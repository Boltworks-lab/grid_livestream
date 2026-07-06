#!/usr/bin/env bash
# Postgres logical backup (Phase 10, brief §12 PITR/backup drill). For local/staging
# use; production uses the managed provider's PITR + this as a portable export.
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL}"
OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/grid-$STAMP.dump"

# custom format (-Fc) → parallel, compressed, selective restore
pg_dump "$DATABASE_URL" -Fc -f "$FILE"
echo "backup written: $FILE ($(du -h "$FILE" | cut -f1))"

# keep the 14 most recent
ls -1t "$OUT_DIR"/grid-*.dump | tail -n +15 | xargs -r rm -f
