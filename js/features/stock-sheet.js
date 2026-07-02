/* ================= D — FEUILLE ETAT DE STOCK THEORIQUE (lecture seule, tous roles) =================
   Stock theorique = dernier inventaire valide (base) + production + entrees - sorties - consommation(recettes + dechets).
   Source officielle : records VALIDES serveur ; repli local (idb) si aucun serveur.
   Detail par lot + FIFO pour les produits finis (lots derives des productions, date = date de prod).
   Aucune route serveur nouvelle : tout est derive a la lecture des records existants.
   Reutilise les globals : REFS, RECF, ETAT, ETAT_DATE, ST, RO, total, round2, num, mergeAndMigrate,
   catOf, grpDe, fmtq, esc, sipsRecords, idbAll, $. */

/* ---- Mecanique pure partagee : domain/stock.js expose StockDomain + les aliases globaux. ---- */

/* ---- Sources de donnees ---- */

async function stockServerSource(){
  const opt = { timeoutMs: 8000, compact: true, strict: true };
  const reads = await Promise.allSettled([
    sipsRecords('inventory', opt),
    sipsRecords('production', opt),
    sipsRecords('entree', opt),
    sipsRecords('sortie', opt)
  ]);
  if (reads.every(r => r.status === 'rejected')) return null;
  if (reads.some(r => r.status === 'rejected')) throw new Error('Lecture serveur incomplete : impossible de calculer un stock fiable. Verifie la connexion puis Actualiser.');
  const inv = reads[0].value || [], prod = reads[1].value || [], ent = reads[2].value || [], sort = reads[3].value || [];
  if (!(inv.length || prod.length || ent.length || sort.length)) return null;
  const invs = inv.filter(r => r && r.payload && r.payload.st && r.payload.st.c)
    .sort((a, b) => String(a.payload.date || '').localeCompare(String(b.payload.date || ''))
      || ((Date.parse(a.validatedAt || '') || 0) - (Date.parse(b.validatedAt || '') || 0)));
  const base = invs[invs.length - 1] || null;
  return {
    source: 'serveur',
    baseST: base ? base.payload.st : null,
    baseDate: base ? String(base.payload.date || '') : (ETAT_DATE || ''),
    baseKind: base ? 'inventory' : (ETAT_DATE ? 'etat' : ''),
    prod: prod.map(r => r.payload || {}),
    entree: ent.map(r => r.payload || {}),
    sortie: sort.map(r => r.payload || {})
  };
}

async function stockLocalSource(){
  let recs = []; try { recs = await idbAll(); } catch (e) { recs = []; }
  const isInv = r => r && r.locked && r.st && r.st.c && r.id !== 'current'
    && String(r.id).indexOf('prod_') !== 0 && String(r.id).indexOf('sortie_') !== 0
    && String(r.id).indexOf('entree_') !== 0 && String(r.id).indexOf('fragsess_') !== 0
    && String(r.id).indexOf('batch_') !== 0;
  const invs = recs.filter(isInv)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || ((a.savedAt || 0) - (b.savedAt || 0)));
  const base = invs[invs.length - 1] || null;
  return {
    source: 'local',
    baseST: base ? base.st : null,
    baseDate: base ? String(base.date || '') : (ETAT_DATE || ''),
    baseKind: base ? 'inventory' : (ETAT_DATE ? 'etat' : ''),
    prod: recs.filter(r => String(r.id).indexOf('prod_') === 0),
    entree: recs.filter(r => String(r.id).indexOf('entree_') === 0),
    sortie: recs.filter(r => String(r.id).indexOf('sortie_') === 0)
  };
}

/* Base par code depuis un snapshot d'inventaire : init = ETAT manuel, ecrase par le compte si counted.
   E2 : extrait aussi les LOTS REELS par bloc des produits finis comptes (date = blk.date de la saisie),
   pour remplacer le lot de base agrege. baseLots[code] = [{date, qty}] ; Somme(qty) === baseMap[code].
   Utilise les globals d'inventory-core (ensureBlocks, blockHasInput, blockTotal, isFini, pOf) dispo
   a l'execution navigateur ; reste hors des fonctions pures testees en VM. */
