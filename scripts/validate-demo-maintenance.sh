#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAINTENANCE_SCRIPT="${1:-$ROOT_DIR/deploy/bin/yistack-demo-maintenance}"
TEMP_ROOT="$(mktemp -d)"

cleanup() {
  rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT

fail() {
  echo "Ephemeral trial mode validation failed: $*" >&2
  exit 1
}

[ -x "$MAINTENANCE_SCRIPT" ] || fail "script is missing or not executable"
bash -n "$MAINTENANCE_SCRIPT"

mkdir -p \
  "$TEMP_ROOT/bin" \
  "$TEMP_ROOT/config" \
  "$TEMP_ROOT/data/runtime/projects/project-keep" \
  "$TEMP_ROOT/data/runtime/templates/template-keep" \
  "$TEMP_ROOT/data/runtime/container-data" \
  "$TEMP_ROOT/data/runtime/generation-evidence/expired" \
  "$TEMP_ROOT/data/ms-playwright/browser-keep" \
  "$TEMP_ROOT/cache/expired" \
  "$TEMP_ROOT/log/expired" \
  "$TEMP_ROOT/install" \
  "$TEMP_ROOT/systemd"

cat > "$TEMP_ROOT/bin/systemctl" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$SYSTEMCTL_LOG"
if [ "${1:-}" = "is-active" ]; then
  exit 3
fi
exit 0
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

cat > "$TEMP_ROOT/bin/podman" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = "inspect" ]; then
  echo true
fi
if [ "${1:-}" = "exec" ]; then
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
  "$TEMP_ROOT/bin/systemctl" \
  "$TEMP_ROOT/bin/systemd-analyze" \
  "$TEMP_ROOT/bin/podman"

printf 'keep\n' > "$TEMP_ROOT/data/runtime/projects/project-keep/app.txt"
printf 'keep\n' > "$TEMP_ROOT/data/runtime/templates/template-keep/template.txt"
printf 'keep\n' > "$TEMP_ROOT/data/ms-playwright/browser-keep/browser.txt"
printf 'keep\n' > "$TEMP_ROOT/config/yistack-secret"
printf 'keep\n' > "$TEMP_ROOT/install/release-binary"
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
YISTACK_BROWSER_EVIDENCE_DIR=$TEMP_ROOT/data/runtime/generation-evidence
YISTACK_SYSTEMD_UNIT_DIR=$TEMP_ROOT/systemd
EOF

cat > "$TEMP_ROOT/config/postgres.env" <<'EOF'
POSTGRES_CONTAINER_NAME=yistack-postgres
POSTGRES_USER=postgres
POSTGRES_DB=yistack
EOF

cat > "$TEMP_ROOT/config/demo.env" <<EOF
DEMO_MAINTENANCE_ENABLED=true
DEMO_BASELINE_DIR=$TEMP_ROOT/data/demo-baseline
DEMO_PROJECT_TTL_HOURS=0
DEMO_STOPPED_CONTAINER_TTL_MINUTES=0
DEMO_EVIDENCE_TTL_HOURS=1
DEMO_CACHE_TTL_HOURS=1
DEMO_LOG_TTL_DAYS=0
DEMO_DISK_HIGH_WATERMARK_PERCENT=99
DEMO_DISK_LOW_WATERMARK_PERCENT=98
DEMO_RESTART_AFTER_RESET=false
DEMO_HEALTH_TIMEOUT_SECONDS=10
DEMO_LOCK_FILE=$TEMP_ROOT/demo.lock
DEMO_RESET_ON_CALENDAR="Mon..Fri *-*-* 03:15:00"
DEMO_RESET_RANDOMIZED_DELAY_SEC=2min
DEMO_CLEANUP_ON_CALENDAR="*-*-* *:45:00"
DEMO_CLEANUP_RANDOMIZED_DELAY_SEC=30s
SERVICE_USER=$(id -un)
EOF

run_maintenance() {
  PATH="$TEMP_ROOT/bin:$PATH" \
    SYSTEMCTL_LOG="$TEMP_ROOT/systemctl.log" \
    MOCK_USER_DATA_ROWS="${MOCK_USER_DATA_ROWS:-}" \
    YISTACK_ENV_FILE="$TEMP_ROOT/config/yistack.env" \
    YISTACK_POSTGRES_ENV_FILE="$TEMP_ROOT/config/postgres.env" \
    YISTACK_DEMO_ENV_FILE="$TEMP_ROOT/config/demo.env" \
    "$MAINTENANCE_SCRIPT" "$@"
}

