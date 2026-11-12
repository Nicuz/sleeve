# Operations

## Local development

```bash
bun install
cp .env.example .env
bun run db:deploy
bun run dev
```

- Vite: `http://localhost:5173`
- API: `http://localhost:3001`
- Vite proxies `/api` to the Bun API.
- SQLite: `prisma/dev.db`
- Cover cache: `data/covers/`
- MusicBrainz cache: `MetadataCache` inside the SQLite DB

Bun is required. Node is not used at runtime.

## Production

```bash
bun run build
bun run start
```

- `NODE_ENV=production`
- Serves `dist/` and API from one Bun process.
- Port comes from `.env` (`3001` locally).
- Service worker is registered only in production.
- Use a reverse proxy (Caddy/Nginx) for TLS and a real domain; secure context is required for PWA install.

Recommended deploy steps:

1. `bun install --frozen-lockfile` (or `bun install`)
2. `bun run db:deploy` (also runs automatically on start unless `AUTO_MIGRATE=false`)
3. `bun run build`
4. Start `bun run start` under a process manager (systemd, pm2, container).
5. Persist `prisma/dev.db` and `data/covers/` on a volume.
6. Set a real `MUSICBRAINZ_USER_AGENT` with contact info.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | Prisma SQLite URL |
| `PORT` | `3001` | API/production server port |
| `MUSICBRAINZ_USER_AGENT` | local placeholder | Required UA/contact for MusicBrainz |
| `COVER_CACHE_DIR` | `./data/covers` | Optional cover cache directory |
| `NODE_ENV` | — | `production` for production mode |

Do not commit `.env`.

## Database changes

Schema changes live in `prisma/migrations`:

```bash
# edit prisma/schema.prisma
bun run db:migrate
bun run db:generate
# restart bun run dev so Bun reloads @prisma/client
```

`bun run db:push` is still useful for quick local schema iteration, but it skips migrations. Skipping the `search_fts` migration leaves the FTS table absent; search then uses the slower `contains` fallback.

Production applies pending migrations on start unless `AUTO_MIGRATE=false`. Apply them manually with `bun run db:deploy`.

Symptoms of a stale Prisma client:

- `prisma.<newModel>` is undefined
- new fields missing from JSON responses
- `Unknown argument` errors after schema changes

Fix: stop/restart the dev API. A production restart always reloads the client.

## Seed and destructive operations

```bash
bun run seed            # adds missing demo records; skips MBIDs already present
bun run seed -- --reset # DESTRUCTIVE: deletes all releases/tracks, then seeds demo library
```

Never run `--reset` on a real collection. It does not remove wishlist items or metadata cache, but it does wipe owned releases and tracks.

The clear-library action in Settings requires typing `DELETE`; it removes releases/tracks only.

## Backups

Preferred:

- Settings → **Backup & restore** → **Download backup** (releases, tracks, wishlist, saved suggestions, followed artists, library defaults)

Automatic snapshots:

- Every JSON import creates a `pre-import-*.db` snapshot first.
- Snapshot failure aborts the import.
- Snapshots live in `data/backups` (or `BACKUP_DIR`), are internal, and keep the last 5.
- They are a rollback safety net, not the primary backup.

Restore from JSON:

- Settings → **Restore a backup** → preview → **Add to my library** or **Replace my library**.
- Add skips duplicates and is safe for partial restores.
- Replace clears the current collection and restores the backup exactly, including follows and defaults.

Restore exact SQLite snapshot:

```bash
# stop the server first
bun run restore -- pre-import-YYYY-MM-DD.db
# start the server again
```

`bun run restore` creates a `pre-restore-*.db` safety copy before copying. Snapshots are not exposed in Settings. Covers are cache and are not part of snapshots; they re-download automatically.

## Caches

### MusicBrainz metadata cache

- Location: SQLite `MetadataCache` table
- TTLs: search 30m, detail 7d, negative 10m
- Clear: Settings → Metadata cache, or `DELETE /api/metadata/cache`
- Safe to clear; next requests will hit MusicBrainz again

