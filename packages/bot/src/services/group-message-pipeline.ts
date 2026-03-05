import { LlmClient } from '@hawala/llm-client';
import { hasPaymentMethodOverlap, type GroupMessage, type ParsedOffer, type ParsedPaymentMethodGroup, type Visibility } from '@hawala/shared';
import { and, eq, ne } from 'drizzle-orm';
import { config } from '../config';
import { db, schema } from '../db';
import { debugError, debugLog } from './debug-chat';
import { getRate } from './rates';
import { upsertGroupMember, upsertUser } from './user-event-tracker';

interface BufferedGroupMessage {
  text: string;
  chatId: number;
  chatTitle: string;
  messageId: number;
  messageThreadId?: number;
  authorTelegramId: number;
  authorUsername: string | null;
  authorFirstName: string;
}

interface PersistedOffer {
  id: number;
  authorId: number;
  authorUsername?: string;
  authorFirstName: string;
  groupName: string;
  groupId: number;
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  amountCurrency?: string;
  partial: boolean;
  partialThreshold: number;
  takePaymentMethods: ParsedPaymentMethodGroup[];
  givePaymentMethods: ParsedPaymentMethodGroup[];
  originalMessageText: string;
  chatId: number;
  messageId: number;
  messageThreadId?: number;
}

interface MatchCandidate {
  userOfferId: number;
  userId: number;
  userTelegramId: number;
  visibility: Visibility;
  minSplitAmount: number;
  paymentMethods: string;
}

type InlineButton = { text: string; callback_data: string } | { text: string; url: string };

interface MatchNotificationKeyboard {
  inline_keyboard: InlineButton[][];
}

interface GroupMessagePipelineOptions {
  sendDirectMessage: (telegramId: number, text: string, options?: {
    parse_mode?: 'Markdown' | 'HTML';
    reply_markup?: MatchNotificationKeyboard;
  }) => Promise<void>;
  setMessageReaction?: (chatId: number, messageId: number, emoji: string) => Promise<void>;
}

export class GroupMessagePipeline {
  private readonly llmClient = new LlmClient({
    apiKey: config.openrouterApiKey,
    model: config.openrouterModel,
  });

  private readonly bufferedByChat = new Map<number, BufferedGroupMessage[]>();
  private readonly flushTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly flushingChats = new Set<number>();
  private readonly trustedGroupIds = new Set(config.trustedGroupIds);
  private readonly options: GroupMessagePipelineOptions;

  constructor(options: GroupMessagePipelineOptions) {
    this.options = options;
  }

  enqueue(message: BufferedGroupMessage): void {
    if (!this.isTrustedChat(message.chatId)) return;
    if (!this.isAllowedTopic(message.chatId, message.messageThreadId)) return;

    const authorLabel = message.authorUsername ?? String(message.authorTelegramId);
    const textPreview = message.text.length > 120 ? `${message.text.slice(0, 117)}...` : message.text;
    console.log(
      '[GroupMessage] chatId=%d msgId=%d author=%s topic=%s text="%s"',
      message.chatId,
      message.messageId,
      authorLabel,
      message.messageThreadId ?? '-',
      textPreview.replace(/\n/g, '↵'),
    );

    const queue = this.bufferedByChat.get(message.chatId) ?? [];
    queue.push(message);
    this.bufferedByChat.set(message.chatId, queue);

    const queueSize = queue.length;
    const batchSize = config.messageBatchSize;
    const flushMs = config.messageBatchFlushMs;

    if (queueSize >= batchSize) {
      console.log(
        '[Pipeline] TRIGGER=batch_full chatId=%d queueSize=%d batchSize=%d → flushing immediately',
        message.chatId,
        queueSize,
        batchSize,
      );
      void this.flushChat(message.chatId, 'batch_full');
      return;
    }

    if (!config.dev) {
      console.log(
        '[Pipeline] TRIGGER=waiting_for_batch chatId=%d queueSize=%d batchSize=%d (dev=false, no timer)',
        message.chatId,
        queueSize,
        batchSize,
      );
      return;
    }

    console.log(
      '[Pipeline] TRIGGER=timer_scheduled chatId=%d queueSize=%d batchSize=%d flushMs=%d',
      message.chatId,
      queueSize,
      batchSize,
      flushMs,
    );
    this.scheduleFlush(message.chatId);
  }

