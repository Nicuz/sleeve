import { Elysia } from 'elysia';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';

const trackSchema = z.object({
  position: z.coerce.number().int().optional(),
  disc: z.coerce.number().int().nullable().optional(),
  number: z.coerce.number().int().nullable().optional(),
  title: z.string().min(1),
  duration: z.coerce.number().int().nullable().optional(),
  artist: z.string().nullable().optional(),
});

const genresSchema = z
  .union([z.string(), z.array(z.string())])
  .nullable()
  .optional();

const releaseSchema = z.object({
  musicbrainzId: z.string().nullable().optional(),
  title: z.string().min(1),
  artist: z.string().min(1),
  artistId: z.string().nullable().optional(),
  year: z.coerce.number().int().min(1800).max(2200).nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  catalogNumber: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  format: z.string().min(1).default('Other'),
  formatDetail: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  condition: z.string().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  purchaseLocation: z.string().nullable().optional(),
  purchasePrice: z.coerce.number().nonnegative().nullable().optional(),
  purchaseCurrency: z.string().nullable().optional(),
  genres: genresSchema,
  trackCount: z.coerce.number().int().nonnegative().nullable().optional(),
  tracks: z.array(trackSchema).optional(),
});

const wishlistSchema = z.object({
  musicbrainzId: z.string().nullable().optional(),
  title: z.string().min(1),
  artist: z.string().min(1),
  artistId: z.string().nullable().optional(),
  year: z.coerce.number().int().min(1800).max(2200).nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  catalogNumber: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  format: z.string().min(1).default('Other'),
  formatDetail: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  targetPrice: z.coerce.number().nonnegative().nullable().optional(),
  targetCurrency: z.string().nullable().optional(),
});

function manualKey(title: string, artist: string, format: string) {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}|${format.trim().toLowerCase()}`;
}

function genresToString(
  genres: string | string[] | null | undefined,
): string | null {
  if (Array.isArray(genres)) {
    const clean = genres.map((genre) => genre.trim()).filter(Boolean);
    return clean.length ? clean.join(', ') : null;
  }
  const clean = (genres ?? '').trim();
  return clean || null;
}

export const importRoutes = new Elysia().post(
  '/api/import',
  async ({ body, set }) => {
    const payload = body as
      | { releases?: unknown; wishlist?: unknown }
      | unknown[]
      | null;
    const releasesInput = Array.isArray(payload)
      ? payload
      : payload?.releases;
    const wishlistInput = Array.isArray(payload) ? [] : payload?.wishlist;

    if (!Array.isArray(releasesInput) && !Array.isArray(wishlistInput)) {
      set.status = 400;
      return { message: 'No releases or wishlist items found in the backup.' };
    }
    if (
      (Array.isArray(releasesInput) && releasesInput.length > 10_000) ||
      (Array.isArray(wishlistInput) && wishlistInput.length > 10_000)
    ) {
      set.status = 400;
      return { message: 'Backup is too large to import.' };
    }

    try {
      const [existingReleases, existingWishlist] = await Promise.all([
        prisma.release.findMany({
          select: {
            musicbrainzId: true,
            title: true,
            artist: true,
            format: true,
          },
        }),
        prisma.wishlistItem.findMany({
          select: {
            musicbrainzId: true,
            title: true,
            artist: true,
            format: true,
          },
        }),
      ]);

      const seenReleaseMbids = new Set(
        existingReleases
          .map((item) => item.musicbrainzId)
          .filter((id): id is string => Boolean(id)),
      );
      const seenReleaseKeys = new Set(
        existingReleases.map((item) =>
          manualKey(item.title, item.artist, item.format),
        ),
      );
      const seenWishlistMbids = new Set(
        existingWishlist
          .map((item) => item.musicbrainzId)
          .filter((id): id is string => Boolean(id)),
      );
      const seenWishlistKeys = new Set(
        existingWishlist.map((item) =>
          manualKey(item.title, item.artist, item.format),
        ),
      );

      const releaseCreates: Array<ReturnType<typeof prisma.release.create>> = [];
      const wishlistCreates: Array<
        ReturnType<typeof prisma.wishlistItem.create>
      > = [];
      let skippedReleases = 0;
      let invalidReleases = 0;
      let skippedWishlist = 0;
      let invalidWishlist = 0;

      for (const raw of Array.isArray(releasesInput) ? releasesInput : []) {
        const parsed = releaseSchema.safeParse(raw);
        if (!parsed.success) {
          invalidReleases += 1;
          continue;
        }
        const data = parsed.data;
        const mbid = data.musicbrainzId?.trim() || null;
        const key = manualKey(data.title, data.artist, data.format);
        if (
          (mbid && seenReleaseMbids.has(mbid)) ||
          (!mbid && seenReleaseKeys.has(key))
        ) {
          skippedReleases += 1;
          continue;
        }

        const tracks = (data.tracks ?? []).map((track, index) => ({
          position: track.position ?? index + 1,
          disc: track.disc ?? null,
          number: track.number ?? null,
          title: track.title,
          duration: track.duration ?? null,
          artist: track.artist ?? null,
        }));

        releaseCreates.push(
          prisma.release.create({
            data: {
              musicbrainzId: mbid,
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
              genres: genresToString(data.genres),
              trackCount: data.trackCount ?? tracks.length,
              tracks: tracks.length ? { create: tracks } : undefined,
            },
          }),
        );
        if (mbid) seenReleaseMbids.add(mbid);
        else seenReleaseKeys.add(key);
      }

      for (const raw of Array.isArray(wishlistInput) ? wishlistInput : []) {
        const parsed = wishlistSchema.safeParse(raw);
        if (!parsed.success) {
          invalidWishlist += 1;
          continue;
        }
        const data = parsed.data;
        const mbid = data.musicbrainzId?.trim() || null;
        const key = manualKey(data.title, data.artist, data.format);
        if (
          (mbid && seenWishlistMbids.has(mbid)) ||
          (!mbid && seenWishlistKeys.has(key))
        ) {
          skippedWishlist += 1;
          continue;
        }

        wishlistCreates.push(
          prisma.wishlistItem.create({
            data: {
              musicbrainzId: mbid,
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
              priority: data.priority,
              targetPrice: data.targetPrice ?? null,
              targetCurrency: data.targetCurrency ?? null,
            },
          }),
        );
        if (mbid) seenWishlistMbids.add(mbid);
        else seenWishlistKeys.add(key);
      }

      if (releaseCreates.length > 0 || wishlistCreates.length > 0) {
        await prisma.$transaction([...releaseCreates, ...wishlistCreates]);
      }

      return {
        importedReleases: releaseCreates.length,
        skippedReleases,
        invalidReleases,
        importedWishlist: wishlistCreates.length,
        skippedWishlist,
        invalidWishlist,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        set.status = 409;
        return { message: 'Some items already exist and could not be imported.' };
      }
      set.status = 500;
      return {
        message:
          error instanceof Error ? error.message : 'Could not import backup.',
      };
    }
  },
);
