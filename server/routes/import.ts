import { Elysia } from 'elysia';
import { Prisma } from '@prisma/client';
import { ImportError, applyImport, previewImport, type ImportMode } from '../import-data';

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
  });
