import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type AddPreset = {
  query: string;
  display: string;
};

type AppContextValue = {
  addOpen: boolean;
  addPreset: AddPreset | null;
  openAdd: (preset?: AddPreset) => void;
  closeAdd: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [addOpen, setAddOpen] = useState(false);
  const [addPreset, setAddPreset] = useState<AddPreset | null>(null);

  const value = useMemo<AppContextValue>(
    () => ({
      addOpen,
      addPreset,
      openAdd: (preset) => {
        setAddPreset(preset ?? null);
        setAddOpen(true);
      },
      closeAdd: () => {
        setAddOpen(false);
        setAddPreset(null);
      },
    }),
    [addOpen, addPreset],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
