import { eq } from 'drizzle-orm';
import { db, schema } from '../db';

const blacklistCache = new Set<number>();
let cacheInitialized = false;

export async function initBlacklistCache(): Promise<void> {
  const rows = await db.select({ telegramId: schema.blacklist.telegramId }).from(schema.blacklist);
  blacklistCache.clear();
  for (const row of rows) {
    blacklistCache.add(row.telegramId);
  }
  cacheInitialized = true;
  console.log(`[Blacklist] Loaded ${blacklistCache.size} banned user(s)`);
}

export function isBlacklisted(telegramId: number): boolean {
  if (!cacheInitialized) {
    console.warn('[Blacklist] Cache not initialized, allowing request');
    return false;
  }
  return blacklistCache.has(telegramId);
}

export async function addToBlacklist(telegramId: number, reason?: string): Promise<void> {
  await db.insert(schema.blacklist).values({ telegramId, reason }).onConflictDoNothing();
  blacklistCache.add(telegramId);
}

export async function removeFromBlacklist(telegramId: number): Promise<void> {
  await db.delete(schema.blacklist).where(eq(schema.blacklist.telegramId, telegramId));
  blacklistCache.delete(telegramId);
}
