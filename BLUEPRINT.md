# BLUEPRINT TECHNIQUE — Production LEP / Inventaire terrain (Hunter's Food)

> Document de spécifications « zéro défaut » destiné à un agent générateur (CloudCode).
> État des lieux **AS-IS** de l'app existante + **architecture cible modulaire** pour régénération/correction.
> Stack actuel : **PWA mono-fichier 100 % client-side, sans backend.** `index.html` (~3 480 lignes) + 4 libs locales.
> Tout est en français (UI, données, libellés). Cible : tablette/mobile en atelier, **usage hors-ligne**.

---

## 1. Périmètre Fonctionnel Global

**« Application d'inventaire physique et de pilotage de production pour une usine de poudre de lait (gamme DIAMO), utilisable hors-ligne sur tablette en atelier : on compte le stock réel, on le compare à l'état de stock ERP, on suit la production et les mouvements, et on calcule la capacité/le plan de production. »**

Particularités structurantes :
- **Aucun serveur** : tout vit dans le navigateur (IndexedDB + localStorage). L'échange entre postes se fait par **fichiers JSON** (import/export, partage Web Share) et par **fusion de fragments** multi-compteurs.
- **Métiers de comptage hétérogènes** : 8 « modes » de saisie (`carton`, `sac`, `cartvide`, `bobine`, `vrac`, `tare`, `plastique`, `simple`) — chacun a sa formule de conversion vers une quantité en unité de base.
- **Deux rôles** : Employé (saisie) et Admin (PIN 4 chiffres → référentiels, analyses, paramètres).

---

## 2. Détail des Modules Fonctionnels

L'app est découpée en **11 onglets** (`TABS`, index.html:1731). Colonnes du tuple : `[id, label, visibleEmployé, adminOnly]`.

| id | Onglet | Rôle | Fonction |
|----|--------|------|----------|
| `accueil` | Accueil | tous | Tableau de bord / récents |
| `comptage` | Comptage | tous | Saisie d'inventaire physique |
| `prod` | Production | tous | Fiches de production journalière |
| `ref` | Référentiels | admin | Articles, conditionnements, état de stock ERP, recettes |
| `bilan` | Bilan | admin | Écart physique vs théorique |
| `feuillet` | Feuillet | admin | Remplissage auto du feuillet PDF mensuel |
| `capacite` | Capacité | admin | Capacité de production selon stock |
| `plan` | Plan | admin | Plan de production (priorités/parts) |
| `sorties` | Sorties | admin | Mouvements de sortie |
| `entree` | Entrées | admin | Mouvements d'entrée |
| `analyse` | Analyses | admin | Agrégats déchets/production par mois |

### 2.1 Module Authentification / Rôles
- `toggleAdmin()` (1714), `askPin()` (1698), `getPin()`/`changePin()` (1697,1717).
- Premier accès admin : création d'un PIN 4 chiffres (stocké `lep_pin`).
- Bascule Employé ↔ Admin via bouton 🔒 (`#lockBtn`), masque/affiche les onglets `adminOnly`.
- Actions : déverrouiller, verrouiller, changer le PIN.

### 2.2 Module Comptage (cœur)
- `render()`/`buildCard()`/`buildBody()` (836,869) : arbre **Catégories → Sous-groupes → Cartes article**.
- Pour chaque article, saisie selon son **mode** (`r.m`), avec conversion → quantité (`total(r)`, 750-815).
- Actions : saisir, marquer compté (`setCounted`), photo jointe (`photoArrayUI`/`allPhotos`), ratio d'avancement par groupe/cat (`ratioInfo`), tout replier (`#collapseAll`).
- Cycle de vie inventaire : nouveau (`#newInv`), valider/verrouiller (`validateCurrent`, `#validBtn`/`#lockBtn`), archiver (`archiveCurrent`), consulter en lecture seule (`RO`), reprendre une archive (`reprendreArchive`), historique (`openHistory`/`#histBtn`).
- **Fragments multi-compteurs** : créer une session (`fragStartFromDlg`), chaque compteur exporte sa part, fusion roulante (`mergeFragments`, recomptes frais prioritaires sur reports) → `fragFinalize`/`fragArchiveMerged`. (3171-3470)

