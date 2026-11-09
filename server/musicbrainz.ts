import { prisma } from './db';

const MB_BASE = 'https://musicbrainz.org/ws/2';
const CAA_BASE = 'https://coverartarchive.org/release';
const CAA_RELEASE_GROUP_BASE = 'https://coverartarchive.org/release-group';
const USER_AGENT =
  process.env.MUSICBRAINZ_USER_AGENT ?? 'Sleeve/0.1 ( https://github.com/local/sleeve )';
const MIN_INTERVAL_MS = 1200;

type Credit = {
  name: string;
  joinphrase?: string;
  artist?: { id?: string };
};

type MbSearchRelease = {
  id: string;
  title: string;
  score?: number;
  date?: string;
  country?: string;
  barcode?: string;
  'track-count'?: number;
  'artist-credit'?: Credit[];
  'release-group'?: { 'primary-type'?: string };
  'label-info'?: Array<{ 'catalog-number'?: string; label?: { name?: string } }>;
  media?: Array<{ format?: string }>;
};

type MbTrack = {
  number?: string;
  title: string;
  length?: number;
  position?: number;
  'artist-credit'?: Credit[];
};

type MbMedium = {
  position?: number;
  format?: string;
  'track-count'?: number;
  tracks?: MbTrack[];
};

type MbRelease = {
  id: string;
  title: string;
  date?: string;
  country?: string;
  barcode?: string;
  status?: string;
  packaging?: string;
  'track-count'?: number;
  'artist-credit'?: Credit[];
  'release-group'?: {
    'primary-type'?: string;
    genres?: Array<{ name: string }>;
  };
  genres?: Array<{ name: string }>;
  'label-info'?: Array<{ 'catalog-number'?: string; label?: { name?: string } }>;
  media?: MbMedium[];
};

export type SearchResult = {
  musicbrainzId: string;
  title: string;
  artist: string;
  artistId: string | null;
  year: number | null;
  releaseDate: string | null;
  country: string | null;
  label: string | null;
  catalogNumber: string | null;
  barcode: string | null;
  format: string;
  formatDetail: string | null;
  trackCount: number | null;
  coverUrl: string;
  type: string | null;
};

export type ReleaseDetail = Omit<SearchResult, 'type'> & {
  type: string | null;
  status: string | null;
  packaging: string | null;
  genres: string[];
  tracks: Array<{
    position: number;
    disc: number | null;
    number: number | null;
    title: string;
    duration: number | null;
    artist: string | null;
  }>;
};

type MbArtistSearch = {
  id: string;
  name: string;
  'sort-name'?: string;
  disambiguation?: string;
  type?: string;
  country?: string;
  area?: { name?: string };
  'life-span'?: { begin?: string; end?: string; ended?: boolean };
  score?: number;
};

type MbArtist = MbArtistSearch & {
  genres?: Array<{ name: string }>;
  tags?: Array<{ name: string; count?: number }>;
  relations?: Array<{ type?: string; url?: { resource?: string } }>;
};

type MbReleaseGroup = {
  id: string;
  title: string;
  score?: number;
  'primary-type'?: string;
  'secondary-types'?: string[];
  'first-release-date'?: string;
  'release-count'?: number;
  count?: number;
  'artist-credit'?: Credit[];
};

export type DiscoverReleaseGroup = ArtistReleaseGroup & {
  score: number;
};

export type ArtistSearchResult = {
  id: string;
  name: string;
  sortName: string | null;
  disambiguation: string | null;
  type: string | null;
  country: string | null;
  area: string | null;
  beginYear: number | null;
  endYear: number | null;
  ended: boolean;
  score: number;
};

export type ArtistLink = {
  type: string;
  url: string;
};

export type ArtistReleaseGroup = {
  id: string;
  title: string;
  primaryType: string;
  secondaryTypes: string[];
  firstReleaseDate: string | null;
  year: number | null;
  releaseCount: number;
  coverUrl: string;
  artist: string;
  artistId: string | null;
};

