# Phase 3 — Intégrité des visas qualité — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher la forge de visas qualité côté client, garantir l'append-once des signatures serveur, et faire couvrir les visas réels par le hash d'intégrité — entièrement côté serveur, sans casser le mode offline.

**Architecture:** Tout se passe dans `server/app.mjs`. À la soumission d'une fiche `quality`, le serveur filtre `payload.visas` (ne garde que les rôles que le compte authentifié peut signer) et estampille l'identité depuis le token. `quality-sign` refuse une 2e signature du même rôle (409) et recalcule le hash. Aucun changement client.

**Tech Stack:** Node.js ESM sans dépendance (serveur maison), harnais de test boîte-noire `tests/server-security.test.js` lancé via `npm run test:server`.

## Global Constraints

- Ne JAMAIS modifier `server/data/sips-data.json`. (Les tests utilisent `SIPS_DATA_DIR` isolé.)
- Valider après chaque modif serveur : `node --check server/app.mjs`.
- Ne pas casser le mode offline : le visa `operateur` continue de voyager dans le payload de soumission.
- Le visa `operateur` valide commence par `data:image/`. Rôles qualité signables : `operateur`, `responsableQualite`.
- Source des droits : `roleCanSign(role)` (`server/app.mjs:31`). `admin.canSign = ['responsableProd']` (ne signe aucun visa qualité).
- L'objet `user` rendu par `requireAuth` possède `id`, `username`, `nom`, `role`.
- Pas de bump `sw.js` (aucun fichier client modifié).

---

### Task 1: Faille A — filtrer et estampiller les visas qualité à la soumission

