import type { GlobalSearchScope } from './types';

const RECENT_KEY = 'sleeve:search:recent:v1';
const SCOPE_KEY = 'sleeve:search:scope:v1';
const MAX_RECENT = 5;

export const SEARCH_SCOPES: ReadonlyArray<{
  value: GlobalSearchScope;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'library', label: 'Library' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'artists', label: 'Artists' },
];

function storage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export function loadRecentSearches(): string[] {
  try {
    const raw = storage()?.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function rememberSearch(query: string): string[] {
  const clean = query.trim();
  const next = clean
    ? [
        clean,
        ...loadRecentSearches().filter(
          (item) => item.toLowerCase() !== clean.toLowerCase(),
        ),
      ].slice(0, MAX_RECENT)
    : loadRecentSearches();
  try {
    storage()?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable in private mode.
  }
  return next;
}

export function clearRecentSearches() {
  try {
    storage()?.removeItem(RECENT_KEY);
  } catch {
    // Storage can be unavailable in private mode.
  }
}

export function loadSearchScope(): GlobalSearchScope {
  const raw = storage()?.getItem(SCOPE_KEY);
  return SEARCH_SCOPES.some((scope) => scope.value === raw)
    ? (raw as GlobalSearchScope)
    : 'all';
}

export function saveSearchScope(scope: GlobalSearchScope) {
  try {
    storage()?.setItem(SCOPE_KEY, scope);
  } catch {
    // Storage can be unavailable in private mode.
  }
}
