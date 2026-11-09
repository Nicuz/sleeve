import { Elysia } from 'elysia';
import { prisma } from '../db';

type ReleaseRow = {
  artist: string;
  artistId: string | null;
  format: string;
  year: number | null;
  genres: string | null;
  trackCount: number | null;
  musicbrainzId: string | null;
  coverUrl: string | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
};

type SpendRow = {
  id: string;
  title: string;
  artist: string;
  format: string;
  purchaseDate: string | null;
  purchasePrice: number | null;
  purchaseCurrency: string | null;
  purchaseLocation: string | null;
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

function currencyOf(row: SpendRow): string {
  return (row.purchaseCurrency || 'EUR').toUpperCase();
}

type StatsRange = 'all' | 'year' | '12m';

function parseRange(value: unknown): StatsRange {
  return value === 'year' || value === '12m' ? value : 'all';
}

function rangeStart(range: StatsRange): Date | null {
  if (range === 'all') return null;
  const now = new Date();
  if (range === 'year') {
    return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
}

export const statsRoutes = new Elysia({ prefix: '/api/stats' })
  .get('/', async ({ query }) => {
    const range = parseRange(query.range);
    const start = rangeStart(range);
    const [releases, recent] = await Promise.all([
      prisma.release.findMany({
        where: start ? { createdAt: { gte: start } } : undefined,
        select: {
          artist: true,
          artistId: true,
          format: true,
          year: true,
          genres: true,
          trackCount: true,
          musicbrainzId: true,
          coverUrl: true,
          purchasePrice: true,
          purchaseDate: true,
        },
      }),
      prisma.release.findMany({
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
    ]);

    const rows = releases as ReleaseRow[];
    const formatMap = countMap(rows.map((row) => row.format || 'Other'));
    const artistMap = new Map<
      string,
      { artist: string; artistId: string | null; count: number }
    >();
    for (const row of rows) {
      const key = row.artistId ?? `name:${row.artist}`;
      const current = artistMap.get(key) ?? {
        artist: row.artist,
        artistId: row.artistId,
        count: 0,
      };
      if (!current.artistId && row.artistId) current.artistId = row.artistId;
      current.count += 1;
      artistMap.set(key, current);
    }
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

    const sortedArtists = [...artistMap.values()].sort(
      (a, b) => b.count - a.count || a.artist.localeCompare(b.artist),
    );

    return {
      total: rows.length,
      totalTracks: rows.reduce((sum, row) => sum + (row.trackCount ?? 0), 0),
      totalArtists: artistMap.size,
      totalGenres: genreMap.size,
      missingMetadata: rows.filter(
        (row) => !row.musicbrainzId || !row.coverUrl || !row.trackCount,
      ).length,
      missingGenre: rows.filter((row) => !row.genres?.trim()).length,
      missingPurchaseInfo: rows.filter(
        (row) => row.purchasePrice === null || !row.purchaseDate,
      ).length,
      byFormat,
      byDecade,
      topArtists: sortedArtists.slice(0, 6).map((item) => ({
        artist: item.artist,
        artistId: item.artistId,
        count: item.count,
      })),
      topGenres: ranked(genreMap, 12).map((item) => ({
        genre: item.name,
        count: item.count,
      })),
      recentlyAdded: recent,
    };
  })
  .get('/spending', async ({ query }) => {
    const range = parseRange(query.range);
    const start = rangeStart(range);
    const cutoff = start ? start.toISOString().slice(0, 10) : null;
    const rows = (
      await prisma.release.findMany({
        select: {
          id: true,
          title: true,
          artist: true,
          format: true,
          purchaseDate: true,
          purchasePrice: true,
          purchaseCurrency: true,
          purchaseLocation: true,
        },
      })
    ).filter(
      (row) => !cutoff || (row.purchaseDate && row.purchaseDate >= cutoff),
    ) as SpendRow[];

    const priced = rows.filter((row) => row.purchasePrice !== null);
    const currencyMap = new Map<string, { count: number; total: number }>();
    for (const row of priced) {
      const code = currencyOf(row);
      const current = currencyMap.get(code) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += row.purchasePrice ?? 0;
      currencyMap.set(code, current);
    }
    const currencies = [...currencyMap.entries()]
      .map(([currency, value]) => ({ currency, ...value }))
      .sort((a, b) => b.count - a.count || b.total - a.total);

    const requested =
      typeof query.currency === 'string' ? query.currency.toUpperCase() : '';
    const fallbackCurrency = requested || 'EUR';
    const currency =
      requested && currencyMap.has(requested)
        ? requested
        : (currencies[0]?.currency ?? fallbackCurrency);

    const selected = priced.filter((row) => currencyOf(row) === currency);
    const prices = selected.map((row) => row.purchasePrice ?? 0);
    const totalSpent = prices.reduce((sum, price) => sum + price, 0);
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const middle = Math.floor(sortedPrices.length / 2);
    const medianPrice = sortedPrices.length
      ? sortedPrices.length % 2 === 1
        ? sortedPrices[middle]
        : (sortedPrices[middle - 1] + sortedPrices[middle]) / 2
      : null;

    const currentYear = new Date().getFullYear();
    const spentThisYear = selected
      .filter((row) => row.purchaseDate?.startsWith(String(currentYear)))
      .reduce((sum, row) => sum + (row.purchasePrice ?? 0), 0);

    const firstPurchaseYear =
      selected
        .map((row) => row.purchaseDate?.slice(0, 4))
        .filter((year): year is string => Boolean(year))
        .map(Number)
        .sort((a, b) => a - b)[0] ?? null;

    const months: Array<{
      key: string;
      label: string;
      amount: number;
      count: number;
    }> = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date(Date.UTC(currentYear, new Date().getMonth() - offset, 1));
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      months.push({
        key: `${year}-${String(month + 1).padStart(2, '0')}`,
        label: date.toLocaleString('en-US', {
          month: 'short',
          timeZone: 'UTC',
        }),
        amount: 0,
        count: 0,
      });
    }
    const monthMap = new Map(months.map((month) => [month.key, month]));
    for (const row of selected) {
      if (!row.purchaseDate) continue;
      const month = monthMap.get(row.purchaseDate.slice(0, 7));
      if (!month) continue;
      month.amount += row.purchasePrice ?? 0;
      month.count += 1;
    }

    const formatMap = new Map<string, { amount: number; count: number }>();
    for (const row of selected) {
      const current = formatMap.get(row.format) ?? { amount: 0, count: 0 };
      current.amount += row.purchasePrice ?? 0;
      current.count += 1;
      formatMap.set(row.format, current);
    }
    const byFormat = [...formatMap.entries()]
      .map(([format, value]) => ({ format, ...value }))
      .sort((a, b) => b.amount - a.amount);

    const shopMap = new Map<string, { amount: number; count: number }>();
    for (const row of selected) {
      const location = row.purchaseLocation?.trim();
      if (!location) continue;
      const current = shopMap.get(location) ?? { amount: 0, count: 0 };
      current.amount += row.purchasePrice ?? 0;
      current.count += 1;
      shopMap.set(location, current);
    }
    const topShops = [...shopMap.entries()]
      .map(([location, value]) => ({ location, ...value }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    const mostExpensive = [...selected].sort(
      (a, b) => (b.purchasePrice ?? 0) - (a.purchasePrice ?? 0),
    )[0];

    return {
      currency,
      currencies,
      totalSpent,
      releasesWithPrice: selected.length,
      averagePrice: selected.length ? totalSpent / selected.length : null,
      medianPrice,
      spentThisYear,
      currentYear,
      firstPurchaseYear,
      monthly: months,
      byFormat,
      topShops,
      mostExpensive: mostExpensive
        ? {
            id: mostExpensive.id,
            title: mostExpensive.title,
            artist: mostExpensive.artist,
            price: mostExpensive.purchasePrice ?? 0,
            currency: currencyOf(mostExpensive),
            purchaseDate: mostExpensive.purchaseDate,
          }
        : null,
      missingPurchaseInfo: rows.filter(
        (row) => row.purchasePrice === null || row.purchaseDate === null,
      ).length,
    };
  });
