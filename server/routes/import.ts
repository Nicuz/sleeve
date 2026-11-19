import { Elysia, t } from 'elysia';
import { Prisma } from '@prisma/client';
import { ImportError, applyImport, previewImport, type ImportMode } from '../import-data';
import { saveCoverUpload, uploadCoverName } from '../cover-uploads';
import { pruneOrphanCoverUploads } from '../cover-gc';

function modeFromQuery(value: unknown): ImportMode {
  return value === 'replace' ? 'replace' : 'merge';
}

function errorResponse(error: unknown, set: { status?: number | string }) {
  if (error instanceof ImportError) {
    set.status = error.status;
    return { message: error.message };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    set.status = 409;
    return { message: 'Some items already exist and could not be imported.' };
  }
  set.status = 500;
  return {
    message: error instanceof Error ? error.message : 'Could not import backup.',
  };
}

function requiredCovers(payload: unknown): Set<string> {
  const names = new Set<string>();
  if (!payload || typeof payload !== 'object') return names;
  const record = payload as Record<string, unknown>;
  for (const key of ['releases', 'wishlist', 'saved']) {
    const rows = record[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const coverUrl = (row as Record<string, unknown>).coverUrl;
      if (typeof coverUrl !== 'string') continue;
      const name = uploadCoverName(coverUrl);
      if (name) names.add(name);
    }
  }
  return names;
}

export const importRoutes = new Elysia()
  .post('/api/import/preview', async ({ body, query, set }) => {
    try {
      return await previewImport(body, modeFromQuery(query.mode));
    } catch (error) {
      return errorResponse(error, set);
    }
  })
  .post('/api/import', async ({ body, query, set }) => {
    try {
      return await applyImport(body, modeFromQuery(query.mode));
    } catch (error) {
      return errorResponse(error, set);
    }
  })
  .post(
    '/api/import/upload',
    async ({ body, query, set }) => {
      try {
        let payload: unknown = body.payload;
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch {
            throw new ImportError('That backup file is not valid JSON.', 400);
          }
        }

        const stored = new Set<string>();
        for (const file of body.covers ?? []) {
          const data = new Uint8Array(await file.arrayBuffer());
          const saved = await saveCoverUpload(data);
          const name = uploadCoverName(saved.coverUrl);
          if (name) stored.add(name);
        }

        const missing = [...requiredCovers(payload)].filter((name) => !stored.has(name));
        if (missing.length > 0) {
          throw new ImportError(
            `This backup is missing ${missing.length} cover image${
              missing.length === 1 ? '' : 's'
            }.`,
            400,
          );
        }

        const result = await applyImport(payload, modeFromQuery(query.mode));
        await pruneOrphanCoverUploads().catch(() => undefined);
        return result;
      } catch (error) {
        return errorResponse(error, set);
      }
    },
    {
      body: t.Object({
        payload: t.Any(),
        covers: t.Optional(
          t.Files({
            maxSize: '8m',
            type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          }),
        ),
      }),
    },
  );
