#!/usr/bin/env bash

set -euo pipefail

PACKAGE_ROOT="${1:-}"
if [ -z "$PACKAGE_ROOT" ]; then
  echo "Usage: $0 <extracted-release-directory>" >&2
  exit 2
fi
PACKAGE_ROOT="$(realpath "$PACKAGE_ROOT")"
for required_file in \
  bin/yistack-database-backup \
  bin/yistack-ephemeral-maintenance \
  bin/yistack-postgres \
  bin/yistack-server \
  database/init.sql \
  database/migrations/manifest.json \
  database/migrations/202609070001_migration_integrity.sql \
  database/migrations/rollback/202609070001_migration_integrity.sql \
  database/postgres-auth-compat.sql; do
  if [ ! -f "$PACKAGE_ROOT/$required_file" ]; then
    echo "Release directory is missing $required_file" >&2
    exit 1
  fi
done
for command in curl podman realpath sed timeout; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Missing PostgreSQL runtime validation command: $command" >&2
    exit 1
  }
done

run_id="${GITHUB_RUN_ID:-$$}-${RANDOM}"
container_name="yistack-release-test-${run_id}"
data_dir="$(mktemp -d "${TMPDIR:-/tmp}/yistack-release-pg.XXXXXX")"
postgres_env="$(mktemp "${TMPDIR:-/tmp}/yistack-release-pg-env.XXXXXX")"
backend_log="$(mktemp "${TMPDIR:-/tmp}/yistack-release-backend.XXXXXX")"
health_body="$(mktemp "${TMPDIR:-/tmp}/yistack-release-health.XXXXXX")"
unhealthy_body="$(mktemp "${TMPDIR:-/tmp}/yistack-release-unhealthy.XXXXXX")"
supervisor_log="$(mktemp "${TMPDIR:-/tmp}/yistack-release-pg-supervisor.XXXXXX")"
register_body="$(mktemp "${TMPDIR:-/tmp}/yistack-release-register.XXXXXX")"
ephemeral_root="$(mktemp -d "${TMPDIR:-/tmp}/yistack-release-ephemeral.XXXXXX")"
backend_pid=""
supervisor_pid=""
port_offset="$((RANDOM % 500))"
postgres_port="$((55000 + port_offset))"
backend_port="$((56000 + port_offset))"

cleanup() {
  if [ -n "$backend_pid" ]; then
    kill "$backend_pid" >/dev/null 2>&1 || true
    wait "$backend_pid" >/dev/null 2>&1 || true
  fi
  if [ -n "$supervisor_pid" ]; then
    kill "$supervisor_pid" >/dev/null 2>&1 || true
    wait "$supervisor_pid" >/dev/null 2>&1 || true
  fi
  podman rm --force "$container_name" >/dev/null 2>&1 || true
  podman unshare rm -rf "$data_dir" >/dev/null 2>&1 || true
  rm -f \
    "$postgres_env" \
    "$backend_log" \
    "$health_body" \
    "$unhealthy_body" \
    "$supervisor_log" \
    "$register_body"
  rm -rf "$ephemeral_root"
}
trap cleanup EXIT

printf '%s\n' \
  'POSTGRES_IMAGE=docker.io/library/postgres:16-alpine' \
  "POSTGRES_CONTAINER_NAME=$container_name" \
  'POSTGRES_USER=postgres' \
  'POSTGRES_PASSWORD=release-runtime-test-password' \
  'POSTGRES_DB=yistack' \
  "POSTGRES_PORT=$postgres_port" \
  "POSTGRES_DATA_DIR=$data_dir" \
  'POSTGRES_LOG_DRIVER=none' > "$postgres_env"

run_postgres() {
  YISTACK_POSTGRES_ENV_FILE="$postgres_env" \
    "$PACKAGE_ROOT/bin/yistack-postgres" "$@"
}

