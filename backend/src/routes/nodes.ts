import { FastifyInstance } from 'fastify';
import * as headscale from '../headscale/client';
import type { HsNode } from '../headscale/types';

export async function nodeRoutes(app: FastifyInstance) {
  app.get('/api/nodes', async (_req, reply) => {
    try {
      const nodeList = await headscale.nodes.list();
      return nodeList.map((node) => ({
        ...node,
        online: headscale.isOnline(node),
        expired: isExpired(node),
      }));
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });

  app.get('/api/users', async (_req, reply) => {
    try {
      return await headscale.users.list();
    } catch (err) {
      return reply.code(502).send({ error: headscaleErr(err) });
    }
  });
}

function isExpired(node: HsNode): boolean {
  if (!node.expiry || node.expiry.startsWith('0001-')) return false;
  return new Date(node.expiry).getTime() < Date.now();
}

function headscaleErr(err: unknown): string {
  return `Headscale unavailable: ${err instanceof Error ? err.message : 'Unknown error'}`;
}
