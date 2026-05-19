import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, COOKIE_NAME, JwtPayload } from '../auth/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

export async function authGuard(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return reply.code(401).send({ error: 'Unauthorized' });
  try {
    req.user = await verifyToken(token);
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function adminGuard(req: FastifyRequest, reply: FastifyReply) {
  await authGuard(req, reply);
  if (reply.sent) return;
  if (req.user.role !== 'admin') return reply.code(403).send({ error: 'Forbidden' });
}

/** Returns null for admins (no filter) or namespace string for users. */
export function scopeNamespace(req: FastifyRequest): string | null {
  return req.user?.role === 'admin' ? null : (req.user?.namespace ?? null);
}
