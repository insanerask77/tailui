import { FastifyInstance } from 'fastify';
import * as headscale from '../headscale/client';
import { recentAuditEvents } from '../db';

export async function overviewRoutes(app: FastifyInstance) {
  app.get('/api/overview', async (_req, reply) => {
    try {
      const [nodeList, userList, events] = await Promise.all([
        headscale.nodes.list(),
        headscale.users.list(),
        Promise.resolve(recentAuditEvents(10)),
      ]);

      const nodesTotal = nodeList.length;
      const nodesOnline = nodeList.filter(headscale.isOnline).length;
      const usersCount = userList.length;

      return {
        nodesTotal,
        nodesOnline,
        nodesOffline: nodesTotal - nodesOnline,
        usersCount,
        recentEvents: events,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.code(502).send({ error: `Headscale unavailable: ${message}` });
    }
  });
}
