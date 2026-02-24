import { apiFetch } from '@/lib/api';
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

export interface TrustedGroup {
  name: string;
  link: string;
}

interface TrustedGroupsContextValue {
  groups: TrustedGroup[];
  loading: boolean;
}

const TrustedGroupsContext = createContext<TrustedGroupsContextValue>({
  groups: [],
  loading: true,
});

export function TrustedGroupsProvider(props: PropsWithChildren) {
  const [groups, setGroups] = useState<TrustedGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/groups')
      .then((res) => res.json())
      .then((data) => setGroups(data))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <TrustedGroupsContext.Provider value={{ groups, loading }}>
      {props.children}
    </TrustedGroupsContext.Provider>
  );
}

export function useTrustedGroups() {
  return useContext(TrustedGroupsContext);
}
