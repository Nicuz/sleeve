import { Elysia } from 'elysia';
import {
  getRelease,
  searchByBarcode,
  searchReleases,
} from '../musicbrainz';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'MusicBrainz lookup failed';
}

export const musicbrainzRoutes = new Elysia({ prefix: '/api/musicbrainz' })
  .get('/search', async ({ query, set }) => {
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    if (!q) {
      set.status = 400;
      return { message: 'Search query is required' };
    }
    const limit = Math.min(
      30,
      Math.max(1, Number(query.limit ?? 20) || 20),
    );
    try {
      const results = await searchReleases(q, limit);
      return { results, count: results.length };
    } catch (error) {
      set.status = 502;
      return { message: message(error) };
    }
  })
  .get('/barcode/:code', async ({ params, set }) => {
    try {
      const results = await searchByBarcode(params.code);
      return { results, count: results.length };
    } catch (error) {
      set.status = 502;
      return { message: message(error) };
    }
  })
  .get('/releases/:mbid', async ({ params, set }) => {
    try {
      const release = await getRelease(params.mbid);
      return { release };
    } catch (error) {
      set.status = 502;
      return { message: message(error) };
    }
  });
