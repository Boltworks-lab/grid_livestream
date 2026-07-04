# ADR 0003 — Buy vs build: support tickets & analytics dashboards

- **Status:** Accepted (vendor sign-off = owner; swapping vendors does not change the code seams)
- **Date:** 2026-07-03
- **Context:** PROJECT_BRIEF §6 requires a support/ticket workflow and monitoring
  dashboards in the admin app, and explicitly recommends integrating vendors over
  building ("propose the split in Phase 1 and record it as an ADR").

## Decision

**Buy both, embed both; build only the glue.**

### Tickets → Zendesk (alternative: Plain)

- Zendesk handles inbox, SLA timers, canned responses, internal notes, email channel.
- The `tickets` table stays minimal (see schema): local linkage for user lookup +
  `externalRef` pointing at the Zendesk ticket. A webhook syncs status/priority back
  so admin's user-360 view shows support history without leaving the app.
- In-app "report a problem" creates the Zendesk ticket via API, attaching user id,
  device, app version.
- **Why not build:** ticket state machines, SLA clocks, and email threading are
  undifferentiated heavy lifting; §6.3's requirements are Zendesk's core product.
- **Why Zendesk over Plain:** more mature workflows for a 24/7 support org (§7);
  Plain is the leaner API-first fallback if Zendesk pricing stings — the integration
  surface (create ticket, sync status, deep-link) is identical either way.

### Dashboards → Metabase (embedded), PostHog for product analytics

- Metabase (self-hosted OSS) over a read replica for revenue/ledger/ops dashboards
  (§6.4: DAU/MAU, top streams, revenue, payout liabilities, ARPPU, chargeback rate).
  Admin embeds signed Metabase dashboards (JWT embedding) behind admin auth.
- PostHog (already in the stack, ADR 0001) owns funnels/retention/cohorts — product
  analytics stays out of the ops DB.
- **Build only:** the realtime "now" widgets (concurrent viewers, live streams) that
  need second-level freshness — small admin endpoints over Redis counters.

## What we do NOT build in the MVP

Ticket inbox UI, SLA engines, chart builders, cohort engines, email threading.

## Consequences

- Two external vendors enter the data-processing map (GDPR records, DPAs — §7 legal
  checklist). Support data lives in Zendesk; only ticket refs + status locally.
- Metabase needs a read replica (or scheduled-refresh cache) before real traffic —
  never dashboards against the primary.
- Admin Phase 8 scope shrinks to: IAM/audit, moderation queue, user lookup, config,
  embeds — the parts that ARE differentiated.
