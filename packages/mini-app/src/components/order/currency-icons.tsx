/**
 * Tiny inline currency icons for the selector pills.
 * These replace the flag/coin placeholders from the HTML design.
 */

export function UsdtIcon() {
  return (
    <span className="font-bold text-white text-[10px]">T</span>
  );
}

export function RubIcon() {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden rounded-full">
      <div className="flex-1 bg-white" />
      <div className="flex-1 bg-[#0052B4]" />
      <div className="flex-1 bg-[#D52B1E]" />
    </div>
  );
}

/** Map currency code to icon background color */
export const CURRENCY_COLORS: Record<string, string> = {
  USDT: '#26A17B',
  USDC: '#2775CA',
  USD: '#6B8E23',
  EUR: '#003399',
  EURT: '#003399',
  EURC: '#003399',
  RUB: '#0052B4',
  GEL: '#FF0000',
  AMD: '#D90012',
  HUF: '#477050',
  GBP: '#00247D',
  TRY: '#E30A17',
  KZT: '#00AEC7',
  UAH: '#005BBB',
};

export function getCurrencyColor(code: string): string {
  return CURRENCY_COLORS[code] || '#48484A';
}
