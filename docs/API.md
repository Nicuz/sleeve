# API

All endpoints are same-origin under `/api`. JSON requests and responses use `application/json` unless noted. Errors return `{ "message": "…" }`.

Common status codes:

- `400` invalid payload or missing confirmation
- `404` resource not found
- `409` duplicate (MusicBrainz ID / existing item)
- `502` MusicBrainz, Cover Art Archive or enrichment failure

## Health

### `GET /api/health`

```json
{ "ok": true, "name": "Sleeve", "time": "2026-…" }
```

## Releases

### `GET /api/releases`

Query params (all optional):

- `q` — title, artist, label or catalog number substring
- `format` — normalized format; omit or `All`
- `genre` — genre substring; omit or `All`
- `decade` — start year, e.g. `1970`; omit or `All`
- `sort` — `recent` (default), `title`, `artist`, `year`, `rating`

Response:

```json
{ "releases": [ /* Release rows; no tracks */ ], "count": 10 }
```

### `GET /api/releases/owned?ids=uuid1,uuid2`

Returns local release IDs for MusicBrainz IDs already in the library. Max 100 IDs.

```json
{ "releases": [{ "id": "local-id", "musicbrainzId": "uuid" }] }
```

### `GET /api/releases/:id`

Returns one release with tracks ordered by disc, number, position.

```json
{ "release": { /* Release with tracks */ } }
```

### `POST /api/releases`

Creates a release. Duplicate `musicbrainzId` returns `409`.

```json
{
  "musicbrainzId": "uuid or null",
  "title": "Kind of Blue",
  "artist": "Miles Davis",
  "artistId": "uuid or null",
  "year": 1959,
  "releaseDate": "1959-08-17",
  "country": "US",
  "label": "Columbia",
  "catalogNumber": "CL 1355",
  "barcode": null,
  "format": "CD",
  "formatDetail": "CD",
  "coverUrl": "https://coverartarchive.org/...",
  "notes": "…",
  "rating": 5,
  "condition": "Near Mint",
  "purchaseDate": "2024-03-16",
  "purchaseLocation": "Rough Trade, London",
  "purchasePrice": 24.99,
  "purchaseCurrency": "EUR",
  "genres": ["Jazz", "Modal"],
  "trackCount": 5,
  "tracks": [
    { "position": 1, "disc": null, "number": 1, "title": "So What", "duration": 545, "artist": "Miles Davis" }
  ]
}
```

Response `201`:

```json
{ "release": { /* release with tracks */ } }
```

### `PATCH /api/releases/:id`

Partial update. All create fields are optional, including `tracks` (replaces the whole tracklist when present). MB/refresh enrichment preserves user fields.

### `DELETE /api/releases/:id`

Deletes a release and cascades to tracks.

```json
{ "ok": true }
```

### `DELETE /api/releases?confirm=DELETE`

Clears the entire library. Requires exact `confirm=DELETE`.

```json
{ "ok": true, "deleted": 10 }
```

### `POST /api/releases/:id/refresh`

Only for releases with a MusicBrainz ID. Fetches fresh MB detail, updates metadata/tracks, preserves user fields.

```json
{ "release": { /* updated release with tracks */ } }
```

### `POST /api/releases/:id/enrich`

Fetches metadata for one release:

- if it already has an MBID → fetch/apply detail;
- otherwise → barcode search, then `artist + title`, then title fallback;
- conservative match threshold; duplicates are rejected.

Response variants:

```json
{ "status": "matched", "release": { /* … */ }, "match": { "title": "…", "artist": "…", "score": 105 } }
{ "status": "unmatched" }
{ "status": "duplicate" }
```

### `POST /api/releases/:id/apply-match`

Applies a user-selected MusicBrainz release.

```json
{ "musicbrainzId": "uuid" }
```

Same response shape as `/enrich`, with `status: matched | duplicate`.

## MusicBrainz

These routes proxy MusicBrainz, apply rate limiting, persistent cache, single-flight and request cancellation.

### `GET /api/musicbrainz/search?q=…&limit=20`

Release search. `limit` 1–30.

```json
{ "results": [ /* SearchResult */ ], "count": 20 }
```

