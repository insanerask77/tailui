import { FastifyInstance } from 'fastify';

export async function configRoutes(app: FastifyInstance) {
  app.get('/api/config', async () => {
    return {
      headscaleUrl: process.env.HEADSCALE_PUBLIC_URL ?? process.env.HEADSCALE_URL ?? 'http://localhost:8080',
    };
  });
}
