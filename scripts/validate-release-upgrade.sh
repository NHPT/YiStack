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
  bin/yistack-ephemeral-maintenance \
  bin/yistack-postgres \
  bin/yistack-service-user-exec \
  bin/yistack-server \
  bin/yistackctl \
  database/migrations/manifest.json \
  database/migrations/rollback/202609070001_migration_integrity.sql \
  database/migrations/rollback/202609190001_admin_user_hard_delete.sql \
  database/migrations/rollback/202609190002_resource_alert_action_claims.sql \
  systemd/yistack.target \
  upgrade.sh; do
  [ -e "$PACKAGE_ROOT/$required_file" ] || {
    echo "Release directory is missing $required_file" >&2
    exit 1
  }
done
for command in cmp flock grep podman ps realpath sha256sum sort tar; do
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
real_podman="$(command -v podman)"
maintenance_lock_pid=""
blocked_installer_release_file=""

cleanup() {
  if [ -n "$maintenance_lock_pid" ]; then
    kill "$maintenance_lock_pid" >/dev/null 2>&1 || true
    wait "$maintenance_lock_pid" >/dev/null 2>&1 || true
  fi
  if [ -n "$blocked_installer_release_file" ]; then
    : > "$blocked_installer_release_file" 2>/dev/null || true
  fi
  podman rm --force "$container_name" >/dev/null 2>&1 || true
  podman unshare rm -rf "$data_dir" >/dev/null 2>&1 || true
  rm -rf "$root"
}
trap cleanup EXIT

set +e
bash -c '
  source "$1"
  exec 8>"$2"
  flock -n 8
  exec 9>"$3"
  flock -n 9
  run_lifecycle_child sh -c "exit 23"
' _ \
  "$PACKAGE_ROOT/upgrade.sh" \
  "$root/wrapper-ephemeral.lock" \
  "$root/wrapper-upgrade.lock"
wrapper_status="$?"
set -e
[ "$wrapper_status" -eq 23 ] || {
  echo "Lifecycle child wrapper changed exit status 23 to $wrapper_status." >&2
  exit 1
}

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
      WHERE version = '202609190002_resource_alert_action_claims';" >/dev/null
podman exec -i "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  < "$PACKAGE_ROOT/database/migrations/rollback/202609190002_resource_alert_action_claims.sql" \
  >/dev/null
podman exec "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  -c "DELETE FROM public.schema_migrations
      WHERE version = '202609190001_admin_user_hard_delete';" >/dev/null
podman exec -i "$container_name" \
  psql -v ON_ERROR_STOP=1 -U postgres -d yistack \
  < "$PACKAGE_ROOT/database/migrations/rollback/202609190001_admin_user_hard_delete.sql" \
  >/dev/null
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
  start | stop | restart)
    for unit in "$@"; do
      [ "$unit" = "--quiet" ] && continue
      if [ "$command" = "start" ] || [ "$command" = "restart" ]; then
        grep -Fqx "$unit" "$state_file" || printf '%s\n' "$unit" >> "$state_file"
      else
        grep -Fvx "$unit" "$state_file" > "$state_file.tmp" || true
        mv "$state_file.tmp" "$state_file"
      fi
    done
    ;;
  enable | disable)
    now=false
    for unit in "$@"; do
      if [ "$unit" = "--quiet" ]; then
        continue
      fi
      if [ "$unit" = "--now" ]; then
        now=true
        continue
      fi
      if [ "$command" = "enable" ]; then
        grep -Fqx "$unit" "$enabled_file" || printf '%s\n' "$unit" >> "$enabled_file"
      else
        grep -Fvx "$unit" "$enabled_file" > "$enabled_file.tmp" || true
        mv "$enabled_file.tmp" "$enabled_file"
      fi
      if [ "$now" = "true" ]; then
        if [ "$command" = "enable" ]; then
          grep -Fqx "$unit" "$state_file" || printf '%s\n' "$unit" >> "$state_file"
        else
          grep -Fvx "$unit" "$state_file" > "$state_file.tmp" || true
          mv "$state_file.tmp" "$state_file"
        fi
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
[ "$PWD" = "${MOCK_EXPECTED_SERVICE_CWD:?}" ] || {
  echo "Service-user command inherited an unsafe working directory: $PWD" >&2
  exit 1
}
if [ "${MOCK_DENY_PACKAGE_HELPER:-false}" = "true" ]; then
  for argument in "$@"; do
    [ "$argument" != "$YISTACK_PACKAGE_ROOT/bin/yistack-database-backup" ] || {
      echo "Upgrade executed the backup helper through the Release package path." >&2
      exit 1
    }
  done
