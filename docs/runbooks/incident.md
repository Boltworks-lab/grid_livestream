# Runbook — Incident (Sev1/Sev2)

**Sev1**: outage, data loss, or money moving wrong. **Sev2**: major feature down, no
money/data risk. Both page on-call; Sev1 pages the founder too.

## First 10 minutes

1. **Declare** — open an incident channel; name an IC (incident commander).
2. **Stabilize over diagnose** — if money/ledger is involved,
   [freeze payouts](payout-freeze.md) immediately; if a bad release,
   [roll back](rollback.md).
3. **Assess blast radius** — how many users, is money affected, is data corrupted?

## Money / ledger anomaly

- Run `pnpm --filter @grid/api reconcile`. Non-zero = stop-the-world:
  freeze payouts, do not process withdrawals until it balances.
- The ledger is append-only (DB triggers); corrections are **new compensating
  transactions** (REFUND/ADJUSTMENT), never edits. Every fix is auditable.

## Comms

- Status page + in-app banner (AppConfig) for user-facing outages.
- Do not speculate on cause publicly until confirmed.

## After (within 48h)

- Blameless postmortem: timeline, root cause, contributing factors, action items with
  owners. File under `docs/runbooks/postmortems/`. Add the regression test that would
  have caught it.
