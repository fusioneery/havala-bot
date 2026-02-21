import type { Currency } from './currencies';
import type { PaymentMethodGroup } from './payment-methods';

// ─── User ────────────────────────────────────
export interface User {
  id: number;
  telegramId: number;
  username: string | null;
  firstName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Trust ───────────────────────────────────
export type TrustType = 'friend' | 'acquaintance';

export interface TrustRelation {
  id: number;
  userId: number;
  targetUserId: number;
  type: TrustType;
  createdAt: Date;
}

// ─── Offers ──────────────────────────────────
export type OfferStatus = 'active' | 'matched' | 'cancelled' | 'error';
export type UserOfferStatus = 'active' | 'matched' | 'cancelled';
export type MatchStatus = 'pending' | 'accepted' | 'error_flagged';
export type Visibility = 'friends_only' | 'friends_and_acquaintances';

export interface Offer {
  id: number;
  authorId: number;
  groupId: number;
  telegramMessageId: number;
  fromCurrency: Currency;
  toCurrency: Currency;
  amount: number;
  paymentMethods: PaymentMethodGroup[];
  status: OfferStatus;
  isLlmParsed: boolean;
  originalMessageText: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserOffer {
  id: number;
  userId: number;
  fromCurrency: Currency;
  toCurrency: Currency;
  amount: number;
  minSplitAmount: number;
  visibility: Visibility;
  visibleTo: number[] | null;
  status: UserOfferStatus;
  notifyOnMatch: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── LLM ─────────────────────────────────────
export interface GroupMessage {
  index: number;
  text: string;
  authorTelegramId: number;
  messageId: number;
  chatId: number;
}

export interface ParsedOffer {
  messageIndex: number;
  isExchangeOffer: boolean;
  amount: number | null;
  fromCurrency: Currency | null;
  toCurrency: Currency | null;
  paymentMethods: PaymentMethodGroup[];
}

// ─── Search API ──────────────────────────────
export interface SearchRequest {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  minSplitAmount: number;
  visibility: Visibility;
}

export interface MatchResult {
  id: number;
  offer: {
    id: number;
    fromCurrency: string;
    toCurrency: string;
    amount: number;
    paymentMethods: string[];
    originalMessageText: string | null;
    telegramMessageId: number;
  };
  author: {
    telegramId: number;
    username: string | null;
    firstName: string;
    avatarUrl: string | null;
  };
  reputation: number;
  trustType: TrustType | null;
  groupName: string;
  telegramMessageLink: string;
}

export interface SearchResponse {
  userOffer: {
    id: number;
    status: UserOfferStatus;
  };
  matches: MatchResult[];
  offerText: string;
}
