import { OfferCard } from '@/components/offer/offer-card';
import { BottomNav } from '@/components/ui/bottom-nav';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { GroupTooltip } from '@/components/ui/group-tooltip';
import { ProgressiveBlur } from '@/components/ui/progressive-blur';
import { TrustedGroupsProvider, useTrustedGroups } from '@/hooks/use-trusted-groups';
import { apiFetch } from '@/lib/api';
import AboutPage from '@/pages/about';
import CreateOrderPage from '@/pages/create-order';
import FeedPage from '@/pages/feed';
import FriendsPage from '@/pages/friends';
import MatchesPage from '@/pages/matches';
import type { MyOfferItem } from '@hawala/shared';
import { Bot, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Outlet, Route, Routes, useNavigate } from 'react-router-dom';

const IS_DEV = import.meta.env.DEV;
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'halwa_app_bot';

function NotInBotScreen() {
  const botUrl = `https://t.me/${BOT_USERNAME.replace('@', '')}`;

  return (
    <div className="w-full h-dvh bg-background text-foreground flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center mb-6">
          <Bot className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-[24px] font-bold mb-3">Халва работает только внутри бота</h1>
        <p className="text-muted-foreground text-[15px] mb-8">
          Откройте приложение через Telegram бота, чтобы продолжить
        </p>
        <a
          href={botUrl}
          className="w-full bg-lime hover:bg-lime-hover text-[#1C1C1E] h-[56px] rounded-[20px] font-bold text-[17px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(200,241,53,0.4)]"
        >
          Перейти в бота
        </a>
      </div>
    </div>
  );
}

function useIsAuthenticated(): boolean | null {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if (IS_DEV) {
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
      .then((res) => res.json())
      .then((data) => setOffers(data))
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
    return <NotInBotScreen />;
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
