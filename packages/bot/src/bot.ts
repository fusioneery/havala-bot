import { and, eq, inArray, or } from 'drizzle-orm';
import { Bot, InlineKeyboard } from 'grammy';
import { config } from './config';
import { db, schema } from './db';
import { getBotCopy, getStoredLanguage, getTrustTypeLabel, resolveBotLanguage } from './lib/i18n';
import { addToBlacklist } from './services/blacklist';
import { handleChatMemberUpdate } from './services/chat-member-handler';
import { debugError, debugLog } from './services/debug-chat';
import { GroupMessagePipeline } from './services/group-message-pipeline';
import { getRate } from './services/rates';
import { trackUserFromContext } from './services/user-event-tracker';

export const bot = new Bot(config.botToken);

const pendingErrorReports = new Map<number, number>();

const GROUP_LABEL_CACHE_TTL_MS = 10 * 60 * 1000;
type GroupLabel = { label: string; username?: string };
let cachedGroupLabels: GroupLabel[] = [];
let groupLabelCacheValidUntil = 0;

function getContextCopy(ctx: { from?: { language_code?: string } | undefined }) {
  return getBotCopy(resolveBotLanguage({ locale: ctx.from?.language_code }));
}

const groupMessagePipeline = new GroupMessagePipeline({
  sendDirectMessage: async (telegramId, text, options) => {
    await bot.api.sendMessage(telegramId, text, options);
  },
  setMessageReaction: async (chatId, messageId, emoji) => {
    await bot.api.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: emoji as '👍' }]);
  },
});

async function getTrustedGroupLabels(): Promise<GroupLabel[]> {
  const now = Date.now();
  if (groupLabelCacheValidUntil > now) return cachedGroupLabels;

  const ids = config.trustedGroupIds;
  if (ids.length === 0) {
    cachedGroupLabels = [];
    groupLabelCacheValidUntil = now + GROUP_LABEL_CACHE_TTL_MS;
    return cachedGroupLabels;
  }

  const labels: GroupLabel[] = [];
  await Promise.all(
    ids.map(async (chatId) => {
      try {
        const chat = await bot.api.getChat(chatId);
        const title = 'title' in chat && chat.title ? chat.title : undefined;
        const username = 'username' in chat && chat.username ? chat.username : undefined;
        if (title || username) {
          labels.push({ label: title ?? `@${username}`, username });
        }
      } catch {
        // group unreachable
      }
    }),
  );

  cachedGroupLabels = labels.sort((a, b) => a.label.localeCompare(b.label));
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
  const copy = getContextCopy(ctx);

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
      await ctx.reply(copy.matchNotFound);
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
      await ctx.reply(copy.dataNotFound);
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
      copy.thanksForFeedback,
    );
  } catch (error) {
    console.error('Error handling error report:', error);
    void debugError('Error report handler failed', error, { matchId: pendingMatchId });
    await ctx.reply(copy.feedbackSaveError);
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
  const copy = getContextCopy(ctx);

  const payload = ctx.match?.trim();
  let referrerUser: { id: number; firstName: string; telegramId: number; language: string } | null = null;

  // Handle deal link: ?start=1{4-char-code} (prefix 1 = no friendship, just onboard)
  if (payload?.startsWith('1') && payload.length === 5) {
    // Deal codes identify the sender but intentionally skip friendship creation.
    // Friendship is established later when a match participant clicks "Успешно".
  }

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
            language: schema.users.language,
            telegramId: schema.users.telegramId,
            notifyOnFriendAdd: schema.users.notifyOnFriendAdd,
          })
          .from(schema.users)
          .where(eq(schema.users.id, refCodeRow.userId))
          .limit(1);

        // Don't add yourself as friend
        if (currentUser && referrer && referrer.telegramId !== user.id) {
          // Check if friendship already exists
          const [existingFriendship] = await db
            .select({ userId: schema.trustRelations.userId })
            .from(schema.trustRelations)
            .where(
              and(
                eq(schema.trustRelations.userId, currentUser.id),
                eq(schema.trustRelations.targetUserId, referrer.id),
              ),
            )
            .limit(1);

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

          // Notify referrer only if this is a NEW friendship
          if (!existingFriendship && referrer.notifyOnFriendAdd) {
            try {
              const referrerCopy = getBotCopy(getStoredLanguage(referrer.language));
              const keyboard = new InlineKeyboard()
                .webApp(referrerCopy.createOffer, config.miniAppUrl)
                .row()
                .text(referrerCopy.toggleFriendNotifyButton(true), 'toggle_friend_notify');

              await bot.api.sendMessage(
                referrer.telegramId,
                referrerCopy.friendAddedNotification(user.first_name),
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
  const groupListText =
    groupLabels.length > 0
      ? ` (${groupLabels
          .map(({ label, username }) =>
            username ? `<a href="https://t.me/${username}">${label}</a>` : label,
          )
          .join(', ')})`
      : '';
  const welcomeText = copy.welcomeText({
    miniAppUrl: config.miniAppUrl,
    groupListText,
    referrerFirstName: referrerUser?.firstName,
  });

  await ctx.reply(welcomeText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: copy.openApp, web_app: { url: config.miniAppUrl } }],
      ],
    },
  });
});

