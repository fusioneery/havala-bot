import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// Load .env from monorepo root (Bun runs from packages/bot)
loadEnv({ path: path.resolve(import.meta.dir, '../../../.env') });

export const config = {
  botToken: process.env.BOT_TOKEN!,
  openrouterApiKey: process.env.OPENROUTER_API_KEY!,
  openrouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  dbFileName: process.env.DB_FILE_NAME || './data/hawala.db',
  trustedGroupIds: (process.env.TRUSTED_GROUP_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map(Number),
  messageBatchSize: Number(process.env.MESSAGE_BATCH_SIZE) || 5,
  port: Number(process.env.PORT) || 3000,
  isProd: process.env.NODE_ENV === 'production',
  miniAppUrl: process.env.MINI_APP_URL!,
  writeOfferText: process.env.WRITE_OFFER_TEXT || '#ищу {TAKE_AMOUNT} {TAKE_CURRENCY} через {TAKE_PAYMENT_METHOD}\n#предлагаю {GIVE_AMOUNT} {GIVE_CURRENCY} {GIVE_PAYMENT_METHOD}',
} as const;
