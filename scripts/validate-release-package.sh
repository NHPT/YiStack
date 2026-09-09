#!/usr/bin/env bash

set -euo pipefail

ARCHIVE_PATH="${1:-}"
EXPECTED_ARCH="${2:-}"
SKIP_RUNTIME_SMOKE="${SKIP_RUNTIME_SMOKE:-false}"

if [ -z "$ARCHIVE_PATH" ]; then
  echo "Usage: $0 <release.tar.gz> [amd64|arm64]" >&2
  exit 2
fi
ARCHIVE_PATH="$(realpath "$ARCHIVE_PATH")"
archive_name="$(basename "$ARCHIVE_PATH")"
if [[ ! "$archive_name" =~ ^(yistack-(v[0-9]+\.[0-9]+\.[0-9]+)-linux-(amd64|arm64))\.tar\.gz$ ]]; then
  echo "Invalid release archive name: $archive_name" >&2
  exit 2
fi
package_name="${BASH_REMATCH[1]}"
package_version="${BASH_REMATCH[2]}"
package_arch="${BASH_REMATCH[3]}"
if [ -n "$EXPECTED_ARCH" ] && [ "$EXPECTED_ARCH" != "$package_arch" ]; then
  echo "Archive architecture is $package_arch, expected $EXPECTED_ARCH" >&2
  exit 1
fi

for command in bash curl diff file find grep realpath sed seq sha256sum tar; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Missing validation command: $command" >&2
    exit 1
  }
done

[ -f "$ARCHIVE_PATH.sha256" ] || {
  echo "Release archive checksum is missing: $ARCHIVE_PATH.sha256" >&2
  exit 1
}
checksum_line="$(< "$ARCHIVE_PATH.sha256")"
if [[ ! "$checksum_line" =~ ^([0-9a-f]{64})\ \ (.+)$ ]] ||
  [ "${BASH_REMATCH[2]:-}" != "$archive_name" ]; then
  echo "Release archive checksum file is invalid: $ARCHIVE_PATH.sha256" >&2
  exit 1
fi
actual_checksum="$(sha256sum "$ARCHIVE_PATH")"
actual_checksum="${actual_checksum%% *}"
[ "$actual_checksum" = "${BASH_REMATCH[1]}" ] || {
  echo "Release archive checksum verification failed: $ARCHIVE_PATH" >&2
  exit 1
}

while IFS= read -r entry; do
  case "$entry" in
    "$package_name" | "$package_name/"*)
      ;;
    *)
      echo "Archive entry escapes the package root: $entry" >&2
      exit 1
      ;;
  esac
  case "/$entry/" in
    *"/../"* | *"/./"*)
      echo "Archive entry contains an unsafe path component: $entry" >&2
      exit 1
      ;;
  esac
done < <(tar -tzf "$ARCHIVE_PATH")

temp_root="$(mktemp -d)"
frontend_pid=""
worker_pid=""
cleanup() {
  for pid in "$frontend_pid" "$worker_pid"; do
    if [ -n "$pid" ]; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" >/dev/null 2>&1 || true
    fi
  done
  rm -rf "$temp_root"
}
trap cleanup EXIT

tar -xzf "$ARCHIVE_PATH" -C "$temp_root"
package_root="$temp_root/$package_name"

required_files=(
  "LICENSE"
  "MANIFEST.sha256"
  "README.en.md"
  "README.md"
  "docs/assets/screenshots/git-delivery.png"
  "docs/assets/screenshots/mobile-preview.png"
  "docs/assets/screenshots/terminal-session.png"
  "docs/assets/screenshots/verified-preview.png"
  "docs/assets/screenshots/workspace-overview.png"
  "SOURCE_COMMIT"
  "VERSION"
  "bin/yistack-database-backup"
  "bin/yistack-ephemeral-maintenance"
  "bin/yistack-frontend"
  "bin/yistack-postgres"
  "bin/yistack-server"
  "bin/yistackctl"
  "browser-worker/browser-acceptance-worker.mjs"
  "browser-worker/lib/browser-acceptance.mjs"
  "browser-worker/node_modules/playwright/package.json"
  "browser-worker/node_modules/playwright-core/package.json"
  "config/postgres.env.example"
  "config/yistack-ephemeral-maintenance.env.example"
  "config/yistack.env.example"
  "database/init.sql"
  "database/migrations/000000000000_contributor_alpha.sql"
  "database/migrations/202609070001_migration_integrity.sql"
  "database/migrations/manifest.json"
  "database/migrations/rollback/000000000000_contributor_alpha.sql"
  "database/migrations/rollback/202609070001_migration_integrity.sql"
  "database/postgres-auth-compat.sql"
  "frontend/.next/BUILD_ID"
  "frontend/.next/static"
  "frontend/server.js"
  "install.sh"
  "upgrade.sh"
  "runtime/node/bin/node"
  "systemd/yistack-backend.service"
  "systemd/yistack-browser-worker.service"
  "systemd/yistack-ephemeral-cleanup.service"
  "systemd/yistack-ephemeral-cleanup.timer"
  "systemd/yistack-ephemeral-reset.service"
  "systemd/yistack-ephemeral-reset.timer"
  "systemd/yistack-frontend.service"
  "systemd/yistack-postgres.service"
  "systemd/yistack.target"
)
for relative_path in "${required_files[@]}"; do
  if [ ! -e "$package_root/$relative_path" ]; then
    echo "Release package is missing $relative_path" >&2
    exit 1
  fi
