import { RubIcon, UsdtIcon, getCurrencyColor } from '@/components/order/currency-icons';
import { CurrencyInput, formatWithSpaces } from '@/components/order/currency-input';
import { RateSelector, type RateSource } from '@/components/order/rate-selector';
import { SplitSlider } from '@/components/order/split-slider';
import { SwapButton } from '@/components/order/swap-button';
import { VisibilitySelector } from '@/components/order/visibility-selector';
import { AccordionSection } from '@/components/ui/accordion-section';
import type { Visibility } from '@hawala/shared';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function CreateOrderPage() {
  // ─── Form state ────────────────────────────
  const [fromAmount, setFromAmount] = useState('1 000');
  const [toAmount, setToAmount] = useState('92 000');
  const [fromCurrency, setFromCurrency] = useState('USDT');
  const [toCurrency, setToCurrency] = useState('RUB');
  const [minExchangeAmount, setMinExchangeAmount] = useState('0');
  const [visibility, setVisibility] = useState<Visibility>('friends_and_acquaintances');

  // ─── Rate state ──────────────────────────────
  const [rateSource, setRateSource] = useState<RateSource>('vas3k');
  const [customRate, setCustomRate] = useState('');
  const [vas3kRate, setVas3kRate] = useState<number | null>(null);
  const [googleRate, setGoogleRate] = useState<number | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);

  useEffect(() => {
    fetch('https://kurs.vas3k.club/current-rates.json')
      .then((res) => res.json())
      .then((data) => {
        const v = parseFloat(data.vas3k.rate);
        const g = parseFloat(data.google.rate);
        setVas3kRate(v);
        setGoogleRate(g);
        setCustomRate(v.toFixed(2));
      })
      .catch(console.error)
      .finally(() => setRatesLoading(false));
  }, []);

  const effectiveRate = useMemo(() => {
    if (rateSource === 'vas3k') return vas3kRate;
    if (rateSource === 'google') return googleRate;
    return parseFloat(customRate) || null;
  }, [rateSource, vas3kRate, googleRate, customRate]);

  // ─── Recalculate toAmount when rate or fromAmount changes ───
  useEffect(() => {
    if (!effectiveRate || effectiveRate <= 0) return;
    const from = Number(fromAmount.replace(/[^\d.]/g, '')) || 0;
    if (from <= 0) return;

    let result: number;
    if (fromCurrency === 'USDT' && toCurrency === 'RUB') {
      result = from * effectiveRate;
    } else if (fromCurrency === 'RUB' && toCurrency === 'USDT') {
      result = from / effectiveRate;
    } else {
      return;
    }

    const str = result >= 100 ? Math.round(result).toString() : result.toFixed(2);
    setToAmount(formatWithSpaces(str));
  }, [fromAmount, effectiveRate, fromCurrency, toCurrency]);

  const ratePreview = useMemo(() => {
    if (ratesLoading) return '...';
    const labels: Record<RateSource, string> = {
      vas3k: 'равновесный',
      google: 'Google',
      custom: 'свой',
    };
    const rate = effectiveRate?.toFixed(2) ?? '—';
    return `${rate} ₽ — ${labels[rateSource]}`;
  }, [effectiveRate, rateSource, ratesLoading]);

  const visibilityLabels: Record<Visibility, string> = {
    friends_and_acquaintances: 'Друзья и знакомые',
    friends_only: 'Только друзья',
  };

  const splitPreview = useCallback(
    (open: boolean) => {
      const parse = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;
      const max = parse(fromAmount);
      const current = parse(minExchangeAmount);
      if (current <= 0) return 'любая';
      if (current >= max) return 'только полная';
      return open ? undefined : `${minExchangeAmount} ${fromCurrency}`;
    },
    [minExchangeAmount, fromAmount, fromCurrency],
  );

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
      rate: effectiveRate,
      rateSource,
      minExchangeAmount,
      visibility,
    });
  }, [fromAmount, toAmount, fromCurrency, toCurrency, effectiveRate, rateSource, minExchangeAmount, visibility]);

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

        {/* ── Exchange rate ── */}
        <AccordionSection title="Курс" preview={ratePreview} className="mt-6">
          <RateSelector
            source={rateSource}
            onSourceChange={setRateSource}
            customRate={customRate}
            onCustomRateChange={setCustomRate}
            vas3kRate={vas3kRate}
            googleRate={googleRate}
            loading={ratesLoading}
          />
        </AccordionSection>

        {/* ── Minimum exchange amount ── */}
        <AccordionSection title="Минимальная сумма обмена" preview={splitPreview} className="mt-2">
          <SplitSlider
            value={minExchangeAmount}
            onChange={setMinExchangeAmount}
            maxAmount={fromAmount}
            currency={fromCurrency}
            toMaxAmount={toAmount}
            toCurrency={toCurrency}
          />
        </AccordionSection>

        {/* ── Visibility selector ── */}
        <AccordionSection title="Круг поиска" preview={visibilityLabels[visibility]} className="mt-2">
          <VisibilitySelector value={visibility} onChange={setVisibility} groupName="Hawala обмен" />
        </AccordionSection>
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
