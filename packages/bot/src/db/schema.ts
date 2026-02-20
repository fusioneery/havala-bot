import { sqliteTable as table } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';

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
    paymentMethods: t.text('payment_methods').notNull().default('[]'),
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
