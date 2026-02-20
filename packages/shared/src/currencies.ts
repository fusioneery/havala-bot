export const CURRENCIES = [
  // Stablecoins
  'USDT', 'USDC',
  // Euro variants
  'EUR', 'EURT', 'EURC',
  // Major fiat
  'USD', 'RUB', 'GEL', 'AMD', 'HUF',
  // Other fiat (extend as needed)
  'GBP', 'CHF', 'TRY', 'KZT', 'UAH', 'BYN', 'AZN', 'UZS',
  'THB', 'VND', 'IDR', 'MYR', 'SGD', 'HKD', 'JPY', 'KRW',
  'CNY', 'INR', 'AED', 'SAR', 'ILS', 'PLN', 'CZK', 'RON',
  'BGN', 'HRK', 'RSD', 'BAM', 'MDL', 'NOK', 'SEK', 'DKK',
  'CAD', 'AUD', 'NZD', 'BRL', 'ARS', 'MXN', 'CLP', 'COP',
  'PEN', 'ZAR', 'EGP', 'NGN', 'KES',
] as const;

export type Currency = (typeof CURRENCIES)[number];
