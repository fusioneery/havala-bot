import type { FastifyInstance } from 'fastify';
import { eq, and, like, or, notInArray, ne } from 'drizzle-orm';
import { db, schema } from '../db';
import { config } from '../config';
import type { ContactListItem, AddContactRequest, UserSearchResult } from '@hawala/shared';

export async function contactRoutes(server: FastifyInstance) {
  // For dev: hardcoded user_id=1. In prod, extract from Telegram initData.
  const userId = 1;

  // GET / — list contacts
  server.get('/', async (_request, reply) => {
    const rows = await db
      .select({
        id: schema.trustRelations.id,
        type: schema.trustRelations.type,
        targetUser: schema.users,
      })
      .from(schema.trustRelations)
      .innerJoin(schema.users, eq(schema.trustRelations.targetUserId, schema.users.id))
      .where(eq(schema.trustRelations.userId, userId));

    const contacts: ContactListItem[] = rows.map((r) => ({
      id: r.id,
      type: r.type as ContactListItem['type'],
      user: {
        id: r.targetUser.id,
        telegramId: r.targetUser.telegramId,
        username: r.targetUser.username,
        firstName: r.targetUser.firstName,
        avatarUrl: r.targetUser.avatarUrl,
      },
    }));

    return reply.send(contacts);
  });

  // POST / — add or update contact
  server.post<{ Body: AddContactRequest }>('/', async (request, reply) => {
    const { targetUserId, type } = request.body;

    const [row] = await db
      .insert(schema.trustRelations)
      .values({ userId, targetUserId, type })
      .onConflictDoUpdate({
        target: [schema.trustRelations.userId, schema.trustRelations.targetUserId],
        set: { type },
      })
      .returning({ id: schema.trustRelations.id });

    return reply.send(row);
  });

  // DELETE /:id — remove contact
  server.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = Number(request.params.id);

    await db
      .delete(schema.trustRelations)
      .where(and(eq(schema.trustRelations.id, id), eq(schema.trustRelations.userId, userId)));

    return reply.send({ ok: true });
  });

  // GET /search?q= — search users to add
  server.get<{ Querystring: { q?: string } }>('/search', async (request, reply) => {
    const q = request.query.q?.trim();
    if (!q) return reply.send([]);

    // Get already-added contact user IDs
    const existing = await db
      .select({ targetUserId: schema.trustRelations.targetUserId })
      .from(schema.trustRelations)
      .where(eq(schema.trustRelations.userId, userId));

    const excludeIds = [userId, ...existing.map((r) => r.targetUserId)];

    const pattern = `%${q}%`;
    const rows = await db
      .select()
      .from(schema.users)
      .where(
        and(
          notInArray(schema.users.id, excludeIds),
          or(like(schema.users.username, pattern), like(schema.users.firstName, pattern)),
        ),
      )
      .limit(20);

    const results: UserSearchResult[] = rows.map((r) => ({
      id: r.id,
      telegramId: r.telegramId,
      username: r.username,
      firstName: r.firstName,
      avatarUrl: r.avatarUrl,
    }));

    return reply.send(results);
  });

  // GET /invite-link — generate or get existing referral link
  server.get('/invite-link', async (_request, reply) => {
    // Check if user already has a referral code
    let [existing] = await db
      .select({ code: schema.referralCodes.code })
      .from(schema.referralCodes)
      .where(eq(schema.referralCodes.userId, userId))
      .limit(1);

    if (!existing) {
      // Generate a unique code with retries
      let code: string;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        code = schema.generateBase58Code(4);
        try {
          await db.insert(schema.referralCodes).values({ code, userId });
          existing = { code };
          break;
        } catch {
          attempts++;
        }
      }

      if (!existing) {
        return reply.status(500).send({ error: 'Failed to generate referral code' });
      }
    }

    const link = `https://t.me/${config.botUsername}?start=0${existing.code}`;
    return reply.send({ link, code: existing.code });
  });
}
