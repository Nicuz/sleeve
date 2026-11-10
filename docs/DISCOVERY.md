# Discovery

Canonical reference for how Discover builds its feed. Read this before changing discovery; it is intentionally more detailed than `ARCHITECTURE.md`.

## TL;DR

- Source data: owned releases, wishlist, saved suggestions, `DiscoverySeen`.
- Metadata: MusicBrainz release groups; popularity: ListenBrainz release-group counts.
- Sections: Release Radar, New this week, New this month, Crate dig.
- Feed is cached 12h and refreshed automatically. There is no user-facing refresh button.
- `GET /api/discover?refresh=1` forces a rebuild (dev/internal only).
- Library, wishlist and saved mutations invalidate the feed.
- Code: `server/discovery.ts`, `server/listenbrainz.ts`, `server/musicbrainz.ts`, `src/pages/discover.tsx`.

## Inputs

`getCollectionSnapshot()` in `server/discovery.ts` reads:

| Source | Fields | Purpose |
| --- | --- | --- |
| `Release` | `title`, `artist`, `artistId`, `genres` | genre counts, artist counts, owned keys |
| `WishlistItem` | `title`, `artist` | exclude wanted releases |
| `SavedSuggestion` | `releaseGroupId` | exclude saved suggestions |
| `DiscoverySeen` | `releaseGroupId`, `seenAt` | deprioritise recent impressions |

Derived values:

- `topGenres`: top 3 genres by occurrence count.
- `topArtistIds`: top 15 owned artists by release count.
- `ownedKeys`: normalized `artist|title`.
- `ownedArtistIds`, `ownedArtistNames`.
- `savedGroupIds`.

## MusicBrainz queries

All calls live in `server/musicbrainz.ts`.

### Release Radar

```text
arid:(<top artist IDs>)
AND firstreleasedate:[today-30d TO today+90d]
limit 100
```

Function: `searchReleaseGroupsByArtistIds`.

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

All-time older albums/EPs, not just the last 2 years.

## Filters

Applied to every candidate:

- Keep studio albums/EPs only: `secondaryTypes` empty, primary type `Album` or `EP`.
- Remove Various Artists.
- Remove owned releases, wishlist items and saved release groups.
- New week/month sections also remove owned artists.
- Deduplicate release-group IDs.
- Limit repeated artists during selection.

## Popularity

`server/listenbrainz.ts` batches release-group IDs to:

```text
POST https://api.listenbrainz.org/1/popularity/release-group
```

Response fields used:

- `total_listen_count`
- `total_user_count`

Cache: in-memory, 24 hours. No SQLite table.

Score (`popularityScore` in `server/discovery.ts`):

```text
log10(1 + total_listen_count) + 0.35 * log10(1 + total_user_count)
```

Fallback when ListenBrainz has no data:

```text
log10(1 + MusicBrainz releaseCount) * 1.5
```

## Ranking and selection

### Release Radar / New this week / New this month

1. Sort by popularity descending.
2. Tie-break by release date descending.
3. `selectDiverse`:
   - unseen items first, seen items later
   - max 2 per artist
   - max 8 items per section
   - blocked IDs are skipped

### Crate dig

Monthly deterministic blend:

```text
0.72 * random(monthKey:releaseGroupId)
+ 0.28 * (popularity / maxPopularity)
```

- `monthKey` is `YYYY-MM`.
- Same month + same data → stable rotation.
- Different month → different Crate dig shelf.
- Max 1 per artist, 8 items.

### Lead pick

First available item from:

```text
Release Radar → New this week → New this month → Crate dig
```

The lead pick is removed from its section to avoid duplication.

## Output

Response shape (`DiscoverResponse`):

```ts
{
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
}
```

Each item includes release-group fields plus:

- `reason` — shown on cards/dialog
- `genre` — source genre when applicable

## Persistence and refresh

### `DiscoveryFeed`

One row with `id = "current"`:

- `payload` — JSON feed
- `generatedAt`
- `expiresAt` — 12 hours

### `DiscoverySeen`

One row per release group shown:

- `releaseGroupId`
- `artistId`
- `seenAt`

Rows older than 30 days are pruned. Seen items are deprioritised, not hard-excluded.

### Refresh behavior

- Fresh cache → returned immediately.
- Expired cache → cached feed returned immediately; rebuild runs in background.
- No cache → request waits for rebuild.
- `?refresh=1` → waits for rebuild.
- Single-flight via `rebuildPromise`.

### Invalidation

`invalidateDiscoveryFeed()` sets `expiresAt` to epoch. Called after mutation of:

- releases: create, update, delete, enrich, match, refresh
- wishlist: create, update, delete
- saved suggestions: save, promote, delete

## How to refresh manually

Force server rebuild:

```bash
curl -s "http://localhost:3001/api/discover?refresh=1" > /dev/null
```

Clear feed and seen history:

```bash
bun -e 'import { prisma } from "./server/db"; await prisma.discoveryFeed.deleteMany(); await prisma.discoverySeen.deleteMany(); await prisma.$disconnect();'
```

Restarting the server alone does **not** clear the cached feed.

## UI behavior

`src/pages/discover.tsx`:

- Tabs: `For you` and `Saved N` (`?view=saved`).
- `For you` shows lead pick + sections.
- Cards open `SuggestionDialog`, not the Add release form.
- Dialog actions: Add to wishlist, Save for later, I already own it.
- `I already own it` opens the edition picker prefilled with `rgid:<releaseGroupId>`.
- No manual refresh button. Shows `Updated … · refreshes automatically`.

## Current limitations

- MusicBrainz tag data is noisy and has no mainstream weighting.
- Popularity is release-group-level only; artist popularity is not fetched yet.
- New releases often have no ListenBrainz listens, so `releaseCount` fallback can dominate.
- Crate dig uses a 100-item MusicBrainz candidate pool per genre, not the full catalogue.
- Release dates can be year-only or differ by edition/country.

## Likely next improvements

1. Add ListenBrainz **artist** popularity and rank new releases by artist strength.
2. Add a relative popularity floor for New this week/month when enough candidates exist.
3. Version the feed cache key so algorithm changes invalidate automatically.
4. Expand candidate pools or use decade partitions for Crate dig.
