import { Elysia } from 'elysia';
import { getAppSettings } from '../app-settings';
import { prisma } from '../db';

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

export const exportRoutes = new Elysia().get('/api/export', async ({ set }) => {
  const stamp = new Date().toISOString().slice(0, 10);
  const [releases, wishlist, saved, follows, settings] = await Promise.all([
    loadReleases(),
    loadWishlist(),
    loadSaved(),
    loadFollows(),
    getAppSettings(),
  ]);

  set.headers['content-type'] = 'application/json; charset=utf-8';
  set.headers['content-disposition'] =
    `attachment; filename="sleeve-library-${stamp}.json"`;
  return JSON.stringify(
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
});
