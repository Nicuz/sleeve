import { Elysia } from 'elysia';
import { z } from 'zod';
import { prisma } from '../db';

const followSchema = z.object({
  name: z.string().trim().min(1, 'Artist name is required').max(300),
});

function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Invalid payload';
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

export const followRoutes = new Elysia({ prefix: '/api/artists' })
  .get('/follows', async () => {
    const items = await prisma.artistFollow.findMany({
      orderBy: { name: 'asc' },
    });
    const artistIds = items.map((item) => item.artistId);
    const ownedRows =
      artistIds.length > 0
        ? await prisma.release.groupBy({
            by: ['artistId'],
            where: { artistId: { in: artistIds } },
            _count: { _all: true },
          })
        : [];
    const ownedCounts = new Map<string, number>();
    for (const row of ownedRows) {
      if (row.artistId) ownedCounts.set(row.artistId, row._count._all);
    }
    return {
      items: items.map((item) => ({
        ...item,
        ownedCount: ownedCounts.get(item.artistId) ?? 0,
      })),
      count: items.length,
    };
  })
  .put('/:artistId/follow', async ({ params, body, set }) => {
    const artistId = params.artistId.trim();
    if (!artistId || artistId.length > 64) {
      set.status = 400;
      return { message: 'Invalid artist ID' };
    }

    const parsed = followSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { message: errorMessage(parsed.error) };
    }

    try {
      const item = await prisma.artistFollow.upsert({
        where: { artistId },
        create: { artistId, name: parsed.data.name },
        update: { name: parsed.data.name },
      });
      return { item };
    } catch (error) {
      set.status = 500;
      return { message: errorMessage(error) };
    }
  })
  .delete('/:artistId/follow', async ({ params, set }) => {
    const artistId = params.artistId.trim();
    if (!artistId || artistId.length > 64) {
      set.status = 400;
      return { message: 'Invalid artist ID' };
    }

    try {
      await prisma.artistFollow.deleteMany({ where: { artistId } });
      return { ok: true };
    } catch (error) {
      set.status = 500;
      return { message: errorMessage(error) };
    }
  });
