---
title: FAQ
description: Common questions about covers, metadata, imports, backups and the PWA.
---

# FAQ

## Where is my data stored?

- Docker: the `sleeve-data` volume, mounted at `/data`.
- From source: `prisma/dev.db` for the database, `data/covers` for the cover cache and `data/backups` for snapshots.

Use **Settings → Backup & restore** for a portable JSON backup.

## A cover is missing. Is the match wrong?

Not necessarily. The Cover Art Archive does not have art for every edition. Open the release and use **Search match** to try another pressing. Cover failures are common enough that Sleeve gives them their own action.

## Metadata download skipped a record

Automatic matching is deliberately conservative. Low-confidence matches are skipped so the app does not attach the wrong album. Open the release and choose **Search match** to pick the correct edition manually.

## Refresh fails with a MusicBrainz message

MusicBrainz rate-limits requests. After a 503, Sleeve waits about 30 seconds before trying again. Wait and retry; do not bypass the service layer or hammer the API.

## Why does Sleeve reject this release as a duplicate?

The MusicBrainz ID is already in the library. Each ID can appear once. If you own a different edition, search for that edition. If you want two physical copies of the same edition, Sleeve cannot represent that yet.

## Can I refresh a manual release?

No. A manual release has no MusicBrainz ID to refresh. Use **Search match** to attach one, or keep it manual.

## Wishlist or saved find?

- **Wishlist** means you intend to buy it.
- **Saved** means you bookmarked a Discover suggestion.

They are separate on purpose. Saving a suggestion does not add it to the wishlist.

## Discogs import has no covers

Expected. Discogs CSV files contain no MusicBrainz IDs or cover URLs. Import first, then run **Download metadata** and fix individual matches.

## Discover looks the same for days

The feed is cached and refreshed weekly. There is no manual refresh button. Adding releases, wishlist items or followed artists improves later builds but does not rebuild the current feed immediately.

## The installed app shows an old version

The service worker only runs in production builds. Hard-reload, or clear the site data for the app and open it again. See [Operations](../development/operations.md#pwa-service-worker).

## Can several people use one instance?

Sleeve is single-user. Optional HTTP Basic auth protects an exposed instance, but there are no separate accounts or per-user libraries.

## How do I move to another machine?

Download a JSON backup, install Sleeve on the new machine and restore it with **Choose backup file**. For an exact database move, copy the SQLite file and restore it with the CLI; see [Operations](../development/operations.md#backups).

## Why is my spending total split by currency?

Prices in different currencies are not converted. Spending groups by currency, so use the currency selector to see one at a time.
