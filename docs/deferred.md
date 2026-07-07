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

## Phase 9 / staff-roles deferrals

- **Notification delivery layers**: in-app notifications work (bell + inbox, web +
  mobile; gift/follow hooks). Push (FCM/APNs) and email (Resend/Postmark) layer on the
  same rows once providers are configured — owner-blocked (deferred above).
- **Marketing CMS depth (ADR 0006)**: audience/platform _targeting evaluation_ (the
  `audience` JSON field is stored but not yet enforced per-viewer/segment/country) and
  the **promo redemption engine** (codes are created/listed; applying a code at
  top-up/unlock is not wired). Fee/bonus application will post through the ledger.
- **Per-permission staff grants** (finer than per-role), staff self-service
  password/TOTP reset, forced-logout list (ADR 0006).
- **VOD** (brief Phase 9): stream recording via LiveKit egress + gated playback —
  needs LiveKit keys; the `vods` table + gated `access` field already exist.
- **Full a11y pass + empty/error/loading states** across web & mobile (brief Phase 9)
  — partial (loading/empty states exist on most screens).

## Phase 8 deferrals

- **Dashboards** — embed Metabase (ADR 0003) once the owner approves the vendor; the
  admin app reserves no UI for it yet.
- **IAM completeness** — staff CRUD, role-based permission matrix (only SUPERADMIN
  exists meaningfully), forced logout/session list. Roles are IN the token; per-role
  authorization checks land with staff CRUD.
- **Automated moderation (§8) — chat keyword DONE**: runtime-editable severity list
  (add/remove/reclassify in the admin Moderation tab), evasion-resistant normalization,
  flag-for-review-first (only 'block' withheld pre-broadcast), auto-flag → system report
  in the queue, creator mute + slow-mode. Owner-blocked drop-ins: **ML text moderation**
  (OpenAI Moderation / Perspective key → screenMl adapter) and **image/video** (stream
  frame sampling + upload/VOD scan via Rekognition/Hive/SafeSearch). Both slot behind
  the existing interface + queue with zero rework.
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

- **DONE — web subscriptions** (2026-07-06): creators set their own monthly price;
  viewers subscribe via Stripe Billing; `invoice.paid` credits the creator 70% in coins
  at the 1¢ peg (SUB ledger tx, idempotent per invoice); SUBS entitlement opens for
  active subscribers. Verified live end-to-end.
- **Mobile subscriptions** still need RevenueCat (owner has a _test_ SDK key; also needs
  App Store/Play products + a RevenueCat webhook auth secret — see RevenueCat below).
- **Unlock for scheduled (not-yet-live) streams** — unlock currently requires the
  stream to not be ENDED; pre-purchase of scheduled streams is a product call.

## RevenueCat (mobile IAP) — partially configured

Owner supplied a **test SDK key** (`REVENUECAT_API_KEY` in .env). Still needed before
mobile diamond purchases / subscriptions work end-to-end:

- Platform SDK keys (`appl_…` iOS, `goog_…` Android) wired into the mobile app.
- Products/entitlements configured in RevenueCat + App Store Connect / Google Play
  (requires paid developer accounts + app listings).
- A RevenueCat **webhook auth secret** so `/payments/webhooks/revenuecat` can credit
  diamonds exactly once (mirror of the Stripe webhook path — endpoint not built yet).

## Phase 4 deferrals

- **DONE — LiveKit keys configured** (2026-07-06): `/streams/{id}/token` mints real
  tokens; the web live room mounts the multi-source LiveStage (camera/mic/screen for
  creators, subscribe-first grid for viewers). Still to wire: the `room_finished`
  webhook (auto-end streams on empty) and `RemoveParticipant` on ban/refund.
- **LiveKit player — web DONE; mobile WIRED** (LiveStage in apps/mobile/src/live).
  Native modules + EAS config (eas.json, config plugins) are in place and verified
  (prebuild + Metro bundle). Remaining owner step: run `eas build --profile development`
  and install the dev client (docs/runbooks/mobile-dev-build.md) — then mobile video is live.
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