### Cover cache

- Location: `data/covers/`
- One `.bin` + one `.json` per URL
- Clear: stop server and `rm -rf data/covers/*`
- Safe to clear; covers re-download on demand

### PWA / service worker

- Production only.
- Cache groups include shell, runtime assets, API responses and covers.
- To force-refresh after a deploy: hard reload, unregister the service worker, or clear site data.
- The offline API cache is network-first online, so normal navigation refreshes data.

## MusicBrainz operations

- All calls go through `server/musicbrainz.ts`.
- Minimum spacing: 1.2s.
- 503 retries: up to 3 attempts, then a 30s cooldown.
- Requests are serialized; identical in-flight requests share one call.
- Client query requests pass an `AbortSignal` so cancelled searches do not consume queued rate-limit slots.
- If you see “MusicBrainz is cooling down”, wait ~30s. Do not bypass the service layer.

Set `MUSICBRAINZ_USER_AGENT` to a real contact before heavy use.

## Metadata enrichment

Entry points:

- Library banner → **Download metadata** (batch, sequential, progress)
- Release page → **Fetch metadata** (manual release auto-match)
- Release page → **Search match** (always available; choose an edition)
- Release page → **Refresh** (existing MBID, force fresh detail)

Enrichment preserves notes, rating, condition, purchase fields and chosen format. It updates title/artist, MB IDs, cover, label, year, genres and tracks.

If CAA has no image for the selected edition:

1. Open the release.
2. Click **Search match** (or the “Cover not found” CTA).
3. Pick a different edition with a cover.
4. Apply metadata.

## Imports

### JSON restore

Settings → Library data → **Import JSON**.

- Skips releases with an existing MBID.
- Skips manual duplicates by normalized title/artist/format.
- Imports wishlist items too.

### Discogs CSV

Library → **Import from Discogs**.

- Upload/drop CSV.
- Check auto-detected mapping.
- Live preview updates as mapping changes.
- Rows without title or artist are skipped.
- Import reuses the merge-safe JSON import pipeline.
- Discogs CSV has no MusicBrainz IDs or covers; run metadata enrichment afterwards.

## Verification checklist

```bash
bun run check
```

`bun test` includes an isolated import/export/backup integration suite. It creates a temp database, runs migrations, exercises API routes and removes the temp data.

Docker smoke test, optional:

```bash
bun run test:docker
# or run the test stage inside Docker
docker build --target test .
```

Then manually verify the touched flow. Use the disposable-database wrapper so the real library is never mutated:

```bash
scripts/temp-db.sh bun run seed
scripts/temp-db.sh bun server/index.ts
```

It creates a temp SQLite database, applies migrations, exports `DATA_DIR`/`BACKUP_DIR` and removes everything on exit. The default API port is 3099; for the Vite UI use `PORT=3001 scripts/temp-db.sh bun server/index.ts` so the `/api` proxy matches. If you need a copy of the real DB instead, use:

```bash
cp prisma/dev.db /tmp/sleeve-test.db
DATABASE_URL="file:/tmp/sleeve-test.db" PORT=3002 NODE_ENV=production bun server/index.ts
```

Never leave test records in the real DB.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `EADDRINUSE` on 3001 | Another dev/prod server is running. Stop it or use another `PORT`. |
| New route/model missing | Dev API not restarted after schema/code change. |
| Prisma model undefined | Run `bun run db:push`/`db:generate`, restart dev. |
| Metadata not updating | Check MBID; use Refresh/Search match. |
| Cover fallback shown | CAA 404 for that edition; use Search match. |
| Search slow | MB rate limit/cooldown; results are cached. |
| PWA not registering | Production build only; service worker needs HTTPS or localhost. |
| Old UI after deploy | Service worker/browser cache; hard reload/clear site data. |
| Prices reject comma | Fixed: price inputs are text and `parsePriceInput` accepts comma/dot. If it regresses, check that inputs remain `type="text"`. |
| Import skipped everything | Duplicates by MBID or manual title/artist/format. |
