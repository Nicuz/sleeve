import { Elysia } from 'elysia';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';

const wishlistSchema = z.object({
  musicbrainzId: z.string().nullable().optional(),
  releaseGroupId: z.string().nullable().optional(),
  title: z.string().min(1, 'Title is required'),
  artist: z.string().min(1, 'Artist is required'),
  artistId: z.string().nullable().optional(),
  year: z.number().int().min(1800).max(2200).nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  catalogNumber: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  format: z.string().min(1).default('Other'),
  formatDetail: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  targetPrice: z.number().nonnegative().nullable().optional(),
  targetCurrency: z.string().nullable().optional(),
});

const updateSchema = z
  .object({
    title: z.string().min(1),
    artist: z.string().min(1),
    notes: z.string().nullable(),
    targetPrice: z.number().nonnegative().nullable(),
    targetCurrency: z.string().nullable(),
  })
  .partial();

function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Invalid payload';
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

export const wishlistRoutes = new Elysia({ prefix: '/api/wishlist' })
  .get('/', async () => {
    const items = await prisma.wishlistItem.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return { items, count: items.length };
  })
  .post('/', async ({ body, set }) => {
    const parsed = wishlistSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { message: errorMessage(parsed.error) };
    }
    const data = parsed.data;
    try {
      const releaseGroupId = data.releaseGroupId ?? null;
      if (!data.musicbrainzId) {
        const duplicate = await prisma.wishlistItem.findFirst({
          where: releaseGroupId
            ? { releaseGroupId }
            : {
                musicbrainzId: null,
                releaseGroupId: null,
                title: data.title,
                artist: data.artist,
                format: data.format,
              },
        });
        if (duplicate) {
          set.status = 409;
          return { message: 'This release is already in your wishlist.' };
        }
      }
      const item = await prisma.wishlistItem.create({
        data: {
          musicbrainzId: data.musicbrainzId ?? null,
          releaseGroupId,
          title: data.title,
          artist: data.artist,
          artistId: data.artistId ?? null,
          year: data.year ?? null,
          releaseDate: data.releaseDate ?? null,
          country: data.country ?? null,
          label: data.label ?? null,
          catalogNumber: data.catalogNumber ?? null,
          barcode: data.barcode ?? null,
          format: data.format,
          formatDetail: data.formatDetail ?? null,
          coverUrl: data.coverUrl ?? null,
          notes: data.notes ?? null,
          targetPrice: data.targetPrice ?? null,
          targetCurrency: data.targetCurrency ?? null,
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
        return { message: 'This release is already on your wishlist.' };
      }
      set.status = 500;
      return { message: errorMessage(error) };
    }
  })
  .patch('/:id', async ({ params, body, set }) => {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { message: errorMessage(parsed.error) };
    }
    try {
      const item = await prisma.wishlistItem.update({
        where: { id: params.id },
        data: parsed.data,
      });
      return { item };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        set.status = 404;
        return { message: 'Wishlist item not found' };
      }
      set.status = 500;
      return { message: errorMessage(error) };
    }
  })
  .delete('/:id', async ({ params, set }) => {
    try {
      await prisma.wishlistItem.delete({ where: { id: params.id } });
      return { ok: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        set.status = 404;
        return { message: 'Wishlist item not found' };
      }
      set.status = 500;
      return { message: errorMessage(error) };
    }
  });
