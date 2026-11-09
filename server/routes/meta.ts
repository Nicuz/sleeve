import { Elysia } from 'elysia';
import { prisma } from '../db';

const FORMATS = ['CD', 'Vinyl', 'Cassette', 'Digital', 'Other'];

export const metaRoutes = new Elysia({ prefix: '/api/meta' }).get('/', async () => {
  const releases = await prisma.release.findMany({
    select: { format: true, genres: true, year: true },
  });

  const formats = new Set<string>();
  const genreCounts = new Map<string, number>();
  const decades = new Set<number>();

  for (const release of releases) {
    if (release.format) formats.add(release.format);
    if (release.year) decades.add(Math.floor(release.year / 10) * 10);
    for (const genre of (release.genres ?? '').split(',')) {
      const clean = genre.trim();
      if (clean) genreCounts.set(clean, (genreCounts.get(clean) ?? 0) + 1);
    }
  }

  const genres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 30)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));

  return {
    formats: [...FORMATS, ...[...formats].filter((f) => !FORMATS.includes(f))],
    genres,
    decades: [...decades].sort((a, b) => a - b),
  };
});