  private isTrustedChat(chatId: number): boolean {
    if (this.trustedGroupIds.size === 0) return true;
    return this.trustedGroupIds.has(chatId);
  }

  private isAllowedTopic(chatId: number, messageThreadId?: number): boolean {
    const allowedTopics = config.trustedGroupTopics.get(chatId);
    if (!allowedTopics) return true;

    // In forum groups, General topic often omits message_thread_id — treat as topic 1
    const topicId = messageThreadId ?? 1;
    return allowedTopics.has(topicId);
  }

  private scheduleFlush(chatId: number): void {
    if (this.flushTimers.has(chatId)) return;

    const flushMs = config.messageBatchFlushMs;
    const timer = setTimeout(() => {
      this.flushTimers.delete(chatId);
      const queueSize = this.bufferedByChat.get(chatId)?.length ?? 0;
      console.log(
        '[Pipeline] TRIGGER=timer chatId=%d queueSize=%d flushMs=%d → flushing',
        chatId,
        queueSize,
        flushMs,
      );
      void this.flushChat(chatId, 'timer');
    }, flushMs);

    this.flushTimers.set(chatId, timer);
  }

  private clearFlushTimer(chatId: number): void {
    const timer = this.flushTimers.get(chatId);
    if (!timer) return;
    clearTimeout(timer);
    this.flushTimers.delete(chatId);
  }

  private async flushChat(chatId: number, trigger: 'batch_full' | 'timer'): Promise<void> {
    if (this.flushingChats.has(chatId)) return;

    const queue = this.bufferedByChat.get(chatId);
    if (!queue || queue.length === 0) return;

    this.flushingChats.add(chatId);
    this.clearFlushTimer(chatId);

    const initialQueueSize = queue.length;
    console.log(
      '[Pipeline] flushChat START chatId=%d trigger=%s queueSize=%d batchSize=%d',
      chatId,
      trigger,
      initialQueueSize,
      config.messageBatchSize,
    );

    try {
      let batchIndex = 0;
      while (true) {
        const currentQueue = this.bufferedByChat.get(chatId);
        if (!currentQueue || currentQueue.length === 0) break;

        const canTakeFullBatch = currentQueue.length >= config.messageBatchSize;
        if (!canTakeFullBatch && trigger !== 'timer') break;

        const takeSize = canTakeFullBatch
          ? config.messageBatchSize
          : currentQueue.length;
        const batch = currentQueue.splice(0, takeSize);
        batchIndex++;

        console.log(
          '[Pipeline] processBatch #%d chatId=%d batchSize=%d remainingInQueue=%d',
          batchIndex,
          chatId,
          batch.length,
          this.bufferedByChat.get(chatId)?.length ?? 0,
        );
        await this.processBatch(batch, trigger);
      }
    } finally {
      const currentQueue = this.bufferedByChat.get(chatId);
      if (!currentQueue || currentQueue.length === 0) {
        this.bufferedByChat.delete(chatId);
        console.log('[Pipeline] flushChat END chatId=%d queue emptied', chatId);
      } else if (config.dev) {
        this.scheduleFlush(chatId);
        console.log(
          '[Pipeline] flushChat END chatId=%d remaining=%d → rescheduled timer',
          chatId,
          currentQueue.length,
        );
      } else {
        console.log(
          '[Pipeline] flushChat END chatId=%d remaining=%d (dev=false, no timer)',
          chatId,
          currentQueue.length,
        );
      }
      this.flushingChats.delete(chatId);
    }
  }

