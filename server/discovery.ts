import { prisma } from './db';
import { getReleaseGroupPopularity, type ReleaseGroupPopularity } from './listenbrainz';
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
  basedOn: string[];
  featured: DiscoveryItem | null;
  sections: DiscoverySection[];
  generatedAt: string;
};

const VARIOUS_ARTISTS_ID = '89ad4ac3-39f7-470e-963a-56509c546377';
const FEED_TTL_MS = 12 * 60 * 60 * 1000;
const SEEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RADAR_WINDOW_DAYS = 30;
const WEEK_WINDOW_DAYS = 7;
const MONTH_WINDOW_DAYS = 30;
const CRATE_SINCE = '1950-01-01';
const UPCOMING_WINDOW_DAYS = 90;
const RADAR_LIMIT = 8;
const WEEK_LIMIT = 8;
const MONTH_LIMIT = 8;
const CRATE_LIMIT = 8;

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

function monthlyRotation(
  items: DiscoveryItem[],
  monthKey: string,
  popularity: Map<string, ReleaseGroupPopularity>,
): DiscoveryItem[] {
  function randomScore(id: string): number {
    let hash = 2166136261;
    for (const char of `${monthKey}:${id}`) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 0xffffffff;
  }
  const scored = items.map((item) => ({
    item,
    random: randomScore(item.id),
    popularity: popularityScore(item, popularity),
  }));
  const maxPopularity = Math.max(1, ...scored.map((entry) => entry.popularity));
  return scored
    .sort(
      (a, b) =>
        b.random * 0.72 +
        (b.popularity / maxPopularity) * 0.28 -
        (a.random * 0.72 + (a.popularity / maxPopularity) * 0.28),
    )
    .map((entry) => entry.item);
}

function popularityScore(
  item: DiscoveryItem,
  popularity: Map<string, ReleaseGroupPopularity>,
): number {
  const stats = popularity.get(item.id);
  if (stats) {
    return Math.log10(1 + stats.listenCount) + Math.log10(1 + stats.userCount) * 0.35;
  }
  return Math.log10(1 + item.releaseCount) * 1.5;
}

function sortByPopularity(
  items: DiscoveryItem[],
  popularity: Map<string, ReleaseGroupPopularity>,
): DiscoveryItem[] {
  return [...items].sort((a, b) => {
    const diff = popularityScore(b, popularity) - popularityScore(a, popularity);
    return diff || byReleaseDate(a, b);
  });
}

function selectDiverse(
  items: DiscoveryItem[],
  limit: number,
  maxPerArtist: number,
  seen: Set<string>,
  blocked: Set<string>,
): DiscoveryItem[] {
  const picks: DiscoveryItem[] = [];
  const artistCounts = new Map<string, number>();
  const ordered = [
    ...items.filter((item) => !seen.has(item.id)),
    ...items.filter((item) => seen.has(item.id)),
  ];

  for (const item of ordered) {
    if (picks.length >= limit) break;
    if (blocked.has(item.id) || picks.some((pick) => pick.id === item.id)) continue;
    const artistKey = item.artistId ?? normalize(item.artist);
    if ((artistCounts.get(artistKey) ?? 0) >= maxPerArtist) continue;
    artistCounts.set(artistKey, (artistCounts.get(artistKey) ?? 0) + 1);
    picks.push(item);
  }

  return picks;
}

type CollectionSnapshot = {
  topGenres: string[];
  topArtistIds: string[];
  ownedKeys: Set<string>;
  wishlistKeys: Set<string>;
  savedGroupIds: Set<string>;
  ownedArtistIds: Set<string>;
  ownedArtistNames: Set<string>;
};

