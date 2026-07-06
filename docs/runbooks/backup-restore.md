# Runbook — Backup & Restore

Production uses the managed provider's **PITR** (brief §12). These scripts give a
portable logical backup and — critically — the **quarterly restore drill** that proves
backups are actually usable.

## Backup

```sh
DATABASE_URL=postgresql://… infra/backup.sh ./backups
```

Custom-format dump (`-Fc`), 14 kept. Schedule daily (cron / provider job) in addition
to PITR.

## Restore drill (quarterly — brief §12)

Restores a dump into a **throwaway** DB and reconciles it — never touches live:

```sh
pnpm --filter @grid/api build            # reconcile.js must exist
DATABASE_URL=postgresql://…admin… infra/restore-drill.sh ./backups/grid-<stamp>.dump
# → RESTORE DRILL PASSED — backup is usable and the ledger balances.
```

A passing drill proves three things at once: the dump restores, the schema is intact,
and the ledger still balances to zero.

## Real restore (disaster)

1. Provision a fresh DB; restore the latest good dump (`pg_restore --clean --if-exists
--no-owner`) or use provider PITR to a timestamp before the incident.
2. Run `reconcile` before pointing the app at it.
3. Repoint `DATABASE_URL`, deploy, smoke-test a purchase.
4. Note data loss window (last backup → incident) in the postmortem.
