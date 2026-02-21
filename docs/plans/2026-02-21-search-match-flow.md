# Search → Match Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the "Искать" button to create a user offer via API + find top-5 matches, then show results on a Tinder-swipe screen (or empty state with post-to-group CTA).

**Architecture:** Single `POST /api/offers/search` endpoint handles both offer creation and matching. Frontend calls it, navigates to `/matches/:offerId`. For dev, we skip Telegram auth and use a hardcoded test user (user_id=1). The `WRITE_OFFER_TEXT` env var controls the group-post template with `{PLACEHOLDER}` syntax.

**Tech Stack:** Fastify route plugin, Drizzle ORM queries, React Router navigation, existing BottomSheet + card UI components.

**Design doc:** `docs/plans/2026-02-21-search-match-flow-design.md`

---

## Task 1: Shared Types for Search API

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Add search request/response types to shared/types.ts**

Add these types at the end of the file, after the `ParsedOffer` interface:

```typescript
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
  offerText: string;  // resolved template for "post to group"
}
```

**Step 2: Verify typecheck**

```bash
cd /Users/vlad/projects/hawala-bot/packages/shared && bunx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
cd /Users/vlad/projects/hawala-bot && git add packages/shared/src/types.ts && git commit -m "feat(shared): add SearchRequest, SearchResponse, MatchResult types"
```

---

## Task 2: Config + Template Builder + Offer Route

**Files:**
- Modify: `packages/bot/src/config.ts` — add `WRITE_OFFER_TEXT`
- Create: `packages/bot/src/lib/template.ts` — template resolver
- Create: `packages/bot/src/routes/offers.ts` — POST /api/offers/search
- Modify: `packages/bot/src/server.ts` — register offers route

**Step 1: Add WRITE_OFFER_TEXT to config**

In `packages/bot/src/config.ts`, add after the `miniAppUrl` line:

```typescript
  writeOfferText: process.env.WRITE_OFFER_TEXT || '#ищу {TAKE_AMOUNT} {TAKE_CURRENCY} через {TAKE_PAYMENT_METHOD}\n#предлагаю {GIVE_AMOUNT} {GIVE_CURRENCY} {GIVE_PAYMENT_METHOD}',
```

**Step 2: Create template resolver**

Create `packages/bot/src/lib/template.ts`:

```typescript
interface TemplateParams {
  takeAmount: string;
  takeCurrency: string;
  takePaymentMethod: string;
  giveAmount: string;
  giveCurrency: string;
  givePaymentMethod: string;
}

/**
 * Resolves {PLACEHOLDER} tokens in template string.
 * Template comes from WRITE_OFFER_TEXT env var.
 */
export function resolveTemplate(template: string, params: TemplateParams): string {
  return template
    .replace(/\{TAKE_AMOUNT\}/g, params.takeAmount)
    .replace(/\{TAKE_CURRENCY\}/g, params.takeCurrency)
    .replace(/\{TAKE_PAYMENT_METHOD\}/g, params.takePaymentMethod)
    .replace(/\{GIVE_AMOUNT\}/g, params.giveAmount)
    .replace(/\{GIVE_CURRENCY\}/g, params.giveCurrency)
    .replace(/\{GIVE_PAYMENT_METHOD\}/g, params.givePaymentMethod)
    .replace(/\\n/g, '\n');
}

const CRYPTO_CURRENCIES = new Set(['USDT', 'USDC', 'BTC', 'ETH', 'TON']);

/**
 * Derive payment method group label from currency code.
 * Mirrors frontend's getPaymentGroup() logic.
 */
export function getPaymentMethodLabel(currency: string): string {
  if (currency === 'RUB') return 'СБП';
  if (CRYPTO_CURRENCIES.has(currency)) return 'Crypto';
  return 'SWIFT/SEPA';
}
```

**Step 3: Create offers route**

