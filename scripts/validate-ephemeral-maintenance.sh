#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAINTENANCE_SCRIPT="${1:-$ROOT_DIR/deploy/bin/yistack-ephemeral-maintenance}"
TEMP_ROOT="$(mktemp -d)"
REAL_FLOCK_BIN="$(command -v flock)"
STALE_COMMAND_PID=""
BLOCKED_PODMAN_RELEASE_FILE=""

cleanup() {
  if [ -n "$STALE_COMMAND_PID" ]; then
    kill "$STALE_COMMAND_PID" >/dev/null 2>&1 || true
    wait "$STALE_COMMAND_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$BLOCKED_PODMAN_RELEASE_FILE" ]; then
    : > "$BLOCKED_PODMAN_RELEASE_FILE" 2>/dev/null || true
  fi
  rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT

fail() {
  echo "Ephemeral experience mode validation failed: $*" >&2
  exit 1
}

set +e
bash -c '
  export YISTACK_ENV_FILE="$2/missing-yistack.env"
  export YISTACK_EPHEMERAL_ENV_FILE="$2/missing-ephemeral.env"
  source "$1"
  exec 7>"$2/wrapper.lock"
  flock -n 7
  EPHEMERAL_LOCK_FD=7
  run_as_service sh -c "exit 29"
' _ "$MAINTENANCE_SCRIPT" "$TEMP_ROOT"
wrapper_status="$?"
set -e
[ "$wrapper_status" -eq 29 ] ||
  fail "service command wrapper changed exit status 29 to $wrapper_status"

[ -x "$MAINTENANCE_SCRIPT" ] || fail "script is missing or not executable"
bash -n "$MAINTENANCE_SCRIPT"

mkdir -p \
  "$TEMP_ROOT/bin" \
  "$TEMP_ROOT/config" \
  "$TEMP_ROOT/data/runtime/projects/project-keep" \
  "$TEMP_ROOT/data/runtime/templates/template-keep" \
  "$TEMP_ROOT/data/runtime/container-data" \
  "$TEMP_ROOT/data/runtime/backups/project-keep" \
  "$TEMP_ROOT/data/runtime/generation-evidence/expired" \
  "$TEMP_ROOT/data/ms-playwright/browser-keep" \
  "$TEMP_ROOT/cache/expired" \
  "$TEMP_ROOT/log/expired" \
  "$TEMP_ROOT/install/config" \
  "$TEMP_ROOT/systemd"

cat > "$TEMP_ROOT/bin/systemctl" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$SYSTEMCTL_LOG"
command="${1:-}"
shift || true
case "$command" in
  is-active)
    unit="${!#}"
    grep -Fqx "$unit" "$SYSTEMCTL_STATE"
    ;;
  is-enabled)
    unit="${!#}"
    grep -Fqx "$unit" "$SYSTEMCTL_ENABLED"
    ;;
  enable)
    now=false
    for unit in "$@"; do
      if [ "$unit" = "--now" ]; then
        now=true
        continue
      fi
      grep -Fqx "$unit" "$SYSTEMCTL_ENABLED" ||
        printf '%s\n' "$unit" >> "$SYSTEMCTL_ENABLED"
      if [ "$now" = "true" ]; then
        grep -Fqx "$unit" "$SYSTEMCTL_STATE" ||
          printf '%s\n' "$unit" >> "$SYSTEMCTL_STATE"
      fi
    done
    ;;
  disable)
    if [ "${MOCK_SYSTEMCTL_FAIL_TIMER_DISABLE:-false}" = "true" ]; then
      exit 1
    fi
    for unit in "$@"; do
      [ "$unit" = "--now" ] && continue
      grep -Fvx "$unit" "$SYSTEMCTL_ENABLED" > "$SYSTEMCTL_ENABLED.tmp" || true
      mv "$SYSTEMCTL_ENABLED.tmp" "$SYSTEMCTL_ENABLED"
      grep -Fvx "$unit" "$SYSTEMCTL_STATE" > "$SYSTEMCTL_STATE.tmp" || true
      mv "$SYSTEMCTL_STATE.tmp" "$SYSTEMCTL_STATE"
    done
    ;;
  restart | start)
    if [ "$command" = "restart" ] && [ "${MOCK_SYSTEMCTL_FAIL_TIMER_RESTART:-false}" = "true" ]; then
      exit 1
    fi
    for unit in "$@"; do
      grep -Fqx "$unit" "$SYSTEMCTL_STATE" ||
        printf '%s\n' "$unit" >> "$SYSTEMCTL_STATE"
    done
    ;;
  stop)
    if [ "${MOCK_SYSTEMCTL_FAIL_MAINTENANCE_STOP:-false}" = "true" ]; then
      exit 1
    fi
    for unit in "$@"; do
      grep -Fvx "$unit" "$SYSTEMCTL_STATE" > "$SYSTEMCTL_STATE.tmp" || true
      mv "$SYSTEMCTL_STATE.tmp" "$SYSTEMCTL_STATE"
    done
    ;;
  daemon-reload)
    [ "${MOCK_SYSTEMCTL_FAIL_DAEMON_RELOAD:-false}" != "true" ]
    ;;
esac
EOF

cat > "$TEMP_ROOT/bin/flock" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ -n "${MOCK_FLOCK_READY_FILE:-}" ]; then
  : > "$MOCK_FLOCK_READY_FILE"
  while [ ! -e "${MOCK_FLOCK_RELEASE_FILE:?}" ]; do
    sleep 0.01
  done
