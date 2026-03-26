import { Skeleton } from '@/components/ui/skeleton';
import { useDealCode } from '@/hooks/use-deal-code';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { buildDmUrl, cn, getGroupLink, openTelegramLink } from '@/lib/utils';
import type { MatchResult, TrustType } from '@hawala/shared';
import { ExternalLink, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MatchCardProps {
  match: MatchResult;
  searchedAt?: string;
}

function formatSearchedAt(dateStr: string, locale: string, lang: 'ru' | 'en'): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (isToday) return lang === 'ru' ? `сегодня в ${time}` : `today at ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return lang === 'ru' ? `вчера в ${time}` : `yesterday at ${time}`;
  return `${d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} ${lang === 'ru' ? 'в' : 'at'} ${time}`;
}

export function MatchCard({ match, searchedAt }: MatchCardProps) {
  const dealCode = useDealCode();
  const { lang, locale } = useI18n();
  const { author, offer, trustType, groupName, telegramMessageLink, matchSource } = match;
  const copy = lang === 'ru'
    ? {
        friend: 'Друг',
        fromGroup: 'знакомый из ',
        fromHalwa: 'знакомый из Халвы',
        offers: 'Предлагает',
        write: 'Написать в личку',
        openMessage: 'Перейти к сообщению',
      }
    : {
        friend: 'Friend',
        fromGroup: 'acquaintance from ',
        fromHalwa: 'acquaintance from Halwa',
        offers: 'Offers',
        write: 'Open chat',
        openMessage: 'Open message',
      };
  const displayTrustType: TrustType = trustType ?? 'acquaintance';
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const isGroupMessageMatch = (matchSource ?? (telegramMessageLink ? 'group_message' : 'hawala')) === 'group_message';

  const amountIsInFromCurrency = !offer.amountCurrency || offer.amountCurrency === offer.fromCurrency;
  const displayFromAmount = amountIsInFromCurrency ? offer.amount : null;
  const displayToAmount = !amountIsInFromCurrency ? offer.amount : null;

  useEffect(() => {
    let cancelled = false;
    setConvertedAmount(null);

    const [from, to] = amountIsInFromCurrency
      ? [offer.fromCurrency, offer.toCurrency]
      : [offer.toCurrency, offer.fromCurrency];

    apiFetch(`/api/rates/market?from=${from}&to=${to}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rate?: number } | null) => {
        if (cancelled || !data?.rate) return;
        const amount = offer.amount * data.rate;
        setConvertedAmount(amount);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [offer.fromCurrency, offer.toCurrency, offer.amount, amountIsInFromCurrency]);

  const dmUrl = buildDmUrl({
    username: author.username,
    groupName,
    telegramMessageLink,
    matchSource,
    dealCode,
    lang,
  }) ?? (isGroupMessageMatch ? telegramMessageLink : null);

  return (
    <div className="bg-card rounded-[28px] p-6 border border-border shadow-sm w-full">
      {/* Author info */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className={cn(
            'w-[46px] h-[46px] rounded-full p-[1.5px] border-2 shrink-0',
            displayTrustType === 'friend' ? 'border-accent2' : 'border-muted-foreground/50',
          )}
        >
          <div className="w-full h-full rounded-full bg-accent flex items-center justify-center text-base font-bold text-foreground overflow-hidden">
            {author.avatarUrl ? (
              <img src={author.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              author.firstName.charAt(0)
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-foreground truncate">
            {author.firstName}
          </span>
          {displayTrustType === 'friend' && (
              <span className="shrink-0 text-[13px] font-bold text-accent2">{copy.friend}</span>
            )}
          </div>
          {author.username && (
            <span className="block text-[13px] text-muted-foreground truncate">@{author.username}</span>
          )}
        </div>
        <div className="shrink-0 text-right text-[13px]">
          {displayTrustType === 'friend' ? null : isGroupMessageMatch && telegramMessageLink ? (
            <span className="text-foreground">
              {copy.fromGroup}
              <button
                onClick={() => openTelegramLink(getGroupLink(telegramMessageLink))}
                className="text-foreground hover:underline"
              >
                {groupName}
              </button>
            </span>
          ) : (
            <span className="text-foreground">{copy.fromHalwa}</span>
          )}
        </div>
      </div>

      {/* Offer details */}
      <div className="bg-background rounded-[20px] p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[14px] text-muted-foreground">{copy.offers}</span>
          {searchedAt && (
            <span className="text-[12px] text-muted-foreground">
              {formatSearchedAt(searchedAt, locale, lang)}
            </span>
          )}
        </div>
        <div className="text-[24px] font-bold text-foreground flex flex-wrap items-baseline gap-x-2">
          {displayFromAmount !== null ? (
            <span>{displayFromAmount.toLocaleString(locale)} {offer.fromCurrency}</span>
          ) : convertedAmount !== null ? (
            <span>
              {convertedAmount >= 100
                ? Math.round(convertedAmount).toLocaleString(locale)
                : convertedAmount.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{' '}
              {offer.fromCurrency}
            </span>
          ) : (
            <>
              <Skeleton className="h-7 w-24 inline-block align-baseline" />
              <span>{offer.fromCurrency}</span>
            </>
          )}
          <span className="text-foreground">→</span>
          {displayToAmount !== null ? (
            <span className="font-semibold text-muted-foreground">
              {displayToAmount.toLocaleString(locale)} {offer.toCurrency}
            </span>
          ) : convertedAmount !== null && displayFromAmount !== null ? (
            <span className="font-semibold text-muted-foreground">
              {convertedAmount >= 100
                ? Math.round(convertedAmount).toLocaleString(locale)
                : convertedAmount.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{' '}
              {offer.toCurrency}
            </span>
          ) : (
            <>
              <Skeleton className="h-7 w-24 inline-block align-baseline font-semibold" />
              <span className="font-semibold text-muted-foreground">{offer.toCurrency}</span>
            </>
          )}
        </div>
        {offer.originalMessageText && (
          <p className="text-[14px] text-muted-foreground mt-2 whitespace-pre-line line-clamp-5">
            {offer.originalMessageText}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {dmUrl && <button
          onClick={() => { console.log('[MatchCard] Написать clicked', { dmUrl }); openTelegramLink(dmUrl); }}
          className="w-full bg-primary text-primary-foreground h-[52px] rounded-[20px] font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <MessageCircle className="w-4.5 h-4.5" />
          {copy.write}
        </button>}
        {isGroupMessageMatch && telegramMessageLink && <button
          onClick={() => openTelegramLink(telegramMessageLink)}
          className="w-full bg-accent text-foreground h-[52px] rounded-[20px] font-semibold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <ExternalLink className="w-4.5 h-4.5" />
          {copy.openMessage}
        </button>}
      </div>
    </div>
  );
}
