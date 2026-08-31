#!/bin/bash
# start.sh - 生产环境启动脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-/etc/yistack/yistack.env}"
ROOT_ENV_FILE="${ROOT_ENV_FILE:-$ROOT_DIR/.env}"

load_env_file() {
    local env_file="$1"
    if [ -f "$env_file" ]; then
        # shellcheck disable=SC1090
        set -a
        source "$env_file"
        set +a
    fi
}

if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
fi

load_env_file "$ROOT_ENV_FILE"

LOG_DIR="${YISTACK_LOG_DIR:-$ROOT_DIR/logs}"

# 监听配置
BACKEND_HOST=${APP_HOST:-127.0.0.1}
BACKEND_PORT=${APP_PORT:-${BACKEND_PORT:-8080}}
FRONTEND_HOST=${FRONTEND_HOST:-127.0.0.1}
FRONTEND_PORT=${FRONTEND_PORT:-${DEPLOY_RUN_PORT:-5000}}

echo "🚀 Starting YiStack production environment..."
mkdir -p "$LOG_DIR"
export CONTAINER_ENABLED="${CONTAINER_ENABLED:-true}"
export CONTAINER_RUNTIME="${CONTAINER_RUNTIME:-podman}"

# 启动浏览器验收 worker
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

# 启动后端
echo "📡 Starting backend server..."
if [ -f "$ROOT_DIR/dist/yistack-server" ]; then
    ("$ROOT_DIR/dist/yistack-server" > "$LOG_DIR/backend.log" 2>&1) &
    BACKEND_PID=$!
elif [ -f "${YISTACK_INSTALL_DIR:-/opt/yistack}/yistack-server" ]; then
    ("${YISTACK_INSTALL_DIR:-/opt/yistack}/yistack-server" > "$LOG_DIR/backend.log" 2>&1) &
    BACKEND_PID=$!
else
    cd "$ROOT_DIR/backend"
    (go run ./cmd/server/main.go > "$LOG_DIR/backend.log" 2>&1) &
    BACKEND_PID=$!
    cd "$ROOT_DIR"
fi

# 等待后端启动
BACKEND_READY=false
for i in {1..30}; do
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "❌ Backend process exited unexpectedly"
        echo "---- backend.log ----"
        sed -n '1,220p' "$LOG_DIR/backend.log" || true
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
    echo "---- backend.log ----"
    sed -n '1,220p' "$LOG_DIR/backend.log" || true
    exit 1
fi

# 启动前端
echo "🖥️  Starting frontend server..."
(pnpm exec next start -H "$FRONTEND_HOST" -p "$FRONTEND_PORT" > "$LOG_DIR/frontend.log" 2>&1) &

echo ""
echo "🎉 YiStack is running!"
echo "   Frontend: http://${FRONTEND_HOST}:$FRONTEND_PORT"
echo "   Backend:  http://${BACKEND_HOST}:$BACKEND_PORT"
echo "   Logs:     $LOG_DIR"
