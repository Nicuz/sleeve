import { Elysia } from 'elysia';
import { prisma } from '../db';

export const maintenanceRoutes = new Elysia()
  .get('/api/metadata/cache', async () => {
    const [count, oldest, newest] = await Promise.all([
      prisma.metadataCache.count(),
      prisma.metadataCache.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.metadataCache.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);
    return {
      count,
      oldest: oldest?.createdAt ?? null,
      newest: newest?.updatedAt ?? null,
    };
  })
  .delete('/api/metadata/cache', async () => {
    const result = await prisma.metadataCache.deleteMany();
    return { ok: true, deleted: result.count };
  });
