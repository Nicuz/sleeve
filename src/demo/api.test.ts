import { describe, expect, test } from 'bun:test';
import { handleDemoRequest } from './api';

function get(path: string): Promise<Response> {
  return handleDemoRequest(new URL(path, 'http://demo.local'));
}

describe('demo api', () => {
  test('lists releases with filters', async () => {
    const response = await get('/api/releases?format=Vinyl&sort=title');
    const data = (await response.json()) as {
      releases: Array<{ title: string; format: string }>;
      count: number;
    };

    expect(response.status).toBe(200);
    expect(data.count).toBeGreaterThan(0);
    expect(data.releases.every((release) => release.format === 'Vinyl')).toBe(true);
    expect(data.releases.map((release) => release.title)).toEqual(
      [...data.releases.map((release) => release.title)].sort(),
    );
  });

  test('uses only CD, Vinyl and Cassette in a single currency', async () => {
    const releases = (await (await get('/api/releases')).json()) as {
      releases: Array<{ format: string; coverUrl: string | null }>;
    };
    const wishlist = (await (await get('/api/wishlist')).json()) as {
      items: Array<{ format: string; targetCurrency: string | null }>;
    };

    const formats = new Set([
      ...releases.releases.map((release) => release.format),
      ...wishlist.items.map((item) => item.format),
    ]);
    expect([...formats].sort()).toEqual(['CD', 'Cassette', 'Vinyl']);
    expect(releases.releases.every((release) => release.coverUrl)).toBe(true);
    expect(wishlist.items.every((item) => item.targetCurrency === 'EUR')).toBe(true);
  });

  test('returns stats and spending for the chosen range', async () => {
    const stats = (await (await get('/api/stats')).json()) as {
      total: number;
      totalTracks: number;
      byFormat: unknown[];
    };
    const spending = (await (await get('/api/stats/spending?currency=EUR')).json()) as {
      currency: string;
      monthly: unknown[];
    };

    expect(stats.total).toBeGreaterThan(0);
    expect(stats.totalTracks).toBeGreaterThan(0);
    expect(stats.byFormat.length).toBeGreaterThan(0);
    expect(spending.currency).toBe('EUR');
    expect(spending.monthly).toHaveLength(12);
  });

  test('serves discover, search and artist pages', async () => {
    const discover = (await (await get('/api/discover')).json()) as {
      sections: unknown[];
      featured: unknown;
    };
    const search = (await (await get('/api/search?q=miles')).json()) as {
      releases: { total: number };
      parsed: { text: string };
    };
    const artist = (await (
      await get('/api/musicbrainz/artists/561d854a-6a28-4aa7-8c99-323e6ce46c2a')
    ).json()) as { artist: { releaseGroups: unknown[] } };

    expect(discover.sections).toHaveLength(3);
    expect(discover.featured).toBeTruthy();
    expect(search.parsed.text).toBe('miles');
    expect(search.releases.total).toBeGreaterThan(0);
    expect(artist.artist.releaseGroups.length).toBeGreaterThan(0);
  });

  test('rejects writes', async () => {
    const response = await handleDemoRequest(
      new URL('/api/releases', 'http://demo.local'),
      {
        method: 'POST',
        body: JSON.stringify({ title: 'Nope', artist: 'Nope', format: 'CD' }),
      },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      message: expect.stringContaining('Demo'),
    });
  });
});
