import type { FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { config } from '../config';

/**
 * Resolve the internal user ID from the x-telegram-init-data header.
 * In dev mode, falls back to userId 1 when header is absent.
 * Returns null if the user cannot be identified.
 */
export async function resolveUserId(request: FastifyRequest): Promise<number | null> {
  const initData = request.headers['x-telegram-init-data'];

  if (!initData || typeof initData !== 'string') {
    return config.dev ? 1 : null;
  }

  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    if (!userJson) return config.dev ? 1 : null;

    const telegramUser = JSON.parse(userJson);
    const telegramId = typeof telegramUser.id === 'number' ? telegramUser.id : null;
    if (!telegramId) return config.dev ? 1 : null;

    const [user] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.telegramId, telegramId))
      .limit(1);

    return user?.id ?? null;
  } catch {
    return config.dev ? 1 : null;
  }
}
