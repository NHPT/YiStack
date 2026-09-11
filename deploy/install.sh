#!/usr/bin/env bash

set -euo pipefail

PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="$(tr -d '[:space:]' < "$PACKAGE_ROOT/VERSION")"
SERVICE_USER="yistack"
SERVICE_GROUP="yistack"
INSTALL_ROOT="/opt/yistack"
CONFIG_DIR="/etc/yistack"
DATA_DIR="/var/lib/yistack"
LOG_DIR="/var/log/yistack"
CACHE_DIR="/var/cache/yistack"
RELEASE_DIR="$INSTALL_ROOT/releases/$VERSION"
WITH_POSTGRES=false
POSTGRES_IMAGE_OVERRIDE=""
START_SERVICES=false
INSTALL_BROWSER=true
LOCK_FILE="${YISTACK_UPGRADE_LOCK_FILE:-/run/lock/yistack-upgrade.lock}"
LOCK_HELD="${YISTACK_INSTALL_LOCK_HELD:-false}"
HEALTH_ATTEMPTS="${YISTACK_INSTALL_HEALTH_ATTEMPTS:-60}"
HEALTH_SLEEP_SECONDS="${YISTACK_INSTALL_HEALTH_SLEEP_SECONDS:-1}"

run_as_service_user() {
  YISTACK_SERVICE_USER="$SERVICE_USER" \
  YISTACK_DATA_DIR="$DATA_DIR" \
    "$RELEASE_DIR/bin/yistack-service-user-exec" "$@"
}

read_env_value() {
  local key="$1"
  local fallback="$2"
  local value=""
  if [ -r "$CONFIG_DIR/yistack.env" ]; then
    value="$(sed -n "s/^${key}=//p" "$CONFIG_DIR/yistack.env" | tail -n 1)"
  fi
  printf '%s' "${value:-$fallback}"
}

usage() {
  cat <<'EOF'
Usage: sudo ./install.sh [options]

Options:
  --with-postgres         Configure and start the optional PostgreSQL container
  --postgres-image IMAGE  Override the PostgreSQL image before first startup
  --start                 Start YiStack after installation
  --skip-browser-install  Do not download the Playwright Chromium runtime
  --help                  Show this help
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --with-postgres)
      WITH_POSTGRES=true
      ;;
    --postgres-image)
      [ "$#" -ge 2 ] || {
        echo "--postgres-image requires an image reference." >&2
        exit 2
      }
      POSTGRES_IMAGE_OVERRIDE="$2"
      shift
      ;;
    --start)
      START_SERVICES=true
      ;;
    --skip-browser-install)
      INSTALL_BROWSER=false
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if [ -n "$POSTGRES_IMAGE_OVERRIDE" ]; then
  [ "$WITH_POSTGRES" = "true" ] || {
    echo "--postgres-image requires --with-postgres." >&2
    exit 2
  }
  [[ "$POSTGRES_IMAGE_OVERRIDE" =~ ^[A-Za-z0-9][A-Za-z0-9._:/@-]*$ ]] || {
    echo "Invalid PostgreSQL image reference: $POSTGRES_IMAGE_OVERRIDE" >&2
    exit 2
  }
fi

if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid deployment package version: $VERSION" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "The deployment installer must run as root." >&2
  exit 1
fi
[[ "$HEALTH_ATTEMPTS" =~ ^[1-9][0-9]*$ ]] || {
  echo "YISTACK_INSTALL_HEALTH_ATTEMPTS must be a positive integer." >&2
  exit 1
}
[[ "$HEALTH_SLEEP_SECONDS" =~ ^[0-9]+([.][0-9]+)?$ ]] || {
  echo "YISTACK_INSTALL_HEALTH_SLEEP_SECONDS must be a non-negative number." >&2
  exit 1
}
if [ "$LOCK_HELD" != "true" ]; then
  mkdir -p "$(dirname "$LOCK_FILE")"
  exec 9>"$LOCK_FILE"
  flock -n 9 || {
    echo "Another YiStack installation, upgrade, or uninstall is running." >&2
    exit 1
  }
fi
if systemctl is-active --quiet yistack.target ||
  systemctl is-active --quiet yistack-backend.service; then
  echo "Stop YiStack before installing or upgrading: sudo yistackctl stop" >&2
  exit 1
fi

