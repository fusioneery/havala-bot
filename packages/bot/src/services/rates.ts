import { config } from '../config';
import { reportProviderDown, reportProviderUp } from './admin-alerts';

// ─── CoinGecko coin ID → our currency code mapping ─────
const COINGECKO_IDS: Record<string, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  tether: 'USDT',
  'usd-coin': 'USDC',
  'the-open-network': 'TON',
};

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';
const OER_URL = 'https://openexchangerates.org/api/latest.json';
const VAS3K_RATES_URL = 'https://kurs.vas3k.club/current-rates.json';

const CRYPTO_REFRESH_MS = 60_000; // 1 minute
const FIAT_REFRESH_MS = 60 * 60_000; // 1 hour
const VAS3K_REFRESH_MS = 5 * 60_000; // 5 minutes

// ─── In-memory caches ──────────────────────────────────
/** Crypto prices in USD: e.g. { BTC: 65000, ETH: 3400, USDT: 1, USDC: 1 } */
let cryptoPricesUsd: Record<string, number> = {};
let cryptoFetchedAt = 0;

/** Fiat rates relative to USD: e.g. { EUR: 0.92, RUB: 92.5, ... } */
let fiatRatesUsd: Record<string, number> = {};
let fiatFetchedAt = 0;

/** Computed pair cache: "BTC/RUB" → { rate, computedAt } */
const pairCache = new Map<string, { rate: number; computedAt: number }>();

/** vas3k.kurs cache — shared with the rate route */
let vas3kRates: { data: unknown; fetchedAt: number } | null = null;

export function getVas3kRates() {
  return vas3kRates;
}

// ─── Fetch functions ───────────────────────────────────

async function fetchCryptoPrices(): Promise<void> {
  const ids = Object.keys(COINGECKO_IDS).join(',');
  const url = `${COINGECKO_URL}?ids=${ids}&vs_currencies=usd`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const msg = `HTTP ${res.status}`;
      console.error(`CoinGecko fetch failed: ${msg}`);
      await reportProviderDown('CoinGecko', msg);
      return;
    }
    const data = await res.json() as Record<string, { usd: number }>;

    const prices: Record<string, number> = {};
    for (const [geckoId, currency] of Object.entries(COINGECKO_IDS)) {
      if (data[geckoId]?.usd) {
        prices[currency] = data[geckoId].usd;
      }
    }
    prices.USD = 1;

    cryptoPricesUsd = prices;
    cryptoFetchedAt = Date.now();
    rebuildPairCache();
    await reportProviderUp('CoinGecko');
    console.log(`[rates] Crypto prices updated: ${Object.keys(prices).join(', ')}`);
  } catch (err) {
    console.error('[rates] CoinGecko fetch error:', err);
    await reportProviderDown('CoinGecko', String(err));
  }
}

