import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith('file:')) {
  throw new Error('A file: DATABASE_URL is required for the migration test.');
}

const databasePath = databaseUrl.slice('file:'.length);
const initMigrationPath = join(
  process.cwd(),
  'prisma/migrations/20261109225941_init/migration.sql',
);
const initSql = await readFile(initMigrationPath, 'utf8');
const initChecksum = createHash('sha256').update(initSql).digest('hex');

const db = new Database(databasePath, { create: true });
db.exec(initSql);
db.exec(`
  CREATE TABLE "_prisma_migrations" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "checksum" TEXT NOT NULL,
    "finished_at" DATETIME,
    "migration_name" TEXT NOT NULL,
    "logs" TEXT,
    "rolled_back_at" DATETIME,
    "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
  )
`);
db.query(
  `INSERT INTO "_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "applied_steps_count")
   VALUES (?, ?, CURRENT_TIMESTAMP, ?, 1)`,
).run(randomUUID(), initChecksum, '20261109225941_init');

const legacyDate = '2020-01-02T03:04:05.000Z';
db.query(
  `INSERT INTO "Release"
    ("id", "title", "artist", "format", "createdAt", "updatedAt")
   VALUES (?, ?, ?, ?, ?, ?)`,
).run('legacy-release', 'Legacy Album', 'Legacy Artist', 'CD', legacyDate, legacyDate);
db.query(
  `INSERT INTO "WishlistItem"
    ("id", "title", "artist", "format", "createdAt", "updatedAt")
   VALUES (?, ?, ?, ?, ?, ?)`,
).run(
  'legacy-wishlist',
  'Legacy Wanted',
  'Legacy Artist',
  'Vinyl',
  legacyDate,
  legacyDate,
);
db.close();

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

const { prisma } = await import('../server/db');
const release = await prisma.release.findUnique({ where: { id: 'legacy-release' } });
assert.equal(release?.title, 'Legacy Album');
assert.equal(release?.createdAt.toISOString(), legacyDate);

const wishlist = await prisma.wishlistItem.findFirst({
  where: { id: 'legacy-wishlist' },
});
assert.equal(wishlist?.title, 'Legacy Wanted');
assert.equal(wishlist?.releaseGroupId, null);

assert.equal(await prisma.artistFollow.count(), 0);
assert.equal(await prisma.savedSuggestion.count(), 0);
assert.equal(await prisma.appSettings.count(), 0);
assert.equal(await prisma.discoveryFeed.count(), 0);
assert.equal(await prisma.discoverySeen.count(), 0);
assert.equal(await prisma.discoveryEvent.count(), 0);

const follow = await prisma.artistFollow.create({
  data: { artistId: 'legacy-follow', name: 'Legacy Artist' },
});
assert.equal(follow.name, 'Legacy Artist');

await prisma.$disconnect();
console.log('Migration upgrade preserved legacy data and added new schema.');
