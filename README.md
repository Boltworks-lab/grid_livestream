# Grid

Live-streaming creator-economy platform: creators go live, viewers buy **diamonds** and
spend them on animated gifts, creators convert gifts to **coins** and withdraw real money.
See [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) for the full vision, rules, and phased plan.

**Current phase: 0 — repo scaffold.** Apps boot but contain no product features yet.

## Layout

```
apps/
  web/       React 18 + Vite — viewer/creator web app
  admin/     React 18 + Vite — internal ops app (separate auth, TOTP 2FA from Phase 8)
  mobile/    React Native (Expo) — viewer/creator mobile app
  api/       NestJS modular monolith — REST + WebSockets
packages/
  shared/    zod schemas, types, constants (fee rates, gift catalog later)
  api-client/  typed client generated from OpenAPI in Phase 1 (placeholder)
  ui-tokens/   design tokens extracted from the prototypes in Phase 1 (placeholder)
prototypes/  the original HTML/CSS/JS prototypes — reference-only, do not edit or import
infra/       docker-compose (Postgres 16 + Redis 7); IaC later
docs/        ADRs, runbooks, API docs
```

## Getting started

Prerequisites: Node ≥ 22.12, pnpm 10 (`npm i -g pnpm@10`), Docker Desktop.

```sh
pnpm install
docker compose -f infra/docker-compose.yml up -d   # Postgres :5432, Redis :6379
cp .env.example .env

pnpm dev                       # all dev servers via turbo, or individually:
pnpm --filter @grid/api dev    # http://localhost:3001/health
pnpm --filter @grid/web dev    # http://localhost:5173
pnpm --filter @grid/admin dev  # http://localhost:5174
pnpm --filter @grid/mobile start  # Expo (QR code / emulator)
```

## Quality gates

CI runs `lint`, `format:check`, `typecheck`, `test`, `build` on every push/PR — the same
commands work locally. Commits follow [Conventional Commits](https://www.conventionalcommits.org)
(enforced by commitlint via husky).

## Non-negotiables

The engineering rules in [PROJECT_BRIEF.md §3](./PROJECT_BRIEF.md) (double-entry ledger,
server-authoritative economy, webhook-verified payments, media-layer gating, RBAC + audit
log, zod at every edge, migrations only) are binding. Do not weaken them.