  private async processBatch(batch: BufferedGroupMessage[], trigger: 'batch_full' | 'timer'): Promise<void> {
    const chatId = batch[0]?.chatId;
    const batchSize = batch.length;

    console.log(
      '[Pipeline] processBatch START chatId=%d trigger=%s batchSize=%d',
      chatId ?? 0,
      trigger,
      batchSize,
    );

    await this.upsertGroupMembersFromBatch(batch);

    if (
      chatId != null &&
      config.skipBatchOnNewMessage &&
      (this.bufferedByChat.get(chatId)?.length ?? 0) > 0
    ) {
      const queue = this.bufferedByChat.get(chatId) ?? [];
      queue.unshift(...batch);
      this.bufferedByChat.set(chatId, queue);
      console.log(
        '[Pipeline] skipBatchOnNewMessage: batch put back chatId=%d batchSize=%d queueSize=%d',
        chatId,
        batch.length,
        queue.length,
      );
      return;
    }

    const llmMessages: GroupMessage[] = batch.map((message, index) => ({
      index,
      text: message.text,
      authorTelegramId: message.authorTelegramId,
      messageId: message.messageId,
      chatId: message.chatId,
    }));

    const previews = batch
      .map((m) => m.text.slice(0, 20).replace(/\n/g, '↵'))
      .join(' | ');
    console.log(
      '[Pipeline] LLM REQUEST chatId=%d batchSize=%d previews="%s"',
      chatId ?? 0,
      batchSize,
      previews.length > 100 ? previews.slice(0, 97) + '...' : previews,
    );

    const llmStartMs = Date.now();
    let parsedOffers: ParsedOffer[] = [];
    try {
      parsedOffers = await this.llmClient.parseExchangeOffers(llmMessages);
    } catch (error) {
      const elapsedMs = Date.now() - llmStartMs;
      console.error(
        '[Pipeline] LLM FAILED chatId=%d elapsedMs=%d error=%s',
        chatId ?? 0,
        elapsedMs,
        error instanceof Error ? error.message : String(error),
      );
      void debugError('LLM parse failed', error, { chatId, elapsedMs, batchSize });
      return;
    }

    const llmElapsedMs = Date.now() - llmStartMs;
    const exchangeOffersCount = parsedOffers.filter((o) => o.isExchangeOffer).length;
    console.log(
      '[Pipeline] LLM RESPONSE chatId=%d elapsedMs=%d parsed=%d exchangeOffers=%d',
      chatId ?? 0,
      llmElapsedMs,
      parsedOffers.length,
      exchangeOffersCount,
    );

    void debugLog('🤖', 'AI вердикт', {
      chatId,
      batchSize,
      elapsedMs: llmElapsedMs,
      parsed: parsedOffers.length,
      exchangeOffers: exchangeOffersCount,
      verdicts: parsedOffers.map((o, i) => ({
        msg: batch[i]?.text.slice(0, 60),
        isOffer: o.isExchangeOffer,
        ...(o.isExchangeOffer ? { amount: o.amount, from: o.givePaymentMethods[0]?.currency, to: o.takePaymentMethods[0]?.currency } : {}),
      })),
    });

    let persistedCount = 0;
    let notifiedCount = 0;

    for (const parsedOffer of parsedOffers) {
      const persistedOffer = await this.persistOffer(parsedOffer, batch);
      if (!persistedOffer) continue;

      persistedCount++;
      const notified = await this.createMatchesAndNotify(persistedOffer);
      notifiedCount += notified;
    }

    console.log(
      '[Pipeline] processBatch END chatId=%d persisted=%d notified=%d totalElapsedMs=%d',
      chatId ?? 0,
      persistedCount,
      notifiedCount,
      Date.now() - llmStartMs,
    );
  }

