// Сервис брифа skoup.ru. За nginx на шлюзе gw:
//   POST /api/brief/               — заявка (multipart/form-data, поля как в src/scripts/brief/index.ts)
//   GET  /api/brief/files/:id/:n   — файл заявки по подписанной ссылке из письма
//   GET  /api/brief/health         — проверка живости
// Персональные данные в лог не пишем — только id заявки.
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { openStore } from './store.js';
import { parseBrief, validateBrief } from './brief.js';
import { createMailer, composeLetter, signFile } from './mail.js';

const filesRoot = join(config.dataDir, 'files');
const tmpRoot = join(config.dataDir, 'tmp');
await mkdir(filesRoot, { recursive: true });
await mkdir(tmpRoot, { recursive: true });

const store = openStore(join(config.dataDir, 'briefs.db'));
const mailer = createMailer(config.mail);
const log = (event, data = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), event, ...data }));
if (!mailer) log('mail_disabled', { reason: 'нет ключа Postbox — письма уйдут, когда он появится' });

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

// ---------- Приём заявки ----------

async function handleSubmit(req, res) {
  if (!String(req.headers['content-type'] ?? '').startsWith('multipart/form-data')) {
    json(res, 415, { error: 'multipart_required' });
    return;
  }
  const tmpDir = join(tmpRoot, randomUUID());
  await mkdir(tmpDir);
  let parsed;
  try {
    parsed = await parseBrief(req, tmpDir);
  } catch {
    await rm(tmpDir, { recursive: true, force: true });
    json(res, 400, { error: 'bad_form' });
    return;
  }

  const result = validateBrief(parsed);
  if (result.spam || result.error) {
    await rm(tmpDir, { recursive: true, force: true });
    if (result.spam) {
      log('spam');
      json(res, 201, { ok: true }); // боту — обычный ответ
    } else {
      log('rejected', { reason: result.error });
      json(res, 400, { error: result.error });
    }
    return;
  }

  const id = randomUUID();
  const brief = { ...result.brief, id, receivedAt: new Date().toISOString() };
  if (brief.files.length) await rename(tmpDir, join(filesRoot, id));
  else await rm(tmpDir, { recursive: true, force: true });
  store.insert(brief);
  log('brief', { id, files: brief.files.length, marketing: brief.marketing });
  json(res, 201, { ok: true });
  notifyPending();
}

// ---------- Письма ----------

let notifying = false;
async function notifyPending() {
  if (!mailer || notifying) return;
  notifying = true;
  try {
    for (const brief of store.pending()) {
      try {
        await mailer.sendMail(
          composeLetter(brief, {
            env: config.env,
            publicUrl: config.publicUrl,
            linkSecret: config.linkSecret,
            linkDays: config.linkDays,
            from: config.mail.from,
            to: config.mail.to,
          }),
        );
        store.markNotified(brief.id);
        log('notified', { id: brief.id });
      } catch (error) {
        store.markAttempt(brief.id);
        log('notify_failed', { id: brief.id, code: error.code ?? error.responseCode ?? 'unknown' });
      }
    }
  } finally {
    notifying = false;
  }
}

// ---------- Файлы по ссылке из письма ----------

async function handleFile(res, id, index, url) {
  const expires = Number(url.searchParams.get('e'));
  const token = url.searchParams.get('t') ?? '';
  const expected = signFile(config.linkSecret, id, index, expires);
  const valid =
    Number.isFinite(expires) &&
    expires > Date.now() / 1000 &&
    token.length === expected.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (!valid) {
    json(res, 403, { error: 'link_invalid_or_expired' });
    return;
  }
  const brief = store.get(id);
  const file = brief?.files[index];
  if (!file || brief.files_deleted_at) {
    json(res, 410, { error: 'gone' });
    return;
  }
  const path = join(filesRoot, id, String(index));
  try {
    const info = await stat(path);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': info.size,
      'Content-Disposition': `attachment; filename="file"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    createReadStream(path).pipe(res);
  } catch {
    json(res, 410, { error: 'gone' });
  }
}

// ---------- Сроки хранения (политика, раздел 2.1) ----------

async function cleanup() {
  const day = 86400 * 1000;
  for (const id of store.filesOlderThan(new Date(Date.now() - config.retention.filesDays * day).toISOString())) {
    await rm(join(filesRoot, id), { recursive: true, force: true });
    store.markFilesDeleted(id);
    log('files_deleted', { id });
  }
  for (const id of store.olderThan(new Date(Date.now() - config.retention.briefDays * day).toISOString())) {
    await rm(join(filesRoot, id), { recursive: true, force: true });
    store.remove(id);
    log('brief_deleted', { id });
  }
  // недокачанные загрузки старше суток
  for (const dir of await readdir(tmpRoot)) {
    const info = await stat(join(tmpRoot, dir)).catch(() => null);
    if (info && Date.now() - info.mtimeMs > day) await rm(join(tmpRoot, dir), { recursive: true, force: true });
  }
}

// ---------- HTTP ----------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '');
    if (req.method === 'GET' && path === '/api/brief/health') return json(res, 200, { ok: true, env: config.env });
    if (req.method === 'POST' && path === '/api/brief') return await handleSubmit(req, res);
    const file = path.match(/^\/api\/brief\/files\/([0-9a-f-]{36})\/(\d)$/);
    if (req.method === 'GET' && file) return await handleFile(res, file[1], Number(file[2]), url);
    json(res, 404, { error: 'not_found' });
  } catch (error) {
    log('error', { message: error.message });
    if (!res.headersSent) json(res, 500, { error: 'internal' });
    else res.destroy();
  }
});
server.requestTimeout = 15 * 60 * 1000; // до 5 файлов по 50 МБ на медленном соединении
server.headersTimeout = 60 * 1000;

server.listen(config.port, () => log('started', { port: config.port, env: config.env }));
setInterval(notifyPending, 10 * 60 * 1000).unref();
setInterval(() => cleanup().catch((e) => log('cleanup_failed', { message: e.message })), 24 * 3600 * 1000).unref();
cleanup().catch((e) => log('cleanup_failed', { message: e.message }));
notifyPending();

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
