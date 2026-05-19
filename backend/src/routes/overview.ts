import { FastifyInstance } from 'fastify';
import * as headscale from '../headscale/client';
import { recentAuditEvents } from '../db';
import { scopeNamespace } from '../middleware/authGuard';

export async function overviewRoutes(app: FastifyInstance) {
  app.get('/api/overview', async (req, reply) => {
    const ns = scopeNamespace(req);
    try {
      const [nodeList, userList, events] = await Promise.all([
        headscale.nodes.list(),
        headscale.users.list(),
        Promise.resolve(recentAuditEvents(10)),
      ]);

      const nodes = ns ? nodeList.filter(n => n.user?.name === ns) : nodeList;
      const users = ns ? userList.filter(u => u.name === ns) : userList;

      return {
        nodesTotal:  nodes.length,
        nodesOnline: nodes.filter(headscale.isOnline).length,
        nodesOffline: nodes.filter(n => !headscale.isOnline(n)).length,
        usersCount:  users.length,
        recentEvents: events,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.code(502).send({ error: `Headscale unavailable: ${message}` });
    }
  });
}
