---
title: Getting started
description: Install Sleeve, open your library and add the first record.
---

# Getting started

Sleeve is a single-user app for your CD and vinyl collection. It runs on your machine or server, keeps everything in one local database and has no accounts or telemetry.

## Run it

The fastest route is Docker:

```bash
git clone https://github.com/Nicuz/sleeve.git
cd sleeve
docker compose up -d --build
```

Open [http://127.0.0.1:3001](http://127.0.0.1:3001).

From source, with Bun 1.4 or newer:

```bash
bun install
cp .env.example .env
bun run db:deploy
bun run dev
```

## Run it on a server

Start with the Docker command above. For a long-running server:

1. Optional login: set both `SLEEVE_AUTH_USER` and `SLEEVE_AUTH_PASSWORD` in `.env`, then restart with `docker compose up -d`. Set both or neither.
2. Upgrade with:

   ```bash
   git pull
   docker compose up -d --build
   ```

   Pending migrations run on startup.
3. Download a backup from **Settings → Backup & restore** after upgrades and before risky changes.

Environment variables, Docker details and hardening live in [Operations](../development/operations.md#production).

## Add your first record

1. Select **Add a release** on the library page.
2. Search for an artist, album or barcode.
3. Pick the exact edition, adjust format and condition, then select **Add to collection**.

Sleeve pulls the cover, label, year and tracklist from MusicBrainz. You can edit the release later without losing your own condition, rating, notes or purchase details.

See [Adding releases](adding-releases.md) for both search and manual entry.

## Bring over an existing collection

If your shelf already lives on Discogs:

1. Export your collection as CSV from Discogs.
2. Open **Import from Discogs** in Sleeve.
3. Drop the CSV, review the detected columns and import.

Discogs rows have no MusicBrainz IDs or covers. Run the metadata download afterwards.

See [Importing from Discogs](importing-discogs.md).

## Find your way around

- **Library** — filters, search, grid/list view and missing-metadata review.
- **Discover** — weekly recommendations from your collection, wishlist and followed artists.
- **Wishlist** — records you want to buy, with optional target prices.
- **Insights** — formats, eras, genres and spending.
- **Settings** — theme, defaults, backups, caches and the danger zone.

## Protect your data

Open **Settings → Backup & restore → Download backup** before big edits or imports. The JSON file contains releases, wishlist, saved finds, followed artists and defaults.

## Next steps

- [Adding releases](adding-releases.md)
- [Library and search](library-and-search.md)
- [Settings and backup](settings-and-backup.md)
- [Operations and deployment](../development/operations.md#production)
