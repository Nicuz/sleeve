import { Elysia } from 'elysia';
import type { Prisma } from '@prisma/client';
import { parseSearchQuery } from '../../shared/search-query';
import { prisma } from '../db';
import { searchReleaseIds } from '../search-index';
import { releaseWhereFromQuery, wishlistWhereFromQuery } from '../search-query';

const SEARCH_SCOPES = ['all', 'library', 'wishlist', 'artists'] as const;
type SearchScope = (typeof SEARCH_SCOPES)[number];

type SearchRelease = {
  id: string;
  title: string;
  artist: string;
  artistId: string | null;
  year: number | null;
  format: string;
  coverUrl: string | null;
  track: string | null;
};

type ReleaseRow = {
  id: string;
  title: string;
  artist: string;
  artistId: string | null;
  year: number | null;
  format: string;
  coverUrl: string | null;
  label: string | null;
  catalogNumber: string | null;
  genres: string | null;
  tracks: { title: string }[];
};

function score(value: string | null | undefined, query: string) {
  const text = (value ?? '').toLowerCase();
  if (!text) return 0;
  if (text === query) return 100;
  if (text.startsWith(query)) return 70;
  if (text.includes(query)) return 45;
  return 0;
}

function releaseScore(
  release: {
    title: string;
    artist: string;
    label: string | null;
    catalogNumber: string | null;
    genres: string | null;
    tracks: { title: string }[];
  },
  query: string,
) {
  if (!query) return 0;
  return Math.max(
    score(release.title, query) + 10,
    score(release.artist, query),
    score(release.label, query),
    score(release.catalogNumber, query),
    score(release.genres, query),
    release.tracks.length > 0 ? 30 : 0,
  );
}

function matchesDirectly(release: { title: string; artist: string }, query: string) {
  if (!query) return false;
  return score(release.title, query) > 0 || score(release.artist, query) > 0;
}

function releaseSelect(trackTerm: string | null) {
  return {
    id: true,
    title: true,
    artist: true,
    artistId: true,
    year: true,
    format: true,
    coverUrl: true,
    label: true,
    catalogNumber: true,
    genres: true,
    tracks: trackTerm
      ? {
          where: { title: { contains: trackTerm } },
          select: { title: true },
          take: 1,
        }
      : { select: { title: true }, take: 0 },
  } satisfies Prisma.ReleaseSelect;
}

