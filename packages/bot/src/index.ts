import { bot } from './bot';
import { config } from './config';
import { createServer } from './server';
import { initAdminAlerts } from './services/admin-alerts';
import { initBlacklistCache } from './services/blacklist';
import { startCleanupJob } from './services/cleanup';
import { startRateService } from './services/rates';

async function logTrustedGroups(): Promise<void> {
  const ids = config.trustedGroupIds;
  if (ids.length === 0) {
    console.log('[TrustedGroups] No trusted groups configured (all groups allowed)');
    return;
  }
  console.log(`[TrustedGroups] Fetching ${ids.length} group(s) from Telegram API...`);
  for (const chatId of ids) {
    try {
      const chat = await bot.api.getChat(chatId);
      const title = 'title' in chat ? chat.title : '(no title)';
      console.log(`[TrustedGroups] id=${chatId} title="${title}"`);
    } catch (err) {
      console.warn(`[TrustedGroups] id=${chatId} failed to fetch:`, err);
    }
  }
}

async function main() {
  console.log('Starting Halwa Bot...');

  await logTrustedGroups();

  await initBlacklistCache();
  startCleanupJob();

  initAdminAlerts(async (chatId, text) => {
    await bot.api.sendMessage(chatId, text);
  });

  await startRateService();

  // Start Fastify API server
  const server = await createServer();
  await server.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`API server listening on port ${config.port}`);

  // Start grammY bot (long polling). Broad allowed_updates for user tracking.
  bot.start({
    allowed_updates: [
      'message',
      'edited_message',
      'channel_post',
      'edited_channel_post',
      'chat_member',
      'my_chat_member',
      'callback_query',
      'inline_query',
      'chosen_inline_result',
      'chat_join_request',
      'shipping_query',
      'pre_checkout_query',
      'poll_answer',
    ],
    onStart: () => console.log('Bot is running (long polling)'),
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
