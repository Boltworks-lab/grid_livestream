# Runbook — Payout Freeze

Trigger: suspected payout fraud, a reconciliation mismatch, or a ledger anomaly. Goal:
**stop money leaving** while you investigate, without corrupting the books.

## Freeze (do this first, ask questions after)

1. Set economics `minPayoutCoins` to an unreachable value (admin → Economics, or
   `pnpm --filter @grid/api set-economics -- '<json>'`) — new requests can't meet the
   minimum. Fast, reversible, audited.
2. For a hard stop, disable the approve path: pause the Connect transfer worker /
   revoke the approver's `payouts.review` (admin → Staff), so nothing gets approved.
3. Announce internally; note the trigger.

## Investigate

- `pnpm --filter @grid/api reconcile` — must balance to zero in both currencies.
- Review `payouts` in REQUESTED/PROCESSING and recent `audit_log` payout actions.
- Suspicious creator? Suspend via the moderation queue (revokes their sessions).

## Correct (never edit the ledger)

- Reverse a bad movement with a compensating REFUND/ADJUSTMENT transaction.
- A failed/rejected payout already auto-refunds coins to the creator (built-in).

## Unfreeze

- Restore `minPayoutCoins`, re-enable approvals. Confirm reconcile is clean. Log the
  all-clear in the incident channel.
