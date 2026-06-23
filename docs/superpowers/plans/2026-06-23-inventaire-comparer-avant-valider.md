# Inventaire serveur — comparer-avant-valider (Spec B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre l'inventaire 100 % serveur avec le flux d'un seul compteur : soumettre → comparer au stock ERP (Bilan de revue) AVANT validation → Valider OU Demander recomptage non destructif (pré-rempli, jamais zéro), le compteur d'origine corrige et re-soumet.

**Architecture:** Le serveur conserve la soumission rejetée pour recomptage (flag `recountRequested`) et laisse l'auteur lister ses propres soumissions inventaire rejetées. Côté client, le moteur Bilan existant (`buildBilan`) est paramétré par un snapshot (`buildBilanFrom`) et réutilisé pour une vue de revue plein écran depuis l'onglet Serveur, plus un `findBilanPair` qui inclut les inventaires validés serveur. Les boutons fichier/valider-local d'un inventaire sont retirés ; le hors-ligne passe par la file d'attente existante.

**Tech Stack:** PWA JavaScript vanilla (scripts classiques, pas de modules), IndexedDB + localStorage, serveur local Node.js sans dépendance (`server/app.mjs`), harnais de test boîte-noire `tests/server-security.test.js` (ESM).

## Global Constraints

- **JAMAIS Python** pour écrire un fichier ; uniquement Edit tool ou Node `fs`. (incident perte de données 2026-06-18)
- **Valider la syntaxe JS après CHAQUE modification client** : `npm run check:js`.
- **Tests serveur** : `npm run test:server` (le harnais sort toujours `exit 0`, lire la ligne `N reussi(s), M echec(s)` ; aucun nouvel échec ne doit apparaître).
- **Incrémenter le cache SW** (`sw.js` ligne 1, `inv-lep-vXX` → `vXX+1`) dès qu'un fichier CLIENT change (index.html, css/, domain/, js/). Une modification serveur seule (server/app.mjs, tests/) ne bump PAS le SW.
- **Pas de guillemets typographiques `'` (U+2019)** dans les chaînes JS délimitées par `'...'`. Dans `alert()`/`confirm()`, sauts de ligne par `\n` uniquement.
- **Commits via `git commit -F <fichier>`** (message en fichier), branche `inventaire-serveur`.
- Tout le texte UI en **français**. Réutiliser les helpers existants : `$`, `esc`, `num`, `fmt`, `fmtq`, `frDate`, `toast`, `clone`, `todayStr`, `snapshot`, `mergeAndMigrate`, `archiveCurrent`, `idbAll`, `sipsFetch`, `sipsRecords`, `sipsAdminHeaders`, `switchTab`, `authConfirmPassword`.
- **Ne JAMAIS commiter `server/data/sips-data.json`.** Ne pas toucher `BLUEPRINT.md` ni d'autres fichiers non liés.
- **Ne pas casser le mode 100 % local d'origine** (aucun serveur jamais configuré).
- **Ordre des scripts** (global scope partagé) : `inventory-core.js` (4) → `server-session-tabs.js` (5) → `production-movements-server.js` (6) → `analysis-bilan-feuillet.js` (7). Les fonctions inter-fichiers ne sont appelées qu'au runtime (clic), jamais au chargement — c'est déjà le cas pour `buildBilan` appelé depuis `inventory-core.js`.

## File Structure

- `server/app.mjs` — handler `reject` accepte `recountRequested` (inventory) ; sérialiseur `publicSubmission` expose `recountRequested` ; handler `GET /api/submissions` autorise l'auteur à lister ses propres inventaires rejetés.
- `tests/server-security.test.js` — tests `[B1]` reject conserve + flag, `[B2]` lecture propriétaire isolée, `[B3]` validate inventory crée un record lisible.
- `js/features/analysis-bilan-feuillet.js` — `buildBilanFrom(snapshot)` (réutilise `buildBilan`) ; `findBilanPair` inclut les validés serveur + repli local + tie-break serveur.
- `js/features/production-movements-server.js` — bouton « Comparer au stock (Bilan) » sur l'inventaire soumis ; vue de revue plein écran + actions Valider / Demander recomptage ; « Recomptage de … » dans le détail.
- `js/core/inventory-core.js` — retrait `validBtn`/`shareBtn`/`dlBtn` (résumé) + import d'UN inventaire `.txt` (historique) ; section « À recompter » + rechargement pré-rempli + `recountOf` à la soumission.
- `index.html` — retrait des 3 boutons du résumé inventaire (`shareBtn`, `dlBtn`, `validBtn`).
- `sw.js` — bump version (changements client).
- `docs/SIPS_LOCAL_SERVER_HANDOFF.md` — relais mis à jour.

---

### Task 1: Serveur — `reject` accepte `recountRequested` (inventory) + sérialiseur

**Files:**
- Modify: `server/app.mjs` (sérialiseur `publicSubmission` ~409-422 ; handler decision ~1205-1209)
- Test: `tests/server-security.test.js` (ajout bloc `[B1]` avant le bloc `[K]` final, ~ligne 320)

**Interfaces:**
- Produces: `POST /api/submissions/:id/reject` avec body `{recountRequested:true}` pose `submission.recountRequested=true` sur une soumission `type:inventory` rejetée et conserve la soumission ; `recountRequested` est exposé par `publicSubmission`/`fullSubmission`.

- [ ] **Step 1: Écrire le test `[B1]` qui échoue**

Dans `tests/server-security.test.js`, juste avant le commentaire `// ---- [K] serveStatic` (~ligne 321), insérer :

