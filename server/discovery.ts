import { prisma } from './db';
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

const FEED_TTL_MS = 6 * 60 * 60 * 1000;
const SEEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RADAR_WINDOW_DAYS = 60;
const NEW_WINDOW_DAYS = 30;
const CRATE_WINDOW_DAYS = 730;
const UPCOMING_WINDOW_DAYS = 90;
const RADAR_LIMIT = 8;
const NEW_LIMIT = 8;
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

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
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

async function buildDiscoveryFeed(signal?: AbortSignal): Promise<DiscoveryFeed> {
  const snapshot = await getCollectionSnapshot();
  const sinceRadar = daysFromNow(-RADAR_WINDOW_DAYS);
  const sinceNew = daysFromNow(-NEW_WINDOW_DAYS);
  const sinceCrate = daysFromNow(-CRATE_WINDOW_DAYS);
  const until = daysFromNow(UPCOMING_WINDOW_DAYS);
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

  const newCandidates: DiscoveryItem[] = [];
  const crateCandidates: DiscoveryItem[] = [];

  for (const genre of snapshot.topGenres) {
    try {
      const groups = await searchNewReleaseGroupsByTag(
        genre,
        sinceCrate,
        until,
        100,
        signal,
      );
      for (const group of groups) {
        if (!isAlbumOrEp(group)) continue;
        if (isOwnedRelease(group, snapshot) || isOwnedArtist(group, snapshot)) {
          continue;
        }
        const date = group.firstReleaseDate ?? '';
        const item = {
          ...group,
          reason:
            date >= sinceNew ? `Because you collect ${genre}` : `Crate dig · ${genre}`,
          genre,
        };
        if (date >= sinceNew) newCandidates.push(item);
        else crateCandidates.push(item);
      }
    } catch {
      // A single genre failure should not blank the whole feed.
    }
  }

  const radar = selectDiverse(
    uniqueById(radarCandidates).sort(byReleaseDate),
    RADAR_LIMIT,
    2,
    seen,
    new Set(),
  );
  const used = new Set(radar.map((item) => item.id));
  const fresh = selectDiverse(
    uniqueById(newCandidates).sort(byReleaseDate),
    NEW_LIMIT,
    2,
    seen,
    used,
  );
  for (const item of fresh) used.add(item.id);
  const crate = selectDiverse(
    shuffled(uniqueById(crateCandidates)),
    CRATE_LIMIT,
    1,
    seen,
    used,
  );

  const featured = radar[0] ?? fresh[0] ?? crate[0] ?? null;
  const allSections: DiscoverySection[] = [
    {
      id: 'radar',
      kind: 'radar',
      title: 'Release Radar',
      subtitle: 'New releases from artists you own',
      items: radar.filter((item) => item.id !== featured?.id),
    },
    {
      id: 'new',
      kind: 'new',
      title: 'New this week',
      subtitle: 'Fresh albums across your top genres',
      items: fresh.filter((item) => item.id !== featured?.id),
    },
    {
      id: 'crate',
      kind: 'crate',
      title: 'Crate dig',
      subtitle: 'A random pull from your collection’s orbit',
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

export async function getDiscoveryFeed(
  refresh = false,
  signal?: AbortSignal,
): Promise<DiscoveryFeed> {
  const cached = await prisma.discoveryFeed.findUnique({ where: { id: 'current' } });
  if (!refresh && cached && cached.expiresAt.getTime() > Date.now()) {
    try {
      return JSON.parse(cached.payload) as DiscoveryFeed;
    } catch {
      // Ignore corrupt cache and regenerate.
    }
  }

  let feed: DiscoveryFeed;
  try {
    feed = await buildDiscoveryFeed(signal);
  } catch (error) {
    if (cached) {
      try {
        return JSON.parse(cached.payload) as DiscoveryFeed;
      } catch {
        // Fall through to the original error.
      }
    }
    throw error;
  }

  if (feed.sections.length === 0 && cached) {
    try {
      return JSON.parse(cached.payload) as DiscoveryFeed;
    } catch {
      // No usable cache; return the empty feed.
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
}
