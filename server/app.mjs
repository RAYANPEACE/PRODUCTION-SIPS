import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFile, writeFile, mkdir, stat, rename, readdir, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { basename, dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const dataDir = resolve(__dirname, 'data');
const dbPath = resolve(dataDir, 'sips-data.json');
const backupDir = resolve(dataDir, 'backups');
const port = Number(process.env.SIPS_PORT || 3000);
const adminPin = process.env.SIPS_ADMIN_PIN || '1234';

// ====== AUTH / ROLES ======
// Source de verite des droits. Le client recoit `tabs` et `canSign` a la connexion.
const TAB_IDS = ['accueil', 'comptage', 'prod', 'qualite', 'ref', 'bilan', 'feuillet', 'capacite', 'plan', 'sorties', 'entree', 'analyse', 'serveur'];
const ROLES = {
  admin: { label: 'Chef d\'usine', tabs: TAB_IDS.slice(), canSign: ['responsableProd'] },
  magasinier: { label: 'Magasinier', tabs: ['accueil', 'comptage', 'sorties', 'entree'], canSign: [] },
  operateur: { label: 'Operateur', tabs: ['accueil', 'comptage', 'prod', 'sorties', 'entree'], canSign: ['operateur'] },
  preparateur: { label: 'Preparateur melanges', tabs: ['accueil', 'comptage', 'qualite', 'prod'], canSign: ['operateur'] },
  responsableQualite: { label: 'Responsable qualite', tabs: ['accueil', 'qualite'], canSign: ['responsableQualite'] }
};
function roleTabs(role) { return (ROLES[role] && ROLES[role].tabs) || []; }
function roleCanSign(role) { return (ROLES[role] && ROLES[role].canSign) || []; }

const TOKEN_TTL_SEC = 7 * 24 * 3600;
const jwtSecretPath = resolve(dataDir, '.jwt-secret');
let _jwtSecret = null;
async function jwtSecret() {
  if (_jwtSecret) return _jwtSecret;
  await mkdir(dataDir, { recursive: true });
  try {
    _jwtSecret = (await readFile(jwtSecretPath, 'utf8')).trim();
    if (_jwtSecret) return _jwtSecret;
  } catch {}
  _jwtSecret = crypto.randomBytes(48).toString('base64');
  await writeFile(jwtSecretPath, _jwtSecret, 'utf8');
  return _jwtSecret;
}

function pbkdf2(plain, salt) {
  return new Promise((res, rej) => {
    crypto.pbkdf2(plain, salt, 100000, 64, 'sha512', (e, key) => e ? rej(e) : res(key));
  });
}
async function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await pbkdf2(plain, salt);
  return salt + ':' + key.toString('hex');
}
async function verifyPassword(plain, stored) {
  if (!stored || stored.indexOf(':') < 0) return false;
  const [salt, hash] = stored.split(':');
  const key = await pbkdf2(plain, salt);
  const hashBuf = Buffer.from(hash, 'hex');
  if (hashBuf.length !== key.length) return false;
  return crypto.timingSafeEqual(hashBuf, key);
}

function b64url(input) { return Buffer.from(input).toString('base64url'); }
async function jwtSign(payload) {
  const secret = await jwtSecret();
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', secret).update(header + '.' + body).digest());
  return header + '.' + body + '.' + sig;
}
async function jwtVerify(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const secret = await jwtSecret();
  const [h, b, s] = parts;
  const expected = b64url(crypto.createHmac('sha256', secret).update(h + '.' + b).digest());
  const sigBuf = Buffer.from(s);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(b, 'base64url').toString()); } catch { return null; }
  if (!payload || typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
};

function emptyDb() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    users: [],
    inventorySessions: [],
    submissions: [],
    records: [],
    audit: []
  };
}

async function ensureDb() {
  await mkdir(dataDir, { recursive: true });
  try {
    await stat(dbPath);
  } catch {
    await writeJson(dbPath, emptyDb());
  }
}

async function readDb() {
  await ensureDb();
  const raw = await readFile(dbPath, 'utf8');
  const db = JSON.parse(raw);
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.inventorySessions)) db.inventorySessions = [];
  if (!Array.isArray(db.submissions)) db.submissions = [];
  if (!Array.isArray(db.records)) db.records = [];
  if (!Array.isArray(db.audit)) db.audit = [];
  return db;
}

async function writeJson(path, value) {
  const tmp = path + '.tmp';
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await rename(tmp, path);
}

