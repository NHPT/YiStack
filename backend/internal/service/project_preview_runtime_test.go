package service

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os/exec"
	"strings"
	"testing"
)

func TestBuildProjectPreviewServerCommandCoversNodeAndStaticEntrypoints(t *testing.T) {
	command := buildProjectPreviewServerCommand(5173, false)

	requiredSegments := []string{
		"PORT=5173",
		"FORCE_RESTART=0",
		"package.json",
		"pnpm install --prefer-offline --no-frozen-lockfile",
		"npm install --legacy-peer-deps",
		".next/BUILD_ID",
		"run start -- --hostname 0.0.0.0 --port",
		"run dev",
		`if [ "${package_runner}" = "npm" ]; then`,
		"run dev --host 0.0.0.0 --port",
		"run dev --hostname 0.0.0.0 --port",
		"--host 0.0.0.0 --port",
		"--hostname 0.0.0.0 --port",
		"go.mod",
		`go build -o "${RUNTIME_DIR}/preview-go" .`,
		`nohup "${RUNTIME_DIR}/preview-go"`,
		`PYTHON_BIN="${RUNTIME_DIR}/python-venv/bin/python"`,
		`"${PYTHON_BIN}" manage.py runserver`,
		`"${PYTHON_BIN}" -m uvicorn main:app`,
		`"${PYTHON_BIN}" -m uvicorn app:app`,
		"python3 -m http.server",
		"public/index.html",
		`curl -sS "http://127.0.0.1:${PORT}/"`,
		"if preview_ready; then",
		"preview_descendants()",
		`stop_preview_tree "${preview_pid}"`,
		`kill -9 "${process_pid}"`,
		"existing_deadline=",
		"continue",
		"preview server did not become ready on port ${PORT}",
	}

	for _, segment := range requiredSegments {
		if !strings.Contains(command, segment) {
			t.Fatalf("expected preview server command to contain %q, got:\n%s", segment, command)
		}
	}
	if strings.Contains(command, "existing preview process still owns port") {
		t.Fatalf("expected healthy orphaned preview to remain reusable, got:\n%s", command)
	}
	if strings.Index(command, "elif [ -f go.mod ]") >= strings.Index(command, "elif [ -f index.html ]") {
		t.Fatalf("expected Go application entrypoint before static HTML fallback, got:\n%s", command)
	}
	if strings.Index(command, "[ -f .next/BUILD_ID ]") >= strings.Index(command, "elif node -e") {
		t.Fatalf("expected built Next.js production start before Node dev fallback, got:\n%s", command)
	}
}

func TestProjectPreviewReadinessProbeAcceptsHTTPErrorResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(
		response http.ResponseWriter,
		_ *http.Request,
	) {
		http.Error(response, "not found", http.StatusNotFound)
	}))
	parsedURL, err := url.Parse(server.URL)
	if err != nil {
		t.Fatalf("parse test server URL: %v", err)
	}
	command := strings.ReplaceAll(
		projectPreviewReadinessProbeCommand(),
		"${PORT}",
		parsedURL.Port(),
	)

	if output, err := exec.Command("sh", "-c", command).CombinedOutput(); err != nil {
		t.Fatalf(
			"expected HTTP 404 response to prove preview readiness, got %v: %s",
			err,
			strings.TrimSpace(string(output)),
		)
	}

	server.Close()
	if err := exec.Command("sh", "-c", command).Run(); err == nil {
		t.Fatal("expected refused preview connection to remain not ready")
	}
}

func TestBuildProjectPreviewServerCommandNormalizesInvalidPort(t *testing.T) {
	command := buildProjectPreviewServerCommand(0, true)
	if !strings.Contains(command, "PORT=3000") {
		t.Fatalf("expected invalid preview port to fall back to 3000, got:\n%s", command)
	}
	if !strings.Contains(command, "FORCE_RESTART=1") {
		t.Fatalf("expected forced preview restart, got:\n%s", command)
	}
}

func TestBuildProjectPreviewServerCommandHasValidShellSyntax(t *testing.T) {
	command := exec.Command("sh", "-n")
	command.Stdin = strings.NewReader(
		buildProjectPreviewServerCommand(8080, true),
	)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf(
			"expected valid preview shell command, got %v: %s",
			err,
			strings.TrimSpace(string(output)),
		)
	}
}
