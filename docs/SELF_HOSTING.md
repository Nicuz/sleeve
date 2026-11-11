# Self-hosting Sleeve

Sleeve is a single-user app. Run one process, keep one data directory, back it up.

## Docker (recommended)

```bash
cp .env.example .env    # optional: set a real MusicBrainz contact
docker compose up -d --build
```

Open http://127.0.0.1:3001.

The compose file binds to localhost only and stores everything in the `sleeve-data` volume:

```text
/data/sleeve.db      SQLite database
/data/covers/        cover image cache (safe to delete)
/data/backups/       internal pre-import snapshots
```

Set a real contact so MusicBrainz can reach you:

```env
MUSICBRAINZ_USER_AGENT="Sleeve self-hosted (you@example.com)"
```

Expose it only through a reverse proxy with TLS (Caddy, Nginx, Traefik).

## Local process

```bash
bun install
cp .env.example .env
bun run db:deploy
bun run build
bun run start
```

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | required | SQLite URL, e.g. `file:/data/sleeve.db` |
| `PORT` | `3000` prod / `3001` dev | HTTP port |
| `DATA_DIR` | `./data` | Covers and backups |
| `COVER_CACHE_DIR` | `$DATA_DIR/covers` | Cover cache override |
| `BACKUP_DIR` | `$DATA_DIR/backups` | Backups |
| `COVER_CACHE_MAX_MB` | `500` | Cover cache size limit |
| `AUTO_MIGRATE` | `true` | Run migrations on production startup |
| `SLEEVE_AUTH_USER` | unset | Optional HTTP Basic auth user |
| `SLEEVE_AUTH_PASSWORD` | unset | Optional HTTP Basic auth password |
| `MUSICBRAINZ_USER_AGENT` | placeholder | Required contact for heavy use |

Set both auth variables together to enable Basic auth. Leave both empty for a LAN/local install.

Container checks:

```bash
bun run test:docker          # build release image + runtime smoke test
docker build --target test . # run the full test suite inside Docker
```

## Backups

Use **Settings → Backup & restore → Download backup** in the browser. The JSON file lands on the host, outside the container and outside the Docker volume. This is the primary backup.

Restore with **Restore a backup** in the browser. Preview, then add to the library or replace it.

Sleeve also writes automatic `pre-import-*.db` snapshots to `/data/backups` before each restore. Keep the last 5. They are an internal rollback safety net, not the main backup. They are not exposed in Settings.

Do not rely on the Docker volume as your only backup:

```bash
# This deletes the database, covers and snapshots.
docker compose down -v
```

### Exact snapshot restore in Docker

Stop the running app, run the restore in a one-off container, then start again:

```bash
docker compose stop sleeve
docker compose run --rm --entrypoint bun sleeve run restore -- pre-import-2026-11-09T22-00-00-000Z.db
docker compose start sleeve
```

Do not run `docker compose exec` against the live app for restore. It would replace a SQLite file under an active Prisma connection.

The restore command preserves the current database as `pre-restore-<timestamp>.db` before replacing it.

Back up the whole `DATA_DIR` volume if you want covers too.

## Upgrades

```bash
git pull
docker compose up -d --build
```

Startup applies pending Prisma migrations automatically. If the database contains migrations newer than the running build, Sleeve refuses to start. Restore a backup or deploy the newer version.

## Reverse proxy

Caddy:

```caddyfile
sleeve.example.com {
  reverse_proxy 127.0.0.1:3001
}
```

Keep `ports` bound to `127.0.0.1`; do not expose Bun directly to the internet.

## Troubleshooting

- **401 after enabling auth**: set both `SLEEVE_AUTH_USER` and `SLEEVE_AUTH_PASSWORD`; clear the browser's Basic auth cache.
- **Health check fails**: `/api/health` requires the database to be reachable. Check the volume mount and `DATABASE_URL`.
- **Migration error**: restore the latest backup, then upgrade to a matching version.
- **Empty covers**: cover cache is disposable; restart or use Settings → Metadata & cache to clear it.
- **MusicBrainz 503**: rate limited; wait for the cooldown.
