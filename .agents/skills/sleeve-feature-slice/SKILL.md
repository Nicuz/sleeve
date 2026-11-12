---
name: sleeve-feature-slice
description: Use when adding or changing a Sleeve feature across layers: a persisted field, API endpoint, page, filter, or behavior that touches both server and client. Maps files to change and invariants to preserve.
---

# Sleeve feature slice

Read `AGENTS.md` first. Classify the change, then follow the matching path in `references/touchpoints.md`.

## Workflow

1. Classify: data-only, API-only, UI-only, search, or integration (MusicBrainz, Discover, import).
2. Read the matching doc from the Fast lookup table in `AGENTS.md`.
3. List every layer the change crosses before editing.
4. Implement in order: schema → server → `src/lib/types.ts` → `src/lib/api.ts` → UI.
5. Preserve user-owned fields on every metadata path.
6. Run `sleeve-verify`.
7. Update the matching doc when behavior, schema, API or commands changed.

## Invariants

- `Release.format` is one of `CD`, `Vinyl`, `Cassette`, `Digital`, `Other`. Raw media goes in `formatDetail`.
- `Release.genres` is a comma-separated string, not an array.
- Dates are `YYYY-MM-DD` strings; prices are numbers, and UI inputs go through `parsePriceInput`.
- Tracks are ordered by `disc`, then `number`, then `position`. Replacing tracks happens in a transaction.
- `musicbrainzId` and `releaseGroupId` are unique when present. Catch Prisma `P2002` and return `409`.
- Wishlist means buy intent only. Discover bookmarks stay in `SavedSuggestion`.
- User-owned fields: condition, rating, notes, purchase date, purchase location, purchase price, purchase currency.

## API shape

- Routes live in `server/routes/*.ts` and are registered in `server/index.ts`.
- Validate request bodies with Zod `safeParse`, not ad-hoc checks.
- Return `{ message }` for errors and set `set.status` explicitly.
- Add the client method to `src/lib/api.ts`; keep response types in `src/lib/types.ts`.
- Client calls go through `api.*`; do not call `fetch` directly from components.

## UI contract

- Follow `sleeve-ui-change` for any interface work.
- Register a new page in `src/App.tsx` and add it to `src/components/sidebar.tsx` / `mobile-nav.tsx` only when it is a primary destination.

## Docs sync

| Change | Update |
| --- | --- |
| Schema, fields, invariants | `docs/development/data-model.md` |
| Endpoint or payload | `docs/development/api.md` |
| Flow or module layout | `docs/development/architecture.md` |
| UI rule or pattern | `docs/development/design-system.md` |
| Discover behavior | `docs/development/discovery.md` |
| Command, env or ops | `docs/development/operations.md` |
| Why, not what | `docs/development/decisions.md` |
