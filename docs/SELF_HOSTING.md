# Self-hosting Sleeve

Sleeve is a single-user app. Run one process, keep one data directory, back it up.

## Docker (recommended)

```bash
cp .env.example .env    # optional: set a real MusicBrainz contact
docker compose up -d --build
```

Open http://127.0.0.1:3001.

The compose file binds to localhost only and stores everything in the `sleeve-data` volume. No database variables are needed — the container defaults to `/data/sleeve.db`:

```text
/data/sleeve.db      SQLite database
/data/covers/        cover image cache (safe to delete)
/data/backups/       internal pre-import snapshots
```

The default user agent points to the project URL, which is enough contact for
normal use. Add your email if you plan to fetch a lot of metadata:

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
| `DATABASE_URL` | `$DATA_DIR/sleeve.db` in Docker | SQLite URL; required when running from source |
| `PORT` | `3000` prod / `3001` dev | HTTP port |
| `DATA_DIR` | `./data`, `/data` in Docker | Covers and backups |
| `COVER_CACHE_DIR` | `$DATA_DIR/covers` | Cover cache override |
| `BACKUP_DIR` | `$DATA_DIR/backups` | Backups |
| `COVER_CACHE_MAX_MB` | `500` | Cover cache size limit |
| `AUTO_MIGRATE` | `true` | Run migrations on production startup |
| `SLEEVE_AUTH_USER` | unset | Optional HTTP Basic auth user |
| `SLEEVE_AUTH_PASSWORD` | unset | Optional HTTP Basic auth password |
| `SLEEVE_AUTH_USER_FILE` | unset | Read the auth user from a file |
| `SLEEVE_AUTH_PASSWORD_FILE` | unset | Read the auth password from a file |
| `MUSICBRAINZ_USER_AGENT` | project URL | Contact for MusicBrainz requests |

Set both auth variables together to enable Basic auth; leave both empty for a LAN install. They are read at startup, so restart after changing them.

### Auth secrets in files

Plain environment variables are visible to `docker inspect` and in `/proc`. To keep credentials out, point the `_FILE` variants at files instead — they win over the plain variables:

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

Keep `secrets/` out of git and readable only by you (`chmod 600`). A trailing newline is fine.

Container checks:

```bash
bun run test:docker          # build release image + runtime smoke test
docker build --target test . # run the full test suite inside Docker
```

## Hardening

The compose file already applies these; keep them if you deploy your own:

- runs as `uid/gid 1000` (`bun`), never root
- bind-mounting a host folder owned by another user? Either `sudo chown -R 1000:1000 ./data` or add `user: "<uid>:<gid>"` to the service
- `cap_drop: ALL` and `no-new-privileges`
- read-only root filesystem, with `/tmp` as a 64 MB tmpfs
- data written with `0600` files and `0700` directories (`umask 077`)
- port published on `127.0.0.1` only
- health probes on `/api/health`

Sleeve speaks plain HTTP. If it leaves localhost, terminate TLS in front of it.

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
