import { env } from './config';

export type ReleaseGroupPopularity = {
  listenCount: number;
  userCount: number;
};

export type ArtistPopularity = {
  listenCount: number;
  userCount: number;
};

export type SimilarArtistMatch = {
  artistId: string;
  name: string;
  score: number;
  referenceId: string;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SIMILAR_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BATCH = 100;
const MIN_INTERVAL_MS = 1000;
const BASE = 'https://api.listenbrainz.org';
const LABS_BASE = 'https://labs.api.listenbrainz.org';
const RELEASE_GROUP_ENDPOINT = `${BASE}/1/popularity/release-group`;
const ARTIST_ENDPOINT = `${BASE}/1/popularity/artist`;
const SIMILAR_ENDPOINT = `${LABS_BASE}/similar-artists/json`;
const SIMILAR_ALGORITHM =
  'session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30';

const releaseGroupCache = new Map<
  string,
  { value: ReleaseGroupPopularity; expiresAt: number }
>();
const artistCache = new Map<string, { value: ArtistPopularity; expiresAt: number }>();
const similarCache = new Map<
  string,
  { value: SimilarArtistMatch[]; expiresAt: number }
>();

let chain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function isValidMbid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

function abortError() {
  const error = new Error('Request cancelled');
  error.name = 'AbortError';
  return error;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function lbFetch<T>(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<T | null> {
  const run = chain.then(async () => {
    if (signal?.aborted) throw abortError();
    const waitMs = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (waitMs > 0) await wait(waitMs, signal);
    lastRequestAt = Date.now();

    const timeout = AbortSignal.timeout(20000);
    const response = await fetch(url, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'user-agent': env.userAgent,
        ...init.headers,
      },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  });

  chain = run.catch(() => undefined);
  return run;
}

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of releaseGroupCache) {
    if (entry.expiresAt <= now) releaseGroupCache.delete(key);
  }
  for (const [key, entry] of artistCache) {
    if (entry.expiresAt <= now) artistCache.delete(key);
  }
  for (const [key, entry] of similarCache) {
    if (entry.expiresAt <= now) similarCache.delete(key);
  }
}

export async function getReleaseGroupPopularity(
  ids: string[],
  signal?: AbortSignal,
): Promise<Map<string, ReleaseGroupPopularity>> {
  const result = new Map<string, ReleaseGroupPopularity>();
  const missing: string[] = [];
  const now = Date.now();

  for (const id of [...new Set(ids.filter(isValidMbid))]) {
    const cached = releaseGroupCache.get(id);
    if (cached && cached.expiresAt > now) result.set(id, cached.value);
    else if (cached) releaseGroupCache.delete(id);
    else missing.push(id);
  }

  for (let index = 0; index < missing.length; index += MAX_BATCH) {
    if (signal?.aborted) break;
    const batch = missing.slice(index, index + MAX_BATCH);
    try {
      const rows = await lbFetch<
        Array<{
          release_group_mbid?: string;
          total_listen_count?: number | null;
          total_user_count?: number | null;
        }>
      >(
        RELEASE_GROUP_ENDPOINT,
        {
          method: 'POST',
          body: JSON.stringify({ release_group_mbids: batch }),
        },
        signal,
      );
      if (!rows) continue;
      for (const row of rows) {
        if (!row.release_group_mbid || row.total_listen_count == null) continue;
        const value = {
          listenCount: row.total_listen_count,
          userCount: row.total_user_count ?? 0,
        };
        result.set(row.release_group_mbid, value);
        releaseGroupCache.set(row.release_group_mbid, {
          value,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') break;
    }
  }

  pruneCache();
  return result;
}

export async function getArtistPopularity(
  ids: string[],
  signal?: AbortSignal,
): Promise<Map<string, ArtistPopularity>> {
  const result = new Map<string, ArtistPopularity>();
  const missing: string[] = [];
  const now = Date.now();

  for (const id of [...new Set(ids.filter(isValidMbid))]) {
    const cached = artistCache.get(id);
    if (cached && cached.expiresAt > now) result.set(id, cached.value);
    else if (cached) artistCache.delete(id);
    else missing.push(id);
  }

  for (let index = 0; index < missing.length; index += MAX_BATCH) {
    if (signal?.aborted) break;
    const batch = missing.slice(index, index + MAX_BATCH);
    try {
      const rows = await lbFetch<
        Array<{
          artist_mbid?: string;
          total_listen_count?: number | null;
          total_user_count?: number | null;
        }>
      >(
        ARTIST_ENDPOINT,
        {
          method: 'POST',
          body: JSON.stringify({ artist_mbids: batch }),
        },
        signal,
      );
      if (!rows) continue;
      for (const row of rows) {
        if (!row.artist_mbid || row.total_listen_count == null) continue;
        const value = {
          listenCount: row.total_listen_count,
          userCount: row.total_user_count ?? 0,
        };
        result.set(row.artist_mbid, value);
        artistCache.set(row.artist_mbid, {
          value,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') break;
    }
  }

  pruneCache();
  return result;
}

export async function getSimilarArtists(
  seedIds: string[],
  signal?: AbortSignal,
): Promise<SimilarArtistMatch[]> {
  const ids = [...new Set(seedIds.filter(isValidMbid))].sort();
  if (ids.length === 0) return [];

  const key = ids.join(',');
  const cached = similarCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) similarCache.delete(key);

  const params = new URLSearchParams();
  for (const id of ids) params.append('artist_mbids', id);
  params.set('algorithm', SIMILAR_ALGORITHM);

  try {
    const rows = await lbFetch<
      Array<{
        artist_mbid?: string;
        name?: string;
        score?: number;
        reference_mbid?: string;
      }>
    >(`${SIMILAR_ENDPOINT}?${params.toString()}`, { method: 'GET' }, signal);

    if (!rows) return [];
    const matches = rows
      .filter(
        (
          row,
        ): row is {
          artist_mbid: string;
          name: string;
          score: number;
          reference_mbid: string;
        } =>
          Boolean(
            row.artist_mbid &&
              row.name &&
              typeof row.score === 'number' &&
              row.reference_mbid &&
              isValidMbid(row.artist_mbid),
          ),
      )
      .map((row) => ({
        artistId: row.artist_mbid,
        name: row.name,
        score: row.score,
        referenceId: row.reference_mbid,
      }));

    similarCache.set(key, {
      value: matches,
      expiresAt: Date.now() + SIMILAR_CACHE_TTL_MS,
    });
    return matches;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return [];
    return [];
  }
}
