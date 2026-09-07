#!/usr/bin/env bash

set -euo pipefail

PACKAGE_ROOT="${1:-}"
if [ -z "$PACKAGE_ROOT" ]; then
  echo "Usage: $0 <extracted-release-directory>" >&2
  exit 2
fi
PACKAGE_ROOT="$(realpath "$PACKAGE_ROOT")"
for required_file in \
  bin/yistack-demo-maintenance \
  bin/yistack-postgres \
  bin/yistack-server \
  database/init.sql \
  database/postgres-auth-compat.sql; do
  if [ ! -f "$PACKAGE_ROOT/$required_file" ]; then
    echo "Release directory is missing $required_file" >&2
    exit 1
  fi
done
for command in curl podman realpath; do
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
register_body="$(mktemp "${TMPDIR:-/tmp}/yistack-release-register.XXXXXX")"
demo_root="$(mktemp -d "${TMPDIR:-/tmp}/yistack-release-demo.XXXXXX")"
backend_pid=""
port_offset="$((RANDOM % 500))"
postgres_port="$((55000 + port_offset))"
backend_port="$((56000 + port_offset))"

cleanup() {
  if [ -n "$backend_pid" ]; then
    kill "$backend_pid" >/dev/null 2>&1 || true
    wait "$backend_pid" >/dev/null 2>&1 || true
  fi
  podman rm --force "$container_name" >/dev/null 2>&1 || true
  podman unshare rm -rf "$data_dir" >/dev/null 2>&1 || true
  rm -f "$postgres_env" "$backend_log" "$health_body" "$register_body"
  rm -rf "$demo_root"
}
trap cleanup EXIT

printf '%s\n' \
  'POSTGRES_IMAGE=docker.io/library/postgres:16-alpine' \
  "POSTGRES_CONTAINER_NAME=$container_name" \
  'POSTGRES_USER=postgres' \
  'POSTGRES_PASSWORD=release-runtime-test-password' \
  'POSTGRES_DB=yistack' \
  "POSTGRES_PORT=$postgres_port" \
  "POSTGRES_DATA_DIR=$data_dir" > "$postgres_env"

for _ in 1 2; do
  YISTACK_POSTGRES_ENV_FILE="$postgres_env" \
    "$PACKAGE_ROOT/bin/yistack-postgres" init
done

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
  -c "SELECT (SELECT count(*) FROM public.schema_migrations WHERE version = '000000000000_contributor_alpha') || ':' || (SELECT data_type || ':' || is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'instance_id');")"
if [ "$schema_contract" != "1:uuid:YES" ]; then
  echo "Unexpected release database contract: $schema_contract" >&2
  exit 1
fi

memory_limit="$(podman inspect --format '{{.HostConfig.Memory}}' "$container_name")"
pids_limit="$(podman inspect --format '{{.HostConfig.PidsLimit}}' "$container_name")"
if [ "$memory_limit" != "1073741824" ] || [ "$pids_limit" != "256" ]; then
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

demo_data="$demo_root/data"
demo_config="$demo_root/config"
demo_log="$demo_root/log"
demo_cache="$demo_root/cache"
demo_install="$demo_root/install"
demo_baseline="$demo_data/demo-baseline"
demo_project_id="demo-user-project"
real_podman="$(command -v podman)"
mkdir -p \
  "$demo_root/bin" \
  "$demo_config" \
  "$demo_data/runtime/projects" \
  "$demo_data/runtime/templates/protected-template" \
  "$demo_data/runtime/container-data" \
  "$demo_data/runtime/generation-evidence" \
  "$demo_data/ms-playwright/protected-browser" \
  "$demo_log" \
  "$demo_cache" \
  "$demo_install"
printf 'runtime-template\n' > "$demo_data/runtime/templates/protected-template/template.txt"
printf 'browser-runtime\n' > "$demo_data/ms-playwright/protected-browser/browser.txt"
printf 'v0.0.0\n' > "$demo_install/VERSION"
printf '0000000000000000000000000000000000000000\n' > "$demo_install/SOURCE_COMMIT"
ln -s "$PACKAGE_ROOT/bin/yistack-postgres" "$demo_install/yistack-postgres"

cat > "$demo_root/bin/systemctl" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = "is-active" ]; then
  exit 3
fi
exit 0
EOF
cat > "$demo_root/bin/podman" <<EOF
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
chmod 0755 "$demo_root/bin/systemctl" "$demo_root/bin/podman"

