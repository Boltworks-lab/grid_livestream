# Deferred items — the "don't forget" ledger

Things intentionally skipped or stubbed, with what unblocks each. Review at the start
of every phase; delete entries when done. (CLAUDE.md points here.)

## Blocked on owner input (placeholders exist in .env.example)

| Item                                                                  | Needs                                            | Placeholder / seam                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Email OTP login (Phase 2)                                             | Provider choice — Resend or Postmark — + API key | `EMAIL_API_KEY`; brief §7 suggests Resend/Postmark                                           |
| Google OAuth (Phase 2)                                                | Client ID + secret from Google console           | `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`; spec: `POST /auth/oauth/{provider}` |
| Apple Sign-In (Phase 2; mandatory on iOS once any social login ships) | Service ID + key from Apple developer console    | `APPLE_OAUTH_CLIENT_ID` / `APPLE_OAUTH_KEY_*`                                                |
| Sentry, all apps (Phase 2)                                            | DSN(s) from sentry.io                            | `SENTRY_DSN`                                                                                 |
| Zendesk + Metabase sign-off                                           | Owner vendor/cost approval                       | ADR 0003 records the recommendation                                                          |

## Phase 8 deferrals

- **Dashboards** — embed Metabase (ADR 0003) once the owner approves the vendor; the
  admin app reserves no UI for it yet.
- **IAM completeness** — staff CRUD, role-based permission matrix (only SUPERADMIN
  exists meaningfully), forced logout/session list. Roles are IN the token; per-role
  authorization checks land with staff CRUD.
- **Automated moderation (§8)** — chat keyword/ML filter, stream frame sampling,
  upload scanning; the human queue works, automation feeds it later.
- **Content/config management** — gift catalog CRUD, banners, featured, categories
  (admin edits economics only so far).
- **Marketing tools** (§6.6) — campaigns, promo codes, referrals.
- **Admin endpoints in the OpenAPI spec** — the admin app uses a small typed fetch
  for /admin/*; fold into the generated client with the contract-drift CI gate.
- **Deployment**: admin behind SSO/IP-allowlist (brief §12) when deployed.
- **Dev admin credential**: seeded `admin@grid.local` / `admin12345!` — change before
  anything is public.

## Phase 7 deferrals

- **Enable Stripe Connect** (owner, one click): Stripe dashboard → Connect → get
  started (test mode). Until then `POST /payouts/connect/onboard` returns a clear 503;
  the moment it's enabled, Express onboarding, live KYC status, and real test-mode
  transfers all work with zero code changes.
- **Admin payout approval queue** — Phase 8; until then
  `pnpm --filter @grid/api approve-payout -- <id>` approves as the seeded system
  staff user and writes audit_log.
- **Payout receipts / notifications** — Phase 9 (email provider still owner-blocked).

## Phase 6 deferrals

- **Subscriptions (owner decision needed first)**: Stripe Billing on web is unblocked
  (test keys exist), but crediting the creator requires pegging fiat to coins. Proposal:
  **1 coin = $0.01** (consistent with diamond packages ≈ 1¢/diamond), so a $4.99/mo sub
  credits the creator 70% = 349 coins per period via a SUB ledger tx on `invoice.paid`.
  Owner should confirm the peg + monthly price before this ships. Mobile subs need
  RevenueCat (already owner-blocked).
- **SUBS-gated streams**: the entitlement branch exists and is enforced; until
  subscriptions ship, SUBS streams are only enterable via creator INVITE grants.
- **Unlock for scheduled (not-yet-live) streams** — unlock currently requires the
  stream to not be ENDED; pre-purchase of scheduled streams is a product call.

## Phase 4 deferrals

- **LiveKit Cloud keys** (owner-blocked): create a project at cloud.livekit.io (free
  tier) → `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` in apps/api/.env.
  Until then `/streams/{id}/token` 503s; unlocks: video publish/subscribe, the
  `room_finished` webhook (auto-end streams), `RemoveParticipant` revocation.
- **LiveKit player mount, web + mobile** — both live rooms mint tokens and reserve
  the video surface; mount `@livekit/components-react` (web) and
  `@livekit/react-native` (mobile — needs a dev build, not Expo Go) once keys exist.
- **Mobile like/share rail buttons** — prototype's action rail shipped with
  chevrons/gift/end; like + share are cosmetic placeholders to add.
- **Playwright e2e for the web flows** (signup → go live → chat → gift) — brief §10.
- **Creator mute + slow-mode** — only message removal shipped; muted-user tracking
  with the moderation work (§8).
- **Entitlement unit tests** for FOLLOWERS/PRIVATE/SUBS branches (live verification
  covered PPV + FREE paths; the service is small and typed but untested branches exist).
- **Per-live-stream Redis Streams** — persistence uses ONE global stream + consumer
  group (simpler consumer discovery); revisit against ADR 0002's per-stream design
  when fanout demands, plus a retention/eviction policy for the stream key.

## Phase 3 deferrals

- **RevenueCat mobile IAP** (owner-blocked): needs a RevenueCat account + store
  products; mobile diamond purchases are web-only until then (brief §2 payments row).
- **Stripe CLI webhook forwarding**: real Stripe→localhost events need
  `stripe listen --forward-to localhost:3001/payments/webhooks/stripe`; put the
  printed `whsec_…` into apps/api/.env `STRIPE_WEBHOOK_SECRET` (currently a local
  dev secret used by the signed-webhook simulator).
- **Mobile wallet UI**: balances/history view on the phone (purchases wait on IAP).
- **k6 load script** for top-up/gifting bursts (Phase 3 exit criterion; ledger-level
  concurrency is already covered by the Testcontainers suite).
- **Admin read-only ledger search** — needs staff auth (Phase 8 IAM); reconcile
  script covers the finance-ops need meanwhile.
- **Refund flow** (REFUND tx kind exists; webhook handling for charge.refunded lands
  with chargeback work, brief §7 financial safety).

## Deferred by design (no input needed — just later)

- **Contract-drift CI gate**: emit OpenAPI from @nestjs/swagger and fail CI when it
  drifts from `docs/api/openapi.yaml` (brief §10 "Contract"). Client generation is
  manual until then (`pnpm --filter @grid/api-client generate`).
- **/health → Terminus** with DB/Redis probes once Phase 3 needs readiness checks.
- **chat_messages day-partitioning** — when volume demands (ADR 0002).
- **Playwright E2E + Testcontainers integration tests** — Phase 3 per brief §10.
- **Settings screen** (content preferences, privacy toggles, terms sections from the
  prototypes) — web has profile-only shell so far; mobile same.
- **Inter/JetBrains Mono fonts on mobile** (expo-font) — system fonts for now.
- **Timing-safe login** (verify against a constant hash when user not found) — noted
  in auth.service.ts; fine behind rate limiting for now.

## Dev-machine housekeeping (cosmetic)

- Wedged-Docker leftovers: poisoned alpine layer snapshots in Docker Desktop; a
  "Purge data" in Docker Desktop settings reclaims them. Compose uses `postgres:16`
  (Debian) partly for this reason.
- Dev DB contains e2e test users (`mia`, `leo`) and one guard-test ledger row —
  `prisma migrate reset` (needs interactive consent) whenever a clean slate is wanted.
- Prototype README moved to `prototypes/README.md`; root README covers the monorepo.
