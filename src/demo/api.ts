import { parseSearchQuery, type ParsedSearchQuery } from '../../shared/search-query';
import type {
  AppSettings,
  ArtistReleaseGroup,
  DiscoverResponse,
  EnrichResult,
  Meta,
  Release,
  SpendingStats,
  Stats,
  StatsRange,
} from '@/lib/types';
import {
  buildArtistDetail,
  buildArtistSearchResults,
  buildDiscoverSections,
  buildSearchResults,
  createDemoState,
} from './data';

type DemoState = ReturnType<typeof createDemoState>;

const state: DemoState = createDemoState();
const searchResults = buildSearchResults();
const artistResults = buildArtistSearchResults();
const discover = buildDiscoverSections();

const READ_ONLY_MESSAGE = 'Demo mode: data changes are disabled.';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fail(message: string, status = 400): Response {
  return json({ message }, status);
}

function withoutTracks(release: Release): Release {
  const { tracks: _tracks, ...rest } = release;
  return rest;
}

function inRange(release: Release, range: StatsRange): boolean {
  if (range === 'all') return true;
  const created = new Date(release.createdAt);
  const now = new Date();
  if (range === 'year') return created.getUTCFullYear() === now.getUTCFullYear();
  return now.getTime() - created.getTime() <= 365 * 24 * 60 * 60 * 1000;
}

function matchesQuery(release: Release, query: string): boolean {
  const value = query.toLowerCase();
  return (
    release.title.toLowerCase().includes(value) ||
    release.artist.toLowerCase().includes(value)
  );
}

function filterReleases(url: URL): Release[] {
  const params = url.searchParams;
  const query = params.get('q')?.trim() ?? '';
  const format = params.get('format');
  const genre = params.get('genre');
  const decade = params.get('decade');
  const missing = params.get('missing');
  const sort = params.get('sort') ?? 'recent';

  let releases = state.releases.filter((release) => {
    if (query && !matchesQuery(release, query)) return false;
    if (format && format !== 'All' && release.format !== format) return false;
    if (genre && genre !== 'All' && !(release.genres ?? '').includes(genre)) {
      return false;
    }
    if (decade && decade !== 'All') {
      if (!release.year || String(Math.floor(release.year / 10) * 10) !== decade) {
        return false;
      }
    }
    if (missing === 'genre' && release.genres) return false;
    if (missing === 'purchase' && release.purchaseDate && release.purchasePrice != null) {
      return false;
    }
    if (
      missing === 'metadata' &&
      release.musicbrainzId &&
      release.coverUrl &&
      release.trackCount
    ) {
      return false;
    }
    return true;
  });

  releases = [...releases].sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'artist') return a.artist.localeCompare(b.artist);
    if (sort === 'year') return (b.year ?? 0) - (a.year ?? 0);
    return b.createdAt.localeCompare(a.createdAt);
  });

  return releases;
}

function computeStats(range: StatsRange): Stats {
  const releases = state.releases.filter((release) => inRange(release, range));
  const formats = new Map<string, number>();
  const decades = new Map<number, number>();
  const artists = new Map<string, number>();
  const genres = new Map<string, number>();

  let totalTracks = 0;
  let missingMetadata = 0;
  let missingGenre = 0;
  let missingPurchaseInfo = 0;

  for (const release of releases) {
    formats.set(release.format, (formats.get(release.format) ?? 0) + 1);
    if (release.year) {
      const decade = Math.floor(release.year / 10) * 10;
      decades.set(decade, (decades.get(decade) ?? 0) + 1);
    }
    artists.set(release.artist, (artists.get(release.artist) ?? 0) + 1);
    totalTracks += release.trackCount ?? release.tracks?.length ?? 0;
    if (!release.musicbrainzId || !release.coverUrl || !release.trackCount) {
      missingMetadata += 1;
    }
    if (!release.genres) missingGenre += 1;
    if (!release.purchaseDate || release.purchasePrice == null) missingPurchaseInfo += 1;
    for (const genre of (release.genres ?? '').split(',')) {
      const clean = genre.trim();
      if (clean) genres.set(clean, (genres.get(clean) ?? 0) + 1);
    }
  }

  const topArtists = [...artists.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([artist, count]) => ({ artist, count }));

  const topGenres = [...genres.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([genre, count]) => ({ genre, count }));

  return {
    total: releases.length,
    missingMetadata,
    missingGenre,
    missingPurchaseInfo,
    totalTracks,
    totalArtists: artists.size,
    totalGenres: genres.size,
    delta: null,
    byFormat: [...formats.entries()]
      .map(([format, count]) => ({ format, count }))
      .sort((a, b) => b.count - a.count),
    byDecade: [...decades.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([value, count]) => ({ decade: `${value}s`, value, count })),
    topArtists,
    topGenres,
    recentlyAdded: [...releases]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map(withoutTracks),
  };
}