fi
exec "${REAL_FLOCK_BIN:?}" "$@"
EOF

cat > "$TEMP_ROOT/bin/systemd-analyze" <<'EOF'
#!/usr/bin/env bash
case "${1:-}" in
  calendar | timespan)
    [ -n "${2:-}" ] && [ "${2:-}" != "invalid-calendar" ]
    ;;
  *)
    exit 1
    ;;
esac
EOF

cat > "$TEMP_ROOT/bin/df" <<'EOF'
#!/usr/bin/env bash
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n'
printf 'mock 100 26 74 %s%% /tmp\n' "${MOCK_DISK_USAGE_PERCENT:-26}"
EOF

cat > "$TEMP_ROOT/bin/podman" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ "${MOCK_PODMAN_KILL_PARENT:-false}" = "true" ] &&
  [ ! -e "${MOCK_PODMAN_READY_FILE:?}" ] &&
  [[ " $* " = *" pg_dump "* ]]; then
  printf '%s\n' "$$" > "${MOCK_PODMAN_PID_FILE:?}"
  : > "$MOCK_PODMAN_READY_FILE"
  guardian_pid="$PPID"
  maintenance_pid="$(ps -o ppid= -p "$guardian_pid" | tr -d '[:space:]')"
  [ -n "$maintenance_pid" ]
  kill -KILL "$maintenance_pid"
  while [ ! -e "${MOCK_PODMAN_RELEASE_FILE:?}" ]; do
    sleep 0.01
  done
  exit 97
fi
printf '%s\n' "$*" >> "$PODMAN_LOG"
if [ "${1:-}" = "inspect" ]; then
  echo true
fi
if [ "${1:-}" = "exec" ]; then
  if [ "${MOCK_PG_DUMP_FAIL:-false}" = "true" ] && [[ " $* " = *" pg_dump "* ]]; then
    exit 1
  fi
  case " $* " in
    *"user_data_rows("*)
      [ -n "${MOCK_USER_DATA_ROWS:-}" ] && printf '%s\n' "$MOCK_USER_DATA_ROWS"
      ;;
    *"schema_migrations WHERE version"*)
      printf '1\n'
      ;;
  esac
fi
exit 0
EOF
chmod 0755 \
  "$TEMP_ROOT/bin/df" \
  "$TEMP_ROOT/bin/flock" \
  "$TEMP_ROOT/bin/systemctl" \
  "$TEMP_ROOT/bin/systemd-analyze" \
  "$TEMP_ROOT/bin/podman"
: > "$TEMP_ROOT/systemctl.state"
: > "$TEMP_ROOT/systemctl.enabled"
: > "$TEMP_ROOT/podman.log"

printf 'keep\n' > "$TEMP_ROOT/data/runtime/projects/project-keep/app.txt"
printf 'keep\n' > "$TEMP_ROOT/data/runtime/templates/template-keep/template.txt"
printf 'keep\n' > "$TEMP_ROOT/data/ms-playwright/browser-keep/browser.txt"
printf 'delete\n' > "$TEMP_ROOT/data/runtime/backups/project-keep/backup.tar.gz"
printf 'keep\n' > "$TEMP_ROOT/config/yistack-secret"
printf 'keep\n' > "$TEMP_ROOT/install/release-binary"
printf '0000000000000000000000000000000000000000\n' > "$TEMP_ROOT/install/SOURCE_COMMIT"
printf 'delete\n' > "$TEMP_ROOT/data/runtime/generation-evidence/expired/evidence.txt"
printf 'delete\n' > "$TEMP_ROOT/cache/expired/cache.txt"
printf 'delete\n' > "$TEMP_ROOT/log/expired/log.txt"
touch -d '3 hours ago' \
  "$TEMP_ROOT/data/runtime/generation-evidence/expired/evidence.txt" \
  "$TEMP_ROOT/cache/expired/cache.txt" \
  "$TEMP_ROOT/log/expired/log.txt"

cat > "$TEMP_ROOT/config/yistack.env" <<EOF
DB_TYPE=postgres
YISTACK_INSTALL_DIR=$TEMP_ROOT/install
YISTACK_DATA_DIR=$TEMP_ROOT/data
YISTACK_LOG_DIR=$TEMP_ROOT/log
YISTACK_CACHE_DIR=$TEMP_ROOT/cache
CONTAINER_PROJECT_DIR=$TEMP_ROOT/data/runtime/projects
CONTAINER_DATA_DIR=$TEMP_ROOT/data/runtime/container-data
PROJECT_BACKUP_DIR=$TEMP_ROOT/data/runtime/backups
YISTACK_BROWSER_EVIDENCE_DIR=$TEMP_ROOT/data/runtime/generation-evidence
YISTACK_SYSTEMD_UNIT_DIR=$TEMP_ROOT/systemd
EOF

cat > "$TEMP_ROOT/config/postgres.env" <<'EOF'
POSTGRES_CONTAINER_NAME=yistack-postgres
POSTGRES_USER=postgres
POSTGRES_DB=yistack
EOF

