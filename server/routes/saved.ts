import { Elysia } from 'elysia';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';
import { recordDiscoveryEvent } from '../discovery';

const savedSchema = z.object({
  releaseGroupId: z.string().min(1),
  title: z.string().min(1, 'Title is required'),
  artist: z.string().min(1, 'Artist is required'),
  artistId: z.string().nullable().optional(),
  year: z.number().int().min(1800).max(2200).nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  type: z.string().min(1).default('Other'),
});

function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Invalid payload';
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

export const savedRoutes = new Elysia({ prefix: '/api/saved' })
  .get('/', async () => {
    const items = await prisma.savedSuggestion.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return { items, count: items.length };
  })
  .post('/', async ({ body, set }) => {
    const parsed = savedSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { message: errorMessage(parsed.error) };
    }
    const data = parsed.data;
    try {
      const item = await prisma.savedSuggestion.create({
        data: {
          releaseGroupId: data.releaseGroupId,
          title: data.title,
          artist: data.artist,
          artistId: data.artistId ?? null,
          year: data.year ?? null,
          releaseDate: data.releaseDate ?? null,
          coverUrl: data.coverUrl ?? null,
          type: data.type,
        },
      });
      set.status = 201;
      return { item };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        set.status = 409;
        return { message: 'This release is already saved.' };
      }
      set.status = 500;
      return { message: errorMessage(error) };
    }
  })
  .post('/:id/promote', async ({ params, set }) => {
    try {
      const saved = await prisma.savedSuggestion.findUnique({
        where: { id: params.id },
      });
      if (!saved) {
        set.status = 404;
        return { message: 'Saved suggestion not found' };
      }
      const [item] = await prisma.$transaction([
        prisma.wishlistItem.create({
          data: {
            releaseGroupId: saved.releaseGroupId,
            title: saved.title,
            artist: saved.artist,
            artistId: saved.artistId,
            year: saved.year,
            releaseDate: saved.releaseDate,
            coverUrl: saved.coverUrl,
            format: saved.type,
            formatDetail: saved.type,
          },
        }),
        prisma.savedSuggestion.delete({ where: { id: saved.id } }),
      ]);
      return { item };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        set.status = 409;
        return { message: 'This release is already on your wishlist.' };
      }
      set.status = 500;
      return { message: errorMessage(error) };
    }
  })
  .delete('/:id', async ({ params, set }) => {
    try {
      const saved = await prisma.savedSuggestion.delete({ where: { id: params.id } });
      void recordDiscoveryEvent({
        releaseGroupId: saved.releaseGroupId,
        artistId: saved.artistId,
        artist: saved.artist,
        action: 'remove-save',
      });
      return { ok: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        set.status = 404;
        return { message: 'Saved suggestion not found' };
      }
      set.status = 500;
      return { message: errorMessage(error) };
    }
  });