function stockBaseMap(baseST){
  const baseMap = {}, baseLots = {};
  REFS.forEach(r => { const v = ETAT[r.code]; baseMap[r.code] = (v != null && v !== '') ? num(v) : 0; });
  if (baseST && baseST.c) {
    const prevST = ST, prevRO = RO;
    try {
      ST = JSON.parse(JSON.stringify(baseST)); RO = true; mergeAndMigrate();
      REFS.forEach(r => {
        const e = ST.c[r.code];
        if (!e || !e.counted) return;
        baseMap[r.code] = round2(total(r));
        const wantsLots = (typeof isFini === 'function' && isFini(r)) || (typeof isPerishableMp === 'function' && isPerishableMp(r));
        if (wantsLots && typeof ensureBlocks === 'function') {
          ensureBlocks(r, e);
          const lots = [];
          (e.blocks || []).forEach(blk => {
            if (typeof blockHasInput === 'function' && !blockHasInput(r, blk)) return;
            lots.push({ date: String((blk && blk.date) || ''), qty: round2(blockTotal(r, blk, (blk && blk.cfg) || pOf(r))) });
          });
          if (lots.length) baseLots[r.code] = lots;
        }
      });
    } finally { ST = prevST; RO = prevRO; }
  }
  return { baseMap: baseMap, baseLots: baseLots };
}

/* ---- Assemblage ---- */

async function computeStockData(){
  let src = await stockServerSource();
  if (!src) src = await stockLocalSource();
  const bm = stockBaseMap(src.baseST);
  const baseMap = bm.baseMap, baseLotsMap = bm.baseLots;
  const fl = stockApplyMovements(src.baseDate, src.prod, src.entree, src.sortie, { refs: REFS, recipes: RECF, num: num, round2: round2, includeStartDate: true });
  const rows = [];
  REFS.forEach(r => {
    const c = r.code, cat = catOf(c), grp = grpDe(cat);
    const base = num(baseMap[c]);
    const flux = (fl.add[c] || 0) + (fl.en[c] || 0) - (fl.so[c] || 0) - (fl.conso[c] || 0);
    const stock = round2(base + flux);
    const arrow = Math.abs(flux) < 1e-9 ? 0 : (flux > 0 ? 1 : -1);
    const row = { code: c, des: r.des, unite: r.ub || r.u || '', cat, grp, base: round2(base), flux: round2(flux), stock, arrow, lots: null, lotKind: null };
    const bl = (baseLotsMap[c] && baseLotsMap[c].length) ? baseLotsMap[c] : base;
    if (grp === 'fini' && src.baseDate) {
      // E2 : vrais lots finis par bloc (FIFO par date de production).
      const lots = buildFinishedLots(c, bl, src.baseDate, src.prod, src.entree, fl.desToCode, fl.today, { includeStartDate: true });
      // FIFO deduit les sorties ET l'eventuelle consommation RECF (si un produit fini sert d'ingredient),
      // pour que la somme des restants des lots egale toujours le stock agrege (base + flux).
      applyFifo(lots, (fl.so[c] || 0) + (fl.conso[c] || 0));
      row.lots = lots; row.lotKind = 'fini';
    } else if (typeof isPerishableMp === 'function' && isPerishableMp(r) && src.baseDate) {
      // E3 : lots de matiere perissable (FEFO par date de peremption). Conso MP = sorties + RECF.
      const lots = buildMpLots(c, bl, src.baseDate, src.entree, fl.desToCode, fl.today, { includeStartDate: true });
      applyFifo(lots, (fl.so[c] || 0) + (fl.conso[c] || 0));
      row.lots = lots; row.lotKind = 'mp';
    }
    rows.push(row);
  });
  const meta = { source: src.source, baseDate: src.baseDate, baseKind: src.baseKind, hasBase: !!src.baseDate, nbMov: fl.nbMov };
  return { rows: rows, meta: meta };
}

/* ---- Rendu (onglet Stock) ---- */

