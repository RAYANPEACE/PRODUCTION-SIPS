# Spec E2 — Stock par lots RÉELS (date par bloc de l'inventaire) + FIFO

Date : 2026-06-24
Statut : design validé en **carte blanche** (Rayan : « enchaîne E2, je garde des traces »). Décisions recommandées prises par l'agent (§7). Branche `inventaire-serveur` (non mergée). Suite d'E1 (garde-fou date de prod) et de D (feuille Stock). Sous-projet 2/3 du chantier « modèle par lot ».

## 1. Contexte & problème

D (livré) affiche un détail par lot + FIFO pour les produits finis dans `js/features/stock-sheet.js`, mais les lots de **base** sont **dérivés** : `stockBaseMap` agrège tous les blocs d'un article en **une quantité** (`total(r)`), puis `buildFinishedLots` fabrique **un seul lot de base** daté à la **date de l'inventaire** entier. Les **vraies dates de production par bloc** (saisies au comptage, `ST.c[code].blocks[].date`, désormais fiabilisées par E1) sont **perdues**.

**E2** : remplacer ce lot de base agrégé par les **lots réels** extraits du snapshot du dernier inventaire validé — un lot par bloc de produit fini, daté par `blk.date` —, puis appliquer le FIFO sur ces lots réels. Les productions/entrées restent datées par leur record (inchangé).

## 2. Objectif

Pour chaque produit fini, la feuille Stock montre les lots **réellement comptés** (date de production de chaque bloc + quantité), le FIFO consommant le plus ancien d'abord. Invariant conservé : la **somme des lots = stock agrégé** (`base + flux`).

## 3. Changements (cœur)

### 3.1 `stockBaseMap(baseST)` → renvoie `{ baseMap, baseLots }`
Dans le swap `ST`/`RO` existant (après `mergeAndMigrate`), en plus de `baseMap[code] = total(r)` pour les comptés, construire pour chaque **produit fini compté** :
```
baseLots[code] = blocks (ensureBlocks) avec saisie (blockHasInput)
                 -> [{ date: blk.date||'', qty: blockTotal(r, blk, blk.cfg||pOf(r)) }]
```
- N'utilise que des globals déjà disponibles à l'exécution navigateur (`ensureBlocks`, `blockHasInput`, `blockTotal`, `isFini`, `pOf`). Reste **hors des fonctions pures testées en VM** (qui n'ont pas ces globals).
- Invariant : `Σ qty(baseLots[code]) === baseMap[code]` (blockTotal somme à total(r)).

### 3.2 `buildFinishedLots(code, baseLots, baseDate, prodRecs, entreeRecs, desToCode, today)`
- `baseLots` accepte désormais un **tableau** `[{date, qty}]`. **Rétro-compat** : si `baseLots` est un **nombre**, l'envelopper en un seul lot `[{date: baseDate||'', qty: baseLots}]` (comportement D + tests `test:stock` inchangés).
- Construire les lots de production (datés `p.date`) et d'entrée (datés `r.date`) comme aujourd'hui, puis **concaténer** les lots de base.
- **Fusionner par date** (clé de lot = date seule, décision E1) : lots de même date additionnés ; un lot à date vide = `imprecise:true`. Trier par date croissante (date vide en premier = traité comme le plus ancien).

### 3.3 `computeStockData()`
- `const { baseMap, baseLots } = stockBaseMap(src.baseST);`
- Pour un produit fini : `const bl = baseLots[c] && baseLots[c].length ? baseLots[c] : base;` (repli sur le nombre `base` si aucun lot par bloc — ex. fini théorique depuis ETAT). `buildFinishedLots(c, bl, src.baseDate, ...)`.

### 3.4 Affichage (`stockSheetHTML`)
- Étiquette de lot pilotée par la **date** : `lot du <date>` ; date vide → `lot sans date précise` + mention « (date de production manquante) ». Supprime les libellés `inventaire`/`entree`/`production` (la clé est la date).
- `visibleLots` : lots avec `|rest| > 1e-9` **ou** `imprecise` (le lot sans date reste visible comme signalement).

## 4. Hors périmètre E2
- MP par lot + péremption → **E3**.
- Persistance serveur d'un ledger de lots (tout reste dérivé à la lecture).
- Garde-fou bloquant (fait en E1) ; lien Qualité `numeroLot`.

## 5. Fichiers touchés
- `js/features/stock-sheet.js` : `stockBaseMap`, `buildFinishedLots`, `computeStockData`, `stockSheetHTML`.
- `sw.js` : bump `inv-lep-v131`.
- `tests/stock-fifo.test.js` : conserver la rétro-compat (nombre) ; ajouter lots de base **tableau** (per-bloc) + **fusion same-date** + invariant somme.

## 6. Cas limites
- **Blocs non datés** (inventaires hérités d'avant E1) → lot `imprecise`, date vide, trié en premier (FIFO le consomme d'abord). E1 empêche les nouveaux.
- **Fini théorique** (compté sans saisie, base depuis ETAT) → repli sur un lot unique = `base`.
- **Deux blocs même date** → fusionnés en un lot.
- **Σ lots = base** garanti (blockTotal somme à total(r)) → l'invariant `Σ rest = base + flux` après FIFO tient.
- **Sorties > stock** → dernier lot négatif (déjà géré, signalé en rouge).
- **Source serveur ou locale** → identique (les deux passent par `stockBaseMap` sur un snapshot `st` à blocs).

## 7. Récap des choix (carte blanche) et pourquoi
| Choix | Pourquoi |
|---|---|
| Lots de base = **par bloc** du snapshot, dans `stockBaseMap` | La donnée par lot existe déjà dans le snapshot (`blocks[].date`/`blockTotal`) ; on arrête juste de l'agréger. Reste hors des fonctions pures (globals non dispo en VM). |
| `buildFinishedLots` accepte **nombre OU tableau** | Rétro-compat : `test:stock` reste vert ; nouveau chemin passe les vrais lots. |
| **Fusion par date** + libellé « lot du <date> » | Cohérent avec « clé de lot = date seule » (E1) ; affichage propre, abandonne les libellés de source. |
| Date vide = **imprecise**, triée en premier | FIFO consomme l'inconnu d'abord (prudent) ; visible comme signalement ; E1 fiabilise le futur. |
| Repli sur `base` (nombre) si pas de lots | Ne casse jamais le cas fini théorique / sans bloc. |
