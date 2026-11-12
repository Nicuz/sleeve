<h1 align="center">
  <img src="public/favicon.svg" width="40" height="40" alt="Sleeve logo" />
  Sleeve
</h1>

<p align="center"><strong>Every record you own, on one dust-free shelf.</strong></p>

<p align="center">
  <a href="https://github.com/Nicuz/sleeve/actions/workflows/ci.yml"><img src="https://github.com/Nicuz/sleeve/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/Nicuz/sleeve/actions/workflows/pages.yml"><img src="https://github.com/Nicuz/sleeve/actions/workflows/pages.yml/badge.svg" alt="Docs" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
</p>

Sleeve keeps your CD and vinyl collection organized — covers, tracklists, what you paid, and what you're still hunting for. It runs on your machine: no accounts, no cloud, no telemetry.

<p align="center"><strong><a href="https://nicuz.github.io/sleeve/guide/getting-started">Read the guide →</a></strong></p>

<p align="center">
  <img src="docs/public/screenshot.webp" width="660" alt="Sleeve library on desktop: collection grid with album covers, formats and listening stats" />
  <img src="docs/public/screenshot-mobile.webp" width="210" alt="Sleeve library on a phone: two-column collection grid with format badges" />
</p>

## Features

- **Catalog your collection** — covers, labels, barcodes, genres, ratings and tracklists.
- **Import from Discogs** — export your collection as CSV; Sleeve detects the columns, previews the rows and brings the whole shelf over in one go.
- **Add the exact edition** — search MusicBrainz by name, barcode or artist and attach the right pressing.
- **Read the collection** — formats, eras, genres, spending and records that need attention.
- **Keep a wishlist** — separate from your shelf, with target prices.
- **Find the next record** — weekly Discover picks built from your collection, wishlist and followed artists.
- **Take it with you** — JSON backup and restore, plus an installable app that works offline.

## Quick start

```bash
git clone https://github.com/Nicuz/sleeve.git
cd sleeve
docker compose up -d --build
```

Open **http://127.0.0.1:3001**. Your library lives in the `sleeve-data` volume; back it up from **Settings → Backup & restore**. Update later with `git pull && docker compose up -d --build`.

For login, ports, data layout and upgrades, see [Run on a server](docs/guide/getting-started.md#run-it-on-a-server).

<details>
<summary><strong>Run from source</strong></summary>

Requires [Bun](https://bun.sh) 1.4 or newer.

```bash
bun install
cp .env.example .env
bun run db:deploy
bun run dev        # http://localhost:5173
```

Want demo data? Run `bun run sample`, then `DATABASE_URL="file:./sample.db" bun run dev`.

Set a real contact in `MUSICBRAINZ_USER_AGENT` before heavy metadata use.

See [CONTRIBUTING.md](CONTRIBUTING.md) for checks, commit rules and conventions.

</details>

## Docs

- [User guide](https://nicuz.github.io/sleeve/guide/getting-started) — install, add records, import Discogs, wishlist, Discover and backup.
- [Run on a server](https://nicuz.github.io/sleeve/guide/getting-started#run-it-on-a-server) — Docker, optional login and upgrades.
- [Development](https://nicuz.github.io/sleeve/development/) — architecture, API, data model, design, operations and local checks.
- [Architecture](https://nicuz.github.io/sleeve/development/architecture) · [API](https://nicuz.github.io/sleeve/development/api)
- [Contributing](https://nicuz.github.io/sleeve/development/contributing) — checks, commits and conventions.

Docs source lives in `docs/` and builds with VitePress. Local commands are in [Development](docs/development/index.md#docs-site).

## License

MIT — see [LICENSE](LICENSE).
