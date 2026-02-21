import type { FastifyInstance } from 'fastify';
import { getRate, getRateInfo, getVas3kRates } from '../services/rates';

export async function rateRoutes(server: FastifyInstance) {
  server.get('/', async (_request, reply) => {
    const cached = getVas3kRates();
    if (!cached) {
      return reply.status(502).send({ error: 'vas3k.kurs rates not available' });
    }
    return reply.send(cached.data);
  });

  // Market rate for any currency pair
  server.get<{
    Querystring: { from: string; to: string };
  }>('/market', async (request, reply) => {
    const { from, to } = request.query;

    if (!from || !to) {
      return reply.status(400).send({ error: 'Missing "from" and "to" query params' });
    }

    const rate = getRate(from.toUpperCase(), to.toUpperCase());

    if (rate === null) {
      return reply.status(404).send({
        error: `Rate not available for ${from}/${to}`,
      });
    }

    return reply.send({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate,
      info: getRateInfo(),
    });
  });
}
