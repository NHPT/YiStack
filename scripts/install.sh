#!/bin/bash
# install.sh - YiStack 安装脚本
# 当前阶段负责检测并自动安装项目运行所需的 Podman 环境，
# 并初始化生产部署所需的服务用户、目录和环境配置。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

RUNTIME="podman"
INSTALL_MODE="${INSTALL_MODE:-production}"
SERVICE_USER="${YISTACK_USER:-yistack}"
SERVICE_GROUP="${YISTACK_GROUP:-yistack}"

if [ "$INSTALL_MODE" = "development" ]; then
  INSTALL_DIR="${INSTALL_DIR:-$ROOT_DIR}"
  CONFIG_DIR="${CONFIG_DIR:-$ROOT_DIR/.yistack}"
  DATA_DIR="${DATA_DIR:-$ROOT_DIR/runtime}"
  LOG_DIR="${LOG_DIR:-$ROOT_DIR/logs}"
  CACHE_DIR="${CACHE_DIR:-$ROOT_DIR/.cache/yistack}"
  PROJECT_DIR="${PROJECT_DIR:-$DATA_DIR/projects}"
  TEMPLATE_DIR="${TEMPLATE_DIR:-$DATA_DIR/templates}"
  CONTAINER_DATA_DIR="${CONTAINER_DATA_DIR:-$DATA_DIR/container-data}"
else
  INSTALL_DIR="${INSTALL_DIR:-/opt/yistack}"
  CONFIG_DIR="${CONFIG_DIR:-/etc/yistack}"
  DATA_DIR="${DATA_DIR:-/var/lib/yistack}"
  LOG_DIR="${LOG_DIR:-/var/log/yistack}"
  CACHE_DIR="${CACHE_DIR:-/var/cache/yistack}"
  PROJECT_DIR="${PROJECT_DIR:-$DATA_DIR/runtime/projects}"
  TEMPLATE_DIR="${TEMPLATE_DIR:-$DATA_DIR/runtime/templates}"
  CONTAINER_DATA_DIR="${CONTAINER_DATA_DIR:-$DATA_DIR/runtime/container-data}"
fi

ENV_FILE="${ENV_FILE:-$CONFIG_DIR/yistack.env}"
SOCKET_PATH="${SOCKET_PATH:-}"
PODMAN_CONFIGURE_MIRRORS="${PODMAN_CONFIGURE_MIRRORS:-true}"
PODMAN_DOCKER_IO_MIRRORS="${PODMAN_DOCKER_IO_MIRRORS:-https://docker.1ms.run https://docker.xuanyuan.me https://docker.1panel.live https://dockerproxy.net}"
OS_ID=""
OS_VERSION_ID=""
OS_VERSION_CODENAME=""
ARCH=""

load_os_info() {
  if [ -f /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    OS_ID="${ID:-}"
    OS_VERSION_ID="${VERSION_ID:-}"
    OS_VERSION_CODENAME="${VERSION_CODENAME:-}"
  fi
  ARCH="$(uname -m)"
}

package_available() {
  local pm="$1"
  local pkg="$2"

  case "$pm" in
    apt)
      apt-cache show "$pkg" >/dev/null 2>&1
      ;;
    dnf|yum)
      "$pm" info "$pkg" >/dev/null 2>&1
      ;;
    *)
      return 1
      ;;
  esac
}

package_available_in_target() {
  local target="$1"
  local pkg="$2"
  apt-cache -o APT::Default-Release="$target" show "$pkg" >/dev/null 2>&1
}

apt_repo_exists() {
  local url="$1"
  curl -fsSLI "$url/Release" >/dev/null 2>&1
}

detect_package_manager() {
  if command -v apt-get >/dev/null 2>&1; then
    echo "apt"
    return
  fi
  if command -v dnf >/dev/null 2>&1; then
    echo "dnf"
    return
  fi
  if command -v yum >/dev/null 2>&1; then
    echo "yum"
    return
  fi
  echo ""
}

run_privileged() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
    return
  fi
  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
    return
  fi
  echo "❌ 当前需要 root 或 sudo 权限执行安装: $*"
  exit 1
}