```js
    // ---- [B1] reject inventaire avec recountRequested conserve la soumission + pose le flag ----
    const invCounter = await makeUser(adminToken, 'magasinier', 'recb1');
    const invSub = await api('POST', '/api/submissions', {
      token: invCounter,
      body: { type: 'inventory', payload: { kind: 'inventory', date: '2026-06-23', agent: 'Compteur B1', filled: 1, st: { c: { 'B1-CODE': { counted: true, blocks: [{ qty: 3 }] } } } } }
    });
    const invSubId = invSub.json && invSub.json.submission && invSub.json.submission.id;
    const recountReject = await api('POST', '/api/submissions/' + invSubId + '/reject', { token: adminToken, body: { recountRequested: true, note: 'Recompter B1-CODE' } });
    const dbB1 = await readTestDb(dataDir);
    const keptB1 = dbB1.submissions.find(s => s.id === invSubId);
    check('[B1] reject inventaire conserve la soumission', !!keptB1 && keptB1.status === 'rejected');
    check('[B1] reject inventaire pose recountRequested', !!keptB1 && keptB1.recountRequested === true);
    check('[B1] recountRequested est exposé par l API', recountReject.status === 200 && recountReject.json.submission && recountReject.json.submission.recountRequested === true);
```

- [ ] **Step 2: Lancer le test et voir `[B1]` échouer**

Run: `npm run test:server`
Expected: la ligne récap montre des `✗ [B1] …` (flag/expose absents) ; le total `echec(s)` augmente.

- [ ] **Step 3: Exposer `recountRequested` dans le sérialiseur**

Dans `server/app.mjs`, dans `publicSubmission` (~ligne 419), après la ligne `correctionRequested: !!s.correctionRequested,` ajouter :

```js
    recountRequested: !!s.recountRequested,
```

- [ ] **Step 4: Poser le flag à la décision `reject`**

Dans `server/app.mjs`, handler decision, juste après la ligne `sub.correctionRequested = sub.status === 'rejected' && sub.type === 'quality' && !!body.correction;` (~ligne 1209) ajouter :

```js
    sub.recountRequested = sub.status === 'rejected' && sub.type === 'inventory' && !!body.recountRequested;
```

- [ ] **Step 5: Lancer les tests et vérifier le vert**

