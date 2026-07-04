# CLAUDE.md — Grid

Read PROJECT_BRIEF.md first; it is the authoritative spec. This file is the quick reference.

## Status

- **Phase 0 complete** (repo scaffold; apps boot, CI defined).
- **Phase 1 complete** (design & specification): Prisma ERD + initial migration
  (`apps/api/prisma/`), OpenAPI skeleton (`docs/api/openapi.yaml`), WS event contract
  (`packages/shared/src/ws-events.ts` + `docs/ws-contract.md`), ADRs 0002–0004,
  design tokens extracted (`packages/ui-tokens`).
- **Pending:** apply init migration to a live DB (Docker was wedged, owner rebooting);
  push to GitHub (`Boltworks-lab/grid_livestream` — needs collaborator access for the
  machine's `skipper-logistics` credential). Mobile is pinned to **Expo SDK 54** (Play
  Store Expo Go cap — see apps/mobile/AGENTS.md).
- Next: **Phase 2 — foundations** (auth email/OTP + Google/Apple, JWT + refresh rotation,
  users/profiles/follows, RBAC guards, rate limiting, Sentry; auth screens web + mobile).
- Work strictly in phases (brief §9). Confirm the plan with the owner before each phase.

## Stack (ADR 0001)

TypeScript everywhere. React 18 + Vite (web, admin) · Expo/React Native (mobile) · NestJS
modular monolith (api) · PostgreSQL + Prisma + Redis · Socket.IO · LiveKit Cloud · Stripe +
RevenueCat · Stripe Connect payouts · pnpm 10 + Turborepo.

## Commands

- `pnpm lint` / `pnpm format:check` / `pnpm typecheck` / `pnpm test` / `pnpm build` — what CI runs
- `pnpm dev` — all dev servers; `pnpm --filter @grid/<app> dev` for one
- `docker compose -f infra/docker-compose.yml up -d` — Postgres + Redis
- Node 22.12 on this machine → pnpm **10** (11 needs ≥ 22.13)

## Hard rules (brief §3 — never weaken)

1. Wallet = double-entry ledger; immutable entries; balances derived; idempotent money
   mutations in DB transactions.
2. Server-authoritative economy — clients render, never decide.
3. Payments credited only from verified webhooks, exactly once.
4. Gated streams enforced at the media layer (LiveKit token minted after entitlement check).
5. Admin is a separate app, separate auth, TOTP 2FA, append-only audit_log.
6. zod validation at every edge (schemas in packages/shared).
7. Secrets in env only; rate-limit auth/chat/gifting/payouts.
8. DB changes via migrations only.
9. Conventional commits; CI green before merge.

## Conventions

- `prototypes/` is reference-only — never edit or import from it; re-implement in React/RN.
- Business logic lives in `packages/shared` (pure TS, no React imports) so a future native
  port only rewrites the view layer (brief §5).
- Vitest everywhere, including NestJS (unplugin-swc for decorator metadata).
- Shared packages build to `dist/` (CJS + d.ts); turbo `^build` ordering handles deps.
- When a decision is ambiguous: write a short ADR option list in `docs/adr/` and ask.