cat > "$TEMP_ROOT/config/ephemeral.env" <<EOF
EPHEMERAL_MAINTENANCE_ENABLED=true
EPHEMERAL_BASELINE_DIR=$TEMP_ROOT/data/ephemeral-baseline
EPHEMERAL_PROJECT_TTL_HOURS=0
EPHEMERAL_STOPPED_CONTAINER_TTL_MINUTES=0
EPHEMERAL_EVIDENCE_TTL_HOURS=1
EPHEMERAL_CACHE_TTL_HOURS=1
EPHEMERAL_LOG_TTL_DAYS=0
EPHEMERAL_DISK_HIGH_WATERMARK_PERCENT=99
EPHEMERAL_DISK_LOW_WATERMARK_PERCENT=98
EPHEMERAL_RESTART_AFTER_RESET=false
EPHEMERAL_HEALTH_TIMEOUT_SECONDS=10
EPHEMERAL_LOCK_FILE=$TEMP_ROOT/ephemeral.lock
EPHEMERAL_RESET_ON_CALENDAR="Mon..Fri *-*-* 03:15:00"
EPHEMERAL_RESET_RANDOMIZED_DELAY_SEC=2min
EPHEMERAL_CLEANUP_ON_CALENDAR="*-*-* *:45:00"
EPHEMERAL_CLEANUP_RANDOMIZED_DELAY_SEC=30s
SERVICE_USER=$(id -un)
EOF

run_maintenance() {
  PATH="$TEMP_ROOT/bin:$PATH" \
    SYSTEMCTL_LOG="$TEMP_ROOT/systemctl.log" \
    SYSTEMCTL_ENABLED="$TEMP_ROOT/systemctl.enabled" \
    SYSTEMCTL_STATE="$TEMP_ROOT/systemctl.state" \
    MOCK_DISK_USAGE_PERCENT="${MOCK_DISK_USAGE_PERCENT:-26}" \
    MOCK_SYSTEMCTL_FAIL_DAEMON_RELOAD="${MOCK_SYSTEMCTL_FAIL_DAEMON_RELOAD:-false}" \
    MOCK_SYSTEMCTL_FAIL_MAINTENANCE_STOP="${MOCK_SYSTEMCTL_FAIL_MAINTENANCE_STOP:-false}" \
    MOCK_USER_DATA_ROWS="${MOCK_USER_DATA_ROWS:-}" \
    PODMAN_LOG="$TEMP_ROOT/podman.log" \
    REAL_FLOCK_BIN="$REAL_FLOCK_BIN" \
    MOCK_FLOCK_READY_FILE="${MOCK_FLOCK_READY_FILE:-}" \
    MOCK_FLOCK_RELEASE_FILE="${MOCK_FLOCK_RELEASE_FILE:-}" \
    MOCK_PODMAN_KILL_PARENT="${MOCK_PODMAN_KILL_PARENT:-false}" \
    MOCK_PODMAN_PID_FILE="${MOCK_PODMAN_PID_FILE:-}" \
    MOCK_PODMAN_READY_FILE="${MOCK_PODMAN_READY_FILE:-}" \
    MOCK_PODMAN_RELEASE_FILE="${MOCK_PODMAN_RELEASE_FILE:-}" \
    EPHEMERAL_LOCK_FILE="$TEMP_ROOT/ephemeral.lock" \
    YISTACK_EPHEMERAL_LOCK_FD="${YISTACK_EPHEMERAL_LOCK_FD:-}" \
    SERVICE_USER="$(id -un)" \
    SYSTEMCTL_BIN="$TEMP_ROOT/bin/systemctl" \
    YISTACK_ENV_FILE="$TEMP_ROOT/config/yistack.env" \
    YISTACK_POSTGRES_ENV_FILE="$TEMP_ROOT/config/postgres.env" \
    YISTACK_EPHEMERAL_ENV_FILE="$TEMP_ROOT/config/ephemeral.env" \
    "$MAINTENANCE_SCRIPT" "$@"
}

run_maintenance status > "$TEMP_ROOT/status.out"
grep -q '^enabled=true$' "$TEMP_ROOT/status.out" || fail "status did not report enabled mode"
grep -q '^reset_timer=inactive$' "$TEMP_ROOT/status.out" || fail "status did not report the reset timer state"
grep -q '^cleanup_timer=inactive$' "$TEMP_ROOT/status.out" || fail "status did not report the cleanup timer state"
grep -q '^reset_timer_enabled=false$' "$TEMP_ROOT/status.out" ||
  fail "status did not report the reset timer enablement"
grep -q '^cleanup_timer_enabled=false$' "$TEMP_ROOT/status.out" ||
  fail "status did not report the cleanup timer enablement"
grep -q '^configured_reset_on_calendar=Mon..Fri \*-\*-\* 03:15:00$' "$TEMP_ROOT/status.out" ||
  fail "status did not report the configured daily reset schedule"
: > "$TEMP_ROOT/systemctl.log"
run_maintenance enforce
[ -e "$TEMP_ROOT/data/runtime/generation-evidence/expired/evidence.txt" ] ||
  fail "hourly disk check removed evidence below the high watermark"
[ -e "$TEMP_ROOT/cache/expired/cache.txt" ] ||
  fail "hourly disk check removed cache below the high watermark"
if grep -Fq 'start yistack-postgres.service' "$TEMP_ROOT/systemctl.log"; then
  fail "hourly disk check started PostgreSQL below the high watermark"
fi
run_maintenance cleanup