if [ ! -f "$PACKAGE_ROOT/MANIFEST.sha256" ]; then
  echo "Deployment manifest is missing." >&2
  exit 1
fi

(
  cd "$PACKAGE_ROOT"
  sha256sum --check --quiet MANIFEST.sha256
)

if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install --yes \
    bash-completion \
    ca-certificates \
    curl \
    fuse-overlayfs \
    openssl \
    podman \
    slirp4netns \
    uidmap
else
  echo "This deployment package currently supports Debian/Ubuntu apt systems." >&2
  exit 1
fi

if ! getent group "$SERVICE_GROUP" >/dev/null 2>&1; then
  groupadd --system "$SERVICE_GROUP"
fi
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system \
    --gid "$SERVICE_GROUP" \
    --create-home \
    --home-dir "$DATA_DIR" \
    --shell /bin/bash \
    "$SERVICE_USER"
fi

if ! grep -q "^${SERVICE_USER}:" /etc/subuid; then
  echo "${SERVICE_USER}:100000:65536" >> /etc/subuid
fi
if ! grep -q "^${SERVICE_USER}:" /etc/subgid; then
  echo "${SERVICE_USER}:100000:65536" >> /etc/subgid
fi

install -d -m 0755 -o root -g root "$INSTALL_ROOT" "$INSTALL_ROOT/releases"
install -d -m 0750 -o root -g "$SERVICE_GROUP" "$CONFIG_DIR"
install -d -m 0750 -o "$SERVICE_USER" -g "$SERVICE_GROUP" \
  "$DATA_DIR" \
  "$DATA_DIR/runtime/projects" \
  "$DATA_DIR/runtime/templates" \
  "$DATA_DIR/runtime/container-data" \
  "$DATA_DIR/runtime/generation-evidence" \
  "$DATA_DIR/database-backups" \
  "$DATA_DIR/ms-playwright" \
  "$LOG_DIR" \
  "$CACHE_DIR"

stage_dir="$INSTALL_ROOT/releases/.${VERSION}.$$"
rm -rf "$stage_dir"
install -d -m 0755 -o root -g root "$stage_dir"
cp -a "$PACKAGE_ROOT/." "$stage_dir/"
rm -rf "$RELEASE_DIR"
mv "$stage_dir" "$RELEASE_DIR"
ln -sfn "$RELEASE_DIR" "$INSTALL_ROOT/current.new"
mv -Tf "$INSTALL_ROOT/current.new" "$INSTALL_ROOT/current"
chmod 0755 "$RELEASE_DIR/install.sh" "$RELEASE_DIR/bin/"*
install -d -m 0755 -o root -g root /usr/local/bin
ln -sfn "$INSTALL_ROOT/current/bin/yistackctl" /usr/local/bin/yistackctl
install -d -m 0755 -o root -g root /usr/share/bash-completion/completions
"$RELEASE_DIR/bin/yistackctl" completion bash \
  > /usr/share/bash-completion/completions/yistackctl
chmod 0644 /usr/share/bash-completion/completions/yistackctl

if [ ! -f "$CONFIG_DIR/yistack.env" ]; then
  install -m 0640 -o root -g "$SERVICE_GROUP" \
    "$RELEASE_DIR/config/yistack.env.example" \
    "$CONFIG_DIR/yistack.env"
fi