async function writeDb(db) {
  await writeJson(dbPath, db);
  await createDailyBackup();
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function backupStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function weekKey(dateText) {
  const d = new Date(dateText + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

async function listBackupFiles(prefix) {
  try {
    const names = await readdir(backupDir);
    return names.filter(name => name.startsWith(prefix) && name.endsWith('.json')).sort().reverse();
  } catch {
    return [];
  }
}

async function backupList() {
  const files = await listBackupFiles('sips-data-');
  const rows = [];
  for (const file of files) {
    try {
      const st = await stat(resolve(backupDir, file));
      rows.push({ file, size: st.size, createdAt: st.mtime.toISOString() });
    } catch {}
  }
  return rows;
}

function safeBackupName(file) {
  return file === basename(file) && /^sips-data-(daily|manual)-[\w.-]+\.json$/.test(file);
}

async function pruneDailyBackups() {
  const files = await listBackupFiles('sips-data-daily-');
  const keep = new Set(files.slice(0, 7));
  const weekly = new Set();
  for (const file of files.slice(7)) {
    const m = file.match(/^sips-data-daily-(\d{4}-\d{2}-\d{2})/);
    if (!m) continue;
    const wk = weekKey(m[1]);
    if (weekly.size < 4 && !weekly.has(wk)) {
      weekly.add(wk);
      keep.add(file);
    }
  }
  await Promise.all(files.filter(file => !keep.has(file)).map(file => unlink(resolve(backupDir, file)).catch(() => {})));
}

async function createBackup(reason) {
  await ensureDb();
  await mkdir(backupDir, { recursive: true });
  const raw = await readFile(dbPath, 'utf8');
  const file = 'sips-data-' + reason + '-' + backupStamp() + '.json';
  await writeFile(resolve(backupDir, file), raw, 'utf8');
  if (reason === 'daily') await pruneDailyBackups();
  return file;
}

async function createDailyBackup() {
  const today = dateKey(Date.now());
  const existing = await listBackupFiles('sips-data-daily-' + today);
  if (existing.length) return existing[0];
  return createBackup('daily');
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-sips-admin-pin,authorization'
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 10 * 1024 * 1024) {
        reject(new Error('Payload trop volumineux'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolveBody({});
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        reject(new Error('JSON invalide'));
      }
    });
    req.on('error', reject);
  });
}

// Resout l'utilisateur authentifie via le JWT (header Authorization: Bearer ...).
// Verifie a chaque appel que le compte existe, est actif, et que le token
// n'a pas ete emis avant un changement de mot de passe.
async function authUser(req) {
  const header = req.headers['authorization'] || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const payload = await jwtVerify(m[1]);
  if (!payload || !payload.sub) return null;
  const db = await readDb();
  const user = db.users.find(u => u.id === payload.sub);
  if (!user || user.enabled === false) return null;
  if ((user.passwordChangedAt || 0) > (payload.iat || 0)) return null;
  return user;
}

async function requireAuth(req, res) {
  const user = await authUser(req);
  if (!user) {
    sendJson(res, 401, { ok: false, error: 'Authentification requise' });
    return null;
  }
  return user;
}

async function isAdminRequest(req) {
  const pin = req.headers['x-sips-admin-pin'];
  if (pin && pin === adminPin) return true;
  const user = await authUser(req);
  return !!(user && user.role === 'admin');
}

// Accepte l'ancien PIN (compatibilite transitoire) OU un JWT de role admin.
async function requireAdmin(req, res) {
  if (await isAdminRequest(req)) return true;
  sendJson(res, 401, { ok: false, error: 'Acces admin requis' });
  return false;
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    nom: u.nom,
    role: u.role,
    enabled: u.enabled !== false,
    mustChangePassword: !!u.mustChangePassword,
    lastLogin: u.lastLogin || null,
    createdAt: u.createdAt
  };
}
function sessionUser(u) {
  return {
    id: u.id,
    username: u.username,
    nom: u.nom,
    role: u.role,
    mustChangePassword: !!u.mustChangePassword,
    tabs: roleTabs(u.role),
    canSign: roleCanSign(u.role)
  };
}
async function issueToken(user) {
  const iat = Math.floor(Date.now() / 1000);
  return jwtSign({ sub: user.id, role: user.role, nom: user.nom, iat, exp: iat + TOKEN_TTL_SEC });
}

function audit(db, action, actor, details) {
  db.audit.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action,
    actor: actor || null,
    details: details || {}
  });
}

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

function qualityLot(payload) {
  return String(payload && payload.informations && payload.informations.numeroLot || '').trim().toUpperCase();
}

function publicSubmission(s) {
  return {
    id: s.id,
    type: s.type,
    status: s.status,
    author: s.author,
    createdAt: s.createdAt,
    decidedAt: s.decidedAt || null,
    decidedBy: s.decidedBy || null,
    note: s.note || ''
  };
}

function fullSubmission(s) {
  return {
    ...publicSubmission(s),
    payload: s.payload,
    decisionNote: s.decisionNote || ''
  };
}

