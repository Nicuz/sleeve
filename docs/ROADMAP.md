# Roadmap

## Completed

### Core library

- [x] Owned release CRUD with SQLite/Prisma
- [x] Tracklists, cover art, formats, genres, condition, rating, notes
- [x] Search/filter by query, format, genre, decade; grid/list views; sorting
- [x] Purchase date/location/price/currency
- [x] Collection statistics and spending insights

### MusicBrainz

- [x] Release search, barcode search, release detail
- [x] Artist search, artist pages, external links, genres
- [x] Paginated discographies
- [x] Album studio filtering and “new artist” discovery
- [x] Persistent metadata cache, single-flight, abort propagation, 503 cooldown
- [x] Owned-release detection in search results
- [x] Per-release refresh
- [x] Automatic enrichment for manual/imported records
- [x] Manual match: search and choose an edition
- [x] Cover-failure detection and CTA

### Collection data

- [x] JSON export/import (releases, tracks, wishlist, saved, follows, settings)
- [x] Discogs CSV import with auto-detection, visual mapping and live preview
- [x] Duplicate-safe merge import
- [x] Cover proxy with disk cache

### Preferences and UX

- [x] Settings: accent palettes, library defaults, currency, view, sort
- [x] Metadata cache stats and clear action
- [x] Wishlist with target prices, priorities and notes
- [x] Offline banner
- [x] Responsive desktop/mobile shell

### Platform

- [x] PWA manifest + icons
- [x] Service worker caching shell/assets/API/covers
- [x] Production static serving with SPA fallback
- [x] Conventional Commits documentation and contribution guide

## Next priorities

1. **Manual cover fallback**
   - Edit cover URL directly from the release page.
   - Optional image upload or external URL, because some CAA editions have no image at all.

2. **Metadata matching polish**
   - Show “already in library” markers inside manual search results.
   - Let batch enrichment review/confirm ambiguous matches instead of only skipping them.
   - Store Discogs `release_id` during CSV import for future Discogs API enrichment/cover lookup.

3. **Discovery v2**
   - Related artists via MusicBrainz artist relationships.
   - “More from artists you own” using cached discographies.
   - Per-genre pagination and refresh controls.
   - Explain why each suggestion is shown.

4. **Quality gates**
   - Add an automated test suite (unit + Playwright).
   - Add ESLint/Prettier or Biome.
   - CI running `bun run check`.
   - Commit hooks for Conventional Commits.

5. **Offline/PWA polish**
   - Update prompt when a new service worker is available.
   - Clear-cache control in Settings.
   - Better offline empty states for uncached routes.

6. **Cover cache operations**
   - Cache size/count display.
   - Prune by age/size.
   - Optional user-triggered cache clear.

7. **Data portability**
   - Export/import preferences.
   - More granular import strategies (skip/replace/merge).
   - Import preview with per-row skip reasons.

## Deferred / explicitly not in current scope

- **Tracklist editing** — deferred by user request.
- Audio playback, streaming integration, playlists tied to playback, scrobbling.
- Collaborative filtering/recommendations requiring play history.
- Multi-user auth, sharing and sync.
- Market value, Discogs price history, automated deal scoring.
- Loans/borrow tracking.
- Budget enforcement and alerts.
- Background jobs/queue for very large libraries.

## Known limitations

- Single-user only; no auth.
- SQLite local DB; no sync between devices.
- `db push` instead of Prisma migrations.
- Discovery is genre/tag heuristic, not personalized by listening behavior.
- Discogs CSV imports are manual records until enriched.
- Some CAA editions have no cover.
- Batch enrichment is sequential and bounded by MusicBrainz rate limits.
- Offline view shows cached data and cannot mutate data offline.
- Main JS bundle is near 500KB; route-level code splitting should be expanded if startup becomes a concern.
