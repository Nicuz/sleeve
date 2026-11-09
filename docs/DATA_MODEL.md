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
| `musicbrainzId` | Unique when present |
| `title`, `artist`, `artistId` | Same semantics as Release |
| `year`, `releaseDate`, `country`, `label`, `catalogNumber`, `barcode` | Optional metadata |
| `format`, `formatDetail`, `coverUrl` | Optional/display data |
| `notes` | User notes |
| `priority` | 1 low, 2 medium (default), 3 high |
| `targetPrice`, `targetCurrency` | Optional target |
| `createdAt`, `updatedAt` | Timestamps |

No tracklist, condition, rating or purchase fields: wishlist items are not owned copies.

Wishlist is not part of collection stats.

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

## Cover cache

Not in SQLite. Cover Art Archive images are cached on disk:

- directory: `data/covers/` (or `COVER_CACHE_DIR`)
- `<sha256>.bin` image + `<sha256>.json` metadata (`contentType`, size, url)
- ignored by git
- 5MB per image limit

## Settings

Browser `localStorage`, key `sleeve:settings:v1`:

- accent palette
- default format, condition, currency
- default view (`grid` / `list`)
- default sort

Settings never leave the browser. Export/import does not include them.

## Invariants

- Owned data lives in `Release`/`Track`; remote MusicBrainz payloads only in `MetadataCache`.
- `format` is always a normalized category. Keep the raw string in `formatDetail`.
- `genres` is comma-separated; ingestion dedupes case-insensitively.
- MB IDs are unique, but multiple null values are allowed.
- Preserve user-owned fields on refresh/enrichment: condition, rating, notes, purchase date/location/price/currency, and chosen format.
- Dates are date-only strings where possible; prices are numbers.
- Deleting a release must cascade-delete tracks.
- Wishlist and library are independent; an item can exist in both unless application logic prevents it.

## Export format

`GET /api/export?format=json`:

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
    { "id": "…", "title": "…", "artist": "…", "priority": 2, "…": "all WishlistItem fields" }
  ]
}
```

CSV export is release/track rows: one row per track, release fields repeated; releases with no tracks still produce one row. CSV export does not include wishlist.

## Import rules

`POST /api/import` accepts JSON exports or a bare releases array.

- IDs from the payload are ignored; new CUIDs are generated.
- If `musicbrainzId` exists, dedupe by MBID only. This permits separate editions.
- If `musicbrainzId` is null, dedupe by normalized `title|artist|format`.
- Wishlist uses the same rules.
- Invalid rows are counted and skipped; the rest still import.
- Tracks are created with the release in the same transaction.
- `genres` accepts string or array.
- Date strings are stored as provided; CSV mapping normalizes to date-only.

## Discogs CSV mapping

The browser maps CSV columns to Sleeve fields. Normalization before hitting `/api/import`:

- format string → normalized category; raw string → `formatDetail`
- rating `0` → null; 1–5 kept
- condition strings → Sleeve labels (`Near Mint`, `Very Good Plus`, …)
- `released` → year and date-only release date
- `Date Added` → purchase date
- `3,50` / `3.50` → number
- missing title/artist → row skipped
