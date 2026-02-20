import { useState, useCallback } from 'react';
import { X, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Visibility } from '@hawala/shared';
import { CurrencyInput } from '@/components/order/currency-input';
import { SwapButton } from '@/components/order/swap-button';
import { SplitSlider } from '@/components/order/split-slider';
import { VisibilitySelector } from '@/components/order/visibility-selector';
import { UsdtIcon, RubIcon, getCurrencyColor } from '@/components/order/currency-icons';

export default function CreateOrderPage() {
  const navigate = useNavigate();

  // ─── Form state ────────────────────────────
  const [fromAmount, setFromAmount] = useState('1,000');
  const [toAmount, setToAmount] = useState('92,000');
  const [fromCurrency, setFromCurrency] = useState('USDT');
  const [toCurrency, setToCurrency] = useState('RUB');
  const [splitPercent, setSplitPercent] = useState(50);
  const [visibility, setVisibility] = useState<Visibility>('friends_and_acquaintances');

  // ─── Swap currencies ───────────────────────
  const handleSwap = useCallback(() => {
    setFromAmount(toAmount);
    setToAmount(fromAmount);
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  }, [fromAmount, toAmount, fromCurrency, toCurrency]);

  // ─── Submit ────────────────────────────────
  const handleSubmit = useCallback(() => {
    // TODO: POST /api/offers and navigate to match screen
    console.log({
      fromAmount,
      toAmount,
      fromCurrency,
      toCurrency,
      splitPercent,
      visibility,
    });
  }, [fromAmount, toAmount, fromCurrency, toCurrency, splitPercent, visibility]);

  // ─── Currency icon renderers ───────────────
  const fromIcon = fromCurrency === 'USDT' ? <UsdtIcon /> : undefined;
  const toIcon = toCurrency === 'RUB' ? <RubIcon /> : undefined;

  return (
    <div className="w-full h-dvh flex flex-col bg-background text-white">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 pt-8 pb-4 bg-background sticky top-0 z-30">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-surface text-[#E5E5EA] flex items-center justify-center hover:bg-surface-hover transition active:scale-95"
        >
          <X className="w-[18px] h-[18px]" strokeWidth={2.5} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-white">
          Создать заявку
        </h1>
        <button className="w-10 h-10 rounded-full bg-surface text-[#E5E5EA] flex items-center justify-center hover:bg-surface-hover transition active:scale-95">
          <MoreHorizontal className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </header>

      {/* ── Scrollable content ── */}
      <main className="flex-1 overflow-y-auto no-scrollbar px-4 pb-32">
        {/* ── Currency pair cards ── */}
        <div className="flex flex-col gap-2 relative mt-4">
          <CurrencyInput
            label="Меняю"
            value={fromAmount}
            onChange={setFromAmount}
            currency={fromCurrency}
            currencyColor={getCurrencyColor(fromCurrency)}
            currencyIcon={fromIcon}
            onCurrencyClick={() => {/* TODO: open currency picker */}}
            balance="4,200"
            className="pb-8"
          />

          <SwapButton onSwap={handleSwap} />

          <CurrencyInput
            label="На"
            value={toAmount}
            onChange={setToAmount}
            currency={toCurrency}
            currencyColor={getCurrencyColor(toCurrency)}
            currencyIcon={toIcon}
            onCurrencyClick={() => {/* TODO: open currency picker */}}
            className="pt-8"
          />
        </div>

        {/* ── Split slider ── */}
        <SplitSlider value={splitPercent} onChange={setSplitPercent} />

        {/* ── Visibility selector ── */}
        <VisibilitySelector value={visibility} onChange={setVisibility} />
      </main>

      {/* ── Fixed bottom CTA ── */}
      <div className="fixed bottom-0 left-0 w-full p-5 pb-8 bg-gradient-to-t from-background via-background to-transparent z-40 pointer-events-none">
        <button
          onClick={handleSubmit}
          className="pointer-events-auto w-full bg-lime hover:bg-lime-hover text-background h-[60px] rounded-[24px] font-bold text-[18px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(200,241,53,0.2)]"
        >
          Искать
        </button>
      </div>
    </div>
  );
}