default_socket_path() {
  local uid
  if [ "$INSTALL_MODE" = "production" ] && id "$SERVICE_USER" >/dev/null 2>&1; then
    uid="$(id -u "$SERVICE_USER")"
  else
    uid="$(id -u)"
  fi
  echo "/run/user/$uid/podman/podman.sock"
}

ensure_apt_base_dependencies() {
  run_privileged apt-get install -y curl gnupg2 ca-certificates apt-transport-https
}

ensure_podman_apt_repo() {
  local repo_url=""
  local key_url=""
  local repo_file="/etc/apt/sources.list.d/devel:kubic:libcontainers:stable.list"
  local keyring="/usr/share/keyrings/libcontainers-archive-keyring.gpg"

  case "$OS_ID:$OS_VERSION_ID" in
    debian:10)
      repo_url="https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable/Debian_10/"
      key_url="${repo_url}Release.key"
      ;;
    ubuntu:20.04)
      repo_url="https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable/xUbuntu_20.04/"
      key_url="${repo_url}Release.key"
      ;;
    ubuntu:18.04)
      repo_url="https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable/xUbuntu_18.04/"
      key_url="${repo_url}Release.key"
      ;;
    *)
      return 1
      ;;
  esac

  if ! apt_repo_exists "$repo_url"; then
    return 1
  fi

  echo "📦 当前系统原生仓库未提供 podman，自动接入 libcontainers 仓库..."
  ensure_apt_base_dependencies
  curl -fsSL "$key_url" | gpg --dearmor | run_privileged tee "$keyring" >/dev/null
  echo "deb [signed-by=$keyring] $repo_url /" | run_privileged tee "$repo_file" >/dev/null
  run_privileged apt-get update
  return 0
}

install_rootless_dependencies_apt() {
  local packages=(uidmap slirp4netns fuse-overlayfs)
  run_privileged apt-get install -y "${packages[@]}" || true
}

prepare_debian10_podman_dependencies() {
  if [ "$OS_ID" = "debian" ] && [ "$OS_VERSION_ID" = "10" ]; then
    if package_available_in_target buster-backports libseccomp2 && \
       package_available_in_target buster-backports libnftables1 && \
       package_available_in_target buster-backports libnftnl11 && \
       package_available_in_target buster-backports nftables && \
       package_available_in_target buster-backports libprotobuf23 && \
       package_available_in_target buster-backports python3-protobuf; then
      echo "📦 升级 Debian 10 所需的 Podman 基础依赖到 buster-backports 版本..."
      run_privileged apt-get install -y -t buster-backports \
        libseccomp2 \
        libnftnl11 \
        libnftables1 \
        nftables \
        libprotobuf23 \
        python3-protobuf
    else
      echo "❌ Debian 10 安装 podman 需要 buster-backports 中更新的 libseccomp2/libnftables/libprotobuf 依赖，但当前源不可用"
      exit 1
    fi
  fi
}

install_podman_bundle_apt() {
  local packages=()

  if [ "$OS_ID" = "debian" ] && [ "$OS_VERSION_ID" = "10" ]; then
    packages+=(
      libseccomp2/buster-backports
      libnftnl11/buster-backports
      libnftables1/buster-backports
      nftables/buster-backports
      libprotobuf23/buster-backports
      python3-protobuf/buster-backports
    )
  fi

  packages+=(
    podman
    criu
    crun
    conmon
    containers-common
    uidmap
    slirp4netns
    containernetworking-plugins
    fuse-overlayfs
  )
  run_privileged apt-get install -y "${packages[@]}"
}

install_rootless_dependencies_rpm() {
  local pm="$1"
  local packages=(uidmap slirp4netns fuse-overlayfs)
  run_privileged "$pm" install -y "${packages[@]}" || true
}

configure_rootless_podman() {
  local username="$1"

  if command -v loginctl >/dev/null 2>&1; then
    run_privileged loginctl enable-linger "$username" || true
  fi

  if ! grep -q "^${username}:" /etc/subuid 2>/dev/null; then
    echo "🔧 配置 /etc/subuid for $username"
    echo "${username}:100000:65536" | run_privileged tee -a /etc/subuid >/dev/null
  fi

  if ! grep -q "^${username}:" /etc/subgid 2>/dev/null; then
    echo "🔧 配置 /etc/subgid for $username"
    echo "${username}:100000:65536" | run_privileged tee -a /etc/subgid >/dev/null
  fi
}

