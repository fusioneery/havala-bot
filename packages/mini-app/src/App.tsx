import { OfferCard } from '@/components/offer/offer-card';
import { BottomNav } from '@/components/ui/bottom-nav';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { GroupTooltip } from '@/components/ui/group-tooltip';
import { ProgressiveBlur } from '@/components/ui/progressive-blur';
import { TrustedGroupsProvider, useTrustedGroups } from '@/hooks/use-trusted-groups';
import { apiFetch } from '@/lib/api';
import LandingPage from '@/pages/landing';
import AboutPage from '@/pages/about';
import CreateOrderPage from '@/pages/create-order';
import FeedPage from '@/pages/feed';
import FriendsPage from '@/pages/friends';
import MatchesPage from '@/pages/matches';
import type { MyOfferItem } from '@hawala/shared';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Outlet, Route, Routes, useNavigate } from 'react-router-dom';

const IS_DEV = import.meta.env.VITE_DEV === 'true' || import.meta.env.VITE_DEV === '1';
function useIsAuthenticated(): boolean | null {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if (IS_DEV) {
      debugger;
      setIsAuthenticated(true);
      return;
    }

    const initData = window.Telegram?.WebApp?.initData;
    setIsAuthenticated(!!initData && initData.length > 0);
  }, []);

  return isAuthenticated;
}

const LS_KEY_VISITED_ABOUT = 'visited_about';

function HomePage() {
  const navigate = useNavigate();
  const { groups } = useTrustedGroups();

  const [offers, setOffers] = useState<MyOfferItem[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [hasVisitedAbout] = useState(() => localStorage.getItem(LS_KEY_VISITED_ABOUT) === '1');

  useEffect(() => {
    apiFetch('/api/offers')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setOffers(data);
      })
      .catch(console.error)
      .finally(() => setOffersLoading(false));
  }, []);

  const [cancelId, setCancelId] = useState<string | null>(null);

  const confirmCancel = useCallback(async () => {
    if (cancelId === null) return;
    try {
      const res = await apiFetch(`/api/offers/${cancelId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Cancel failed');
      setOffers((prev) => prev.filter((o) => o.id !== cancelId));
    } catch (err) {
      console.error('Cancel error:', err);
    }
    setCancelId(null);
  }, [cancelId]);

  return (
    <div className="w-full h-dvh overflow-y-auto bg-background text-foreground">
      <header className="px-6 pt-3.5 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-bold tracking-tight">Халва</h1>
          <button
            onClick={() => navigate('/about')}
            className="text-muted-foreground text-[15px] font-medium hover:text-foreground transition"
          >
            Что это?
          </button>
        </div>
        {!hasVisitedAbout && (
          <p className="text-muted-foreground text-[15px] mt-1">
            Меняй валюту среди своих друзей и участников{' '}
            <GroupTooltip groups={groups}>доверенных групп</GroupTooltip>
          </p>
        )}
      </header>

      <main className="px-4 pb-40">
        {offersLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : offers.length === 0 ? (
          <div className="bg-card rounded-[24px] p-5 border border-border">
            <p className="text-muted-foreground text-[14px]">
              У вас пока нет активных заявок
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} onCancel={setCancelId} />
            ))}
          </div>
        )}
      </main>

      <BottomSheet open={cancelId !== null} onClose={() => setCancelId(null)}>
        <h3 className="text-[18px] font-bold text-foreground mb-2">Отменить заявку?</h3>
        <p className="text-[15px] text-muted-foreground mb-6">
          Заявка будет удалена, и вы перестанете получать мэтчи по ней.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={confirmCancel}
            className="w-full h-[52px] rounded-[20px] bg-red-500 text-white font-bold text-[16px] active:scale-[0.98] transition-all"
          >
            Да, отменить
          </button>
          <button
            onClick={() => setCancelId(null)}
            className="w-full h-[52px] rounded-[20px] bg-accent text-foreground font-semibold text-[16px] active:scale-[0.98] transition-all"
          >
            Назад
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

function TabLayout() {
  return (
    <>
      <Outlet />
      <div className="fixed bottom-0 left-0 right-0 z-40 h-[100px] pointer-events-none">
        <ProgressiveBlur height="100%" position="bottom" />
      </div>
      <BottomNav />
    </>
  );
}

function App() {
  const isAuthenticated = useIsAuthenticated();

  if (isAuthenticated === null) {
    return (
      <div className="w-full h-dvh bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <TrustedGroupsProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<TabLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/friends" element={<FriendsPage />} />
          </Route>
          <Route path="/about" element={<AboutPage />} />
          <Route path="/create" element={<CreateOrderPage />} />
          <Route path="/matches/:offerId" element={<MatchesPage />} />
        </Routes>
      </BrowserRouter>
    </TrustedGroupsProvider>
  );
}

export default App;
