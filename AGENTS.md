# Sleeve — OpenCode Project Instructions

Sleeve is a single-user CD/vinyl library built with Bun, Elysia, React/Vite, Tailwind v4, Prisma and SQLite. Read this file before changing code. Deeper docs live in `docs/`.

## Golden rules

- **Never reset or reseed the user's database without explicit permission.** `bun run seed -- --reset` deletes the library.
- **The SQLite database is the user's real collection.** Do not run destructive maintenance while testing.
- **Do not commit** `.env`, `prisma/dev.db`, `data/` (cover cache), `dist/` or `node_modules/`.
- **Do not commit unless explicitly asked.**
- **One logical change per commit.** Use Conventional Commits (`feat:`, `fix:`, `perf:`, `docs:`, `refactor:`…).
- **Run `bun run check` before considering work done.**
- Preserve user-owned fields during metadata updates: condition, rating, notes, purchase date/location/price/currency.
- Keep all MusicBrainz calls inside `server/musicbrainz.ts` so rate limiting, caching and single-flight stay centralized.

## Commands

```bash
bun install
bun run dev          # API :3001 + Vite :5173
bun run check        # tsc --noEmit + production build
bun run build        # dist/
bun run start        # production server, serves dist + API on PORT (.env: 3001)
bun run db:push      # apply Prisma schema to SQLite (no migrations)
bun run db:generate  # regenerate Prisma client
bun run db:studio    # Prisma Studio
bun run seed         # add demo records if missing; skips existing
bun run seed -- --reset  # DESTRUCTIVE: wipe library, then seed
```

After a Prisma schema change: `bun run db:push`, then restart `bun run dev` so Bun reloads `@prisma/client`.

## Architecture map

### Backend

- `server/index.ts` — Elysia app. Dev: API only. Production: serves `dist/` and SPA fallback.
- `server/db.ts` — Prisma singleton.
- `server/musicbrainz.ts` — MusicBrainz + Cover Art Archive integration:
  - 1.2s request spacing, retries on 503, 30s cooldown.
  - SQLite `MetadataCache` with tiered TTLs (search 30m, details 7d, negative 10m).
  - Single-flight, abort propagation via `AbortSignal`, `refreshRelease`.
  - Artist search/detail, release groups, genre discovery search.
- `server/release-metadata.ts` — enrichment:
  - `applyReleaseDetail` (preserves user fields)
  - `enrichReleaseById` (barcode → artist/title → title fallback, score threshold 75)
  - `applyReleaseMatch` (manual MusicBrainz ID)
- `server/routes/` — releases, wishlist, discovery, import, export, stats, metadata cache, covers, meta, MusicBrainz proxies.
- `prisma/schema.prisma` — `Release`, `Track`, `WishlistItem`, `SavedSuggestion`, `MetadataCache`, `DiscoveryFeed`, `DiscoverySeen`.
- `server/discovery.ts` — builds the cached Discover feed (Release Radar, New this week, Crate dig).
- `prisma/seed.ts` — demo data. Destructive only with `--reset`.

### Frontend

- `src/App.tsx` — routes: `/`, `/releases/:id`, `/artists/:mbid`, `/wishlist`, `/discover`, `/stats`, `/settings`, `/import/csv`.
- `src/pages/` — one page per route.
- `src/components/` — dialogs, cards, shell, cover art, metadata match/enrich, wishlist, spending.
- `src/lib/api.ts` — typed fetch client.
- `src/lib/types.ts` — shared client types.
- `src/lib/settings.tsx` — localStorage settings (`sleeve:settings:v1`): accent, defaults, currency, view, sort.
- `src/lib/discogs.ts` — Discogs CSV field detection, mapping, normalization.
- `src/index.css` — Tailwind theme tokens and component classes (`.panel`, `.btn`, `.input`, `.chip`, `.eyebrow`).
- `public/sw.js` — PWA service worker, registered only in production.

## Source-of-truth rules

