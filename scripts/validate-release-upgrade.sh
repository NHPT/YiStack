#!/usr/bin/env bash

set -Eeuo pipefail

PACKAGE_ROOT="${1:-}"
if [ -z "$PACKAGE_ROOT" ]; then
  echo "Usage: $0 <extracted-release-directory>" >&2
  exit 2
fi
PACKAGE_ROOT="$(realpath "$PACKAGE_ROOT")"
for required_file in \
  MANIFEST.sha256 \
  VERSION \
  bin/yistack-database-backup \
  bin/yistack-postgres \
  bin/yistack-server \
  bin/yistackctl \
  database/migrations/manifest.json \
  database/migrations/rollback/202609070001_migration_integrity.sql \
  systemd/yistack.target \
  upgrade.sh; do
  [ -e "$PACKAGE_ROOT/$required_file" ] || {
    echo "Release directory is missing $required_file" >&2
    exit 1
  }
done
for command in cmp flock grep podman realpath sha256sum sort tar; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Missing upgrade validation command: $command" >&2
    exit 1
  }
done

target_version="$(tr -d '[:space:]' < "$PACKAGE_ROOT/VERSION")"
[[ "$target_version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  echo "Invalid test Release version: $target_version" >&2
  exit 1
}
highest_version="$(printf '%s\n%s\n' v1.0.0 "$target_version" | sort -V | tail -n 1)"
if [ "$target_version" = v1.0.0 ] || [ "$highest_version" != "$target_version" ]; then
  echo "Upgrade validation requires a Release newer than v1.0.0, got $target_version" >&2
  exit 1
fi

run_id="${GITHUB_RUN_ID:-$$}-${RANDOM}"
container_name="yistack-upgrade-test-${run_id}"
root="$(mktemp -d "${TMPDIR:-/tmp}/yistack-release-upgrade.XXXXXX")"
data_dir="$root/postgres-data"
postgres_env="$root/postgres.env"
port="$((57000 + RANDOM % 1000))"

cleanup() {
  podman rm --force "$container_name" >/dev/null 2>&1 || true
  podman unshare rm -rf "$data_dir" >/dev/null 2>&1 || true
  rm -rf "$root"
}
trap cleanup EXIT

printf '%s\n' \
  'POSTGRES_IMAGE=docker.io/library/postgres:16-alpine' \
  "POSTGRES_CONTAINER_NAME=$container_name" \
  'POSTGRES_USER=postgres' \
  'POSTGRES_PASSWORD=upgrade-runtime-test-password' \
  'POSTGRES_DB=yistack' \
  "POSTGRES_PORT=$port" \
  "POSTGRES_DATA_DIR=$data_dir" > "$postgres_env"
YISTACK_POSTGRES_ENV_FILE="$postgres_env" \
  "$PACKAGE_ROOT/bin/yistack-postgres" init

podman exec "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "DELETE FROM public.schema_migrations
      WHERE version = '202609070001_migration_integrity';" >/dev/null
podman exec -i "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  < "$PACKAGE_ROOT/database/migrations/rollback/202609070001_migration_integrity.sql" \
  >/dev/null
podman exec "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "INSERT INTO public.users (id, email, username, password_hash)
      VALUES (
        '10000000-0000-0000-0000-000000000096',
        'upgrade-preserved@example.test',
        'Upgrade Preserved',
        'test-only'
      );" >/dev/null

mock_root="$root/mocks"
mkdir -p "$mock_root"
cat > "$mock_root/systemctl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
state_file="${MOCK_SYSTEMCTL_STATE:?}"
enabled_file="${MOCK_SYSTEMCTL_ENABLED:?}"
log_file="${MOCK_SYSTEMCTL_LOG:?}"
command="${1:-}"
shift || true
printf '%s %s\n' "$command" "$*" >> "$log_file"
case "$command" in
  is-active)
    unit="${!#}"
    grep -Fqx "$unit" "$state_file"
    ;;
  is-enabled)
    unit="${!#}"
    grep -Fqx "$unit" "$enabled_file"
    ;;
  start | stop)
    for unit in "$@"; do
      [ "$unit" = "--quiet" ] && continue
      if [ "$command" = "start" ]; then
        grep -Fqx "$unit" "$state_file" || printf '%s\n' "$unit" >> "$state_file"
      else
        grep -Fvx "$unit" "$state_file" > "$state_file.tmp" || true
        mv "$state_file.tmp" "$state_file"
      fi
    done
    ;;
  enable | disable)
    for unit in "$@"; do
      [ "$unit" = "--quiet" ] && continue
      if [ "$command" = "enable" ]; then
        grep -Fqx "$unit" "$enabled_file" || printf '%s\n' "$unit" >> "$enabled_file"
      else
        grep -Fvx "$unit" "$enabled_file" > "$enabled_file.tmp" || true
        mv "$enabled_file.tmp" "$enabled_file"
      fi
    done
    ;;
  daemon-reload)
    ;;
  *)
    echo "Unexpected systemctl command: $command $*" >&2
    exit 1
    ;;