function stockNote(meta){
  if (!meta.hasBase) {
    return 'Base = etat de stock manuel (aucune date de reference : flux non projetes). Valide un inventaire serveur ou renseigne la date de l etat de stock dans Referentiels.';
  }
  const src = meta.baseKind === 'inventory'
    ? ('dernier inventaire valide du <b>' + esc(meta.baseDate || '?') + '</b>')
    : ('etat de stock du <b>' + esc(meta.baseDate || '?') + '</b>');
  const badge = meta.source === 'serveur'
    ? '<b style="color:var(--green)">officiel serveur</b>'
    : '<b style="color:#9a6500">local (repli, serveur indisponible)</b>';
  return 'Stock theorique = ' + src + ' + production + entrees − sorties − consommation. '
    + meta.nbMov + ' mouvement(s) pris en compte. Source : ' + badge + '.';
}

function stockLotAlertHTML(x, lots){
  if(!lots||!lots.length)return '';
  let red=false,yellow=false;
  const isMp=x.lotKind==='mp';
  lots.forEach(l=>{
    if(l.imprecise){yellow=true;return;}
    const info=isMp
      ? ((typeof expInfo==='function')?expInfo(l.date):null)
      : ((typeof prodInfo==='function')?prodInfo(l.date):null);
    if(!info)return;
    if(info.cls==='exp-ko')red=true;
    else if(info.cls==='exp-warn'||info.cls==='exp-soon')yellow=true;
  });
  if(red)return '<span class="stock-lot-alert red" title="Lot perime, trop ancien ou incoherent">⚠</span>';
  if(yellow)return '<span class="stock-lot-alert yellow" title="Lot proche de la limite ou date manquante">⚠</span>';
  return '';
}

function stockSheetHTML(data){
  const fams = [['mp', 'Matieres premieres', '#1f7a4d'], ['emballage', 'Emballages', '#1b5faa'], ['fini', 'Produits finis', '#8a6d3b'], ['autre', 'Autres', '#6a7280']];
  let h = '<div class="bil-pair ' + (data.meta.hasBase ? 'ok' : 'warn') + '">' + stockNote(data.meta) + '</div>';
  fams.forEach(fam => {
    const rs = data.rows.filter(x => x.grp === fam[0]);
    if (!rs.length) return;
    rs.sort((a, b) => String(a.code).localeCompare(String(b.code)));
    h += '<details class="bil-sec stock-sec" data-stk-section><summary class="bil-sec-h" style="background:' + fam[2] + '"><span>' + fam[1] + ' <span class="gn">(' + rs.length + ')</span></span><span class="stk-fold"></span></summary><div class="bil-lines">';
    rs.forEach(x => {
      const ar = x.arrow > 0
        ? '<span title="en hausse" style="color:var(--green)">▲</span>'
        : (x.arrow < 0 ? '<span title="en baisse" style="color:var(--red)">▼</span>' : '<span title="stable" style="color:#9aa7b0">=</span>');
      const negStyle = x.stock < 0 ? ' style="color:var(--red)"' : '';
      const fluxClass = x.flux > 0 ? 'pos' : (x.flux < 0 ? 'neg' : 'zero');
      const mvClass = x.arrow > 0 ? ' mv-up' : (x.arrow < 0 ? ' mv-down' : '');
      h += '<div class="bil-line' + mvClass + '">'
        + '<div class="bl-id"><span class="bl-code">' + x.code + '</span> ' + hlLaity(x.des) + '</div>'
        + '<div class="bl-tp">base <b>' + fmtq(x.base) + '</b> · flux <b class="stock-flux ' + fluxClass + '">' + (x.flux > 0 ? '+' : '') + fmtq(x.flux) + '</b></div>'
        + '<div class="bl-ec"><b' + negStyle + '>' + fmtq(x.stock) + ' ' + esc(x.unite) + '</b> ' + ar + '</div>';
      const isMp = x.lotKind === 'mp';
      const visibleLots = x.lots ? x.lots.filter(l => Math.abs(l.rest) > 1e-9 || l.imprecise) : [];
      if (visibleLots.length) {
        h += '<div class="bl-st">' + stockLotAlertHTML(x, visibleLots) + '<button class="b-sec" data-stk-toggle="' + esc(x.code) + '" style="font-size:11px;padding:2px 8px">Lots (' + visibleLots.length + ')</button></div>';
        h += '<div class="stk-lots" id="stklots-' + esc(x.code) + '" style="display:none;flex-basis:100%;margin-top:4px;padding-left:6px">'
          + visibleLots.map(l => {
            let lbl, note = '';
            if (l.imprecise) {
              lbl = isMp ? 'lot sans date de peremption' : 'lot sans date precise';
              note = ' <em style="color:#9a6500">(' + (isMp ? 'date de peremption manquante' : 'date de production manquante') + ')</em>';
            } else if (isMp) {
              lbl = 'perime le <b>' + esc(l.date) + '</b>';
              const info = (typeof expInfo === 'function') ? expInfo(l.date) : null;
              if (info) {
                const col = info.cls === 'exp-ko' ? 'var(--red)' : (info.cls === 'exp-warn' ? '#d2691e' : (info.cls === 'exp-soon' ? '#b8860b' : 'var(--green)'));
                note = ' <em style="color:' + col + '">' + esc(info.txt) + '</em>';
              }
            } else {
              lbl = 'produit le <b>' + esc(l.date) + '</b>';
              const info = (typeof prodInfo === 'function') ? prodInfo(l.date) : null;
              if (info) {
                const col = info.cls === 'exp-ko' ? 'var(--red)' : 'var(--green)';
                note = ' <em style="color:' + col + '">' + esc(info.txt) + '</em>';
              }
            }
            const rNeg = l.rest < 0 ? ' style="color:var(--red)"' : '';
            return '<div style="font-size:12px;color:#556">' + lbl + ' — restant <b' + rNeg + '>' + fmtq(l.rest) + '</b>' + note + '</div>';
          }).join('')
          + '<div style="font-size:11px;color:#9aa7b0;margin-top:2px">' + (isMp ? 'FEFO : le lot qui perime le plus tot sort en premier.' : 'FIFO : le lot le plus ancien sort en premier.') + '</div></div>';
      }
      h += '</div>';
    });
    h += '</div></details>';
  });
  return h;
}

