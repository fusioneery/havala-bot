import { useState, useCallback } from 'react';

const STORAGE_KEY = 'hawala:create-order';

interface PersistedFormState {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  minExchangeAmount: string;
  visibility: string;
  rateSource: string;
}

function load(): Partial<PersistedFormState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(state: PersistedFormState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded — ignore
  }
}

export function usePersistedFormState() {
  const [saved] = useState(load);
  const isFirstVisit = !localStorage.getItem(STORAGE_KEY);

  const persist = useCallback((state: PersistedFormState) => {
    save(state);
  }, []);

  return { saved, persist, isFirstVisit } as const;
}
