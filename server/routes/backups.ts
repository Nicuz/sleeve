import { Elysia } from 'elysia';
import { stat } from 'node:fs/promises';
import { backupPath, createBackup, listBackups } from '../backup';

export const backupRoutes = new Elysia({ prefix: '/api/backups' })
  .get('/', async () => ({ backups: await listBackups() }))
  .post('/', async ({ set }) => {
    try {
      const backup = await createBackup();
      set.status = 201;
      return { backup };
    } catch (error) {
      set.status = 500;
      return {
        message: error instanceof Error ? error.message : 'Could not create backup.',
      };
    }
  })
  .get('/:name', async ({ params, set }) => {
    let path: string;
    try {
      path = backupPath(params.name);
    } catch (error) {
      set.status = 400;
      return {
        message: error instanceof Error ? error.message : 'Invalid backup name.',
      };
    }
    try {
      const info = await stat(path);
      const file = Bun.file(path);
      return new Response(file, {
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(info.size),
          'content-disposition': `attachment; filename="${params.name}"`,
        },
      });
    } catch {
      set.status = 404;
      return { message: 'Backup not found.' };
    }
  });