### `GET /api/musicbrainz/barcode/:code`

Convenience wrapper around a MusicBrainz barcode search.

### `GET /api/musicbrainz/artists?q=…&limit=6`

Artist search. `limit` 1–10.

### `GET /api/musicbrainz/artists/:mbid`

Artist detail, links, genres and first 100 release groups.

```json
{ "artist": { /* ArtistDetail */ } }
```

### `GET /api/musicbrainz/artists/:mbid/release-groups?offset=100&limit=100`

Paginated release groups. `limit` 1–100.

```json
{ "groups": [ /* ArtistReleaseGroup */ ], "total": 217 }
```

### `GET /api/musicbrainz/releases/:mbid`

Full MusicBrainz release detail mapped to Sleeve’s shape (tracks included).

```json
{ "release": { /* ReleaseDetail */ } }
```

## Stats

### `GET /api/stats`

```json
{
  "total": 10,
  "totalTracks": 147,
  "totalArtists": 8,
  "totalGenres": 24,
  "missingMetadata": 3,
  "byFormat": [{ "format": "CD", "count": 10 }],
  "byDecade": [{ "decade": "1990s", "value": 1990, "count": 4 }],
  "topArtists": [{ "artist": "Green Day", "count": 2 }],
  "topGenres": [{ "genre": "Rock", "count": 5 }],
  "recentlyAdded": [ /* up to 4 releases */ ]
}
```

`missingMetadata` = releases with no MBID, no cover URL, or no track count.

### `GET /api/stats/spending?currency=EUR`

Spending for one currency (defaults to the most-used priced currency).

```json
{
  "currency": "EUR",
  "currencies": [{ "currency": "EUR", "count": 5, "total": 88.3 }],
  "totalSpent": 88.3,
  "releasesWithPrice": 5,
  "averagePrice": 17.66,
  "medianPrice": 16.5,
  "spentThisYear": 88.3,
  "currentYear": 2026,
  "firstPurchaseYear": 2026,
  "monthly": [{ "key": "2026-01", "label": "Jan", "amount": 0, "count": 0 }],
  "byFormat": [{ "format": "CD", "amount": 51.3, "count": 3 }],
  "topShops": [{ "location": "Blue Note Milano", "amount": 34.8, "count": 2 }],
  "mostExpensive": { "id": "release-id", "title": "…", "artist": "…", "price": 25, "currency": "EUR", "purchaseDate": "2026-09-01" },
  "missingPurchaseInfo": 0
}
```

## Meta

### `GET /api/meta`

```json
{ "formats": ["CD", "Vinyl", "…"], "genres": ["Jazz", "Rock"], "decades": [1970, 1980] }
```

Genres are sorted by frequency, capped at 30, case-normalized by ingestion.

## Wishlist

### `GET /api/wishlist`

Items sorted by creation date, newest first.

```json
{ "items": [ /* WishlistItem */ ], "count": 3 }
```

### `POST /api/wishlist`

```json
{
  "musicbrainzId": "uuid or null",
  "releaseGroupId": "uuid or null",
  "title": "Random Access Memories",
  "artist": "Daft Punk",
  "artistId": "uuid or null",
  "year": 2013,
  "releaseDate": "2013-05-17",
  "country": "US",
  "label": "Columbia",
  "catalogNumber": "…",
  "barcode": "…",
  "format": "Vinyl",
  "formatDetail": "2×12\" Vinyl",
  "coverUrl": "https://coverartarchive.org/...",
  "notes": "Original pressing",
  "targetPrice": 25,
  "targetCurrency": "EUR"
}
```

Wishlist is buy intent only. Duplicate MBID, release group or manual title/artist/format returns `409`.

### `PATCH /api/wishlist/:id`

Partial update; commonly `targetPrice`, `targetCurrency`, `notes`.

### `DELETE /api/wishlist/:id`

## Saved suggestions

### `GET /api/saved`

Discover bookmarks. These are not wishlist items.

```json
{ "items": [ /* SavedSuggestion */ ], "count": 1 }
```

### `POST /api/saved`

