import { cn } from '@/lib/utils';
import { Inbox, Search, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const TABS = [
  { key: 'offers', label: 'Заявки', icon: Inbox, path: '/' },
  { key: 'friends', label: 'Друзья', icon: Users, path: '/friends' },
] as const;

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const activeTab = TABS.find((t) => t.path === pathname)?.key ?? 'offers';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-row items-center justify-center px-4 max-[389px]:px-3 pb-[max(env(safe-area-inset-bottom,24px),24px)] pointer-events-none gap-4">
      <button
        onClick={() => navigate('/create')}
        className="pointer-events-auto flex-1 flex items-center justify-center gap-2 h-[64px] px-4 rounded-[32px] glass-btn-cta font-bold text-[16px] active:scale-[0.96] transition-all max-[389px]:h-[52px] max-[389px]:px-5 max-[389px]:rounded-[26px] max-[389px]:text-[15px] max-[389px]:gap-1.5"
      >
        <Search className="w-4.5 h-4.5 max-[389px]:w-4 max-[389px]:h-4" strokeWidth={2.5} />
        Найти обмен
      </button>
      {/* Tab bar — liquid glass */}
      <nav className="pointer-events-auto shrink-0 h-[64px] rounded-[32px] px-3 flex items-center gap-2 relative glass-nav max-[389px]:h-[52px] max-[389px]:rounded-[26px] max-[389px]:px-2 max-[389px]:gap-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center justify-center w-[64px] max-[389px]:w-[56px] h-full z-10 group gap-1 max-[389px]:gap-0.5 min-w-0"
            >
              <Icon
                className={cn(
                  'w-6 h-6 max-[389px]:w-5 max-[389px]:h-5 shrink-0 transition-all',
                  isActive ? 'text-foreground' : 'text-foreground/50 group-hover:text-foreground/70',
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={cn(
                  'text-[10px] max-[389px]:text-[9px] font-medium transition-all truncate',
                  isActive ? 'text-foreground' : 'text-foreground/50 group-hover:text-foreground/70'
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
