import { describe, expect, test } from 'bun:test';
import { EMPTY_FEED_TTL_MS, discoveryFeedTtlMs, type DiscoveryFeed } from './discovery';

describe('discoveryFeedTtlMs', () => {
  test('retries empty feeds quickly', () => {
    expect(discoveryFeedTtlMs({ featured: null, sections: [] })).toBe(EMPTY_FEED_TTL_MS);
  });

  test('keeps populated feeds on the weekly cadence', () => {
    const feed = {
      featured: {} as DiscoveryFeed['featured'],
      sections: [],
    };
    expect(discoveryFeedTtlMs(feed)).toBeGreaterThan(EMPTY_FEED_TTL_MS);
  });
});