async function fetchFiatRates(): Promise<void> {
  const apiKey = config.openExchangeRatesApiKey;
  if (!apiKey) {
    console.warn('[rates] OPENEXCHANGERATES_API_KEY not set, skipping fiat fetch');
    return;
  }

  const url = `${OER_URL}?app_id=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const msg = `HTTP ${res.status}`;
      console.error(`OpenExchangeRates fetch failed: ${msg}`);
      await reportProviderDown('OpenExchangeRates', msg);
      return;
    }
    const data = await res.json() as { rates: Record<string, number> };

    fiatRatesUsd = data.rates;
    fiatFetchedAt = Date.now();
    rebuildPairCache();
    await reportProviderUp('OpenExchangeRates');
    console.log(`[rates] Fiat rates updated: ${Object.keys(data.rates).length} currencies`);
  } catch (err) {
    console.error('[rates] OpenExchangeRates fetch error:', err);
    await reportProviderDown('OpenExchangeRates', String(err));
  }
}

async function fetchVas3kRates(): Promise<void> {
  try {
    const res = await fetch(VAS3K_RATES_URL);
    if (!res.ok) {
      const msg = `HTTP ${res.status}`;
      console.error(`vas3k.kurs fetch failed: ${msg}`);
      await reportProviderDown('vas3k.kurs', msg);
      return;
    }
    const data = await res.json();
    vas3kRates = { data, fetchedAt: Date.now() };
    await reportProviderUp('vas3k.kurs');
    console.log('[rates] vas3k.kurs rates updated');
  } catch (err) {
    console.error('[rates] vas3k.kurs fetch error:', err);
    await reportProviderDown('vas3k.kurs', String(err));
  }
}

// ─── Known crypto tickers ──────────────────────────────
const CRYPTO_CURRENCIES = new Set(Object.values(COINGECKO_IDS));
// Also add BTC/ETH aliases that might come from currency list
CRYPTO_CURRENCIES.add('BTC');
CRYPTO_CURRENCIES.add('ETH');

function isCrypto(currency: string): boolean {
  return CRYPTO_CURRENCIES.has(currency);
}

// ─── Price in USD for any currency ─────────────────────

function priceInUsd(currency: string): number | null {
  if (currency === 'USD') return 1;

  // Check crypto first
  if (isCrypto(currency) && cryptoPricesUsd[currency]) {
    return cryptoPricesUsd[currency];
  }

  // Check fiat
  if (fiatRatesUsd[currency]) {
    // OER rates are "1 USD = X currency", so price of currency in USD = 1/rate
    return 1 / fiatRatesUsd[currency];
  }

  return null;
}

// ─── Rate calculation ──────────────────────────────────

export function getRate(from: string, to: string): number | null {
  if (from === to) return 1;

  const key = `${from}/${to}`;
  const cached = pairCache.get(key);
  if (cached) return cached.rate;

  return computeRate(from, to);
}

function computeRate(from: string, to: string): number | null {
  // Rate = how many units of `to` you get for 1 unit of `from`
  const fromUsd = priceInUsd(from);
  const toUsd = priceInUsd(to);

  if (!fromUsd || !toUsd) return null;

  // 1 FROM = fromUsd USD, 1 TO = toUsd USD
  // So 1 FROM = fromUsd / toUsd TO
  return fromUsd / toUsd;
}

// ─── Pair cache rebuild ────────────────────────────────

function rebuildPairCache(): void {
  // Collect all known currencies
  const currencies = new Set<string>();

  for (const c of Object.values(COINGECKO_IDS)) currencies.add(c);
  currencies.add('USD');
  for (const c of Object.keys(fiatRatesUsd)) currencies.add(c);

  const now = Date.now();
  const currencyList = [...currencies];

  for (const from of currencyList) {
    for (const to of currencyList) {
      if (from === to) continue;
      const rate = computeRate(from, to);
      if (rate !== null) {
        pairCache.set(`${from}/${to}`, { rate, computedAt: now });
      }
    }
  }
}

// ─── Public API ────────────────────────────────────────

export function getAllCachedRates(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, { rate }] of pairCache) {
    result[key] = rate;
  }
  return result;
}

export function getRateInfo() {
  return {
    cryptoFetchedAt,
    fiatFetchedAt,
    cryptoCurrencies: Object.keys(cryptoPricesUsd),
    fiatCurrencies: Object.keys(fiatRatesUsd).length,
    cachedPairs: pairCache.size,
  };
}

// ─── Lifecycle ─────────────────────────────────────────

let cryptoInterval: ReturnType<typeof setInterval> | null = null;
let fiatInterval: ReturnType<typeof setInterval> | null = null;
let vas3kInterval: ReturnType<typeof setInterval> | null = null;

export async function startRateService(): Promise<void> {
  console.log('[rates] Starting rate service...');

  await Promise.all([fetchCryptoPrices(), fetchFiatRates(), fetchVas3kRates()]);

  cryptoInterval = setInterval(fetchCryptoPrices, CRYPTO_REFRESH_MS);
  fiatInterval = setInterval(fetchFiatRates, FIAT_REFRESH_MS);
  vas3kInterval = setInterval(fetchVas3kRates, VAS3K_REFRESH_MS);

  console.log('[rates] Rate service started');
}

export function stopRateService(): void {
  if (cryptoInterval) clearInterval(cryptoInterval);
  if (fiatInterval) clearInterval(fiatInterval);
  if (vas3kInterval) clearInterval(vas3kInterval);
  cryptoInterval = null;
  fiatInterval = null;
  vas3kInterval = null;
}
