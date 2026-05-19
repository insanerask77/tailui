import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'tailui.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      action  TEXT    NOT NULL,
      actor   TEXT    NOT NULL,
      target  TEXT,
      ts      INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

export function auditLog(action: string, actor: string, target?: string) {
  const db = getDb();
  db.prepare('INSERT INTO audit_log (action, actor, target) VALUES (?, ?, ?)').run(
    action,
    actor,
    target ?? null,
  );
}

export function recentAuditEvents(limit = 10): AuditEvent[] {
  const db = getDb();
  return db
    .prepare('SELECT id, action, actor, target, ts FROM audit_log ORDER BY id DESC LIMIT ?')
    .all(limit) as AuditEvent[];
}

export interface AuditEvent {
  id: number;
  action: string;
  actor: string;
  target: string | null;
  ts: number;
}