done

deprecated_files=(
  "bin/yistack-demo-maintenance"
  "config/yistack-demo-maintenance.env.example"
  "systemd/yistack-demo-cleanup.service"
  "systemd/yistack-demo-cleanup.timer"
  "systemd/yistack-demo-reset.service"
  "systemd/yistack-demo-reset.timer"
)
for relative_path in "${deprecated_files[@]}"; do
  if [ -e "$package_root/$relative_path" ]; then
    echo "Release package retained deprecated maintenance file $relative_path" >&2
    exit 1
  fi
done

for screenshot in "$package_root/docs/assets/screenshots/"*.png; do
  case "$(file -b "$screenshot")" in
    "PNG image data, 1600 x 1000"*)
      ;;
    *)
      echo "Release screenshot has an unexpected format or size: $screenshot" >&2
      exit 1
      ;;
  esac
done

if [ "$(tr -d '[:space:]' < "$package_root/VERSION")" != "$package_version" ]; then
  echo "VERSION does not match the archive name." >&2
  exit 1
fi
if ! grep -Eq '^[0-9a-f]{40}$' "$package_root/SOURCE_COMMIT"; then
  echo "SOURCE_COMMIT is not a full Git commit SHA." >&2
  exit 1
fi

if ! manifest_output="$(cd "$package_root" && sha256sum --check MANIFEST.sha256 2>&1)"; then
  printf '%s\n' "$manifest_output" >&2
  exit 1
fi

