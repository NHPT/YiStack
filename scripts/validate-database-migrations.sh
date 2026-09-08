#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER_NAME="yistack-migration-test-$$"
POSTGRES_IMAGE="${YISTACK_POSTGRES_IMAGE:-docker.io/library/postgres:16-alpine}"
POSTGRES_PASSWORD="${YISTACK_POSTGRES_TEST_PASSWORD:-yistack-migration-local-only}"
POSTGRES_PORT="$((45000 + $$ % 1000))"
TEMP_ROOT="$(mktemp -d)"
MIGRATION_BINARY="$TEMP_ROOT/yistack-server"
LOCK_PID=""

cleanup() {
  if [ -n "$LOCK_PID" ]; then
    kill "$LOCK_PID" >/dev/null 2>&1 || true
    wait "$LOCK_PID" >/dev/null 2>&1 || true
  fi
  podman rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT

fail() {
  echo "Database migration validation failed: $*" >&2
  exit 1
}

for command in go grep podman sed; do
  command -v "$command" >/dev/null 2>&1 || fail "missing command: $command"
done

echo "[migration] Building the database command..."
(
  cd "$ROOT_DIR/backend"
  go build -o "$MIGRATION_BINARY" ./cmd/server
)

echo "[migration] Starting isolated PostgreSQL 16..."
podman run \
  --name "$CONTAINER_NAME" \
  --env "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" \
  --env POSTGRES_DB=yistack \
  --publish "127.0.0.1:${POSTGRES_PORT}:5432" \
  --detach "$POSTGRES_IMAGE" >/dev/null

ready=false
for _ in $(seq 1 60); do
  if podman exec "$CONTAINER_NAME" \
    psql -At -v ON_ERROR_STOP=1 -U postgres -d yistack \
    -c "SELECT 1;" 2>/dev/null | grep -qx "1"; then
    ready=true
    break
  fi
  sleep 1
done
[ "$ready" = "true" ] || fail "PostgreSQL did not become queryable"

podman exec -i --env PGOPTIONS=--client-min-messages=warning "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  < "$ROOT_DIR/deploy/database/postgres-auth-compat.sql" >/dev/null
podman exec -i --env PGOPTIONS=--client-min-messages=warning "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  < "$ROOT_DIR/backend/init.sql" >/dev/null

# Recreate the v1.0.0 ledger while retaining the current business schema. The
# first supported upgrade adds migration integrity and v1.1.0 release metadata.
podman exec "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "DELETE FROM public.schema_migrations WHERE version = '202609070001_migration_integrity';" \
  >/dev/null
podman exec -i "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  < "$ROOT_DIR/backend/migrations/rollback/202609070001_migration_integrity.sql" \
  >/dev/null

podman exec "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "INSERT INTO public.users (id, email, username, password_hash)
      VALUES (
        '10000000-0000-0000-0000-000000000099',
        'migration-user@example.invalid',
        'Migration User',
        'test-only'
      );" >/dev/null

run_database() {
  env \
    YISTACK_SKIP_DOTENV=true \
    YISTACK_MIGRATIONS_DIR="${YISTACK_MIGRATIONS_DIR:-$ROOT_DIR/backend/migrations}" \
    DB_TYPE=postgres \
    DB_HOST=127.0.0.1 \
    DB_PORT="$POSTGRES_PORT" \
    DB_USER=postgres \
    DB_PASSWORD="$POSTGRES_PASSWORD" \
    DB_NAME=yistack \
    DB_SSL_MODE=disable \
    JWT_SECRET=migration-runtime-test-secret-0123456789 \
    "$MIGRATION_BINARY" database "$@"
}

run_database status > "$TEMP_ROOT/status-before.json"
grep -q '"state": "pending"' "$TEMP_ROOT/status-before.json" ||
  fail "baseline database did not report a pending migration"
grep -q '"202609070001_migration_integrity"' "$TEMP_ROOT/status-before.json" ||
  fail "pending migration was not reported"

echo "[migration] Verifying advisory lock contention..."
podman exec "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "SELECT pg_advisory_lock(6433735705560535883); SELECT pg_sleep(10);" \
  >/dev/null &
LOCK_PID=$!
lock_ready=false
for _ in $(seq 1 30); do
  advisory_lock_count="$(
    podman exec "$CONTAINER_NAME" \
      psql -At -U postgres -d yistack \
      -c "SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND granted;"
  )"
  if [ "$advisory_lock_count" = "1" ]; then
    lock_ready=true
    break
  fi
  sleep 1
done
[ "$lock_ready" = "true" ] || fail "test advisory lock was not acquired"
if run_database migrate > "$TEMP_ROOT/locked.out" 2>&1; then
  fail "migration ran while the advisory lock was held"
fi
grep -q 'another database migration operation is running' "$TEMP_ROOT/locked.out" ||
  fail "lock contention did not produce the expected error"
wait "$LOCK_PID" >/dev/null 2>&1 || true
LOCK_PID=""

echo "[migration] Applying and verifying the supported upgrade..."
run_database migrate > "$TEMP_ROOT/migrate.json"
grep -q '"202609070001_migration_integrity"' "$TEMP_ROOT/migrate.json" ||
  fail "migration result did not report the applied version"
run_database verify > "$TEMP_ROOT/verify.json"
grep -q '"state": "current"' "$TEMP_ROOT/verify.json" ||
  fail "migrated database did not verify as current"

