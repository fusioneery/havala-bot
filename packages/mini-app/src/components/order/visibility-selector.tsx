import { useState } from 'react';
import { Users, Globe, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Visibility } from '@hawala/shared';

interface VisibilitySelectorProps {
  value: Visibility;
  onChange: (value: Visibility) => void;
}

const options: Array<{
  value: Visibility;
  icon: typeof Users;
  label: string;
  description: string;
}> = [
  {
    value: 'friends_only',
    icon: Users,
    label: 'Друзья',
    description: 'Только прямые контакты',
  },
  {
    value: 'friends_and_acquaintances',
    icon: Globe,
    label: 'Друзья и знакомые',
    description: 'Рекомендуется для скорости',
  },
];

export function VisibilitySelector({ value, onChange }: VisibilitySelectorProps) {
  const [faqOpen, setFaqOpen] = useState(false);

  return (
    <div className="mt-10 px-1 mb-6">
      <h3 className="text-[17px] font-semibold mb-4 ml-1">Видимость</h3>

      <div className="flex flex-col gap-3">
        {options.map((option) => {
          const isSelected = value === option.value;
          const Icon = option.icon;

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
                  'flex items-center justify-between bg-surface p-4 rounded-[24px] border transition overflow-hidden',
                  isSelected
                    ? 'border-lime/20 shadow-[0_0_0_1px_rgba(200,241,53,0.05)]'
                    : 'border-transparent hover:border-surface-hover',
                )}
              >
                {/* Glow background for selected */}
                {isSelected && (
                  <div className="absolute inset-0 bg-gradient-to-r from-lime/10 to-transparent" />
                )}

                <div className="flex items-center gap-4 z-10">
                  <div className="w-11 h-11 rounded-full bg-surface-hover flex items-center justify-center text-white transition-colors duration-300">
                    <Icon className="w-[22px] h-[22px]" />
                  </div>
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        'text-[16px] font-medium',
                        isSelected ? 'text-white' : 'text-white/90 group-hover:text-white',
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="text-label text-[13px]">{option.description}</span>
                  </div>
                </div>

                {/* Radio circle */}
                <div
                  className={cn(
                    'w-6 h-6 rounded-full border-[2px] relative z-10 box-border transition-all duration-300 shrink-0',
                    isSelected
                      ? 'border-lime bg-lime shadow-[0_0_12px_rgba(200,241,53,0.4)]'
                      : 'border-surface-active',
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-background rounded-full" />
                  )}
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
          className="group flex items-center gap-2.5 text-lime text-[14px] font-semibold hover:text-lime-hover transition outline-none"
        >
          <div className="w-6 h-6 rounded-full bg-lime/10 flex items-center justify-center group-hover:bg-lime/20 transition border border-lime/20">
            <ChevronRight
              className={cn(
                'w-2.5 h-2.5 transition-transform duration-300',
                faqOpen && 'rotate-90',
              )}
            />
          </div>
          <span>Как работает видимость?</span>
        </button>
        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
            faqOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <div className="pt-3 pb-1 pl-9 pr-2">
            <p className="text-label text-[14px] leading-relaxed">
              При выборе "Друзья и знакомые" вашу заявку увидят не только ваши контакты,
              но и их доверенные друзья (2-й круг). Это увеличивает шанс найти встречное
              предложение на 40% без потери приватности.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
