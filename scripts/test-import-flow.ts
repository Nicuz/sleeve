import assert from 'node:assert/strict';
import { readdir, rm } from 'node:fs/promises';
import { Elysia } from 'elysia';

const databaseUrl = process.env.DATABASE_URL;
const backupDir = process.env.BACKUP_DIR;

if (!databaseUrl || !backupDir) {
  throw new Error('Test database environment is missing.');
}

const migration = Bun.spawnSync(['bunx', 'prisma', 'migrate', 'deploy'], {
  env: process.env,
  stdout: 'pipe',
  stderr: 'pipe',
});
if (migration.exitCode !== 0) {
  throw new Error(
    `prisma migrate deploy failed:\n${migration.stdout.toString()}\n${migration.stderr.toString()}`,
  );
}

const { configureDatabase, prisma } = await import('../server/db');
const { applyImport, previewImport, ImportError } = await import('../server/import-data');
const { exportRoutes } = await import('../server/routes/export');
const { settingsRoutes } = await import('../server/routes/settings');
const { followRoutes } = await import('../server/routes/follows');
const { importRoutes } = await import('../server/routes/import');
const { releaseRoutes } = await import('../server/routes/releases');
const { wishlistRoutes } = await import('../server/routes/wishlist');
const { savedRoutes } = await import('../server/routes/saved');
const { getCollectionSnapshot } = await import('../server/discovery');

await configureDatabase();

const BASE_CREATED_AT = '2020-01-02T03:04:05.000Z';

function basePayload() {
  return {
    app: 'sleeve',
    version: 1,
    exportedAt: '2026-11-11T10:00:00.000Z',
    releases: [
      {
        musicbrainzId: 'aaaaaaaa-1111-4111-8111-111111111111',
        title: 'Test Album',
        artist: 'Test Artist',
        artistId: 'bbbbbbbb-2222-4222-8222-222222222222',
        year: 2020,
        format: 'CD',
        condition: 'Near Mint',
        rating: 4,
        genres: ['Ambient', 'Electronic'],
        trackCount: 2,
        createdAt: BASE_CREATED_AT,
        tracks: [
          { position: 1, disc: 1, number: 1, title: 'One', duration: 120 },
          { position: 2, disc: 1, number: 2, title: 'Two', duration: 130 },
        ],
      },
    ],
    wishlist: [
      {
        title: 'Wanted',
        artist: 'Test Artist',
        format: 'Vinyl',
        createdAt: '2021-02-03T00:00:00.000Z',
      },
    ],
    saved: [
      {
        releaseGroupId: 'cccccccc-3333-4333-8333-333333333333',
        title: 'Saved',
        artist: 'Test Artist',
        type: 'Album',
        createdAt: '2022-03-04T00:00:00.000Z',
      },
    ],
    follows: [
      {
        artistId: 'bbbbbbbb-2222-4222-8222-222222222222',
        name: 'Test Artist',
        createdAt: '2023-04-05T00:00:00.000Z',
      },
    ],
    settings: {
      defaultFormat: 'CD',
      defaultCondition: 'Near Mint',
      defaultCurrency: 'EUR',
    },
  };
}

async function reset() {
  await prisma.track.deleteMany();
  await prisma.release.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.savedSuggestion.deleteMany();
  await prisma.artistFollow.deleteMany();
  await prisma.discoveryFeed.deleteMany();
  await prisma.discoverySeen.deleteMany();
  await prisma.discoveryEvent.deleteMany();
  await prisma.appSettings.deleteMany();
  await rm(backupDir, { recursive: true, force: true });
}

async function api(app: Elysia, path: string, init?: RequestInit) {
  return app.handle(new Request(`http://localhost${path}`, init));
}

// Preview is read-only.
await reset();
{
  const preview = await previewImport(basePayload(), 'merge');
  assert.equal(preview.importable.releases, 1);
  assert.equal(preview.incoming.tracks, 2);
  assert.equal(preview.current.releases, 0);
  assert.equal(await prisma.release.count(), 0);
}

