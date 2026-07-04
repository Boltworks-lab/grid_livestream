# GRID — Project Brief & Build Instructions

> **How to use this file:** Place it in the root of your `grid` folder as `PROJECT_BRIEF.md`
> (keep a copy of the key decisions in `CLAUDE.md` too). In Claude Code, start with:
> _"Read PROJECT_BRIEF.md and let's begin Phase 0. Confirm the plan before writing code."_
> Work phase by phase. Do not skip ahead. Ask before making architectural changes.

---

## 1. What we are building (Idea & Vision)

**Grid** is a live-streaming creator-economy platform (comparable to BuzzCast, Bigo Live,
TikTok Live). Creators go live to a global audience; viewers buy **diamonds** (virtual
currency) with real money and spend them on animated **gifts** during streams; creators
convert received gifts into **coins** and withdraw real money. Additional monetization:
subscriptions, pay-per-view gated streams/VOD, and platform features.

Two working HTML/CSS/JS prototypes already exist in this repo and are the **source of
truth for UX, flows, and visual design**:

- `index.html` + `css/` + `js/` — desktop web app (Discover, Live room with chat and
  gift bar, Wallet with recharge, Creator dashboard, Profile, Settings, Go Live setup
  with visibility + access controls, viewer-side pay-to-unlock gate)
- `mobile/index.html` — mobile app (bottom tab nav, full-bleed live room with overlay
  chat and TikTok-style action rail, swipe between streams, bottom-sheet gift drawer,
  wallet, Go Live, inbox, same paywall gate)

The task is to rebuild these as production-grade software.

### Products in scope

1. **Web app** (viewers + creators) — the desktop prototype, productionized
2. **Mobile app** (viewers + creators) — the mobile prototype, as a real app
3. **Admin/Ops web app** (internal staff) — moderation, support, analytics, content
   management, IAM. Does not exist yet; specified in §6.
4. **Backend API + realtime services** powering all three

### Business model (drives technical requirements)

- Platform takes ~30% of gift value, ~30% of subscriptions, ~25% of PPV
- Diamonds are bought via IAP/card; coins are withdrawn via payout providers
- Success depends on: reliable payments, low-latency streaming, creator trust
  (accurate ledger, on-time payouts), and safety (moderation keeps the platform
  advertiser- and app-store-safe)

---

## 2. Technology decisions (final — with rationale)

These were chosen deliberately. Do not substitute without discussion.

### One language where possible: TypeScript

| Layer         | Choice                                                                                                                                                                       | Why (and why not the alternatives)                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web frontend  | **React 18 + TypeScript + Vite**                                                                                                                                             | Shares mental model and code with React Native; largest ecosystem for realtime UI. Angular rejected: no benefit here, splits knowledge from the mobile app.                                                                                                                                                                                                                                                                |
| Mobile        | **React Native (Expo, dev-client workflow) + TypeScript**                                                                                                                    | Required by product owner; Expo speeds iteration while allowing native modules. Architected for a future Kotlin/Swift port (see §5).                                                                                                                                                                                                                                                                                       |
| Admin app     | **React + TypeScript** (same design system)                                                                                                                                  | One frontend skill set; RBAC-heavy internal tool.                                                                                                                                                                                                                                                                                                                                                                          |
| Backend       | **Node.js + TypeScript + NestJS** — a single **modular monolith**                                                                                                            | One language across the whole stack; first-class SDKs for everything this domain needs (Stripe, LiveKit, Socket.IO/WS, FCM/APNs). FastAPI rejected: splitting into Python buys nothing here and doubles the hiring/testing surface. Go rejected _for now_: it's the right tool for a high-fanout chat gateway **at scale** — noted as the one service we may extract later — but starting there is premature optimization. |
| Database      | **PostgreSQL** (+ **Redis** for cache/pubsub/presence/rate-limits)                                                                                                           | The wallet is a financial ledger; ACID is non-negotiable.                                                                                                                                                                                                                                                                                                                                                                  |
| ORM           | **Prisma**                                                                                                                                                                   | Type-safe, migration-friendly.                                                                                                                                                                                                                                                                                                                                                                                             |
| Realtime      | **WebSockets via Socket.IO** (NestJS gateway), Redis adapter for horizontal scale                                                                                            | Chat, gift events, viewer counts, presence.                                                                                                                                                                                                                                                                                                                                                                                |
| Live video    | **LiveKit Cloud** (WebRTC) — do **NOT** build media servers                                                                                                                  | Building RTMP/HLS infra is a multi-year distraction. LiveKit has React + React Native SDKs, server-side room control (needed for the paywall gate), and can be self-hosted later for cost. Fallback candidates: AWS IVS, Mux.                                                                                                                                                                                              |
| Payments in   | **Stripe** (web) + **RevenueCat** wrapping Apple/Google **IAP** (mobile)                                                                                                     | ⚠️ Critical: app stores REQUIRE in-app purchase for digital goods (diamonds) and take 15–30%. Web top-ups via Stripe avoid that cut — steer users there where policy allows.                                                                                                                                                                                                                                               |
| Payouts out   | **Stripe Connect (Express)**                                                                                                                                                 | Handles KYC/identity, bank/PayPal-like payouts, tax form collection (1099/DAC7). Never hand-roll payouts.                                                                                                                                                                                                                                                                                                                  |
| Monorepo      | **pnpm workspaces + Turborepo**                                                                                                                                              | Shared types/API client between web, mobile, admin, api.                                                                                                                                                                                                                                                                                                                                                                   |
| Auth          | **Email/phone + OAuth (Google, Apple — Apple sign-in is mandatory on iOS if any social login exists)**, JWT access + rotating refresh tokens, TOTP 2FA for admin             |                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Deployment    | Docker; **Railway or Fly.io** for API+Postgres+Redis at MVP; **Vercel** for the two web apps; **EAS** for mobile builds. Migrate to AWS (ECS/RDS) when traffic justifies it. | Safest easy path; no Kubernetes until it's earned.                                                                                                                                                                                                                                                                                                                                                                         |
| Observability | **Sentry** (errors, all apps), **PostHog** (product analytics), structured logs (pino) → hosted log drain, uptime checks                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                            |