function recordStatus(r) {
  return r.status || 'validated';
}

function latestInventoryRecord(db) {
  return (db.records || [])
    .filter(r => r.type === 'inventory' && recordStatus(r) === 'validated' && r.payload && r.payload.st)
    .sort((a, b) => String(b.validatedAt || '').localeCompare(String(a.validatedAt || '')))[0] || null;
}

function activeQualityLotConflict(db, lot) {
  if (!lot) return null;
  const submitted = db.submissions.find(s => (
    s.type === 'quality'
    && s.status === 'submitted'
    && qualityLot(s.payload) === lot
  ));
  if (submitted) return { kind: 'submission', row: submitted };
  const record = db.records.find(r => (
    r.type === 'quality'
    && recordStatus(r) !== 'cancelled'
    && qualityLot(r.payload) === lot
  ));
  if (record) return { kind: 'record', row: record };
  return null;
}

function missingQualitySignatures(payload) {
  const labels = {
    operateur: 'operateur',
    responsableQualite: 'responsable qualite'
  };
  const visas = (payload && payload.visas) || {};
  return Object.keys(labels)
    .filter(key => !visas[key] || !visas[key].signature)
    .map(key => labels[key]);
}

function canSignQuality(user) {
  return user && roleCanSign(user.role).some(role => role === 'operateur' || role === 'responsableQualite');
}

function publicInventorySession(s) {
  const contributions = (s.contributions || []).map(c => ({
    id: c.id,
    agent: c.agent,
    userId: c.userId || null,
    username: c.username || '',
    counted: c.counted || 0,
    freshCount: c.freshCount || 0,
    submittedAt: c.submittedAt,
    note: c.note || ''
  }));
  return {
    id: s.id,
    title: s.title || '',
    date: s.date || '',
    status: s.status || 'open',
    baseInventoryId: s.baseInventoryId || null,
    baseDate: s.baseDate || '',
    createdAt: s.createdAt,
    createdBy: s.createdBy || null,
    finalizedAt: s.finalizedAt || null,
    finalizedBy: s.finalizedBy || null,
    submissionId: s.submissionId || null,
    contributions
  };
}

