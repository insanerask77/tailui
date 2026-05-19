import Fastify from 'fastify';

const app = Fastify({ logger: process.env.LOG_LEVEL !== 'warn' });

app.get('/health', async () => ({ ok: true }));

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`tailui-backend listening on :${port}`);
});
