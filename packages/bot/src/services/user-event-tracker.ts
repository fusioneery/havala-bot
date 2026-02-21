import type { Context } from 'grammy';
import { and, eq } from 'drizzle-orm';
import { config } from '../config';
import { db, schema } from '../db';

type TelegramUser = { id: number; username?: string; first_name: string; is_bot?: boolean };

async function getTelegramAvatarUrl(telegramUserId: number): Promise<string | null> {
  try {
    const photosRes = await fetch(
      `https://api.telegram.org/bot${config.botToken}/getUserProfilePhotos?user_id=${telegramUserId}&limit=1`,
    );
    const photosData = (await photosRes.json()) as {
      ok: boolean;
      result?: { photos?: Array<Array<{ file_id: string }>> };
    };
    if (!photosData.ok || !photosData.result?.photos?.length) return null;

    const sizes = photosData.result.photos[0];
    if (!sizes?.length) return null;
    const largest = sizes[sizes.length - 1];
    const fileId = largest.file_id;

    const fileRes = await fetch(
      `https://api.telegram.org/bot${config.botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
    );
    const fileData = (await fileRes.json()) as { ok: boolean; result?: { file_path: string } };
    if (!fileData.ok || !fileData.result?.file_path) return null;

    return `https://api.telegram.org/file/bot${config.botToken}/${fileData.result.file_path}`;
  } catch {
    return null;
  }
}

function isTrustedChat(chatId: number): boolean {
  if (config.trustedGroupIds.length === 0) return true;
  return config.trustedGroupIds.includes(chatId);
}

function extractUser(ctx: Context): TelegramUser | null {
  const u =
    ctx.from
    ?? ctx.update.callback_query?.from
    ?? ctx.update.inline_query?.from
    ?? ctx.update.chosen_inline_result?.from
    ?? ctx.update.shipping_query?.from
    ?? ctx.update.pre_checkout_query?.from
    ?? ctx.update.chat_join_request?.from
    ?? ctx.update.poll_answer?.user
    ?? ctx.update.chat_member?.new_chat_member?.user
    ?? ctx.update.my_chat_member?.new_chat_member?.user;
  return u ? { id: u.id, username: u.username, first_name: u.first_name || 'Unknown', is_bot: u.is_bot } : null;
}

function extractChat(ctx: Context): { id: number; title?: string; type: string } | null {
  const c =
    ctx.chat
    ?? ctx.update.callback_query?.message?.chat
    ?? ctx.update.chat_join_request?.chat
    ?? ctx.update.chat_member?.chat
    ?? ctx.update.my_chat_member?.chat;
  if (!c) return null;
  return {
    id: c.id,
    title: 'title' in c ? c.title : undefined,
    type: c.type,
  };
}

function isGroupChat(chat: { type: string }): boolean {
  return chat.type === 'group' || chat.type === 'supergroup';
}

function isLeaveEvent(ctx: Context): boolean {
  const status = ctx.update.chat_member?.new_chat_member?.status
    ?? ctx.update.my_chat_member?.new_chat_member?.status;
  return status === 'left' || status === 'kicked';
}

export async function trackUserFromContext(ctx: Context): Promise<void> {
  const user = extractUser(ctx);
  if (!user || user.is_bot) return;

  const chat = extractChat(ctx);
  const isGroup = chat && isGroupChat(chat);
  const trustedGroup = isGroup && isTrustedChat(chat!.id);

  await upsertUser(user);

  if (trustedGroup && !isLeaveEvent(ctx)) {
    const chatTitle = chat!.title || String(chat!.id);
    await upsertGroupMember(chat!.id, chatTitle, user);
  }
}

export async function upsertUser(user: TelegramUser): Promise<{ id: number }> {
  const avatarUrl = await getTelegramAvatarUrl(user.id);
  const setOnConflict: Record<string, unknown> = {
    username: user.username ?? null,
    firstName: user.first_name || 'Unknown',
    updatedAt: new Date(),
  };
  if (avatarUrl) setOnConflict.avatarUrl = avatarUrl;

  const [row] = await db
    .insert(schema.users)
    .values({
      telegramId: user.id,
      username: user.username ?? null,
      firstName: user.first_name || 'Unknown',
      avatarUrl: avatarUrl ?? null,
    })
    .onConflictDoUpdate({
      target: schema.users.telegramId,
      set: setOnConflict,
    })
    .returning({ id: schema.users.id });
  return row!;
}

export async function upsertGroupMember(
  telegramChatId: number,
  chatTitle: string,
  user: TelegramUser,
): Promise<void> {
  const [group] = await db
    .insert(schema.trustedGroups)
    .values({
      telegramChatId,
      name: chatTitle,
      addedFromConfig: config.trustedGroupIds.includes(telegramChatId),
    })
    .onConflictDoUpdate({
      target: schema.trustedGroups.telegramChatId,
      set: { name: chatTitle },
    })
    .returning({ id: schema.trustedGroups.id });

  const dbUser = await upsertUser(user);

  await db
    .insert(schema.groupMembers)
    .values({ groupId: group.id, userId: dbUser.id })
    .onConflictDoNothing({ target: [schema.groupMembers.groupId, schema.groupMembers.userId] });
}

export async function removeGroupMember(telegramChatId: number, userTelegramId: number): Promise<void> {
  const [group] = await db
    .select({ id: schema.trustedGroups.id })
    .from(schema.trustedGroups)
    .where(eq(schema.trustedGroups.telegramChatId, telegramChatId))
    .limit(1);
  if (!group) return;

  const [dbUser] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.telegramId, userTelegramId))
    .limit(1);
  if (!dbUser) return;

  await db
    .delete(schema.groupMembers)
    .where(
      and(
        eq(schema.groupMembers.groupId, group.id),
        eq(schema.groupMembers.userId, dbUser.id),
      ),
    );
}
