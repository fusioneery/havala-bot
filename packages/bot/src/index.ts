import { config } from './config';
import { bot } from './bot';
import { createServer } from './server';

async function main() {
  console.log('Starting Hawala Bot...');

  // Start Fastify API server
  const server = await createServer();
  await server.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`API server listening on port ${config.port}`);

  // Start grammY bot (long polling)
  bot.start({
    onStart: () => console.log('Bot is running (long polling)'),
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