// Handle forwarded messages — add to trust circles (only in private chats)
bot.on('message:forward_origin', async (ctx, next) => {
  if (ctx.chat?.type !== 'private') return next();
  const copy = getContextCopy(ctx);

  const keyboard = new InlineKeyboard()
    .text(copy.trustFriend, 'trust:friend')
    .text(copy.trustAcquaintance, 'trust:acquaintance');

  await ctx.reply(copy.trustPrompt, {
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

bot.callbackQuery(/^trust:/, async (ctx) => {
  const copy = getContextCopy(ctx);
  const type = ctx.callbackQuery.data.replace('trust:', '') as 'friend' | 'acquaintance';
  const label = getTrustTypeLabel(type, resolveBotLanguage({ locale: ctx.from?.language_code }));
  const currentUser = ctx.from;
  const repliedMsg = ctx.callbackQuery.message?.reply_to_message;
  const forwardOrigin = repliedMsg?.forward_origin as {
    sender_user?: { id: number; first_name: string; last_name?: string; username?: string };
    sender_user_name?: string;
  } | undefined;

  const userDisplay = forwardOrigin ? getForwardedUserDisplay(forwardOrigin) : '';
  const suffix = userDisplay ? ` (${userDisplay})` : '';

  if (!forwardOrigin?.sender_user?.id) {
    await ctx.answerCallbackQuery({ text: copy.forwardedUserUnknown });
    return;
  }

  const forwardedTelegramId = forwardOrigin.sender_user.id;

  if (forwardedTelegramId === currentUser.id) {
    await ctx.answerCallbackQuery({ text: copy.cannotAddSelf });
    return;
  }

  try {
    const [dbCurrentUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.telegramId, currentUser.id))
      .limit(1);

    if (!dbCurrentUser) {
      await ctx.answerCallbackQuery({ text: copy.runStartFirst });
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

    await ctx.answerCallbackQuery({ text: copy.addedAs(label) });
    await ctx.editMessageText(copy.addedAsMessage(label, suffix));
  } catch (error) {
    console.error('[trust] Error saving trust relation:', error);
    await ctx.answerCallbackQuery({ text: copy.saveError });
  }
});

bot.callbackQuery(/^match_success:/, async (ctx) => {
  const copy = getContextCopy(ctx);
  const matchId = parseInt(ctx.callbackQuery.data.replace('match_success:', ''), 10);
  if (isNaN(matchId)) {
    await ctx.answerCallbackQuery({ text: copy.invalidId });
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
      await ctx.answerCallbackQuery({ text: copy.matchNotFound });
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
      await ctx.answerCallbackQuery({ text: copy.dataNotFound });
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

    // Create mutual friendship between match participants
    const [initiatorUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, userOffer.userId))
      .limit(1);

    const [counterpartyUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, groupOffer.authorId))
      .limit(1);

    if (initiatorUser && counterpartyUser && initiatorUser.id !== counterpartyUser.id) {
      await db
        .insert(schema.trustRelations)
        .values({ userId: initiatorUser.id, targetUserId: counterpartyUser.id, type: 'friend' })
        .onConflictDoNothing();

      await db
        .insert(schema.trustRelations)
        .values({ userId: counterpartyUser.id, targetUserId: initiatorUser.id, type: 'friend' })
        .onConflictDoNothing();
    }

    void debugLog('✅', 'Обмен успешен', {
      matchId,
      from: `${groupOffer.fromCurrency} → ${groupOffer.toCurrency}`,
      amount: groupOffer.amount,
    });

    await ctx.answerCallbackQuery({ text: copy.exchangeSuccessRecorded });
    await ctx.editMessageText(
      ctx.callbackQuery.message?.text + `\n\n${copy.exchangeSuccessSuffix}`,
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    console.error('Error handling match_success:', error);
    void debugError('match_success handler failed', error, { matchId });
    await ctx.answerCallbackQuery({ text: copy.genericError });
  }
});

bot.callbackQuery(/^match_error:/, async (ctx) => {
  const copy = getContextCopy(ctx);
  const matchId = parseInt(ctx.callbackQuery.data.replace('match_error:', ''), 10);
  const user = ctx.from;

  if (isNaN(matchId) || !user) {
    await ctx.answerCallbackQuery({ text: copy.invalidData });
    return;
  }

  pendingErrorReports.set(user.id, matchId);

  await ctx.answerCallbackQuery();
  await ctx.reply(
    copy.describeProblem,
    { reply_markup: { force_reply: true } },
  );
});

// /friends — list your friends with their Telegram usernames
bot.command('friends', async (ctx) => {
  const user = ctx.from;
  if (!user || ctx.chat?.type !== 'private') return;
  const copy = getContextCopy(ctx);

  const [dbUser] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.telegramId, user.id))
    .limit(1);

  if (!dbUser) {
    await ctx.reply(copy.notRegisteredStart);
    return;
  }

  const friends = await db
    .select({
      firstName: schema.users.firstName,
      username: schema.users.username,
    })
    .from(schema.trustRelations)
    .innerJoin(schema.users, eq(schema.trustRelations.targetUserId, schema.users.id))
    .where(
      and(
        eq(schema.trustRelations.userId, dbUser.id),
        eq(schema.trustRelations.type, 'friend'),
      ),
    );

  if (friends.length === 0) {
    await ctx.reply(copy.noFriends);
    return;
  }

  const lines = friends.map((f) => {
    const name = f.firstName;
    return f.username ? `${name} — @${f.username}` : name;
  });

  await ctx.reply(copy.yourFriends(friends.length, lines));
});

// /deleteaccount — permanently delete all data and self-ban
bot.command('deleteaccount', async (ctx) => {
  const user = ctx.from;
  if (!user || ctx.chat?.type !== 'private') return;
  const copy = getContextCopy(ctx);

  const keyboard = new InlineKeyboard()
    .text(copy.deleteForever, 'confirm_delete_account')
    .row()
    .text(copy.cancel, 'cancel_delete_account');

  await ctx.reply(copy.deleteConfirmation, { reply_markup: keyboard });
});

bot.callbackQuery('confirm_delete_account', async (ctx) => {
  const user = ctx.from;
  if (!user) return;
  const copy = getContextCopy(ctx);

  try {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(copy.deletingData);

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
      copy.accountDeleted,
    );
  } catch (error) {
    console.error('[deleteaccount] Error:', error);
    void debugError('deleteaccount failed', error, { telegramId: user.id });
    await ctx.editMessageText(copy.deleteError);
  }
});