// Merge imports full data, preserves timestamps, writes a safety snapshot.
await reset();
{
  const result = await applyImport(basePayload(), 'merge');
  assert.equal(result.importedReleases, 1);
  assert.equal(result.importedWishlist, 1);
  assert.equal(result.importedSaved, 1);
  assert.equal(result.importedFollows, 1);
  assert.equal(result.importedSettings, 1);
  assert.match(result.backup.name, /^pre-import-.+\.db$/);

  const release = await prisma.release.findFirst({ include: { tracks: true } });
  assert.ok(release);
  assert.equal(release.title, 'Test Album');
  assert.equal(release.tracks.length, 2);
  assert.equal(release.createdAt.toISOString(), BASE_CREATED_AT);

  const wishlist = await prisma.wishlistItem.findFirst();
  assert.equal(wishlist?.createdAt.toISOString(), '2021-02-03T00:00:00.000Z');
  const saved = await prisma.savedSuggestion.findFirst();
  assert.equal(saved?.createdAt.toISOString(), '2022-03-04T00:00:00.000Z');
  const follow = await prisma.artistFollow.findFirst();
  assert.equal(follow?.createdAt.toISOString(), '2023-04-05T00:00:00.000Z');

  const settings = await prisma.appSettings.findUnique({ where: { id: 'default' } });
  assert.equal(settings?.defaultCurrency, 'EUR');

  const snapshots = (await readdir(backupDir)).filter((name) =>
    name.startsWith('pre-import-'),
  );
  assert.equal(snapshots.length, 1);
}

// Merge skips duplicates.
await reset();
{
  await applyImport(basePayload(), 'merge');
  const result = await applyImport(basePayload(), 'merge');
  assert.equal(result.importedReleases, 0);
  assert.equal(result.skippedReleases, 1);
  assert.equal(result.skippedWishlist, 1);
  assert.equal(result.skippedSaved, 1);
  assert.equal(result.skippedFollows, 1);
  assert.equal(await prisma.release.count(), 1);
}

// Replace restores exactly and clears discovery state.
await reset();
{
  await applyImport(basePayload(), 'merge');
  await applyImport(
    {
      releases: [{ title: 'Extra', artist: 'Other Artist', format: 'CD' }],
    },
    'merge',
  );
  await prisma.discoverySeen.create({ data: { releaseGroupId: 'seen-group' } });
  await prisma.discoveryEvent.create({
    data: { releaseGroupId: 'event-group', action: 'open' },
  });

  const result = await applyImport(basePayload(), 'replace');
  assert.equal(result.mode, 'replace');
  assert.equal(await prisma.release.count(), 1);
  assert.equal(await prisma.track.count(), 2);
  assert.equal(await prisma.discoverySeen.count(), 0);
  assert.equal(await prisma.discoveryEvent.count(), 0);
  const release = await prisma.release.findFirst();
  assert.equal(release?.title, 'Test Album');
  assert.equal(release?.createdAt.toISOString(), BASE_CREATED_AT);
}

// Invalid rows are counted, valid rows still import.
await reset();
{
  const payload = {
    releases: [
      { title: '', artist: '', format: 'CD' },
      { title: 'Valid', artist: 'Artist', format: 'CD' },
    ],
  };
  const preview = await previewImport(payload, 'merge');
  assert.equal(preview.invalid.releases, 1);
  assert.equal(preview.importable.releases, 1);
  const result = await applyImport(payload, 'merge');
  assert.equal(result.invalidReleases, 1);
  assert.equal(result.importedReleases, 1);
}

// Replace rejects bare arrays.
await reset();
{
  const payload = [{ title: 'Bare', artist: 'Array', format: 'CD' }];
  const preview = await previewImport(payload, 'merge');
  assert.equal(preview.canReplace, false);
  await assert.rejects(
    () => applyImport(payload, 'replace'),
    (error) => error instanceof ImportError && /full Sleeve/.test(error.message),
  );
  assert.equal(await prisma.release.count(), 0);
}

