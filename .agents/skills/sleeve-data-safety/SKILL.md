---
name: sleeve-data-safety
description: Use before touching Sleeve's Prisma schema, SQLite database, seeds, migrations, backups, test data, or destructive API routes. Enforces disposable-database isolation so the user's real collection is never lost.
---

# Sleeve data safety

The SQLite database is the user's real collection. Treat every command as potentially destructive until proven otherwise.

## Hard stops

- Never run `bun run seed -- --reset`.
- Never delete, move or overwrite `prisma/dev.db`, `prisma/dev.db-wal` or `prisma/dev.db-shm`.
- Never call `DELETE /api/releases?confirm=DELETE` or clear caches against the real DB.
- Never point `DATABASE_URL` at `prisma/dev.db` during tests.

## Use a disposable database

Preferred wrapper:

```bash
scripts/temp-db.sh bun run seed
scripts/temp-db.sh bunx prisma studio
scripts/temp-db.sh bun test
scripts/temp-db.sh bun server/index.ts
```

It exports an absolute `DATABASE_URL`, `DATA_DIR`, `BACKUP_DIR` and default `PORT=3099`, runs `prisma migrate deploy`, then deletes the temp directory on exit. For the Vite UI, run `PORT=3001 scripts/temp-db.sh bun server/index.ts` plus `bun run dev:web` so the `/api` proxy matches.

Manual equivalent:

```bash
cp prisma/dev.db /tmp/sleeve-test.db
DATABASE_URL="file:/tmp/sleeve-test.db" DATA_DIR=/tmp/sleeve-data PORT=3002 bun server/index.ts
```

Stop the server and remove the copy when done.

## Schema changes

1. Edit `prisma/schema.prisma`.
2. Create a migration with `bun run db:migrate`.
3. Apply it with `bun run db:deploy`.
4. Run `bun run db:generate` or restart `bun run dev` so Bun reloads the Prisma client.
5. Update `docs/development/data-model.md`, and `prisma/seed.ts` if demo data must match.

`bun run db:push` is only for throwaway databases. It skips migrations, including the FTS triggers in `prisma/migrations/20261111190000_search_fts`; search then silently falls back to `contains`.

## Tests

Integration tests already isolate themselves with temp directories:

- `server/import-flow.test.ts`
- `server/migration-upgrade.test.ts`

Follow that pattern (`mkdtempSync` + `DATABASE_URL=file:<tmp>` + cleanup) instead of writing to the real DB. Unit tests for search, Discogs mapping, settings and utils are pure and safe.

## Backups

- `bun run backup` writes a snapshot to `data/backups` (or `BACKUP_DIR`).
- Run a backup before any schema or bulk-data operation on a real DB.
- Restore only with explicit user approval.

## After manual testing

- Stop temp servers and remove copied DBs and data dirs.
- Verify the real DB was untouched:

```bash
bun -e 'const { prisma } = await import("./server/db"); console.log({ releases: await prisma.release.count(), wishlist: await prisma.wishlistItem.count() })'
```

- Report counts before and after if the task could plausibly affect them.