### Monorepo layout

```
grid/
├─ apps/
│  ├─ web/            # React viewer/creator app
│  ├─ mobile/         # React Native (Expo)
│  ├─ admin/          # React internal ops app
│  └─ api/            # NestJS modular monolith
├─ packages/
│  ├─ shared/         # zod schemas, TS types, constants (gift catalog, fee rates)
│  ├─ api-client/     # typed client generated from OpenAPI, used by all 3 apps
│  └─ ui-tokens/      # design tokens extracted from the prototypes (colors, radii, spacing)
├─ prototypes/        # ← move the existing HTML prototypes here, untouched, as reference
├─ infra/             # Dockerfiles, compose, IaC later
└─ docs/              # ADRs, runbooks, API docs
```

### API modules (NestJS)

`auth` · `users` · `streams` · `chat` (WS gateway) · `gifts` · `wallet` (ledger) ·
`payments` (Stripe/RevenueCat webhooks) · `payouts` (Connect) · `subscriptions` ·
`gates` (PPV/private access) · `moderation` · `notifications` (FCM/APNs/email) ·
`admin` (staff-only endpoints, separate guard) · `analytics-events`

---

## 3. Non-negotiable engineering rules

1. **The wallet is a double-entry ledger.** Every diamond/coin movement is an immutable
   `ledger_entry` row (debit one account, credit another; platform fee is its own leg).
   Balances are derived (or cached with invariant checks), never directly mutated.
   All money mutations are idempotent (idempotency keys) and wrapped in DB transactions.
2. **Server-authoritative economy.** Prices, balances, gate access, and fee splits are
   computed server-side only. Clients render; they never decide.
3. **Webhooks are the source of truth for payments.** A purchase is credited only when
   the Stripe/RevenueCat webhook is verified (signature-checked) and processed exactly once.
4. **Gated streams are enforced at the media layer.** LiveKit room tokens are only
   minted after the server verifies entitlement — never hide-the-video-in-CSS.
5. **RBAC everywhere; admin is a separate app with separate auth**, 2FA required, every
   staff action written to an append-only `audit_log`.
6. **All input validated with zod at the edge** (shared schemas in `packages/shared`).
7. **Secrets in env/secret manager only.** Rate-limit auth, chat, gifting, and payout
   endpoints. Follow OWASP ASVS basics.
8. **Migrations only** — never edit the DB by hand.
9. Conventional commits; CI must pass (lint, typecheck, tests) before merge.

---

## 4. Data model (core sketch — refine in Phase 1)