set_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  local escaped_value="${value//\\/\\\\}"
  escaped_value="${escaped_value//&/\\&}"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${escaped_value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

if ! grep -q '^DB_AUTO_MIGRATE=' "$CONFIG_DIR/yistack.env"; then
  set_env_value "$CONFIG_DIR/yistack.env" DB_AUTO_MIGRATE false
fi
set_env_value "$CONFIG_DIR/yistack.env" \
  YISTACK_MIGRATIONS_DIR "$INSTALL_ROOT/current/database/migrations"
if ! grep -q '^YISTACK_DATABASE_BACKUP_DIR=' "$CONFIG_DIR/yistack.env"; then
  set_env_value "$CONFIG_DIR/yistack.env" \
    YISTACK_DATABASE_BACKUP_DIR "$DATA_DIR/database-backups"
fi

if ! grep -Eq '^JWT_SECRET=.{32,}$' "$CONFIG_DIR/yistack.env"; then
  set_env_value "$CONFIG_DIR/yistack.env" JWT_SECRET "$(openssl rand -hex 32)"
fi

service_uid="$(id -u "$SERVICE_USER")"
set_env_value "$CONFIG_DIR/yistack.env" \
  CONTAINER_SOCKET_PATH "/run/user/$service_uid/podman/podman.sock"

loginctl enable-linger "$SERVICE_USER"
systemctl start "user@${service_uid}.service"
run_as_service_user systemctl --user enable --now podman.socket

for unit in "$RELEASE_DIR"/systemd/*; do
  install -m 0644 -o root -g root "$unit" "/etc/systemd/system/$(basename "$unit")"
done
systemctl daemon-reload

if [ "$INSTALL_BROWSER" = "true" ]; then
  node_bin="$RELEASE_DIR/runtime/node/bin/node"
  playwright_cli="$RELEASE_DIR/browser-worker/node_modules/playwright/cli.js"
  "$node_bin" "$playwright_cli" install-deps chromium
  run_as_service_user env \
    PLAYWRIGHT_BROWSERS_PATH="$DATA_DIR/ms-playwright" \
    "$node_bin" "$playwright_cli" install chromium
fi

if [ "$WITH_POSTGRES" = "true" ]; then
  if [ ! -f "$CONFIG_DIR/postgres.env" ]; then
    install -m 0640 -o root -g "$SERVICE_GROUP" \
      "$RELEASE_DIR/config/postgres.env.example" \
      "$CONFIG_DIR/postgres.env"
  fi
  if [ -n "$POSTGRES_IMAGE_OVERRIDE" ]; then
    set_env_value "$CONFIG_DIR/postgres.env" \
      POSTGRES_IMAGE "$POSTGRES_IMAGE_OVERRIDE"
  fi
  if ! grep -Eq '^POSTGRES_PASSWORD=.{24,}$' "$CONFIG_DIR/postgres.env"; then
    set_env_value "$CONFIG_DIR/postgres.env" POSTGRES_PASSWORD "$(openssl rand -hex 24)"
  fi
  postgres_password="$(sed -n 's/^POSTGRES_PASSWORD=//p' "$CONFIG_DIR/postgres.env" | tail -n 1)"
  set_env_value "$CONFIG_DIR/yistack.env" DB_TYPE postgres
  set_env_value "$CONFIG_DIR/yistack.env" DB_HOST 127.0.0.1
  set_env_value "$CONFIG_DIR/yistack.env" DB_PORT 5432
  set_env_value "$CONFIG_DIR/yistack.env" DB_USER postgres
  set_env_value "$CONFIG_DIR/yistack.env" DB_PASSWORD "$postgres_password"
  set_env_value "$CONFIG_DIR/yistack.env" DB_NAME yistack
  set_env_value "$CONFIG_DIR/yistack.env" DB_SSL_MODE disable
  systemctl enable yistack-postgres.service
  systemctl restart yistack-postgres.service
  run_as_service_user "$RELEASE_DIR/bin/yistack-postgres" init
fi

systemctl enable yistack.target
if [ "$START_SERVICES" = "true" ]; then
  echo "Starting YiStack services and waiting for health checks..."
  if ! YISTACK_HEALTH_ATTEMPTS="$HEALTH_ATTEMPTS" \
    YISTACK_HEALTH_SLEEP_SECONDS="$HEALTH_SLEEP_SECONDS" \
    "$RELEASE_DIR/bin/yistackctl" restart; then
    echo "YiStack $VERSION was installed, but startup verification failed." >&2
    echo "Inspect the failure with: sudo yistackctl status" >&2
    echo "Follow service logs with: sudo yistackctl logs" >&2
    exit 1
  fi
fi

echo "YiStack $VERSION installation completed successfully."
echo "Release: $RELEASE_DIR"
echo "Configuration: $CONFIG_DIR/yistack.env"
if [ "$START_SERVICES" = "false" ]; then
  echo "Services: not started"
  echo "Review the configuration, then run: sudo yistackctl start"
else
  frontend_port="$(read_env_value FRONTEND_PORT 5000)"
  echo "Services: started"
  echo "Health check: passed"
  echo "Local URL: http://127.0.0.1:$frontend_port"
fi
if [ "$WITH_POSTGRES" = "true" ]; then
  echo "PostgreSQL: running as a rootless Podman container"
  echo "Inspect it with: sudo yistackctl postgres status"
  echo "List its image with: sudo yistackctl runtime images"
fi
