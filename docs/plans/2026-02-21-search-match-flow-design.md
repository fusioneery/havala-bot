# Search → Match Flow Design

## Overview

When user presses "Искать" on the create order screen, a single synchronous API call creates the user offer and attempts to find top-5 matches. If matches found → navigate to Tinder-swipe screen. If no matches → empty state with bot notification promise + post-to-group CTA.

## API: `POST /api/offers/search`

Single endpoint that creates the offer and returns matches in one call.

### Request

```typescript
{
  fromCurrency: string;      // e.g. "USDT"
  toCurrency: string;        // e.g. "RUB"
  amount: number;            // e.g. 1000
  minSplitAmount: number;    // e.g. 500
  visibility: Visibility;    // "friends_only" | "friends_and_acquaintances"
}
```

### Response

```typescript
{
  userOffer: {
    id: number;
    // ...full UserOffer fields
  };
  matches: Array<{
    id: number;                       // match record ID
    offer: {                          // the matched offer from DB
      id: number;
      fromCurrency: string;
      toCurrency: string;
      amount: number;
      paymentMethods: string[];
      originalMessageText: string | null;
      telegramMessageId: number;
    };
    author: {                         // offer author
      telegramId: number;
      username: string | null;
      firstName: string;
      avatarUrl: string | null;
    };
    reputation: number;               // calculated reputation score
    trustType: "friend" | "acquaintance" | null;
    groupName: string;
    telegramMessageLink: string;      // deep link to original message
  }>;                                 // max 5, sorted: friends by rep → acquaintances by rep
}
```

### Backend Logic

1. Create `userOffer` in DB (status: 'active', notifyOnMatch: true)
2. Query `offers` where `offers.fromCurrency = request.toCurrency AND offers.toCurrency = request.fromCurrency` (reverse direction match)
3. Filter by status = 'active'
4. Filter by visibility + trust circle of requesting user
5. Calculate reputation for each candidate (using shared formula)
6. Sort: friends first (by reputation desc) → acquaintances (by reputation desc)
7. Take top 5
8. Create `matches` records in DB for each result
9. Return userOffer + matches array

## Frontend Flow

### Navigation

```
/create → [click "Искать"] → POST /api/offers/search → /matches/:offerId
```

### Match Screen (`/matches/:offerId`)

**Case A — Matches found (1-5):**

Tinder-style swipe cards as described in design doc:
- Card: avatar, firstName, reputation score, original message text, group name
- Swipe left = skip (frontend only, no API call)
- Primary button: "Перейти к сообщению" → opens `telegramMessageLink`
- Secondary button: "Написать в личку" → opens Telegram share dialog with template message
- When all cards exhausted: "Матчей больше нет" + "Показать заново" button

**Case B — No matches (empty state):**

- Icon + "Прямо сейчас подходящих предложений нет"
- Subtitle: "Мы напишем вам в ЛС от бота, когда появится подходящий матч"
- Primary CTA: "Запостить в группу" → opens Telegram share dialog with offer text

## Message Template Builder

Configurable via env var `WRITE_OFFER_TEXT`. Supports placeholders.

### Default Template

```
WRITE_OFFER_TEXT="#ищу {TAKE_AMOUNT} {TAKE_CURRENCY} через {TAKE_PAYMENT_METHOD}\n#предлагаю {GIVE_AMOUNT} {GIVE_CURRENCY} {GIVE_PAYMENT_METHOD}"
```

### Available Placeholders

| Placeholder | Source | Example |
|------------|--------|---------|
| `{TAKE_AMOUNT}` | userOffer.amount | 1,000 |
| `{TAKE_CURRENCY}` | userOffer.fromCurrency | USDT |
| `{TAKE_PAYMENT_METHOD}` | derived from currency | Crypto |
| `{GIVE_AMOUNT}` | toAmount from form | 92,000 |
| `{GIVE_CURRENCY}` | userOffer.toCurrency | RUB |
| `{GIVE_PAYMENT_METHOD}` | derived from currency | СБП |

### Template Resolution

Template is stored in config, resolved on the backend, returned in the API response as `offerText` field. Frontend uses it for `tg://msg_url?url=&text={encodedText}`.

## Bot Notification (future, not in this implementation)

When `notifyOnMatch: true` on a userOffer and a new matching offer appears:
- Bot sends DM: "Новый матч по обмену! @username — [original message]"
- 2 inline buttons: "Мне неактуально" (cancels userOffer) | "Ошибка, условия не те" (flags to error_offers)

This is a separate task — the current implementation only sets `notifyOnMatch: true` in the DB.

## Files Affected

### Backend (packages/bot/)
- `src/routes/offers.ts` — new file, POST /api/offers/search
- `src/routes/auth.ts` — new file, POST /api/auth/validate (needed for user identity)
- `src/server.ts` — register new route plugins
- `src/config.ts` — add WRITE_OFFER_TEXT env var

### Frontend (packages/mini-app/)
- `src/pages/create-order.tsx` — wire submit to API + navigate
- `src/pages/matches.tsx` — new file, swipe screen
- `src/components/match/match-card.tsx` — new file
- `src/components/match/empty-state.tsx` — new file
- `src/App.tsx` — add /matches/:offerId route

### Shared (packages/shared/)
- `src/types.ts` — add SearchRequest, SearchResponse, MatchResult types
