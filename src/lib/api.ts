import type {
  MbRelease,
  Meta,
  Release,
  ReleasePayload,
  SearchResult,
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

  getRelease(id: string) {
    return request<{ release: Release }>(`/api/releases/${id}`);
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

  searchMusicbrainz(query: string, limit = 20) {
    return request<{ results: SearchResult[]; count: number }>(
      `/api/musicbrainz/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    );
  },

  searchBarcode(code: string) {
    return request<{ results: SearchResult[]; count: number }>(
      `/api/musicbrainz/barcode/${encodeURIComponent(code)}`,
    );
  },

  getMusicbrainzRelease(mbid: string) {
    return request<{ release: MbRelease }>(
      `/api/musicbrainz/releases/${encodeURIComponent(mbid)}`,
    );
  },

  stats() {
    return request<Stats>('/api/stats');
  },

  meta() {
    return request<Meta>('/api/meta');
  },
};
