# ADR 0001 — Technology stack

- **Status:** Accepted
- **Date:** 2026-07-03
- **Source:** PROJECT_BRIEF.md §2 (decisions made by the product owner; recorded here so the
  rationale survives the brief)

## Context

Grid is a live-streaming creator-economy platform: live video, realtime chat and gifting, a
real-money virtual-currency ledger, payouts, and an internal ops app. Three user-facing
surfaces (web, mobile, admin) share one backend. The wallet is a financial ledger, so
correctness and auditability outrank raw throughput at this stage.

## Decision

One language — TypeScript — across every layer, in a pnpm + Turborepo monorepo.

| Layer         | Choice                                                                                                                                              | Rationale / rejected alternatives                                                                                                                                                                                                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web frontend  | React 18 + TypeScript + Vite                                                                                                                        | Shares mental model and code with React Native; largest realtime-UI ecosystem. Angular rejected: no benefit, splits knowledge from mobile.                                                                                                                                                                                                     |
| Mobile        | React Native (Expo, dev-client workflow) + TypeScript                                                                                               | Required by product owner; Expo speeds iteration while allowing native modules. Structured for a future Kotlin/Swift port: business logic lives in shared packages, screens stay thin (brief §5).                                                                                                                                              |
| Admin         | React + TypeScript, same design system                                                                                                              | One frontend skill set; RBAC-heavy internal tool; separate app with separate auth (brief §3.5).                                                                                                                                                                                                                                                |
| Backend       | Node.js + TypeScript + NestJS, single modular monolith                                                                                              | One language across the stack; first-class SDKs for Stripe, LiveKit, Socket.IO, FCM/APNs. FastAPI rejected: a Python split buys nothing and doubles the hiring/testing surface. Go rejected for now: right tool for a high-fanout chat gateway at scale — the one service we may extract later — but starting there is premature optimization. |
| Database      | PostgreSQL + Redis (cache/pubsub/presence/rate limits)                                                                                              | The wallet is a double-entry ledger; ACID is non-negotiable (brief §3.1).                                                                                                                                                                                                                                                                      |
| ORM           | Prisma                                                                                                                                              | Type-safe, migration-friendly; migrations only, never hand-edited DB (brief §3.8).                                                                                                                                                                                                                                                             |
| Realtime      | WebSockets via Socket.IO (NestJS gateway), Redis adapter for horizontal scale                                                                       | Chat, gift events, viewer counts, presence.                                                                                                                                                                                                                                                                                                    |
| Live video    | LiveKit Cloud (WebRTC) — no self-built media servers                                                                                                | Building RTMP/HLS infra is a multi-year distraction. LiveKit has React + RN SDKs and server-side room control (needed for the paywall gate: tokens minted only after entitlement checks, brief §3.4). Fallbacks: AWS IVS, Mux.                                                                                                                 |
| Payments in   | Stripe (web) + RevenueCat wrapping Apple/Google IAP (mobile)                                                                                        | App stores require IAP for digital goods and take 15–30%; web top-ups via Stripe avoid that cut. Webhooks are the source of truth for crediting (brief §3.3).                                                                                                                                                                                  |
| Payouts out   | Stripe Connect (Express)                                                                                                                            | KYC/identity, payouts, tax-form collection handled by the provider. Never hand-roll payouts.                                                                                                                                                                                                                                                   |
| Monorepo      | pnpm workspaces + Turborepo                                                                                                                         | Shared types and a generated API client between web, mobile, admin, api.                                                                                                                                                                                                                                                                       |
| Auth          | Email/phone + OAuth (Google, Apple — Apple mandatory on iOS when any social login exists), JWT access + rotating refresh tokens, TOTP 2FA for admin |                                                                                                                                                                                                                                                                                                                                                |
| Deployment    | Docker; Railway or Fly.io for api+Postgres+Redis at MVP; Vercel for web/admin; EAS for mobile. AWS (ECS/RDS) when traffic justifies it.             | No Kubernetes until it's earned.                                                                                                                                                                                                                                                                                                               |
| Observability | Sentry (all apps), PostHog (product analytics), pino structured logs → hosted drain, uptime checks                                                  |                                                                                                                                                                                                                                                                                                                                                |

## Consequences

- Hiring/testing surface is a single language; shared zod schemas validate at every edge.
- The chat gateway may be extracted to Go later if fanout demands it — the Socket.IO +
  Redis-adapter design keeps that extraction possible.
- LiveKit Cloud is a paid dependency; self-hosting remains an exit path for cost.
- App-store IAP fees make mobile diamond pricing channel-specific; pricing is modeled per
  channel from Phase 3 onward.

## Phase 0 implementation notes (2026-07-03)

- pnpm 10 (not 11): the machine runs Node 22.12 and pnpm 11 requires ≥22.13. Pinned via
  `packageManager`. Corepack was bypassed (known signature-verification bug in the version
  bundled with Node 22.12); pnpm installed globally via npm instead.
- Vitest is the single test runner, including for NestJS (via `unplugin-swc`, since esbuild
  does not support `emitDecoratorMetadata`). Revisit only if Nest tooling friction appears.
- Shared packages compile to CJS + `.d.ts` via plain `tsc`; consumers depend on built output
  (`dependsOn: ^build` in turbo). Swap to tsup/dual-format in Phase 1 if needed for the
  generated api-client.
