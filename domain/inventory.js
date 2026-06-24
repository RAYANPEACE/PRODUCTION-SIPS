/* ====== domain/inventory.js ======
   Logique métier pure (aucune dépendance externe, aucun accès DOM/IndexedDB).
   Utilisable dans le navigateur (window.InventoryDomain) et dans Node (module.exports).
*/
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;            // Node : require('./domain/inventory')
  } else {
    root.InventoryDomain = api;      // Navigateur : window.InventoryDomain
  }
})(typeof self !== 'undefined' ? self : this, function () {

  /* Date du jour au format ISO (YYYY-MM-DD), en heure locale. */
  function todayISO(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /* Copie profonde sans dépendance. Les comptages (`c`) sont des données
     simples (objets/tableaux/nombres/chaînes), donc le clone JSON suffit. */
  function deepCopy(v) {
    if (v == null) return v;
    return JSON.parse(JSON.stringify(v));
  }

  /* Crée un nouvel inventaire (comptage modifiable, à figer plus tard) à partir
     du dernier inventaire validé.
     - last == null  -> renvoie null (rien à reprendre).
     - TOUT `last` est COPIÉ EN PROFONDEUR (comptages `c`, réglages `cfg`, etc.) :
       modifier `last` après coup ne touche jamais le résultat (et inversement).
     - locked = false : le nouvel inventaire est modifiable.
     - date = aujourd'hui ; nouvel `id` ; nouvelle session de comptage.
     - `sourceId` garde une trace de l'inventaire validé d'origine. */
  function createInventoryFromLastValidated(last) {
    if (last == null) return null;
    const inv = deepCopy(last);
    inv.id = 'inv_' + Date.now();
    inv.date = todayISO();
    inv.locked = false;
    inv.sessionStart = Date.now();
    inv.createdAt = Date.now();
    inv.sourceId = last.id || null;
    return inv;
  }

  /* Détecteur générique « un bloc a-t-il une saisie ? » (sans dépendance DOM).
     Reproduit la logique de blockHasInput de inventory-core pour les modes
     carton/sac/vrac/tare/simple. Sert de repli quand aucun helper n'est injecté. */
  function defaultBlockHasInput(r, b) {
    if (!b) return false;
    const nz = v => String(v == null ? '' : v).trim() !== '';
    if (Array.isArray(b.pleines) && b.pleines.some(nz)) return true;
    if (Array.isArray(b.entamees) && b.entamees.some(a => a && (nz(a.et) || nz(a.vrac)))) return true;
    if (Array.isArray(b.partielles) && b.partielles.some(nz)) return true;
    if (nz(b.kg)) return true;
    if (Array.isArray(b.weighings) && b.weighings.some(w => w && nz(w.brut))) return true;
    if (nz(b.val)) return true;
    return false;
  }

  /* E1 — Garde-fou « date de production ». Liste les PRODUITS FINIS comptés
     ayant au moins un lot (bloc) avec une saisie mais SANS date de production.
     Pure : aucune dépendance DOM/IndexedDB. Les helpers (isFini, blockHasInput,
     ensureBlocks) sont injectés par l'app ; des replis raisonnables existent
     pour les tests.
       entries : map { code -> entry (ST.c[code]) }
       refs    : REFS
       h       : { isFini?, blockHasInput?, ensureBlocks? }
     Retour : [{ code, des, nbLots }]  (vide = rien ne bloque). */
  function lotsMissingProdDate(entries, refs, h) {
    h = h || {};
    const isFini = h.isFini || (r => !!r && (r.cat === 'fini' || r.g === 'fini'));
    const blockHasInput = h.blockHasInput || defaultBlockHasInput;
    const ensureBlocks = h.ensureBlocks || null;
    const out = [];
    (refs || []).forEach(r => {
      if (!isFini(r)) return;
      const e = entries && entries[r.code];
      if (!e || !e.counted) return;
      if (ensureBlocks) ensureBlocks(r, e);
      const blocks = Array.isArray(e.blocks) ? e.blocks : [];
      let nbLots = 0;
      blocks.forEach(b => {
        if (blockHasInput(r, b) && !String((b && b.date) || '').trim()) nbLots++;
      });
      if (nbLots > 0) out.push({ code: r.code, des: r.des, nbLots: nbLots });
    });
    return out;
  }

  return {
    todayISO,
    deepCopy,
    createInventoryFromLastValidated,
    defaultBlockHasInput,
    lotsMissingProdDate
  };
});