### 2.3 Module Production
- `renderProduction()` (2105) — fiche `PF` (`freshPF`, 2053) : date, agent, **blocs** (`freshBlock`, produit `p`, nb `n`, déchets emballage/film/mélange, lignes perso, photos), note.
- Calcule les déchets par bloc (`blockDechets`), totaux (`blockTotal`), débit (`prodDebit`).
- Actions : nouvelle fiche, sauvegarder (`prodSave` → IndexedDB id `prod_*`), partager (`prodShare`/`prodShareText`), historique (`loadProdHist`).

### 2.4 Module Mouvements (Entrées / Sorties)
- `renderMov(kind)` (2227) — `MOVF={sortie,entree}` (`freshMov`, 2191) : date, réf, lignes finis/MP `[{a,q}]`, photos, note.
- Actions : saisir, sauvegarder (`movSave` → id `sortie_*` / `entree_*`), partager (`movShare`).

### 2.5 Module Référentiels (admin)
- `renderRef()` (1876) : gestion **articles** (`addArticle`/`delArticle`, `#artAdd`), **conditionnements** (`renderCond`, clé `lep_cond`), **état de stock ERP** (`renderEtat` : coller texte / importer XLSX `etatXlsx` / date `etatDate` / reset `etatReset`), **recettes** (`renderRecf`, `lep_recf`).
- Applique les référentiels (`applyReferentials`) et persiste la config (`saveCfg` → `inv_cfg`).

### 2.6 Module Bilan
- `buildBilan()` (1305+) / `renderBilan()` : pour chaque code, `theo = ETAT[code]`, `phys = total(article)` si compté → `ecart`, `pct`, `flags` d'alerte (`reglesAlerte`).
- Appariement Bilan ↔ état de stock daté (`findBilanPair`/`bilPairBanner`).
- Actions : afficher détail (`#bilFull`/`#bilToggle`), période (`#bilPeriode`), imprimer (`#bilPrint`), PDF (`bilanPDF`/`#bilPDF`), reco VALIDER/RECOMPTER.

### 2.7 Module Feuillet
- `renderFeuillet()` : importe le **PDF feuillet du mois** (`feuPick`/`feuDetect`/`feuGenerate`), remplit **uniquement la colonne Lot1** (compté → physique ; non compté → état de stock) via `pdf-lib`. Export PDF rempli.

### 2.8 Module Capacité & Plan
- `computeCapacite()` (par recette `RECF`) / `renderCapacite()` : combien produire de chaque produit selon le **stock vivant** (`refreshLiveStock`/`stockDispo`), goulot (`maxGoulot`). Export PDF (`capacitePDF`).
- `renderPlan()` (`PLAN`, `lep_plan`) : priorités + quantité ferme OU part % du reste (`planRows`/`normalizePriorities`/`planChargeHTML`), machines/arrêts (`MACHINES`, `lep_machines`, `arretsMin`). Sauvegarde `savePlan`.

### 2.9 Module Analyses (admin)
- `renderAnalyse()` (3xxx) : lit toutes les fiches IndexedDB (`idbAll`), agrège **déchets** et **production par mois** (`prod_*`, `sortie_*`, `entree_*`), périodes (`lep_periode`).

### 2.10 Module Import/Export & Partage (transversal)
- `exportAll`/`importAll`/`exportLight`/`buildJSON`/`importInventory` (1315-1395), `collectLS` (sauvegarde des clés `lep_*`+`inv_cfg`).
- Partage natif : `shareBlob`/`shareJSON`/`shareOrDownload`/`shareFragment` (Web Share API + fallback download).
- Données démo : `genDemoData`/`clearDemoData`.

---

## 3. Mapping des Entités & Data Model

Pas de SGBD : **IndexedDB** (base `inv_db` v1, store `inv` keyPath `id`) + **localStorage**. Voici le modèle logique.

### 3.1 Référentiel article — `REFS[]` (constante code, index.html:671)
```
{ code:string(PK), des:string, u:unité, g:groupId, m:mode, p:{paramsConversion}, note?:string, cat?:string }
```
- `m ∈ {carton,sac,cartvide,bobine,vrac,tare,plastique,simple}` → pilote la carte de saisie ET la formule `total()`.
- `g` → `GROUPS[]` (701) `[id,label,num]` → `CATS[]` (711) `[{id,title,subs[]}]` (2 catégories : PF, MP&Emballages).

