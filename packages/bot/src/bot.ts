import { eq, inArray } from 'drizzle-orm';
import { Bot, InlineKeyboard } from 'grammy';
import { config } from './config';
import { db, schema } from './db';
import { handleChatMemberUpdate } from './services/chat-member-handler';
import { GroupMessagePipeline } from './services/group-message-pipeline';
import { getRate } from './services/rates';
import { trackUserFromContext } from './services/user-event-tracker';

export const bot = new Bot(config.botToken);

const pendingErrorReports = new Map<number, number>();
const ADMIN_USERNAME_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedAdminUsernames: string[] = [];
let adminUsernameCacheValidUntil = 0;

const groupMessagePipeline = new GroupMessagePipeline({
  sendDirectMessage: async (telegramId, text, options) => {
    await bot.api.sendMessage(telegramId, text, options);
  },
});

async function getAdminUsernames(): Promise<string[]> {
  const now = Date.now();
  if (adminUsernameCacheValidUntil > now) {
    return cachedAdminUsernames;
  }

  if (config.adminIds.length === 0) {
    cachedAdminUsernames = [];
    adminUsernameCacheValidUntil = now + ADMIN_USERNAME_CACHE_TTL_MS;
    return cachedAdminUsernames;
  }

  const usernames = new Set<string>();

  await Promise.all(
    config.adminIds.map(async (adminId) => {
      try {
        const chat = await bot.api.getChat(adminId);
        if ('username' in chat && typeof chat.username === 'string' && chat.username.length > 0) {
          usernames.add(`@${chat.username}`);
        }
      } catch (error) {
        console.warn(`[start] Failed to resolve admin username for ${adminId}:`, error);
      }
    }),
  );

  // Fallback to locally tracked users if Telegram API doesn't return usernames.
  if (usernames.size < config.adminIds.length) {
    const rows = await db
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(inArray(schema.users.telegramId, config.adminIds));

    for (const row of rows) {
      if (row.username) {
        usernames.add(`@${row.username}`);
      }
    }
  }

  cachedAdminUsernames = Array.from(usernames).sort((a, b) => a.localeCompare(b));
  adminUsernameCacheValidUntil = now + ADMIN_USERNAME_CACHE_TTL_MS;
  return cachedAdminUsernames;
}

// Track any event with user info: upsert users + group_members (for groups)
bot.use(async (ctx, next) => {
  await trackUserFromContext(ctx).catch((err) =>
    console.error('[user-event-tracker]', err),
  );
  return next();
});

// Log chat/group ID for every incoming message (debug groups we're member of)
bot.use(async (ctx, next) => {
  const chat = ctx.chat;
  if (chat && ['group', 'supergroup'].includes(chat.type)) {
    console.log(`[Group message] chatId=${chat.id} type=${chat.type} title=${'title' in chat ? chat.title : 'N/A'}`);
  }
  return next();
});