while IFS= read -r link_path; do
  resolved_path="$(realpath -m "$link_path")"
  case "$resolved_path" in
    "$package_root"/*)
      ;;
    *)
      echo "Release package contains an external symlink: $link_path" >&2
      exit 1
      ;;
  esac
  if [ ! -e "$link_path" ]; then
    echo "Release package contains a dangling symlink: $link_path" >&2
    exit 1
  fi
done < <(find "$package_root" -type l -print)

for script in \
  "$package_root/install.sh" \
  "$package_root/upgrade.sh" \
  "$package_root/bin/yistack-database-backup" \
  "$package_root/bin/yistack-ephemeral-maintenance" \
  "$package_root/bin/yistack-frontend" \
  "$package_root/bin/yistack-postgres" \
  "$package_root/bin/yistackctl"; do
  [ -x "$script" ] || {
    echo "Release script is not executable: $script" >&2
    exit 1
  }
  bash -n "$script"
done
install_help="$("$package_root/install.sh" --help)"
grep -Fq -- "--postgres-image IMAGE" <<< "$install_help" || {
  echo "Release installer does not expose the PostgreSQL image override." >&2
  exit 1
}
"$package_root/upgrade.sh" --help >/dev/null
"$package_root/bin/yistack-ephemeral-maintenance" --help >/dev/null
yistackctl_help="$("$package_root/bin/yistackctl" help)"
for command in start stop restart status logs health postgres database upgrade ephemeral completion; do
  grep -Eq "^  ${command}( |$)" <<< "$yistackctl_help" || {
    echo "yistackctl help is missing the $command command." >&2
    exit 1
  }
done
if grep -Eq '^  demo( |$)' <<< "$yistackctl_help"; then
  echo "yistackctl help retained the deprecated demo command." >&2
  exit 1
fi

completion_script="$temp_root/yistackctl-completion.bash"
"$package_root/bin/yistackctl" completion bash > "$completion_script"
bash -n "$completion_script"
completion_result="$(
  bash -c '
    source "$1"
    COMP_WORDS=(yistackctl ep)
    COMP_CWORD=1
    _yistackctl
    printf "%s\n" "${COMPREPLY[@]}"
  ' _ "$completion_script"
)"
grep -Fqx ephemeral <<< "$completion_result" || {
  echo "Bash completion does not expose the ephemeral command." >&2
  exit 1
}
completion_result="$(
  bash -c '
    source "$1"
    COMP_WORDS=(yistackctl database m)
    COMP_CWORD=2
    _yistackctl
    printf "%s\n" "${COMPREPLY[@]}"
  ' _ "$completion_script"
)"
grep -Fqx migrate <<< "$completion_result" || {
  echo "Bash completion does not expose database migrate." >&2
  exit 1
}

mock_bin="$temp_root/mock-bin"
systemctl_log="$temp_root/systemctl.log"
mkdir -p "$mock_bin"
cat > "$mock_bin/systemctl" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$SYSTEMCTL_LOG"
EOF
chmod 0755 "$mock_bin/systemctl"
for command in start stop restart; do
  PATH="$mock_bin:$PATH" SYSTEMCTL_LOG="$systemctl_log" \
    "$package_root/bin/yistackctl" "$command"
done
printf '%s\n' \
  'start yistack.target' \
  'stop yistack.target' \
  'restart yistack.target' > "$temp_root/expected-systemctl.log"
if ! diff -u "$temp_root/expected-systemctl.log" "$systemctl_log"; then
  echo "yistackctl service commands do not control yistack.target as expected." >&2
  exit 1
fi

backend_description="$(file -b "$package_root/bin/yistack-server")"
node_description="$(file -b "$package_root/runtime/node/bin/node")"
case "$package_arch" in
  amd64)
    expected_machine="x86-64"
    ;;
  arm64)
    expected_machine="ARM aarch64"
    ;;
esac
for description in "$backend_description" "$node_description"; do
  case "$description" in
    *ELF*"$expected_machine"*)
      ;;
    *)
      echo "Unexpected executable architecture: $description" >&2
      exit 1
      ;;
  esac
done
case "$backend_description" in
  *"statically linked"*)
    ;;
  *)
    echo "The Go backend is not statically linked: $backend_description" >&2
    exit 1
    ;;
esac

case "$(uname -m):$package_arch" in
  x86_64:amd64 | aarch64:arm64 | arm64:arm64)
    native_package=true
    ;;
  *)
    native_package=false
    ;;
esac

wait_for_url() {
  local url="$1"
  local log_file="$2"
  for _ in $(seq 1 30); do
    if curl --fail --silent --show-error "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  sed -n '1,160p' "$log_file" >&2 || true
  return 1
}

if [ "$SKIP_RUNTIME_SMOKE" != "true" ] && [ "$native_package" = "true" ]; then
  bundled_node="$package_root/runtime/node/bin/node"
  case "$("$bundled_node" --version)" in
    v22.*)
      ;;
    *)
      echo "The deployment package must contain Node.js 22." >&2
      exit 1
      ;;
  esac

  frontend_port="$((42000 + $$ % 1000))"
  frontend_env="$temp_root/frontend.env"
  printf '%s\n' \
    'FRONTEND_HOST=127.0.0.1' \
    "FRONTEND_PORT=$frontend_port" \
    'BACKEND_URL=http://127.0.0.1:8080' \
    'SUPABASE_SERVICE_ROLE_KEY=must-not-reach-frontend' \
    > "$frontend_env"
  (
    cd "$package_root/frontend"
    export YISTACK_INSTALL_DIR="$package_root"
    export YISTACK_ENV_FILE="$frontend_env"
    exec "$package_root/bin/yistack-frontend"
  ) >"$temp_root/frontend.log" 2>&1 &
  frontend_pid=$!
  wait_for_url "http://127.0.0.1:$frontend_port/auth" "$temp_root/frontend.log"
  if tr '\0' '\n' < "/proc/$frontend_pid/environ" | grep -q '^SUPABASE_SERVICE_ROLE_KEY='; then
    echo "Frontend process received a backend-only secret." >&2
    exit 1
  fi
  if ! tr '\0' '\n' < "/proc/$frontend_pid/environ" | grep -q '^BACKEND_URL=http://127.0.0.1:8080$'; then
    echo "Frontend process did not receive its allowlisted backend URL." >&2
    exit 1
  fi

  worker_port="$((43000 + $$ % 1000))"
  BROWSER_ACCEPTANCE_WORKER_PORT="$worker_port" \
    PLAYWRIGHT_BROWSERS_PATH="$temp_root/ms-playwright" \
    "$bundled_node" "$package_root/browser-worker/browser-acceptance-worker.mjs" \
    >"$temp_root/browser-worker.log" 2>&1 &
  worker_pid=$!
  wait_for_url "http://127.0.0.1:$worker_port/health" "$temp_root/browser-worker.log"
fi

echo "Release package validation passed: $archive_name"
