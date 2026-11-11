import { describe, expect, test } from 'bun:test';
import { autoMapDiscogsColumns, transformDiscogsRows } from './discogs';

describe('autoMapDiscogsColumns', () => {
  test('maps common Discogs headers, BOM and spacing', () => {
    const mapping = autoMapDiscogsColumns([
      '\uFEFFRelease Title',
      'Artist Name',
      'Released',
      'Format',
      'Collection Media Condition',
      'My Rating',
      'Date Added',
      'Price',
      'Currency',
      'Cat#',
      'Notes',
    ]);

    expect(mapping).toEqual({
      title: '\uFEFFRelease Title',
      artist: 'Artist Name',
      released: 'Released',
      format: 'Format',
      condition: 'Collection Media Condition',
      rating: 'My Rating',
      purchaseDate: 'Date Added',
      purchasePrice: 'Price',
      purchaseCurrency: 'Currency',
      catalogNumber: 'Cat#',
      notes: 'Notes',
    });
  });
});

describe('transformDiscogsRows', () => {
  test('normalizes Discogs values', () => {
    const mapping = autoMapDiscogsColumns([
      'Release Title',
      'Artist Name',
      'Released',
      'Format',
      'Collection Media Condition',
      'My Rating',
      'Date Added',
      'Price',
      'Currency',
      'Cat#',
      'Notes',
    ]);
    const result = transformDiscogsRows(
      [
        {
          'Release Title': 'Album',
          'Artist Name': 'Artist',
          Released: '2021-05-07',
          Format: '12" Vinyl',
          'Collection Media Condition': 'VG+',
          'My Rating': '5',
          'Date Added': '09/11/2026',
          Price: '1.234,56',
          Currency: 'usd',
          'Cat#': 'CAT-1',
          Notes: '  note  ',
        },
      ],
      mapping,
      'EUR',
    );

    expect(result.total).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.releases[0]).toMatchObject({
      title: 'Album',
      artist: 'Artist',
      year: 2021,
      releaseDate: '2021-05-07',
      format: 'Vinyl',
      formatDetail: '12" Vinyl',
      condition: 'Very Good Plus',
      rating: 5,
      purchaseDate: '2026-11-09',
      purchasePrice: 1234.56,
      purchaseCurrency: 'USD',
      catalogNumber: 'CAT-1',
      notes: 'note',
      trackCount: 0,
    });
  });

  test('uses the default currency only when a price exists', () => {
    const mapping = autoMapDiscogsColumns(['Title', 'Artist', 'Price']);
    const result = transformDiscogsRows(
      [{ Title: 'No price', Artist: 'Artist', Price: '' }],
      mapping,
      'EUR',
    );
    expect(result.releases[0]?.purchasePrice).toBeNull();
    expect(result.releases[0]?.purchaseCurrency).toBeNull();
  });

  test('infers common formats and conditions', () => {
    const mapping = autoMapDiscogsColumns(['Title', 'Artist', 'Format', 'Condition']);
    const result = transformDiscogsRows(
      [
        { Title: 'CD', Artist: 'A', Format: 'CD, Album', Condition: 'NM' },
        { Title: 'Tape', Artist: 'B', Format: 'Cassette', Condition: 'VG' },
        { Title: 'File', Artist: 'C', Format: 'Digital Media', Condition: 'G+' },
        { Title: 'Unknown', Artist: 'D', Format: 'Box Set', Condition: 'unknown' },
      ],
      mapping,
      'EUR',
    );

    expect(result.releases.map((release) => release.format)).toEqual([
      'CD',
      'Cassette',
      'Digital',
      'Other',
    ]);
    expect(result.releases.map((release) => release.condition)).toEqual([
      'Near Mint',
      'Very Good',
      'Good',
      null,
    ]);
  });

  test('skips rows missing title or artist', () => {
    const mapping = autoMapDiscogsColumns(['Title', 'Artist']);
    const result = transformDiscogsRows(
      [
        { Title: 'No artist', Artist: '' },
        { Title: '', Artist: 'No title' },
        { Title: 'Valid', Artist: 'Artist' },
      ],
      mapping,
      'EUR',
    );
    expect(result.total).toBe(3);
    expect(result.skipped).toBe(2);
    expect(result.releases).toHaveLength(1);
  });

  test('parses year-only release dates', () => {
    const mapping = autoMapDiscogsColumns(['Title', 'Artist', 'Released']);
    const result = transformDiscogsRows(
      [{ Title: 'Album', Artist: 'Artist', Released: '1999' }],
      mapping,
      'EUR',
    );
    expect(result.releases[0]?.year).toBe(1999);
    expect(result.releases[0]?.releaseDate).toBeNull();
  });
});
