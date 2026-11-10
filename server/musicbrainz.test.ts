import { describe, expect, test } from 'bun:test';
import { normalizeFormat, sortFormats } from './musicbrainz';

describe('normalizeFormat', () => {
  test('maps common media formats', () => {
    expect(normalizeFormat('CD')).toBe('CD');
    expect(normalizeFormat('12" Vinyl')).toBe('Vinyl');
    expect(normalizeFormat('Cassette')).toBe('Cassette');
    expect(normalizeFormat('Digital Media')).toBe('Digital');
    expect(normalizeFormat(undefined)).toBe('Other');
  });
});

describe('sortFormats', () => {
  test('orders formats consistently', () => {
    expect(sortFormats(['Other', 'Digital', 'CD', 'Vinyl'])).toEqual([
      'CD',
      'Vinyl',
      'Digital',
      'Other',
    ]);
  });
});
