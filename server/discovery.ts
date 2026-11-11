import { prisma } from './db';
import {
  getArtistPopularity,
  getReleaseGroupPopularity,
  getSimilarArtists,
  type ArtistPopularity,
  type ReleaseGroupPopularity,
} from './listenbrainz';
import {
  searchNewReleaseGroupsByTag,
  searchReleaseGroupsByArtistIds,
  type DiscoverReleaseGroup,
} from './musicbrainz';

export type DiscoveryItem = DiscoverReleaseGroup & {
  reason: string;
  genre: string | null;
};

export type DiscoverySection = {
  id: string;
  kind: 'radar' | 'new' | 'crate';
  title: string;
  subtitle: string;
  items: DiscoveryItem[];
};

export type DiscoveryFeed = {
  version: number;
  basedOn: string[];
  featured: DiscoveryItem | null;
  sections: DiscoverySection[];
  generatedAt: string;
  nextRefreshAt: string;
};

export type DiscoveryEventAction = 'open' | 'remove-save';

export type DiscoveryEventInput = {
  releaseGroupId: string;
  artistId?: string | null;
  artist?: string | null;
  action: DiscoveryEventAction;
};

export const DISCOVERY_VERSION = 4;

const VARIOUS_ARTISTS_ID = '89ad4ac3-39f7-470e-963a-56509c546377';
const FEED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SEEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EVENT_WINDOW_DAYS = 180;
const RADAR_WINDOW_DAYS = 30;
const WEEK_WINDOW_DAYS = 7;
const MONTH_WINDOW_DAYS = 30;
const CRATE_SINCE = '1950-01-01';
const UPCOMING_WINDOW_DAYS = 90;
const RADAR_LIMIT = 8;
const WEEK_LIMIT = 8;
const MONTH_LIMIT = 8;
const CRATE_LIMIT = 8;
const ARTIST_SEED_LIMIT = 10;
const SIMILAR_ARTIST_LIMIT = 40;
const SIMILAR_ARTIST_WEIGHT = 2.5;
const OPEN_WEIGHT = 0.25;
const REMOVE_SAVE_WEIGHT = -0.5;
const FOLLOW_WEIGHT = 1.5;
const MAX_ARTIST_AFFINITY = 12;
const MIN_ARTIST_AFFINITY = -4;
const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function releaseKey(artist: string, title: string): string {
  return `${normalize(artist)}|${normalize(title)}`;
}

function artistKey(id: string | null | undefined, name: string): string {
  return id ? `id:${id}` : `name:${normalize(name)}`;
}

function artistIdFromKey(key: string): string | null {
  return key.startsWith('id:') ? key.slice(3) : null;
}

function isAlbumOrEp(group: DiscoverReleaseGroup): boolean {
  return (
    group.secondaryTypes.length === 0 &&
    (group.primaryType === 'Album' || group.primaryType === 'EP')
  );
}

function byReleaseDate(a: DiscoveryItem, b: DiscoveryItem): number {
  return (b.firstReleaseDate ?? '').localeCompare(a.firstReleaseDate ?? '');
}

function uniqueById(items: DiscoveryItem[]): DiscoveryItem[] {
  const map = new Map<string, DiscoveryItem>();
  for (const item of items) map.set(item.id, item);
  return [...map.values()];
}

function ratingWeight(rating: number | null): number {
  if (rating == null) return 1;
  if (rating >= 5) return 2;
  if (rating === 4) return 1.5;
  if (rating === 3) return 1;
  if (rating === 2) return 0.6;
  return 0.3;
}