fi
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
cat > "$mock_root/installer" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ "${MOCK_INSTALLER_KILL_PARENT:-false}" = "true" ]; then
  : > "${MOCK_INSTALLER_READY_FILE:?}"
  guardian_pid="$PPID"
  upgrade_pid="$(ps -o ppid= -p "$guardian_pid" | tr -d '[:space:]')"
  [ -n "$upgrade_pid" ]
  kill -KILL "$upgrade_pid"
  while [ ! -e "${MOCK_INSTALLER_RELEASE_FILE:?}" ]; do
    sleep 0.01
  done
  exit 97
fi
version="$(tr -d '[:space:]' < "$YISTACK_PACKAGE_ROOT/VERSION")"
release_dir="$YISTACK_INSTALL_ROOT/releases/$version"
rm -rf "$release_dir"
mkdir -p "$release_dir/bin" "$release_dir/database" "$release_dir/systemd"
cp "$YISTACK_PACKAGE_ROOT/VERSION" "$release_dir/VERSION"
ln -s "$YISTACK_PACKAGE_ROOT/bin/yistack-server" "$release_dir/bin/yistack-server"
ln -s "$YISTACK_PACKAGE_ROOT/bin/yistack-ephemeral-maintenance" "$release_dir/bin/yistack-ephemeral-maintenance"
ln -s "$YISTACK_PACKAGE_ROOT/bin/yistack-service-user-exec" "$release_dir/bin/yistack-service-user-exec"
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
cat > "$mock_root/podman" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = "ps" ]; then
  for argument in "$@"; do
    case "$argument" in
      *label=yistack.project_id*)
        exit 0
        ;;
    esac
  done
fi
if [ "${1:-}" = "network" ] && [ "${2:-}" = "ls" ]; then
  for argument in "$@"; do
    case "$argument" in
      *label=yistack.project_id*)
        exit 0
        ;;
    esac
  done
fi
exec "${MOCK_REAL_PODMAN:?}" "$@"
EOF
chmod 0755 \
  "$mock_root/systemctl" \
  "$mock_root/runuser" \
  "$mock_root/old-yistackctl" \
  "$mock_root/new-yistackctl" \
  "$mock_root/installer" \
  "$mock_root/podman"

prepare_case() {
  local case_root="$1"
  local ephemeral_enabled="${2:-true}"
  local ephemeral_assignment="${3:-EPHEMERAL_MAINTENANCE_ENABLED=$ephemeral_enabled}"
  local unit unit_name old_release
  old_release="$case_root/install/releases/v1.0.0"
  mkdir -p \
    "$old_release/bin" \
    "$old_release/systemd" \
    "$case_root/install/releases/v0.9.0" \
    "$case_root/install/releases/v9.9.9" \
    "$case_root/install/releases/local-notes" \
    "$case_root/config" \
    "$case_root/data/database-backups" \
    "$case_root/data/ephemeral-baseline" \
    "$case_root/root-only" \
    "$case_root/systemd"
  chmod 0700 "$case_root/root-only"
  printf 'legacy-baseline\n' > "$case_root/data/ephemeral-baseline/legacy-marker"
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
  cat > "$case_root/config/ephemeral-maintenance.env" <<EOF
$ephemeral_assignment
EPHEMERAL_BASELINE_DIR=$case_root/data/ephemeral-baseline
EPHEMERAL_RESTART_AFTER_RESET=false
EPHEMERAL_HEALTH_TIMEOUT_SECONDS=10
EPHEMERAL_LOCK_FILE=$case_root/ephemeral.lock
SERVICE_USER=$(id -un)
EOF
  printf '%s\n' yistack.target > "$case_root/systemctl.state"
  : > "$case_root/systemctl.enabled"
  if [ "$ephemeral_enabled" = "true" ]; then
    printf '%s\n' yistack-ephemeral-reset.timer >> "$case_root/systemctl.state"
    printf '%s\n' yistack-ephemeral-reset.timer >> "$case_root/systemctl.enabled"
  fi
  : > "$case_root/systemctl.log"
}

