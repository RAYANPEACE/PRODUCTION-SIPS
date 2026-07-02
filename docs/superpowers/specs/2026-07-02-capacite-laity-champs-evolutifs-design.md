# Design — Capacité/Plan stock théorique, LAITY bleu, champs évolutifs

Date : 2026-07-02
Statut : validé (design), à planifier

## Contexte

Trois demandes utilisateur regroupées :

1. L'onglet **Capacité** (et **Plan**) doit afficher le vrai stock théorique
   actualisé (inventaire de base + production + entrées − sorties − conso), pas la
   valeur brute du dernier inventaire. Symptôme réel : inventaire à 1800 kg, une
   sortie du jour ramène le stock réel à ~1300, mais Capacité affiche encore 1800.
2. Le produit **LAITY** doit apparaître **en bleu** partout dans l'interface pour
   le différencier de DIAMO et éviter les erreurs de saisie.
3. Rendre certaines listes déroulantes **évolutives** (mémorisent les saisies) et
   ajouter des champs structurés aux entrées/sorties : matricule véhicule,
   chauffeur, destinataire (sortie) / provenance (entrée).

## Décisions utilisateur

- Champs évolutifs → **champ texte + suggestions** (datalist HTML natif).
- Nouveaux champs → **Sortie** : matricule + chauffeur + destinataire ;
  **Entrée** : matricule + chauffeur + provenance.
- LAITY bleu → **partout dans l'interface HTML** ; PDF laissés en noir.

---

## Volet 1 & 2 — Capacité & Plan lisent le vrai stock théorique

### Cause racine

Il existe deux implémentations parallèles du « stock théorique » :

- **Onglet Stock** — `computeStockData()` dans `js/features/stock-sheet.js`.
  Source officielle (roadmap D). Serveur prioritaire, repli local. Appelle
  `stockApplyMovements(..., { includeStartDate: true })` → inclut les mouvements
  datés du **même jour** que l'inventaire de base.
- **Capacité/Plan** — `refreshLiveStock()` dans `js/features/capacity-plan.js:156`.
  Local-only. Appelle `stockApplyMovements(...)` **sans** `includeStartDate`
  (défaut `false`) → **exclut** les mouvements du jour de l'inventaire.

La sortie du jour, datée du même jour que l'inventaire validé, est donc ignorée par
Capacité/Plan mais prise en compte par l'onglet Stock → écart 1800 vs 1300.

### Correctif

Réécrire le corps de `refreshLiveStock()` pour **réutiliser `computeStockData()`**
au lieu de recalculer sa propre base + flux :

```js
async function refreshLiveStock(){
  LIVESTOCK={}; LIVEMETA={hasBase:false,baseDate:null,nbMov:0};
  try{
    const data=await computeStockData();          // source officielle (onglet Stock)
    (data.rows||[]).forEach(r=>{ LIVESTOCK[r.code]=num(r.stock); });
    const m=data.meta||{};
    LIVEMETA={hasBase:!!m.hasBase, baseDate:m.baseDate||null, baseKind:m.baseKind||'', nbMov:m.nbMov||0};
  }catch(e){
    LIVESTOCK=null;                               // repli : stockDispo() retombe sur ETAT/inventaire courant
  }
}
```

Conséquences :

- `stockDispo(code)`, `computeCapacite()`, `computeCapaciteFromStock()`, tout le
  plan (`buildReste`, `simulerB`) restent inchangés : ils consomment `LIVESTOCK`.
- `liveStockNote()` reste compatible (`LIVEMETA.baseKind`/`baseDate`/`nbMov` toujours
  fournis). Vérifier le libellé — `baseKind` vaut `'inventory'` ou `'etat'`, comme
  aujourd'hui.
- **Une seule source de vérité** : Capacité, Plan et onglet Stock affichent
  désormais toujours la même valeur ; l'écart ne peut plus réapparaître.
