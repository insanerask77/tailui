import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, COOKIE_NAME } from '../auth/jwt';

export async function authGuard(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  try {
    await verifyToken(token);
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}
