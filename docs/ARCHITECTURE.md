# Architecture

## Overview

Sleeve is one Bun process (API, and in production also the static frontend) plus a Vite-built React SPA. SQLite is the local source of truth for the user’s collection and wishlist; remote MusicBrainz data is cached separately.

```text
React SPA
  │  JSON over /api
  ▼
Elysia (Bun)
  ├── Prisma → SQLite (Release, Track, WishlistItem, MetadataCache)
  ├── MusicBrainz service → MetadataCache + rate limiter + single-flight
  └── Cover proxy → disk cache (data/covers)
```

## Runtime modes

### Development

- `bun run dev` starts:
  - API on `PORT` (`3001`, from `.env`)
  - Vite on `5173`, proxying `/api` to `3001`
- Vite serves the SPA; the API does not serve `dist/`.
- Service worker is not registered.

### Production

- `bun run build` writes `dist/`.
- `bun run start` sets `NODE_ENV=production`.
- `server/index.ts` starts `Bun.serve`:
  - `/api/*` → Elysia
  - existing files under `dist/` → static response
  - everything else → `dist/index.html` (SPA fallback)
- Production port is `PORT` (`3001` in the local `.env`).
- Service worker registration happens in `src/main.tsx` only under `import.meta.env.PROD`.

## Backend modules

### `server/index.ts`

Creates the Elysia app and mounts route plugins. In production it also serves the built SPA and implements a normalized path check to prevent static path traversal.

### `server/musicbrainz.ts`

The only module allowed to call MusicBrainz or Cover Art Archive APIs.

Responsibilities:

- Fixed `User-Agent`.
- Global serialized request chain with at least 1.2s between requests.
- Retries for transient `503`, then a 30s global cooldown.
- Persistent cache in SQLite `MetadataCache`.
- Single-flight for identical in-flight requests.
- AbortSignal propagation so cancelled client requests are dropped before consuming rate-limit slots.
- Mapping raw MusicBrainz payloads to internal `SearchResult`, `ReleaseDetail`, artist and release-group shapes.
- `refreshRelease` bypasses the normal cache read and stores fresh detail.

TTLs:

| Tier | TTL |
| --- | --- |
| Search / artist search / genre release-group search | 30 min |
| Release detail / artist detail / artist group pages | 7 days |
| Empty search result | 10 min |

Search results include `score`; artist results include `score`, type, area, country, life span and disambiguation. Artist detail includes genres/tags, selected external links and the first 100 release groups plus a total count.

### `server/release-metadata.ts`

Metadata application and matching:

- `applyReleaseDetail(releaseId, detail)`
  - Deletes/recreates tracks in one transaction.
  - Updates MB-derived fields and `musicbrainzId`.
  - Preserves user fields: `format`, `condition`, `rating`, `notes`, purchase fields.
- `enrichReleaseById(releaseId)`
  - Existing MBID → fetch/apply detail.
  - Manual release → barcode search, then `artist + title`, then title fallback.
  - Ranks candidates by title, artist, format, year, barcode, catalog number and MB relevance.
  - Requires confidence ≥ 75; rejects duplicate MBIDs.
- `applyReleaseMatch(releaseId, mbid)`
  - Applies a user-selected edition.
  - Rejects MBIDs already used by another release.

### `server/routes/`

| Module | Responsibility |
| --- | --- |
| `releases.ts` | CRUD, list filters, owned lookup, refresh/enrich/manual match, clear library |
| `musicbrainz.ts` | Release search, barcode search, artist search/detail, group pages, release detail |
| `wishlist.ts` | Wishlist CRUD |
| `discover.ts` | Genre-based suggestions |
| `import.ts` | Merge-safe JSON import (releases + wishlist) |
| `export.ts` | JSON (releases, tracks, wishlist) and CSV (release/track rows) |
| `stats.ts` | Collection stats, spending stats, missing-metadata count |
| `meta.ts` | Format/genre/decade filter options |
| `maintenance.ts` | Metadata cache stats + clear |
| `covers.ts` | Allowlisted Cover Art Archive proxy + disk cache |

## Request flows

### Add a release

1. Add dialog searches releases through `/api/musicbrainz/search`.
2. Artist suggestions are derived from the release search results; no separate artist call by default.
3. User can explicitly request an artist search, or click an artist to open the artist page.
4. Clicking a result fetches full release detail unless the MBID is already owned.
5. On save, `/api/releases` stores release and tracks in SQLite.
6. After save, the app navigates to `/releases/:id`, which reads from SQLite.

### Library and release pages

Library list, filters, stats and release details read Prisma/SQLite only. No MusicBrainz call is made to render an owned release.

### Refresh and enrichment

- Per-release **Refresh** (existing MBID): fetch fresh detail and apply.
- **Fetch metadata** (manual): auto-match and apply.
- **Search match** (always available): search MusicBrainz, user selects the exact edition, `/apply-match` applies it.
- Library batch **Download metadata**: client processes missing releases sequentially via `/enrich`, showing progress. Running against many records can take time because of MusicBrainz rate limits.

“Missing metadata” means no MBID, no cover URL, or no track count. A cover URL may exist while CAA still returns 404; the release page also detects image failure and offers **Search match**.

### Metadata cache and cancellation

