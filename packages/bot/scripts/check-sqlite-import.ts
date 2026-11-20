import { Database } from 'bun:sqlite';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import postgres from 'postgres';

const url = process.env.TEST_IMPORT_URL;
if (!url || new URL(url).pathname !== '/hawala_import_test') throw new Error('Expected a dedicated hawala_import_test database');
const dir = await mkdtemp(join(tmpdir(), 'hawala-import-'));
const path = join(dir, 'old.db');
const legacy = new Database(path);
const pg = postgres(url);
try {
  const migrations = resolve(import.meta.dir, '../drizzle');
  for (const file of (await readdir(migrations)).filter(f => f.endsWith('.sql')).sort()) {
    legacy.exec(await readFile(join(migrations, file), 'utf8'));
  }
  legacy.exec("INSERT INTO users(id,telegram_id,first_name,created_at,updated_at) VALUES (7,5000000001,'fixture',1711111111,1711111112)");
  legacy.exec("UPDATE sqlite_sequence SET seq=91 WHERE name='users'");
  legacy.close();
  async function runImport() {
    const proc = Bun.spawn([process.execPath, resolve(import.meta.dir, 'import-sqlite.ts'), path],
      { env: { ...process.env, DATABASE_URL: url }, stdout: 'ignore', stderr: 'ignore' });
    return proc.exited;
  }
  assert.equal(await runImport(), 0);
  assert.notEqual(await runImport(), 0);
  const [row] = await pg`SELECT id, telegram_id, created_at, notify_on_friend_add FROM users`;
  assert.equal(row.id, 7);
  assert.equal(String(row.telegram_id), '5000000001');
  assert.equal(row.created_at.getTime(), 1711111111000);
  assert.equal(row.notify_on_friend_add, true);
  assert.equal(Number((await pg`SELECT nextval('users_id_seq') AS id`)[0].id), 92);
} finally {
  await pg.end();
  await rm(dir, { recursive: true, force: true });
}
