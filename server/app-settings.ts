import { prisma } from './db';

export const FORMAT_OPTIONS = ['CD', 'Vinyl', 'Cassette', 'Digital', 'Other'] as const;
export const CONDITION_OPTIONS = [
  'Mint',
  'Near Mint',
  'Very Good Plus',
  'Very Good',
  'Good',
  'Fair',
  'Poor',
] as const;
export const CURRENCY_OPTIONS = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'JPY',
  'CAD',
  'AUD',
] as const;

export const APP_SETTINGS_ID = 'default';

export const DEFAULT_APP_SETTINGS = {
  defaultFormat: 'CD',
  defaultCondition: 'Near Mint',
  defaultCurrency: 'EUR',
} as const;

export type AppSettingsValues = {
  defaultFormat: string;
  defaultCondition: string;
  defaultCurrency: string;
};

function pick(row: {
  defaultFormat: string;
  defaultCondition: string;
  defaultCurrency: string;
}): AppSettingsValues {
  return {
    defaultFormat: row.defaultFormat,
    defaultCondition: row.defaultCondition,
    defaultCurrency: row.defaultCurrency,
  };
}

export async function getAppSettings(): Promise<AppSettingsValues> {
  const row = await prisma.appSettings.findUnique({
    where: { id: APP_SETTINGS_ID },
  });
  return row ? pick(row) : { ...DEFAULT_APP_SETTINGS };
}

export async function saveAppSettings(
  patch: Partial<AppSettingsValues>,
): Promise<AppSettingsValues> {
  const row = await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    create: {
      id: APP_SETTINGS_ID,
      ...DEFAULT_APP_SETTINGS,
      ...patch,
    },
    update: patch,
  });
  return pick(row);
}