ledger_contract="$(
  podman exec "$CONTAINER_NAME" \
    psql -At -U postgres -d yistack \
    -c "SELECT string_agg(version || ':' || checksum_sha256, ',' ORDER BY version)
        FROM public.schema_migrations;"
)"
expected_ledger="000000000000_contributor_alpha:a7dbe43d655163175bb51cb4c5eed1f87249a37a50e2e0585d794d4283d8e871,202609070001_migration_integrity:82c16545ca00adda937470bca75f0591472cbb702a8eb60e192221ba07a602bf"
[ "$ledger_contract" = "$expected_ledger" ] ||
  fail "unexpected migration ledger: $ledger_contract"

app_version="$(
  podman exec "$CONTAINER_NAME" \
    psql -At -U postgres -d yistack \
    -c "SELECT value FROM public.system_config WHERE key = 'app_version';"
)"
[ "$app_version" = "1.1.0" ] || fail "migration did not update app_version to 1.1.0"

user_count="$(
  podman exec "$CONTAINER_NAME" \
    psql -At -U postgres -d yistack \
    -c "SELECT count(*) FROM public.users WHERE email = 'migration-user@example.invalid';"
)"
[ "$user_count" = "1" ] || fail "migration did not preserve user data"

run_database migrate > "$TEMP_ROOT/retry.json"
grep -Fq '"applied_versions": []' "$TEMP_ROOT/retry.json" ||
  fail "repeated migration was not idempotent"

echo "[migration] Rejecting tampered and unknown histories..."
cp -a "$ROOT_DIR/backend/migrations" "$TEMP_ROOT/tampered"
printf '%s\n' '-- tampered' >> "$TEMP_ROOT/tampered/202609070001_migration_integrity.sql"
if YISTACK_MIGRATIONS_DIR="$TEMP_ROOT/tampered" \
  run_database verify > "$TEMP_ROOT/tampered.out" 2>&1; then
  fail "tampered migration passed checksum validation"
fi
grep -q 'checksum mismatch' "$TEMP_ROOT/tampered.out" ||
  fail "tampered migration did not report a checksum mismatch"
podman exec "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "UPDATE public.schema_migrations
      SET checksum_sha256 = '0000000000000000000000000000000000000000000000000000000000000000'
      WHERE version = '000000000000_contributor_alpha';" >/dev/null
if run_database status > "$TEMP_ROOT/checksum-drift.out" 2>&1; then
  fail "database checksum drift was accepted"
fi
grep -q 'database checksum mismatch' "$TEMP_ROOT/checksum-drift.out" ||
  fail "database checksum drift did not report the affected history"
podman exec "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "UPDATE public.schema_migrations
      SET checksum_sha256 = 'a7dbe43d655163175bb51cb4c5eed1f87249a37a50e2e0585d794d4283d8e871'
      WHERE version = '000000000000_contributor_alpha';" >/dev/null


podman exec "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "DELETE FROM public.schema_migrations
      WHERE version = '000000000000_contributor_alpha';" >/dev/null
if run_database status > "$TEMP_ROOT/history-gap.out" 2>&1; then
  fail "migration history gap was accepted"
fi
grep -q 'database migration history has a gap' "$TEMP_ROOT/history-gap.out" ||
  fail "migration history gap did not report the missing predecessor"
podman exec "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "INSERT INTO public.schema_migrations (version, description, checksum_sha256)
      VALUES (
        '000000000000_contributor_alpha',
        'YiStack Contributor Alpha baseline',
        'a7dbe43d655163175bb51cb4c5eed1f87249a37a50e2e0585d794d4283d8e871'
      );" >/dev/null

podman exec "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "INSERT INTO public.schema_migrations (version, description, checksum_sha256)
      VALUES (
        '999999999999_unknown',
        'unknown future migration',
        '0000000000000000000000000000000000000000000000000000000000000000'
      );" >/dev/null
if run_database status > "$TEMP_ROOT/unknown.out" 2>&1; then
  fail "unknown migration history was accepted"
fi
grep -Eq 'newer than this release|unknown migration' "$TEMP_ROOT/unknown.out" ||
  fail "unknown migration rejection did not explain the version boundary"
podman exec "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "DELETE FROM public.schema_migrations WHERE version = '999999999999_unknown';" \
  >/dev/null

echo "[migration] Rolling back one version and applying it again..."
run_database rollback > "$TEMP_ROOT/rollback.json"
grep -q '"current_version": "000000000000_contributor_alpha"' "$TEMP_ROOT/rollback.json" ||
  fail "rollback did not return to the supported baseline"
checksum_column_count="$(
  podman exec "$CONTAINER_NAME" \
    psql -At -U postgres -d yistack \
    -c "SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'schema_migrations'
          AND column_name = 'checksum_sha256';"
)"
[ "$checksum_column_count" = "0" ] || fail "rollback retained checksum metadata"
app_version="$(
  podman exec "$CONTAINER_NAME" \
    psql -At -U postgres -d yistack \
    -c "SELECT value FROM public.system_config WHERE key = 'app_version';"
)"
[ "$app_version" = "1.0.0" ] || fail "rollback did not restore app_version to 1.0.0"
if run_database verify > "$TEMP_ROOT/old-version.out" 2>&1; then
  fail "startup verification accepted a pending database version"
fi
grep -q 'run yistackctl database migrate' "$TEMP_ROOT/old-version.out" ||
  fail "pending version did not provide a migration recovery command"

run_database migrate >/dev/null
run_database verify >/dev/null
user_count="$(
  podman exec "$CONTAINER_NAME" \
    psql -At -U postgres -d yistack \
    -c "SELECT count(*) FROM public.users WHERE email = 'migration-user@example.invalid';"
)"
[ "$user_count" = "1" ] || fail "rollback and re-apply did not preserve user data"

echo "Database migration runner validation passed."
