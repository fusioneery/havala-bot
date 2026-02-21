import { useCallback, useEffect, useRef, useState } from 'react';

interface MinExchangeAmountProps {
  value: string;
  onChange: (value: string) => void;
  maxAmount: string;
  currency: string;
}

function parseAmount(str: string): number {
  return Number(str.replace(/[^\d.]/g, '')) || 0;
}

function formatAmount(num: number): string {
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function SplitSlider({ value, onChange, maxAmount, currency }: MinExchangeAmountProps) {
  const sliderRef = useRef<HTMLInputElement>(null);
  const max = parseAmount(maxAmount);
  const currentValue = parseAmount(value);
  
  const percent = max > 0 ? Math.round((currentValue / max) * 100) : 100;
  
  const [inputValue, setInputValue] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const updateSliderBackground = useCallback((val: number) => {
    if (sliderRef.current) {
      sliderRef.current.style.backgroundSize = `${val}% 100%`;
    }
  }, []);

  useEffect(() => {
    updateSliderBackground(percent);
  }, [percent, updateSliderBackground]);

  const validate = useCallback((val: string): boolean => {
    const num = parseAmount(val);
    if (num < 0) {
      setError('Минимум 0');
      return false;
    }
    if (num > max) {
      setError(`Максимум ${formatAmount(max)}`);
      return false;
    }
    setError(null);
    return true;
  }, [max]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    validate(raw);
  };

  const handleInputBlur = () => {
    const num = parseAmount(inputValue);
    const clamped = Math.max(0, Math.min(num, max));
    const formatted = formatAmount(clamped);
    setInputValue(formatted);
    onChange(formatted);
    setError(null);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPercent = Number(e.target.value);
    const newAmount = Math.round((max * newPercent) / 100);
    const formatted = formatAmount(newAmount);
    setInputValue(formatted);
    onChange(formatted);
    updateSliderBackground(newPercent);
    setError(null);
  };

  return (
    <div className="mt-8 px-2">
      <div className="flex justify-between items-center mb-2">
        <label className="text-[17px] font-semibold leading-none text-foreground">
          Минимальная сумма обмена
        </label>
        <div className="flex items-center gap-2">
          {percent === 0 ? (
            <span className="h-10 px-3 flex items-center text-[17px] font-bold text-muted-foreground">любая</span>
          ) : percent === 100 ? (
            <span className="h-10 px-3 flex items-center text-[17px] font-bold text-muted-foreground">только полная</span>
          ) : (
            <>
              <input
                type="text"
                inputMode="numeric"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                className="w-24 h-10 px-3 text-right text-[17px] font-bold bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              />
              <span className="text-[15px] text-muted-foreground font-medium min-w-[50px]">
                {currency}
              </span>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-destructive text-[13px] mb-3 text-right">{error}</p>
      )}

      <div className="relative h-14 flex items-center mb-2">
        <input
          ref={sliderRef}
          type="range"
          min="0"
          max="100"
          step="1"
          value={percent}
          onChange={handleSliderChange}
          className="range-slider relative z-10"
        />

        {/* Tick marks */}
        <div className="absolute w-full flex justify-between px-[14px] pointer-events-none top-[36px]">
          {[0, 50, 100].map((tick) => (
            <div key={tick} className="flex flex-col items-center gap-1.5">
              <div className="w-0.5 h-1.5 bg-muted rounded-full" />
              <span className="text-[11px] text-muted-foreground font-medium font-mono">
                {tick}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
