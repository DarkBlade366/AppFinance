import { createContext, PropsWithChildren, useCallback, useContext, useState } from 'react';

type RefreshContextValue = {
  version: number;
  refresh: () => void;
};

const RefreshContext = createContext<RefreshContextValue>({ version: 0, refresh: () => {} });

export function RefreshProvider({ children }: PropsWithChildren) {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return (
    <RefreshContext.Provider value={{ version, refresh }}>{children}</RefreshContext.Provider>
  );
}

export function useRefresh(): RefreshContextValue {
  return useContext(RefreshContext);
}