for stale_command in apply-schedule reset cleanup enforce; do
  stale_ready="$TEMP_ROOT/${stale_command}.lock-ready"
  stale_release="$TEMP_ROOT/${stale_command}.lock-release"
  MOCK_FLOCK_READY_FILE="$stale_ready" \
  MOCK_FLOCK_RELEASE_FILE="$stale_release" \
    run_maintenance "$stale_command" > "$TEMP_ROOT/${stale_command}.stale.out" 2>&1 &
  STALE_COMMAND_PID="$!"
  for _ in $(seq 1 500); do
    [ -e "$stale_ready" ] && break
    sleep 0.01
  done
  [ -e "$stale_ready" ] || fail "$stale_command did not reach the maintenance lock"

  run_maintenance disable
  : > "$stale_release"
  set +e
  wait "$STALE_COMMAND_PID"
  stale_status="$?"
  set -e
  STALE_COMMAND_PID=""
  [ "$stale_status" -ne 0 ] ||
    fail "$stale_command used a stale enabled state after disable completed"
  grep -q 'Ephemeral experience mode is disabled' "$TEMP_ROOT/${stale_command}.stale.out" ||
    fail "$stale_command did not reload the disabled state after acquiring the lock"
  sed -i 's/^EPHEMERAL_MAINTENANCE_ENABLED=false$/EPHEMERAL_MAINTENANCE_ENABLED=true/' \
    "$TEMP_ROOT/config/ephemeral.env"
done

[ ! -e "$TEMP_ROOT/data/runtime/generation-evidence/expired/evidence.txt" ] || fail "expired evidence was retained"
[ ! -e "$TEMP_ROOT/cache/expired/cache.txt" ] || fail "expired cache was retained"
[ -e "$TEMP_ROOT/log/expired/log.txt" ] || fail "disabled log cleanup removed a file"
[ -e "$TEMP_ROOT/data/runtime/projects/project-keep/app.txt" ] || fail "project workspace was modified"
[ -e "$TEMP_ROOT/data/runtime/templates/template-keep/template.txt" ] || fail "runtime template was modified"
[ -e "$TEMP_ROOT/data/ms-playwright/browser-keep/browser.txt" ] || fail "Playwright runtime was modified"
[ -e "$TEMP_ROOT/config/yistack-secret" ] || fail "configuration was modified"
[ -e "$TEMP_ROOT/install/release-binary" ] || fail "release installation was modified"

sed -i 's/^EPHEMERAL_MAINTENANCE_ENABLED=true$/EPHEMERAL_MAINTENANCE_ENABLED=false/' "$TEMP_ROOT/config/ephemeral.env"
if run_maintenance cleanup > "$TEMP_ROOT/disabled.out" 2>&1; then
  fail "cleanup ran without explicit enablement"
fi
grep -q 'Ephemeral experience mode is disabled' "$TEMP_ROOT/disabled.out" || fail "disabled mode did not fail closed"

sed -i 's/^EPHEMERAL_MAINTENANCE_ENABLED=false$/EPHEMERAL_MAINTENANCE_ENABLED=true/' "$TEMP_ROOT/config/ephemeral.env"
sed -i 's/^DB_TYPE=postgres$/DB_TYPE=supabase/' "$TEMP_ROOT/config/yistack.env"
if run_maintenance cleanup > "$TEMP_ROOT/supabase.out" 2>&1; then
  fail "cleanup accepted external Supabase"
fi
grep -q 'external Supabase is refused' "$TEMP_ROOT/supabase.out" || fail "Supabase mode did not fail closed"

sed -i 's/^DB_TYPE=supabase$/DB_TYPE=postgres/' "$TEMP_ROOT/config/yistack.env"
sed -i "s|^CONTAINER_PROJECT_DIR=.*|CONTAINER_PROJECT_DIR=$TEMP_ROOT/outside-projects|" "$TEMP_ROOT/config/yistack.env"
if run_maintenance status > "$TEMP_ROOT/path.out" 2>&1; then
  fail "status accepted an unmanaged project path"
fi
grep -q 'CONTAINER_PROJECT_DIR must be' "$TEMP_ROOT/path.out" || fail "unsafe path did not fail closed"

sed -i "s|^CONTAINER_PROJECT_DIR=.*|CONTAINER_PROJECT_DIR=$TEMP_ROOT/data/runtime/projects|" "$TEMP_ROOT/config/yistack.env"
sed -i "s|^YISTACK_CACHE_DIR=.*|YISTACK_CACHE_DIR=$TEMP_ROOT/data/runtime/templates|" "$TEMP_ROOT/config/yistack.env"
if run_maintenance status > "$TEMP_ROOT/overlap.out" 2>&1; then
  fail "status accepted a cache directory overlapping protected data"
fi
grep -q 'must not overlap' "$TEMP_ROOT/overlap.out" || fail "overlapping paths did not fail closed"

sed -i "s|^YISTACK_CACHE_DIR=.*|YISTACK_CACHE_DIR=$TEMP_ROOT/cache|" "$TEMP_ROOT/config/yistack.env"
run_maintenance apply-schedule
reset_override="$TEMP_ROOT/systemd/yistack-ephemeral-reset.timer.d/10-schedule.conf"
cleanup_override="$TEMP_ROOT/systemd/yistack-ephemeral-cleanup.timer.d/10-schedule.conf"
grep -Fqx 'OnCalendar=Mon..Fri *-*-* 03:15:00' "$reset_override" ||
  fail "reset timer override did not preserve the configured calendar"
