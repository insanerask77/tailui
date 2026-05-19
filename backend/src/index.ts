import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from './auth/routes';
import { authGuard } from './middleware/authGuard';

const app = Fastify({
  logger: process.env.LOG_LEVEL === 'warn'
    ? { level: 'warn' }
    : { level: 'info' },
});

app.register(cookie);
app.register(authRoutes);

app.addHook('preHandler', async (req, reply) => {
  if (req.url.startsWith('/api/')) {
    await authGuard(req, reply);
  }
});

app.get('/health', async () => ({ ok: true }));

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`tailui-backend listening on :${port}`);
});
