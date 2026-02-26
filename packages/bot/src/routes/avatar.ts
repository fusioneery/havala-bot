import type { FastifyInstance } from 'fastify';
import { config } from '../config';

export async function avatarRoutes(server: FastifyInstance) {
  // GET /:telegramId — proxy user avatar from Telegram Bot API
  server.get<{ Params: { telegramId: string } }>('/:telegramId', async (request, reply) => {
    const telegramId = Number(request.params.telegramId);
    if (!telegramId || isNaN(telegramId)) {
      return reply.status(400).send({ error: 'Invalid telegramId' });
    }

    try {
      const photosRes = await fetch(
        `https://api.telegram.org/bot${config.botToken}/getUserProfilePhotos?user_id=${telegramId}&limit=1`,
      );
      const photosData = (await photosRes.json()) as {
        ok: boolean;
        result?: { photos?: Array<Array<{ file_id: string; width: number }>> };
      };

      if (!photosData.ok || !photosData.result?.photos?.length) {
        return reply.status(404).send({ error: 'No avatar' });
      }

      const sizes = photosData.result.photos[0];
      if (!sizes?.length) {
        return reply.status(404).send({ error: 'No avatar' });
      }

      // Pick the smallest size >= 160px, or the largest available
      const target = sizes.find((s) => s.width >= 160) ?? sizes[sizes.length - 1];

      const fileRes = await fetch(
        `https://api.telegram.org/bot${config.botToken}/getFile?file_id=${encodeURIComponent(target.file_id)}`,
      );
      const fileData = (await fileRes.json()) as {
        ok: boolean;
        result?: { file_path: string };
      };

      if (!fileData.ok || !fileData.result?.file_path) {
        return reply.status(404).send({ error: 'No avatar' });
      }

      const imageRes = await fetch(
        `https://api.telegram.org/file/bot${config.botToken}/${fileData.result.file_path}`,
      );

      if (!imageRes.ok || !imageRes.body) {
        return reply.status(502).send({ error: 'Failed to fetch avatar' });
      }

      const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=3600');

      return reply.send(Buffer.from(await imageRes.arrayBuffer()));
    } catch {
      return reply.status(502).send({ error: 'Failed to fetch avatar' });
    }
  });
}
