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
