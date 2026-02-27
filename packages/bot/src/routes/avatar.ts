import type { FastifyInstance } from 'fastify';
import { downloadAndSaveAvatar, getLocalAvatarUrl } from '../services/avatar-storage';

export async function avatarRoutes(server: FastifyInstance) {
  // GET /:telegramId — serve locally stored avatar (download on first request)
  server.get<{ Params: { telegramId: string } }>('/:telegramId', async (request, reply) => {
    const telegramId = Number(request.params.telegramId);
    if (!telegramId || isNaN(telegramId)) {
      return reply.status(400).send({ error: 'Invalid telegramId' });
    }

    // Check if already downloaded
    let localUrl = getLocalAvatarUrl(telegramId);

    // If not on disk yet, download from Telegram
    if (!localUrl) {
      localUrl = await downloadAndSaveAvatar(telegramId);
    }

    if (!localUrl) {
      return reply.status(404).send({ error: 'No avatar' });
    }

    // Redirect to the static file
    return reply.redirect(localUrl);
  });
}
