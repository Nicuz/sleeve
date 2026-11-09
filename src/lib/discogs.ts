import type { ReleasePayload } from './types';
import { parsePriceInput } from './utils';

export type DiscogsFieldKey =
  | 'title'
  | 'artist'
  | 'released'
  | 'format'
  | 'label'
  | 'catalogNumber'
  | 'barcode'
  | 'country'
  | 'condition'
  | 'notes'
  | 'rating'
  | 'purchaseDate'
  | 'purchaseLocation'
  | 'purchasePrice'
  | 'purchaseCurrency';

export type DiscogsField = {
  key: DiscogsFieldKey;
  label: string;
  hint: string;
  required?: boolean;
  synonyms: string[];
};

export const DISCOGS_FIELDS: DiscogsField[] = [
  {
    key: 'title',
    label: 'Title',
    hint: 'Album or release title',
    required: true,
    synonyms: ['title', 'release title', 'album'],
  },
  {
    key: 'artist',
    label: 'Artist',
    hint: 'Main artist',
    required: true,
    synonyms: ['artist', 'artist name', 'artists'],
  },
  {
    key: 'released',
    label: 'Year / release date',
    hint: 'Used for year and release date',
    synonyms: ['released', 'release date', 'year', 'release year'],
  },
  {
    key: 'format',
    label: 'Format',
    hint: 'Vinyl, CD, cassette…',
    synonyms: ['format', 'formats', 'media type'],
  },
  {
    key: 'label',
    label: 'Label',
    hint: 'Record label',
    synonyms: ['label', 'record label', 'labels'],
  },
  {
    key: 'catalogNumber',
    label: 'Catalog number',
    hint: 'Catalog / catno',
    synonyms: ['catalog#', 'catalog number', 'catalog no', 'catno', 'cat#', 'catalog'],
  },
  {
    key: 'barcode',
    label: 'Barcode',
    hint: 'Barcode, UPC or EAN',
    synonyms: ['barcode', 'upc', 'ean'],
  },
  {
    key: 'country',
    label: 'Country',
    hint: 'Release country',
    synonyms: ['country', 'release country'],
  },
  {
    key: 'condition',
    label: 'Condition',
    hint: 'Media condition',
    synonyms: [
      'collection media condition',
      'media condition',
      'condition',
      'sleeve condition',
    ],
  },
  {
    key: 'notes',
    label: 'Notes',
    hint: 'Personal notes',
    synonyms: ['collection notes', 'notes'],
  },
  {
    key: 'rating',
    label: 'Rating',
    hint: '1–5 stars',
    synonyms: ['rating', 'my rating'],
  },
  {
    key: 'purchaseDate',
    label: 'Purchase date',
    hint: 'Date added or bought',
    synonyms: ['date added', 'purchase date', 'added'],
  },
  {
    key: 'purchaseLocation',
    label: 'Purchase location',
    hint: 'Shop or place',
    synonyms: ['location', 'shop', 'store', 'purchase location'],
  },
  {
    key: 'purchasePrice',
    label: 'Purchase price',
    hint: 'Price paid',
    synonyms: ['price', 'purchase price', 'value'],
  },
  {
    key: 'purchaseCurrency',
    label: 'Currency',
    hint: 'Currency code',
    synonyms: ['currency'],
  },
];

export type DiscogsMapping = Partial<Record<DiscogsFieldKey, string>>;

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function autoMapDiscogsColumns(
  headers: string[],
): DiscogsMapping {
  const byNormalized = new Map(
    headers.map((header) => [normalizeHeader(header), header]),
  );
  const mapping: DiscogsMapping = {};
  for (const field of DISCOGS_FIELDS) {
    for (const synonym of field.synonyms) {
      const column = byNormalized.get(normalizeHeader(synonym));
      if (column) {
        mapping[field.key] = column;
        break;
      }
    }
  }
  return mapping;
}

