import { Elysia } from 'elysia';
import { getDiscoveryFeed } from '../discovery';

export const discoverRoutes = new Elysia().get(
  '/api/discover',
  async ({ request, query, set }) => {
    const refresh = query.refresh === '1' || query.refresh === 'true';
    try {
      return await getDiscoveryFeed(refresh, request.signal);
    } catch {
      set.status = 502;
      return { message: 'Discovery is temporarily unavailable. Try again.' };
    }
  },
);
