import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const BOT_LINK = `${import.meta.env.VITE_BOT_USERNAME}`;

/** Derives group/channel link from a Telegram message link (removes message id). */
export function getGroupLink(messageLink: string): string {
  try {
    const url = new URL(messageLink);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      parts.pop(); // remove message id
      url.pathname = parts.join('/');
    }
    return url.toString();
  } catch {
    return messageLink;
  }
}

export function buildDmUrl(params: {
  username: string | null;
  groupName: string;
  telegramMessageLink: string | null;
  matchSource?: 'group_message' | 'hawala';
}): string | null {
  const { username, groupName, telegramMessageLink, matchSource } = params;
  if (!username) return null;

  const isHawalaMatch = matchSource === 'hawala' || !telegramMessageLink;

  const introLine = isHawalaMatch
    ? 'Привет, нашёл твою заявку в Халве, давай поменяемся?'
    : `Привет, я из ${groupName}, давай поменяемся? ${telegramMessageLink}`;

  const messageText = [
    introLine,
    '',
    `если что, нашёл тебя через Халву: ${BOT_LINK}`,
  ].join('\n');

  return `https://t.me/${username}?text=${encodeURIComponent(messageText)}`;
}
