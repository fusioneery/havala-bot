import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { config } from '../config';
import * as schema from './schema';

// Ensure data directory exists
import { mkdirSync } from 'fs';
import { dirname } from 'path';
mkdirSync(dirname(config.dbFileName), { recursive: true });

const sqlite = new Database(config.dbFileName);
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });
export { schema };
