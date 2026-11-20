import { Database } from 'bun:sqlite';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const [file] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!file || !url) throw new Error('Supply a SQLite snapshot path and set DATABASE_URL');
const source = new Database(file, { readonly: true });
const pg = postgres(url, { max: 1 });
const tables = ['users', 'trusted_groups', 'blacklist', 'trust_relations', 'group_members',
  'offers', 'user_offers', 'matches', 'error_offers', 'exchange_history', 'offer_requests', 'referral_codes'];
try {
  source.exec('BEGIN');
  if (source.query('PRAGMA quick_check').values().flat().join() !== 'ok'
    || source.query('PRAGMA foreign_key_check').values().length) throw new Error('SQLite integrity check failed');
  const found = source.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table'").all()
    .map(r => r.name).filter(n => !['__drizzle_migrations', 'sqlite_sequence'].includes(n));
  if (!isDeepStrictEqual(found.sort(), [...tables].sort())) throw new Error('Unexpected SQLite table set');
  await migrate(drizzle(pg), { migrationsFolder: resolve(import.meta.dir, '../drizzle-pg') });
  await pg.begin(async tx => {
    for (const table of tables) {
      await tx`LOCK TABLE ${tx(table)} IN ACCESS EXCLUSIVE MODE`;
      if ((await tx`SELECT 1 FROM ${tx(table)} LIMIT 1`).length) throw new Error(`Target table must be empty: ${table}`);
      const columns = await tx`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=${table} ORDER BY ordinal_position`;
      const keys = columns.map(c => String(c.column_name));
      const sqliteKeys = source.query<{name:string}, []>(`PRAGMA table_info("${table}")`).all().map(c => c.name);
      if (!isDeepStrictEqual([...keys].sort(), sqliteKeys.sort())) throw new Error(`Column mismatch in ${table}`);
      let lastId = 0, count = 0;
      const batch = source.query<Record<string, string | number | null>, [number]>(
        `SELECT * FROM "${table}" WHERE id > ? ORDER BY id LIMIT 250`);
      for (;;) {
        const rows = batch.all(lastId);
        if (!rows.length) break;
        const converted = rows.map(row => Object.fromEntries(columns.map(({column_name:key, data_type:type}) => {
          let value = row[key];
          if (value === null) return [key, null];
          if (type === 'boolean') {
            if (value !== 0 && value !== 1) throw new Error(`Invalid boolean in ${table}.${key}`);
            return [key, value === 1];
          }
          if (type === 'timestamp with time zone') return [key, new Date(Number(value) * 1000).toISOString()];
          if (type === 'bigint') return [key, String(value)];
          return [key, value];
        })));
        const stored = await tx`INSERT INTO ${tx(table)} ${tx(converted, ...keys)} RETURNING *`;
        const result = new Map(stored.map(r => [r.id,r]));
        for (const row of converted) for (const {column_name: key, data_type: type} of columns) {
          const actual = result.get(row.id)?.[key];
          const normalized = actual !== null && type === 'timestamp with time zone'
            ? new Date(actual).toISOString() : actual;
          if (normalized !== row[key]) {
            throw new Error(`Value mismatch in ${table}.${key}`);
          }
        }
        lastId = Number(rows.at(-1)!.id);
        count += rows.length;
      }
      const total = Number(source.query(`SELECT count(*) FROM "${table}"`).values()[0][0]);
      if (total !== count) throw new Error(`Row count mismatch in ${table}`);
      const seq = source.query<{seq:number},[string]>('SELECT seq FROM sqlite_sequence WHERE name=?').get(table);
      const next = Math.max(lastId, seq?.seq ?? 0) + 1;
      if (!Number.isSafeInteger(next)) throw new Error(`Invalid sequence in ${table}`);
      await tx.unsafe(`ALTER SEQUENCE "${table}_id_seq" RESTART WITH ${next}`);
      console.log(`${table}: verified ${count} rows`);
    }
  });
} finally {
  source.close();
  await pg.end();
}
