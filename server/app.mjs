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
    'cache-control': 'no-store'
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

async function handleApi(req, res, url) {
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
    let rows = db.submissions;
    if (status) rows = rows.filter(s => s.status === status);
    if (type) rows = rows.filter(s => s.type === type);
    rows = rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sendJson(res, 200, { ok: true, submissions: rows.map(publicSubmission) });
  }

  if (req.method === 'POST' && url.pathname === '/api/submissions') {
    const body = await readBody(req);
    if (!body.type || !body.payload) {
      return sendJson(res, 400, { ok: false, error: 'type et payload requis' });
    }
    const db = await readDb();
    const rec = {
      id: 'sub_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      type: String(body.type),
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
        type: sub.type,
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
    return sendJson(res, 200, { ok: true, records: db.records });
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