run_upgrade() {
  local case_root="$1"
  (
    cd "$case_root/root-only"
    env \
    MOCK_DENY_PACKAGE_HELPER="${MOCK_DENY_PACKAGE_HELPER:-false}" \
    MOCK_EXPECTED_SERVICE_CWD="$case_root/data" \
    MOCK_INSTALLER_KILL_PARENT="${MOCK_INSTALLER_KILL_PARENT:-false}" \
    MOCK_INSTALLER_READY_FILE="${MOCK_INSTALLER_READY_FILE:-}" \
    MOCK_INSTALLER_RELEASE_FILE="${MOCK_INSTALLER_RELEASE_FILE:-}" \
    MOCK_NEW_HEALTH_FAIL="${MOCK_NEW_HEALTH_FAIL:-false}" \
    MOCK_NEW_YISTACKCTL="$mock_root/new-yistackctl" \
    MOCK_REAL_PODMAN="$real_podman" \
    MOCK_SYSTEMCTL_ENABLED="$case_root/systemctl.enabled" \
    MOCK_SYSTEMCTL_LOG="$case_root/systemctl.log" \
    MOCK_SYSTEMCTL_STATE="$case_root/systemctl.state" \
    PATH="$mock_root:$PATH" \
    YISTACK_CONFIG_DIR="$case_root/config" \
    YISTACK_DATA_DIR="$case_root/data" \
    YISTACK_DATABASE_BACKUP_DIR="$case_root/data/database-backups" \
    YISTACK_ENV_FILE="$case_root/config/yistack.env" \
    YISTACK_EPHEMERAL_LOCK_FILE="$case_root/ephemeral.lock" \
    YISTACK_INSTALLER_PATH="$mock_root/installer" \
    YISTACK_INSTALL_ROOT="$case_root/install" \
    YISTACK_PACKAGE_ROOT="$PACKAGE_ROOT" \
    YISTACK_POSTGRES_ENV_FILE="$postgres_env" \
    YISTACK_RUNUSER_BIN="$mock_root/runuser" \
    YISTACK_SERVICE_EXEC_SKIP_ROOT_CHECK=true \
    YISTACK_SERVICE_GROUP="$(id -gn)" \
    YISTACK_SERVICE_USER="$(id -un)" \
    YISTACK_SKIP_ROOT_CHECK=true \
    YISTACK_SYSTEMCTL_BIN="$mock_root/systemctl" \
    YISTACK_SYSTEMD_DIR="$case_root/systemd" \
    YISTACK_UPGRADE_HEALTH_ATTEMPTS=1 \
    YISTACK_UPGRADE_HEALTH_SLEEP_SECONDS=0 \
    YISTACK_UPGRADE_LOCK_FILE="$case_root/upgrade.lock" \
      "$PACKAGE_ROOT/upgrade.sh" --skip-browser-install
  )
}

database_contract() {
  podman exec "$container_name" \
    psql -At -v ON_ERROR_STOP=1 -U postgres -d yistack -c "$1"
}

run_package_database() {
  local case_root="$1"
  local command="$2"
  (
    set -a
    # shellcheck disable=SC1090
    source "$case_root/config/yistack.env"
    set +a
    YISTACK_SKIP_DOTENV=true \
    YISTACK_INSTALL_DIR="$PACKAGE_ROOT" \
    YISTACK_MIGRATIONS_DIR="$PACKAGE_ROOT/database/migrations" \
      "$PACKAGE_ROOT/bin/yistack-server" database "$command"
  )
}

rollback_package_database_to_version() {
  local case_root="$1"
  local expected_version="$2"
  local observed_version=""
  local previous_version=""

  observed_version="$(database_contract \
    'SELECT version FROM public.schema_migrations ORDER BY version DESC LIMIT 1;')"
  while [ "$observed_version" != "$expected_version" ]; do
    previous_version="$observed_version"
    run_package_database "$case_root" rollback >/dev/null
    observed_version="$(database_contract \
      'SELECT version FROM public.schema_migrations ORDER BY version DESC LIMIT 1;')"
    [ "$observed_version" != "$previous_version" ] || {
      echo "Database rollback did not advance from $observed_version." >&2
      exit 1
    }
  done
}