### 3.2 Inventaire / Comptage — `ST` (store `inv`, id `current` ou `inv_<ts>`)
```
{ id, agent, date(ISO), sessionStart(ts), c:{ [code]: Entry }, cfg?:{[code]:params}, locked?:bool }
Entry (selon mode) :
  carton/sac : {counted, pleines:[n…], entamees:[{et,vrac}…]}
  cartvide   : {counted, palStd, autres:[…], paqPlus, vrac}
  bobine     : {counted, pleines:[…], ent:[…]}
  vrac       : {counted, pleines:[…], partielles:[…], kg}
  tare       : {counted, weighings:[{brut,emb}…]}
  plastique  : {counted, restant, …}
  simple     : {counted, val}
  (+ photos:[dataURL])
```
Archive enrichie : `{id,date,agent,savedAt,filled,bilan:{total,nbAlertes,nbCounted},detail:{[code]:{n,t,p,e}},st:snapshot,locked?}`.

### 3.3 Session fragmentée — store `inv`, id `fragsess_<ts>`
```
{ id, kind:'fragsess', date, title, agents:[name…], fragments:{ [name]:{st:{…}, ts, …} } }
```

### 3.4 Production — id `prod_<ts>` : `{id,date,agent,blocks:[{p,n,w_emb,w_film,w_mel,perso:[{lbl,qte}],photos}],note}`
### 3.5 Mouvements — id `sortie_<ts>` / `entree_<ts>` : `{id,date,ref,finis:[{a,q}],mp:[{a,q}],photos,note}`

### 3.6 localStorage (clés)
| Clé | Contenu |
|-----|---------|
| `inv_cfg` | Config conversion par code (`{[code]:params}`) |
| `lep_pin` | PIN admin (4 chiffres) |
| `lep_etat` | État de stock ERP `{[code]:qté}` (seed `SEED_ETAT`) |
| `lep_etat_date` | Date de l'état de stock (appariement Bilan) |
| `lep_cond` | Conditionnements `{[code]:{ub,lv:[[niveau,facteur]…]}}` (`SEED_COND`) |
| `lep_recf` | Recettes `{[produit]:[{code,des,qte}…]}` (`SEED_RECF`) |
| `lep_plan` | Plan `{[produit]:{prio,objectif,part}}` (`SEED_PLAN`) |
| `lep_machines` | Machines/cadences + arrêts (`SEED_MACHINES`/`SEED_ARRETS`) |
| `lep_meta` | Métadonnées catégorie/unité (`SEED_CAT`,`SEED_UB`) |
| `lep_added` | Articles ajoutés manuellement |
| `lep_periode` | Période d'analyse |
| `lep_prodcfg` | Config production |