export type ArtistDetail = Omit<ArtistSearchResult, 'score'> & {
  genres: string[];
  links: ArtistLink[];
  releaseGroups: ArtistReleaseGroup[];
  releaseGroupTotal: number;
};

const ARTIST_LINK_TYPES = [
  'official homepage',
  'wikipedia',
  'discogs',
  'bandcamp',
  'allmusic',
  'wikidata',
  'youtube',
  'instagram',
  'facebook',
  'twitter',
  'soundcloud',
];

type CacheTier = 'search' | 'detail';

const CACHE_TTL_MS: Record<CacheTier | 'negative', number> = {
  search: 30 * 60 * 1000,
  detail: 7 * 24 * 60 * 60 * 1000,
  negative: 10 * 60 * 1000,
};

let lastPruneAt = 0;

async function pruneCache() {
  if (Date.now() - lastPruneAt < 10 * 60 * 1000) return;
  lastPruneAt = Date.now();
  await prisma.metadataCache
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined);
}

async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    const row = await prisma.metadataCache.findUnique({ where: { key } });
    if (!row) return undefined;
    if (row.expiresAt.getTime() <= Date.now()) {
      await prisma.metadataCache
        .delete({ where: { key } })
        .catch(() => undefined);
      return undefined;
    }
    return JSON.parse(row.payload) as T;
  } catch {
    return undefined;
  }
}

async function cacheSet(key: string, value: unknown, ttlMs: number) {
  try {
    const expiresAt = new Date(Date.now() + ttlMs);
    await prisma.metadataCache.upsert({
      where: { key },
      create: { key, payload: JSON.stringify(value), expiresAt },
      update: { payload: JSON.stringify(value), expiresAt },
    });
    void pruneCache();
  } catch {
    // A cache failure must never break metadata lookup.
  }
}

type Flight<T> = {
  promise: Promise<T>;
  controller: AbortController;
  subscribers: number;
  settled: boolean;
};

const inFlight = new Map<string, Flight<unknown>>();

function abortError() {
  const error = new Error('Request cancelled');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

async function withCache<T>(
  key: string,
  tier: CacheTier,
  loader: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== undefined) return cached;

  throwIfAborted(signal);

  const existing = inFlight.get(key) as Flight<T> | undefined;
  if (existing) {
    existing.subscribers += 1;
    try {
      return await abortable(existing.promise, signal);
    } finally {
      existing.subscribers -= 1;
      if (existing.subscribers <= 0 && !existing.settled) {
        existing.controller.abort();
      }
    }
  }

  const controller = new AbortController();
  const flight = {
    controller,
    subscribers: 1,
    settled: false,
  } as Flight<T>;
  const promise = (async () => {
    try {
      const value = await loader(controller.signal);
      const empty = Array.isArray(value) && value.length === 0;
      const ttl =
        tier === 'search' && empty
          ? CACHE_TTL_MS.negative
          : CACHE_TTL_MS[tier];
      await cacheSet(key, value, ttl);
      return value;
    } finally {
      flight.settled = true;
      inFlight.delete(key);
    }
  })();
  flight.promise = promise;
  inFlight.set(key, flight as Flight<unknown>);

  try {
    return await abortable(promise, signal);
  } finally {
    flight.subscribers -= 1;
    if (flight.subscribers <= 0 && !flight.settled) {
      controller.abort();
    }
  }
}

let chain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;
let cooldownUntil = 0;

function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
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