assert_service_state() {
  local case_root="$1"
  local expected_ephemeral_state="$2"
  grep -Fqx yistack.target "$case_root/systemctl.state"
  if [ "$expected_ephemeral_state" = "enabled" ]; then
    grep -Fqx yistack-ephemeral-reset.timer "$case_root/systemctl.state"
    grep -Fqx yistack-ephemeral-reset.timer "$case_root/systemctl.enabled"
    grep -Fqx yistack-ephemeral-cleanup.timer "$case_root/systemctl.state"
    grep -Fqx yistack-ephemeral-cleanup.timer "$case_root/systemctl.enabled"
  elif [ "$expected_ephemeral_state" = "restored" ]; then
    grep -Fqx yistack-ephemeral-reset.timer "$case_root/systemctl.state"
    grep -Fqx yistack-ephemeral-reset.timer "$case_root/systemctl.enabled"
    if grep -Fqx yistack-ephemeral-cleanup.timer "$case_root/systemctl.state" ||
      grep -Fqx yistack-ephemeral-cleanup.timer "$case_root/systemctl.enabled"; then
      echo "Upgrade recovery changed the disabled cleanup timer state." >&2
      exit 1
    fi
  elif grep -Fqx yistack-ephemeral-reset.timer "$case_root/systemctl.state"; then
    echo "Upgrade restarted the stale ephemeral reset timer." >&2
    exit 1
  elif grep -Fqx yistack-ephemeral-reset.timer "$case_root/systemctl.enabled"; then
    echo "Upgrade left the stale ephemeral reset timer enabled." >&2
    exit 1
  fi
  if [ "$expected_ephemeral_state" = "paused" ] &&
    grep -Fqx yistack-ephemeral-cleanup.timer "$case_root/systemctl.state"; then
    echo "Upgrade changed the inactive cleanup timer state." >&2
    exit 1
  fi
  if [ "$expected_ephemeral_state" = "paused" ] &&
    grep -Fqx yistack-ephemeral-cleanup.timer "$case_root/systemctl.enabled"; then
    echo "Upgrade changed the disabled cleanup timer state." >&2
    exit 1
  fi
  if grep -Fqx yistack.target "$case_root/systemctl.enabled"; then
    echo "Upgrade changed the disabled target enablement state in $expected_ephemeral_state path." >&2
    echo "Active units:" >&2
    sed 's/^/  /' "$case_root/systemctl.state" >&2
    echo "Enabled units:" >&2
    sed 's/^/  /' "$case_root/systemctl.enabled" >&2
    echo "systemctl calls:" >&2
    sed 's/^/  /' "$case_root/systemctl.log" >&2
    exit 1
  fi
}

assert_lifecycle_locks_released() {
  local case_root="$1"
  local lifecycle_lock
  for lifecycle_lock in "$case_root/upgrade.lock" "$case_root/ephemeral.lock"; do
    flock -n "$lifecycle_lock" true || {
      echo "Upgrade leaked lifecycle lock: $lifecycle_lock" >&2
      exit 1
    }
  done
}

lock_conflict_root="$root/maintenance-lock-conflict"
prepare_case "$lock_conflict_root"
(
  exec 7>"$lock_conflict_root/ephemeral.lock"
  flock -n 7
  : > "$lock_conflict_root/maintenance-lock-held"
  while [ ! -e "$lock_conflict_root/release-maintenance-lock" ]; do
    sleep 0.01
  done
) &
maintenance_lock_pid="$!"
while [ ! -e "$lock_conflict_root/maintenance-lock-held" ]; do
  sleep 0.01
done
set +e
run_upgrade "$lock_conflict_root" > "$lock_conflict_root/upgrade.out" 2>&1
lock_conflict_status="$?"
set -e
: > "$lock_conflict_root/release-maintenance-lock"
wait "$maintenance_lock_pid"
maintenance_lock_pid=""
[ "$lock_conflict_status" -ne 0 ] || {
  echo "Upgrade unexpectedly crossed an active ephemeral maintenance lock." >&2
  exit 1
}
grep -Fq 'ephemeral experience maintenance is running' "$lock_conflict_root/upgrade.out"
[ ! -s "$lock_conflict_root/systemctl.log" ] || {
  echo "Upgrade touched systemd before acquiring the ephemeral maintenance lock." >&2
  exit 1
}
[ -z "$(find "$lock_conflict_root/data/database-backups" -type f -print -quit)" ] || {
  echo "Upgrade created a database backup before acquiring the ephemeral maintenance lock." >&2
  exit 1
}