**Index essentiels (cible)** : store `inv` indexé par `kind` et par `date` (actuellement filtrage par préfixe d'`id` via `idbAll()` — coûteux ; à indexer si refonte).

---

## 4. Découpage Technique Front-End

App **SPA mono-page** : pas de routeur URL, navigation par onglets (`switchTab(id)`, `buildTabbar()`). Le « routing » cible (si refonte) = hash-routes :

| « Route » (cible `#/…`) | Onglet | Composants réutilisables clés |
|------|--------|-------------------------------|
| `#/accueil` | Accueil | `DashboardRecent`, `StatCard` |
| `#/comptage` | Comptage | `CategoryTree`, `GroupHeader`, `ArticleCard`, `ReadoutBadge`, `PhotoPicker`, `Tally`, `ModeInput(carton/sac/vrac/tare/bobine/cartvide/plastique/simple)` |
| `#/prod` | Production | `ProdBlock`, `DechetsRow`, `PhotoPicker`, `ShareBar` |
| `#/sorties` `#/entree` | Mouvements | `MovLineRow`, `ArticleSelect`, `PhotoPicker`, `ShareBar` |
| `#/ref` | Référentiels | `ArticleEditor`, `CondEditor`, `EtatImporter(XLSX/paste)`, `RecetteEditor` |
| `#/bilan` | Bilan | `BilanTable`, `EcartCell`, `AlertBadge`, `PairBanner`, `PdfExportButton` |
| `#/feuillet` | Feuillet | `PdfPicker`, `FeuilletPreview` |
| `#/capacite` | Capacité | `CapaciteCard`, `GoulotBadge` |
| `#/plan` | Plan | `PlanRow`, `PriorityInput`, `MachineConfig`, `ChargeChart` |
| `#/analyse` | Analyses | `MonthAggregateTable`, `DechetChart` |
| (modale) | — | `Dialog`(`#dlg`), `Toast`, `Lightbox`, `ConfirmExport`, `HistoryDialog`, `FragmentDialog`, `ReadOnlyBanner` |

Composants UI transverses à factoriser : `Tabbar`, `Header(idrow+tools)`, `Card(collapsible)`, `Chevron`, `RatioBadge`, `Button(primary/ghost)`, `LabeledInput`, `Stripe(mode color)`.

---

## 5. Découpage Back-End (API)

⚠️ **Il n'existe aucun back-end ni API réseau aujourd'hui.** La couche « API » est une **abstraction de persistance locale** + des services navigateur. Voici le contrat AS-IS, exprimé comme une API de service à conserver derrière une interface (`services/`), pour qu'une éventuelle synchro serveur soit branchable plus tard.

### 5.1 Service Persistance (IndexedDB) — `services/idb.js`
| Méthode | Équiv. REST cible | Description |
|---------|-------------------|-------------|
| `idbGet(id)` | `GET /records/:id` | Lit une fiche (`current`, `inv_*`, `prod_*`, `sortie_*`, `entree_*`, `fragsess_*`) |
| `idbAll()` | `GET /records` | Liste toutes les fiches (à filtrer par préfixe/kind) |
| `idbPut(rec)` | `PUT /records/:id` | Upsert (keyPath `id`) |
| `idbDel(id)` | `DELETE /records/:id` | Supprime |

### 5.2 Service Config (localStorage) — `services/config.js`
| Méthode | Description |
|---------|-------------|
| `lsGet(key,def)` / `lsSet(key,val)` | Lecture/écriture JSON des clés `lep_*` / `inv_cfg` |
| `loadCfg()` / `saveCfg()` | Config conversion articles |
| `collectLS()` | Snapshot de toutes les clés exportables |

### 5.3 Service Échange — `services/exchange.js`
| Méthode | Payload | Description |
|---------|---------|-------------|
| `exportAll()` / `buildJSON()` | `{cfg,ls,records}` | Export complet (sauvegarde) |
| `exportLight()` | inventaire sans photos | Export léger |
| `importAll(text)` / `importInventory(text)` | JSON | Import / fusion (`mergeAndMigrate`) |
| `buildFragmentFile()` / `mergeFragments(sess)` | fragment JSON | Multi-compteurs |
| `shareJSON/shareBlob/shareOrDownload` | Blob | Web Share API + fallback |

> **Recommandation refonte** : définir une interface `StoragePort` (get/all/put/del) avec impl `IdbAdapter` (actuel) et, plus tard, `HttpAdapter` (REST `/api/records`, `/api/config`, `/api/export`) — **sans toucher** aux modules métier.

---

## 6. Gestion d'état (State Management)

Pas de framework : **état global en variables module-level + persistance debouncée**. Modèle cible : un store léger par domaine (pattern observable / `pub-sub`), pas de Redux nécessaire.

| « Store » (variable globale actuelle) | Source de vérité | Persistance |
|---------------------------------------|------------------|-------------|
| `ST` | Inventaire courant | IndexedDB `current` (debounce 400 ms, `saveCounts`) |
| `RO` | Mode lecture seule | en mémoire |
| `FRAG` / `FRAGED` / `FRAGFILES` | Session fragmentée | IndexedDB `fragsess_*` |
| `CFG` | Conversion articles | `inv_cfg` |
| `ETAT` / `ETAT_DATE` | État de stock ERP | `lep_etat` / `lep_etat_date` |
| `RECF` | Recettes | `lep_recf` |
| `PLAN` / `MACHINES` | Plan & capacité | `lep_plan` / `lep_machines` |
| `PF` | Fiche production en cours | IndexedDB `prod_*` (à la sauvegarde) |
| `MOVF{sortie,entree}` | Mouvements en cours | IndexedDB `sortie_*`/`entree_*` |
| `ADMIN` | Rôle | dérivé du PIN |
| `FEU` | Feuillet PDF chargé | en mémoire |

Flux : saisie UI → mutation du store global → `render*()` re-rend la vue → `saveCounts()`/`*Save()` persiste. **Cible** : extraire chaque store dans `state/<domaine>Store.js` exposant `get/set/subscribe`.

---

## 7. Sécurité & Authentification

- **Pas d'auth serveur** : sécurité **locale, dissuasive** (l'app est mono-poste atelier).
- **Rôles** : `ADMIN` (bool) débloqué par **PIN 4 chiffres** (`lep_pin`). Employé = défaut.
- **Gating UI** : onglets `adminOnly` masqués hors admin (`buildTabbar`/`updateAdminUI`) ; actions destructrices (reset état, vider fiche) derrière `confirm()`.
- **Protection des données** : inventaires **validés/verrouillés** (`locked`) jamais écrasés (`archiveCurrent` ré-attribue un `id` si conflit) — anti-contamination des fusions.
- **Mode lecture seule** (`RO`) : consultation d'archive sans mutation (`saveCounts` retourne tôt si `RO`).
- **Limites connues à documenter** : PIN en clair dans localStorage (non chiffré), pas de chiffrement at-rest, contournable par DevTools. Acceptable pour le contexte (un seul poste, pas de données personnelles). **Si exposition multi-utilisateur** → exiger vrai back-end (JWT/session) via `HttpAdapter`.

