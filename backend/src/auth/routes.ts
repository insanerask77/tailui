import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { signToken, verifyToken, COOKIE_NAME } from './jwt';
import {
  getUserByUsername, createAppUser, updateAppUserPassword,
  getInvitation, markInvitationUsed,
} from '../db';
import { auditLog } from '../db';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 7,
  path: '/',
};

export async function authRoutes(app: FastifyInstance) {

  // ── Login ────────────────────────────────────────────────────────────────
  app.post('/auth/login', async (req, reply) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) return reply.code(400).send({ error: 'username and password required' });

    const user = getUserByUsername(username);
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return reply.code(401).send({ error: 'Invalid credentials' });

    const token = await signToken({ username, role: user.role, namespace: user.namespace });
    auditLog('auth.login', username);
    reply.setCookie(COOKIE_NAME, token, COOKIE_OPTS).send({ ok: true });
  });

  // ── Logout ───────────────────────────────────────────────────────────────
  app.post('/auth/logout', async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' }).send({ ok: true });
  });

  // ── Me ───────────────────────────────────────────────────────────────────
  app.get('/auth/me', async (req, reply) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      const payload = await verifyToken(token);
      return { username: payload.username, role: payload.role, namespace: payload.namespace };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // ── Validate invite token (public) ───────────────────────────────────────
  app.get('/auth/invite/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const inv = getInvitation(token);
    if (!inv || inv.used || inv.expires_at < Math.floor(Date.now() / 1000)) {
      return reply.code(404).send({ error: 'Invalid or expired invitation' });
    }
    return { valid: true, role: inv.role, namespace: inv.namespace };
  });

  // ── Register via invite (public) ─────────────────────────────────────────
  app.post('/auth/invite/:token/register', async (req, reply) => {
    const { token } = req.params as { token: string };
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) return reply.code(400).send({ error: 'username and password required' });
    if (password.length < 8) return reply.code(400).send({ error: 'Password must be at least 8 characters' });

    const inv = getInvitation(token);
    if (!inv || inv.used || inv.expires_at < Math.floor(Date.now() / 1000)) {
      return reply.code(400).send({ error: 'Invalid or expired invitation' });
    }

    const existing = getUserByUsername(username);
    if (existing) return reply.code(409).send({ error: 'Username already taken' });

    const hash = await bcrypt.hash(password, 12);
    const user = createAppUser(username, hash, inv.role, inv.namespace);
    markInvitationUsed(token);
    auditLog('auth.register', username, `via invite from ${inv.created_by}`);

    const jwt = await signToken({ username, role: user.role as 'admin' | 'user', namespace: user.namespace });
    reply.setCookie(COOKIE_NAME, jwt, COOKIE_OPTS).send({ ok: true });
  });

  // ── Change own password (authenticated) ──────────────────────────────────
  app.patch('/auth/password', async (req, reply) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: 'Unauthorized' });
    const payload = await verifyToken(token).catch(() => null);
    if (!payload) return reply.code(401).send({ error: 'Unauthorized' });

    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) return reply.code(400).send({ error: 'currentPassword and newPassword required' });
    if (newPassword.length < 8) return reply.code(400).send({ error: 'Password must be at least 8 characters' });

    const user = getUserByUsername(payload.username);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return reply.code(401).send({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    updateAppUserPassword(user.id, hash);
    auditLog('auth.password_change', payload.username);
    reply.send({ ok: true });
  });
}