grep -Fqx 'RandomizedDelaySec=2min' "$reset_override" ||
  fail "reset timer override did not preserve the configured randomized delay"
grep -Fqx 'OnCalendar=*-*-* *:45:00' "$cleanup_override" ||
  fail "cleanup timer override did not preserve the configured calendar"
grep -Fqx 'RandomizedDelaySec=30s' "$cleanup_override" ||
  fail "cleanup timer override did not preserve the configured randomized delay"
grep -Fqx 'daemon-reload' "$TEMP_ROOT/systemctl.log" ||
  fail "schedule application did not reload systemd"
grep -Fqx 'enable --now yistack-ephemeral-reset.timer yistack-ephemeral-cleanup.timer' "$TEMP_ROOT/systemctl.log" ||
  fail "schedule application did not enable both timers"

sed -i 's|^EPHEMERAL_RESET_ON_CALENDAR=.*|EPHEMERAL_RESET_ON_CALENDAR=invalid-calendar|' "$TEMP_ROOT/config/ephemeral.env"
if run_maintenance apply-schedule > "$TEMP_ROOT/invalid-schedule.out" 2>&1; then
  fail "schedule application accepted an invalid calendar"
fi
grep -q 'EPHEMERAL_RESET_ON_CALENDAR is not a valid systemd calendar value' "$TEMP_ROOT/invalid-schedule.out" ||
  fail "invalid calendar rejection did not identify the configured setting"
sed -i 's|^EPHEMERAL_RESET_ON_CALENDAR=.*|EPHEMERAL_RESET_ON_CALENDAR="Mon..Fri *-*-* 03:15:00"|' "$TEMP_ROOT/config/ephemeral.env"

MOCK_USER_DATA_ROWS='users:1' run_maintenance snapshot
[ -e "$TEMP_ROOT/data/runtime/projects/project-keep/app.txt" ] ||
  fail "snapshot modified an existing project workspace"
[ -z "$(tar -tzf "$TEMP_ROOT/data/ephemeral-baseline/workspace.tar.gz")" ] ||
  fail "snapshot included project workspace data in the clean baseline"
grep -q -- '--exclude-table-data=public.users' "$TEMP_ROOT/podman.log" ||
  fail "snapshot did not exclude regular users from the database dump"
grep -q -- '--exclude-table-data=public.projects' "$TEMP_ROOT/podman.log" ||
  fail "snapshot did not exclude projects from the database dump"
grep -q -- '--exclude-table-data=public.project_resource_alert_action_claims' "$TEMP_ROOT/podman.log" ||
  fail "snapshot did not exclude resource alert action claims from the database dump"
grep -q -- '--exclude-table-data=public.project_collaboration_events' "$TEMP_ROOT/podman.log" ||
  fail "snapshot did not exclude collaboration events from the database dump"

exec 7>"$TEMP_ROOT/ephemeral.lock"
flock -n 7 || fail "could not hold the maintenance lock for concurrency validation"
: > "$TEMP_ROOT/systemctl.log"
if run_maintenance enable > "$TEMP_ROOT/enable-lock-conflict.out" 2>&1; then
  fail "enable ignored an active maintenance lock"
fi
grep -q 'maintenance operation is still running' "$TEMP_ROOT/enable-lock-conflict.out" ||
  fail "enable lock conflict did not report the active maintenance operation"
if run_maintenance disable > "$TEMP_ROOT/disable-lock-conflict.out" 2>&1; then
  fail "disable ignored an active maintenance lock"
fi
grep -q 'maintenance operation is still running' "$TEMP_ROOT/disable-lock-conflict.out" ||
  fail "disable lock conflict did not report the active maintenance operation"
if run_maintenance snapshot > "$TEMP_ROOT/snapshot-lock-conflict.out" 2>&1; then
  fail "snapshot ignored an active maintenance lock"
fi
grep -q 'maintenance operation is still running' "$TEMP_ROOT/snapshot-lock-conflict.out" ||
  fail "snapshot lock conflict did not report the active maintenance operation"
if [ -s "$TEMP_ROOT/systemctl.log" ]; then
  fail "enable or disable stopped maintenance units before acquiring the maintenance lock"
fi
grep -q '^EPHEMERAL_MAINTENANCE_ENABLED=true$' "$TEMP_ROOT/config/ephemeral.env" ||
  fail "lock-conflicted enable or disable changed the enabled state"
YISTACK_EPHEMERAL_LOCK_FD=7 run_maintenance disable
grep -q '^EPHEMERAL_MAINTENANCE_ENABLED=false$' "$TEMP_ROOT/config/ephemeral.env" ||
  fail "maintenance command did not reuse an inherited matching lock descriptor"
sed -i 's/^EPHEMERAL_MAINTENANCE_ENABLED=false$/EPHEMERAL_MAINTENANCE_ENABLED=true/' \
  "$TEMP_ROOT/config/ephemeral.env"
: > "$TEMP_ROOT/systemctl.log"

cp "$TEMP_ROOT/config/ephemeral.env" \
  "$TEMP_ROOT/install/config/yistack-ephemeral-maintenance.env.example"