bot.callbackQuery('cancel_delete_account', async (ctx) => {
  const copy = getContextCopy(ctx);
  await ctx.answerCallbackQuery({ text: copy.cancelled });
  await ctx.editMessageText(copy.deleteCancelled);
});

bot.callbackQuery('toggle_friend_notify', async (ctx) => {
  const user = ctx.from;
  if (!user) return;
  const copy = getContextCopy(ctx);

  try {
    const [dbUser] = await db
      .select({ id: schema.users.id, notifyOnFriendAdd: schema.users.notifyOnFriendAdd })
      .from(schema.users)
      .where(eq(schema.users.telegramId, user.id))
      .limit(1);

    if (!dbUser) {
      await ctx.answerCallbackQuery({ text: copy.userNotFound });
      return;
    }

    const newValue = !dbUser.notifyOnFriendAdd;
    await db
      .update(schema.users)
      .set({ notifyOnFriendAdd: newValue, updatedAt: new Date() })
      .where(eq(schema.users.id, dbUser.id));

    const keyboard = new InlineKeyboard()
      .webApp(copy.createOffer, config.miniAppUrl)
      .row()
      .text(copy.toggleFriendNotifyButton(newValue), 'toggle_friend_notify');

    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    await ctx.answerCallbackQuery({
      text: newValue ? copy.notificationsEnabled : copy.notificationsDisabled,
    });
  } catch (error) {
    console.error('[toggle_friend_notify] Error:', error);
    await ctx.answerCallbackQuery({ text: copy.genericError });
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
