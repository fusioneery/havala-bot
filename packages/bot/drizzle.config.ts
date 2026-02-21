import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Load .env from monorepo root (same as bot config)
loadEnv({ path: path.resolve(dir, '../../.env') });

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    // Resolve to absolute path so drizzle and bot use the same DB regardless of cwd
    url: path.resolve(dir, process.env.DB_FILE_NAME || './data/hawala.db'),
  },
});
