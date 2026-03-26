import { useI18n } from '@/lib/i18n';
import { cn, openTelegramLink } from '@/lib/utils';
import { useState } from 'react';
import { BottomSheet } from './bottom-sheet';

interface Group {
  name: string;
  link: string;
}

interface GroupTooltipProps {
  groups: Group[];
  children: React.ReactNode;
  className?: string;
}

export function GroupTooltip({ groups, children, className }: GroupTooltipProps) {
  const [open, setOpen] = useState(false);
  const { lang } = useI18n();
  const copy = lang === 'ru'
    ? {
        title: 'Доверенные группы',
        description: 'Группы, участники которых участвуют в подборе заявок на обмен. Сообщения в этих группах анализируются на предложения об обмене и автоматически попадают в список заявок.',
        open: 'Открыть',
        empty: 'Нет доверенных групп',
      }
    : {
        title: 'Trusted groups',
        description: 'Members of these groups are included in exchange matching. Messages in these groups are analyzed for exchange offers and automatically added to the offers list.',
        open: 'Open',
        empty: 'No trusted groups',
      };

  const disabled = groups.length === 0;

  return (
    <>
      <span
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && setOpen(true)}
        className={cn(
          'underline decoration-dotted underline-offset-[3px]',
          disabled
            ? 'decoration-muted-foreground/50'
            : 'decoration-foreground/50 cursor-pointer',
          className,
        )}
      >
        {children}
      </span>

      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <h2 className="text-[17px] font-semibold mb-2">{copy.title}</h2>
        <p className="text-muted-foreground text-[13px] leading-relaxed mb-4">
          {copy.description}
        </p>
        <div className="max-h-[40vh] overflow-y-auto -mx-2 px-2">
          <ul className="space-y-2">
            {groups.map((group) => (
              <li
                key={group.link}
                className="flex items-center justify-between gap-3 bg-background/50 rounded-xl px-4 py-3"
              >
                <span className="text-[14px] text-foreground leading-snug line-clamp-2 min-w-0">
                  {group.name}
                </span>
                <button
                  onClick={() => openTelegramLink(group.link)}
                  className="bg-lime text-[#1C1C1E] text-[12px] font-semibold px-3 py-1.5 rounded-full hover:opacity-80 transition shrink-0"
                >
                  {copy.open}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {groups.length === 0 && (
          <p className="text-muted-foreground text-[14px] text-center py-4">
            {copy.empty}
          </p>
        )}
      </BottomSheet>
    </>
  );
}