parent_kill_root="$root/parent-kill"
prepare_case "$parent_kill_root"
installer_ready_file="$parent_kill_root/installer-ready"
installer_release_file="$parent_kill_root/release-installer"
set +e
blocked_installer_release_file="$installer_release_file"
MOCK_DENY_PACKAGE_HELPER=true \
MOCK_INSTALLER_KILL_PARENT=true \
MOCK_INSTALLER_READY_FILE="$installer_ready_file" \
MOCK_INSTALLER_RELEASE_FILE="$installer_release_file" \
  run_upgrade "$parent_kill_root" > "$parent_kill_root/upgrade.out" 2>&1 &
killed_upgrade_pid="$!"
set -e
for _ in $(seq 1 3000); do
  [ ! -e "$installer_ready_file" ] || break
  sleep 0.01
done
[ -e "$installer_ready_file" ] || {
  echo "Upgrade did not reach the blocking installer." >&2
  exit 1
}
set +e
wait "$killed_upgrade_pid"
killed_upgrade_status="$?"
set -e
[ "$killed_upgrade_status" -ne 0 ] || {
  echo "Upgrade parent unexpectedly survived the termination test." >&2
  exit 1
}
for lifecycle_lock in "$parent_kill_root/upgrade.lock" "$parent_kill_root/ephemeral.lock"; do
  if flock -n "$lifecycle_lock" true; then
    echo "Terminated upgrade released a lifecycle lock while its child was active: $lifecycle_lock" >&2
    exit 1
  fi
done
: > "$installer_release_file"
locks_released=false
for _ in $(seq 1 3000); do
  if flock -n "$parent_kill_root/upgrade.lock" true &&
    flock -n "$parent_kill_root/ephemeral.lock" true; then
    locks_released=true
    break
  fi
  sleep 0.01
done
[ "$locks_released" = "true" ] || {
  echo "Lifecycle locks remained held after the interrupted child exited." >&2
  exit 1
}

blocked_installer_release_file=""
success_root="$root/success"
prepare_case "$success_root" true \
  'export EPHEMERAL_MAINTENANCE_ENABLED="true" # preserve across upgrade'
podman stop --time 20 "$container_name" >/dev/null
if ! MOCK_DENY_PACKAGE_HELPER=true \
  run_upgrade "$success_root" > "$success_root/upgrade.out" 2>&1; then
  echo "Successful upgrade acceptance failed:" >&2
  cat "$success_root/upgrade.out" >&2
  exit 1
fi
assert_lifecycle_locks_released "$success_root"
grep -Fq 'Managed PostgreSQL is not running; starting it before the upgrade' \
  "$success_root/upgrade.out"
[ "$(tr -d '[:space:]' < "$success_root/install/current/VERSION")" = "$target_version" ]
[ ! -e "$success_root/install/releases/v1.0.0" ]
[ ! -e "$success_root/install/releases/v0.9.0" ]
[ -d "$success_root/install/releases/v9.9.9" ]
[ -d "$success_root/install/releases/local-notes" ]
grep -Fqx 'INSTALL_MARKER=new' "$success_root/config/yistack.env"
assert_service_state "$success_root" enabled
grep -Fqx 'EPHEMERAL_MAINTENANCE_ENABLED=true' "$success_root/config/ephemeral-maintenance.env"
grep -Fq 'Ephemeral experience mode: enabled with a new Release baseline' "$success_root/upgrade.out"
[ ! -e "$success_root/data/ephemeral-baseline/legacy-marker" ]
grep -Fqx 'schema=ephemeral-experience-baseline.v2' \
  "$success_root/data/ephemeral-baseline/METADATA"
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
[ "$success_contract" = "4:1:1:1.1.10" ] || {
  echo "Unexpected successful upgrade database contract: $success_contract" >&2
  exit 1
}
success_dumps=("$success_root/data/database-backups/"*.dump)
[ "${#success_dumps[@]}" -eq 1 ] && [ -s "${success_dumps[0]}" ]
[ -s "${success_dumps[0]}.sha256" ]
[ -s "${success_dumps[0]%.dump}.yistack.env" ]
[ -s "${success_dumps[0]%.dump}.systemd/units.state" ]
[ -z "$(find "$success_root/data/database-backups" \
  -maxdepth 1 -name '*.ephemeral-baseline' -print -quit)" ]
[ -z "$(find "$success_root/data/database-backups" \
  -maxdepth 1 -name '.yistack-database-backup.upgrade.*' -print -quit)" ]