- Capacité/Plan deviennent serveur-prioritaires (comme l'onglet Stock). Le repli
  local existe déjà dans `computeStockData()` via `stockLocalSource()`.

### Dépendance de chargement

`computeStockData` est défini dans `js/features/stock-sheet.js`. Vérifier l'ordre des
scripts dans `index.html` : `stock-sheet.js` doit être chargé **avant**
`capacity-plan.js` (ou au moins avant tout appel). `refreshLiveStock` est appelé de
façon asynchrone à l'entrée des onglets (`switchTab`), donc la définition doit exister
au moment de l'appel — vérifier/ajuster l'ordre si besoin.

### Test manuel

1. Valider un inventaire d'une matière à 1800.
2. Saisir une sortie **du même jour** ramenant à 1300.
3. Onglet Stock affiche 1300 → Capacité et Plan doivent aussi partir de 1300.

---

## Volet 3 — Produit LAITY en bleu partout dans l'UI

### Helpers (à placer dans un core partagé, ex. `js/core/inventory-core.js` ou près de `recipeProductLabel`)

```js
function isLaity(txt){
  return String(txt||'').normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toUpperCase().indexOf('LAITY')>=0;
}
// Renvoie le texte esc-apé avec les segments « LAITY » colorés.
function hlLaity(txt){
  const s=esc(String(txt==null?'':txt));
  return isLaity(txt) ? s.replace(/(LAITY)/gi,'<span class="laity">$1</span>') : s;
}
```

### CSS (`css/styles.css`)

```css
.laity{color:#1565c0;font-weight:700}
option.laity{color:#1565c0;font-weight:700}
```

### Points d'application

- **Options de listes déroulantes** (produits **et** articles) : ajouter
  `class="laity"` sur l'`<option>` quand le libellé contient LAITY. On colore
  l'option entière (impossible de colorer un mot dans un `<option>`), ce qui reste
  clair. Concerné :
  - `movSectionHTML` (`artOpts`) dans `production-movements-server.js` (articles
    entrée/sortie — « CARTON LAITY 20G »).
  - `<select id="planPick">` dans `capacity-plan.js`.
  - Toute autre liste déroulante produits/articles (production, etc.).
- **Texte HTML** (cartes, lignes, titres) : remplacer les
  `esc(recipeProductLabel(p))` / `esc(r.des)` par `hlLaity(recipeProductLabel(p))` /
  `hlLaity(r.des)` là où un nom de produit/article s'affiche :
  - Cartes Capacité (`cap-prod`), lignes matières.
  - Lignes Plan, résultats de simulation, « capacité restante après plan ».
  - Tableaux onglet Stock, historiques mouvements, écrans production/entrée/sortie.
- **PDF** : inchangés (noir).

### Garde-fous

- Ne pas casser l'échappement : `hlLaity` échappe d'abord, puis injecte le span sur
  le mot LAITY (déjà sûr, LAITY ne contient pas de caractère à échapper).
- Ne pas appliquer `hlLaity` dans un contexte d'attribut HTML (`value="..."`,
  `title="..."`) — uniquement en contenu affiché.

---

## Volet 4 — Champs évolutifs + nouveaux champs entrée/sortie

### État actuel

Formulaire mouvement partagé (`renderMov`, `production-movements-server.js`) : un seul
champ libre `mf.ref` (`MOVCFG[kind].refLabel`). Stocké dans `rec.ref` /
`payload.ref`, affiché dans l'historique, entre dans la signature anti-doublon
(`localSig`) et les PDF.

### Nouveaux champs

Remplacer le champ `ref` unique par des champs structurés selon le type :

| Champ (clé) | Sortie | Entrée |
|---|---|---|
| `matricule` | Matricule véhicule | Matricule véhicule |
| `chauffeur` | Chauffeur | Chauffeur |
| `dest` | Destinataire | Provenance (libellé différent, même clé) |

Définir la liste des champs dans `MOVCFG[kind]`, ex. :

