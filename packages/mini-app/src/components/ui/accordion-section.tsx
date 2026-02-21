import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';

interface AccordionSectionProps {
  title: string;
  preview?: string | ((open: boolean) => string | undefined);
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export function AccordionSection({
  title,
  preview,
  defaultOpen = false,
  children,
  className,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const resolvedPreview = typeof preview === 'function' ? preview(open) : preview;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-3 outline-none active:opacity-70 transition-opacity"
      >
        <span className="text-[17px] font-semibold text-foreground">{title}</span>
        <div className="flex items-center gap-2">
          {resolvedPreview && (
            <span className="text-[15px] text-muted-foreground">{resolvedPreview}</span>
          )}
          <ChevronRight
            className={cn(
              'w-[18px] h-[18px] text-muted-foreground transition-transform duration-300',
              open && 'rotate-90',
            )}
          />
        </div>
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
