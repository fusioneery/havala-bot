import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CryptoIcon, FlagIcon, getCurrencyColor, hasCryptoIcon, hasFlagIcon } from './currency-icons';

const CRYPTO = ['USDT', 'ETH', 'TON', 'BTC', 'USDC'] as const;
const FIAT = [
  'RUB', 'EUR', 'USD', 'BYN', 'GEL', 'TRY', 'KZT', 'AMD',
  'AED', 'ARS', 'AZN', 'BGN', 'BRL', 'CAD', 'CHF', 'CZK',
  'GBP', 'HUF', 'IDR', 'ILS', 'KGS', 'MDL', 'PLN', 'RON',
  'RSD', 'THB', 'TJS', 'UZS', 'ZAR',
  'AUD', 'CNY', 'DKK', 'HKD', 'INR', 'JPY', 'KRW', 'MXN',
  'MYR', 'NOK', 'SEK', 'SGD', 'VND',
] as const;
const CRYPTO_SET = new Set<string>(CRYPTO);

const PICKER_GROUPS = [
  { label: 'Криптовалюты', currencies: CRYPTO },
  { label: 'Фиатные валюты', currencies: FIAT },
];

const RECENT_KEY = 'hawala:recent-currencies';
const MAX_RECENT = 3;

function getRecentCurrencies(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecentCurrency(code: string): void {
  const recent = getRecentCurrencies().filter((c) => c !== code);
  recent.unshift(code);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

const CRYPTO_LABEL = 'ERC-20 / TRC-20 / BEP-20';

export function getPaymentGroup(currency: string): string {
  if (CRYPTO_SET.has(currency)) return CRYPTO_LABEL;
  if (currency === 'RUB') return 'СБП / все банки';
  return 'SWIFT/SEPA или местный банк';
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
  if (hasCryptoIcon(code)) return <CryptoIcon code={code} />;
  if (hasFlagIcon(code)) return <FlagIcon code={code} />;
  return (
    <span className="font-bold text-white text-[10px]">{code.charAt(0)}</span>
  );
}

function CurrencyRow({ code, selected, onSelect }: { code: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 px-3 py-3 rounded-2xl transition-all w-full',
        selected ? 'bg-accent' : 'active:bg-accent/50',
      )}
    >
      <div
        className="relative w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0"
        style={{ backgroundColor: getCurrencyColor(code) }}
      >
        {renderPickerIcon(code)}
      </div>
      <div className="flex flex-col items-start flex-1">
        <span className="text-[16px] font-semibold">{code}</span>
        <span className="text-[12px] text-muted-foreground">
          {getPaymentGroup(code)}
        </span>
      </div>
      {selected && <Check className="w-5 h-5 text-foreground" />}
    </button>
  );
}

type PaymentMethod = 'swift' | 'local_banks';

interface CurrencyInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  currencyColor: string;
  currencyIcon?: React.ReactNode;
  pairCurrency?: string;
  balance?: string;
  className?: string;
  loading?: boolean;
  selectedMethods?: PaymentMethod[];
  onMethodsChange?: (methods: PaymentMethod[]) => void;
}

function getInputFontSize(value: string): string {
  const digitCount = value.replace(/[^\d]/g, '').length;
  if (digitCount <= 6) return 'text-[40px]';
  if (digitCount <= 8) return 'text-[32px]';
  if (digitCount <= 10) return 'text-[26px]';
  return 'text-[22px]';
}

export function CurrencyInput({
  label,
  value,
  onChange,
  currency,
  onCurrencyChange,
  currencyColor,
  currencyIcon,
  pairCurrency,
  className,
  loading,
  selectedMethods,
  onMethodsChange,
}: CurrencyInputProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recentCurrencies, setRecentCurrencies] = useState<string[]>(getRecentCurrencies);

  const inputFontSize = useMemo(() => getInputFontSize(value), [value]);

  const showMethodPills = !CRYPTO_SET.has(currency) && currency !== 'RUB';

  const toggleMethod = (method: PaymentMethod) => {
    if (!onMethodsChange || !selectedMethods) return;
    if (selectedMethods.includes(method)) {
      if (selectedMethods.length > 1) {
        onMethodsChange(selectedMethods.filter((m) => m !== method));
      }
    } else {
      onMethodsChange([...selectedMethods, method]);
    }
  };

  // Show the opposite group first: if pair is crypto → fiat first, and vice versa
  const orderedGroups = pairCurrency && CRYPTO_SET.has(pairCurrency)
    ? [...PICKER_GROUPS].reverse()
    : PICKER_GROUPS;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(formatWithSpaces(e.target.value));
  };

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
          {loading ? (
            <div className="flex-1 py-2">
              <Skeleton className="h-[40px] w-3/5" />
            </div>
          ) : (
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={handleInputChange}
              className={cn(
                'bg-transparent text-foreground font-bold w-full outline-none placeholder-muted-foreground tracking-tight transition-[font-size] duration-150',
                inputFontSize,
              )}
              placeholder="0"
            />
          )}
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

        {/* Payment method pills for non-RUB fiat */}
        {showMethodPills && selectedMethods && onMethodsChange && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => toggleMethod('swift')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-full text-[13px] font-medium transition-all border',
                selectedMethods.includes('swift')
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-transparent text-muted-foreground border-border hover:border-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all',
                  selectedMethods.includes('swift')
                    ? 'border-background bg-background'
                    : 'border-muted-foreground',
                )}
              >
                {selectedMethods.includes('swift') && (
                  <span className="w-2 h-2 rounded-full bg-foreground" />
                )}
              </span>
              SWIFT/SEPA
            </button>
            <button
              onClick={() => toggleMethod('local_banks')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-full text-[13px] font-medium transition-all border',
                selectedMethods.includes('local_banks')
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-transparent text-muted-foreground border-border hover:border-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all',
                  selectedMethods.includes('local_banks')
                    ? 'border-background bg-background'
                    : 'border-muted-foreground',
                )}
              >
                {selectedMethods.includes('local_banks') && (
                  <span className="w-2 h-2 rounded-full bg-foreground" />
                )}
              </span>
              Локальные банки
            </button>
          </div>
        )}
      </div>

      {/* Currency picker */}
      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <h3 className="text-[20px] font-bold mb-4">
          {label === 'Меняю' ? 'Выберите валюту, которую меняете' : 'Выберите валюту, которую хотите получить'}
        </h3>
        <div className="max-h-[60vh] overflow-y-auto no-scrollbar">
          {recentCurrencies.length > 0 && (
            <div className="mb-4">
              <p className="text-[13px] text-muted-foreground font-semibold uppercase tracking-wide mb-2 px-1">
                Недавние
              </p>
              <div className="flex flex-col gap-0.5">
                {recentCurrencies.map((c) => (
                  <CurrencyRow
                    key={c}
                    code={c}
                    selected={currency === c}
                    onSelect={() => {
                      onCurrencyChange(c);
                      addRecentCurrency(c);
                      setRecentCurrencies(getRecentCurrencies());
                      setPickerOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {orderedGroups.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="text-[13px] text-muted-foreground font-semibold uppercase tracking-wide mb-2 px-1">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.currencies.map((c) => (
                  <CurrencyRow
                    key={c}
                    code={c}
                    selected={currency === c}
                    onSelect={() => {
                      onCurrencyChange(c);
                      addRecentCurrency(c);
                      setRecentCurrencies(getRecentCurrencies());
                      setPickerOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
