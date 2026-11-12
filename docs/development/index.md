---
title: Development
description: Start here to work on Sleeve's code, database, API and interface.
---

# Development

Sleeve is a Bun + Elysia backend with a React/Vite frontend, Prisma and SQLite. The app is deliberately small and single-user.

## Read first

1. [Project rules and invariants](https://github.com/Nicuz/sleeve/blob/main/AGENTS.md) — golden rules, invariants and the repo map.
2. [Architecture](architecture.md) — runtime modes, modules and request flows.
3. [Data model](data-model.md) — Prisma models and invariants.
4. [API](api.md) — endpoints and payloads.

## Common tasks

| Task | Start with |
| --- | --- |
| Add a field or endpoint | [Data model](data-model.md), [API](api.md) |
| Change the UI | [Design system](design-system.md) |
| Change Discover | [Discovery](discovery.md) |
| Change metadata behavior | [Operations § Metadata enrichment](operations.md#metadata-enrichment) |
| Debug or deploy | [Operations](operations.md) |
| Understand a choice | [Decisions](decisions.md) |

## Local checks

```bash
bun install
bun run db:deploy
bun run check
```

`bun run check` runs typecheck, Biome lint, the test suite and a production build. For manual testing, use the disposable database:

```bash
scripts/temp-db.sh bun run seed
scripts/temp-db.sh bun server/index.ts
```

Never run destructive commands against `prisma/dev.db`; see [Contributing](contributing.md).

## Portable skills

Procedures for AI coding assistants live in `.agents/skills/` and work with OpenCode, Codex and Claude Code:

- `sleeve-data-safety`
- `sleeve-feature-slice`
- `sleeve-ui-change`
- `sleeve-musicbrainz`
- `sleeve-verify`
