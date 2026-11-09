import { Elysia } from 'elysia';
import {
  getArtist,
  getArtistReleaseGroups,
  getRelease,
  searchArtists,
  searchByBarcode,
  searchReleases,
} from '../musicbrainz';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'MusicBrainz lookup failed';
}

export const musicbrainzRoutes = new Elysia({ prefix: '/api/musicbrainz' })
  .get('/search', async ({ query, set, request }) => {
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    if (!q) {
      set.status = 400;
      return { message: 'Search query is required' };
    }
    const limit = Math.min(30, Math.max(1, Number(query.limit ?? 20) || 20));
    try {
      const results = await searchReleases(q, limit, request.signal);
      return { results, count: results.length };
    } catch (error) {
      set.status = 502;
      return { message: message(error) };
    }
  })
  .get('/barcode/:code', async ({ params, set, request }) => {
    try {
      const results = await searchByBarcode(params.code, request.signal);
      return { results, count: results.length };
    } catch (error) {
      set.status = 502;
      return { message: message(error) };
    }
  })
  .get('/artists', async ({ query, set, request }) => {
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    if (!q) {
      set.status = 400;
      return { message: 'Search query is required' };
    }
    const limit = Math.min(10, Math.max(1, Number(query.limit ?? 6) || 6));
    try {
      const results = await searchArtists(q, limit, request.signal);
      return { results, count: results.length };
    } catch (error) {
      set.status = 502;
      return { message: message(error) };
    }
  })
  .get('/artists/:mbid/release-groups', async ({ params, query, set, request }) => {
    const offset = Math.max(0, Number(query.offset ?? 0) || 0);
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 100) || 100));
    try {
      const page = await getArtistReleaseGroups(
        params.mbid,
        offset,
        limit,
        request.signal,
      );
      return page;
    } catch (error) {
      set.status = 502;
      return { message: message(error) };
    }
  })
  .get('/artists/:mbid', async ({ params, set, request }) => {
    try {
      const artist = await getArtist(params.mbid, request.signal);
      return { artist };
    } catch (error) {
      set.status = 502;
      return { message: message(error) };
    }
  })
  .get('/releases/:mbid', async ({ params, set, request }) => {
    try {
      const release = await getRelease(params.mbid, request.signal);
      return { release };
    } catch (error) {
      set.status = 502;
      return { message: message(error) };
    }
  });
