import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';
import { useState } from 'react';

export type RateSource = 'vas3k' | 'google' | 'custom' | 'market';

interface RateSelectorProps {
  source: RateSource;
  onSourceChange: (source: RateSource) => void;
  customRate: string;
  onCustomRateChange: (rate: string) => void;
  vas3kRate: number | null;
  googleRate: number | null;
  loading: boolean;
}

export function RateSelector({
  source,
  onSourceChange,
  customRate,
  onCustomRateChange,
  vas3kRate,
  googleRate,
  loading,
}: RateSelectorProps) {
  const [showHelp, setShowHelp] = useState(false);

  if (loading) {
    return (
      <div className="px-1 flex flex-col gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between bg-card p-4 rounded-[20px] border border-transparent">
            <div className="flex items-center gap-3">
              <Skeleton className="w-6 h-6 rounded-full shrink-0" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    );
  }

  const options: Array<{
    value: RateSource;
    label: string;
    rate: number | null;
  }> = [
    { value: 'vas3k', label: 'Равновесный', rate: vas3kRate },
    { value: 'google', label: 'Google', rate: googleRate },
    { value: 'custom', label: 'Свой курс', rate: null },
  ];

  return (
    <div className="px-1">
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isSelected = source === option.value;
          return (
            <label key={option.value} className="relative block cursor-pointer">
              <input
                type="radio"
                name="rate-source"
                checked={isSelected}
                onChange={() => onSourceChange(option.value)}
                className="peer hidden"
              />
              <div
                className={cn(
                  'flex items-center justify-between bg-card p-4 rounded-[20px] border transition',
                  isSelected ? 'border-foreground/20' : 'border-transparent hover:border-border',
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full border-2 relative box-border transition-all duration-300 shrink-0',
                      isSelected ? 'border-foreground bg-foreground' : 'border-muted-foreground',
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-background rounded-full" />
                    )}
                  </div>
                  <span className="text-[16px] font-medium text-foreground flex items-center gap-1.5">
                    {option.label}
                    {option.value === 'vas3k' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowHelp(true);
                        }}
                        className="text-muted-foreground active:text-foreground transition-colors"
                      >
                        <HelpCircle className="w-[16px] h-[16px] top-[1px] relative" />
                      </button>
                    )}
                  </span>
                </div>
                {option.rate !== null && (
                  <span className="text-[15px] text-muted-foreground font-mono">
                    {option.rate.toFixed(2)} ₽
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {source === 'custom' && (
        <div className="mt-3 flex items-center gap-3 px-1">
          <span className="text-[15px] text-muted-foreground whitespace-nowrap">1 USDT =</span>
          <input
            type="text"
            inputMode="decimal"
            value={customRate}
            onChange={(e) => onCustomRateChange(e.target.value.replace(/[^\d.]/g, ''))}
            className="flex-1 h-12 px-4 text-[18px] font-bold bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            placeholder="Введите курс"
          />
          <span className="text-[15px] text-muted-foreground">₽</span>
        </div>
      )}

      <BottomSheet open={showHelp} onClose={() => setShowHelp(false)}>
        <h3 className="text-[18px] font-bold text-foreground mb-3">Равновесный курс</h3>
        <p className="text-[15px] text-muted-foreground leading-relaxed mb-3">
          Это{' '}
          <a
            href="https://kurs.vas3k.club"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            Вастрик.Курс
          </a>
          , который учитывает разницу между «гугловским» курсом доллара и реальными курсами криптообменников. Зачастую она доходит до 2 рублей.
        </p>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          Это справедливая середина между тем, что показывает Google, и тем, что предлагают обменники на практике.
        </p>
      </BottomSheet>
    </div>
  );
}

interface MarketRateSelectorProps {
  source: 'market' | 'custom';
  onSourceChange: (source: 'market' | 'custom') => void;
  customRate: string;
  onCustomRateChange: (rate: string) => void;
  marketRate: number | null;
  fromCurrency: string;
  toCurrency: string;
  loading: boolean;
}

export function MarketRateSelector({
  source,
  onSourceChange,
  customRate,
  onCustomRateChange,
  marketRate,
  fromCurrency,
  toCurrency,
  loading,
}: MarketRateSelectorProps) {
  if (loading) {
    return (
      <div className="px-1 flex flex-col gap-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between bg-card p-4 rounded-[20px] border border-transparent">
            <div className="flex items-center gap-3">
              <Skeleton className="w-6 h-6 rounded-full shrink-0" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    );
  }

  const formatRate = (rate: number) => {
    if (rate >= 1) return rate.toFixed(2);
    return rate.toPrecision(4);
  };

  const options: Array<{
    value: 'market' | 'custom';
    label: string;
    rate: number | null;
    disabled?: boolean;
  }> = [
    { 
      value: 'market', 
      label: 'Рыночный', 
      rate: marketRate,
      disabled: marketRate === null,
    },
    { value: 'custom', label: 'Свой курс', rate: null },
  ];

  return (
    <div className="px-1">
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isSelected = source === option.value;
          const isDisabled = option.disabled;
          return (
            <label 
              key={option.value} 
              className={cn(
                'relative block',
                isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              )}
            >
              <input
                type="radio"
                name="market-rate-source"
                checked={isSelected}
                onChange={() => !isDisabled && onSourceChange(option.value)}
                disabled={isDisabled}
                className="peer hidden"
              />
              <div
                className={cn(
                  'flex items-center justify-between bg-card p-4 rounded-[20px] border transition',
                  isSelected ? 'border-foreground/20' : 'border-transparent hover:border-border',
                  isDisabled && 'hover:border-transparent',
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full border-2 relative box-border transition-all duration-300 shrink-0',
                      isSelected ? 'border-foreground bg-foreground' : 'border-muted-foreground',
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-background rounded-full" />
                    )}
                  </div>
                  <span className="text-[16px] font-medium text-foreground">
                    {option.label}
                    {option.value === 'market' && marketRate === null && (
                      <span className="text-muted-foreground text-[14px] ml-1.5">(недоступен)</span>
                    )}
                  </span>
                </div>
                {option.rate !== null && (
                  <span className="text-[15px] text-muted-foreground font-mono">
                    {formatRate(option.rate)} {toCurrency}
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {source === 'custom' && (
        <div className="mt-3 flex items-center gap-3 px-1 pb-1">
          <span className="text-[15px] text-muted-foreground whitespace-nowrap">1 {fromCurrency} =</span>
          <input
            type="text"
            inputMode="decimal"
            value={customRate}
            onChange={(e) => onCustomRateChange(e.target.value.replace(/[^\d.]/g, ''))}
            className="flex-1 h-12 text-right max-w-30 px-4 text-[18px] font-bold bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            placeholder="Введите курс"
          />
          <span className="text-[15px] text-muted-foreground">{toCurrency}</span>
        </div>
      )}
    </div>
  );
}
