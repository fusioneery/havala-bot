import { Bot, InlineKeyboard } from 'grammy';
import { config } from './config';

export const bot = new Bot(config.botToken);

// Log chat/group ID for every incoming message (debug groups we're member of)
bot.use(async (ctx, next) => {
  const chat = ctx.chat;
  if (chat && ['group', 'supergroup'].includes(chat.type)) {
    console.log(`[Group message] chatId=${chat.id} type=${chat.type} title=${'title' in chat ? chat.title : 'N/A'}`);
  }
  return next();
});

// /start command
bot.command('start', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  // TODO: upsert user in DB

  await ctx.reply(
    `Welcome to Hawala Bot!\n\nManage your exchange contacts and find trusted matches.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Open Mini App', web_app: { url: config.miniAppUrl } }],
        ],
      },
    },
  );
});

// Handle forwarded messages — add to trust circles
bot.on('message:forward_origin', async (ctx) => {
  // TODO: extract forwarded user, ask friend/acquaintance
  const keyboard = new InlineKeyboard()
    .text('Friend', 'trust:friend')
    .text('Acquaintance', 'trust:acquaintance');

  await ctx.reply('Add this person to your trust circle?', {
    reply_markup: keyboard,
  });
});

bot.callbackQuery(/^trust:/, async (ctx) => {
  const type = ctx.callbackQuery.data.replace('trust:', '') as 'friend' | 'acquaintance';
  // TODO: save trust relation to DB
  await ctx.answerCallbackQuery({ text: `Added as ${type}!` });
  await ctx.editMessageText(`Added as ${type}`);
});

// Catch-all error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});