  private async persistOffer(
    parsedOffer: ParsedOffer,
    batch: BufferedGroupMessage[],
  ): Promise<PersistedOffer | null> {
    if (!parsedOffer.isExchangeOffer) return null;
    if (parsedOffer.amount == null || parsedOffer.amount <= 0) return null;

    const fromCurrency = parsedOffer.givePaymentMethods[0]?.currency ?? null;
    const toCurrency = parsedOffer.takePaymentMethods[0]?.currency ?? null;
    if (!fromCurrency || !toCurrency) return null;

    const source = batch[parsedOffer.messageIndex];
    if (!source) return null;

    const user = await this.upsertUser(source);
    const trustedGroup = await this.upsertTrustedGroup(source);

    const [existingOffer] = await db
      .select({ id: schema.offers.id })
      .from(schema.offers)
      .where(
        and(
          eq(schema.offers.groupId, trustedGroup.id),
          eq(schema.offers.telegramMessageId, source.messageId),
        ),
      )
      .limit(1);

    if (existingOffer) {
      return null;
    }

    const paymentMethodsJson = JSON.stringify({
      take: parsedOffer.takePaymentMethods,
      give: parsedOffer.givePaymentMethods,
    });

    const [insertedOffer] = await db
      .insert(schema.offers)
      .values({
        authorId: user.id,
        groupId: trustedGroup.id,
        telegramMessageId: source.messageId,
        fromCurrency,
        toCurrency,
        amount: parsedOffer.amount,
        amountCurrency: parsedOffer.amountCurrency,
        partial: parsedOffer.partial,
        partialThreshold: parsedOffer.partialThreshold,
        paymentMethods: paymentMethodsJson,
        status: 'active',
        isLlmParsed: true,
        originalMessageText: source.text,
      })
      .returning({
        id: schema.offers.id,
        authorId: schema.offers.authorId,
      });

    void debugLog('✅', 'Заявка из чата', {
      offerId: insertedOffer.id,
      author: source.authorUsername ?? String(source.authorTelegramId),
      direction: `${fromCurrency} → ${toCurrency}`,
      amount: parsedOffer.amount,
      partial: parsedOffer.partial,
      chatId: source.chatId,
      msgId: source.messageId,
    });

    if (config.reactToParsedOffers && this.options.setMessageReaction) {
      try {
        await this.options.setMessageReaction(source.chatId, source.messageId, '👍');
      } catch (err) {
        console.error('[Pipeline] Failed to set reaction chatId=%d msgId=%d:', source.chatId, source.messageId, err);
        void debugError('Failed to set reaction', err, { chatId: source.chatId, msgId: source.messageId });
      }
    }

    return {
      id: insertedOffer.id,
      authorId: insertedOffer.authorId,
      authorUsername: source.authorUsername ?? undefined,
      authorFirstName: source.authorFirstName || 'Unknown',
      groupName: source.chatTitle || String(source.chatId),
      groupId: trustedGroup.id,
      fromCurrency,
      toCurrency,
      amount: parsedOffer.amount,
      amountCurrency: parsedOffer.amountCurrency ?? undefined,
      partial: parsedOffer.partial,
      partialThreshold: parsedOffer.partialThreshold,
      takePaymentMethods: parsedOffer.takePaymentMethods,
      givePaymentMethods: parsedOffer.givePaymentMethods,
      originalMessageText: source.text,
      chatId: source.chatId,
      messageId: source.messageId,
      messageThreadId: source.messageThreadId,
    };
  }

  async handleEditedMessage(chatId: number, messageId: number, newText: string): Promise<void> {
    if (!this.isTrustedChat(chatId)) return;

    // Find the offer by telegram message ID + group
    const [group] = await db
      .select({ id: schema.trustedGroups.id })
      .from(schema.trustedGroups)
      .where(eq(schema.trustedGroups.telegramChatId, chatId))
      .limit(1);

    if (!group) return;

    const [existingOffer] = await db
      .select({
        id: schema.offers.id,
        originalMessageText: schema.offers.originalMessageText,
        status: schema.offers.status,
      })
      .from(schema.offers)
      .where(
        and(
          eq(schema.offers.groupId, group.id),
          eq(schema.offers.telegramMessageId, messageId),
          eq(schema.offers.status, 'active'),
        ),
      )
      .limit(1);

    if (!existingOffer || !existingOffer.originalMessageText) return;

    const oldText = existingOffer.originalMessageText;
    if (oldText === newText) return;

    console.log(
      '[Pipeline] EDIT chatId=%d msgId=%d offerId=%d',
      chatId,
      messageId,
      existingOffer.id,
    );

    let editAction;
    try {
      editAction = await this.llmClient.analyzeOfferEdit(oldText, newText, config.openrouterSmartModel);
    } catch (error) {
      console.error(
        '[Pipeline] LLM edit analysis failed offerId=%d:',
        existingOffer.id,
        error instanceof Error ? error.message : String(error),
      );
      void debugError('LLM edit analysis failed', error, { offerId: existingOffer.id, chatId, messageId });
      return;
    }

    console.log(
      '[Pipeline] EDIT RESULT offerId=%d action=%s',
      existingOffer.id,
      editAction.action,
    );

    void debugLog('✏️', 'Сообщение отредактировано', {
      offerId: existingOffer.id,
      chatId,
      messageId,
      action: editAction.action,
      ...(editAction.action === 'update' && editAction.updates ? { updates: editAction.updates } : {}),
    });

    if (editAction.action === 'delete') {
      await db
        .update(schema.offers)
        .set({ status: 'cancelled', updatedAt: new Date(), originalMessageText: newText })
        .where(eq(schema.offers.id, existingOffer.id));

      console.log('[Pipeline] EDIT → CANCELLED offerId=%d', existingOffer.id);
      return;
    }

    if (editAction.action === 'update' && editAction.updates) {
      const u = editAction.updates;
      const set: Record<string, unknown> = {
        updatedAt: new Date(),
        originalMessageText: newText,
      };

      if (u.amount != null) set.amount = u.amount;
      if (u.amountCurrency) set.amountCurrency = u.amountCurrency;
      if (u.fromCurrency) set.fromCurrency = u.fromCurrency;
      if (u.toCurrency) set.toCurrency = u.toCurrency;
      if (u.partial != null) set.partial = u.partial;
      if (u.partialThreshold != null) set.partialThreshold = u.partialThreshold;
      if (u.takePaymentMethods || u.givePaymentMethods) {
        // Need to merge with existing payment methods if only one side changed
        const existing = await db
          .select({ paymentMethods: schema.offers.paymentMethods })
          .from(schema.offers)
          .where(eq(schema.offers.id, existingOffer.id))
          .limit(1);
        const currentPM = JSON.parse(existing[0]?.paymentMethods ?? '{"take":[],"give":[]}');
        set.paymentMethods = JSON.stringify({
          take: u.takePaymentMethods ?? currentPM.take,
          give: u.givePaymentMethods ?? currentPM.give,
        });
      }

      await db
        .update(schema.offers)
        .set(set)
        .where(eq(schema.offers.id, existingOffer.id));

      console.log(
        '[Pipeline] EDIT → UPDATED offerId=%d fields=%s',
        existingOffer.id,
        Object.keys(set).filter((k) => k !== 'updatedAt' && k !== 'originalMessageText').join(','),
      );
      return;
    }

    // no_change — just update the stored text
    await db
      .update(schema.offers)
      .set({ originalMessageText: newText, updatedAt: new Date() })
      .where(eq(schema.offers.id, existingOffer.id));
  }

