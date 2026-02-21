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
