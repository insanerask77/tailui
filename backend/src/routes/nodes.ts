import { FastifyInstance, FastifyRequest } from 'fastify';
import * as headscale from '../headscale/client';
import type { HsNode } from '../headscale/types';
import { auditLog } from '../db';
import { verifyToken, COOKIE_NAME } from '../auth/jwt';

async function actor(req: FastifyRequest): Promise<string> {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return 'unknown';
    return (await verifyToken(token)).username;
  } catch {
    return 'unknown';
  }
}

function isExpired(node: HsNode): boolean {
  if (!node.expiry || node.expiry.startsWith('0001-')) return false;
  return new Date(node.expiry).getTime() < Date.now();
}

function headscaleErr(err: unknown): string {
  return `Headscale unavailable: ${err instanceof Error ? err.message : 'Unknown error'}`;
}

export async function nodeRoutes(app: FastifyInstance) {
  // ── List ──────────────────────────────────────────────────────────────
  app.get('/api/nodes', async (_req, reply) => {
    try {
      const list = await headscale.nodes.list();
      return list.map((n) => ({ ...n, online: headscale.isOnline(n), expired: isExpired(n) }));
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Update (rename / tags) ────────────────────────────────────────────
  app.patch('/api/nodes/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { name?: string; tags?: string[] };
    const by = await actor(req);

    try {
      if (body.name !== undefined) {
        await headscale.nodes.rename(id, body.name);
        auditLog('node.rename', by, id);
      }
      if (body.tags !== undefined) {
        await headscale.nodes.setTags(id, body.tags);
        auditLog('node.tags', by, id);
      }
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Delete ────────────────────────────────────────────────────────────
  app.delete('/api/nodes/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const by = await actor(req);
    try {
      await headscale.nodes.delete(id);
      auditLog('node.delete', by, id);
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Expire ────────────────────────────────────────────────────────────
  app.post('/api/nodes/:id/expire', async (req, reply) => {
    const { id } = req.params as { id: string };
    const by = await actor(req);
    try {
      await headscale.nodes.expire(id);
      auditLog('node.expire', by, id);
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Bulk expire ───────────────────────────────────────────────────────
  app.post('/api/nodes/bulk-expire', async (req, reply) => {
    const { ids } = req.body as { ids: string[] };
    const by = await actor(req);
    try {
      await Promise.all(ids.map((id) => headscale.nodes.expire(id)));
      ids.forEach((id) => auditLog('node.expire', by, id));
      return { ok: true, count: ids.length };
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Bulk delete ───────────────────────────────────────────────────────
  app.post('/api/nodes/bulk-delete', async (req, reply) => {
    const { ids } = req.body as { ids: string[] };
    const by = await actor(req);
    try {
      await Promise.all(ids.map((id) => headscale.nodes.delete(id)));
      ids.forEach((id) => auditLog('node.delete', by, id));
      return { ok: true, count: ids.length };
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Move node to different user ───────────────────────────────────────
  app.put('/api/nodes/:id/user', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { user } = req.body as { user?: string };
    if (!user) return reply.code(400).send({ error: 'user is required' });
    const by = await actor(req);
    try {
      const result = await headscale.nodes.move(id, user);
      auditLog('node.move', by, `${id} → ${user}`);
      return result;
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });
}
