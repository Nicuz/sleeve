# Contributing

Sleeve is a personal Bun + React music collection app. Keep changes small, typed and easy to review.

## Setup

```bash
bun install
cp .env.example .env   # if .env is missing
bun run db:push
bun run seed           # optional demo library
bun run dev
```

- UI: http://localhost:5173
- API: http://localhost:3001
- DB: SQLite at `prisma/dev.db` (ignored by git)

## Before every commit

```bash
bun run check          # typecheck + production build
```

Test the touched flow manually. For UI changes, check desktop and mobile widths.

## Branches

Keep `main` working.

```text
feat/short-description
fix/short-description
refactor/short-description
docs/short-description
chore/short-description
```

## Commits: Conventional Commits

Format:

```text
<type>(<scope>): <summary>

<optional body>

<optional footer>
```

### Types

| Type | Use |
| --- | --- |
| `feat` | new user-facing capability |
| `fix` | bug fix |
| `refactor` | code change without behaviour change |
| `perf` | performance improvement |
| `docs` | documentation only |
| `test` | tests only |
| `build` | dependencies, bundling, tooling |
| `ci` | CI/CD configuration |
| `chore` | maintenance with no product effect |
| `style` | formatting only, no logic change |
| `revert` | revert a previous commit |

### Scopes

Use a short area name: `web`, `api`, `db`, `mb`, `ui`, `stats`, `deps`, `docs`.

### Rules

- Imperative, lowercase summary: `add release page`, not `added release page`.
- No trailing period. Keep the summary at or below 72 characters.
- One logical change per commit. Do not mix refactors with features or fixes.
- Commit a working state: `bun run check` must pass.
- Explain **why** in the body when the change is not obvious.
- Reference issues/PRs in the footer: `Refs #12` or `Closes #12`.
- Mark breaking changes: `BREAKING CHANGE: ...`.
- Never commit `.env`, `prisma/dev.db`, `node_modules`, `dist`, secrets or tokens.
- Do not rewrite shared history or force-push.

### Examples

```text
feat(web): add dedicated release page

Replace the release drawer with a /releases/:id route so records
can be linked, opened in a new tab and read as a full page.

Closes #14
```

```text
fix(mb): retry rate-limited MusicBrainz requests

Retry 503 responses twice with backoff before surfacing an error.
```

```text
refactor(api): extract release payload validation
```

## Pull-request / change checklist

- Scope is small and focused.
- `bun run check` passes.
- New API input is validated with Zod.
- New UI has loading, empty and error states.
- Desktop + mobile checked.
- Screenshots included for visible UI changes.
- Prisma schema changes include `bun run db:push` and seed/DB verification.
- No secrets, local database files or build output committed.

## Code conventions

- TypeScript strict. Avoid `any`; justify casts.
- Follow existing structure: pages in `src/pages`, UI in `src/components`, API routes in `server/routes`.
- Keep server routes thin; shared logic in `server/*.ts`.
- All MusicBrainz requests go through `server/musicbrainz.ts` (rate limit + user agent).
- Store genres comma-separated; order tracks by disc/number.
- Use Tailwind theme tokens from `src/index.css`; avoid new hard-coded palettes.
- Add accessible names (`aria-label`) to icon-only controls.
- Do not add comments unless they explain non-obvious intent.
- Keep the MusicBrainz `musicbrainzId` unique; manual entries may omit it.

## Documentation map

- `AGENTS.md` — instructions for OpenCode sessions
- `README.md` — setup, features, scripts
- `docs/ARCHITECTURE.md` — runtime, modules, flows
- `docs/DESIGN_SYSTEM.md` — colors, typography, components, UI rules
- `docs/API.md` — endpoints and payloads
- `docs/DATA_MODEL.md` — Prisma models, invariants, import/export
- `docs/OPERATIONS.md` — backups, caches, troubleshooting
- `docs/ROADMAP.md` — done, next, deferred
- `docs/DECISIONS.md` — architectural decisions

Update the relevant docs when changing schema, API contracts, commands or architecture.
