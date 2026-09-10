#!/usr/bin/env bash

set -Eeuo pipefail

PACKAGE_ROOT="${1:-}"
if [ -z "$PACKAGE_ROOT" ]; then
  echo "Usage: $0 <extracted-release-directory>" >&2
  exit 2
fi
PACKAGE_ROOT="$(realpath "$PACKAGE_ROOT")"
for required_file in bin/yistackctl bin/yistack-service-user-exec; do
  [ -x "$PACKAGE_ROOT/$required_file" ] || {
    echo "Release directory is missing executable $required_file" >&2
    exit 1
  }
done

root="$(mktemp -d "${TMPDIR:-/tmp}/yistack-release-control.XXXXXX")"
trap 'rm -rf "$root"' EXIT
mock_bin="$root/mock-bin"
data_dir="$root/data"
root_only_dir="$root/root-only"
install_root="$root/install"
mkdir -p "$mock_bin" "$data_dir" "$root_only_dir" "$install_root"
chmod 0700 "$root_only_dir"
ln -s "$PACKAGE_ROOT" "$install_root/current"

cat > "$root/yistack.env" <<'EOF'
APP_PORT=18080
FRONTEND_PORT=15000
EOF
cat > "$mock_bin/systemctl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${MOCK_SYSTEMCTL_LOG:?}"
EOF
cat > "$mock_bin/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
url="${!#}"
if [[ "$url" == */api/health ]]; then
  attempts="$(cat "${MOCK_HEALTH_ATTEMPTS_FILE:?}")"
  attempts="$((attempts + 1))"
  printf '%s\n' "$attempts" > "$MOCK_HEALTH_ATTEMPTS_FILE"
  [ "$attempts" -gt "${MOCK_HEALTH_FAILURES:-0}" ] || exit 22
  printf '{"status":"ok"}'
fi
EOF
cat > "$mock_bin/runuser" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[ "$PWD" = "${MOCK_EXPECTED_SERVICE_CWD:?}" ] || {
  echo "service-user command inherited unsafe cwd: $PWD" >&2
  exit 1
}
[ "${1:-}" = -u ] && shift 2
[ "${1:-}" = -- ] && shift
exec "$@"
EOF
cat > "$mock_bin/podman" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${MOCK_PODMAN_LOG:?}"
printf 'mock-podman %s\n' "$*"
EOF
chmod 0755 "$mock_bin/"*
: > "$root/systemctl.log"
: > "$root/podman.log"
printf '0\n' > "$root/health-attempts"

run_control() {
  (
    cd "$root_only_dir"
    env \
      PATH="$mock_bin:$PATH" \
      MOCK_EXPECTED_SERVICE_CWD="$data_dir" \
      MOCK_HEALTH_ATTEMPTS_FILE="$root/health-attempts" \
      MOCK_HEALTH_FAILURES="${MOCK_HEALTH_FAILURES:-0}" \
      MOCK_PODMAN_LOG="$root/podman.log" \
      MOCK_SYSTEMCTL_LOG="$root/systemctl.log" \
      YISTACK_DATA_DIR="$data_dir" \
      YISTACK_ENV_FILE="$root/yistack.env" \
      YISTACK_HEALTH_ATTEMPTS=3 \
      YISTACK_HEALTH_SLEEP_SECONDS=0 \
      YISTACK_INSTALL_ROOT="$install_root" \
      YISTACK_RUNUSER_BIN="$mock_bin/runuser" \
      YISTACK_SERVICE_EXEC_SKIP_ROOT_CHECK=true \
      YISTACK_SERVICE_USER="$(id -un)" \
      YISTACK_SERVICE_USER_EXEC="$PACKAGE_ROOT/bin/yistack-service-user-exec" \
      "$PACKAGE_ROOT/bin/yistackctl" "$@"
  )
}

start_output="$(MOCK_HEALTH_FAILURES=2 run_control start)"
grep -Fqx 'YiStack services started successfully.' <<< "$start_output"
grep -Fqx 'Health check: passed' <<< "$start_output"
[ "$(cat "$root/health-attempts")" = 3 ]
grep -Fqx 'start yistack.target' "$root/systemctl.log"

runtime_output="$(run_control runtime images)"
grep -Fqx 'mock-podman images' <<< "$runtime_output"
grep -Fqx 'images' "$root/podman.log"

stop_output="$(run_control stop)"
grep -Fqx 'YiStack services stopped.' <<< "$stop_output"
grep -Fqx 'stop yistack.target' "$root/systemctl.log"

printf '0\n' > "$root/health-attempts"
set +e
MOCK_HEALTH_FAILURES=3 run_control restart > "$root/restart.out" 2>&1
restart_status="$?"
set -e
[ "$restart_status" -ne 0 ]
grep -Fq 'YiStack did not become healthy after starting.' "$root/restart.out"
grep -Fq 'status yistack-backend.service yistack-frontend.service yistack-browser-worker.service' \
  "$root/systemctl.log"

echo "Release control-command validation passed."
