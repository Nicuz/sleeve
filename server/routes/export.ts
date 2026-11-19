import { Elysia } from 'elysia';
import { strToU8, zipSync } from 'fflate';
import { getAppSettings } from '../app-settings';
import { prisma } from '../db';
import { readCoverUpload, uploadCoverName } from '../cover-uploads';

function loadReleases() {
  return prisma.release.findMany({
    include: {
      tracks: {
        orderBy: [{ disc: 'asc' }, { number: 'asc' }, { position: 'asc' }],
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

function loadWishlist() {
  return prisma.wishlistItem.findMany({
    orderBy: { createdAt: 'asc' },
  });
}

function loadSaved() {
  return prisma.savedSuggestion.findMany({
    orderBy: { createdAt: 'asc' },
  });
}

function loadFollows() {
  return prisma.artistFollow.findMany({
    orderBy: { name: 'asc' },
  });
}

function coverNames(rows: Array<{ coverUrl: string | null }>): string[] {
  const names = new Set<string>();
  for (const row of rows) {
    if (!row.coverUrl) continue;
    const name = uploadCoverName(row.coverUrl);
    if (name) names.add(name);
  }
  return [...names];
}

export const exportRoutes = new Elysia().get('/api/export', async ({ set }) => {
  const stamp = new Date().toISOString().slice(0, 10);
  const [releases, wishlist, saved, follows, settings] = await Promise.all([
    loadReleases(),
    loadWishlist(),
    loadSaved(),
    loadFollows(),
    getAppSettings(),
  ]);

  const payload = JSON.stringify(
    {
      app: 'sleeve',
      version: 1,
      exportedAt: new Date().toISOString(),
      releases,
      wishlist,
      saved,
      follows,
      settings,
    },
    null,
    2,
  );

  const names = coverNames([...releases, ...wishlist, ...saved]);
  const covers = new Map<string, Uint8Array>();
  for (const name of names) {
    const cover = await readCoverUpload(name);
    if (!cover) {
      set.status = 500;
      return { message: `Cover image ${name} is missing from storage.` };
    }
    covers.set(name, cover.data);
  }

  if (covers.size === 0) {
    set.headers['content-type'] = 'application/json; charset=utf-8';
    set.headers['content-disposition'] =
      `attachment; filename="sleeve-library-${stamp}.json"`;
    return payload;
  }

  const files: Record<string, Uint8Array> = {
    'library.json': strToU8(payload),
  };
  for (const [name, data] of covers) {
    files[`covers/${name}`] = data;
  }
  const archive = zipSync(files, { level: 0 });
  return new Response(archive, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="sleeve-library-${stamp}.zip"`,
    },
  });
});