write_podman_registry_config_file() {
  local target_file="$1"
  local tmp_file
  tmp_file="$(mktemp)"

  {
    cat <<EOF
# YiStack managed Podman registry mirror configuration
# Generated by scripts/install.sh

unqualified-search-registries = ["docker.io"]

[[registry]]
prefix = "docker.io"
location = "docker.io"
EOF

    for mirror in $PODMAN_DOCKER_IO_MIRRORS; do
      if [ -z "$mirror" ]; then
        continue
      fi
      local mirror_location="${mirror#http://}"
      mirror_location="${mirror_location#https://}"
      cat <<EOF

[[registry.mirror]]
location = "$mirror_location"
EOF
    done
  } > "$tmp_file"

  if [ -f "$target_file" ]; then
    cp "$target_file" "$target_file.bak.$(date +%Y%m%d%H%M%S)" || true
  fi

  install -m 0644 "$tmp_file" "$target_file"
  rm -f "$tmp_file"
}

configure_podman_registry_mirrors() {
  if [ "$PODMAN_CONFIGURE_MIRRORS" != "true" ]; then
    echo "ℹ️  已跳过 Podman registry mirror 配置"
    return
  fi

  if [ -z "$PODMAN_DOCKER_IO_MIRRORS" ]; then
    echo "ℹ️  未配置 PODMAN_DOCKER_IO_MIRRORS，跳过 Podman registry mirror 配置"
    return
  fi

  echo "🪞 配置 Podman docker.io 镜像源..."
  if [ "$INSTALL_MODE" = "production" ]; then
    local config_dir="$DATA_DIR/.config/containers"
    local config_file="$config_dir/registries.conf"
    run_privileged mkdir -p "$config_dir"
    run_privileged chown -R "$SERVICE_USER":"$SERVICE_GROUP" "$DATA_DIR/.config"
    run_privileged runuser -u "$SERVICE_USER" -- mkdir -p "$config_dir"
    run_privileged runuser -u "$SERVICE_USER" -- bash -c "$(declare -f write_podman_registry_config_file); PODMAN_DOCKER_IO_MIRRORS=\"$PODMAN_DOCKER_IO_MIRRORS\" write_podman_registry_config_file \"$config_file\""
    run_privileged chown "$SERVICE_USER":"$SERVICE_GROUP" "$config_file"
    echo "✅ 已写入 Podman registry mirror 配置: $config_file"
    return
  fi

  local config_dir="$HOME/.config/containers"
  local config_file="$config_dir/registries.conf"
  mkdir -p "$config_dir"
  write_podman_registry_config_file "$config_file"
  echo "✅ 已写入 Podman registry mirror 配置: $config_file"
}

install_runtime() {
  local pm="$1"
  echo "📦 自动安装 $RUNTIME ..."
  case "$pm" in
    apt)
      run_privileged apt-get update
      if package_available apt podman; then
        prepare_debian10_podman_dependencies
        install_podman_bundle_apt
        install_rootless_dependencies_apt
        return
      fi

      if package_available_in_target buster-backports podman; then
        prepare_debian10_podman_dependencies
        run_privileged apt-get install -y -t buster-backports podman
        install_rootless_dependencies_apt
        return
      fi

      if ensure_podman_apt_repo && package_available apt podman; then
        prepare_debian10_podman_dependencies
        install_podman_bundle_apt
        install_rootless_dependencies_apt
        return
      fi

      echo "❌ 当前 apt 源和兼容仓库中都无法安装 podman。"
      echo "   系统: ${OS_ID:-unknown} ${OS_VERSION_ID:-unknown} (${OS_VERSION_CODENAME:-unknown})"
      echo "   建议先检查外网访问、仓库源策略或安全代理策略。"
      echo "   当前脚本不自动走 GitHub 二进制安装，因为 Podman 在 Linux 上还依赖 conmon/crun/uidmap/fuse-overlayfs 等组件，"
      echo "   直接下发二进制会让 rootless、socket、systemd 集成变得不稳定。"
      exit 1
      ;;
    dnf|yum)
      if ! package_available "$pm" podman; then
        echo "❌ 当前 $pm 源中不存在 podman 包"
        exit 1
      fi
      run_privileged "$pm" install -y podman
      install_rootless_dependencies_rpm "$pm"
      ;;
    *)
      echo "❌ 未识别当前系统包管理器，无法自动安装 $RUNTIME"
      exit 1
      ;;
  esac
}