mv "$TEMP_ROOT/config/ephemeral.env" "$TEMP_ROOT/config/ephemeral.env.saved"
if run_maintenance enable > "$TEMP_ROOT/enable-missing-config-lock-conflict.out" 2>&1; then
  fail "enable ignored an active maintenance lock when configuration was missing"
fi
[ ! -e "$TEMP_ROOT/config/ephemeral.env" ] ||
  fail "lock-conflicted enable created a missing configuration before acquiring the lock"
if run_maintenance disable > "$TEMP_ROOT/disable-missing-config-lock-conflict.out" 2>&1; then
  fail "disable ignored an active maintenance lock when configuration was missing"
fi
[ ! -e "$TEMP_ROOT/config/ephemeral.env" ] ||
  fail "lock-conflicted disable created a missing configuration before acquiring the lock"
if run_maintenance snapshot > "$TEMP_ROOT/snapshot-missing-config-lock-conflict.out" 2>&1; then
  fail "snapshot ignored an active maintenance lock when configuration was missing"
fi
[ ! -e "$TEMP_ROOT/config/ephemeral.env" ] ||
  fail "lock-conflicted snapshot created a missing configuration before acquiring the lock"
if [ -s "$TEMP_ROOT/systemctl.log" ]; then
  fail "missing-config lock conflict changed systemd state before acquiring the lock"
fi
mv "$TEMP_ROOT/config/ephemeral.env.saved" "$TEMP_ROOT/config/ephemeral.env"
flock -u 7
exec 7>&-

podman_ready_file="$TEMP_ROOT/podman-ready"
podman_pid_file="$TEMP_ROOT/podman-pid"
podman_release_file="$TEMP_ROOT/release-podman"
BLOCKED_PODMAN_RELEASE_FILE="$podman_release_file"
set +e
(
  exec 7>"$TEMP_ROOT/ephemeral.lock"
  flock -n 7
  MOCK_PODMAN_KILL_PARENT=true \
  MOCK_PODMAN_PID_FILE="$podman_pid_file" \
  MOCK_PODMAN_READY_FILE="$podman_ready_file" \
  MOCK_PODMAN_RELEASE_FILE="$podman_release_file" \
  YISTACK_EPHEMERAL_LOCK_FD=7 \
    run_maintenance snapshot
) > "$TEMP_ROOT/maintenance-parent-kill.out" 2>&1 &
killed_maintenance_pid="$!"
set -e
for _ in $(seq 1 3000); do
  [ ! -e "$podman_ready_file" ] || break
  sleep 0.01
done
[ -e "$podman_ready_file" ] ||
  fail "maintenance did not reach the blocking Podman command"
podman_pid="$(cat "$podman_pid_file")"
[ ! -e "/proc/$podman_pid/fd/7" ] ||
  fail "Podman child inherited the arbitrary maintenance lock descriptor"
set +e
wait "$killed_maintenance_pid"
killed_maintenance_status="$?"
set -e
[ "$killed_maintenance_status" -ne 0 ] ||
  fail "maintenance parent unexpectedly survived the termination test"
if flock -n "$TEMP_ROOT/ephemeral.lock" true; then
  fail "terminated maintenance released its lock while the Podman child was active"
fi
: > "$podman_release_file"
maintenance_lock_released=false
for _ in $(seq 1 3000); do
  if flock -n "$TEMP_ROOT/ephemeral.lock" true; then
    maintenance_lock_released=true
    break
  fi
  sleep 0.01
done
[ "$maintenance_lock_released" = "true" ] ||
  fail "maintenance lock remained held after the Podman child exited"
BLOCKED_PODMAN_RELEASE_FILE=""

sed -i 's/^EPHEMERAL_DISK_LOW_WATERMARK_PERCENT=98$/EPHEMERAL_DISK_LOW_WATERMARK_PERCENT=invalid/' \
  "$TEMP_ROOT/config/ephemeral.env"
run_maintenance disable
sed -i 's/^EPHEMERAL_DISK_LOW_WATERMARK_PERCENT=invalid$/EPHEMERAL_DISK_LOW_WATERMARK_PERCENT=98/' \
  "$TEMP_ROOT/config/ephemeral.env"
grep -q '^EPHEMERAL_MAINTENANCE_ENABLED=false$' "$TEMP_ROOT/config/ephemeral.env" ||
  fail "disable did not persist the disabled state from an invalid configuration"
grep -Fq 'disable --now yistack-ephemeral-reset.timer yistack-ephemeral-cleanup.timer' "$TEMP_ROOT/systemctl.log" ||
  fail "disable did not stop both schedules"
grep -Fq 'stop yistack-ephemeral-reset.service yistack-ephemeral-cleanup.service' "$TEMP_ROOT/systemctl.log" ||
  fail "disable did not stop running maintenance services"
cp "$TEMP_ROOT/config/ephemeral.env" \
  "$TEMP_ROOT/install/config/yistack-ephemeral-maintenance.env.example"
rm "$TEMP_ROOT/config/ephemeral.env"
run_maintenance snapshot
[ -f "$TEMP_ROOT/config/ephemeral.env" ] ||
  fail "snapshot did not create the missing configuration"
grep -q '^EPHEMERAL_MAINTENANCE_ENABLED=false$' "$TEMP_ROOT/config/ephemeral.env" ||
  fail "snapshot did not leave a newly created configuration disabled"
