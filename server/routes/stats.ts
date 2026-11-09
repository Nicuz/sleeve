import { Elysia } from 'elysia';
import { prisma } from '../db';

type ReleaseRow = {
  artist: string;
  format: string;
  year: number | null;
  genres: string | null;
  trackCount: number | null;
};

function countMap(rows: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row, (map.get(row) ?? 0) + 1);
  return map;
}

function ranked(map: Map<string, number>, limit?: number) {
  const list = [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return limit ? list.slice(0, limit) : list;
}

export const statsRoutes = new Elysia({ prefix: '/api/stats' }).get('/', async () => {
  const [releases, recent] = await Promise.all([
    prisma.release.findMany({
      select: {
        artist: true,
        format: true,
        year: true,
        genres: true,
        trackCount: true,
      },
    }),
    prisma.release.findMany({
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
  ]);

  const rows = releases as ReleaseRow[];
  const formatMap = countMap(rows.map((row) => row.format || 'Other'));
  const artistMap = countMap(rows.map((row) => row.artist));
  const genreMap = new Map<string, number>();
  for (const row of rows) {
    for (const genre of (row.genres ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)) {
      genreMap.set(genre, (genreMap.get(genre) ?? 0) + 1);
    }
  }

  const decadeMap = new Map<number, number>();
  for (const row of rows) {
    if (!row.year) continue;
    const decade = Math.floor(row.year / 10) * 10;
    decadeMap.set(decade, (decadeMap.get(decade) ?? 0) + 1);
  }

  const byFormat = ranked(formatMap).map((item) => ({
    format: item.name,
    count: item.count,
  }));
  const byDecade = [...decadeMap.entries()]
    .map(([decade, count]) => ({ decade: `${decade}s`, value: decade, count }))
    .sort((a, b) => a.value - b.value);

  return {
    total: rows.length,
    totalTracks: rows.reduce((sum, row) => sum + (row.trackCount ?? 0), 0),
    totalArtists: artistMap.size,
    totalGenres: genreMap.size,
    byFormat,
    byDecade,
    topArtists: ranked(artistMap, 6).map((item) => ({
      artist: item.name,
      count: item.count,
    })),
    topGenres: ranked(genreMap, 12).map((item) => ({
      genre: item.name,
      count: item.count,
    })),
    recentlyAdded: recent,
  };
});
