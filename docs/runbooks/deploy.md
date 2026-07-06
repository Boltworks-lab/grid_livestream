# Runbook — Deploy

Envs: local (compose) → staging (auto on `main`) → production (tagged release), brief §12.

## Pre-flight

- [ ] CI green on the commit (lint, typecheck, test, build, security job).
- [ ] Any DB change is a **migration** (never hand-edited); review the SQL.
- [ ] Secrets present in the target env's secret store (not committed).
- [ ] Feature-flag risky changes; note the rollback plan.

## Staging

1. Merge to `main` → staging auto-deploys.
2. **Gated migration step**: back up first (`infra/backup.sh`), then
   `pnpm --filter @grid/api exec prisma migrate deploy`.
3. Smoke: sign up → top up (test) → go live → chat → gift → unlock → payout request.
4. Watch Sentry + logs for 5 min.

## Production

1. Tag the release (`vX.Y.Z`); CI/CD builds images.
2. Manual approval gate → **backup-before-migrate** → `prisma migrate deploy`.
3. Zero-downtime rollout; health checks (`GET /health`) must pass.
4. Verify: a real test-mode purchase credits once; reconciliation job clean.
5. Mobile: EAS build → submit → staged rollout 10% → 100% (crash-free ≥ 99.5%).

If anything smells wrong → [rollback.md](rollback.md).