Create `packages/bot/src/routes/offers.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { eq, and, ne } from 'drizzle-orm';
import { db, schema } from '../db';
import { config } from '../config';
import { resolveTemplate, getPaymentMethodLabel } from '../lib/template';
import type { SearchRequest, SearchResponse, MatchResult } from '@hawala/shared';

export async function offerRoutes(server: FastifyInstance) {
  server.post<{ Body: SearchRequest }>('/search', async (request, reply) => {
    const { fromCurrency, toCurrency, amount, minSplitAmount, visibility } = request.body;

    // For dev: use hardcoded user_id=1. In prod, extract from Telegram initData.
    // TODO: replace with real auth middleware
    const userId = 1;

    // 1. Create user offer
    const [userOffer] = await db
      .insert(schema.userOffers)
      .values({
        userId,
        fromCurrency,
        toCurrency,
        amount,
        minSplitAmount,
        visibility,
        notifyOnMatch: true,
      })
      .returning({ id: schema.userOffers.id, status: schema.userOffers.status });

    // 2. Find matching offers (reverse direction)
    const candidateOffers = await db
      .select({
        offer: schema.offers,
        author: schema.users,
        group: schema.trustedGroups,
      })
      .from(schema.offers)
      .innerJoin(schema.users, eq(schema.offers.authorId, schema.users.id))
      .innerJoin(schema.trustedGroups, eq(schema.offers.groupId, schema.trustedGroups.id))
      .where(
        and(
          eq(schema.offers.status, 'active'),
          eq(schema.offers.fromCurrency, toCurrency),   // reverse match
          eq(schema.offers.toCurrency, fromCurrency),    // reverse match
          ne(schema.offers.authorId, userId),             // not self
        ),
      );

    // 3. Filter by trust circle + calculate reputation
    const matchResults: (MatchResult & { _sortPriority: number })[] = [];

    for (const row of candidateOffers) {
      // Check trust relation
      const [trustRow] = await db
        .select({ type: schema.trustRelations.type })
        .from(schema.trustRelations)
        .where(
          and(
            eq(schema.trustRelations.userId, userId),
            eq(schema.trustRelations.targetUserId, row.author.id),
          ),
        )
        .limit(1);

      const trustType = (trustRow?.type as 'friend' | 'acquaintance') ?? null;

      // Apply visibility filter
      if (visibility === 'friends_only' && trustType !== 'friend') {
        continue;
      }

      // Simple reputation: for now just count trust relations targeting this author
      // TODO: implement full reputation formula from design doc
      const reputation = trustType === 'friend' ? 10 : trustType === 'acquaintance' ? 5 : 1;

      const chatId = row.group.telegramChatId;
      const msgId = row.offer.telegramMessageId;
      // Build deep link: https://t.me/c/{chatId}/{messageId} for private supergroups
      const telegramMessageLink = `https://t.me/c/${String(chatId).replace('-100', '')}/${msgId}`;

      matchResults.push({
        id: 0, // will be set after match insert
        offer: {
          id: row.offer.id,
          fromCurrency: row.offer.fromCurrency,
          toCurrency: row.offer.toCurrency,
          amount: row.offer.amount,
          paymentMethods: JSON.parse(row.offer.paymentMethods),
          originalMessageText: row.offer.originalMessageText,
          telegramMessageId: row.offer.telegramMessageId,
        },
        author: {
          telegramId: row.author.telegramId,
          username: row.author.username,
          firstName: row.author.firstName,
          avatarUrl: row.author.avatarUrl,
        },
        reputation,
        trustType,
        groupName: row.group.name,
        telegramMessageLink,
        _sortPriority: trustType === 'friend' ? 0 : trustType === 'acquaintance' ? 1 : 2,
      });
    }

    // 4. Sort: friends first (by rep desc) → acquaintances (by rep desc) → others
    matchResults.sort((a, b) => {
      if (a._sortPriority !== b._sortPriority) return a._sortPriority - b._sortPriority;
      return b.reputation - a.reputation;
    });

    // 5. Take top 5 and create match records
    const top5 = matchResults.slice(0, 5);
    const finalMatches: MatchResult[] = [];

    for (const m of top5) {
      const [matchRow] = await db
        .insert(schema.matches)
        .values({
          userOfferId: userOffer.id,
          matchedOfferId: m.offer.id,
        })
        .returning({ id: schema.matches.id });

      const { _sortPriority, ...clean } = m;
      finalMatches.push({ ...clean, id: matchRow.id });
    }

    // 6. Build offer text from template
    const formatNum = (n: number) => n.toLocaleString('ru-RU');
    const offerText = resolveTemplate(config.writeOfferText, {
      takeAmount: formatNum(amount),
      takeCurrency: fromCurrency,
      takePaymentMethod: getPaymentMethodLabel(fromCurrency),
      giveAmount: formatNum(amount), // same amount (user can edit in share dialog)
      giveCurrency: toCurrency,
      givePaymentMethod: getPaymentMethodLabel(toCurrency),
    });

    const response: SearchResponse = {
      userOffer: { id: userOffer.id, status: userOffer.status as 'active' },
      matches: finalMatches,
      offerText,
    };

    return reply.send(response);
  });
}
```

**Step 4: Register offers route in server.ts**

In `packages/bot/src/server.ts`, add import at top:

```typescript
import { offerRoutes } from './routes/offers';
```

Replace the `// TODO: register route plugins` comment block with:

