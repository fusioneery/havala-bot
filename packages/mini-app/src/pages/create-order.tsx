import { RubIcon, UsdtIcon, getCurrencyColor } from '@/components/order/currency-icons';
import { CurrencyInput } from '@/components/order/currency-input';
import { SplitSlider } from '@/components/order/split-slider';
import { SwapButton } from '@/components/order/swap-button';
import { VisibilitySelector } from '@/components/order/visibility-selector';
import type { Visibility } from '@hawala/shared';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export default function CreateOrderPage() {
  // ─── Form state ────────────────────────────
  const [fromAmount, setFromAmount] = useState('1 000');
  const [toAmount, setToAmount] = useState('92 000');
  const [fromCurrency, setFromCurrency] = useState('USDT');
  const [toCurrency, setToCurrency] = useState('RUB');
  const [minExchangeAmount, setMinExchangeAmount] = useState('0');
  const [visibility, setVisibility] = useState<Visibility>('friends_and_acquaintances');

  // ─── Clamp minExchangeAmount when fromAmount changes ───
  useEffect(() => {
    const parseAmount = (str: string) => Number(str.replace(/[^\d.]/g, '')) || 0;
    const formatAmount = (num: number) =>
      Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    
    const max = parseAmount(fromAmount);
    const current = parseAmount(minExchangeAmount);
    
    if (current > max) {
      setMinExchangeAmount(formatAmount(max));
    }
  }, [fromAmount, minExchangeAmount]);

  // ─── Swap currencies ───────────────────────
  const handleSwap = useCallback(() => {
    setFromAmount(toAmount);
    setToAmount(fromAmount);
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setMinExchangeAmount(toAmount);
  }, [fromAmount, toAmount, fromCurrency, toCurrency]);

  // ─── Submit ────────────────────────────────
  const handleSubmit = useCallback(() => {
    // TODO: POST /api/offers and navigate to match screen
    console.log({
      fromAmount,
      toAmount,
      fromCurrency,
      toCurrency,
      minExchangeAmount,
      visibility,
    });
  }, [fromAmount, toAmount, fromCurrency, toCurrency, minExchangeAmount, visibility]);

  // ─── Currency icon renderers ───────────────
  const getIcon = (currency: string) => {
    if (currency === 'USDT') return <UsdtIcon />;
    if (currency === 'RUB') return <RubIcon />;
    return undefined;
  };
  const fromIcon = getIcon(fromCurrency);
  const toIcon = getIcon(toCurrency);

  return (
    <div className="w-full h-dvh flex flex-col bg-background text-foreground">
      {/* ── Scrollable content ── */}
      <main className="flex-1 overflow-y-auto no-scrollbar px-4 pt-6 pb-32">
        {/* ── Currency pair cards ── */}
        <div className="flex flex-col gap-2 relative mt-4">
          <CurrencyInput
            label="Меняю"
            value={fromAmount}
            onChange={setFromAmount}
            currency={fromCurrency}
            onCurrencyChange={setFromCurrency}
            currencyColor={getCurrencyColor(fromCurrency)}
            currencyIcon={fromIcon}
            className="pb-8"
          />

          <SwapButton onSwap={handleSwap} />

          <CurrencyInput
            label="На"
            value={toAmount}
            onChange={setToAmount}
            currency={toCurrency}
            onCurrencyChange={setToCurrency}
            currencyColor={getCurrencyColor(toCurrency)}
            currencyIcon={toIcon}
            className="pt-8"
          />
        </div>

        {/* ── Minimum exchange amount ── */}
        <SplitSlider
          value={minExchangeAmount}
          onChange={setMinExchangeAmount}
          maxAmount={fromAmount}
          currency={fromCurrency}
        />

        {/* ── Visibility selector ── */}
        <VisibilitySelector value={visibility} onChange={setVisibility} groupName="Hawala обмен" />
      </main>

      {/* ── Fixed bottom CTA ── */}
      <div className="fixed bottom-0 left-0 w-full p-5 pb-8 bg-gradient-to-t from-background via-background to-transparent z-40 pointer-events-none">
        <button
          onClick={handleSubmit}
          className="pointer-events-auto w-full bg-primary hover:opacity-90 text-primary-foreground h-[60px] rounded-[24px] font-bold text-[18px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          <Search className="w-5 h-5" />
          Искать
        </button>
      </div>
    </div>
  );
}
