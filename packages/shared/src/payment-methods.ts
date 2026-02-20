export const PAYMENT_METHOD_GROUPS = [
  'swift_sepa',      // SWIFT, SEPA, Revolut, Wise
  'russian_banks',   // СБП, Сбер, Тинькофф, Альфа, etc.
  'cis_banks',       // Georgian (Credo), Armenian, Kazakh banks
  'crypto',          // Binance, Bybit, on-chain
] as const;

export type PaymentMethodGroup = (typeof PAYMENT_METHOD_GROUPS)[number];

/**
 * Aliases the LLM should recognize and map to groups.
 * Used in the LLM system prompt for structured extraction.
 */
export const PAYMENT_ALIASES: Record<string, PaymentMethodGroup> = {
  // swift_sepa
  'swift': 'swift_sepa',
  'sepa': 'swift_sepa',
  'revolut': 'swift_sepa',
  'wise': 'swift_sepa',
  'transferwise': 'swift_sepa',

  // russian_banks
  'сбп': 'russian_banks',
  'сбер': 'russian_banks',
  'сбербанк': 'russian_banks',
  'тинькофф': 'russian_banks',
  'тиньков': 'russian_banks',
  'тиньк': 'russian_banks',
  'титьков': 'russian_banks',
  'жёлтый банк': 'russian_banks',
  'альфа': 'russian_banks',
  'альфабанк': 'russian_banks',
  'красный банк': 'russian_banks',
  'втб': 'russian_banks',
  'газпромбанк': 'russian_banks',
  'райффайзен': 'russian_banks',
  'россельхоз': 'russian_banks',

  // cis_banks
  'credo': 'cis_banks',
  'банк грузии': 'cis_banks',
  'bog': 'cis_banks',
  'tbc': 'cis_banks',
  'ameriabank': 'cis_banks',
  'acba': 'cis_banks',
  'halyk': 'cis_banks',
  'kaspi': 'cis_banks',

  // crypto
  'binance': 'crypto',
  'bybit': 'crypto',
  'p2p': 'crypto',
  'on-chain': 'crypto',
  'onchain': 'crypto',
};
