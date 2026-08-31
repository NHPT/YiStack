#!/bin/bash
# dev.sh - 开发环境启动脚本
# 同时启动前端 (Next.js) 和后端 (Go + Hertz)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR"
LOG_DIR="$ROOT_DIR/logs"
ROOT_ENV_FILE="${ROOT_ENV_FILE:-$ROOT_DIR/.env}"

PODMAN_SERVICE_PID=""

load_env_file() {
    local env_file="$1"
    if [ -f "$env_file" ]; then
        # shellcheck disable=SC1090
        set -a
        source "$env_file"
        set +a
    fi
}

load_env_file "$ROOT_ENV_FILE"

# 安装 Go（优先使用系统已有版本；不存在或版本过低时再安装）
install_go() {
    local GO_VERSION="1.21.6"
    local GO_ARCH="linux-amd64"
    local TARBALL="/tmp/go.tar.gz"
    local GO_BIN=""

    normalize_version() {
        local version="$1"
        IFS='.' read -r major minor patch <<< "$version"
        major=${major:-0}
        minor=${minor:-0}
        patch=${patch:-0}
        printf "%03d%03d%03d" "$major" "$minor" "$patch"
    }

    version_ge() {
        [ "$(normalize_version "$1")" -ge "$(normalize_version "$2")" ]
    }

    # 优先使用系统 PATH 中已有的 Go
    if GO_BIN=$(command -v go 2>/dev/null); then
        local CURRENT_VERSION
        CURRENT_VERSION=$("$GO_BIN" version 2>/dev/null | sed -n 's/.*go\([0-9][0-9.]*\).*/\1/p' | head -1)
        if [ -n "$CURRENT_VERSION" ] && version_ge "$CURRENT_VERSION" "$GO_VERSION"; then
            echo "✅ Using system Go: $("$GO_BIN" version)"
            "$GO_BIN" env -w GOPROXY=https://goproxy.cn,direct
            "$GO_BIN" env -w GO111MODULE=on
            "$GO_BIN" env -w GOSUMDB=off
            return 0
        fi

        if [ -n "$CURRENT_VERSION" ]; then
            echo "⚠️  System Go version $CURRENT_VERSION is lower than required $GO_VERSION, will install Go $GO_VERSION"
        else
            echo "⚠️  Found Go at $GO_BIN but failed to parse version, will install Go $GO_VERSION"
        fi
    fi

    echo "📦 Installing Go $GO_VERSION..."

    # 尝试多个下载源
    local DOWNLOAD_SUCCESS=false

    # 源1: 华为云镜像
    if [ "$DOWNLOAD_SUCCESS" = "false" ]; then
        echo "   Trying Huawei Cloud mirror..."
        curl -fsSL --connect-timeout 10 --max-time 120 "https://mirrors.huaweicloud.com/golang/go${GO_VERSION}.${GO_ARCH}.tar.gz" -o "$TARBALL" 2>/dev/null && DOWNLOAD_SUCCESS=true
    fi

    # 源2: 腾讯云镜像
    if [ "$DOWNLOAD_SUCCESS" = "false" ]; then
        echo "   Trying Tencent Cloud mirror..."
        curl -fsSL --connect-timeout 10 --max-time 120 "https://mirrors.cloud.tencent.com/golang/go${GO_VERSION}.${GO_ARCH}.tar.gz" -o "$TARBALL" 2>/dev/null && DOWNLOAD_SUCCESS=true
    fi

    # 源3: golang.google.cn
    if [ "$DOWNLOAD_SUCCESS" = "false" ]; then
        echo "   Trying Google CN mirror..."
        curl -fsSL --connect-timeout 10 --max-time 120 "https://golang.google.cn/dl/go${GO_VERSION}.${GO_ARCH}.tar.gz" -o "$TARBALL" 2>/dev/null && DOWNLOAD_SUCCESS=true
    fi

    if [ "$DOWNLOAD_SUCCESS" = "true" ]; then
        # 解压到临时目录
        rm -rf /tmp/go-extract
        mkdir -p /tmp/go-extract
        tar -C /tmp/go-extract -xzf $TARBALL
        rm $TARBALL

        # 安装到 /usr/local/go
        rm -rf /usr/local/go
        mv /tmp/go-extract/go /usr/local/go
        rm -rf /tmp/go-extract

        # 创建符号链接到 PATH 目录
        ln -sf /usr/local/go/bin/go /usr/bin/go
        ln -sf /usr/local/go/bin/gofmt /usr/bin/gofmt 2>/dev/null || true

        # 配置 GOPROXY（永久生效）
        /usr/bin/go env -w GOPROXY=https://goproxy.cn,direct
        /usr/bin/go env -w GO111MODULE=on
        /usr/bin/go env -w GOSUMDB=off

        echo "✅ Go installed: $(/usr/bin/go version)"
        echo "✅ GOPROXY configured: https://goproxy.cn,direct"
    else
        echo "❌ Failed to download Go"
        return 1
    fi
}

