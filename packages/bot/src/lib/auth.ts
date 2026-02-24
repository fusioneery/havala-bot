import type { FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import {
  validate,
  parse,
  isSignatureInvalidError,
  isExpiredError,
  isAuthDateInvalidError,
} from '@telegram-apps/init-data-node';
import { db, schema } from '../db';
import { config } from '../config';

export interface AuthResult {
  userId: number;
  telegramId: number;
  isNewUser: boolean;
}

export type AuthError =
  | 'MISSING_INIT_DATA'
  | 'INVALID_SIGNATURE'
  | 'EXPIRED'
  | 'MISSING_USER_DATA'
  | 'INVALID_AUTH_DATE';

/**
 * Validate Telegram initData signature and resolve/create the internal user.
 * Returns AuthResult on success, or an error code on failure.
 *
 * Validation:
 * - Verifies HMAC-SHA256 signature using bot token
 * - Checks auth_date is present and not expired (default 24h)
 * - Creates user in database if not found
 */
export async function authenticateRequest(
  request: FastifyRequest,
): Promise<{ ok: true; data: AuthResult } | { ok: false; error: AuthError }> {
  const initData = request.headers['x-telegram-init-data'];

  if (!initData || typeof initData !== 'string') {
    if (config.dev) {
      return devFallback();
    }
    return { ok: false, error: 'MISSING_INIT_DATA' };
  }

  try {
    validate(initData, config.botToken, { expiresIn: 86400 });
  } catch (err) {
    if (config.dev) {
      request.log.warn({ err }, 'InitData validation failed in dev mode, using fallback');
      return devFallback();
    }

    if (isSignatureInvalidError(err)) {
      return { ok: false, error: 'INVALID_SIGNATURE' };
    }
    if (isExpiredError(err)) {
      return { ok: false, error: 'EXPIRED' };
    }
    if (isAuthDateInvalidError(err)) {
      return { ok: false, error: 'INVALID_AUTH_DATE' };
    }
    return { ok: false, error: 'INVALID_SIGNATURE' };
  }

  const parsed = parse(initData);
  const telegramUser = parsed.user;

  if (!telegramUser || typeof telegramUser.id !== 'number') {
    return { ok: false, error: 'MISSING_USER_DATA' };
  }

  const result = await findOrCreateUser({
    telegramId: telegramUser.id,
    username: (telegramUser.username as string | undefined) ?? null,
    firstName: (telegramUser.firstName as string) ?? telegramUser.id.toString(),
    photoUrl: (telegramUser.photoUrl as string | undefined) ?? null,
  });

  return { ok: true, data: result };
}

/**
 * Simple helper that returns just the userId or null (for backward compatibility).
 * Prefer authenticateRequest() for new code.
 */
export async function resolveUserId(request: FastifyRequest): Promise<number | null> {
  const result = await authenticateRequest(request);
  return result.ok ? result.data.userId : null;
}

interface TelegramUserData {
  telegramId: number;
  username: string | null;
  firstName: string;
  photoUrl: string | null;
}

async function findOrCreateUser(userData: TelegramUserData): Promise<AuthResult> {
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.telegramId, userData.telegramId))
    .limit(1);

  if (existing) {
    await db
      .update(schema.users)
      .set({
        username: userData.username,
        firstName: userData.firstName,
        avatarUrl: userData.photoUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.telegramId, userData.telegramId));

    return { userId: existing.id, telegramId: userData.telegramId, isNewUser: false };
  }

  const [newUser] = await db
    .insert(schema.users)
    .values({
      telegramId: userData.telegramId,
      username: userData.username,
      firstName: userData.firstName,
      avatarUrl: userData.photoUrl,
    })
    .returning({ id: schema.users.id });

  return { userId: newUser.id, telegramId: userData.telegramId, isNewUser: true };
}

async function devFallback(): Promise<{ ok: true; data: AuthResult }> {
  const [user] = await db
    .select({ id: schema.users.id, telegramId: schema.users.telegramId })
    .from(schema.users)
    .limit(1);

  if (user) {
    return { ok: true, data: { userId: user.id, telegramId: user.telegramId, isNewUser: false } };
  }

  const [newUser] = await db
    .insert(schema.users)
    .values({
      telegramId: 1,
      firstName: 'Dev User',
    })
    .returning({ id: schema.users.id });

  return { ok: true, data: { userId: newUser.id, telegramId: 1, isNewUser: true } };
}
