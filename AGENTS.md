# Sleeve — Project Instructions

Sleeve is a single-user CD/vinyl library built with Bun, Elysia, React/Vite, Tailwind v4, Prisma and SQLite. Read this file before changing code. Deeper docs live in `docs/`. Tool-specific skills live in `.agents/skills/` and work with OpenCode, Codex and Claude Code.

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
bun run dev:temp     # API :3099 against a disposable temp database
bun run check        # typecheck + lint + bun test + production build
bun run docs:build   # VitePress docs site -> docs/.vitepress/dist
bun run test         # bun test (integration tests create their own temp DBs)
bun run build        # dist/
bun run start        # production server, serves dist + API on PORT (.env: 3001)
bun run db:push      # quick local schema sync only; skips migrations and FTS triggers
bun run db:migrate   # create a migration after a schema change
bun run db:deploy    # apply prisma/migrations (required for FTS search index)
bun run db:generate  # regenerate Prisma client
bun run db:studio    # Prisma Studio
bun run seed         # add demo records if missing; skips existing
bun run seed -- --reset  # DESTRUCTIVE: wipe library, then seed
```

After a Prisma schema change: create a migration with `bun run db:migrate`, apply it with `bun run db:deploy`, then restart `bun run dev` so Bun reloads `@prisma/client`. `db:push` is fine for throwaway local iteration, but it skips the FTS triggers and search silently falls back to the slower `contains` path.

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
- `server/routes/` — releases, global search, wishlist, saved suggestions, follows, settings, discovery, import, export, stats, metadata cache, covers, maintenance, meta, MusicBrainz proxies.
- `shared/search-query.ts` — parses `artist:`, `label:`, `catalog:`, `year:`, `format:`, `track:`, `title:`, `genre:` operators; the client (`src/lib/search-query.ts`) re-exports it.
- `server/search-query.ts` — turns parsed operators into Prisma filters for releases and wishlist.
- `server/search-index.ts` — SQLite FTS5 lookup with `contains` fallback; `prisma/migrations/20261111190000_search_fts` creates the table and triggers.
- `prisma/schema.prisma` — `Release`, `Track`, `WishlistItem`, `SavedSuggestion`, `ArtistFollow`, `AppSettings`, `MetadataCache`, `DiscoveryFeed`, `DiscoverySeen`, `DiscoveryEvent`.
- `server/discovery.ts` — builds the cached Discover feed (Release Radar, New this week, New this month, Lost in the Stacks), expands candidates with similar artists, ranks with library affinity + ListenBrainz popularity and refreshes automatically.
- `server/listenbrainz.ts` — batched release-group and artist popularity plus similar-artist lookup, with in-memory caches and 1s request spacing.
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
- `MetadataCache` caches MusicBrainz payloads only. `DiscoveryFeed`/`DiscoverySeen`/`DiscoveryEvent` store discovery snapshots, exposure history and implicit interactions. `SavedSuggestion` stores Discover bookmarks only.
- Cover Art Archive URLs are stored in DB, but rendered through `/api/cover?url=…` (disk cache in `data/covers`).
- Wishlist is a separate table; it is not a library status. Wishlist means buy intent only. Discover bookmarks live in `SavedSuggestion`, not Wishlist.
- JSON export includes releases, tracks and wishlist. CSV import is mapped client-side then sent to generic `/api/import`.
- PWA works only in a production build; no service worker is registered in dev.

## UI rules

- Design: dark “vinyl lounge”, warm amber default, Space Grotesk/Inter, rounded cards, Spotify-like shell.
- Use existing tokens/components; don’t hardcode new palettes.
- Use `CoverArt` for every cover; it proxies CAA and handles fallbacks.
- Every icon-only button needs `aria-label`.
- Check desktop and mobile. Mobile nav has 4 destinations plus the center add button; settings lives in the header.
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
- **Tests exist:** `bun test` covers search parsing, Discogs mapping, settings, header UI and temp-DB import/export/migration flows. No Playwright setup is committed. Manual verification must avoid mutating user data; use `scripts/temp-db.sh`, temporary records, or a copied DB.

## Before finishing

1. `bun run check`
2. Run targeted tests for touched logic (`bun test path/to/file.test.ts`).
3. For manual flows, use `scripts/temp-db.sh` instead of the real DB.
4. Test the touched flow on desktop and mobile.
5. Confirm no test records remain: `bun -e 'const { prisma } = await import("./server/db"); console.log(await prisma.release.count())'`
6. Update the matching doc when behavior, schema, API or commands change.
7. If docs changed, run `bun run docs:build`.
8. `git status` and commit only if asked.

## Skills

Procedural playbooks live in `.agents/skills/` (portable skill format). OpenCode and Codex read that path natively; Claude Code reads it through the `.claude/skills` symlink.

| Skill | Load when |
| --- | --- |
| `sleeve-data-safety` | Touching Prisma, seeds, migrations, backups, test data or destructive routes |
| `sleeve-feature-slice` | Adding or changing a field, endpoint, page or cross-layer behavior |
| `sleeve-ui-change` | Building or changing pages, dialogs, cards, filters or navigation |
| `sleeve-musicbrainz` | Working on metadata, enrichment, refresh, artists or Discover queries |
| `sleeve-verify` | Finishing a task; run the definition-of-done checks |

Skills carry procedures only. Static facts (models, routes, commands, invariants) stay in this file and `docs/`; update them there, not inside a skill.

## Fast lookup

Use these before exploring the whole repo:

| Question about | Read |
| --- | --- |
| Discover inputs, ranking, popularity, cache, refresh | `docs/development/discovery.md` |
| User-facing workflows | `docs/guide/` |
| Docker, auth, upgrades | `docs/development/operations.md#production` |
| Overall flows and component layout | `docs/development/architecture.md` |
| API request/response shapes | `docs/development/api.md` |
| Database fields, invariants, import/export | `docs/development/data-model.md` |
| UI patterns, colors, page rules | `docs/development/design-system.md` |
| Dev/prod, backups, troubleshooting | `docs/development/operations.md` |
| Why a technical choice was made | `docs/development/decisions.md` |

## Docs

- `README.md` — setup and overview
- `docs/index.md` — docs site landing page
- `docs/guide/` — user guide, including server steps
- `docs/development/architecture.md` — flows and design
- `docs/development/discovery.md` — Discover inputs, queries, ranking, cache and refresh
- `docs/development/design-system.md` — visual language and component patterns
- `docs/development/api.md` — endpoints
- `docs/development/data-model.md` — schema, invariants, import/export
- `docs/development/operations.md` — dev/prod, backups, troubleshooting
- `docs/development/decisions.md` — architectural decisions
- `CONTRIBUTING.md` — commit/branch conventions
