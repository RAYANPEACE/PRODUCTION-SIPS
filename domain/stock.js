/* ====== domain/stock.js ======
   Pure stock mechanics shared by Stock, Bilan and Plan.
   No DOM, no IndexedDB, no server access.
*/
(function (root, factory) {
  const api = factory(root || {});
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.StockDomain = api;
    /* Legacy globals for classic scripts already calling these helpers. */
    root.mergeLotsByDate = api.mergeLotsByDate;
    root.buildMpLots = api.buildMpLots;
    root.buildFinishedLots = api.buildFinishedLots;
    root.applyFifo = api.applyFifo;
    root.stockApplyMovements = api.stockApplyMovements;
  }
})(typeof self !== 'undefined' ? self : this, function (root) {
  function defaultNum(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function defaultRound2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function ctx(opt) {
    opt = opt || {};
    return {
      num: opt.num || root.num || defaultNum,
      round2: opt.round2 || root.round2 || defaultRound2,
      refs: opt.refs || root.REFS || [],
      recipes: opt.recipes || root.RECF || {},
      today: opt.today || new Date().toISOString().slice(0, 10),
      endDate: opt.endDate || opt.today || null,
      includeStartDate: !!opt.includeStartDate
    };
  }

  function productTokens(s) {
    const stop = { CARTON: 1, LAIT: 1, EN: 1, POUDRE: 1, X: 1, DE: 1, DU: 1, LA: 1, LE: 1 };
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().match(/[A-Z0-9]+/g)
      ?.filter(t => !stop[t]) || [];
  }

  function inferRecipeProductCode(prod, refs) {
    const exact = refs.find(r => r && r.cat === 'fini' && (r.code === prod || r.des === prod));
    if (exact) return exact.code;
    const want = productTokens(prod);
    let best = null, bestScore = 0;
    refs.filter(r => r && r.cat === 'fini').forEach(r => {
      const got = productTokens(r.des);
      const score = want.filter(t => got.includes(t)).length;
      if (score > bestScore) { best = r; bestScore = score; }
    });
    return bestScore >= 2 && best ? best.code : '';
  }

  function recipeForProduct(prod, recipes, refs) {
    if (recipes && recipes[prod]) return recipes[prod];
    const code = inferRecipeProductCode(prod, refs);
    if (!code) return [];
    const key = Object.keys(recipes || {}).find(k => inferRecipeProductCode(k, refs) === code);
    return key ? (recipes[key] || []) : [];
  }

  function addQty(map, code, qty, h) {
    if (!code || !(qty > 0)) return;
    map[code] = h.round2((map[code] || 0) + qty);
  }

  function ingredientCat(m, codeToRef) {
    const r = codeToRef[m && m.code];
    return (r && r.cat) || '';
  }

  function ingredientText(m) {
    return String(((m && m.des) || '') + ' ' + ((m && m.code) || '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }

  function isFilmIngredient(m, codeToRef) {
    return ingredientCat(m, codeToRef) === 'film' || ingredientText(m).indexOf('FILM') >= 0;
  }

  function isCartonIngredient(m, codeToRef) {
    return ingredientCat(m, codeToRef) === 'carton' || ingredientText(m).indexOf('CARTON') >= 0;
  }

  function isPackagingIngredient(m, codeToRef) {
    const cat = ingredientCat(m, codeToRef);
    const txt = ingredientText(m);
    return cat === 'carton' || cat === 'emballage' || txt.indexOf('CARTON') >= 0 || txt.indexOf('SAC') >= 0 || txt.indexOf('ZIPPER') >= 0;
  }

  function isMpIngredient(m, codeToRef) {
    return ingredientCat(m, codeToRef) === 'mp';
  }

  // Sacs plastique (ex. "SAC PLASTIQUE POUR KRAFT") exclus de la deduction stock : seul le kraft compte.
  function isPlasticSachet(m) {
    return ingredientText(m).indexOf('PLAST') >= 0;
  }

  function addWeightedWaste(conso, recipe, qty, predicate, h, codeToRef) {
    if (!(qty > 0)) return;
    const rows = (recipe || []).filter(m => m && m.code && predicate(m, codeToRef) && h.num(m.qte) > 0);
    const total = rows.reduce((s, m) => s + h.num(m.qte), 0);
    if (!(total > 0)) return;
    rows.forEach(m => addQty(conso, m.code, qty * h.num(m.qte) / total, h));
  }

  function addProductionWaste(conso, recipe, bk, h, codeToRef) {
    const pack = h.num(bk && bk.w_emb);
    if (pack > 0) {
      let rows = (recipe || []).filter(m => m && m.code && isCartonIngredient(m, codeToRef) && h.num(m.qte) > 0);
      if (!rows.length) rows = (recipe || []).filter(m => m && m.code && isPackagingIngredient(m, codeToRef) && !isFilmIngredient(m, codeToRef) && !isPlasticSachet(m) && h.num(m.qte) > 0);
      rows.forEach(m => addQty(conso, m.code, pack * h.num(m.qte), h));
    }
    addWeightedWaste(conso, recipe, h.num(bk && bk.w_film), isFilmIngredient, h, codeToRef);
    addWeightedWaste(conso, recipe, h.num(bk && bk.w_mel), isMpIngredient, h, codeToRef);
  }

  /* Merge lots by date. Empty date means imprecise. */
  function mergeLotsByDate(lots, undatedLast, opt) {
    const h = ctx(opt);
    const map = {}, order = [];
    (lots || []).forEach(l => {
      const k = String((l && l.date) || '');
      if (!map[k]) {
        map[k] = { date: k, qty: 0, imprecise: k === '' };
        order.push(k);
      }
      map[k].qty = h.round2(map[k].qty + h.num(l && l.qty));
    });
    return order.map(k => map[k]).sort((a, b) => {
      if (undatedLast) {
        if (a.imprecise && !b.imprecise) return 1;
        if (!a.imprecise && b.imprecise) return -1;
      }
      return String(a.date).localeCompare(String(b.date));
    });
  }

  function buildMpLots(code, baseLots, baseDate, entreeRecs, desToCode, today, opt) {
    const h = ctx(Object.assign({}, opt || {}, { today: today || (opt && opt.today) }));
    const inWin = d => baseDate && (h.includeStartDate ? String(d || '') >= baseDate : String(d || '') > baseDate) && String(d || '') <= h.today;
    const lots = [];
    if (Array.isArray(baseLots)) {
      baseLots.forEach(l => {
        if (l && h.num(l.qty) !== 0) lots.push({ date: String(l.date || ''), qty: h.round2(h.num(l.qty)) });
      });
    } else if (h.num(baseLots) > 0) {
      lots.push({ date: '', qty: h.round2(h.num(baseLots)) });
    }
    (entreeRecs || []).forEach(r => {
      if (!inWin(r && r.date)) return;
      (r.mp || []).forEach(x => {
        if (!x || !x.a || (desToCode[x.a] || x.a) !== code) return;
        const q = h.num(x.q);
        if (q > 0) lots.push({ date: String(x.exp || ''), qty: h.round2(q) });
      });
    });
    return mergeLotsByDate(lots, true, h);
  }

  function buildFinishedLots(code, baseLots, baseDate, prodRecs, entreeRecs, desToCode, today, opt) {
    const h = ctx(Object.assign({}, opt || {}, { today: today || (opt && opt.today) }));
    const inWin = d => baseDate && (h.includeStartDate ? String(d || '') >= baseDate : String(d || '') > baseDate) && String(d || '') <= h.today;
    const lots = [];
    if (Array.isArray(baseLots)) {
      baseLots.forEach(l => {
        if (l && h.num(l.qty) !== 0) lots.push({ date: String(l.date || ''), qty: h.round2(h.num(l.qty)) });
      });
    } else if (h.num(baseLots) > 0) {
      lots.push({ date: baseDate || '', qty: h.round2(h.num(baseLots)) });
    }
    (prodRecs || []).forEach(p => {
      if (!inWin(p && p.date)) return;
      (p.blocks || []).forEach(bk => {
        const n = h.num(bk && bk.n);
        if (!bk || !bk.p || n <= 0) return;
        if ((desToCode[bk.p] || bk.p) !== code) return;
        lots.push({ date: String(p.date || ''), qty: h.round2(n) });
      });
    });
    (entreeRecs || []).forEach(r => {
      if (!inWin(r && r.date)) return;
      (r.finis || []).forEach(x => {
        if (!x || !x.a || (desToCode[x.a] || x.a) !== code) return;
        const q = h.num(x.q);
        if (q > 0) lots.push({ date: String(r.date || ''), qty: h.round2(q) });
      });
    });
    return mergeLotsByDate(lots, false, h);
  }

  function applyFifo(lots, sortieQty, opt) {
    const h = ctx(opt);
    let rest = h.num(sortieQty);
    lots.forEach(l => { l.rest = l.qty; });
    for (const l of lots) {
      if (rest <= 0) break;
      const take = Math.min(l.rest, rest);
      l.rest = h.round2(l.rest - take);
      rest = h.round2(rest - take);
    }
    if (rest > 1e-9) {
      if (lots.length) {
        lots[lots.length - 1].rest = h.round2(lots[lots.length - 1].rest - rest);
      } else {
        lots.push({ date: '', qty: 0, imprecise: true, rest: h.round2(-rest) });
      }
    }
    return lots;
  }

  function stockApplyMovements(baseDate, prodRecs, entreeRecs, sortieRecs, opt) {
    const h = ctx(opt);
    const desToCode = {};
    const codeToRef = {};
    h.refs.forEach(r => { if (r && r.code) codeToRef[r.code] = r; });
    h.refs.forEach(r => {
      if (!r || !r.code) return;
      desToCode[r.code] = r.code;
      desToCode[r.des] = r.code;
    });
    Object.keys(h.recipes || {}).forEach(prod => {
      const code = inferRecipeProductCode(prod, h.refs);
      if (code) desToCode[prod] = code;
    });
    const endDate = String(h.endDate || h.today);
    const inWin = d => baseDate && (h.includeStartDate ? String(d || '') >= baseDate : String(d || '') > baseDate) && String(d || '') <= endDate;
    const add = {}, conso = {}, en = {}, so = {};
    let nbMov = 0;

    (prodRecs || []).forEach(p => {
      if (!inWin(p && p.date)) return;
      nbMov++;
      (p.blocks || []).forEach(bk => {
        const n = h.num(bk && bk.n);
        if (!bk || !bk.p || n <= 0) return;
        const code = desToCode[bk.p];
        if (code) add[code] = (add[code] || 0) + n;
        const recipe = recipeForProduct(bk.p, h.recipes, h.refs);
        recipe.forEach(m => {
          if (m && m.code) addQty(conso, m.code, n * h.num(m.qte), h);
        });
        addProductionWaste(conso, recipe, bk, h, codeToRef);
      });
    });

    const addMov = (arr, obj) => (arr || []).forEach(r => {
      if (!inWin(r && r.date)) return;
      nbMov++;
      [].concat(r.finis || [], r.mp || []).forEach(x => {
        if (!x || !x.a) return;
        const c = desToCode[x.a];
        if (c && h.num(x.q) > 0) obj[c] = (obj[c] || 0) + h.num(x.q);
      });
    });
    addMov(entreeRecs, en);
    addMov(sortieRecs, so);

    return { add, conso, en, so, nbMov, desToCode, today: endDate };
  }

  return {
    mergeLotsByDate,
    buildMpLots,
    buildFinishedLots,
    applyFifo,
    stockApplyMovements
  };
});
