import bitcoinIcon from '@/assets/bitcoin.png';
import ethereumIcon from '@/assets/ethereum.png';
import tetherIcon from '@/assets/tether.png';
import usdCoinIcon from '@/assets/usd-coin.png';
import tonIcon from '@/assets/the-open-network.png';

/** Map currency code → imported PNG asset */
const CRYPTO_ICONS: Record<string, string> = {
  BTC: bitcoinIcon,
  ETH: ethereumIcon,
  USDT: tetherIcon,
  USDC: usdCoinIcon,
  TON: tonIcon,
};

export function CryptoIcon({ code, className }: { code: string; className?: string }) {
  const src = CRYPTO_ICONS[code];
  if (!src) return null;
  return <img src={src} alt={code} className={className || 'w-full h-full object-cover'} />;
}

/** Map fiat currency code → ISO 3166-1 alpha-2 country code for flagcdn */
const FIAT_COUNTRY: Record<string, string> = {
  RUB: 'ru',
  USD: 'us',
  EUR: 'eu',
  GBP: 'gb',
  CHF: 'ch',
  PLN: 'pl',
  CZK: 'cz',
  RON: 'ro',
  BGN: 'bg',
  HUF: 'hu',
  RSD: 'rs',
  SEK: 'se',
  NOK: 'no',
  DKK: 'dk',
  TRY: 'tr',
  GEL: 'ge',
  AMD: 'am',
  AZN: 'az',
  KZT: 'kz',
  KGS: 'kg',
  UZS: 'uz',
  TJS: 'tj',
  BYN: 'by',
  MDL: 'md',
  THB: 'th',
  AED: 'ae',
  IDR: 'id',
  VND: 'vn',
  MYR: 'my',
  SGD: 'sg',
  INR: 'in',
  JPY: 'jp',
  CNY: 'cn',
  KRW: 'kr',
  HKD: 'hk',
  ILS: 'il',
  SAR: 'sa',
  BRL: 'br',
  ARS: 'ar',
  MXN: 'mx',
  CAD: 'ca',
  AUD: 'au',
  ZAR: 'za',
  EGP: 'eg',
};

export function FlagIcon({ code, className }: { code: string; className?: string }) {
  const country = FIAT_COUNTRY[code];
  if (!country) return null;
  return (
    <img
      src={`https://flagcdn.com/${country}.svg`}
      alt={code}
      className={className || 'absolute inset-0 w-full h-full object-cover'}
    />
  );
}

export function hasFlagIcon(code: string): boolean {
  return code in FIAT_COUNTRY;
}

/** Map currency code to icon background color */
export const CURRENCY_COLORS: Record<string, string> = {
  BTC: '#F7931A',
  ETH: '#627EEA',
  TON: '#0098EA',
  USDT: '#26A17B',
  USDC: '#2775CA',
  USD: '#6B8E23',
  EUR: '#003399',
  EURT: '#003399',
  EURC: '#003399',
  GBP: '#00247D',
  CHF: '#D52B1E',
  PLN: '#DC143C',
  CZK: '#11457E',
  RON: '#002B7F',
  BGN: '#00966E',
  HUF: '#477050',
  RSD: '#0C4076',
  SEK: '#006AA7',
  NOK: '#BA0C2F',
  DKK: '#C8102E',
  RUB: '#0052B4',
  TRY: '#E30A17',
  GEL: '#FF0000',
  AMD: '#D90012',
  AZN: '#0092BC',
  KZT: '#00AEC7',
  KGS: '#E8112D',
  UZS: '#1EB53A',
  TJS: '#006600',
  BYN: '#C8313E',
  MDL: '#003DA5',
  THB: '#A51931',
  AED: '#00732F',
  IDR: '#CE1126',
  VND: '#DA251D',
  MYR: '#010066',
  SGD: '#EF3340',
  INR: '#FF9933',
  JPY: '#BC002D',
  CNY: '#DE2910',
  KRW: '#003478',
  HKD: '#DE2910',
  ILS: '#0038B8',
  SAR: '#006C35',
  BRL: '#009739',
  ARS: '#74ACDF',
  MXN: '#006847',
  CAD: '#FF0000',
  AUD: '#00008B',
  ZAR: '#007749',
  EGP: '#CE1126',
};

export function getCurrencyColor(code: string): string {
  return CURRENCY_COLORS[code] || '#48484A';
}

/** Whether a currency has a PNG icon */
export function hasCryptoIcon(code: string): boolean {
  return code in CRYPTO_ICONS;
}
