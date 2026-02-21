import type { FastifyInstance } from 'fastify';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db, schema } from '../db';

export async function feedRoutes(server: FastifyInstance) {
  server.get<{ Querystring: { filter?: string } }>('/', async (request, reply) => {
    const userId = 1; // TODO: extract from Telegram initData in prod
    const filter = request.query.filter ?? 'friends';

    // 1. Find trusted user IDs based on filter
    const trustTypes: ('friend' | 'acquaintance')[] = filter === 'friends'
      ? ['friend']
      : ['friend', 'acquaintance'];

    const trustRows = await db
      .select({ targetUserId: schema.trustRelations.targetUserId, type: schema.trustRelations.type })
      .from(schema.trustRelations)
      .where(
        and(
          eq(schema.trustRelations.userId, userId),
          inArray(schema.trustRelations.type, trustTypes),
        ),
      );

    if (trustRows.length === 0) return reply.send([]);

    const trustedUserIds = trustRows.map((r) => r.targetUserId);
    const trustMap = new Map(trustRows.map((r) => [r.targetUserId, r.type as 'friend' | 'acquaintance']));

    // 2. Fetch active offers from trusted users
    const offers = await db
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
          inArray(schema.offers.authorId, trustedUserIds),
        ),
      )
      .orderBy(desc(schema.offers.createdAt));

    // 3. Format as MyOfferItem[] — reuse OfferCard shape
    const result = offers.map((row) => {
      const pm = JSON.parse(row.offer.paymentMethods) as {
        give?: { currency: string; methods: string[] }[];
        take?: { currency: string; methods: string[] }[];
      };

      const matchSource = row.offer.isLlmParsed ? 'group_message' : 'hawala';
      const chatId = row.group.telegramChatId;
      const msgId = row.offer.telegramMessageId;
      const telegramMessageLink = matchSource === 'group_message'
        ? `https://t.me/c/${String(chatId).replace('-100', '')}/${msgId}`
        : null;

      const topMatch = {
        author: {
          firstName: row.author.firstName,
          username: row.author.username,
          avatarUrl: row.author.avatarUrl,
        },
        trustType: trustMap.get(row.author.id) ?? null,
        groupName: matchSource === 'group_message' ? row.group.name : 'Халва',
        telegramMessageLink,
        matchSource,
      };
      return {
        id: row.offer.id,
        fromCurrency: row.offer.fromCurrency,
        toCurrency: row.offer.toCurrency,
        amount: row.offer.amount,
        status: 'active' as const,
        matchCount: 1,
        createdAt: row.offer.createdAt,
        paymentMethods: { give: pm.give ?? [], take: pm.take ?? [] },
        topMatch,
        allMatches: [topMatch],
      };
    });

    return reply.send(result);
  });
}