  private async upsertUser(message: BufferedGroupMessage): Promise<{ id: number }> {
    return upsertUser({
      id: message.authorTelegramId,
      username: message.authorUsername ?? undefined,
      first_name: message.authorFirstName || 'Unknown',
    });
  }

  private async upsertTrustedGroup(message: BufferedGroupMessage): Promise<{ id: number }> {
    const [group] = await db
      .insert(schema.trustedGroups)
      .values({
        telegramChatId: message.chatId,
        name: message.chatTitle || String(message.chatId),
        addedFromConfig: this.trustedGroupIds.has(message.chatId),
      })
      .onConflictDoUpdate({
        target: schema.trustedGroups.telegramChatId,
        set: {
          name: message.chatTitle || String(message.chatId),
        },
      })
      .returning({ id: schema.trustedGroups.id });

    return group;
  }

  private async upsertGroupMembersFromBatch(batch: BufferedGroupMessage[]): Promise<void> {
    const seen = new Map<number, Set<number>>();

    for (const msg of batch) {
      if (msg.authorTelegramId) {
        let authors = seen.get(msg.chatId);
        if (!authors) {
          authors = new Set();
          seen.set(msg.chatId, authors);
        }
        if (authors.has(msg.authorTelegramId)) continue;
        authors.add(msg.authorTelegramId);
      }
    }

    for (const [chatId, authorIds] of seen) {
      const first = batch.find((m) => m.chatId === chatId);
      if (!first) continue;

      const chatTitle = first.chatTitle || String(chatId);
      for (const authorTelegramId of authorIds) {
        const authorMsg = batch.find(
          (m) => m.chatId === chatId && m.authorTelegramId === authorTelegramId,
        );
        if (!authorMsg) continue;

        await upsertGroupMember(chatId, chatTitle, {
          id: authorMsg.authorTelegramId,
          username: authorMsg.authorUsername ?? undefined,
          first_name: authorMsg.authorFirstName || 'Unknown',
        });
      }
    }
  }

