import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_LOCAL_SETTINGS,
  parseLocalSettings,
  type LocalSettings,
} from './settings';

describe('parseLocalSettings', () => {
  test('returns defaults for missing storage', () => {
    expect(parseLocalSettings(null)).toEqual(DEFAULT_LOCAL_SETTINGS);
  });

  test('accepts valid local settings', () => {
    const stored: LocalSettings = {
      theme: 'light',
      accent: 'sky',
      defaultView: 'list',
      defaultSort: 'rating',
    };
    expect(parseLocalSettings(JSON.stringify(stored))).toEqual(stored);
  });

  test('ignores old database-backed fields in the same payload', () => {
    expect(
      parseLocalSettings(
        JSON.stringify({
          theme: 'light',
          accent: 'coral',
          defaultView: 'list',
          defaultSort: 'title',
          defaultFormat: 'Vinyl',
          defaultCondition: 'Mint',
          defaultCurrency: 'USD',
        }),
      ),
    ).toEqual({
      theme: 'light',
      accent: 'coral',
      defaultView: 'list',
      defaultSort: 'title',
    });
  });

  test('falls back per invalid field', () => {
    expect(
      parseLocalSettings(
        JSON.stringify({
          theme: 'sepia',
          accent: 'purple',
          defaultView: 'table',
          defaultSort: 'random',
        }),
      ),
    ).toEqual(DEFAULT_LOCAL_SETTINGS);
  });

  test('returns defaults for malformed JSON', () => {
    expect(parseLocalSettings('{not-json')).toEqual(DEFAULT_LOCAL_SETTINGS);
  });
});
