package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"yistack/internal/model"
	"yistack/pkg/container"
)

type projectValidationContainerStub struct {
	files        map[string]string
	dirs         map[string]bool
	results      map[string]*container.ExecResult
	errs         map[string]error
	resultQueues map[string][]*container.ExecResult
	errQueues    map[string][]error
	nilResults   map[string]bool
	calls        [][]string
}

func (s *projectValidationContainerStub) RunCommandArgs(
	_ context.Context,
	_ string,
	args []string,
	_ string,
	_ int,
) (*container.ExecResult, error) {
	recordedArgs := args
	if len(args) >= 5 &&
		args[0] == "timeout" &&
		args[1] == "--signal=TERM" &&
		strings.HasPrefix(args[2], "--kill-after=") {
		recordedArgs = args[4:]
	}
	s.calls = append(s.calls, append([]string(nil), recordedArgs...))
	key := strings.Join(recordedArgs, "\x00")
	if queued := s.errQueues[key]; len(queued) > 0 {
		err := queued[0]
		s.errQueues[key] = queued[1:]
		if err != nil {
			return nil, err
		}
	}
	if queued := s.resultQueues[key]; len(queued) > 0 {
		result := queued[0]
		s.resultQueues[key] = queued[1:]
		if result == nil {
			return nil, nil
		}
		copy := *result
		return &copy, nil
	}
	if err := s.errs[key]; err != nil {
		return nil, err
	}
	if s.nilResults[key] {
		return nil, nil
	}
	if result := s.results[key]; result != nil {
		copy := *result
		return &copy, nil
	}
	if len(args) == 3 && args[0] == "test" {
		relativePath := strings.TrimPrefix(args[2], "/workspace/")
		exists := false
		if args[1] == "-d" {
			exists = s.dirs[relativePath]
		} else {
			_, exists = s.files[relativePath]
		}
		if exists {
			return &container.ExecResult{ExitCode: 0}, nil
		}
		return &container.ExecResult{ExitCode: 1}, nil
	}
	if len(args) == 2 && args[0] == "cat" {
		relativePath := strings.TrimPrefix(args[1], "/workspace/")
		content, ok := s.files[relativePath]
		if !ok {
			return &container.ExecResult{ExitCode: 1, Stderr: "missing file"}, nil
		}
		return &container.ExecResult{ExitCode: 0, Stdout: content}, nil
	}
	return &container.ExecResult{ExitCode: 0, Stdout: "ok", Duration: 12}, nil
}

type generatedProjectValidatorStub struct {
	result *ProjectValidationResult
	err    error
	calls  int
}

func (s *generatedProjectValidatorStub) Validate(
	_ context.Context,
	_ string,
	_ *model.Project,
	_ StreamEventHandler,
) (*ProjectValidationResult, error) {
	s.calls++
	return s.result, s.err
}