function fullInventorySession(s) {
  return {
    ...publicInventorySession(s),
    baseSnapshot: s.baseSnapshot || null,
    contributions: (s.contributions || []).map(c => ({ ...c }))
  };
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      name: 'SIPS local server',
      time: new Date().toISOString()
    });
  }

  // ====== AUTH ======
  if (req.method === 'GET' && url.pathname === '/api/auth/setup') {
    const db = await readDb();
    return sendJson(res, 200, { ok: true, needsSetup: db.users.length === 0 });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/setup') {
    const db = await readDb();
    if (db.users.length > 0) {
      return sendJson(res, 409, { ok: false, error: 'Configuration deja effectuee' });
    }
    const body = await readBody(req);
    const username = String(body.username || '').trim().toLowerCase();
    const nom = String(body.nom || '').trim();
    const password = String(body.password || '');
    if (!username || !nom || password.length < 4) {
      return sendJson(res, 400, { ok: false, error: 'Identifiant, nom et mot de passe (4 caracteres minimum) requis' });
    }
    const user = {
      id: 'usr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      username, nom, role: 'admin',
      passwordHash: await hashPassword(password),
      enabled: true,
      passwordChangedAt: Math.floor(Date.now() / 1000),
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      createdBy: 'setup',
      lastLogin: new Date().toISOString()
    };
    db.users.push(user);
    audit(db, 'user.setup', nom, { id: user.id });
    await writeDb(db);
    return sendJson(res, 201, { ok: true, token: await issueToken(user), user: sessionUser(user) });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readBody(req);
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const db = await readDb();
    const user = db.users.find(u => u.username === username);
    const ok = user && user.enabled !== false && await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return sendJson(res, 401, { ok: false, error: 'Identifiant ou mot de passe incorrect' });
    }
    user.lastLogin = new Date().toISOString();
    audit(db, 'user.login', user.nom, { id: user.id });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, token: await issueToken(user), user: sessionUser(user) });
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    const user = await requireAuth(req, res);
    if (!user) return;
    return sendJson(res, 200, { ok: true, user: sessionUser(user) });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/verify-password') {
    const user = await requireAuth(req, res);
    if (!user) return;
    const body = await readBody(req);
    const ok = await verifyPassword(String(body.password || ''), user.passwordHash);
    return sendJson(res, 200, { ok });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/change-password') {
    const user = await requireAuth(req, res);
    if (!user) return;
    const body = await readBody(req);
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 4) {
      return sendJson(res, 400, { ok: false, error: 'Nouveau mot de passe trop court (4 caracteres minimum)' });
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return sendJson(res, 401, { ok: false, error: 'Mot de passe actuel incorrect' });
    }
    user.passwordHash = await hashPassword(newPassword);
    user.passwordChangedAt = Math.floor(Date.now() / 1000);
    user.mustChangePassword = false;
    const db = await readDb();
    const dbUser = db.users.find(u => u.id === user.id);
    if (dbUser) {
      dbUser.passwordHash = user.passwordHash;
      dbUser.passwordChangedAt = user.passwordChangedAt;
      dbUser.mustChangePassword = false;
      audit(db, 'user.password_changed', user.nom, { id: user.id });
      await writeDb(db);
      return sendJson(res, 200, { ok: true, token: await issueToken(dbUser), user: sessionUser(dbUser) });
    }
    return sendJson(res, 404, { ok: false, error: 'Utilisateur introuvable' });
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/users') {
    if (!(await requireAdmin(req, res))) return;
    const db = await readDb();
    return sendJson(res, 200, {
      ok: true,
      users: db.users.map(publicUser),
      roles: Object.keys(ROLES).map(k => ({ key: k, label: ROLES[k].label }))
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/users') {
    if (!(await requireAdmin(req, res))) return;
    const body = await readBody(req);
    const username = String(body.username || '').trim().toLowerCase();
    const nom = String(body.nom || '').trim();
    const role = String(body.role || '');
    const password = String(body.password || '');
    if (!username || !nom || !ROLES[role] || password.length < 4) {
      return sendJson(res, 400, { ok: false, error: 'Identifiant, nom, role valide et mot de passe (4 caracteres minimum) requis' });
    }
    const db = await readDb();
    if (db.users.some(u => u.username === username)) {
      return sendJson(res, 409, { ok: false, error: 'Identifiant deja utilise' });
    }
    const actor = await authUser(req);
    const user = {
      id: 'usr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      username, nom, role,
      passwordHash: await hashPassword(password),
      enabled: true,
      passwordChangedAt: Math.floor(Date.now() / 1000),
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
      createdBy: actor ? actor.nom : 'admin',
      lastLogin: null
    };
    db.users.push(user);
    audit(db, 'user.created', actor ? actor.nom : 'admin', { id: user.id, role });
    await writeDb(db);
    return sendJson(res, 201, { ok: true, user: publicUser(user) });
  }

  const userEdit = url.pathname.match(/^\/api\/auth\/users\/([^/]+)$/);
  if (req.method === 'POST' && userEdit) {
    if (!(await requireAdmin(req, res))) return;
    const actor = await authUser(req);
    const body = await readBody(req);
    const db = await readDb();
    const user = db.users.find(u => u.id === userEdit[1]);
    if (!user) return sendJson(res, 404, { ok: false, error: 'Utilisateur introuvable' });

    const isSelf = actor && actor.id === user.id;
    const otherEnabledAdmins = db.users.filter(u => u.role === 'admin' && u.enabled !== false && u.id !== user.id);
    const isLastAdmin = user.role === 'admin' && otherEnabledAdmins.length === 0;

    if (body.role !== undefined) {
      if (!ROLES[body.role]) return sendJson(res, 400, { ok: false, error: 'Role invalide' });
      if (isLastAdmin && body.role !== 'admin') {
        return sendJson(res, 409, { ok: false, error: 'Impossible de retirer le role du dernier admin' });
      }
      user.role = body.role;
    }
    if (body.enabled !== undefined) {
      const enabled = !!body.enabled;
      if (!enabled && isSelf) return sendJson(res, 409, { ok: false, error: 'Impossible de desactiver son propre compte' });
      if (!enabled && isLastAdmin) return sendJson(res, 409, { ok: false, error: 'Impossible de desactiver le dernier admin' });
      user.enabled = enabled;
    }
    if (body.password) {
      if (String(body.password).length < 4) return sendJson(res, 400, { ok: false, error: 'Mot de passe trop court (4 caracteres minimum)' });
      user.passwordHash = await hashPassword(String(body.password));
      user.passwordChangedAt = Math.floor(Date.now() / 1000);
      user.mustChangePassword = true;
    }
    if (body.nom !== undefined) {
      const nom = String(body.nom).trim();
      if (nom) user.nom = nom;
    }
    audit(db, 'user.updated', actor ? actor.nom : 'admin', { id: user.id });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, user: publicUser(user) });
  }

  // ====== INVENTAIRE FRAGMENTE SERVEUR ======
  if (req.method === 'GET' && url.pathname === '/api/inventory-sessions') {
    const user = await requireAuth(req, res);
    if (!user) return;
    const db = await readDb();
    const includeClosed = url.searchParams.get('includeClosed') === '1';
    let rows = db.inventorySessions || [];
    if (!includeClosed) rows = rows.filter(s => (s.status || 'open') === 'open');
    rows = rows.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return sendJson(res, 200, { ok: true, sessions: rows.map(publicInventorySession) });
  }

  if (req.method === 'POST' && url.pathname === '/api/inventory-sessions') {
    if (!(await requireAdmin(req, res))) return;
    const actor = await authUser(req);
    const body = await readBody(req);
    const date = String(body.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return sendJson(res, 400, { ok: false, error: 'Date inventaire requise' });
    }
    const db = await readDb();
    const baseRecord = body.baseInventoryId
      ? db.records.find(r => r.id === body.baseInventoryId && r.type === 'inventory' && recordStatus(r) === 'validated')
      : latestInventoryRecord(db);
    const sess = {
      id: 'isess_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      title: String(body.title || '').trim(),
      date,
      baseInventoryId: baseRecord ? baseRecord.id : null,
      baseDate: baseRecord && baseRecord.payload ? (baseRecord.payload.date || '') : '',
      baseSnapshot: baseRecord && baseRecord.payload ? (baseRecord.payload.st || null) : null,
      status: 'open',
      createdAt: new Date().toISOString(),
      createdBy: actor ? { id: actor.id, name: actor.nom, role: actor.role } : { name: 'admin' },
      contributions: []
    };
    db.inventorySessions.push(sess);
    audit(db, 'inventory_session.created', actor ? actor.nom : 'admin', { id: sess.id, date: sess.date });
    await writeDb(db);
    return sendJson(res, 201, { ok: true, session: publicInventorySession(sess) });
  }

  const inventorySessionDetail = url.pathname.match(/^\/api\/inventory-sessions\/([^/]+)$/);
  if (req.method === 'GET' && inventorySessionDetail) {
    const user = await requireAuth(req, res);
    if (!user) return;
    const db = await readDb();
    const sess = db.inventorySessions.find(s => s.id === inventorySessionDetail[1]);
    if (!sess) return sendJson(res, 404, { ok: false, error: 'Session inventaire introuvable' });
    return sendJson(res, 200, { ok: true, session: fullInventorySession(sess) });
  }

  const inventoryContribution = url.pathname.match(/^\/api\/inventory-sessions\/([^/]+)\/contributions$/);
  if (req.method === 'POST' && inventoryContribution) {
    const user = await requireAuth(req, res);
    if (!user) return;
    const body = await readBody(req);
    const payload = body.payload || {};
    const freshCodes = Array.isArray(payload.freshCodes)
      ? [...new Set(payload.freshCodes.map(c => String(c)).filter(Boolean))]
      : [];
    const counts = {};
    if (payload.counts && typeof payload.counts === 'object') {
      for (const code of freshCodes) {
        if (payload.counts[code] && payload.counts[code].counted) counts[code] = payload.counts[code];
      }
    } else if (payload.st && payload.st.c && typeof payload.st.c === 'object') {
      for (const code of freshCodes) {
        if (payload.st.c[code] && payload.st.c[code].counted) counts[code] = payload.st.c[code];
      }
    }
    const countedCodes = Object.keys(counts);
    if (!freshCodes.length || !countedCodes.length) {
      return sendJson(res, 400, { ok: false, error: 'Aucun article recompte dans ce fragment' });
    }
    const db = await readDb();
    const sess = db.inventorySessions.find(s => s.id === inventoryContribution[1]);
    if (!sess) return sendJson(res, 404, { ok: false, error: 'Session inventaire introuvable' });
    if ((sess.status || 'open') !== 'open') {
      return sendJson(res, 409, { ok: false, error: 'Session inventaire deja finalisee' });
    }
    if (payload.baseInventoryId && payload.baseInventoryId !== sess.baseInventoryId) {
      return sendJson(res, 409, { ok: false, error: 'Base inventaire differente de la session serveur' });
    }
    const rec = {
      id: 'icontrib_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      userId: user.id,
      username: user.username,
      agent: String(payload.agent || user.nom || '').trim() || user.nom,
      counted: countedCodes.length,
      freshCount: countedCodes.length,
      submittedAt: new Date().toISOString(),
      note: String(body.note || '').trim(),
      payload: {
        baseInventoryId: sess.baseInventoryId || null,
        baseDate: sess.baseDate || '',
        agent: String(payload.agent || user.nom || '').trim() || user.nom,
        freshCodes: countedCodes,
        counts,
        cfg: payload.cfg || {}
      }
    };
    sess.contributions = sess.contributions || [];
    const existing = sess.contributions.findIndex(c => c.userId === user.id);
    if (existing >= 0) sess.contributions[existing] = rec;
    else sess.contributions.push(rec);
    sess.updatedAt = rec.submittedAt;
    audit(db, 'inventory_session.contribution', user.nom, { id: sess.id, counted: countedCodes.length });
    await writeDb(db);
    return sendJson(res, existing >= 0 ? 200 : 201, { ok: true, session: publicInventorySession(sess), contribution: rec });
  }

  const inventoryFinalize = url.pathname.match(/^\/api\/inventory-sessions\/([^/]+)\/finalize$/);
  if (req.method === 'POST' && inventoryFinalize) {
    if (!(await requireAdmin(req, res))) return;
    const actor = await authUser(req);
    const body = await readBody(req);
    const payload = body.payload || {};
    if (!payload.st || !payload.st.c) {
      return sendJson(res, 400, { ok: false, error: 'Inventaire fusionne manquant' });
    }
    if (body.summary && Number(body.summary.conflicts || 0) > 0) {
      return sendJson(res, 409, { ok: false, error: 'Conflits inventaire non resolus' });
    }
    const db = await readDb();
    const sess = db.inventorySessions.find(s => s.id === inventoryFinalize[1]);
    if (!sess) return sendJson(res, 404, { ok: false, error: 'Session inventaire introuvable' });
    if ((sess.status || 'open') !== 'open') {
      return sendJson(res, 409, { ok: false, error: 'Session inventaire deja finalisee' });
    }
    const finalizedAt = new Date().toISOString();
    const hash = submissionHash('inventory', payload);
    const sub = {
      id: 'sub_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      sourceInventorySessionId: sess.id,
      hash,
      type: 'inventory',
      status: 'submitted',
      payload,
      author: payload.author || null,
      note: body.note || ('Fusion inventaire serveur ' + (sess.title || sess.date || sess.id)),
      createdAt: finalizedAt
    };
    db.submissions.push(sub);
    sess.status = 'finalized';
    sess.finalizedAt = finalizedAt;
    sess.finalizedBy = body.actor || (actor ? actor.nom : 'admin');
    sess.submissionId = sub.id;
    sess.finalSummary = body.summary || {};
    audit(db, 'inventory_session.finalized', sess.finalizedBy, {
      id: sess.id,
      submissionId: sub.id,
      contributions: (sess.contributions || []).length,
      conflicts: body.summary && body.summary.conflicts
    });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, session: publicInventorySession(sess), submission: publicSubmission(sub) });
  }

  if (req.method === 'GET' && url.pathname === '/api/submissions') {
    const db = await readDb();
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const includePayload = url.searchParams.get('include') === 'payload';
    if (includePayload) {
      const user = await authUser(req);
      const qualitySignerRead = type === 'quality' && status === 'submitted' && canSignQuality(user);
      if (!qualitySignerRead && !(await isAdminRequest(req))) {
        return sendJson(res, 401, { ok: false, error: 'Acces admin requis' });
      }
    }
    let rows = db.submissions;
    if (status) rows = rows.filter(s => s.status === status);
    if (type) rows = rows.filter(s => s.type === type);
    rows = rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sendJson(res, 200, { ok: true, submissions: rows.map(includePayload ? fullSubmission : publicSubmission) });
  }

  const detail = url.pathname.match(/^\/api\/submissions\/([^/]+)$/);
  if (req.method === 'GET' && detail) {
    if (!(await requireAdmin(req, res))) return;
    const db = await readDb();
    const sub = db.submissions.find(s => s.id === detail[1]);
    if (!sub) return sendJson(res, 404, { ok: false, error: 'Soumission introuvable' });
    return sendJson(res, 200, { ok: true, submission: fullSubmission(sub) });
  }

  if (req.method === 'POST' && url.pathname === '/api/submissions') {
    const body = await readBody(req);
    if (!body.type || !body.payload) {
      return sendJson(res, 400, { ok: false, error: 'type et payload requis' });
    }
    const db = await readDb();
    const type = String(body.type);
    const hash = submissionHash(type, body.payload);
    const activeRecord = db.records.find(r => r.hash === hash && recordStatus(r) !== 'cancelled');
    const existing = db.submissions.find(s => s.hash === hash && s.status === 'submitted')
      || (activeRecord && db.submissions.find(s => s.id === activeRecord.sourceSubmissionId));
    if (existing) {
      audit(db, 'submission.duplicate', body.author, { id: existing.id, type });
      await writeDb(db);
      return sendJson(res, 200, { ok: true, duplicate: true, submission: publicSubmission(existing) });
    }
    if (type === 'quality') {
      const lot = qualityLot(body.payload);
      const lotConflict = activeQualityLotConflict(db, lot);
      if (lotConflict) {
        audit(db, 'submission.duplicate_lot', body.author, { id: lotConflict.row.id, type, lot });
        await writeDb(db);
        return sendJson(res, 409, {
          ok: false,
          duplicateLot: true,
          error: 'Une fiche qualite active existe deja pour le lot ' + lot + '. Rejetez ou annulez l ancienne version avant de resoumettre une correction.'
        });
      }
    }
    const rec = {
      id: 'sub_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      type,
      hash,
      status: 'submitted',
      author: body.author || null,
      payload: body.payload,
      note: body.note || '',
      createdAt: new Date().toISOString()
    };
    db.submissions.push(rec);
    audit(db, 'submission.created', body.author, { id: rec.id, type: rec.type });
    await writeDb(db);
    return sendJson(res, 201, { ok: true, submission: publicSubmission(rec) });
  }

  const qualitySign = url.pathname.match(/^\/api\/submissions\/([^/]+)\/quality-sign$/);
  if (req.method === 'POST' && qualitySign) {
    const user = await requireAuth(req, res);
    if (!user) return;
    const body = await readBody(req);
    const role = String(body.role || '');
    if (roleCanSign(user.role).indexOf(role) < 0 || ['operateur', 'responsableQualite'].indexOf(role) < 0) {
      return sendJson(res, 403, { ok: false, error: 'Ce compte ne peut pas signer ce visa qualite' });
    }
    const signature = String((body.visa && body.visa.signature) || '');
    if (!signature || signature.indexOf('data:image/') !== 0) {
      return sendJson(res, 400, { ok: false, error: 'Signature manquante' });
    }
    const db = await readDb();
    const sub = db.submissions.find(s => s.id === qualitySign[1]);
    if (!sub) return sendJson(res, 404, { ok: false, error: 'Soumission introuvable' });
    if (sub.type !== 'quality') return sendJson(res, 400, { ok: false, error: 'Soumission non qualite' });
    if (sub.status !== 'submitted') return sendJson(res, 409, { ok: false, error: 'Soumission deja traitee' });
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
    sub.qualitySignedBy = user.nom;
    audit(db, 'quality.signature', user.nom, { id: sub.id, role });
    await writeDb(db);
    return sendJson(res, 200, {
      ok: true,
      submission: fullSubmission(sub),
      missing: missingQualitySignatures(sub.payload)
    });
  }

  const decision = url.pathname.match(/^\/api\/submissions\/([^/]+)\/(validate|reject)$/);
  if (req.method === 'POST' && decision) {
    if (!(await requireAdmin(req, res))) return;
    const [, id, action] = decision;
    const body = await readBody(req);
    const db = await readDb();
    const sub = db.submissions.find(s => s.id === id);
    if (!sub) return sendJson(res, 404, { ok: false, error: 'Soumission introuvable' });
    if (sub.status !== 'submitted') {
      return sendJson(res, 409, { ok: false, error: 'Soumission deja traitee' });
    }
    if (action === 'validate' && sub.type === 'quality') {
      const missing = missingQualitySignatures(sub.payload);
      if (missing.length) {
        return sendJson(res, 400, { ok: false, error: 'Validation qualite impossible : signature(s) manquante(s) ' + missing.join(', ') });
      }
    }
    sub.status = action === 'validate' ? 'validated' : 'rejected';
    sub.decidedAt = new Date().toISOString();
    sub.decidedBy = body.actor || 'admin';
    sub.decisionNote = body.note || '';
    if (sub.status === 'validated') {
      db.records.push({
        id: 'rec_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
        sourceSubmissionId: sub.id,
        hash: sub.hash || submissionHash(sub.type, sub.payload),
        type: sub.type,
        status: 'validated',
        payload: sub.payload,
        author: sub.author || null,
        validatedBy: sub.decidedBy,
        validatedAt: sub.decidedAt
      });
    }
    audit(db, 'submission.' + sub.status, sub.decidedBy, { id: sub.id, type: sub.type, note: sub.decisionNote || '' });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, submission: publicSubmission(sub) });
  }

  if (req.method === 'GET' && url.pathname === '/api/records') {
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    if (!(await isAdminRequest(req))) {
      const user = await authUser(req);
      if (!(type === 'quality' && canSignQuality(user))) {
        return sendJson(res, 401, { ok: false, error: 'Acces admin requis' });
      }
    }
    const db = await readDb();
    let rows = db.records;
    if (type) rows = rows.filter(r => r.type === type);
    if (status) rows = rows.filter(r => recordStatus(r) === status);
    return sendJson(res, 200, { ok: true, records: rows });
  }

  const cancelRecord = url.pathname.match(/^\/api\/records\/([^/]+)\/cancel$/);
  if (req.method === 'POST' && cancelRecord) {
    if (!(await requireAdmin(req, res))) return;
    const body = await readBody(req);
    const db = await readDb();
    const rec = db.records.find(r => r.id === cancelRecord[1]);
    if (!rec) return sendJson(res, 404, { ok: false, error: 'Enregistrement introuvable' });
    if (recordStatus(rec) === 'cancelled') {
      return sendJson(res, 409, { ok: false, error: 'Enregistrement deja annule' });
    }
    rec.status = 'cancelled';
    rec.cancelledAt = new Date().toISOString();
    rec.cancelledBy = body.actor || 'admin';
    rec.cancelReason = body.reason || '';
    audit(db, 'record.cancelled', rec.cancelledBy, {
      id: rec.id,
      sourceSubmissionId: rec.sourceSubmissionId || null,
      type: rec.type,
      reason: rec.cancelReason
    });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, record: rec });
  }

  if (req.method === 'GET' && url.pathname === '/api/audit') {
    if (!(await requireAdmin(req, res))) return;
    const db = await readDb();
    return sendJson(res, 200, { ok: true, audit: db.audit.slice().reverse() });
  }

  if (req.method === 'POST' && url.pathname === '/api/backup') {
    if (!(await requireAdmin(req, res))) return;
    const body = await readBody(req);
    const db = await readDb();
    audit(db, 'backup.created', body.actor || 'admin', { reason: 'manual' });
    await writeDb(db);
    const file = await createBackup('manual');
    return sendJson(res, 200, { ok: true, backup: file });
  }

  if (req.method === 'GET' && url.pathname === '/api/backups') {
    if (!(await requireAdmin(req, res))) return;
    await mkdir(backupDir, { recursive: true });
    return sendJson(res, 200, { ok: true, backups: await backupList() });
  }

  const backupDownload = url.pathname.match(/^\/api\/backups\/([^/]+)$/);
  if (req.method === 'GET' && backupDownload) {
    if (!(await requireAdmin(req, res))) return;
    const file = decodeURIComponent(backupDownload[1]);
    if (!safeBackupName(file)) return sendJson(res, 400, { ok: false, error: 'Nom de sauvegarde invalide' });
    const target = resolve(backupDir, file);
    if (!target.startsWith(backupDir)) return sendJson(res, 400, { ok: false, error: 'Nom de sauvegarde invalide' });
    try {
      await stat(target);
    } catch {
      return sendJson(res, 404, { ok: false, error: 'Sauvegarde introuvable' });
    }
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="' + file + '"',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    });
    return createReadStream(target).pipe(res);
  }

  return sendJson(res, 404, { ok: false, error: 'Route API inconnue' });
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const target = normalize(resolve(rootDir, '.' + pathname));
  if (!target.startsWith(rootDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  try {
    const st = await stat(target);
    if (!st.isFile()) throw new Error('not file');
    res.writeHead(200, {
      'content-type': mime[extname(target)] || 'application/octet-stream'
    });
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

async function requestHandler(req, res) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url);
    }
    return await serveStatic(req, res, url);
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message || 'Erreur serveur' });
  }
}