```typescript
  // Register route plugins
  server.register(offerRoutes, { prefix: '/api/offers' });
```

Keep the other TODO comments for future routes.

**Step 5: Create the routes directory**

```bash
mkdir -p /Users/vlad/projects/hawala-bot/packages/bot/src/routes
mkdir -p /Users/vlad/projects/hawala-bot/packages/bot/src/lib
```

**Step 6: Push DB schema and seed a test user**

```bash
cd /Users/vlad/projects/hawala-bot/packages/bot && bunx drizzle-kit push
```

Then create a seed script at `packages/bot/src/seed.ts`:

```typescript
import { db, schema } from './db';

async function seed() {
  // Ensure test user exists (id=1)
  const existing = await db.select().from(schema.users).limit(1);
  if (existing.length === 0) {
    await db.insert(schema.users).values({
      telegramId: 123456789,
      username: 'testuser',
      firstName: 'Test',
    });
    console.log('Seeded test user (id=1)');
  } else {
    console.log('Test user already exists');
  }
}

seed().catch(console.error);
```

Run: `cd /Users/vlad/projects/hawala-bot/packages/bot && bun src/seed.ts`

**Step 7: Verify API works**

Start the bot server:
```bash
cd /Users/vlad/projects/hawala-bot/packages/bot && bun --watch src/index.ts &
```

Test the endpoint:
```bash
curl -X POST http://localhost:3000/api/offers/search \
  -H "Content-Type: application/json" \
  -d '{"fromCurrency":"USDT","toCurrency":"RUB","amount":1000,"minSplitAmount":500,"visibility":"friends_and_acquaintances"}'
```

Expected: JSON with `userOffer` (id, status: "active") and empty `matches` array (no offers in DB yet) and `offerText` with resolved template.

**Step 8: Commit**

```bash
cd /Users/vlad/projects/hawala-bot && git add packages/bot/src/config.ts packages/bot/src/lib/template.ts packages/bot/src/routes/offers.ts packages/bot/src/server.ts packages/bot/src/seed.ts && git commit -m "feat(bot): add POST /api/offers/search with matching logic and template builder"
```

---

## Task 3: Match Swipe Screen + Empty State (Frontend)

**Files:**
- Create: `packages/mini-app/src/pages/matches.tsx`
- Create: `packages/mini-app/src/components/match/match-card.tsx`
- Create: `packages/mini-app/src/components/match/empty-state.tsx`
- Modify: `packages/mini-app/src/App.tsx` — add route
- Modify: `packages/mini-app/src/pages/create-order.tsx` — wire submit

**Step 1: Create MatchCard component**

Create `packages/mini-app/src/components/match/match-card.tsx`:

```tsx
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
```

**Step 2: Create EmptyState component**

Create `packages/mini-app/src/components/match/empty-state.tsx`:

