import { useTrustedGroups } from '@/hooks/use-trusted-groups';
import { useI18n } from '@/lib/i18n';
import { openTelegramLink } from '@/lib/utils';
import { Bell, Send } from 'lucide-react';

interface EmptyStateProps {
  offerText: string;
  /** True when all matches were swiped away; false when API returned 0 */
  allSwiped?: boolean;
  onReset?: () => void;
}

export function EmptyState({ offerText: _offerText, allSwiped, onReset }: EmptyStateProps) {
  const { groups } = useTrustedGroups();
  const { lang } = useI18n();
  const firstGroup = groups[0];
  const copy = lang === 'ru'
    ? {
        noMoreTitle: 'Мэтчей больше нет',
        noMoreText: 'Вы просмотрели все доступные предложения',
        showAgain: 'Показать заново',
        noMatchesTitle: 'Мэтчей нет, но мы напишем',
        noMatchesText: 'Бот напишет вам в ЛС, когда появится подходящая заявка',
        writeMore: 'Написать ещё в группу',
      }
    : {
        noMoreTitle: 'No more matches',
        noMoreText: 'You have reviewed all available offers',
        showAgain: 'Show again',
        noMatchesTitle: 'No matches yet, but we will message you',
        noMatchesText: 'The bot will message you when a suitable offer appears',
        writeMore: 'Post in the group again',
      };

  return (
    <div className="flex flex-col items-center justify-center px-6 pt-10 text-center">
      {allSwiped ? (
        <>
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-5">
            <Bell className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="text-[20px] font-bold text-foreground mb-2">
            {copy.noMoreTitle}
          </h2>
          <p className="text-[15px] text-muted-foreground mb-8 max-w-[280px]">
            {copy.noMoreText}
          </p>
          <button
            onClick={onReset}
            className="w-full bg-accent text-foreground h-[52px] rounded-[20px] font-semibold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all mb-4"
          >
            {copy.showAgain}
          </button>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-5">
            <Bell className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="text-[20px] font-bold text-foreground mb-2">
            {copy.noMatchesTitle}
          </h2>
          <p className="text-[15px] text-muted-foreground mb-8 max-w-[280px]">
            {copy.noMatchesText}
          </p>
        </>
      )}

      {firstGroup && (
        <button
          onClick={() => openTelegramLink(firstGroup.link)}
          className="w-full bg-primary text-primary-foreground h-[56px] rounded-[24px] font-bold text-[17px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg"
        >
          <Send className="w-5 h-5" />
          {copy.writeMore}
        </button>
      )}
    </div>
  );
}
