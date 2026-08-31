package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"yistack/internal/model"
	"yistack/pkg/container"
)

var errProjectPreviewEntrypointMissing = errors.New("project preview entrypoint is missing")

func projectPreviewReadinessProbeCommand() string {
	return `curl -sS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1`
}

func ensureProjectPreviewServer(
	ctx context.Context,
	containerMgr *container.Manager,
	project *model.Project,
	spec runtimeEnvironmentSpec,
	forceRestart bool,
) error {
	if containerMgr == nil {
		return fmt.Errorf("container manager not available")
	}
	if project == nil || strings.TrimSpace(project.ProjectID) == "" {
		return fmt.Errorf("project is required")
	}

	internalPort := runtimeApplicationPort(spec)
	if internalPort <= 0 {
		internalPort = 3000
	}

	result, err := containerMgr.ExecuteInContainer(ctx, &container.RunOptions{
		ProjectID: project.ProjectID,
		Command:   buildProjectPreviewServerCommand(internalPort, forceRestart),
		WorkDir:   "/workspace",
		Timeout:   300,
	})
	if err != nil {
		return err
	}
	if result.ExitCode == 42 {
		return errProjectPreviewEntrypointMissing
	}
	if result.ExitCode != 0 {
		detail := strings.TrimSpace(result.Stderr)
		if detail == "" {
			detail = strings.TrimSpace(result.Stdout)
		}
		if detail == "" {
			detail = fmt.Sprintf("preview server start failed with exit code %d", result.ExitCode)
		}
		return fmt.Errorf(detail)
	}
	return nil
}