# 安装 Go
install_go

# Go 已安装到 /usr/bin，无需额外 PATH 配置
# GOPROXY 已在 install_go 中配置为永久生效

BACKEND_HOST=${APP_HOST:-127.0.0.1}
BACKEND_PORT=${APP_PORT:-${BACKEND_PORT:-8080}}
FRONTEND_HOST=${FRONTEND_HOST:-127.0.0.1}
FRONTEND_PORT=${FRONTEND_PORT:-${DEPLOY_RUN_PORT:-5000}}
NEXT_DIST_DIR=${NEXT_DIST_DIR:-.next-dev}
HOST_IPS=$(hostname -I 2>/dev/null | xargs)
DEFAULT_ALLOWED_DEV_ORIGINS="localhost,127.0.0.1"
if [ -n "$HOST_IPS" ]; then
    for host_ip in $HOST_IPS; do
        if [ -n "$host_ip" ]; then
            DEFAULT_ALLOWED_DEV_ORIGINS="$DEFAULT_ALLOWED_DEV_ORIGINS,$host_ip"
        fi
    done
fi
NEXT_ALLOWED_DEV_ORIGINS=${NEXT_ALLOWED_DEV_ORIGINS:-$DEFAULT_ALLOWED_DEV_ORIGINS}

init_podman_socket() {
    if ! command -v podman >/dev/null 2>&1; then
        echo "❌ Podman is required because all project operations run inside containers."
        exit 1
    fi

    local uid
    uid="$(id -u)"
    local socket_path="${CONTAINER_SOCKET_PATH:-/run/user/$uid/podman/podman.sock}"

    export CONTAINER_ENABLED="${CONTAINER_ENABLED:-true}"
    export CONTAINER_SOCKET_PATH="$socket_path"

    echo "🐳 Preparing Podman runtime..."
    echo "   Socket: $CONTAINER_SOCKET_PATH"

    if [ -S "$CONTAINER_SOCKET_PATH" ]; then
        echo "✅ Podman socket is ready"
        return 0
    fi

    if command -v systemctl >/dev/null 2>&1 && systemctl --user start podman.socket >/dev/null 2>&1; then
        sleep 1
    fi

    if [ ! -S "$CONTAINER_SOCKET_PATH" ]; then
        mkdir -p "$(dirname "$CONTAINER_SOCKET_PATH")"
        podman system service --time=0 "unix://$CONTAINER_SOCKET_PATH" > "$LOG_DIR/podman-service.log" 2>&1 &
        PODMAN_SERVICE_PID=$!
        sleep 2
    fi

    if [ ! -S "$CONTAINER_SOCKET_PATH" ]; then
        echo "❌ Podman socket is not available."
        echo "   Try manually: systemctl --user start podman.socket"
        echo "   Or check:     podman system service --time=0 unix://$CONTAINER_SOCKET_PATH"
        if [ -f "$LOG_DIR/podman-service.log" ]; then
            echo "---- podman-service.log ----"
            sed -n '1,120p' "$LOG_DIR/podman-service.log" || true
        fi
        exit 1
    fi

    echo "✅ Podman socket is ready"
}

echo "🚀 Starting YiStack development environment..."
echo "   Frontend: Next.js on ${FRONTEND_HOST}:${FRONTEND_PORT}"
echo "   Backend:  Go + Hertz on ${BACKEND_HOST}:${BACKEND_PORT}"

# 创建日志目录
mkdir -p "$LOG_DIR"

init_podman_socket

# 清理旧进程
echo "🧹 Cleaning up old processes..."
pkill -f "yistack-server" 2>/dev/null || true
pkill -f "next" 2>/dev/null || true
pkill -f "browser-acceptance-worker.mjs" 2>/dev/null || true
sleep 1

echo "🌐 Starting browser acceptance worker..."
(pnpm browser:worker > "$LOG_DIR/browser-acceptance-worker.log" 2>&1) &
BROWSER_ACCEPTANCE_PID=$!
BROWSER_ACCEPTANCE_READY=false
for i in {1..20}; do
    if curl -fsS "http://127.0.0.1:43120/health" >/dev/null 2>&1; then
        BROWSER_ACCEPTANCE_READY=true
        break
    fi
    sleep 1
done
if [ "$BROWSER_ACCEPTANCE_READY" != "true" ]; then
    echo "❌ Browser acceptance worker did not become ready"
    sed -n "1,120p" "$LOG_DIR/browser-acceptance-worker.log" || true
    exit 1
