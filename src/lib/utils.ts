import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseGenres(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function formatTotalDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  });
}

export function formatPrice(
  value: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (value === null || value === undefined) return '—';
  const code = currency || 'EUR';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`.trim();
  }
}

export function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parsePriceInput(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, '');
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const separator = Math.max(lastComma, lastDot);

  let normalized = cleaned;
  if (separator !== -1) {
    const integer = cleaned.slice(0, separator).replace(/[.,]/g, '');
    const fraction = cleaned.slice(separator + 1).replace(/[.,]/g, '');
    normalized = fraction ? `${integer}.${fraction}` : integer;
  }

  const price = Number.parseFloat(normalized);
  return Number.isFinite(price) && price >= 0 ? price : null;
}


export function proxiedCoverUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === 'coverartarchive.org') {
      return `/api/cover?url=${encodeURIComponent(value)}`;
    }
  } catch {
    return value;
  }
  return value;
}

export function hueFromString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function pluralize(count: number, singular: string, plural?: string) {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

export const CONDITIONS = [
  'Mint',
  'Near Mint',
  'Very Good Plus',
  'Very Good',
  'Good',
  'Fair',
  'Poor',
];

export const FORMAT_OPTIONS = ['CD', 'Vinyl', 'Cassette', 'Digital', 'Other'];

export const CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'JPY',
  'CAD',
  'AUD',
] as const;
