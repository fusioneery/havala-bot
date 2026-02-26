import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createTestDb, resetCounters,
  seedUser, seedTrustedGroup, seedOffer, seedUserOffer,
  seedTrustRelation, seedMatch,
  type TestDb,
} from './helpers/test-db';
import { findMatchingUserOffers, findMatchingGroupOffers } from './helpers/matching-queries';

let db: TestDb;

beforeEach(() => {
  db = createTestDb();
  resetCounters();
});

// ═══════════════════════════════════════════════
//  Direction A: group offer appears → find userOffers
//  (Pipeline path: createMatchesAndNotify)
// ═══════════════════════════════════════════════

describe('Direction A: group offer → matching userOffers', () => {
  test('basic match: userOffer exists, then group offer arrives', async () => {
    const alice = await seedUser(db, { firstName: 'Alice' });
    const bob = await seedUser(db, { firstName: 'Bob' });
    const group = await seedTrustedGroup(db);

    // Alice wants EUR, has RUB (userOffer.from=EUR, userOffer.to=RUB)
    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
    });

    // Bob posts in group: has EUR, wants RUB (offer.from=RUB, offer.to=EUR)
    // Wait - currencies are reversed.
    // offer.from = what the author GIVES = RUB
    // offer.to = what the author WANTS = EUR
    // This does NOT match Alice (who wants EUR and has RUB) because:
    //   matching requires userOffer.from == offer.to AND userOffer.to == offer.from
    //   Alice: from=EUR, to=RUB
    //   Bob offer: from=RUB, to=EUR
    //   Check: EUR == EUR ✓, RUB == RUB ✓
    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].userId).toBe(alice.id);
  });

  test('no match when currencies do not align', async () => {
    const alice = await seedUser(db, { firstName: 'Alice' });
    const bob = await seedUser(db, { firstName: 'Bob' });
    const group = await seedTrustedGroup(db);

    // Alice wants USD→RUB
    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'USD',
      toCurrency: 'RUB',
      amount: 1000,
    });

    // Bob offers EUR→RUB (wrong pair for Alice)
    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matches).toHaveLength(0);
  });

  test('self-match is prevented', async () => {
    const alice = await seedUser(db, { firstName: 'Alice' });
    const group = await seedTrustedGroup(db);

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
    });

    const offer = await seedOffer(db, {
      authorId: alice.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: alice.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matches).toHaveLength(0);
  });

  test('only matches active userOffers', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      status: 'cancelled',
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matches).toHaveLength(0);
  });

  test('only matches userOffers with notifyOnMatch=true', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      notifyOnMatch: false,
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matches).toHaveLength(0);
  });

  test('duplicate match is prevented', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    const userOffer = await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    // Pre-existing match
    await seedMatch(db, userOffer.id, offer.id);

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matches).toHaveLength(0);
  });

  // ─── Amount checks ───────────────────────────

  test('rejects when offer amount < userOffer minSplitAmount', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 5000,
      minSplitAmount: 1000,
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500, // less than min 1000
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matches).toHaveLength(0);
  });

  test('rejects when offer amount > userOffer amount and offer is not partial', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 500,
      minSplitAmount: 0,
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 1000, // more than Alice's 500
      partial: false,
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 1000,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matches).toHaveLength(0);
  });

  test('allows when offer amount > userOffer amount but offer is partial', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 500,
      minSplitAmount: 0,
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 1000,
      partial: true,
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 1000,
      partial: true,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matches).toHaveLength(1);
  });

  // ─── Amount conversion with different currencies ─────

  test('converts offer amount via rate when amountCurrency differs', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    // Alice wants EUR, has RUB, min 100 EUR
    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 100,
    });

    // Bob's offer: has 50000 RUB, wants EUR. amountCurrency=RUB
    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 50000,
      amountCurrency: 'RUB',
    });

    // Rate: 1 RUB = 0.01 EUR → 50000 RUB = 500 EUR
    const mockRate = (from: string, to: string) => {
      if (from === 'RUB' && to === 'EUR') return 0.01;
      return null;
    };

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 50000,
      amountCurrency: 'RUB',
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    }, { getRate: mockRate });

    expect(matches).toHaveLength(1);
  });

  test('skips when rate is unavailable for amount conversion', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 50000,
      amountCurrency: 'RUB',
    });

    // No rate available
    const noRate = () => null;

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 50000,
      amountCurrency: 'RUB',
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    }, { getRate: noRate });

    expect(matches).toHaveLength(0);
  });

  // ─── Payment method filtering ────────────────

  test('matches when payment methods are compatible', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    // Alice wants to receive RUB via russian_banks, give EUR via swift
    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      paymentMethods: JSON.stringify({
        take: [{ currency: 'RUB', methods: ['russian_banks'] }],
        give: [{ currency: 'EUR', methods: ['swift'] }],
      }),
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      paymentMethods: JSON.stringify({
        take: [{ currency: 'EUR', methods: ['swift'] }],
        give: [{ currency: 'RUB', methods: ['russian_banks'] }],
      }),
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      // offer gives RUB via russian_banks, takes EUR via swift
      givePaymentMethods: [{ currency: 'RUB', methods: ['russian_banks'] }],
      takePaymentMethods: [{ currency: 'EUR', methods: ['swift'] }],
    });

    expect(matches).toHaveLength(1);
  });

  test('rejects when payment methods are incompatible on one side', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    // Alice only accepts RUB via crypto (unusual but valid)
    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      paymentMethods: JSON.stringify({
        take: [{ currency: 'RUB', methods: ['crypto'] }],
        give: [{ currency: 'EUR', methods: ['swift'] }],
      }),
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      // offer gives RUB via russian_banks (Alice wants crypto)
      givePaymentMethods: [{ currency: 'RUB', methods: ['russian_banks'] }],
      takePaymentMethods: [{ currency: 'EUR', methods: ['swift'] }],
    });

    expect(matches).toHaveLength(0);
  });

  test('matches when userOffer has no payment method restrictions', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    // Alice has no payment method preferences
    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      paymentMethods: JSON.stringify({ take: [], give: [] }),
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [{ currency: 'RUB', methods: ['russian_banks'] }],
      takePaymentMethods: [{ currency: 'EUR', methods: ['swift'] }],
    });

    expect(matches).toHaveLength(1);
  });

  // ─── Visibility / trust ──────────────────────

  test('friends_only: matches when author is a friend', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedTrustRelation(db, alice.id, bob.id, 'friend');

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      visibility: 'friends_only',
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matches).toHaveLength(1);
  });

  test('friends_only: rejects acquaintance', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedTrustRelation(db, alice.id, bob.id, 'acquaintance');

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      visibility: 'friends_only',
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matches).toHaveLength(0);
  });

  test('friends_only: rejects stranger', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    // No trust relation
    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      visibility: 'friends_only',
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matches).toHaveLength(0);
  });

  test('friends_and_acquaintances: matches stranger', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      visibility: 'friends_and_acquaintances',
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matches).toHaveLength(1);
  });

  // ─── Multiple candidates ────────────────────

  test('finds multiple matching userOffers', async () => {
    const alice = await seedUser(db);
    const carol = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
    });

    await seedUserOffer(db, {
      userId: carol.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 2000,
    });

    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matches).toHaveLength(2);
    const matchedUserIds = matches.map((m) => m.userId).sort();
    expect(matchedUserIds).toEqual([alice.id, carol.id].sort());
  });
});

