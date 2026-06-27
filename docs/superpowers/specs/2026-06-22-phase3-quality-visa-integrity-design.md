# Phase 3 — Intégrité des visas qualité (failles A / I / J)

Date : 2026-06-22
Branche : `security-hardening`
Audit source : `project_server-security-audit` (cross-model, 2026-06-21)

## Contexte

Le serveur local SIPS reçoit des fiches qualité (`type: 'quality'`) via `POST /api/submissions`,
puis des signatures via `POST /api/submissions/:id/quality-sign`, avant validation admin
(`POST /api/submissions/:id/validate`). La validation finale exige les visas `operateur` et
`responsableQualite` (voir `missingQualitySignatures`).

Trois failles d'intégrité restent ouvertes après les Phases 0-2 :

- **Faille A (CRITIQUE)** : `POST /api/submissions` stocke `body.payload` verbatim
  (`server/app.mjs:930`). Le client peut donc fournir `payload.visas` — y compris un visa
  `responsableQualite` forgé. `missingQualitySignatures` ne vérifie que la *présence* d'une
  `signature`, pas son origine serveur ni l'identité du signataire. Une fiche entièrement
  forgée par un seul client devient validable.
- **Faille I (append-once manquant)** : `quality-sign` écrit `sub.payload.visas[role] = …`
  (`server/app.mjs:961`) sans garde. Un 2e visa du même rôle écrase silencieusement le premier.
- **Faille J (hash périmé)** : le hash d'intégrité est calculé à la soumission
  (`server/app.mjs:902`) et réutilisé tel quel à la validation (`server/app.mjs:1005`,
  `sub.hash || submissionHash(...)`). Les signatures ajoutées ensuite via `quality-sign` ne
  sont pas reflétées : le hash du record officiel ne couvre pas les visas réels.

## Contrainte structurante : mode offline-first

L'app est offline-first. `sipsSubmit` (`js/core/server-session-tabs.js:96`) met la soumission
en file locale (`sipsQueue`) quand le serveur est injoignable, puis `sipsFlushPending` la rejoue
plus tard, **en une seule requête POST avec le visa opérateur embarqué dans le payload** — car
hors-ligne il n'existe aucun `id` de soumission contre lequel appeler `/quality-sign`.

Conséquence : on ne peut pas « supprimer tous les visas client » sans casser la signature
opérateur en mode offline. La décision retenue (validée avec l'utilisateur) est donc une
sécurité **100% serveur**, qui préserve le flux offline tel quel.

## Décision de conception

Le visa opérateur continue de voyager dans le payload de soumission. Le serveur **ne fait
jamais confiance** à l'identité fournie par le client, ni à aucun visa que le compte
authentifié n'a pas le droit de signer. Aucun changement fonctionnel client n'est requis :
la sécurité est entièrement défensive côté serveur.

## Changements serveur (`server/app.mjs`)

### 1. Faille A — filtrage + estampillage des visas à la soumission

Dans le handler `POST /api/submissions`, pour `type === 'quality'` uniquement, **avant** de
construire `rec` et de calculer le hash, normaliser `body.payload.visas` :

- Partir d'un objet vide.
- Pour chaque `role` du payload entrant : ne le conserver que si
  `role ∈ {operateur, responsableQualite}` **ET** `roleCanSign(user.role).indexOf(role) >= 0`.
- Pour chaque visa conservé, **écraser l'identité** depuis le compte authentifié :
  `{ nom: user.nom, userId: user.id, role, username: user.username }`. Conserver
  `signature` et `date` fournis par le client.
- Remplacer `body.payload.visas` par cet objet normalisé (ou le supprimer s'il est vide).

Une fonction utilitaire dédiée, p. ex. `sanitizeQualityVisas(payload, user)`, encapsule cette
logique pour rester testable et lisible.

Effet attendu (test [A]) : l'admin (`canSign = ['responsableProd']`) soumet des visas
`operateur` + `responsableQualite` forgés → aucun n'est dans `roleCanSign('admin')` → les deux
sont supprimés → `missingQualitySignatures` retourne les deux → `validate` renvoie 400 (≠ 200).

Flux réel : l'opérateur (`canSign = ['operateur']`) → son visa `operateur` survit, estampillé
à son identité serveur. Le `responsableQualite` est supprimé et devra être signé via
`/quality-sign` par un compte habilité.

### 2. Faille I — append-once dans `quality-sign`

Dans le handler `POST /api/submissions/:id/quality-sign`, après avoir résolu `sub` et le `role`,
avant d'écrire le visa :

- Si `sub.payload.visas[role]` existe **et** possède une `signature` non vide commençant par
  `data:image/` → renvoyer `409 { ok: false, error: 'Visa <role> deja signe' }`.
- Sinon (absent, ou présent mais sans image valide) → autoriser la signature (re-signature d'une
  entrée vide/corrompue permise).

### 3. Faille J — recalcul du hash après chaque mutation des visas

- Après le filtrage/estampillage des visas dans `POST /api/submissions`, calculer le hash sur
  le payload **normalisé** (le code calcule déjà le hash après normalisation si on place le
  `sanitizeQualityVisas` avant `submissionHash(type, body.payload)` — vérifier l'ordre).
- Dans `quality-sign`, après avoir ajouté le visa : recalculer et stocker
  `sub.hash = submissionHash(sub.type, sub.payload)`.
- À `validate`, le record reprend `sub.hash` (désormais toujours à jour). Le filet
  `submissionHash(sub.type, sub.payload)` reste correct mais `sub.hash` est la source.

Note dédup : le hash sert aussi à l'anti-doublon à la soumission. Comme les visas restent dans
le hash, deux soumissions identiques du même opérateur (même visa) restent dédupliquées ; deux
opérateurs différents produisent des hash différents, mais le verrou de lot
(`activeQualityLotConflict`) couvre déjà ce cas pour `quality`. Pas de régression attendue.

## Client (`js/features/quality.js`)

**Aucun changement fonctionnel requis.** `qSubmitServer` (`quality.js:509`) embarque déjà
uniquement le visa `operateur` (nom forcé depuis la session), et la signature
`responsableQualite` passe déjà par `/quality-sign` (flux `qLoadPendingBatch`). La sécurité
est server-side.

Conséquence cache SW : si aucun fichier client n'est modifié, **pas de bump `sw.js`**. Si un
détail client doit malgré tout changer à l'implémentation, bumper `sw.js` (actuellement
`inv-lep-v109`).

## Tests et vérification

- `npm run test:server` doit passer de 6/8 à **8/8** :
  - `[A]` fiche à visas forgés non validable (≠ 200) ✅
  - `[I]` 2e signature même rôle → 409 ✅
- `node --check server/app.mjs` OK.
- Ne pas modifier `server/data/sips-data.json`.

## Hors périmètre (Phases ultérieures)

- Phase 4 : `finalize` inventaire autoritatif (failles G/H).
- Phase 5 : `importAll` transactionnel, import secours `partId`, `serveStatic` (failles M/L/K).
- Gate cross-model (`/codex:adversarial-review`) à relancer sur les fixes A/I/J avant de clore
  la branche (surface haute : intégrité des données / signatures).
