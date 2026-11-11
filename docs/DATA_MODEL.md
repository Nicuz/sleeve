# Data model

SQLite database: `prisma/dev.db`. Prisma schema: `prisma/schema.prisma`.

This project uses `prisma db push` (no migration history). That is fine for the local prototype; switch to migrations before deploying multi-instance or applying production schema changes.

## Release

Owned release/edition.

| Field | Notes |
| --- | --- |
| `id` | CUID primary key |
| `musicbrainzId` | Unique when present; null for manual records |
| `title`, `artist` | Display fields; updated by enrichment/refresh |
| `artistId` | MusicBrainz artist MBID when known |
| `year` | Parsed release year |
| `releaseDate` | Date-ish string; date-only when known |
| `country` | Release country |
| `label`, `catalogNumber`, `barcode` | Release identifiers |
| `format` | Normalized category: `CD`, `Vinyl`, `Cassette`, `Digital`, `Other` |
| `formatDetail` | Raw MusicBrainz/Discogs format string |
| `coverUrl` | Usually CAA release URL; rendered through proxy |
| `notes` | User-owned text |
| `rating` | 1–5 or null |
| `condition` | User-owned condition label |
| `purchaseDate` | `YYYY-MM-DD` when known |
| `purchaseLocation` | Shop/place |
| `purchasePrice` | Number or null |
| `purchaseCurrency` | ISO-style code, e.g. `EUR` |
| `genres` | Comma-separated string |
| `trackCount` | Cached count, also derived from tracks on import/refresh |
| `createdAt`, `updatedAt` | Managed timestamps |

Indexes: artist, format, year, createdAt.

## Track

Child of `Release`.

| Field | Notes |
| --- | --- |
| `id` | CUID |
| `releaseId` | FK, cascade delete |
| `position` | Global ordering integer |
| `disc` | Disc number when multi-disc |
| `number` | Track number within disc |
| `title` | Required |
| `duration` | Seconds or null |
| `artist` | Track artist if different from release artist |

Display/order rule: `disc`, then `number`, then `position`. On refresh/enrichment, tracks are deleted and recreated in one transaction.

## WishlistItem

Separate from owned releases.

| Field | Notes |
| --- | --- |
| `id` | CUID |
| `musicbrainzId` | Unique when present; absent for release-group-only items |
| `releaseGroupId` | Unique when present; set when adding a Discover release group |
| `title`, `artist`, `artistId` | Same semantics as Release |
| `year`, `releaseDate`, `country`, `label`, `catalogNumber`, `barcode` | Optional metadata |
| `format`, `formatDetail`, `coverUrl` | Optional/display data |
| `notes` | User notes |
| `targetPrice`, `targetCurrency` | Optional target |
| `createdAt`, `updatedAt` | Timestamps |

No tracklist, condition, rating or purchase fields: wishlist items are not owned copies. Wishlist means buy intent only.

## SavedSuggestion

Lightweight Discover bookmark, kept out of Wishlist until the user decides to buy.

| Field | Notes |
| --- | --- |
| `id` | CUID |
| `releaseGroupId` | Unique MusicBrainz release-group MBID |
| `title`, `artist`, `artistId` | Display metadata |
| `year`, `releaseDate`, `coverUrl` | Optional metadata |
| `type` | `Album`, `EP`, etc. |
| `createdAt` | Saved timestamp |

Promoting a saved suggestion creates a `WishlistItem` and deletes the saved row. Saved suggestions are not part of wishlist counts or target totals.

Wishlist is not part of collection stats.

## ArtistFollow

Explicit “show me more from this artist” signal. It is not a wishlist or saved item and does not imply ownership.

| Field | Notes |
| --- | --- |
| `artistId` | MusicBrainz artist MBID, primary key |
| `name` | Display name captured when followed |
| `createdAt` | Follow timestamp |

Index: `name`. Follows feed Discover affinity and similar-artist seeds. Unfollowing only removes the signal; it creates no negative event. Followed artists are never excluded from Discover.

## AppSettings

Single-row table for library defaults that must survive browser storage loss and be included in backups.

| Field | Notes |
| --- | --- |
| `id` | Always `default` |
| `defaultFormat` | Default format for manual releases |
| `defaultCondition` | Default condition on new entries |
| `defaultCurrency` | Default purchase currency |
| `updatedAt` | Last update |

Missing row means built-in defaults; the API returns defaults without creating a row.

## MetadataCache

Persistent MusicBrainz payload cache.

| Field | Notes |
| --- | --- |
| `key` | Primary key, e.g. `mb:release:<mbid>` |
| `payload` | JSON string |
| `expiresAt` | TTL expiry |
| `createdAt`, `updatedAt` | Timestamps |

Index: `expiresAt`.

TTL tiers (see `server/musicbrainz.ts`):

- search/artist search/genre search: 30 minutes
- release detail/artist detail/group pages: 7 days
- empty search result: 10 minutes

Expired rows are deleted on access and opportunistically pruned. Clearing this table does not touch the collection.

## DiscoveryFeed

Single cached Discover payload.

| Field | Notes |
| --- | --- |
| `id` | Always `current` |
| `payload` | JSON discovery feed, including algorithm `version` |
| `generatedAt` | Last generation time |
| `expiresAt` | Feed TTL (7 days) |

`?refresh=1` replaces this row immediately.

## DiscoverySeen

Release groups already shown in Discover.