ensure_runtime() {
  if command -v "$RUNTIME" >/dev/null 2>&1; then
    echo "✅ 运行时已安装: $("$RUNTIME" --version | head -n 1)"
    return
  fi

  local pm
  pm="$(detect_package_manager)"
  install_runtime "$pm"

  if ! command -v "$RUNTIME" >/dev/null 2>&1; then
    echo "❌ $RUNTIME 安装后仍不可用"
    exit 1
  fi

  echo "✅ 运行时安装完成: $("$RUNTIME" --version | head -n 1)"
}

ensure_runtime_service() {
  if ! command -v systemctl >/dev/null 2>&1; then
    return
  fi

  echo "🔌 启动 Podman Socket..."
  if [ "$INSTALL_MODE" = "production" ]; then
    local service_uid
    service_uid="$(id -u "$SERVICE_USER")"
    run_privileged loginctl enable-linger "$SERVICE_USER" || true
    run_privileged runuser -u "$SERVICE_USER" -- env XDG_RUNTIME_DIR="/run/user/$service_uid" systemctl --user enable --now podman.socket || true
    return
  fi

  systemctl --user enable --now podman.socket || true
}

ensure_service_user() {
  if [ "$INSTALL_MODE" != "production" ]; then
    configure_rootless_podman "$(id -un)"
    return
  fi

  if ! getent group "$SERVICE_GROUP" >/dev/null 2>&1; then
    echo "👤 创建服务用户组: $SERVICE_GROUP"
    run_privileged groupadd --system "$SERVICE_GROUP"
  fi

  if ! id "$SERVICE_USER" >/dev/null 2>&1; then
    echo "👤 创建服务用户: $SERVICE_USER"
    run_privileged useradd --system \
      --gid "$SERVICE_GROUP" \
      --create-home \
      --home-dir "$DATA_DIR" \
      --shell /bin/bash \
      "$SERVICE_USER"
  fi

  configure_rootless_podman "$SERVICE_USER"
}

ensure_directories() {
  if [ "$INSTALL_MODE" = "production" ]; then
    run_privileged mkdir -p \
      "$INSTALL_DIR" \
      "$CONFIG_DIR" \
      "$PROJECT_DIR" \
      "$TEMPLATE_DIR" \
      "$CONTAINER_DATA_DIR" \
      "$LOG_DIR" \
      "$CACHE_DIR"
    run_privileged chown -R root:root "$INSTALL_DIR"
    run_privileged chown -R root:"$SERVICE_GROUP" "$CONFIG_DIR"
    run_privileged chown -R "$SERVICE_USER":"$SERVICE_GROUP" "$DATA_DIR" "$LOG_DIR" "$CACHE_DIR"
    run_privileged chmod 755 "$INSTALL_DIR"
    run_privileged chmod 750 "$CONFIG_DIR" "$DATA_DIR" "$LOG_DIR" "$CACHE_DIR"
  else
    mkdir -p \
      "$INSTALL_DIR" \
      "$CONFIG_DIR" \
      "$PROJECT_DIR" \
      "$TEMPLATE_DIR" \
      "$CONTAINER_DATA_DIR" \
      "$LOG_DIR" \
      "$CACHE_DIR"
  fi

  echo "✅ 已确保目录存在:"
  echo "   INSTALL_DIR=$INSTALL_DIR"
  echo "   CONFIG_DIR=$CONFIG_DIR"
  echo "   PROJECT_DIR=$PROJECT_DIR"
  echo "   TEMPLATE_DIR=$TEMPLATE_DIR"
  echo "   CONTAINER_DATA_DIR=$CONTAINER_DATA_DIR"
  echo "   LOG_DIR=$LOG_DIR"
  echo "   CACHE_DIR=$CACHE_DIR"
}

