# Inventaire fragmenté (multi-compteurs, hors-ligne d'abord) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à plusieurs compteurs de compter chacun leur zone **hors-ligne**, puis au retour de l'admin assembler les parts côté serveur en un inventaire `submitted` (avec attribution par article et recompte ciblé), qui passe par le flux B *comparer → valider / recompter*.

**Architecture:** On **inverse** le modèle Phase 7 (« l'admin ouvre une session live, les autres la rejoignent ») : chaque part est comptée hors-ligne et part dans la **file d'attente locale** (`lep_server_pending`), puis le serveur la **rattache à la seule manche ouverte** (créée à la première part si aucune). L'assemblage (`finalize`) est **autoritaire côté serveur** : il reconstruit l'inventaire depuis les contributions (jamais le payload client — garde G/H), marque *non compté = écart nul* (`counted:false`, **pas** la valeur de base), estampille chaque article du compteur (`by`), et exige une résolution explicite pour tout conflit. Le recompte ciblé renvoie un/des **article(s) précis** vers **leur** compteur (`by`).

**Tech Stack:** Node.js sans dépendance (`server/app.mjs`), JS vanilla scripts classiques (`js/core/*`, `js/features/*`), IndexedDB + localStorage, tests boîte-noire `tests/server-security.test.js` (sous-processus, `SIPS_DATA_DIR` isolé), `npm run test:server` / `npm run check:js`.

## Global Constraints

- **Spec source :** `docs/superpowers/specs/2026-06-23-inventaire-fragmente-design.md` (C). Dépend de B (déjà livrée) — même objet final : une soumission `inventory` `submitted` qui passe par le flux B.
- **Sécurité fichiers :** JAMAIS de Python pour écrire un fichier. Edit tool ou Node `fs` uniquement. `npm run check:js` après CHAQUE modif client. Tag de sécurité avant la série : `git tag backup-before-frag-c`.
- **Encodage :** pas de guillemets typographiques `'` (U+2019) dans une chaîne JS délimitée par `'...'` ; `\n` pour les sauts de ligne d'`alert`/`confirm`. Préserver le mélange UTF-8 littéral / `\uXXXX` existant.
- **SW cache :** incrémenter `sw.js` ligne 1 (`inv-lep-vXX`) pour TOUT changement client. État de départ : **v124**.
- **Commits :** `git commit -F <fichier>` (here-strings cassent sur accents dans ce shell). Terminer chaque message par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Tests serveur :** `npm run test:server` doit rester **100 % vert** à chaque commit serveur. État de départ : **35/35**.
- **Ne jamais** fusionner tout le snapshot du téléphone ; seuls `freshCodes`/`counts` d'une contribution comptent comme recomptage. La reconstruction est serveur-autoritaire.
- **Mode 100 % local d'origine** (aucun serveur jamais configuré) ne doit pas casser (verrou strict `sipsRequiresLogin`).
- **Réutiliser les helpers existants** : `$`, `esc`, `num`, `fmt`, `toast`, `clone`, `todayStr`, `frDate`, `idbPut/idbGet`, `sipsFetch`, `sipsAdminHeaders`, `sipsActor`, `sipsPending/sipsSetPending`, `buildBilanFrom` (B), `bindClick`.

---

## Vue d'ensemble des fichiers

- **`server/app.mjs`** — store réutilisé `db.inventorySessions` (sémantique « manche »). Nouveau endpoint contribution **sans id** ; `buildInventoryPayloadFromSession` révisé (non compté = `counted:false`, estampille `by`) ; recompte ciblé article→compteur ; listing des recomptes ciblés pour un compteur.
- **`tests/server-security.test.js`** — scénarios C (a)…(f).
- **`js/features/fragments.js`** — remplace le modèle « rejoindre session live » par « ma part hors-ligne → file → rattachement manche » ; vue d'assemblage/couverture ; **retrait** du bloc secours fichier (`fragIngestFile`, `fragAddFile`, `fragRenderFileList`, `fragMergeFiles`, `shareFragment`, `buildFragmentFile`, dialogue `#fragModeFiles`).
- **`js/features/production-movements-server.js`** (onglet Serveur, `sipsLoadServeur`) — vue d'assemblage de la manche ouverte (couverture comptés/par-qui vs non comptés + conflits) + bouton Finaliser → puis Comparer (B).
- **`js/core/inventory-core.js`** — section « À recompter » (B) étendue aux **articles ciblés** ; affichage « compté par X » à la consultation d'archive.
- **`js/core/server-session-tabs.js`** — `sipsFlushPending` draine aussi les contributions `frag-contribution` vers le endpoint sans id ; helper d'enfilage `sipsQueueContribution`.
- **`index.html`** — retrait du bloc HTML `#fragModeFiles` (secours fichier) ; libellés du dialogue `#fragDlg` simplifiés vers « Ma part d'inventaire ».
- **`sw.js`** — bump de version (un seul bump final, ou par lot client).

> **Convention de nommage retenue (décision d'implémentation, cohérente avec la spec §5.1) :** on **réutilise** le store `db.inventorySessions` et les routes `/api/inventory-sessions` existants plutôt que d'introduire un store `inventoryRounds` (moindre churn, moindre risque de régression). La « manche » = une session avec `status:'open'`, **au plus une ouverte à la fois**. On ajoute uniquement les routes nouvelles décrites ci-dessous.

---

## Task 1 : Manche ouverte unique + contribution sans sessionId (serveur)

**Files:**
- Modify: `server/app.mjs` (helpers près de `latestInventoryRecord` / section `INVENTAIRE FRAGMENTE SERVEUR`, autour de 906-1016)
- Test: `tests/server-security.test.js`

**Interfaces:**
- Produces (serveur) :
  - `findOrCreateOpenRound(db, actor) -> sess` : renvoie l'unique session `status:'open'`, en crée une (base = `latestInventoryRecord(db)`) si aucune.
  - `POST /api/inventory-rounds/contribution` (auth requise, **pas** admin) : body `{ payload:{ agent, freshCodes:[code], counts:{code:entry}, cfg?:{code} } , note? }` → rattache la contribution à la manche ouverte (création si aucune), une contribution par `userId` (remplace la sienne). Réponse `{ ok, round: publicInventorySession, contribution }`.
- Consumes : helpers existants `requireAuth`, `authUser`, `latestInventoryRecord`, `publicInventorySession`, `audit`, `readDb/writeDb`, `crypto`.

- [ ] **Step 1 : Écrire le test qui échoue (a)**

Dans `tests/server-security.test.js`, ajouter (suivre le style des tests existants : démarrage serveur sous-processus, `SIPS_DATA_DIR` isolé, helper `api()`/`login()` déjà présents — réutiliser le harnais en place) :

```js
test('[C1] contribution sans sessionId rattachee a la manche ouverte (creee si aucune)', async (t) => {
  const srv = await startServer(t);
  await setupAdmin(srv);                       // helper harnais : cree admin + token
  const tokA = await createUserAndLogin(srv, 'ahmed', 'operateur');
  // aucune session ouverte au depart
  const r1 = await api(srv, 'POST', '/api/inventory-rounds/contribution', {
    token: tokA,
    body: { payload: { agent: 'ahmed', freshCodes: ['190001'], counts: { '190001': { counted: true, _phys: 5 } } } }
  });
  assert.equal(r1.status, 201);
  assert.ok(r1.json.round && r1.json.round.id);
  const roundId = r1.json.round.id;
  // une 2e part d'un autre compteur rejoint la MEME manche ouverte
  const tokB = await createUserAndLogin(srv, 'sara', 'operateur');
  const r2 = await api(srv, 'POST', '/api/inventory-rounds/contribution', {
    token: tokB,
    body: { payload: { agent: 'sara', freshCodes: ['190004'], counts: { '190004': { counted: true, _phys: 9 } } } }
  });
  assert.equal(r2.json.round.id, roundId, 'meme manche ouverte');
  assert.equal((r2.json.round.contributions || []).length, 2);
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run : `npm run test:server`
Expected : FAIL `[C1]` (404 ou route inconnue — endpoint pas encore défini).

- [ ] **Step 3 : Implémenter `findOrCreateOpenRound` + la route**

Dans `server/app.mjs`, ajouter le helper (près de `buildInventoryPayloadFromSession`) :

```js
function findOrCreateOpenRound(db, actor) {
  if (!Array.isArray(db.inventorySessions)) db.inventorySessions = [];
  let sess = db.inventorySessions.find(s => (s.status || 'open') === 'open');
  if (sess) return sess;
  const baseRecord = latestInventoryRecord(db);
  sess = {
    id: 'isess_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
    title: '',
    date: new Date().toISOString().slice(0, 10),
    baseInventoryId: baseRecord ? baseRecord.id : null,
    baseDate: baseRecord && baseRecord.payload ? (baseRecord.payload.date || '') : '',
    baseSnapshot: baseRecord && baseRecord.payload ? (baseRecord.payload.st || null) : null,
    status: 'open',
    createdAt: new Date().toISOString(),
    createdBy: actor ? { id: actor.id, name: actor.nom, role: actor.role } : { name: 'auto' },
    autoOpened: true,
    contributions: []
  };
  db.inventorySessions.push(sess);
  audit(db, 'inventory_session.opened', actor ? actor.nom : 'auto', { id: sess.id, auto: true });
  return sess;
}
```

Ajouter la route (avant le match `/api/inventory-sessions/:id/contributions` existant, dans `handleApiRoutes`) :

```js
if (req.method === 'POST' && url.pathname === '/api/inventory-rounds/contribution') {
  const user = await requireAuth(req, res);
  if (!user) return;
  const body = await readBody(req);
  const payload = body.payload || {};
  const freshCodes = Array.isArray(payload.freshCodes)
    ? [...new Set(payload.freshCodes.map(c => String(c)).filter(Boolean))] : [];
  const counts = {};
  const src = (payload.counts && typeof payload.counts === 'object') ? payload.counts
            : (payload.st && payload.st.c) ? payload.st.c : {};
  for (const code of freshCodes) if (src[code] && src[code].counted) counts[code] = src[code];
  const countedCodes = Object.keys(counts);
  if (!freshCodes.length || !countedCodes.length) {
    return sendJson(res, 400, { ok: false, error: 'Aucun article recompte dans cette part' });
  }
  const db = await readDb();
  const actor = await authUser(req);
  const sess = findOrCreateOpenRound(db, actor);
  const rec = {
    id: 'icontrib_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
    userId: user.id, username: user.username,
    agent: String(payload.agent || user.nom || '').trim() || user.nom,
    counted: countedCodes.length, freshCount: countedCodes.length,
    submittedAt: new Date().toISOString(), note: String(body.note || '').trim(),
    payload: {
      baseInventoryId: sess.baseInventoryId || null, baseDate: sess.baseDate || '',
      agent: String(payload.agent || user.nom || '').trim() || user.nom,
      freshCodes: countedCodes, counts, cfg: payload.cfg || {}
    }
  };
  sess.contributions = sess.contributions || [];
  const existing = sess.contributions.findIndex(c => c.userId === user.id);
  if (existing >= 0) sess.contributions[existing] = rec; else sess.contributions.push(rec);
  sess.updatedAt = rec.submittedAt;
  audit(db, 'inventory_session.contribution', user.nom, { id: sess.id, counted: countedCodes.length });
  await writeDb(db);
  return sendJson(res, existing >= 0 ? 200 : 201, { ok: true, round: publicInventorySession(sess), contribution: rec });
}
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run : `npm run test:server`
Expected : `[C1]` PASS, total inchangé sinon (36/36 attendu).

- [ ] **Step 5 : `node --check` + commit**

Run : `node --check server/app.mjs`
```bash
git add server/app.mjs tests/server-security.test.js
git commit -F docs/superpowers/_msg.txt   # message : "feat(serveur): manche inventaire unique + contribution sans sessionId (C)"
```

---

## Task 2 : Assemblage révisé — non compté = `counted:false`, estampille `by` (serveur)

**Files:**
- Modify: `server/app.mjs` — `buildInventoryPayloadFromSession` (≈603-693)
- Test: `tests/server-security.test.js`

**Interfaces:**
- Produces : `buildInventoryPayloadFromSession(sess, resolutionInput)` renvoie un `payload.st.c[code]` où chaque code **compté** porte `{...entry, by:<agent>}` et chaque code **non compté par personne** vaut `{ counted:false }` (jamais la valeur de base). Conflit (>1 compteur, pas de résolution) → `{ ok:false, status:409, conflicts }` (inchangé). Tout le reste (`frag`, `summary`) conservé.
- Consumes : `cloneJson`, `objectMap`, contributions Task 1.

- [ ] **Step 1 : Écrire les tests qui échouent (b) + (c) + (d) + (f)**

```js
test('[C2] uncounted -> counted:false (jamais la valeur de base) + by estampille', async (t) => {
  const srv = await startServer(t);
  await setupAdmin(srv);
  // base validee : 190001=100, 190009=50  (cree via fixture/finalize anterieur ou injection record)
  const adminTok = srv.adminToken;
  await seedValidatedInventory(srv, { '190001': 100, '190009': 50 });  // helper a ajouter au harnais
  const tokA = await createUserAndLogin(srv, 'ahmed', 'operateur');
  await api(srv, 'POST', '/api/inventory-rounds/contribution', { token: tokA,
    body: { payload: { agent: 'ahmed', freshCodes: ['190001'], counts: { '190001': { counted: true, _phys: 7 } } } } });
  // finalize via la route admin existante sur la manche ouverte
  const round = (await api(srv, 'GET', '/api/inventory-sessions', { token: adminTok })).json.sessions[0];
  const fin = await api(srv, 'POST', '/api/inventory-sessions/' + round.id + '/finalize', { token: adminTok, body: {} });
  assert.equal(fin.status, 200);
  const sub = (await api(srv, 'GET', '/api/submissions?include=payload', { token: adminTok })).json.submissions
              .find(s => s.id === fin.json.submission.id);
  const c = sub.payload.st.c;
  assert.equal(c['190001'].counted, true);
  assert.equal(c['190001'].by, 'ahmed', 'article compte estampille by=compteur');
  assert.equal(c['190009'].counted, false, 'article non compte = counted:false');
  assert.ok(c['190009']._phys == null, 'jamais la valeur de base');
});

test('[C3] conflit (meme code, 2 compteurs) -> finalize refuse sans resolution', async (t) => {
  const srv = await startServer(t);
  await setupAdmin(srv);
  await seedValidatedInventory(srv, { '190001': 100 });
  const a = await createUserAndLogin(srv, 'ahmed', 'operateur');
  const b = await createUserAndLogin(srv, 'sara', 'operateur');
  await api(srv, 'POST', '/api/inventory-rounds/contribution', { token: a,
    body: { payload: { agent: 'ahmed', freshCodes: ['190001'], counts: { '190001': { counted: true, _phys: 7 } } } } });
  await api(srv, 'POST', '/api/inventory-rounds/contribution', { token: b,
    body: { payload: { agent: 'sara', freshCodes: ['190001'], counts: { '190001': { counted: true, _phys: 9 } } } } });
  const round = (await api(srv, 'GET', '/api/inventory-sessions', { token: srv.adminToken })).json.sessions[0];
  const fin = await api(srv, 'POST', '/api/inventory-sessions/' + round.id + '/finalize', { token: srv.adminToken, body: {} });
  assert.equal(fin.status, 409);
  assert.ok((fin.json.conflicts || []).some(x => x.code === '190001'));
});

test('[C4] reconstruction serveur ignore tout payload client forge (regression G/H)', async (t) => {
  const srv = await startServer(t);
  await setupAdmin(srv);
  await seedValidatedInventory(srv, { '190001': 100 });
  const a = await createUserAndLogin(srv, 'ahmed', 'operateur');
  await api(srv, 'POST', '/api/inventory-rounds/contribution', { token: a,
    body: { payload: { agent: 'ahmed', freshCodes: ['190001'], counts: { '190001': { counted: true, _phys: 7 } } } } });
  const round = (await api(srv, 'GET', '/api/inventory-sessions', { token: srv.adminToken })).json.sessions[0];
  // payload client forge : pretend 190001=999 et un article 190099 jamais compte
  const fin = await api(srv, 'POST', '/api/inventory-sessions/' + round.id + '/finalize', { token: srv.adminToken,
    body: { payload: { st: { c: { '190001': { counted: true, _phys: 999 }, '190099': { counted: true, _phys: 1 } } } } } });
  const sub = (await api(srv, 'GET', '/api/submissions?include=payload', { token: srv.adminToken })).json.submissions
              .find(s => s.id === fin.json.submission.id);
  assert.equal(sub.payload.st.c['190001']._phys, 7, 'valeur reconstruite depuis la contribution, pas le payload');
  assert.ok(sub.payload.st.c['190099'] == null || sub.payload.st.c['190099'].counted === false);
});
```

> **Note harnais :** ajouter au fichier de test les helpers manquants `seedValidatedInventory(srv, map)` (crée une soumission `inventory` puis la valide via les routes admin existantes, pour poser une base validée) et `createUserAndLogin` si absent. Suivre les helpers déjà présents en haut du fichier ; ne pas réinventer le démarrage serveur.

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run : `npm run test:server`
Expected : `[C2]` échoue (article non compté garde la base / pas de `by`). `[C3]`/`[C4]` peuvent déjà passer (conflit + reconstruction existent) — c'est OK, ils verrouillent la non-régression.

- [ ] **Step 3 : Réviser `buildInventoryPayloadFromSession`**

Remplacer la construction de `base.c` : ne plus reporter les valeurs de base pour les non-comptés ; partir d'un univers de codes = `clés(baseSnapshot.c) ∪ clés(counts)`, tout en `{counted:false}`, puis remplir les comptés avec `by`. Diff ciblé :

```js
// AVANT (≈609-651) : base.c = objectMap(base.c) puis on ecrit base.c[code]=entry pour les comptes,
//                    en laissant les non-comptes a la valeur de base.
// APRES :
const baseCfg = objectMap(base.cfg);
const universe = new Set(Object.keys(objectMap(base.c)));   // codes connus de la base (pour cfg)
const resultC = {};
const resultCfg = {};
// (byCode construit comme avant a partir des contributions)
for (const code of Object.keys(byCode)) universe.add(code);
const conflicts = [];
const applied = [];
for (const code of [...universe].sort()) {
  const rows = byCode[code];
  if (!rows || !rows.length) { resultC[code] = { counted: false }; continue; }   // non compte = ecart nul
  const hasResolution = Object.prototype.hasOwnProperty.call(resolutions, code);
  if (rows.length > 1 && !hasResolution) {
    conflicts.push({ code, count: rows.length, agents: rows.map(r => r.agent) });
    continue;
  }
  const idx = hasResolution ? resolutions[code] : 0;
  if (!rows[idx]) { conflicts.push({ code, count: rows.length, agents: rows.map(r => r.agent), invalidResolution: idx }); continue; }
  resultC[code] = { ...cloneJson(rows[idx].entry), counted: true, by: rows[idx].agent };
  if (rows[idx].cfg) resultCfg[code] = cloneJson(rows[idx].cfg);
  else if (baseCfg[code]) resultCfg[code] = cloneJson(baseCfg[code]);
  if (rows.length > 1) applied.push({ code, agent: rows[idx].agent, choices: rows.map(r => r.agent) });
}
if (conflicts.length) return { ok: false, status: 409, error: 'Conflits inventaire non resolus', conflicts };
base.c = resultC;
base.cfg = resultCfg;
```

Garder le reste (`base.id/date/agent/sessionStart`, calcul `filled`, `payload.frag`, `summary`) inchangé. `filled` via `countInventoryEntries(base)` reste correct (compte `counted:true`).

- [ ] **Step 4 : Lancer, vérifier le succès**

Run : `npm run test:server`
Expected : `[C2]`/`[C3]`/`[C4]` PASS, et les anciens tests inventaire fragmenté toujours verts.

- [ ] **Step 5 : `node --check` + commit**

```bash
node --check server/app.mjs
git add server/app.mjs tests/server-security.test.js
git commit -F docs/superpowers/_msg.txt   # "feat(serveur): assemblage - non compte=counted:false + estampille by (C)"
```

---

## Task 3 : Recompte ciblé article → compteur (serveur)

**Files:**
- Modify: `server/app.mjs` — route `reject` (≈1218) + listing submissions par auteur (filtre B)
- Test: `tests/server-security.test.js`

**Interfaces:**
- Produces :
  - `POST /api/submissions/:id/reject` accepte en plus `recountArticles: [{ code, by }]` (pour `type:inventory`). Pose `sub.recountArticles = [...]` et `sub.recountRequested = true`. Conserve la soumission (déjà conservée).
  - `GET /api/submissions?status=rejected&type=inventory&forMe=1` (auth, **pas** admin) : renvoie les soumissions rejetées dont **un article** `recountArticles[].by` correspond au compteur courant (`user.username`/`user.nom`), avec la liste `recountArticles` filtrée sur lui. Étend le listing propriétaire de B (qui filtrait sur `author.userId`).
- Consumes : `requireAuth`, `requireAdmin`, `authUser`, helpers B (`recountRequested`).

- [ ] **Step 1 : Écrire le test (e)**

```js
test('[C5] recompte cible ne renvoie que l article vise a son compteur', async (t) => {
  const srv = await startServer(t);
  await setupAdmin(srv);
  await seedValidatedInventory(srv, { '190001': 100, '190004': 40 });
  const a = await createUserAndLogin(srv, 'ahmed', 'operateur');   // username 'ahmed'
  const b = await createUserAndLogin(srv, 'sara', 'operateur');
  await api(srv, 'POST', '/api/inventory-rounds/contribution', { token: a,
    body: { payload: { agent: 'ahmed', freshCodes: ['190001'], counts: { '190001': { counted: true, _phys: 7 } } } } });
  await api(srv, 'POST', '/api/inventory-rounds/contribution', { token: b,
    body: { payload: { agent: 'sara', freshCodes: ['190004'], counts: { '190004': { counted: true, _phys: 9 } } } } });
  const round = (await api(srv, 'GET', '/api/inventory-sessions', { token: srv.adminToken })).json.sessions[0];
  const fin = await api(srv, 'POST', '/api/inventory-sessions/' + round.id + '/finalize', { token: srv.adminToken, body: {} });
  const subId = fin.json.submission.id;
  // admin demande le recompte cible de 190001 (compte par ahmed)
  const rej = await api(srv, 'POST', '/api/submissions/' + subId + '/reject', { token: srv.adminToken,
    body: { note: 'ecart anormal', recountArticles: [{ code: '190001', by: 'ahmed' }] } });
  assert.equal(rej.status, 200);
  // ahmed voit l article ; sara ne le voit pas
  const mineA = await api(srv, 'GET', '/api/submissions?status=rejected&type=inventory&forMe=1', { token: a });
  assert.ok(mineA.json.submissions.some(s => (s.recountArticles || []).some(x => x.code === '190001')));
  const mineB = await api(srv, 'GET', '/api/submissions?status=rejected&type=inventory&forMe=1', { token: b });
  assert.ok(!mineB.json.submissions.some(s => (s.recountArticles || []).some(x => x.code === '190001')));
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run : `npm run test:server` → `[C5]` FAIL (`recountArticles` non géré, `forMe` non géré).

- [ ] **Step 3 : Implémenter**

Dans la route `reject` (après le calcul de `recountRequested`, ≈1218) :

```js
if (sub.type === 'inventory' && Array.isArray(body.recountArticles)) {
  sub.recountArticles = body.recountArticles
    .filter(x => x && x.code)
    .map(x => ({ code: String(x.code), by: String(x.by || '').trim() }));
  if (sub.recountArticles.length) sub.recountRequested = true;
}
```

Dans le handler `GET /api/submissions` (listing), gérer `forMe=1` pour `type=inventory&status=rejected` : autoriser un compte non-admin à voir une soumission rejetée si **un** `recountArticles[].by` == `user.username` ou `user.nom`, en filtrant la liste renvoyée :

```js
const forMe = url.searchParams.get('forMe') === '1';
if (forMe && type === 'inventory' && status === 'rejected') {
  const me = [user.username, user.nom].filter(Boolean).map(s => String(s).toLowerCase());
  rows = rows.filter(s => Array.isArray(s.recountArticles)
    && s.recountArticles.some(a => me.includes(String(a.by || '').toLowerCase())));
  rows = rows.map(s => ({ ...publicSubmission(s),
    recountArticles: (s.recountArticles || []).filter(a => me.includes(String(a.by || '').toLowerCase())) }));
  return sendJson(res, 200, { ok: true, submissions: rows });
}
```

> Adapter aux noms réels du handler de listing (chercher `publicSubmission` / la projection actuelle) ; ne pas exposer `payload` complet aux non-admins ici (juste le résumé + `recountArticles`).

- [ ] **Step 4 : Lancer, vérifier le succès** — `npm run test:server` → `[C5]` PASS.

- [ ] **Step 5 : `node --check` + commit** — `"feat(serveur): recompte cible article->compteur + listing forMe (C)"`.

---

## Task 4 : Part hors-ligne d'abord — file d'attente (client)

**Files:**
- Modify: `js/core/server-session-tabs.js` — `sipsFlushPending` (≈134-154) + nouveau `sipsQueueContribution`
- Modify: `js/features/fragments.js` — `srvFragSendMine`/`srvFragContributionPayload` → envoi vers le endpoint sans id avec repli file
- Modify: `sw.js`

**Interfaces:**
- Consumes : `sipsPending/sipsSetPending`, `sipsFetch`, `sipsActor`, `freshCodes()` (fragments.js), `srvFragContributionPayload()`.
- Produces :
  - `sipsQueueContribution(payload, note) -> bool` : enfile `{ type:'frag-contribution', payload, author:sipsActor(), note, hash }` dans `lep_server_pending` (dédup par hash).
  - `sipsFlushPending` : pour un row `type==='frag-contribution'`, POST `/api/inventory-rounds/contribution` (au lieu de `/api/submissions`).
  - `srvFragSubmitMine()` : envoie la part au endpoint sans id ; si hors-ligne, enfile via `sipsQueueContribution` ; toast cohérent.

- [ ] **Step 1 : `sipsQueueContribution` + drain dans `sipsFlushPending`**

Dans `server-session-tabs.js`, ajouter près de `sipsQueue` :

```js
function sipsQueueContribution(payload,note){
  if(sipsRequiresLogin())return false;
  const hash=localSig('server:frag-contribution',payload||{});
  const rows=sipsPending();
  const i=rows.findIndex(r=>r&&r.hash===hash);
  const row={type:'frag-contribution',payload:payload,author:sipsActor(),note:note||'',hash:hash};
  if(i>=0)rows[i]=row;else rows.push(row);
  sipsSetPending(rows);
  return true;
}
```

Dans `sipsFlushPending`, remplacer l'envoi unique par un aiguillage :

```js
// AVANT : await sipsFetch('/api/submissions', ... {type,payload,author,note});
// APRES :
try{
  if(row.type==='frag-contribution'){
    await sipsFetch('/api/inventory-rounds/contribution',{method:'POST',body:JSON.stringify({payload:row.payload,note:row.note||''})});
  }else{
    await sipsFetch('/api/submissions',{method:'POST',body:JSON.stringify({type:row.type,payload:row.payload,author:row.author,note:row.note||''})});
  }
  sent++;
}catch(e){keep.push(sipsPendingFailure(row,hash,e));}
```

- [ ] **Step 2 : `srvFragSubmitMine` dans fragments.js**

Remplacer `srvFragSendMine` (qui exige une session sélectionnée) par un envoi sans id avec repli file :

```js
async function srvFragSubmitMine(){
  const payload=srvFragContributionPayload();   // {agent, freshCodes, counts, cfg, ...}
  if(!payload.freshCodes.length){toast('Compte au moins un article avant d envoyer ta part');return;}
  if(sipsRequiresLogin()){toast('Connexion requise pour envoyer ta part au serveur.');return;}
  try{
    const r=await sipsFetch('/api/inventory-rounds/contribution',{method:'POST',body:JSON.stringify({payload:payload})});
    toast('Part envoyee au serveur : '+payload.freshCodes.length+' article(s)');
    return r;
  }catch(e){
    if(e.status){toast('Erreur serveur : '+e.message);return;}
    const q=sipsQueueContribution(payload,'');
    toast(q?'Serveur indisponible : part ajoutee en attente (envoi auto au retour)':'Part deja en attente');
  }
}
```

Rebrancher le bouton d'envoi : `if($('#srvFragSend'))$('#srvFragSend').onclick=srvFragSubmitMine;` (remplace `srvFragSendMine`). Supprimer l'ancienne `srvFragSendMine`.

- [ ] **Step 3 : `check:js` + bump SW + commit**

Run : `npm run check:js`
Bump `sw.js` v124→v125.
```bash
git add js/core/server-session-tabs.js js/features/fragments.js sw.js
git commit -F docs/superpowers/_msg.txt   # "feat(comptage): part fragmentee hors-ligne d abord via file d attente (C)"
```

> **Test manuel (pas de test auto client) :** hors-ligne, compter une zone → « Envoyer ma part » → toast « ajoutee en attente » ; rallumer le serveur → la part part toute seule (auto-sync) et apparaît dans la manche.

---

## Task 5 : Vue d'assemblage / couverture + Finaliser (onglet Serveur)

**Files:**
- Modify: `js/features/production-movements-server.js` — `sipsLoadServeur` (vue admin)
- Modify: `js/features/fragments.js` — réutiliser `srvFragAnalyze`/`srvFragResolveConflicts` (assemblage) ; afficher la couverture
- Modify: `sw.js`

**Interfaces:**
- Consumes : `GET /api/inventory-sessions` (manche ouverte), `GET /api/inventory-sessions/:id` (détail+contributions), `finalize` (Task 2), `buildBilanFrom` (B), `srvFragResolveConflicts` (existant).
- Produces : `srvRoundCoverage(sess) -> { comptes:[{code,by}], nonComptes:[code], conflits:[code] }` (dérivé des contributions) ; vue admin « Manche en cours » avec couverture + bouton **Finaliser** → à la finalisation, ouvre le **Bilan de revue** (flux B) sur la soumission créée.

- [ ] **Step 1 : `srvRoundCoverage`** (fragments.js) — dérive qui a compté quoi :

```js
function srvRoundCoverage(sess){
  const by={};
  (sess.contributions||[]).forEach(c=>{(c.payload&&c.payload.freshCodes||[]).forEach(code=>{(by[code]=by[code]||[]).push(c.agent||'Compteur');});});
  const comptes=[],conflits=[];
  Object.keys(by).sort().forEach(code=>{(by[code].length>1?conflits:comptes).push({code,by:by[code]});});
  const known=new Set(Object.keys((sess.baseSnapshot&&sess.baseSnapshot.c)||{}));
  Object.keys(by).forEach(c=>known.add(c));
  const nonComptes=[...known].filter(c=>!by[c]).sort();
  return {comptes,conflits,nonComptes};
}
```

- [ ] **Step 2 : Vue admin « Manche en cours »** dans `sipsLoadServeur` (production-movements-server.js) — bloc qui charge la manche ouverte et affiche la couverture (nombre comptés / non comptés / conflits) + bouton **Finaliser & comparer**. À la finalisation, appeler `srvFragAnalyze` (existant, gère les conflits via `srvFragResolveConflicts`), puis sur la soumission créée appeler le Bilan de revue B (`openRevueBilan(submission)` ou équivalent déjà ajouté en B — réutiliser la fonction du bouton « Comparer au stock »).

> Réutiliser au maximum `srvFragAnalyze` (déjà : détail → build → conflits → finalize). L'ajout C = afficher la **couverture** avant Finaliser et **enchaîner** sur le Bilan de revue B après finalize (au lieu de juste un toast).

- [ ] **Step 3 : `check:js` + bump SW v125→v126 + commit** — `"feat(serveur): vue assemblage/couverture manche + Finaliser puis Comparer (C)"`.

> **Test manuel :** 2 parts (zones différentes + 1 conflit) → onglet Serveur montre couverture (comptés par qui / non comptés / conflit) → Finaliser → résolution conflit → Bilan de revue B s'ouvre.

---

## Task 6 : Recompte ciblé côté compteur + « compté par X » (client)

**Files:**
- Modify: `js/core/inventory-core.js` — section « À recompter » (≈866-881) étendue aux articles ciblés ; affichage `by` à la consultation d'archive (`openArchive`)
- Modify: `js/features/production-movements-server.js` — depuis le Bilan de revue B, bouton « Recompte ciblé » sur un article anormal → `reject` avec `recountArticles:[{code,by}]`
- Modify: `sw.js`

**Interfaces:**
- Consumes : `GET /api/submissions?status=rejected&type=inventory&forMe=1` (Task 3), `st.c[code].by` (Task 2).
- Produces : section « À recompter » liste **les articles précis** (code + désignation) à recompter ; au clic, charge ces articles dans le comptage ; à la consultation d'un inventaire, chaque ligne comptée affiche « compté par X ».

- [ ] **Step 1 : Étendre « À recompter »** — en plus des soumissions rejetées dont l'auteur est le compteur (B), appeler `forMe=1` et lister les `recountArticles` ciblant le compteur ; chaque entrée affiche le(s) code(s)+désignation et un bouton « Recompter ces articles » qui pré-remplit le comptage sur ces codes (réutilise le rechargement pré-rempli de B, restreint aux codes ciblés).

- [ ] **Step 2 : Bouton « Recompte ciblé »** dans le Bilan de revue (production-movements-server.js) — pour une ligne d'écart, `reject` avec `recountArticles:[{code, by: st.c[code].by}]` (le `by` vient du snapshot de la soumission). Confirmation + mot de passe admin (réutilise `authConfirmPassword`).

- [ ] **Step 3 : « compté par X » à la consultation** — dans `openArchive`/rendu d'un inventaire, si `st.c[code].by`, afficher « · compté par <by> » sur la ligne.

- [ ] **Step 4 : `check:js` + bump SW v126→v127 + commit** — `"feat(comptage): recompte cible par article + affichage compte par X (C)"`.

> **Test manuel :** admin demande recompte ciblé d'un article → le bon compteur le voit dans « À recompter » → recompte → re-soumet (file si offline) → ré-assemblage → consultation montre « compté par X ».

---

## Task 7 : Retrait du secours fichier fragmenté (client)

**Files:**
- Modify: `js/features/fragments.js` — supprimer `buildFragmentFile`, `shareFragment`, `fragIngestFile`, `fragAddFile`, `fragRenderFileList`, `fragMergeFiles`, `FRAGFILES`, le handler `#fragMergeFiles`
- Modify: `index.html` — retirer le bloc `<details id="fragModeFiles">` (secours local fichiers) du dialogue `#fragDlg` + le bouton `#fragMergeFiles`
- Modify: `js/core/inventory-core.js` — retirer `bindClick('#fragMergeFiles',…)` (≈1015)
- Modify: `sw.js`

**Interfaces:** aucune nouvelle ; suppression de code mort après les Tasks 4-6.

- [ ] **Step 1 : Vérifier qu'aucune autre référence ne subsiste** — `grep -n "fragMergeFiles\|FRAGFILES\|shareFragment\|buildFragmentFile\|fragIngestFile\|fragAddFile\|fragRenderFileList\|fragModeFiles" js/ index.html`. Tout doit être circonscrit aux fichiers ci-dessus.

- [ ] **Step 2 : Retirer le bloc HTML** `#fragModeFiles` et le bouton `#fragMergeFiles` de `index.html` (dialogue `#fragDlg`), puis les fonctions JS mortes de `fragments.js`, puis le `bindClick('#fragMergeFiles',…)` de `inventory-core.js` et l'appel `fragRenderFileList()`/`rescue` dans `openFragDlg`.

- [ ] **Step 3 : `check:js`** (doit rester vert — pas de référence pendante) **+ bump SW v127→v128 + commit** — `"feat(comptage): retrait du secours fichier fragmente (C)"`.

> **Garde-fou :** ne retirer le secours fichier qu'après que Tasks 4-6 fournissent le chemin serveur complet hors-ligne. Si l'exécution s'arrête avant, **ne pas** faire Task 7.

---

## Task 8 : Mise à jour du relais + mémoire

**Files:**
- Modify: `docs/SIPS_LOCAL_SERVER_HANDOFF.md` (entrée « Fait depuis le relais » + marquer Priorité 2 / Phase 7 mise à jour C)
- Modify (mémoire) : `project_sips-pending-mobile-tests` (ajouter le flux C à tester) ; rien de neuf dans `project_sips-pending-reviews` si déjà couvert.

- [ ] **Step 1 : Documenter** ce qui a été fait, tests `npm run test:server` (nombre vert), SW final, et la liste « À TESTER SUR MOBILE » (scénario 2 téléphones de la spec §9).
- [ ] **Step 2 : Commit** — `"docs: relais - inventaire fragmente C (multi-compteurs hors-ligne)"`.

---

## Cross-model review gate (rappel — instruction globale utilisateur)

C touche une **surface haute-sensibilité** : données d'inventaire multi-utilisateurs, reconstruction serveur autoritaire, isolation par compteur (recompte ciblé). **Avant de finir la branche / merger vers `main`**, recommander à l'utilisateur de lancer la revue adversariale cross-model Codex :

```
/codex:adversarial-review --base <sha-avant-C> --background reconstruction serveur finalize (non-compte=counted:false, by, conflits) + isolation recompte cible forMe + drain file frag-contribution
```

Claude ne peut pas la lancer (`disable-model-invocation`) — donner la commande exacte, l'utilisateur la lance, Claude adjuge les findings. Garder un contrôle cross-model sur les **correctifs** des findings de jugement.

---

## Self-Review (effectuée à l'écriture)

- **Couverture spec C :** §2 décisions 1-10 → Tasks 1 (1,2,3), 2 (5 non-compté, 4 by), 3+6 (8 recompte ciblé), 5 (9 couverture), 4 (1,3 hors-ligne+file), 6 (4 attribution affichée), 7 (10 retrait fichiers), conflit (6) → Tasks 2/5. Garde-fous §8 → notes de tâches. Tests §9 (a-f) → `[C1]`-`[C5]` + régression `[C4]`. ✓
- **Décision d'implémentation explicitée :** réutilisation `inventorySessions` comme « manche » (pas de nouveau store) — documentée en tête.
- **Cohérence des types :** `payload.st.c[code] = { counted, _phys?, by? }` ; `recountArticles:[{code,by}]` ; row file `{type:'frag-contribution',payload,hash}` — utilisés de façon cohérente Tasks 1→6.
- **Point ouvert à valider à l'exécution :** noms exacts du handler de listing `GET /api/submissions` (projection `publicSubmission`) et de la fonction Bilan-de-revue de B (`openRevueBilan` ou équivalent) — à relire dans le code au début des Tasks 3 et 5 (la spec B est déjà livrée, les fonctions existent).
