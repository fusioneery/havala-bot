import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export type RateSource = 'vas3k' | 'google' | 'custom';

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
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
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
                  <span className="text-[16px] font-medium text-foreground">
                    {option.label}
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
    </div>
  );
}
