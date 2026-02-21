/**
 * Returns true if groupsA and groupsB share at least one payment method
 * for the given currency. If either side has no entries for that currency,
 * returns true (no data = no restriction).
 */
export function hasPaymentMethodOverlap(
  groupsA: { currency: string; methods: string[] }[],
  groupsB: { currency: string; methods: string[] }[],
  currency: string,
): boolean {
  const methodsA = new Set<string>();
  for (const g of groupsA) {
    if (g.currency === currency) {
      for (const m of g.methods) methodsA.add(m);
    }
  }
  if (methodsA.size === 0) return true;

  let hasBMethods = false;
  for (const g of groupsB) {
    if (g.currency === currency) {
      for (const m of g.methods) {
        hasBMethods = true;
        if (methodsA.has(m)) return true;
      }
    }
  }
  return !hasBMethods;
}

const CRYPTO_CURRENCIES = new Set([
  'BTC', 'ETH', 'TON', 'USDT', 'USDC', 'EURT', 'EURC',
]);

/** CIS/regional fiats that typically use local_banks */
const LOCAL_BANK_FIATS = new Set(['GEL', 'KZT', 'UAH', 'AMD', 'BYN', 'AZN', 'UZS', 'KGS', 'MDL']);

export const PAYMENT_GROUP_LABELS: Record<PaymentMethodGroup, string> = {
  russian_banks: 'СБП / российские банки',
  local_banks: 'Местные банки',
  swift: 'SWIFT / SEPA',
  crypto: 'Крипто',
};

/**
 * Returns human-readable payment group label for fiat currency (non-RUB, non-crypto).
 * Returns null for RUB and crypto.
 */
export function getPaymentGroupLabelForFiat(currency: string): string | null {
  if (currency === 'RUB') return null;
  if (CRYPTO_CURRENCIES.has(currency)) return null;
  const group = LOCAL_BANK_FIATS.has(currency) ? 'local_banks' : 'swift';
  return PAYMENT_GROUP_LABELS[group];
}

export function getDefaultPaymentMethod(currency: string): PaymentMethodGroup {
  if (currency === 'RUB') return 'russian_banks';
  if (CRYPTO_CURRENCIES.has(currency)) return 'crypto';
  return 'swift';
}

export function getDefaultPaymentMethods(currency: string): PaymentMethodGroup[] {
  if (currency === 'RUB') return ['russian_banks'];
  if (CRYPTO_CURRENCIES.has(currency)) return ['crypto'];
  return ['swift', 'local_banks'];
}

export const PAYMENT_METHOD_GROUPS = [
  'russian_banks',   // СБП, Сбер, Тинькофф/Т-Банк, Альфа, ВТБ, any RU card
  'local_banks',     // CIS/regional banks: Araratbank, HalykBank, Kaspi, BoG, TBC
  'swift',           // SWIFT, SEPA, Revolut, Wise, IBAN, international cards
  'crypto',          // on-chain, Binance, Bybit, P2P crypto
] as const;

export type PaymentMethodGroup = (typeof PAYMENT_METHOD_GROUPS)[number];

/**
 * Aliases the LLM should recognize and map to groups.
 * Used in the LLM system prompt for structured extraction.
 */
export const PAYMENT_ALIASES: Record<string, PaymentMethodGroup> = {
  // russian_banks
  'сбп': 'russian_banks',
  'сбер': 'russian_banks',
  'сбербанк': 'russian_banks',
  'тинькофф': 'russian_banks',
  'тиньков': 'russian_banks',
  'тиньк': 'russian_banks',
  'тбанк': 'russian_banks',
  'т-банк': 'russian_banks',
  'титьков': 'russian_banks',
  'жёлтый банк': 'russian_banks',
  'альфа': 'russian_banks',
  'альфабанк': 'russian_banks',
  'красный банк': 'russian_banks',
  'втб': 'russian_banks',
  'газпромбанк': 'russian_banks',
  'райффайзен': 'russian_banks',
  'россельхоз': 'russian_banks',
  'на карту': 'russian_banks',
  'ру карту': 'russian_banks',

  // local_banks
  'credo': 'local_banks',
  'банк грузии': 'local_banks',
  'bog': 'local_banks',
  'tbc': 'local_banks',
  'ameriabank': 'local_banks',
  'araratbank': 'local_banks',
  'acba': 'local_banks',
  'halyk': 'local_banks',
  'halykbank': 'local_banks',
  'kaspi': 'local_banks',
  'jusan': 'local_banks',

  // swift
  'swift': 'swift',
  'sepa': 'swift',
  'revolut': 'swift',
  'wise': 'swift',
  'transferwise': 'swift',
  'iban': 'swift',
  'blik': 'swift',
  'paypal': 'swift',

  // crypto
  'binance': 'crypto',
  'bybit': 'crypto',
  'p2p': 'crypto',
  'on-chain': 'crypto',
  'onchain': 'crypto',
};
