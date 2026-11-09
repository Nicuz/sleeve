import { Elysia } from 'elysia';
import { prisma } from '../db';

const CSV_HEADERS = [
  'release_id',
  'musicbrainz_id',
  'title',
  'artist',
  'artist_id',
  'year',
  'release_date',
  'country',
  'label',
  'catalog_number',
  'barcode',
  'format',
  'format_detail',
  'condition',
  'rating',
  'purchase_date',
  'purchase_location',
  'purchase_price',
  'purchase_currency',
  'genres',
  'notes',
  'track_count',
  'created_at',
  'disc',
  'track_number',
  'track_title',
  'track_duration_seconds',
  'track_artist',
];

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(
  releases: Awaited<ReturnType<typeof loadReleases>>,
): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const release of releases) {
    const base = [
      release.id,
      release.musicbrainzId,
      release.title,
      release.artist,
      release.artistId,
      release.year,
      release.releaseDate,
      release.country,
      release.label,
      release.catalogNumber,
      release.barcode,
      release.format,
      release.formatDetail,
      release.condition,
      release.rating,
      release.purchaseDate,
      release.purchaseLocation,
      release.purchasePrice,
      release.purchaseCurrency,
      release.genres,
      release.notes,
      release.trackCount,
      release.createdAt.toISOString(),
    ];
    if (release.tracks.length === 0) {
      lines.push(
        [...base, '', '', '', '', ''].map(escapeCsv).join(','),
      );
      continue;
    }
    for (const track of release.tracks) {
      lines.push(
        [
          ...base,
          track.disc,
          track.number,
          track.title,
          track.duration,
          track.artist,
        ]
          .map(escapeCsv)
          .join(','),
      );
    }
  }
  return lines.join('\r\n');
}

function loadReleases() {
  return prisma.release.findMany({
    include: {
      tracks: {
        orderBy: [{ disc: 'asc' }, { number: 'asc' }, { position: 'asc' }],
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export const exportRoutes = new Elysia().get('/api/export', async ({ query, set }) => {
  const format = query.format === 'csv' ? 'csv' : 'json';
  const releases = await loadReleases();
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    set.headers['content-type'] = 'text/csv; charset=utf-8';
    set.headers['content-disposition'] =
      `attachment; filename="sleeve-library-${stamp}.csv"`;
    return toCsv(releases);
  }

  set.headers['content-type'] = 'application/json; charset=utf-8';
  set.headers['content-disposition'] =
    `attachment; filename="sleeve-library-${stamp}.json"`;
  return JSON.stringify(
    {
      app: 'sleeve',
      version: 1,
      exportedAt: new Date().toISOString(),
      releases,
    },
    null,
    2,
  );
});
