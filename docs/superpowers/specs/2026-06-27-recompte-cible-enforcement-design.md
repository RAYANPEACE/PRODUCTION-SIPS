# Spec R2-6 — Enforcement serveur du recompte ciblé (isolation des contributions)

Date : 2026-06-27
Statut : design carte blanche (Rayan). Corrige le finding R2-6 de la revue adversariale Codex (isolation faible du recompte ciblé), sorti du lot des 8 correctifs car il demandait une conception du cycle de vie de l'assignment. Branche `inventaire-serveur` (non mergée).

## 1. Problème
Le recompte ciblé : l'admin rejette un inventaire avec `recountArticles` (`{code, by, byUser}`), renvoyant chaque article anormal à SON compteur (`byUser` = username). Le compteur visé re-compte puis envoie sa part via `/api/inventory-rounds/contribution` (même endpoint que la manche normale). **Aujourd'hui** ce endpoint accepte n'importe quels `freshCodes` de n'importe quel compteur authentifié : un compteur non assigné peut soumettre l'article ciblé d'un autre, polluant l'assemblage autoritaire. L'enforcement n'existe qu'à la **lecture** (`forMe`), pas à l'**écriture**.

Difficulté (pourquoi pas un patch trivial) : dans une manche **normale**, tous les compteurs envoient librement leur zone — c'est le design. L'enforcement ne doit valoir que pour les articles **réellement sous recompte ciblé actif**, sans rendre le blocage **collant** (les `recountArticles` d'une soumission rejetée restent sinon éternellement présents → faux blocages).

## 2. Décision : cycle de vie explicite de l'assignment
1. **Actif** : un article est « en recompte ciblé actif » s'il apparaît dans `recountArticles` d'une soumission **inventaire rejetée** dont `recountResolvedAt` est absent/nul.
2. **Enforcement (écriture)** : à `/inventory-rounds/contribution`, pour chaque code compté de la part, si ce code est assigné à un `byUser` **différent** du compteur courant → **rejet 403** (l'article est réservé à un autre compteur). Les codes non assignés et les codes assignés au compteur courant passent (la manche normale reste libre).
3. **Purge à résolution** : `recountResolvedAt` est posé (= now) sur toutes les soumissions inventaire rejetées non résolues quand :
   - une **manche est finalisée** (`/inventory-sessions/:id/finalize`) — un nouvel inventaire assemblé supersede les recomptes en attente ; ou
   - un **inventaire est validé** (`/submissions/:id/validate` avec `type==='inventory'`) — un inventaire officiel récent rend les recomptes antérieurs caducs.
   → l'assignment ne « colle » jamais au-delà de la prochaine assemblée/validation.

Identité : on réutilise la comparaison existante du côté lecture (`me = [user.username, user.nom]` en minuscules ; `byUser` = `contribution.username`, posé à l'assemblage ligne 659).

## 3. Fichiers touchés
- `server/app.mjs` :
  - helper `activeRecountAssignments(db)` → `{ code: Set(byUserLower) }` (soumissions inventaire rejetées, `recountArticles`, `!recountResolvedAt`).
  - endpoint contribution : après le contrôle base (R2-5), bloquer les `countedCodes` assignés à un autre (`403`).
  - finalize : poser `recountResolvedAt` sur les rejets non résolus avant `writeDb`.
  - validate inventaire : idem.

## 4. Cas limites
- **Aucun recompte actif** → `assign` vide → aucun blocage (manche normale inchangée — les tests C1-C5 et R2-5/R2-7 restent verts).
- **Le compteur assigné** soumet son article → autorisé (et peut aussi soumettre d'autres codes non assignés).
- **Deux recomptes ciblés en attente** → une finalisation/validation les purge tous (simplification acceptée : une nouvelle assemblée supersede tout).
- **Article assigné à plusieurs** (improbable) → autorisé si le compteur est l'un d'eux.
- **`byUser` vide** (assignment sans identité stable) → non bloquant (on ne peut pas attribuer).

## 5. Tests (server-security.test.js)
- `[R2-6]` compteur **non assigné** bloqué (403) sur l'article en recompte ciblé d'un autre.
- `[R2-6]` compteur **assigné** peut soumettre son article ciblé.
- `[R2-6]` après **finalisation**, l'assignment est **purgé** → le code redevient libre.
- Régression : C1-C5, R2-5, R2-7 restent verts (les `seedValidatedInventory` purgent les assignments via la validation).

## 6. Hors périmètre
- Refonte d'un « mode manche de recompte » dédié (séparé des manches normales) : non nécessaire avec le cycle de vie ci-dessus.
- Côté client : aucun changement (le 403 remonte en toast via `srvFragSubmitMine`). Pas de bump SW.
