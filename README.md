<h1 align="center">
  <img src="public/favicon.svg" width="40" height="40" alt="Sleeve logo" />
  Sleeve
</h1>

<p align="center"><strong>Every record you own, on one dust-free shelf.</strong></p>

<p align="center">
  <a href="https://github.com/Nicuz/sleeve/actions/workflows/ci.yml"><img src="https://github.com/Nicuz/sleeve/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
</p>

Sleeve keeps your CD and vinyl collection organized — covers, tracklists, what you paid, and what you're still hunting for. It runs on your machine: no accounts, no cloud, no telemetry.

<p align="center">
  <img src="docs/public/screenshot.webp" width="660" alt="Sleeve library on desktop: collection grid with album covers, formats and listening stats" />
  <img src="docs/public/screenshot-mobile.webp" width="210" alt="Sleeve library on a phone: two-column collection grid with format badges" />
</p>

## Features

- **Catalog your collection** — covers, labels, barcodes, genres, ratings and tracklists.
- **Import from Discogs** — export your collection as CSV; Sleeve detects the columns, previews the rows and brings the whole shelf over in one go.
- **Skip the typing** — search MusicBrainz by name, barcode or artist and add the exact edition.
- **Know what you spent** — spending by month, format and shop.
- **Keep a wishlist** — separate from your shelf, with target prices.
- **Take it with you** — JSON backup and restore, plus an installable app that works offline.

## Quick start

```bash
git clone https://github.com/Nicuz/sleeve.git
cd sleeve
docker compose up -d --build
```

Open **http://127.0.0.1:3001**. Your library lives in the `sleeve-data` volume; back it up from **Settings → Backup & restore**. Update later with `git pull && docker compose up -d --build`.

Defaults suit a local install. Trimmed view with the knobs that matter:

```yaml
services:
  sleeve:
    build: .
    image: sleeve:latest
    ports:
      - "127.0.0.1:3001:3001"   # localhost only
    environment:
      # Optional login: set both or neither
      # SLEEVE_AUTH_USER: you
      # SLEEVE_AUTH_PASSWORD: secret
    volumes:
      - sleeve-data:/data        # database, cover cache and backups

volumes:
  sleeve-data:
```

The volume is the only thing you need: the image stores SQLite at `/data/sleeve.db` and covers next to it.

Anyone who can reach port 3001 gets in by default. Setting both auth variables makes Sleeve ask for that username and password — HTTP Basic auth — before it serves anything.

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

See [CONTRIBUTING.md](CONTRIBUTING.md) for checks, branches and commits.

</details>

## Docs

- [User guide](docs/guide/getting-started.md)
- [Run on a server](docs/guide/getting-started.md#run-it-on-a-server)
- [Architecture](docs/development/architecture.md)
- [API](docs/development/api.md)
- [Contributing](CONTRIBUTING.md)

The docs site is built with VitePress:

```bash
bun run docs:dev
bun run docs:build
```

For a GitHub project page, pass the repository base path: `DOCS_BASE=/sleeve/ bun run docs:build`.

## License

MIT — see [LICENSE](LICENSE).