run_postgres start
legacy_container_id="$(podman inspect --format '{{.Id}}' "$container_name")"
[ "$(podman inspect --format '{{.HostConfig.LogConfig.Type}}' "$container_name")" = none ]
run_postgres stop
sed -i 's/^POSTGRES_LOG_DRIVER=none$/POSTGRES_LOG_DRIVER=k8s-file/' "$postgres_env"

for _ in 1 2; do
  run_postgres init
done
current_container_id="$(podman inspect --format '{{.Id}}' "$container_name")"
if [ "$current_container_id" = "$legacy_container_id" ]; then
  echo "PostgreSQL container was not recreated to migrate its log driver." >&2
  exit 1
fi

run_package_database() {
  YISTACK_SKIP_DOTENV=true \
  YISTACK_MIGRATIONS_DIR="$PACKAGE_ROOT/database/migrations" \
  DB_TYPE=postgres \
  DB_HOST=127.0.0.1 \
  DB_PORT="$postgres_port" \
  DB_USER=postgres \
  DB_PASSWORD=release-runtime-test-password \
  DB_NAME=yistack \
  DB_SSL_MODE=disable \
    "$PACKAGE_ROOT/bin/yistack-server" database "$@"
}

podman exec "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "DELETE FROM public.schema_migrations WHERE version = '202609070001_migration_integrity';" \
  >/dev/null
podman exec -i "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  < "$PACKAGE_ROOT/database/migrations/rollback/202609070001_migration_integrity.sql" \
  >/dev/null
if run_package_database verify > "$ephemeral_root/pre-migration.out" 2>&1; then
  echo "Packaged startup verification accepted the v1.0.0 database baseline." >&2
  exit 1
fi
grep -q 'run yistackctl database migrate' "$ephemeral_root/pre-migration.out" || {
  echo "Packaged startup verification did not provide migration recovery." >&2
  cat "$ephemeral_root/pre-migration.out" >&2
  exit 1
}
podman exec "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "INSERT INTO public.users (id, email, username, password_hash)
      VALUES (
        '10000000-0000-0000-0000-000000000098',
        'migration-preserved@example.test',
        'Migration Preserved',
        'test-only'
      );" >/dev/null
run_package_database migrate > "$ephemeral_root/migrate.out"
run_package_database verify > "$ephemeral_root/migration-verify.out"
migration_contract="$(
  podman exec "$container_name" \
    psql -At -U postgres -d yistack \
    -c "SELECT
          (SELECT count(*) FROM public.schema_migrations) || ':' ||
          (SELECT count(*) FROM public.users WHERE email = 'migration-preserved@example.test') || ':' ||
          (SELECT count(*) FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'schema_migrations'
             AND column_name = 'checksum_sha256');"
)"
if [ "$migration_contract" != "2:1:1" ]; then
  echo "Unexpected packaged migration contract: $migration_contract" >&2
  exit 1
fi
podman exec "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "DELETE FROM public.users WHERE email = 'migration-preserved@example.test';" \
  >/dev/null

backup_config="$ephemeral_root/backup.env"
backup_dir="$ephemeral_root/database-backups"
cat > "$backup_config" <<EOF
DB_TYPE=postgres
DB_HOST=127.0.0.1
DB_PORT=$postgres_port
DB_USER=postgres
DB_PASSWORD=release-runtime-test-password
DB_NAME=yistack
DB_SSL_MODE=disable
POSTGRES_IMAGE=docker.io/library/postgres:16-alpine
EOF
run_database_backup() {
  YISTACK_ENV_FILE="$backup_config" \
  YISTACK_POSTGRES_ENV_FILE="$ephemeral_root/missing-postgres.env" \
  YISTACK_DATABASE_BACKUP_DIR="$backup_dir" \
    "$PACKAGE_ROOT/bin/yistack-database-backup" "$@"
}

podman exec "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "INSERT INTO public.users (id, email, username, password_hash)
      VALUES (
        '10000000-0000-0000-0000-000000000097',
        'backup-original@example.test',
        'Backup Original',
        'test-only'
      );" >/dev/null