Run: `npm run test:server`
Expected: les 3 `✓ [B1] …` ; aucun nouvel échec. Puis `node --check server/app.mjs` (pas d'erreur).

- [ ] **Step 6: Commit**

```bash
git add server/app.mjs tests/server-security.test.js
git commit -F - <<'EOF'
feat(serveur): reject inventaire accepte recountRequested (recomptage non destructif)

POST /api/submissions/:id/reject pose submission.recountRequested=true pour
type:inventory et conserve la soumission (snapshot inclus). publicSubmission
expose recountRequested. Test [B1] ajoute (3 checks).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

### Task 2: Serveur — l'auteur liste ses propres inventaires rejetés (recomptage)

**Files:**
- Modify: `server/app.mjs` (handler `GET /api/submissions` ~1067-1084)
- Test: `tests/server-security.test.js` (bloc `[B2]` + `[B3]` après `[B1]`)

**Interfaces:**
- Consumes: flag `recountRequested` (Task 1).
- Produces: `GET /api/submissions?status=rejected&type=inventory&include=payload` autorise un compte non-admin connecté, mais ne renvoie QUE ses propres soumissions (`author.id === user.id`) ; un admin voit toutes.

- [ ] **Step 1: Écrire les tests `[B2]` et `[B3]` qui échouent**

Dans `tests/server-security.test.js`, juste après le bloc `[B1]` ajouté en Task 1, insérer :

```js
    // ---- [B2] l auteur liste SES inventaires rejetes, pas ceux des autres ----
    const otherCounter = await makeUser(adminToken, 'magasinier', 'recb2');
    const ownList = await api('GET', '/api/submissions?status=rejected&type=inventory&include=payload', { token: invCounter });
    const otherList = await api('GET', '/api/submissions?status=rejected&type=inventory&include=payload', { token: otherCounter });
    const adminList = await api('GET', '/api/submissions?status=rejected&type=inventory&include=payload', { token: adminToken });
    check('[B2] l auteur voit sa soumission inventaire rejetee', ownList.status === 200 && (ownList.json.submissions || []).some(s => s.id === invSubId));
    check('[B2] un autre compte ne voit PAS la soumission rejetee d autrui', otherList.status === 200 && !(otherList.json.submissions || []).some(s => s.id === invSubId));
    check('[B2] l admin voit toutes les soumissions inventaire rejetees', adminList.status === 200 && (adminList.json.submissions || []).some(s => s.id === invSubId));

    // ---- [B3] validate d un inventaire cree un record valide lisible (st present) ----
    const invSub3 = await api('POST', '/api/submissions', {
      token: invCounter,
      body: { type: 'inventory', payload: { kind: 'inventory', date: '2026-06-23', agent: 'Compteur B3', filled: 1, st: { c: { 'B3-CODE': { counted: true, blocks: [{ qty: 9 }] } } } } }
    });
    const invSub3Id = invSub3.json && invSub3.json.submission && invSub3.json.submission.id;
    const validateInv = await api('POST', '/api/submissions/' + invSub3Id + '/validate', { token: adminToken, body: {} });
    const recRead = await api('GET', '/api/records?type=inventory&status=validated', { token: invCounter });
    const invRecord = recRead.json && (recRead.json.records || []).find(r => r.sourceSubmissionId === invSub3Id);
    check('[B3] validate inventaire renvoie 200', validateInv.status === 200);
    check('[B3] le record inventaire valide est lisible avec son snapshot st',
      !!invRecord && invRecord.payload && invRecord.payload.st && invRecord.payload.st.c && !!invRecord.payload.st.c['B3-CODE']);
```

- [ ] **Step 2: Lancer le test et voir `[B2]` échouer**

Run: `npm run test:server`
Expected: `✗ [B2] l auteur voit …` et/ou `✗ [B2] un autre compte ne voit PAS …` (le handler renvoie 401 ou ne filtre pas). `[B3]` devrait déjà passer (validate inventory crée le record), mais le confirmer.

- [ ] **Step 3: Réécrire le handler `GET /api/submissions`**

Dans `server/app.mjs`, remplacer le bloc `if (req.method === 'GET' && url.pathname === '/api/submissions') { … }` (~1067-1084) par :

```js
  if (req.method === 'GET' && url.pathname === '/api/submissions') {
    const db = await readDb();
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const includePayload = url.searchParams.get('include') === 'payload';
    const admin = await isAdminRequest(req);
    const user = await authUser(req);
    if (includePayload) {
      const qualitySignerRead = type === 'quality' && ['submitted', 'rejected'].indexOf(status) >= 0 && canSignQuality(user);
      // Recomptage : un compte connecte peut lire SES PROPRES inventaires rejetes (avec payload.st).
      const invOwnerRead = type === 'inventory' && status === 'rejected' && !!user;
      if (!qualitySignerRead && !invOwnerRead && !admin) {
        return sendJson(res, 401, { ok: false, error: 'Acces admin requis' });
      }
    }
    let rows = db.submissions;
    if (status) rows = rows.filter(s => s.status === status);
    if (type) rows = rows.filter(s => s.type === type);
    // Un non-admin ne voit QUE ses propres soumissions inventaire rejetees.
    if (type === 'inventory' && status === 'rejected' && !admin) {
      rows = user ? rows.filter(s => s.author && s.author.id === user.id) : [];
    }
    rows = rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sendJson(res, 200, { ok: true, submissions: rows.map(includePayload ? fullSubmission : publicSubmission) });
  }
```

- [ ] **Step 4: Lancer les tests et vérifier le vert**

Run: `npm run test:server`
Expected: tous les `✓ [B2] …` et `✓ [B3] …` ; aucun nouvel échec (les `[N]` qualité/records restent verts). Puis `node --check server/app.mjs`.

- [ ] **Step 5: Commit**

```bash
git add server/app.mjs tests/server-security.test.js
git commit -F - <<'EOF'
feat(serveur): l auteur liste ses inventaires rejetes pour recomptage

GET /api/submissions?status=rejected&type=inventory&include=payload autorise
un compte connecte mais ne renvoie que ses propres soumissions (author.id);
l admin voit tout. Tests [B2] (isolation auteur) + [B3] (record valide lisible).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

### Task 3: Bilan — `buildBilanFrom(snapshot)` (réutilise `buildBilan`)

**Files:**
- Modify: `js/features/analysis-bilan-feuillet.js` (après `buildBilan`, ~ligne 286)
- Modify: `sw.js` (bump version — fait en Task 7 groupé ; ici on ajoute du code client donc on validera check:js)

**Interfaces:**
- Produces: `buildBilanFrom(snapshot)` → même objet que `buildBilan()` (`{rows, alertes, total, reco}`), calculé sur le snapshot fourni (`{c:{...}}`) au lieu du comptage courant `ST`. Décision 9 (« non compté = écart nul ») héritée de `buildBilan` (un article `!counted` reste `phys=null` → écart `null`, exclu de `totEc`).

- [ ] **Step 1: Lire `buildBilan` et `renderBilan` pour confirmer la mécanique d'échange de `ST`**

Run: ouvrir `js/features/analysis-bilan-feuillet.js` lignes 265-380. Confirmer que `buildBilan()` lit `ST.c[code]` et `total(r)` (basé sur `ST`), et que `renderBilan` échange déjà `ST` autour de `buildBilan`. `buildBilanFrom` applique le même échange, encapsulé et restauré dans un `finally`.

- [ ] **Step 2: Ajouter `buildBilanFrom`**

Dans `js/features/analysis-bilan-feuillet.js`, juste après la fin de `function buildBilan(){…}` (après la ligne `return {rows:rows,alertes:alertes,total:totEc,reco:alertes.length?'RECOMPTER':'VALIDER'};}`, ~ligne 286), insérer :

```js
/* Bilan calcule sur un snapshot physique fourni (soumission/record serveur, inventaire valide)
   au lieu du comptage courant. Reutilise buildBilan en echangeant temporairement ST puis le
   restaure. Decision 9 (non compte = ecart nul) est heritee de buildBilan : un article non
   compte reste phys=null -> ecart null, neutralise (aligne au theorique), exclu de l ecart total. */
function buildBilanFrom(snapshot){
  const prevST=ST,prevRO=RO;
  try{
    ST=snapshot?JSON.parse(JSON.stringify(snapshot)):freshCounts();
    mergeAndMigrate();
    return buildBilan();
  }finally{ST=prevST;RO=prevRO;}
}
```

- [ ] **Step 3: Valider la syntaxe JS**

Run: `npm run check:js`
Expected: OK (aucune erreur).

- [ ] **Step 4: Commit**

```bash
git add js/features/analysis-bilan-feuillet.js
git commit -F - <<'EOF'
feat(bilan): buildBilanFrom(snapshot) reutilise buildBilan sur un snapshot fourni

Permet de comparer un snapshot d inventaire soumis/valide a l ERP admin (ETAT)
sans remplacer le comptage courant. Decision 9 (non compte = ecart nul) heritee
de buildBilan (phys null exclu de l ecart). Sert le Bilan de revue (Task 5).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

### Task 4: Bilan — `findBilanPair` inclut les inventaires validés serveur + repli local

**Files:**
- Modify: `js/features/analysis-bilan-feuillet.js` (`findBilanPair` ~358-371)

**Interfaces:**
- Consumes: `sipsRecords('inventory', {timeoutMs})` → tableau de records `{payload:{date,agent,st},validatedAt,createdAt}`.
- Produces: `findBilanPair()` async → `{pair, posterior}` où `pair` peut désormais être un inventaire validé **serveur** (`{date,agent,st,savedAt,server:true}`) ou local verrouillé ; à date égale le serveur l'emporte ; repli local si aucun validé serveur.

- [ ] **Step 1: Remplacer `findBilanPair`**

Dans `js/features/analysis-bilan-feuillet.js`, remplacer toute la fonction `async function findBilanPair(){…}` (~358-371) par :

```js
/* Trouve l'inventaire de reference a apparier a l'etat de stock (ERP). Pool = inventaires VALIDES
   SERVEUR (officiels, payload.st) + inventaires verrouilles LOCAUX (repli transition). Selection :
   le plus recent (<= ETAT_DATE si renseignee, jamais posterieur). A date egale, le serveur l'emporte. */
async function findBilanPair(){
  let recs=[];try{recs=await idbAll();}catch(e){recs=[];}
  const localInvs=recs.filter(r=>r&&r.locked&&r.st&&r.st.c&&r.id!=='current'
    &&String(r.id).indexOf('prod_')!==0&&String(r.id).indexOf('sortie_')!==0
    &&String(r.id).indexOf('entree_')!==0&&String(r.id).indexOf('fragsess_')!==0)
    .map(r=>({date:r.date||'',agent:r.agent||'',st:r.st,savedAt:r.savedAt||0,server:false}));
  let serverInvs=[];
  try{
    const rows=await sipsRecords('inventory',{timeoutMs:1200});
    serverInvs=(rows||[]).filter(r=>r&&r.payload&&r.payload.st&&r.payload.st.c)
      .map(r=>({date:(r.payload.date||''),agent:(r.payload.agent||''),st:r.payload.st,savedAt:Date.parse(r.validatedAt||r.createdAt||'')||0,server:true}));
  }catch(e){serverInvs=[];}
  const pool=serverInvs.concat(localInvs);
  if(!pool.length)return {pair:null,posterior:0};
  // tri : date desc ; a date egale, serveur (officiel) d'abord ; puis savedAt desc
  pool.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||((b.server?1:0)-(a.server?1:0))||((b.savedAt||0)-(a.savedAt||0)));
  if(ETAT_DATE){
    const le=pool.filter(r=>String(r.date||'')<=ETAT_DATE);
    return {pair:le[0]||null,posterior:pool.length-le.length};
  }
  return {pair:pool[0],posterior:0};
}
```

- [ ] **Step 2: Valider la syntaxe JS**

Run: `npm run check:js`
Expected: OK.

- [ ] **Step 3: Vérifier la non-régression du repli local (revue manuelle du code)**

Confirmer : si `sipsRecords` échoue/retourne `[]`, `serverInvs=[]` et `pool=localInvs` → comportement identique à avant (dernier inventaire verrouillé local). `renderBilan` consomme `pair.st`/`pair.date`/`pair.agent` qui existent dans les nouveaux objets du pool. `bilPairBanner` lit `pair.date`/`pair.agent` (compatibles).

- [ ] **Step 4: Commit**

```bash
git add js/features/analysis-bilan-feuillet.js
git commit -F - <<'EOF'
feat(bilan): findBilanPair inclut les inventaires valides serveur + repli local

