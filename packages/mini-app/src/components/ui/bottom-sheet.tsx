import { cn } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ startY: 0, dy: 0, active: false });

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const id = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(id);
    }
  }, [open]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    drag.current = { startY: e.touches[0].clientY, dy: 0, active: true };
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!drag.current.active) return;
    const dy = Math.max(0, e.touches[0].clientY - drag.current.startY);
    drag.current.dy = dy;
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${dy}px)`;
  }, []);

  const onTouchEnd = useCallback(() => {
    const { dy, active } = drag.current;
    drag.current.active = false;
    if (!active) return;

    const sheet = sheetRef.current;
    if (sheet) {
      sheet.style.transition = '';
      sheet.style.transform = '';
    }

    if (dy > (sheet?.offsetHeight ?? 300) * 0.25) {
      onClose();
    }
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className={cn(
          'absolute inset-0 bg-black/40 transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={cn(
          'absolute bottom-0 left-0 right-0 bg-card rounded-t-[20px]',
          'pb-[max(env(safe-area-inset-bottom),20px)]',
          'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          visible ? 'translate-y-0' : 'translate-y-full',
        )}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-[5px] rounded-full bg-muted-foreground/30" />
        </div>
        <div className="px-6 pt-2 pb-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
