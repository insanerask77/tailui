import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from './auth/routes';
import { authGuard } from './middleware/authGuard';
import { overviewRoutes } from './routes/overview';
import { nodeRoutes } from './routes/nodes';
import { userRoutes } from './routes/users';
import { authKeyRoutes } from './routes/authkeys';
import { apiKeyRoutes } from './routes/apikeys';
import { routeRoutes } from './routes/routes';
import { dnsRoutes } from './routes/dns';
import { policyRoutes } from './routes/policy';
import { eventRoutes } from './routes/events';
import { configRoutes } from './routes/config';
import * as broadcaster from './sse/broadcaster';
import { getDb } from './db';

const app = Fastify({
  logger: process.env.LOG_LEVEL === 'warn'
    ? { level: 'warn' }
    : { level: 'info' },
});

getDb();
broadcaster.start();

app.register(cookie);
app.register(authRoutes);
app.register(overviewRoutes);
app.register(nodeRoutes);
app.register(userRoutes);
app.register(authKeyRoutes);
app.register(apiKeyRoutes);
app.register(routeRoutes);
app.register(dnsRoutes);
app.register(policyRoutes);
app.register(eventRoutes);
app.register(configRoutes);

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
