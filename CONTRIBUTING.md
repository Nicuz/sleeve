# Contributing

Sleeve is a personal Bun + React app. Keep changes small, typed and easy to review.

> Delegating a change? Require this workflow and a short report: commands run, feature tested, and any remaining risk. You do not need to run commands yourself.

## Setup

```bash
bun install
cp .env.example .env   # if .env is missing
bun run db:deploy
bun run dev
```

- UI: http://localhost:5173
- API: http://localhost:3001
- DB: `prisma/dev.db` (ignored by git)

Optional demo library: `bun run seed` adds demo records to your development database. For an isolated demo database, use `bun run sample` and start against `sample.db`.

## Feature requests

Have an idea, or found something that could work better? Open an issue and describe what you were trying to do, what got in the way, and what you hoped would happen. You do not need to know how Sleeve is built. A plain description is enough.

Sleeve is a personal app that keeps the collection on your machine. Ideas that add accounts, let several people share one library, show marketplace prices or estimate what a collection is worth need a conversation first. They are not automatically out of reach, but they change what the app is.

If you write code, small fixes and copy changes are welcome as a pull request.

## Verify a change

A change is done when the automated checks pass and the changed feature has been exercised in the app.

### 1. Automated checks

```bash
bun run check
```

This runs typecheck, Biome, tests and the production build.

### 2. Manual check on a disposable database

```bash
scripts/temp-db.sh bun server/index.ts
```

`temp-db.sh` creates a temporary SQLite database, points `DATA_DIR` and `BACKUP_DIR` at a temporary folder, runs the command, and deletes everything on exit.

1. Open http://localhost:3099.
2. Click through the changed feature. Add a test record if needed.
3. Check desktop and mobile widths for UI changes.
4. Stop the server with `Ctrl+C`.
5. Run `bun run docs:build` if docs changed.

Never run manual tests against `prisma/dev.db`; that file is the real collection.

## Commits

Keep `main` working. One logical change per commit. Use Conventional Commits:

```text
<type>(<scope>): <summary>
```

Common types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`.

```text
feat(web): add dedicated release page

Replace the release drawer with a /releases/:id route so records
can be linked and opened in a new tab.

Closes #14
```

Rules:

- Imperative, lowercase summary, no trailing period, max 72 characters.
- Commit a working state.
- Explain **why** in the body when it is not obvious.
- Never commit `.env`, `prisma/dev.db`, `data/`, `dist/` or secrets.
- Do not rewrite shared history or force-push.

## Releases

`package.json` holds the version and releases are tagged `vX.Y.Z`.

1. Move the relevant `CHANGELOG.md` entries from `[Unreleased]` into a dated `## [X.Y.Z]` section.
2. Bump `"version"` in `package.json` (same value, no `v`).
3. Commit as `chore(release): vX.Y.Z`.
4. Tag and push:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main --tags
```

The tag must equal `v${package.json.version}`. The release workflow fails otherwise, then runs `bun run check` and publishes a GitHub Release using the matching changelog section.

## Code

- TypeScript strict. Avoid `any`; justify casts.
- Pages in `src/pages`, UI in `src/components`, routes in `server/routes`.
- Keep routes thin; shared logic in `server/*.ts`.
- All MusicBrainz calls go through `server/musicbrainz.ts`.
- Preserve user-owned fields on metadata updates: condition, rating, notes and purchase details.
- Store genres comma-separated; order tracks by disc, number, position.
- Use theme tokens from `src/index.css`; no new hard-coded palettes.
- Add `aria-label` to icon-only controls.
- Schema changes need a migration (`bun run db:migrate`) and `bun run db:deploy`.
- Avoid comments unless they explain non-obvious intent.

## Docs

| File | Purpose |
| --- | --- |
| `AGENTS.md` | project rules and invariants |
| `.agents/skills/` | portable project procedures |
| `docs/guide/` | user guide, including server steps |
| `docs/development/` | architecture, API, data model, design, operations, decisions |
| `README.md` | setup and feature overview |
| `CHANGELOG.md` | release notes, grouped by version |

Update the matching doc when schema, API, commands or architecture change. Release notes go in `CHANGELOG.md`, not in a separate draft.
