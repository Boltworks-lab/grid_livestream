# ADR 0005 — Pricing & revenue-share model

- **Status:** Accepted
- **Date:** 2026-07-05
- **Context:** The owner's direction: creators set their own prices; the platform takes
  a deductible percentage computed by a system formula that can evolve over time. All
  payment/pricing parameters must be adjustable without redeploying.

## Decision

**Creator-set prices, platform percentage revshare, everything runtime-configurable.**

1. **Creators price their own content.** PPV unlock prices are set per stream at Go
   Live (already live). Subscription prices become per-creator when subs ship.
   Gift catalog prices are platform-set (admin CRUD, Phase 8) because gifts are a
   platform-wide currency surface, not creator content.
2. **The platform fee is a percentage per revenue type** — the formula is
   `fee = floor(total × rate)`, `creator = total − fee` — rounding ALWAYS favors the
   creator (creator trust is the business, brief §7). Defaults follow the brief §1:
   gifts 30%, PPV 25%, subscriptions 30%.
3. **Every economic parameter lives in `app_config` under the `economics` key**,
   validated by `economicsSchema` (packages/shared): per-type fee rates, the coin→fiat
   peg (`coinValueCents`, default 1¢ — consistent with diamond retail ≈ 1¢), minimum
   payout, and the new-creator payout hold. The API reads it through
   `EconomicsService` (30 s cache, loud fallback to defaults on invalid config).
   Change the numbers → the next computed split uses them. Until the admin app ships
   (Phase 8), `pnpm --filter @grid/api set-economics -- '<json>'` updates it.
4. **Evolvability:** the config shape is versioned by the zod schema — richer formulas
   (creator-level tiers, category rates, promotional windows) extend the schema and
   the split function without touching ledger mechanics; the ledger only ever sees
   final entry amounts, and historical transactions record the fee actually charged
   in their metadata (immutable audit).

## Consequences

- Fee changes are instant-ish (≤30 s cache) and require no deploy; they apply only to
  transactions posted after the change — history is never restated.
- The admin app (Phase 8) gets a ready-made surface: edit `economics`, with the
  append-only audit_log capturing before/after.
- Reporting revenue by rate requires reading tx metadata (fee recorded per tx),
  not multiplying by today's rate.