  private async createMatchesAndNotify(offer: PersistedOffer): Promise<number> {
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
          ...(config.dev ? [] : [ne(schema.userOffers.userId, offer.authorId)]),
        ),
      );

    let notified = 0;
    for (const candidate of candidates) {
      // Convert offer amount to candidate's fromCurrency for comparison
      const offerAmountCurrency = offer.amountCurrency ?? offer.fromCurrency;
      let offerAmountConverted = offer.amount;
      if (offerAmountCurrency !== candidate.fromCurrency) {
        const rate = getRate(offerAmountCurrency, candidate.fromCurrency);
        if (!rate) continue; // can't compare without rate
        offerAmountConverted = offer.amount * rate;
      }

      // Offer must meet candidate's minimum split amount
      if (offerAmountConverted < candidate.minSplitAmount) {
        continue;
      }

      // Offer must fit within candidate's total amount, unless offer author allows partial
      if (offerAmountConverted > candidate.amount && !offer.partial) {
        continue;
      }

      // Payment method compatibility:
      // offer.give ↔ userOffer.take (for offer.fromCurrency)
      // offer.take ↔ userOffer.give (for offer.toCurrency)
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

      const isVisible = await this.isOfferVisibleToUser(
        candidate.userId,
        offer.authorId,
        candidate.visibility,
      );
      if (!isVisible) continue;

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

      const [insertedMatch] = await db
        .insert(schema.matches)
        .values({
          userOfferId: candidate.userOfferId,
          matchedOfferId: offer.id,
          status: 'pending',
        })
        .returning({ id: schema.matches.id });

      const text = this.buildMatchNotificationText(offer);
      const keyboard = this.buildMatchResultKeyboard(insertedMatch.id, offer);

      void debugLog('🎯', 'Мэтч найден', {
        matchId: insertedMatch.id,
        offerId: offer.id,
        userOfferId: candidate.userOfferId,
        direction: `${offer.fromCurrency} → ${offer.toCurrency}`,
        notifyTelegramId: candidate.userTelegramId,
      });

      await this.safeSendDirectMessage(candidate.userTelegramId, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      notified++;
    }
    return notified;
  }

  private async isOfferVisibleToUser(
    userId: number,
    targetAuthorId: number,
    visibility: Visibility,
  ): Promise<boolean> {
    if (visibility === 'friends_and_acquaintances') {
      return true;
    }

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

  private buildMatchNotificationText(offer: PersistedOffer): string {
    const link = this.buildTelegramMessageLink(
      offer.chatId,
      offer.messageId,
      offer.messageThreadId,
    );

    const rate = getRate(offer.fromCurrency, offer.toCurrency);
    const fromAmount = offer.amount;
    const toAmount = rate ? fromAmount * rate : null;

    const formattedFromAmount = fromAmount.toLocaleString('ru-RU', { 
      maximumFractionDigits: 2 
    });
    const formattedToAmount = toAmount 
      ? toAmount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
      : '?';

    const snippet = offer.originalMessageText.length > 600
      ? `${offer.originalMessageText.slice(0, 597)}...`
      : offer.originalMessageText;

    return [
      '🎉 *Нашлась подходящая заявка на обмен!*',
      '',
      `*${formattedFromAmount} ${offer.fromCurrency}* → *${formattedToAmount} ${offer.toCurrency}*`,
      '',
      `[Оригинальное сообщение в группе](${link})`,
      '```',
      snippet,
      '```',
      '',
      '_После обмена, пожалуйста, нажмите одну из кнопок ниже_',
    ].join('\n');
  }

  private buildMatchResultKeyboard(matchId: number, offer: PersistedOffer): MatchNotificationKeyboard {
    const rows: MatchNotificationKeyboard['inline_keyboard'] = [];

    if (offer.authorUsername) {
      const dmText = `Привет! Нашёл твою заявку на обмен ${offer.fromCurrency} → ${offer.toCurrency} в «${offer.groupName}»`;
      const url = `https://t.me/${offer.authorUsername}?text=${encodeURIComponent(dmText)}`;
      rows.push([{ text: '💬 Перейти в личку', url }]);
    }

    rows.push(
      [{ text: '✅ Успешно поменялся', callback_data: `match_success:${matchId}` }],
      [{ text: '❌ Неуспех / ошибка', callback_data: `match_error:${matchId}` }],
    );

    return { inline_keyboard: rows };
  }

  private buildTelegramMessageLink(
    chatId: number,
    messageId: number,
    messageThreadId?: number,
  ): string {
    const normalizedChatId = String(chatId).replace('-100', '');
    if (typeof messageThreadId === 'number') {
      return `https://t.me/c/${normalizedChatId}/${messageThreadId}/${messageId}`;
    }

    return `https://t.me/c/${normalizedChatId}/${messageId}`;
  }

  private async safeSendDirectMessage(
    telegramId: number, 
    text: string,
    options?: { 
      parse_mode?: 'Markdown' | 'HTML';
      reply_markup?: MatchNotificationKeyboard;
    },
  ): Promise<void> {
    try {
      await this.options.sendDirectMessage(telegramId, text, options);
    } catch (error) {
      console.error(`Failed to send DM notification to user ${telegramId}`, error);
      void debugError('Failed to send DM', error, { telegramId });
    }
  }
}
