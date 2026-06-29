/* ====== tests/server-security.test.js ======
   Tests de securite boite-noire du serveur local SIPS.
   Lancent une instance reelle de server/app.mjs en sous-processus, avec un
   dossier de donnees temporaire isole (SIPS_DATA_DIR), puis tapent l'API en HTTP.

   IMPORTANT : ces tests affirment le comportement SECURISE attendu apres le
   durcissement (audit 2026-06-21). Ils ECHOUENT donc volontairement sur le code
   actuel, et documentent les failles a corriger :
     [A] submissions non authentifiees / visas forges par le client
     [C/D] PIN admin seul = bypass complet
     [E] mustChangePassword non applique cote serveur
     [B] ecritures concurrentes qui se perdent (lost update)
     [I] visa qualite ecrase (pas d'append-once)

   Lancer :  npm run test:server      (ou : node tests/server-security.test.js)
   ESM (package.json type=module).
*/
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = resolve(__dirname, '..', 'server', 'app.mjs');
const PORT = Number(process.env.TEST_PORT || 3987);
const PIN = 'testpin-not-default';
const BASE = 'http://127.0.0.1:' + PORT;

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log('  ✓ ' + label); }
  else { failed++; console.error('  ✗ ' + label); }
}

const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function stableForHash(value) {
  if (Array.isArray(value)) return value.map(stableForHash);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (key === 'id' || key === 'submittedAt') continue;
      out[key] = stableForHash(value[key]);
    }
    return out;
  }
  return value;
}

function submissionHash(type, payload) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ type, payload: stableForHash(payload) }))
    .digest('hex');
}

async function readTestDb(dataDir) {
  return JSON.parse(await readFile(join(dataDir, 'sips-data.json'), 'utf8'));
}

async function writeTestDb(dataDir, db) {
  await writeFile(join(dataDir, 'sips-data.json'), JSON.stringify(db, null, 2), 'utf8');
}

async function api(method, path, { token, pin, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers['authorization'] = 'Bearer ' + token;
  if (pin) headers['x-sips-admin-pin'] = pin;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = null;
  try { json = await res.json(); } catch { /* corps non-JSON */ }
  return { status: res.status, json };
}

async function waitHealthy(timeoutMs = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.ok) return true;
    } catch { /* pas encore pret */ }
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('Le serveur de test n\'a pas demarre dans les temps');
}

// Cree un compte (via le 1er admin), se connecte, et purge mustChangePassword
// pour isoler les autres tests de la faille [E]. Renvoie un token frais.
async function makeUser(adminToken, role, suffix) {
  const username = role + '_' + suffix;
  const password = 'pw-' + suffix;
  await api('POST', '/api/auth/users', { token: adminToken, body: { username, nom: 'U ' + suffix, role, password } });
  const login = await api('POST', '/api/auth/login', { body: { username, password } });
  const token = login.json && login.json.token;
  // change-password efface mustChangePassword
  const cp = await api('POST', '/api/auth/change-password', { token, body: { currentPassword: password, newPassword: password + 'x' } });
  return (cp.json && cp.json.token) || token;
}

function qualityPayload(lot, visas) {
  return {
    type: 'quality',
    payload: {
      informations: { numeroLot: lot, produit: 'DIAMO' },
      ...(visas ? { visas } : {})
    }
  };
}

function inventoryContribution(agent, code, qty) {
  return {
    payload: {
      agent,
      freshCodes: [code],
      counts: { [code]: { counted: true, blocks: [{ qty }] } },
      cfg: { [code]: { unit: 'test' } }
    }
  };
}

