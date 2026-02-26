import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { config } from './config';
import { contactRoutes } from './routes/contacts';
import { groupRoutes } from './routes/groups';
import { feedRoutes } from './routes/feed';
import { offerRoutes } from './routes/offers';
import { rateRoutes } from './routes/rates';
import { avatarRoutes } from './routes/avatar';
import { isBlacklisted } from './services/blacklist';
import { authenticateRequest } from './lib/auth';
import { debugError } from './services/debug-chat';
import { getAvatarsDir } from './services/avatar-storage';

export async function createServer() {
  const server = Fastify({
    logger: {
      level: 'info',
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            headers: request.headers,
          };
        },
      },
    },
  });

  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-init-data'],
    credentials: true,
  });

  // Global error handler — log full details for every unhandled error
  server.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(
      { err: error, req: { method: request.method, url: request.url, body: request.body } },
      `Unhandled error on ${request.method} ${request.url}`,
    );
    const statusCode = error.statusCode ?? 500;
    void debugError(`HTTP ${request.method} ${request.url}`, error, {
      statusCode,
    });
    reply.status(statusCode).send({
      error: error.name || 'InternalServerError',
      message: error.message,
      statusCode,
    });
  });

  // Log POST/PUT/DELETE request bodies for debugging
  server.addHook('preHandler', async (request) => {
    if (request.method !== 'GET' && request.method !== 'OPTIONS' && request.url !== '/api/health') {
      request.log.info({ body: request.body }, `${request.method} ${request.url} body`);
    }
  });

  server.addHook('preHandler', async (request, reply) => {
    if (request.url === '/api/health' || request.url.startsWith('/static/')) return;

    const authResult = await authenticateRequest(request);
    if (authResult.ok) {
      if (isBlacklisted(authResult.data.telegramId)) {
        return reply.status(503).send({ error: 'Service temporarily unavailable' });
      }
      (request as any).auth = authResult.data;
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
  server.register(avatarRoutes, { prefix: '/api/avatar' });

  // Serve avatar images from disk (both dev and production)
  await server.register(fastifyStatic, {
    root: getAvatarsDir(),
    prefix: '/static/avatars/',
    decorateReply: false,
  });

  // In production, serve mini-app static build
  if (config.isProd) {
    await server.register(fastifyStatic, {
      root: new URL('../../mini-app/dist', import.meta.url).pathname,
      prefix: '/',
      wildcard: true,
      decorateReply: false,
    });

    // SPA fallback — serve index.html only for GET on non-API routes
    server.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        reply.status(404).send({ error: 'Not found' });
      } else if (request.method === 'GET' || request.method === 'HEAD') {
        reply.sendFile('index.html');
      } else {
        reply.status(404).send({ error: 'Not found' });
      }
    });
  }

  return server;
}