// ═══════════════════════════════════════════════
//  Direction B: userOffer appears → find group offers
//  (API path: POST /search)
// ═══════════════════════════════════════════════

describe('Direction B: userOffer → matching group offers', () => {
  test('basic match: group offer exists, then userOffer is created', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    // Bob already posted: gives RUB, wants EUR
    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    // Alice creates userOffer: wants EUR (has RUB)
    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].authorId).toBe(bob.id);
  });

  test('no match when currencies do not align', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    // Bob offers RUB→GEL
    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'GEL',
      amount: 500,
    });

    // Alice wants EUR→RUB
    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });

    expect(matches).toHaveLength(0);
  });

  test('self-match is prevented', async () => {
    const alice = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedOffer(db, {
      authorId: alice.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });

    expect(matches).toHaveLength(0);
  });

  test('only matches active group offers', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      status: 'cancelled',
    });

    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });

    expect(matches).toHaveLength(0);
  });

  // ─── Amount checks ───────────────────────────

  test('rejects when offer amount < minSplitAmount', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 50, // too small
    });

    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 100,
      visibility: 'friends_and_acquaintances',
    });

    expect(matches).toHaveLength(0);
  });

  test('rejects when offer amount > userOffer amount and not partial', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 2000,
      partial: false,
    });

    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 500, // alice only wants 500 but offer is 2000 non-partial
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });

    expect(matches).toHaveLength(0);
  });

  test('allows when offer amount > userOffer amount but offer is partial', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 2000,
      partial: true,
    });

    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 500,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });

    expect(matches).toHaveLength(1);
  });

  // ─── Amount conversion ──────────────────────

  test('converts offer amount when amountCurrency differs from userOffer.fromCurrency', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    // Bob offers 100000 RUB (amountCurrency=RUB), wants EUR
    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 100000,
      amountCurrency: 'RUB',
    });

    // Alice wants EUR→RUB, amount 2000 EUR, min 500 EUR
    // 100000 RUB at rate 0.01 = 1000 EUR (within Alice's range)
    const mockRate = (from: string, to: string) => {
      if (from === 'RUB' && to === 'EUR') return 0.01;
      return null;
    };

    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 2000,
      minSplitAmount: 500,
      visibility: 'friends_and_acquaintances',
    }, { getRate: mockRate });

    expect(matches).toHaveLength(1);
  });

  // ─── Trust-based sorting ─────────────────────

  test('sorts results: friends first, then acquaintances, then others', async () => {
    const alice = await seedUser(db);
    const friendBob = await seedUser(db, { firstName: 'Bob' });
    const acquaintanceCarol = await seedUser(db, { firstName: 'Carol' });
    const strangerDave = await seedUser(db, { firstName: 'Dave' });
    const group = await seedTrustedGroup(db);

    await seedTrustRelation(db, alice.id, friendBob.id, 'friend');
    await seedTrustRelation(db, alice.id, acquaintanceCarol.id, 'acquaintance');

    // All three have matching offers
    await seedOffer(db, { authorId: strangerDave.id, groupId: group.id, fromCurrency: 'RUB', toCurrency: 'EUR', amount: 500 });
    await seedOffer(db, { authorId: acquaintanceCarol.id, groupId: group.id, fromCurrency: 'RUB', toCurrency: 'EUR', amount: 500 });
    await seedOffer(db, { authorId: friendBob.id, groupId: group.id, fromCurrency: 'RUB', toCurrency: 'EUR', amount: 500 });

    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });

    expect(matches).toHaveLength(3);
    expect(matches[0].trustType).toBe('friend');
    expect(matches[0].authorId).toBe(friendBob.id);
    expect(matches[1].trustType).toBe('acquaintance');
    expect(matches[1].authorId).toBe(acquaintanceCarol.id);
    expect(matches[2].trustType).toBeNull();
    expect(matches[2].authorId).toBe(strangerDave.id);
  });

  test('friends_only: filters out non-friends', async () => {
    const alice = await seedUser(db);
    const friendBob = await seedUser(db);
    const acquaintanceCarol = await seedUser(db);
    const strangerDave = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedTrustRelation(db, alice.id, friendBob.id, 'friend');
    await seedTrustRelation(db, alice.id, acquaintanceCarol.id, 'acquaintance');

    await seedOffer(db, { authorId: friendBob.id, groupId: group.id, fromCurrency: 'RUB', toCurrency: 'EUR', amount: 500 });
    await seedOffer(db, { authorId: acquaintanceCarol.id, groupId: group.id, fromCurrency: 'RUB', toCurrency: 'EUR', amount: 500 });
    await seedOffer(db, { authorId: strangerDave.id, groupId: group.id, fromCurrency: 'RUB', toCurrency: 'EUR', amount: 500 });

    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
      visibility: 'friends_only',
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].authorId).toBe(friendBob.id);
  });

  test('limits results to 5', async () => {
    const alice = await seedUser(db);
    const group = await seedTrustedGroup(db);

    // Create 7 users with matching offers
    for (let i = 0; i < 7; i++) {
      const user = await seedUser(db);
      await seedOffer(db, {
        authorId: user.id,
        groupId: group.id,
        fromCurrency: 'RUB',
        toCurrency: 'EUR',
        amount: 500,
      });
    }

    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });

    expect(matches).toHaveLength(5);
  });

  // ─── Payment methods in Direction B ──────────

  test('filters by payment method compatibility', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const carol = await seedUser(db);
    const group = await seedTrustedGroup(db);

    // Bob takes EUR via swift
    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      paymentMethods: JSON.stringify({
        take: [{ currency: 'EUR', methods: ['swift'] }],
        give: [{ currency: 'RUB', methods: ['russian_banks'] }],
      }),
    });

    // Carol takes EUR via crypto only
    await seedOffer(db, {
      authorId: carol.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      paymentMethods: JSON.stringify({
        take: [{ currency: 'EUR', methods: ['crypto'] }],
        give: [{ currency: 'RUB', methods: ['russian_banks'] }],
      }),
    });

    // Alice gives EUR via swift only → should match Bob but not Carol
    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
      givePaymentMethods: [{ currency: 'EUR', methods: ['swift'] }],
      takePaymentMethods: [{ currency: 'RUB', methods: ['russian_banks'] }],
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].authorId).toBe(bob.id);
  });
});

