import { FastifyInstance } from 'fastify';
import { verifyToken, COOKIE_NAME } from '../auth/jwt';
import * as broadcaster from '../sse/broadcaster';

let clientSeq = 0;

export async function eventRoutes(app: FastifyInstance) {
  app.get('/api/events', async (req, reply) => {
    // Validate JWT — EventSource sends cookies automatically (same-origin)
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    try {
      await verifyToken(token);
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Hijack the connection — Fastify won't manage the response lifecycle
    reply.hijack();

    const res = reply.raw;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx/proxy buffering
    res.flushHeaders();

    // Keepalive comment every 25s to prevent proxy timeouts
    const keepalive = setInterval(() => {
      try { res.write(': keepalive\n\n'); } catch { /* ignore */ }
    }, 25_000);

    const id = `client-${++clientSeq}`;
    broadcaster.addClient(id, res);

    req.raw.on('close', () => {
      clearInterval(keepalive);
      broadcaster.removeClient(id);
    });
  });
}
