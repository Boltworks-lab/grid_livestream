# Runbook — Rollback

## Decide fast

Roll back if: elevated 5xx, payment/ledger errors, crash-loop, or a data-corrupting bug.
**Money bugs → freeze payouts first** ([payout-freeze.md](payout-freeze.md)), then roll back.

## App code (stateless)

1. Redeploy the previous good image/tag (Railway/Fly: promote prior release;
   Vercel: instant rollback to the prior deployment).
2. Confirm `GET /health` + a smoke purchase.

## Migrations (stateful — the dangerous case)

Prisma migrations are forward-only; **do not** hand-roll `DOWN` under pressure.

- **Additive migration** (new nullable column/table): safe to leave; roll back only the
  app code. The old code ignores the new column.
- **Destructive migration** (dropped/renamed column, type change): restore from the
  pre-migrate backup ([backup-restore.md](backup-restore.md)) into a new DB and cut over,
  or apply a forward fix-migration. Never `DELETE`/`UPDATE` the ledger by hand — the
  append-only triggers will (correctly) refuse.

## After

- Post the incident in [incident.md](incident.md) format.
- Write the fix-forward migration; add a regression test before re-deploying.
