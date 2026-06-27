# Spec E3 — Matières premières par lot + péremption (entrée datée, FEFO, garde-fou bloquant)

Date : 2026-06-24
Statut : design validé en **carte blanche** (Rayan), avec deux infléchissements explicites de l'utilisateur (voir §2). Branche `inventaire-serveur`. Dernier sous-projet (3/3) du chantier « modèle par lot ». Suit E1 (garde-fou date de prod) et E2 (lots finis réels).

## 1. Contexte
La feuille Stock ([stock-sheet.js](../../../js/features/stock-sheet.js)) détaille désormais les **produits finis** par lot réel (E2), mais les **matières premières (MP)** restent **agrégées**. Pour une MP, la date de bloc saisie au comptage = **date de péremption** ([inventory-core.js:446](../../../js/core/inventory-core.js#L446)), pas de production. On veut le suivi par lot + alertes péremption + déduction du lot **qui périme le plus tôt** (FEFO).

## 2. Périmètre & décisions (carte blanche + directives utilisateur)
Définition centrale : **matière périssable** = `r.g === 'vrac' || r.g === 'tare'` (matières en sacs/caisses + arômes). Les **emballages/consommables** (films, sacs plastique, cartons vides, zipper, kraft) **ne sont jamais** concernés par le lot/péremption/blocage.

1. **(Directive A)** **Saisie des entrées MP datée** : ajouter un champ **date de péremption** par ligne MP dans l'onglet **Entrées** (pas en Sorties). Le lot d'entrée porte cette date.
2. **(Directive B)** **Garde-fou bloquant étendu aux MP périssables** : interdire la validation d'un inventaire si une **matière périssable comptée** a un lot saisi **sans date de péremption** (en plus des produits finis sans date de prod d'E1). Emballages exclus (choix utilisateur : « seulement les vraies matières »).
3. **FEFO** : la consommation des MP (sorties + conso RECF) déduit le lot **qui périme le plus tôt** d'abord. Lots sans date triés **en dernier** (péremption inconnue = non prioritaire ; visible comme signalement).
4. **Lots MP réels** : extraits du dernier inventaire validé (un lot par bloc de matière périssable, date = péremption `blk.date`), comme E2 — plus les lots d'entrée datés par `exp`.
5. **Alertes péremption** : chaque lot affiche son statut (`expInfo` : périmé / périme bientôt / OK) avec code couleur, le plus urgent en haut.
6. **Hors périmètre** : FEFO sur les emballages ; péremption des sorties ; lien Qualité ; persistance serveur d'un ledger (tout reste dérivé à la lecture).

## 3. Slice A — Entrée MP datée
- `js/features/production-movements-server.js`
  - `freshMov` : lignes MP → `{a, q, exp:''}` (exp ignoré ailleurs ; rétro-compat : absent = '').
  - `movSectionHTML(mf, sec, title, withExp)` : si `withExp`, ajoute un `<input type="date" class="mv-exp">` par ligne. Appelé avec `withExp = (kind==='entree' && sec==='mp')`.
  - Handler : `.mv-exp` `onchange` → `mf[sec][i].exp`. Le `+ article` pousse `{a,q,exp:''}`.
  - `movArts`/payload : `mp` est déjà cloné → `exp` transporté sans changement de schéma serveur.
  - Détail soumission (`sipsLines` MP, entrée) : ajouter la colonne `['exp','Péremption']`.
- Sorties et produits finis : inchangés.

## 4. Slice B — Garde-fou MP périssable bloquant
- `domain/inventory.js` : généraliser `lotsMissingProdDate` → **`lotsMissingDate(entries, refs, h)`** renvoyant `[{code, des, nbLots, kind}]` avec `kind ∈ {'fini','mp'}`.
  - `kind` via helpers injectés : `isFini(r)` → 'fini' ; sinon `isPerishableMp(r)` → 'mp' ; sinon ignoré.
  - Détection identique pour les deux (`counted` + blocs avec saisie sans `blk.date`).
  - Replis purs : `isFini` (cat/g 'fini'), `isPerishableMp` (`r.g==='vrac'||r.g==='tare'`).
  - Conserver un alias `lotsMissingProdDate = lotsMissingDate` (compat).
- `js/core/inventory-core.js`
  - `isPerishableMp(r){return r.g==='vrac'||r.g==='tare';}`.
  - Wrapper `inventoryLotsMissingDate(entries)` injecte `{isFini, isPerishableMp, blockHasInput, ensureBlocks}`.
  - `openLotWarn(list)` : grouper/labelliser par `kind` — produits finis « date de production », matières « date de péremption ». Lignes cliquables → carte (inchangé).
  - Hooks `submitInventoryServer` / `validateCurrent` : appeler le wrapper (couvre fini + mp).
- `js/features/fragments.js` : `srvFragSubmitMine` utilise le wrapper sur `payload.counts`.
- `blockMeta` (UI) : le flag rouge « date manquante » s'applique déjà à tout bloc ; pour une matière périssable sans date saisie, même traitement (la fonction `updMissing` teste `isFin` aujourd'hui → étendre à `isFin || isPerishableMp(r)`), + bouton « aujourd'hui » aussi pour la péremption MP.