// Replace without settings resets library defaults.
await reset();
{
  await applyImport({ settings: { defaultCurrency: 'USD' } }, 'merge');
  assert.equal(await prisma.appSettings.count(), 1);
  const payload = { ...basePayload(), settings: undefined };
  await applyImport(payload, 'replace');
  assert.equal(await prisma.appSettings.count(), 0);
}

// Pre-import snapshots are pruned to five.
await reset();
{
  for (let index = 0; index < 6; index += 1) {
    await applyImport(
      { settings: { defaultCurrency: index % 2 === 0 ? 'EUR' : 'USD' } },
      'merge',
    );
  }
  const snapshots = (await readdir(backupDir)).filter((name) =>
    name.startsWith('pre-import-'),
  );
  assert.equal(snapshots.length, 5);
}

// JSON export includes all user data and has no CSV path.
await reset();
{
  await applyImport(basePayload(), 'merge');
  const app = new Elysia().use(exportRoutes);
  const response = await api(app, '/api/export');
  assert.equal(response.status, 200);
  const body = (await response.json()) as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), [
    'app',
    'exportedAt',
    'follows',
    'releases',
    'saved',
    'settings',
    'version',
    'wishlist',
  ]);
  assert.equal((body.releases as unknown[]).length, 1);
  assert.equal((body.wishlist as unknown[]).length, 1);
  assert.equal((body.follows as unknown[]).length, 1);
}

// Settings route validates and persists defaults.
await reset();
{
  const app = new Elysia().use(settingsRoutes);
  const initial = await api(app, '/api/settings');
  assert.equal(initial.status, 200);
  const initialBody = (await initial.json()) as {
    settings: { defaultCurrency: string };
  };
  assert.equal(initialBody.settings.defaultCurrency, 'EUR');

  const patch = await api(app, '/api/settings', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ defaultCurrency: 'USD' }),
  });
  assert.equal(patch.status, 200);
  const patchBody = (await patch.json()) as {
    settings: { defaultCurrency: string };
  };
  assert.equal(patchBody.settings.defaultCurrency, 'USD');

  const invalid = await api(app, '/api/settings', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ defaultCurrency: 'BTC' }),
  });
  assert.equal(invalid.status, 400);
}

// Follow routes are idempotent and local.
await reset();
{
  const app = new Elysia().use(followRoutes);
  const id = 'dddddddd-4444-4444-8444-444444444444';
  const put = await api(app, `/api/artists/${id}/follow`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Followed Artist' }),
  });
  assert.equal(put.status, 200);

  const list = await api(app, '/api/artists/follows');
  const body = (await list.json()) as { count: number };
  assert.equal(body.count, 1);

  const remove = await api(app, `/api/artists/${id}/follow`, { method: 'DELETE' });
  assert.equal(remove.status, 200);
  assert.equal(await prisma.artistFollow.count(), 0);
}

// Import HTTP routes: preview, merge, replace wiring and errors.
await reset();
{
  const app = new Elysia().use(importRoutes);
  const preview = await api(app, '/api/import/preview?mode=merge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(basePayload()),
  });
  assert.equal(preview.status, 200);
  const previewBody = (await preview.json()) as {
    importable: { releases: number };
  };
  assert.equal(previewBody.importable.releases, 1);
  assert.equal(await prisma.release.count(), 0);

  const merge = await api(app, '/api/import?mode=merge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(basePayload()),
  });
  assert.equal(merge.status, 200);
  assert.equal(await prisma.release.count(), 1);

  const replace = await api(app, '/api/import?mode=replace', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(basePayload()),
  });
  assert.equal(replace.status, 200);
  const replaceBody = (await replace.json()) as { mode: string };
  assert.equal(replaceBody.mode, 'replace');

  const bare = await api(app, '/api/import?mode=replace', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify([{ title: 'Bare', artist: 'Array', format: 'CD' }]),
  });
  assert.equal(bare.status, 400);
}

