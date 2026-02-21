interface TemplateParams {
  takeAmount: string;
  takeCurrency: string;
  takePaymentMethod: string;
  giveAmount: string;
  giveCurrency: string;
  givePaymentMethod: string;
}

export function resolveTemplate(template: string, params: TemplateParams): string {
  return template
    .replace(/\{TAKE_AMOUNT\}/g, params.takeAmount)
    .replace(/\{TAKE_CURRENCY\}/g, params.takeCurrency)
    .replace(/\{TAKE_PAYMENT_METHOD\}/g, params.takePaymentMethod)
    .replace(/\{GIVE_AMOUNT\}/g, params.giveAmount)
    .replace(/\{GIVE_CURRENCY\}/g, params.giveCurrency)
    .replace(/\{GIVE_PAYMENT_METHOD\}/g, params.givePaymentMethod)
    .replace(/\\n/g, '\n')
    .replace(/ {2,}/g, ' ');
}

const CRYPTO_CURRENCIES = new Set(['USDT', 'USDC', 'BTC', 'ETH', 'TON']);

export function getPaymentMethodLabel(currency: string): string {
  if (currency === 'RUB') return 'по СБП (любой банк)';
  if (CRYPTO_CURRENCIES.has(currency)) return '';
  return 'по SWIFT/SEPA';
}