---

## 8. Interactions tierces (APIs externes)

**Aucun appel réseau sortant.** Toutes les « intégrations » sont des **APIs navigateur + libs locales** (embarquées pour le hors-ligne). Points de rebond (fallback) à conserver :

| Intégration | Lib / API | Usage | Fallback si échec |
|-------------|-----------|-------|-------------------|
| Lecture Excel (état de stock) | `xlsx.full.min.js` (`ensureXLSX`/`loadScript`) | Import `lep_etat` + date (n° série) | Coller du texte manuel (`etatPaste`) |
| Génération PDF (bilan, capacité) | `pdf-lib.min.js` (`ensurePDF`) | Export documents | Impression navigateur (`window.print`) |
| Lecture PDF (feuillet) | `pdf.min.js` + `pdf.worker.min.js` | Détecter/remplir Lot1 | Message d'erreur + ré-import |
| Partage de fichiers | **Web Share API** (`navigator.share`) | Envoi JSON/PDF | `download` (lien `<a download>`) |
| Persistance | IndexedDB / localStorage | Stockage | `try/catch` silencieux (no-op) |
| Hors-ligne / install | **Service Worker** (`sw.js`, cache `inv-lep-v57`/`inv-lib-v1`) + manifest | PWA cache-first | Réseau puis fallback `index.html` |
| Photos | `<input type=file>` / dataURL | Pièces jointes | — |

> **Aucune** API de paiement, mail, géoloc, ou auth externe. Si ajout futur → centraliser dans `services/external/` avec gestion d'échec uniforme (timeout + toast + file d'attente offline).

---

## 9. Architecture Modulaire Prédécoupée (Économie de Tokens)

L'app est actuellement **un seul `index.html`**. Voici l'arborescence cible pour qu'un agent sache **exactement où ranger chaque bout de code**. Build léger (Vite) ou simples ES modules — pas de framework imposé.