// Handle error feedback replies in private chat
bot.on('message:text', async (ctx, next) => {
  const chat = ctx.chat;
  const from = ctx.from;
  const message = ctx.message;
  const text = message.text?.trim();

  if (chat?.type !== 'private' || !from || !text) {
    await next();
    return;
  }

  const pendingMatchId = pendingErrorReports.get(from.id);
  if (!pendingMatchId) {
    await next();
    return;
  }

  pendingErrorReports.delete(from.id);

  try {
    const [match] = await db
      .select({
        id: schema.matches.id,
        userOfferId: schema.matches.userOfferId,
        matchedOfferId: schema.matches.matchedOfferId,
      })
      .from(schema.matches)
      .where(eq(schema.matches.id, pendingMatchId))
      .limit(1);

    if (!match) {
      await ctx.reply('Мэтч не найден.');
      return;
    }

    const [userOffer] = await db
      .select({
        userId: schema.userOffers.userId,
        fromCurrency: schema.userOffers.fromCurrency,
        toCurrency: schema.userOffers.toCurrency,
        amount: schema.userOffers.amount,
      })
      .from(schema.userOffers)
      .where(eq(schema.userOffers.id, match.userOfferId))
      .limit(1);

    const [groupOffer] = await db
      .select({
        authorId: schema.offers.authorId,
        groupId: schema.offers.groupId,
        fromCurrency: schema.offers.fromCurrency,
        toCurrency: schema.offers.toCurrency,
        amount: schema.offers.amount,
      })
      .from(schema.offers)
      .where(eq(schema.offers.id, match.matchedOfferId))
      .limit(1);

    if (!userOffer || !groupOffer) {
      await ctx.reply('Данные не найдены.');
      return;
    }

    const rate = getRate(groupOffer.fromCurrency, groupOffer.toCurrency);
    const convertedAmount = rate ? groupOffer.amount * rate : null;

    await db.insert(schema.exchangeHistory).values({
      userOfferId: match.userOfferId,
      matchedOfferId: match.matchedOfferId,
      matchId: match.id,
      initiatorUserId: userOffer.userId,
      counterpartyUserId: groupOffer.authorId,
      groupId: groupOffer.groupId,
      fromCurrency: groupOffer.fromCurrency,
      toCurrency: groupOffer.toCurrency,
      amount: groupOffer.amount,
      convertedAmount,
      exchangeRate: rate,
      success: false,
      errorReason: text,
    });

    await db
      .update(schema.matches)
      .set({ status: 'error_flagged', updatedAt: new Date() })
      .where(eq(schema.matches.id, pendingMatchId));

    await db
      .update(schema.userOffers)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(schema.userOffers.id, match.userOfferId));

    await ctx.reply(
      'Спасибо за обратную связь! Мы записали информацию об ошибке. Ваша заявка отменена.',
    );
  } catch (error) {
    console.error('Error handling error report:', error);
    await ctx.reply('Произошла ошибка при сохранении отзыва.');
  }
});

// Handle group text messages: batch -> LLM parse -> offers -> matches -> DM alerts
bot.on('message:text', async (ctx, next) => {
  const chat = ctx.chat;
  const from = ctx.from;
  const message = ctx.message;
  const text = message.text?.trim();
  const isGroupChat = chat && ['group', 'supergroup'].includes(chat.type);

  if (!isGroupChat || !from || from.is_bot || !text) {
    await next();
    return;
  }

  groupMessagePipeline.enqueue({
    text,
    chatId: chat.id,
    chatTitle: ('title' in chat && chat.title) ? chat.title : String(chat.id),
    messageId: message.message_id,
    messageThreadId: message.message_thread_id,
    authorTelegramId: from.id,
    authorUsername: from.username ?? null,
    authorFirstName: from.first_name || 'Unknown',
  });

  await next();
});

// Track group members on join/leave (only for trusted groups)
bot.on('chat_member', async (ctx) => {
  const update = ctx.update.chat_member;
  if (update) {
    await handleChatMemberUpdate(update);
  }
});

// /start command with referral support
bot.command('start', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  const payload = ctx.match?.trim();
  let referrerUser: { id: number; firstName: string; telegramId: number } | null = null;

  // Handle referral: ?start=0{4-char-code} (prefix 0 + 4-char base58 code)
  if (payload?.startsWith('0') && payload.length === 5) {
    const refCode = payload.slice(1);
    try {
      // Get current user from DB
      const [currentUser] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.telegramId, user.id))
        .limit(1);

      // Get referrer by code
      const [refCodeRow] = await db
        .select({
          userId: schema.referralCodes.userId,
        })
        .from(schema.referralCodes)
        .where(eq(schema.referralCodes.code, refCode))
        .limit(1);

      if (refCodeRow) {
        const [referrer] = await db
          .select({
            id: schema.users.id,
            firstName: schema.users.firstName,
            telegramId: schema.users.telegramId,
          })
          .from(schema.users)
          .where(eq(schema.users.id, refCodeRow.userId))
          .limit(1);

        // Don't add yourself as friend
        if (currentUser && referrer && referrer.telegramId !== user.id) {
          // Create mutual friendship (both directions)
          await db
            .insert(schema.trustRelations)
            .values({ userId: currentUser.id, targetUserId: referrer.id, type: 'friend' })
            .onConflictDoNothing();

          await db
            .insert(schema.trustRelations)
            .values({ userId: referrer.id, targetUserId: currentUser.id, type: 'friend' })
            .onConflictDoNothing();

          referrerUser = referrer;

          // Notify referrer that their friend joined
          try {
            await bot.api.sendMessage(
              referrer.telegramId,
              `🎉 ${user.first_name} присоединился по вашей ссылке! Вы теперь друзья.`,
            );
          } catch {
            // Referrer may have blocked the bot
          }
        }
      }
    } catch (err) {
      console.error('[referral] Error processing referral:', err);
    }
  }

  const adminUsernames = await getAdminUsernames();
  const adminListText = adminUsernames.length > 0 ? adminUsernames.join(', ') : 'не удалось определить';

  const welcomeText = [
    'Привет! Я Халва бот.',
    '',
    'Как это работает:',
    '1. Вы создаёте заявку на обмен в мини-приложении.',
    '2. Бот отслеживает сообщения в доверенных Telegram-группах и находит релевантные предложения.',
    '3. Когда есть совпадение, бот присылает контакт и ссылку на сообщение для связи напрямую.',
    '',
    'Бот не хранит деньги и не участвует в расчётах - он только соединяет людей.',
    referrerUser ? `🎉 Вы и ${referrerUser.firstName} теперь друзья.` : '',
    '',
    `Админы бота: ${adminListText}`,
  ]
    .filter(Boolean)
    .join('\n');

  await ctx.reply(welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть Халву', web_app: { url: config.miniAppUrl } }],
      ],
    },
  });
});

