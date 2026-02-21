import { sqliteTable as table } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';

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
    id: t.int().primaryKey({ autoIncrement: true }),
    telegramId: t.int('telegram_id').notNull().unique(),
    username: t.text(),
    firstName: t.text('first_name').notNull(),
    avatarUrl: t.text('avatar_url'),
    createdAt: t.int('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: t.int('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
);

export const trustRelations = table(
  'trust_relations',
  {
    id: t.int().primaryKey({ autoIncrement: true }),
    userId: t.int('user_id').notNull().references(() => users.id),
    targetUserId: t.int('target_user_id').notNull().references(() => users.id),
    type: t.text({ enum: ['friend', 'acquaintance'] }).notNull(),
    createdAt: t.int('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (tbl) => [
    t.uniqueIndex('trust_user_target_idx').on(tbl.userId, tbl.targetUserId),
  ],
);

export const trustedGroups = table(
  'trusted_groups',
  {
    id: t.int().primaryKey({ autoIncrement: true }),
    telegramChatId: t.int('telegram_chat_id').notNull().unique(),
    name: t.text().notNull(),
    link: t.text(),
    addedFromConfig: t.int('added_from_config', { mode: 'boolean' }).notNull().default(false),
    createdAt: t.int('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
);

export const groupMembers = table(
  'group_members',
  {
    id: t.int().primaryKey({ autoIncrement: true }),
    groupId: t.int('group_id').notNull().references(() => trustedGroups.id),
    userId: t.int('user_id').notNull().references(() => users.id),
    joinedAt: t.int('joined_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (tbl) => [
    t.uniqueIndex('group_member_idx').on(tbl.groupId, tbl.userId),
  ],
);

export const offers = table(
  'offers',
  {
    id: t.int().primaryKey({ autoIncrement: true }),
    authorId: t.int('author_id').notNull().references(() => users.id),
    groupId: t.int('group_id').notNull().references(() => trustedGroups.id),
    telegramMessageId: t.int('telegram_message_id').notNull(),
    fromCurrency: t.text('from_currency').notNull(),
    toCurrency: t.text('to_currency').notNull(),
    amount: t.real().notNull(),
    amountCurrency: t.text('amount_currency'),
    paymentMethods: t.text('payment_methods').notNull().default('[]'),
    partial: t.int({ mode: 'boolean' }).notNull().default(false),
    partialThreshold: t.real('partial_threshold').notNull().default(0),
    status: t.text({ enum: ['active', 'matched', 'cancelled', 'error'] }).notNull().default('active'),
    isLlmParsed: t.int('is_llm_parsed', { mode: 'boolean' }).notNull().default(true),
    originalMessageText: t.text('original_message_text'),
    createdAt: t.int('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: t.int('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
);

export const userOffers = table(
  'user_offers',
  {
    id: t.int().primaryKey({ autoIncrement: true }),
    userId: t.int('user_id').notNull().references(() => users.id),
    fromCurrency: t.text('from_currency').notNull(),
    toCurrency: t.text('to_currency').notNull(),
    amount: t.real().notNull(),
    minSplitAmount: t.real('min_split_amount').notNull(),
    paymentMethods: t.text('payment_methods').notNull().default('{"take":[],"give":[]}'),
    visibility: t.text({ enum: ['friends_only', 'friends_and_acquaintances'] }).notNull().default('friends_and_acquaintances'),
    visibleTo: t.text('visible_to'),
    status: t.text({ enum: ['active', 'matched', 'cancelled'] }).notNull().default('active'),
    notifyOnMatch: t.int('notify_on_match', { mode: 'boolean' }).notNull().default(true),
    createdAt: t.int('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: t.int('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
);

export const matches = table(
  'matches',
  {
    id: t.int().primaryKey({ autoIncrement: true }),
    userOfferId: t.int('user_offer_id').notNull().references(() => userOffers.id),
    matchedOfferId: t.int('matched_offer_id').notNull().references(() => offers.id),
    status: t.text({ enum: ['pending', 'accepted', 'error_flagged'] }).notNull().default('pending'),
    createdAt: t.int('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: t.int('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
);

export const errorOffers = table(
  'error_offers',
  {
    id: t.int().primaryKey({ autoIncrement: true }),
    offerId: t.int('offer_id').notNull().references(() => offers.id),
    reportedBy: t.int('reported_by').notNull().references(() => users.id),
    reason: t.text(),
    createdAt: t.int('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
);

export const exchangeHistory = table(
  'exchange_history',
  {
    id: t.int().primaryKey({ autoIncrement: true }),
    userOfferId: t.int('user_offer_id').notNull().references(() => userOffers.id),
    matchedOfferId: t.int('matched_offer_id').notNull().references(() => offers.id),
    matchId: t.int('match_id').notNull().references(() => matches.id),
    initiatorUserId: t.int('initiator_user_id').notNull().references(() => users.id),
    counterpartyUserId: t.int('counterparty_user_id').notNull().references(() => users.id),
    groupId: t.int('group_id').notNull().references(() => trustedGroups.id),
    fromCurrency: t.text('from_currency').notNull(),
    toCurrency: t.text('to_currency').notNull(),
    amount: t.real().notNull(),
    convertedAmount: t.real('converted_amount'),
    exchangeRate: t.real('exchange_rate'),
    success: t.int({ mode: 'boolean' }).notNull(),
    errorReason: t.text('error_reason'),
    createdAt: t.int('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
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
    id: t.int().primaryKey({ autoIncrement: true }),
    code: t.text().notNull().unique(),
    userId: t.int('user_id').notNull().references(() => users.id).unique(),
    createdAt: t.int('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
);

export const blacklist = table(
  'blacklist',
  {
    id: t.int().primaryKey({ autoIncrement: true }),
    telegramId: t.int('telegram_id').notNull().unique(),
    reason: t.text(),
    createdAt: t.int('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
);

export const offerRequests = table(
  'offer_requests',
  {
    id: t.int().primaryKey({ autoIncrement: true }),
    userId: t.int('user_id').notNull().references(() => users.id),
    createdAt: t.int('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (tbl) => [
    t.index('offer_requests_user_created_idx').on(tbl.userId, tbl.createdAt),
  ],
);
