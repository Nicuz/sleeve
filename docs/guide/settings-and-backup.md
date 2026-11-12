---
title: Settings and backup
description: Theme, defaults, backups, caches, reset options and the danger zone.
---

# Settings and backup

Open **Settings** from the header.

## Appearance

- **Theme** — dark lounge or light reading view.
- **Accent color** — amber, coral, moss, sky or lilac.

Both apply instantly and are stored locally in the browser.

## Library view

- default grid or list
- default sort order

These are starting values; changing filters on the library page overrides them for that view.

## Library defaults

Defaults for new releases:

- format
- condition
- currency

Manual entries and the add-release dialog use them.

## Backup and restore

**Download backup** produces one JSON file with:

- releases and tracks
- wishlist
- saved Discover finds
- followed artists
- library defaults

**Choose backup file** previews the contents before writing anything. Two modes:

- **Add to my library** — merges, skips duplicates and keeps your current collection.
- **Replace my library** — deletes the current releases, wishlist, saved finds and follows, then restores the file. Type `RESTORE` to confirm.

Every import writes a `pre-import-*.db` snapshot first. Exact database snapshots are restored from the CLI; see [Operations](../development/operations.md#backups).

## Metadata and cover caches

- **Clear metadata** removes cached MusicBrainz searches and release details. Searches take longer afterwards.
- **Clear covers** removes the local cover image cache. Covers download again when needed.

Clearing a cache never deletes releases.

## Reset

**Reset defaults** restores appearance, library view and new-release defaults. It does not touch collection data.

## Danger zone

**Clear library** removes every release and track. Wishlist, saved finds, follows, preferences and caches stay. Type `DELETE` to confirm.

Download a backup first. There is no undo.

## Install as an app

A production build is installable as a PWA. Use the browser's install action; the app then opens in its own window. Offline mode caches the shell and previously viewed data. Development builds do not register the service worker.

If an update looks stale, hard-reload or clear the site data. See [Operations](../development/operations.md#pwa-service-worker).

## Login and HTTPS

Settings does not manage authentication. Set the optional Basic auth variables when running on a server; see [Getting started](getting-started.md#run-it-on-a-server).