Le Bilan courant s appaire au plus recent inventaire valide (serveur officiel ou
local verrouille, <= ETAT_DATE). A date egale, le serveur l emporte. Repli sur les
inventaires verrouilles locaux tant qu aucun valide serveur (transition).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

### Task 5: Serveur (onglet) — bouton « Comparer au stock » + vue de revue + actions

**Files:**
- Modify: `js/features/production-movements-server.js` (`sipsSubmissionDetailHTML` ~339-343 ; `sipsSubmissionHTML` actions ~350 ; `sipsLoadServeur` wiring ~430 ; ajout `sipsOpenInventoryReview` + `sipsReviewDecide`)

**Interfaces:**
- Consumes: `buildBilanFrom` + `fullTablesHTML` (Task 3, fichier 7, appelés au runtime), `switchTab('serveur')`, `authConfirmPassword`, `sipsAdminHeaders`, `sipsFetch`.
- Produces: sur une soumission `inventory` `submitted`, bouton `Comparer au stock (Bilan)` ouvrant une vue plein écran « Revue inventaire — <compteur> <date> » avec écarts vs ERP admin et boutons `Valider` / `Demander recomptage`.

- [ ] **Step 1: Afficher « Recomptage de … » dans le détail inventaire**

Dans `js/features/production-movements-server.js`, dans `sipsSubmissionDetailHTML`, remplacer la branche `if(s.type==='inventory'){…}` (~339-343) par :

```js
  if(s.type==='inventory'){
    const detail=Object.keys(p.detail||{}).map(code=>Object.assign({code:code},p.detail[code]));
    return sipsKV([['Date',frDate(p.date)],['Compteur',p.agent],['Articles comptes',p.filled],['Recomptage de',p.recountOf&&p.recountOf.id],['Alertes bilan',p.bilan&&p.bilan.nbAlertes],['Ecart total',p.bilan&&p.bilan.total]])
      +(s.recountRequested?'<p style="color:var(--red);font-size:12px;margin:6px 0 0">Recomptage demande</p>':'')
      +sipsLines('Articles comptes',detail.slice(0,80),[['code','Code'],['n','Article'],['p','Physique'],['t','Theorique'],['e','Ecart']]);
  }
```