// Collection snapshot: follows add affinity and seed priority.
await reset();
{
  const artistId = '11111111-aaaa-4aaa-8aaa-111111111111';
  const followId = '22222222-bbbb-4bbb-8bbb-222222222222';
  await prisma.release.create({
    data: {
      title: 'Owned',
      artist: 'Owned Artist',
      artistId,
      format: 'CD',
      rating: 5,
      genres: 'Rock',
    },
  });
  await prisma.artistFollow.createMany({
    data: [
      { artistId: followId, name: 'Followed Artist' },
      { artistId, name: 'Owned Artist' },
    ],
  });

  const snapshot = await getCollectionSnapshot();
  assert.equal(snapshot.artistAffinity.get(`id:${followId}`), 1.5);
  assert.equal(snapshot.artistAffinity.get(`id:${artistId}`), 3.5);
  assert.equal(snapshot.artistSources.get(`id:${artistId}`), 'followed');
  assert.ok(snapshot.seedArtistIds.includes(followId));
  assert.ok(snapshot.seedArtistIds.includes(artistId));
  assert.equal(snapshot.genreAffinity.get('rock'), 2);
  assert.deepEqual(snapshot.topGenres, ['Rock']);
}

// Release CRUD route.
await reset();
{
  const app = new Elysia().use(releaseRoutes);
  const created = await api(app, '/api/releases', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Route Album',
      artist: 'Route Artist',
      format: 'CD',
      tracks: [{ title: 'Track 1', position: 1 }],
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = (await created.json()) as {
    release: { id: string; tracks: unknown[] };
  };
  assert.equal(createdBody.release.tracks.length, 1);

  const fetched = await api(app, `/api/releases/${createdBody.release.id}`);
  assert.equal(fetched.status, 200);

  const updated = await api(app, `/api/releases/${createdBody.release.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rating: 5, notes: 'Test note' }),
  });
  assert.equal(updated.status, 200);

  const removed = await api(app, `/api/releases/${createdBody.release.id}`, {
    method: 'DELETE',
  });
  assert.equal(removed.status, 200);
  assert.equal(await prisma.release.count(), 0);
}

// Wishlist CRUD route.
await reset();
{
  const app = new Elysia().use(wishlistRoutes);
  const created = await api(app, '/api/wishlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Wanted', artist: 'Artist', format: 'Vinyl' }),
  });
  assert.equal(created.status, 201);
  const createdBody = (await created.json()) as { item: { id: string } };

  const list = await api(app, '/api/wishlist');
  const listBody = (await list.json()) as { count: number };
  assert.equal(listBody.count, 1);

  const removed = await api(app, `/api/wishlist/${createdBody.item.id}`, {
    method: 'DELETE',
  });
  assert.equal(removed.status, 200);
  assert.equal(await prisma.wishlistItem.count(), 0);
}

// Saved suggestion CRUD route.
await reset();
{
  const app = new Elysia().use(savedRoutes);
  const created = await api(app, '/api/saved', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      releaseGroupId: '99999999-cccc-4ccc-8ccc-999999999999',
      title: 'Saved',
      artist: 'Artist',
      type: 'Album',
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = (await created.json()) as { item: { id: string } };

  const list = await api(app, '/api/saved');
  const listBody = (await list.json()) as { count: number };
  assert.equal(listBody.count, 1);

  const removed = await api(app, `/api/saved/${createdBody.item.id}`, {
    method: 'DELETE',
  });
  assert.equal(removed.status, 200);
  assert.equal(await prisma.savedSuggestion.count(), 0);
}

await prisma.$disconnect();
console.log('Import/export/backup/API integration passed.');
