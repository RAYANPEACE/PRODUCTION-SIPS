import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat, rename } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const dataDir = resolve(__dirname, 'data');
const dbPath = resolve(dataDir, 'sips-data.json');
const port = Number(process.env.SIPS_PORT || 3000);
const adminPin = process.env.SIPS_ADMIN_PIN || '1234';

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
  return JSON.parse(raw);
}

async function writeJson(path, value) {
  const tmp = path + '.tmp';
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await rename(tmp, path);
}

async function writeDb(db) {
  await writeJson(dbPath, db);
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-sips-admin-pin'
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

function requireAdmin(req, res) {
  const pin = req.headers['x-sips-admin-pin'];
  if (pin !== adminPin) {
    sendJson(res, 401, { ok: false, error: 'PIN admin invalide' });
    return false;
  }
  return true;
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

  if (req.method === 'GET' && url.pathname === '/api/submissions') {
    const db = await readDb();
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const includePayload = url.searchParams.get('include') === 'payload';
    if (includePayload && !requireAdmin(req, res)) return;
    let rows = db.submissions;
    if (status) rows = rows.filter(s => s.status === status);
    if (type) rows = rows.filter(s => s.type === type);
    rows = rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sendJson(res, 200, { ok: true, submissions: rows.map(includePayload ? fullSubmission : publicSubmission) });
  }

  const detail = url.pathname.match(/^\/api\/submissions\/([^/]+)$/);
  if (req.method === 'GET' && detail) {
    if (!requireAdmin(req, res)) return;
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

  const decision = url.pathname.match(/^\/api\/submissions\/([^/]+)\/(validate|reject)$/);
  if (req.method === 'POST' && decision) {
    if (!requireAdmin(req, res)) return;
    const [, id, action] = decision;
    const body = await readBody(req);
    const db = await readDb();
    const sub = db.submissions.find(s => s.id === id);
    if (!sub) return sendJson(res, 404, { ok: false, error: 'Soumission introuvable' });
    if (sub.status !== 'submitted') {
      return sendJson(res, 409, { ok: false, error: 'Soumission deja traitee' });
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
    audit(db, 'submission.' + sub.status, sub.decidedBy, { id: sub.id, type: sub.type });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, submission: publicSubmission(sub) });
  }

  if (req.method === 'GET' && url.pathname === '/api/records') {
    if (!requireAdmin(req, res)) return;
    const db = await readDb();
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    let rows = db.records;
    if (type) rows = rows.filter(r => r.type === type);
    if (status) rows = rows.filter(r => recordStatus(r) === status);
    return sendJson(res, 200, { ok: true, records: rows });
  }

  const cancelRecord = url.pathname.match(/^\/api\/records\/([^/]+)\/cancel$/);
  if (req.method === 'POST' && cancelRecord) {
    if (!requireAdmin(req, res)) return;
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
    if (!requireAdmin(req, res)) return;
    const db = await readDb();
    return sendJson(res, 200, { ok: true, audit: db.audit.slice().reverse() });
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

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url);
    }
    return await serveStatic(req, res, url);
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message || 'Erreur serveur' });
  }
});

await ensureDb();
server.listen(port, '0.0.0.0', () => {
  console.log('SIPS local server');
  console.log('  Local:   http://localhost:' + port);
  console.log('  Reseau:  http://ADRESSE_IP_DU_PC:' + port);
  if (!process.env.SIPS_ADMIN_PIN) {
    console.log('  PIN admin par defaut: 1234 (changer avec SIPS_ADMIN_PIN)');
  }
});