function hashScore(seed: string, id: string): number {
  let hash = 2166136261;
  for (const char of `${seed}:${id}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function eventDecay(createdAt: Date): number {
  const ageDays = Math.max(0, (Date.now() - createdAt.getTime()) / DAY_MS);
  return 0.5 ** (ageDays / 120);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function popularityScore(stats: { listenCount: number; userCount: number }): number {
  return Math.log10(1 + stats.listenCount) + Math.log10(1 + stats.userCount) * 0.35;
}

function artistPopularityScore(stats: ArtistPopularity | undefined): number {
  if (!stats) return 0;
  return Math.log10(1 + stats.listenCount) + Math.log10(1 + stats.userCount) * 0.35;
}

type ScoredItem = {
  item: DiscoveryItem;
  score: number;
  affinity: number;
  popularity: number;
  freshness: number;
  exploration: number;
};

type ArtistSource = 'owned' | 'wishlist' | 'saved' | 'followed';

type CollectionSnapshot = {
  topGenres: string[];
  genreAffinity: Map<string, number>;
  artistAffinity: Map<string, number>;
  artistNames: Map<string, string>;
  artistSources: Map<string, ArtistSource>;
  seedArtistIds: string[];
  ownedKeys: Set<string>;
  wishlistKeys: Set<string>;
  savedGroupIds: Set<string>;
  ownedArtistIds: Set<string>;
  ownedArtistNames: Set<string>;
};

async function getCollectionSnapshot(): Promise<CollectionSnapshot> {
  const eventCutoff = new Date(Date.now() - EVENT_WINDOW_DAYS * DAY_MS);
  const [releases, wishlist, saved, follows, events] = await Promise.all([
    prisma.release.findMany({
      select: { title: true, artist: true, artistId: true, genres: true, rating: true },
    }),
    prisma.wishlistItem.findMany({
      select: { title: true, artist: true, artistId: true },
    }),
    prisma.savedSuggestion.findMany({
      select: { releaseGroupId: true, artist: true, artistId: true },
    }),
    prisma.artistFollow.findMany({
      select: { artistId: true, name: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.discoveryEvent.findMany({
      where: { createdAt: { gt: eventCutoff } },
      select: {
        releaseGroupId: true,
        artistId: true,
        artist: true,
        action: true,
        createdAt: true,
      },
    }),
  ]);

  const genreWeights = new Map<string, { name: string; weight: number }>();
  const artistAffinity = new Map<string, number>();
  const artistNames = new Map<string, string>();
  const artistSources = new Map<string, ArtistSource>();
  const ownedKeys = new Set<string>();
  const ownedArtistIds = new Set<string>();
  const ownedArtistNames = new Set<string>();
  const sourceRank: Record<ArtistSource, number> = {
    saved: 1,
    wishlist: 2,
    owned: 3,
    followed: 4,
  };

  function markArtistSource(
    id: string | null | undefined,
    name: string,
    source: ArtistSource,
  ) {
    const key = artistKey(id, name);
    const current = artistSources.get(key);
    if (!current || sourceRank[source] > sourceRank[current]) {
      artistSources.set(key, source);
    }
  }

  function addArtist(id: string | null | undefined, name: string, weight: number) {
    if (!name) return;
    const key = artistKey(id, name);
    artistAffinity.set(key, (artistAffinity.get(key) ?? 0) + weight);
    if (!artistNames.has(key)) artistNames.set(key, name);
  }

  function addGenre(name: string, weight: number) {
    const key = normalize(name);
    if (!key) return;
    const current = genreWeights.get(key);
    genreWeights.set(key, {
      name: current?.name ?? name,
      weight: (current?.weight ?? 0) + weight,
    });
  }

  for (const release of releases) {
    ownedKeys.add(releaseKey(release.artist, release.title));
    ownedArtistNames.add(normalize(release.artist));
    if (release.artistId) ownedArtistIds.add(release.artistId);
    const weight = ratingWeight(release.rating);
    addArtist(release.artistId, release.artist, weight);
    markArtistSource(release.artistId, release.artist, 'owned');
    for (const genre of (release.genres ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)) {
      addGenre(genre, weight);
    }
  }

  const wishlistKeys = new Set<string>();
  for (const item of wishlist) {
    wishlistKeys.add(releaseKey(item.artist, item.title));
    addArtist(item.artistId, item.artist, 1.2);
    markArtistSource(item.artistId, item.artist, 'wishlist');
  }

  const savedGroupIds = new Set<string>();
  for (const item of saved) {
    savedGroupIds.add(item.releaseGroupId);
    addArtist(item.artistId, item.artist, 0.8);
    markArtistSource(item.artistId, item.artist, 'saved');
  }

  for (const follow of follows) {
    addArtist(follow.artistId, follow.name, FOLLOW_WEIGHT);
    markArtistSource(follow.artistId, follow.name, 'followed');
  }

  const openedGroups = new Set<string>();
  for (const event of events) {
    const key = artistKey(event.artistId, event.artist ?? '');
    if (event.action === 'open') {
      if (openedGroups.has(event.releaseGroupId)) continue;
      openedGroups.add(event.releaseGroupId);
      if (event.artist)
        addArtist(
          event.artistId,
          event.artist,
          OPEN_WEIGHT * eventDecay(event.createdAt),
        );
    } else if (event.action === 'remove-save' && event.artist) {
      addArtist(
        event.artistId,
        event.artist,
        REMOVE_SAVE_WEIGHT * eventDecay(event.createdAt),
      );
    }
    if (!artistNames.has(key) && event.artist) artistNames.set(key, event.artist);
  }

  for (const [key, value] of artistAffinity) {
    artistAffinity.set(key, clamp(value, MIN_ARTIST_AFFINITY, MAX_ARTIST_AFFINITY));
  }

  const genreAffinity = new Map<string, number>();
  for (const [key, value] of genreWeights) genreAffinity.set(key, value.weight);

  const topGenres = [...genreWeights.entries()]
    .sort((a, b) => b[1].weight - a[1].weight || a[1].name.localeCompare(b[1].name))
    .slice(0, 3)
    .map(([, value]) => value.name);

  const seedIds = new Set(follows.map((follow) => follow.artistId));
  for (const [key, value] of [...artistAffinity.entries()].sort((a, b) => b[1] - a[1])) {
    if (!key.startsWith('id:') || value <= 0) continue;
    const id = artistIdFromKey(key);
    if (id) seedIds.add(id);
  }
  const seedArtistIds = [...seedIds].slice(0, ARTIST_SEED_LIMIT);

  return {
    topGenres,
    genreAffinity,
    artistAffinity,
    artistNames,
    artistSources,
    seedArtistIds,
    ownedKeys,
    wishlistKeys,
    savedGroupIds,
    ownedArtistIds,
    ownedArtistNames,
  };
}

type SimilarExpansion = {
  affinity: Map<string, number>;
  sources: Map<string, { name: string; score: number; kind: ArtistSource | null }>;
  artistIds: string[];
};

async function expandSimilarArtists(
  snapshot: CollectionSnapshot,
  signal?: AbortSignal,
): Promise<SimilarExpansion> {
  const expansion: SimilarExpansion = {
    affinity: new Map(),
    sources: new Map(),
    artistIds: [],
  };
  if (snapshot.seedArtistIds.length === 0) return expansion;

  const matches = await getSimilarArtists(snapshot.seedArtistIds, signal);
  if (matches.length === 0) return expansion;

  const seedScores = new Map<string, number>();
  for (const id of snapshot.seedArtistIds) {
    seedScores.set(id, Math.max(0, snapshot.artistAffinity.get(`id:${id}`) ?? 0));
  }
  const maxSeedScore = Math.max(1, ...seedScores.values());
  const maxScoreByReference = new Map<string, number>();
  for (const match of matches) {
    maxScoreByReference.set(
      match.referenceId,
      Math.max(maxScoreByReference.get(match.referenceId) ?? 0, match.score),
    );
  }

  for (const match of matches) {
    if (snapshot.ownedArtistIds.has(match.artistId)) continue;
    const seedScore = seedScores.get(match.referenceId) ?? 0;
    if (seedScore <= 0) continue;
    const normalizedScore =
      match.score / (maxScoreByReference.get(match.referenceId) ?? 1);
    const contribution =
      normalizedScore * (seedScore / maxSeedScore) * SIMILAR_ARTIST_WEIGHT;
    if (contribution <= 0) continue;
    expansion.affinity.set(
      match.artistId,
      (expansion.affinity.get(match.artistId) ?? 0) + contribution,
    );
    const source = snapshot.artistNames.get(`id:${match.referenceId}`);
    const sourceKind = snapshot.artistSources.get(`id:${match.referenceId}`) ?? null;
    const current = expansion.sources.get(match.artistId);
    if (source && (!current || contribution > current.score)) {
      expansion.sources.set(match.artistId, {
        name: source,
        score: contribution,
        kind: sourceKind,
      });
    }
  }

  expansion.artistIds = [...expansion.affinity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, SIMILAR_ARTIST_LIMIT)
    .map(([id]) => id);

  for (const id of expansion.artistIds) {
    const key = `id:${id}`;
    const merged = clamp(
      (snapshot.artistAffinity.get(key) ?? 0) + (expansion.affinity.get(id) ?? 0),
      MIN_ARTIST_AFFINITY,
      MAX_ARTIST_AFFINITY,
    );
    snapshot.artistAffinity.set(key, merged);
  }

  return expansion;
}

function isOwnedRelease(
  group: DiscoverReleaseGroup,
  snapshot: CollectionSnapshot,
): boolean {
  if (snapshot.ownedKeys.has(releaseKey(group.artist, group.title))) return true;
  if (snapshot.wishlistKeys.has(releaseKey(group.artist, group.title))) return true;
  return snapshot.savedGroupIds.has(group.id);
}

function isOwnedArtist(
  group: DiscoverReleaseGroup,
  snapshot: CollectionSnapshot,
): boolean {
  if (group.artistId && snapshot.ownedArtistIds.has(group.artistId)) return true;
  return snapshot.ownedArtistNames.has(normalize(group.artist));
}

function isVariousArtists(group: DiscoverReleaseGroup): boolean {
  if (group.artistId === VARIOUS_ARTISTS_ID) return true;
  return normalize(group.artist) === 'various artists';
}

type RankingContext = {
  artistAffinity: Map<string, number>;
  genreAffinity: Map<string, number>;
  releasePopularity: Map<string, ReleaseGroupPopularity>;
  artistPopularity: Map<string, ArtistPopularity>;
};

function candidateArtistAffinity(item: DiscoveryItem, context: RankingContext): number {
  const key = artistKey(item.artistId, item.artist);
  return Math.max(0, context.artistAffinity.get(key) ?? 0);
}

function candidateGenreAffinity(item: DiscoveryItem, context: RankingContext): number {
  if (!item.genre) return 0;
  return Math.max(0, context.genreAffinity.get(normalize(item.genre)) ?? 0);
}

function candidatePopularity(item: DiscoveryItem, context: RankingContext): number {
  const releaseStats = context.releasePopularity.get(item.id);
  const artistStats = item.artistId
    ? context.artistPopularity.get(item.artistId)
    : undefined;
  return (
    popularityScore({
      listenCount: releaseStats?.listenCount ?? 0,
      userCount: releaseStats?.userCount ?? 0,
    }) +
    0.65 * artistPopularityScore(artistStats)
  );
}

function freshnessScore(item: DiscoveryItem): number {
  if (!item.firstReleaseDate) return 0;
  const time = Date.parse(item.firstReleaseDate);
  if (!Number.isFinite(time)) return 0;
  const days = (time - Date.now()) / DAY_MS;
  if (days >= 0) return 1;
  return clamp(1 + days / 90, 0, 1);
}

function normalise(value: number, max: number): number {
  return max > 0 ? clamp(value / max, 0, 1) : 0;
}

function rankRecent(
  items: DiscoveryItem[],
  context: RankingContext,
  seed: string,
): ScoredItem[] {
  const base = items.map((item) => ({
    item,
    artistAffinity: candidateArtistAffinity(item, context),
    genreAffinity: candidateGenreAffinity(item, context),
    affinity: 0,
    popularity: candidatePopularity(item, context),
    freshness: freshnessScore(item),
    exploration: hashScore(seed, item.id),
    score: 0,
  }));
  const maxArtistAffinity = Math.max(0, ...base.map((entry) => entry.artistAffinity));
  const maxGenreAffinity = Math.max(0, ...base.map((entry) => entry.genreAffinity));
  const maxPopularity = Math.max(0, ...base.map((entry) => entry.popularity));
  for (const entry of base) {
    entry.affinity = Math.max(
      normalise(entry.artistAffinity, maxArtistAffinity),
      0.5 * normalise(entry.genreAffinity, maxGenreAffinity),
    );
    entry.score =
      0.5 * entry.affinity +
      0.25 * normalise(entry.popularity, maxPopularity) +
      0.15 * entry.freshness +
      0.1 * entry.exploration;
  }
  return base.sort((a, b) => b.score - a.score || byReleaseDate(a.item, b.item));
}

function rankCrate(
  items: DiscoveryItem[],
  context: RankingContext,
  seed: string,
): ScoredItem[] {
  const base = items.map((item) => ({
    item,
    artistAffinity: candidateArtistAffinity(item, context),
    genreAffinity: candidateGenreAffinity(item, context),
    affinity: 0,
    popularity: candidatePopularity(item, context),
    freshness: freshnessScore(item),
    exploration: hashScore(seed, item.id),
    score: 0,
  }));
  const maxArtistAffinity = Math.max(0, ...base.map((entry) => entry.artistAffinity));
  const maxGenreAffinity = Math.max(0, ...base.map((entry) => entry.genreAffinity));
  const maxPopularity = Math.max(0, ...base.map((entry) => entry.popularity));
  for (const entry of base) {
    entry.affinity = Math.max(
      normalise(entry.artistAffinity, maxArtistAffinity),
      0.5 * normalise(entry.genreAffinity, maxGenreAffinity),
    );
    entry.score =
      0.45 * entry.exploration +
      0.3 * entry.affinity +
      0.25 * normalise(entry.popularity, maxPopularity);
  }
  return base.sort((a, b) => b.score - a.score || byReleaseDate(a.item, b.item));
}

type DiversityOptions = {
  maxPerGenre?: number;
  maxPerEra?: number;
};

function selectDiverse(
  rows: ScoredItem[],
  limit: number,
  maxPerArtist: number,
  seen: Set<string>,
  blocked: Set<string>,
  options: DiversityOptions = {},
): DiscoveryItem[] {
  const picks: DiscoveryItem[] = [];
  const artistCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  const eraCounts = new Map<number, number>();
  const ordered = [
    ...rows.filter((row) => !seen.has(row.item.id)),
    ...rows.filter((row) => seen.has(row.item.id)),
  ];

  function pass(enforceGenre: boolean, enforceEra: boolean) {
    for (const row of ordered) {
      if (picks.length >= limit) break;
      const item = row.item;
      if (blocked.has(item.id) || picks.some((pick) => pick.id === item.id)) continue;
      const artistKeyValue = item.artistId ?? normalize(item.artist);
      if ((artistCounts.get(artistKeyValue) ?? 0) >= maxPerArtist) continue;
      const genre = item.genre ? normalize(item.genre) : null;
      if (
        enforceGenre &&
        genre &&
        options.maxPerGenre !== undefined &&
        (genreCounts.get(genre) ?? 0) >= options.maxPerGenre
      ) {
        continue;
      }
      const era = item.year ? Math.floor(item.year / 10) : null;
      if (
        enforceEra &&
        era !== null &&
        options.maxPerEra !== undefined &&
        (eraCounts.get(era) ?? 0) >= options.maxPerEra
      ) {
        continue;
      }
      artistCounts.set(artistKeyValue, (artistCounts.get(artistKeyValue) ?? 0) + 1);
      if (genre) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      if (era !== null) eraCounts.set(era, (eraCounts.get(era) ?? 0) + 1);
      picks.push(item);
    }
  }

  pass(true, true);
  pass(false, false);
  return picks;
}

function parseFeed(payload: string): DiscoveryFeed | null {
  try {
    return JSON.parse(payload) as DiscoveryFeed;
  } catch {
    return null;
  }
}

async function buildDiscoveryFeed(signal?: AbortSignal): Promise<DiscoveryFeed> {
  const snapshot = await getCollectionSnapshot();
  const expansion = await expandSimilarArtists(snapshot, signal);
  const sinceRadar = daysFromNow(-RADAR_WINDOW_DAYS);
  const sinceWeek = daysFromNow(-WEEK_WINDOW_DAYS);
  const sinceMonth = daysFromNow(-MONTH_WINDOW_DAYS);
  const until = daysFromNow(UPCOMING_WINDOW_DAYS);
  const monthKey = new Date().toISOString().slice(0, 7);
  const weekKey = isoDate(new Date());
  const seenCutoff = new Date(Date.now() - SEEN_TTL_MS);
  const eventCutoff = new Date(Date.now() - EVENT_WINDOW_DAYS * DAY_MS);

  const seenRows = await prisma.discoverySeen.findMany({
    where: { seenAt: { gt: seenCutoff } },
    select: { releaseGroupId: true },
  });
  const seen = new Set(seenRows.map((row) => row.releaseGroupId));

  let radarCandidates: DiscoveryItem[] = [];
  const radarArtistIds = snapshot.seedArtistIds;
  const orbitArtistIds = expansion.artistIds.filter(
    (id) => !snapshot.seedArtistIds.includes(id),
  );

  function radarReason(group: DiscoverReleaseGroup): string {
    const source = snapshot.artistSources.get(artistKey(group.artistId, group.artist));
    if (source === 'followed') return 'New from an artist you follow';
    if (source === 'owned') return 'New from an artist you own';
    if (source === 'wishlist') return 'New from an artist on your wishlist';
    if (source === 'saved') return 'New from an artist you saved';
    return 'New from an artist near your collection';
  }

  if (radarArtistIds.length > 0) {
    try {
      const groups = await searchReleaseGroupsByArtistIds(
        radarArtistIds,
        sinceRadar,
        until,
        100,
        signal,
      );
      radarCandidates = groups
        .filter(isAlbumOrEp)
        .filter((group) => !isVariousArtists(group))
        .filter((group) => !isOwnedRelease(group, snapshot))
        .map((group) => ({
          ...group,
          reason: radarReason(group),
          genre: null,
        }))
        .sort(byReleaseDate);
    } catch {
      radarCandidates = [];
    }
  }

  const weekCandidates: DiscoveryItem[] = [];
  const monthCandidates: DiscoveryItem[] = [];
  const crateCandidates: DiscoveryItem[] = [];
  const orbitCandidateIds = new Set<string>();

  function orbitReason(group: DiscoverReleaseGroup): string {
    const source = group.artistId ? expansion.sources.get(group.artistId) : undefined;
    if (!source) return 'From an artist near your collection';
    if (source.kind === 'followed') return `Because you follow ${source.name}`;
    if (source.kind === 'owned') return `Because you own ${source.name}`;
    if (source.kind === 'wishlist') {
      return `Because ${source.name} is on your wishlist`;
    }
    if (source.kind === 'saved') return `Because you saved ${source.name}`;
    return `Similar to ${source.name}`;
  }

  if (orbitArtistIds.length > 0) {
    try {
      const recent = await searchReleaseGroupsByArtistIds(
        orbitArtistIds,
        sinceRadar,
        until,
        100,
        signal,
      );
      for (const group of recent) {
        if (!isAlbumOrEp(group) || isVariousArtists(group)) continue;
        if (isOwnedRelease(group, snapshot)) continue;
        const date = group.firstReleaseDate ?? '';
        if (!date) continue;
        orbitCandidateIds.add(group.id);
        const item = {
          ...group,
          reason: orbitReason(group),
          genre: null,
        };
        if (date >= sinceWeek) weekCandidates.push(item);
        else monthCandidates.push(item);
      }

      const older = await searchReleaseGroupsByArtistIds(
        orbitArtistIds,
        CRATE_SINCE,
        sinceMonth,
        100,
        signal,
      );
      for (const group of older) {
        if (!isAlbumOrEp(group) || isVariousArtists(group)) continue;
        if (isOwnedRelease(group, snapshot)) continue;
        const date = group.firstReleaseDate ?? '';
        if (!date || date >= sinceMonth) continue;
        orbitCandidateIds.add(group.id);
        crateCandidates.push({
          ...group,
          reason: orbitReason(group),
          genre: null,
        });
      }
    } catch {
      // Similar-artist expansion is an enhancement; keep genre candidates on failure.
    }
  }

  for (const genre of snapshot.topGenres) {
    try {
      const recent = await searchNewReleaseGroupsByTag(
        genre,
        sinceMonth,
        until,
        100,
        signal,
      );
      for (const group of recent) {
        if (!isAlbumOrEp(group) || isVariousArtists(group)) continue;
        if (isOwnedRelease(group, snapshot) || isOwnedArtist(group, snapshot)) {
          continue;
        }
        const date = group.firstReleaseDate ?? '';
        if (!date) continue;
        const item = {
          ...group,
          reason: `Because you collect ${genre}`,
          genre,
        };
        if (date >= sinceWeek) weekCandidates.push(item);
        else monthCandidates.push(item);
      }

      const older = await searchNewReleaseGroupsByTag(
        genre,
        CRATE_SINCE,
        sinceMonth,
        100,
        signal,
      );
      for (const group of older) {
        if (!isAlbumOrEp(group) || isVariousArtists(group)) continue;
        if (isOwnedRelease(group, snapshot) || isOwnedArtist(group, snapshot)) {
          continue;
        }
        const date = group.firstReleaseDate ?? '';
        if (!date || date >= sinceMonth) continue;
        crateCandidates.push({
          ...group,
          reason: `Because you collect ${genre}`,
          genre,
        });
      }
    } catch {
      // A single genre failure should not blank the whole feed.
    }
  }

  const allCandidates = uniqueById([
    ...radarCandidates,
    ...weekCandidates,
    ...monthCandidates,
    ...crateCandidates,
  ]);
  const releasePopularity = await getReleaseGroupPopularity(
    allCandidates.map((item) => item.id),
    signal,
  );
  const artistPopularity = await getArtistPopularity(
    allCandidates.map((item) => item.artistId).filter((id): id is string => Boolean(id)),
    signal,
  );

  const context: RankingContext = {
    artistAffinity: snapshot.artistAffinity,
    genreAffinity: snapshot.genreAffinity,
    releasePopularity,
    artistPopularity,
  };

  const radar = selectDiverse(
    rankRecent(uniqueById(radarCandidates), context, weekKey),
    RADAR_LIMIT,
    2,
    seen,
    new Set(),
    { maxPerGenre: 3, maxPerEra: 4 },
  );
  const used = new Set(radar.map((item) => item.id));
  const week = selectDiverse(
    rankRecent(uniqueById(weekCandidates), context, weekKey),
    WEEK_LIMIT,
    2,
    seen,
    used,
    { maxPerGenre: 3, maxPerEra: 4 },
  );
  for (const item of week) used.add(item.id);
  const month = selectDiverse(
    rankRecent(uniqueById(monthCandidates), context, weekKey),
    MONTH_LIMIT,
    2,
    seen,
    used,
    { maxPerGenre: 3, maxPerEra: 4 },
  );
  for (const item of month) used.add(item.id);
  const crate = selectDiverse(
    rankCrate(uniqueById(crateCandidates), context, monthKey),
    CRATE_LIMIT,
    1,
    seen,
    used,
    { maxPerGenre: 3, maxPerEra: 3 },
  );

  const orbitFeatured =
    week.find((item) => orbitCandidateIds.has(item.id)) ??
    month.find((item) => orbitCandidateIds.has(item.id)) ??
    crate.find((item) => orbitCandidateIds.has(item.id)) ??
    null;
  const featured = radar[0] ?? orbitFeatured ?? week[0] ?? month[0] ?? crate[0] ?? null;
  const allSections: DiscoverySection[] = [
    {
      id: 'radar',
      kind: 'radar',
      title: 'From your artists',
      subtitle: 'Recent and upcoming albums from artists you own, want or follow',
      items: radar.filter((item) => item.id !== featured?.id),
    },
    {
      id: 'new-week',
      kind: 'new',
      title: 'New this week',
      subtitle: 'Fresh releases and announced albums',
      items: week.filter((item) => item.id !== featured?.id),
    },
    {
      id: 'new-month',
      kind: 'new',
      title: 'New this month',
      subtitle: 'Recent releases you may have missed',
      items: month.filter((item) => item.id !== featured?.id),
    },
    {
      id: 'crate',
      kind: 'crate',
      title: 'Lost in the Stacks',
      subtitle: 'Older albums from artists and genres you collect, rotated monthly',
      items: crate.filter((item) => item.id !== featured?.id),
    },
  ];
  const sections = allSections.filter((section) => section.items.length > 0);

  const feed: DiscoveryFeed = {
    version: DISCOVERY_VERSION,
    basedOn: snapshot.topGenres,
    featured,
    sections,
    generatedAt: new Date().toISOString(),
    nextRefreshAt: new Date(Date.now() + FEED_TTL_MS).toISOString(),
  };

  const returned = [featured, ...sections.flatMap((section) => section.items)].filter(
    (item): item is DiscoveryItem => Boolean(item),
  );

  await Promise.all(
    returned.map((item) =>
      prisma.discoverySeen.upsert({
        where: { releaseGroupId: item.id },
        create: { releaseGroupId: item.id, artistId: item.artistId },
        update: { artistId: item.artistId, seenAt: new Date() },
      }),
    ),
  );
  await prisma.discoverySeen.deleteMany({ where: { seenAt: { lt: seenCutoff } } });
  await prisma.discoveryEvent.deleteMany({ where: { createdAt: { lt: eventCutoff } } });

  return feed;
}

let rebuildPromise: Promise<DiscoveryFeed> | null = null;

async function rebuildFeed(signal?: AbortSignal): Promise<DiscoveryFeed> {
  if (rebuildPromise) return rebuildPromise;

  rebuildPromise = (async () => {
    const feed = await buildDiscoveryFeed(signal);

    if (feed.sections.length === 0) {
      const existing = await prisma.discoveryFeed.findUnique({
        where: { id: 'current' },
      });
      const cached = existing ? parseFeed(existing.payload) : null;
      if (cached) {
        await prisma.discoveryFeed
          .update({
            where: { id: 'current' },
            data: { expiresAt: new Date(Date.now() + FEED_TTL_MS) },
          })
          .catch(() => undefined);
        return cached;
      }
    }

    await prisma.discoveryFeed.upsert({
      where: { id: 'current' },
      create: {
        id: 'current',
        payload: JSON.stringify(feed),
        expiresAt: new Date(Date.now() + FEED_TTL_MS),
      },
      update: {
        payload: JSON.stringify(feed),
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + FEED_TTL_MS),
      },
    });

    return feed;
  })().finally(() => {
    rebuildPromise = null;
  });

  return rebuildPromise;
}

export async function recordDiscoveryEvent(input: DiscoveryEventInput): Promise<void> {
  await prisma.discoveryEvent
    .create({
      data: {
        releaseGroupId: input.releaseGroupId,
        artistId: input.artistId ?? null,
        artist: input.artist ?? null,
        action: input.action,
      },
    })
    .catch(() => undefined);
}

export async function removeOwnedReleaseFromDiscoveryFeed(
  title: string,
  artist: string,
): Promise<void> {
  const row = await prisma.discoveryFeed.findUnique({ where: { id: 'current' } });
  if (!row) return;
  const feed = parseFeed(row.payload);
  if (!feed) return;

  const key = releaseKey(artist, title);
  const isMatch = (item: DiscoveryItem) => releaseKey(item.artist, item.title) === key;

  let featured = feed.featured && isMatch(feed.featured) ? null : feed.featured;
  const sections = feed.sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !isMatch(item)),
    }))
    .filter((section) => section.items.length > 0);

  if (!featured && sections.length > 0) {
    const [first] = sections;
    featured = first.items[0] ?? null;
    sections[0] = { ...first, items: first.items.slice(1) };
  }

  const next: DiscoveryFeed = {
    ...feed,
    featured,
    sections: sections.filter((section) => section.items.length > 0),
  };
  if (JSON.stringify(next) === row.payload) return;

  await prisma.discoveryFeed
    .update({ where: { id: 'current' }, data: { payload: JSON.stringify(next) } })
    .catch(() => undefined);
}

export async function getDiscoveryFeed(
  refresh = false,
  signal?: AbortSignal,
): Promise<DiscoveryFeed> {
  const cachedRow = await prisma.discoveryFeed.findUnique({ where: { id: 'current' } });
  const cached = cachedRow ? parseFeed(cachedRow.payload) : null;
  const current = cached?.version === DISCOVERY_VERSION;

  if (!refresh && cached && current) {
    const generatedAt = new Date(cached.generatedAt).getTime();
    if (Number.isFinite(generatedAt)) {
      const expectedRefreshAt = new Date(generatedAt + FEED_TTL_MS);
      if (expectedRefreshAt.getTime() > Date.now()) {
        const normalized: DiscoveryFeed = {
          ...cached,
          nextRefreshAt: expectedRefreshAt.toISOString(),
        };
        if (
          cachedRow &&
          (cachedRow.expiresAt.getTime() < expectedRefreshAt.getTime() ||
            cached.nextRefreshAt !== normalized.nextRefreshAt)
        ) {
          await prisma.discoveryFeed
            .update({
              where: { id: 'current' },
              data: {
                payload: JSON.stringify(normalized),
                expiresAt: expectedRefreshAt,
              },
            })
            .catch(() => undefined);
        }
        return normalized;
      }
    }
    if (cachedRow && cachedRow.expiresAt.getTime() > Date.now()) return cached;
    void rebuildFeed().catch(() => undefined);
    return cached;
  }

  try {
    return await rebuildFeed(signal);
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}
