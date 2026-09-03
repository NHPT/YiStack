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
START_SERVICES=false
INSTALL_BROWSER=true

usage() {
  cat <<'EOF'
Usage: sudo ./install.sh [options]

Options:
  --with-postgres         Configure and start the optional PostgreSQL container
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

if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid deployment package version: $VERSION" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "The deployment installer must run as root." >&2
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

if ! grep -Eq '^JWT_SECRET=.{32,}$' "$CONFIG_DIR/yistack.env"; then
  set_env_value "$CONFIG_DIR/yistack.env" JWT_SECRET "$(openssl rand -hex 32)"
fi

service_uid="$(id -u "$SERVICE_USER")"
set_env_value "$CONFIG_DIR/yistack.env" \
  CONTAINER_SOCKET_PATH "/run/user/$service_uid/podman/podman.sock"

loginctl enable-linger "$SERVICE_USER" || true
systemctl start "user@${service_uid}.service"
runuser -u "$SERVICE_USER" -- env \
  HOME="$DATA_DIR" \
  XDG_RUNTIME_DIR="/run/user/$service_uid" \
  systemctl --user enable --now podman.socket

for unit in "$RELEASE_DIR"/systemd/*; do
  install -m 0644 -o root -g root "$unit" "/etc/systemd/system/$(basename "$unit")"
done
systemctl daemon-reload

if [ "$INSTALL_BROWSER" = "true" ]; then
  node_bin="$RELEASE_DIR/runtime/node/bin/node"
  playwright_cli="$RELEASE_DIR/browser-worker/node_modules/playwright/cli.js"
  "$node_bin" "$playwright_cli" install-deps chromium
  runuser -u "$SERVICE_USER" -- env \
    HOME="$DATA_DIR" \
    PLAYWRIGHT_BROWSERS_PATH="$DATA_DIR/ms-playwright" \
    "$node_bin" "$playwright_cli" install chromium
fi

if [ "$WITH_POSTGRES" = "true" ]; then
  if [ ! -f "$CONFIG_DIR/postgres.env" ]; then
    install -m 0640 -o root -g "$SERVICE_GROUP" \
      "$RELEASE_DIR/config/postgres.env.example" \
      "$CONFIG_DIR/postgres.env"
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
  systemctl enable --now yistack-postgres.service
  runuser -u "$SERVICE_USER" -- env \
    HOME="$DATA_DIR" \
    XDG_RUNTIME_DIR="/run/user/$service_uid" \
    "$RELEASE_DIR/bin/yistack-postgres" init
fi

systemctl enable yistack.target
if [ "$START_SERVICES" = "true" ]; then
  systemctl restart yistack.target
fi

echo "YiStack $VERSION installed at $RELEASE_DIR"
echo "Configuration: $CONFIG_DIR/yistack.env"
if [ "$START_SERVICES" = "false" ]; then
  echo "Review the configuration, then run: sudo systemctl start yistack.target"
else
  echo "Run 'sudo yistackctl health' to verify the deployment."
fi
