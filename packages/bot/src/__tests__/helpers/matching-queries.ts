/**
 * Extracted matching queries from the pipeline and routes.
 * These replicate the exact DB queries and filtering logic used in production,
 * allowing us to test the matching algorithm against a test DB.
 */
import { and, eq, ne } from 'drizzle-orm';
import { hasPaymentMethodOverlap, type ParsedPaymentMethodGroup } from '@hawala/shared';
import * as schema from '../../db/schema';
import type { TestDb } from './test-db';

// ─── Direction A: group offer → find matching userOffers ──────

export interface DirectionAResult {
  userOfferId: number;
  userId: number;
  userTelegramId: number;
}

/**
 * Replicates `createMatchesAndNotify` from group-message-pipeline.ts.
 * Given a persisted group offer, finds all matching active userOffers.
 */
export async function findMatchingUserOffers(
  db: TestDb,
  offer: {
    id: number;
    authorId: number;
    fromCurrency: string;
    toCurrency: string;
    amount: number;
    amountCurrency?: string | null;
    partial: boolean;
    partialThreshold: number;
    givePaymentMethods: ParsedPaymentMethodGroup[];
    takePaymentMethods: ParsedPaymentMethodGroup[];
  },
  opts: {
    getRate?: (from: string, to: string) => number | null;
    skipSelfMatch?: boolean;
  } = {},
): Promise<DirectionAResult[]> {
  const getRate = opts.getRate ?? (() => 1);
  const skipSelfMatch = opts.skipSelfMatch ?? true;

  const candidates = await db
    .select({
      userOfferId: schema.userOffers.id,
      userId: schema.userOffers.userId,
      userTelegramId: schema.users.telegramId,
      visibility: schema.userOffers.visibility,
      amount: schema.userOffers.amount,
      fromCurrency: schema.userOffers.fromCurrency,
      minSplitAmount: schema.userOffers.minSplitAmount,
      paymentMethods: schema.userOffers.paymentMethods,
    })
    .from(schema.userOffers)
    .innerJoin(schema.users, eq(schema.userOffers.userId, schema.users.id))
    .where(
      and(
        eq(schema.userOffers.status, 'active'),
        eq(schema.userOffers.notifyOnMatch, true),
        eq(schema.userOffers.fromCurrency, offer.toCurrency),
        eq(schema.userOffers.toCurrency, offer.fromCurrency),
        ...(skipSelfMatch ? [ne(schema.userOffers.userId, offer.authorId)] : []),
      ),
    );

  const results: DirectionAResult[] = [];

  for (const candidate of candidates) {
    // Amount conversion
    const offerAmountCurrency = offer.amountCurrency ?? offer.fromCurrency;
    let offerAmountConverted = offer.amount;
    if (offerAmountCurrency !== candidate.fromCurrency) {
      const rate = getRate(offerAmountCurrency, candidate.fromCurrency);
      if (!rate) continue;
      offerAmountConverted = offer.amount * rate;
    }

    // Min split check
    if (offerAmountConverted < candidate.minSplitAmount) continue;

    // Max amount check
    if (offerAmountConverted > candidate.amount && !offer.partial) continue;

    // Payment method compatibility
    const userPM = JSON.parse(candidate.paymentMethods) as {
      take: ParsedPaymentMethodGroup[];
      give: ParsedPaymentMethodGroup[];
    };
    if (userPM.take.length || userPM.give.length) {
      const fromSideOk = hasPaymentMethodOverlap(
        offer.givePaymentMethods, userPM.take, offer.fromCurrency,
      );
      const toSideOk = hasPaymentMethodOverlap(
        offer.takePaymentMethods, userPM.give, offer.toCurrency,
      );
      if (!fromSideOk || !toSideOk) continue;
    }

    // Visibility check
    const isVisible = await checkVisibility(
      db, candidate.userId, offer.authorId, candidate.visibility as 'friends_only' | 'friends_and_acquaintances',
    );
    if (!isVisible) continue;

    // Duplicate match check
    const [existingMatch] = await db
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(
        and(
          eq(schema.matches.userOfferId, candidate.userOfferId),
          eq(schema.matches.matchedOfferId, offer.id),
        ),
      )
      .limit(1);
    if (existingMatch) continue;

    results.push({
      userOfferId: candidate.userOfferId,
      userId: candidate.userId,
      userTelegramId: candidate.userTelegramId,
    });
  }

  return results;
}

// ─── Direction B: userOffer → find matching group offers ──────

export interface DirectionBResult {
  offerId: number;
  authorId: number;
  trustType: 'friend' | 'acquaintance' | null;
  reputation: number;
}

/**
 * Replicates the matching logic from POST /search in offers.ts.
 * Given a new userOffer, finds matching active group offers.
 */
