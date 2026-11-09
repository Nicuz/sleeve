const MB_BASE = 'https://musicbrainz.org/ws/2';
const CAA_BASE = 'https://coverartarchive.org/release';
const CAA_RELEASE_GROUP_BASE = 'https://coverartarchive.org/release-group';
const USER_AGENT =
  process.env.MUSICBRAINZ_USER_AGENT ?? 'Sleeve/0.1 ( https://github.com/local/sleeve )';
const MIN_INTERVAL_MS = 1200;
const CACHE_TTL_MS = 5 * 60 * 1000;

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
  'primary-type'?: string;
  'secondary-types'?: string[];
  'first-release-date'?: string;
  'release-count'?: number;
  'artist-credit'?: Credit[];
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

const cache = new Map<string, { expires: number; value: unknown }>();

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown) {
  if (cache.size > 200) cache.clear();
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
}

let chain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mbFetch<T>(path: string): Promise<T> {
  const run = chain.then(async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
      if (wait > 0) await sleep(wait);
      lastRequestAt = Date.now();

      const response = await fetch(`${MB_BASE}/${path}`, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      if (response.status === 503 && attempt < 2) {
        await sleep(1800 * (attempt + 1));
        continue;
      }

      const message =
        response.status === 503
          ? 'MusicBrainz is rate limiting right now. Try again in a moment.'
          : `MusicBrainz request failed (${response.status}).`;
      throw new Error(message);
    }

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
): Promise<SearchResult[]> {
  const key = `search:${query.toLowerCase()}:${limit}`;
  const cached = cacheGet<SearchResult[]>(key);
  if (cached) return cached;

  const data = await mbFetch<{ releases?: MbSearchRelease[] }>(
    `release/?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`,
  );
  const results = (data.releases ?? []).map(mapSearchRelease);
  cacheSet(key, results);
  return results;
}

export async function searchByBarcode(barcode: string): Promise<SearchResult[]> {
  return searchReleases(`barcode:${barcode}`, 10);
}

export async function getRelease(mbid: string): Promise<ReleaseDetail> {
  const key = `release:${mbid}`;
  const cached = cacheGet<ReleaseDetail>(key);
  if (cached) return cached;

  const data = await mbFetch<MbRelease>(
    `release/${encodeURIComponent(mbid)}?inc=recordings+artist-credits+labels+genres+release-groups&fmt=json`,
  );
  const detail = mapRelease(data);
  cacheSet(key, detail);
  return detail;
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
    releaseCount: group['release-count'] ?? 0,
    coverUrl: `${CAA_RELEASE_GROUP_BASE}/${group.id}/front-250`,
    artist: joinCredit(group['artist-credit']) || fallbackArtist,
  };
}

export async function searchArtists(
  query: string,
  limit = 6,
): Promise<ArtistSearchResult[]> {
  const key = `artist-search:${query.toLowerCase()}:${limit}`;
  const cached = cacheGet<ArtistSearchResult[]>(key);
  if (cached) return cached;

  const data = await mbFetch<{ artists?: MbArtistSearch[] }>(
    `artist/?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`,
  );
  const results = (data.artists ?? []).map(mapArtistSearch);
  cacheSet(key, results);
  return results;
}

export async function getArtist(mbid: string): Promise<ArtistDetail> {
  const key = `artist:${mbid}`;
  const cached = cacheGet<ArtistDetail>(key);
  if (cached) return cached;

  const [artistData, groupData] = await Promise.all([
    mbFetch<MbArtist>(
      `artist/${encodeURIComponent(mbid)}?inc=genres+tags+url-rels&fmt=json`,
    ),
    mbFetch<{
      'release-groups'?: MbReleaseGroup[];
      'release-group-count'?: number;
    }>(
      `release-group?artist=${encodeURIComponent(mbid)}&inc=artist-credits&fmt=json&limit=100`,
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

  const detail: ArtistDetail = {
    ...base,
    genres: [...genreMap.values()].sort((a, b) => a.localeCompare(b)),
    links: links.slice(0, 8),
    releaseGroups,
    releaseGroupTotal: groupData['release-group-count'] ?? releaseGroups.length,
  };
  cacheSet(key, detail);
  return detail;
}
