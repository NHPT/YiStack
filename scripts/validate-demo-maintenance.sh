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
  echo "Demo maintenance validation failed: $*" >&2
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
  "$TEMP_ROOT/install"

cat > "$TEMP_ROOT/bin/systemctl" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = "is-active" ]; then
  exit 3
fi
exit 0
EOF

cat > "$TEMP_ROOT/bin/podman" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = "inspect" ]; then
  echo true
fi
exit 0
EOF
chmod 0755 "$TEMP_ROOT/bin/systemctl" "$TEMP_ROOT/bin/podman"

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
SERVICE_USER=$(id -un)
EOF

run_maintenance() {
  PATH="$TEMP_ROOT/bin:$PATH" \
    YISTACK_ENV_FILE="$TEMP_ROOT/config/yistack.env" \
    YISTACK_POSTGRES_ENV_FILE="$TEMP_ROOT/config/postgres.env" \
    YISTACK_DEMO_ENV_FILE="$TEMP_ROOT/config/demo.env" \
    "$MAINTENANCE_SCRIPT" "$@"
}

run_maintenance status > "$TEMP_ROOT/status.out"
grep -q '^enabled=true$' "$TEMP_ROOT/status.out" || fail "status did not report enabled mode"
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
grep -q 'Demo maintenance is disabled' "$TEMP_ROOT/disabled.out" || fail "disabled mode did not fail closed"

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

for protected_path in \
  'runtime/templates' \
  'ms-playwright' \
  '/etc/yistack' \
  '/opt/yistack'; do
  grep -q "$protected_path" "$MAINTENANCE_SCRIPT" || fail "missing protected path contract: $protected_path"
done
grep -q -- '--filter label=yistack.project_id' "$MAINTENANCE_SCRIPT" || fail "missing YiStack label filter"

echo "Demo maintenance safety validation passed."