run_maintenance status > "$TEMP_ROOT/status.out"
grep -q '^enabled=true$' "$TEMP_ROOT/status.out" || fail "status did not report enabled mode"
grep -q '^configured_reset_on_calendar=Mon..Fri \*-\*-\* 03:15:00$' "$TEMP_ROOT/status.out" ||
  fail "status did not report the configured daily reset schedule"
run_maintenance cleanup

[ ! -e "$TEMP_ROOT/data/runtime/generation-evidence/expired/evidence.txt" ] || fail "expired evidence was retained"
[ ! -e "$TEMP_ROOT/cache/expired/cache.txt" ] || fail "expired cache was retained"
[ -e "$TEMP_ROOT/log/expired/log.txt" ] || fail "disabled log cleanup removed a file"
[ -e "$TEMP_ROOT/data/runtime/projects/project-keep/app.txt" ] || fail "project workspace was modified"
[ -e "$TEMP_ROOT/data/runtime/templates/template-keep/template.txt" ] || fail "runtime template was modified"
[ -e "$TEMP_ROOT/data/ms-playwright/browser-keep/browser.txt" ] || fail "Playwright runtime was modified"
[ -e "$TEMP_ROOT/config/yistack-secret" ] || fail "configuration was modified"
[ -e "$TEMP_ROOT/install/release-binary" ] || fail "release installation was modified"

sed -i 's/^DEMO_MAINTENANCE_ENABLED=true$/DEMO_MAINTENANCE_ENABLED=false/' "$TEMP_ROOT/config/demo.env"
if run_maintenance cleanup > "$TEMP_ROOT/disabled.out" 2>&1; then
  fail "cleanup ran without explicit enablement"
fi
grep -q 'Ephemeral trial mode is disabled' "$TEMP_ROOT/disabled.out" || fail "disabled mode did not fail closed"

sed -i 's/^DEMO_MAINTENANCE_ENABLED=false$/DEMO_MAINTENANCE_ENABLED=true/' "$TEMP_ROOT/config/demo.env"
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
reset_override="$TEMP_ROOT/systemd/yistack-demo-reset.timer.d/10-schedule.conf"
cleanup_override="$TEMP_ROOT/systemd/yistack-demo-cleanup.timer.d/10-schedule.conf"
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
grep -Fqx 'enable --now yistack-demo-reset.timer yistack-demo-cleanup.timer' "$TEMP_ROOT/systemctl.log" ||
  fail "schedule application did not enable both timers"

sed -i 's|^DEMO_RESET_ON_CALENDAR=.*|DEMO_RESET_ON_CALENDAR=invalid-calendar|' "$TEMP_ROOT/config/demo.env"
if run_maintenance apply-schedule > "$TEMP_ROOT/invalid-schedule.out" 2>&1; then
  fail "schedule application accepted an invalid calendar"
fi
grep -q 'DEMO_RESET_ON_CALENDAR is not a valid systemd calendar value' "$TEMP_ROOT/invalid-schedule.out" ||
  fail "invalid calendar rejection did not identify the configured setting"
sed -i 's|^DEMO_RESET_ON_CALENDAR=.*|DEMO_RESET_ON_CALENDAR="Mon..Fri *-*-* 03:15:00"|' "$TEMP_ROOT/config/demo.env"

if MOCK_USER_DATA_ROWS='users:1' run_maintenance snapshot > "$TEMP_ROOT/dirty-database.out" 2>&1; then
  fail "snapshot accepted a database containing user data"
fi
grep -q 'database contains user data' "$TEMP_ROOT/dirty-database.out" ||
  fail "dirty database rejection did not explain the clean-baseline requirement"

if run_maintenance snapshot > "$TEMP_ROOT/dirty-workspace.out" 2>&1; then
  fail "snapshot accepted a non-empty project workspace"
fi
grep -q 'project directory contains a project workspace' "$TEMP_ROOT/dirty-workspace.out" ||
  fail "dirty workspace rejection did not explain the clean-baseline requirement"

rm -rf "$TEMP_ROOT/data/runtime/projects/project-keep"
run_maintenance snapshot
grep -q '^schema=ephemeral-trial-baseline.v1$' "$TEMP_ROOT/data/demo-baseline/METADATA" ||
  fail "snapshot did not write the ephemeral trial baseline schema"
grep -q '^user_data_policy=empty$' "$TEMP_ROOT/data/demo-baseline/METADATA" ||
  fail "snapshot did not record the empty user-data policy"

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
  fail "ephemeral trial reset must not remove reusable Podman images"
fi

echo "Ephemeral trial mode safety validation passed."
