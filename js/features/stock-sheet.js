/* ================= D — FEUILLE ETAT DE STOCK THEORIQUE (lecture seule, tous roles) =================
   Stock theorique = dernier inventaire valide (base) + production + entrees − sorties − consommation(RECF).
   Source officielle : records VALIDES serveur ; repli local (idb) si aucun serveur.
   Detail par lot + FIFO pour les produits finis (lots derives des productions, date = date de prod).
   Aucune route serveur nouvelle : tout est derive a la lecture des records existants.
   Reutilise les globals : REFS, RECF, ETAT, ETAT_DATE, ST, RO, total, round2, num, mergeAndMigrate,
   catOf, grpDe, fmtq, esc, sipsRecords, idbAll, $. */

/* ---- Fonctions pures (testables hors navigateur) ---- */

/* Lots d'un produit fini, tries du plus ANCIEN au plus recent (le lot "base inventaire" est le plus ancien).
   base = quantite du dernier inventaire valide ; prodRecs/entreeRecs = payloads de mouvements. */
function buildFinishedLots(code, base, baseDate, prodRecs, entreeRecs, desToCode, today){
  const inWin = d => baseDate && String(d || '') > baseDate && String(d || '') <= today;
  const lots = [];
  if (base > 0) lots.push({ date: baseDate || '', qty: round2(base), source: 'inventaire' });
  (prodRecs || []).forEach(p => {
    if (!inWin(p && p.date)) return;
    (p.blocks || []).forEach(bk => {
      const n = num(bk && bk.n);
      if (!bk || !bk.p || n <= 0) return;
      if (desToCode[bk.p] !== code) return;
      lots.push({ date: String(p.date || ''), qty: round2(n), source: 'production' });
    });
  });
  (entreeRecs || []).forEach(r => {
    if (!inWin(r && r.date)) return;
    (r.finis || []).forEach(x => {
      if (!x || !x.a || desToCode[x.a] !== code) return;
      const q = num(x.q);
      if (q > 0) lots.push({ date: String(r.date || ''), qty: round2(q), source: 'entree' });
    });
  });
  lots.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  return lots;
}

/* FIFO : consomme sortieQty en commencant par le lot le plus ancien. Pose l.rest sur chaque lot.
   Si les sorties depassent le stock (incoherence terrain), le dernier lot devient negatif (signale). */
function applyFifo(lots, sortieQty){
  let rest = num(sortieQty);
  lots.forEach(l => { l.rest = l.qty; });
  for (const l of lots) {
    if (rest <= 0) break;
    const take = Math.min(l.rest, rest);
    l.rest = round2(l.rest - take);
    rest = round2(rest - take);
  }
  if (rest > 1e-9 && lots.length) {
    lots[lots.length - 1].rest = round2(lots[lots.length - 1].rest - rest);
  }
  return lots;
}

/* Applique les flux de mouvements sur une fenetre (date > baseDate, <= today). Renvoie les agregats. */
function stockApplyMovements(baseDate, prodRecs, entreeRecs, sortieRecs){
  const desToCode = {}; REFS.forEach(r => { desToCode[r.des] = r.code; });
  const today = new Date().toISOString().slice(0, 10);
  const inWin = d => baseDate && String(d || '') > baseDate && String(d || '') <= today;
  const add = {}, conso = {}, en = {}, so = {};
  let nbMov = 0;
  (prodRecs || []).forEach(p => {
    if (!inWin(p && p.date)) return; nbMov++;
    (p.blocks || []).forEach(bk => {
      const n = num(bk && bk.n);
      if (!bk || !bk.p || n <= 0) return;
      const code = desToCode[bk.p];
      if (code) add[code] = (add[code] || 0) + n;
      (RECF[bk.p] || []).forEach(m => { if (m && m.code) conso[m.code] = (conso[m.code] || 0) + n * num(m.qte); });
    });
  });
  const addMov = (arr, obj) => (arr || []).forEach(r => {
    if (!inWin(r && r.date)) return; nbMov++;
    [].concat(r.finis || [], r.mp || []).forEach(x => {
      if (!x || !x.a) return;
      const c = desToCode[x.a];
      if (c && num(x.q) > 0) obj[c] = (obj[c] || 0) + num(x.q);
    });
  });
  addMov(entreeRecs, en); addMov(sortieRecs, so);
  return { add, conso, en, so, nbMov, desToCode, today };
}

/* ---- Sources de donnees ---- */

