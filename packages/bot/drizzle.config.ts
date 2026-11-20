import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Load .env from monorepo root (same as bot config)
loadEnv({ path: path.resolve(dir, '../../.env') });

export default defineConfig({
  out: './drizzle-pg',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
