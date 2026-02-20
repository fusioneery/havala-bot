import 'dotenv/config';

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
} as const;