// Handle forwarded messages — add to trust circles
bot.on('message:forward_origin', async (ctx) => {
  // TODO: extract forwarded user, ask friend/acquaintance
  const keyboard = new InlineKeyboard()
    .text('Друг', 'trust:friend')
    .text('Знакомый', 'trust:acquaintance');

  await ctx.reply('Добавить этого человека как друга или знакомого?', {
    reply_markup: keyboard,
    reply_to_message_id: ctx.message.message_id,
  });
});

function getForwardedUserDisplay(origin: { sender_user?: { first_name: string; last_name?: string; username?: string }; sender_user_name?: string }): string {
  if ('sender_user' in origin && origin.sender_user) {
    const u = origin.sender_user;
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Пользователь';
    const handle = u.username ? ` (@${u.username})` : '';
    return `${name}${handle}`;
  }
  if ('sender_user_name' in origin && origin.sender_user_name) {
    return origin.sender_user_name;
  }
  return '';
}

const trustTypeLabel: Record<'friend' | 'acquaintance', string> = {
  friend: 'друг',
  acquaintance: 'знакомый',
};

bot.callbackQuery(/^trust:/, async (ctx) => {
  const type = ctx.callbackQuery.data.replace('trust:', '') as 'friend' | 'acquaintance';
  const label = trustTypeLabel[type] ?? type;
  const currentUser = ctx.from;
  const repliedMsg = ctx.callbackQuery.message?.reply_to_message;
  const forwardOrigin = repliedMsg?.forward_origin as {
    sender_user?: { id: number; first_name: string; last_name?: string; username?: string };
    sender_user_name?: string;
  } | undefined;

  const userDisplay = forwardOrigin ? getForwardedUserDisplay(forwardOrigin) : '';
  const suffix = userDisplay ? ` (${userDisplay})` : '';

  if (!forwardOrigin?.sender_user?.id) {
    await ctx.answerCallbackQuery({ text: 'Не удалось определить пользователя из пересланного сообщения' });
    return;
  }

  const forwardedTelegramId = forwardOrigin.sender_user.id;

  if (forwardedTelegramId === currentUser.id) {
    await ctx.answerCallbackQuery({ text: 'Нельзя добавить себя в контакты' });
    return;
  }

  try {
    const [dbCurrentUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.telegramId, currentUser.id))
      .limit(1);

    if (!dbCurrentUser) {
      await ctx.answerCallbackQuery({ text: 'Сначала запустите бота командой /start' });
      return;
    }

    const forwardedUser = forwardOrigin.sender_user;
    const forwardedFirstName = forwardedUser.first_name || 'Unknown';

    const [existingTarget] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.telegramId, forwardedTelegramId))
      .limit(1);

    let targetUserId: number;
    if (existingTarget) {
      targetUserId = existingTarget.id;
    } else {
      const [newUser] = await db
        .insert(schema.users)
        .values({
          telegramId: forwardedTelegramId,
          firstName: forwardedFirstName,
          username: forwardedUser.username ?? null,
        })
        .returning({ id: schema.users.id });
      targetUserId = newUser.id;
    }

    await db
      .insert(schema.trustRelations)
      .values({ userId: dbCurrentUser.id, targetUserId, type })
      .onConflictDoUpdate({
        target: [schema.trustRelations.userId, schema.trustRelations.targetUserId],
        set: { type },
      });

    await ctx.answerCallbackQuery({ text: `Добавлен как ${label}!` });
    await ctx.editMessageText(`✅ Добавлен как ${label}${suffix}`);
  } catch (error) {
    console.error('[trust] Error saving trust relation:', error);
    await ctx.answerCallbackQuery({ text: 'Произошла ошибка при сохранении' });
  }
});

