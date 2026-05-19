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

    CREATE TABLE IF NOT EXISTS app_users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'user',
      namespace     TEXT,
      created_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      token       TEXT    UNIQUE NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'user',
      namespace   TEXT,
      created_by  TEXT    NOT NULL,
      used        INTEGER NOT NULL DEFAULT 0,
      expires_at  INTEGER NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
  seedAdminFromEnv(db);
}

function seedAdminFromEnv(db: Database.Database) {
  const existing = db.prepare('SELECT id FROM app_users WHERE role = ?').get('admin');
  if (existing) return;

  const username = process.env.ADMIN_USERNAME;
  const b64 = process.env.ADMIN_PASSWORD_HASH_B64;
  const direct = process.env.ADMIN_PASSWORD_HASH;
  if (!username || (!b64 && !direct)) return;

  const hash = b64
    ? Buffer.from(b64, 'base64').toString('utf8')
    : direct!;

  db.prepare('INSERT OR IGNORE INTO app_users (username, password_hash, role, namespace) VALUES (?, ?, ?, ?)')
    .run(username, hash, 'admin', null);
}

// ── Users ──────────────────────────────────────────────────────────────────

export interface AppUser {
  id: number;
  username: string;
  password_hash: string;
  role: 'admin' | 'user';
  namespace: string | null;
  created_at: number;
}

export function getUserByUsername(username: string): AppUser | undefined {
  return getDb().prepare('SELECT * FROM app_users WHERE username = ?').get(username) as AppUser | undefined;
}

export function listAppUsers(): Omit<AppUser, 'password_hash'>[] {
  return getDb().prepare('SELECT id, username, role, namespace, created_at FROM app_users ORDER BY created_at DESC').all() as Omit<AppUser, 'password_hash'>[];
}

export function createAppUser(username: string, passwordHash: string, role: string, namespace: string | null): AppUser {
  const db = getDb();
  db.prepare('INSERT INTO app_users (username, password_hash, role, namespace) VALUES (?, ?, ?, ?)').run(username, passwordHash, role, namespace);
  return db.prepare('SELECT * FROM app_users WHERE username = ?').get(username) as AppUser;
}

export function deleteAppUser(id: number): void {
  getDb().prepare('DELETE FROM app_users WHERE id = ?').run(id);
}

export function updateAppUserPassword(id: number, hash: string): void {
  getDb().prepare('UPDATE app_users SET password_hash = ? WHERE id = ?').run(hash, id);
}

// ── Invitations ────────────────────────────────────────────────────────────

export interface Invitation {
  id: number;
  token: string;
  role: string;
  namespace: string | null;
  created_by: string;
  used: number;
  expires_at: number;
  created_at: number;
}

export function createInvitation(token: string, role: string, namespace: string | null, createdBy: string, expiresAt: number): Invitation {
  const db = getDb();
  db.prepare('INSERT INTO invitations (token, role, namespace, created_by, expires_at) VALUES (?, ?, ?, ?, ?)').run(token, role, namespace, createdBy, expiresAt);
  return db.prepare('SELECT * FROM invitations WHERE token = ?').get(token) as Invitation;
}

export function getInvitation(token: string): Invitation | undefined {
  return getDb().prepare('SELECT * FROM invitations WHERE token = ?').get(token) as Invitation | undefined;
}

export function listInvitations(): Invitation[] {
  return getDb().prepare('SELECT * FROM invitations WHERE used = 0 ORDER BY created_at DESC').all() as Invitation[];
}

export function markInvitationUsed(token: string): void {
  getDb().prepare('UPDATE invitations SET used = 1 WHERE token = ?').run(token);
}

export function revokeInvitation(token: string): void {
  getDb().prepare('DELETE FROM invitations WHERE token = ?').run(token);
}

// ── Audit log ──────────────────────────────────────────────────────────────

export function auditLog(action: string, actor: string, target?: string) {
  getDb().prepare('INSERT INTO audit_log (action, actor, target) VALUES (?, ?, ?)').run(action, actor, target ?? null);
}

export function recentAuditEvents(limit = 10): AuditEvent[] {
  return getDb()
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