write_env_file() {
  if [ "$INSTALL_MODE" != "production" ]; then
    return
  fi

  local socket_path="$SOCKET_PATH"
  local tmp_file
  tmp_file="$(mktemp)"
  cat > "$tmp_file" <<EOF
# YiStack production environment
# Generated by scripts/install.sh

CONTAINER_ENABLED=true
CONTAINER_RUNTIME=podman
CONTAINER_SOCKET_PATH=$socket_path
CONTAINER_PROJECT_DIR=$PROJECT_DIR
CONTAINER_TEMPLATE_DIR=$TEMPLATE_DIR
CONTAINER_DATA_DIR=$CONTAINER_DATA_DIR

YISTACK_INSTALL_DIR=$INSTALL_DIR
YISTACK_CONFIG_DIR=$CONFIG_DIR
YISTACK_DATA_DIR=$DATA_DIR
YISTACK_LOG_DIR=$LOG_DIR
YISTACK_CACHE_DIR=$CACHE_DIR
EOF

  run_privileged install -m 0640 -o root -g "$SERVICE_GROUP" "$tmp_file" "$ENV_FILE"
  rm -f "$tmp_file"
  echo "✅ 已写入生产环境配置: $ENV_FILE"
}

write_systemd_service_hint() {
  if [ "$INSTALL_MODE" != "production" ]; then
    return
  fi

  local service_file="$CONFIG_DIR/yistack.service.example"
  local tmp_file
  tmp_file="$(mktemp)"
  cat > "$tmp_file" <<EOF
[Unit]
Description=YiStack Backend
After=network.target

[Service]
User=$SERVICE_USER
Group=$SERVICE_GROUP
EnvironmentFile=$ENV_FILE
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/yistack-server
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  run_privileged install -m 0640 -o root -g "$SERVICE_GROUP" "$tmp_file" "$service_file"
  rm -f "$tmp_file"
  echo "✅ 已写入 systemd 服务示例: $service_file"
}

preheat_runtime_images() {
  if [ "${YISTACK_PREHEAT_ON_INSTALL:-true}" != "true" ]; then
    echo "ℹ️  已跳过安装阶段镜像预热"
    return
  fi

  if [ ! -x "$ROOT_DIR/scripts/preheat.sh" ]; then
    echo "⚠️  未找到镜像预热脚本: $ROOT_DIR/scripts/preheat.sh"
    return
  fi

  echo "🔥 预热常用开发镜像..."
  if [ "$INSTALL_MODE" = "production" ]; then
    local service_uid
    service_uid="$(id -u "$SERVICE_USER")"
    run_privileged runuser -u "$SERVICE_USER" -- env \
      XDG_RUNTIME_DIR="/run/user/$service_uid" \
      CONTAINER_RUNTIME="$RUNTIME" \
      "$ROOT_DIR/scripts/preheat.sh" || true
    return
  fi

  CONTAINER_RUNTIME="$RUNTIME" "$ROOT_DIR/scripts/preheat.sh" || true
}

main() {
  load_os_info
  echo "🚀 Installing YiStack runtime dependencies..."
  echo "   Project root: $ROOT_DIR"
  echo "   Runtime: $RUNTIME"
  echo "   Install mode: $INSTALL_MODE"
  echo "   OS: ${OS_ID:-unknown} ${OS_VERSION_ID:-unknown} ${OS_VERSION_CODENAME:-}"

  ensure_runtime
  ensure_service_user
  if [ -z "$SOCKET_PATH" ]; then
    SOCKET_PATH="$(default_socket_path)"
  fi
  ensure_directories
  configure_podman_registry_mirrors
  ensure_runtime_service
  write_env_file
  write_systemd_service_hint

  if [ -S "$SOCKET_PATH" ]; then
    echo "✅ 检测到 Socket: $SOCKET_PATH"
    preheat_runtime_images
  else
    echo "⚠️  未检测到 Socket: $SOCKET_PATH"
    if [ "$INSTALL_MODE" = "production" ]; then
      echo "   请确认 $SERVICE_USER 用户的 rootless podman.socket 已启动。"
      echo "   可手动执行: sudo loginctl enable-linger $SERVICE_USER"
      echo "             sudo runuser -u $SERVICE_USER -- systemctl --user enable --now podman.socket"
    else
      echo "   请确认当前用户的 rootless podman.socket 已启动。"
    fi
  fi

  echo "✅ YiStack 安装脚本执行完成"
}

main "$@"
