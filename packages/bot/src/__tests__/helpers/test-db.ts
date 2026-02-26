import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { resolve } from 'path';
import * as schema from '../../db/schema';

export type TestDb = BunSQLiteDatabase<typeof schema>;

export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:');
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('PRAGMA foreign_keys = ON;');

  const testDb = drizzle(sqlite, { schema });
  const migrationsFolder = resolve(import.meta.dir, '../../../drizzle');
  migrate(testDb, { migrationsFolder });

  return testDb;
}

// ─── Seed helpers ──────────────────────────────

let userCounter = 0;
let groupCounter = 0;

export function resetCounters() {
  userCounter = 0;
  groupCounter = 0;
}

export async function seedUser(
  db: TestDb,
  overrides: Partial<typeof schema.users.$inferInsert> = {},
) {
  userCounter++;
  const [user] = await db
    .insert(schema.users)
    .values({
      telegramId: overrides.telegramId ?? 100000 + userCounter,
      firstName: overrides.firstName ?? `User${userCounter}`,
      username: overrides.username ?? `user${userCounter}`,
      ...overrides,
    })
    .returning();
  return user;
}

export async function seedTrustedGroup(
  db: TestDb,
  overrides: Partial<typeof schema.trustedGroups.$inferInsert> = {},
) {
  groupCounter++;
  const [group] = await db
    .insert(schema.trustedGroups)
    .values({
      telegramChatId: overrides.telegramChatId ?? -(1000000 + groupCounter),
      name: overrides.name ?? `Group${groupCounter}`,
      addedFromConfig: overrides.addedFromConfig ?? true,
      ...overrides,
    })
    .returning();
  return group;
}

export async function seedOffer(
  db: TestDb,
  overrides: Partial<typeof schema.offers.$inferInsert> & {
    authorId: number;
    groupId: number;
  },
) {
  const [offer] = await db
    .insert(schema.offers)
    .values({
      telegramMessageId: overrides.telegramMessageId ?? Math.floor(Math.random() * 1_000_000),
      fromCurrency: overrides.fromCurrency ?? 'RUB',
      toCurrency: overrides.toCurrency ?? 'EUR',
      amount: overrides.amount ?? 1000,
      amountCurrency: overrides.amountCurrency ?? null,
      paymentMethods: overrides.paymentMethods ?? JSON.stringify({ take: [], give: [] }),
      partial: overrides.partial ?? false,
      partialThreshold: overrides.partialThreshold ?? 0,
      status: overrides.status ?? 'active',
      isLlmParsed: overrides.isLlmParsed ?? true,
      originalMessageText: overrides.originalMessageText ?? 'test offer',
      ...overrides,
    })
    .returning();
  return offer;
}

export async function seedUserOffer(
  db: TestDb,
  overrides: Partial<typeof schema.userOffers.$inferInsert> & {
    userId: number;
  },
) {
  const [userOffer] = await db
    .insert(schema.userOffers)
    .values({
      fromCurrency: overrides.fromCurrency ?? 'EUR',
      toCurrency: overrides.toCurrency ?? 'RUB',
      amount: overrides.amount ?? 1000,
      minSplitAmount: overrides.minSplitAmount ?? 0,
      paymentMethods: overrides.paymentMethods ?? JSON.stringify({ take: [], give: [] }),
      visibility: overrides.visibility ?? 'friends_and_acquaintances',
      status: overrides.status ?? 'active',
      notifyOnMatch: overrides.notifyOnMatch ?? true,
      ...overrides,
    })
    .returning();
  return userOffer;
}

export async function seedTrustRelation(
  db: TestDb,
  userId: number,
  targetUserId: number,
  type: 'friend' | 'acquaintance' = 'friend',
) {
  const [relation] = await db
    .insert(schema.trustRelations)
    .values({ userId, targetUserId, type })
    .returning();
  return relation;
}

export async function seedMatch(
  db: TestDb,
  userOfferId: number,
  matchedOfferId: number,
  status: 'pending' | 'accepted' | 'error_flagged' = 'pending',
) {
  const [match] = await db
    .insert(schema.matches)
    .values({ userOfferId, matchedOfferId, status })
    .returning();
  return match;
}
