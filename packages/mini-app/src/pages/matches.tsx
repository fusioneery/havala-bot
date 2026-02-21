import { EmptyState } from '@/components/match/empty-state';
import { MatchCard } from '@/components/match/match-card';
import { useBackButton } from '@/hooks/use-back-button';
import type { MatchResult } from '@hawala/shared';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface MatchPageState {
  matches: MatchResult[];
  offerText: string;
  searchedAt?: string;
}

export default function MatchesPage() {
  const { offerId } = useParams<{ offerId: string }>();
  useBackButton('/');

  const [data, setData] = useState<MatchPageState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allSwiped, setAllSwiped] = useState(false);

  // Load matches from sessionStorage (passed from create-order)
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
      <header className="px-5 pt-5 pb-4">
        <h1 className="text-[17px] font-semibold tracking-tight">
          {hasMatches ? `Мэтчи (${data.matches.length})` : 'Результаты'}
        </h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
        <div className="sticky top-0 h-6 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
        {currentMatch ? (
          <div className="relative">
            <MatchCard match={currentMatch} searchedAt={data.searchedAt} />

            {/* Skip button */}
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