| Field | Notes |
| --- | --- |
| `releaseGroupId` | MusicBrainz release-group MBID, primary key |
| `artistId` | Optional artist MBID |
| `seenAt` | Last time shown |

Rows older than 30 days are pruned. Seen items are deprioritised when building a new feed, not hard-excluded, so sparse collections still get suggestions.

## DiscoveryEvent

Implicit Discover interaction log. No UI prompt creates these rows.

| Field | Notes |
| --- | --- |
| `id` | CUID |
| `releaseGroupId` | Release group shown/opened |
| `artistId` | Optional artist MBID |
| `artist` | Artist display name fallback |
| `action` | `open`, `remove-save` |
| `createdAt` | Event time |

Indexes: releaseGroupId, artistId, createdAt. Rows older than 180 days are pruned. Opens add a small positive affinity signal; removing a saved suggestion adds a small decaying negative signal. See `docs/DISCOVERY.md`.

## Cover cache

Not in SQLite. Cover Art Archive images are cached on disk:

- directory: `data/covers/` (or `COVER_CACHE_DIR`)
- `<sha256>.bin` image + `<sha256>.json` metadata (`contentType`, size, url)
- ignored by git
- 5MB per image limit

## Settings

Hybrid storage:

Browser `localStorage`, key `sleeve:settings:v1`:

- theme
- accent palette
- default view (`grid` / `list`)
- default sort

SQLite `AppSettings`:

- default format
- default condition
- default currency

UI preferences stay device-local and load synchronously before paint. Library defaults are part of app data, survive browser storage loss and are included in JSON export/import.

## Invariants

- Owned data lives in `Release`/`Track`; remote MusicBrainz payloads only in `MetadataCache`.
- Discover state lives in `DiscoveryFeed`/`DiscoverySeen`/`DiscoveryEvent`; clearing it must not affect the collection.
- `ArtistFollow` is a taste signal, not an acquisition state. It must not create wishlist or saved rows.
- `AppSettings` stores library defaults only. Theme, accent, view and sort stay in browser storage.
- `format` is always a normalized category. Keep the raw string in `formatDetail`.
- `genres` is comma-separated; ingestion dedupes case-insensitively.
- MB IDs are unique, but multiple null values are allowed.
- Preserve user-owned fields on refresh/enrichment: condition, rating, notes, purchase date/location/price/currency, and chosen format.
- Dates are date-only strings where possible; prices are numbers.
- Deleting a release must cascade-delete tracks.
- Wishlist and library are independent; an item can exist in both unless application logic prevents it.

## Export format

`GET /api/export`:

```json
{
  "app": "sleeve",
  "version": 1,
  "exportedAt": "2026-11-09T…",
  "releases": [
    {
      "id": "…",
      "musicbrainzId": "…",
      "title": "…",
      "artist": "…",
      "tracks": [{ "id": "…", "releaseId": "…", "position": 1, "title": "…" }],
      "…": "all Release fields"
    }
  ],
  "wishlist": [
    { "id": "…", "title": "…", "artist": "…", "…": "all WishlistItem fields" }
  ],
  "saved": [
    { "id": "…", "title": "…", "artist": "…", "…": "all SavedSuggestion fields" }
  ],
  "follows": [
    { "artistId": "…", "name": "…", "createdAt": "…" }
  ],
  "settings": {
    "defaultFormat": "CD",
    "defaultCondition": "Near Mint",
    "defaultCurrency": "EUR"
  }
}
```

JSON is the only collection export format. Discogs CSV is import-only.

## Database snapshots

Not database tables. `VACUUM INTO` snapshots in `data/backups` (or `BACKUP_DIR`):

- automatic before import: `pre-import-<timestamp>.db`
- last 5 pre-import snapshots are kept
- not exposed in the Settings UI
- exact restore: `bun run restore -- <name>` with the server stopped

Snapshots include the whole SQLite database, including follows and library defaults. Cover images are cache and are not included. JSON remains the user-facing backup format.

## Import rules

`POST /api/import?mode=merge` accepts JSON exports or a bare releases array. `mode=replace` requires a full Sleeve JSON object.

- IDs from the payload are ignored; new CUIDs are generated.
- `createdAt` is preserved for releases, wishlist items, saved suggestions and follows.
- If `musicbrainzId` exists, dedupe by MBID only. This permits separate editions.
- If `musicbrainzId` is null, dedupe by normalized `title|artist|format`.
- Wishlist uses the same rules.
- Saved suggestions dedupe by `releaseGroupId`.
- Followed artists dedupe by `artistId`.
- Settings patch current library defaults when present.
- Invalid rows are counted and skipped; the rest still import.
- Tracks are created with the release in the same transaction.
- `genres` accepts string or array.
- Date strings are stored as provided; CSV mapping normalizes to date-only.

Replace mode also clears `DiscoveryFeed`, `DiscoverySeen` and `DiscoveryEvent` so the next Discover build reflects the restored collection. Metadata and cover caches are kept. If the backup has no settings, library defaults reset to built-in values.

Every import creates a `pre-import-*.db` snapshot first. If snapshot creation fails, nothing is written.

## Discogs CSV mapping

The browser maps CSV columns to Sleeve fields. Normalization before hitting `/api/import`:

- format string → normalized category; raw string → `formatDetail`
- rating `0` → null; 1–5 kept
- condition strings → Sleeve labels (`Near Mint`, `Very Good Plus`, …)
- `released` → year and date-only release date
- `Date Added` → purchase date
- `3,50` / `3.50` → number
- missing title/artist → row skipped
