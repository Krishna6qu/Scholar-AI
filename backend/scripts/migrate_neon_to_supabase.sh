#!/usr/bin/env bash
# Migrate ScholarAI production data from Neon to Supabase.
#
# Prerequisites:
#   - pg_dump and pg_restore (PostgreSQL client tools)
#   - Neon connection string (direct, port 5432 — not the pooler)
#   - Empty Supabase project with schema applied first:
#       cd backend && alembic upgrade head
#
# Usage:
#   export NEON_DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
#   export SUPABASE_DATABASE_URL="postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres"
#   ./scripts/migrate_neon_to_supabase.sh
#
# Test against a throwaway Supabase project before running against production.
# Keep the Neon database for at least a week as a rollback path.

set -euo pipefail

if [[ -z "${NEON_DATABASE_URL:-}" || -z "${SUPABASE_DATABASE_URL:-}" ]]; then
  echo "Set NEON_DATABASE_URL and SUPABASE_DATABASE_URL before running." >&2
  exit 1
fi

DUMP_FILE="$(mktemp /tmp/scholarai_neon_dump.XXXXXX).dump"

echo "Dumping Neon schema + data to ${DUMP_FILE}..."
pg_dump "${NEON_DATABASE_URL}" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="${DUMP_FILE}"

echo "Restoring into Supabase (data only — schema must already exist via Alembic)..."
pg_restore \
  --dbname="${SUPABASE_DATABASE_URL}" \
  --no-owner \
  --no-acl \
  --data-only \
  --disable-triggers \
  "${DUMP_FILE}"

echo "Done. Verify row counts, then update DATABASE_URL in Render to the Supabase pooler URL (port 6543)."
echo "Dump saved at ${DUMP_FILE} — delete when migration is confirmed."
