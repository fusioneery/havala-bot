import { CryptoIcon, FlagIcon, getCurrencyColor, hasCryptoIcon, hasFlagIcon } from '@/components/order/currency-icons';
import { Skeleton } from '@/components/ui/skeleton';
import { CurrencyInput, formatWithSpaces } from '@/components/order/currency-input';
import { MarketRateSelector, RateSelector, type RateSource } from '@/components/order/rate-selector';
import { SplitSlider } from '@/components/order/split-slider';
import { SwapButton } from '@/components/order/swap-button';
import { VisibilitySelector } from '@/components/order/visibility-selector';
import { AccordionSection } from '@/components/ui/accordion-section';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useAutoOpenAccordions } from '@/hooks/use-auto-open-accordions';
import { apiFetch } from '@/lib/api';
import { useBackButton } from '@/hooks/use-back-button';
import { usePersistedFormState } from '@/hooks/use-persisted-state';
import { getDefaultPaymentMethod, type Currency, type PaymentMethodGroup, type SearchRequest, type SearchResponse, type Visibility } from '@hawala/shared';
import { Loader2, Search, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface RateLimitError {
  dailyCount: number;
  monthlyCount: number;
  dailyLimit: number;
  monthlyLimit: number;
}

type MethodSelection = ('swift' | 'local_banks')[];

const ALL_FIAT_METHODS: MethodSelection = ['swift', 'local_banks'];

export default function CreateOrderPage() {
  const navigate = useNavigate();
  useBackButton('/');
  const { saved, persist, isFirstVisit } = usePersistedFormState();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<RateLimitError | null>(null);

  // ─── Form state ────────────────────────────
  const [fromAmount, setFromAmount] = useState(saved.fromAmount ?? '1 000');
  const [toAmount, setToAmount] = useState('');
  const [fromCurrency, setFromCurrency] = useState(saved.fromCurrency ?? 'USDT');
  const [toCurrency, setToCurrency] = useState(saved.toCurrency ?? 'RUB');
  const [minExchangeAmount, setMinExchangeAmount] = useState(saved.minExchangeAmount ?? '0');
  const [visibility, setVisibility] = useState<Visibility>((saved.visibility as Visibility) ?? 'friends_and_acquaintances');
  const [fromMethods, setFromMethods] = useState<MethodSelection>(['swift']);
  const [toMethods, setToMethods] = useState<MethodSelection>(['swift']);

  // ─── Rate state ──────────────────────────────
  const [rateSource, setRateSource] = useState<RateSource>((saved.rateSource as RateSource) ?? 'vas3k');
  const [customRate, setCustomRate] = useState('');
  const [vas3kRate, setVas3kRate] = useState<number | null>(null);
  const [googleRate, setGoogleRate] = useState<number | null>(null);
  const [marketRate, setMarketRate] = useState<number | null>(null);
  const [marketRateSource, setMarketRateSource] = useState<'market' | 'custom'>('market');
  const [marketCustomRate, setMarketCustomRate] = useState('');
  const [ratesLoading, setRatesLoading] = useState(true);

  const isUsdtRubPair =
    (fromCurrency === 'USDT' && toCurrency === 'RUB') ||
    (fromCurrency === 'RUB' && toCurrency === 'USDT');

  // Fetch vas3k rates for USDT/RUB pair
  useEffect(() => {
    if (!isUsdtRubPair) return;
    setRatesLoading(true);
    apiFetch('/api/rates')
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
  }, [isUsdtRubPair]);

  // Fetch market rate for non USDT/RUB pairs
  useEffect(() => {
    if (isUsdtRubPair) return;
    setRatesLoading(true);
    setMarketRate(null);
    setMarketRateSource('market');
    apiFetch(`/api/rates/market?from=${fromCurrency}&to=${toCurrency}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.rate) {
          setMarketRate(data.rate);
          const formatted = data.rate >= 1 ? data.rate.toFixed(2) : data.rate.toPrecision(4);
          setMarketCustomRate(formatted);
        } else {
          setMarketRateSource('custom');
          setMarketCustomRate('');
        }
      })
      .catch(console.error)
      .finally(() => setRatesLoading(false));
  }, [isUsdtRubPair, fromCurrency, toCurrency]);

  const effectiveRate = useMemo(() => {
    if (!isUsdtRubPair) {
      if (marketRateSource === 'custom') {
        return parseFloat(marketCustomRate) || null;
      }
      return marketRate;
    }
    if (rateSource === 'vas3k') return vas3kRate;
    if (rateSource === 'google') return googleRate;
    return parseFloat(customRate) || null;
  }, [isUsdtRubPair, marketRate, marketRateSource, marketCustomRate, rateSource, vas3kRate, googleRate, customRate]);

  // ─── Recalculate toAmount when rate or fromAmount changes ───
  useEffect(() => {
    if (!effectiveRate || effectiveRate <= 0) return;
    const from = Number(fromAmount.replace(/[^\d.]/g, '')) || 0;
    if (from <= 0) return;

    // For USDT/RUB legacy: vas3k rate is always USDT→RUB direction
    let result: number;
    if (isUsdtRubPair) {
      if (fromCurrency === 'USDT') {
        result = from * effectiveRate;
      } else {
        result = from / effectiveRate;
      }
    } else {
      // Market rate is already from→to direction
      result = from * effectiveRate;
    }

    const str = result >= 100 ? Math.round(result).toString() : result.toFixed(2);
    setToAmount(formatWithSpaces(str));
  }, [fromAmount, effectiveRate, fromCurrency, toCurrency, isUsdtRubPair]);

  const ratePreview = useMemo(() => {
    if (ratesLoading) return '...';
    if (!isUsdtRubPair) {
      if (!effectiveRate) return '—';
      const formatted = effectiveRate >= 1 ? effectiveRate.toFixed(2) : effectiveRate.toPrecision(4);
      const sourceLabel = marketRateSource === 'custom' ? ' — свой' : '';
      return `1 ${fromCurrency} = ${formatted} ${toCurrency}${sourceLabel}`;
    }
    const labels: Record<RateSource, string> = {
      vas3k: 'равновесный',
      google: 'Google',
      custom: 'свой',
      market: 'рыночный',
    };
    const rate = effectiveRate?.toFixed(2) ?? '—';
    return `${rate} ₽ — ${labels[rateSource]}`;
  }, [effectiveRate, rateSource, marketRateSource, ratesLoading, isUsdtRubPair, fromCurrency, toCurrency]);

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
    const formatAmount = (num: number): string => {
      if (num === 0) return '0';
      if (num >= 100) return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      if (num >= 1) return (Math.round(num * 100) / 100).toString();
      return Number(num.toPrecision(4)).toString();
    };
    
    const max = parseAmount(fromAmount);
    const current = parseAmount(minExchangeAmount);
    
    if (current > max) {
      setMinExchangeAmount(formatAmount(max));
    }
  }, [fromAmount, minExchangeAmount]);

  // ─── Reset methods when currency changes ───
  // For non-RUB fiat: default to all payment methods (swift + local_banks)
  const isNonRubFiat = (c: string) => {
    const defaultMethod = getDefaultPaymentMethod(c);
    return defaultMethod === 'swift' || defaultMethod === 'local_banks';
  };

  useEffect(() => {
    setFromMethods(isNonRubFiat(fromCurrency) ? ALL_FIAT_METHODS : ['swift']);
  }, [fromCurrency]);

  useEffect(() => {
    setToMethods(isNonRubFiat(toCurrency) ? ALL_FIAT_METHODS : ['swift']);
  }, [toCurrency]);

  // ─── Swap currencies ───────────────────────
  const handleSwap = useCallback(() => {
    setFromAmount(toAmount);
    setToAmount(fromAmount);
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setFromMethods(toMethods);
    setToMethods(fromMethods);
    setMinExchangeAmount(toAmount);
  }, [fromAmount, toAmount, fromCurrency, toCurrency, fromMethods, toMethods]);

  // ─── Build payment methods based on currency type ───
  const buildPaymentMethods = useCallback((currency: string, selectedMethods: MethodSelection): PaymentMethodGroup[] => {
    const defaultMethod = getDefaultPaymentMethod(currency);
    if (defaultMethod === 'russian_banks' || defaultMethod === 'crypto') {
      return [defaultMethod];
    }
    return selectedMethods as PaymentMethodGroup[];
  }, []);

  // ─── Submit ────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const parseAmount = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;

    const body: SearchRequest = {
      fromCurrency,
      toCurrency,
      amount: parseAmount(fromAmount),
      minSplitAmount: parseAmount(minExchangeAmount),
      visibility,
      givePaymentMethods: [{ currency: fromCurrency as Currency, methods: buildPaymentMethods(fromCurrency, fromMethods) }],
      takePaymentMethods: [{ currency: toCurrency as Currency, methods: buildPaymentMethods(toCurrency, toMethods) }],
    };

    try {
      const res = await apiFetch('/api/offers/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        const errorData = await res.json();
        setRateLimitError({
          dailyCount: errorData.dailyCount,
          monthlyCount: errorData.monthlyCount,
          dailyLimit: errorData.dailyLimit,
          monthlyLimit: errorData.monthlyLimit,
        });
        return;
      }

      if (!res.ok) throw new Error(`Search failed: ${res.status}`);

      const data: SearchResponse = await res.json();

      persist({ fromCurrency, toCurrency, fromAmount, minExchangeAmount, visibility, rateSource });

      sessionStorage.setItem(
        `matches:${data.userOffer.id}`,
        JSON.stringify({ matches: data.matches, offerText: data.offerText, searchedAt: new Date().toISOString() }),
      );

      navigate(`/matches/${data.userOffer.id}`);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, fromCurrency, toCurrency, fromAmount, minExchangeAmount, visibility, rateSource, fromMethods, toMethods, buildPaymentMethods, navigate, persist]);

  // ─── Currency icon renderers ───────────────
  const getIcon = (currency: string) => {
    if (hasCryptoIcon(currency)) return <CryptoIcon code={currency} />;
    if (hasFlagIcon(currency)) return <FlagIcon code={currency} />;
    return undefined;
  };
  const fromIcon = getIcon(fromCurrency);
  const toIcon = getIcon(toCurrency);

  // ─── Auto-open accordions if viewport allows ───
  // Only for first-time users (no prior searches)
  // Indices: 0=rate, 1=split, 2=visibility
  // Skip rate accordion (index 0) from auto-opening
  const acc = useAutoOpenAccordions(3, isFirstVisit, [0]);

  return (
    <div className="w-full h-dvh flex flex-col bg-background text-foreground">
      {/* ── Scrollable content ── */}
      <main ref={acc.containerRef} className="flex-1 overflow-y-auto no-scrollbar px-4 pb-32">
        <div className="sticky top-0 h-6 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
        {/* ── Currency pair cards ── */}
        <div className="flex flex-col gap-2 mt-4">
          <div className="relative">
            <CurrencyInput
              label="Меняю"
              value={fromAmount}
              onChange={setFromAmount}
              currency={fromCurrency}
              onCurrencyChange={setFromCurrency}
              currencyColor={getCurrencyColor(fromCurrency)}
              currencyIcon={fromIcon}
              pairCurrency={toCurrency}
              className="pb-8"
              selectedMethods={fromMethods}
              onMethodsChange={setFromMethods}
            />
            <SwapButton onSwap={handleSwap} />
          </div>

          <CurrencyInput
            label="На"
            value={toAmount}
            onChange={setToAmount}
            currency={toCurrency}
            onCurrencyChange={setToCurrency}
            currencyColor={getCurrencyColor(toCurrency)}
            currencyIcon={toIcon}
            pairCurrency={fromCurrency}
            className="pt-8"
            loading={ratesLoading}
            selectedMethods={toMethods}
            onMethodsChange={setToMethods}
          />
        </div>

        {/* ── Exchange rate ── */}
        {isUsdtRubPair ? (
          <AccordionSection
            title="Курс"
            preview={ratesLoading ? <Skeleton className="h-5 w-28" /> : ratePreview}
            className="mt-6"
            open={acc.isOpen(0)}
            onOpenChange={() => acc.toggle(0)}
            contentRef={acc.setContentRef(0)}
          >
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
        ) : (
          <AccordionSection
            title="Курс"
            preview={ratesLoading ? <Skeleton className="h-5 w-36" /> : ratePreview}
            className="mt-6"
            open={acc.isOpen(0)}
            onOpenChange={() => acc.toggle(0)}
            contentRef={acc.setContentRef(0)}
          >
            <MarketRateSelector
              source={marketRateSource}
              onSourceChange={setMarketRateSource}
              customRate={marketCustomRate}
              onCustomRateChange={setMarketCustomRate}
              marketRate={marketRate}
              fromCurrency={fromCurrency}
              toCurrency={toCurrency}
              loading={ratesLoading}
            />
          </AccordionSection>
        )}

        {/* ── Minimum exchange amount ── */}
        <AccordionSection
          title="Минимальная сумма обмена"
          preview={splitPreview}
          className="mt-2"
          open={acc.isOpen(1)}
          onOpenChange={() => acc.toggle(1)}
          contentRef={acc.setContentRef(1)}
        >
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
        <AccordionSection
          title="Круг поиска"
          preview={visibilityLabels[visibility]}
          className="mt-2"
          open={acc.isOpen(2)}
          onOpenChange={() => acc.toggle(2)}
          contentRef={acc.setContentRef(2)}
        >
          <VisibilitySelector value={visibility} onChange={setVisibility} />
        </AccordionSection>
      </main>

      {/* ── Fixed bottom CTA ── */}
      <div className="fixed bottom-0 left-0 w-full p-5 pb-8 bg-gradient-to-t from-background via-background to-transparent z-40 pointer-events-none">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="pointer-events-auto w-full bg-lime hover:bg-lime-hover text-[#1C1C1E] h-[60px] rounded-[24px] font-bold text-[18px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(200,241,53,0.4)] disabled:opacity-60"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Search className="w-5 h-5" />
          )}
          {isSubmitting ? 'Ищем...' : 'Искать'}
        </button>
      </div>

      {/* ── Rate Limit Error Sheet ── */}
      <BottomSheet open={!!rateLimitError} onClose={() => setRateLimitError(null)}>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-xl font-bold mb-2">Лимит заявок исчерпан</h3>
          <p className="text-muted-foreground mb-4">
            Для защиты от мошенничества мы ограничиваем количество заявок.
          </p>
          {rateLimitError && (
            <div className="w-full bg-muted/50 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Сегодня</span>
                <span className="font-medium">{rateLimitError.dailyCount} / {rateLimitError.dailyLimit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">В этом месяце</span>
                <span className="font-medium">{rateLimitError.monthlyCount} / {rateLimitError.monthlyLimit}</span>
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Попробуйте снова завтра или дождитесь начала следующего месяца.
          </p>
          <button
            onClick={() => setRateLimitError(null)}
            className="mt-6 w-full bg-muted hover:bg-muted/80 text-foreground h-12 rounded-xl font-medium transition-colors"
          >
            Понятно
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
