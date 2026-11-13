---
title: Decisions
description: Architectural decision records and the reasoning behind Sleeve's design.
---

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

The user’s real collection lives locally in `prisma/dev.db`. Single-user/no-auth keeps the MVP simple. **Update:** the project now ships migrations (ADR-022), and `bun run db:deploy` is required for schema changes including the FTS search index. Revisit auth only if multi-device/multi-user sync becomes a requirement.

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

**Status:** superseded by ADR-018 (section now called “From your artists”)

Discover is not one random genre query. `server/discovery.ts` composes album-oriented feeds: From your artists (last 30 days from owned artists), New this week (last 7 days across top genres), New this month (8–30 days), and Lost in the Stacks (all-time older picks rotated monthly). Candidates are ranked with ListenBrainz popularity where available; MusicBrainz `releaseCount` is the fallback proxy. The feed is cached for 12 hours in `DiscoveryFeed` and refreshed automatically; stale requests return the cache immediately while a background rebuild runs. There is no user-facing refresh button. `?refresh=1` remains a dev/internal override. Release, wishlist and saved mutations invalidate the cache. Shown release groups are recorded in `DiscoverySeen` for 30 days and deprioritised, then allowed again so sparse collections still get suggestions. Benefits: streaming-like cadence, stable page reloads, and no repeated manual refresh.

## ADR-016 — Saved suggestions are separate from Wishlist

**Status:** accepted

Saved suggestions are a pre-decision queue (“listen and decide later”), not buying intent, so they live in `SavedSuggestion` instead of `WishlistItem`. Discover offers **Add to wishlist** and **Save** as separate actions. The Saved tab in Discover can promote an item into Wishlist, which creates a `WishlistItem` and removes the saved row. Benefits: Wishlist counts, target totals, exports and semantics stay pure. `WishlistItem.releaseGroupId` still supports adding a Discover release group directly to Wishlist without choosing a specific edition; the edit dialog routes those items to **Choose edition**.

## ADR-017 — Discover is a decision surface, not data entry

**Status:** accepted

Clicking a Discover card opens a suggestion dialog, not the Add release dialog. The recommendation reason is followed by **Listen on ListenBrainz**; the action row offers **Add to wishlist**, **Save for later** and **I already own it — Add to library**. Listening links to the ListenBrainz release-group page in a new tab; it is not an embedded player and playback depends on the user's connected music service. “I already own it — Add to library” opens the existing edition picker prefilled with the release group, because a physical release still needs a specific edition, format and condition. Benefits: Discover stays focused on decisions, and collection data is only created through the explicit edition flow.

## ADR-018 — Library-first affinity with zero extra interactions

**Status:** accepted

Discover quality is improved without adding prompts: purchases, ratings, wishlist items and saved suggestions form the affinity model, while opening a card or removing a saved suggestion is logged silently in `DiscoveryEvent`. Top owned/wishlist artists seed ListenBrainz similar-artist expansion, which adds candidates outside the owned-artist and top-tag pool. Ranking combines artist/genre affinity with ListenBrainz artist and release-group popularity; `releaseCount` is no longer used because it measures editions, not demand. Genre/era caps and a deterministic exploration weight keep sparse signals from collapsing into a filter bubble. Feed payloads carry a `version` so algorithm changes invalidate immediately. Benefits: better relevance with zero new user actions and no manual refresh.

## ADR-019 — Weekly, stable Discover cadence for a physical collection

**Status:** accepted

The feed TTL is 7 days, not 12 hours. A physical collection rewards slow browsing, and the weekly release cycle is the natural refresh unit; Lost in the Stacks still rotates monthly. The current shelf is also treated as stable: wishlist/save changes influence the next weekly rebuild but do not replace what is on screen, and owning a record prunes only the matching item from the cached payload. This avoids reshuffling picks while the user is deciding what to hunt down, while still removing a record immediately after they add it to the library. Benefits: fewer disruptive changes, longer usable shelves, and a cadence that matches listening to records rather than streaming.

## ADR-020 — Artist follow separates taste from acquisition

**Status:** accepted

Discover needs explicit artist taste without forcing users to save an album they do not want or add a fake wishlist item. `ArtistFollow` stores one row per MusicBrainz artist and contributes a strong positive affinity signal; followed artists are prioritised as similar-artist seeds and as seeds for the From your artists section. It does not exclude the artist from Discover, create a saved item or imply buy intent. Follow is available on artist pages, release pages, wishlist search/edit dialogs and in the Discover suggestion dialog. The Discover `Following` tab makes the list visible and manageable without adding a new navigation destination, and includes direct MusicBrainz artist search so following works on a fresh install with an empty library. Benefits: a cleaner saved shelf, more accurate discovery input, and one clear meaning per action: rate owned records, want albums, save release groups, follow artists.

## ADR-021 — Hybrid settings storage

**Status:** accepted

Theme, accent, default view and sort stay in browser `localStorage`; default format, condition and currency move to SQLite `AppSettings`. The first group is device-specific and must apply before first paint, so synchronous local storage avoids a theme flash and keeps UI preferences personal to each browser. The second group is collection-level data: it should survive browser storage loss, apply across devices and be included in JSON backups. The app merges both sources in `SettingsProvider`. Benefits: fast, flicker-free UI boot plus portable data-entry defaults, without turning every visual preference into a server round trip.

## ADR-022 — JSON replace restore, CLI exact snapshots

**Status:** accepted

In-app restore uses a full JSON backup inside one transaction, not a live SQLite file swap. Replace mode clears releases, wishlist, saved, follows, library defaults and discovery state, then restores the backup, preserving `createdAt`. Every import creates a `pre-import-*.db` snapshot first and aborts if that snapshot fails; the last 5 are kept. Snapshots are internal rollback files, not a user-facing feature. JSON is the only visible backup/restore path, which also works cleanly in Docker because browser download/upload crosses the container boundary. Exact database restoration remains a CLI command (`bun run restore`, or `docker compose run` in Docker) because swapping the SQLite file under an active Prisma connection is unsafe. Benefits: safe one-click restore, no binary snapshot management in Settings, and no risk of corrupting a live database.

## ADR-023 — SemVer releases with build info

**Status:** accepted

`package.json` is the version source of truth and releases are annotated `vX.Y.Z` tags. A tag workflow refuses to publish when the tag and `package.json` disagree, runs the full check, publishes multi-arch `ghcr.io/nicuz/sleeve` images, and creates a GitHub Release whose notes come from `CHANGELOG.md`. Builds stamp the short commit and build date: Vite defines `__SLEEVE_BUILD__` for the client and emits `dist/build-info.json`, which the production server reads. Local checkouts fall back to `git rev-parse`; Docker build args supply the commit because `.git` is excluded from the image. **Settings → About** and the public `GET /api/version` expose the same data. `docker-compose.image.yml` is the minimal image-only stack for prebuilt deployments; the root compose remains the hardened source-build path. Benefits: users and operators can identify exactly what they run, and release notes never depend on a manually edited GitHub form.
