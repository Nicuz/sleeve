import { describe, expect, test } from 'bun:test';
import { normalizeFormat, preferPhysicalReleases, sortFormats } from './musicbrainz';

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

describe('preferPhysicalReleases', () => {
  test('drops digital releases when a physical edition exists', () => {
    const releases = [
      { id: 'digital', format: 'Digital' },
      { id: 'cd', format: 'CD' },
    ];
    expect(preferPhysicalReleases(releases)).toEqual([{ id: 'cd', format: 'CD' }]);
  });

  test('keeps digital releases when they are the only editions', () => {
    const releases = [
      { id: 'digital-a', format: 'Digital' },
      { id: 'digital-b', format: 'Digital' },
    ];
    expect(preferPhysicalReleases(releases)).toEqual(releases);
  });
});
