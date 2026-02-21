import { ArrowUpDown } from 'lucide-react';

interface SwapButtonProps {
  onSwap: () => void;
}

export function SwapButton({ onSwap }: SwapButtonProps) {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
      <div className="w-14 h-14 bg-background rounded-full flex items-center justify-center p-1.5 pointer-events-auto">
        <button
          onClick={onSwap}
          className="w-full h-full rounded-full bg-lime hover:bg-lime-hover text-foreground flex items-center justify-center transition-all duration-300 shadow-lg group border border-background"
        >
          <ArrowUpDown className="w-5 h-5 transition-transform duration-500" />
        </button>
      </div>
    </div>
  );
}
