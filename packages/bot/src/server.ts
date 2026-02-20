import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';

export async function createServer() {
  const server = Fastify({ logger: true });

  await server.register(cors, {
    origin: config.isProd ? false : ['http://localhost:5173'],
  });

  // Health check
  server.get('/api/health', async () => ({ status: 'ok' }));

  // TODO: register route plugins
  // server.register(authRoutes, { prefix: '/api/auth' });
  // server.register(contactRoutes, { prefix: '/api/contacts' });
  // server.register(offerRoutes, { prefix: '/api/offers' });
  // server.register(matchRoutes, { prefix: '/api/matches' });
  // server.register(groupRoutes, { prefix: '/api/groups' });
  // server.register(dealRoutes, { prefix: '/api/deals' });

  // In production, serve mini-app static build
  if (config.isProd) {
    const fastifyStatic = await import('@fastify/static');
    await server.register(fastifyStatic.default, {
      root: new URL('../../mini-app/dist', import.meta.url).pathname,
      prefix: '/',
      wildcard: true,
    });

    // SPA fallback — serve index.html for non-API routes
    server.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        reply.status(404).send({ error: 'Not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  return server;
}
