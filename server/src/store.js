// Хранилище заявок — встроенный SQLite Node (node:sqlite), один файл в каталоге данных.
import { DatabaseSync } from 'node:sqlite';

export function openStore(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS briefs (
      id TEXT PRIMARY KEY,
      received_at TEXT NOT NULL,          -- серверное время получения, ISO UTC
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      contact TEXT NOT NULL,
      contact_type TEXT NOT NULL,
      phone TEXT NOT NULL,
      services TEXT NOT NULL,             -- JSON-массив
      task TEXT NOT NULL,
      budget TEXT NOT NULL,
      files TEXT NOT NULL,                -- JSON: [{ name, size }], файлы — files/<id>/<номер>
      consent_version TEXT NOT NULL,      -- редакция согласия на обработку ПДн (ч. 3 ст. 9 152-ФЗ)
      marketing INTEGER NOT NULL,         -- 1 — дал согласие на рассылку
      marketing_version TEXT,
      notified_at TEXT,
      notify_attempts INTEGER NOT NULL DEFAULT 0,
      files_deleted_at TEXT
    );
  `);

  const insert = db.prepare(`
    INSERT INTO briefs (id, received_at, name, company, contact, contact_type, phone, services, task, budget, files,
                        consent_version, marketing, marketing_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const getOne = db.prepare('SELECT * FROM briefs WHERE id = ?');
  const pending = db.prepare(
    'SELECT * FROM briefs WHERE notified_at IS NULL AND notify_attempts < 20 ORDER BY received_at LIMIT 20',
  );
  const notified = db.prepare('UPDATE briefs SET notified_at = ? WHERE id = ?');
  const attempt = db.prepare('UPDATE briefs SET notify_attempts = notify_attempts + 1 WHERE id = ?');
  const filesExpired = db.prepare(
    "SELECT id FROM briefs WHERE files_deleted_at IS NULL AND files != '[]' AND received_at < ?",
  );
  const filesDeleted = db.prepare('UPDATE briefs SET files_deleted_at = ? WHERE id = ?');
  const expired = db.prepare('SELECT id FROM briefs WHERE received_at < ?');
  const remove = db.prepare('DELETE FROM briefs WHERE id = ?');

  const parse = (row) => row && { ...row, services: JSON.parse(row.services), files: JSON.parse(row.files) };

  return {
    insert(b) {
      insert.run(
        b.id, b.receivedAt, b.name, b.company, b.contact, b.contactType, b.phone, JSON.stringify(b.services),
        b.task, b.budget, JSON.stringify(b.files), b.consentVersion, b.marketing ? 1 : 0, b.marketingVersion ?? null,
      );
    },
    get: (id) => parse(getOne.get(id)),
    pending: () => pending.all().map(parse),
    markNotified: (id) => notified.run(new Date().toISOString(), id),
    markAttempt: (id) => attempt.run(id),
    filesOlderThan: (iso) => filesExpired.all(iso).map((r) => r.id),
    markFilesDeleted: (id) => filesDeleted.run(new Date().toISOString(), id),
    olderThan: (iso) => expired.all(iso).map((r) => r.id),
    remove: (id) => remove.run(id),
    close: () => db.close(),
  };
}