```
users(id, handle, email, phone, dob, country, role, status, created_at …)
creator_profiles(user_id, level, follower_count, stripe_connect_id, kyc_status …)
follows(follower_id, creator_id)
streams(id, creator_id, title, category, thumbnail, visibility[public|followers|private],
        access[free|ppv|subs], ppv_price_diamonds, status[scheduled|live|ended],
        livekit_room, started_at, ended_at, peak_viewers)
stream_access_grants(stream_id, user_id, source[ppv|sub|invite], ledger_entry_id)
gift_catalog(id, name, emoji/asset, price_diamonds, animation_tier, active)
gift_events(id, stream_id, sender_id, gift_id, qty, ledger_tx_id, created_at)
subscriptions(id, viewer_id, creator_id, tier, status, provider, renews_at)
vods(id, creator_id, title, access, price, mux/livekit asset refs, status)

-- LEDGER (heart of the system)
accounts(id, owner_type[user|creator|platform], owner_id, currency[diamond|coin], …)
ledger_transactions(id, kind[topup|gift|ppv_unlock|sub|payout|refund|adjustment],
                    idempotency_key UNIQUE, metadata, created_at)
ledger_entries(id, tx_id, account_id, direction[debit|credit], amount, running invariants)
payouts(id, creator_id, coin_amount, fiat_amount, provider_ref, status, …)

-- SAFETY & OPS
reports(id, reporter_id, target_type[stream|user|chat_msg|vod], target_id, reason, status)
moderation_actions(id, actor_staff_id, target, action[warn|mute|remove|ban|shadowban], reason)
audit_log(id, staff_id, action, target, before, after, ip, created_at)  -- append-only
staff_users(id, email, role[superadmin|admin|moderator|support|marketing|analyst], totp, status)
tickets(id, user_id, channel, subject, status, assignee_staff_id, priority, sla_due_at)
app_config(key, value, updated_by)         -- feature flags, banners, gift catalog toggles
```

Chat messages: Redis hot path + async batch persist to Postgres (or a `chat_messages`
table partitioned by day) — decide in Phase 1 with an ADR.

---

## 5. Mobile architecture (with the native future in mind)

The owner may later go native (Kotlin/Swift). Structure RN so that port is a rewrite of
the **view layer only**:

- All business logic, API calls, and state live in `packages/shared` + `packages/api-client`
  (pure TS, no React imports) — portable to KMP/Swift via the OpenAPI spec.
- Screens are thin; navigation via React Navigation; styling via tokens from `ui-tokens`.
- Platform services (push, IAP via RevenueCat, LiveKit) wrapped behind small interfaces
  so native SDK swaps are localized.
- Keep the OpenAPI spec authoritative — a future Kotlin/Swift client is generated, not
  hand-written.

---

## 6. Admin / Ops app — required capabilities

Build as `apps/admin`. Staff-only, SSO-able later, TOTP 2FA from day one, full audit trail.

1. **IAM**: staff CRUD, role-based permissions (superadmin/admin/moderator/support/
   marketing/analyst), session management, forced logout, audit log viewer.
2. **Moderation & content review**: report queue with evidence (chat excerpts, stream
   thumbnails/clips), actions (warn/mute/remove content/suspend/ban/shadowban), appeal
   handling, automated-flag review (see §8), per-moderator throughput stats.
3. **Support & tickets**: ticket inbox (statuses, priorities, SLA timers, canned
   responses, internal notes), user lookup (profile, devices, wallet history — **read-only
   money data**; adjustments go through a dual-approval flow that writes ledger entries).
4. **Monitoring & analytics dashboards**: DAU/MAU, concurrent viewers, top streams,
   revenue (top-ups, gifts, subs, PPV), payout liabilities, ARPPU, retention cohorts,
   chargeback rate. (Embed Metabase/PostHog dashboards rather than hand-building charts
   where sensible.)
5. **Content & app management**: gift catalog CRUD (prices, assets, active windows),
   featured/banner management, category management, app announcements, feature flags,
   remote-config values the mobile app reads at launch.
6. **Marketing tools**: push/email campaign triggers (segmented), promo codes, referral
   program config, creator-spotlight scheduling.
7. **Finance ops**: payout review/approval queue, KYC status view (via Stripe), refund
   and chargeback workflows, ledger search + export.

**Buy vs build note:** for MVP it is acceptable (and recommended) to integrate Zendesk
or Plain for tickets and Metabase for dashboards instead of building from scratch —
propose the split in Phase 1 and record it as an ADR.

---

## 7. What this business needs beyond code (review & recommendations)

Treat these as requirements, not suggestions — they're what separates a demo from a
viable streaming business:

