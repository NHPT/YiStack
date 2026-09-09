#!/usr/bin/env bash

set -Eeuo pipefail

PACKAGE_ROOT="${1:-}"
if [ -z "$PACKAGE_ROOT" ]; then
  echo "Usage: $0 <extracted-release-directory>" >&2
  exit 2
fi
PACKAGE_ROOT="$(realpath "$PACKAGE_ROOT")"
for required_file in bin/yistack-uninstall bin/yistackctl; do
  [ -x "$PACKAGE_ROOT/$required_file" ] || {
    echo "Release directory is missing executable $required_file" >&2
    exit 1
  }
done

root="$(mktemp -d "${TMPDIR:-/tmp}/yistack-release-uninstall.XXXXXX")"
trap 'rm -rf "$root"' EXIT
mock_bin="$root/mock-bin"
mkdir -p "$mock_bin"

cat > "$mock_bin/systemctl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${MOCK_SYSTEMCTL_LOG:?}"
EOF
cat > "$mock_bin/loginctl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${MOCK_LOGINCTL_LOG:?}"
EOF
cat > "$mock_bin/flock" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${MOCK_FLOCK_LOG:?}"
[ "${MOCK_FLOCK_FAIL:-false}" != true ]
EOF
cat > "$mock_bin/runuser" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = -u ]; then
  shift 2
fi
if [ "${1:-}" = -- ]; then
  shift
fi
exec "$@"
EOF
cat > "$mock_bin/podman" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${MOCK_PODMAN_LOG:?}"
case "$*" in
  "ps -aq --filter label=yistack.project_id")
    printf '%s\n' project-one project-two
    ;;
  "container exists yistack-postgres")
    ;;
  "network ls -q --filter label=yistack.project_id")
    printf '%s\n' project-network
    ;;
esac
EOF
for command in userdel groupdel; do
  cat > "$mock_bin/$command" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s %s\n' "$(basename "$0")" "$*" >> "${MOCK_ACCOUNT_LOG:?}"
EOF
done
chmod 0755 "$mock_bin/"*

service_user="$(id -un)"
service_group="$(id -gn)"