const tlsPort = Number(process.env.SIPS_TLS_PORT || 3443);
const tlsCertPath = process.env.SIPS_TLS_CERT || resolve(__dirname, 'certs', 'cert.pem');
const tlsKeyPath = process.env.SIPS_TLS_KEY || resolve(__dirname, 'certs', 'key.pem');

async function loadTls() {
  try {
    const [cert, key] = await Promise.all([readFile(tlsCertPath), readFile(tlsKeyPath)]);
    return { cert, key };
  } catch {
    return null;
  }
}

await ensureDb();

// HTTP reste TOUJOURS actif : secours, acces localhost, compatibilite existante.
const httpServer = createHttpServer(requestHandler);
httpServer.listen(port, '0.0.0.0', () => {
  console.log('SIPS local server (HTTP)');
  console.log('  Local:   http://localhost:' + port);
  console.log('  Reseau:  http://ADRESSE_IP_DU_PC:' + port);
});

// HTTPS optionnel : actif uniquement si un certificat est present dans server/certs/.
// Necessaire pour le mode hors-ligne PWA sur les telephones. Voir SERVER_HTTPS.md.
const tls = await loadTls();
if (tls) {
  const httpsServer = createHttpsServer(tls, requestHandler);
  httpsServer.on('error', err => console.log('HTTPS erreur: ' + err.message));
  httpsServer.listen(tlsPort, '0.0.0.0', () => {
    console.log('SIPS local server (HTTPS)');
    console.log('  Local:   https://localhost:' + tlsPort);
    console.log('  Reseau:  https://ADRESSE_IP_DU_PC:' + tlsPort);
  });
} else {
  console.log('HTTPS desactive : aucun certificat dans server/certs/ (mode hors-ligne PWA indisponible). Voir SERVER_HTTPS.md.');
}

if (!process.env.SIPS_ADMIN_PIN) {
  console.log('  PIN admin par defaut: 1234 (changer avec SIPS_ADMIN_PIN)');
}
