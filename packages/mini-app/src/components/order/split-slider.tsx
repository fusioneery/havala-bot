import { useCallback, useRef, useEffect } from 'react';

interface SplitSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function SplitSlider({ value, onChange }: SplitSliderProps) {
  const sliderRef = useRef<HTMLInputElement>(null);

  const updateSliderBackground = useCallback((val: number) => {
    if (sliderRef.current) {
      const percent = val;
      sliderRef.current.style.backgroundSize = `${percent}% 100%`;
    }
  }, []);

  useEffect(() => {
    updateSliderBackground(value);
  }, [value, updateSliderBackground]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    onChange(val);
    updateSliderBackground(val);
  };

  return (
    <div className="mt-8 px-2">
      <div className="flex justify-between items-end mb-5">
        <label className="text-[17px] font-semibold leading-none text-white">
          Минимальная сумма сплита
        </label>
        <span className="text-lime font-bold text-[17px] leading-none bg-lime/10 px-2.5 py-1 rounded-md min-w-[3.5rem] text-center">
          {value}%
        </span>
      </div>

      <div className="relative h-14 flex items-center mb-2">
        <input
          ref={sliderRef}
          type="range"
          min="0"
          max="100"
          step="10"
          value={value}
          onChange={handleChange}
          className="range-slider relative z-10"
        />

        {/* Tick marks */}
        <div className="absolute w-full flex justify-between px-[14px] pointer-events-none top-[36px]">
          {[0, 50, 100].map((tick) => (
            <div key={tick} className="flex flex-col items-center gap-1.5">
              <div className="w-0.5 h-1.5 bg-surface-hover rounded-full" />
              <span className="text-[11px] text-label-dim font-medium font-mono">
                {tick}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
