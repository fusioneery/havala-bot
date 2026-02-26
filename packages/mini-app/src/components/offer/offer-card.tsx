import {
  CryptoIcon,
  FlagIcon,
  getCurrencyColor,
  hasCryptoIcon,
  hasFlagIcon,
} from '@/components/order/currency-icons';
import { useDealCode } from '@/hooks/use-deal-code';
import { apiFetch } from '@/lib/api';
import { buildDmUrl, cn, getGroupLink, openTelegramLink } from '@/lib/utils';
import {
  getDefaultPaymentMethods,
  getPaymentGroupLabelForFiat,
  type MyOfferItem,
  type MyOfferMatchItem,
  type PaymentMethodGroup,
  type TrustType,
} from '@hawala/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronUp, MessageCircle, UserCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const PILL_LABELS: Record<PaymentMethodGroup, string> = {
  russian_banks: 'СБП',
  local_banks: 'Местные банки',
  swift: 'SWIFT / SEPA',
  crypto: 'Крипта',
};

interface OfferCardProps {
  offer: MyOfferItem;
  onCancel: (id: string) => void;
}

function CurrencyIcon({ code, size }: { code: string; size: number }) {
  const color = getCurrencyColor(code);
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {hasCryptoIcon(code) ? (
        <CryptoIcon code={code} className="w-full h-full object-cover" />
      ) : hasFlagIcon(code) ? (
        <FlagIcon code={code} className="w-full h-full object-cover" />
      ) : (
        <span className="text-white text-[10px] font-bold">{code}</span>
      )}
    </div>
  );
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const created = new Date(dateStr).getTime();
  const diffMs = now - created;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин. назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч. назад`;
  return 'вчера';
}

function getMethodsForCurrency(
  entries: { currency: string; methods: PaymentMethodGroup[] }[],
  currency: string,
): PaymentMethodGroup[] {
  const found = entries.find((e) => e.currency === currency);
  if (found && found.methods.length > 0) return found.methods;
  return getDefaultPaymentMethods(currency);
}

function pluralMatch(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 19) return 'мэтчей';
  switch (n % 10) {
    case 1: return 'мэтч';
    case 2: case 3: case 4: return 'мэтча';
    default: return 'мэтчей';
  }
}

interface MatchRowProps {
  match: MyOfferMatchItem;
  compact?: boolean;
  dealCode?: string | null;
}

function MatchRow({ match, compact = false, dealCode }: MatchRowProps) {
  const displayTrustType: TrustType | null = match.trustType ?? 'acquaintance';
  const isGroupMessageMatch =
    (match.matchSource ?? (match.telegramMessageLink ? 'group_message' : 'hawala')) === 'group_message';
  const dmUrl = buildDmUrl({
    username: match.author.username,
    groupName: match.groupName,
    telegramMessageLink: match.telegramMessageLink,
    matchSource: match.matchSource,
    dealCode,
  });

  return (
    <div className={cn('flex items-center gap-3', compact && 'py-1')}>
      {/* Avatar */}
      <div
        className={cn(
          'rounded-full p-[4px] border shrink-0',
          compact ? 'w-[38px] h-[38px]' : 'w-[47px] h-[47px] p-[5px]',
          displayTrustType === 'friend' ? 'border-primary' : 'border-muted-foreground/50',
        )}
      >
        <div className="w-full h-full rounded-full bg-accent flex items-center justify-center text-sm font-bold text-foreground overflow-hidden">
          {match.author.avatarUrl ? (
            <img src={match.author.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            match.author.firstName.charAt(0)
          )}
        </div>
      </div>

      {/* Name + trust */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-semibold text-foreground truncate">
            {match.author.firstName}
          </span>
          {match.author.username && (
            <span className="text-[12px] text-muted-foreground truncate">
              @{match.author.username}
            </span>
          )}
        </div>
        <div className="text-[12px]">
          {displayTrustType === 'friend' ? (
            <span className="inline-flex items-center gap-1 font-bold text-foreground">
              <UserCheck className="w-3.5 h-3.5 text-accent2 shrink-0" />
              Друг
            </span>
          ) : isGroupMessageMatch && match.telegramMessageLink ? (
            <span className="text-muted-foreground">
              знакомый из{' '}
              <button
                onClick={() => openTelegramLink(getGroupLink(match.telegramMessageLink!))}
                className="text-foreground hover:underline"
              >
                {match.groupName}
              </button>
            </span>
          ) : (
            <span className="text-muted-foreground">знакомый из Халвы</span>
          )}
        </div>
      </div>

      {/* Write button */}
      {dmUrl && (
        <button
          onClick={() => openTelegramLink(dmUrl)}
          className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold flex items-center gap-1 active:scale-95 transition shrink-0"
        >
          <MessageCircle className="w-3 h-3" />
          Написать
        </button>
      )}
    </div>
  );
}

export function OfferCard({ offer, onCancel }: OfferCardProps) {
  const dealCode = useDealCode();
  const displayTrustType: TrustType | null = offer.topMatch
    ? offer.topMatch.trustType ?? 'acquaintance'
    : null;

  const paymentGroupLabel =
    getPaymentGroupLabelForFiat(offer.fromCurrency) ??
    getPaymentGroupLabelForFiat(offer.toCurrency);

  const fromIsNonRubFiat = getPaymentGroupLabelForFiat(offer.fromCurrency) !== null;
  const toIsNonRubFiat = getPaymentGroupLabelForFiat(offer.toCurrency) !== null;
  const fromMethods = fromIsNonRubFiat
    ? getMethodsForCurrency(offer.paymentMethods.give, offer.fromCurrency)
    : [];
  const toMethods = toIsNonRubFiat
    ? getMethodsForCurrency(offer.paymentMethods.take, offer.toCurrency)
    : [];

  // Only show pills when exactly 1 method total (a specific choice worth highlighting)
  const showPaymentPills =
    (fromIsNonRubFiat || toIsNonRubFiat) &&
    fromMethods.length + toMethods.length === 1;

  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setConvertedAmount(null);
    apiFetch(`/api/rates/market?from=${offer.fromCurrency}&to=${offer.toCurrency}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rate?: number } | null) => {
        if (cancelled || !data?.rate) return;
        setConvertedAmount(offer.amount * data.rate);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [offer.fromCurrency, offer.toCurrency, offer.amount]);

  const dmUrl = offer.topMatch
    ? buildDmUrl({
        username: offer.topMatch.author.username,
        groupName: offer.topMatch.groupName,
        telegramMessageLink: offer.topMatch.telegramMessageLink,
        matchSource: offer.topMatch.matchSource,
        dealCode,
      })
    : null;

  const hasMultipleMatches = offer.matchCount > 1;
  const extraMatchCount = offer.matchCount - 1;

  // allMatches may be absent on older API responses; fall back gracefully.
  // Sort by reputation: friends first, then acquaintances, then others. Cap at 5.
  const trustRank = (t: string | null) => t === 'friend' ? 0 : t === 'acquaintance' ? 1 : 2;
  const allMatches = (offer.allMatches ?? (offer.topMatch ? [offer.topMatch] : []))
    .slice()
    .sort((a, b) => trustRank(a.trustType) - trustRank(b.trustType))
    .slice(0, 5);
  const extraMatches = allMatches.slice(1);

  return (
    <div className="bg-card rounded-[24px] p-5 border border-border">
      {/* Header: currency pair + amount + time + cancel */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center -space-x-1.5">
            <CurrencyIcon code={offer.fromCurrency} size={28} />
            <CurrencyIcon code={offer.toCurrency} size={28} />
          </div>
          <div>
            <div className="text-[16px] font-semibold text-foreground">
              {offer.amount.toLocaleString('ru-RU').replace(',', '.')} {offer.fromCurrency} → {offer.toCurrency}
            </div>
            <div className="text-[13px] text-muted-foreground">
              {convertedAmount !== null ? (
                <>
                  ≈ {convertedAmount >= 100
                    ? Math.round(convertedAmount).toLocaleString('ru-RU')
                    : convertedAmount.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{' '}
                  {offer.toCurrency}
                </>
              ) : (
                <Skeleton className="h-[18px] w-24 rounded-md" />
              )}
            </div>
            <div className="text-[13px] text-muted-foreground">
              {relativeTime(offer.createdAt)}
            </div>
          </div>
        </div>

        <button
          onClick={() => onCancel(offer.id)}
          className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition active:scale-95"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>

      {/* Payment method pills */}
      {showPaymentPills && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {fromMethods.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-muted-foreground text-[11px] font-medium">
              <span className="text-foreground font-normal">{offer.fromCurrency}</span>
              {fromMethods.length === 1 && <span className="text-accent2">только</span>}
              {fromMethods.map((m) => PILL_LABELS[m]).join(' или ')}
            </span>
          )}
          {toMethods.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-muted-foreground text-[11px] font-medium">
              <span className="text-foreground font-normal">{offer.toCurrency}</span>
              {toMethods.length === 1 && <span className="text-accent2">только</span>}
              {toMethods.map((m) => PILL_LABELS[m]).join(' или ')}
            </span>
          )}
        </div>
      )}

      {/* Match section */}
      {offer.matchCount > 0 && offer.topMatch && (
        <>
          {/* Card stack wrapper (collapsed) */}
          <div
            className={cn(
              'relative',
              hasMultipleMatches && !showAllMatches && 'mb-[10px]',
            )}
          >
            {/* Back shadow card (3rd layer) */}
            {offer.matchCount >= 3 && !showAllMatches && (
              <div
                className="absolute inset-x-3 inset-y-0 translate-y-[10px] rounded-[16px] bg-background border border-border opacity-50"
                style={{ zIndex: 1 }}
              />
            )}
            {/* Middle shadow card (2nd layer) */}
            {hasMultipleMatches && !showAllMatches && (
              <div
                className="absolute inset-x-1.5 inset-y-0 translate-y-[5px] rounded-[16px] bg-background border border-border opacity-75"
                style={{ zIndex: 2 }}
              />
            )}

            {/* Top card — always rendered */}
            <div
              className="relative bg-background rounded-[16px] p-4 space-y-3"
              style={{ zIndex: 3 }}
            >
              {/* Row 1: Avatar + User info */}
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-[47px] h-[47px] rounded-full p-[5px] border shrink-0',
                    displayTrustType === 'friend' ? 'border-primary' : 'border-muted-foreground/50',
                  )}
                >
                  <div className="w-full h-full rounded-full bg-accent flex items-center justify-center text-sm font-bold text-foreground overflow-hidden">
                    {offer.topMatch.author.avatarUrl ? (
                      <img
                        src={offer.topMatch.author.avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      offer.topMatch.author.firstName.charAt(0)
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-semibold text-foreground truncate">
                      {offer.topMatch.author.firstName}
                    </span>
                    {offer.topMatch.author.username && (
                      <span className="text-[13px] text-muted-foreground truncate">
                        @{offer.topMatch.author.username}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                    {paymentGroupLabel && (
                      <span className="text-[13px] text-muted-foreground">
                        {paymentGroupLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Trust info + Action button */}
              <div className="flex items-center justify-between gap-3">
                <div className="text-[13px]">
                  {displayTrustType === 'friend' ? (
                    <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
                      <UserCheck className="w-4 h-4 text-accent2 shrink-0" />
                      Друг
                    </span>
                  ) : offer.topMatch.telegramMessageLink ? (
                    <span className="text-muted-foreground">
                      знакомый из{' '}
                      <button
                        onClick={() => openTelegramLink(getGroupLink(offer.topMatch!.telegramMessageLink!))}
                        className="text-foreground hover:underline"
                      >
                        {offer.topMatch.groupName}
                      </button>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">знакомый из Халвы</span>
                  )}
                </div>
                {dmUrl && (
                  <button
                    onClick={() => openTelegramLink(dmUrl)}
                    className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold flex items-center gap-1.5 active:scale-95 transition shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Написать
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* "+N мэтчей" expand button */}
          {hasMultipleMatches && !showAllMatches && (
            <button
              onClick={() => setShowAllMatches(true)}
              className="mt-3 w-full flex items-center justify-center text-[13px] text-muted-foreground hover:text-foreground transition-colors py-0.5"
            >
              +{extraMatchCount} {pluralMatch(extraMatchCount)}
            </button>
          )}

          {/* Expanded: extra match rows */}
          {showAllMatches && extraMatches.length > 0 && (
            <div className="mt-2 bg-background rounded-[16px] divide-y divide-border/60">
              {extraMatches.map((match, i) => (
                <div key={i} className="px-4 py-3">
                  <MatchRow match={match} compact dealCode={dealCode} />
                </div>
              ))}
              <div className="px-4 py-3">
                <button
                  onClick={() => setShowAllMatches(false)}
                  className="w-full flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  Скрыть остальные мэтчи
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* No matches */}
      {offer.matchCount === 0 && (
        <div className="text-[14px] text-muted-foreground">
          Пока нет мэтчей — напишем, когда появятся
        </div>
      )}
    </div>
  );
}