async function mbFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const run = chain.then(async () => {
    throwIfAborted(signal);

    if (Date.now() < cooldownUntil) {
      const seconds = Math.ceil((cooldownUntil - Date.now()) / 1000);
      throw new Error(
        `MusicBrainz is cooling down. Try again in ${seconds}s.`,
      );
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
      if (wait > 0) await waitWithAbort(wait, signal);
      lastRequestAt = Date.now();
      throwIfAborted(signal);

      const timeout = AbortSignal.timeout(15000);
      const response = await fetch(`${MB_BASE}/${path}`, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      if (response.status === 503 && attempt < 2) {
        await waitWithAbort(1800 * (attempt + 1), signal);
        continue;
      }

      if (response.status === 503) {
        cooldownUntil = Date.now() + 30_000;
      }

      const message =
        response.status === 503
          ? 'MusicBrainz is rate limiting right now. Try again in a moment.'
          : `MusicBrainz request failed (${response.status}).`;
      throw new Error(message);
    }

    cooldownUntil = Date.now() + 30_000;
    throw new Error('MusicBrainz is rate limiting right now. Try again in a moment.');
  });

  chain = run.catch(() => undefined);
  return run as Promise<T>;
}

function joinCredit(credit?: Credit[]): string {
  if (!credit?.length) return '';
  return credit.map((item) => `${item.name}${item.joinphrase ?? ''}`).join('').trim();
}

export function coverUrl(mbid: string, size: 250 | 500 = 500): string {
  return `${CAA_BASE}/${mbid}/front-${size}`;
}

export function normalizeFormat(raw?: string): string {
  if (!raw) return 'Other';
  if (/cd/i.test(raw)) return 'CD';
  if (/vinyl|12"|10"|7"/i.test(raw)) return 'Vinyl';
  if (/cassette|tape/i.test(raw)) return 'Cassette';
  if (/digital|file/i.test(raw)) return 'Digital';
  return 'Other';
}

const FORMAT_ORDER = ['CD', 'Vinyl', 'Cassette', 'Digital', 'Other'];

export function sortFormats(formats: string[]): string[] {
  return formats.sort(
    (a, b) => FORMAT_ORDER.indexOf(a) - FORMAT_ORDER.indexOf(b),
  );
}

function mapSearchRelease(release: MbSearchRelease): SearchResult {
  const media = release.media ?? [];
  const formatDetail = media.find((item) => item.format)?.format ?? null;
  const date = release.date ?? '';
  return {
    musicbrainzId: release.id,
    title: release.title,
    artist: joinCredit(release['artist-credit']) || 'Unknown artist',
    artistId: release['artist-credit']?.[0]?.artist?.id ?? null,
    year: date ? Number(date.slice(0, 4)) || null : null,
    releaseDate: date || null,
    country: release.country ?? null,
    label: release['label-info']?.[0]?.label?.name ?? null,
    catalogNumber: release['label-info']?.[0]?.['catalog-number'] ?? null,
    barcode: release.barcode ?? null,
    format: normalizeFormat(formatDetail ?? undefined),
    formatDetail,
    trackCount: release['track-count'] ?? null,
    coverUrl: coverUrl(release.id, 250),
    type: release['release-group']?.['primary-type'] ?? null,
  };
}

function titleizeGenre(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/&([a-z])/g, (_, letter: string) => `&${letter.toUpperCase()}`);
}