- [ ] **Step 2: Ajouter le bouton « Comparer au stock » sur l'inventaire soumis**

Dans `sipsSubmissionHTML`, remplacer la ligne `const actions=s.status==='submitted'?'<button data-act="validate">Valider</button>'+(s.type==='quality'?'<button class="del" data-act="correction">Demander correction</button>':'')+'<button class="del" data-act="reject">Rejeter</button>':'';` (~350) par :

```js
  const actions=s.status==='submitted'
    ?(s.type==='inventory'
       ?'<button data-act="compare">Comparer au stock (Bilan)</button><button data-act="validate">Valider</button><button class="del" data-act="reject">Rejeter</button>'
       :'<button data-act="validate">Valider</button>'+(s.type==='quality'?'<button class="del" data-act="correction">Demander correction</button>':'')+'<button class="del" data-act="reject">Rejeter</button>')
    :'';
```

- [ ] **Step 3: Brancher le bouton `compare` dans `sipsLoadServeur`**

Dans `sipsLoadServeur`, remplacer la sous-expression de câblage des soumissions `subs.querySelectorAll('[data-sub]').forEach(el=>{const id=el.dataset.sub;el.querySelectorAll('button[data-act]').forEach(b=>b.onclick=()=>sipsDecide(id,b.dataset.act));});` (~430) par :

```js
subs.querySelectorAll('[data-sub]').forEach(el=>{const id=el.dataset.sub;el.querySelectorAll('button[data-act]').forEach(b=>{if(b.dataset.act==='compare'){const sub=rows.find(x=>x.id===id);b.onclick=()=>sipsOpenInventoryReview(sub);}else{b.onclick=()=>sipsDecide(id,b.dataset.act);}});});
```

- [ ] **Step 4: Ajouter `sipsOpenInventoryReview` et `sipsReviewDecide`**

Dans `js/features/production-movements-server.js`, juste après la fonction `sipsSubmissionDetailHTML` (~ligne 345, avant `function sipsSubmissionHTML`), insérer :

```js
/* Vue de revue plein ecran : compare le snapshot d une soumission inventaire a l ERP admin (ETAT),
   reutilise le moteur Bilan (buildBilanFrom), puis offre Valider / Demander recomptage. */
function sipsOpenInventoryReview(s){
  if(!s){toast('Soumission introuvable');return;}
  const p=s.payload||{};
  if(!p.st||!p.st.c){toast('Soumission sans detail de comptage');return;}
  let r;try{r=buildBilanFrom(p.st);}catch(e){toast('Bilan indisponible : '+e.message);return;}
  const counted=r.rows.filter(x=>x.counted).length;
  const who=p.agent||(s.author&&s.author.name)||'—';
  const app=$('#app');
  app.innerHTML='<div class="bilan-wrap">'
    +'<div class="bil-ctrl"><button id="revBack" class="b-sec">← Retour serveur</button>'
    +'<button id="revValidate" class="b-go">✅ Valider</button>'
    +'<button id="revRecount" class="del">↩ Demander recomptage</button></div>'
    +'<h2 class="prod-title">Revue inventaire — '+esc(who)+' '+esc(frDate(p.date)||'')+'</h2>'
    +'<div class="bil-pair '+(r.alertes.length?'warn':'ok')+'">'
      +(r.alertes.length?('⚠ '+r.alertes.length+' ecart(s) a verifier'):'✓ Aucun ecart bloquant')
      +' · ecart total <b>'+fmtq(Math.round(r.total*1000)/1000)+'</b> · '+counted+' article(s) comptes vs etat de stock du <b>'+esc(ETAT_DATE||'—')+'</b></div>'
    +fullTablesHTML(r)+'</div>';
  $('#revBack').onclick=()=>{switchTab('serveur');};
  $('#revValidate').onclick=()=>sipsReviewDecide(s.id,'validate');
  $('#revRecount').onclick=()=>sipsReviewDecide(s.id,'recount');
}
async function sipsReviewDecide(id,kind){
  const actor=(typeof USR!=='undefined'&&USR.nom)||'admin';
  if(kind==='validate'){
    if(!confirm('Valider cet inventaire ?\n\nIl deviendra la base officielle du Bilan.'))return;
    if(typeof authConfirmPassword==='function'&&!(await authConfirmPassword('valider cet inventaire')))return;
    try{await sipsFetch('/api/submissions/'+encodeURIComponent(id)+'/validate',{method:'POST',headers:sipsAdminHeaders(),body:JSON.stringify({actor:actor})});toast('Inventaire valide');}
    catch(e){toast('Erreur serveur : '+e.message);return;}
  }else{
    const note=prompt('Motif du recomptage (articles a revoir) ?','Recompter les ecarts signales');
    if(note===null)return;
    if(typeof authConfirmPassword==='function'&&!(await authConfirmPassword('demander un recomptage')))return;
    try{await sipsFetch('/api/submissions/'+encodeURIComponent(id)+'/reject',{method:'POST',headers:sipsAdminHeaders(),body:JSON.stringify({actor:actor,note:note||'',recountRequested:true})});toast('Recomptage demande');}
    catch(e){toast('Erreur serveur : '+e.message);return;}
  }
  switchTab('serveur');
}
```

- [ ] **Step 5: Valider la syntaxe JS**

Run: `npm run check:js`
Expected: OK.

- [ ] **Step 6: Commit**