- **App-store economics**: Apple/Google take 15–30% of IAP diamond sales _before_ your
  30% platform fee. Model diamond pricing per channel; push web top-ups where policy allows.
- **Trust & safety program**: 18+ age gate at signup **plus** age-assurance on creator
  onboarding; automated moderation (§8) + 24/7-capable human review as you grow; clear
  community guidelines; repeat-infringer policy.
- **Legal/compliance checklist** (engage a lawyer; the app must support these):
  ToS, Privacy Policy (GDPR + PIPEDA — owner is in Canada — + CCPA), cookie consent,
  DMCA registered agent + takedown flow, music licensing risk on streams, KYC/AML on
  payouts (Stripe Connect covers most), sanctions screening, tax forms (1099-K/DAC7),
  data-deletion self-serve, records of processing.
- **Financial safety**: chargeback/fraud monitoring (Stripe Radar), velocity limits on
  top-ups and gifting, payout holds for new creators (e.g. 7-day rolling), reserve for
  refunds, monthly ledger reconciliation job that must balance to zero.
- **Creator success**: onboarding checklist, payout transparency page, analytics for
  creators, referral bonuses — creator retention IS the business.
- **Support ops**: help center (docs site), in-app report/contact, SLA targets.
- **Growth infra**: SEO'd public landing + stream pages (SSR or prerender), deep links,
  App Store/Play assets, push-notification strategy (go-live alerts drive most traffic),
  email (Resend/Postmark) for receipts and digests.

---

## 8. Automated moderation (minimum viable)

- Chat: keyword/regex + ML text moderation (e.g., OpenAI moderation API or Perspective)
  → auto-hide + queue for human review; per-user mute/slow-mode tools for creators.
- Streams: periodic frame sampling → image moderation API (e.g., AWS Rekognition or
  Hive) → threshold auto-flag to the admin review queue; hard-stop only on high-confidence
  CSAM signals (report per NCMEC obligations).
- Uploads (avatars, thumbnails, VOD): scan before publish.
- All auto-actions logged and reversible by staff (except mandatory-report categories).

---

## 9. SDLC — Phased delivery plan

Work strictly in phases. Each phase ends with: passing CI, a short demo script, and
updated docs. **Ask for confirmation before starting each phase.**

### Phase 0 — Discovery & setup (repo hygiene)

- Move prototypes into `prototypes/`; scaffold the monorepo (pnpm + Turborepo), shared
  tsconfig/eslint/prettier, commit hooks, GitHub Actions CI (lint/typecheck/test).
- Write `docs/adr/0001-stack.md` capturing §2 decisions.
- Deliverable: empty apps boot (`web`, `admin`, `mobile` Expo, `api` health endpoint),
  docker-compose for Postgres+Redis.

### Phase 1 — Design & specification

- Finalize the ERD from §4 (Prisma schema), the OpenAPI spec skeleton, and WS event
  contract (`chat:message`, `gift:sent`, `viewer:count`, `stream:status`, …).
- ADRs: chat persistence strategy; buy-vs-build for tickets/dashboards; LiveKit room
  lifecycle & token policy for gated streams.
- Extract design tokens from the prototypes into `packages/ui-tokens`.
- Deliverable: reviewed schema + API spec; no product code yet.

### Phase 2 — Foundations

- `auth` (email/OTP + Google/Apple OAuth, JWT + refresh rotation), `users`, profiles,
  follows. RBAC guards. Rate limiting. Sentry wired in all apps.
- Web + mobile: auth screens, profile, settings shells matching the prototypes.
- Deliverable: sign up → edit profile → follow, on web and mobile, against the real API.

### Phase 3 — Wallet & payments (the hard core — do this before streaming)

- Ledger tables + service with invariant tests (property-based tests on double-entry).
- Stripe top-ups (web) with webhook crediting; RevenueCat IAP (mobile) sandbox flow.
- Wallet UI (both apps) matching prototypes; transaction history.
- Reconciliation job + admin read-only ledger search.
- Deliverable: buy diamonds in test mode on web and mobile; balances correct under
  concurrent load (include a k6 or artillery concurrency test).

### Phase 4 — Live streaming & chat

- LiveKit integration: creator publishes (mobile camera / web), viewers subscribe;
  server mints room tokens; stream lifecycle (create → live → end) with `streams` rows.
- WS chat with presence + viewer counts; creator mod tools (mute/remove).
- Discover feed (live now, categories) on web + mobile; swipe-next on mobile.
- Deliverable: real multi-device live session with working chat.