```tsx
import { Bell, Send } from 'lucide-react';

interface EmptyStateProps {
  offerText: string;
  /** True when all matches were swiped away; false when API returned 0 */
  allSwiped?: boolean;
  onReset?: () => void;
}

export function EmptyState({ offerText, allSwiped, onReset }: EmptyStateProps) {
  const shareUrl = `https://t.me/share/url?text=${encodeURIComponent(offerText)}`;

  return (
    <div className="flex flex-col items-center justify-center px-6 pt-10 text-center">
      {allSwiped ? (
        <>
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-5">
            <Bell className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="text-[20px] font-bold text-foreground mb-2">
            Матчей больше нет
          </h2>
          <p className="text-[15px] text-muted-foreground mb-8 max-w-[280px]">
            Вы просмотрели все доступные предложения
          </p>
          <button
            onClick={onReset}
            className="w-full bg-accent text-foreground h-[52px] rounded-[20px] font-semibold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all mb-4"
          >
            Показать заново
          </button>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-5">
            <Bell className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="text-[20px] font-bold text-foreground mb-2">
            Подходящих предложений нет
          </h2>
          <p className="text-[15px] text-muted-foreground mb-8 max-w-[280px]">
            Мы напишем вам в ЛС от бота, когда появится подходящий матч
          </p>
        </>
      )}

      <a
        href={shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full bg-primary text-primary-foreground h-[56px] rounded-[24px] font-bold text-[17px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg"
      >
        <Send className="w-5 h-5" />
        Запостить в группу
      </a>
    </div>
  );
}
```

**Step 3: Create Matches page**

Create `packages/mini-app/src/pages/matches.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { MatchResult } from '@hawala/shared';
import { MatchCard } from '@/components/match/match-card';
import { EmptyState } from '@/components/match/empty-state';

interface MatchPageState {
  matches: MatchResult[];
  offerText: string;
}

export default function MatchesPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<MatchPageState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allSwiped, setAllSwiped] = useState(false);

  // Load matches from navigation state (passed from create-order)
  useEffect(() => {
    const stored = sessionStorage.getItem(`matches:${offerId}`);
    if (stored) {
      setData(JSON.parse(stored));
    }
  }, [offerId]);

  const handleSwipeLeft = useCallback(() => {
    if (!data) return;
    if (currentIndex < data.matches.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setAllSwiped(true);
    }
  }, [currentIndex, data]);

  const handleReset = useCallback(() => {
    setCurrentIndex(0);
    setAllSwiped(false);
  }, []);

  if (!data) {
    return (
      <div className="w-full h-dvh flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  const hasMatches = data.matches.length > 0;
  const currentMatch = hasMatches && !allSwiped ? data.matches[currentIndex] : null;

  return (
    <div className="w-full h-dvh flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center gap-4 px-5 pt-8 pb-4">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-card text-foreground flex items-center justify-center hover:bg-accent transition active:scale-95"
        >
          <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2.5} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight">
          {hasMatches ? `Матчи (${data.matches.length})` : 'Результаты'}
        </h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
        {currentMatch ? (
          <div className="relative">
            <MatchCard match={currentMatch} />

            {/* Swipe hint / skip button */}
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleSwipeLeft}
                className="text-muted-foreground text-[14px] font-medium py-2 px-6 rounded-full bg-card border border-border active:scale-95 transition"
              >
                Пропустить →
              </button>
            </div>

            {/* Counter */}
            <div className="mt-3 text-center text-[13px] text-muted-foreground">
              {currentIndex + 1} из {data.matches.length}
            </div>
          </div>
        ) : (
          <EmptyState
            offerText={data.offerText}
            allSwiped={allSwiped && hasMatches}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}
```

**Step 4: Add route to App.tsx**

In `packages/mini-app/src/App.tsx`, add import:

```typescript
import MatchesPage from '@/pages/matches';
```

Add route inside `<Routes>`:

```tsx
<Route path="/matches/:offerId" element={<MatchesPage />} />
```

**Step 5: Wire create-order submit to API**

In `packages/mini-app/src/pages/create-order.tsx`:

Add `useNavigate` import (add to existing react-router-dom import if needed):

```typescript
import { useNavigate } from 'react-router-dom';
```

Add at top of component:

```typescript
const navigate = useNavigate();
const [isSubmitting, setIsSubmitting] = useState(false);
```

Replace the `handleSubmit` callback with:

```typescript
const handleSubmit = useCallback(async () => {
  if (isSubmitting) return;
  setIsSubmitting(true);

  try {
    const parseAmount = (str: string) => Number(str.replace(/[^\d.]/g, '')) || 0;

    const res = await fetch('/api/offers/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromCurrency,
        toCurrency,
        amount: parseAmount(fromAmount),
        minSplitAmount: parseAmount(minExchangeAmount),
        visibility,
      }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();

    // Store in sessionStorage for the matches page
    sessionStorage.setItem(`matches:${data.userOffer.id}`, JSON.stringify({
      matches: data.matches,
      offerText: data.offerText,
    }));

    navigate(`/matches/${data.userOffer.id}`);
  } catch (err) {
    console.error('Search failed:', err);
    // TODO: show error toast
  } finally {
    setIsSubmitting(false);
  }
}, [isSubmitting, fromCurrency, toCurrency, fromAmount, minExchangeAmount, visibility, navigate]);
```

Update the button to show loading state — replace the `<Search className="w-5 h-5" />` line area:

```tsx
<button
  onClick={handleSubmit}
  disabled={isSubmitting}
  className="pointer-events-auto w-full bg-primary hover:opacity-90 text-primary-foreground h-[60px] rounded-[24px] font-bold text-[18px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
>
  {isSubmitting ? (
    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
  ) : (
    <Search className="w-5 h-5" />
  )}
  {isSubmitting ? 'Ищем...' : 'Искать'}
</button>
```

**Step 6: Create directories**

```bash
mkdir -p /Users/vlad/projects/hawala-bot/packages/mini-app/src/components/match
```

**Step 7: Verify build**

```bash
cd /Users/vlad/projects/hawala-bot/packages/mini-app && bun run build
```

Expected: Build succeeds.

**Step 8: Commit**

```bash
cd /Users/vlad/projects/hawala-bot && git add packages/mini-app/ && git commit -m "feat(mini-app): add match swipe screen, empty state, wire search API call"
```

---

## Task 4: End-to-End Smoke Test

**Step 1: Ensure `.env` has required values**

```bash
cd /Users/vlad/projects/hawala-bot && cat .env
```

Ensure it has at minimum:
```
BOT_TOKEN=test:fake
OPENROUTER_API_KEY=test
DB_FILE_NAME=./data/hawala.db
MINI_APP_URL=http://localhost:5173
```

**Step 2: Push DB schema**

```bash
cd /Users/vlad/projects/hawala-bot/packages/bot && bunx drizzle-kit push
```

**Step 3: Seed test user**

```bash
cd /Users/vlad/projects/hawala-bot/packages/bot && bun src/seed.ts
```

**Step 4: Start both servers**

```bash
cd /Users/vlad/projects/hawala-bot && bun run dev
```

**Step 5: Test the flow**

1. Open http://localhost:5173/create
2. Fill in values (defaults are fine)
3. Click "Искать"
4. Should navigate to `/matches/<id>` with empty state (no offers in DB yet)
5. Verify "Запостить в группу" link contains the template text

**Step 6: Test API directly**

```bash
curl -s http://localhost:3000/api/offers/search \
  -H "Content-Type: application/json" \
  -d '{"fromCurrency":"USDT","toCurrency":"RUB","amount":1000,"minSplitAmount":500,"visibility":"friends_and_acquaintances"}' | jq .
```

Expected:
```json
{
  "userOffer": { "id": 1, "status": "active" },
  "matches": [],
  "offerText": "#ищу 1 000 USDT через Crypto\n#предлагаю 1 000 RUB СБП"
}
```

**Step 7: Final commit if any fixes needed**

```bash
cd /Users/vlad/projects/hawala-bot && git add -A && git commit -m "fix: smoke test fixes for search flow"
```

---

## Summary of Commits

1. `feat(shared): add SearchRequest, SearchResponse, MatchResult types`
2. `feat(bot): add POST /api/offers/search with matching logic and template builder`
3. `feat(mini-app): add match swipe screen, empty state, wire search API call`
4. `fix: smoke test fixes for search flow` (if needed)

## Final State

- "Искать" button → calls `POST /api/offers/search` → navigates to `/matches/:offerId`
- Matches found → swipeable MatchCard with "Перейти к сообщению" + "Написать в личку"
- No matches → empty state with "Запостить в группу" (uses resolved WRITE_OFFER_TEXT template)
- Template configurable via `WRITE_OFFER_TEXT` env var with `{PLACEHOLDER}` syntax
- DB gets userOffer created + match records for results