**Files:**
- Modify: `server/app.mjs` (ajout d'un helper près de `missingQualitySignatures:451-460` ; appel dans le handler `POST /api/submissions:891-939`)
- Test: `tests/server-security.test.js` (déjà écrit — checks `[A]`, lignes 107-120)

**Interfaces:**
- Consumes: `roleCanSign(role)` (`server/app.mjs:31`), `submissionHash(type, payload)` (`server/app.mjs:390`), l'objet `user` de `requireAuth`.
- Produces: `sanitizeQualityVisas(payload, user)` — mute `payload.visas` en place ; ne conserve que les rôles ∈ `roleCanSign(user.role)` ∩ {operateur, responsableQualite} ayant une signature `data:image/`, avec identité écrasée ; supprime `payload.visas` si vide.

- [ ] **Step 1: Lancer le harnais et confirmer que `[A]` (fiche forgée validable) est ROUGE**

Run: `npm run test:server`
Expected: la ligne `✗ [A] une fiche qualite a visas fournis par le client ne doit pas etre validable …` apparaît (rouge). Noter aussi `[I]` rouge — traité en Task 2.

- [ ] **Step 2: Ajouter le helper `sanitizeQualityVisas`**

Insérer juste après `missingQualitySignatures` (après la ligne `server/app.mjs:460`) :

```js
// Securite (faille A) : a la soumission, on ne fait JAMAIS confiance aux visas
// fournis par le client. On ne conserve que les visas dont le ROLE est signable
// par le compte authentifie, et on ecrase l'identite depuis le token. Les autres
// (ex. responsableQualite forge par un operateur) sont supprimes ; ils devront
// passer par /quality-sign. Mode offline preserve : le visa operateur legitime
// voyage dans le payload et est estampille a l'arrivee.
function sanitizeQualityVisas(payload, user) {
  if (!payload || typeof payload !== 'object') return;
  const allowed = roleCanSign(user.role).filter(r => r === 'operateur' || r === 'responsableQualite');
  const incoming = (payload.visas && typeof payload.visas === 'object') ? payload.visas : {};
  const clean = {};
  for (const role of allowed) {
    const v = incoming[role];
    if (v && typeof v === 'object' && typeof v.signature === 'string' && v.signature.indexOf('data:image/') === 0) {
      clean[role] = {
        nom: user.nom,
        signature: v.signature,
        date: String(v.date || new Date().toISOString()),
        userId: user.id,
        username: user.username
      };
    }
  }
  if (Object.keys(clean).length) payload.visas = clean;
  else delete payload.visas;
}
```

- [ ] **Step 3: Appeler le helper AVANT le calcul du hash dans `POST /api/submissions`**

Dans le handler (`server/app.mjs:891+`), remplacer ce bloc :

```js
    const db = await readDb();
    const type = String(body.type);
    const hash = submissionHash(type, body.payload);
```

par :

```js
    const db = await readDb();
    const type = String(body.type);
    // Faille A : normaliser/estampiller les visas qualite avant tout (hash inclus).
    if (type === 'quality') sanitizeQualityVisas(body.payload, user);
    const hash = submissionHash(type, body.payload);
```

(Le hash est ainsi calculé sur le payload nettoyé — couvre aussi la faille J côté soumission.)

- [ ] **Step 4: Vérifier la syntaxe**

Run: `node --check server/app.mjs`
Expected: aucune sortie (OK).

- [ ] **Step 5: Lancer le harnais et confirmer `[A]` VERT**

Run: `npm run test:server`
Expected: `✓ [A] une fiche qualite a visas fournis par le client ne doit pas etre validable …`. Les autres checks déjà verts le restent. `[I]` reste rouge (Task 2).

- [ ] **Step 6: Commit**

```bash
git add server/app.mjs docs/superpowers/plans/2026-06-22-phase3-quality-visa-integrity.md
git commit -m "feat(securite): filtre et estampille les visas qualite a la soumission (Phase 3, faille A)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Failles I + J — append-once et recalcul du hash dans quality-sign

**Files:**
- Modify: `server/app.mjs` (handler `POST /api/submissions/:id/quality-sign`, `server/app.mjs:941-977`)
- Test: `tests/server-security.test.js` (déjà écrit — checks `[I]`, lignes 140-148)

**Interfaces:**
- Consumes: `submissionHash(sub.type, sub.payload)` (`server/app.mjs:390`), `sub.payload.visas[role]`.
- Produces: garde append-once (409 si un visa du rôle a déjà une signature `data:image/`) ; `sub.hash` recalculé après ajout du visa.

- [ ] **Step 1: Confirmer que `[I]` (2e signature même rôle) est ROUGE**

Run: `npm run test:server`
Expected: `✗ [I] 2e signature du meme role doit etre refusee (409 append-once)` (rouge). `[A]` doit être vert (Task 1 faite).

- [ ] **Step 2: Ajouter la garde append-once + le recalcul du hash**

Dans `quality-sign`, remplacer ce bloc (`server/app.mjs:959-968`) :

```js
    sub.payload = sub.payload || {};
    sub.payload.visas = sub.payload.visas || {};
    sub.payload.visas[role] = {
      nom: user.nom,
      signature,
      date: String((body.visa && body.visa.date) || new Date().toISOString()),
      userId: user.id,
      username: user.username
    };
    sub.qualitySignedAt = new Date().toISOString();
```

par :

```js
    sub.payload = sub.payload || {};
    sub.payload.visas = sub.payload.visas || {};
    // Faille I : append-once. Un visa deja signe (vraie image) n'est jamais
    // ecrase. Une entree vide/corrompue (sans image) peut etre (re)signee.
    const prior = sub.payload.visas[role];
    if (prior && typeof prior.signature === 'string' && prior.signature.indexOf('data:image/') === 0) {
      return sendJson(res, 409, { ok: false, error: 'Visa ' + role + ' deja signe' });
    }
    sub.payload.visas[role] = {
      nom: user.nom,
      signature,
      date: String((body.visa && body.visa.date) || new Date().toISOString()),
      userId: user.id,
      username: user.username
    };
    // Faille J : le hash d'integrite doit couvrir les visas signes cote serveur.
    sub.hash = submissionHash(sub.type, sub.payload);
    sub.qualitySignedAt = new Date().toISOString();
```

- [ ] **Step 3: Vérifier la syntaxe**

Run: `node --check server/app.mjs`
Expected: aucune sortie (OK).

- [ ] **Step 4: Lancer le harnais — tout doit être VERT (8/8)**

Run: `npm run test:server`
Expected: `✓ [I] 1re signature operateur acceptee`, `✓ [I] 2e signature du meme role doit etre refusee (409 append-once)`, et `8 reussi(s), 0 echec(s).`

- [ ] **Step 5: Commit**

```bash
git add server/app.mjs
git commit -m "feat(securite): append-once visas qualite + recalcul hash (Phase 3, failles I/J)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Mise à jour du relais et gate cross-model

**Files:**
- Modify: `docs/SIPS_LOCAL_SERVER_HANDOFF.md` (section "Fait depuis le relais")
- Modify (mémoire, hors repo) : `project_server-security-audit` (état des phases)

- [ ] **Step 1: Ajouter l'entrée de relais**

Ajouter en tête de la liste "Fait depuis le relais" de `docs/SIPS_LOCAL_SERVER_HANDOFF.md` une ligne datée 2026-06-22 résumant : Phase 3 (failles A/I/J) — filtrage+estampillage des visas qualité à la soumission, append-once 409 sur `quality-sign`, recalcul du hash ; `npm run test:server` = 8/8 ; `node --check` OK ; aucun changement client (pas de bump SW).

- [ ] **Step 2: Commit**

```bash
git add docs/SIPS_LOCAL_SERVER_HANDOFF.md
git commit -m "docs: relais Phase 3 durcissement (visas qualite A/I/J)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 3: Mettre à jour la mémoire projet**

Marquer Phases 0-3 faites dans `project_server-security-audit`, reds restants = aucun pour A/I/B ; rouges Phase 4/5 non couverts par le harnais actuel.

- [ ] **Step 4: Recommander le gate cross-model (ne PAS lancer soi-même)**

Surface haute (intégrité signatures/données, code écrit par Claude). Donner à l'utilisateur la commande exacte :
`/codex:adversarial-review --base 2d77d3d --background "Phase 3 SIPS : filtrage/estampillage des visas qualite a la soumission (sanitizeQualityVisas), append-once quality-sign, recalcul hash — chercher contournements de la forge de visas, races, et incoherences de hash"`
Puis attendre les findings, les adjuger, et corriger avec un second avis sur les fixes.

---

## Self-Review

**Spec coverage :**
- Faille A → Task 1 (`sanitizeQualityVisas` + appel avant hash). ✅
- Faille I → Task 2 (garde append-once 409). ✅
- Faille J → Task 1 (hash sur payload nettoyé à la soumission) + Task 2 (`sub.hash` recalculé après signature). ✅
- Contrainte offline (visa opérateur dans le payload) → respectée : le helper conserve et estampille le visa opérateur légitime. ✅
- Décision "re-signer si vide" (faille I) → garde 409 uniquement si signature `data:image/` présente. ✅
- Zéro changement client / pas de bump SW → aucune tâche ne touche `js/` ni `sw.js`. ✅
- Tests 8/8 → Task 2 Step 4. ✅
- Gate cross-model → Task 3 Step 4. ✅

**Placeholder scan :** aucun TBD/TODO ; tout le code est fourni intégralement.

**Type consistency :** `sanitizeQualityVisas(payload, user)` mute `payload.visas` ; `submissionHash(type, payload)` utilisé de façon cohérente (Task 1 sur `body.payload`, Task 2 sur `sub.payload`) ; champs visa identiques partout (`nom, signature, date, userId, username`).
