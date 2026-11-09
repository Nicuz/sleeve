import { Elysia } from 'elysia';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';

const trackSchema = z.object({
  position: z.number().int().nonnegative().optional(),
  disc: z.number().int().positive().nullable().optional(),
  number: z.number().int().positive().nullable().optional(),
  title: z.string().min(1),
  duration: z.number().int().nonnegative().nullable().optional(),
  artist: z.string().nullable().optional(),
});

const releaseBaseSchema = z.object({
  musicbrainzId: z.string().nullable().optional(),
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
  rating: z.number().int().min(1).max(5).nullable().optional(),
  condition: z.string().nullable().optional(),
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid purchase date')
    .nullable()
    .optional(),
  purchaseLocation: z.string().nullable().optional(),
  purchasePrice: z.number().nonnegative().nullable().optional(),
  purchaseCurrency: z.string().nullable().optional(),
  genres: z.array(z.string()).optional(),
  trackCount: z.number().int().nonnegative().nullable().optional(),
  tracks: z.array(trackSchema).optional(),
});

const updateSchema = releaseBaseSchema.partial().extend({
  tracks: z.array(trackSchema).optional(),
});

type TrackInput = z.infer<typeof trackSchema>;

function trackCreateData(tracks: TrackInput[]) {
  return tracks.map((track, index) => ({
    position: track.position ?? index + 1,
    disc: track.disc ?? null,
    number: track.number ?? null,
    title: track.title,
    duration: track.duration ?? null,
    artist: track.artist ?? null,
  }));
}

function mapNullable(data: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    result[key] = value;
  }
  return result;
}

function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Invalid payload';
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

export const releaseRoutes = new Elysia({ prefix: '/api/releases' })
  .get('/', async ({ query }) => {
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    const format = typeof query.format === 'string' ? query.format : '';
    const genre = typeof query.genre === 'string' ? query.genre : '';
    const decade = typeof query.decade === 'string' ? query.decade : '';
    const sort = typeof query.sort === 'string' ? query.sort : 'recent';

    const where: Prisma.ReleaseWhereInput = {};
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { artist: { contains: q } },
        { label: { contains: q } },
        { catalogNumber: { contains: q } },
      ];
    }
    if (format && format !== 'All') where.format = format;
    if (genre && genre !== 'All') where.genres = { contains: genre };
    if (decade && decade !== 'All') {
      const start = Number(decade);
      if (Number.isFinite(start)) {
        where.year = { gte: start, lt: start + 10 };
      }
    }

    const orderBy: Prisma.ReleaseOrderByWithRelationInput[] =
      sort === 'title'
        ? [{ title: 'asc' }]
        : sort === 'artist'
          ? [{ artist: 'asc' }, { year: 'asc' }]
          : sort === 'year'
            ? [{ year: 'desc' }, { artist: 'asc' }]
            : sort === 'rating'
              ? [{ rating: 'desc' }, { createdAt: 'desc' }]
              : [{ createdAt: 'desc' }];

    const releases = await prisma.release.findMany({ where, orderBy });
    return { releases, count: releases.length };
  })
  .get('/owned', async ({ query }) => {
    const ids =
      typeof query.ids === 'string'
        ? query.ids
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
            .slice(0, 100)
        : [];
    if (ids.length === 0) return { releases: [] };
    const releases = await prisma.release.findMany({
      where: { musicbrainzId: { in: ids } },
      select: { id: true, musicbrainzId: true },
    });
    return { releases };
  })
  .get('/:id', async ({ params, set }) => {
    const release = await prisma.release.findUnique({
      where: { id: params.id },
      include: {
        tracks: {
          orderBy: [{ disc: 'asc' }, { number: 'asc' }, { position: 'asc' }],
        },
      },
    });
    if (!release) {
      set.status = 404;
      return { message: 'Release not found' };
    }
    return { release };
  })
  .post('/', async ({ body, set }) => {
    const parsed = releaseBaseSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { message: errorMessage(parsed.error) };
    }

    const data = parsed.data;
    try {
      const release = await prisma.release.create({
        data: {
          musicbrainzId: data.musicbrainzId ?? null,
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
          rating: data.rating ?? null,
          condition: data.condition ?? null,
          purchaseDate: data.purchaseDate ?? null,
          purchaseLocation: data.purchaseLocation ?? null,
          purchasePrice: data.purchasePrice ?? null,
          purchaseCurrency: data.purchaseCurrency ?? null,
          genres: data.genres?.length ? data.genres.join(', ') : null,
          trackCount: data.trackCount ?? data.tracks?.length ?? 0,
          tracks: data.tracks?.length
            ? { create: trackCreateData(data.tracks) }
            : undefined,
        },
        include: { tracks: true },
      });
      set.status = 201;
      return { release };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        set.status = 409;
        return { message: 'This release is already in your collection.' };
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

    const data = parsed.data;
    const updateData = mapNullable({
      title: data.title,
      artist: data.artist,
      artistId: data.artistId,
      year: data.year,
      releaseDate: data.releaseDate,
      country: data.country,
      label: data.label,
      catalogNumber: data.catalogNumber,
      barcode: data.barcode,
      format: data.format,
      formatDetail: data.formatDetail,
      coverUrl: data.coverUrl,
      notes: data.notes,
      rating: data.rating,
      condition: data.condition,
      purchaseDate: data.purchaseDate,
      purchaseLocation: data.purchaseLocation,
      purchasePrice: data.purchasePrice,
      purchaseCurrency: data.purchaseCurrency,
      genres: data.genres ? data.genres.join(', ') : undefined,
      trackCount:
        data.tracks !== undefined
          ? (data.trackCount ?? data.tracks.length)
          : data.trackCount,
    });

    try {
      const release = await prisma.$transaction(async (tx) => {
        await tx.release.update({
          where: { id: params.id },
          data: updateData,
        });

        if (data.tracks !== undefined) {
          await tx.track.deleteMany({ where: { releaseId: params.id } });
          if (data.tracks.length) {
            await tx.track.createMany({
              data: trackCreateData(data.tracks).map((track) => ({
                ...track,
                releaseId: params.id,
              })),
            });
          }
        }

        return tx.release.findUnique({
          where: { id: params.id },
          include: {
            tracks: {
              orderBy: [
                { disc: 'asc' },
                { number: 'asc' },
                { position: 'asc' },
              ],
            },
          },
        });
      });

      if (!release) {
        set.status = 404;
        return { message: 'Release not found' };
      }
      return { release };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        set.status = 404;
        return { message: 'Release not found' };
      }
      set.status = 500;
      return { message: errorMessage(error) };
    }
  })
  .delete('/', async ({ query, set }) => {
    const confirm = typeof query.confirm === 'string' ? query.confirm : '';
    if (confirm !== 'DELETE') {
      set.status = 400;
      return { message: 'Type DELETE to confirm clearing the library.' };
    }
    const result = await prisma.release.deleteMany();
    return { ok: true, deleted: result.count };
  })
  .delete('/:id', async ({ params, set }) => {
    try {
      await prisma.release.delete({ where: { id: params.id } });
      return { ok: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        set.status = 404;
        return { message: 'Release not found' };
      }
      set.status = 500;
      return { message: errorMessage(error) };
    }
  });
