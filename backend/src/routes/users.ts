import { FastifyInstance, FastifyRequest } from 'fastify';
import * as headscale from '../headscale/client';
import { auditLog } from '../db';
import { verifyToken, COOKIE_NAME } from '../auth/jwt';

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

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export async function userRoutes(app: FastifyInstance) {
  // ── List (with nodeCount) ─────────────────────────────────────────────
  app.get('/api/users', async (_req, reply) => {
    try {
      const [userList, nodeList] = await Promise.all([
        headscale.users.list(),
        headscale.nodes.list(),
      ]);
      const countMap = nodeList.reduce<Record<string, number>>((acc, n) => {
        acc[n.user.name] = (acc[n.user.name] ?? 0) + 1;
        return acc;
      }, {});
      return userList.map((u) => ({ ...u, nodeCount: countMap[u.name] ?? 0 }));
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Create ────────────────────────────────────────────────────────────
  app.post('/api/users', async (req, reply) => {
    const { name } = req.body as { name?: string };
    if (!name || !NAME_RE.test(name)) {
      return reply.code(400).send({ error: 'Name must be lowercase letters, numbers, hyphens only (starting with letter/digit)' });
    }
    const by = await actor(req);
    try {
      const result = await headscale.users.create(name);
      auditLog('user.create', by, name);
      return result;
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Rename ────────────────────────────────────────────────────────────
  app.patch('/api/users/:name', async (req, reply) => {
    const { name } = req.params as { name: string };
    const { newName } = req.body as { newName?: string };
    if (!newName || !NAME_RE.test(newName)) {
      return reply.code(400).send({ error: 'New name must be lowercase letters, numbers, hyphens only' });
    }
    const by = await actor(req);
    try {
      const result = await headscale.users.rename(name, newName);
      auditLog('user.rename', by, `${name} → ${newName}`);
      return result;
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Delete ────────────────────────────────────────────────────────────
  app.delete('/api/users/:name', async (req, reply) => {
    const { name } = req.params as { name: string };
    const by = await actor(req);
    try {
      await headscale.users.delete(name);
      auditLog('user.delete', by, name);
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });
}
