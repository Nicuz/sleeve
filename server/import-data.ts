import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  APP_SETTINGS_ID,
  CONDITION_OPTIONS,
  CURRENCY_OPTIONS,
  DEFAULT_APP_SETTINGS,
  FORMAT_OPTIONS,
  type AppSettingsValues,
} from './app-settings';
import { createBackup, type BackupFile } from './backup';
import { prisma } from './db';

const MAX_ROWS = 10_000;

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
  createdAt: z.coerce.date().optional(),
});

const wishlistSchema = z.object({
  musicbrainzId: z.string().nullable().optional(),
  releaseGroupId: z.string().nullable().optional(),
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
  targetPrice: z.coerce.number().nonnegative().nullable().optional(),
  targetCurrency: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
});

const savedSchema = z.object({
  releaseGroupId: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  artistId: z.string().nullable().optional(),
  year: z.coerce.number().int().min(1800).max(2200).nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  type: z.string().min(1).default('Other'),
  createdAt: z.coerce.date().optional(),
});

const followSchema = z.object({
  artistId: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.coerce.date().optional(),
});

const settingsSchema = z.object({
  defaultFormat: z.enum(FORMAT_OPTIONS).optional(),
  defaultCondition: z.enum(CONDITION_OPTIONS).optional(),
  defaultCurrency: z.enum(CURRENCY_OPTIONS).optional(),
});

export type ImportMode = 'merge' | 'replace';

export type ImportSource = {
  app: string | null;
  version: number | null;
  exportedAt: string | null;
};

export type ImportPreview = {
  mode: ImportMode;
  source: ImportSource;
  canReplace: boolean;
  incoming: {
    releases: number;
    tracks: number;
    wishlist: number;
    saved: number;
    follows: number;
    hasSettings: boolean;
  };
  importable: {
    releases: number;
    wishlist: number;
    saved: number;
    follows: number;
    hasSettings: boolean;
  };
  duplicates: {
    releases: number;
    wishlist: number;
    saved: number;
    follows: number;
  };
  invalid: {
    releases: number;
    wishlist: number;
    saved: number;
    follows: number;
    settings: number;
  };
  current: {
    releases: number;
    tracks: number;
    wishlist: number;
    saved: number;
    follows: number;
  };
  warnings: string[];
};

export type ImportResult = {
  mode: ImportMode;
  backup: BackupFile;
  importedReleases: number;
  skippedReleases: number;
  invalidReleases: number;
  importedWishlist: number;
  skippedWishlist: number;
  invalidWishlist: number;
  importedSaved: number;
  skippedSaved: number;
  invalidSaved: number;
  importedFollows: number;
  skippedFollows: number;
  invalidFollows: number;
  importedSettings: number;
  invalidSettings: number;
};

type PreparedImport = {
  source: ImportSource;
  canReplace: boolean;
  current: ImportPreview['current'];
  incoming: ImportPreview['incoming'];
  duplicates: ImportPreview['duplicates'];
  invalid: ImportPreview['invalid'];
  warnings: string[];
  releases: Prisma.ReleaseCreateInput[];
  wishlist: Prisma.WishlistItemCreateManyInput[];
  saved: Prisma.SavedSuggestionCreateManyInput[];
  follows: Prisma.ArtistFollowCreateManyInput[];
  settings: Partial<AppSettingsValues> | null;
};

export class ImportError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ImportError';
    this.status = status;
  }
}

