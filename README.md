# Sleeve

A private, single-user CD and vinyl library with a warm, Spotify-inspired interface. Built with Bun, Elysia, React, Tailwind, Prisma and SQLite.

## What it does

- Catalog owned releases with cover art, label, catalog number, barcode, genres and tracklists.
- Search MusicBrainz by release, barcode or artist; browse artist discographies and add a specific edition.
- Track purchase date, shop, price and currency; see spending insights by month, format and shop.
- Keep a separate wishlist with target prices and priorities.
- Discover new artists and studio albums from the genres in your collection.
- Enrich manual records automatically or pick a MusicBrainz edition manually.
- Import Discogs collection CSVs with automatic column detection, visual mapping and live preview.
- Export/import a JSON backup of releases, tracks and wishlist.
- Work offline in a production build through the PWA service worker.

## Stack

| Layer | Technology |
| --- | --- |
| Runtime | Bun 1.4+ |
| API | Elysia 1.4 |
| Frontend | React 19, Vite 8, React Router 7, TanStack Query 5 |
| Styling | Tailwind CSS 4, custom CSS tokens |
| Data | SQLite, Prisma 6 |
| Metadata | MusicBrainz web service, Cover Art Archive |
| CSV | Papa Parse |
| PWA | Custom service worker + web manifest |

## Quick start

```bash
bun install
cp .env.example .env   # if missing
bun run db:deploy
bun run seed           # optional demo library
bun run dev
```

- UI: http://localhost:5173
- API: http://localhost:3001
- DB: `prisma/dev.db` (ignored by git)

Production:

```bash
bun run db:deploy
bun run build
bun run start
```

PWA/service worker is registered only in production builds.

## Environment

`.env`:

```env
DATABASE_URL="file:./dev.db"
PORT=3001
MUSICBRAINZ_USER_AGENT="Sleeve/0.1 ( https://github.com/local/sleeve )"
```

Set a real contact in `MUSICBRAINZ_USER_AGENT` before heavy use. The MusicBrainz service layer enforces 1.2s spacing, retries, cooldown, caching and single-flight.

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | API + Vite dev server |
| `bun run check` | TypeScript + Biome + production build |
| `bun run lint` | Biome lint/format check |
| `bun run format` | Apply Biome formatting |
| `bun run build` | Build `dist/` |
| `bun run start` | Production Bun server |
| `bun run db:migrate` | Create/apply migrations in development |
| `bun run db:deploy` | Apply migrations in production |
| `bun run db:push` | Legacy: push schema without migration history |
| `bun run db:generate` | Regenerate Prisma client |
| `bun run db:studio` | Open Prisma Studio |
| `bun run seed` | Add missing demo records |
| `bun run seed -- --reset` | **Destructive:** wipe library, then seed |

## Project structure

```text
server/
  index.ts                 Elysia app + production static server
  musicbrainz.ts           MB/CAA client, cache, rate limiting, single-flight
  release-metadata.ts      enrichment, refresh, manual match
  routes/                  releases, wishlist, discover, import, export, stats, covers…
prisma/
  schema.prisma            Release, Track, WishlistItem, MetadataCache
  seed.ts                  demo data
src/
  pages/                   library, release, artist, wishlist, discover, stats, settings, import
  components/              shell, cards, dialogs, cover art, toasts
  lib/                     API client, types, settings, Discogs mapping, utils
public/
  sw.js                    PWA service worker
  manifest.webmanifest     PWA manifest
docs/                      architecture, API, data, operations, roadmap, decisions
```

## Data and backups

The SQLite database is the source of truth for the owned collection. MusicBrainz responses are cached separately in `MetadataCache`; covers are cached on disk in `data/covers/`.

- JSON export: Settings → Library data, or `GET /api/export?format=json`
- CSV release export: `GET /api/export?format=csv`
- JSON restore: Settings → Import JSON (merge-safe, skips duplicates)
- Discogs CSV import: Settings or Library → Import CSV
- Manual DB backup: copy `prisma/dev.db` while the server is stopped

Never run `bun run seed -- --reset` on a real library.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [API](docs/API.md)
- [Data model](docs/DATA_MODEL.md)
- [Operations](docs/OPERATIONS.md)
- [Roadmap](docs/ROADMAP.md)
- [Decisions](docs/DECISIONS.md)
- [Contributing](CONTRIBUTING.md)
- [OpenCode project instructions](AGENTS.md)

## Current limitations

- Single-user only, no authentication or sync.
- No audio playback or streaming integrations.
- Discovery is genre/tag-based, not collaborative filtering.
- Discogs CSV imports have no MusicBrainz ID or cover; use metadata enrichment.
- Some Cover Art Archive editions have no image; use **Search match** to choose another edition.
- Prisma uses `db push` rather than migrations (acceptable for this local prototype; switch before multi-instance deployment).
