# Spec E1 — Garde-fou bloquant « date de production » + fiabilisation de la saisie par lot

Date : 2026-06-24
Statut : design validé en **carte blanche** (Rayan : « réponds toi-même aux questions, je revois la spec à la fin »). Décisions recommandées prises par l'agent, résumées en §10. Branche `inventaire-serveur` (non mergée). Dépend de B (comparer-avant-valider) et C (inventaire fragmenté), déjà livrées.

## 1. Contexte : le chantier « modèle par lot » et son découpage

Objectif global (mémoire `project_sips-roadmap-stock-fifo`) : passer d'un modèle « quantité globale par article » à un modèle « **par lot avec date de production** », en 3 volets liés par le même prérequis (capturer lot + date à la saisie) :

1. Saisie comptage **par lot** (date de production).
2. Garde-fou **bloquant** : pas de validation d'un inventaire si un produit fini n'a pas sa date de production.
3. FIFO/péremption **par lot réels** (remplacent les lots *dérivés* de D dans `stock-sheet.js`) ; MP : suivi par lot + péremption.

### Constat d'exploration déterminant

La saisie comptage **capture déjà les lots avec dates**. Le modèle `ST.c[code].blocks[]` (refondu par B/C, voir `js/core/inventory-core.js`) donne à chaque article multi-lot (modes `carton`, `sac`, `vrac`, `tare`, `simple` pour cat `fini`/`mp`) un tableau de **blocs**, et `buildBlocks` + `blockMeta` rendent pour chaque bloc :
- produit fini → champ **« Date de production »** (`blk.date`, avec libellé de délai `prodInfo`) ;
- MP → champ **« Date de péremption »** (`blk.date`, avec `expInfo`) ;
- bouton **« + lot (autre date de production / format) »** ; chaque bloc a sa quantité (`blockTotal`), sa config, sa photo d'étiquette.

**Un bloc EST déjà un lot daté.** Le « cœur de la saisie » à refondre est en grande partie déjà en place. Ce qui manque réellement :

- **(a)** `blk.date` est **optionnel** — rien n'empêche de valider un inventaire avec des produits finis non datés ;
- **(b)** `js/features/stock-sheet.js` (D) **ignore** ces dates de bloc : `stockBaseMap` agrège tous les blocs d'un article en une quantité unique puis fabrique **un seul lot de base** daté à la date de l'inventaire — les vraies dates par bloc sont perdues ;
- **(c)** les MP restent **agrégées** dans la feuille Stock.

Le prérequis commun « capturer lot+date à la saisie » est donc surtout un travail d'**enforcement + propagation**, pas de construction.

### Découpage en 3 sous-projets

- **E1 (cette spec)** : garde-fou **bloquant** + fiabilisation de la saisie par lot. **Socle** : rend les dates de lot fiables pour que E2/E3 reposent sur des données saines. Le plus petit et le moins risqué.
- **E2 (suivant)** : `stock-sheet.js` lit les **lots réels** (date par bloc) du dernier inventaire validé au lieu d'agréger ; FIFO produits finis sur ces vrais lots (remplace les lots dérivés de D).
- **E3 (plus tard)** : MP par lot + péremption dans la feuille Stock (suivi + alertes).

Chaque sous-projet a son cycle spec → plan → implémentation. Cette spec ne couvre que **E1**.

## 2. Objectif d'E1

Interdire la **validation/soumission d'un inventaire** tant qu'un **produit fini compté** a un lot (bloc) **avec quantité saisie mais sans date de production**. Guider l'utilisateur vers les cartes à compléter. Aucune nouvelle structure de données : `blk.date` existe déjà.

## 3. Décisions (recommandées, carte blanche)

1. **Clé de lot = date de production seule** (validé par Rayan). Deux productions du même produit le même jour fusionnent en un lot. Colle à `blk.date` et au FIFO par date déjà en place. Pas de numéro de lot saisi à l'inventaire (le `numeroLot` LOT-NNN de la Qualité n'est PAS la clé en E1 ; lien éventuel = E2/E3).
2. **Périmètre du garde-fou** : **produits finis comptés uniquement**. Un bloc est concerné s'il a une **saisie** (`blockHasInput`) **et** un `blk.date` vide. Les **MP** sont exclues (leur date = péremption, concern E3). Les articles **non comptés** (théoriques) ne sont jamais concernés.
3. **Points d'accroche** (fonction réutilisable, voir §5) :
   - `submitInventoryServer()` — bloque avant l'envoi (flux B serveur, cas principal) ;
   - `validateCurrent()` — bloque la validation locale (mode legacy / 100 % local) ;
   - `srvFragSubmitMine()` — bloque l'envoi de la part d'un compteur (flux fragmenté C), filtré à **ses** produits finis comptés.