YISTACK_ENV_FILE="$success_root/config/yistack.env" \
YISTACK_POSTGRES_ENV_FILE="$postgres_env" \
YISTACK_EPHEMERAL_ENV_FILE="$success_root/config/ephemeral-maintenance.env" \
YISTACK_INSTALL_DIR="$success_root/install/current" \
YISTACK_DATA_DIR="$success_root/data" \
YISTACK_LOG_DIR="$success_root/log" \
YISTACK_CACHE_DIR="$success_root/cache" \
YISTACK_SYSTEMD_UNIT_DIR="$success_root/systemd" \
SERVICE_USER="$(id -un)" \
SYSTEMCTL_BIN="$mock_root/systemctl" \
MOCK_SYSTEMCTL_ENABLED="$success_root/systemctl.enabled" \
MOCK_SYSTEMCTL_LOG="$success_root/systemctl.log" \
MOCK_SYSTEMCTL_STATE="$success_root/systemctl.state" \
MOCK_REAL_PODMAN="$real_podman" \
PATH="$mock_root:$PATH" \
  "$PACKAGE_ROOT/bin/yistack-ephemeral-maintenance" reset >/dev/null
[ "$(database_contract "SELECT count(*) FROM public.users;")" = "0" ] || {
  echo "The upgraded ephemeral baseline retained regular users." >&2
  exit 1
}

success_backup_name="$(basename "${success_dumps[0]}" .dump)"
rollback_package_database_to_version \
  "$success_root" \
  000000000000_contributor_alpha
YISTACK_ENV_FILE="$success_root/config/yistack.env" \
YISTACK_POSTGRES_ENV_FILE="$postgres_env" \
YISTACK_DATABASE_BACKUP_DIR="$success_root/data/database-backups" \
  "$PACKAGE_ROOT/bin/yistack-database-backup" restore "$success_backup_name" \
  >/dev/null

normal_root="$root/normal-mode"
prepare_case "$normal_root" false
if ! MOCK_DENY_PACKAGE_HELPER=true \
  run_upgrade "$normal_root" > "$normal_root/upgrade.out" 2>&1; then
  echo "Normal-mode upgrade acceptance failed:" >&2
  cat "$normal_root/upgrade.out" >&2
  exit 1
fi
[ "$(tr -d '[:space:]' < "$normal_root/install/current/VERSION")" = "$target_version" ]
assert_service_state "$normal_root" paused
grep -Fqx 'EPHEMERAL_MAINTENANCE_ENABLED=false' \
  "$normal_root/config/ephemeral-maintenance.env"
[ -f "$normal_root/data/ephemeral-baseline/legacy-marker" ]
if grep -Fq 'Ephemeral experience mode: enabled' "$normal_root/upgrade.out"; then
  echo "Normal-mode upgrade unexpectedly enabled Ephemeral Experience Mode." >&2
  exit 1
fi
normal_dumps=("$normal_root/data/database-backups/"*.dump)
[ "${#normal_dumps[@]}" -eq 1 ] && [ -s "${normal_dumps[0]}" ]
normal_backup_name="$(basename "${normal_dumps[0]}" .dump)"
rollback_package_database_to_version \
  "$normal_root" \
  000000000000_contributor_alpha
YISTACK_ENV_FILE="$normal_root/config/yistack.env" \
YISTACK_POSTGRES_ENV_FILE="$postgres_env" \
YISTACK_DATABASE_BACKUP_DIR="$normal_root/data/database-backups" \
  "$PACKAGE_ROOT/bin/yistack-database-backup" restore "$normal_backup_name" \
  >/dev/null

failure_root="$root/failure"
prepare_case "$failure_root"
cp "$failure_root/config/yistack.env" "$failure_root/original-yistack.env"
cp "$failure_root/config/ephemeral-maintenance.env" "$failure_root/original-ephemeral-maintenance.env"
set +e
MOCK_DENY_PACKAGE_HELPER=true MOCK_NEW_HEALTH_FAIL=true run_upgrade "$failure_root" \
  > "$failure_root/upgrade.out" 2>&1
failure_status="$?"
set -e
[ "$failure_status" -ne 0 ] || {
  echo "Upgrade unexpectedly succeeded after the new health check failed." >&2
  exit 1
}
assert_lifecycle_locks_released "$failure_root"
[ "$(tr -d '[:space:]' < "$failure_root/install/current/VERSION")" = v1.0.0 ]
[ -d "$failure_root/install/releases/v1.0.0" ]
[ -d "$failure_root/install/releases/v0.9.0" ]
cmp "$failure_root/original-yistack.env" "$failure_root/config/yistack.env"
cmp "$failure_root/original-ephemeral-maintenance.env" "$failure_root/config/ephemeral-maintenance.env"
assert_service_state "$failure_root" restored
grep -Eq '^[[:space:]]*EPHEMERAL_MAINTENANCE_ENABLED=true$' \
  "$failure_root/config/ephemeral-maintenance.env"
