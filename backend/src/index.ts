import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from './auth/routes';
import { authGuard } from './middleware/authGuard';
import { overviewRoutes } from './routes/overview';
import { nodeRoutes } from './routes/nodes';
import { getDb } from './db';

const app = Fastify({
  logger: process.env.LOG_LEVEL === 'warn'
    ? { level: 'warn' }
    : { level: 'info' },
});

getDb();

app.register(cookie);
app.register(authRoutes);
app.register(overviewRoutes);
app.register(nodeRoutes);

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