4. **UX de correction** : modal **bloquant** listant chaque produit fini en défaut ; un appui sur une ligne **défile vers la carte** (`scrollCardIntoView`) et la met en évidence. Le champ date du bloc fautif est **signalé en rouge** (classe CSS) quand il est vide alors que le bloc a une saisie. Un bouton raccourci **« aujourd'hui »** par bloc facilite la saisie. **Pas d'auto-remplissage silencieux** de la date (forcer une vraie date est le but de la traçabilité).
5. **Date future** : non bloquante. Le garde-fou porte sur la **présence** de la date, pas sa validité. Une date de production future reste signalée par `prodInfo` (« production à venir ») — cohérent avec l'existant ; on ne durcit pas plus en E1.
6. **Migration** : le garde-fou s'applique aux **nouvelles** validations seulement. Les inventaires **déjà verrouillés** (sans dates) restent intacts. Les lots non datés hérités sont gérés par E2 (libellé « sans date précise », déjà fait en D). **Aucune migration de données.**
7. **Modèle `ST.c`** : **aucun champ nouveau** ; E1 = validation + signalement UI sur `blk.date` existant.
8. **Lien Qualité** : pas de lien dur en E1. (Piste E2/E3 : rapprocher la date d'un lot de la fiche Qualité `numeroLot`/`dateProduction` du même produit/jour — hors périmètre ici.)

## 4. Règle de détection (cœur testable)

Fonction pure réutilisable, extractible pour test Node (style `test:stock`) :

```
lotsMissingProdDate(entries, refs) -> [{code, des, nbLots}]
```

- `entries` : map `{code: ST.c[code]}` (ou sous-ensemble pour le flux fragmenté).
- `refs` : `REFS`.
- Pour chaque `ref` **produit fini** (`isFini(r)`) **compté** (`entry.counted`) :
  - parcourir `entry.blocks` (après `ensureBlocks`) ;
  - compter les blocs `b` tels que `blockHasInput(r, b) && !String(b.date||'').trim()` ;
  - si ce compte > 0 → ajouter `{code, des:r.des, nbLots}`.
- Renvoie la liste (vide = OK pour valider).

L'enveloppe non pure côté app (`finishedLotsMissingDate(scope)`) construit `entries` selon le scope (`'all'` = tout `ST.c` ; `'mine'` = les `counts` de la contribution fragmentée) puis appelle la fonction pure.

## 5. Composants & fichiers touchés

- **`js/core/inventory-core.js`**
  - Ajouter `lotsMissingProdDate(entries, refs)` (pure) et `finishedLotsMissingDate(scope)` (enveloppe).
  - `submitInventoryServer()` et `validateCurrent()` : en tête (après le test `filled`), si `finishedLotsMissingDate('all').length` → ouvrir le **modal garde-fou** et `return` (ne pas soumettre/valider).
  - `blockMeta(...)` : ajouter la classe d'alerte rouge sur l'input date quand le bloc a une saisie et pas de date ; ajouter le bouton « aujourd'hui ».
  - Modal garde-fou : réutiliser le patron `#warn`/`#ncList` (liste d'articles) ou un dialog dédié `#lotWarn` ; chaque ligne `onclick` → `switchTab('comptage')` puis `scrollCardIntoView(code)`.
- **`js/features/fragments.js`**
  - `srvFragSubmitMine()` : avant l'envoi, si `finishedLotsMissingDate('mine').length` → modal garde-fou (filtré) et `return`.
- **`index.html`**
  - Dialog `#lotWarn` (si dédié) calqué sur `#warn` ; sinon réutiliser `#warn` avec un titre paramétrable.
- **`css/styles.css`**
  - Classe `.blk-date.missing input` (bordure rouge) pour le champ date non rempli d'un lot saisi.
- **`sw.js`** : bump version (`inv-lep-v130`) ; pas de nouveau fichier à précacher (modif de fichiers existants).
- **`tests/`** : `tests/lot-gardefou.test.js` (Node pur) sur `lotsMissingProdDate` — voir §8. Pas de route serveur nouvelle → `test:server` inchangé (reste 47/47).

## 6. Flux

1. Compteur remplit l'inventaire ; pour un produit fini, chaque bloc = un lot, avec sa date de production.
2. Il tape **Soumettre** (B) / **Valider** (local) / **Envoyer ma part** (C).
3. `finishedLotsMissingDate(scope)` s'exécute :
   - liste vide → flux normal (soumission/validation/envoi) ;
   - liste non vide → **modal bloquant** : « Date de production manquante pour N produit(s) fini(s) » + liste cliquable ; aucune soumission. L'utilisateur tape une ligne → carte ciblée, champ date en rouge, saisit la date (ou « aujourd'hui »), recommence.

## 7. Cas limites & garde-fous

- **Produit fini, 1 seul bloc, date vide, quantité saisie** → bloqué.
- **Bloc avec date mais quantité 0** (ni `blockHasInput`) → ignoré (pas un lot réel) ; ne bloque pas.
- **Bloc quantité saisie + date présente** → OK.
- **MP sans date de péremption** → **non concerné** par E1 (E3).
- **Article fini non compté** (théorique) → non concerné.
- **Mode 100 % local sans serveur** → `validateCurrent()` applique le garde-fou de la même façon.
- **Recompte (`recountOf`)** → repasse par `submitInventoryServer` → garde-fou appliqué.
- **Flux fragmenté** : un compteur qui n'a aucun produit fini dans sa zone n'est jamais bloqué ; celui qui en a doit dater ses lots avant d'envoyer sa part (la date est saisie sur le téléphone qui a les lots physiques sous les yeux). L'assemblage serveur reste autoritaire et inchangé.
- **Inventaires déjà verrouillés** non datés → intacts (pas de blocage rétroactif).

## 8. Tests

- **JS pur (Node, style `npm run test:stock`)** : `tests/lot-gardefou.test.js` vérifie `lotsMissingProdDate` :
  - produit fini compté avec un bloc saisi sans date → signalé ;
  - bloc daté → non signalé ;
  - bloc saisi sans date mais quantité 0 → non signalé ;
  - MP sans date → non signalé (hors périmètre) ;
  - produit fini non compté → non signalé ;
  - plusieurs blocs, un seul sans date → signalé une fois avec `nbLots=1`.
  - Pour rester pur, le test fournit des stubs minimes de `isFini`, `blockHasInput`, `ensureBlocks` (ou on extrait la détection dans une forme injectable). Aligner sur le harnais existant `tests/stock-fifo.test.js`.
- **`npm run check:js`** après chaque modif ; **`npm run test:server`** reste 47/47 ; **`npm run test:stock`** reste 11/11 ; **bump SW**.
- **Manuel mobile** : compter un produit fini sans date → Soumettre bloque avec la liste ; taper la ligne → carte ciblée, champ rouge → dater (ou « aujourd'hui ») → Soumettre passe. Idem `Valider` (local) et `Envoyer ma part` (fragmenté).

## 9. Hors périmètre E1

- Lecture des **lots réels** par `stock-sheet.js` et FIFO produits finis sur ces lots → **E2**.
- MP par lot + péremption dans la feuille Stock → **E3**.
- Numéro de lot saisi à l'inventaire ; lien dur avec la Qualité (`numeroLot`).
- Validité de la date (future, antériorité au dernier inventaire) au-delà du signalement `prodInfo` existant.
- Toute persistance serveur d'un ledger de lots (rien de nouveau côté store).

## 10. Récapitulatif des choix (carte blanche) et pourquoi

| # | Choix | Pourquoi |
|---|-------|----------|
| Sous-projet 1 | **E1** (garde-fou + fiabilisation saisie) avant E2/E3 | Socle : sans dates fiables, le FIFO réel d'E2/E3 reposerait sur des lots non datés. Le plus petit, le moins risqué, ne touche pas le calcul de stock. |
| Clé de lot | **Date seule** | Choisi par Rayan. Aligné sur `blk.date` et le FIFO par date existant ; pas de champ supplémentaire à saisir au comptage. |
| Périmètre garde-fou | **Produits finis comptés, blocs avec saisie** | C'est exactement la donnée requise par le FIFO produits finis. MP = péremption (autre sujet, E3). Ne pas embêter sur les articles théoriques. |
| Accroches | **submit serveur + valider local + part fragmentée** | Couvre les 3 chemins de validation existants (B, legacy/local, C) ; bloque au plus près de l'utilisateur qui a les lots sous les yeux. |
| Pas d'auto-date | **Saisie manuelle, raccourci « aujourd'hui »** | Auto-remplir tuerait la traçabilité (but du garde-fou). Le raccourci garde l'ergonomie mobile. |
| Migration | **Aucune ; non rétroactif** | Ne pas casser les inventaires déjà validés ; E2 gère déjà les lots hérités non datés (« sans date précise »). |
| Modèle de données | **Aucun champ nouveau** | `blk.date` existe déjà ; E1 = validation + UI. Surface minimale, risque minimal. |
| Tests | **Fonction pure + harnais Node** | Reproduit le succès de `test:stock` (11/11) : logique testable hors navigateur, pas de route serveur. |