func buildProjectPreviewServerCommand(internalPort int, forceRestart bool) string {
	if internalPort <= 0 {
		internalPort = 3000
	}
	forceRestartValue := 0
	if forceRestart {
		forceRestartValue = 1
	}

	return fmt.Sprintf(`set -eu
PORT=%d
FORCE_RESTART=%d
RUNTIME_DIR=".yistack/runtime"
PID_FILE="${RUNTIME_DIR}/preview.pid"
LOG_FILE="${RUNTIME_DIR}/preview.log"
mkdir -p "${RUNTIME_DIR}"
PYTHON_BIN="python3"
if [ -x "${RUNTIME_DIR}/python-venv/bin/python" ]; then
  PYTHON_BIN="${RUNTIME_DIR}/python-venv/bin/python"
fi

preview_ready() {
  %s
}

preview_descendants() {
  parent_pid="$1"
  ps -eo pid=,ppid= | awk -v parent="${parent_pid}" '$2 == parent { print $1 }' |
    while read -r child_pid; do
      [ -n "${child_pid}" ] || continue
      preview_descendants "${child_pid}"
      printf '%%s\n' "${child_pid}"
    done
}

stop_preview_tree() {
  root_pid="$1"
  descendant_pids="$(preview_descendants "${root_pid}")"
  for process_pid in ${descendant_pids} "${root_pid}"; do
    kill "${process_pid}" >/dev/null 2>&1 || true
  done
  sleep 1
  if preview_ready; then
    for process_pid in ${descendant_pids} "${root_pid}"; do
      kill -9 "${process_pid}" >/dev/null 2>&1 || true
    done
    sleep 1
  fi
}

if [ "${FORCE_RESTART}" -ne 1 ] && preview_ready; then
  exit 0
fi

preview_pid=""
if [ -s "${PID_FILE}" ]; then
  preview_pid="$(cat "${PID_FILE}" 2>/dev/null | tr -cd '0-9' || true)"
fi
if [ -n "${preview_pid}" ] && kill -0 "${preview_pid}" >/dev/null 2>&1; then
  if [ "${FORCE_RESTART}" -ne 1 ]; then
    existing_deadline=$(( $(date +%%s) + 20 ))
    while kill -0 "${preview_pid}" >/dev/null 2>&1; do
      if preview_ready; then
        exit 0
      fi
      if [ "$(date +%%s)" -ge "${existing_deadline}" ]; then
        break
      fi
      sleep 1
    done
  fi
  stop_preview_tree "${preview_pid}"
fi

if preview_ready; then
  echo "preview endpoint remained healthy after restart request; reusing it" >>"${LOG_FILE}"
  exit 0
fi

if [ -f package.json ]; then
  if [ -f pnpm-lock.yaml ] && command -v pnpm >/dev/null 2>&1; then
    package_runner="pnpm"
  elif [ -f yarn.lock ] && command -v yarn >/dev/null 2>&1; then
    package_runner="yarn"
  else
    package_runner="npm"
  fi

  if [ ! -d node_modules ]; then
    case "${package_runner}" in
      pnpm)
        pnpm install --prefer-offline --no-frozen-lockfile >>"${LOG_FILE}" 2>&1 || pnpm install --no-frozen-lockfile >>"${LOG_FILE}" 2>&1
        ;;
      yarn)
        yarn install >>"${LOG_FILE}" 2>&1
        ;;
      *)
        npm install >>"${LOG_FILE}" 2>&1 || npm install --legacy-peer-deps >>"${LOG_FILE}" 2>&1
        ;;
    esac
  fi

  if [ -f .next/BUILD_ID ] &&
     node -e "const p=require('./package.json');const d=Object.assign({},p.dependencies,p.devDependencies);process.exit(d&&d.next&&p.scripts&&p.scripts.start?0:1)" >/dev/null 2>&1; then
    if [ "${package_runner}" = "npm" ]; then
      HOST=0.0.0.0 HOSTNAME=0.0.0.0 PORT="${PORT}" nohup "${package_runner}" run start -- --hostname 0.0.0.0 --port "${PORT}" >>"${LOG_FILE}" 2>&1 &
    else
      HOST=0.0.0.0 HOSTNAME=0.0.0.0 PORT="${PORT}" nohup "${package_runner}" run start --hostname 0.0.0.0 --port "${PORT}" >>"${LOG_FILE}" 2>&1 &
    fi
    echo "$!" >"${PID_FILE}"
  elif node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts.dev?0:1)" >/dev/null 2>&1; then
    if node -e "const p=require('./package.json');const d=Object.assign({},p.dependencies,p.devDependencies);process.exit(d&&d.next?0:1)" >/dev/null 2>&1; then
      if [ "${package_runner}" = "npm" ]; then
        HOST=0.0.0.0 HOSTNAME=0.0.0.0 PORT="${PORT}" nohup "${package_runner}" run dev -- --hostname 0.0.0.0 --port "${PORT}" >>"${LOG_FILE}" 2>&1 &
      else
        HOST=0.0.0.0 HOSTNAME=0.0.0.0 PORT="${PORT}" nohup "${package_runner}" run dev --hostname 0.0.0.0 --port "${PORT}" >>"${LOG_FILE}" 2>&1 &
      fi
    elif node -e "const p=require('./package.json');const d=Object.assign({},p.dependencies,p.devDependencies);process.exit(d&&d.vite?0:1)" >/dev/null 2>&1; then
      if [ "${package_runner}" = "npm" ]; then
        HOST=0.0.0.0 PORT="${PORT}" nohup "${package_runner}" run dev -- --host 0.0.0.0 --port "${PORT}" >>"${LOG_FILE}" 2>&1 &
      else
        HOST=0.0.0.0 PORT="${PORT}" nohup "${package_runner}" run dev --host 0.0.0.0 --port "${PORT}" >>"${LOG_FILE}" 2>&1 &
      fi
    else
      HOST=0.0.0.0 HOSTNAME=0.0.0.0 PORT="${PORT}" nohup "${package_runner}" run dev >>"${LOG_FILE}" 2>&1 &
    fi
    echo "$!" >"${PID_FILE}"
  elif node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts.start?0:1)" >/dev/null 2>&1; then
    HOST=0.0.0.0 HOSTNAME=0.0.0.0 PORT="${PORT}" nohup "${package_runner}" run start >>"${LOG_FILE}" 2>&1 &
    echo "$!" >"${PID_FILE}"
  else
    echo "package.json does not define dev or start script" >&2
    exit 42
  fi
elif [ -f go.mod ]; then
  go build -o "${RUNTIME_DIR}/preview-go" . >>"${LOG_FILE}" 2>&1
  HOST=0.0.0.0 PORT="${PORT}" nohup "${RUNTIME_DIR}/preview-go" >>"${LOG_FILE}" 2>&1 &
  echo "$!" >"${PID_FILE}"
elif [ -f manage.py ]; then
  HOST=0.0.0.0 PORT="${PORT}" nohup "${PYTHON_BIN}" manage.py runserver "0.0.0.0:${PORT}" >>"${LOG_FILE}" 2>&1 &
  echo "$!" >"${PID_FILE}"
elif [ -f main.py ] && grep -Eqi 'FastAPI|from[[:space:]]+fastapi|import[[:space:]]+fastapi' main.py; then
  HOST=0.0.0.0 PORT="${PORT}" nohup "${PYTHON_BIN}" -m uvicorn main:app --host 0.0.0.0 --port "${PORT}" >>"${LOG_FILE}" 2>&1 &
  echo "$!" >"${PID_FILE}"
elif [ -f app.py ] && grep -Eqi 'FastAPI|from[[:space:]]+fastapi|import[[:space:]]+fastapi' app.py; then
  HOST=0.0.0.0 PORT="${PORT}" nohup "${PYTHON_BIN}" -m uvicorn app:app --host 0.0.0.0 --port "${PORT}" >>"${LOG_FILE}" 2>&1 &
  echo "$!" >"${PID_FILE}"
elif [ -f main.py ]; then
  HOST=0.0.0.0 PORT="${PORT}" nohup "${PYTHON_BIN}" main.py >>"${LOG_FILE}" 2>&1 &
  echo "$!" >"${PID_FILE}"
elif [ -f app.py ]; then
  HOST=0.0.0.0 PORT="${PORT}" nohup "${PYTHON_BIN}" app.py >>"${LOG_FILE}" 2>&1 &
  echo "$!" >"${PID_FILE}"
elif [ -f index.html ]; then
  nohup python3 -m http.server "${PORT}" --bind 0.0.0.0 >>"${LOG_FILE}" 2>&1 &
  echo "$!" >"${PID_FILE}"
elif [ -f public/index.html ]; then
  cd public
  nohup python3 -m http.server "${PORT}" --bind 0.0.0.0 >>"../${LOG_FILE}" 2>&1 &
  echo "$!" >"../${PID_FILE}"
else
  echo "no preview entrypoint found: package.json, go.mod, Python app, index.html or public/index.html is required" >&2
  exit 42
fi

deadline=$(( $(date +%%s) + 90 ))
while true; do
  if preview_ready; then
    exit 0
  fi
  preview_pid="$(cat "${PID_FILE}" 2>/dev/null | tr -cd '0-9' || true)"
  if [ -n "${preview_pid}" ] && ! kill -0 "${preview_pid}" >/dev/null 2>&1; then
    sleep 1
    continue
  fi
  if [ "$(date +%%s)" -ge "${deadline}" ]; then
    echo "preview server did not become ready on port ${PORT}" >&2
    tail -n 80 "${LOG_FILE}" >&2 || true
    exit 1
  fi
  sleep 1
done
`, internalPort, forceRestartValue, projectPreviewReadinessProbeCommand())
}