function valueOf(
  row: Record<string, string>,
  mapping: DiscogsMapping,
  key: DiscogsFieldKey,
): string {
  const column = mapping[key];
  if (!column) return '';
  return (row[column] ?? '').trim();
}

function nullable(value: string): string | null {
  const clean = value.trim();
  return clean || null;
}

function inferFormat(raw: string): string {
  if (!raw) return 'Other';
  if (/cd/i.test(raw)) return 'CD';
  if (/vinyl|12"|10"|7"|\blp\b/i.test(raw)) return 'Vinyl';
  if (/cassette|tape/i.test(raw)) return 'Cassette';
  if (/digital|file/i.test(raw)) return 'Digital';
  return 'Other';
}

function normalizeCondition(raw: string): string | null {
  if (!raw) return null;
  const value = raw.toLowerCase();
  if (/near mint|\bnm\b/.test(value)) return 'Near Mint';
  if (/mint|\bm\b/.test(value)) return 'Mint';
  if (/very good plus|\bvg\+/.test(value)) return 'Very Good Plus';
  if (/very good|\bvg\b/.test(value)) return 'Very Good';
  if (/good plus|\bg\+/.test(value)) return 'Good';
  if (/good|\bg\b/.test(value)) return 'Good';
  if (/fair|\bf\b/.test(value)) return 'Fair';
  if (/poor|\bp\b/.test(value)) return 'Poor';
  return null;
}

function parseYear(raw: string): number | null {
  const match = raw.match(/\b(18|19|20)\d{2}\b/);
  if (!match) return null;
  const year = Number.parseInt(match[0], 10);
  return Number.isFinite(year) ? year : null;
}

function parseReleaseDate(raw: string): string | null {
  const match = raw.match(/^\d{4}(-\d{2}){1,2}/);
  return match ? match[0] : null;
}

function parseRating(raw: string): number | null {
  const rating = Number.parseInt(raw, 10);
  return Number.isFinite(rating) && rating >= 1 && rating <= 5
    ? rating
    : null;
}

function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const dmy = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

export function transformDiscogsRows(
  rows: Array<Record<string, string>>,
  mapping: DiscogsMapping,
  defaultCurrency: string,
): { releases: ReleasePayload[]; skipped: number; total: number } {
  const releases: ReleasePayload[] = [];
  let skipped = 0;

  for (const row of rows) {
    const title = valueOf(row, mapping, 'title');
    const artist = valueOf(row, mapping, 'artist');
    if (!title || !artist) {
      skipped += 1;
      continue;
    }

    const released = valueOf(row, mapping, 'released');
    const rawFormat = valueOf(row, mapping, 'format');
    const rawPrice = valueOf(row, mapping, 'purchasePrice');
    const price = parsePriceInput(rawPrice);
    const rawCurrency = valueOf(row, mapping, 'purchaseCurrency');
    const currency = rawCurrency
      ? rawCurrency.toUpperCase()
      : defaultCurrency;

    releases.push({
      title,
      artist,
      year: parseYear(released),
      releaseDate: parseReleaseDate(released),
      format: inferFormat(rawFormat),
      formatDetail: nullable(rawFormat),
      label: nullable(valueOf(row, mapping, 'label')),
      catalogNumber: nullable(valueOf(row, mapping, 'catalogNumber')),
      barcode: nullable(valueOf(row, mapping, 'barcode')),
      country: nullable(valueOf(row, mapping, 'country')),
      condition: normalizeCondition(valueOf(row, mapping, 'condition')),
      notes: nullable(valueOf(row, mapping, 'notes')),
      rating: parseRating(valueOf(row, mapping, 'rating')),
      purchaseDate: normalizeDate(valueOf(row, mapping, 'purchaseDate')),
      purchaseLocation: nullable(valueOf(row, mapping, 'purchaseLocation')),
      purchasePrice: price,
      purchaseCurrency: price === null ? null : currency,
      trackCount: 0,
    });
  }

  return { releases, skipped, total: rows.length };
}