run_database_backup create release-runtime >/dev/null
run_database_backup verify release-runtime >/dev/null
cp "$backup_dir/release-runtime.dump" "$backup_dir/corrupt.dump"
backup_checksum="$(sha256sum "$backup_dir/release-runtime.dump")"
backup_checksum="${backup_checksum%% *}"
printf '%s  corrupt.dump\n' "$backup_checksum" > "$backup_dir/corrupt.dump.sha256"
printf 'corruption' >> "$backup_dir/corrupt.dump"
if run_database_backup verify corrupt > "$ephemeral_root/corrupt-backup.out" 2>&1; then
  echo "Database backup verification accepted a corrupted archive." >&2
  exit 1
fi
podman exec "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "ALTER TABLE public.users ADD COLUMN upgrade_restore_probe text;
      UPDATE public.users
      SET email = 'backup-mutated@example.test'
      WHERE id = '10000000-0000-0000-0000-000000000097';" >/dev/null
run_database_backup restore release-runtime >/dev/null
backup_restore_contract="$(
  podman exec "$container_name" \
    psql -At -v ON_ERROR_STOP=1 -U postgres -d yistack \
    -c "SELECT
          (SELECT email FROM public.users
           WHERE id = '10000000-0000-0000-0000-000000000097') || ':' ||
          (SELECT count(*) FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'users'
             AND column_name = 'upgrade_restore_probe') || ':' ||
          (SELECT count(*) FROM public.schema_migrations);"
)"
if [ "$backup_restore_contract" != "backup-original@example.test:0:2" ]; then
  echo "Unexpected database backup restore contract: $backup_restore_contract" >&2
  exit 1
fi
podman exec "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "DELETE FROM public.users WHERE email = 'backup-original@example.test';" \
  >/dev/null

container_runtime_config="$(
  podman exec "$container_name" \
    psql --quiet -At -v ON_ERROR_STOP=1 -U postgres -d yistack \
    -c "UPDATE public.system_config SET value = 'false' WHERE key = 'container.enabled' RETURNING key || ':' || value;"
)"
if [ "$container_runtime_config" != "container.enabled:false" ]; then
  echo "Unable to disable the application container runtime for release validation: $container_runtime_config" >&2
  exit 1
fi

APP_ENV=production \
APP_HOST=127.0.0.1 \
APP_PORT="$backend_port" \
DB_TYPE=postgres \
DB_AUTO_MIGRATE=false \
DB_HOST=127.0.0.1 \
DB_PORT="$postgres_port" \
DB_USER=postgres \
DB_PASSWORD=release-runtime-test-password \
DB_NAME=yistack \
DB_SSL_MODE=disable \
JWT_SECRET=release-runtime-jwt-secret-0123456789abcdef \
CONTAINER_ENABLED=false \
CONTAINER_PREVIEW_PORT=0 \
YISTACK_MIGRATIONS_DIR="$PACKAGE_ROOT/database/migrations" \
YISTACK_SKIP_DOTENV=true \
  "$PACKAGE_ROOT/bin/yistack-server" >"$backend_log" 2>&1 &
backend_pid=$!

print_backend_log() {
  tail -n 220 "$backend_log" >&2
}

ready=false
for _ in $(seq 1 45); do
  if curl --fail --silent --show-error \
    "http://127.0.0.1:$backend_port/api/health" > "$health_body" 2>/dev/null; then
    ready=true
    break
  fi
  if ! kill -0 "$backend_pid" >/dev/null 2>&1; then
    print_backend_log
    exit 1
  fi
  sleep 1
done
if [ "$ready" != "true" ]; then
  print_backend_log
  exit 1
fi
if ! grep -q '"status":"ok"' "$health_body"; then
  echo "Unexpected backend health response:" >&2
  cat "$health_body" >&2
  exit 1
fi

