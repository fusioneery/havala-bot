import type { FastifyInstance } from 'fastify';
import { eq, and, ne } from 'drizzle-orm';
import { db, schema } from '../db';
import { config } from '../config';
import { resolveTemplate, getPaymentMethodLabel } from '../lib/template';
import type { SearchRequest, SearchResponse, MatchResult } from '@hawala/shared';

export async function offerRoutes(server: FastifyInstance) {
  server.post<{ Body: SearchRequest }>('/search', async (request, reply) => {
    const { fromCurrency, toCurrency, amount, minSplitAmount, visibility } = request.body;

    // For dev: hardcoded user_id=1. In prod, extract from Telegram initData.
    const userId = 1;

    // 1. Create user offer
    const [userOffer] = await db
      .insert(schema.userOffers)
      .values({
        userId,
        fromCurrency,
        toCurrency,
        amount,
        minSplitAmount,
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
          ne(schema.offers.authorId, userId),
        ),
      );

    // 3. Filter by trust circle + calculate reputation
    const matchResults: (MatchResult & { _sortPriority: number })[] = [];

    for (const row of candidateOffers) {
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

      const chatId = row.group.telegramChatId;
      const msgId = row.offer.telegramMessageId;
      const telegramMessageLink = `https://t.me/c/${String(chatId).replace('-100', '')}/${msgId}`;

      matchResults.push({
        id: 0,
        offer: {
          id: row.offer.id,
          fromCurrency: row.offer.fromCurrency,
          toCurrency: row.offer.toCurrency,
          amount: row.offer.amount,
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
        groupName: row.group.name,
        telegramMessageLink,
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

    const response: SearchResponse = {
      userOffer: { id: userOffer.id, status: userOffer.status as 'active' },
      matches: finalMatches,
      offerText,
    };

    return reply.send(response);
  });
}