func TestProjectValidationRunnerStaticHTMLFixture(t *testing.T) {
	runtime := &projectValidationContainerStub{
		files: map[string]string{"index.html": "<!doctype html>"},
		dirs:  map[string]bool{},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"static-project",
		&model.Project{ProjectID: "static-project", AppType: "static-html", TechStack: `{"runtime":{"profile":"static-html"}}`},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if err != nil {
		t.Fatalf("expected static fixture to pass: %v", err)
	}
	if result.Stack != ProjectValidationStackStaticHTML || result.Status != ProjectValidationStatusPassed {
		t.Fatalf("unexpected static validation result: %#v", result)
	}
	assertProjectValidationCheckStatus(t, result, "entry", ProjectValidationStatusPassed)
	assertProjectValidationCheckStatus(t, result, "build", ProjectValidationStatusSkipped)
	assertProjectValidationCheckStatus(t, result, "test", ProjectValidationStatusSkipped)
	assertProjectValidationCheckStatus(t, result, "lint", ProjectValidationStatusSkipped)
}

func TestProjectValidationRunnerNextFixtureUsesPackageLock(t *testing.T) {
	runtime := &projectValidationContainerStub{
		files: map[string]string{
			"package.json": `{
				"scripts":{"build":"next build","test":"node --test","lint":"next lint"},
				"dependencies":{"next":"16.1.1"}
			}`,
			"package-lock.json": `{}`,
		},
		dirs: map[string]bool{},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"next-project",
		&model.Project{ProjectID: "next-project", AppType: "web", TechStack: `{"runtime":{"profile":"node-nextjs"}}`},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if err != nil {
		t.Fatalf("expected Next fixture to pass: %v", err)
	}
	if result.Stack != ProjectValidationStackNodeNextJS || result.PackageManager != "npm" {
		t.Fatalf("unexpected Next validation plan: %#v", result)
	}
	assertValidationCommandOrder(t, runtime.calls, []string{
		"npm ci",
		"npm run build",
		"npm run test",
		"npm run lint",
	})
}

func TestProjectValidationRunnerRejectsInvalidGenericNodeSyntax(t *testing.T) {
	runtimeCheckKey := strings.Join(
		[]string{"node", "-e", nodeRuntimeSyntaxValidationScript},
		"\x00",
	)
	runtime := &projectValidationContainerStub{
		files: map[string]string{
			"package.json": `{"scripts":{"start":"node index.js"},"dependencies":{"express":"4.18.2"}}`,
			"index.js":     `const express = require('express');\nconst app = express();`,
		},
		dirs: map[string]bool{},
		results: map[string]*container.ExecResult{
			runtimeCheckKey: {
				ExitCode: 1,
				Stderr:   "index.js:1\nSyntaxError: Invalid or unexpected token",
			},
		},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"node-project",
		&model.Project{ProjectID: "node-project", AppType: "api", TechStack: `{"runtime":{"profile":"node-express"}}`},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if GenerationFailureCode(err) != GenerationFailureCodeProjectValidationFailed {
		t.Fatalf("expected invalid Node.js syntax to fail validation, got %v", err)
	}
	assertProjectValidationCheckStatus(t, result, "browser-runtime", ProjectValidationStatusFailed)
	if len(result.Diagnostics) == 0 ||
		!strings.Contains(result.Diagnostics[0].Message, "Invalid or unexpected token") {
		t.Fatalf("expected actionable Node.js syntax diagnostic, got %#v", result.Diagnostics)
	}
}

func TestProjectValidationRunnerReinstallsIncompleteNodeModulesWithoutLockfile(t *testing.T) {
	runtime := &projectValidationContainerStub{
		files: map[string]string{
			"package.json": `{
				"scripts":{"build":"next build"},
				"dependencies":{"next":"16.1.1"}
			}`,
		},
		dirs: map[string]bool{"node_modules": true},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"next-project",
		&model.Project{ProjectID: "next-project", AppType: "web", TechStack: `{"runtime":{"profile":"node-nextjs"}}`},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if err != nil {
		t.Fatalf("expected incomplete node_modules to be repaired by install: %v", err)
	}
	assertProjectValidationCheckStatus(t, result, "prepare", ProjectValidationStatusPassed)
	assertValidationCommandOrder(t, runtime.calls, []string{
		"npm install",
		"npm run build",
	})
}

func TestProjectValidationRunnerViteFixtureSkipsMissingLint(t *testing.T) {
	runtime := &projectValidationContainerStub{
		files: map[string]string{
			"package.json": `{
				"scripts":{"build":"vite build","test":"vitest run"},
				"dependencies":{"react":"18.2.0"},
				"devDependencies":{"vite":"7.0.0"}
			}`,
			"pnpm-lock.yaml": "lockfileVersion: '9.0'",
		},
		dirs: map[string]bool{},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"vite-project",
		&model.Project{ProjectID: "vite-project", AppType: "web", TechStack: `{"runtime":{"profile":"node-react"}}`},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if err != nil {
		t.Fatalf("expected Vite fixture to pass: %v", err)
	}
	if result.Stack != ProjectValidationStackNodeVite || result.PackageManager != "pnpm" {
		t.Fatalf("unexpected Vite validation plan: %#v", result)
	}
	assertProjectValidationCheckStatus(t, result, "lint", ProjectValidationStatusSkipped)
	assertValidationCommandOrder(t, runtime.calls, []string{
		"pnpm install --frozen-lockfile",
		strings.Join([]string{"node", "-e", viteReactJSXRuntimeValidationScript}, " "),
		"pnpm run build",
		"pnpm run test",
	})
}

func TestProjectValidationRunnerRejectsMissingViteReactRuntime(t *testing.T) {
	runtimeCheckKey := strings.Join([]string{"node", "-e", viteReactJSXRuntimeValidationScript}, "\x00")
	runtime := &projectValidationContainerStub{
		files: map[string]string{
			"package.json": `{
				"scripts":{"build":"vite build"},
				"dependencies":{"react":"18.2.0"},
				"devDependencies":{"vite":"5.4.0","@vitejs/plugin-react":"4.3.0"}
			}`,
			"pnpm-lock.yaml": "lockfileVersion: \x279.0\x27",
			"src/App.jsx":    "import { useState } from \x27react\x27; export default () => <main />;",
		},
		dirs: map[string]bool{},
		results: map[string]*container.ExecResult{
			runtimeCheckKey: {
				ExitCode: 1,
				Stderr:   "src/App.jsx:1:1: React is not defined at runtime; configure @vitejs/plugin-react in vite.config or import React",
			},
		},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"vite-project",
		&model.Project{ProjectID: "vite-project", AppType: "web", TechStack: `{"runtime":{"profile":"node-react"}}`},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if GenerationFailureCode(err) != GenerationFailureCodeProjectValidationFailed {
		t.Fatalf("expected missing React runtime binding to fail validation, got %v", err)
	}
	assertProjectValidationCheckStatus(t, result, "browser-runtime", ProjectValidationStatusFailed)
	if len(result.Diagnostics) != 1 || result.Diagnostics[0].Path != "src/App.jsx" || !strings.Contains(result.Diagnostics[0].Message, "React is not defined") {
		t.Fatalf("expected actionable React runtime diagnostic, got %#v", result.Diagnostics)
	}
	assertValidationCommandOrder(t, runtime.calls, []string{
		"pnpm install --frozen-lockfile",
		strings.Join([]string{"node", "-e", viteReactJSXRuntimeValidationScript}, " "),
	})
}

func TestProjectValidationRunnerRejectsNodeEnvironmentInViteBrowserSource(t *testing.T) {
	runtimeCheckKey := strings.Join([]string{"node", "-e", viteReactJSXRuntimeValidationScript}, "\x00")
	runtime := &projectValidationContainerStub{
		files: map[string]string{
			"package.json": `{
				"scripts":{"build":"vite build"},
				"dependencies":{"react":"18.2.0"},
				"devDependencies":{"vite":"5.4.0","@vitejs/plugin-react":"4.3.0"}
			}`,
			"src/App.jsx": `const url = process.env.VITE_SUPABASE_URL;`,
		},
		dirs: map[string]bool{},
		results: map[string]*container.ExecResult{
			runtimeCheckKey: {
				ExitCode: 1,
				Stderr:   "src/App.jsx:1:1: process is not defined in Vite browser source; use import.meta.env for VITE_* variables",
			},
		},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"vite-project",
		&model.Project{ProjectID: "vite-project", AppType: "web", TechStack: `{"runtime":{"profile":"node-react"}}`},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if GenerationFailureCode(err) != GenerationFailureCodeProjectValidationFailed {
		t.Fatalf("expected Node environment access to fail Vite validation, got %v", err)
	}
	assertProjectValidationCheckStatus(t, result, "browser-runtime", ProjectValidationStatusFailed)
	if len(result.Diagnostics) != 1 || result.Diagnostics[0].Path != "src/App.jsx" ||
		!strings.Contains(result.Diagnostics[0].Message, "process is not defined") {
		t.Fatalf("expected actionable Vite environment diagnostic, got %#v", result.Diagnostics)
	}
}

func TestProjectValidationRunnerGoFixture(t *testing.T) {
	runtime := &projectValidationContainerStub{
		files: map[string]string{"go.mod": "module example.com/app"},
		dirs:  map[string]bool{},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"go-project",
		&model.Project{ProjectID: "go-project", AppType: "api", TechStack: `{"runtime":{"profile":"go-gin"}}`},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if err != nil {
		t.Fatalf("expected Go fixture to pass: %v", err)
	}
	if result.Stack != ProjectValidationStackGo {
		t.Fatalf("unexpected Go validation result: %#v", result)
	}
	assertValidationCommandOrder(t, runtime.calls, []string{
		"go mod tidy",
		"go build ./...",
		"go test ./...",
		"go vet ./...",
	})
}

func TestProjectValidationRunnerRetriesTransientGoPrepareWithoutRepair(t *testing.T) {
	goTidyKey := strings.Join([]string{"go", "mod", "tidy"}, "\x00")
	runtime := &projectValidationContainerStub{
		files: map[string]string{"go.mod": "module example.com/app"},
		dirs:  map[string]bool{},
		resultQueues: map[string][]*container.ExecResult{
			goTidyKey: {
				{
					ExitCode: 1,
					Stderr:   "go: github.com/gin-gonic/gin: Get https://proxy.golang.org: dial tcp: i/o timeout",
					Duration: 30,
				},
				{ExitCode: 0, Stdout: "dependencies ready", Duration: 20},
			},
		},
	}
	runner := NewContainerProjectValidationRunner(runtime)
	runner.prepareRetryDelays = []time.Duration{0}
	retryEvents := 0

	result, err := runner.Validate(
		context.Background(),
		"go-project",
		&model.Project{ProjectID: "go-project", AppType: "api", TechStack: `{"runtime":{"profile":"go-gin"}}`},
		func(name StreamEventName, payload StreamEventPayload) error {
			if name != StreamEventStep {
				return nil
			}
			step, _ := payload.(map[string]any)
			meta, _ := step["meta"].(map[string]any)
			if meta["transient_failure"] == true {
				retryEvents++
			}
			return nil
		},
	)

	if err != nil {
		t.Fatalf("transient dependency failure must recover inside validation: %v", err)
	}
	if result.Status != ProjectValidationStatusPassed || retryEvents != 1 {
		t.Fatalf("expected one truthful retry and a passed gate, result=%#v retries=%d", result, retryEvents)
	}
	assertValidationCommandOrder(t, runtime.calls, []string{
		"go mod tidy",
		"go mod tidy",
		"go build ./...",
		"go test ./...",
		"go vet ./...",
	})
	for _, check := range result.Checks {
		if check.Kind == "prepare" {
			if check.AttemptCount != 2 || !strings.Contains(check.Message, "重试 1 次后恢复") {
				t.Fatalf("expected retry evidence on prepare check, got %#v", check)
			}
			return
		}
	}
	t.Fatalf("expected prepare check in %#v", result.Checks)
}

func TestProjectValidationPrepareRetryClassification(t *testing.T) {
	tests := []struct {
		name   string
		err    error
		result *container.ExecResult
		want   bool
	}{
		{name: "deadline", err: context.DeadlineExceeded, want: true},
		{name: "canceled", err: context.Canceled, want: false},
		{name: "container timeout", result: &container.ExecResult{ExitCode: 124}, want: true},
		{name: "temporary DNS", result: &container.ExecResult{ExitCode: 1, Stderr: "Temporary failure in name resolution"}, want: true},
		{name: "HTTP 503", result: &container.ExecResult{ExitCode: 1, Stderr: "HTTP/1.1 503 Service Unavailable"}, want: true},
		{name: "HTTP 404", result: &container.ExecResult{ExitCode: 1, Stderr: "HTTP 404 Not Found"}, want: false},
		{name: "permanent dependency", result: &container.ExecResult{ExitCode: 1, Stderr: "go: malformed module path"}, want: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := isTransientProjectValidationPrepareFailure(test.err, test.result)
			if got != test.want {
				t.Fatalf("retry classification mismatch: got %t want %t", got, test.want)
			}
		})
	}
}

func TestProjectValidationExecutionCommandBoundsContainerProcess(t *testing.T) {
	command := []string{"npm", "install"}
	bounded, hostTimeout := projectValidationExecutionCommand(command, 600)
	want := []string{
		"timeout",
		"--signal=TERM",
		"--kill-after=30s",
		"600s",
		"npm",
		"install",
	}
	if strings.Join(bounded, "\x00") != strings.Join(want, "\x00") {
		t.Fatalf("bounded validation command = %#v, want %#v", bounded, want)
	}
	if hostTimeout != 635 {
		t.Fatalf("host timeout = %d, want 635", hostTimeout)
	}
	if strings.Join(command, " ") != "npm install" {
		t.Fatalf("source command mutated: %#v", command)
	}
}

func TestBuildNodeScriptCheckAllowsLongProductionBuild(t *testing.T) {
	build := buildNodeScriptCheck("npm", "build", true)
	test := buildNodeScriptCheck("npm", "test", false)

	if build.timeout != 600 {
		t.Fatalf("node production build timeout = %d, want 600", build.timeout)
	}
	if test.timeout != 300 {
		t.Fatalf("node test timeout = %d, want 300", test.timeout)
	}
}

func TestProjectValidationRunnerRejectsMissingPythonManifest(t *testing.T) {
	runtime := &projectValidationContainerStub{
		files: map[string]string{
			"main.py": "from fastapi import FastAPI\napp = FastAPI()\n",
		},
		dirs: map[string]bool{},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"python-project",
		&model.Project{ProjectID: "python-project", AppType: "api", TechStack: `{"runtime":{"profile":"python-fastapi"}}`},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if GenerationFailureCode(err) != GenerationFailureCodeProjectValidationFailed {
		t.Fatalf("expected missing Python manifest to fail validation, got %v", err)
	}
	if len(result.Checks) != 1 || result.Checks[0].Kind != "detect" ||
		!strings.Contains(result.Checks[0].Message, "requires requirements.txt or pyproject.toml") {
		t.Fatalf("expected actionable Python manifest diagnostic, got %#v", result.Checks)
	}
	for _, call := range runtime.calls {
		if len(call) == 0 || call[0] != "test" {
			t.Fatalf("expected validation to stop after path probes, got %#v", runtime.calls)
		}
	}
}

func TestProjectValidationRunnerPythonFixture(t *testing.T) {
	runtime := &projectValidationContainerStub{
		files: map[string]string{
			"requirements.txt": "fastapi==0.116.0\npytest==8.4.0\nruff==0.12.0",
		},
		dirs: map[string]bool{"tests": true},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"python-project",
		&model.Project{ProjectID: "python-project", AppType: "ai", TechStack: `{"runtime":{"profile":"python-fastapi"}}`},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if err != nil {
		t.Fatalf("expected Python fixture to pass: %v", err)
	}
	if result.Stack != ProjectValidationStackPython {
		t.Fatalf("unexpected Python validation result: %#v", result)
	}
	assertValidationCommandOrder(t, runtime.calls, []string{
		strings.Join(projectPythonVirtualEnvironmentCreationArgs(), " "),
		strings.Join(projectPythonPackageInstallArgs("-r", "requirements.txt"), " "),
		`.yistack/runtime/python-venv/bin/python -m compileall -q -x (^|/)(\.git|\.yistack|\.venv|venv|__pycache__)(/|$) .`,
		strings.Join([]string{projectPythonExecutablePath(), "-c", pythonFastAPIRuntimeValidationScript}, " "),
		".yistack/runtime/python-venv/bin/python -m pytest",
		".yistack/runtime/python-venv/bin/python -m ruff check .",
	})
}

func TestProjectValidationRunnerRejectsLegacyStarletteTemplateResponse(t *testing.T) {
	runtimeCheckKey := strings.Join(
		[]string{projectPythonExecutablePath(), "-c", pythonFastAPIRuntimeValidationScript},
		"\x00",
	)
	runtime := &projectValidationContainerStub{
		files: map[string]string{
			"requirements.txt": "fastapi==0.141.1\njinja2==3.1.6",
			"main.py":          `templates.TemplateResponse("index.html", {"request": request})`,
		},
		dirs: map[string]bool{},
		results: map[string]*container.ExecResult{
			runtimeCheckKey: {
				ExitCode: 1,
				Stderr:   "main.py:1:1: Starlette TemplateResponse positional arguments are incompatible; use TemplateResponse(request=request, name=..., context=...)",
			},
		},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"python-project",
		&model.Project{ProjectID: "python-project", AppType: "api", TechStack: `{"runtime":{"profile":"python-fastapi"}}`},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if GenerationFailureCode(err) != GenerationFailureCodeProjectValidationFailed {
		t.Fatalf("expected legacy TemplateResponse to fail validation, got %v", err)
	}
	assertProjectValidationCheckStatus(t, result, "browser-runtime", ProjectValidationStatusFailed)
	if len(result.Diagnostics) != 1 || result.Diagnostics[0].Path != "main.py" ||
		!strings.Contains(result.Diagnostics[0].Message, "TemplateResponse positional arguments") {
		t.Fatalf("expected actionable Starlette diagnostic, got %#v", result.Diagnostics)
	}
}

func TestProjectValidationRunnerInfersPythonFromManifest(t *testing.T) {
	runtime := &projectValidationContainerStub{
		files: map[string]string{"requirements.txt": "fastapi==0.116.0"},
		dirs:  map[string]bool{},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"python-project",
		&model.Project{ProjectID: "python-project", AppType: "custom"},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if err != nil {
		t.Fatalf("expected Python manifest inference to pass: %v", err)
	}
	if result.Stack != ProjectValidationStackPython {
		t.Fatalf("expected requirements.txt to select Python validation, got %#v", result)
	}
	assertValidationCommandOrder(t, runtime.calls, []string{
		strings.Join(projectPythonVirtualEnvironmentCreationArgs(), " "),
		strings.Join(projectPythonPackageInstallArgs("-r", "requirements.txt"), " "),
		`.yistack/runtime/python-venv/bin/python -m compileall -q -x (^|/)(\.git|\.yistack|\.venv|venv|__pycache__)(/|$) .`,
		strings.Join([]string{projectPythonExecutablePath(), "-c", pythonFastAPIRuntimeValidationScript}, " "),
	})
	for _, check := range result.Checks {
		if len(check.Command) > 0 && check.DurationMS != 12 {
			t.Fatalf("expected command duration evidence, got %#v", check)
		}
	}
}

func TestProjectValidationRunnerStopsAfterBuildFailure(t *testing.T) {
	buildKey := strings.Join([]string{"npm", "run", "build"}, "\x00")
	runtime := &projectValidationContainerStub{
		files: map[string]string{
			"package.json": `{
				"scripts":{"build":"next build","test":"node --test","lint":"next lint"},
				"dependencies":{"next":"16.1.1"}
			}`,
			"package-lock.json": `{}`,
		},
		dirs: map[string]bool{},
		results: map[string]*container.ExecResult{
			buildKey: {ExitCode: 2, Stderr: "TypeScript build failed"},
		},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"next-project",
		&model.Project{ProjectID: "next-project", AppType: "web", TechStack: `{"runtime":{"profile":"node-nextjs"}}`},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if GenerationFailureCode(err) != GenerationFailureCodeProjectValidationFailed {
		t.Fatalf("expected project validation failure, got %v", err)
	}
	if result.Status != ProjectValidationStatusFailed {
		t.Fatalf("expected failed validation result, got %#v", result)
	}
	assertProjectValidationCheckStatus(t, result, "build", ProjectValidationStatusFailed)
	commands := validationQualityCommands(runtime.calls)
	if strings.Join(commands, ",") != "npm ci,npm run build" {
		t.Fatalf("expected validation to stop after build, got %#v", commands)
	}
}

func TestProjectValidationRunnerStopsOnExecutionFailures(t *testing.T) {
	buildKey := strings.Join([]string{"npm", "run", "build"}, "\x00")
	tests := []struct {
		name      string
		err       error
		nilResult bool
	}{
		{name: "execution error", err: errors.New("container unavailable")},
		{name: "timeout", err: context.DeadlineExceeded},
		{name: "nil result", nilResult: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			runtime := &projectValidationContainerStub{
				files: map[string]string{
					"package.json":      `{"scripts":{"build":"next build","test":"node --test"},"dependencies":{"next":"16.1.1"}}`,
					"package-lock.json": `{}`,
				},
				dirs:       map[string]bool{},
				errs:       map[string]error{},
				nilResults: map[string]bool{},
			}
			if test.err != nil {
				runtime.errs[buildKey] = test.err
			}
			if test.nilResult {
				runtime.nilResults[buildKey] = true
			}
			runner := NewContainerProjectValidationRunner(runtime)
			result, err := runner.Validate(
				context.Background(),
				"next-project",
				&model.Project{ProjectID: "next-project", AppType: "web", TechStack: `{"runtime":{"profile":"node-nextjs"}}`},
				func(StreamEventName, StreamEventPayload) error { return nil },
			)
			if GenerationFailureCode(err) != GenerationFailureCodeProjectValidationFailed {
				t.Fatalf("expected project validation failure, got %v", err)
			}
			assertProjectValidationCheckStatus(t, result, "build", ProjectValidationStatusFailed)
			if strings.Join(validationQualityCommands(runtime.calls), ",") != "npm ci,npm run build" {
				t.Fatalf("validation must stop after build execution failure, got %#v", validationQualityCommands(runtime.calls))
			}
		})
	}
}

func TestProjectValidationRunnerRequiresBuildForNextAndVite(t *testing.T) {
	runtime := &projectValidationContainerStub{
		files: map[string]string{
			"package.json":      `{"scripts":{"test":"node --test"},"dependencies":{"next":"16.1.1"}}`,
			"package-lock.json": `{}`,
		},
		dirs: map[string]bool{},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"next-project",
		&model.Project{ProjectID: "next-project", AppType: "web", TechStack: `{"runtime":{"profile":"node-nextjs"}}`},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if GenerationFailureCode(err) != GenerationFailureCodeProjectValidationFailed {
		t.Fatalf("expected missing required build to fail, got %v", err)
	}
	assertProjectValidationCheckStatus(t, result, "build", ProjectValidationStatusFailed)
	commands := validationQualityCommands(runtime.calls)
	if strings.Join(commands, ",") != "npm ci" {
		t.Fatalf("missing required build must stop before test/lint, got %#v", commands)
	}
}

func TestProjectValidationRunnerRejectsMultipleNodeLockfiles(t *testing.T) {
	runtime := &projectValidationContainerStub{
		files: map[string]string{
			"package.json":      `{"scripts":{"build":"next build"},"dependencies":{"next":"16.1.1"}}`,
			"package-lock.json": `{}`,
			"pnpm-lock.yaml":    "lockfileVersion: '9.0'",
		},
		dirs: map[string]bool{},
	}
	runner := NewContainerProjectValidationRunner(runtime)

	result, err := runner.Validate(
		context.Background(),
		"next-project",
		&model.Project{ProjectID: "next-project", AppType: "web", TechStack: `{"runtime":{"profile":"node-nextjs"}}`},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if GenerationFailureCode(err) != GenerationFailureCodeProjectValidationFailed {
		t.Fatalf("expected ambiguous lockfiles to fail, got %v", err)
	}
	if len(result.Checks) != 1 || result.Checks[0].Kind != "detect" {
		t.Fatalf("expected stack detection failure evidence, got %#v", result)
	}
}

func TestApplyGenerationArtifactsStopsBeforePreviewAndGitWhenProjectValidationFails(t *testing.T) {
	validationResult := &ProjectValidationResult{
		Status: ProjectValidationStatusFailed,
		Stack:  ProjectValidationStackNodeNextJS,
		Checks: []ProjectValidationCheck{{ID: "build", Kind: "build", Status: ProjectValidationStatusFailed}},
	}
	validationErr := newProjectValidationFailure("build", []string{"npm", "run", "build"}, intPointer(1), "build failed", validationResult, errors.New("build failed"))
	validator := &generatedProjectValidatorStub{result: validationResult, err: validationErr}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.projectValidator = validator
	var stepIDs []string

	result := &generationResult{}
	err := service.applyGenerationArtifacts(
		context.Background(),
		&GenerateRequest{},
		&model.Project{ProjectID: "project-1"},
		result,
		func(name StreamEventName, payload StreamEventPayload) error {
			if name == StreamEventStep {
				step, _ := payload.(map[string]any)
				if id, ok := step["id"].(string); ok {
					stepIDs = append(stepIDs, id)
				}
			}
			return nil
		},
	)

	if GenerationFailureCode(err) != GenerationFailureCodeProjectValidationFailed {
		t.Fatalf("expected project validation failure, got %v", err)
	}
	if validator.calls != 1 || result.ProjectValidation != validationResult {
		t.Fatalf("expected validation result to be retained, calls=%d result=%#v", validator.calls, result.ProjectValidation)
	}
	for _, stepID := range stepIDs {
		if stepID == "preview-server" || stepID == "git-commit" {
			t.Fatalf("validation failure must block Preview and Git, got steps %#v", stepIDs)
		}
	}
}

func assertProjectValidationCheckStatus(t *testing.T, result *ProjectValidationResult, kind, status string) {
	t.Helper()
	for _, check := range result.Checks {
		if check.Kind == kind {
			if check.Status != status {
				t.Fatalf("expected %s status %q, got %#v", kind, status, check)
			}
			return
		}
	}
	t.Fatalf("expected %s check in %#v", kind, result.Checks)
}

func assertValidationCommandOrder(t *testing.T, calls [][]string, expected []string) {
	t.Helper()
	actual := validationQualityCommands(calls)
	if strings.Join(actual, "\n") != strings.Join(expected, "\n") {
		t.Fatalf("validation command order mismatch:\n got: %#v\nwant: %#v", actual, expected)
	}
}

func validationQualityCommands(calls [][]string) []string {
	commands := []string{}
	for _, args := range calls {
		if len(args) == 0 || args[0] == "test" || args[0] == "cat" {
			continue
		}
		commands = append(commands, strings.Join(args, " "))
	}
	return commands
}
