# Spec B — Inventaire serveur : comparer-avant-valider (1 compteur)

Date : 2026-06-23
Statut : design validé avec l'utilisateur (Rayan), implémentation **différée** sur une branche dédiée `inventaire-serveur` **après** la revue cross-model Codex de `security-hardening`.

## 1. Contexte & objectif

L'inventaire devient **100 % serveur**. Aujourd'hui l'admin valide localement (verrou idb `validateCurrent`) et le Bilan ne se base que sur des inventaires verrouillés **localement** ; les fichiers `.txt` WhatsApp servaient d'échange.

Besoin terrain (Rayan) : recevoir le comptage d'un opérateur, le **comparer à l'état de stock ERP de l'usine** (le Bilan), **voir les incohérences**, et **seulement ensuite** décider de valider ou de demander un recomptage — sans perdre le travail si c'est à refaire.

Objectif de B : le **flux d'un seul compteur**. Le multi-compteur (fragmenté) est la spec **C** ; la feuille de stock temps réel + FIFO est la spec **D** (mémoire `project_sips-roadmap-stock-fifo`).

## 2. Décisions validées avec l'utilisateur

1. La **comparaison (Bilan) se fait AVANT la validation**, sur un inventaire **soumis** (statut `submitted`). La validation est la dernière étape.
2. Le Bilan de revue est recalculé contre l'**ERP de l'admin** (la donnée `ETAT` chargée sur l'appareil admin), **pas** le bilan pré-calculé par le compteur.
3. On **réutilise le moteur Bilan existant** (`buildBilan`), paramétré pour accepter un snapshot physique au choix.
4. « Demander recomptage » est **non destructif** et calqué sur la Qualité : la soumission est rejetée avec motif, **garde son snapshot**, revient au **compteur d'origine** pré-remplie (jamais zéro), qui corrige et re-soumet (lié par `recountOf`).
5. **Inventaire 100 % serveur/file** : on **retire** l'export ET l'import d'**un** inventaire en `.txt`, et le bouton **« Valider » local**. Le hors-ligne passe par la **file d'attente** (auto-envoi au retour serveur) + re-ouverture depuis l'historique Comptage.
6. La **Sauvegarde complète (Accueil)** reste (disaster-recovery, séparée du flux inventaire).
7. Le **compteur d'origine** reprend le recomptage (pas n'importe qui).
8. Le mode **100 % local d'origine** (aucun serveur jamais configuré) ne doit pas être cassé.
9. **Article non compté = écart nul (aligné au théorique).** Un article non compté ce tour ne prend **ni** la valeur du dernier inventaire **ni** zéro : il est traité comme **conforme au stock théorique (ERP `ETAT`)** → écart nul. **Seuls les articles réellement comptés produisent un écart** dans le Bilan. L'inventaire enregistre par article « compté (valeur) » ou « non compté » (on ne remplit pas les non-comptés avec le théorique en douce ; c'est le Bilan qui les neutralise).

## 3. Périmètre

