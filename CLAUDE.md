# CLAUDE.md — Grid

Read PROJECT_BRIEF.md first; it is the authoritative spec. This file is the quick reference.

## Status

- **Phase 0 complete** (repo scaffold; apps boot, CI defined).
- **Phase 1 complete** (design & specification): Prisma ERD + initial migration
  (`apps/api/prisma/`), OpenAPI skeleton (`docs/api/openapi.yaml`), WS event contract
  (`packages/shared/src/ws-events.ts` + `docs/ws-contract.md`), ADRs 0002–0004,
  design tokens extracted (`packages/ui-tokens`).
- **Phase 2 in progress.** Done: init migration applied (ledger append-only triggers
  verified live), auth (register/login/refresh rotation + reuse detection), users
  (me/profile/follow), global JWT guard + throttler, CORS, e2e-verified against
  Postgres; @grid/api-client now real (openapi-typescript + openapi-fetch, generated
  from docs/api/openapi.yaml — regenerate via `pnpm --filter @grid/api-client generate`
  after contract changes); packages build dual CJS+ESM via tsup; web auth + profile
  screens live against the API (ui-tokens via CSS vars); mobile auth + profile screens
  (expo-secure-store sessions, API URL derived from the Metro host).
  Remaining in Phase 2: email OTP, Google/Apple OAuth, Sentry — all owner-blocked.
- **Phase 3 core done**: double-entry LedgerService (idempotency keys, per-currency
  zero-sum, FOR UPDATE row locks against overdraw), Stripe Checkout top-ups + signature-
  verified webhook crediting (exactly once), wallet endpoints + web wallet UI,
  reconciliation script (`pnpm --filter @grid/api reconcile`), Testcontainers +
  fast-check invariant suite (12 tests). Stripe TEST keys live in apps/api/.env
  (gitignored). Remaining: see Phase 3 section of docs/deferred.md.
- **Phase 4 backbone done**: streams lifecycle (create/go-live/end), discover feed,
  entitlement gate (§3.4 enforced for chat AND media tokens), Socket.IO gateway on
  /rt with Redis adapter (join/leave, chat, presence, throttled viewer counts, rate
  limits), ADR-0002 batch persistence, creator message removal. Verified live 13/13
  (two socket clients, gated join rejected, 402/503 token paths, persistence).
  LiveKit video = owner-blocked on keys. Web live UI shipped: router (/, /stream/:id,
  /go-live, /me), Discover grid with lock badges, Go Live form, live room with working
  chat + creator moderation + gate screen; video slot mounts LiveKit once keys exist.
- **Phase 5 done** (verified 11/11): server-driven gift catalog (seeded from the
  prototype), send-gift = 5-entry cross-currency ledger tx (70/30, rounding favors
  the creator, computeGiftSplit in shared), combo counters + session top-gifters in
  Redis, gift:sent broadcasts, web gift bar + floating animations. Books reconcile
  to zero in both currencies.
- **Phase 4 mobile UI shipped**: React Navigation bottom tabs (Discover / Go Live /
  Wallet / Me) + full-bleed live room (overlay chat, action rail, swipe/chevron
  next-stream, bottom-sheet gift drawer, gate screen). Wallet is view-only on mobile
  until RevenueCat IAP.
- **Phase 6 core done** (verified 11/11): PPV unlock = PPV_UNLOCK ledger tx (75/25)
  - stream_access_grant with SERVER-derived idempotency (`ppv:{stream}:{user}` — pay
    once across devices); unlock buttons on web + mobile gates; private-stream INVITE
    endpoint. Chat gateway auth moved to socket middleware (fixes a connect race).
    Subscriptions deferred pending owner sign-off on the coin peg (docs/deferred.md).
- **Economics are runtime-adjustable (ADR 0005)**: creator-set prices; platform
  revshare %, coin peg, payout minimum/hold all live in app_config `economics`,
  read via EconomicsService (30 s cache, loud default fallback). Change via
  `pnpm --filter @grid/api set-economics -- '<json>'` until the admin app.
- **Phase 7 core done** (verified 7/7 + refund path): Connect Express onboarding
  (503 until owner enables Connect), payout request = PAYOUT ledger tx into a
  clearing account (client idempotency key), min/hold checks, approve script →
  Stripe transfer with automatic coin REFUND + audit_log on failure. Ledger fix:
  idempotency lookup now precedes the balance check (replays after balance drops
  return the original tx — regression-tested).
- **Phase 8 core done** (verified 14/14): staff auth = separate JWT secret + typ
  claim, TOTP 2FA mandatory (enroll-on-first-login via signed enroll token), user
  tokens rejected on /admin. Admin app: payout queue (approve/reject with refund),
  report queue (BAN/SUSPEND revokes sessions; REMOVE_CONTENT hides chat), user
  lookup (money read-only), economics editor, audit viewer. Every mutation lands
  in append-only audit_log. Dev login: admin@grid.local / admin12345! (CHANGE IT).
  POST /reports lets users file reports.
- **Multi-source streaming (LIVE)**: LiveKit keys configured; `/streams/{id}/token`
  mints real tokens; web live room mounts the LiveStage with per-source toggles
  (camera+mic+screen(+audio), ADR 0004) for creators and screen-share-first layout
  for viewers. Mobile video waits on an EAS dev-client build (deferred.md).
- **Web subscriptions (LIVE, ADR 0005)**: creators set their own monthly price
  (`subPriceCents`); viewers subscribe via Stripe Billing; `invoice.paid` credits
  the creator 70% in coins at the 1¢ peg (SUB ledger tx, idempotent per invoice);
  SUBS entitlement opens for active subscribers. Verified 11/11 + reconcile. Coin
  peg confirmed by owner: **1 coin = 1¢**. Mobile subs need RevenueCat.
- **Provider keys configured** in apps/api/.env: LiveKit (live), Stripe (secret +
  webhook), RevenueCat (test SDK key only — mobile IAP needs store products +
  webhook secret, deferred.md).
- **Staff roles & permissions (ADR 0006)**: permission matrix in
  apps/api/src/admin/permissions.ts; endpoints declare @RequirePermission, AdminGuard
  enforces per-role. Roles: SUPERADMIN/ADMIN/MODERATOR/TECH_SUPPORT/BILLING_SUPPORT/
  SUPPORT/MARKETING/ANALYST. Moderator holds `moderation.view_gated` — audited
  view-only token for paywalled content (legal monitoring). Admin app: Staff CRUD +
  Marketing CMS (banners/promos with time windows; targeting JSON scaffolded) tabs.
- **Phase 9 partial**: in-app notifications (module + gift/follow hooks + bell/inbox
  on web & mobile). Push/email/VOD deferred (providers + LiveKit keys). Verified 20/20.
- **docs/deferred.md is the skip ledger** — every intentionally skipped item lives
  there. Add to it when skipping; review it at each phase boundary.
- Remote: `github.com/Boltworks-lab/grid_livestream` (repo-scoped credential —
  `credential.useHttpPath true`). Local Postgres runs on **host port 5433** (native
  Windows Postgres owns 5432); Redis on 6379. Mobile is pinned to **Expo SDK 54**
  (Play Store Expo Go cap — see apps/mobile/AGENTS.md).
- Work strictly in phases (brief §9). Confirm the plan with the owner before each phase.

## Stack (ADR 0001)

TypeScript everywhere. React 19.1 + Vite (web, admin; pinned via pnpm.overrides) ·
Expo/React Native SDK 54 (mobile) · NestJS
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