function mapRelease(release: MbRelease): ReleaseDetail {
  const media = release.media ?? [];
  const formatDetail = media.find((item) => item.format)?.format ?? null;
  const artist = joinCredit(release['artist-credit']) || 'Unknown artist';
  const date = release.date ?? '';
  const genreMap = new Map<string, string>();
  const addGenre = (name: string) => {
    const clean = titleizeGenre(name);
    if (clean && !genreMap.has(clean.toLowerCase())) {
      genreMap.set(clean.toLowerCase(), clean);
    }
  };
  for (const genre of release.genres ?? []) addGenre(genre.name);
  for (const genre of release['release-group']?.genres ?? []) addGenre(genre.name);
  const genres = [...genreMap.values()].sort((a, b) => a.localeCompare(b));

  let position = 0;
  const tracks: ReleaseDetail['tracks'] = [];
  media.forEach((medium, mediumIndex) => {
    for (const track of medium.tracks ?? []) {
      position += 1;
      const rawNumber = Number(track.number);
      tracks.push({
        position,
        disc: media.length > 1 ? (medium.position ?? mediumIndex + 1) : null,
        number: Number.isFinite(rawNumber) ? rawNumber : null,
        title: track.title,
        duration: track.length ? Math.round(track.length / 1000) : null,
        artist: joinCredit(track['artist-credit']) || artist,
      });
    }
  });

  return {
    musicbrainzId: release.id,
    title: release.title,
    artist,
    artistId: release['artist-credit']?.[0]?.artist?.id ?? null,
    year: date ? Number(date.slice(0, 4)) || null : null,
    releaseDate: date || null,
    country: release.country ?? null,
    label: release['label-info']?.[0]?.label?.name ?? null,
    catalogNumber: release['label-info']?.[0]?.['catalog-number'] ?? null,
    barcode: release.barcode ?? null,
    format: normalizeFormat(formatDetail ?? undefined),
    formatDetail,
    trackCount: tracks.length || release['track-count'] || null,
    coverUrl: coverUrl(release.id, 500),
    type: release['release-group']?.['primary-type'] ?? null,
    status: release.status ?? null,
    packaging: release.packaging ?? null,
    genres,
    tracks,
  };
}

export async function searchReleases(
  query: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const key = `mb:release-search:${query.trim().toLowerCase()}:${limit}`;
  return withCache(
    key,
    'search',
    async (flightSignal) => {
      const data = await mbFetch<{ releases?: MbSearchRelease[] }>(
        `release/?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`,
        flightSignal,
      );
      return (data.releases ?? []).map(mapSearchRelease);
    },
    signal,
  );
}

export async function searchByBarcode(
  barcode: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  return searchReleases(`barcode:${barcode}`, 10, signal);
}

export async function getRelease(
  mbid: string,
  signal?: AbortSignal,
): Promise<ReleaseDetail> {
  return withCache(
    `mb:release:${mbid}`,
    'detail',
    async (flightSignal) => {
      const data = await mbFetch<MbRelease>(
        `release/${encodeURIComponent(mbid)}?inc=recordings+artist-credits+labels+genres+release-groups&fmt=json`,
        flightSignal,
      );
      return mapRelease(data);
    },
    signal,
  );
}

function mapArtistSearch(artist: MbArtistSearch): ArtistSearchResult {
  return {
    id: artist.id,
    name: artist.name,
    sortName: artist['sort-name'] ?? null,
    disambiguation: artist.disambiguation || null,
    type: artist.type ?? null,
    country: artist.country ?? null,
    area: artist.area?.name ?? null,
    beginYear: artist['life-span']?.begin
      ? Number(artist['life-span'].begin.slice(0, 4)) || null
      : null,
    endYear: artist['life-span']?.end
      ? Number(artist['life-span'].end.slice(0, 4)) || null
      : null,
    ended: Boolean(artist['life-span']?.ended),
    score: artist.score ?? 0,
  };
}

function mapArtistReleaseGroup(
  group: MbReleaseGroup,
  fallbackArtist: string,
): ArtistReleaseGroup {
  const date = group['first-release-date'] ?? '';
  return {
    id: group.id,
    title: group.title,
    primaryType: group['primary-type'] ?? 'Other',
    secondaryTypes: group['secondary-types'] ?? [],
    firstReleaseDate: date || null,
    year: date ? Number(date.slice(0, 4)) || null : null,
    releaseCount: group['release-count'] ?? group.count ?? 0,
    coverUrl: `${CAA_RELEASE_GROUP_BASE}/${group.id}/front-250`,
    artist: joinCredit(group['artist-credit']) || fallbackArtist,
    artistId: group['artist-credit']?.[0]?.artist?.id ?? null,
  };
}