async function stockServerSource(){
  let inv = [], prod = [], ent = [], sort = [];
  try { inv = await sipsRecords('inventory', { timeoutMs: 1500 }); } catch (e) { inv = []; }
  try { prod = await sipsRecords('production', { timeoutMs: 1500 }); } catch (e) { prod = []; }
  try { ent = await sipsRecords('entree', { timeoutMs: 1500 }); } catch (e) { ent = []; }
  try { sort = await sipsRecords('sortie', { timeoutMs: 1500 }); } catch (e) { sort = []; }
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

/* Base par code depuis un snapshot d'inventaire : init = ETAT manuel, ecrase par le compte si counted. */
function stockBaseMap(baseST){
  const baseMap = {};
  REFS.forEach(r => { const v = ETAT[r.code]; baseMap[r.code] = (v != null && v !== '') ? num(v) : 0; });
  if (baseST && baseST.c) {
    const prevST = ST, prevRO = RO;
    try {
      ST = JSON.parse(JSON.stringify(baseST)); RO = true; mergeAndMigrate();
      REFS.forEach(r => { if (ST.c[r.code] && ST.c[r.code].counted) baseMap[r.code] = round2(total(r)); });
    } finally { ST = prevST; RO = prevRO; }
  }
  return baseMap;
}

/* ---- Assemblage ---- */

async function computeStockData(){
  let src = await stockServerSource();
  if (!src) src = await stockLocalSource();
  const baseMap = stockBaseMap(src.baseST);
  const fl = stockApplyMovements(src.baseDate, src.prod, src.entree, src.sortie);
  const rows = [];
  REFS.forEach(r => {
    const c = r.code, cat = catOf(c), grp = grpDe(cat);
    const base = num(baseMap[c]);
    const flux = (fl.add[c] || 0) + (fl.en[c] || 0) - (fl.so[c] || 0) - (fl.conso[c] || 0);
    const stock = round2(base + flux);
    const arrow = Math.abs(flux) < 1e-9 ? 0 : (flux > 0 ? 1 : -1);
    const row = { code: c, des: r.des, unite: r.ub || r.u || '', cat, grp, base: round2(base), flux: round2(flux), stock, arrow, lots: null };
    if (grp === 'fini' && src.baseDate) {
      const lots = buildFinishedLots(c, base, src.baseDate, src.prod, src.entree, fl.desToCode, fl.today);
      // FIFO deduit les sorties ET l'eventuelle consommation RECF (si un produit fini sert d'ingredient),
      // pour que la somme des restants des lots egale toujours le stock agrege (base + flux).
      applyFifo(lots, (fl.so[c] || 0) + (fl.conso[c] || 0));
      row.lots = lots;
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

function stockSheetHTML(data){
  const fams = [['mp', 'Matieres premieres', '#1f7a4d'], ['emballage', 'Emballages', '#1b5faa'], ['fini', 'Produits finis', '#8a6d3b'], ['autre', 'Autres', '#6a7280']];
  let h = '<div class="bil-pair ' + (data.meta.hasBase ? 'ok' : 'warn') + '">' + stockNote(data.meta) + '</div>';
  fams.forEach(fam => {
    const rs = data.rows.filter(x => x.grp === fam[0]);
    if (!rs.length) return;
    rs.sort((a, b) => String(a.code).localeCompare(String(b.code)));
    h += '<section class="bil-sec"><div class="bil-sec-h" style="background:' + fam[2] + '">' + fam[1] + ' <span class="gn">(' + rs.length + ')</span></div><div class="bil-lines">';
    rs.forEach(x => {
      const ar = x.arrow > 0
        ? '<span title="en hausse" style="color:var(--green)">▲</span>'
        : (x.arrow < 0 ? '<span title="en baisse" style="color:var(--red)">▼</span>' : '<span title="stable" style="color:#9aa7b0">=</span>');
      const negStyle = x.stock < 0 ? ' style="color:var(--red)"' : '';
      h += '<div class="bil-line">'
        + '<div class="bl-id"><span class="bl-code">' + x.code + '</span> ' + esc(x.des) + '</div>'
        + '<div class="bl-tp">base <b>' + fmtq(x.base) + '</b> · flux <b>' + (x.flux > 0 ? '+' : '') + fmtq(x.flux) + '</b></div>'
        + '<div class="bl-ec"><b' + negStyle + '>' + fmtq(x.stock) + ' ' + esc(x.unite) + '</b> ' + ar + '</div>';
      const visibleLots = x.lots ? x.lots.filter(l => Math.abs(l.rest) > 1e-9 || l.source === 'inventaire') : [];
      if (visibleLots.length) {
        h += '<div class="bl-st"><button class="b-sec" data-stk-toggle="' + esc(x.code) + '" style="font-size:11px;padding:2px 8px">Lots (' + visibleLots.length + ')</button></div>';
        h += '<div class="stk-lots" id="stklots-' + esc(x.code) + '" style="display:none;flex-basis:100%;margin-top:4px;padding-left:6px">'
          + visibleLots.map(l => {
            const lbl = l.source === 'inventaire' ? 'lot base inventaire' : (l.source === 'entree' ? 'lot (entree)' : 'lot');
            const note = l.source === 'inventaire' ? ' <em style="color:#9a6500">(sans date de lot precise)</em>' : '';
            const rNeg = l.rest < 0 ? ' style="color:var(--red)"' : '';
            return '<div style="font-size:12px;color:#556">' + lbl + ' <b>' + esc(l.date || '?') + '</b> — restant <b' + rNeg + '>' + fmtq(l.rest) + '</b>' + note + '</div>';
          }).join('')
          + '<div style="font-size:11px;color:#9aa7b0;margin-top:2px">FIFO : le lot le plus ancien sort en premier.</div></div>';
      }
      h += '</div>';
    });
    h += '</div></section>';
  });
  return h;
}

async function renderStock(){
  const app = $('#app');
  app.innerHTML = '<div class="bilan-wrap">'
    + '<div class="bil-ctrl"><button id="stkRefresh" class="bil-print">Actualiser</button></div>'
    + '<h2 class="prod-title">Etat de stock theorique</h2>'
    + '<div id="stkBody"><p class="ref-hint">Calcul du stock…</p></div></div>';
  const rb = $('#stkRefresh'); if (rb) rb.onclick = renderStock;
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
}
