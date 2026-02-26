import { eq, inArray, or } from 'drizzle-orm';
import { Bot, InlineKeyboard } from 'grammy';
import { config } from './config';
import { db, schema } from './db';
import { addToBlacklist } from './services/blacklist';
import { handleChatMemberUpdate } from './services/chat-member-handler';
import { GroupMessagePipeline } from './services/group-message-pipeline';
import { getRate } from './services/rates';
import { debugError, debugLog } from './services/debug-chat';
import { trackUserFromContext } from './services/user-event-tracker';

export const bot = new Bot(config.botToken);

const pendingErrorReports = new Map<number, number>();

const GROUP_LABEL_CACHE_TTL_MS = 10 * 60 * 1000;
let cachedGroupLabels: string[] = [];
let groupLabelCacheValidUntil = 0;

const groupMessagePipeline = new GroupMessagePipeline({
  sendDirectMessage: async (telegramId, text, options) => {
    await bot.api.sendMessage(telegramId, text, options);
  },
  setMessageReaction: async (chatId, messageId, emoji) => {
    await bot.api.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: emoji as '👍' }]);
  },
});

async function getTrustedGroupLabels(): Promise<string[]> {
  const now = Date.now();
  if (groupLabelCacheValidUntil > now) return cachedGroupLabels;

  const ids = config.trustedGroupIds;
  if (ids.length === 0) {
    cachedGroupLabels = [];
    groupLabelCacheValidUntil = now + GROUP_LABEL_CACHE_TTL_MS;
    return cachedGroupLabels;
  }

  const labels: string[] = [];
  await Promise.all(
    ids.map(async (chatId) => {
      try {
        const chat = await bot.api.getChat(chatId);
        if ('username' in chat && chat.username) {
          labels.push(`@${chat.username}`);
        } else if ('title' in chat && chat.title) {
          labels.push(chat.title);
        }
      } catch {
        // group unreachable
      }
    }),
  );

  cachedGroupLabels = labels.sort((a, b) => a.localeCompare(b));
  groupLabelCacheValidUntil = now + GROUP_LABEL_CACHE_TTL_MS;
  return cachedGroupLabels;
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

    void debugLog('⚠️', 'Жалоба на обмен', {
      matchId: pendingMatchId,
      userId: from.id,
      reason: text.slice(0, 200),
    });

    await ctx.reply(
      'Спасибо за обратную связь! Мы записали информацию об ошибке. Ваша заявка отменена.',
    );
  } catch (error) {
    console.error('Error handling error report:', error);
    void debugError('Error report handler failed', error, { matchId: pendingMatchId });
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

// Handle edited messages in groups: detect offer changes via LLM
bot.on('edited_message:text', async (ctx) => {
  const chat = ctx.chat;
  const from = ctx.from;
  const message = ctx.editedMessage;
  const text = message.text?.trim();
  const isGroupChat = chat && ['group', 'supergroup'].includes(chat.type);

  if (!isGroupChat || !from || from.is_bot || !text) return;

  void groupMessagePipeline.handleEditedMessage(chat.id, message.message_id, text);
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
            notifyOnFriendAdd: schema.users.notifyOnFriendAdd,
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
          if (referrer.notifyOnFriendAdd) {
            try {
              const keyboard = new InlineKeyboard()
                .webApp('Создать заявку', config.miniAppUrl)
                .row()
                .text('🔔 Не уведомлять о новых друзьях', 'toggle_friend_notify');

              await bot.api.sendMessage(
                referrer.telegramId,
                `${user.first_name} добавил вас в друзья в Халве, теперь вы можете видеть заявки на обмен друг друга.`,
                { reply_markup: keyboard },
              );
            } catch {
              // Referrer may have blocked the bot
            }
          }
        }
      }
    } catch (err) {
      console.error('[referral] Error processing referral:', err);
    }
  }

  const groupLabels = await getTrustedGroupLabels();
  const groupListText = groupLabels.length > 0 ? ` (${groupLabels.join(', ')})` : '';

  const welcomeText = [
    '👋 Привет! Я Халва — бот для поиска обменов.',
    '',
    '📌 Как это работает:',
    '1️⃣ Создайте заявку на обмен в мини-приложении.',
    `2️⃣ Бот мониторит доверенные группы${groupListText} и находит подходящие предложения.`,
    '3️⃣ При совпадении — получите контакт и ссылку на сообщение.',
    '',
    '🔒 Бот не хранит деньги и не участвует в расчётах — только соединяет людей.',
    referrerUser ? `\n🎉 Вы и ${referrerUser.firstName} теперь друзья!` : '',
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

// Handle forwarded messages — add to trust circles (only in private chats)
bot.on('message:forward_origin', async (ctx, next) => {
  if (ctx.chat?.type !== 'private') return next();

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

    void debugLog('✅', 'Обмен успешен', {
      matchId,
      from: `${groupOffer.fromCurrency} → ${groupOffer.toCurrency}`,
      amount: groupOffer.amount,
    });

    await ctx.answerCallbackQuery({ text: 'Отлично! Обмен записан как успешный.' });
    await ctx.editMessageText(
      ctx.callbackQuery.message?.text + '\n\n✅ *Обмен завершён успешно!*',
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    console.error('Error handling match_success:', error);
    void debugError('match_success handler failed', error, { matchId });
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

// /deleteaccount — permanently delete all data and self-ban
bot.command('deleteaccount', async (ctx) => {
  const user = ctx.from;
  if (!user || ctx.chat?.type !== 'private') return;

  const keyboard = new InlineKeyboard()
    .text('Да, удалить навсегда', 'confirm_delete_account')
    .row()
    .text('Отмена', 'cancel_delete_account');

  await ctx.reply(
    '⚠️ Вы уверены?\n\n'
    + 'Эта команда безвозвратно удалит ВСЕ ваши данные:\n'
    + '• Контакты и связи доверия\n'
    + '• Все заявки и мэтчи\n'
    + '• Историю обменов\n'
    + '• Реферальный код\n\n'
    + 'После удаления ваш аккаунт будет заблокирован навсегда. Это действие нельзя отменить.',
    { reply_markup: keyboard },
  );
});

bot.callbackQuery('confirm_delete_account', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  try {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('Удаление данных...');

    const [dbUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.telegramId, user.id))
      .limit(1);

    if (dbUser) {
      await deleteAllUserData(dbUser.id);
    }

    await addToBlacklist(user.id, 'self-delete via /deleteaccount');

    void debugLog('🚫', 'Аккаунт удалён', {
      telegramId: user.id,
      username: user.username,
    });

    await ctx.editMessageText(
      'Ваш аккаунт удалён и заблокирован навсегда. Прощайте.',
    );
  } catch (error) {
    console.error('[deleteaccount] Error:', error);
    void debugError('deleteaccount failed', error, { telegramId: user.id });
    await ctx.editMessageText('Произошла ошибка при удалении. Обратитесь к админу.');
  }
});

bot.callbackQuery('cancel_delete_account', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Отменено' });
  await ctx.editMessageText('Удаление отменено.');
});

bot.callbackQuery('toggle_friend_notify', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  try {
    const [dbUser] = await db
      .select({ id: schema.users.id, notifyOnFriendAdd: schema.users.notifyOnFriendAdd })
      .from(schema.users)
      .where(eq(schema.users.telegramId, user.id))
      .limit(1);

    if (!dbUser) {
      await ctx.answerCallbackQuery({ text: 'Пользователь не найден' });
      return;
    }

    const newValue = !dbUser.notifyOnFriendAdd;
    await db
      .update(schema.users)
      .set({ notifyOnFriendAdd: newValue, updatedAt: new Date() })
      .where(eq(schema.users.id, dbUser.id));

    const originalText = ctx.callbackQuery.message?.text ?? '';
    const buttonLabel = newValue
      ? '🔔 Не уведомлять о новых друзьях'
      : '🔕 Уведомлять о новых друзьях';

    const keyboard = new InlineKeyboard()
      .webApp('Создать заявку', config.miniAppUrl)
      .row()
      .text(buttonLabel, 'toggle_friend_notify');

    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    await ctx.answerCallbackQuery({
      text: newValue ? 'Уведомления включены' : 'Уведомления выключены',
    });
  } catch (error) {
    console.error('[toggle_friend_notify] Error:', error);
    await ctx.answerCallbackQuery({ text: 'Ошибка' });
  }
});