```js
sortie:{ ..., fields:[
  {key:'matricule', label:'Matricule véhicule', sug:'lep_sug_matricule'},
  {key:'chauffeur', label:'Chauffeur',          sug:'lep_sug_chauffeur'},
  {key:'dest',      label:'Destinataire',        sug:'lep_sug_dest'}
]},
entree:{ ..., fields:[
  {key:'matricule', label:'Matricule véhicule', sug:'lep_sug_matricule'},
  {key:'chauffeur', label:'Chauffeur',          sug:'lep_sug_chauffeur'},
  {key:'dest',      label:'Provenance',          sug:'lep_sug_provenance'}
]}
```

Note : `matricule` et `chauffeur` partagent leur historique de suggestions entre
entrée et sortie (mêmes clés `lep_sug_*`). `dest` a une clé distincte par type
(`lep_sug_dest` pour destinataires, `lep_sug_provenance` pour provenances) car ce
sont des vocabulaires différents.

### Datalist évolutif

Helpers de persistance (localStorage) :

```js
function sugGet(key){ return lsGet(key,[]) || []; }
function sugAdd(key,val){
  val=String(val||'').trim(); if(!val)return;
  let list=sugGet(key).filter(v=>v!==val);
  list.unshift(val);
  if(list.length>50)list=list.slice(0,50);
  lsSet(key,list);
}
```

Rendu de chaque champ dans `renderMov` :

```html
<label>Matricule véhicule
  <input class="mv-fld" data-key="matricule" list="dl_matricule"
         value="..." placeholder="ex. 1234 TU 56">
  <datalist id="dl_matricule">
    <option value="1234 TU 56"></option> ...
  </datalist>
</label>
```

- `freshMov()` initialise les nouvelles clés à `''`.
- Chaque `<input class="mv-fld">` met à jour `mf[key]` sur `oninput`.
- À l'ouverture d'un record de l'historique (« Voir »), recharger `mf[key]` depuis le
  record (repli sur parsing de `ref` non requis : afficher `ref` legacy tel quel si
  les champs séparés sont absents — voir compat).

### Persistance & compat

À la validation (`movSave` **et** `movSubmit`) :

1. Construire les champs séparés dans le record :
   `rec.matricule`, `rec.chauffeur`, `rec.dest`.
2. Dériver `rec.ref` (chaîne combinée) pour compat historique/signature/PDF :
   `ref = [matricule, chauffeur, dest].filter(Boolean).join(' · ')`.
3. Appeler `sugAdd(key,val)` pour chaque champ non vide (matricule, chauffeur, dest)
   → alimente les datalists de la prochaine saisie.

Compat lecture (`renderMovHist`, ouverture « Voir ») :

- Nouveau record : afficher `matricule / chauffeur / dest` (ou le `ref` combiné).
- Ancien record : `matricule`/`chauffeur`/`dest` absents → afficher `rec.ref` legacy.
  Pas de migration ; les anciens records restent lisibles via `ref`.

`localSig` continue de hacher `ref` (désormais dérivé) → la détection de doublon reste
cohérente.

### Périmètre

- Les listes déroulantes **produits/articles** ne deviennent PAS évolutives : elles
  proviennent d'un catalogue fixe (REFS/RECF). Le pattern évolutif ne concerne que
  les champs texte libres (matricule, chauffeur, destinataire, provenance).

---

## Transverse

- `npm run check:js` après chaque volet.
- Bump du cache SW (`sw.js` ligne 1 : `inv-lep-vXX` → `+1`) avant push.
- Commit par volet (message descriptif), push après le batch.
- Aucune migration IndexedDB : tous les champs sont additifs.
- Tester sur mobile Android (fermer/rouvrir l'app pour charger la nouvelle version).

## Ordre d'implémentation suggéré

1. Volet 1&2 (correctif capacité/plan) — le plus impactant, isolé.
2. Volet 3 (LAITY bleu) — helpers + CSS + points d'application.
3. Volet 4 (champs évolutifs) — le plus large, touche le formulaire mouvement.
