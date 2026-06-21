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
import { mkdtemp, rm } from 'node:fs/promises';
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