async function renderStock(){
  const app = $('#app');
  app.innerHTML = '<div class="bilan-wrap">'
    + '<div class="bil-ctrl stock-ctrl"><button id="stkRefresh" class="bil-print">Actualiser</button><button id="stkCollapseAll" class="bil-print">Tout replier</button></div>'
    + '<h2 class="prod-title">Etat de stock theorique</h2>'
    + '<div id="stkBody"><p class="ref-hint">Calcul du stock…</p></div></div>';
  const rb = $('#stkRefresh'); if (rb) rb.onclick = renderStock;
  const cb = $('#stkCollapseAll'); if (cb) cb.onclick = function () {
    document.querySelectorAll('#stkBody [data-stk-section]').forEach(function (d) { d.open = false; });
  };
  const ctrl = app.querySelector('.stock-ctrl');
  if (ctrl) {
    const header = document.querySelector('header');
    const banner = document.getElementById('roBanner');
    const off = (header ? header.offsetHeight : 0) + (banner && banner.style.display !== 'none' ? banner.offsetHeight : 0);
    ctrl.style.top = off + 'px';
  }
  let data;
  try { data = await computeStockData(); }
  catch (e) { const b = $('#stkBody'); if (b) b.innerHTML = '<p style="color:var(--red);font-size:13px">Stock indisponible : ' + esc(e.message) + '</p>'; return; }
  const body = $('#stkBody'); if (!body) return;
  body.innerHTML = stockSheetHTML(data);
  body.querySelectorAll('[data-stk-toggle]').forEach(function (b) {
    b.onclick = function () {
      const el = document.getElementById('stklots-' + b.dataset.stkToggle);
      if (el) el.style.display = (el.style.display === 'none') ? 'block' : 'none';
    };
  });
  body.querySelectorAll('[data-stk-section]').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) setTimeout(function () {
        // Aligner le haut de la section juste sous la barre de boutons collee, sinon elle masque la 1re ligne.
        const ctrl = document.querySelector('.stock-ctrl');
        const barBottom = ctrl ? ctrl.getBoundingClientRect().bottom : 0;
        const top = d.getBoundingClientRect().top;
        window.scrollBy({ top: top - barBottom - 8, behavior: 'smooth' });
      }, 60);
    });
  });
}