// ═══════════════════════════════════════════════
//  Cross-currency matching scenarios
// ═══════════════════════════════════════════════

describe('Cross-currency matching', () => {
  test('RUB ↔ EUR: standard CIS→Europe exchange', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
    });

    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });

    expect(matches).toHaveLength(1);
  });

  test('USDT ↔ RUB: crypto↔fiat exchange', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'USDT',
      toCurrency: 'RUB',
      amount: 5000,
      paymentMethods: JSON.stringify({
        take: [{ currency: 'RUB', methods: ['russian_banks'] }],
        give: [{ currency: 'USDT', methods: ['crypto'] }],
      }),
    });

    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'USDT',
      amount: 3000,
      paymentMethods: JSON.stringify({
        take: [{ currency: 'USDT', methods: ['crypto'] }],
        give: [{ currency: 'RUB', methods: ['russian_banks'] }],
      }),
    });

    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'USDT',
      toCurrency: 'RUB',
      amount: 5000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
      givePaymentMethods: [{ currency: 'USDT', methods: ['crypto'] }],
      takePaymentMethods: [{ currency: 'RUB', methods: ['russian_banks'] }],
    });

    expect(matches).toHaveLength(1);
  });

  test('GEL ↔ RUB: CIS regional exchange', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'GEL',
      toCurrency: 'RUB',
      amount: 2000,
      paymentMethods: JSON.stringify({
        take: [{ currency: 'RUB', methods: ['russian_banks'] }],
        give: [{ currency: 'GEL', methods: ['local_banks'] }],
      }),
    });

    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'GEL',
      amount: 1000,
      paymentMethods: JSON.stringify({
        take: [{ currency: 'GEL', methods: ['local_banks'] }],
        give: [{ currency: 'RUB', methods: ['russian_banks'] }],
      }),
    });

    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'GEL',
      toCurrency: 'RUB',
      amount: 2000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
      givePaymentMethods: [{ currency: 'GEL', methods: ['local_banks'] }],
      takePaymentMethods: [{ currency: 'RUB', methods: ['russian_banks'] }],
    });

    expect(matches).toHaveLength(1);
  });

  test('EUR ↔ USDT: fiat↔stablecoin exchange', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'USDT',
      amount: 2000,
    });

    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'USDT',
      toCurrency: 'EUR',
      amount: 1000,
    });

    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'USDT',
      amount: 2000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });

    expect(matches).toHaveLength(1);
  });

  test('AMD ↔ EUR: Armenian dram↔Euro via local banks', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'AMD',
      toCurrency: 'EUR',
      amount: 500000,
      paymentMethods: JSON.stringify({
        take: [{ currency: 'EUR', methods: ['swift'] }],
        give: [{ currency: 'AMD', methods: ['local_banks'] }],
      }),
    });

    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'EUR',
      toCurrency: 'AMD',
      amount: 1000,
      paymentMethods: JSON.stringify({
        take: [{ currency: 'AMD', methods: ['local_banks'] }],
        give: [{ currency: 'EUR', methods: ['swift'] }],
      }),
    });

    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'AMD',
      toCurrency: 'EUR',
      amount: 500000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
      givePaymentMethods: [{ currency: 'AMD', methods: ['local_banks'] }],
      takePaymentMethods: [{ currency: 'EUR', methods: ['swift'] }],
    });

    expect(matches).toHaveLength(1);
  });

  test('does not match wrong currency pair even when amounts align', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    // Alice wants EUR→RUB
    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
    });

    // Bob offers GEL→EUR (wrong! Alice would need RUB→EUR)
    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'GEL',
      toCurrency: 'EUR',
      amount: 500,
    });

    const matches = await findMatchingGroupOffers(db, {
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

// ═══════════════════════════════════════════════
//  Bidirectional matching (both directions hit)
// ═══════════════════════════════════════════════

describe('Bidirectional matching consistency', () => {
  test('if A matches B in Direction A, then B matches A in Direction B', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    // Alice: userOffer, wants EUR, has RUB
    const userOffer = await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
    });

    // Bob: group offer, gives RUB, wants EUR
    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    // Direction A: Bob's offer finds Alice's userOffer
    const dirA = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    // Direction B: Alice's userOffer finds Bob's offer
    const dirB = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });

    expect(dirA).toHaveLength(1);
    expect(dirA[0].userId).toBe(alice.id);
    expect(dirB).toHaveLength(1);
    expect(dirB[0].authorId).toBe(bob.id);
  });

  test('timing: userOffer first, then group offer arrives and matches', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    // Step 1: Alice creates userOffer (no group offers yet)
    await seedUserOffer(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
    });

    const matchesBefore = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });
    expect(matchesBefore).toHaveLength(0);

    // Step 2: Bob's group offer arrives later
    const offer = await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    // Pipeline runs direction A matching
    const matchesAfter = await findMatchingUserOffers(db, {
      id: offer.id,
      authorId: bob.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
      partial: false,
      partialThreshold: 0,
      givePaymentMethods: [],
      takePaymentMethods: [],
    });

    expect(matchesAfter).toHaveLength(1);
    expect(matchesAfter[0].userId).toBe(alice.id);
  });

  test('timing: group offer first, then userOffer is created and matches', async () => {
    const alice = await seedUser(db);
    const bob = await seedUser(db);
    const group = await seedTrustedGroup(db);

    // Step 1: Bob's group offer already exists
    await seedOffer(db, {
      authorId: bob.id,
      groupId: group.id,
      fromCurrency: 'RUB',
      toCurrency: 'EUR',
      amount: 500,
    });

    // Step 2: Alice creates userOffer → API runs direction B matching
    const matches = await findMatchingGroupOffers(db, {
      userId: alice.id,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 1000,
      minSplitAmount: 0,
      visibility: 'friends_and_acquaintances',
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].authorId).toBe(bob.id);
  });
});
