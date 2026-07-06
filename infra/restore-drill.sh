#!/usr/bin/env bash
# Restore drill (brief §12: "test restores quarterly"). Restores a dump into a
# THROWAWAY database and runs the reconciliation check against it — proves the
# backup is usable AND the ledger still balances. Never touches the live DB.
set -euo pipefail

DUMP="${1:?usage: restore-drill.sh <dump-file>}"
: "${DATABASE_URL:?set DATABASE_URL (the drill derives a scratch DB from its host)}"

BASE="${DATABASE_URL%/*}"
SCRATCH="grid_restore_drill_$(date -u +%Y%m%d%H%M%S)"
SCRATCH_URL="$BASE/$SCRATCH"

echo "creating scratch db: $SCRATCH"
psql "$DATABASE_URL" -c "CREATE DATABASE \"$SCRATCH\";"

cleanup() {
  psql "$DATABASE_URL" -c "DROP DATABASE IF EXISTS \"$SCRATCH\" WITH (FORCE);" || true
}
trap cleanup EXIT

echo "restoring $DUMP …"
pg_restore --clean --if-exists --no-owner -d "$SCRATCH_URL" "$DUMP"

echo "reconciling restored ledger …"
DATABASE_URL="$SCRATCH_URL" node apps/api/dist/scripts/reconcile.js

echo "RESTORE DRILL PASSED — backup is usable and the ledger balances."
