import { BottomSheet } from '@/components/ui/bottom-sheet';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { getCurrencyColor, RubIcon, UsdtIcon } from './currency-icons';

const CRYPTO = ['USDT', 'USDC', 'BTC', 'ETH', 'TON'] as const;
const FIAT = ['RUB', 'USD', 'EUR', 'GBP', 'HUF', 'GEL', 'AMD', 'TRY', 'KZT', 'UAH'] as const;
const CRYPTO_SET = new Set<string>(CRYPTO);

const PICKER_GROUPS = [
  { label: 'Криптовалюты', currencies: CRYPTO },
  { label: 'Фиатные валюты', currencies: FIAT },
];

const PAYMENT_GROUPS = [
  { label: 'СБП', defaultCurrency: 'RUB' },
  { label: 'Crypto', defaultCurrency: 'USDT' },
  { label: 'SWIFT/SEPA', defaultCurrency: 'USD' },
] as const;

export function getPaymentGroup(currency: string): string {
  if (currency === 'RUB') return 'СБП';
  if (CRYPTO_SET.has(currency)) return 'Crypto';
  return 'SWIFT/SEPA';
}

export function formatWithSpaces(input: string): string {
  const raw = input.replace(/[^\d.]/g, '');
  if (raw === '') return '';

  const dotIdx = raw.indexOf('.');
  const intRaw = dotIdx >= 0 ? raw.slice(0, dotIdx) : raw;
  const decRaw =
    dotIdx >= 0
      ? '.' + raw.slice(dotIdx + 1).replace(/\./g, '').slice(0, 2)
      : '';

  const intPart = intRaw.replace(/^0+(?=\d)/, '') || (dotIdx >= 0 ? '0' : '');
  if (!intPart && !decRaw) return raw === '.' ? '0.' : '';

  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return formatted + decRaw;
}

function renderPickerIcon(code: string) {
  if (code === 'RUB') return <RubIcon />;
  if (code === 'USDT') return <UsdtIcon />;
  return (
    <span className="font-bold text-white text-[10px]">{code.charAt(0)}</span>
  );
}

interface CurrencyInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  currencyColor: string;
  currencyIcon?: React.ReactNode;
  balance?: string;
  className?: string;
}

export function CurrencyInput({
  label,
  value,
  onChange,
  currency,
  onCurrencyChange,
  currencyColor,
  currencyIcon,
  className,
}: CurrencyInputProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(formatWithSpaces(e.target.value));
  };

  const activeGroup = getPaymentGroup(currency);

  return (
    <>
      <div
        className={cn(
          'bg-card rounded-[28px] p-6 active:scale-[0.99] transition-transform duration-200 shadow-sm border border-border',
          className,
        )}
      >
        <div className="flex justify-between items-center mb-3">
          <label className="text-lg font-medium">{label}</label>
        </div>
        <div className="flex items-center justify-between gap-4">
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={handleInputChange}
            className="bg-transparent text-foreground text-[40px] font-bold w-full outline-none placeholder-muted-foreground tracking-tight"
            placeholder="0"
          />
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-2 bg-accent hover:bg-muted active:opacity-80 transition rounded-full pl-2 pr-4 py-1.5 min-w-fit h-[48px]"
          >
            <div
              className="relative w-8 h-8 rounded-full flex items-center justify-center text-[10px] overflow-hidden shrink-0 shadow-inner"
              style={{ backgroundColor: currencyColor }}
            >
              {currencyIcon || (
                <span className="font-bold text-white text-[10px]">
                  {currency.charAt(0)}
                </span>
              )}
            </div>
            <span className="text-[17px] font-semibold text-foreground">
              {currency}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Payment group pills */}
        {/* <div className="flex gap-2 mt-4">
          {PAYMENT_GROUPS.map((group) => (
            <button
              key={group.label}
              onClick={() => {
                if (activeGroup !== group.label) {
                  onCurrencyChange(group.defaultCurrency);
                }
              }}
              className={cn(
                'px-4 py-2 rounded-full text-[13px] font-semibold transition-all',
                activeGroup === group.label
                  ? 'bg-foreground text-background'
                  : 'bg-background text-foreground border border-border hover:bg-accent',
              )}
            >
              {group.label}
            </button>
          ))}
        </div> */}
      </div>

      {/* Currency picker */}
      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <h3 className="text-[20px] font-bold mb-4">Выберите валюту</h3>
        <div className="max-h-[60vh] overflow-y-auto no-scrollbar">
          {PICKER_GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="text-[13px] text-muted-foreground font-semibold uppercase tracking-wide mb-2 px-1">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.currencies.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      onCurrencyChange(c);
                      setPickerOpen(false);
                    }}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-2xl transition-all w-full',
                      currency === c
                        ? 'bg-accent'
                        : 'active:bg-accent/50',
                    )}
                  >
                    <div
                      className="relative w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0"
                      style={{ backgroundColor: getCurrencyColor(c) }}
                    >
                      {renderPickerIcon(c)}
                    </div>
                    <div className="flex flex-col items-start flex-1">
                      <span className="text-[16px] font-semibold">{c}</span>
                      <span className="text-[12px] text-muted-foreground">
                        {getPaymentGroup(c)}
                      </span>
                    </div>
                    {currency === c && (
                      <Check className="w-5 h-5 text-foreground" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