[ -f "$failure_root/data/ephemeral-baseline/legacy-marker" ]
grep -Fq 'stop yistack-postgres.service' "$failure_root/systemctl.log"
grep -Fq 'start yistack-postgres.service' "$failure_root/systemctl.log"
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
grep -Fq 'Rolling database migrations back to 000000000000_contributor_alpha' \
  "$failure_root/upgrade.out"
grep -Fq 'Previous Release v1.0.0 restored.' "$failure_root/upgrade.out"
[ -z "$(find "$failure_root/data/database-backups" \
  -maxdepth 1 -name '.yistack-database-backup.upgrade.*' -print -quit)" ]

backup_failure_root="$root/ephemeral-backup-failure"
prepare_case "$backup_failure_root"
cp "$backup_failure_root/config/ephemeral-maintenance.env" \
  "$backup_failure_root/original-ephemeral-maintenance.env"
chmod 000 "$backup_failure_root/config/ephemeral-maintenance.env"
set +e
MOCK_DENY_PACKAGE_HELPER=true run_upgrade "$backup_failure_root" \
  > "$backup_failure_root/upgrade.out" 2>&1
backup_failure_status="$?"
set -e
chmod 0640 "$backup_failure_root/config/ephemeral-maintenance.env"
[ "$backup_failure_status" -ne 0 ] || {
  echo "Upgrade unexpectedly succeeded when the ephemeral configuration backup failed." >&2
  exit 1
}
assert_lifecycle_locks_released "$backup_failure_root"
cmp "$backup_failure_root/original-ephemeral-maintenance.env" \
  "$backup_failure_root/config/ephemeral-maintenance.env"
assert_service_state "$backup_failure_root" restored
grep -Fq 'Previous Release v1.0.0 restored.' "$backup_failure_root/upgrade.out"

dispatch_root="$root/dispatch/yistack-v9.9.9-linux-amd64"
mkdir -p "$dispatch_root"
cat > "$dispatch_root/upgrade.sh" <<'EOF'
#!/usr/bin/env bash
if [ "${YISTACK_ASSERT_ARCHIVE_PARENT_MODE:-false}" = "true" ]; then
  archive_parent="$(dirname "$(dirname "$(realpath "$0")")")"
  [ "$(stat -c '%a' "$archive_parent")" = "711" ] || {
    echo "Archive extraction parent is not traversable by the service user." >&2
    exit 1
  }
fi
printf '%s\n' "$*" > "${YISTACK_UPGRADE_DISPATCH_OUTPUT:?}"
[ "${1:-}" != "--fail" ] || exit 23
EOF
chmod 0755 "$dispatch_root/upgrade.sh"
YISTACK_UPGRADE_DISPATCH_OUTPUT="$root/directory-dispatch.out" \
  "$PACKAGE_ROOT/bin/yistackctl" upgrade "$dispatch_root" --skip-browser-install
grep -Fqx -- '--skip-browser-install' "$root/directory-dispatch.out"
tar -czf "$root/yistack-v9.9.9-linux-amd64.tar.gz" \
  -C "$root/dispatch" yistack-v9.9.9-linux-amd64
[ ! -e "$root/yistack-v9.9.9-linux-amd64.tar.gz.sha256" ]
YISTACK_ASSERT_ARCHIVE_PARENT_MODE=true \
  YISTACK_UPGRADE_DISPATCH_OUTPUT="$root/archive-dispatch.out" \
  "$PACKAGE_ROOT/bin/yistackctl" upgrade \
    "$root/yistack-v9.9.9-linux-amd64.tar.gz" --skip-browser-install
grep -Fqx -- '--skip-browser-install' "$root/archive-dispatch.out"

mkdir -p "$root/unsafe/wrong-root" "$root/archive-tmp"
cp "$dispatch_root/upgrade.sh" "$root/unsafe/wrong-root/upgrade.sh"
tar -czf "$root/yistack-v9.9.8-linux-amd64.tar.gz" \
  -C "$root/unsafe" wrong-root
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
