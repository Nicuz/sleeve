# Discovery

Canonical reference for how Discover builds its feed. Read this before changing discovery; it is intentionally more detailed than `ARCHITECTURE.md`.

## TL;DR

- Source data: owned releases (including rating), wishlist, saved suggestions, `DiscoverySeen`, `DiscoveryEvent`.
- Metadata: MusicBrainz release groups and release-group tags.
- Personalisation: library-weighted artist/genre affinity, ListenBrainz similar artists, ListenBrainz artist and release-group popularity.
- Sections: Release Radar, New this week, New this month, Crate dig.
- Feed is cached 7 days and refreshed automatically. There is no user-facing refresh button.
- `GET /api/discover?refresh=1` forces a rebuild (dev/internal only).
- Saving or wishlisting does not rebuild the current feed; those signals shape the next weekly refresh.
- Owning a record removes that matching item from the current feed without rebuilding the rest.
- Code: `server/discovery.ts`, `server/listenbrainz.ts`, `server/musicbrainz.ts`, `src/pages/discover.tsx`.

## Interaction model

Discover adds no required interactions. It learns from the core flows:

| Signal | Source | Weight |
| --- | --- | --- |
| Purchased release | `Release` | 1, boosted by rating |
| Rating | `Release.rating` | 0.3×–2× on the purchase weight |
| Wishlist item | `WishlistItem` | +1.2 |
| Saved suggestion | `SavedSuggestion` | +0.8 |
| Opened suggestion | `DiscoveryEvent: open` | +0.25, once per release group |
| Removed saved suggestion | `DiscoveryEvent: remove-save` | −0.5 |

Negative event weights decay with a 120-day half-life. There is no "not interested" button, onboarding or rating prompt. Removing a saved suggestion is the only implicit negative feedback; removing a wishlist item is ignored because it often means the record was purchased.

`DiscoverySeen` is still a novelty control, not a taste signal. Being shown without interacting does not count as a dislike.

## Inputs

`getCollectionSnapshot()` in `server/discovery.ts` reads:

| Source | Fields | Purpose |
| --- | --- | --- |
| `Release` | `title`, `artist`, `artistId`, `genres`, `rating` | affinity, genre weights, owned keys |
| `WishlistItem` | `title`, `artist`, `artistId` | affinity, exclusion |
| `SavedSuggestion` | `releaseGroupId`, `artist`, `artistId` | affinity, exclusion |
| `DiscoveryEvent` | release group, artist, action, date | weak opens / removals |
| `DiscoverySeen` | `releaseGroupId` | deprioritise recent impressions |

Derived values:

- `artistAffinity`: rating-weighted purchases + wishlist/saved + event signals, clamped to `[-4, 12]`.
- `genreAffinity`: rating-weighted genre occurrence across owned releases.
- `topGenres`: top 3 genres by weighted affinity.
- `seedArtistIds`: top 10 positive artists with MBIDs, used for similar-artist expansion.
- `ownedKeys`, `wishlistKeys`, `savedGroupIds`, `ownedArtistIds`, `ownedArtistNames`.

## Similar artists

`expandSimilarArtists()` calls ListenBrainz's similar-artists dataset with the top owned/wishlist artists as seeds:

```text
GET https://labs.api.listenbrainz.org/similar-artists/json
    ?artist_mbids=<seed>&artist_mbids=<seed>…
    &algorithm=session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30
```

- Results are aggregated per seed, filtered to exclude owned artists, capped at 40 artists.
- Similarity is normalised per seed and weighted by the seed artist's affinity.
- Matching candidate artists get an affinity boost and a "More like …" reason.
- Cached in memory for 7 days; failures fall back to owned artists and genre candidates.

This is the main candidate-quality improvement: Discover can now surface artists near the collection, not only artists already owned or the top 3 raw tags.

## MusicBrainz queries

All MusicBrainz calls live in `server/musicbrainz.ts`.

### Release Radar

Seeded by owned/wishlist artists only:

```text
arid:(<seed artist IDs>)
AND firstreleasedate:[today-30d TO today+90d]
limit 100
```

Function: `searchReleaseGroupsByArtistIds`.

### Orbit candidates

Similar artists are queried separately:

- recent: `[today-30d TO today+90d]` → New this week / New this month
- older: `[1950-01-01 TO today-30d]` → Crate dig

These candidates carry a "More like …" reason and are ranked by affinity.

### New this week / New this month

For each top genre:

```text
tag:"<genre>"
AND firstreleasedate:[today-30d TO today+90d]
limit 100
```

Function: `searchNewReleaseGroupsByTag`.

Partitioning:

- `firstReleaseDate >= today-7d` → **New this week** (includes upcoming releases)
- `today-30d <= firstReleaseDate < today-7d` → **New this month**

### Crate dig

For each top genre:

```text
tag:"<genre>"
AND firstreleasedate:[1950-01-01 TO today-30d]
limit 100
```

Older albums/EPs, all-time, plus older releases from similar artists.

## Filters

Applied to every candidate:

- Keep studio albums/EPs only: `secondaryTypes` empty, primary type `Album` or `EP`.
- Remove Various Artists.
- Remove owned releases, wishlist items and saved release groups.
- New week/month genre sections also remove owned artists.
- Deduplicate release-group IDs.
- Limit repeated artists, genres and eras during selection.

## Popularity

`server/listenbrainz.ts` batches release-group IDs to:

```text
POST https://api.listenbrainz.org/1/popularity/release-group
```

and candidate artist IDs to:

```text
POST https://api.listenbrainz.org/1/popularity/artist
```

Response fields used:

- `total_listen_count`
- `total_user_count`

Cache: in-memory, 24 hours. Requests are spaced at least 1 second apart per ListenBrainz guidance.

