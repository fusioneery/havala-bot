import { apiFetch } from '@/lib/api';
import { useEffect, useState } from 'react';

export function useDealCode(): string | null {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    apiFetch('/api/contacts/invite-link')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { code?: string } | null) => { if (data?.code) setCode(data.code); })
      .catch(() => {});
  }, []);
  return code;
}
