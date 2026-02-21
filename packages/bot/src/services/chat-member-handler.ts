import type { ChatMemberUpdated } from 'grammy/types';
import { config } from '../config';
import { removeGroupMember, upsertGroupMember } from './user-event-tracker';

const IN_STATUSES = new Set(['creator', 'administrator', 'member', 'restricted']);
const OUT_STATUSES = new Set(['left', 'kicked']);

function isTrustedChat(chatId: number): boolean {
  if (config.trustedGroupIds.length === 0) return true;
  return config.trustedGroupIds.includes(chatId);
}

export async function handleChatMemberUpdate(update: ChatMemberUpdated): Promise<void> {
  const chat = update.chat;
  if (chat.type !== 'group' && chat.type !== 'supergroup') return;
  const chatId = chat.id;
  if (!isTrustedChat(chatId)) return;

  const member = update.new_chat_member;
  const user = member.user;
  if (user.is_bot) return;

  const status = member.status;
  const chatTitle = 'title' in chat ? chat.title : String(chatId);

  if (OUT_STATUSES.has(status)) {
    await removeGroupMember(chatId, user.id);
    return;
  }

  if (IN_STATUSES.has(status)) {
    await upsertGroupMember(chatId, chatTitle, user);
  }
}
