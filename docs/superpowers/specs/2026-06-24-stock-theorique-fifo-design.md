# Spec D — Feuille d'état de stock théorique temps réel + lots + FIFO

Date : 2026-06-24
Statut : design validé (carte blanche utilisateur Rayan — décisions recommandées prises par l'agent, à tester en fin de chantier). Dépend de B (comparer-avant-valider) et C (inventaire fragmenté), déjà livrées sur la branche `inventaire-serveur`.

## 1. Contexte & objectif

Besoin (mémoire `project_sips-roadmap-stock-fifo`) : une **feuille d'état de stock théorique** consultable **par tout le monde** (lecture), calculée en temps réel = *dernier inventaire validé + productions + entrées − sorties − consommation*, avec à terme le **détail par lot** (date de production) et la **déduction FIFO** des produits finis, plus des **flèches d'évolution** (🔴 baisse / 🟢 hausse / ⚪ stable) depuis le dernier inventaire validé.

**Constat d'exploration déterminant :** le moteur de calcul agrégé existe déjà dans `js/features/capacity-plan.js` (`refreshLiveStock()`, `LIVESTOCK`, `liveStockNote()`, `stockDispo()`) : il calcule par article `base + production + entrées − sorties − consommation(RECF)` à partir des **records locaux**. Il n'est ni exposé comme feuille, ni basé serveur, ni détaillé par lot, ni doté de flèches.

D est donc découpé en **3 phases** livrées dans l'ordre, chacune utile seule :

- **D-a** : feuille « État de stock » lisible par tous, **agrégée** (niveau quantité), **basée serveur** (officiel) avec **repli local**, avec **flèches** d'évolution. Réutilise/adapte `refreshLiveStock`.
- **D-b** : **détail par lot + date de production** pour les produits finis (modèle dérivé des records, pas de refonte de la saisie comptage) + garde-fou.
- **D-c** : **déduction FIFO** par date de production (produits finis), affichée dans la feuille.

## 2. Décisions (recommandées, prises par l'agent)

1. **Source** : officiel serveur, **mouvements validés seulement**, **repli local** si aucun serveur configuré. → tout le monde voit le même chiffre officiel ; le mode 100 % local reste fonctionnel.
2. **Placement** : **nouvel onglet « Stock »**, lecture seule, **visible par tous les rôles**. `hasTab('stock')` renvoie toujours `true` (public) ; ajouté à `TABS` avec `adminOnly=false` pour le mode legacy/local.
3. **Réutilisation** : le calcul agrégé réutilise la logique de `refreshLiveStock` (base + production + entrées − sorties − conso RECF), portée sur les records serveur. Pas de duplication : on extrait une fonction de calcul paramétrée par la source des données.
4. **Flèches (D-a)** : par article, comparer le **stock théorique actuel** à la **base** (quantité du dernier inventaire validé) → `Δ = actuel − base` : `Δ<0` 🔴, `Δ>0` 🟢, `Δ==0` ⚪. (Comme `actuel = base + flux`, la flèche = signe du flux net depuis la base.)
5. **Consommation MP (RECF)** : conservée — la production déduit les matières premières via la recette (déjà fait par `refreshLiveStock`). Une note explique le calcul.
6. **Lots des produits finis (D-b)** : **dérivés des records**, sans refonte de la saisie comptage. Une production d'un produit fini à la date `d` crée un **lot** `(produit, d)` de la quantité produite. La quantité du **dernier inventaire validé** forme un **lot de base** daté de l'inventaire (le plus ancien). → on obtient le détail par lot pour les produits finis sans changer la façon de compter physiquement.
7. **FIFO (D-c)** : les **sorties** de produits finis consomment d'abord le **lot le plus ancien** (clé = date de production ; le lot de base inventaire est le plus ancien). Quantité insuffisante → on enchaîne sur le lot suivant. Donne le restant par lot.
8. **Matières premières** : **pas de FIFO** (on n'a que la date de péremption, pas de prod). Les MP restent **agrégées** ; le suivi péremption reste celui du Bilan.
9. **Garde-fou date de production** : version **non bloquante** en D (ne pas casser le flux de validation que B/C viennent de poser). La feuille **signale** les produits finis sans lot daté (issus de l'inventaire de base) au lieu de bloquer la validation. Le garde-fou bloquant sur la validation d'inventaire est noté **hors périmètre D** (refonte saisie comptage par lot = chantier ultérieur dédié).
10. **Annulations** : les records `cancelled` sont **ignorés** partout dans le calcul (cohérent avec les historiques métier).

## 3. Phase D-a — Feuille « État de stock » agrégée (serveur + flèches)

### 3.1 Composants
- **`js/features/capacity-plan.js`** (ou nouveau `js/features/stock-sheet.js` chargé après capacity-plan) : extraire le cœur de `refreshLiveStock` en une fonction paramétrée `computeStock({invBase, prodRecs, entreeRecs, sortieRecs, baseDate})` qui renvoie `{stock:{code:qte}, base:{code:qte}, meta:{hasBase,baseDate,baseKind,nbMov,source}}`. `refreshLiveStock` (local, pour Capacité/Plan) l'appelle avec les sources locales ; la feuille Stock l'appelle avec les sources serveur.
- **Source serveur** : `sipsRecords('inventory')` → dernier validé (par date) ; `sipsRecords('production'|'entree'|'sortie')` → records validés. Base par code = total par article calculé depuis `payload.st` de l'inventaire (réutiliser le swap `ST`/`total(r)` déjà utilisé par `refreshLiveStock`). Repli : si aucun inventaire validé serveur **et** aucun record serveur → appeler la version locale (`refreshLiveStock`) et marquer `meta.source='local'`.
- **Onglet « Stock »** : `renderStock()` rend une vue lecture seule, groupée par famille (mp / emballage / fini / autre) comme le Bilan, colonnes : **Article** (code + désignation), **Base** (quantité au dernier inventaire validé), **Flux net** (Δ = actuel − base), **Stock théorique**, **Flèche**. En-tête : note explicative (`liveStockNote`-like) + date de base + nb de mouvements pris en compte + badge `officiel serveur` / `local (repli)`. Bouton « Actualiser ».
- **Onglet/visibilité** : ajouter `['stock','Stock',true,false]` à `TABS` ; `hasTab` : `if(id==='stock')return true;` en tête (public, lecture seule). `switchTab('stock')` appelle `renderStock()`.

### 3.2 Règles
- Mouvements pris en compte : `date > baseDate && date <= aujourd'hui`, records `validated` non `cancelled` uniquement.
- Mapping désignation→code conservé (`desToCode`) comme l'existant (productions `block.p`, mouvements `finis[].a`/`mp[].a`).
- Sans base datée (ni inventaire validé ni `ETAT_DATE`) : pas de projection de flux (on ne sait pas lesquels sont postérieurs) — afficher la base seule + note d'avertissement, comme `refreshLiveStock` aujourd'hui.

### 3.3 Hors D-a
- Détail par lot (D-b), FIFO (D-c). En D-a, les produits finis sont **agrégés** comme les autres.

## 4. Phase D-b — Détail par lot + date de production (produits finis)

### 4.1 Modèle (dérivé, sans refonte de la saisie)
- **Ledger lots produit fini** construit à la lecture : pour chaque produit fini,
  - **lot de base** `{date: baseDate, qty: base[code], source:'inventaire'}` (le plus ancien) ;
  - **un lot par production** postérieure `{date: prod.date, qty: produit, source:'production', recId}`.
- Les **entrées** de produits finis (rares) ajoutent un lot daté de l'entrée (`source:'entree'`).
- Fonction `buildFinishedLots(code, base, prodRecs, entreeRecs, baseDate)` → `[{date, qty, source}...]` trié par date croissante.

### 4.2 Affichage
- Dans la feuille Stock (D-a), chaque **produit fini** devient déroulable : total + liste des lots (date de prod, quantité). MP/emballage restent agrégés.
- Signaler le lot de base `(inventaire)` comme « sans date de lot précise » (garde-fou non bloquant, décision 9).

### 4.3 Hors D-b
- La déduction des sorties (FIFO) arrive en D-c ; en D-b les lots affichent les **quantités brutes ajoutées** (avant déduction des sorties).

## 5. Phase D-c — Déduction FIFO (produits finis)

### 5.1 Règle
- `applyFifo(lots, sortieQty)` : consomme `sortieQty` (somme des sorties validées du produit fini depuis `baseDate`) en commençant par le lot le plus **ancien** (date croissante ; le lot de base inventaire est le plus ancien). Décrémente lot par lot ; un lot tombé à 0 est épuisé ; renvoie les lots avec `qtyRestant`.
- Le **total restant** par produit fini doit égaler le stock agrégé D-a (`base + entrées + production − sorties`) — invariant de cohérence à vérifier en test unitaire serveur-indépendant (pur calcul) ou via un check de somme dans le rendu.

### 5.2 Affichage
- Feuille Stock : pour chaque produit fini, lots avec **quantité restante** (FIFO appliqué), lot épuisé masqué ou grisé. Le plus ancien en premier = prochain à sortir.

### 5.3 Hors D-c
- MP : pas de FIFO. Garde-fou bloquant à la validation d'inventaire : chantier ultérieur (refonte saisie par lot).

## 6. Fichiers touchés (synthèse)
- `js/features/capacity-plan.js` : extraire `computeStock(...)` réutilisable ; `refreshLiveStock` l'appelle (local). (Ou nouveau module `js/features/stock-sheet.js` + garder `refreshLiveStock` qui délègue.)
- `js/features/stock-sheet.js` (nouveau, chargé après capacity-plan dans `index.html`) : sources serveur, `buildFinishedLots`, `applyFifo`, `renderStock`.
- `js/core/server-session-tabs.js` : `TABS` + `hasTab('stock')` public ; `switchTab` route `stock` → `renderStock`.
- `index.html` : `<script>` du nouveau module dans l'ordre ; bouton/zone onglet si nécessaire (le tabbar est généré depuis `TABS`).
- `sw.js` : bump + ajouter le nouveau fichier à `APP` (liste de précache).
- `tests/server-security.test.js` : pas de route serveur nouvelle (lecture via records existants) → pas de test serveur ; le calcul FIFO/lots est du JS client pur. (Option : un mini harnais de test Node pur pour `applyFifo`/`buildFinishedLots` si extractibles — voir §8.)

## 7. Cas limites & garde-fous
- **Aucun serveur configuré** : repli local complet (`refreshLiveStock`), badge `local`. Onglet Stock visible quand même (lecture).
- **Aucun inventaire validé** : base = `ETAT` manuel daté si `ETAT_DATE`, sinon base seule sans projection (avertissement).
- **Désignation absente du référentiel** (`desToCode` ne mappe pas) : le mouvement est ignoré du calcul (comme aujourd'hui) — ne pas planter.
- **Records `cancelled`** : ignorés.
- **Produit fini sans aucune production datée** (tout vient de l'inventaire de base) : un seul lot `(inventaire)`, FIFO trivial.
- **Sorties > stock** (incohérence terrain) : FIFO épuise tous les lots ; le restant agrégé peut être négatif → afficher en rouge « stock théorique négatif (vérifier mouvements/inventaire) », ne pas masquer.
- **Performance** : lecture des records serveur via `sipsRecords` (déjà mis en cache no-store, timeout court). Calcul O(articles × mouvements) — acceptable (référentiel ~28 articles).

## 8. Tests
- **JS pur (recommandé)** : extraire `applyFifo(lots, sortieQty)` et `buildFinishedLots(...)` en fonctions pures et ajouter un petit harnais Node (`tests/stock-fifo.test.js`, sans serveur) qui vérifie : FIFO consomme le plus ancien d'abord ; somme des restants = base+entrées+prod−sorties ; lot de base = plus ancien ; sortie > stock → restant négatif signalé.
- **check:js** après chaque modif client ; **bump SW** ; le tabbar affiche « Stock » pour un compte non-admin.
- **Manuel mobile** : valider un inventaire serveur → faire des productions/sorties → onglet Stock montre le stock théorique, flèches cohérentes, produits finis déroulés par lot avec FIFO (le plus ancien part en premier), MP agrégées, badge officiel serveur ; couper le serveur → repli local + badge local.

## 9. Hors périmètre D (chantiers ultérieurs)
- Refonte de la **saisie comptage par lot** (compter physiquement chaque lot daté à l'inventaire) + garde-fou **bloquant** « pas de validation sans date de production ».
- Lots/péremption FIFO pour les **MP**.
- Persistance serveur d'un ledger de lots (ici tout est **dérivé à la lecture** des records existants — pas de nouveau store).
