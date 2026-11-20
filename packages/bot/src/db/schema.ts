import { pgTable as table } from 'drizzle-orm/pg-core';
import * as t from 'drizzle-orm/pg-core';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function generateBase58Code(length = 4): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += BASE58_ALPHABET[Math.floor(Math.random() * BASE58_ALPHABET.length)];
  }
  return code;
}

export const users = table(
  'users',
  {
    id: t.serial().primaryKey(),
    telegramId: t.bigint('telegram_id', { mode: 'number' }).notNull().unique(),
    username: t.text(),
    firstName: t.text('first_name').notNull(),
    language: t.text({ enum: ['ru', 'en'] }).notNull().default('en'),
    avatarUrl: t.text('avatar_url'),
    notifyOnFriendAdd: t.boolean('notify_on_friend_add').notNull().default(true),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
    updatedAt: t.timestamp('updated_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
);

export const trustRelations = table(
  'trust_relations',
  {
    id: t.serial().primaryKey(),
    userId: t.integer('user_id').notNull().references(() => users.id),
    targetUserId: t.integer('target_user_id').notNull().references(() => users.id),
    type: t.text({ enum: ['friend', 'acquaintance'] }).notNull(),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
  (tbl) => [
    t.uniqueIndex('trust_user_target_idx').on(tbl.userId, tbl.targetUserId),
  ],
);

export const trustedGroups = table(
  'trusted_groups',
  {
    id: t.serial().primaryKey(),
    telegramChatId: t.bigint('telegram_chat_id', { mode: 'number' }).notNull().unique(),
    name: t.text().notNull(),
    link: t.text(),
    addedFromConfig: t.boolean('added_from_config').notNull().default(false),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
);

export const groupMembers = table(
  'group_members',
  {
    id: t.serial().primaryKey(),
    groupId: t.integer('group_id').notNull().references(() => trustedGroups.id),
    userId: t.integer('user_id').notNull().references(() => users.id),
    joinedAt: t.timestamp('joined_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
  (tbl) => [
    t.uniqueIndex('group_member_idx').on(tbl.groupId, tbl.userId),
  ],
);

export const offers = table(
  'offers',
  {
    id: t.serial().primaryKey(),
    authorId: t.integer('author_id').notNull().references(() => users.id),
    groupId: t.integer('group_id').notNull().references(() => trustedGroups.id),
    telegramMessageId: t.bigint('telegram_message_id', { mode: 'number' }).notNull(),
    fromCurrency: t.text('from_currency').notNull(),
    toCurrency: t.text('to_currency').notNull(),
    amount: t.doublePrecision().notNull(),
    amountCurrency: t.text('amount_currency'),
    paymentMethods: t.text('payment_methods').notNull().default('[]'),
    partial: t.boolean().notNull().default(false),
    partialThreshold: t.doublePrecision('partial_threshold').notNull().default(0),
    status: t.text({ enum: ['active', 'matched', 'cancelled', 'error'] }).notNull().default('active'),
    isLlmParsed: t.boolean('is_llm_parsed').notNull().default(true),
    originalMessageText: t.text('original_message_text'),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
    updatedAt: t.timestamp('updated_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
);

export const userOffers = table(
  'user_offers',
  {
    id: t.serial().primaryKey(),
    userId: t.integer('user_id').notNull().references(() => users.id),
    fromCurrency: t.text('from_currency').notNull(),
    toCurrency: t.text('to_currency').notNull(),
    amount: t.doublePrecision().notNull(),
    minSplitAmount: t.doublePrecision('min_split_amount').notNull(),
    paymentMethods: t.text('payment_methods').notNull().default('{"take":[],"give":[]}'),
    visibility: t.text({ enum: ['friends_only', 'friends_and_acquaintances'] }).notNull().default('friends_and_acquaintances'),
    visibleTo: t.text('visible_to'),
    status: t.text({ enum: ['active', 'matched', 'cancelled'] }).notNull().default('active'),
    notifyOnMatch: t.boolean('notify_on_match').notNull().default(true),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
    updatedAt: t.timestamp('updated_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
);

export const matches = table(
  'matches',
  {
    id: t.serial().primaryKey(),
    userOfferId: t.integer('user_offer_id').notNull().references(() => userOffers.id),
    matchedOfferId: t.integer('matched_offer_id').notNull().references(() => offers.id),
    status: t.text({ enum: ['pending', 'accepted', 'error_flagged'] }).notNull().default('pending'),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
    updatedAt: t.timestamp('updated_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
);

export const errorOffers = table(
  'error_offers',
  {
    id: t.serial().primaryKey(),
    offerId: t.integer('offer_id').notNull().references(() => offers.id),
    reportedBy: t.integer('reported_by').notNull().references(() => users.id),
    reason: t.text(),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
);

export const exchangeHistory = table(
  'exchange_history',
  {
    id: t.serial().primaryKey(),
    userOfferId: t.integer('user_offer_id').notNull().references(() => userOffers.id),
    matchedOfferId: t.integer('matched_offer_id').notNull().references(() => offers.id),
    matchId: t.integer('match_id').notNull().references(() => matches.id),
    initiatorUserId: t.integer('initiator_user_id').notNull().references(() => users.id),
    counterpartyUserId: t.integer('counterparty_user_id').notNull().references(() => users.id),
    groupId: t.integer('group_id').notNull().references(() => trustedGroups.id),
    fromCurrency: t.text('from_currency').notNull(),
    toCurrency: t.text('to_currency').notNull(),
    amount: t.doublePrecision().notNull(),
    convertedAmount: t.doublePrecision('converted_amount'),
    exchangeRate: t.doublePrecision('exchange_rate'),
    success: t.boolean().notNull(),
    errorReason: t.text('error_reason'),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
  (tbl) => [
    t.index('exchange_history_initiator_idx').on(tbl.initiatorUserId),
    t.index('exchange_history_counterparty_idx').on(tbl.counterpartyUserId),
    t.index('exchange_history_group_idx').on(tbl.groupId),
  ],
);

export const referralCodes = table(
  'referral_codes',
  {
    id: t.serial().primaryKey(),
    code: t.text().notNull().unique(),
    userId: t.integer('user_id').notNull().references(() => users.id).unique(),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
);

export const blacklist = table(
  'blacklist',
  {
    id: t.serial().primaryKey(),
    telegramId: t.bigint('telegram_id', { mode: 'number' }).notNull().unique(),
    reason: t.text(),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
);

export const offerRequests = table(
  'offer_requests',
  {
    id: t.serial().primaryKey(),
    userId: t.integer('user_id').notNull().references(() => users.id),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
  (tbl) => [
    t.index('offer_requests_user_created_idx').on(tbl.userId, tbl.createdAt),
  ],
);
