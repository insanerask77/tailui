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

const DEFAULT_POLICY = `{
  // Headscale ACL policy — HuJSON format (comments allowed)
  // Documentation: https://headscale.net/acls/
  "groups": {},
  "tagOwners": {},
  "acls": [
    // Allow all nodes to communicate with each other
    {"action": "accept", "src": ["*"], "dst": ["*:*"]}
  ]
}`;

export async function policyRoutes(app: FastifyInstance) {
  // ── GET policy ────────────────────────────────────────────────────────────
  app.get('/api/policy', async (_req, reply) => {
    try {
      return await headscale.policy.get();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('acl policy not found') || msg.includes('404') || msg.includes('code 5') || msg.includes('code 2')) {
        return { policy: DEFAULT_POLICY, updatedAt: null };
      }
      return reply.code(502).send({ error: `Headscale unavailable: ${msg}` });
    }
  });

  // ── PUT policy ────────────────────────────────────────────────────────────
  app.put('/api/policy', async (req, reply) => {
    const { policy } = req.body as { policy?: string };
    if (policy === undefined) return reply.code(400).send({ error: 'policy is required' });
    const by = await actor(req);
    try {
      const result = await headscale.policy.put(policy);
      auditLog('policy.update', by);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('400') || msg.includes('invalid') || msg.includes('parse')) {
        return reply.code(422).send({ error: `Policy validation failed: ${msg}` });
      }
      return reply.code(502).send({ error: `Headscale unavailable: ${msg}` });
    }
  });
}
