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

  /* Crée un nouvel inventaire (comptage vierge à figer plus tard) à partir
     du dernier inventaire validé.
     - last == null  -> renvoie null (rien à reprendre).
     - last.c est COPIÉ EN PROFONDEUR : modifier last.c après coup ne touche
       jamais le résultat (et inversement).
     - locked = false : le nouvel inventaire est modifiable.
     - date = aujourd'hui. */
  function createInventoryFromLastValidated(last) {
    if (last == null) return null;
    return {
      id: 'inv_' + Date.now(),
      date: todayISO(),
      agent: last.agent || '',
      c: deepCopy(last.c),
      locked: false,
      createdAt: Date.now(),
      sourceId: last.id || null
    };
  }

  return {
    todayISO,
    deepCopy,
    createInventoryFromLastValidated
  };
});