export async function searchArtists(
  query: string,
  limit = 6,
  signal?: AbortSignal,
): Promise<ArtistSearchResult[]> {
  const key = `mb:artist-search:${query.trim().toLowerCase()}:${limit}`;
  return withCache(
    key,
    'search',
    async (flightSignal) => {
      const data = await mbFetch<{ artists?: MbArtistSearch[] }>(
        `artist/?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`,
        flightSignal,
      );
      return (data.artists ?? []).map(mapArtistSearch);
    },
    signal,
  );
}

export async function getArtist(
  mbid: string,
  signal?: AbortSignal,
): Promise<ArtistDetail> {
  return withCache(
    `mb:artist:${mbid}`,
    'detail',
    async (flightSignal) => {
      const [artistData, groupData] = await Promise.all([
        mbFetch<MbArtist>(
          `artist/${encodeURIComponent(mbid)}?inc=genres+tags+url-rels&fmt=json`,
          flightSignal,
        ),
        mbFetch<{
          'release-groups'?: MbReleaseGroup[];
          'release-group-count'?: number;
        }>(
          `release-group?artist=${encodeURIComponent(mbid)}&inc=artist-credits&fmt=json&limit=100`,
          flightSignal,
        ),
      ]);

  const base = mapArtistSearch(artistData);
  const genreMap = new Map<string, string>();
  const addGenre = (name: string) => {
    const clean = titleizeGenre(name);
    if (clean && !genreMap.has(clean.toLowerCase())) {
      genreMap.set(clean.toLowerCase(), clean);
    }
  };
  for (const genre of artistData.genres ?? []) addGenre(genre.name);
  if (genreMap.size === 0) {
    [...(artistData.tags ?? [])]
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 6)
      .forEach((tag) => addGenre(tag.name));
  }

  const links: ArtistLink[] = [];
  const seenTypes = new Set<string>();
  for (const relation of artistData.relations ?? []) {
    const type = relation.type?.toLowerCase();
    const url = relation.url?.resource;
    if (!type || !url || !ARTIST_LINK_TYPES.includes(type) || seenTypes.has(type)) {
      continue;
    }
    seenTypes.add(type);
    links.push({ type, url });
  }
  links.sort(
    (a, b) =>
      ARTIST_LINK_TYPES.indexOf(a.type) - ARTIST_LINK_TYPES.indexOf(b.type),
  );

      const releaseGroups = (groupData['release-groups'] ?? [])
        .map((group) => mapArtistReleaseGroup(group, artistData.name))
        .sort(
          (a, b) =>
            (b.firstReleaseDate ?? '').localeCompare(a.firstReleaseDate ?? '') ||
            a.title.localeCompare(b.title),
        );

      return {
        ...base,
        genres: [...genreMap.values()].sort((a, b) => a.localeCompare(b)),
        links: links.slice(0, 8),
        releaseGroups,
        releaseGroupTotal:
          groupData['release-group-count'] ?? releaseGroups.length,
      } satisfies ArtistDetail;
    },
    signal,
  );
}


export async function searchReleaseGroupsByTag(
  tag: string,
  limit = 12,
  signal?: AbortSignal,
): Promise<DiscoverReleaseGroup[]> {
  const cleanTag = tag.replace(/"/g, '').trim();
  if (!cleanTag) return [];
  const query = `tag:"${cleanTag}" AND primarytype:album`;
  return withCache(
    `mb:genre-albums:${cleanTag.toLowerCase()}:${limit}`,
    'search',
    async (flightSignal) => {
      const data = await mbFetch<{ 'release-groups'?: MbReleaseGroup[] }>(
        `release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`,
        flightSignal,
      );
      return (data['release-groups'] ?? []).map((group) => ({
        ...mapArtistReleaseGroup(group, 'Unknown artist'),
        score: group.score ?? 0,
      }));
    },
    signal,
  );
}
