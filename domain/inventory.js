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

  return {
    todayISO,
    deepCopy,
    createInventoryFromLastValidated
  };
});