demo_user_id="$(sed -n 's/.*"id":"\([^"]*\)".*/\1/p' "$register_body" | head -n 1)"
if ! [[ "$demo_user_id" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "Unable to extract the registered release user ID." >&2
  cat "$register_body" >&2
  exit 1
fi

cat > "$demo_config/yistack.env" <<EOF
DB_TYPE=postgres
YISTACK_INSTALL_DIR=$demo_install
YISTACK_DATA_DIR=$demo_data
YISTACK_LOG_DIR=$demo_log
YISTACK_CACHE_DIR=$demo_cache
CONTAINER_PROJECT_DIR=$demo_data/runtime/projects
CONTAINER_TEMPLATE_DIR=$demo_data/runtime/templates
CONTAINER_DATA_DIR=$demo_data/runtime/container-data
YISTACK_BROWSER_EVIDENCE_DIR=$demo_data/runtime/generation-evidence
PLAYWRIGHT_BROWSERS_PATH=$demo_data/ms-playwright
EOF
cp "$postgres_env" "$demo_config/postgres.env"
cat > "$demo_config/demo.env" <<EOF
DEMO_MAINTENANCE_ENABLED=true
DEMO_BASELINE_DIR=$demo_baseline
DEMO_PROJECT_TTL_HOURS=24
DEMO_STOPPED_CONTAINER_TTL_MINUTES=60
DEMO_EVIDENCE_TTL_HOURS=24
DEMO_CACHE_TTL_HOURS=24
DEMO_LOG_TTL_DAYS=7
DEMO_DISK_HIGH_WATERMARK_PERCENT=99
DEMO_DISK_LOW_WATERMARK_PERCENT=98
DEMO_RESTART_AFTER_RESET=false
DEMO_HEALTH_TIMEOUT_SECONDS=10
DEMO_LOCK_FILE=$demo_root/demo.lock
SERVICE_USER=$(id -un)
EOF

run_demo_maintenance() {
  PATH="$demo_root/bin:$PATH" \
    YISTACK_ENV_FILE="$demo_config/yistack.env" \
    YISTACK_POSTGRES_ENV_FILE="$demo_config/postgres.env" \
    YISTACK_DEMO_ENV_FILE="$demo_config/demo.env" \
    "$PACKAGE_ROOT/bin/yistack-demo-maintenance" "$@"
}

kill "$backend_pid"
wait "$backend_pid" || true
backend_pid=""

if run_demo_maintenance snapshot > "$demo_root/dirty-baseline.out" 2>&1; then
  echo "Ephemeral trial snapshot accepted registered user data." >&2
  exit 1
fi
grep -q 'database contains user data' "$demo_root/dirty-baseline.out" || {
  echo "Ephemeral trial snapshot did not explain the clean-baseline requirement." >&2
  cat "$demo_root/dirty-baseline.out" >&2
  exit 1
}
podman exec "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "DELETE FROM public.users WHERE id = '$demo_user_id';"
run_demo_maintenance snapshot

podman exec "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "INSERT INTO public.users (id, email, username, password_hash) VALUES ('$demo_user_id', 'ephemeral-user@example.test', 'ephemeral-user', 'runtime-test-hash'); INSERT INTO public.projects (user_id, project_id, name, directory_path) VALUES ('$demo_user_id', '$demo_project_id', 'Ephemeral user project', '$demo_data/runtime/projects/$demo_project_id');"
mkdir -p "$demo_data/runtime/projects/$demo_project_id"
printf 'user-workspace\n' > "$demo_data/runtime/projects/$demo_project_id/app.txt"
printf 'container-state\n' > "$demo_data/runtime/container-data/state.json"
printf 'generation-evidence\n' > "$demo_data/runtime/generation-evidence/evidence.txt"
printf 'cache-data\n' > "$demo_cache/cache.txt"
printf 'managed-log\n' > "$demo_log/application.log"
podman exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "INSERT INTO public.chat_messages (project_id, user_id, role, content) VALUES ('$demo_project_id', '$demo_user_id', 'user', 'ephemeral user content');"
run_demo_maintenance reset

[ "$(cat "$demo_data/runtime/templates/protected-template/template.txt")" = "runtime-template" ] || {
  echo "Ephemeral trial reset modified runtime templates." >&2
  exit 1
}
[ "$(cat "$demo_data/ms-playwright/protected-browser/browser.txt")" = "browser-runtime" ] || {
  echo "Ephemeral trial reset modified the Playwright runtime." >&2
  exit 1
}
for cleared_path in \
  "$demo_data/runtime/projects/$demo_project_id" \
  "$demo_data/runtime/container-data/state.json" \
  "$demo_data/runtime/generation-evidence/evidence.txt" \
  "$demo_cache/cache.txt" \
  "$demo_log/application.log"; do
  [ ! -e "$cleared_path" ] || {
    echo "Ephemeral trial reset retained managed user data: $cleared_path" >&2
    exit 1
  }
done
restored_user_data_contract="$(
  podman exec "$container_name" psql -At -U postgres -d yistack \
    -c "SELECT (SELECT count(*) FROM public.users) || ':' || (SELECT count(*) FROM public.projects) || ':' || (SELECT count(*) FROM public.chat_messages);"
)"
[ "$restored_user_data_contract" = "0:0:0" ] || {
  echo "Ephemeral trial reset retained database user data: $restored_user_data_contract" >&2
  exit 1
}
postgres_image_id_after="$(
  podman image inspect --format '{{.Id}}' docker.io/library/postgres:16-alpine
)"
[ "$postgres_image_id_after" = "$postgres_image_id_before" ] || {
  echo "Ephemeral trial reset removed or replaced the reusable PostgreSQL image." >&2
  exit 1
}

echo "Release PostgreSQL runtime validation passed."
