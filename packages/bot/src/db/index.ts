import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from '../config';
import * as schema from './schema';

if (!config.databaseUrl) throw new Error('DATABASE_URL is required');
export const db = drizzle(postgres(config.databaseUrl), { schema });
export { schema };

await migrate(db, { migrationsFolder: resolve(import.meta.dir, '../../drizzle-pg') });