```bash
git add js/features/production-movements-server.js
git commit -F - <<'EOF'
feat(serveur): comparer un inventaire soumis au stock (Bilan de revue) avant validation

Sur une soumission inventory submitted, bouton "Comparer au stock (Bilan)" ouvre
une vue plein ecran "Revue inventaire" : ecarts du snapshot vs ERP admin (ETAT)
via buildBilanFrom, puis Valider ou Demander recomptage (reject recountRequested).
Detail affiche "Recomptage de" + "Recomptage demande".

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

### Task 6: Comptage — retrait Valider local + export/import fichier d'UN inventaire

**Files:**
- Modify: `index.html` (résumé inventaire : retirer `shareBtn`, `dlBtn`, `validBtn` ~74,75,78)
- Modify: `js/core/inventory-core.js` (retrait des 3 handlers ~1061-1063 ; retrait du bloc « Importer un inventaire reçu (.txt) » dans `openHistory` ~863-867)

**Interfaces:**
- Produces: le résumé inventaire ne propose plus que `Soumettre au serveur` (`submitInvBtn`) ; l'historique inventaire ne propose plus l'import d'UN inventaire `.txt`. La Sauvegarde complète (export/import global, en haut de `openHistory`) et la liste « Valides serveur » sont conservées.

- [ ] **Step 1: Retirer les 3 boutons du résumé dans `index.html`**

Dans `index.html`, supprimer les trois lignes suivantes (~74, 75, 78) :

```html
      <button class="b-sec" id="shareBtn">Secours WhatsApp / mail</button>
      <button class="b-sec" id="dlBtn">Télécharger secours local</button>
```
et
```html
      <button class="b-go" id="validBtn" style="background:#0e1a12;color:#5dffb0">🔒 Valider cet inventaire (devient la référence)</button>
```

Vérifier qu'il reste le bouton `submitInvBtn` (« Soumettre au serveur »). Ne PAS toucher aux autres boutons du dialogue.

- [ ] **Step 2: Retirer les handlers correspondants dans `inventory-core.js`**

Dans `js/core/inventory-core.js`, supprimer les trois lignes (~1061-1063) :

```js
bindClick('#shareBtn',shareJSON);
$('#dlBtn').onclick=()=>{archiveCurrent();download(exportName(),buildJSON(),'text/plain');toast('Fichier enregistré');};
bindClick('#validBtn',validateCurrent);
```

(IMPORTANT : la ligne `$('#dlBtn').onclick=…` n'est PAS défensive — sans le bouton elle planterait au chargement ; elle DOIT être retirée. `bindClick('#submitInvBtn',submitInventoryServer);` juste au-dessus est conservé. Les fonctions `shareJSON` et `validateCurrent` restent définies mais orphelines — c'est sans effet ; ne pas les supprimer pour limiter le diff. `validateCurrent` n'est plus appelé depuis le résumé ; la validation locale 🔒 par enregistrement reste disponible dans l'historique pour le repli transition.)

- [ ] **Step 3: Retirer l'import d'UN inventaire `.txt` dans `openHistory`**

Dans `js/core/inventory-core.js`, dans `openHistory`, supprimer le bloc (~863-867) :

```js
  const fi=document.createElement('input');fi.type='file';fi.accept='.txt,.json,text/plain';fi.style.display='none';
  fi.onchange=function(e){const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=function(){importInventory(rd.result);};rd.readAsText(f);};
  const imp=document.createElement('button');imp.style.cssText='width:100%;margin-bottom:10px;padding:10px;border-radius:8px;border:1.5px solid #c5e4d2;color:var(--green);background:#e7f3ec;font-weight:700;font-size:14px';
  imp.textContent='Importer un inventaire reçu (.txt)';imp.onclick=function(){fi.click();};
  list.append(fi,imp);
```

(La Sauvegarde complète `expB`/`expLB`/`impB` en haut de `openHistory` est conservée — disaster recovery, hors flux inventaire. `importInventory` reste défini mais orphelin.)

- [ ] **Step 4: Valider la syntaxe JS**

Run: `npm run check:js`
Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add index.html js/core/inventory-core.js
git commit -F - <<'EOF'
feat(comptage): inventaire 100% serveur - retrait Valider local + fichier d un inventaire

Resume inventaire : retire "Valider" local (validBtn) et les secours fichier d UN
inventaire (shareBtn/dlBtn). Historique : retire l import d UN inventaire .txt.
Conserve "Soumettre au serveur" et la Sauvegarde complete (disaster recovery).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

### Task 7: Comptage — section « À recompter » + rechargement pré-rempli + `recountOf`

**Files:**
- Modify: `js/core/inventory-core.js` (global `INV_RECOUNT_OF` près des autres `let` ~56 ; `inventoryServerPayload` ~1021-1025 ; `submitInventoryServer` reset ~1041-1044 ; section « À recompter » dans `openHistory` après le bloc Sauvegarde complète ~845 ; fonction `sipsReloadRecount`)

**Interfaces:**
- Consumes: `GET /api/submissions?status=rejected&type=inventory&include=payload` (Task 2), `sipsFetch`, `archiveCurrent`, `mergeAndMigrate`, `snapshot`, `clone`, `SESSION` (global), `FRAG`/`fragExitState`.
- Produces: `openHistory` liste les recomptages demandés à l'utilisateur ; « Reprendre » recharge le snapshot pré-rempli (jamais zéro) et arme `INV_RECOUNT_OF` ; la prochaine soumission porte `payload.recountOf={id,date}` puis `INV_RECOUNT_OF` est remis à `null`.

- [ ] **Step 1: Déclarer le global `INV_RECOUNT_OF`**

Dans `js/core/inventory-core.js`, juste après `let RO=false;` (~ligne 57), ajouter :

```js
let INV_RECOUNT_OF=null;           // {id,date} de la soumission rejetee en cours de recomptage (B)
```

- [ ] **Step 2: Joindre `recountOf` au payload de soumission**

Dans `js/core/inventory-core.js`, remplacer `inventoryServerPayload` (~1021-1025) par :

```js
function inventoryServerPayload(){
  const filled=REFS.filter(r=>ST.c[r.code].counted).length;
  let bilan=null,detail=null;try{const b=buildBilan();bilan={total:Math.round(b.total*1000)/1000,nbAlertes:b.alertes.length,nbCounted:b.rows.filter(r=>r.counted).length};detail={};b.rows.forEach(r=>{if(r.counted)detail[r.code]={n:r.nom,t:r.theo,p:r.phys,e:r.ecart};});}catch(e){}
  const out={kind:'inventory',date:ST.date||todayStr(),agent:ST.agent||'',filled:filled,bilan:bilan,detail:detail,st:snapshot(),submittedAt:new Date().toISOString()};
  if(INV_RECOUNT_OF)out.recountOf=clone(INV_RECOUNT_OF);
  return out;
}
```

- [ ] **Step 3: Réinitialiser `INV_RECOUNT_OF` après une soumission partie/en file**

Dans `js/core/inventory-core.js`, dans `submitInventoryServer`, à l'intérieur du bloc `if(r&&(r.ok||r.queued)){…}` (~1041), ajouter `INV_RECOUNT_OF=null;` :

```js
    if(r&&(r.ok||r.queued)){
      INV_RECOUNT_OF=null;
      const dlg=$('#dlg');if(dlg&&dlg.open)dlg.close();
      toast(r.ok?'Inventaire soumis au serveur':'Inventaire ajouté en attente (hors ligne)');
    }
