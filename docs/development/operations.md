---
title: Operations
description: Local development, production, migrations, backups, caches and troubleshooting.
---

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

Recommended deploy steps:

1. `bun install --frozen-lockfile` (or `bun install`)
2. `bun run db:deploy` (also runs automatically on start unless `AUTO_MIGRATE=false`)
3. `bun run build`
4. Start `bun run start` under a process manager (systemd, pm2, container).
5. Persist `prisma/dev.db` and `data/covers/` on a volume.
6. Set a real `MUSICBRAINZ_USER_AGENT` with contact info.

### Docker

The compose file binds to localhost and stores everything in the `sleeve-data` volume:

```text
/data/sleeve.db      SQLite database
/data/covers/        cover image cache (safe to delete)
/data/backups/       internal pre-import snapshots
```

Published image:

```bash
docker compose up -d
```

Source build:

```bash
docker compose up -d --build
```

Use the inline stack from the README/getting started as `compose.yaml`. The repository's `docker-compose.image.yml` is the same stack with auth and user-agent variables.

`/data` uses the named volume `sleeve-data` by default. To store the database and covers in a visible host directory, set an absolute path:

```dotenv
SLEEVE_DATA_DIR=/opt/stacks/sleeve/data
```

The image entrypoint starts as root only long enough to create the directory and recursively set ownership to uid/gid `1000`, then drops to the `bun` user before starting the app. No manual `chown` is needed, including for bind mounts.

If you run the container with an explicit non-root `user:`, the entrypoint cannot change ownership. In that case create the directory yourself and make it writable by that user, or use the default named volume.

### Ports

The container always listens on `3001`. The host port defaults to `3001`, so the two appear identical. Only the host side can collide with another service.

If something else already uses `3001`, set `SLEEVE_PORT` in `.env`:

```dotenv
SLEEVE_PORT=3011
```

Then redeploy and open `http://127.0.0.1:3011`:

```bash
docker compose up -d
```

Do not change `PORT` unless you also change the container side of the mapping. `PORT` is the port inside the container; `SLEEVE_PORT` is the host port.

When a reverse proxy runs in the same Docker network, remove `ports` entirely and proxy to `sleeve:3001`. No host port is published, so no collision is possible.

### Images and tags

`bun run docker:build` builds a stamped release image and tags it twice:

- `sleeve:<version>` — exact release, treat as immutable.
- `sleeve:latest` — newest local build, moving pointer.

The script passes `SLEEVE_VERSION`, `SLEEVE_COMMIT`, `SLEEVE_DIRTY` and `SLEEVE_BUILD_DATE` as build args. Images carry OCI labels for version, revision, build date, source and license:

```bash
docker image inspect sleeve:latest --format '{{json .Config.Labels}}'
```

`docker compose up -d --build` also accepts `SLEEVE_VERSION` (default `dev`) and `SLEEVE_COMMIT`, but still tags the image `sleeve:latest`. Use `bun run docker:build` when you need an exact version tag.

### Published images

Tagged releases publish multi-arch images to GitHub Container Registry:

- `ghcr.io/nicuz/sleeve:<version>` — exact release.
- `ghcr.io/nicuz/sleeve:<major>.<minor>` — newest patch in that line.
- `ghcr.io/nicuz/sleeve:latest` — newest stable release.
- Platforms: `linux/amd64`, `linux/arm64`.

The package is public. If a pull asks for credentials, check the package visibility in GitHub package settings. Images appear after the first tagged release.

`docker-compose.image.yml` is the full runtime stack with auth and user-agent variables. The README and getting started show a shorter inline version without them. Set `SLEEVE_VERSION` to pin `0.1.0`, `0.1`, or another tag; the default is `latest`. With `latest`, an update action that runs `docker compose pull` picks up new releases.

Source builds keep using the root `docker-compose.yml` and its hardening options.

### Authentication

Set both variables, or neither:

```dotenv
SLEEVE_AUTH_USER=you
SLEEVE_AUTH_PASSWORD=secret
```

For Docker secrets, use the `_FILE` variants. They read the value from a file instead of an environment variable, so secrets stay out of `docker inspect` and `/proc`. They win over the plain variables:

```yaml
services:
  sleeve:
    secrets:
      - sleeve_auth_user
      - sleeve_auth_password
    environment:
      SLEEVE_AUTH_USER_FILE: /run/secrets/sleeve_auth_user
      SLEEVE_AUTH_PASSWORD_FILE: /run/secrets/sleeve_auth_password

secrets:
  sleeve_auth_user:
    file: ./secrets/auth_user
  sleeve_auth_password:
    file: ./secrets/auth_password
```

Keep `secrets/` out of git and mode `600`. Restart after changing auth values.

### Hardening

The compose file already applies these:

- runs as `uid/gid 1000` (`bun`), never root
- `cap_drop: ALL` and `no-new-privileges`
- read-only root filesystem with a small `/tmp` tmpfs
- data written with `0600` files and `0700` directories
- port published on `127.0.0.1` only
- health probes on `/api/health`

### Upgrades

Published image:

```bash
docker compose pull
docker compose up -d
```

Source build:

```bash
git pull
SLEEVE_COMMIT=$(git rev-parse --short HEAD) docker compose up -d --build
```

For source builds, `.git` is excluded from the image, so pass the commit at build time. Without it, **Settings → About** and `/api/version` show `unknown`.

Check what is running before and after an upgrade:

```bash
curl -s http://127.0.0.1:3001/api/version
```

The same version, commit and build date appear in **Settings → About**. Releases are tagged `vX.Y.Z`; `git fetch --tags && git describe --tags --always` shows the checkout you are on.

Startup applies pending migrations. If the database contains migrations newer than the running build, Sleeve refuses to start; restore a backup or deploy the newer version.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | Prisma SQLite URL |
| `PORT` | `3001` | Port inside the app/container |
| `SLEEVE_PORT` | `3001` | Host port published by Docker Compose |
| `SLEEVE_DATA_DIR` | `sleeve-data` | Named volume or absolute host path mounted at `/data` |
| `SLEEVE_VERSION` | `latest` | Image tag used by `docker-compose.image.yml` |
| `DATA_DIR` | `./data` (`/data` in Docker) | Covers and backups |
| `COVER_CACHE_DIR` | `$DATA_DIR/covers` | Cover cache override |
| `BACKUP_DIR` | `$DATA_DIR/backups` | Backups and import snapshots |
| `COVER_CACHE_MAX_MB` | `500` | Cover cache size limit |
| `AUTO_MIGRATE` | `true` | Apply pending migrations on production startup |
| `MUSICBRAINZ_USER_AGENT` | project URL | Contact for MusicBrainz requests |
| `NODE_ENV` | — | `production` for production mode |
| `SLEEVE_AUTH_USER` | unset | Optional HTTP Basic auth user |
| `SLEEVE_AUTH_PASSWORD` | unset | Optional HTTP Basic auth password |
| `SLEEVE_AUTH_USER_FILE` | unset | Read the auth user from a file |
| `SLEEVE_AUTH_PASSWORD_FILE` | unset | Read the auth password from a file |

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

For documentation changes:

```bash
bun run docs:build
```

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
| `EADDRINUSE` on 3001 | Another process owns the port. For Docker, set `SLEEVE_PORT`; for a source run, set `PORT`. |
| Docker: `unable to open database file` | The image entrypoint fixes bind-mount ownership. If you run with an explicit non-root `user:`, chown the data directory to that user or use the named volume. |
| New route/model missing | Dev API not restarted after schema/code change. |
| Prisma model undefined | Run `bun run db:push`/`db:generate`, restart dev. |
| Metadata not updating | Check MBID; use Refresh/Search match. |
| Cover fallback shown | CAA 404 for that edition; use Search match. |
| Search slow | MB rate limit/cooldown; results are cached. |
| PWA not registering | Production build only; service worker needs HTTPS or localhost. |
| Old UI after deploy | Service worker/browser cache; hard reload/clear site data. |
| Prices reject comma | Fixed: price inputs are text and `parsePriceInput` accepts comma/dot. If it regresses, check that inputs remain `type="text"`. |
| Import skipped everything | Duplicates by MBID or manual title/artist/format. |
