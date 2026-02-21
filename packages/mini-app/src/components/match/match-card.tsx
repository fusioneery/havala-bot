import type { MatchResult } from '@hawala/shared';
import { ExternalLink, MessageCircle } from 'lucide-react';

interface MatchCardProps {
  match: MatchResult;
}

export function MatchCard({ match }: MatchCardProps) {
  const { author, offer, reputation, trustType, groupName, telegramMessageLink } = match;

  const trustLabel = trustType === 'friend' ? 'Друг' : trustType === 'acquaintance' ? 'Знакомый' : null;

  // Build DM share URL with template message
  const dmText = encodeURIComponent(
    `Привет, я из ${groupName}, давай поменяемся? ${telegramMessageLink}`,
  );
  const dmUrl = author.username
    ? `https://t.me/${author.username}?text=${dmText}`
    : telegramMessageLink;

  return (
    <div className="bg-card rounded-[28px] p-6 border border-border shadow-sm w-full">
      {/* Author info */}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-xl font-bold text-foreground shrink-0 overflow-hidden">
          {author.avatarUrl ? (
            <img src={author.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            author.firstName.charAt(0)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-semibold text-foreground truncate">
              {author.firstName}
            </span>
            {trustLabel && (
              <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {trustLabel}
              </span>
            )}
          </div>
          {author.username && (
            <span className="text-[14px] text-muted-foreground">@{author.username}</span>
          )}
        </div>
        <div className="text-right">
          <span className="text-[12px] text-muted-foreground">Репутация</span>
          <div className="text-[20px] font-bold text-foreground">{reputation.toFixed(1)}</div>
        </div>
      </div>

      {/* Offer details */}
      <div className="bg-background rounded-[20px] p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[14px] text-muted-foreground">Предлагает</span>
          <span className="text-[14px] text-muted-foreground">{groupName}</span>
        </div>
        <div className="text-[24px] font-bold text-foreground">
          {offer.amount.toLocaleString('ru-RU')} {offer.fromCurrency} → {offer.toCurrency}
        </div>
        {offer.originalMessageText && (
          <p className="text-[14px] text-muted-foreground mt-2 line-clamp-3">
            {offer.originalMessageText}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <a
          href={telegramMessageLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-primary text-primary-foreground h-[52px] rounded-[20px] font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <ExternalLink className="w-4.5 h-4.5" />
          Перейти к сообщению
        </a>
        <a
          href={dmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-accent text-foreground h-[52px] rounded-[20px] font-semibold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <MessageCircle className="w-4.5 h-4.5" />
          Написать в личку
        </a>
      </div>
    </div>
  );
}
