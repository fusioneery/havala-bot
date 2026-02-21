import { config } from '../config';

export type RateProvider = 'CoinGecko' | 'OpenExchangeRates' | 'vas3k.kurs';

interface ProviderState {
  healthy: boolean;
  lastAlertAt: number;
}

const ALERT_COOLDOWN_MS = 30 * 60_000;

let sendFn: ((chatId: number, text: string) => Promise<void>) | null = null;
const states = new Map<RateProvider, ProviderState>();

export function initAdminAlerts(
  send: (chatId: number, text: string) => Promise<void>,
) {
  sendFn = send;
  for (const name of [
    'CoinGecko',
    'OpenExchangeRates',
    'vas3k.kurs',
  ] as RateProvider[]) {
    states.set(name, { healthy: true, lastAlertAt: 0 });
  }
}

async function notifyAdmins(text: string) {
  if (!sendFn || config.adminIds.length === 0) return;

  for (const adminId of config.adminIds) {
    try {
      await sendFn(adminId, text);
    } catch (err) {
      console.error(`[admin-alerts] Failed to notify admin ${adminId}:`, err);
    }
  }
}

export async function reportProviderDown(
  provider: RateProvider,
  error: string,
) {
  const state = states.get(provider);
  if (!state) return;

  const now = Date.now();
  const wasHealthy = state.healthy;
  state.healthy = false;

  if (wasHealthy || now - state.lastAlertAt > ALERT_COOLDOWN_MS) {
    state.lastAlertAt = now;
    const msg = `⚠️ Провайдер курса недоступен: ${provider}\n\nОшибка: ${error}\nВремя: ${new Date().toISOString()}`;
    console.warn(`[admin-alerts] Provider down: ${provider} — ${error}`);
    await notifyAdmins(msg);
  }
}

export async function reportProviderUp(provider: RateProvider) {
  const state = states.get(provider);
  if (!state) return;

  if (!state.healthy) {
    state.healthy = true;
    state.lastAlertAt = Date.now();
    const msg = `✅ Провайдер курса восстановлен: ${provider}\n\nВремя: ${new Date().toISOString()}`;
    console.log(`[admin-alerts] Provider recovered: ${provider}`);
    await notifyAdmins(msg);
  }
}
