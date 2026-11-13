---
title: Getting started
description: Install Sleeve, open your library and add the first record.
---

# Getting started

Sleeve is a catalog for a physical collection. It does not play music and it does not replace streaming. You add the records you own, Sleeve fetches covers and tracklists from MusicBrainz, and everything stays in one local SQLite database.

There are no user accounts and no telemetry. One instance holds one collection.

Want to look around first? Try the [static demo](https://nicuz.github.io/sleeve/demo/). It uses made-up records and read-only data.

## Run it

The fastest route is the published multi-arch image:

```bash
curl -fsSLO https://raw.githubusercontent.com/Nicuz/sleeve/main/docker-compose.image.yml
docker compose -f docker-compose.image.yml up -d
```

Open [http://127.0.0.1:3001](http://127.0.0.1:3001). Pin a release with `SLEEVE_VERSION=0.1.0` in `.env`; the default is `latest`. If `3001` is taken, set `SLEEVE_PORT=3011`.

Data lives in the named volume `sleeve-data` by default. To use a host directory instead:

```dotenv
SLEEVE_DATA_DIR=/opt/stacks/sleeve/data
```

The image's entrypoint creates the directory and fixes ownership before starting the app. No manual `chown` needed.

Or clone and build the image locally:

```bash
git clone https://github.com/Nicuz/sleeve.git
cd sleeve
docker compose up -d --build
```

From source, with Bun 1.4 or newer:

```bash
bun install
cp .env.example .env
bun run db:deploy
bun run dev
```

## Run it on a server

Start with one of the Docker commands above. For a long-running server:

1. Optional login: set both `SLEEVE_AUTH_USER` and `SLEEVE_AUTH_PASSWORD` in `.env`, then recreate the stack. Set both or neither.
2. Upgrade the published image with:

   ```bash
   docker compose -f docker-compose.image.yml pull
   docker compose -f docker-compose.image.yml up -d
   ```

   Or upgrade a source build with:

   ```bash
   git pull
   SLEEVE_COMMIT=$(git rev-parse --short HEAD) docker compose up -d --build
   ```

   Pending migrations run on startup. **Settings → About** and `/api/version` show the running version and commit.
3. Download a backup from **Settings → Backup & restore** after upgrades and before risky changes.

Tagged releases publish `ghcr.io/nicuz/sleeve` images for `linux/amd64` and `linux/arm64`. The minimal stack lives in `docker-compose.image.yml`: image, restart policy, localhost port and the `/data` volume. The volume keeps the SQLite database, covers and snapshots; back it up before upgrading.

Basic auth protects an exposed instance. It does not add user accounts or separate libraries. Environment variables, Docker details and hardening live in [Operations](../development/operations.md#production).

## Add your first record

1. Select **Add a release** on the library page.
2. Search for an artist, album or barcode.
3. Pick the exact edition, adjust format and condition, then select **Add to collection**.

Sleeve pulls the cover, label, year and tracklist from MusicBrainz. You can edit the release later without losing your own condition, rating, notes or purchase details.

See [Adding releases](adding-releases.md) for both search and manual entry.

## Import an existing collection

If your shelf already lives on Discogs:

1. Export your collection as CSV from Discogs.
2. Open **Import from Discogs** in Sleeve.
3. Drop the CSV, review the detected columns and import.

Discogs rows have no MusicBrainz IDs or covers. Run the metadata download afterwards.

See [Importing from Discogs](importing-discogs.md).

## The three parts

- [Library](library-and-search.md): every record you own, with filters, search and a review list for incomplete metadata.
- [Wishlist](wishlist.md): the records you are looking for, with optional target prices.
- [Discover](discover.md): records worth checking next, built from your shelf, your wishlist and the artists you follow.

Insights, settings, imports and backups are linked from the app when you need them.

## Protect your data

Open **Settings → Backup & restore → Download backup** before big edits or imports. The JSON file contains releases, wishlist, saved finds, followed artists and defaults.

## Next steps

- [Adding releases](adding-releases.md)
- [Library and search](library-and-search.md)
- [Settings and backup](settings-and-backup.md)
- [Operations and deployment](../development/operations.md#production)
