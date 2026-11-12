---
name: sleeve-verify
description: Use when finishing any Sleeve code change, before reporting done or committing. Runs the full check suite, targeted tests, isolated manual verification and residue checks.
---

# Sleeve verify

Definition of done for this repo. Do not report complete until every applicable item passes.

## 1. Full check

```bash
bun run check
```

This runs `tsc --noEmit`, Biome lint, `bun test` and the production build. Report the first real failure with `file:line`; do not paper over it.

## 2. Targeted tests

Run the tests that cover the changed logic:

```bash
bun test src/lib/search-query.test.ts
bun test server/import-flow.test.ts
bun test src/components/header.test.tsx
```

Add a test when the change is pure logic (parser, mapping, scoring, formatting) or a cross-layer import/export/migration flow.

## 3. Manual flow

Use a disposable database, never the real one:

```bash
scripts/temp-db.sh bun run seed
scripts/temp-db.sh bun server/index.ts
```

For UI work, run `PORT=3001 scripts/temp-db.sh bun server/index.ts` and `bun run dev:web` in another terminal so Vite's `/api` proxy reaches the temp API. Default temp port is 3099. Exercise the touched flow on desktop and mobile.

## 4. Residue check

Confirm the real DB was not modified by manual testing:

```bash
bun -e 'const { prisma } = await import("./server/db"); console.log({ releases: await prisma.release.count(), wishlist: await prisma.wishlistItem.count() })'
```

Stop temp servers and remove copied DBs and temp data directories.

## 5. Docs sync

Update the matching doc when behavior, schema, API, commands or UI patterns changed:

- `docs/development/data-model.md` — schema, fields, invariants, import/export
- `docs/development/api.md` — endpoints and payloads
- `docs/development/architecture.md` — flows and module layout
- `docs/development/design-system.md` — UI patterns
- `docs/development/discovery.md` — Discover inputs, ranking, cache
- `docs/development/operations.md` — commands, env, backups, troubleshooting
- `docs/development/decisions.md` — why a choice was made

Static facts belong in `AGENTS.md` or `docs/`, never copied into a skill.

## 6. Review

```bash
git status
git diff --stat
```

If documentation or skills changed, also run:

```bash
bun run docs:build
```

Check for accidental files (`prisma/dev.db*`, `data/`, `dist/`, `.env`) and unrelated edits. Commit only when the user explicitly asks, using Conventional Commits.

## Report

State what changed, which commands passed, what was tested manually, and any remaining risk. Keep it short.