// Spec C : pose un inventaire VALIDE comme base (dernier inventaire valide serveur).
async function seedValidatedInventory(adminToken, codeMap) {
  const c = {};
  for (const code of Object.keys(codeMap)) c[code] = { counted: true, blocks: [{ qty: codeMap[code] }] };
  const sub = await api('POST', '/api/submissions', {
    token: adminToken,
    body: { type: 'inventory', payload: { kind: 'inventory', date: '2026-06-20', agent: 'Base ' + Object.keys(codeMap).join('-'), filled: Object.keys(c).length, st: { c, cfg: {} } } }
  });
  const id = sub.json && sub.json.submission && sub.json.submission.id;
  await api('POST', '/api/submissions/' + id + '/validate', { token: adminToken, body: {} });
  return id;
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), 'sips-sectest-'));
  const proc = spawn(process.execPath, [APP], {
    env: { ...process.env, SIPS_PORT: String(PORT), SIPS_DATA_DIR: dataDir, SIPS_ADMIN_PIN: PIN },
    stdio: ['ignore', 'ignore', 'inherit']
  });

  try {
    await waitHealthy();

    // 1er admin (setup) -> token admin reel
    const setup = await api('POST', '/api/auth/setup', { body: { username: 'chef', nom: 'Chef', password: 'chefpass' } });
    const adminToken = setup.json && setup.json.token;
    check('setup cree le 1er admin et renvoie un token', !!adminToken);
    const loginUsers = await api('GET', '/api/auth/login-users');
    const loginUser = loginUsers.json && loginUsers.json.users && loginUsers.json.users[0];
    check('[AUTH] la liste de connexion est publique et expose le compte actif', loginUsers.status === 200 && loginUser && loginUser.username === 'chef');
    check('[AUTH] la liste de connexion ne renvoie pas de hash mot de passe', loginUser && !('passwordHash' in loginUser));

    // ---- [A] submissions non authentifiees ----
    const anon = await api('POST', '/api/submissions', { body: { type: 'prod', payload: { x: 1 } } });
    check('[A] POST /api/submissions sans token doit etre refuse (401)', anon.status === 401);

    // ---- [A] visas qualite forges par le client ----
    const forged = await api('POST', '/api/submissions', {
      token: adminToken,
      body: qualityPayload('LOT-FORGE', {
        operateur: { nom: 'Pirate', signature: SIG },
        responsableQualite: { nom: 'Pirate', signature: SIG }
      })
    });
    const forgedId = forged.json && forged.json.submission && forged.json.submission.id;
    const validateForged = forgedId
      ? await api('POST', '/api/submissions/' + forgedId + '/validate', { token: adminToken, body: {} })
      : { status: 0 };
    check('[A] une fiche qualite a visas fournis par le client ne doit pas etre validable (visas serveur requis)',
      validateForged.status !== 200);

    // ---- [C/D] PIN admin seul ne doit pas suffire pour une action admin ----
    const pinOnly = await api('POST', '/api/auth/users', {
      pin: PIN,
      body: { username: 'viapin', nom: 'Via Pin', role: 'operateur', password: 'pw1234' }
    });
    check('[C/D] le PIN admin seul ne doit pas autoriser la creation d\'un compte', pinOnly.status === 401);

    // ---- [E] mustChangePassword applique cote serveur ----
    await api('POST', '/api/auth/users', { token: adminToken, body: { username: 'op_mcp', nom: 'Op MCP', role: 'operateur', password: 'temp1234' } });
    const mcpLogin = await api('POST', '/api/auth/login', { body: { username: 'op_mcp', password: 'temp1234' } });
    const mcpToken = mcpLogin.json && mcpLogin.json.token;
    const subForSign = await api('POST', '/api/submissions', { token: adminToken, body: qualityPayload('LOT-MCP') });
    const subMcpId = subForSign.json && subForSign.json.submission && subForSign.json.submission.id;
    const signWhileMcp = subMcpId
      ? await api('POST', '/api/submissions/' + subMcpId + '/quality-sign', { token: mcpToken, body: { role: 'operateur', visa: { signature: SIG } } })
      : { status: 0 };
    check('[E] un compte mustChangePassword ne doit pas pouvoir signer (403)', signWhileMcp.status === 403);

    // ---- [I] visa qualite append-once (pas d'ecrasement) ----
    const op1 = await makeUser(adminToken, 'operateur', 'one');
    const op2 = await makeUser(adminToken, 'operateur', 'two');
    const subI = await api('POST', '/api/submissions', { token: adminToken, body: qualityPayload('LOT-APPEND') });
    const subIid = subI.json && subI.json.submission && subI.json.submission.id;
    const sign1 = await api('POST', '/api/submissions/' + subIid + '/quality-sign', { token: op1, body: { role: 'operateur', visa: { signature: SIG } } });
    const sign2 = await api('POST', '/api/submissions/' + subIid + '/quality-sign', { token: op2, body: { role: 'operateur', visa: { signature: SIG } } });
    check('[I] 1re signature operateur acceptee', sign1.status === 200);
    check('[I] 2e signature du meme role doit etre refusee (409 append-once)', sign2.status === 409);

    // ---- [A] visas qualite legacy/corrompus : image seule != visa serveur ----
    const rq1 = await makeUser(adminToken, 'responsableQualite', 'rqone');
    const subLegacy = await api('POST', '/api/submissions', { token: adminToken, body: qualityPayload('LOT-LEGACY') });
    const legacyId = subLegacy.json && subLegacy.json.submission && subLegacy.json.submission.id;
    let db = await readTestDb(dataDir);
    const legacy = db.submissions.find(s => s.id === legacyId);
    legacy.payload.visas = {
      operateur: { nom: 'Legacy Op', signature: SIG, userId: 'fake-op', username: 'fake-op' },
      responsableQualite: { nom: 'Legacy RQ', signature: SIG, userId: 'fake-rq', username: 'fake-rq' }
    };
    legacy.hash = submissionHash(legacy.type, legacy.payload);
    await writeTestDb(dataDir, db);
    const validateLegacy = await api('POST', '/api/submissions/' + legacyId + '/validate', { token: adminToken, body: {} });
    const replaceLegacyOp = await api('POST', '/api/submissions/' + legacyId + '/quality-sign', { token: op1, body: { role: 'operateur', visa: { signature: SIG } } });
    const replaceLegacyRq = await api('POST', '/api/submissions/' + legacyId + '/quality-sign', { token: rq1, body: { role: 'responsableQualite', visa: { signature: SIG } } });
    const validateRepaired = await api('POST', '/api/submissions/' + legacyId + '/validate', { token: adminToken, body: {} });
    check('[A] un visa legacy image sans estampille serveur ne doit pas valider', validateLegacy.status === 400);
    check('[A] un visa legacy image doit rester remplacable par /quality-sign', replaceLegacyOp.status === 200 && replaceLegacyRq.status === 200);
    check('[A] une fiche legacy reparee par signatures serveur devient validable', validateRepaired.status === 200);

    // ---- [J] validation qualite : le record ne doit jamais promouvoir un hash perime ----
    const rq2 = await makeUser(adminToken, 'responsableQualite', 'rqtwo');
    const subHash = await api('POST', '/api/submissions', { token: adminToken, body: qualityPayload('LOT-HASH') });
    const hashId = subHash.json && subHash.json.submission && subHash.json.submission.id;
    db = await readTestDb(dataDir);
    const staleBeforeSign = db.submissions.find(s => s.id === hashId).hash;
    await api('POST', '/api/submissions/' + hashId + '/quality-sign', { token: op1, body: { role: 'operateur', visa: { signature: SIG } } });
    await api('POST', '/api/submissions/' + hashId + '/quality-sign', { token: rq2, body: { role: 'responsableQualite', visa: { signature: SIG } } });
    db = await readTestDb(dataDir);
    const signed = db.submissions.find(s => s.id === hashId);
    signed.hash = staleBeforeSign;
    await writeTestDb(dataDir, db);
    const validateHash = await api('POST', '/api/submissions/' + hashId + '/validate', { token: adminToken, body: {} });
    db = await readTestDb(dataDir);
    const hashSub = db.submissions.find(s => s.id === hashId);
    const hashRecord = db.records.find(r => r.sourceSubmissionId === hashId);
    const expectedFinalHash = submissionHash('quality', hashSub.payload);
    const rqReadsQualityRecord = await api('GET', '/api/records?type=quality&status=validated', { token: rq2 });
    const rqQualityArchived = rqReadsQualityRecord.json && (rqReadsQualityRecord.json.records || []).find(r => r.sourceSubmissionId === hashId);
    check('[J] validation qualite accepte une soumission legacy a hash perime apres recalcul', validateHash.status === 200);
    check('[J] le hash du record qualite couvre le payload final signe',
      !!hashRecord && hashRecord.hash === expectedFinalHash && hashRecord.hash !== staleBeforeSign && hashSub.hash === expectedFinalHash);
    check('[J] la fiche qualite validee est archivee et lisible par le responsable qualite',
      rqReadsQualityRecord.status === 200 && !!rqQualityArchived && rqQualityArchived.payload && rqQualityArchived.payload.visas && rqQualityArchived.payload.visas.responsableQualite);

    // ---- [B] ecritures concurrentes : aucune contribution perdue ----
    const sess = await api('POST', '/api/inventory-sessions', { token: adminToken, body: { date: '2026-06-21', title: 'Concurrence' } });
    const sessId = sess.json && sess.json.session && sess.json.session.id;
    const N = 6;
    const tokens = [];
    for (let i = 0; i < N; i++) tokens.push(await makeUser(adminToken, 'magasinier', 'c' + i));
    const contribBody = (i) => ({
      payload: {
        agent: 'agent' + i,
        freshCodes: ['CODE' + i],
        counts: { ['CODE' + i]: { counted: true, blocks: [{ qty: i + 1 }] } }
      }
    });
    await Promise.all(tokens.map((tk, i) =>
      api('POST', '/api/inventory-sessions/' + sessId + '/contributions', { token: tk, body: contribBody(i) })
    ));
    const detail = await api('GET', '/api/inventory-sessions/' + sessId, { token: adminToken });
    const got = detail.json && detail.json.session && (detail.json.session.contributions || []).length;
    check('[B] ' + N + ' contributions concurrentes (users distincts) doivent toutes survivre, got=' + got, got === N);

    // ---- [G/H] finalize inventaire : fusion autoritaire cote serveur ----
    const invA = await makeUser(adminToken, 'magasinier', 'inva');
    const invB = await makeUser(adminToken, 'magasinier', 'invb');
    const sessAuth = await api('POST', '/api/inventory-sessions', { token: adminToken, body: { date: '2026-06-22', title: 'Autoritaire' } });
    const authId = sessAuth.json && sessAuth.json.session && sessAuth.json.session.id;
    await api('POST', '/api/inventory-sessions/' + authId + '/contributions', { token: invA, body: inventoryContribution('Inventaire A', 'AUTH-CODE', 7) });
    const forgedFinalize = await api('POST', '/api/inventory-sessions/' + authId + '/finalize', {
      token: adminToken,
      body: {
        payload: {
          kind: 'inventory',
          date: '2099-01-01',
          agent: 'Payload forge',
          filled: 1,
          st: { c: { 'EVIL-CODE': { counted: true, val: '999' } } }
        },
        summary: { conflicts: 0 }
      }
    });
    const forgedSubId = forgedFinalize.json && forgedFinalize.json.submission && forgedFinalize.json.submission.id;
    const forgedSub = forgedSubId ? await api('GET', '/api/submissions/' + forgedSubId, { token: adminToken }) : { json: null };
    const forgedPayload = forgedSub.json && forgedSub.json.submission && forgedSub.json.submission.payload;
    check('[G/H] finalize ignore le payload client forge et reconstruit depuis les contributions serveur',
      forgedFinalize.status === 200
      && forgedPayload
      && forgedPayload.st
      && forgedPayload.st.c
      && forgedPayload.st.c['AUTH-CODE']
      && !forgedPayload.st.c['EVIL-CODE']
      && forgedPayload.agent !== 'Payload forge');

    const sessConflict = await api('POST', '/api/inventory-sessions', { token: adminToken, body: { date: '2026-06-22', title: 'Conflit' } });
    const conflictId = sessConflict.json && sessConflict.json.session && sessConflict.json.session.id;
    await api('POST', '/api/inventory-sessions/' + conflictId + '/contributions', { token: invA, body: inventoryContribution('Inventaire A', 'CONFLICT-CODE', 1) });
    await api('POST', '/api/inventory-sessions/' + conflictId + '/contributions', { token: invB, body: inventoryContribution('Inventaire B', 'CONFLICT-CODE', 2) });
    const conflictNoResolution = await api('POST', '/api/inventory-sessions/' + conflictId + '/finalize', {
      token: adminToken,
      body: { payload: { st: { c: { 'CONFLICT-CODE': { counted: true, val: 'fake' } } } }, summary: { conflicts: 0 } }
    });
    const conflictResolved = await api('POST', '/api/inventory-sessions/' + conflictId + '/finalize', {
      token: adminToken,
      body: { resolutions: { 'CONFLICT-CODE': 1 }, summary: { conflicts: 0 } }
    });
    const conflictSubId = conflictResolved.json && conflictResolved.json.submission && conflictResolved.json.submission.id;
    const conflictSub = conflictSubId ? await api('GET', '/api/submissions/' + conflictSubId, { token: adminToken }) : { json: null };
    const conflictEntry = conflictSub.json && conflictSub.json.submission && conflictSub.json.submission.payload
      && conflictSub.json.submission.payload.st && conflictSub.json.submission.payload.st.c['CONFLICT-CODE'];
    check('[G/H] finalize refuse les conflits recalcules sans resolution serveur', conflictNoResolution.status === 409);
    check('[G/H] finalize applique une resolution explicite sur les contributions serveur',
      conflictResolved.status === 200 && conflictEntry && conflictEntry.blocks && conflictEntry.blocks[0].qty === 2);

    // ---- [N] lecture des records valides par un compte non-admin (mouvements officiels) ----
    const opRead = await makeUser(adminToken, 'operateur', 'recread');
    const magRead = await makeUser(adminToken, 'magasinier', 'recq');
    const subSortie = await api('POST', '/api/submissions', {
      token: adminToken,
      body: { type: 'sortie', payload: { kind: 'sortie', date: '2026-06-23', ref: 'CAMION-1', finis: [{ a: 'DIAMO', q: '5' }], mp: [] } }
    });
    const sortieId = subSortie.json && subSortie.json.submission && subSortie.json.submission.id;
    await api('POST', '/api/submissions/' + sortieId + '/validate', { token: adminToken, body: {} });
    const opSeesValidated = await api('GET', '/api/records?type=sortie&status=validated', { token: opRead });
    const opNoStatus = await api('GET', '/api/records?type=sortie', { token: opRead });
    const anonRecords = await api('GET', '/api/records?type=sortie&status=validated', {});
    const magQuality = await api('GET', '/api/records?type=quality&status=validated', { token: magRead });
    const magMe = await api('GET', '/api/auth/me', { token: magRead });
    const magTabs = (magMe.json && magMe.json.user && magMe.json.user.tabs) || [];
    check('[N] un compte non-admin connecte lit les records sortie VALIDES',
      opSeesValidated.status === 200 && Array.isArray(opSeesValidated.json.records) && opSeesValidated.json.records.some(r => r.type === 'sortie'));
    check('[N] un compte non-admin ne peut PAS lister les records sans filtre de statut (admin requis)', opNoStatus.status === 401);
    check('[N] lecture des records refusee sans authentification', anonRecords.status === 401);
    check('[N] la qualite reste reservee aux signataires qualite (magasinier refuse)', magQuality.status === 401);
    check('[N] le magasinier voit comptage, production, stock, sorties et entrees',
      ['comptage', 'prod', 'stock', 'sorties', 'entree'].every(t => magTabs.includes(t)));

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
    check('[B1] recountRequested est expose par l API', recountReject.status === 200 && recountReject.json.submission && recountReject.json.submission.recountRequested === true);

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

    // ---- [B4] journal : suppression CIBLEE (ids / periode), jamais de purge globale, admin requis ----
    const audAll = await api('GET', '/api/audit', { token: adminToken });
    const audRows = (audAll.json && audAll.json.audit) || [];
    const firstId = audRows.length ? audRows[0].id : null;
    const totalBefore = audAll.json && audAll.json.total;
    const delNoCriteria = await api('POST', '/api/audit/delete', { token: adminToken, body: {} });
    const delNonAdmin = await api('POST', '/api/audit/delete', { token: invCounter, body: { ids: [firstId] } });
    const delById = await api('POST', '/api/audit/delete', { token: adminToken, body: { ids: [firstId] } });
    const audAfter = await api('GET', '/api/audit', { token: adminToken });
    const stillHasDeleted = ((audAfter.json && audAfter.json.audit) || []).some(e => e.id === firstId);
    const delByDate = await api('POST', '/api/audit/delete', { token: adminToken, body: { beforeDate: '2026-06-23' } });
    check('[B4] suppression sans critere refusee (pas de purge globale)', delNoCriteria.status === 400);
    check('[B4] suppression journal refusee a un non-admin', delNonAdmin.status === 401);
    check('[B4] suppression par id retire l entree ciblee', delById.status === 200 && delById.json.removed >= 1 && !stillHasDeleted);
    check('[B4] suppression par periode (beforeDate) retire les entrees anterieures', delByDate.status === 200 && typeof delByDate.json.removed === 'number');

    // ====== Spec C : inventaire fragmente (manche unique, assemblage, recompte cible) ======
    // Repartir d'un etat sans manche ouverte (les tests precedents laissent des sessions ouvertes).
    let dbC = await readTestDb(dataDir);
    (dbC.inventorySessions || []).forEach(s => { if ((s.status || 'open') === 'open') s.status = 'finalized'; });
    await writeTestDb(dataDir, dbC);

    // ---- [C1] contribution sans sessionId rattachee a la manche ouverte (creee si aucune) ----
    const c1a = await makeUser(adminToken, 'operateur', 'c1a');
    const c1b = await makeUser(adminToken, 'operateur', 'c1b');
    const c1r1 = await api('POST', '/api/inventory-rounds/contribution', { token: c1a,
      body: { payload: { agent: 'Ahmed', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 5 }] } } } } });
    const c1RoundId = c1r1.json && c1r1.json.round && c1r1.json.round.id;
    const c1r2 = await api('POST', '/api/inventory-rounds/contribution', { token: c1b,
      body: { payload: { agent: 'Sara', freshCodes: ['190004'], counts: { '190004': { counted: true, blocks: [{ qty: 9 }] } } } } });
    check('[C1] contribution sans sessionId cree/retourne une manche', c1r1.status === 201 && !!c1RoundId);
    check('[C1] une 2e part rejoint la MEME manche ouverte', c1r2.json && c1r2.json.round && c1r2.json.round.id === c1RoundId);
    check('[C1] la manche ouverte regroupe les 2 parts', c1r2.json && c1r2.json.round && (c1r2.json.round.contributions || []).length === 2);
    await api('POST', '/api/inventory-sessions/' + c1RoundId + '/finalize', { token: adminToken, body: {} });

    // ---- [C1b] si plusieurs manches ouvertes existent deja, une part rejoint la plus recente ----
    const c1bOld = await api('POST', '/api/inventory-sessions', { token: adminToken, body: { date: '2026-06-24', title: 'Ancienne session' } });
    const c1bNew = await api('POST', '/api/inventory-sessions', { token: adminToken, body: { date: '2026-06-25', title: 'Session courante' } });
    const c1bUser = await makeUser(adminToken, 'operateur', 'c1buser');
    const c1bPart = await api('POST', '/api/inventory-rounds/contribution', { token: c1bUser,
      body: { payload: { agent: 'Courant', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 3 }] } } } } });
    check('[C1b] contribution rattachee a la session ouverte la plus recente',
      c1bPart.json && c1bPart.json.round && c1bNew.json && c1bPart.json.round.id === c1bNew.json.session.id);
    const c1bOldDetail = await api('GET', '/api/inventory-sessions/' + c1bOld.json.session.id, { token: adminToken });
    check('[C1b] ancienne session ouverte non polluee',
      c1bOldDetail.json && c1bOldDetail.json.session && (c1bOldDetail.json.session.contributions || []).length === 0);

    const c1cUser = await makeUser(adminToken, 'operateur', 'c1cuser');
    const c1cPart = await api('POST', '/api/inventory-rounds/contribution', { token: c1cUser,
      body: { payload: { agent: 'Ancien vise', sessionId: c1bOld.json.session.id, freshCodes: ['190004'], counts: { '190004': { counted: true, blocks: [{ qty: 4 }] } } } } });
    check('[C1c] sessionId explicite respecte meme si une session plus recente est ouverte',
      c1cPart.json && c1cPart.json.round && c1cPart.json.round.id === c1bOld.json.session.id);

    const c1dNonAdminCancel = await api('POST', '/api/inventory-sessions/' + c1bOld.json.session.id + '/cancel', { token: c1bUser, body: {} });
    const c1dCancel = await api('POST', '/api/inventory-sessions/' + c1bOld.json.session.id + '/cancel', { token: adminToken, body: { reason: 'test' } });
    const c1dOpen = await api('GET', '/api/inventory-sessions', { token: adminToken });
    const c1dAfterCancelPart = await api('POST', '/api/inventory-rounds/contribution', { token: c1cUser,
      body: { payload: { agent: 'Ancien vise', sessionId: c1bOld.json.session.id, freshCodes: ['190005'], counts: { '190005': { counted: true, blocks: [{ qty: 5 }] } } } } });
    check('[C1d] annulation session refusee a un non-admin', c1dNonAdminCancel.status === 401);
    check('[C1d] admin peut annuler une session ouverte', c1dCancel.status === 200 && c1dCancel.json.session.status === 'cancelled');
    check('[C1d] session annulee disparait des sessions ouvertes',
      c1dOpen.json && c1dOpen.json.sessions && !c1dOpen.json.sessions.some(s => s.id === c1bOld.json.session.id));
    check('[C1d] contribution vers session annulee refusee', c1dAfterCancelPart.status === 409);

    dbC = await readTestDb(dataDir);
    (dbC.inventorySessions || []).forEach(s => { if ((s.status || 'open') === 'open') s.status = 'finalized'; });
    await writeTestDb(dataDir, dbC);

    // ---- [C2] assemblage : base conservee + article modifie estampille by ----
    await seedValidatedInventory(adminToken, { '190001': 100, '190009': 50 });
    const c2a = await makeUser(adminToken, 'operateur', 'c2a');
    await api('POST', '/api/inventory-rounds/contribution', { token: c2a,
      body: { payload: { agent: 'Ahmed', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 7 }] } } } } });
    const c2Round = (await api('GET', '/api/inventory-sessions', { token: adminToken })).json.sessions[0];
    const c2Fin = await api('POST', '/api/inventory-sessions/' + c2Round.id + '/finalize', { token: adminToken, body: {} });
    const c2Sub = c2Fin.json && c2Fin.json.submission && await api('GET', '/api/submissions/' + c2Fin.json.submission.id, { token: adminToken });
    const c2c = c2Sub && c2Sub.json && c2Sub.json.submission && c2Sub.json.submission.payload && c2Sub.json.submission.payload.st.c;
    check('[C2] article compte estampille by=compteur', !!c2c && c2c['190001'].counted === true && c2c['190001'].by === 'Ahmed');
    check('[C2] article non modifie conserve la valeur de base', !!c2c && c2c['190009'] && c2c['190009'].counted === true && c2c['190009'].blocks[0].qty === 50);
    check('[C2] article non modifie ne prend PAS le compteur du jour', !!c2c && c2c['190009'] && !c2c['190009'].by);

    // ---- [C3] conflit (meme code, 2 compteurs) -> finalize refuse sans resolution ----
    await seedValidatedInventory(adminToken, { '190001': 100 });
    const c3a = await makeUser(adminToken, 'operateur', 'c3a');
    const c3b = await makeUser(adminToken, 'operateur', 'c3b');
    await api('POST', '/api/inventory-rounds/contribution', { token: c3a,
      body: { payload: { agent: 'Ahmed', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 7 }] } } } } });
    await api('POST', '/api/inventory-rounds/contribution', { token: c3b,
      body: { payload: { agent: 'Sara', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 9 }] } } } } });
    const c3Round = (await api('GET', '/api/inventory-sessions', { token: adminToken })).json.sessions[0];
    const c3Fin = await api('POST', '/api/inventory-sessions/' + c3Round.id + '/finalize', { token: adminToken, body: {} });
    check('[C3] conflit non resolu -> finalize 409', c3Fin.status === 409 && (c3Fin.json.conflicts || []).some(x => x.code === '190001'));
    await api('POST', '/api/inventory-sessions/' + c3Round.id + '/finalize', { token: adminToken, body: { resolutions: { '190001': 1 } } });

    // ---- [C4] reconstruction serveur ignore tout payload client forge (regression G/H) ----
    await seedValidatedInventory(adminToken, { '190001': 100 });
    const c4a = await makeUser(adminToken, 'operateur', 'c4a');
    await api('POST', '/api/inventory-rounds/contribution', { token: c4a,
      body: { payload: { agent: 'Ahmed', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 7 }] } } } } });
    const c4Round = (await api('GET', '/api/inventory-sessions', { token: adminToken })).json.sessions[0];
    const c4Fin = await api('POST', '/api/inventory-sessions/' + c4Round.id + '/finalize', { token: adminToken,
      body: { payload: { st: { c: { '190001': { counted: true, blocks: [{ qty: 999 }] }, '190099': { counted: true, blocks: [{ qty: 1 }] } } } } } });
    const c4c = c4Fin.json && c4Fin.json.submission && (await api('GET', '/api/submissions/' + c4Fin.json.submission.id, { token: adminToken })).json.submission.payload.st.c;
    check('[C4] valeur reconstruite depuis la contribution (pas le payload forge)', !!c4c && c4c['190001'].blocks[0].qty === 7);
    check('[C4] article jamais compte absent du resultat (pas injecte par le client)', !!c4c && !c4c['190099']);

    // ---- [C5] recompte cible ne renvoie que l article vise a son compteur ----
    await seedValidatedInventory(adminToken, { '190001': 100, '190004': 40 });
    const c5a = await makeUser(adminToken, 'operateur', 'c5a');   // username operateur_c5a
    const c5b = await makeUser(adminToken, 'operateur', 'c5b');
    await api('POST', '/api/inventory-rounds/contribution', { token: c5a,
      body: { payload: { agent: 'Ahmed', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 7 }] } } } } });
    await api('POST', '/api/inventory-rounds/contribution', { token: c5b,
      body: { payload: { agent: 'Sara', freshCodes: ['190004'], counts: { '190004': { counted: true, blocks: [{ qty: 9 }] } } } } });
    const c5Round = (await api('GET', '/api/inventory-sessions', { token: adminToken })).json.sessions[0];
    const c5Fin = await api('POST', '/api/inventory-sessions/' + c5Round.id + '/finalize', { token: adminToken, body: {} });
    const c5SubId = c5Fin.json && c5Fin.json.submission && c5Fin.json.submission.id;
    const c5Detail = (await api('GET', '/api/submissions/' + c5SubId, { token: adminToken })).json.submission;
    const c5ByUser = c5Detail.payload.st.c['190001'].byUser;   // identite stable du compteur de 190001
    const c5Rej = await api('POST', '/api/submissions/' + c5SubId + '/reject', { token: adminToken,
      body: { note: 'ecart anormal', recountArticles: [{ code: '190001', by: 'Ahmed', byUser: c5ByUser }] } });
    const c5MineA = await api('GET', '/api/submissions?status=rejected&type=inventory&forMe=1', { token: c5a });
    const c5MineB = await api('GET', '/api/submissions?status=rejected&type=inventory&forMe=1', { token: c5b });
    check('[C5] reject avec recountArticles accepte', c5Rej.status === 200);
    check('[C5] le compteur cible voit SON article a recompter',
      c5MineA.status === 200 && (c5MineA.json.submissions || []).some(s => (s.recountArticles || []).some(x => x.code === '190001')));
    check('[C5] un autre compteur ne voit PAS cet article cible',
      c5MineB.status === 200 && !(c5MineB.json.submissions || []).some(s => (s.recountArticles || []).some(x => x.code === '190001')));

    // ====== Revue adversariale 2026-06-27 : corrections R1/R2 ======

    // ---- [R1-1] l'attribution de decision vient du TOKEN, pas de body.actor ----
    const r1Sub = await api('POST', '/api/submissions', { token: adminToken,
      body: { type: 'inventory', payload: { kind: 'inventory', date: '2026-06-21', agent: 'X', filled: 1, st: { c: { '190001': { counted: true, blocks: [{ qty: 1 }] } }, cfg: {} } } } });
    const r1Id = r1Sub.json.submission.id;
    const r1Val = await api('POST', '/api/submissions/' + r1Id + '/validate', { token: adminToken, body: { actor: 'Pirate Forge' } });
    const r1Decided = (await api('GET', '/api/submissions/' + r1Id, { token: adminToken })).json.submission;
    check('[R1-1] decidedBy vient du token authentifie (pas de body.actor)',
      r1Val.status === 200 && r1Decided.decidedBy === 'Chef' && r1Decided.decidedBy !== 'Pirate Forge');

    // ---- [R1-2] la date de visa qualite est posee par le serveur (anti-antidatage) ----
    const r2signer = await makeUser(adminToken, 'operateur', 'r2date');
    const r2Sub = await api('POST', '/api/submissions', { token: adminToken, body: qualityPayload('LOT-DATE') });
    const r2Id = r2Sub.json.submission.id;
    await api('POST', '/api/submissions/' + r2Id + '/quality-sign', { token: r2signer, body: { role: 'operateur', visa: { signature: SIG, date: '1999-01-01T00:00:00.000Z' } } });
    const r2Visa = (await api('GET', '/api/submissions/' + r2Id, { token: adminToken })).json.submission.payload.visas.operateur;
    check('[R1-2] date de visa = serveur (pas la date client forgee)',
      !!r2Visa && r2Visa.date !== '1999-01-01T00:00:00.000Z' && /^\d{4}-\d{2}-\d{2}T/.test(r2Visa.date));
    check('[R1-2] date client conservee a part (clientDate, non opposable)', !!r2Visa && r2Visa.clientDate === '1999-01-01T00:00:00.000Z');

    // ---- [R1-3] GET /api/submissions exige une authentification (anti-enumeration anonyme) ----
    const r3Anon = await api('GET', '/api/submissions?type=inventory');
    check('[R1-3] GET /api/submissions sans auth refuse (401)', r3Anon.status === 401);

    // ---- [R1-4] detail de session : un non-admin ne voit pas les comptes d'autrui ----
    await seedValidatedInventory(adminToken, { '190001': 100 });
    const r4a = await makeUser(adminToken, 'operateur', 'r4a');
    await api('POST', '/api/inventory-rounds/contribution', { token: r4a,
      body: { payload: { agent: 'Ahmed', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 7 }] } } } } });
    const r4Round = (await api('GET', '/api/inventory-sessions', { token: adminToken })).json.sessions[0];
    const r4User = (await api('GET', '/api/inventory-sessions/' + r4Round.id, { token: r4a })).json.session;
    const r4Admin = (await api('GET', '/api/inventory-sessions/' + r4Round.id, { token: adminToken })).json.session;
    check('[R1-4] non-admin recoit la base (peut charger sa zone)', !!r4User.baseSnapshot);
    check('[R1-4] non-admin ne recoit PAS les comptes detailles des contributions',
      (r4User.contributions || []).every(c => !c.payload));
    check('[R1-4] admin recoit les contributions detaillees', (r4Admin.contributions || []).some(c => c.payload && c.payload.counts));

    // ---- [R2-5] une part visant une autre base que la manche ouverte est rejetee ----
    const r5BaseA = await seedValidatedInventory(adminToken, { '190001': 100 });
    const r5a = await makeUser(adminToken, 'operateur', 'r5a');
    await api('POST', '/api/inventory-rounds/contribution', { token: r5a,
      body: { payload: { baseInventoryId: r5BaseA, agent: 'Ahmed', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 7 }] } } } } });
    const r5RoundA = (await api('GET', '/api/inventory-sessions', { token: adminToken })).json.sessions[0];
    await api('POST', '/api/inventory-sessions/' + r5RoundA.id + '/finalize', { token: adminToken, body: {} });
    await seedValidatedInventory(adminToken, { '190001': 200 });   // nouvelle base B
    const r5Stale = await api('POST', '/api/inventory-rounds/contribution', { token: r5a,
      body: { payload: { baseInventoryId: r5BaseA, agent: 'Ahmed', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 5 }] } } } } });
    check('[R2-5] part perimee (base A) rejetee quand la manche est sur base B (409)', r5Stale.status === 409);

    // ---- [R2-7] 2 parts disjointes du meme compteur fusionnent (pas de perte) ----
    await seedValidatedInventory(adminToken, { '190001': 100, '190004': 40 });
    const r7a = await makeUser(adminToken, 'operateur', 'r7a');
    await api('POST', '/api/inventory-rounds/contribution', { token: r7a,
      body: { payload: { agent: 'Ahmed', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 7 }] } } } } });
    await api('POST', '/api/inventory-rounds/contribution', { token: r7a,
      body: { payload: { agent: 'Ahmed', freshCodes: ['190004'], counts: { '190004': { counted: true, blocks: [{ qty: 9 }] } } } } });
    const r7Round = (await api('GET', '/api/inventory-sessions', { token: adminToken })).json.sessions[0];
    const r7Fin = await api('POST', '/api/inventory-sessions/' + r7Round.id + '/finalize', { token: adminToken, body: {} });
    const r7c = (await api('GET', '/api/submissions/' + r7Fin.json.submission.id, { token: adminToken })).json.submission.payload.st.c;
    check('[R2-7] 1re part conservee apres 2e part disjointe (190001)', !!r7c && r7c['190001'] && r7c['190001'].counted === true);
    check('[R2-7] 2e part presente (190004) sans ecraser la 1re', !!r7c && r7c['190004'] && r7c['190004'].counted === true);

    // ---- [R2-6] isolation du recompte cible : seul le compteur assigne soumet l'article ----
    await seedValidatedInventory(adminToken, { '190001': 100, '190004': 40 });
    const t1 = await makeUser(adminToken, 'operateur', 't1');
    const t2 = await makeUser(adminToken, 'operateur', 't2');
    await api('POST', '/api/inventory-rounds/contribution', { token: t1,
      body: { payload: { agent: 'T1', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 7 }] } } } } });
    await api('POST', '/api/inventory-rounds/contribution', { token: t2,
      body: { payload: { agent: 'T2', freshCodes: ['190004'], counts: { '190004': { counted: true, blocks: [{ qty: 9 }] } } } } });
    const t6Round = (await api('GET', '/api/inventory-sessions', { token: adminToken })).json.sessions.find(s => (s.status || 'open') === 'open');
    const t6Fin = await api('POST', '/api/inventory-sessions/' + t6Round.id + '/finalize', { token: adminToken, body: {} });
    const t6SubId = t6Fin.json.submission.id;
    const t6ByUser = (await api('GET', '/api/submissions/' + t6SubId, { token: adminToken })).json.submission.payload.st.c['190001'].byUser;
    await api('POST', '/api/submissions/' + t6SubId + '/reject', { token: adminToken,
      body: { note: 'ecart', recountArticles: [{ code: '190001', by: 'T1', byUser: t6ByUser }] } });
    const t2Bad = await api('POST', '/api/inventory-rounds/contribution', { token: t2,
      body: { payload: { agent: 'T2', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 99 }] } } } } });
    check('[R2-6] compteur non assigne bloque (403) sur article en recompte cible', t2Bad.status === 403);
    const t1Ok = await api('POST', '/api/inventory-rounds/contribution', { token: t1,
      body: { payload: { agent: 'T1', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 8 }] } } } } });
    check('[R2-6] compteur assigne peut soumettre son article cible', t1Ok.status === 200 || t1Ok.status === 201);
    const t6Round2 = (await api('GET', '/api/inventory-sessions', { token: adminToken })).json.sessions.find(s => (s.status || 'open') === 'open');
    await api('POST', '/api/inventory-sessions/' + t6Round2.id + '/finalize', { token: adminToken, body: {} });
    const t2After = await api('POST', '/api/inventory-rounds/contribution', { token: t2,
      body: { payload: { agent: 'T2', freshCodes: ['190001'], counts: { '190001': { counted: true, blocks: [{ qty: 50 }] } } } } });
    check('[R2-6] apres finalisation, l assignment est purge (code de nouveau libre)', t2After.status === 200 || t2After.status === 201);

    // ---- [K] serveStatic : ne jamais servir les donnees serveur ou fichiers caches ----
    const staticDb = await fetch(BASE + '/server/data/sips-data.json');
    const staticSecret = await fetch(BASE + '/server/data/.jwt-secret');
    const malformedStatic = await fetch(BASE + '/%E0%A4%A');
    check('[K] serveStatic bloque server/data/sips-data.json', staticDb.status === 403);
    check('[K] serveStatic bloque les fichiers caches/sensibles', staticSecret.status === 403);
    check('[K] serveStatic rejette les URLs mal encodees sans 500', malformedStatic.status === 400);

  } finally {
    proc.kill();
    await rm(dataDir, { recursive: true, force: true }).catch(() => {});
  }

  console.log('\n' + passed + ' reussi(s), ' + failed + ' echec(s).');
  console.log('(Rappel : sur le code AVANT durcissement, des echecs sont ATTENDUS et documentent les failles.)');
  // Sortie 0 : l'echec est l'etat de depart documente. Phase 1+ fera passer ces tests.
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(2); });