prepare_case() {
  local case_root="$1"
  local unit=""
  mkdir -p \
    "$case_root/install/releases/v1.1.4/bin" \
    "$case_root/config" \
    "$case_root/data/runtime" \
    "$case_root/log" \
    "$case_root/cache" \
    "$case_root/systemd/yistack-backend.service.d" \
    "$case_root/usr/local/bin" \
    "$case_root/usr/share/bash-completion/completions" \
    "$case_root/run/lock" \
    "$case_root/tmp"
  cp "$PACKAGE_ROOT/bin/yistackctl" "$case_root/install/releases/v1.1.4/bin/yistackctl"
  cp "$PACKAGE_ROOT/bin/yistack-uninstall" "$case_root/install/releases/v1.1.4/bin/yistack-uninstall"
  chmod 0755 "$case_root/install/releases/v1.1.4/bin/"*
  ln -s "$case_root/install/releases/v1.1.4" "$case_root/install/current"
  printf 'POSTGRES_CONTAINER_NAME=yistack-postgres\n' > "$case_root/config/postgres.env"
  printf 'preserve\n' > "$case_root/data/runtime/state"
  printf 'log\n' > "$case_root/log/yistack.log"
  printf 'cache\n' > "$case_root/cache/item"
  ln -s "$case_root/install/current/bin/yistackctl" "$case_root/usr/local/bin/yistackctl"
  printf 'complete -F _yistackctl yistackctl\n' \
    > "$case_root/usr/share/bash-completion/completions/yistackctl"
  printf 'lock\n' > "$case_root/run/lock/yistack-upgrade.lock"
  printf 'lock\n' > "$case_root/run/lock/yistack-ephemeral-maintenance.lock"
  printf '%s:100000:65536\nkeep:200000:65536\n' "$service_user" > "$case_root/subuid"
  printf '%s:100000:65536\nkeep:200000:65536\n' "$service_user" > "$case_root/subgid"
  for unit in "$PACKAGE_ROOT"/systemd/*; do
    touch "$case_root/systemd/$(basename "$unit")"
  done
  touch "$case_root/systemd/yistack-demo-reset.service"
  : > "$case_root/systemctl.log"
  : > "$case_root/loginctl.log"
  : > "$case_root/flock.log"
  : > "$case_root/podman.log"
  : > "$case_root/account.log"
}

run_uninstall() {
  local case_root="$1"
  shift
  env \
    PATH="$mock_bin:$PATH" \
    MOCK_ACCOUNT_LOG="$case_root/account.log" \
    MOCK_LOGINCTL_LOG="$case_root/loginctl.log" \
    MOCK_FLOCK_LOG="$case_root/flock.log" \
    MOCK_PODMAN_LOG="$case_root/podman.log" \
    MOCK_SYSTEMCTL_LOG="$case_root/systemctl.log" \
    YISTACK_CACHE_DIR="$case_root/cache" \
    YISTACK_COMPLETION_PATH="$case_root/usr/share/bash-completion/completions/yistackctl" \
    YISTACK_CONFIG_DIR="$case_root/config" \
    YISTACK_DATA_DIR="$case_root/data" \
    YISTACK_EPHEMERAL_LOCK_FILE="$case_root/run/lock/yistack-ephemeral-maintenance.lock" \
    YISTACK_GROUPDEL_BIN="$mock_bin/groupdel" \
    YISTACK_INSTALL_ROOT="$case_root/install" \
    YISTACK_LOGINCTL_BIN="$mock_bin/loginctl" \
    YISTACK_LOG_DIR="$case_root/log" \
    YISTACK_RUNUSER_BIN="$mock_bin/runuser" \
    YISTACK_SERVICE_GROUP="$service_group" \
    YISTACK_SERVICE_USER="$service_user" \
    YISTACK_SUBGID_FILE="$case_root/subgid" \
    YISTACK_SUBUID_FILE="$case_root/subuid" \
    YISTACK_SYSTEMCTL_BIN="$mock_bin/systemctl" \
    YISTACK_SYSTEMD_DIR="$case_root/systemd" \
    YISTACK_UNINSTALL_SKIP_ROOT_CHECK=true \
    YISTACK_UNINSTALL_TMPDIR="$case_root/tmp" \
    YISTACK_UPGRADE_LOCK_FILE="$case_root/run/lock/yistack-upgrade.lock" \
    YISTACK_USERDEL_BIN="$mock_bin/userdel" \
    YISTACKCTL_PATH="$case_root/usr/local/bin/yistackctl" \
      "$case_root/usr/local/bin/yistackctl" uninstall "$@"
}

preserve_root="$root/preserve"
prepare_case "$preserve_root"
run_uninstall "$preserve_root"
[ ! -e "$preserve_root/install" ]
[ ! -e "$preserve_root/usr/local/bin/yistackctl" ]
[ ! -e "$preserve_root/systemd/yistack-backend.service" ]
[ ! -e "$preserve_root/systemd/yistack-backend.service.d" ]
for path in config data log cache; do
  [ -d "$preserve_root/$path" ]
done
grep -Fq 'stop --time 20 project-one' "$preserve_root/podman.log"
grep -Fq 'stop --time 20 yistack-postgres' "$preserve_root/podman.log"
[ ! -s "$preserve_root/account.log" ]
grep -Fq "$service_user:100000:65536" "$preserve_root/subuid"
[ -z "$(find "$preserve_root/tmp" -mindepth 1 -print -quit)" ]

purge_root="$root/purge"
prepare_case "$purge_root"
run_uninstall "$purge_root" --purge
for path in install config data log cache; do
  [ ! -e "$purge_root/$path" ]
done
grep -Fq 'rm --force project-one' "$purge_root/podman.log"
grep -Fq 'rm --force yistack-postgres' "$purge_root/podman.log"
grep -Fq 'network rm --force project-network' "$purge_root/podman.log"
grep -Fq "userdel $service_user" "$purge_root/account.log"
grep -Fq "groupdel $service_group" "$purge_root/account.log"
! grep -Fq "$service_user:" "$purge_root/subuid"
grep -Fq 'keep:200000:65536' "$purge_root/subuid"
[ -z "$(find "$purge_root/tmp" -mindepth 1 -print -quit)" ]

lock_root="$root/lock"
prepare_case "$lock_root"
set +e
MOCK_FLOCK_FAIL=true run_uninstall "$lock_root" > "$lock_root/output" 2>&1
lock_status="$?"
set -e
[ "$lock_status" -ne 0 ]
[ -d "$lock_root/install" ]
[ ! -s "$lock_root/systemctl.log" ]
grep -Fq 'another YiStack upgrade or uninstall is running' "$lock_root/output"
[ -z "$(find "$lock_root/tmp" -mindepth 1 -print -quit)" ]

unsafe_root="$root/unsafe"
prepare_case "$unsafe_root"
set +e
YISTACK_INSTALL_ROOT=/ \
YISTACK_UNINSTALL_SKIP_ROOT_CHECK=true \
  "$PACKAGE_ROOT/bin/yistack-uninstall" > "$unsafe_root/output" 2>&1
unsafe_status="$?"
set -e
[ "$unsafe_status" -ne 0 ]
grep -Fq 'refusing unsafe INSTALL_ROOT' "$unsafe_root/output"

echo "Release uninstall validation passed."