- Owned releases and tracks live in SQLite. Library/release pages read the DB, not MusicBrainz.
- `MetadataCache` caches MusicBrainz payloads only. `DiscoveryFeed`/`DiscoverySeen` store discovery snapshots and exposure history. `SavedSuggestion` stores Discover bookmarks only.
- Cover Art Archive URLs are stored in DB, but rendered through `/api/cover?url=…` (disk cache in `data/covers`).
- Wishlist is a separate table; it is not a library status. Wishlist means buy intent only. Discover bookmarks live in `SavedSuggestion`, not Wishlist.
- JSON export includes releases, tracks and wishlist. CSV import is mapped client-side then sent to generic `/api/import`.
- PWA works only in a production build; no service worker is registered in dev.

## UI rules

- Design: dark “vinyl lounge”, warm amber default, Space Grotesk/Inter, rounded cards, Spotify-like shell.
- Use existing tokens/components; don’t hardcode new palettes.
- Use `CoverArt` for every cover; it proxies CAA and handles fallbacks.
- Every icon-only button needs `aria-label`.
- Check desktop and mobile. Mobile nav has 5 destinations.
- Discover cards open a suggestion dialog; creating a release goes through the edition picker.
- Avoid comments in code unless intent is non-obvious.

## Data invariants

- `Release.format` is a normalized category: `CD`, `Vinyl`, `Cassette`, `Digital`, `Other`. Raw format goes in `formatDetail`.
- `Release.genres` is a comma-separated string.
- Tracks are ordered by `disc`, `number`, then `position`. Cascade delete from release.
- Purchase date and `releaseDate` are date-only strings (`YYYY-MM-DD`) where possible.
- Prices are numbers; UI inputs are text and `parsePriceInput` accepts `3,50` and `3.50`.
- MusicBrainz IDs are unique (`musicbrainzId`), but null is allowed. `releaseGroupId` is also unique when present and is used by Discover saves.

## Enrichment behavior

- `POST /api/releases/:id/enrich`: if MBID exists, refresh; otherwise search and auto-match conservatively.
- `POST /api/releases/:id/apply-match`: user-selected MBID; rejects duplicates already in the library.
- `POST /api/releases/:id/refresh`: force fresh MB detail for an existing MBID.
- Auto-match preserves format, condition, rating, notes and purchase fields. It updates title/artist/IDs/cover/tracks.
- Missing metadata means: no MBID, no cover URL, or no track count.

## Known gotchas

- **Stale Prisma client:** after schema/model changes, restart the dev API. Old processes can keep the previous generated client.
- **MusicBrainz 503:** wait for cooldown; don’t bypass the service layer.
- **CAA 404s:** some editions genuinely have no cover. Use “Search match” and pick another edition; cover failure has its own CTA.
- **PWA stale shell:** production only; hard reload or clear site data if the service worker serves an old build.
- **Port conflict:** `.env` sets `PORT=3001`; dev API and production both use it.
- **User data:** current DB may contain real imported records. Do not reseed for convenience.
- **No test suite committed:** use `bun run check` plus manual/Playwright flows. All verification must avoid mutating user data; use temporary records and delete them, or copy the DB.

## Before finishing

1. `bun run check`
2. Test the touched flow on desktop and mobile.
3. Confirm no test records remain: `bun -e 'import { prisma } from "./server/db"; …'`
4. `git status` and commit only if asked.

## Docs

- `README.md` — setup and overview
- `docs/ARCHITECTURE.md` — flows and design
- `docs/DESIGN_SYSTEM.md` — visual language and component patterns
- `docs/API.md` — endpoints
- `docs/DATA_MODEL.md` — schema, invariants, import/export
- `docs/OPERATIONS.md` — dev/prod, backups, troubleshooting
- `docs/ROADMAP.md` — completed, next, deferred
- `docs/DECISIONS.md` — architectural decisions
- `CONTRIBUTING.md` — commit/branch conventions
