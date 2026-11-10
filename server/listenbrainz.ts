import { env } from './config';

export type ReleaseGroupPopularity = {
  listenCount: number;
  userCount: number;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BATCH = 100;
const ENDPOINT = 'https://api.listenbrainz.org/1/popularity/release-group';

const cache = new Map<string, { value: ReleaseGroupPopularity; expiresAt: number }>();

function isValidMbid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export async function getReleaseGroupPopularity(
  ids: string[],
  signal?: AbortSignal,
): Promise<Map<string, ReleaseGroupPopularity>> {
  const result = new Map<string, ReleaseGroupPopularity>();
  const missing: string[] = [];
  const now = Date.now();

  for (const id of [...new Set(ids.filter(isValidMbid))]) {
    const cached = cache.get(id);
    if (cached && cached.expiresAt > now) result.set(id, cached.value);
    else if (cached) cache.delete(id);
    else missing.push(id);
  }

  for (let index = 0; index < missing.length; index += MAX_BATCH) {
    if (signal?.aborted) break;
    const batch = missing.slice(index, index + MAX_BATCH);
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': env.userAgent,
        },
        body: JSON.stringify({ release_group_mbids: batch }),
        signal,
      });
      if (!response.ok) continue;
      const rows = (await response.json()) as Array<{
        release_group_mbid?: string;
        total_listen_count?: number | null;
        total_user_count?: number | null;
      }>;
      for (const row of rows) {
        if (!row.release_group_mbid || row.total_listen_count == null) continue;
        const value = {
          listenCount: row.total_listen_count,
          userCount: row.total_user_count ?? 0,
        };
        result.set(row.release_group_mbid, value);
        cache.set(row.release_group_mbid, {
          value,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      }
    } catch {
      // Popularity is an enhancement; feed generation must not fail without it.
    }
  }

  return result;
}