assert_backend_unhealthy() {
  local unhealthy_status=""
  unhealthy_status="$(curl --silent --show-error \
    --output "$unhealthy_body" \
    --write-out '%{http_code}' \
    "http://127.0.0.1:$backend_port/api/health")"
  if [ "$unhealthy_status" != 503 ] ||
    ! grep -q '"database":"unavailable"' "$unhealthy_body"; then
    echo "Backend health did not report the stopped database:" >&2
    cat "$unhealthy_body" >&2
    return 1
  fi
}

run_postgres stop
assert_backend_unhealthy

timeout 180s env \
  YISTACK_POSTGRES_ENV_FILE="$postgres_env" \
  "$PACKAGE_ROOT/bin/yistack-postgres" supervise \
  > "$supervisor_log" 2>&1 &
supervisor_pid=$!
run_postgres wait-ready
kill -0 "$supervisor_pid"
curl --fail --silent --show-error \
  "http://127.0.0.1:$backend_port/api/health" > "$health_body"
grep -q '"database":"ok"' "$health_body"

podman kill "$container_name" >/dev/null
set +e
wait "$supervisor_pid"
supervisor_status="$?"
set -e
supervisor_pid=""
if [ "$supervisor_status" -ne 137 ]; then
  echo "PostgreSQL supervisor returned $supervisor_status after an exit-code 137 container failure." >&2
  cat "$supervisor_log" >&2
  exit 1
fi
stopped_state="$(run_postgres inspect)"
case "$stopped_state" in
  status=exited\ exit_code=137\ *)
    ;;
  *)
    echo "Unexpected stopped PostgreSQL state: $stopped_state" >&2
    exit 1
    ;;
esac
assert_backend_unhealthy

run_postgres start
curl --fail --silent --show-error \
  "http://127.0.0.1:$backend_port/api/health" > "$health_body"
grep -q '"database":"ok"' "$health_body"

register_status="$(curl --silent --show-error \
  --output "$register_body" \
  --write-out '%{http_code}' \
  --header 'content-type: application/json' \
  --data "{\"email\":\"release-${run_id}@example.test\",\"password\":\"Release-Test-Password!\",\"username\":\"release-${run_id}\"}" \
  "http://127.0.0.1:$backend_port/api/auth/register")"
if [ "$register_status" != "200" ] && [ "$register_status" != "201" ]; then
  echo "User registration returned HTTP $register_status:" >&2
  cat "$register_body" >&2
  exit 1
fi

schema_contract="$(podman exec "$container_name" \
  psql -At -U postgres -d yistack \
  -c "SELECT (SELECT count(*) FROM public.schema_migrations) || ':' || (SELECT data_type || ':' || is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'instance_id');")"
if [ "$schema_contract" != "2:uuid:YES" ]; then
  echo "Unexpected release database contract: $schema_contract" >&2
  exit 1
fi

memory_limit="$(podman inspect --format '{{.HostConfig.Memory}}' "$container_name")"
pids_limit="$(podman inspect --format '{{.HostConfig.PidsLimit}}' "$container_name")"
log_driver="$(podman inspect --format '{{.HostConfig.LogConfig.Type}}' "$container_name")"
if [ "$memory_limit" != "1073741824" ] ||
  [ "$pids_limit" != "256" ] ||
  [ "$log_driver" != "k8s-file" ]; then
  echo "Unexpected PostgreSQL resource limits: memory=$memory_limit pids=$pids_limit" >&2
  exit 1
fi
postgres_image_id_before="$(
  podman image inspect --format '{{.Id}}' docker.io/library/postgres:16-alpine
)"
[ -n "$postgres_image_id_before" ] || {
  echo "Unable to identify the reusable PostgreSQL image." >&2
  exit 1
}

ephemeral_data="$ephemeral_root/data"
ephemeral_config="$ephemeral_root/config"
ephemeral_log="$ephemeral_root/log"
ephemeral_cache="$ephemeral_root/cache"
ephemeral_install="$ephemeral_root/install"
ephemeral_baseline="$ephemeral_data/ephemeral-baseline"
ephemeral_project_id="ephemeral-user-project"
real_podman="$(command -v podman)"
mkdir -p \
  "$ephemeral_root/bin" \
  "$ephemeral_config" \
  "$ephemeral_data/runtime/projects" \
  "$ephemeral_data/runtime/templates/protected-template" \
  "$ephemeral_data/runtime/container-data" \
  "$ephemeral_data/runtime/generation-evidence" \
  "$ephemeral_data/ms-playwright/protected-browser" \
  "$ephemeral_log" \
  "$ephemeral_cache" \
  "$ephemeral_install"