grep -q '^schema=ephemeral-experience-baseline.v2$' "$TEMP_ROOT/data/ephemeral-baseline/METADATA" ||
  fail "snapshot did not write the ephemeral experience baseline schema"
grep -q '^user_data_policy=excluded$' "$TEMP_ROOT/data/ephemeral-baseline/METADATA" ||
  fail "snapshot did not record the excluded user-data policy"
run_maintenance status > "$TEMP_ROOT/verified-status.out"
grep -q '^baseline=verified$' "$TEMP_ROOT/verified-status.out" ||
  fail "status did not report a verified current baseline"
sed -i 's/^schema=ephemeral-experience-baseline.v2$/schema=unsupported/' \
  "$TEMP_ROOT/data/ephemeral-baseline/METADATA"
run_maintenance status > "$TEMP_ROOT/invalid-metadata-status.out"
grep -q '^baseline=invalid$' "$TEMP_ROOT/invalid-metadata-status.out" ||
  fail "status reported incompatible baseline metadata as verified"
sed -i 's/^schema=unsupported$/schema=ephemeral-experience-baseline.v2/' \
  "$TEMP_ROOT/data/ephemeral-baseline/METADATA"
printf '1111111111111111111111111111111111111111\n' > "$TEMP_ROOT/install/SOURCE_COMMIT"
run_maintenance status > "$TEMP_ROOT/stale-status.out"
grep -q '^baseline=stale$' "$TEMP_ROOT/stale-status.out" ||
  fail "status did not report a baseline from another Release as stale"
printf '0000000000000000000000000000000000000000\n' > "$TEMP_ROOT/install/SOURCE_COMMIT"
printf 'preserve on enable failure\n' > "$TEMP_ROOT/data/ephemeral-baseline/pre-enable-marker"
sed -i '/^[[:space:]]*EPHEMERAL_MAINTENANCE_ENABLED[[:space:]]*=/d' "$TEMP_ROOT/config/ephemeral.env"
sed -i 's|^EPHEMERAL_RESET_ON_CALENDAR=.*|EPHEMERAL_RESET_ON_CALENDAR=invalid-calendar|' "$TEMP_ROOT/config/ephemeral.env"
if run_maintenance enable > "$TEMP_ROOT/enable-failure.out" 2>&1; then
  fail "enable accepted an invalid schedule"
fi
grep -q '^EPHEMERAL_MAINTENANCE_ENABLED=false$' "$TEMP_ROOT/config/ephemeral.env" ||
  fail "failed enable did not restore the disabled state"
[ -f "$TEMP_ROOT/data/ephemeral-baseline/pre-enable-marker" ] ||
  fail "failed enable did not restore the previous baseline"
sed -i 's|^EPHEMERAL_RESET_ON_CALENDAR=.*|EPHEMERAL_RESET_ON_CALENDAR="Mon..Fri *-*-* 03:15:00"|' "$TEMP_ROOT/config/ephemeral.env"
if MOCK_SYSTEMCTL_FAIL_DAEMON_RELOAD=true \
  run_maintenance enable > "$TEMP_ROOT/enable-systemctl-failure.out" 2>&1; then
  fail "enable ignored a systemd reload failure"
fi
grep -q '^EPHEMERAL_MAINTENANCE_ENABLED=false$' "$TEMP_ROOT/config/ephemeral.env" ||
  fail "systemd failure did not restore the disabled state"
grep -q 'mode remains disabled' "$TEMP_ROOT/enable-systemctl-failure.out" ||
  fail "systemd failure did not report the enable rollback"
[ -f "$TEMP_ROOT/data/ephemeral-baseline/pre-enable-marker" ] ||
  fail "systemd failure did not restore the previous baseline"
run_maintenance enable
[ ! -e "$TEMP_ROOT/data/ephemeral-baseline/pre-enable-marker" ] ||
  fail "successful enable retained the previous baseline rollback copy"
grep -q '^EPHEMERAL_MAINTENANCE_ENABLED=true$' "$TEMP_ROOT/config/ephemeral.env" ||
  fail "enable did not restore a missing enablement setting"
grep -Fq 'enable --now yistack-ephemeral-reset.timer yistack-ephemeral-cleanup.timer' "$TEMP_ROOT/systemctl.log" ||
  fail "enable did not start both schedules"
run_maintenance status > "$TEMP_ROOT/enabled-status.out"
grep -q '^reset_timer=active$' "$TEMP_ROOT/enabled-status.out" ||
  fail "enabled status did not report the reset timer as active"
grep -q '^cleanup_timer=active$' "$TEMP_ROOT/enabled-status.out" ||
  fail "enabled status did not report the cleanup timer as active"
grep -q '^reset_timer_enabled=true$' "$TEMP_ROOT/enabled-status.out" ||
  fail "enabled status did not report the reset timer as enabled"
grep -q '^cleanup_timer_enabled=true$' "$TEMP_ROOT/enabled-status.out" ||
  fail "enabled status did not report the cleanup timer as enabled"
: > "$TEMP_ROOT/systemctl.log"
printf 'preserve on restart failure\n' > "$TEMP_ROOT/data/ephemeral-baseline/pre-enable-marker"
if MOCK_SYSTEMCTL_FAIL_TIMER_RESTART=true \
  run_maintenance enable > "$TEMP_ROOT/enable-restart-failure.out" 2>&1; then
  fail "enable ignored a timer restart failure"
