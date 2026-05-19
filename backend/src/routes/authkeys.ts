import { FastifyInstance, FastifyRequest } from 'fastify';
import * as headscale from '../headscale/client';
import { auditLog } from '../db';
import { verifyToken, COOKIE_NAME } from '../auth/jwt';
import { scopeNamespace } from '../middleware/authGuard';

async function actor(req: FastifyRequest): Promise<string> {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return 'unknown';
    return (await verifyToken(token)).username;
  } catch { return 'unknown'; }
}

function headscaleErr(err: unknown): string {
  return `Headscale unavailable: ${err instanceof Error ? err.message : 'Unknown error'}`;
}

export async function authKeyRoutes(app: FastifyInstance) {
  // ── List keys (scoped by namespace for non-admin) ─────────────────────────
  app.get('/api/authkeys', async (req, reply) => {
    const ns = scopeNamespace(req);
    try {
      const userList = await headscale.users.list();
      const filtered = ns ? userList.filter(u => u.name === ns) : userList;
      const keyLists = await Promise.all(filtered.map((u) => headscale.preauthkeys.list(u.name)));
      return keyLists.flat();
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Create key ────────────────────────────────────────────────────────────
  app.post('/api/authkeys', async (req, reply) => {
    const body = req.body as {
      user?: string;
      reusable?: boolean;
      ephemeral?: boolean;
      expiration?: string;
      aclTags?: string[];
    };
    if (!body.user) return reply.code(400).send({ error: 'user is required' });
    const by = await actor(req);
    try {
      const defaultExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const result = await headscale.preauthkeys.create({
        user: body.user,
        reusable: body.reusable ?? false,
        ephemeral: body.ephemeral ?? false,
        expiration: body.expiration ?? defaultExpiry,
        aclTags: body.aclTags ?? [],
      });
      auditLog('authkey.create', by, body.user);
      return result;
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Expire key ────────────────────────────────────────────────────────────
  app.post('/api/authkeys/expire', async (req, reply) => {
    const { user, key } = req.body as { user?: string; key?: string };
    if (!user || !key) return reply.code(400).send({ error: 'user and key are required' });
    const by = await actor(req);
    try {
      await headscale.preauthkeys.expire(user, key);
      auditLog('authkey.expire', by, `${user}/${key.slice(0, 10)}…`);
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });
}
