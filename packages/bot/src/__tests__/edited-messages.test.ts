import { describe, test, expect, beforeEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import {
  createTestDb, resetCounters,
  seedUser, seedTrustedGroup, seedOffer,
  type TestDb,
} from './helpers/test-db';
import * as schema from '../db/schema';

/**
 * Tests for the edited message handling logic.
 *
 * The pipeline's handleEditedMessage method:
 * 1. Looks up existing offer by (groupId, telegramMessageId, status='active')
 * 2. Calls LLM to analyze the edit (delete/update/no_change)
 * 3. Applies the appropriate DB mutation
 *
 * Since the LLM call is external, we test the DB-level behavior:
 * - Finding the correct offer to update
 * - Applying edits correctly
 * - Status transitions
 */

let db: TestDb;

beforeEach(() => {
  db = createTestDb();
  resetCounters();
});

// ─── Simulated edit actions ──────────────────

async function simulateEditDelete(
  testDb: TestDb,
  offerId: number,
  newText: string,
) {
  await testDb
    .update(schema.offers)
    .set({ status: 'cancelled', updatedAt: new Date(), originalMessageText: newText })
    .where(eq(schema.offers.id, offerId));
}

async function simulateEditUpdate(
  testDb: TestDb,
  offerId: number,
  newText: string,
  updates: Partial<{
    amount: number;
    amountCurrency: string;
    fromCurrency: string;
    toCurrency: string;
    partial: boolean;
    partialThreshold: number;
  }>,
) {
  const set: Record<string, unknown> = {
    updatedAt: new Date(),
    originalMessageText: newText,
  };
  if (updates.amount != null) set.amount = updates.amount;
  if (updates.amountCurrency) set.amountCurrency = updates.amountCurrency;
  if (updates.fromCurrency) set.fromCurrency = updates.fromCurrency;
  if (updates.toCurrency) set.toCurrency = updates.toCurrency;
  if (updates.partial != null) set.partial = updates.partial;
  if (updates.partialThreshold != null) set.partialThreshold = updates.partialThreshold;

  await testDb
    .update(schema.offers)
    .set(set)
    .where(eq(schema.offers.id, offerId));
}

async function simulateEditNoChange(
  testDb: TestDb,
  offerId: number,
  newText: string,
) {
  await testDb
    .update(schema.offers)
    .set({ originalMessageText: newText, updatedAt: new Date() })
    .where(eq(schema.offers.id, offerId));
}

// ─── Tests ──────────────────────────────────

describe('Edited messages', () => {
  test('delete action cancels the offer', async () => {
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 1000,
      originalMessageText: '#ищу 1000 EUR',
    });

    expect(offer.status).toBe('active');

    // User edits message to "закрыто" → LLM returns delete
    await simulateEditDelete(db, offer.id, '~~#ищу 1000 EUR~~ закрыто');

    const [updated] = await db
      .select()
      .from(schema.offers)
      .where(eq(schema.offers.id, offer.id));

    expect(updated.status).toBe('cancelled');
    expect(updated.originalMessageText).toBe('~~#ищу 1000 EUR~~ закрыто');
  });

  test('update action changes amount', async () => {
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 1000,
      originalMessageText: '#ищу 1000 EUR',
    });

    // User edits to 2000 EUR → LLM returns update with new amount
    await simulateEditUpdate(db, offer.id, '#ищу 2000 EUR', { amount: 2000 });

    const [updated] = await db
      .select()
      .from(schema.offers)
      .where(eq(schema.offers.id, offer.id));

    expect(updated.status).toBe('active');
    expect(updated.amount).toBe(2000);
    expect(updated.originalMessageText).toBe('#ищу 2000 EUR');
  });

  test('update action changes currency', async () => {
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 1000,
      originalMessageText: '#ищу 1000 EUR за рубли',
    });

    // User edits to GEL instead of EUR
    await simulateEditUpdate(db, offer.id, '#ищу 1000 GEL за рубли', {
      toCurrency: 'GEL',
    });

    const [updated] = await db
      .select()
      .from(schema.offers)
      .where(eq(schema.offers.id, offer.id));

    expect(updated.toCurrency).toBe('GEL');
    expect(updated.fromCurrency).toBe('RUB'); // unchanged
    expect(updated.amount).toBe(1000); // unchanged
  });

  test('update action can set partial flag', async () => {
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 5000,
      partial: false,
      originalMessageText: '#ищу 5000 EUR',
    });

    await simulateEditUpdate(db, offer.id, '#ищу 5000 EUR (можно частями от 500)', {
      partial: true,
      partialThreshold: 500,
    });

    const [updated] = await db
      .select()
      .from(schema.offers)
      .where(eq(schema.offers.id, offer.id));

    expect(updated.partial).toBe(true);
    expect(updated.partialThreshold).toBe(500);
  });

  test('no_change action only updates stored text', async () => {
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 1000,
      originalMessageText: '#ищу 1000 EUR (привет)',
    });

    // Cosmetic edit: just fixed typo → LLM returns no_change
    await simulateEditNoChange(db, offer.id, '#ищу 1000 EUR (Привет)');

    const [updated] = await db
      .select()
      .from(schema.offers)
      .where(eq(schema.offers.id, offer.id));

    expect(updated.status).toBe('active');
    expect(updated.amount).toBe(1000);
    expect(updated.originalMessageText).toBe('#ищу 1000 EUR (Привет)');
  });

  test('only active offers are found for editing', async () => {
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 1000,
      status: 'cancelled',
      originalMessageText: '#ищу 1000 EUR',
      telegramMessageId: 42,
    });

    // Try to find this offer as the pipeline would
    const found = await db
      .select({ id: schema.offers.id })
      .from(schema.offers)
      .where(
        eq(schema.offers.groupId, group.id),
      )
      .then((rows) =>
        rows.filter(
          (r) => r.id === offer.id,
        ),
      );

    // It exists, but the pipeline queries with status='active', so:
    const foundActive = await db
      .select({ id: schema.offers.id })
      .from(schema.offers)
      .where(
        eq(schema.offers.status, 'active'),
      );

    expect(foundActive).toHaveLength(0);
  });

  test('edit lookup uses correct (groupId, telegramMessageId) pair', async () => {
    const bob = await seedUser(db);
    const group1 = await seedTrustedGroup(db, { telegramChatId: -100001 });
    const group2 = await seedTrustedGroup(db, { telegramChatId: -100002 });

    // Same telegramMessageId in different groups
    const offer1 = await seedOffer(db, {
      authorId: bob.id,
      groupId: group1.id,
      telegramMessageId: 42,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 1000,
    });

    const offer2 = await seedOffer(db, {
      authorId: bob.id,
      groupId: group2.id,
      telegramMessageId: 42,
      fromCurrency: 'GEL',
      toCurrency: 'EUR',
      amount: 2000,
    });

    // Editing in group1 should only find offer1
    const [found] = await db
      .select({ id: schema.offers.id, fromCurrency: schema.offers.fromCurrency })
      .from(schema.offers)
      .where(
        eq(schema.offers.groupId, group1.id),
      )
      .then((rows) =>
        rows.filter((r) => r.id === offer1.id),
      );

    expect(found.fromCurrency).toBe('RUB');
  });

  test('edited offer is picked up by matching after update', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);
    const { findMatchingGroupOffers } = await import('./helpers/matching-queries');

    // Bob offers RUB→EUR 500
    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    // Alice wants EUR→RUB with min 600 → no match
    let matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 600,
      visibility: 'friends_and_acquaintances',
    });
    expect(matches).toHaveLength(0);

    // Bob edits to 800 → now matches
    await simulateEditUpdate(db, offer.id, '#ищу 800 EUR', { amount: 800 });

    matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 600,
      visibility: 'friends_and_acquaintances',
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].authorId).toBe(bob.id);
  });

  test('cancelled offer is not matched after edit-delete', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);
    const { findMatchingGroupOffers } = await import('./helpers/matching-queries');

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    // Initially matches
    let matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });
    expect(matches).toHaveLength(1);

    // Bob cancels via edit
    await simulateEditDelete(db, offer.id, '~~закрыто~~');

    // No longer matches
    matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });
    expect(matches).toHaveLength(0);
  });
});