**Dans B :**
- Bouton « Comparer au stock (Bilan) » sur un inventaire `inventory` soumis (onglet Serveur).
- Bilan de revue (réutilise `buildBilan`) sur le snapshot de la soumission vs ERP admin.
- Actions « Valider » / « Demander recomptage » depuis ce Bilan de revue.
- Boucle de recomptage non destructive (compteur d'origine).
- `findBilanPair` (Bilan courant) inclut les inventaires **validés serveur** + repli local pendant la transition.
- Retrait : bouton « Valider » local, export/import fichier **d'un** inventaire.
- Re-ouvrir un inventaire local sauvegardé depuis l'historique Comptage → « Soumettre ».
- Modèle de données : réserver un champ par-article `by` (compteur), rempli plus tard par C.

**Hors B (specs séparées) :**
- C : sessions multi-compteurs, parts, conflits, démarrage de session, attribution par article affichée, retrait du secours fichier fragmenté.
- D : feuille stock théorique temps réel + FIFO par lot + garde-fou date de production.

## 4. Flux complet

```
Compteur (1 personne)
  compte  ->  Soumettre au serveur
                |
                +-- en ligne  -> soumission serveur (status submitted)
                +-- hors ligne -> file d'attente locale -> auto-envoi au retour serveur

Admin (onglet Serveur, sur l'inventaire submitted)
  [Comparer au stock (Bilan)]
     -> Bilan de revue : snapshot de la soumission (st) recalculé vs ERP admin (ETAT)
     -> écarts / incohérences visibles
        |
        +-- [Valider]            -> record validé = base officielle ; Bilan courant l'utilise
        +-- [Demander recomptage] -> reject(recountRequested) + motif ; snapshot conservé
                                       |
                                       v
Compteur d'origine (onglet Comptage, section "À recompter")
  recharge sa soumission PRÉ-REMPLIE (jamais zéro)
  corrige les articles fautifs
  Soumettre -> nouvelle soumission liée (recountOf) -> revient à l'admin pour re-comparer
```

## 5. Architecture & composants

### 5.1 Bilan de revue (réutilise `buildBilan`)
- Aujourd'hui `buildBilan` / `findBilanPair` (`js/features/analysis-bilan-feuillet.js`) prennent la référence physique depuis les inventaires verrouillés locaux et la comparent à `ETAT`/`ETAT_DATE`.
- **Changement** : extraire/paramétrer le calcul pour accepter un **snapshot physique fourni** (`st.c` d'une soumission) au lieu d'aller le chercher. Une fonction type `buildBilanFrom(snapshot)` réutilisée par le Bilan courant ET la revue.
- **Règle « non compté = écart nul »** (décision 9) : l'écart n'est calculé que sur les articles **comptés** (`st.c[code].counted === true`). Un article non compté est neutralisé (aligné au théorique `ETAT`), il n'apparaît pas comme écart. À implémenter dans `buildBilanFrom`.
- La revue ouvre une **vue plein écran** (même surface que l'onglet Bilan, plus lisible sur mobile) intitulée « Revue inventaire — <compteur> <date> », rendue par le moteur Bilan, avec en tête les boutons **Valider** / **Demander recomptage** et un retour vers l'onglet Serveur.
- **Pas d'ajout serveur pour comparer** : l'admin lit déjà le détail de la soumission (avec `st`) via `GET /api/submissions/:id`.

### 5.2 `findBilanPair` étendu (Bilan courant)
- Ajouter les inventaires **validés serveur** (`sipsRecords('inventory')`, snapshot dans `payload.st`) au pool de candidats.
- Sélection : le plus récent (≤ `ETAT_DATE` si renseignée). **En cas d'égalité de date, le serveur l'emporte** (officiel).
- **Repli transition** : si aucun inventaire validé serveur, retomber sur les anciens inventaires verrouillés localement (comportement actuel).

### 5.3 Demander recomptage (boucle non destructive)
- **Serveur** : réutiliser `POST /api/submissions/:id/reject` avec un flag **`recountRequested`** (calqué sur `correctionRequested` de la qualité). Le `reject` conserve la soumission (snapshot inclus).
- **Récupération par le compteur d'origine** : permettre à un compte de **lister ses propres** soumissions inventaire rejetées (`status=rejected&type=inventory`, filtrées sur l'auteur = `author.userId`/`userId`). À ajouter au handler de liste des submissions (autorisation : l'auteur voit les siennes).
- **Client (Comptage)** : section **« À recompter »** (comme « Corrections demandées » en Qualité). Recharge le snapshot pré-rempli, l'utilisateur corrige, **Soumettre** crée une nouvelle soumission avec `payload.recountOf = { id, date }` liée à l'originale.
- Le détail admin affiche « Recomptage de … » + le motif (comme la qualité).

### 5.4 Retraits & conservation
- **Retirer** côté inventaire (`js/core/inventory-core.js`, dialogue résumé `#dlg`) : bouton **« Valider »** (`validBtn` → `validateCurrent`) ; boutons **export/secours fichier d'un inventaire** (`shareBtn`, `dlBtn`).
- **Conserver** : `submitInvBtn` (Soumettre), la **Sauvegarde complète** sur Accueil (export/import global via `importAll`/collectLS), tout l'historique idb.
- **Re-consulter** : garantir qu'un inventaire de l'historique Comptage se ré-ouvre et que « Soumettre au serveur » agit dessus.

### 5.5 Modèle de données
- Snapshot inventaire : conserver `st.c[code]` tel quel. **Réserver** un champ optionnel par article `st.c[code].by` (nom du compteur), non rempli en B (un seul compteur → l'agent global suffit), rempli par C sans migration.
- Nouvelle soumission de recomptage : `payload.recountOf = { id, date }`.
- Drapeau serveur : `submission.recountRequested = true` sur la soumission rejetée pour recomptage.

## 6. Côté serveur (résumé des changements)
- `POST /api/submissions/:id/reject` : accepter `recountRequested` (pour `type:inventory`), poser le flag, conserver la soumission (déjà conservée).
- Liste des submissions : autoriser un compte non-admin à lister **ses propres** soumissions `inventory` `rejected` (pour la section « À recompter »).
- Aucun changement sur `validate` (crée déjà le record validé) ni sur la lecture du détail.

## 7. Côté client (fichiers touchés)
- `js/features/analysis-bilan-feuillet.js` : `buildBilanFrom(snapshot)` ; `findBilanPair` inclut serveur + repli ; vue Bilan de revue + actions.
- `js/features/production-movements-server.js` : bouton « Comparer au stock » sur l'inventaire soumis dans l'onglet Serveur ; affichage « Recomptage de … ».
- `js/core/inventory-core.js` : retrait `validBtn`/`shareBtn`/`dlBtn` du résumé ; section « À recompter » + rechargement pré-rempli + `recountOf` à la soumission ; re-ouverture depuis historique.
- `sw.js` : bump de version (changement client).

## 8. Cas limites & garde-fous
- **Aucun serveur configuré** : le flux inventaire 100 % serveur ne doit pas casser le mode 100 % local d'origine — message clair, cohérent avec le verrou strict déjà en place (`sipsRequiresLogin`).
- **Hors-ligne** : Soumettre → file d'attente ; auto-envoi au retour ; rien n'est perdu.
- **Transition Bilan** : repli sur inventaires verrouillés locaux tant qu'aucun validé serveur.
- **Double recomptage** : la chaîne `recountOf` reste traçable (chaîne de soumissions liées).
- **Concurrence** : hors périmètre B (un seul compteur) — traité en C.

## 9. Tests
- **Serveur (`tests/server-security.test.js`)** : (a) `reject` avec `recountRequested` conserve la soumission + pose le flag ; (b) un compte non-admin liste **ses** soumissions inventaire rejetées mais **pas celles des autres** ; (c) `validate` d'un inventaire crée bien le record validé lisible (cf. test `[N]`).
- **Manuel mobile** : compteur soumet → admin compare (écarts vs ERP) → demander recomptage → compteur recharge pré-rempli, corrige, re-soumet → admin compare à nouveau → valide → Bilan courant prend la base serveur.

## 10. Hors périmètre (rappel)
- **C** — inventaire fragmenté : sessions, parts, conflits, démarrage de session, **attribution par article affichée** (« compté par X »), retrait du secours fichier fragmenté.
- **D** — feuille état de stock théorique temps réel (dernier inventaire validé + productions + entrées − sorties, **détail par lot**) puis **FIFO** par date de production (produits finis), avec garde-fou « pas de validation d'inventaire sans date de production pour un produit fini ».
