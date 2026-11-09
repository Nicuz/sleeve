import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type AppContextValue = {
  addOpen: boolean;
  openAdd: () => void;
  closeAdd: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [addOpen, setAddOpen] = useState(false);

  const value = useMemo<AppContextValue>(
    () => ({
      addOpen,
      openAdd: () => setAddOpen(true),
      closeAdd: () => setAddOpen(false),
    }),
    [addOpen],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