```json
{
  "releaseGroupId": "uuid",
  "title": "Zarathustra Style",
  "artist": "Fabri Fibra & Neffa",
  "artistId": "uuid or null",
  "year": 2026,
  "releaseDate": "2026-10-09",
  "coverUrl": "https://coverartarchive.org/...",
  "type": "Album"
}
```

Duplicate release group returns `409`.

### `POST /api/saved/:id/promote`

Moves a saved suggestion into Wishlist as a wanted item and removes the saved row.

### `DELETE /api/saved/:id`

## Settings

Only library defaults live in SQLite. Theme, accent, default view and sort stay in browser `localStorage`.

### `GET /api/settings`

```json
{
  "settings": {
    "defaultFormat": "CD",
    "defaultCondition": "Near Mint",
    "defaultCurrency": "EUR"
  }
}
```

Returns defaults when no row exists.

### `PATCH /api/settings`

Partial update. Invalid enum values return `400`.

```json
{ "defaultCurrency": "USD" }
```

Response: `{ "settings": { … } }`.

## Artist follows

Follow is an explicit taste signal for an artist, not a wishlist or saved item. It never excludes the artist from Discover.

### `GET /api/artists/follows`

Followed artists sorted by name. Each item includes `ownedCount`, the number of releases by that artist in the library.

```json
{ "items": [ /* FollowedArtist, with ownedCount */ ], "count": 2 }
```

### `PUT /api/artists/:artistId/follow`

Idempotent create/update.

```json
{ "name": "Godspeed You! Black Emperor" }
```

Response: `{ "item": { "artistId": "uuid", "name": "…", "createdAt": "…" } }`.

### `DELETE /api/artists/:artistId/follow`

Idempotent. Returns `{ "ok": true }` even if the artist was not followed.

## Discovery

### `GET /api/discover`

Builds a personalised feed from the user’s collection:

- **Release Radar** — new albums/EPs from top owned/wishlist/followed artists, last 30 days plus upcoming.
- **New this week** — recent or upcoming albums/EPs from top genres and similar artists.
- **New this month** — albums/EPs released 8–30 days ago from top genres and similar artists.
- **Lost in the Stacks** — all-time older picks from top genres and similar artists, rotated deterministically once per month.
- **Lead pick** — first Radar item, else first similar-artist pick, else first available item.

Candidates are expanded with ListenBrainz similar artists and ranked with library-weighted artist/genre affinity plus ListenBrainz artist and release-group listen/user counts. The feed is cached for 7 days and refreshed automatically. Stale requests return the cached feed immediately while a rebuild runs in the background. `?refresh=1` is an internal/dev override. Saving, wishlisting or following does not rebuild the current feed; owning a record prunes only the matching item. Seen release-group IDs are remembered for 30 days and deprioritised on later builds. The payload carries a `version`; a version mismatch rebuilds before serving.

```json
{
  "version": 4,
  "basedOn": ["Jazz", "Rock", "Electronic"],
  "featured": { /* release-group item */ },
  "sections": [
    {
      "id": "radar",
      "kind": "radar",
      "title": "From your artists",
      "subtitle": "Recent and upcoming albums from your library and wishlist",
      "items": [ /* release-group items */ ]
    }
  ],
  "generatedAt": "2026-…",
  "nextRefreshAt": "2026-…"
}
```

Items include MusicBrainz release-group fields plus `reason` and optional `genre`. If generation fails and no cached feed exists: `502`.

### `POST /api/discover/events`

Records an implicit Discover interaction. Used by the UI when a suggestion is opened; removing a saved suggestion is recorded automatically by the saved delete route. No new user action is required.

```json
{
  "releaseGroupId": "uuid",
  "artistId": "uuid or null",
  "artist": "Artist name",
  "action": "open"
}
```

`action` is one of `open`, `remove-save`. Response: `{ "ok": true }`.

## Export / import

### `GET /api/export`

Full JSON backup:

```json
{
  "app": "sleeve",
  "version": 1,
  "exportedAt": "2026-…",
  "releases": [ /* releases with tracks */ ],
  "wishlist": [ /* wishlist items */ ],
  "saved": [ /* saved suggestions */ ],
  "follows": [ /* followed artists */ ],
  "settings": { "defaultFormat": "CD", "defaultCondition": "Near Mint", "defaultCurrency": "EUR" }
}
```

