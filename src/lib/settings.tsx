import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CONDITIONS, CURRENCIES, FORMAT_OPTIONS } from './utils';

export const ACCENTS = {
  amber: {
    label: 'Amber',
    accent: '#f4b860',
    soft: '#ffd9a0',
    light: '#a2670f',
    lightSoft: '#c88a2c',
  },
  coral: {
    label: 'Coral',
    accent: '#ef7d5b',
    soft: '#ffb8a3',
    light: '#b0472b',
    lightSoft: '#d06a4c',
  },
  moss: {
    label: 'Moss',
    accent: '#b9d97c',
    soft: '#daf0ac',
    light: '#5c761f',
    lightSoft: '#7f9c3c',
  },
  sky: {
    label: 'Sky',
    accent: '#7fb8f5',
    soft: '#b9d9fb',
    light: '#2e6cae',
    lightSoft: '#4f8fd0',
  },
  lilac: {
    label: 'Lilac',
    accent: '#c6a5ff',
    soft: '#e2d1ff',
    light: '#7343c4',
    lightSoft: '#9368d8',
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

export type Settings = {
  theme: ThemeKey;
  accent: AccentKey;
  defaultFormat: string;
  defaultCondition: string;
  defaultCurrency: string;
  defaultView: ViewKey;
  defaultSort: SortKey;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  accent: 'amber',
  defaultFormat: 'CD',
  defaultCondition: 'Near Mint',
  defaultCurrency: 'EUR',
  defaultView: 'grid',
  defaultSort: 'recent',
};

export const SETTINGS_STORAGE_KEY = 'sleeve:settings:v1';

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const accent =
      parsed.accent && parsed.accent in ACCENTS
        ? (parsed.accent as AccentKey)
        : DEFAULT_SETTINGS.accent;
    const theme: ThemeKey =
      parsed.theme === 'light' ? 'light' : DEFAULT_SETTINGS.theme;
    const defaultFormat =
      parsed.defaultFormat && FORMAT_OPTIONS.includes(parsed.defaultFormat)
        ? parsed.defaultFormat
        : DEFAULT_SETTINGS.defaultFormat;
    const defaultCondition =
      parsed.defaultCondition && CONDITIONS.includes(parsed.defaultCondition)
        ? parsed.defaultCondition
        : DEFAULT_SETTINGS.defaultCondition;
    const defaultCurrency =
      parsed.defaultCurrency &&
      (CURRENCIES as readonly string[]).includes(parsed.defaultCurrency)
        ? parsed.defaultCurrency
        : DEFAULT_SETTINGS.defaultCurrency;
    const defaultView =
      parsed.defaultView === 'grid' || parsed.defaultView === 'list'
        ? parsed.defaultView
        : DEFAULT_SETTINGS.defaultView;
    const defaultSort =
      parsed.defaultSort &&
      SORT_OPTIONS.some((option) => option.value === parsed.defaultSort)
        ? (parsed.defaultSort as SortKey)
        : DEFAULT_SETTINGS.defaultSort;
    return {
      theme,
      accent,
      defaultFormat,
      defaultCondition,
      defaultCurrency,
      defaultView,
      defaultSort,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

type SettingsContextValue = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

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
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage can be unavailable in private mode; keep in-memory settings.
    }
  }, [settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateSettings: (patch) =>
        setSettings((current) => ({ ...current, ...patch })),
      resetSettings: () => setSettings(DEFAULT_SETTINGS),
    }),
    [settings],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
