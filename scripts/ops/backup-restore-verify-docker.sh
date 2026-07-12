#!/usr/bin/env bash
# Backup → restore → integrity drill using pg tools inside Compose postgres.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

if [[ ! -f .env.docker ]]; then
  echo "Missing .env.docker"
  exit 1
fi

pnpm dotenvx run -f .env.docker -- bash -c '
set -euo pipefail

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-changeme}"
POSTGRES_DB="${POSTGRES_DB:-saasweave}"
SOURCE_DB="$POSTGRES_DB"
RESTORE_DB="${POSTGRES_DB}_restore_$$"
MARKER_ID="backup-drill-$(date +%s)"
MARKER_ACTION="ops.backup_drill.marker"
DUMP="/tmp/backup-drill.dump"

compose() {
  docker compose "$@"
}

compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null

psql_src() {
  compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$SOURCE_DB" -At -c "$1" | tr -d "\r"
}

psql_admin() {
  compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -At -c "$1" | tr -d "\r"
}

cleanup() {
  psql_src "DELETE FROM audit_log WHERE id = '"'"'${MARKER_ID}'"'"';" >/dev/null 2>&1 || true
  psql_admin "DROP DATABASE IF EXISTS \"${RESTORE_DB}\" WITH (FORCE);" >/dev/null 2>&1 || true
  compose exec -T postgres rm -f "$DUMP" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Creating disposable audit marker…"
psql_src "INSERT INTO audit_log (id, action, actor_name, created_at) VALUES ('"'"'${MARKER_ID}'"'"', '"'"'${MARKER_ACTION}'"'"', '"'"'backup-drill'"'"', NOW());" >/dev/null

SOURCE_COUNT=$(psql_src "SELECT COUNT(*) FROM audit_log WHERE id = '"'"'${MARKER_ID}'"'"';")
[[ "$SOURCE_COUNT" == "1" ]] || { echo "Marker insert failed (count=${SOURCE_COUNT})"; exit 1; }

SOURCE_CHECKSUM=$(psql_src "SELECT COALESCE(md5(string_agg(id || action || COALESCE(actor_name, '"'"''"'"'), '"'"''"'"' ORDER BY id)), '"'"''"'"') FROM audit_log WHERE id = '"'"'${MARKER_ID}'"'"';")

echo "Running pg_dump…"
compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  pg_dump -U "$POSTGRES_USER" -d "$SOURCE_DB" --format=custom --file="$DUMP" --no-owner --no-privileges

compose exec -T postgres test -s "$DUMP" || { echo "Backup artifact missing"; exit 1; }

echo "Creating isolated restore database ${RESTORE_DB}…"
psql_admin "CREATE DATABASE \"${RESTORE_DB}\";" >/dev/null

echo "Restoring backup…"
compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  pg_restore -U "$POSTGRES_USER" -d "$RESTORE_DB" --clean --if-exists --no-owner "$DUMP"

RESTORE_COUNT=$(compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$RESTORE_DB" -At \
  -c "SELECT COUNT(*) FROM audit_log WHERE id = '"'"'${MARKER_ID}'"'"';" | tr -d "\r")

[[ "$RESTORE_COUNT" == "1" ]] || { echo "Restore row count mismatch: ${RESTORE_COUNT}"; exit 1; }

RESTORE_CHECKSUM=$(compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$RESTORE_DB" -At \
  -c "SELECT COALESCE(md5(string_agg(id || action || COALESCE(actor_name, '"'"''"'"'), '"'"''"'"' ORDER BY id)), '"'"''"'"') FROM audit_log WHERE id = '"'"'${MARKER_ID}'"'"';" | tr -d "\r")

[[ "$RESTORE_CHECKSUM" == "$SOURCE_CHECKSUM" ]] || {
  echo "Checksum mismatch source=${SOURCE_CHECKSUM} restore=${RESTORE_CHECKSUM}"
  exit 1
}

echo "Backup/restore docker drill passed."
'
