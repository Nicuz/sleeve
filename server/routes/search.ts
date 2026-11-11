import { Elysia } from 'elysia';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';

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
  return score(release.title, query) > 0 || score(release.artist, query) > 0;
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

    if (!q) {
      return {
        query: '',
        releases: { items: [], total: 0 },
        artists: { items: [], total: 0 },
        wishlist: { items: [], total: 0 },
      };
    }

    const normalised = q.toLowerCase();

    const releaseWhere: Prisma.ReleaseWhereInput = {
      OR: [
        { title: { contains: q } },
        { artist: { contains: q } },
        { label: { contains: q } },
        { catalogNumber: { contains: q } },
        { genres: { contains: q } },
        { tracks: { some: { title: { contains: q } } } },
      ],
    };

    const wishlistWhere: Prisma.WishlistItemWhereInput = {
      OR: [
        { title: { contains: q } },
        { artist: { contains: q } },
        { label: { contains: q } },
        { catalogNumber: { contains: q } },
      ],
    };

    const [releaseRows, releaseTotal, artistRows, wishlistRows, wishlistTotal] =
      await Promise.all([
        prisma.release.findMany({
          where: releaseWhere,
          take: 120,
          select: {
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
            tracks: {
              where: { title: { contains: q } },
              select: { title: true },
              take: 1,
            },
          },
        }),
        prisma.release.count({ where: releaseWhere }),
        prisma.release.findMany({
          where: { artist: { contains: q } },
          select: { artist: true, artistId: true },
        }),
        prisma.wishlistItem.findMany({
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
            label: true,
            catalogNumber: true,
          },
        }),
        prisma.wishlistItem.count({ where: wishlistWhere }),
      ]);

    const releases: SearchRelease[] = releaseRows
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
          !matchesDirectly(release, normalised) && release.tracks.length > 0
            ? release.tracks[0].title
            : null,
      }));

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
    const artists = [...artistMap.values()]
      .sort(
        (a, b) =>
          score(b.name, normalised) - score(a.name, normalised) ||
          b.count - a.count ||
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      )
      .slice(0, limit);

    const wishlist = wishlistRows
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
      .slice(0, limit)
      .map((item) => ({
        id: item.id,
        title: item.title,
        artist: item.artist,
        artistId: item.artistId,
        year: item.year,
        format: item.format,
        coverUrl: item.coverUrl,
      }));

    return {
      query: q,
      releases: { items: releases, total: releaseTotal },
      artists: { items: artists, total: artistMap.size },
      wishlist: { items: wishlist, total: wishlistTotal },
    };
  },
);
