import type {
  ArtistDetail,
  ArtistSearchResult,
  DiscoverResponse,
  ImportResult,
  MbRelease,
  Meta,
  Release,
  ReleasePayload,
  SearchResult,
  WishlistItem,
  WishlistPayload,
  SpendingStats,
  Stats,
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

  discover() {
    return request<DiscoverResponse>('/api/discover');
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

  stats() {
    return request<Stats>('/api/stats');
  },

  spending(currency?: string) {
    const suffix = currency
      ? `?currency=${encodeURIComponent(currency)}`
      : '';
    return request<SpendingStats>(`/api/stats/spending${suffix}`);
  },

  meta() {
    return request<Meta>('/api/meta');
  },
};
