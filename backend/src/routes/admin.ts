import { FastifyInstance, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {
  listAppUsers, createAppUser, deleteAppUser,
  listInvitations, createInvitation, revokeInvitation, getInvitation,
  getUserByUsername,
} from '../db';
import { auditLog } from '../db';
import { verifyToken, COOKIE_NAME } from '../auth/jwt';
import { adminGuard } from '../middleware/authGuard';

async function actorUsername(req: FastifyRequest): Promise<string> {
  try {
    const t = req.cookies[COOKIE_NAME];
    return t ? (await verifyToken(t)).username : 'unknown';
  } catch { return 'unknown'; }
}

export async function adminRoutes(app: FastifyInstance) {

  // All routes here require admin role
  app.addHook('preHandler', adminGuard);

  // ── List TailUI users ─────────────────────────────────────────────────────
  app.get('/api/admin/users', async () => {
    return listAppUsers();
  });

  // ── Create user directly ──────────────────────────────────────────────────
  app.post('/api/admin/users', async (req, reply) => {
    const { username, password, role, namespace } = req.body as {
      username?: string; password?: string; role?: string; namespace?: string;
    };
    if (!username || !password) return reply.code(400).send({ error: 'username and password required' });
    if (getUserByUsername(username)) return reply.code(409).send({ error: 'Username already taken' });

    const hash = await bcrypt.hash(password, 12);
    const user = createAppUser(username, hash, role ?? 'user', namespace ?? null);
    auditLog('admin.user.create', await actorUsername(req), username);
    return { id: user.id, username: user.username, role: user.role, namespace: user.namespace };
  });

  // ── Delete user ───────────────────────────────────────────────────────────
  app.delete('/api/admin/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const by = await actorUsername(req);
    // Prevent admin from deleting themselves
    const self = listAppUsers().find(u => u.username === by);
    if (self?.id === Number(id)) return reply.code(400).send({ error: 'Cannot delete your own account' });

    deleteAppUser(Number(id));
    auditLog('admin.user.delete', by, id);
    return { ok: true };
  });

  // ── List active invitations ───────────────────────────────────────────────
  app.get('/api/admin/invitations', async () => {
    return listInvitations();
  });

  // ── Create invitation ─────────────────────────────────────────────────────
  app.post('/api/admin/invitations', async (req, reply) => {
    const { role, namespace, expiresInHours } = req.body as {
      role?: string; namespace?: string; expiresInHours?: number;
    };
    const by = await actorUsername(req);
    const token = crypto.randomBytes(24).toString('hex');
    const hours = expiresInHours ?? 48;
    const expiresAt = Math.floor(Date.now() / 1000) + hours * 3600;

    const inv = createInvitation(token, role ?? 'user', namespace ?? null, by, expiresAt);
    auditLog('admin.invitation.create', by, namespace ?? 'no-namespace');

    const baseUrl = process.env.TAILUI_PUBLIC_URL ?? '';
    return { ...inv, inviteUrl: `${baseUrl}/register/${token}` };
  });

  // ── Revoke invitation ─────────────────────────────────────────────────────
  app.delete('/api/admin/invitations/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const inv = getInvitation(token);
    if (!inv) return reply.code(404).send({ error: 'Invitation not found' });
    revokeInvitation(token);
    auditLog('admin.invitation.revoke', await actorUsername(req), token.slice(0, 8) + '…');
    return { ok: true };
  });
}