esac
EOF
cat > "$mock_root/runuser" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
filtered=()
if [ "${1:-}" = "-u" ]; then
  shift 2
fi
if [ "${1:-}" = "--" ]; then
  shift
fi
if [ "${1:-}" = "env" ]; then
  shift
  for argument in "$@"; do
    case "$argument" in
      HOME=* | XDG_RUNTIME_DIR=*)
        ;;
      *)
        filtered+=("$argument")
        ;;
    esac
  done
  exec env "${filtered[@]}"
fi
exec "$@"
EOF
cat > "$mock_root/old-yistackctl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[ "${1:-}" = "health" ] || exit 2
echo "Old YiStack is healthy."
EOF
cat > "$mock_root/new-yistackctl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[ "${1:-}" = "health" ] || exit 2
[ "${MOCK_NEW_HEALTH_FAIL:-false}" != "true" ]
echo "New YiStack is healthy."
EOF
cat > "$mock_root/install" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
version="$(tr -d '[:space:]' < "$YISTACK_PACKAGE_ROOT/VERSION")"
release_dir="$YISTACK_INSTALL_ROOT/releases/$version"
rm -rf "$release_dir"
mkdir -p "$release_dir/bin" "$release_dir/database" "$release_dir/systemd"
cp "$YISTACK_PACKAGE_ROOT/VERSION" "$release_dir/VERSION"
ln -s "$YISTACK_PACKAGE_ROOT/bin/yistack-server" "$release_dir/bin/yistack-server"
ln -s "$YISTACK_PACKAGE_ROOT/database/migrations" "$release_dir/database/migrations"
cp "$MOCK_NEW_YISTACKCTL" "$release_dir/bin/yistackctl"
chmod 0755 "$release_dir/bin/yistackctl"
cp "$YISTACK_PACKAGE_ROOT/systemd/"* "$release_dir/systemd/"
for unit in "$release_dir"/systemd/*; do
  cp "$unit" "$YISTACK_SYSTEMD_DIR/$(basename "$unit")"
done
"$YISTACK_SYSTEMCTL_BIN" enable yistack.target
printf 'INSTALL_MARKER=new\n' >> "$YISTACK_ENV_FILE"
ln -sfn "$release_dir" "$YISTACK_INSTALL_ROOT/current.new"
mv -Tf "$YISTACK_INSTALL_ROOT/current.new" "$YISTACK_INSTALL_ROOT/current"
EOF
chmod 0755 \
  "$mock_root/systemctl" \
  "$mock_root/runuser" \
  "$mock_root/old-yistackctl" \
  "$mock_root/new-yistackctl" \
  "$mock_root/install"

prepare_case() {
  local case_root="$1"
  local unit unit_name old_release
  old_release="$case_root/install/releases/v1.0.0"
  mkdir -p \
    "$old_release/bin" \
    "$old_release/systemd" \
    "$case_root/config" \
    "$case_root/data/database-backups" \
    "$case_root/systemd"
  printf 'v1.0.0\n' > "$old_release/VERSION"
  cp "$mock_root/old-yistackctl" "$old_release/bin/yistackctl"
  for unit in "$PACKAGE_ROOT"/systemd/*; do
    unit_name="$(basename "$unit")"
    printf '[Unit]\nDescription=YiStack v1.0.0 %s\n' "$unit_name" \
      > "$old_release/systemd/$unit_name"
    cp "$old_release/systemd/$unit_name" "$case_root/systemd/$unit_name"
  done
  ln -s "$old_release" "$case_root/install/current"
  cat > "$case_root/config/yistack.env" <<EOF
DB_TYPE=postgres
DB_HOST=127.0.0.1
DB_PORT=$port
DB_USER=postgres
DB_PASSWORD=upgrade-runtime-test-password
DB_NAME=yistack
DB_SSL_MODE=disable
POSTGRES_IMAGE=docker.io/library/postgres:16-alpine
ORIGINAL_CONFIG=true
EOF
  printf '%s\n' \
    yistack.target \
    yistack-demo-reset.timer > "$case_root/systemctl.state"
  : > "$case_root/systemctl.enabled"
  : > "$case_root/systemctl.log"
}

run_upgrade() {
  local case_root="$1"
  env \
    MOCK_NEW_HEALTH_FAIL="${MOCK_NEW_HEALTH_FAIL:-false}" \
    MOCK_NEW_YISTACKCTL="$mock_root/new-yistackctl" \
    MOCK_SYSTEMCTL_ENABLED="$case_root/systemctl.enabled" \
    MOCK_SYSTEMCTL_LOG="$case_root/systemctl.log" \
    MOCK_SYSTEMCTL_STATE="$case_root/systemctl.state" \
    YISTACK_CONFIG_DIR="$case_root/config" \
    YISTACK_DATA_DIR="$case_root/data" \
    YISTACK_DATABASE_BACKUP_DIR="$case_root/data/database-backups" \
    YISTACK_ENV_FILE="$case_root/config/yistack.env" \
    YISTACK_INSTALLER_PATH="$mock_root/install" \
    YISTACK_INSTALL_ROOT="$case_root/install" \
    YISTACK_PACKAGE_ROOT="$PACKAGE_ROOT" \
    YISTACK_POSTGRES_ENV_FILE="$postgres_env" \
    YISTACK_RUNUSER_BIN="$mock_root/runuser" \
    YISTACK_SERVICE_GROUP="$(id -gn)" \
    YISTACK_SERVICE_USER="$(id -un)" \
    YISTACK_SKIP_ROOT_CHECK=true \
    YISTACK_SYSTEMCTL_BIN="$mock_root/systemctl" \
    YISTACK_SYSTEMD_DIR="$case_root/systemd" \
    YISTACK_UPGRADE_HEALTH_ATTEMPTS=1 \
    YISTACK_UPGRADE_HEALTH_SLEEP_SECONDS=0 \
    YISTACK_UPGRADE_LOCK_FILE="$case_root/upgrade.lock" \
      "$PACKAGE_ROOT/upgrade.sh" --skip-browser-install
}

database_contract() {
  podman exec "$container_name" \
    psql -At -v ON_ERROR_STOP=1 -U postgres -d yistack -c "$1"
}

assert_service_state() {
  local case_root="$1"
  grep -Fqx yistack.target "$case_root/systemctl.state"
  grep -Fqx yistack-demo-reset.timer "$case_root/systemctl.state"
  if grep -Fqx yistack-demo-cleanup.timer "$case_root/systemctl.state"; then
    echo "Upgrade changed the inactive cleanup timer state." >&2
    exit 1
  fi
  if grep -Fqx yistack.target "$case_root/systemctl.enabled"; then
    echo "Upgrade changed the disabled target enablement state." >&2
    exit 1
  fi
}

success_root="$root/success"
prepare_case "$success_root"
if ! run_upgrade "$success_root" > "$success_root/upgrade.out" 2>&1; then
  echo "Successful upgrade acceptance failed:" >&2
  cat "$success_root/upgrade.out" >&2
  exit 1
fi
[ "$(tr -d '[:space:]' < "$success_root/install/current/VERSION")" = "$target_version" ]
grep -Fqx 'INSTALL_MARKER=new' "$success_root/config/yistack.env"
assert_service_state "$success_root"
for unit in "$PACKAGE_ROOT"/systemd/*; do
  cmp "$unit" "$success_root/systemd/$(basename "$unit")"
done
success_contract="$(database_contract "SELECT
  (SELECT count(*) FROM public.schema_migrations) || ':' ||
  (SELECT count(*) FROM public.users WHERE email = 'upgrade-preserved@example.test') || ':' ||
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'schema_migrations'
     AND column_name = 'checksum_sha256') || ':' ||
  (SELECT value FROM public.system_config WHERE key = 'app_version');")"
[ "$success_contract" = "2:1:1:1.1.0" ] || {
  echo "Unexpected successful upgrade database contract: $success_contract" >&2
  exit 1
}
success_dumps=("$success_root/data/database-backups/"*.dump)
[ "${#success_dumps[@]}" -eq 1 ] && [ -s "${success_dumps[0]}" ]
[ -s "${success_dumps[0]}.sha256" ]
[ -s "${success_dumps[0]%.dump}.yistack.env" ]
[ -s "${success_dumps[0]%.dump}.systemd/units.state" ]

success_backup_name="$(basename "${success_dumps[0]}" .dump)"
YISTACK_ENV_FILE="$success_root/config/yistack.env" \
YISTACK_POSTGRES_ENV_FILE="$postgres_env" \
YISTACK_DATABASE_BACKUP_DIR="$success_root/data/database-backups" \
  "$PACKAGE_ROOT/bin/yistack-database-backup" restore "$success_backup_name" \
  >/dev/null

failure_root="$root/failure"
prepare_case "$failure_root"
cp "$failure_root/config/yistack.env" "$failure_root/original-yistack.env"
set +e
MOCK_NEW_HEALTH_FAIL=true run_upgrade "$failure_root" \
  > "$failure_root/upgrade.out" 2>&1
failure_status="$?"
set -e
[ "$failure_status" -ne 0 ] || {
  echo "Upgrade unexpectedly succeeded after the new health check failed." >&2
  exit 1
}
[ "$(tr -d '[:space:]' < "$failure_root/install/current/VERSION")" = v1.0.0 ]
cmp "$failure_root/original-yistack.env" "$failure_root/config/yistack.env"
assert_service_state "$failure_root"
for unit in "$failure_root/install/releases/v1.0.0/systemd/"*; do
  cmp "$unit" "$failure_root/systemd/$(basename "$unit")"
done
failure_contract="$(database_contract "SELECT
  (SELECT count(*) FROM public.schema_migrations) || ':' ||
  (SELECT count(*) FROM public.users WHERE email = 'upgrade-preserved@example.test') || ':' ||
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'schema_migrations'
     AND column_name = 'checksum_sha256') || ':' ||
  (SELECT value FROM public.system_config WHERE key = 'app_version');")"
[ "$failure_contract" = "1:1:0:1.0.0" ] || {
  echo "Unexpected recovered database contract: $failure_contract" >&2
  cat "$failure_root/upgrade.out" >&2
  exit 1
}
grep -Fq 'Previous Release v1.0.0 restored.' "$failure_root/upgrade.out"

dispatch_root="$root/dispatch/yistack-v9.9.9-linux-amd64"
mkdir -p "$dispatch_root"
cat > "$dispatch_root/upgrade.sh" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" > "${YISTACK_UPGRADE_DISPATCH_OUTPUT:?}"
[ "${1:-}" != "--fail" ] || exit 23
EOF
chmod 0755 "$dispatch_root/upgrade.sh"
YISTACK_UPGRADE_DISPATCH_OUTPUT="$root/directory-dispatch.out" \
  "$PACKAGE_ROOT/bin/yistackctl" upgrade "$dispatch_root" --skip-browser-install
grep -Fqx -- '--skip-browser-install' "$root/directory-dispatch.out"
tar -czf "$root/yistack-v9.9.9-linux-amd64.tar.gz" \
  -C "$root/dispatch" yistack-v9.9.9-linux-amd64
(
  cd "$root"
  sha256sum yistack-v9.9.9-linux-amd64.tar.gz \
    > yistack-v9.9.9-linux-amd64.tar.gz.sha256
)
YISTACK_UPGRADE_DISPATCH_OUTPUT="$root/archive-dispatch.out" \
  "$PACKAGE_ROOT/bin/yistackctl" upgrade \
    "$root/yistack-v9.9.9-linux-amd64.tar.gz" --skip-browser-install
grep -Fqx -- '--skip-browser-install' "$root/archive-dispatch.out"

mkdir -p "$root/unsafe/wrong-root" "$root/archive-tmp"
cp "$dispatch_root/upgrade.sh" "$root/unsafe/wrong-root/upgrade.sh"
tar -czf "$root/yistack-v9.9.8-linux-amd64.tar.gz" \
  -C "$root/unsafe" wrong-root
(
  cd "$root"
  sha256sum yistack-v9.9.8-linux-amd64.tar.gz \
    > yistack-v9.9.8-linux-amd64.tar.gz.sha256
)
set +e
TMPDIR="$root/archive-tmp" \
YISTACK_UPGRADE_DISPATCH_OUTPUT="$root/unsafe-dispatch.out" \
  "$PACKAGE_ROOT/bin/yistackctl" upgrade \
    "$root/yistack-v9.9.8-linux-amd64.tar.gz" \
    > "$root/unsafe-archive.out" 2>&1
unsafe_status="$?"
set -e
[ "$unsafe_status" -ne 0 ] || {
  echo "yistackctl accepted an archive with the wrong package root." >&2
  exit 1
}
grep -Fq 'escapes its package root' "$root/unsafe-archive.out"
[ -z "$(find "$root/archive-tmp" -mindepth 1 -print -quit)" ] || {
  echo "yistackctl left temporary archive content after rejection." >&2
  exit 1
}

set +e
YISTACK_UPGRADE_DISPATCH_OUTPUT="$root/status-dispatch.out" \
  "$PACKAGE_ROOT/bin/yistackctl" upgrade "$dispatch_root" --fail
dispatch_status="$?"
set -e
[ "$dispatch_status" -eq 23 ] || {
  echo "yistackctl did not preserve the upgrade exit status: $dispatch_status" >&2
  exit 1
}

echo "Release one-command upgrade validation passed."