function manualKey(title: string, artist: string, format: string) {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}|${format.trim().toLowerCase()}`;
}

function genresToString(genres: string | string[] | null | undefined): string | null {
  if (Array.isArray(genres)) {
    const clean = genres.map((genre) => genre.trim()).filter(Boolean);
    return clean.length ? clean.join(', ') : null;
  }
  const clean = (genres ?? '').trim();
  return clean || null;
}

function payloadObject(payload: unknown): Record<string, unknown> | null {
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null;
}

function sourceOf(payload: unknown): ImportSource {
  const object = payloadObject(payload);
  return {
    app: typeof object?.app === 'string' ? object.app : null,
    version: typeof object?.version === 'number' ? object.version : null,
    exportedAt: typeof object?.exportedAt === 'string' ? object.exportedAt : null,
  };
}

function inputArrays(payload: unknown) {
  const object = payloadObject(payload);
  return {
    releases: Array.isArray(payload) ? payload : arrayOrEmpty(object?.releases),
    wishlist: Array.isArray(payload) ? [] : arrayOrEmpty(object?.wishlist),
    saved: Array.isArray(payload) ? [] : arrayOrEmpty(object?.saved),
    follows: Array.isArray(payload) ? [] : arrayOrEmpty(object?.follows),
    settingsInput: Array.isArray(payload) ? null : (object?.settings ?? null),
  };
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function prepareImport(
  payload: unknown,
  mode: ImportMode,
): Promise<PreparedImport> {
  const source = sourceOf(payload);
  const canReplace = source.app === 'sleeve' && source.version === 1;
  const input = inputArrays(payload);
  const hasSettings = input.settingsInput != null;
  const arrays = [input.releases, input.wishlist, input.saved, input.follows];
  if (arrays.every((array) => array.length === 0) && !hasSettings) {
    throw new ImportError(
      'No releases, wishlist items, saved suggestions, followed artists or settings found in the backup.',
    );
  }
  if (arrays.some((array) => array.length > MAX_ROWS)) {
    throw new ImportError('Backup is too large to import.');
  }

  let settings: Partial<AppSettingsValues> | null = null;
  let invalidSettings = 0;
  if (hasSettings) {
    const parsed = settingsSchema.safeParse(input.settingsInput);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      invalidSettings = 1;
    } else {
      settings = parsed.data;
    }
  }

  const [
    existingReleases,
    existingWishlist,
    existingSaved,
    existingFollows,
    currentTracks,
  ] = await Promise.all([
    prisma.release.findMany({
      select: { musicbrainzId: true, title: true, artist: true, format: true },
    }),
    prisma.wishlistItem.findMany({
      select: {
        musicbrainzId: true,
        releaseGroupId: true,
        title: true,
        artist: true,
        format: true,
      },
    }),
    prisma.savedSuggestion.findMany({ select: { releaseGroupId: true } }),
    prisma.artistFollow.findMany({ select: { artistId: true } }),
    prisma.track.count(),
  ]);

  const current: ImportPreview['current'] = {
    releases: existingReleases.length,
    tracks: currentTracks,
    wishlist: existingWishlist.length,
    saved: existingSaved.length,
    follows: existingFollows.length,
  };

  const seedExisting = mode === 'merge';
  const seenReleaseMbids = new Set(
    seedExisting
      ? existingReleases
          .map((item) => item.musicbrainzId)
          .filter((id): id is string => Boolean(id))
      : [],
  );
  const seenReleaseKeys = new Set(
    seedExisting
      ? existingReleases.map((item) => manualKey(item.title, item.artist, item.format))
      : [],
  );
  const seenWishlistMbids = new Set(
    seedExisting
      ? existingWishlist
          .map((item) => item.musicbrainzId)
          .filter((id): id is string => Boolean(id))
      : [],
  );
  const seenWishlistKeys = new Set(
    seedExisting
      ? existingWishlist.map((item) => manualKey(item.title, item.artist, item.format))
      : [],
  );
  const seenWishlistGroupIds = new Set(
    seedExisting
      ? existingWishlist
          .map((item) => item.releaseGroupId)
          .filter((id): id is string => Boolean(id))
      : [],
  );
  const seenSavedGroupIds = new Set(
    seedExisting ? existingSaved.map((item) => item.releaseGroupId) : [],
  );
  const seenFollowIds = new Set(
    seedExisting ? existingFollows.map((item) => item.artistId) : [],
  );

  const releases: Prisma.ReleaseCreateInput[] = [];
  const wishlist: Prisma.WishlistItemCreateManyInput[] = [];
  const saved: Prisma.SavedSuggestionCreateManyInput[] = [];
  const follows: Prisma.ArtistFollowCreateManyInput[] = [];
  const duplicates = { releases: 0, wishlist: 0, saved: 0, follows: 0 };
  const invalid = {
    releases: 0,
    wishlist: 0,
    saved: 0,
    follows: 0,
    settings: invalidSettings,
  };
  let incomingTracks = 0;

  for (const raw of input.releases) {
    const parsed = releaseSchema.safeParse(raw);
    if (!parsed.success) {
      invalid.releases += 1;
      continue;
    }
    const data = parsed.data;
    incomingTracks += (data.tracks ?? []).length;
    const mbid = data.musicbrainzId?.trim() || null;
    const key = manualKey(data.title, data.artist, data.format);
    if ((mbid && seenReleaseMbids.has(mbid)) || (!mbid && seenReleaseKeys.has(key))) {
      duplicates.releases += 1;
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

    releases.push({
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
      createdAt: data.createdAt,
    });
    if (mbid) seenReleaseMbids.add(mbid);
    else seenReleaseKeys.add(key);
  }

  for (const raw of input.wishlist) {
    const parsed = wishlistSchema.safeParse(raw);
    if (!parsed.success) {
      invalid.wishlist += 1;
      continue;
    }
    const data = parsed.data;
    const mbid = data.musicbrainzId?.trim() || null;
    const groupId = data.releaseGroupId?.trim() || null;
    const key = manualKey(data.title, data.artist, data.format);
    if (
      (mbid && seenWishlistMbids.has(mbid)) ||
      (groupId && seenWishlistGroupIds.has(groupId)) ||
      (!mbid && !groupId && seenWishlistKeys.has(key))
    ) {
      duplicates.wishlist += 1;
      continue;
    }

    wishlist.push({
      musicbrainzId: mbid,
      releaseGroupId: groupId,
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
      createdAt: data.createdAt,
    });
    if (mbid) seenWishlistMbids.add(mbid);
    else if (groupId) seenWishlistGroupIds.add(groupId);
    else seenWishlistKeys.add(key);
  }

  for (const raw of input.saved) {
    const parsed = savedSchema.safeParse(raw);
    if (!parsed.success) {
      invalid.saved += 1;
      continue;
    }
    const data = parsed.data;
    if (seenSavedGroupIds.has(data.releaseGroupId)) {
      duplicates.saved += 1;
      continue;
    }
    saved.push({
      releaseGroupId: data.releaseGroupId,
      title: data.title,
      artist: data.artist,
      artistId: data.artistId ?? null,
      year: data.year ?? null,
      releaseDate: data.releaseDate ?? null,
      coverUrl: data.coverUrl ?? null,
      type: data.type,
      createdAt: data.createdAt,
    });
    seenSavedGroupIds.add(data.releaseGroupId);
  }

  for (const raw of input.follows) {
    const parsed = followSchema.safeParse(raw);
    if (!parsed.success) {
      invalid.follows += 1;
      continue;
    }
    const data = parsed.data;
    if (seenFollowIds.has(data.artistId)) {
      duplicates.follows += 1;
      continue;
    }
    follows.push({
      artistId: data.artistId,
      name: data.name,
      createdAt: data.createdAt,
    });
    seenFollowIds.add(data.artistId);
  }

  const warnings: string[] = [];
  const invalidTotal =
    invalid.releases +
    invalid.wishlist +
    invalid.saved +
    invalid.follows +
    invalid.settings;
  if (invalidTotal > 0) {
    warnings.push(
      `${invalidTotal} row${invalidTotal === 1 ? '' : 's'} cannot be read and will be skipped.`,
    );
  }
  if (!canReplace) {
    warnings.push('This is not a full Sleeve backup; replace mode is unavailable.');
  }
  if (mode === 'replace') {
    warnings.push(
      'Replace removes the current library, wishlist, saved items, follows, library defaults and discovery state.',
    );
    if (!settings) {
      warnings.push('Backup has no library defaults; defaults will be reset.');
    }
  }

  return {
    source,
    canReplace,
    current,
    incoming: {
      releases: input.releases.length,
      tracks: incomingTracks,
      wishlist: input.wishlist.length,
      saved: input.saved.length,
      follows: input.follows.length,
      hasSettings,
    },
    duplicates,
    invalid,
    warnings,
    releases,
    wishlist,
    saved,
    follows,
    settings,
  };
}

export async function previewImport(
  payload: unknown,
  mode: ImportMode,
): Promise<ImportPreview> {
  const prepared = await prepareImport(payload, mode);
  return {
    mode,
    source: prepared.source,
    canReplace: prepared.canReplace,
    incoming: prepared.incoming,
    importable: {
      releases: prepared.releases.length,
      wishlist: prepared.wishlist.length,
      saved: prepared.saved.length,
      follows: prepared.follows.length,
      hasSettings: Boolean(prepared.settings),
    },
    duplicates: prepared.duplicates,
    invalid: prepared.invalid,
    current: prepared.current,
    warnings: prepared.warnings,
  };
}

export async function applyImport(
  payload: unknown,
  mode: ImportMode,
): Promise<ImportResult> {
  const prepared = await prepareImport(payload, mode);
  if (mode === 'replace' && !prepared.canReplace) {
    throw new ImportError('Replace requires a full Sleeve JSON backup.');
  }

  let backup: BackupFile;
  try {
    backup = await createBackup('pre-import');
  } catch (error) {
    throw new ImportError(
      error instanceof Error
        ? `Safety backup failed; import aborted. ${error.message}`
        : 'Safety backup failed; import aborted.',
      500,
    );
  }

  const hasWork =
    mode === 'replace' ||
    prepared.releases.length > 0 ||
    prepared.wishlist.length > 0 ||
    prepared.saved.length > 0 ||
    prepared.follows.length > 0 ||
    Boolean(prepared.settings);

  if (hasWork) {
    await prisma.$transaction(
      async (tx) => {
        if (mode === 'replace') {
          await tx.track.deleteMany();
          await tx.release.deleteMany();
          await tx.wishlistItem.deleteMany();
          await tx.savedSuggestion.deleteMany();
          await tx.artistFollow.deleteMany();
          await tx.discoveryFeed.deleteMany();
          await tx.discoverySeen.deleteMany();
          await tx.discoveryEvent.deleteMany();
        }

        for (const data of prepared.releases) {
          await tx.release.create({ data });
        }
        if (prepared.wishlist.length > 0) {
          await tx.wishlistItem.createMany({ data: prepared.wishlist });
        }
        if (prepared.saved.length > 0) {
          await tx.savedSuggestion.createMany({ data: prepared.saved });
        }
        if (prepared.follows.length > 0) {
          await tx.artistFollow.createMany({ data: prepared.follows });
        }

        if (mode === 'replace' && !prepared.settings) {
          await tx.appSettings.deleteMany();
        } else if (prepared.settings) {
          await tx.appSettings.upsert({
            where: { id: APP_SETTINGS_ID },
            create: {
              id: APP_SETTINGS_ID,
              ...DEFAULT_APP_SETTINGS,
              ...prepared.settings,
            },
            update:
              mode === 'replace'
                ? { ...DEFAULT_APP_SETTINGS, ...prepared.settings }
                : prepared.settings,
          });
        }
      },
      { timeout: 60_000 },
    );
  }

  return {
    mode,
    backup,
    importedReleases: prepared.releases.length,
    skippedReleases: prepared.duplicates.releases,
    invalidReleases: prepared.invalid.releases,
    importedWishlist: prepared.wishlist.length,
    skippedWishlist: prepared.duplicates.wishlist,
    invalidWishlist: prepared.invalid.wishlist,
    importedSaved: prepared.saved.length,
    skippedSaved: prepared.duplicates.saved,
    invalidSaved: prepared.invalid.saved,
    importedFollows: prepared.follows.length,
    skippedFollows: prepared.duplicates.follows,
    invalidFollows: prepared.invalid.follows,
    importedSettings: prepared.settings ? 1 : 0,
    invalidSettings: prepared.invalid.settings,
  };
}