Score:

```text
log10(1 + total_listen_count) + 0.35 * log10(1 + total_user_count)
```

Candidate popularity combines release-group popularity with artist popularity:

```text
releasePopularity + 0.65 * artistPopularity
```

There is no `releaseCount` fallback: the number of editions is not demand.

## Ranking and selection

### Release Radar / New this week / New this month

Per section, normalise affinity, popularity and freshness across the candidate pool:

```text
0.50 * affinity
+ 0.25 * popularity
+ 0.15 * freshness
+ 0.10 * exploration
```

- Affinity = `max(normalised artist affinity, 0.5 × normalised genre affinity)`.
- Freshness is 1 for future releases, decaying to 0 over 90 days.
- Exploration is a deterministic hash of the current date + release group.

### Crate dig

Monthly deterministic blend:

```text
0.45 * exploration
+ 0.30 * affinity
+ 0.25 * popularity
```

- `monthKey` is `YYYY-MM`.
- Same month + same data → stable rotation.
- Different month → different Crate dig shelf.
- Max 1 per artist, 8 items.

### Diversity

`selectDiverse`:

- unseen items first, seen items later
- max 2 per artist for new sections, 1 for Crate dig
- max 3 per genre and 4 per era when alternatives exist
- a second pass relaxes genre/era caps if a section would otherwise be short
- blocked IDs are skipped across sections

### Lead pick

Priority:

```text
Release Radar
→ first "More like …" item in New this week / New this month / Crate dig
→ first available item
```

The lead pick is removed from its section to avoid duplication.

## Output

Response shape (`DiscoverResponse`):

```ts
{
  version: number;
  basedOn: string[];
  featured: DiscoveryItem | null;
  sections: Array<{
    id: 'radar' | 'new-week' | 'new-month' | 'crate';
    kind: 'radar' | 'new' | 'crate';
    title: string;
    subtitle: string;
    items: DiscoveryItem[];
  }>;
  generatedAt: string;
  nextRefreshAt: string;
}
```

Each item includes release-group fields plus:

- `reason` — shown on cards/dialog
- `genre` — source genre when applicable

## Persistence and refresh

### `DiscoveryFeed`

One row with `id = "current"`:

- `payload` — JSON feed, including `version`
- `generatedAt`
- `expiresAt` — 7 days

A payload with a different `DISCOVERY_VERSION` is rebuilt before serving.

### `DiscoverySeen`

One row per release group shown:

- `releaseGroupId`
- `artistId`
- `seenAt`

Rows older than 30 days are pruned. Seen items are deprioritised, not hard-excluded.

### `DiscoveryEvent`

Implicit interaction log:

- `open` from opening a suggestion dialog
- `remove-save` from deleting a saved suggestion

Rows older than 180 days are pruned. Events never create UI prompts.

### Refresh behavior

- Fresh cache → returned immediately.
- Current cache with an older/short expiry → expiry is extended to `generatedAt + 7 days` without rebuilding, so existing picks survive a cadence change.
- Expired cache → cached feed returned immediately; rebuild runs in background.
- Version mismatch → rebuild before serving.
- No cache → request waits for rebuild.
- `?refresh=1` → waits for rebuild.
- Single-flight via `rebuildPromise`.

### Mutation behavior

The weekly feed is deliberately stable for a physical-first collection.

- Adding a release calls `removeOwnedReleaseFromDiscoveryFeed()`: only matching artist/title items are pruned from the cached payload; the rest of the shelf stays put and the weekly timer is unchanged.
- Wishlist and saved-suggestion mutations do not rebuild the feed. They update affinity and exclusions for the next weekly refresh. The UI still reflects saved/wishlisted state on the current cards.
- Release update, delete, enrich, match and refresh do not rebuild the feed.
- Removing a saved suggestion still records a `remove-save` event for the next refresh.
- Opening a suggestion records an `open` event; it never invalidates the feed.

This preserves what the user is currently browsing instead of reshuffling on every interaction.

## How to refresh manually

Force server rebuild:

```bash
curl -s "http://localhost:3001/api/discover?refresh=1" > /dev/null
```

Clear feed and seen history:

```bash
bun -e 'import { prisma } from "./server/db"; await prisma.discoveryFeed.deleteMany(); await prisma.discoverySeen.deleteMany(); await prisma.discoveryEvent.deleteMany(); await prisma.$disconnect();'
```

Restarting the server alone does **not** clear the cached feed.

## UI behavior

`src/pages/discover.tsx`:

- Tabs: `For you` and `Saved N` (`?view=saved`).
- `For you` shows lead pick + sections.
- Cards open `SuggestionDialog`, not the Add release form.
- Opening a card silently records a `DiscoveryEvent`.
- Dialog actions: Add to wishlist, Save for later, I already own it.
- `I already own it` opens the edition picker prefilled with `rgid:<releaseGroupId>`.
- No manual refresh button. Shows `Updated … · next refresh in …`.

## Current limitations

- MusicBrainz tag data is noisy and has no mainstream weighting.
- Similar artists depend on ListenBrainz coverage and are cached in memory only.
- New releases often have no ListenBrainz listens; artist popularity helps but coverage varies.
- Candidate pools are capped at 100 MusicBrainz results per query.
- Release dates can be year-only or differ by edition/country.
- No play history, audio embeddings or multi-user collaborative matrix.

## Likely next improvements

1. Version the feed cache key for every algorithm experiment (already stores `version`; bump it).
2. Add relative popularity floors for New this week/month when enough candidates exist.
3. Expand candidate pools with decade partitions for Crate dig.
4. Persist similar-artist results in SQLite if rebuild latency becomes an issue.
5. Optional ListenBrainz account connection for true collaborative-filtering signals.
