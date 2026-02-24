import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import { contactRoutes } from './routes/contacts';
import { groupRoutes } from './routes/groups';
import { feedRoutes } from './routes/feed';
import { offerRoutes } from './routes/offers';
import { rateRoutes } from './routes/rates';
import { isBlacklisted } from './services/blacklist';

export async function createServer() {
  const server = Fastify({ logger: true });

  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-init-data'],
    credentials: true,
  });

  server.addHook('preHandler', async (request, reply) => {
    if (request.url === '/api/health') return;

    const telegramId = getTelegramIdFromRequest(request);
    if (telegramId && isBlacklisted(telegramId)) {
      reply.status(503).send({ error: 'Service temporarily unavailable' });
    }
  });

  // Health check
  server.get('/api/health', async () => ({ status: 'ok' }));

  // Register route plugins
  server.register(feedRoutes, { prefix: '/api/feed' });
  server.register(offerRoutes, { prefix: '/api/offers' });
  server.register(rateRoutes, { prefix: '/api/rates' });
  server.register(contactRoutes, { prefix: '/api/contacts' });
  server.register(groupRoutes, { prefix: '/api/groups' });

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

function getTelegramIdFromRequest(request: { headers: Record<string, string | string[] | undefined> }): number | null {
  const initData = request.headers['x-telegram-init-data'];
  if (!initData || typeof initData !== 'string') return null;

  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    if (!userJson) return null;

    const user = JSON.parse(userJson);
    return typeof user.id === 'number' ? user.id : null;
  } catch {
    return null;
  }
}
