# Architectural decisions

Short decision records for future sessions. Each captures the current choice and why.

## ADR-001 — Bun + Elysia for backend and tooling

**Status:** accepted

Use Bun as runtime/package manager/test runner and Elysia for the API. Benefits: one runtime, fast startup, TypeScript directly, simple production static serving. Trade-off: smaller ecosystem than Node/Express; Pin Bun-compatible versions.

## ADR-002 — React + Vite SPA + Tailwind v4

**Status:** accepted

The UI is a client-rendered SPA with React Router and TanStack Query. Tailwind v4 uses CSS-first theme tokens in `src/index.css`. Benefits: rich interactions, easy static hosting/offline, simple component model. Trade-off: no SSR.

## ADR-003 — SQLite + Prisma, no auth, single user

**Status:** accepted

The user’s real collection lives locally in `prisma/dev.db`. Single-user/no-auth keeps the MVP simple. `db push` is used instead of migrations for fast iteration. Revisit migrations before multi-instance deployment; add auth only if multi-device/multi-user sync becomes a requirement.

## ADR-004 — Owned data vs metadata cache

**Status:** accepted

Owned release data is authoritative in `Release`/`Track`. Remote MusicBrainz payloads are cached separately in `MetadataCache`. Rendering an owned release never requires MusicBrainz. Cache TTLs and offline behavior can change without touching the collection.

## ADR-005 — MusicBrainz + Cover Art Archive only

**Status:** accepted

No Discogs API token or other metadata provider at runtime. Discogs CSV is supported as an import format only. Benefits: no API keys, open data, predictable costs. Trade-off: no market values, covers sometimes missing.

## ADR-006 — Centralized MusicBrainz service with persistent cache

**Status:** accepted

All MB calls go through `server/musicbrainz.ts`. The service provides:

- 1.2s spacing, retries, global 30s cooldown
- SQLite cache with tiered TTLs and negative caching
- single-flight
- AbortSignal propagation

This prevents scattered rate-limit bugs and survives restarts. Do not call MB from components or new route modules.

## ADR-007 — Client-side Discogs CSV mapping

**Status:** accepted

CSV parsing and column mapping are client-side (Papa Parse + `src/lib/discogs.ts`), then the mapped payload goes to the generic merge-safe import endpoint. Benefits: instant live preview, no server parser/state, reuse of the same import pipeline for JSON and CSV. Trade-off: very large CSVs consume browser memory; current cap is 10,000 rows.

## ADR-008 — Separate wishlist table

**Status:** accepted

Wishlist items are not `Release` rows with a status. Benefits: collection stats/filters stay clean; wishlist has different fields (priority, target price). Trade-off: some metadata duplication and explicit “acquired” flow not yet implemented.

## ADR-009 — Conservative automatic enrichment

**Status:** accepted

Auto-match searches by barcode, then artist/title, then title. Candidates are scored by title, artist, format, year, barcode, catalog number and MB relevance; threshold is 75. Duplicate MBIDs are rejected. Low-confidence records remain unchanged. Manual **Search match** is the fallback. This prioritizes data integrity over completeness.

## ADR-010 — Preserve user fields on metadata updates

**Status:** accepted

Refresh/enrichment updates MB-derived data (title/artist, IDs, cover, label, year, genres, tracks) but preserves format choice, condition, rating, notes and purchase fields. Enrichment must not silently erase personal data.

## ADR-011 — Cover proxy with disk cache and strict allowlist

**Status:** accepted

CAA images are served through `/api/cover` with a 5MB cap, single-flight and `data/covers` disk cache. Only HTTPS `coverartarchive.org` is allowed to avoid SSRF. Immutable caching reduces repeated network work. Non-CAA manual image URLs bypass the proxy.

## ADR-012 — Price inputs are text, parser normalizes locale separators

**Status:** accepted

HTML `type="number"` rejects comma decimals in some locales. Price fields use `type="text"` + `inputMode="decimal"`, and `parsePriceInput` accepts `3,50`, `3.50` and common thousands/currency formatting.

## ADR-013 — Custom service worker instead of Workbox

**Status:** accepted

A small hand-written service worker caches shell/assets/API/covers and provides offline navigation. Benefits: no build plugin/dependency, transparent behavior. Trade-off: fewer helpers; update lifecycle must be handled carefully. Service worker is registered only in production.

## ADR-014 — Route-level lazy loading for heavy tools

**Status:** accepted

The CSV import page is loaded with `React.lazy` because Papa Parse and mapping UI are only needed there. Other routes remain in the main bundle for now. Expand route splitting if startup size becomes a concern.

## ADR-015 — Composed, cached Discovery feed

**Status:** accepted

Discover is not one random genre query. `server/discovery.ts` composes three feeds: Release Radar (new releases from owned artists), New this week (recent releases across top genres) and Crate dig (older shuffled picks). The generated feed is cached for 6 hours in `DiscoveryFeed`; `?refresh=1` replaces it. Shown release groups are recorded in `DiscoverySeen` for 30 days and deprioritised, then allowed again so sparse collections still get suggestions. Benefits: clearer intent, stable page reloads, and a refresh action that visibly changes content without hammering MusicBrainz.

## ADR-016 — Saved suggestions are separate from Wishlist

**Status:** accepted

Saved suggestions are a pre-decision queue (“listen and decide later”), not buying intent, so they live in `SavedSuggestion` instead of `WishlistItem`. Discover offers **Add to wishlist** and **Save** as separate actions. The Saved tab in Discover can promote an item into Wishlist, which creates a `WishlistItem` and removes the saved row. Benefits: Wishlist counts, target totals, exports and semantics stay pure. `WishlistItem.releaseGroupId` still supports adding a Discover release group directly to Wishlist without choosing a specific edition; the edit dialog routes those items to **Choose edition**.

## ADR-017 — Discover is a decision surface, not data entry

**Status:** accepted

Clicking a Discover card opens a suggestion dialog, not the Add release dialog. The dialog offers **Add to wishlist**, **Save for later** and **I already own it**. “Own it” opens the existing edition picker prefilled with the release group, because a physical release still needs a specific edition, format and condition. Benefits: Discover stays focused on decisions, and collection data is only created through the explicit edition flow.