bot.callbackQuery(/^match_success:/, async (ctx) => {
  const matchId = parseInt(ctx.callbackQuery.data.replace('match_success:', ''), 10);
  if (isNaN(matchId)) {
    await ctx.answerCallbackQuery({ text: 'Ошибка: неверный ID' });
    return;
  }

  try {
    const [match] = await db
      .select({
        id: schema.matches.id,
        userOfferId: schema.matches.userOfferId,
        matchedOfferId: schema.matches.matchedOfferId,
      })
      .from(schema.matches)
      .where(eq(schema.matches.id, matchId))
      .limit(1);

    if (!match) {
      await ctx.answerCallbackQuery({ text: 'Мэтч не найден' });
      return;
    }

    const [userOffer] = await db
      .select({
        userId: schema.userOffers.userId,
        fromCurrency: schema.userOffers.fromCurrency,
        toCurrency: schema.userOffers.toCurrency,
        amount: schema.userOffers.amount,
      })
      .from(schema.userOffers)
      .where(eq(schema.userOffers.id, match.userOfferId))
      .limit(1);

    const [groupOffer] = await db
      .select({
        authorId: schema.offers.authorId,
        groupId: schema.offers.groupId,
        fromCurrency: schema.offers.fromCurrency,
        toCurrency: schema.offers.toCurrency,
        amount: schema.offers.amount,
      })
      .from(schema.offers)
      .where(eq(schema.offers.id, match.matchedOfferId))
      .limit(1);

    if (!userOffer || !groupOffer) {
      await ctx.answerCallbackQuery({ text: 'Данные не найдены' });
      return;
    }

    const rate = getRate(groupOffer.fromCurrency, groupOffer.toCurrency);
    const convertedAmount = rate ? groupOffer.amount * rate : null;

    await db.insert(schema.exchangeHistory).values({
      userOfferId: match.userOfferId,
      matchedOfferId: match.matchedOfferId,
      matchId: match.id,
      initiatorUserId: userOffer.userId,
      counterpartyUserId: groupOffer.authorId,
      groupId: groupOffer.groupId,
      fromCurrency: groupOffer.fromCurrency,
      toCurrency: groupOffer.toCurrency,
      amount: groupOffer.amount,
      convertedAmount,
      exchangeRate: rate,
      success: true,
    });

    await db
      .update(schema.matches)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(schema.matches.id, matchId));

    await db
      .update(schema.userOffers)
      .set({ status: 'matched', updatedAt: new Date() })
      .where(eq(schema.userOffers.id, match.userOfferId));

    await db
      .update(schema.offers)
      .set({ status: 'matched', updatedAt: new Date() })
      .where(eq(schema.offers.id, match.matchedOfferId));

    await ctx.answerCallbackQuery({ text: 'Отлично! Обмен записан как успешный.' });
    await ctx.editMessageText(
      ctx.callbackQuery.message?.text + '\n\n✅ *Обмен завершён успешно!*',
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    console.error('Error handling match_success:', error);
    await ctx.answerCallbackQuery({ text: 'Произошла ошибка' });
  }
});

bot.callbackQuery(/^match_error:/, async (ctx) => {
  const matchId = parseInt(ctx.callbackQuery.data.replace('match_error:', ''), 10);
  const user = ctx.from;

  if (isNaN(matchId) || !user) {
    await ctx.answerCallbackQuery({ text: 'Ошибка: неверные данные' });
    return;
  }

  pendingErrorReports.set(user.id, matchId);

  await ctx.answerCallbackQuery();
  await ctx.reply(
    'Напишите, что именно пошло не так. Это поможет нам улучшить бот.',
    { reply_markup: { force_reply: true } },
  );
});

// Catch-all error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});
