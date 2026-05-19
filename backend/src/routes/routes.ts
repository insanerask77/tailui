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

export async function routeRoutes(app: FastifyInstance) {
  // ── List all routes ───────────────────────────────────────────────────────
  app.get('/api/routes', async (_req, reply) => {
    try {
      return await headscale.routes.list();
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Enable route ──────────────────────────────────────────────────────────
  app.post('/api/routes/:routeId/enable', async (req, reply) => {
    const { routeId } = req.params as { routeId: string };
    const by = await actor(req);
    try {
      const result = await headscale.routes.enable(routeId);
      auditLog('route.enable', by, routeId);
      return result;
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  // ── Disable route ─────────────────────────────────────────────────────────
  app.post('/api/routes/:routeId/disable', async (req, reply) => {
    const { routeId } = req.params as { routeId: string };
    const by = await actor(req);
    try {
      const result = await headscale.routes.disable(routeId);
      auditLog('route.disable', by, routeId);
      return result;
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });
}