`Content-Disposition: attachment`. This is the only export format; there is no CSV collection export.

### `POST /api/import/preview`

Validates a backup and returns what would change without writing. Query: `?mode=merge|replace` (default `merge`).

```json
{
  "mode": "merge",
  "source": { "app": "sleeve", "version": 1, "exportedAt": "2026-…" },
  "canReplace": true,
  "incoming": { "releases": 2, "tracks": 21, "wishlist": 1, "saved": 0, "follows": 2, "hasSettings": true },
  "importable": { "releases": 2, "wishlist": 1, "saved": 0, "follows": 2, "hasSettings": true },
  "duplicates": { "releases": 0, "wishlist": 0, "saved": 0, "follows": 0 },
  "invalid": { "releases": 0, "wishlist": 0, "saved": 0, "follows": 0, "settings": 0 },
  "current": { "releases": 10, "tracks": 124, "wishlist": 3, "saved": 1, "follows": 4 },
  "warnings": []
}
```

`canReplace` requires a full Sleeve object with `app: "sleeve"` and `version: 1`. Bare arrays can only merge.

### `POST /api/import?mode=merge|replace`

Default `merge`.

Merge accepts a full backup object or a bare releases array. Unknown IDs are regenerated. Dedupe:

- releases with MBID → by `musicbrainzId`
- manual releases → normalized `title|artist|format`
- wishlist → same rules
- saved suggestions → by `releaseGroupId`
- followed artists → by `artistId`
- settings → patch current library defaults when present

`replace` requires a full Sleeve JSON object. In one transaction it:

1. Deletes releases/tracks, wishlist, saved suggestions and follows.
2. Clears `DiscoveryFeed`, `DiscoverySeen` and `DiscoveryEvent`.
3. Restores the backup.
4. Restores library defaults, or resets them when the backup has no `settings`.

`createdAt` is preserved for releases, wishlist items, saved suggestions and follows. Metadata cache and cover cache are not touched. Exact `.db` restore stays CLI-only.

Every merge or replace creates a `pre-import-*.db` snapshot before writing. If the snapshot fails, the import aborts.

Response:

```json
{
  "mode": "merge",
  "backup": { "name": "pre-import-2026-….db", "bytes": 172032, "createdAt": "2026-…" },
  "importedReleases": 2,
  "skippedReleases": 1,
  "invalidReleases": 0,
  "importedWishlist": 1,
  "skippedWishlist": 0,
  "invalidWishlist": 0,
  "importedSaved": 1,
  "skippedSaved": 0,
  "invalidSaved": 0,
  "importedFollows": 1,
  "skippedFollows": 0,
  "invalidFollows": 0,
  "importedSettings": 1,
  "invalidSettings": 0
}
```

The Discogs CSV UI maps a CSV client-side and sends the mapped releases to this same endpoint in merge mode.

## Backups

The JSON export/import endpoints are the user-facing backup API. Automatic `pre-import-*.db` safety snapshots are written to `$BACKUP_DIR` but are not exposed as an API surface. Exact snapshot restore stays CLI-only:

```bash
bun run restore -- <backup-name>
```

Stop the server first.

## Metadata cache

### `GET /api/metadata/cache`

```json
{ "count": 21, "oldest": "2026-…", "newest": "2026-…" }
```

### `DELETE /api/metadata/cache`

Clears all cached MusicBrainz payloads.

```json
{ "ok": true, "deleted": 21 }
```

## Covers

### `GET /api/cover?url=…`

Allowlisted proxy for `https://coverartarchive.org/...` only.

- Downloads on miss, stores in `data/covers`.
- Returns `x-cover-cache: HIT|MISS`.
- `Cache-Control: public, max-age=31536000, immutable`.
- `400` for other hosts; `502` when upstream fails.
- Limit 5MB.

## Notes for clients

- Pass an `AbortSignal` on search/detail requests; the route forwards it to MusicBrainz so superseded queued requests do not consume rate-limit capacity.
- Do not call MusicBrainz directly from the browser.
- CAA images should go through the `/api/cover` proxy; the `CoverArt` component does this automatically.
- In production, the same server serves the SPA; only `/api/*` is special-cased.
