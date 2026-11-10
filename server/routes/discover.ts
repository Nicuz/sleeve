import { Elysia } from 'elysia';
import { z } from 'zod';
import { getDiscoveryFeed, recordDiscoveryEvent } from '../discovery';

const eventSchema = z.object({
  releaseGroupId: z.string().min(1).max(64),
  artistId: z.string().max(64).nullable().optional(),
  artist: z.string().max(500).nullable().optional(),
  action: z.enum(['open', 'remove-save']),
});

export const discoverRoutes = new Elysia()
  .get('/api/discover', async ({ request, query, set }) => {
    const refresh = query.refresh === '1' || query.refresh === 'true';
    try {
      return await getDiscoveryFeed(refresh, request.signal);
    } catch {
      set.status = 502;
      return { message: 'Discovery is temporarily unavailable. Try again.' };
    }
  })
  .post('/api/discover/events', async ({ body, set }) => {
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { message: parsed.error.issues[0]?.message ?? 'Invalid event' };
    }
    await recordDiscoveryEvent(parsed.data);
    return { ok: true };
  });