### Phase 5 — Gifting economy

- Gift catalog (server-driven), send-gift flow (ledger tx: viewer diamonds → creator
  coins + platform fee), realtime gift events + animations per the prototypes,
  top-gifter aggregation, creator earnings dashboard.
- Deliverable: end-to-end: top up → watch → gift → creator balance reflects 70%.

### Phase 6 — Gated content & subscriptions

- Go Live setup (visibility + access + price) as in prototypes; PPV unlock flow
  (ledger tx + `stream_access_grants` + gated LiveKit token); subscriptions
  (Stripe Billing web / IAP mobile); private/followers-only enforcement.
- Deliverable: locked stream cannot be joined without paying; unlock persists.

### Phase 7 — Payouts & creator onboarding

- Stripe Connect Express onboarding, KYC status surfacing, coin→fiat conversion,
  payout request → admin approval queue → transfer; payout holds for new creators.
- Deliverable: test-mode payout end to end with audit trail.

### Phase 8 — Admin/Ops app

- Build §6 in priority order: IAM+audit → moderation queue (+§8 automation) →
  user lookup/support → dashboards (embed) → content/config management → marketing.
- Deliverable: a moderator can act on a report; every action lands in audit_log.

### Phase 9 — Notifications, VOD, polish

- Push (go-live alerts, gift receipts), email receipts; VOD upload + gated playback;
  inbox/DMs (basic); accessibility pass; empty/error/loading states everywhere.

### Phase 10 — Hardening, QA & launch prep

- See §10 testing gates; load test (target: 5k concurrent viewers/stream, 500 msg/s
  chat), security review vs OWASP ASVS L2 basics, penetration-test checklist,
  backup/restore drill, on-call runbooks, app-store submission (privacy labels,
  content-rating questionnaires, IAP review notes).

### Ongoing — Maintenance

- Dependabot/renovate; weekly triage; error-budget review; monthly ledger
  reconciliation sign-off; quarterly access review of staff accounts; postmortems
  for Sev1/2 incidents (template in `docs/runbooks/`).

---

## 10. Testing & quality gates (apply every phase)

- **Unit**: Vitest/Jest; ledger and fee-split logic ≥ 95% branch coverage,
  property-based tests for double-entry invariants.
- **API integration**: Testcontainers (real Postgres/Redis); webhook signature and
  idempotency tests (replay the same webhook twice → one credit).
- **E2E**: Playwright (web + admin critical paths: signup, top-up test mode, gift,
  unlock, moderate); Detox or Maestro smoke suite (mobile).
- **Contract**: OpenAPI schema checked in CI; generated client must compile in all apps.
- **Load**: k6 scripts for chat fanout and gifting bursts before Phase 10 exit.
- **Security in CI**: dependency audit, secret scanning, basic ZAP baseline on staging.
- Definition of Done per feature: tests, docs updated, feature-flagged if risky,
  demoable on staging.

---

## 11. Documentation to maintain

`docs/adr/` (all significant decisions) · OpenAPI (generated, published) ·
`docs/runbooks/` (deploy, rollback, incident, payout-freeze, DMCA takedown) ·
onboarding guide (new dev to running stack < 30 min) · admin user guide for staff ·
public help-center content (separate, but tracked here).

---

## 12. Deployment & environments

- **Envs**: local (compose) → staging (auto-deploy on main) → production (tagged release).
- CI/CD: GitHub Actions — lint/typecheck/test → build images → deploy staging →
  manual approval → prod. DB migrations run as a gated step with backup-before-migrate.
- Web/admin on Vercel (separate projects, admin behind SSO/IP-allowlist at minimum);
  API on Railway/Fly with health checks + zero-downtime deploys; Postgres with PITR
  backups (test restores quarterly); Redis managed.
- Mobile: EAS build + submit; staged rollouts (10%→100%); OTA updates via EAS Update
  for JS-only fixes; crash-free-rate gate ≥ 99.5% before promoting.
- Secrets via platform secret stores; least-privilege API keys; separate Stripe
  accounts per env.

---

## 13. Working agreement for Claude Code

- Confirm the plan at the start of each phase; propose, then implement.
- Small PR-sized changes; conventional commits; never commit secrets.
- When a decision is ambiguous, write a short ADR option list and ask.
- Never weaken the rules in §3. If a requirement conflicts with them, stop and ask.
- Prototypes in `prototypes/` are reference-only — do not import their code; re-implement
  properly in React/RN using the extracted tokens.