## 5. Slice C — Stock MP par lot + FEFO + alertes
- `js/features/stock-sheet.js`
  - `stockBaseMap` : construire `baseLots[code]` aussi pour les **matières périssables** (en plus des finis) — un lot par bloc avec saisie, `date = blk.date` (péremption), `qty = blockTotal`.
  - `mergeLotsByDate(lots, undatedLast)` : paramètre pour placer les lots sans date **en dernier** (MP/FEFO) au lieu d'en premier (finis/FIFO).
  - **`buildMpLots(code, baseLots, entreeRecs, desToCode, baseDate, today)`** : lots de base (péremption) + lots d'**entrée** datés par `x.exp` (vide → imprecise) ; `mergeLotsByDate(..., true)` (undated en dernier, tri péremption croissante). Pas de records de production pour les MP.
  - `computeStockData` : pour une matière périssable, `buildMpLots` puis `applyFifo(lots, sorties+conso)` (FEFO car l'ordre du tableau est péremption-croissante). `row.lotKind='mp'`. Pour un fini, inchangé (`row.lotKind='fini'`).
  - `stockSheetHTML` : rendu des lots adapté par `row.lotKind` :
    - fini → « lot du <date> » (production) ;
    - mp → « périme le <date> » + statut `expInfo` (couleur périmé/bientôt) ; imprecise → « sans date de péremption ».
  - Invariant conservé : `Σ rest = base + flux` (par construction des lots).
- `sw.js` : bump `inv-lep-v132`.

## 6. Tests
- `tests/lot-gardefou.test.js` : mettre à jour — une **matière périssable** (g 'vrac'/'tare') comptée sans date est **désormais signalée** (kind 'mp') ; un **emballage** (g 'film'/'plast'/'divers') ne l'est jamais ; un fini reste signalé (kind 'fini'). Injecter `isPerishableMp`.
- `tests/stock-fifo.test.js` : ajouter `buildMpLots` (FEFO) — lot d'entrée daté par `exp` ; tri péremption croissante ; undated en dernier ; FEFO consomme la péremption la plus proche d'abord ; invariant somme. (`mergeLotsByDate(undatedLast)`.)
- `check:js`, `test:server` 47/47 inchangé (pas de route serveur ; `exp` transporté dans le payload existant).

## 7. Cas limites
- **Entrée MP sans `exp`** → lot imprecise (FEFO en dernier), visible. E1/B ne bloque que l'**inventaire**, pas la saisie d'entrée (l'entrée reste fluide ; la péremption d'entrée est encouragée mais non bloquante).
- **Emballage compté sans date** → jamais bloqué, jamais détaillé par lot (agrégé comme aujourd'hui).
- **Matière périssable en mode non multi-bloc** (aucun : vrac et tare sont multi-bloc) → n/a.
- **Lot périmé** (péremption < aujourd'hui) → affiché rouge « périmé depuis X », jamais masqué.
- **Sorties > stock MP** → dernier lot négatif (déjà géré).
- **Mode local / serveur** → identique (snapshot `st` à blocs + records).

## 8. Récap des choix (et pourquoi)
| Choix | Pourquoi |
|---|---|
| Matière périssable = `g ∈ {vrac,tare}` | Seules vraies matières qui périment ; `g` fiable sur tous les REFS ; exclut emballages (choix utilisateur). |
| Entrée MP datée (`exp`) | Directive A : tracer la péremption dès la réception ; schéma serveur inchangé (champ ajouté au sous-objet mp). |
| Garde-fou MP bloquant (matières) | Directive B : fiabilise le FEFO ; limité aux matières pour ne pas bloquer sur les emballages. |
| FEFO + undated en dernier | Logique métier des périssables ; le lot sans date (inconnu) n'est pas consommé en priorité et reste signalé. |
| Réutilise E2 (`mergeLotsByDate`, `applyFifo`, lots par bloc) | Le moteur existe ; E3 change surtout la sémantique (péremption) et l'affichage. |
