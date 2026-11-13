# Changelog

All notable changes to Sleeve are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- The published GHCR image is now the primary Docker path; `docker-compose.image.yml` accepts `SLEEVE_VERSION` and the auth/user-agent variables.

## [0.1.0] - 2026-11-13

### Added

- Collection library with releases, tracks, formats, condition, rating, notes and purchase details.
- MusicBrainz metadata enrichment, Cover Art Archive covers and manual match/refresh flows.
- Discogs CSV import, JSON backup/restore and CSV export.
- Separate wishlist with target prices and notes.
- Discover feed with artist follows, saved suggestions and listening links.
- Collection statistics and spending totals by currency.
- Docker deployment, optional Basic auth and PWA support.
- Settings → About now shows the app version, commit and build date, with a link to releases.
- Public `GET /api/version` endpoint for checking a running instance.
- Tagged releases with notes generated from this changelog.
- Docker images carry OCI version and revision labels; `bun run docker:build` tags both `sleeve:<version>` and `sleeve:latest`.
- Tagged releases publish multi-arch (`amd64`/`arm64`) images to `ghcr.io/nicuz/sleeve`, with a minimal `docker-compose.image.yml` stack.
- Docker Compose takes an optional `SLEEVE_PORT` for the host port; the container and production default stay `3001`.
- Static read-only demo at `/demo/` with real album artwork, CD/Vinyl/Cassette formats and EUR prices.

### Fixed

- Wishlist grid cards reserve a two-line note slot, so cards with and without notes stay aligned and long notes truncate instead of changing row height.
