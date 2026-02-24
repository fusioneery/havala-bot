import { OfferCard } from '@/components/offer/offer-card';
import { apiFetch } from '@/lib/api';
import type { MyOfferItem } from '@hawala/shared';
import { Loader2, Rss } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type FeedFilter = 'friends' | 'acquaintances';

export default function FeedPage() {
  const [filter, setFilter] = useState<FeedFilter>('friends');
  const [offers, setOffers] = useState<MyOfferItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async (f: FeedFilter) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/feed?filter=${f}`);
      if (res.ok) setOffers(await res.json());
    } catch (err) {
      console.error('Feed fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed(filter);
  }, [filter, fetchFeed]);

  return (
    <div className="w-full h-dvh overflow-y-auto bg-background text-foreground">
      <header className="px-6 pt-7 pb-3">
        <h1 className="text-[28px] font-bold tracking-tight">Лента</h1>
        <div className="flex gap-2 mt-3">
          {(['friends', 'acquaintances'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`h-[36px] px-4 rounded-full text-[14px] font-medium transition-all ${
                filter === f
                  ? 'bg-foreground text-background'
                  : 'bg-card border border-border text-muted-foreground'
              }`}
            >
              {f === 'friends' ? 'Друзья' : 'Друзья и знакомые'}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 pb-40">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : offers.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-16 gap-3">
            <Rss className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-[15px] text-center">
              Пока нет заявок от друзей
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} onCancel={() => {}} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
