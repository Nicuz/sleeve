# Sleeve touchpoints

Use with `sleeve-feature-slice`. Paths are from the repo root.

## New persisted field

1. `prisma/schema.prisma` — model field, nullability, defaults, indexes.
2. New migration via `bun run db:migrate`; apply with `bun run db:deploy`.
3. `server/routes/<area>.ts` — Zod schema, create mapping, update mapping.
4. `prisma/seed.ts` — only if demo data should show the field.
5. `src/lib/types.ts` — `Release`, `WishlistItem`, `SavedSuggestion` or related type.
6. `src/lib/api.ts` — only if it has its own payload type.
7. UI forms and read views.
8. `docs/development/data-model.md`.

## New endpoint

1. Route file in `server/routes/`.
2. Register the plugin in `server/index.ts`.
3. Add the client method in `src/lib/api.ts`.
4. Add or extend types in `src/lib/types.ts`.
5. Call it from a page or component through `api.*`.
6. Update `docs/development/api.md`.

## New page

1. `src/pages/<name>.tsx`.
2. Lazy route in `src/App.tsx`.
3. Add to `src/components/sidebar.tsx` and `mobile-nav.tsx` only for primary destinations.
4. Header follows `docs/development/design-system.md` § Page headers and actions.
5. Empty, loading and error states using `EmptyState`, skeletons and `useToast`.
6. Update `docs/development/architecture.md` and `docs/development/design-system.md` file map.

## New filter or sort

1. `src/pages/<page>.tsx` — control and URL/search-param state.
2. `src/lib/api.ts` — query params.
3. `server/routes/<area>.ts` — parse params, build `where` / `orderBy`.
4. `src/lib/settings.tsx` or `src/lib/search-preferences.ts` — persistence if a preference.
5. `docs/development/api.md` and the page doc section.

## Search change

1. `shared/search-query.ts` — operators and parser. This is the single source.
2. `src/lib/search-query.ts` only re-exports; never fork the parser.
3. `server/search-query.ts` — Prisma filters for releases and wishlist.
4. `server/search-index.ts` and the FTS migration — ranking, triggers, fallback.
5. `src/components/global-search.tsx` — operators, scopes, recents, inline actions.
6. Tests: `src/lib/search-query.test.ts` and any server search test.

## MusicBrainz or Discover change

1. Read `sleeve-musicbrainz`.
2. Service functions in `server/musicbrainz.ts`.
3. Enrichment in `server/release-metadata.ts`.
4. Discover logic in `server/discovery.ts`; routes in `server/routes/discover.ts`.
5. Update `docs/development/discovery.md` when ranking, inputs or refresh behavior changes.

## Import or export change

1. `server/import-data.ts` for the shared merge pipeline.
2. `server/routes/import.ts` and `server/routes/export.ts`.
3. `src/lib/discogs.ts` for CSV mapping only.
4. `src/pages/import-csv.tsx` and `src/components/import-backup-dialog.tsx`.
5. Update `docs/development/data-model.md` import/export sections.
