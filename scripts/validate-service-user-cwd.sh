#!/usr/bin/env bash

set -Eeuo pipefail

PACKAGE_ROOT="${1:-}"
if [ -z "$PACKAGE_ROOT" ]; then
  echo "Usage: $0 <extracted-release-directory>" >&2
  exit 2
fi
PACKAGE_ROOT="$(realpath "$PACKAGE_ROOT")"
helper="$PACKAGE_ROOT/bin/yistack-service-user-exec"
[ -x "$helper" ] || {
  echo "Release directory is missing executable bin/yistack-service-user-exec" >&2
  exit 1
}

root="$(mktemp -d "${TMPDIR:-/tmp}/yistack-service-cwd.XXXXXX")"
trap 'chmod 0700 "$root/root-only" 2>/dev/null || true; rm -rf "$root"' EXIT
data_dir="$root/data"
root_only_dir="$root/root-only"
mock_runuser="$root/runuser"
probe="$root/probe"
mkdir -p "$data_dir" "$root_only_dir"
chmod 0700 "$root_only_dir"

cat > "$mock_runuser" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[ "$PWD" = "${EXPECTED_SERVICE_CWD:?}" ] || {
  echo "runuser inherited unsafe cwd: $PWD" >&2
  exit 1
}
[ "${1:-}" = -u ] && shift 2
[ "${1:-}" = -- ] && shift
exec "$@"
EOF
cat > "$probe" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'pwd=%s\n' "$PWD"
printf 'home=%s\n' "$HOME"
printf 'runtime=%s\n' "$XDG_RUNTIME_DIR"
printf 'argument=%s\n' "${1:-}"
EOF
chmod 0755 "$mock_runuser" "$probe"

service_user="$(id -un)"
service_uid="$(id -u)"
forced_output="$(
  cd "$root_only_dir"
  EXPECTED_SERVICE_CWD="$data_dir" \
  YISTACK_DATA_DIR="$data_dir" \
  YISTACK_RUNUSER_BIN="$mock_runuser" \
  YISTACK_SERVICE_EXEC_SKIP_ROOT_CHECK=true \
  YISTACK_SERVICE_USER="$service_user" \
    "$helper" "$probe" forced
)"
grep -Fqx "pwd=$data_dir" <<< "$forced_output"
grep -Fqx "home=$data_dir" <<< "$forced_output"
grep -Fqx "runtime=/run/user/$service_uid" <<< "$forced_output"
grep -Fqx 'argument=forced' <<< "$forced_output"

direct_output="$(
  cd "$root_only_dir"
  YISTACK_DATA_DIR="$data_dir" \
  YISTACK_SERVICE_USER="$service_user" \
    "$helper" "$probe" direct
)"
grep -Fqx "pwd=$data_dir" <<< "$direct_output"
grep -Fqx "home=$data_dir" <<< "$direct_output"
grep -Fqx "runtime=/run/user/$service_uid" <<< "$direct_output"
grep -Fqx 'argument=direct' <<< "$direct_output"

set +e
YISTACK_DATA_DIR=relative/path \
YISTACK_SERVICE_USER="$service_user" \
  "$helper" "$probe" > "$root/unsafe.out" 2>&1
unsafe_status="$?"
set -e
[ "$unsafe_status" -ne 0 ]
grep -Fq 'YISTACK_DATA_DIR must be an absolute path' "$root/unsafe.out"

echo "Service-user working-directory validation passed."