printf 'runtime-template\n' > "$ephemeral_data/runtime/templates/protected-template/template.txt"
printf 'browser-runtime\n' > "$ephemeral_data/ms-playwright/protected-browser/browser.txt"
printf 'v0.0.0\n' > "$ephemeral_install/VERSION"
printf '0000000000000000000000000000000000000000\n' > "$ephemeral_install/SOURCE_COMMIT"
ln -s "$PACKAGE_ROOT/bin/yistack-postgres" "$ephemeral_install/yistack-postgres"

cat > "$ephemeral_root/bin/systemctl" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = "is-active" ]; then
  exit 3
fi
exit 0
EOF
cat > "$ephemeral_root/bin/podman" <<EOF
#!/usr/bin/env bash
set -euo pipefail
case "\${1:-}" in
  ps)
    [[ " \$* " = *" label=yistack.project_id"* ]] && exit 0
    ;;
  network)
    [ "\${2:-}" = "ls" ] && [[ " \$* " = *" label=yistack.project_id"* ]] && exit 0
    ;;
esac
exec "$real_podman" "\$@"
EOF
chmod 0755 "$ephemeral_root/bin/systemctl" "$ephemeral_root/bin/podman"

ephemeral_user_id="$(sed -n 's/.*"id":"\([^"]*\)".*/\1/p' "$register_body" | head -n 1)"
if ! [[ "$ephemeral_user_id" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "Unable to extract the registered release user ID." >&2
  cat "$register_body" >&2
  exit 1
fi

cat > "$ephemeral_config/yistack.env" <<EOF
DB_TYPE=postgres
YISTACK_INSTALL_DIR=$ephemeral_install
YISTACK_DATA_DIR=$ephemeral_data
YISTACK_LOG_DIR=$ephemeral_log
YISTACK_CACHE_DIR=$ephemeral_cache
CONTAINER_PROJECT_DIR=$ephemeral_data/runtime/projects
CONTAINER_TEMPLATE_DIR=$ephemeral_data/runtime/templates
CONTAINER_DATA_DIR=$ephemeral_data/runtime/container-data
YISTACK_BROWSER_EVIDENCE_DIR=$ephemeral_data/runtime/generation-evidence
PLAYWRIGHT_BROWSERS_PATH=$ephemeral_data/ms-playwright
EOF
cp "$postgres_env" "$ephemeral_config/postgres.env"
cat > "$ephemeral_config/ephemeral.env" <<EOF
EPHEMERAL_MAINTENANCE_ENABLED=true
EPHEMERAL_BASELINE_DIR=$ephemeral_baseline
EPHEMERAL_PROJECT_TTL_HOURS=24
EPHEMERAL_STOPPED_CONTAINER_TTL_MINUTES=60
EPHEMERAL_EVIDENCE_TTL_HOURS=24
EPHEMERAL_CACHE_TTL_HOURS=24
EPHEMERAL_LOG_TTL_DAYS=7
EPHEMERAL_DISK_HIGH_WATERMARK_PERCENT=99
EPHEMERAL_DISK_LOW_WATERMARK_PERCENT=98
EPHEMERAL_RESTART_AFTER_RESET=false
EPHEMERAL_HEALTH_TIMEOUT_SECONDS=10
EPHEMERAL_LOCK_FILE=$ephemeral_root/ephemeral.lock
SERVICE_USER=$(id -un)
EOF

run_ephemeral_maintenance() {
  PATH="$ephemeral_root/bin:$PATH" \
    YISTACK_ENV_FILE="$ephemeral_config/yistack.env" \
    YISTACK_POSTGRES_ENV_FILE="$ephemeral_config/postgres.env" \
    YISTACK_EPHEMERAL_ENV_FILE="$ephemeral_config/ephemeral.env" \
    "$PACKAGE_ROOT/bin/yistack-ephemeral-maintenance" "$@"
}

kill "$backend_pid"
wait "$backend_pid" || true
backend_pid=""

if run_ephemeral_maintenance snapshot > "$ephemeral_root/dirty-baseline.out" 2>&1; then
  echo "Ephemeral experience snapshot accepted registered user data." >&2
  exit 1
fi
grep -q 'database contains user data' "$ephemeral_root/dirty-baseline.out" || {
  echo "Ephemeral experience snapshot did not explain the clean-baseline requirement." >&2
  cat "$ephemeral_root/dirty-baseline.out" >&2
  exit 1
}
podman exec "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "DELETE FROM public.users WHERE id = '$ephemeral_user_id';"
run_ephemeral_maintenance snapshot

podman exec "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "INSERT INTO public.users (id, email, username, password_hash) VALUES ('$ephemeral_user_id', 'ephemeral-user@example.test', 'ephemeral-user', 'runtime-test-hash'); INSERT INTO public.projects (user_id, project_id, name, directory_path) VALUES ('$ephemeral_user_id', '$ephemeral_project_id', 'Ephemeral user project', '$ephemeral_data/runtime/projects/$ephemeral_project_id');"
mkdir -p "$ephemeral_data/runtime/projects/$ephemeral_project_id"
printf 'user-workspace\n' > "$ephemeral_data/runtime/projects/$ephemeral_project_id/app.txt"
printf 'container-state\n' > "$ephemeral_data/runtime/container-data/state.json"
printf 'generation-evidence\n' > "$ephemeral_data/runtime/generation-evidence/evidence.txt"
printf 'cache-data\n' > "$ephemeral_cache/cache.txt"
printf 'managed-log\n' > "$ephemeral_log/application.log"
podman exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "INSERT INTO public.chat_messages (project_id, user_id, role, content) VALUES ('$ephemeral_project_id', '$ephemeral_user_id', 'user', 'ephemeral user content');"
run_ephemeral_maintenance reset

[ "$(cat "$ephemeral_data/runtime/templates/protected-template/template.txt")" = "runtime-template" ] || {
  echo "Ephemeral experience reset modified runtime templates." >&2
  exit 1
}
[ "$(cat "$ephemeral_data/ms-playwright/protected-browser/browser.txt")" = "browser-runtime" ] || {
  echo "Ephemeral experience reset modified the Playwright runtime." >&2
  exit 1
}
for cleared_path in \
  "$ephemeral_data/runtime/projects/$ephemeral_project_id" \
  "$ephemeral_data/runtime/container-data/state.json" \
  "$ephemeral_data/runtime/generation-evidence/evidence.txt" \
  "$ephemeral_cache/cache.txt" \
  "$ephemeral_log/application.log"; do
  [ ! -e "$cleared_path" ] || {
    echo "Ephemeral experience reset retained managed user data: $cleared_path" >&2
    exit 1
  }
done
restored_user_data_contract="$(
  podman exec "$container_name" psql -At -U postgres -d yistack \
    -c "SELECT (SELECT count(*) FROM public.users) || ':' || (SELECT count(*) FROM public.projects) || ':' || (SELECT count(*) FROM public.chat_messages);"
)"
[ "$restored_user_data_contract" = "0:0:0" ] || {
  echo "Ephemeral experience reset retained database user data: $restored_user_data_contract" >&2
  exit 1
}
postgres_image_id_after="$(
  podman image inspect --format '{{.Id}}' docker.io/library/postgres:16-alpine
)"
[ "$postgres_image_id_after" = "$postgres_image_id_before" ] || {
  echo "Ephemeral experience reset removed or replaced the reusable PostgreSQL image." >&2
  exit 1
}

echo "Release PostgreSQL runtime validation passed."