function computeSpending(range: StatsRange, currency?: string | null): SpendingStats {
  const releases = state.releases.filter(
    (release) => inRange(release, range) && release.purchasePrice != null,
  );
  const currencyTotals = new Map<string, { count: number; total: number }>();
  for (const release of releases) {
    const code = release.purchaseCurrency ?? state.settings.defaultCurrency;
    const entry = currencyTotals.get(code) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += release.purchasePrice ?? 0;
    currencyTotals.set(code, entry);
  }

  const currencies = [...currencyTotals.entries()]
    .map(([code, entry]) => ({
      currency: code,
      count: entry.count,
      total: Math.round(entry.total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total);

  const activeCurrency =
    currency ?? currencies[0]?.currency ?? state.settings.defaultCurrency;
  const priced = releases
    .filter(
      (release) =>
        (release.purchaseCurrency ?? state.settings.defaultCurrency) === activeCurrency,
    )
    .sort((a, b) => (b.purchasePrice ?? 0) - (a.purchasePrice ?? 0));

  const amounts = priced.map((release) => release.purchasePrice ?? 0);
  const totalSpent = amounts.reduce((sum, amount) => sum + amount, 0);
  const sorted = [...amounts].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length === 0
      ? null
      : sorted.length % 2 === 0
        ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
        : (sorted[middle] ?? 0);

  const currentYear = new Date().getUTCFullYear();
  const monthly = Array.from({ length: 12 }, (_, month) => {
    const items = priced.filter((release) => {
      if (!release.purchaseDate) return false;
      const date = new Date(`${release.purchaseDate}T00:00:00Z`);
      return date.getUTCFullYear() === currentYear && date.getUTCMonth() === month;
    });
    return {
      key: `${currentYear}-${String(month + 1).padStart(2, '0')}`,
      label: new Date(Date.UTC(currentYear, month, 1)).toLocaleString('en', {
        month: 'short',
        timeZone: 'UTC',
      }),
      amount:
        Math.round(
          items.reduce((sum, release) => sum + (release.purchasePrice ?? 0), 0) * 100,
        ) / 100,
      count: items.length,
    };
  });

  const formatTotals = new Map<string, { amount: number; count: number }>();
  const shopTotals = new Map<string, { amount: number; count: number }>();
  const days = new Map<string, number>();
  for (const release of priced) {
    const price = release.purchasePrice ?? 0;
    const format = formatTotals.get(release.format) ?? { amount: 0, count: 0 };
    format.amount += price;
    format.count += 1;
    formatTotals.set(release.format, format);
    if (release.purchaseLocation) {
      const shop = shopTotals.get(release.purchaseLocation) ?? { amount: 0, count: 0 };
      shop.amount += price;
      shop.count += 1;
      shopTotals.set(release.purchaseLocation, shop);
    }
    if (release.purchaseDate) {
      days.set(release.purchaseDate, (days.get(release.purchaseDate) ?? 0) + 1);
    }
  }

  const top = priced[0];

  return {
    currency: activeCurrency,
    currencies,
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalSpentDelta: null,
    releasesWithPrice: priced.length,
    averagePrice:
      priced.length === 0 ? null : Math.round((totalSpent / priced.length) * 100) / 100,
    medianPrice: median == null ? null : Math.round(median * 100) / 100,
    spentThisYear:
      Math.round(
        priced
          .filter((release) => release.purchaseDate?.startsWith(String(currentYear)))
          .reduce((sum, release) => sum + (release.purchasePrice ?? 0), 0) * 100,
      ) / 100,
    currentYear,
    firstPurchaseYear: priced.length
      ? Math.min(
          ...priced
            .map((release) => Number(release.purchaseDate?.slice(0, 4)))
            .filter((year) => Number.isFinite(year)),
        )
      : null,
    monthly,
    byFormat: [...formatTotals.entries()]
      .map(([format, entry]) => ({
        format,
        amount: Math.round(entry.amount * 100) / 100,
        count: entry.count,
      }))
      .sort((a, b) => b.amount - a.amount),
    topShops: [...shopTotals.entries()]
      .map(([location, entry]) => ({
        location,
        amount: Math.round(entry.amount * 100) / 100,
        count: entry.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6),
    mostExpensive: top
      ? {
          id: top.id,
          title: top.title,
          artist: top.artist,
          price: top.purchasePrice ?? 0,
          currency: top.purchaseCurrency ?? activeCurrency,
          purchaseDate: top.purchaseDate,
        }
      : null,
    missingPurchaseInfo: state.releases.filter(
      (release) => !release.purchaseDate || release.purchasePrice == null,
    ).length,
    purchaseDays: [...days.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function meta(): Meta {
  const genres = new Set<string>();
  const decades = new Set<number>();
  for (const release of state.releases) {
    if (release.year) decades.add(Math.floor(release.year / 10) * 10);
    for (const genre of (release.genres ?? '').split(',')) {
      const clean = genre.trim();
      if (clean) genres.add(clean);
    }
  }
  return {
    formats: ['CD', 'Vinyl', 'Cassette'],
    genres: [...genres].sort((a, b) => a.localeCompare(b)),
    decades: [...decades].sort((a, b) => a - b),
  };
}

function globalSearch(url: URL) {
  const query = url.searchParams.get('q') ?? '';
  const scope = (url.searchParams.get('scope') ?? 'all') as
    | 'all'
    | 'library'
    | 'wishlist'
    | 'artists';
  const limit = Number(url.searchParams.get('limit') ?? 6);
  const parsed: ParsedSearchQuery = parseSearchQuery(query);

  const releases = state.releases.filter(
    (release) =>
      !query ||
      matchesQuery(release, query) ||
      (release.genres ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (release.label ?? '').toLowerCase().includes(query.toLowerCase()),
  );
  const artists = new Map<string, number>();
  for (const release of releases) {
    artists.set(release.artist, (artists.get(release.artist) ?? 0) + 1);
  }
  const wishlist = state.wishlist.filter(
    (item) =>
      !query ||
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.artist.toLowerCase().includes(query.toLowerCase()),
  );

  const releaseItems = scope === 'wishlist' || scope === 'artists' ? [] : releases;
  const artistItems =
    scope === 'wishlist' || scope === 'library' ? [] : [...artists.entries()];
  const wishlistItems = scope === 'library' || scope === 'artists' ? [] : wishlist;

  return {
    query,
    scope,
    parsed,
    releases: {
      total: releaseItems.length,
      items: releaseItems.slice(0, limit).map((release) => ({
        id: release.id,
        title: release.title,
        artist: release.artist,
        artistId: release.artistId,
        year: release.year,
        format: release.format,
        coverUrl: release.coverUrl,
        track: null,
      })),
    },
    artists: {
      total: artistItems.length,
      items: artistItems
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, count]) => ({
          name,
          artistId:
            state.releases.find((release) => release.artist === name)?.artistId ?? null,
          count,
        })),
    },
    wishlist: {
      total: wishlistItems.length,
      items: wishlistItems.slice(0, limit).map((item) => ({
        id: item.id,
        title: item.title,
        artist: item.artist,
        artistId: item.artistId,
        year: item.year,
        format: item.format,
        coverUrl: item.coverUrl,
        musicbrainzId: item.musicbrainzId,
        releaseGroupId: item.releaseGroupId,
        releaseDate: item.releaseDate,
        country: item.country,
        label: item.label,
        catalogNumber: item.catalogNumber,
        barcode: item.barcode,
        formatDetail: item.formatDetail,
        notes: item.notes,
      })),
    },
  };
}

function discoverResponse(): DiscoverResponse {
  const generatedAt = new Date();
  return {
    version: 4,
    basedOn: [...new Set(state.releases.map((release) => release.artist))].slice(0, 5),
    featured: discover.featured,
    sections: discover.sections,
    generatedAt: generatedAt.toISOString(),
    nextRefreshAt: new Date(generatedAt.getTime() + 7 * 86400000).toISOString(),
  };
}

function releaseGroups(artistId: string, offset: number, limit: number) {
  const detail = buildArtistDetail(artistId);
  const groups: ArtistReleaseGroup[] = detail.releaseGroups;
  return {
    groups: groups.slice(offset, offset + limit),
    total: groups.length,
  };
}

function musicbrainzRelease(mbid: string) {
  const result =
    searchResults.find((item) => item.musicbrainzId === mbid) ?? searchResults[0];
  return {
    release: {
      ...result,
      status: 'Official',
      packaging: 'Jewel Case',
      genres: ['Rock', 'Alternative Rock'],
      tracks: Array.from({ length: 10 }, (_, index) => ({
        position: index + 1,
        disc: 1,
        number: index + 1,
        title: `${result.title} — Track ${index + 1}`,
        duration: 180 + ((index * 11) % 90),
        artist: result.artist,
      })),
    },
  };
}

export async function handleDemoRequest(url: URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const path = url.pathname;
  const body = () => {
    try {
      return JSON.parse(String(init?.body ?? '{}'));
    } catch {
      return {};
    }
  };

  await new Promise((resolve) => setTimeout(resolve, 70));

  if (method === 'GET' && path === '/api/releases') {
    const releases = filterReleases(url);
    return json({ releases: releases.map(withoutTracks), count: releases.length });
  }

  if (method === 'POST' && path === '/api/releases') return fail(READ_ONLY_MESSAGE, 403);
  if (method === 'DELETE' && path === '/api/releases') {
    return fail('Demo mode: clearing the library is disabled.', 403);
  }

  if (method === 'GET' && path === '/api/releases/random') {
    const release = state.releases[Math.floor(Math.random() * state.releases.length)];
    return json({ release: release ? withoutTracks(release) : null });
  }

  if (method === 'GET' && path === '/api/releases/owned') {
    const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
    return json({
      releases: state.releases
        .filter((release) => release.musicbrainzId && ids.includes(release.musicbrainzId))
        .map((release) => ({
          id: release.id,
          musicbrainzId: release.musicbrainzId as string,
        })),
    });
  }

  const releaseRoute =
    /^\/api\/releases\/([^/]+)(?:\/(enrich|refresh|apply-match))?$/.exec(path);
  if (releaseRoute) {
    const [, id, action] = releaseRoute;
    const release = state.releases.find((item) => item.id === id);
    if (!release) return fail('Release not found', 404);

    if (!action && method === 'GET') return json({ release });
    if (!action && (method === 'PATCH' || method === 'DELETE')) {
      return fail(READ_ONLY_MESSAGE, 403);
    }
    if (action === 'refresh' && method === 'POST') return json({ release });
    if (action === 'enrich' && method === 'POST') {
      return json({ status: 'unmatched' } satisfies EnrichResult);
    }
    if (action === 'apply-match' && method === 'POST') {
      return fail('Demo mode: metadata matching is disabled.', 403);
    }
  }

  if (method === 'GET' && path === '/api/wishlist') {
    return json({ items: state.wishlist, count: state.wishlist.length });
  }
  if (method === 'POST' && path === '/api/wishlist') {
    return fail(READ_ONLY_MESSAGE, 403);
  }

  const wishlistRoute = /^\/api\/wishlist\/([^/]+)$/.exec(path);
  if (wishlistRoute && (method === 'PATCH' || method === 'DELETE')) {
    return fail(READ_ONLY_MESSAGE, 403);
  }

  if (method === 'GET' && path === '/api/saved') {
    return json({ items: state.saved, count: state.saved.length });
  }
  if (method === 'POST' && path === '/api/saved') {
    return fail(READ_ONLY_MESSAGE, 403);
  }

  const savedRoute = /^\/api\/saved\/([^/]+)(?:\/(promote))?$/.exec(path);
  if (savedRoute && method === 'POST') {
    return fail(READ_ONLY_MESSAGE, 403);
  }
  if (savedRoute && method === 'DELETE') {
    return fail(READ_ONLY_MESSAGE, 403);
  }

  if (method === 'GET' && path === '/api/artists/follows') {
    return json({ items: state.follows, count: state.follows.length });
  }

  const followRoute = /^\/api\/artists\/([^/]+)\/follow$/.exec(path);
  if (followRoute && method !== 'GET') return fail(READ_ONLY_MESSAGE, 403);

  if (method === 'GET' && path === '/api/settings') {
    return json({ settings: state.settings });
  }
  if (method === 'PATCH' && path === '/api/settings') {
    state.settings = { ...state.settings, ...(body() as Partial<AppSettings>) };
    return json({ settings: state.settings });
  }

  if (method === 'GET' && path === '/api/discover') {
    return json(discoverResponse());
  }
  if (method === 'POST' && path === '/api/discover/events') {
    return json({ ok: true });
  }

  if (method === 'GET' && path === '/api/stats/spending') {
    return json(
      computeSpending(
        (url.searchParams.get('range') as StatsRange | null) ?? 'all',
        url.searchParams.get('currency'),
      ),
    );
  }
  if (method === 'GET' && path === '/api/stats') {
    return json(computeStats((url.searchParams.get('range') as StatsRange) ?? 'all'));
  }

  if (method === 'GET' && path === '/api/meta') return json(meta());

  if (method === 'GET' && path === '/api/search') return json(globalSearch(url));

  if (method === 'GET' && path === '/api/musicbrainz/search') {
    const query = (url.searchParams.get('q') ?? '').toLowerCase();
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const results = searchResults.filter(
      (item) =>
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.artist.toLowerCase().includes(query),
    );
    return json({ results: results.slice(0, limit), count: results.length });
  }
  if (method === 'GET' && path.startsWith('/api/musicbrainz/barcode/')) {
    return json({ results: searchResults.slice(0, 1), count: 1 });
  }
  if (method === 'GET' && path.startsWith('/api/musicbrainz/releases/')) {
    return json(musicbrainzRelease(decodeURIComponent(path.split('/').pop() ?? '')));
  }
  if (method === 'GET' && path === '/api/musicbrainz/artists') {
    return json({ results: artistResults, count: artistResults.length });
  }
  if (
    method === 'GET' &&
    /^\/api\/musicbrainz\/artists\/[^/]+\/release-groups$/.test(path)
  ) {
    const id = decodeURIComponent(path.split('/')[5] ?? '');
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 100);
    return json(releaseGroups(id, offset, limit));
  }
  if (method === 'GET' && /^\/api\/musicbrainz\/artists\/[^/]+$/.test(path)) {
    const id = decodeURIComponent(path.split('/').pop() ?? '');
    return json({ artist: buildArtistDetail(id) });
  }

  if (method === 'GET' && path === '/api/metadata/cache') {
    return json({ count: 0, oldest: null, newest: null });
  }
  if (method === 'DELETE' && path === '/api/metadata/cache') {
    return json({ ok: true, deleted: 0 });
  }
  if (method === 'GET' && path === '/api/covers/cache') {
    return json({ count: 0, bytes: 0 });
  }
  if (method === 'DELETE' && path === '/api/covers/cache') {
    return json({ ok: true, deleted: 0 });
  }

  if (method === 'GET' && path === '/api/export') {
    return json({
      app: 'sleeve',
      version: 1,
      exportedAt: new Date().toISOString(),
      releases: state.releases,
      wishlist: state.wishlist,
      saved: state.saved,
      follows: state.follows,
      settings: state.settings,
    });
  }

  if (path === '/api/import/preview') {
    return fail('Demo mode: import is disabled.', 403);
  }
  if (path === '/api/import') {
    return fail('Demo mode: import is disabled.', 403);
  }

  return fail(`Demo mode: no mock for ${method} ${path}`, 404);
}

export function installDemoApi(): void {
  const originalFetch = window.fetch.bind(window);
  const demoFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(
      raw,
      /^https?:/.test(window.location.href) ? window.location.href : 'http://localhost/',
    );
    if (!url.pathname.startsWith('/api/')) {
      return originalFetch(input, init);
    }
    return handleDemoRequest(url, init);
  };
  window.fetch = Object.assign(demoFetch, {
    preconnect: originalFetch.preconnect,
  });
  globalThis.fetch = window.fetch;
}
