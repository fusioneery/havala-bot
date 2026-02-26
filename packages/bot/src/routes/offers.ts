import type { FastifyInstance } from 'fastify';
import { eq, and, ne, desc, count, inArray } from 'drizzle-orm';
import { db, schema } from '../db';
import { config } from '../config';
import { resolveTemplate, getPaymentMethodLabel } from '../lib/template';
import { resolveUserId } from '../lib/auth';
import {
  hasPaymentMethodOverlap,
  type MatchResult,
  type MyOfferMatchItem,
  type ParsedPaymentMethodGroup,
  type SearchRequest,
  type SearchResponse,
} from '@hawala/shared';
import { debugLog } from '../services/debug-chat';
import { getRate } from '../services/rates';
import { checkRateLimit, recordOfferRequest } from '../services/rate-limit';

export async function offerRoutes(server: FastifyInstance) {
  server.get('/', async (request, reply) => {
    const userId = await resolveUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const offers = await db
      .select()
      .from(schema.userOffers)
      .where(and(eq(schema.userOffers.userId, userId), eq(schema.userOffers.status, 'active')))
      .orderBy(desc(schema.userOffers.createdAt));

    // Query chat-parsed offers for this user
    const chatOffers = await db
      .select()
      .from(schema.offers)
      .where(and(eq(schema.offers.authorId, userId), eq(schema.offers.status, 'active')));

    if (offers.length === 0 && chatOffers.length === 0) return reply.send([]);

    const offerIds = offers.map((o) => o.id);

    // Count matches per offer (skip if no userOffers)
    const matchCounts = offerIds.length > 0
      ? await db
          .select({ userOfferId: schema.matches.userOfferId, count: count() })
          .from(schema.matches)
          .where(inArray(schema.matches.userOfferId, offerIds))
          .groupBy(schema.matches.userOfferId)
      : [];
    const countMap = new Map(matchCounts.map((r) => [r.userOfferId, r.count]));

    // Fetch all matches per offer (with author + group)
    const matchRows = offerIds.length > 0
      ? await db
          .select({
            matchId: schema.matches.id,
            userOfferId: schema.matches.userOfferId,
            offer: schema.offers,
            author: schema.users,
            group: schema.trustedGroups,
          })
          .from(schema.matches)
          .innerJoin(schema.offers, eq(schema.matches.matchedOfferId, schema.offers.id))
          .innerJoin(schema.users, eq(schema.offers.authorId, schema.users.id))
          .innerJoin(schema.trustedGroups, eq(schema.offers.groupId, schema.trustedGroups.id))
          .where(inArray(schema.matches.userOfferId, offerIds))
      : [];

    // Batch-fetch trust relations for all unique authors
    const uniqueAuthorIds = [...new Set(matchRows.map((r) => r.author.id))];
    const trustRows = uniqueAuthorIds.length > 0
      ? await db
          .select({ targetUserId: schema.trustRelations.targetUserId, type: schema.trustRelations.type })
          .from(schema.trustRelations)
          .where(and(
            eq(schema.trustRelations.userId, userId),
            inArray(schema.trustRelations.targetUserId, uniqueAuthorIds),
          ))
      : [];
    const trustMap = new Map(trustRows.map((r) => [r.targetUserId, r.type as 'friend' | 'acquaintance']));

    // Group matches by offer, topMatch is the first (friends first, then acquaintances)
    const matchesMap = new Map<number, MyOfferMatchItem[]>();
    for (const row of matchRows) {
      const trustType = trustMap.get(row.author.id) ?? null;
      const matchSource = row.offer.isLlmParsed ? 'group_message' : 'hawala';
      const chatId = row.group.telegramChatId;
      const msgId = row.offer.telegramMessageId;
      const telegramMessageLink = matchSource === 'group_message'
        ? `https://t.me/c/${String(chatId).replace('-100', '')}/${msgId}`
        : null;

      const item: MyOfferMatchItem = {
        author: {
          firstName: row.author.firstName,
          username: row.author.username,
          avatarUrl: row.author.avatarUrl,
        },
        trustType,
        groupName: matchSource === 'group_message' ? row.group.name : 'Халва',
        telegramMessageLink,
        matchSource,
      };

      const list = matchesMap.get(row.userOfferId) ?? [];
      list.push(item);
      matchesMap.set(row.userOfferId, list);
    }

    // Sort each offer's matches: friends first, then acquaintances, then others
    for (const [, list] of matchesMap) {
      list.sort((a, b) => {
        const rank = (t: string | null) => t === 'friend' ? 0 : t === 'acquaintance' ? 1 : 2;
        return rank(a.trustType) - rank(b.trustType);
      });
    }

    const userResult = offers.map((o) => {
      const pm = JSON.parse(o.paymentMethods) as {
        give?: { currency: string; methods: string[] }[];
        take?: { currency: string; methods: string[] }[];
      };
      const allMatches = matchesMap.get(o.id) ?? [];
      return {
        id: `uo:${o.id}`,
        fromCurrency: o.fromCurrency,
        toCurrency: o.toCurrency,
        amount: o.amount,
        status: o.status,
        matchCount: countMap.get(o.id) ?? 0,
        createdAt: o.createdAt,
        paymentMethods: { give: pm.give ?? [], take: pm.take ?? [] },
        topMatch: allMatches[0] ?? null,
        allMatches,
      };
    });

    const chatResult = chatOffers.map((o) => {
      const pm = JSON.parse(o.paymentMethods) as {
        give?: { currency: string; methods: string[] }[];
        take?: { currency: string; methods: string[] }[];
      };
      return {
        id: `o:${o.id}`,
        fromCurrency: o.fromCurrency,
        toCurrency: o.toCurrency,
        amount: o.amount,
        status: o.status as 'active',
        matchCount: 0,
        createdAt: o.createdAt,
        paymentMethods: { give: pm.give ?? [], take: pm.take ?? [] },
        topMatch: null,
        allMatches: [],
      };
    });

    const merged = [...userResult, ...chatResult].sort(
      (a, b) => new Date(b.createdAt as unknown as string).getTime() - new Date(a.createdAt as unknown as string).getTime(),
    );

    return reply.send(merged);
  });

  server.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const userId = await resolveUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const raw = request.params.id;
    const isChat = raw.startsWith('o:');
    const numericId = Number(raw.replace(/^(uo:|o:)/, ''));
    if (Number.isNaN(numericId)) return reply.status(400).send({ error: 'Invalid id' });

    if (isChat) {
      // Chat-parsed offer: verify ownership, set cancelled
      const [offer] = await db
        .select()
        .from(schema.offers)
        .where(and(eq(schema.offers.id, numericId), eq(schema.offers.authorId, userId)));
      if (!offer) return reply.status(404).send({ error: 'Not found' });

      await db
        .update(schema.offers)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(schema.offers.id, numericId));

      void debugLog('🗑️', 'Заявка из чата отменена (API)', {
        offerId: numericId,
        userId,
        direction: `${offer.fromCurrency} → ${offer.toCurrency}`,
      });
    } else {
      // User offer: existing logic (delete matches + delete offer)
      const [offer] = await db
        .select()
        .from(schema.userOffers)
        .where(and(eq(schema.userOffers.id, numericId), eq(schema.userOffers.userId, userId)));
      if (!offer) return reply.status(404).send({ error: 'Not found' });

      await db.delete(schema.matches).where(eq(schema.matches.userOfferId, numericId));
      await db.delete(schema.userOffers).where(eq(schema.userOffers.id, numericId));

      void debugLog('🗑️', 'Заявка удалена (API)', {
        userOfferId: numericId,
        userId,
        direction: `${offer.fromCurrency} → ${offer.toCurrency}`,
      });
    }

    return reply.send({ ok: true });
  });

  server.post<{ Body: SearchRequest }>('/search', async (request, reply) => {
    if (!request.body) {
      return reply.status(400).send({ error: 'Missing request body' });
    }

    const {
      fromCurrency, toCurrency, amount, minSplitAmount, visibility,
      givePaymentMethods, takePaymentMethods,
    } = request.body;

    const userId = await resolveUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    // Check rate limits before creating offer
    const rateLimit = await checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return reply.status(429).send({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Вы исчерпали лимит заявок',
        dailyCount: rateLimit.dailyCount,
        monthlyCount: rateLimit.monthlyCount,
        dailyLimit: rateLimit.dailyLimit,
        monthlyLimit: rateLimit.monthlyLimit,
      });
    }

    // Record this request for rate limiting
    await recordOfferRequest(userId);

    // 1. Create user offer (persist payment methods for pipeline matching)
    const paymentMethodsJson = JSON.stringify({
      take: takePaymentMethods ?? [],
      give: givePaymentMethods ?? [],
    });

    const [userOffer] = await db
      .insert(schema.userOffers)
      .values({
        userId,
        fromCurrency,
        toCurrency,
        amount,
        minSplitAmount,
        paymentMethods: paymentMethodsJson,
        visibility,
        notifyOnMatch: true,
      })
      .returning({ id: schema.userOffers.id, status: schema.userOffers.status });

    // 2. Find matching offers (reverse direction)
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
          eq(schema.offers.fromCurrency, toCurrency),
          eq(schema.offers.toCurrency, fromCurrency),
          ...(config.dev ? [] : [ne(schema.offers.authorId, userId)]),
        ),
      );

    // 3. Filter by trust circle + calculate reputation
    const matchResults: (MatchResult & { _sortPriority: number })[] = [];

    for (const row of candidateOffers) {
      // Payment method compatibility check
      if (givePaymentMethods?.length || takePaymentMethods?.length) {
        const offerPM = JSON.parse(row.offer.paymentMethods) as {
          take: ParsedPaymentMethodGroup[];
          give: ParsedPaymentMethodGroup[];
        };

        const fromSideOk = !givePaymentMethods?.length ||
          hasPaymentMethodOverlap(givePaymentMethods, offerPM.take, fromCurrency);
        const toSideOk = !takePaymentMethods?.length ||
          hasPaymentMethodOverlap(takePaymentMethods, offerPM.give, toCurrency);

        if (!fromSideOk || !toSideOk) continue;
      }

      // Amount compatibility check
      const offerAmountCurrency = row.offer.amountCurrency ?? row.offer.fromCurrency;
      let offerAmountConverted = row.offer.amount;
      if (offerAmountCurrency !== fromCurrency) {
        const rate = getRate(offerAmountCurrency, fromCurrency);
        if (!rate) continue;
        offerAmountConverted = row.offer.amount * rate;
      }

      // Offer must meet user's minimum split amount
      if (offerAmountConverted < minSplitAmount) {
        continue;
      }

      // Offer must fit within user's requested amount, unless offer author allows partial
      if (offerAmountConverted > amount && !row.offer.partial) {
        continue;
      }

      const [trustRow] = await db
        .select({ type: schema.trustRelations.type })
        .from(schema.trustRelations)
        .where(
          and(
            eq(schema.trustRelations.userId, userId),
            eq(schema.trustRelations.targetUserId, row.author.id),
          ),
        )
        .limit(1);

      const trustType = (trustRow?.type as 'friend' | 'acquaintance') ?? null;

      if (visibility === 'friends_only' && trustType !== 'friend') {
        continue;
      }

      const reputation = trustType === 'friend' ? 10 : trustType === 'acquaintance' ? 5 : 1;

      const matchSource = row.offer.isLlmParsed ? 'group_message' : 'hawala';
      const chatId = row.group.telegramChatId;
      const msgId = row.offer.telegramMessageId;
      const telegramMessageLink = matchSource === 'group_message'
        ? `https://t.me/c/${String(chatId).replace('-100', '')}/${msgId}`
        : null;

      matchResults.push({
        id: 0,
        offer: {
          id: row.offer.id,
          fromCurrency: row.offer.fromCurrency,
          toCurrency: row.offer.toCurrency,
          amount: row.offer.amount,
          amountCurrency: row.offer.amountCurrency,
          paymentMethods: JSON.parse(row.offer.paymentMethods),
          originalMessageText: row.offer.originalMessageText,
          telegramMessageId: row.offer.telegramMessageId,
        },
        author: {
          telegramId: row.author.telegramId,
          username: row.author.username,
          firstName: row.author.firstName,
          avatarUrl: row.author.avatarUrl,
        },
        reputation,
        trustType,
        groupName: matchSource === 'group_message' ? row.group.name : 'Халва',
        telegramMessageLink,
        matchSource,
        _sortPriority: trustType === 'friend' ? 0 : trustType === 'acquaintance' ? 1 : 2,
      });
    }

    // 4. Sort: friends first by rep, then acquaintances by rep, then others
    matchResults.sort((a, b) => {
      if (a._sortPriority !== b._sortPriority) return a._sortPriority - b._sortPriority;
      return b.reputation - a.reputation;
    });

    // 5. Take top 5 and create match records
    const top5 = matchResults.slice(0, 5);
    const finalMatches: MatchResult[] = [];

    for (const m of top5) {
      const [matchRow] = await db
        .insert(schema.matches)
        .values({
          userOfferId: userOffer.id,
          matchedOfferId: m.offer.id,
        })
        .returning({ id: schema.matches.id });

      const { _sortPriority, ...clean } = m;
      finalMatches.push({ ...clean, id: matchRow.id });
    }

    // 6. Build offer text from template
    const formatNum = (n: number) => n.toLocaleString('ru-RU');
    const offerText = resolveTemplate(config.writeOfferText, {
      takeAmount: formatNum(amount),
      takeCurrency: fromCurrency,
      takePaymentMethod: getPaymentMethodLabel(fromCurrency),
      giveAmount: formatNum(amount),
      giveCurrency: toCurrency,
      givePaymentMethod: getPaymentMethodLabel(toCurrency),
    });

    void debugLog('📝', 'Заявка через API', {
      userOfferId: userOffer.id,
      userId,
      direction: `${fromCurrency} → ${toCurrency}`,
      amount,
      visibility,
      matchesFound: finalMatches.length,
    });

    const response: SearchResponse = {
      userOffer: { id: userOffer.id, status: userOffer.status as 'active' },
      matches: finalMatches,
      offerText,
    };

    return reply.send(response);
  });
}