export async function findMatchingGroupOffers(
  db: TestDb,
  userOffer: {
    userId: number;
    fromCurrency: string;
    toCurrency: string;
    amount: number;
    minSplitAmount: number;
    visibility: 'friends_only' | 'friends_and_acquaintances';
    givePaymentMethods?: ParsedPaymentMethodGroup[];
    takePaymentMethods?: ParsedPaymentMethodGroup[];
  },
  opts: {
    getRate?: (from: string, to: string) => number | null;
    skipSelfMatch?: boolean;
    limit?: number;
  } = {},
): Promise<DirectionBResult[]> {
  const getRate = opts.getRate ?? (() => 1);
  const skipSelfMatch = opts.skipSelfMatch ?? true;
  const limit = opts.limit ?? 5;

  const candidateOffers = await db
    .select({
      offer: schema.offers,
      author: schema.users,
      group: schema.trustedGroups,
    })
    .from(schema.offers)
    .innerJoin(schema.users, eq(schema.offers.authorId, schema.users.id))
    .innerJoin(schema.trustedGroups, eq(schema.offers.groupId, schema.trustedGroups.id))
    .where(
      and(
        eq(schema.offers.status, 'active'),
        eq(schema.offers.fromCurrency, userOffer.toCurrency),
        eq(schema.offers.toCurrency, userOffer.fromCurrency),
        ...(skipSelfMatch ? [ne(schema.offers.authorId, userOffer.userId)] : []),
      ),
    );

  const results: (DirectionBResult & { _sortPriority: number })[] = [];

  for (const row of candidateOffers) {
    // Payment method compatibility
    if (userOffer.givePaymentMethods?.length || userOffer.takePaymentMethods?.length) {
      const offerPM = JSON.parse(row.offer.paymentMethods) as {
        take: ParsedPaymentMethodGroup[];
        give: ParsedPaymentMethodGroup[];
      };

      const fromSideOk = !userOffer.givePaymentMethods?.length ||
        hasPaymentMethodOverlap(userOffer.givePaymentMethods, offerPM.take, userOffer.fromCurrency);
      const toSideOk = !userOffer.takePaymentMethods?.length ||
        hasPaymentMethodOverlap(userOffer.takePaymentMethods, offerPM.give, userOffer.toCurrency);

      if (!fromSideOk || !toSideOk) continue;
    }

    // Amount conversion
    const offerAmountCurrency = row.offer.amountCurrency ?? row.offer.fromCurrency;
    let offerAmountConverted = row.offer.amount;
    if (offerAmountCurrency !== userOffer.fromCurrency) {
      const rate = getRate(offerAmountCurrency, userOffer.fromCurrency);
      if (!rate) continue;
      offerAmountConverted = row.offer.amount * rate;
    }

    // Min split check
    if (offerAmountConverted < userOffer.minSplitAmount) continue;

    // Max amount check
    if (offerAmountConverted > userOffer.amount && !row.offer.partial) continue;

    // Trust check
    const [trustRow] = await db
      .select({ type: schema.trustRelations.type })
      .from(schema.trustRelations)
      .where(
        and(
          eq(schema.trustRelations.userId, userOffer.userId),
          eq(schema.trustRelations.targetUserId, row.author.id),
        ),
      )
      .limit(1);

    const trustType = (trustRow?.type as 'friend' | 'acquaintance') ?? null;

    if (userOffer.visibility === 'friends_only' && trustType !== 'friend') continue;

    const reputation = trustType === 'friend' ? 10 : trustType === 'acquaintance' ? 5 : 1;

    results.push({
      offerId: row.offer.id,
      authorId: row.author.id,
      trustType,
      reputation,
      _sortPriority: trustType === 'friend' ? 0 : trustType === 'acquaintance' ? 1 : 2,
    });
  }

  // Sort: friends first, then acquaintances, then others
  results.sort((a, b) => {
    if (a._sortPriority !== b._sortPriority) return a._sortPriority - b._sortPriority;
    return b.reputation - a.reputation;
  });

  return results.slice(0, limit).map(({ _sortPriority, ...rest }) => rest);
}

// ─── Helpers ──────────────────────────────────

async function checkVisibility(
  db: TestDb,
  userId: number,
  targetAuthorId: number,
  visibility: 'friends_only' | 'friends_and_acquaintances',
): Promise<boolean> {
  if (visibility === 'friends_and_acquaintances') return true;

  const [trustRow] = await db
    .select({ type: schema.trustRelations.type })
    .from(schema.trustRelations)
    .where(
      and(
        eq(schema.trustRelations.userId, userId),
        eq(schema.trustRelations.targetUserId, targetAuthorId),
      ),
    )
    .limit(1);

  return trustRow?.type === 'friend';
}
