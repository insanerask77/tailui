import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { signToken, verifyToken, COOKIE_NAME } from './jwt';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (req, reply) => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      return reply.code(400).send({ error: 'username and password required' });
    }

    const adminUser = process.env.ADMIN_USERNAME;
    const adminHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminUser || !adminHash) {
      return reply.code(500).send({ error: 'Server misconfigured' });
    }

    const usernameMatch = username === adminUser;
    const passwordMatch = await bcrypt.compare(password, adminHash);

    if (!usernameMatch || !passwordMatch) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = await signToken(username);

    reply
      .setCookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
      .send({ ok: true });
  });

  app.post('/auth/logout', async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' }).send({ ok: true });
  });

  app.get('/auth/me', async (req, reply) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const payload = await verifyToken(token);
      return { username: payload.username };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
}