async function deleteAllUserData(userId: number): Promise<void> {
  // Collect IDs needed for cascading deletes
  const userOfferIds = (
    await db.select({ id: schema.userOffers.id }).from(schema.userOffers)
      .where(eq(schema.userOffers.userId, userId))
  ).map((r) => r.id);

  const offerIds = (
    await db.select({ id: schema.offers.id }).from(schema.offers)
      .where(eq(schema.offers.authorId, userId))
  ).map((r) => r.id);

  // Delete from leaf tables first (FK order)
  if (userOfferIds.length > 0 || offerIds.length > 0) {
    // exchange_history references matches, user_offers, offers, users
    await db.delete(schema.exchangeHistory).where(
      or(
        eq(schema.exchangeHistory.initiatorUserId, userId),
        eq(schema.exchangeHistory.counterpartyUserId, userId),
      ),
    );

    // matches reference user_offers and offers
    if (userOfferIds.length > 0) {
      await db.delete(schema.matches).where(
        inArray(schema.matches.userOfferId, userOfferIds),
      );
    }
    if (offerIds.length > 0) {
      await db.delete(schema.matches).where(
        inArray(schema.matches.matchedOfferId, offerIds),
      );
    }
  }

  // error_offers reference offers and users
  if (offerIds.length > 0) {
    await db.delete(schema.errorOffers).where(
      inArray(schema.errorOffers.offerId, offerIds),
    );
  }
  await db.delete(schema.errorOffers).where(eq(schema.errorOffers.reportedBy, userId));

  // Now safe to delete offers and user_offers
  if (userOfferIds.length > 0) {
    await db.delete(schema.userOffers).where(eq(schema.userOffers.userId, userId));
  }
  if (offerIds.length > 0) {
    await db.delete(schema.offers).where(eq(schema.offers.authorId, userId));
  }

  await db.delete(schema.offerRequests).where(eq(schema.offerRequests.userId, userId));
  await db.delete(schema.referralCodes).where(eq(schema.referralCodes.userId, userId));
  await db.delete(schema.groupMembers).where(eq(schema.groupMembers.userId, userId));

  // Trust relations — both directions
  await db.delete(schema.trustRelations).where(
    or(
      eq(schema.trustRelations.userId, userId),
      eq(schema.trustRelations.targetUserId, userId),
    ),
  );

  // Finally delete the user
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

// Catch-all error handler
bot.catch((err) => {
  console.error('Bot error:', err);
  void debugError('Bot error (catch-all)', err.error, {
    update: err.ctx?.update?.update_id,
  });
});
