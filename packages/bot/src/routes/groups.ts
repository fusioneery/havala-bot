import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db';
import * as schema from '../db/schema';

export const groupRoutes: FastifyPluginAsync = async (server) => {
  server.get('/', async () => {
    const groups = await db
      .select({
        name: schema.trustedGroups.name,
        link: schema.trustedGroups.link,
      })
      .from(schema.trustedGroups);

    return groups.filter((g) => g.link);
  });
};
