import { config as loadEnv } from 'dotenv';
import path from 'node:path';

// Load .env from monorepo root (Bun runs from packages/bot)
loadEnv({ path: path.resolve(import.meta.dir, '../../../.env') });

function parseNumberList(input: string): number[] {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

/**
 * Format: "-1001:10,11;-1002:5"
 * where key is Telegram chat ID and value is allowed topic IDs for that chat.
 */
function parseTrustedGroupTopics(input: string): Map<number, Set<number>> {
  const result = new Map<number, Set<number>>();

  for (const entry of input.split(/[;|]/)) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const [chatIdRaw, topicIdsRaw] = trimmed.split(':');
    const chatId = Number(chatIdRaw?.trim());
    if (!Number.isFinite(chatId) || !topicIdsRaw) continue;

    const topicIds = parseNumberList(topicIdsRaw);
    if (topicIds.length === 0) continue;

    const existing = result.get(chatId) ?? new Set<number>();
    for (const topicId of topicIds) {
      existing.add(topicId);
    }
    result.set(chatId, existing);
  }

  return result;
}

export const config = {
  adminIds: parseNumberList(process.env.ADMIN_IDS || ''),
  botToken: process.env.BOT_TOKEN!,
  openrouterApiKey: process.env.OPENROUTER_API_KEY!,
  openrouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-5-nano',
  openrouterSmartModel: process.env.OPENROUTER_SMART_MODEL || 'openai/gpt-5-mini',
  dbFileName: process.env.DB_FILE_NAME || './data/hawala.db',
  trustedGroupIds: parseNumberList(process.env.TRUSTED_GROUP_IDS || ''),
  trustedGroupTopics: parseTrustedGroupTopics(process.env.CHAT_TO_TOPICS || ''),
  messageBatchSize: Number(process.env.MESSAGE_BATCH_SIZE) || 5,
  messageBatchFlushMs: Number(process.env.MESSAGE_BATCH_FLUSH_MS) || 15000,
  /** When true, skip sending batch to LLM if new messages arrived in the queue (put batch back to wait for them) */
  skipBatchOnNewMessage: process.env.SKIP_BATCH_ON_NEW_MESSAGE === 'true' || process.env.SKIP_BATCH_ON_NEW_MESSAGE === '1',
  port: Number(process.env.PORT) || 3000,
  isProd: process.env.NODE_ENV === 'production',
  dev: process.env.DEV === 'true' || process.env.DEV === '1',
  miniAppUrl: process.env.MINI_APP_URL!,
  writeOfferText: process.env.WRITE_OFFER_TEXT || '#ищу {TAKE_AMOUNT} {TAKE_CURRENCY} {TAKE_PAYMENT_METHOD}\n#предлагаю {GIVE_AMOUNT} {GIVE_CURRENCY} {GIVE_PAYMENT_METHOD}',
  openExchangeRatesApiKey: process.env.OPENEXCHANGERATES_API_KEY || '',
  botUsername: process.env.BOT_USERNAME || 'HawalaExchangeBot',

  // Rate limiting
  rateLimitDailyOffers: Number(process.env.RATE_LIMIT_DAILY_OFFERS) || 5,
  rateLimitMonthlyOffers: Number(process.env.RATE_LIMIT_MONTHLY_OFFERS) || 10,

  // Cleanup old offers (in days)
  offerMaxAgeDays: Number(process.env.OFFER_MAX_AGE_DAYS) || 30,

  // Feature flags
  reactToParsedOffers: process.env.REACT_TO_PARSED_OFFERS === 'true' || process.env.REACT_TO_PARSED_OFFERS === '1',
} as const;
