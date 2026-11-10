import type {
  ArtistDetail,
  ArtistReleaseGroupsPage,
  ArtistSearchResult,
  DiscoverResponse,
  EnrichResult,
  ImportResult,
  MetadataCacheInfo,
  MbRelease,
  Meta,
  Release,
  ReleasePayload,
  SavedSuggestion,
  SavedSuggestionPayload,
  SearchResult,
  WishlistItem,
  WishlistPayload,
  SpendingStats,
  Stats,
  StatsRange,
} from './types';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      typeof data.message === 'string' ? data.message : 'Request failed',
      response.status,
    );
  }
  return data as T;
}

export type ReleaseFilters = {
  q?: string;
  format?: string;
  genre?: string;
  decade?: string;
  missing?: string;
  sort?: string;
};

export const api = {
  listReleases(filters: ReleaseFilters = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== 'All') params.set(key, value);
    }
    const suffix = params.toString();
    return request<{ releases: Release[]; count: number }>(
      `/api/releases${suffix ? `?${suffix}` : ''}`,
    );
  },

  importData(payload: unknown) {
    return request<ImportResult>('/api/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  discover(refresh = false) {
    return request<DiscoverResponse>(`/api/discover${refresh ? '?refresh=1' : ''}`);
  },

  recordDiscoveryEvent(payload: {
    releaseGroupId: string;
    artistId?: string | null;
    artist?: string | null;
    action: 'open' | 'remove-save';
  }) {
    return request<{ ok: boolean }>('/api/discover/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  listWishlist() {
    return request<{ items: WishlistItem[]; count: number }>('/api/wishlist');
  },

  createWishlistItem(payload: WishlistPayload) {
    return request<{ item: WishlistItem }>('/api/wishlist', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateWishlistItem(id: string, payload: Partial<WishlistPayload>) {
    return request<{ item: WishlistItem }>(`/api/wishlist/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteWishlistItem(id: string) {
    return request<{ ok: boolean }>(`/api/wishlist/${id}`, {
      method: 'DELETE',
    });
  },
  listSavedSuggestions() {
    return request<{ items: SavedSuggestion[]; count: number }>('/api/saved');
  },

  saveSuggestion(payload: SavedSuggestionPayload) {
    return request<{ item: SavedSuggestion }>('/api/saved', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  removeSavedSuggestion(id: string) {
    return request<{ ok: boolean }>(`/api/saved/${id}`, {
      method: 'DELETE',
    });
  },

  promoteSavedSuggestion(id: string) {
    return request<{ item: WishlistItem }>(`/api/saved/${id}/promote`, {
      method: 'POST',
    });
  },

  applyReleaseMatch(id: string, musicbrainzId: string) {
    return request<EnrichResult>(`/api/releases/${id}/apply-match`, {
      method: 'POST',
      body: JSON.stringify({ musicbrainzId }),
    });
  },

  enrichRelease(id: string) {
    return request<EnrichResult>(`/api/releases/${id}/enrich`, {
      method: 'POST',
    });
  },

  refreshRelease(id: string) {
    return request<{ release: Release }>(`/api/releases/${id}/refresh`, {
      method: 'POST',
    });
  },

  metadataCacheInfo() {
    return request<MetadataCacheInfo>('/api/metadata/cache');
  },

  clearMetadataCache() {
    return request<{ ok: boolean; deleted: number }>('/api/metadata/cache', {
      method: 'DELETE',
    });
  },

  coverCacheInfo() {
    return request<{ count: number; bytes: number }>('/api/covers/cache');
  },

  clearCoverCache() {
    return request<{ ok: boolean; deleted: number }>('/api/covers/cache', {
      method: 'DELETE',
    });
  },

  createBackup() {
    return request<{ backup: { name: string; bytes: number; createdAt: string } }>(
      '/api/backups',
      { method: 'POST' },
    );
  },

  backupUrl(name: string) {
    return `/api/backups/${encodeURIComponent(name)}`;
  },

  randomRelease() {
    return request<{ release: Release | null }>('/api/releases/random');
  },

  getRelease(id: string) {
    return request<{ release: Release }>(`/api/releases/${id}`);
  },

  ownedMusicbrainzIds(ids: string[]) {
    return request<{
      releases: Array<{ id: string; musicbrainzId: string }>;
    }>(`/api/releases/owned?ids=${encodeURIComponent(ids.join(','))}`);
  },

  createRelease(payload: ReleasePayload) {
    return request<{ release: Release }>('/api/releases', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateRelease(id: string, payload: Partial<ReleasePayload>) {
    return request<{ release: Release }>(`/api/releases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteRelease(id: string) {
    return request<{ ok: boolean }>(`/api/releases/${id}`, {
      method: 'DELETE',
    });
  },

  clearLibrary(confirm: string) {
    return request<{ ok: boolean; deleted: number }>(
      `/api/releases?confirm=${encodeURIComponent(confirm)}`,
      { method: 'DELETE' },
    );
  },

  exportLibraryUrl(format: 'json' | 'csv') {
    return `/api/export?format=${format}`;
  },

  searchMusicbrainz(query: string, limit = 20, signal?: AbortSignal) {
    return request<{ results: SearchResult[]; count: number }>(
      `/api/musicbrainz/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      { signal },
    );
  },

  searchBarcode(code: string, signal?: AbortSignal) {
    return request<{ results: SearchResult[]; count: number }>(
      `/api/musicbrainz/barcode/${encodeURIComponent(code)}`,
      { signal },
    );
  },

  getMusicbrainzRelease(mbid: string, signal?: AbortSignal) {
    return request<{ release: MbRelease }>(
      `/api/musicbrainz/releases/${encodeURIComponent(mbid)}`,
      { signal },
    );
  },

  searchArtists(query: string, limit = 6, signal?: AbortSignal) {
    return request<{ results: ArtistSearchResult[]; count: number }>(
      `/api/musicbrainz/artists?q=${encodeURIComponent(query)}&limit=${limit}`,
      { signal },
    );
  },

  getArtist(mbid: string, signal?: AbortSignal) {
    return request<{ artist: ArtistDetail }>(
      `/api/musicbrainz/artists/${encodeURIComponent(mbid)}`,
      { signal },
    );
  },

  getArtistReleaseGroups(
    mbid: string,
    offset: number,
    limit = 100,
    signal?: AbortSignal,
  ) {
    return request<ArtistReleaseGroupsPage>(
      `/api/musicbrainz/artists/${encodeURIComponent(mbid)}/release-groups?offset=${offset}&limit=${limit}`,
      { signal },
    );
  },

  stats(range: StatsRange = 'all') {
    const suffix = range === 'all' ? '' : `?range=${range}`;
    return request<Stats>(`/api/stats${suffix}`);
  },

  spending(currency?: string, range: StatsRange = 'all') {
    const query = new URLSearchParams();
    if (currency) query.set('currency', currency);
    if (range !== 'all') query.set('range', range);
    const suffix = query.size ? `?${query.toString()}` : '';
    return request<SpendingStats>(`/api/stats/spending${suffix}`);
  },

  meta() {
    return request<Meta>('/api/meta');
  },
};