async function getCollectionSnapshot(): Promise<CollectionSnapshot> {
  const [releases, wishlist, saved] = await Promise.all([
    prisma.release.findMany({
      select: { title: true, artist: true, artistId: true, genres: true },
    }),
    prisma.wishlistItem.findMany({ select: { title: true, artist: true } }),
    prisma.savedSuggestion.findMany({ select: { releaseGroupId: true } }),
  ]);

  const genreCounts = new Map<string, number>();
  const artistCounts = new Map<string, { id: string; count: number }>();
  const ownedKeys = new Set<string>();
  const ownedArtistIds = new Set<string>();
  const ownedArtistNames = new Set<string>();

  for (const release of releases) {
    ownedKeys.add(releaseKey(release.artist, release.title));
    ownedArtistNames.add(normalize(release.artist));
    if (release.artistId) {
      ownedArtistIds.add(release.artistId);
      const current = artistCounts.get(release.artistId);
      artistCounts.set(release.artistId, {
        id: release.artistId,
        count: (current?.count ?? 0) + 1,
      });
    }
    for (const genre of (release.genres ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }

  const wishlistKeys = new Set(
    wishlist.map((item) => releaseKey(item.artist, item.title)),
  );

  return {
    topGenres: [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([genre]) => genre),
    topArtistIds: [...artistCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map((artist) => artist.id),
    ownedKeys,
    wishlistKeys,
    savedGroupIds: new Set(saved.map((item) => item.releaseGroupId)),
    ownedArtistIds,
    ownedArtistNames,
  };
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

async function buildDiscoveryFeed(signal?: AbortSignal): Promise<DiscoveryFeed> {
  const snapshot = await getCollectionSnapshot();
  const sinceRadar = daysFromNow(-RADAR_WINDOW_DAYS);
  const sinceWeek = daysFromNow(-WEEK_WINDOW_DAYS);
  const sinceMonth = daysFromNow(-MONTH_WINDOW_DAYS);
  const until = daysFromNow(UPCOMING_WINDOW_DAYS);
  const monthKey = new Date().toISOString().slice(0, 7);
  const seenCutoff = new Date(Date.now() - SEEN_TTL_MS);

  const seenRows = await prisma.discoverySeen.findMany({
    where: { seenAt: { gt: seenCutoff } },
    select: { releaseGroupId: true },
  });
  const seen = new Set(seenRows.map((row) => row.releaseGroupId));

  let radarCandidates: DiscoveryItem[] = [];
  if (snapshot.topArtistIds.length > 0) {
    try {
      const groups = await searchReleaseGroupsByArtistIds(
        snapshot.topArtistIds,
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
          reason: 'New from an artist you own',
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
          reason: `Crate dig · ${genre}`,
          genre,
        });
      }
    } catch {
      // A single genre failure should not blank the whole feed.
    }
  }

  const popularity = await getReleaseGroupPopularity(
    uniqueById([
      ...radarCandidates,
      ...weekCandidates,
      ...monthCandidates,
      ...crateCandidates,
    ]).map((item) => item.id),
    signal,
  );

  const radar = selectDiverse(
    sortByPopularity(uniqueById(radarCandidates), popularity),
    RADAR_LIMIT,
    2,
    seen,
    new Set(),
  );
  const used = new Set(radar.map((item) => item.id));
  const week = selectDiverse(
    sortByPopularity(uniqueById(weekCandidates), popularity),
    WEEK_LIMIT,
    2,
    seen,
    used,
  );
  for (const item of week) used.add(item.id);
  const month = selectDiverse(
    sortByPopularity(uniqueById(monthCandidates), popularity),
    MONTH_LIMIT,
    2,
    seen,
    used,
  );
  for (const item of month) used.add(item.id);
  const crate = selectDiverse(
    monthlyRotation(uniqueById(crateCandidates), monthKey, popularity),
    CRATE_LIMIT,
    1,
    seen,
    used,
  );

  const featured = radar[0] ?? week[0] ?? month[0] ?? crate[0] ?? null;
  const allSections: DiscoverySection[] = [
    {
      id: 'radar',
      kind: 'radar',
      title: 'Release Radar',
      subtitle: 'New albums and EPs from artists you own',
      items: radar.filter((item) => item.id !== featured?.id),
    },
    {
      id: 'new-week',
      kind: 'new',
      title: 'New this week',
      subtitle: 'Albums and EPs released in the last 7 days',
      items: week.filter((item) => item.id !== featured?.id),
    },
    {
      id: 'new-month',
      kind: 'new',
      title: 'New this month',
      subtitle: 'Albums and EPs released 8–30 days ago',
      items: month.filter((item) => item.id !== featured?.id),
    },
    {
      id: 'crate',
      kind: 'crate',
      title: 'Crate dig',
      subtitle: 'A monthly rotation from your collection’s orbit',
      items: crate.filter((item) => item.id !== featured?.id),
    },
  ];
  const sections = allSections.filter((section) => section.items.length > 0);

  const feed: DiscoveryFeed = {
    basedOn: snapshot.topGenres,
    featured,
    sections,
    generatedAt: new Date().toISOString(),
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

  return feed;
}

function parseFeed(payload: string): DiscoveryFeed | null {
  try {
    return JSON.parse(payload) as DiscoveryFeed;
  } catch {
    return null;
  }
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

export async function invalidateDiscoveryFeed(): Promise<void> {
  await prisma.discoveryFeed
    .updateMany({ data: { expiresAt: new Date(0) } })
    .catch(() => undefined);
}

export async function getDiscoveryFeed(
  refresh = false,
  signal?: AbortSignal,
): Promise<DiscoveryFeed> {
  const cachedRow = await prisma.discoveryFeed.findUnique({ where: { id: 'current' } });
  const cached = cachedRow ? parseFeed(cachedRow.payload) : null;

  if (!refresh && cached) {
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
