import { config } from '../config';

type SendFn = (chatId: number, text: string, options?: { parse_mode?: 'HTML' }) => Promise<void>;

let sendFn: SendFn | null = null;
let resolvedChatId: number | null = null;

export function initDebugChat(send: SendFn): void {
  sendFn = send;
  resolvedChatId = config.debugChatId;
  if (resolvedChatId) {
    console.log(`[debug-chat] Initialized, chatId=${resolvedChatId}`);
  }
}

/**
 * Send a structured debug log to the Telegram debug chat.
 * Silently no-ops if DEBUG_CHAT_ID is not set or sendFn not initialized.
 */
export async function debugLog(
  icon: string,
  title: string,
  details?: Record<string, unknown>,
): Promise<void> {
  if (!sendFn || !resolvedChatId) return;

  const lines = [`<b>${icon} ${escapeHtml(title)}</b>`];

  if (details) {
    for (const [key, value] of Object.entries(details)) {
      if (value === undefined || value === null) continue;
      const formatted = typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : String(value);
      lines.push(`<b>${escapeHtml(key)}:</b> <code>${escapeHtml(formatted)}</code>`);
    }
  }

  const text = lines.join('\n');

  try {
    await sendFn(resolvedChatId, text, { parse_mode: 'HTML' });
  } catch (err) {
    const newId = extractMigratedChatId(err);
    if (newId) {
      console.warn(`[debug-chat] Chat migrated to supergroup, new chatId=${newId} — update DEBUG_CHAT_ID`);
      resolvedChatId = newId;
      try {
        await sendFn(resolvedChatId, text, { parse_mode: 'HTML' });
        return;
      } catch (retryErr) {
        console.error('[debug-chat] Retry failed:', retryErr instanceof Error ? retryErr.message : retryErr);
        return;
      }
    }
    console.error('[debug-chat] Failed to send:', err instanceof Error ? err.message : err);
  }
}

/**
 * Log an error/exception to the debug chat with stack trace.
 */
export async function debugError(
  title: string,
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack?.split('\n').slice(0, 4).join('\n') : undefined;

  await debugLog('❌', title, {
    error: msg,
    ...(stack ? { stack } : {}),
    ...context,
  });
}

function extractMigratedChatId(err: unknown): number | null {
  if (
    err &&
    typeof err === 'object' &&
    'parameters' in err &&
    (err as { parameters?: { migrate_to_chat_id?: number } }).parameters?.migrate_to_chat_id
  ) {
    return (err as { parameters: { migrate_to_chat_id: number } }).parameters.migrate_to_chat_id;
  }
  return null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
