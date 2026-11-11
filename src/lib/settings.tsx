import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import type { AppSettings } from './types';

export const ACCENTS = {
  amber: {
    label: 'Amber',
    accent: '#f4b860',
    soft: '#ffd9a0',
    light: '#c2410c',
    lightSoft: '#9a3412',
  },
  coral: {
    label: 'Coral',
    accent: '#ef7d5b',
    soft: '#ffb8a3',
    light: '#b0472b',
    lightSoft: '#973b22',
  },
  moss: {
    label: 'Moss',
    accent: '#b9d97c',
    soft: '#daf0ac',
    light: '#5c761f',
    lightSoft: '#4f6718',
  },
  sky: {
    label: 'Sky',
    accent: '#7fb8f5',
    soft: '#b9d9fb',
    light: '#2e6cae',
    lightSoft: '#245d99',
  },
  lilac: {
    label: 'Lilac',
    accent: '#c6a5ff',
    soft: '#e2d1ff',
    light: '#7343c4',
    lightSoft: '#6236ad',
  },
} as const;

export type AccentKey = keyof typeof ACCENTS;
export type ThemeKey = 'dark' | 'light';

export const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently added' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'artist', label: 'Artist A–Z' },
  { value: 'year', label: 'Year, newest' },
  { value: 'rating', label: 'Highest rated' },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]['value'];
export type ViewKey = 'grid' | 'list';

export type LocalSettings = {
  theme: ThemeKey;
  accent: AccentKey;
  defaultView: ViewKey;
  defaultSort: SortKey;
};

export type Settings = LocalSettings & AppSettings;

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  theme: 'dark',
  accent: 'amber',
  defaultView: 'grid',
  defaultSort: 'recent',
};

export const DEFAULT_COLLECTION_DEFAULTS: AppSettings = {
  defaultFormat: 'CD',
  defaultCondition: 'Near Mint',
  defaultCurrency: 'EUR',
};

export const DEFAULT_SETTINGS: Settings = {
  ...DEFAULT_LOCAL_SETTINGS,
  ...DEFAULT_COLLECTION_DEFAULTS,
};

export const SETTINGS_STORAGE_KEY = 'sleeve:settings:v1';

export function parseLocalSettings(raw: string | null): LocalSettings {
  if (!raw) return DEFAULT_LOCAL_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalSettings>;
    const accent =
      parsed.accent && parsed.accent in ACCENTS
        ? (parsed.accent as AccentKey)
        : DEFAULT_LOCAL_SETTINGS.accent;
    const theme: ThemeKey =
      parsed.theme === 'light' ? 'light' : DEFAULT_LOCAL_SETTINGS.theme;
    const defaultView =
      parsed.defaultView === 'grid' || parsed.defaultView === 'list'
        ? parsed.defaultView
        : DEFAULT_LOCAL_SETTINGS.defaultView;
    const defaultSort =
      parsed.defaultSort &&
      SORT_OPTIONS.some((option) => option.value === parsed.defaultSort)
        ? (parsed.defaultSort as SortKey)
        : DEFAULT_LOCAL_SETTINGS.defaultSort;
    return { theme, accent, defaultView, defaultSort };
  } catch {
    return DEFAULT_LOCAL_SETTINGS;
  }
}

function loadLocalSettings(): LocalSettings {
  if (typeof window === 'undefined') return DEFAULT_LOCAL_SETTINGS;
  return parseLocalSettings(window.localStorage.getItem(SETTINGS_STORAGE_KEY));
}

type SettingsContextValue = {
  settings: Settings;
  updateSettings: (patch: Partial<LocalSettings>) => void;
  resetSettings: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [localSettings, setLocalSettings] = useState<LocalSettings>(loadLocalSettings);
  const appSettingsQuery = useQuery({
    queryKey: ['app-settings'],
    queryFn: api.getAppSettings,
    staleTime: 5 * 60_000,
  });

  const settings = useMemo<Settings>(
    () => ({
      ...localSettings,
      ...(appSettingsQuery.data?.settings ?? DEFAULT_COLLECTION_DEFAULTS),
    }),
    [localSettings, appSettingsQuery.data],
  );

  useLayoutEffect(() => {
    const accent = ACCENTS[settings.accent] ?? ACCENTS.amber;
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.style.setProperty(
      '--color-accent',
      settings.theme === 'light' ? accent.light : accent.accent,
    );
    root.style.setProperty(
      '--color-accent-soft',
      settings.theme === 'light' ? accent.lightSoft : accent.soft,
    );
  }, [settings.accent, settings.theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(localSettings));
    } catch {
      // Storage can be unavailable in private mode; keep in-memory settings.
    }
  }, [localSettings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateSettings: (patch) =>
        setLocalSettings((current) => ({ ...current, ...patch })),
      resetSettings: () => setLocalSettings(DEFAULT_LOCAL_SETTINGS),
    }),
    [settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
