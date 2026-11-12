---
name: sleeve-musicbrainz
description: Use when working on Sleeve metadata, enrichment, refresh, artist pages, Cover Art Archive covers or Discover queries. Keeps MusicBrainz calls centralized, rate-limited, cached and safe for user-owned fields.
---

# Sleeve MusicBrainz work

All MusicBrainz and Cover Art Archive access goes through `server/musicbrainz.ts`. Never call `fetch` against MusicBrainz or CAA from a route, page or component.

## Service rules

- Request spacing is `MIN_INTERVAL_MS` (1200ms). Do not bypass it.
- Responses cache in the SQLite `MetadataCache`: search 30 minutes, details 7 days, negative results 10 minutes.
- Single-flight deduplicates concurrent requests. Keep new calls inside the existing helper.
- Pass `request.signal` from routes into service functions so cancellation propagates.
- 503 handling waits, then sets a 30s cooldown. Surface the existing user-facing message; do not retry around the cooldown.
- The user agent comes from package metadata in `server/config.ts`. Do not hardcode a contact string.

## Routes

`server/routes/musicbrainz.ts` is a thin proxy. It validates input, calls the service, maps errors to status codes and returns the payload. Add caching or retry logic to the service, never to the route.

## Enrichment

Read `server/release-metadata.ts` before changing matching logic.

- `enrichReleaseById`: existing MBID → refresh; otherwise barcode → artist/title → title fallback.
- Auto-match requires `score >= 75`; keep it conservative.
- `applyReleaseMatch`: explicit MBID from the user; reject an MBID already owned by another release.
- `refreshRelease`: requires an existing MBID; manual releases return `400`.
- Missing metadata means no MBID, no cover URL or no track count.

## Preserve user fields

Metadata updates may change title, artist, IDs, year, release date, country, label, catalog number, barcode, format detail, cover URL, genres, track count and tracks.

They must not overwrite: condition, rating, notes, purchase date, purchase location, purchase price, purchase currency, and the normalized `format` category.

## Covers

Store the Cover Art Archive URL in the DB, but render it through `CoverArt` / `/api/cover?url=…`. The disk cache lives in `data/covers` and has its own size limit and prune step. A missing cover is valid; do not fake one.

## Discover

Discover uses the service for release-group and artist lookups, plus `server/listenbrainz.ts` for popularity and similar artists. Read `docs/DISCOVERY.md` before changing queries, ranking, cache or refresh behavior.

## Tests

`server/musicbrainz.test.ts` covers pure helpers (`normalizeFormat`, `sortFormats`). Do not add network-dependent tests. Test parsing, scoring and mapping as pure functions; use a temp DB for persistence behavior.
