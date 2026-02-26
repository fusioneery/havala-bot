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
export type MatchSource = 'group_message' | 'hawala';

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

export interface MyOfferMatchItem {
  author: {
    firstName: string;
    username: string | null;
    avatarUrl: string | null;
  };
  trustType: TrustType | null;
  groupName: string;
  telegramMessageLink: string | null;
  matchSource?: MatchSource;
}

export interface MyOfferItem {
  id: string;  // prefixed "uo:{id}" or "o:{id}"
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  status: UserOfferStatus;
  matchCount: number;
  createdAt: string;
  paymentMethods: {
    give: { currency: string; methods: PaymentMethodGroup[] }[];
    take: { currency: string; methods: PaymentMethodGroup[] }[];
  };
  topMatch: MyOfferMatchItem | null;
  allMatches: MyOfferMatchItem[];
}

// ─── LLM ─────────────────────────────────────
export interface GroupMessage {
  index: number;
  text: string;
  authorTelegramId: number;
  messageId: number;
  chatId: number;
}

export interface ParsedPaymentMethodGroup {
  currency: Currency;
  methods: PaymentMethodGroup[];
}

export interface ParsedOffer {
  messageIndex: number;
  isExchangeOffer: boolean;
  amount: number | null;
  amountCurrency: Currency | null;
  takePaymentMethods: ParsedPaymentMethodGroup[];
  givePaymentMethods: ParsedPaymentMethodGroup[];
  partial: boolean;
  partialThreshold: number;
}

// ─── Contacts ───────────────────────────────
export interface ContactListItem {
  id: number;
  type: TrustType;
  user: {
    id: number;
    telegramId: number;
    username: string | null;
    firstName: string;
    avatarUrl: string | null;
  };
}

export interface AddContactRequest {
  targetUserId: number;
  type: TrustType;
}

export interface UserSearchResult {
  id: number;
  telegramId: number;
  username: string | null;
  firstName: string;
  avatarUrl: string | null;
}

// ─── Search API ──────────────────────────────
export interface SearchRequest {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  minSplitAmount: number;
  visibility: Visibility;
  givePaymentMethods?: ParsedPaymentMethodGroup[];
  takePaymentMethods?: ParsedPaymentMethodGroup[];
}

export interface MatchResult {
  id: number;
  offer: {
    id: number;
    fromCurrency: string;
    toCurrency: string;
    amount: number;
    amountCurrency: string | null;
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
  telegramMessageLink: string | null;
  matchSource?: MatchSource;
}

export interface SearchResponse {
  userOffer: {
    id: number;
    status: UserOfferStatus;
  };
  matches: MatchResult[];
  offerText: string;
}