export const searchRoutes = new Elysia({ prefix: '/api/search' }).get(
  '/',
  async ({ query }) => {
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    const requested = Number.parseInt(
      typeof query.limit === 'string' ? query.limit : '6',
      10,
    );
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 12) : 6;
    const rawScope = typeof query.scope === 'string' ? query.scope : 'all';
    const scope: SearchScope = SEARCH_SCOPES.includes(rawScope as SearchScope)
      ? (rawScope as SearchScope)
      : 'all';
    const parsed = parseSearchQuery(q);
    const hasQuery = Boolean(parsed.text) || Object.keys(parsed.filters).length > 0;

    if (!q || !hasQuery) {
      return {
        query: '',
        scope,
        parsed,
        releases: { items: [], total: 0 },
        artists: { items: [], total: 0 },
        wishlist: { items: [], total: 0 },
      };
    }

    const includeReleases = scope === 'all' || scope === 'library';
    const includeArtists = scope === 'all' || scope === 'artists';
    const includeWishlist = scope === 'all' || scope === 'wishlist';
    const normalised = parsed.text.toLowerCase();
    const trackTerm = parsed.filters.track ?? parsed.text;

    let releases: SearchRelease[] = [];
    let releaseTotal = 0;
    let artistItems: Array<{ name: string; artistId: string | null; count: number }> = [];
    let artistTotal = 0;
    let wishlist: Array<{
      id: string;
      title: string;
      artist: string;
      artistId: string | null;
      year: number | null;
      format: string;
      coverUrl: string | null;
      musicbrainzId: string | null;
      releaseGroupId: string | null;
      releaseDate: string | null;
      country: string | null;
      label: string | null;
      catalogNumber: string | null;
      barcode: string | null;
      formatDetail: string | null;
      notes: string | null;
    }> = [];
    let wishlistTotal = 0;

    const releaseWhere = releaseWhereFromQuery(parsed);

    if (includeReleases) {
      const select = releaseSelect(trackTerm);
      releaseTotal = await prisma.release.count({ where: releaseWhere });

      let rows: ReleaseRow[] = [];
      const ftsIds =
        parsed.text.length >= 3 ? await searchReleaseIds(parsed.text, 120) : null;

      if (ftsIds && ftsIds.length > 0) {
        const operatorWhere = releaseWhereFromQuery(parsed, { includeText: false });
        const where: Prisma.ReleaseWhereInput = operatorWhere
          ? { AND: [operatorWhere, { id: { in: ftsIds } }] }
          : { id: { in: ftsIds } };
        const matched = await prisma.release.findMany({
          where,
          select,
        });
        const order = new Map(ftsIds.map((id, index) => [id, index]));
        matched.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        rows = matched;
      } else {
        rows = await prisma.release.findMany({
          where: releaseWhere,
          take: 120,
          select,
        });
      }

      releases = rows
        .sort(
          (a, b) =>
            releaseScore(b, normalised) - releaseScore(a, normalised) ||
            a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
        )
        .slice(0, limit)
        .map((release) => ({
          id: release.id,
          title: release.title,
          artist: release.artist,
          artistId: release.artistId,
          year: release.year,
          format: release.format,
          coverUrl: release.coverUrl,
          track:
            trackTerm &&
            (parsed.filters.track || !matchesDirectly(release, normalised)) &&
            release.tracks.length > 0
              ? release.tracks[0].title
              : null,
        }));
    }

    if (includeArtists) {
      const artistTerm =
        parsed.filters.artist ??
        parsed.filters.title ??
        parsed.filters.track ??
        parsed.text;
      if (artistTerm) {
        const artistRows = await prisma.release.findMany({
          where: { artist: { contains: artistTerm } },
          select: { artist: true, artistId: true },
        });
        const artistMap = new Map<
          string,
          { name: string; artistId: string | null; count: number }
        >();
        for (const row of artistRows) {
          const key = row.artistId ?? `name:${row.artist.toLowerCase()}`;
          const entry = artistMap.get(key);
          if (entry) entry.count += 1;
          else artistMap.set(key, { name: row.artist, artistId: row.artistId, count: 1 });
        }
        artistTotal = artistMap.size;
        artistItems = [...artistMap.values()]
          .sort(
            (a, b) =>
              score(b.name, artistTerm.toLowerCase()) -
                score(a.name, artistTerm.toLowerCase()) ||
              b.count - a.count ||
              a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
          )
          .slice(0, limit);
      }
    }

    if (includeWishlist) {
      const wishlistWhere = wishlistWhereFromQuery(parsed);
      wishlistTotal = await prisma.wishlistItem.count({ where: wishlistWhere });
      const wishlistRows = await prisma.wishlistItem.findMany({
        where: wishlistWhere,
        take: 40,
        select: {
          id: true,
          title: true,
          artist: true,
          artistId: true,
          year: true,
          format: true,
          coverUrl: true,
          musicbrainzId: true,
          releaseGroupId: true,
          releaseDate: true,
          country: true,
          label: true,
          catalogNumber: true,
          barcode: true,
          formatDetail: true,
          notes: true,
        },
      });
      wishlist = wishlistRows
        .sort(
          (a, b) =>
            Math.max(
              score(b.title, normalised) + 10,
              score(b.artist, normalised),
              score(b.label, normalised),
              score(b.catalogNumber, normalised),
            ) -
              Math.max(
                score(a.title, normalised) + 10,
                score(a.artist, normalised),
                score(a.label, normalised),
                score(a.catalogNumber, normalised),
              ) || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
        )
        .slice(0, limit);
    }

    return {
      query: q,
      scope,
      parsed,
      releases: { items: releases, total: releaseTotal },
      artists: { items: artistItems, total: artistTotal },
      wishlist: { items: wishlist, total: wishlistTotal },
    };
  },
);
