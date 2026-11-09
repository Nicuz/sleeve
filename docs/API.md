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

Items sorted by priority (high first) then creation date.

```json
{ "items": [ /* WishlistItem */ ], "count": 3 }
```

### `POST /api/wishlist`

```json
{
  "musicbrainzId": "uuid or null",
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
  "priority": 3,
  "targetPrice": 25,
  "targetCurrency": "EUR"
}
```

`priority`: `1` low, `2` medium, `3` high. Duplicate MBID or manual title/artist/format returns `409`.

### `PATCH /api/wishlist/:id`

Partial update; commonly `targetPrice`, `targetCurrency`, `priority`, `notes`.

### `DELETE /api/wishlist/:id`

## Discovery

### `GET /api/discover`

Uses the top 3 collection genres. Suggestions are studio albums by artists not already owned.

```json
{
  "basedOn": ["Jazz", "Rock", "Electronic"],
  "sections": [
    { "genre": "Jazz", "items": [ /* release-group suggestions */ ] }
  ],
  "generatedAt": "2026-…"
}
```

If all genre searches fail: `502`.

## Export / import

### `GET /api/export?format=json`

Full JSON backup:

```json
{
  "app": "sleeve",
  "version": 1,
  "exportedAt": "2026-…",
  "releases": [ /* releases with tracks */ ],
  "wishlist": [ /* wishlist items */ ]
}
```

`Content-Disposition: attachment`.

### `GET /api/export?format=csv`

Release/track CSV export: one row per track, release fields repeated. Releases without tracks still produce one row. `Content-Disposition: attachment`.

### `POST /api/import`

Merge-safe JSON import. Accepts:

```json
{ "releases": [ /* release objects, tracks optional */ ], "wishlist": [ /* wishlist objects */ ] }
```

or a bare releases array. Unknown IDs are regenerated.

Dedupe:

- releases with MBID → by `musicbrainzId`
- manual releases → normalized `title|artist|format`
- wishlist → same rules

Response:

```json
{
  "importedReleases": 2,
  "skippedReleases": 1,
  "invalidReleases": 0,
  "importedWishlist": 1,
  "skippedWishlist": 0,
  "invalidWishlist": 0
}
```

The Discogs CSV UI maps a CSV client-side and sends the mapped releases to this same endpoint.

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
