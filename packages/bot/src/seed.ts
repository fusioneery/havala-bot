import { db, schema } from './db';

async function seed() {
  const existing = await db.select().from(schema.users).limit(1);
  if (existing.length === 0) {
    await db.insert(schema.users).values({
      telegramId: 123456789,
      username: 'testuser',
      firstName: 'Test',
    });
    console.log('Seeded test user (id=1)');
  } else {
    console.log('Test user already exists');
  }
}

seed().catch(console.error);
