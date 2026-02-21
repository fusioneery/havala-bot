import { BottomSheet } from '@/components/ui/bottom-sheet';
import { cn } from '@/lib/utils';
import type { Visibility } from '@hawala/shared';
import { ChevronRight, CircleHelp } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface VisibilitySelectorProps {
  value: Visibility;
  onChange: (value: Visibility) => void;
  groupName?: string;
}

const options: Array<{
  value: Visibility;
  label: string;
}> = [
  {
    value: 'friends_and_acquaintances',
    label: 'Друзья и знакомые',
  },
  {
    value: 'friends_only',
    label: 'Только друзья',
  },
];

export function VisibilitySelector({ value, onChange, groupName }: VisibilitySelectorProps) {
  const [faqOpen, setFaqOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [groupTooltipOpen, setGroupTooltipOpen] = useState(false);
  const groupTooltipRef = useRef<HTMLSpanElement>(null);

  const closeGroupTooltip = useCallback(() => setGroupTooltipOpen(false), []);

  useEffect(() => {
    if (!groupTooltipOpen) return;
    const handleOutside = (e: PointerEvent) => {
      if (groupTooltipRef.current && !groupTooltipRef.current.contains(e.target as Node)) {
        closeGroupTooltip();
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [groupTooltipOpen, closeGroupTooltip]);

  return (
    <div className="px-1">
      <div className="flex flex-col gap-3">
        {options.map((option) => {
          const isSelected = value === option.value;

          return (
            <label key={option.value} className="relative block cursor-pointer group">
              <input
                type="radio"
                name="visibility"
                checked={isSelected}
                onChange={() => onChange(option.value)}
                className="peer hidden"
              />
              <div
                className={cn(
                  'flex items-center justify-between bg-card p-4 rounded-[20px] border transition overflow-hidden',
                  isSelected
                    ? 'border-foreground/20'
                    : 'border-transparent hover:border-border',
                )}
              >
                <div className="flex items-center gap-3 z-10">
                  {/* Radio circle */}
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full border-[2px] relative z-10 box-border transition-all duration-300 shrink-0',
                      isSelected
                        ? 'border-foreground bg-foreground'
                        : 'border-muted-foreground',
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-background rounded-full" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[16px] font-medium text-foreground',
                    )}
                  >
                    {option.label}
                  </span>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* FAQ Accordion */}
      <div className="mt-6 ml-1">
        <button
          onClick={() => setFaqOpen((v) => !v)}
          className="group flex items-center gap-2.5 text-muted-foreground font-medium hover:text-foreground transition outline-none"
        >
          <ChevronRight
            className={cn(
              'w-4 h-4 transition-transform duration-300',
              faqOpen && 'rotate-90',
            )}
          />
          <span>В чём разница?</span>
        </button>
        <div
          className={cn(
            'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
            faqOpen ? 'max-h-70 opacity-100' : 'max-h-0 opacity-0 overflow-hidden',
          )}
        >
          <div className="pt-3 pb-1 pl-6 pr-2 flex flex-col gap-2">
            <p className="text-muted-foreground text-[14px] leading-relaxed">
              При выборе "Друзья и знакомые" поиск будет осуществляться среди всех сообщений в{' '}
              <span ref={groupTooltipRef} className="relative inline">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => groupName && setGroupTooltipOpen((v) => !v)}
                  onKeyDown={(e) => e.key === 'Enter' && groupName && setGroupTooltipOpen((v) => !v)}
                  className={cn(
                    'underline decoration-dotted underline-offset-[3px] decoration-muted-foreground/50',
                    groupName && 'cursor-pointer',
                  )}
                >
                  доверенной группе
                </span>
                {groupTooltipOpen && groupName && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2.5 bg-foreground text-background rounded-xl whitespace-nowrap shadow-lg animate-in fade-in zoom-in-95 duration-150 flex items-center gap-2.5">
                    <span className="text-[14px] font-medium">{groupName}</span>
                    <a
                      href={`https://t.me/${groupName.replace(/\s+/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-background text-foreground text-[12px] font-semibold px-3 py-1 rounded-full hover:opacity-80 transition shrink-0"
                    >
                      Открыть
                    </a>
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-foreground" />
                  </span>
                )}
              </span>
              , где состоит бот.
            </p>
            <p className="text-muted-foreground text-[14px] leading-relaxed">
            При выборе "Только друзья" ищем подходящие заявки только среди тех пользователей, которых вы добавили в список друзей самостоятельно.             <span
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1 text-muted-foreground text-[14px] leading-relaxed hover:text-foreground transition underline"
            >
              <CircleHelp className="w-3.5 h-3.5 shrink-0" />
              Как добавлять друзей
              
            </span>
            </p>

          </div>
        </div>
      </div>

      <BottomSheet open={guideOpen} onClose={() => setGuideOpen(false)}>
        <h3 className="text-[17px] font-semibold text-foreground mb-3">
          Как добавлять друзей
        </h3>
        <div className="flex flex-col gap-2.5">
          <p className="text-muted-foreground text-[14px] leading-relaxed">
            Отправьте другу ссылку на бота. Когда он запустит бота и вы оба
            будете в контактах друг друга в Telegram — вы автоматически
            появитесь в списках друзей.
          </p>
          <p className="text-muted-foreground text-[14px] leading-relaxed">
            Также можно переслать контакт или любое сообщение друга прямо боту — этого достаточно, чтобы он появился в списке друзей.
          </p>
        </div>
      </BottomSheet>
    </div>
  );
}
