import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { type Ref, useState, type ReactNode } from 'react';

interface AccordionSectionProps {
  title: string;
  preview?: string | ReactNode | ((open: boolean) => string | ReactNode | undefined);
  defaultOpen?: boolean;
  /** Controlled open state — when provided, overrides internal state */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Ref to the content wrapper (for external height measurement) */
  contentRef?: Ref<HTMLDivElement>;
  children: ReactNode;
  className?: string;
}

export function AccordionSection({
  title,
  preview,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  contentRef,
  children,
  className,
}: AccordionSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const toggle = () => {
    const next = !open;
    if (isControlled) {
      onOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  };

  const resolvedPreview = typeof preview === 'function' ? preview(open) : preview;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-3 py-3 outline-none active:opacity-70 transition-opacity"
      >
        <span className="text-[17px] font-semibold text-left text-foreground">{title}</span>
        <div className="flex items-center gap-2">
          {resolvedPreview != null && resolvedPreview !== '' && (
            typeof resolvedPreview === 'string'
              ? <span className="text-[15px] text-muted-foreground text-right">{resolvedPreview}</span>
              : resolvedPreview
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
        <div ref={contentRef} className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