```
/
├── index.html                  # shell minimal : <header>, <main id="app">, <nav id="tabbar">, <div id="dlg">
├── manifest.webmanifest
├── sw.js                       # service worker (bump cache version à chaque release)
├── /assets
│   ├── icon-192.png  icon-512.png
│   └── /vendor                 # libs locales (offline) : xlsx, pdf-lib, pdf.min, pdf.worker
├── /src
│   ├── main.js                 # init() : charge stores, monte tabbar, 1er render, enregistre SW
│   ├── /config
│   │   ├── refs.js             # REFS[] (catalogue articles)
│   │   ├── taxonomy.js         # GROUPS[], CATS[], STRIPE{}
│   │   ├── seeds.js            # SEED_ETAT/COND/RECF/PLAN/MACHINES/CAT/UB/ARRETS
│   │   └── tabs.js             # TABS[]
│   ├── /models                 # schémas + factories (pas de logique UI)
│   │   ├── inventory.js        # freshCounts, blankEntry, mergeAndMigrate, snapshot
│   │   ├── production.js       # freshPF, freshBlock
│   │   ├── movement.js         # freshMov
│   │   └── fragment.js         # forme session fragmentée
│   ├── /services               # I/O pur, AUCUNE dépendance UI (cf. §5)
│   │   ├── idb.js              # idb/idbGet/idbPut/idbAll/idbDel
│   │   ├── config.js           # lsGet/lsSet/loadCfg/saveCfg/collectLS
│   │   ├── exchange.js         # export/import/share/fragments
│   │   └── /external
│   │       ├── xlsx.js         # ensureXLSX, parse état de stock
│   │       └── pdf.js          # ensurePDF, lecture/écriture feuillet, bilanPDF, capacitePDF
│   ├── /state                  # stores observables (cf. §6)
│   │   ├── inventoryStore.js   # ST, RO, FRAG…
│   │   ├── refStore.js         # CFG, ETAT, RECF, COND
│   │   ├── planStore.js        # PLAN, MACHINES
│   │   ├── prodStore.js        # PF, MOVF
│   │   └── authStore.js        # ADMIN, PIN
│   ├── /domain                 # logique métier PURE, testable (entrée→sortie, pas de DOM)
│   │   ├── conversion.js       # total(), tareNet(), poidsUnite(), convCond() (les 8 modes)
│   │   ├── bilan.js            # buildBilan, reglesAlerte, findBilanPair
│   │   ├── capacite.js         # computeCapacite, stockDispo, maxGoulot
│   │   ├── plan.js             # planRows, normalizePriorities, arretsMin
│   │   └── analyse.js          # agrégats déchets/production par mois
│   ├── /components             # UI réutilisable, sans état global
│   │   ├── /ui                 # Button, Card, Dialog, Toast, Lightbox, Chevron, RatioBadge, LabeledInput
│   │   ├── /inputs             # un composant par mode : CartonInput, SacInput, VracInput, TareInput,
│   │   │                       #   BobineInput, CartVideInput, PlastiqueInput, SimpleInput, PhotoPicker
│   │   └── /shared             # Tabbar, Header, ArticleCard, GroupHeader, ShareBar, ReadOnlyBanner
│   ├── /views                  # une vue par onglet (orchestre stores+domain+components)
│   │   ├── accueil.js  comptage.js  production.js  mouvements.js  referentiels.js
│   │   ├── bilan.js  feuillet.js  capacite.js  plan.js  analyse.js
│   ├── /utils                  # helpers purs : num, round2, fmt, frDate, esc, slug, clone, compress
│   └── /styles
│       └── theme.css           # variables :root (--ink,--steel,--green…) + composants
└── /tests                      # cibler /domain en priorité (conversion, bilan, capacite, mergeFragments)
```

**Règles de rangement pour l'agent générateur :**
1. Une **formule de calcul** → `/domain` (jamais dans une vue). 
2. Un **accès stockage/lib externe** → `/services` (toujours `try/catch` + fallback documenté §8). 
3. Un **morceau d'UI répété** → `/components` ; spécifique à un onglet → `/views`. 
4. Une **constante métier/seed** → `/config`. 
5. Une **donnée de session** → un store de `/state` (get/set/subscribe), jamais en variable libre. 
6. À chaque release qui touche aux assets : **incrémenter la version du cache dans `sw.js`** (`inv-lep-vN`).

---

### Annexe — Les 8 modes de saisie (formule `total()`, index.html:750-815)
| mode | Saisie | Conversion → unité de base |
|------|--------|----------------------------|
| `carton` | pleines (palettes) + entamées (étages/vrac) | `pal×etPal×cartEt + Σétages×cartEt + vrac` |
| `sac` | idem carton | `pal×etPal×sacEt + …` |
| `cartvide` | palettes std + autres + paquets + vrac | `palStd×etPal×pqEt×cartPaquet + …` |
| `bobine` | pleines (kg) + entamées | poids réel ; réf `poidsRef`/`epRef` |
| `vrac` | palettes + sacs partiels + kg | `Σpal×sacPal×kgSac + Σpartiels×kgSac + kg` |
| `tare` | pesées {brut, emballage} | `Σ(brut − tare emballage)` (`tareNet`) |
| `plastique` | restant / paquet / rouleau | `parPaquet`/`parRouleau` |
| `simple` | valeur directe | `val` (vide ⇒ valeur théorique) |
```
