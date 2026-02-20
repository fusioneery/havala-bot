import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  currencyColor: string;
  currencyIcon?: React.ReactNode;
  onCurrencyClick: () => void;
  balance?: string;
  className?: string;
}

export function CurrencyInput({
  label,
  value,
  onChange,
  currency,
  currencyColor,
  currencyIcon,
  onCurrencyClick,
  balance,
  className,
}: CurrencyInputProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only digits and commas for formatting
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (raw === '') {
      onChange('');
      return;
    }
    // Format with commas
    const formatted = Number(raw).toLocaleString('en-US');
    onChange(formatted);
  };

  return (
    <div
      className={cn(
        'bg-surface rounded-[28px] p-6 active:scale-[0.99] transition-transform duration-200 shadow-sm border border-white/5',
        className,
      )}
    >
      <div className="flex justify-between items-center mb-3">
        <label className="text-label text-[15px] font-medium">{label}</label>
        {balance && (
          <span className="text-label text-[11px] font-semibold tracking-wide bg-surface-hover px-2.5 py-1 rounded-md uppercase">
            Баланс: {balance}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={handleInputChange}
          className="bg-transparent text-white text-[40px] font-bold w-full outline-none placeholder-surface-active tracking-tight"
          placeholder="0"
        />
        <button
          onClick={onCurrencyClick}
          className="flex items-center gap-2 bg-surface-hover hover:bg-surface-active active:bg-[#505052] transition rounded-full pl-2 pr-4 py-1.5 min-w-fit h-[48px]"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] overflow-hidden shrink-0 shadow-inner"
            style={{ backgroundColor: currencyColor }}
          >
            {currencyIcon || (
              <span className="font-bold text-white text-[10px]">
                {currency.charAt(0)}
              </span>
            )}
          </div>
          <span className="text-[17px] font-semibold text-white">{currency}</span>
          <ChevronDown className="w-3.5 h-3.5 text-label" />
        </button>
      </div>
    </div>
  );
}