fi
grep -q '^EPHEMERAL_MAINTENANCE_ENABLED=false$' "$TEMP_ROOT/config/ephemeral.env" ||
  fail "timer restart failure did not leave ephemeral mode disabled"
grep -Fq 'stop yistack-ephemeral-reset.service yistack-ephemeral-cleanup.service' "$TEMP_ROOT/systemctl.log" ||
  fail "timer restart failure did not stop running maintenance services"
[ -f "$TEMP_ROOT/data/ephemeral-baseline/pre-enable-marker" ] ||
  fail "timer restart failure did not restore the previous baseline"
run_maintenance enable
: > "$TEMP_ROOT/systemctl.log"
if MOCK_SYSTEMCTL_FAIL_TIMER_DISABLE=true \
  run_maintenance enable > "$TEMP_ROOT/enable-disable-failure.out" 2>&1; then
  fail "enable ignored a timer disable failure"
fi
grep -q '^EPHEMERAL_MAINTENANCE_ENABLED=false$' "$TEMP_ROOT/config/ephemeral.env" ||
  fail "timer disable failure did not leave ephemeral mode disabled"
grep -Fq 'stop yistack-ephemeral-reset.service yistack-ephemeral-cleanup.service' "$TEMP_ROOT/systemctl.log" ||
  fail "timer disable failure skipped stopping maintenance services"
run_maintenance enable
printf 'preserve on snapshot failure\n' > "$TEMP_ROOT/data/ephemeral-baseline/pre-enable-marker"
if MOCK_PG_DUMP_FAIL=true \
  run_maintenance enable > "$TEMP_ROOT/enable-snapshot-failure.out" 2>&1; then
  fail "enable ignored a snapshot failure"
fi
grep -q '^EPHEMERAL_MAINTENANCE_ENABLED=false$' "$TEMP_ROOT/config/ephemeral.env" ||
  fail "snapshot failure did not leave ephemeral mode disabled"
if grep -Fqx 'yistack-ephemeral-reset.timer' "$TEMP_ROOT/systemctl.enabled" ||
  grep -Fqx 'yistack-ephemeral-cleanup.timer' "$TEMP_ROOT/systemctl.enabled"; then
  fail "snapshot failure left an ephemeral timer enabled"
fi
[ -f "$TEMP_ROOT/data/ephemeral-baseline/pre-enable-marker" ] ||
  fail "snapshot failure did not restore the previous baseline"
run_maintenance enable
if MOCK_SYSTEMCTL_FAIL_MAINTENANCE_STOP=true \
  run_maintenance disable > "$TEMP_ROOT/disable-stop-failure.out" 2>&1; then
  fail "disable ignored a maintenance service stop failure"
fi
grep -q '^EPHEMERAL_MAINTENANCE_ENABLED=false$' "$TEMP_ROOT/config/ephemeral.env" ||
  fail "disable did not persist false before reporting a service stop failure"
grep -q 'maintenance units could not be fully stopped' "$TEMP_ROOT/disable-stop-failure.out" ||
  fail "disable did not report the maintenance service stop failure"
run_maintenance enable

mkdir -p "$TEMP_ROOT/data/runtime/projects/project-delete"
printf 'delete\n' > "$TEMP_ROOT/data/runtime/projects/project-delete/app.txt"
printf 'delete\n' > "$TEMP_ROOT/data/runtime/container-data/state.json"
printf 'delete\n' > "$TEMP_ROOT/data/runtime/generation-evidence/evidence.txt"
printf 'delete\n' > "$TEMP_ROOT/cache/cache.txt"
printf 'delete\n' > "$TEMP_ROOT/log/app.log"
run_maintenance reset

for cleared_dir in \
  "$TEMP_ROOT/data/runtime/projects" \
  "$TEMP_ROOT/data/runtime/container-data" \
  "$TEMP_ROOT/data/runtime/backups" \
  "$TEMP_ROOT/data/runtime/generation-evidence" \
  "$TEMP_ROOT/cache" \
  "$TEMP_ROOT/log"; do
  [ -z "$(find "$cleared_dir" -xdev -mindepth 1 -print -quit)" ] ||
    fail "daily reset retained managed data in $cleared_dir"
done
[ -e "$TEMP_ROOT/data/runtime/templates/template-keep/template.txt" ] ||
  fail "daily reset removed the reusable runtime template"
[ -e "$TEMP_ROOT/data/ms-playwright/browser-keep/browser.txt" ] ||
  fail "daily reset removed the reusable browser runtime"
[ -e "$TEMP_ROOT/config/yistack-secret" ] ||
  fail "daily reset removed configuration"
[ -e "$TEMP_ROOT/install/release-binary" ] ||
  fail "daily reset removed the installed release"

for protected_path in \
  'runtime/templates' \
  'ms-playwright' \
  '/etc/yistack' \
  '/opt/yistack'; do
  grep -q "$protected_path" "$MAINTENANCE_SCRIPT" || fail "missing protected path contract: $protected_path"
done
grep -q -- '--filter label=yistack.project_id' "$MAINTENANCE_SCRIPT" || fail "missing YiStack label filter"
if grep -Eq 'podman_cmd (image rm|rmi)|podman system prune' "$MAINTENANCE_SCRIPT"; then
  fail "ephemeral experience reset must not remove reusable Podman images"
fi

echo "Ephemeral experience mode safety validation passed."