```

- [ ] **Step 4: Ajouter la fonction `sipsReloadRecount`**

Dans `js/core/inventory-core.js`, juste avant `async function openHistory(){` (~ligne 833), insérer :

```js
/* Recomptage non destructif (B) : recharge le snapshot d une soumission inventaire rejetee,
   pre-rempli (jamais zero), dans un NOUVEAU comptage modifiable. La prochaine soumission portera
   recountOf={id,date} pour lier la chaine de recomptage. */
function sipsReloadRecount(s){
  const p=s&&s.payload||{};
  if(!p.st||!p.st.c){toast('Soumission sans detail de comptage');return;}
  if(FRAG)fragExitState();
  archiveCurrent();
  RO=false;document.body.classList.remove('ro');$('#roBanner').style.display='none';
  ST=JSON.parse(JSON.stringify(p.st));mergeAndMigrate();
  ST.id='inv_'+Date.now();           // nouvelle fiche : ne pas ecraser l originale rejetee
  ST.sessionStart=Date.now();
  INV_RECOUNT_OF={id:s.id,date:p.date||''};
  $('#agent').value=ST.agent||'';$('#date').value=ST.date||todayStr();
  saveCounts();
  const dlg=$('#histDlg');if(dlg&&dlg.open)dlg.close();
  render();window.scrollTo(0,0);
  toast('Recomptage charge — corrige les articles fautifs puis Soumets');
}
```

- [ ] **Step 5: Afficher la section « À recompter » en haut de `openHistory`**

Dans `js/core/inventory-core.js`, dans `openHistory`, juste après `if(dlg&&!dlg.open)dlg.showModal();` (~ligne 845), insérer :

```js
  // Section "A recompter" : recomptages demandes a CE compteur (ses inventaires rejetes recountRequested).
  const recountHost=document.createElement('div');list.append(recountHost);
  if(typeof SESSION!=='undefined'&&SESSION){
    sipsFetch('/api/submissions?status=rejected&type=inventory&include=payload').then(function(data){
      if(dlg&&!dlg.open)return;
      const rows=(data&&data.submissions||[]).filter(function(s){return s&&s.recountRequested;});
      if(!rows.length)return;
      const h=document.createElement('div');h.style.cssText='font-size:12px;font-weight:800;color:var(--red);margin:0 0 6px;text-transform:uppercase';
      h.textContent='↩ A recompter';recountHost.append(h);
      rows.sort(function(a,b){return String(b.createdAt||'').localeCompare(String(a.createdAt||''));}).forEach(function(s){
        const p=s.payload||{};
        const it=document.createElement('div');it.className='hist-item';
        it.style.cssText='border:1px solid #f0c0c0;background:#fdf3f3';
        it.innerHTML='<div class="info"><b>'+esc(p.date||'—')+'</b><span>'+esc(p.agent||'—')+' · '+(p.filled||0)+' art. · '+esc(s.decisionNote||'Recomptage demande')+'</span></div>';
        const open=document.createElement('button');open.textContent='Reprendre';open.onclick=function(){sipsReloadRecount(s);};
        it.append(open);recountHost.append(it);
      });
    }).catch(function(){});
  }
```

- [ ] **Step 6: Valider la syntaxe JS**

Run: `npm run check:js`
Expected: OK.

- [ ] **Step 7: Commit**

```bash
git add js/core/inventory-core.js
git commit -F - <<'EOF'
feat(comptage): section "A recompter" + recomptage pre-rempli non destructif (recountOf)

openHistory liste les inventaires rejetes recountRequested du compteur ; "Reprendre"
recharge le snapshot pre-rempli (jamais zero) dans un nouveau comptage et arme
INV_RECOUNT_OF ; la soumission suivante porte payload.recountOf={id,date} puis le
reset. Lie la chaine de recomptage a l originale.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

### Task 8: Bump SW + relais + vérification finale de branche

**Files:**
- Modify: `sw.js` (ligne 1, version cache)
- Modify: `docs/SIPS_LOCAL_SERVER_HANDOFF.md` (entrée « Fait depuis le relais »)

**Interfaces:**
- Produces: nouvelle version de cache SW (les clients chargent le nouveau code) ; relais à jour.

- [ ] **Step 1: Lire la version actuelle du SW**

Run: ouvrir `sw.js` ligne 1, lire `inv-lep-vXX`. (Au dernier relais : v117 ; prendre la valeur réellement présente et l'incrémenter de 1.)

- [ ] **Step 2: Incrémenter la version du cache SW**

Dans `sw.js` ligne 1, remplacer `inv-lep-vXX` par `inv-lep-v(XX+1)` (ex. `v117` → `v118`).

- [ ] **Step 3: Vérification finale complète**

Run (dans l'ordre) :
```
npm run check:js
node --check server/app.mjs
npm run test:server
git diff --check
```
Expected : `check:js` OK ; `node --check` OK ; `test:server` montre tous les `✓ [B1] [B2] [B3]` et **0 nouvel échec** par rapport au baseline (les `[N]`, `[A]`, `[G/H]`, `[K]`… restent verts) ; `git diff --check` sans erreur d'espaces.

- [ ] **Step 4: Mettre à jour le relais**

Dans `docs/SIPS_LOCAL_SERVER_HANDOFF.md`, en tête de la liste « Fait depuis le relais » (~ligne 145), ajouter une entrée datée 2026-06-23 résumant : Spec B implémentée (serveur : reject recountRequested + lecture propriétaire des inventaires rejetés, tests [B1]/[B2]/[B3] ; client : `buildBilanFrom`, `findBilanPair` serveur+repli, Bilan de revue depuis l'onglet Serveur avec Valider/Demander recomptage, retrait Valider/fichier d'un inventaire, section « À recompter » pré-remplie avec `recountOf`), cache SW bumpé à la nouvelle version, `test:server` = N/N, **à tester sur mobile** (flux complet : soumettre → comparer → demander recomptage → reprendre pré-rempli → re-soumettre → valider → Bilan courant prend la base serveur). Mentionner que la surface est sensible (données/flux serveur) : gate cross-model Codex conseillée avant merge `main`. Lier la mémoire `[[project_sips-pending-reviews]]`.

- [ ] **Step 5: Commit**

```bash
git add sw.js docs/SIPS_LOCAL_SERVER_HANDOFF.md
git commit -F - <<'EOF'
chore: bump cache SW + relais pour le flux inventaire comparer-avant-valider (Spec B)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Self-Review

**Spec coverage (section 3 « Dans B ») :**
- Bouton « Comparer au stock (Bilan) » sur inventaire soumis → Task 5. ✓
- Bilan de revue (réutilise `buildBilan`) snapshot vs ERP admin → Task 3 (`buildBilanFrom`) + Task 5 (vue). ✓
- Actions Valider / Demander recomptage depuis la revue → Task 5 (`sipsReviewDecide`). ✓
- Boucle de recomptage non destructive (compteur d'origine) → Task 1 (serveur conserve+flag), Task 2 (lecture propriétaire isolée), Task 7 (section + recharge pré-remplie + `recountOf`). ✓
- `findBilanPair` inclut validés serveur + repli local → Task 4. ✓
- Retrait Valider local + export/import fichier d'UN inventaire → Task 6. ✓
- Re-ouvrir un inventaire local depuis l'historique → conservé (déjà présent : `openArchive`/`reprendreArchive` intacts ; Task 6 ne retire que l'import fichier et la liste « Valides serveur » reste). ✓
- Champ par-article `by` réservé, non rempli en B → aucun code requis : `snapshot()` conserve `st.c` tel quel, on n'écrit jamais `by`. Documenté ici, rien à coder. ✓

**Décision 9 (non compté = écart nul) :** héritée de `buildBilan` (Task 3, Step 2 commentaire) — `phys=null` quand `!counted`, écart `null`, exclu de `totEc`. ✓

**Côté serveur (section 6) :** reject `recountRequested` (Task 1) ; liste propriétaire des inventaires rejetés (Task 2) ; aucun changement `validate`/détail (confirmé par `[B3]`). ✓

**Cas limites (section 8) :** aucun serveur configuré → `findBilanPair` repli local (Task 4) ; la section « À recompter » est gardée par `SESSION` (Task 7) donc invisible en mode local ; soumettre = file d'attente existante (inchangé). Hors-ligne → file (inchangé). Transition Bilan → repli (Task 4). Double recomptage → chaîne `recountOf` (Task 7). Concurrence → hors B. ✓

**Placeholder scan :** aucun TBD/TODO ; chaque step de code montre le code complet. ✓

**Type consistency :** `INV_RECOUNT_OF={id,date}` cohérent entre Task 7 (armement) et `inventoryServerPayload` (`out.recountOf=clone(INV_RECOUNT_OF)`) ; `recountRequested` cohérent serveur (`publicSubmission`, handler reject) ↔ client (`s.recountRequested` dans détail + filtre « À recompter ») ; `buildBilanFrom(snapshot)` ↔ appels Task 5 (`buildBilanFrom(p.st)`). `findBilanPair` retourne toujours `{pair,posterior}` avec `pair.{date,agent,st,server}` consommé par `renderBilan`/`bilPairBanner`. ✓

**Tests serveur :** harnais `exit 0` toujours — le critère est la ligne récap (`✓`/`✗` par check + total). Les nouveaux tests `[B1]/[B2]/[B3]` doivent tous être `✓` et le total `echec(s)` ne doit pas augmenter vs baseline.