fi
echo "✅ Browser acceptance worker is ready (PID: $BROWSER_ACCEPTANCE_PID)"

# 清理前端构建缓存，避免 Turbopack/webpack 缓存损坏或权限残留导致的重建循环
echo "🧹 Cleaning frontend cache..."
rm -rf "$FRONTEND_DIR/$NEXT_DIST_DIR"

# 清理旧二进制并重新编译后端
echo "🧹 Removing old backend binary..."
rm -f "$BACKEND_DIR/yistack-server"

echo "🔨 Building Go backend..."
cd "$BACKEND_DIR"
go build -o yistack-server ./cmd/server/
echo "✅ Backend built successfully"

# 启动后端（Go + Hertz）
echo "📡 Starting Go backend..."
(
    cd "$BACKEND_DIR"
    ./yistack-server > "$LOG_DIR/go-backend.log" 2>&1
) &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# 等待后端启动
echo "⏳ Waiting for backend..."
BACKEND_READY=false
for i in {1..30}; do
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "❌ Backend process exited unexpectedly"
        echo "---- go-backend.log ----"
        sed -n '1,220p' "$LOG_DIR/go-backend.log" || true
        exit 1
    fi

    if curl -s "http://${BACKEND_HOST}:${BACKEND_PORT}/api/health" > /dev/null 2>&1; then
        BACKEND_READY=true
        echo "✅ Backend is ready!"
        break
    fi
    sleep 1
done

if [ "$BACKEND_READY" != "true" ]; then
    echo "❌ Backend did not become ready in time"
    echo "   Health endpoint: http://${BACKEND_HOST}:${BACKEND_PORT}/api/health"
    echo "   Check BACKEND_URL for the Next.js proxy and APP_PORT/BACKEND_PORT for the Go server."
    echo "---- go-backend.log ----"
    sed -n '1,220p' "$LOG_DIR/go-backend.log" || true
    exit 1
fi

# 启动前端（Next.js）
echo "🖥️  Starting Next.js frontend..."
(
    cd "$FRONTEND_DIR"
    # Next 16 默认使用 Turbopack；当前环境下会持续触发 panic 和 Fast Refresh 重建循环。
    # 开发环境显式切回 webpack，并启用轮询监听，避免页面无限刷新。
    WATCHPACK_POLLING=true WATCHPACK_POLLING_INTERVAL=1000 CHOKIDAR_USEPOLLING=1 NEXT_DIST_DIR="$NEXT_DIST_DIR" NEXT_ALLOWED_DEV_ORIGINS="$NEXT_ALLOWED_DEV_ORIGINS" \
        pnpm exec next dev . --webpack -H "$FRONTEND_HOST" -p "$FRONTEND_PORT" > "$LOG_DIR/frontend.log" 2>&1
) &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
echo "   Allowed dev origins: $NEXT_ALLOWED_DEV_ORIGINS"

echo "⏳ Waiting for frontend..."
FRONTEND_READY=false
for i in {1..30}; do
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo "❌ Frontend process exited unexpectedly"
        echo "---- frontend.log ----"
        sed -n '1,220p' "$LOG_DIR/frontend.log" || true
        exit 1
    fi

    if curl -s "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
        FRONTEND_READY=true
        echo "✅ Frontend is ready!"
        break
    fi
    sleep 1
done

if [ "$FRONTEND_READY" != "true" ]; then
    echo "❌ Frontend did not become ready in time"
    echo "---- frontend.log ----"
    sed -n '1,220p' "$LOG_DIR/frontend.log" || true
    exit 1
fi

# 预热开发路由，避免用户首次点击“我的项目”或“开始创建”时看到 Next dev
# 按需编译导致的 Rendering / 样式延迟。
echo "🔥 Warming frontend routes..."
curl -s -o /dev/null -H "Cookie: yistack_token=dev-warmup" "http://localhost:$FRONTEND_PORT/projects" || true
curl -s -o /dev/null -H "Cookie: yistack_token=dev-warmup" "http://localhost:$FRONTEND_PORT/workspace?projectId=warmup_project" || true
curl -s -o /dev/null "http://localhost:$FRONTEND_PORT/_next/static/css/app/layout.css" || true

echo ""
echo "🎉 YiStack is running!"
echo "   Frontend: http://localhost:$FRONTEND_PORT"
echo "   Backend:  http://localhost:$BACKEND_PORT"
echo ""
echo "Logs:"
echo "   Frontend: $LOG_DIR/frontend.log"
echo "   Backend:  $LOG_DIR/go-backend.log"
if [ -n "$PODMAN_SERVICE_PID" ]; then
    echo "   Podman:   $LOG_DIR/podman-service.log"
fi

# 保持脚本运行
wait
