import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const BOT_LINK = `${import.meta.env.VITE_BOT_USERNAME}`;
const SHOW_BOT_ATTRIBUTION = import.meta.env.VITE_SHOW_BOT_ATTRIBUTION !== 'false';

/** Open a link from the Telegram Mini App. Uses native openTelegramLink for t.me URLs. */
export function openTelegramLink(url: string): void {
  const tg = (window as unknown as { Telegram?: { WebApp?: {
    openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
    openTelegramLink?: (url: string) => void;
  } } }).Telegram?.WebApp;

  const isTelegramUrl = /^https?:\/\/(t\.me|telegram\.me)\//i.test(url);
  console.log('[openTelegramLink]', { url, isTelegramUrl, hasTgOpenLink: !!tg?.openLink, hasTgOpenTelegramLink: !!tg?.openTelegramLink });

  if (isTelegramUrl && tg?.openTelegramLink) {
    tg.openTelegramLink(url);
  } else if (tg?.openLink) {
    tg.openLink(url);
  } else {
    window.open(url, '_blank');
  }
}

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
  dealCode?: string | null;
}): string | null {
  const { username, groupName, telegramMessageLink, matchSource, dealCode } = params;
  if (!username) return null;

  const isHawalaMatch = matchSource === 'hawala' || !telegramMessageLink;

  const introLine = isHawalaMatch
    ? 'Привет, нашёл твою заявку в Халве, давай поменяемся?'
    : `Привет, я из ${groupName}, давай поменяемся? ${telegramMessageLink}`;

  const botLink = dealCode
    ? `https://t.me/${BOT_LINK}?start=1${dealCode}`
    : BOT_LINK;

  const messageLines = [introLine];
  if (SHOW_BOT_ATTRIBUTION) {
    messageLines.push('', `если что, нашёл тебя через Халву: ${botLink}`);
  }
  const messageText = messageLines.join('\n');

  const dmUrl = `https://t.me/${username}?text=${encodeURIComponent(messageText)}`;
  console.log('[buildDmUrl]', { username, matchSource, dealCode, urlLength: dmUrl.length, url: dmUrl });
  return dmUrl;
}
