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

export async function apiKeyRoutes(app: FastifyInstance) {
  // ── List ──────────────────────────────────────────────────────────────────
  app.get('/api/apikeys', async (_req, reply) => {
    try {
      return await headscale.apikeys.list();
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Create ────────────────────────────────────────────────────────────────
  app.post('/api/apikeys', async (req, reply) => {
    const body = req.body as { expiration?: string };
    const by = await actor(req);
    try {
      const defaultExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const result = await headscale.apikeys.create(body.expiration ?? defaultExpiry);
      auditLog('apikey.create', by);
      return result;
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Revoke ────────────────────────────────────────────────────────────────
  app.delete('/api/apikeys/:prefix', async (req, reply) => {
    const { prefix } = req.params as { prefix: string };
    const by = await actor(req);
    try {
      await headscale.apikeys.revoke(prefix);
      auditLog('apikey.revoke', by, prefix);
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });
}