- Every MB endpoint builds a cache key and calls `withCache`.
- Cache reads/writes are best-effort; a cache failure never breaks the reply.
- Identical requests share a flight.
- Client query functions pass `AbortSignal`; routes pass `request.signal`; the MB service drops aborted queued tasks.
- Expired cache rows are pruned opportunistically.

### Cover proxy

Frontend `CoverArt` rewrites `https://coverartarchive.org/...` URLs to `/api/cover?url=…`.

The proxy:

- allows only HTTPS `coverartarchive.org` URLs;
- uses single-flight;
- stores image + content-type metadata in `data/covers`;
- caps images at 5MB;
- returns immutable browser cache headers;
- responds with `x-cover-cache: HIT|MISS`.

Non-CAA manual image URLs are rendered directly.

### Imports

#### JSON import/restore

- Settings sends a parsed JSON file to `POST /api/import`.
- Payload may contain `releases` and optional `wishlist`.
- Dedupe:
  - releases with MBID → MBID
  - manual releases → normalized title + artist + format
  - wishlist uses the same rules
- Duplicate/invalid rows are counted and skipped.
- Creates release tracks in one transaction with the release rows.

#### Discogs CSV import

- `/import/csv` is lazy-loaded.
- Papa Parse reads the CSV client-side.
- `src/lib/discogs.ts` auto-maps columns by normalized header synonyms.
- Mapping changes update a live preview immediately.
- Transform normalizes format, condition, rating, dates, year, comma/dot prices and currency.
- Rows without title or artist are skipped.
- The mapped array is sent to the generic `/api/import`, so the same dedupe and validation apply.

### Wishlist

Wishlist is a separate table, not a release status. It represents buy intent only. Items can be added from MusicBrainz search results without fetching full release detail. Target price/currency and notes are editable per item. Wishlist state is not part of collection stats.

### Saved suggestions

Discover bookmarks live in `SavedSuggestion`, not Wishlist. Saving stores only release-group metadata. The Saved tab in Discover can promote a suggestion into Wishlist, which creates a `WishlistItem` and removes the saved row. Saved items are excluded from future Discover feeds.

### Discovery

`server/discovery.ts` composes a cached feed from three sources:

- **Release Radar** — top 15 owned artists by collection count. One MusicBrainz query batched across their artist IDs, 60-day window, albums/EPs only.
- **New this week** — top 3 genres. One date-windowed tag query per genre, albums/EPs from the last 30 days, owned artists excluded.
- **Crate dig** — older albums/EPs from those genres, shuffled for serendipity.

Feed rules:

- Mixes only studio albums/EPs; no secondary types.
- Removes owned releases, wishlist items, duplicates, Various Artists and repeated artists.
- Caps: 8 Radar, 8 New, 8 Crate, with artist diversity limits.
- First Radar item becomes the lead pick and is removed from its section.
- Feed snapshots live in `DiscoveryFeed` for 6 hours; `?refresh=1` regenerates.
- Returned release-group IDs are stored in `DiscoverySeen` for 30 days and deprioritised on later generations.
- Saved and wishlisted release groups are excluded from new feeds.
- Card opens a suggestion dialog with **Add to wishlist**, **Save for later** and **I already own it**. Owning opens the edition picker; Discover never creates a release directly. Artist link opens `/artists/:mbid`.

### PWA/offline

`public/sw.js`:

- Pre-caches the shell, built JS/CSS assets parsed from `index.html`, core icons and key API GETs.
- Navigation: network-first, fallback to cached `index.html`.
- Static assets and `/api/cover`: cache-first.
- Selected API GETs: network-first, fallback to cache.
- Cache groups: shell, runtime assets, API, covers.
- Registered only in production.
- An offline banner appears when the browser goes offline.

## Frontend structure

### Routes

| Path | Page |
| --- | --- |
| `/` | Library |
| `/releases/:id` | Release detail, edit, refresh, enrich, manual match |
| `/artists/:mbid` | Artist detail + paginated discography |
| `/wishlist` | Wishlist |
| `/discover` | Genre-based discovery |
| `/stats` | Collection + spending insights |
| `/settings` | Appearance, defaults, data, metadata cache, about |
| `/import/csv` | Lazy-loaded Discogs CSV mapping |

### State

- TanStack Query owns server state and abort signals.
- `AppProvider` owns Add dialog state and its optional preset (`rgid:` / artist query).
- Settings use `localStorage` key `sleeve:settings:v1`.
- Wishlist add/edit dialogs and metadata dialogs are local component state.
- Toasts have a small custom provider.

Visual language and component patterns are documented in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

### Filtering and defaults

- Library filters live in URL search params (`q`, `format`, `genre`, `decade`, `sort`, `view`).
- Default view/sort/format/condition/currency come from settings.
- Settings accent changes CSS variables at runtime.

## Source of truth

| Data | Source |
| --- | --- |
| Owned releases/tracks | SQLite `Release`/`Track` |
| Wishlist | SQLite `WishlistItem` |
| MusicBrainz payload cache | SQLite `MetadataCache` |
| Cover images | `data/covers` disk cache |
| User preferences | Browser `localStorage` |
| Filter state | URL params |

## Key extension points

- Add a new MB endpoint only in `server/musicbrainz.ts` and wrap it with `withCache`.
- Add a new page under `src/pages/` and register in `src/App.tsx`; lazy-load heavy tools.
- Add a new DB field: update Prisma schema, `db:push`, server schemas, response types, export/import mapping, UI and docs.
- For destructive operations, require explicit confirmation and never run them automatically.
