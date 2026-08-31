package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"regexp"
	"strings"
	"syscall"
	"time"

	"yistack/internal/model"
	"yistack/pkg/container"
)

const (
	ProjectValidationStatusPassed  = "passed"
	ProjectValidationStatusFailed  = "failed"
	ProjectValidationStatusSkipped = "skipped"
	ProjectValidationStatusRunning = "running"

	ProjectValidationStackStaticHTML = "static-html"
	ProjectValidationStackNodeNextJS = "node-nextjs"
	ProjectValidationStackNodeVite   = "node-vite"
	ProjectValidationStackNode       = "node"
	ProjectValidationStackGo         = "go"
	ProjectValidationStackPython     = "python"

	projectValidationKillGraceSeconds = 30
	projectValidationHostGraceSeconds = 35
)

type projectValidationContainer interface {
	RunCommandArgs(ctx context.Context, projectID string, args []string, workDir string, timeout int) (*container.ExecResult, error)
}

type generatedProjectValidator interface {
	Validate(ctx context.Context, projectID string, project *model.Project, handler StreamEventHandler) (*ProjectValidationResult, error)
}

// ProjectValidationCheck 记录一个生成项目质量检查及其真实执行证据。
type ProjectValidationCheck struct {
	ID           string   `json:"id"`
	Kind         string   `json:"kind"`
	Status       string   `json:"status"`
	Command      []string `json:"command,omitempty"`
	AttemptCount int      `json:"attempt_count,omitempty"`
	ExitCode     *int     `json:"exit_code,omitempty"`
	DurationMS   int64    `json:"duration_ms,omitempty"`
	Output       string   `json:"output,omitempty"`
	Message      string   `json:"message"`
}

// ProjectValidationResult 描述生成项目容器内的 stack-aware Validation Gate 结果。
type ProjectValidationResult struct {
	Status             string                        `json:"status"`
	Stack              string                        `json:"stack"`
	RuntimeProfile     string                        `json:"runtime_profile"`
	PackageManager     string                        `json:"package_manager,omitempty"`
	Checks             []ProjectValidationCheck      `json:"checks"`
	Diagnostics        []ProjectValidationDiagnostic `json:"diagnostics,omitempty"`
	FailureFingerprint string                        `json:"failure_fingerprint,omitempty"`
}

type projectValidationPlan struct {
	stack          string
	runtimeProfile string
	packageManager string
	checks         []projectValidationPlanCheck
}

type projectValidationPlanCheck struct {
	id      string
	kind    string
	title   string
	args    []string
	timeout int
	status  string
	message string
}

type nodeProjectManifest struct {
	PackageManager  string            `json:"packageManager"`
	Scripts         map[string]string `json:"scripts"`
	Dependencies    map[string]string `json:"dependencies"`
	DevDependencies map[string]string `json:"devDependencies"`
}

// ContainerProjectValidationRunner 在项目容器内检测技术栈并执行质量门禁。
type ContainerProjectValidationRunner struct {
	container          projectValidationContainer
	prepareRetryDelays []time.Duration
}

func NewContainerProjectValidationRunner(containerRuntime projectValidationContainer) *ContainerProjectValidationRunner {
	return &ContainerProjectValidationRunner{
		container: containerRuntime,
		prepareRetryDelays: []time.Duration{
			time.Second,
			3 * time.Second,
		},
	}
}

func (s *GeneratorService) validateGeneratedProject(
	ctx context.Context,
	projectID string,
	project *model.Project,
	handler StreamEventHandler,
) (*ProjectValidationResult, error) {
	if s == nil || s.projectValidator == nil {
		result := &ProjectValidationResult{
			Status: ProjectValidationStatusFailed,
			Checks: []ProjectValidationCheck{},
		}
		err := errors.New("project validation runner is not available")
		return result, newProjectValidationFailure("detect", nil, nil, err.Error(), result, err)
	}
	return s.projectValidator.Validate(ctx, projectID, project, handler)
}

func (r *ContainerProjectValidationRunner) Validate(
	ctx context.Context,
	projectID string,
	project *model.Project,
	handler StreamEventHandler,
) (*ProjectValidationResult, error) {
	result := &ProjectValidationResult{
		Status: ProjectValidationStatusFailed,
		Checks: []ProjectValidationCheck{},
	}
	if r == nil || r.container == nil {
		return result, newProjectValidationFailure("detect", nil, nil, "project validation container is not available", result, errors.New("project validation container is not available"))
	}
	if strings.TrimSpace(projectID) == "" || project == nil {
		return result, newProjectValidationFailure("detect", nil, nil, "project validation requires a persisted project", result, errors.New("project validation requires a persisted project"))
	}

	_ = emitWorkflowStep(handler, "project-validation", "run_command", "验证生成项目", "正在识别项目技术栈并构建质量检查计划。", "running", map[string]any{
		"validation_status": "running",
	})

	plan, err := r.buildPlan(ctx, projectID, project)
	if err != nil {
		check := ProjectValidationCheck{
			ID:      "detect",
			Kind:    "detect",
			Status:  ProjectValidationStatusFailed,
			Message: err.Error(),
		}
		result.RuntimeProfile = canonicalRuntimeProfile(projectRuntimeProfile(project))
		result.Checks = append(result.Checks, check)
		_ = emitProjectValidationCheck(handler, check, result)
		return result, newProjectValidationFailure("detect", nil, nil, err.Error(), result, err)
	}

	result.Stack = plan.stack
	result.RuntimeProfile = plan.runtimeProfile
	result.PackageManager = plan.packageManager
	result.Status = ProjectValidationStatusRunning
	for _, plannedCheck := range plan.checks {
		if err := ctx.Err(); err != nil {
			return result, err
		}
		check, checkErr := r.executeCheck(ctx, projectID, plannedCheck, handler, result)
		result.Checks = append(result.Checks, check)
		if checkErr != nil {
			result.Status = ProjectValidationStatusFailed
			return result, newProjectValidationFailure(check.Kind, check.Command, check.ExitCode, check.Message, result, checkErr)
		}
	}

	result.Status = ProjectValidationStatusPassed
	_ = emitWorkflowStep(handler, "project-validation", "run_command", "验证生成项目", "项目级 Build/Test/Lint Gate 已通过。", "done", map[string]any{
		"validation_status": ProjectValidationStatusPassed,
		"validation_result": result,
		"stack":             result.Stack,
	})
	return result, nil
}

func (r *ContainerProjectValidationRunner) buildPlan(ctx context.Context, projectID string, project *model.Project) (projectValidationPlan, error) {
	profile := canonicalRuntimeProfile(projectRuntimeProfile(project))
	hasPackageJSON, err := r.pathExists(ctx, projectID, "package.json", false)
	if err != nil {
		return projectValidationPlan{}, err
	}
	hasGoMod, err := r.pathExists(ctx, projectID, "go.mod", false)
	if err != nil {
		return projectValidationPlan{}, err
	}
	hasPyproject, err := r.pathExists(ctx, projectID, "pyproject.toml", false)
	if err != nil {
		return projectValidationPlan{}, err
	}
	hasRequirements, err := r.pathExists(ctx, projectID, "requirements.txt", false)
	if err != nil {
		return projectValidationPlan{}, err
	}
	hasIndexHTML, err := r.pathExists(ctx, projectID, "index.html", false)
	if err != nil {
		return projectValidationPlan{}, err
	}
	hasPublicIndexHTML, err := r.pathExists(ctx, projectID, "public/index.html", false)
	if err != nil {
		return projectValidationPlan{}, err
	}

	switch {
	case isPythonRuntimeProfile(profile) || ((hasPyproject || hasRequirements) && !hasPackageJSON && !hasGoMod):
		if isPythonRuntimeProfile(profile) && !hasPyproject && !hasRequirements {
			return projectValidationPlan{}, fmt.Errorf(
				"runtime profile %q requires requirements.txt or pyproject.toml",
				profile,
			)
		}
		return r.buildPythonPlan(ctx, projectID, profile, hasPyproject, hasRequirements)
	case isNodeRuntimeProfile(profile) || (hasPackageJSON && !isGoRuntimeProfile(profile)):
		if !hasPackageJSON {
			return projectValidationPlan{}, fmt.Errorf("runtime profile %q requires package.json", profile)
		}
		return r.buildNodePlan(ctx, projectID, profile)
	case isGoRuntimeProfile(profile) || hasGoMod:
		if !hasGoMod {
			return projectValidationPlan{}, fmt.Errorf("runtime profile %q requires go.mod", profile)
		}
		return buildGoValidationPlan(profile), nil
	case isStaticRuntimeProfile(profile) || hasIndexHTML || hasPublicIndexHTML:
		entryPath := "index.html"
		if !hasIndexHTML {
			entryPath = "public/index.html"
		}
		if !hasIndexHTML && !hasPublicIndexHTML {
			return projectValidationPlan{}, errors.New("static-html validation requires index.html or public/index.html")
		}
		return buildStaticValidationPlan(profile, entryPath), nil
	default:
		return projectValidationPlan{}, fmt.Errorf("unsupported project validation stack for runtime profile %q", profile)
	}
}

func (r *ContainerProjectValidationRunner) buildPythonPlan(
	ctx context.Context,
	projectID string,
	profile string,
	hasPyproject bool,
	hasRequirements bool,
) (projectValidationPlan, error) {
	checks := []projectValidationPlanCheck{}
	requirementsContent := ""
	pyprojectContent := ""
	var err error
	checks = append(checks, projectValidationPlanCheck{
		id: "python-environment", kind: "prepare", title: "准备 Python 虚拟环境",
		args:    projectPythonVirtualEnvironmentCreationArgs(),
		timeout: 300, status: ProjectValidationStatusPassed,
	})
	if hasRequirements {
		requirementsContent, err = r.readFile(ctx, projectID, "requirements.txt")
		if err != nil {
			return projectValidationPlan{}, err
		}
		checks = append(checks, projectValidationPlanCheck{
			id: "prepare", kind: "prepare", title: "准备 Python 依赖",
			args:    projectPythonPackageInstallArgs("-r", "requirements.txt"),
			timeout: 600, status: ProjectValidationStatusPassed,
		})
	} else if hasPyproject {
		pyprojectContent, err = r.readFile(ctx, projectID, "pyproject.toml")
		if err != nil {
			return projectValidationPlan{}, err
		}
		checks = append(checks, projectValidationPlanCheck{
			id: "prepare", kind: "prepare", title: "准备 Python 依赖",
			args:    projectPythonPackageInstallArgs("."),
			timeout: 600, status: ProjectValidationStatusPassed,
		})
	} else {
		checks = append(checks, projectValidationPlanCheck{
			id: "prepare", kind: "prepare", title: "准备 Python 依赖",
			status:  ProjectValidationStatusSkipped,
			message: "未找到 requirements.txt 或 pyproject.toml，依赖准备记录为 skipped_with_reason。",
		})
	}
	if hasPyproject && pyprojectContent == "" {
		pyprojectContent, err = r.readFile(ctx, projectID, "pyproject.toml")
		if err != nil {
			return projectValidationPlan{}, err
		}
	}

	checks = append(checks, projectValidationPlanCheck{
		id: "build", kind: "build", title: "执行项目 Build",
		args: []string{
			projectPythonExecutablePath(),
			"-m",
			"compileall",
			"-q",
			"-x",
			`(^|/)(\.git|\.yistack|\.venv|venv|__pycache__)(/|$)`,
			".",
		},
		timeout: 300, status: ProjectValidationStatusPassed,
	})
	if profile == "python-fastapi" ||
		strings.Contains(strings.ToLower(requirementsContent), "fastapi") ||
		strings.Contains(strings.ToLower(pyprojectContent), "fastapi") {
		checks = append(checks, buildPythonFastAPIRuntimeCheck())
	}

	hasTests, err := r.pathExists(ctx, projectID, "tests", true)
	if err != nil {
		return projectValidationPlan{}, err
	}
	hasPytestConfig, err := r.pathExists(ctx, projectID, "pytest.ini", false)
	if err != nil {
		return projectValidationPlan{}, err
	}
	if hasTests || hasPytestConfig || strings.Contains(pyprojectContent, "[tool.pytest") {
		checks = append(checks, projectValidationPlanCheck{
			id: "test", kind: "test", title: "执行项目 Test",
			args:    []string{projectPythonExecutablePath(), "-m", "pytest"},
			timeout: 300, status: ProjectValidationStatusPassed,
		})
	} else {
		checks = append(checks, projectValidationPlanCheck{
			id: "test", kind: "test", title: "执行项目 Test",
			status:  ProjectValidationStatusSkipped,
			message: "未发现 tests/、pytest.ini 或 pytest 配置，测试记录为 skipped_with_reason。",
		})
	}

	if strings.Contains(strings.ToLower(requirementsContent), "ruff") || strings.Contains(pyprojectContent, "[tool.ruff") {
		checks = append(checks, projectValidationPlanCheck{
			id: "lint", kind: "lint", title: "执行项目 Lint",
			args:    []string{projectPythonExecutablePath(), "-m", "ruff", "check", "."},
			timeout: 300, status: ProjectValidationStatusPassed,
		})
	} else {
		checks = append(checks, projectValidationPlanCheck{
			id: "lint", kind: "lint", title: "执行项目 Lint",
			status:  ProjectValidationStatusSkipped,
			message: "未发现 ruff 配置或依赖，lint 记录为 skipped_with_reason。",
		})
	}

	return projectValidationPlan{
		stack:          ProjectValidationStackPython,
		runtimeProfile: profile,
		checks:         checks,
	}, nil
}

func (r *ContainerProjectValidationRunner) buildNodePlan(ctx context.Context, projectID, profile string) (projectValidationPlan, error) {
	content, err := r.readFile(ctx, projectID, "package.json")
	if err != nil {
		return projectValidationPlan{}, err
	}
	var manifest nodeProjectManifest
	if err := json.Unmarshal([]byte(content), &manifest); err != nil {
		return projectValidationPlan{}, fmt.Errorf("parse package.json: %w", err)
	}
	if manifest.Scripts == nil {
		manifest.Scripts = map[string]string{}
	}

	manager, lockFile, err := r.resolveNodePackageManager(ctx, projectID, manifest.PackageManager)
	if err != nil {
		return projectValidationPlan{}, err
	}

	stack := ProjectValidationStackNode
	if hasNodePackage(manifest, "next") || profile == "node-nextjs" {
		stack = ProjectValidationStackNodeNextJS
	} else if hasNodePackage(manifest, "vite") || profile == "node-react" || profile == "node-vue" {
		stack = ProjectValidationStackNodeVite
	}

	checks := []projectValidationPlanCheck{
		buildNodePrepareCheck(manager, lockFile, hasNodeDependencies(manifest)),
	}
	if stack == ProjectValidationStackNode {
		checks = append(checks, buildNodeRuntimeSyntaxCheck())
	}
	if stack == ProjectValidationStackNodeVite && hasNodePackage(manifest, "react") {
		checks = append(checks, buildViteReactRuntimeCheck())
	}
	checks = append(checks,
		buildNodeScriptCheck(manager, "build", stack == ProjectValidationStackNodeNextJS || stack == ProjectValidationStackNodeVite),
		buildNodeScriptCheck(manager, "test", false),
		buildNodeScriptCheck(manager, "lint", false),
	)
	for index := range checks {
		if checks[index].kind == "build" || checks[index].kind == "test" || checks[index].kind == "lint" {
			script := checks[index].kind
			if strings.TrimSpace(manifest.Scripts[script]) == "" {
				if checks[index].status == ProjectValidationStatusFailed {
					checks[index].message = fmt.Sprintf("required package.json script %q is missing for stack %s", script, stack)
				} else {
					checks[index].status = ProjectValidationStatusSkipped
					checks[index].message = fmt.Sprintf("package.json 未配置 %s script，记录为 skipped_with_reason。", script)
				}
				checks[index].args = nil
			}
		}
	}

	return projectValidationPlan{
		stack:          stack,
		runtimeProfile: profile,
		packageManager: manager,
		checks:         checks,
	}, nil
}

func (r *ContainerProjectValidationRunner) resolveNodePackageManager(ctx context.Context, projectID, declared string) (string, string, error) {
	lockCandidates := []struct {
		path    string
		manager string
	}{
		{path: "pnpm-lock.yaml", manager: "pnpm"},
		{path: "yarn.lock", manager: "yarn"},
		{path: "package-lock.json", manager: "npm"},
	}
	selectedManager := ""
	selectedLock := ""
	for _, candidate := range lockCandidates {
		exists, err := r.pathExists(ctx, projectID, candidate.path, false)
		if err != nil {
			return "", "", err
		}
		if !exists {
			continue
		}
		if selectedManager != "" {
			return "", "", fmt.Errorf("multiple package manager lockfiles found: %s and %s", selectedLock, candidate.path)
		}
		selectedManager = candidate.manager
		selectedLock = candidate.path
	}
	if selectedManager != "" {
		return selectedManager, selectedLock, nil
	}

	declared = strings.TrimSpace(declared)
	if separator := strings.Index(declared, "@"); separator > 0 {
		declared = declared[:separator]
	}
	switch declared {
	case "", "npm":
		return "npm", "", nil
	case "pnpm", "yarn":
		return declared, "", nil
	default:
		return "", "", fmt.Errorf("unsupported package manager %q", declared)
	}
}

func (r *ContainerProjectValidationRunner) executeCheck(
	ctx context.Context,
	projectID string,
	planned projectValidationPlanCheck,
	handler StreamEventHandler,
	validationResult *ProjectValidationResult,
) (ProjectValidationCheck, error) {
	check := ProjectValidationCheck{
		ID:      planned.id,
		Kind:    planned.kind,
		Status:  planned.status,
		Command: append([]string(nil), planned.args...),
		Message: planned.message,
	}
	if planned.status == ProjectValidationStatusSkipped {
		_ = emitProjectValidationCheck(handler, check, validationResult)
		return check, nil
	}
	if planned.status == ProjectValidationStatusPassed && len(planned.args) == 0 {
		_ = emitProjectValidationCheck(handler, check, validationResult)
		return check, nil
	}
	if planned.status == ProjectValidationStatusFailed && len(planned.args) == 0 {
		_ = emitProjectValidationCheck(handler, check, validationResult)
		return check, errors.New(check.Message)
	}

	_ = emitWorkflowStep(handler, "project-validation:"+planned.id, "run_command", planned.title, strings.Join(planned.args, " "), "running", map[string]any{
		"validation_check":  planned.kind,
		"validation_status": "running",
		"stack":             validationResult.Stack,
		"command":           planned.args,
	})
	commandResult, err, attemptCount, durationMS := r.runCheckCommand(
		ctx,
		projectID,
		planned,
		handler,
		validationResult,
	)
	check.AttemptCount = attemptCount
	check.DurationMS = durationMS
	if err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(ctx.Err(), context.Canceled) {
			return check, context.Canceled
		}
		check.Status = ProjectValidationStatusFailed
		check.Message = err.Error()
		_ = emitProjectValidationCheck(handler, check, validationResult)
		return check, err
	}
	if commandResult == nil {
		check.Status = ProjectValidationStatusFailed
		check.Message = "project validation command returned no result"
		_ = emitProjectValidationCheck(handler, check, validationResult)
		return check, errors.New(check.Message)
	}

	exitCode := commandResult.ExitCode
	check.ExitCode = &exitCode
	check.Output = generatedCommandOutput(commandResult)
	if commandResult.ExitCode != 0 {
		check.Status = ProjectValidationStatusFailed
		check.Message = projectValidationCommandFailureMessage(planned.kind, commandResult.ExitCode, check.Output)
		_ = emitProjectValidationCheck(handler, check, validationResult)
		return check, errors.New(check.Message)
	}

	check.Status = ProjectValidationStatusPassed
	check.Message = planned.title + "通过"
	if attemptCount > 1 {
		check.Message = fmt.Sprintf(
			"%s通过（瞬时依赖错误重试 %d 次后恢复）",
			planned.title,
			attemptCount-1,
		)
	}
	_ = emitProjectValidationCheck(handler, check, validationResult)
	return check, nil
}

func (r *ContainerProjectValidationRunner) runCheckCommand(
	ctx context.Context,
	projectID string,
	planned projectValidationPlanCheck,
	handler StreamEventHandler,
	validationResult *ProjectValidationResult,
) (*container.ExecResult, error, int, int64) {
	retryDelays := []time.Duration(nil)
	if planned.kind == "prepare" {
		retryDelays = r.prepareRetryDelays
	}

	var totalDurationMS int64
	for attempt := 1; ; attempt++ {
		startedAt := time.Now()
		executionArgs, executionTimeout := projectValidationExecutionCommand(
			planned.args,
			planned.timeout,
		)
		commandResult, err := r.container.RunCommandArgs(
			ctx,
			projectID,
			executionArgs,
			"/workspace",
			executionTimeout,
		)
		durationMS := time.Since(startedAt).Milliseconds()
		if commandResult != nil && commandResult.Duration > 0 {
			durationMS = commandResult.Duration
		}
		totalDurationMS += durationMS

		if ctx.Err() != nil ||
			attempt > len(retryDelays) ||
			!isTransientProjectValidationPrepareFailure(err, commandResult) {
			return commandResult, err, attempt, totalDurationMS
		}

		delay := retryDelays[attempt-1]
		failureMessage := strings.TrimSpace(generatedCommandOutput(commandResult))
		if err != nil {
			failureMessage = strings.TrimSpace(err.Error())
		}
		_ = emitWorkflowStep(
			handler,
			"project-validation:"+planned.id,
			"run_command",
			planned.title,
			fmt.Sprintf(
				"依赖准备遇到瞬时网络错误，第 %d/%d 次执行失败，%s 后重试：%s",
				attempt,
				len(retryDelays)+1,
				delay,
				failureMessage,
			),
			"running",
			map[string]any{
				"validation_check":  planned.kind,
				"validation_status": "running",
				"stack":             validationResult.Stack,
				"command":           planned.args,
				"attempt":           attempt,
				"max_attempts":      len(retryDelays) + 1,
				"retry_delay_ms":    delay.Milliseconds(),
				"transient_failure": true,
			},
		)
		if err := waitProjectValidationRetry(ctx, delay); err != nil {
			return commandResult, err, attempt, totalDurationMS
		}
	}
}

func projectValidationExecutionCommand(
	args []string,
	timeoutSeconds int,
) ([]string, int) {
	command := append([]string(nil), args...)
	if timeoutSeconds <= 0 || len(command) == 0 {
		return command, timeoutSeconds
	}
	bounded := []string{
		"timeout",
		"--signal=TERM",
		fmt.Sprintf("--kill-after=%ds", projectValidationKillGraceSeconds),
		fmt.Sprintf("%ds", timeoutSeconds),
	}
	bounded = append(bounded, command...)
	return bounded, timeoutSeconds + projectValidationHostGraceSeconds
}

var projectValidationHTTPRetryStatusPattern = regexp.MustCompile(
	`(?i)(?:http(?:/[0-9.]+)?|status(?:\s+code)?|response\s+code)\s*[:=]?\s*(?:408|425|429|5[0-9]{2})\b`,
)

func isTransientProjectValidationPrepareFailure(
	err error,
	result *container.ExecResult,
) bool {
	if err == nil && (result == nil || result.ExitCode == 0) {
		return false
	}
	if errors.Is(err, context.Canceled) {
		return false
	}
	if result != nil && result.ExitCode == 124 {
		return true
	}
	if errors.Is(err, context.DeadlineExceeded) ||
		errors.Is(err, io.EOF) ||
		errors.Is(err, io.ErrUnexpectedEOF) ||
		errors.Is(err, syscall.ECONNRESET) ||
		errors.Is(err, syscall.ECONNREFUSED) ||
		errors.Is(err, syscall.EPIPE) ||
		errors.Is(err, syscall.ETIMEDOUT) {
		return true
	}
	var networkErr net.Error
	if errors.As(err, &networkErr) &&
		(networkErr.Timeout() || networkErr.Temporary()) {
		return true
	}

	parts := []string{}
	if err != nil {
		parts = append(parts, err.Error())
	}
	if result != nil {
		parts = append(parts, result.Stdout, result.Stderr)
	}
	message := strings.ToLower(strings.Join(parts, "\n"))
	for _, marker := range []string{
		"i/o timeout",
		"connection timed out",
		"connection timeout",
		"connect timeout",
		"read timeout",
		"tls handshake timeout",
		"connection reset",
		"connection refused",
		"network is unreachable",
		"temporary failure in name resolution",
		"server misbehaving",
		"no such host",
		"eai_again",
		"etimedout",
		"econnreset",
		"econnrefused",
		"enetunreach",
		"socket hang up",
		"unexpected eof",
		"temporarily unavailable",
		"temporary network failure",
	} {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return projectValidationHTTPRetryStatusPattern.MatchString(message)
}

func waitProjectValidationRetry(
	ctx context.Context,
	delay time.Duration,
) error {
	if delay <= 0 {
		return ctx.Err()
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func (r *ContainerProjectValidationRunner) pathExists(ctx context.Context, projectID, relativePath string, directory bool) (bool, error) {
	flag := "-f"
	if directory {
		flag = "-d"
	}
	result, err := r.container.RunCommandArgs(ctx, projectID, []string{"test", flag, buildWorkspacePath(relativePath)}, "/workspace", 120)
	if err != nil {
		return false, fmt.Errorf("inspect project validation path %s: %w", relativePath, err)
	}
	if result == nil {
		return false, fmt.Errorf("inspect project validation path %s returned no result", relativePath)
	}
	switch result.ExitCode {
	case 0:
		return true, nil
	case 1:
		return false, nil
	default:
		return false, fmt.Errorf("inspect project validation path %s failed: %s", relativePath, generatedCommandOutput(result))
	}
}

func (r *ContainerProjectValidationRunner) readFile(ctx context.Context, projectID, relativePath string) (string, error) {
	result, err := r.container.RunCommandArgs(ctx, projectID, []string{"cat", buildWorkspacePath(relativePath)}, "/workspace", 120)
	if err != nil {
		return "", fmt.Errorf("read project validation file %s: %w", relativePath, err)
	}
	if result == nil {
		return "", fmt.Errorf("read project validation file %s returned no result", relativePath)
	}
	if result.ExitCode != 0 {
		return "", fmt.Errorf("read project validation file %s failed: %s", relativePath, generatedCommandOutput(result))
	}
	return result.Stdout, nil
}

func emitProjectValidationCheck(handler StreamEventHandler, check ProjectValidationCheck, result *ProjectValidationResult) error {
	eventStatus := "done"
	if check.Status == ProjectValidationStatusFailed {
		eventStatus = "failed"
	}
	return emitWorkflowStep(handler, "project-validation:"+check.ID, "run_command", projectValidationCheckTitle(check.Kind), check.Message, eventStatus, map[string]any{
		"validation_check":  check.Kind,
		"validation_status": check.Status,
		"validation_result": result,
		"stack":             result.Stack,
		"command":           check.Command,
		"exitCode":          check.ExitCode,
		"duration_ms":       check.DurationMS,
	})
}

func buildNodePrepareCheck(manager, lockFile string, hasDependencies bool) projectValidationPlanCheck {
	check := projectValidationPlanCheck{
		id:      "prepare",
		kind:    "prepare",
		title:   "准备项目依赖",
		timeout: 600,
		status:  ProjectValidationStatusPassed,
	}
	switch {
	case lockFile == "" && !hasDependencies:
		check.status = ProjectValidationStatusSkipped
		check.message = "package.json 未声明依赖且没有锁文件，依赖准备记录为 skipped_with_reason。"
	case manager == "pnpm" && lockFile != "":
		check.args = []string{"pnpm", "install", "--frozen-lockfile"}
	case manager == "yarn" && lockFile != "":
		check.args = []string{"yarn", "install", "--frozen-lockfile"}
	case manager == "npm" && lockFile != "":
		check.args = []string{"npm", "ci"}
	case manager == "pnpm":
		check.args = []string{"pnpm", "install"}
	case manager == "yarn":
		check.args = []string{"yarn", "install"}
	default:
		check.args = []string{"npm", "install"}
	}
	return check
}

func buildNodeScriptCheck(manager, script string, required bool) projectValidationPlanCheck {
	args := []string{manager, "run", script}
	status := ProjectValidationStatusPassed
	timeout := 300
	if script == "build" {
		timeout = 600
	}
	if required {
		status = ProjectValidationStatusFailed
	}
	return projectValidationPlanCheck{
		id:      script,
		kind:    script,
		title:   projectValidationCheckTitle(script),
		args:    args,
		timeout: timeout,
		status:  status,
	}
}

func buildGoValidationPlan(profile string) projectValidationPlan {
	return projectValidationPlan{
		stack:          ProjectValidationStackGo,
		runtimeProfile: profile,
		checks: []projectValidationPlanCheck{
			{id: "prepare", kind: "prepare", title: "整理 Go 模块", args: []string{"go", "mod", "tidy"}, timeout: 600, status: ProjectValidationStatusPassed},
			{id: "build", kind: "build", title: "执行项目 Build", args: []string{"go", "build", "./..."}, timeout: 300, status: ProjectValidationStatusPassed},
			{id: "test", kind: "test", title: "执行项目 Test", args: []string{"go", "test", "./..."}, timeout: 300, status: ProjectValidationStatusPassed},
			{id: "lint", kind: "lint", title: "执行项目 Lint", args: []string{"go", "vet", "./..."}, timeout: 300, status: ProjectValidationStatusPassed},
		},
	}
}

func buildStaticValidationPlan(profile, entryPath string) projectValidationPlan {
	return projectValidationPlan{
		stack:          ProjectValidationStackStaticHTML,
		runtimeProfile: profile,
		checks: []projectValidationPlanCheck{
			{id: "entry", kind: "entry", title: "检查静态入口", status: ProjectValidationStatusPassed, message: "已确认静态入口 " + entryPath},
			{id: "prepare", kind: "prepare", title: "准备项目依赖", status: ProjectValidationStatusSkipped, message: "static-html 不需要依赖准备，记录为 skipped_with_reason。"},
			{id: "build", kind: "build", title: "执行项目 Build", status: ProjectValidationStatusSkipped, message: "static-html 没有构建步骤，记录为 skipped_with_reason。"},
			{id: "test", kind: "test", title: "执行项目 Test", status: ProjectValidationStatusSkipped, message: "static-html 未配置测试，记录为 skipped_with_reason。"},
			{id: "lint", kind: "lint", title: "执行项目 Lint", status: ProjectValidationStatusSkipped, message: "static-html 未配置 lint，记录为 skipped_with_reason。"},
		},
	}
}

func hasNodePackage(manifest nodeProjectManifest, packageName string) bool {
	if _, ok := manifest.Dependencies[packageName]; ok {
		return true
	}
	_, ok := manifest.DevDependencies[packageName]
	return ok
}

func hasNodeDependencies(manifest nodeProjectManifest) bool {
	return len(manifest.Dependencies) > 0 || len(manifest.DevDependencies) > 0
}

func isNodeRuntimeProfile(profile string) bool {
	return strings.HasPrefix(profile, "node-")
}

func isGoRuntimeProfile(profile string) bool {
	return strings.HasPrefix(profile, "go-") || profile == "go"
}

func isPythonRuntimeProfile(profile string) bool {
	return strings.HasPrefix(profile, "python-") || profile == "python"
}

func isStaticRuntimeProfile(profile string) bool {
	return profile == "static-html" || profile == "static"
}

func projectValidationCheckTitle(kind string) string {
	switch kind {
	case "detect":
		return "识别项目技术栈"
	case "entry":
		return "检查静态入口"
	case "prepare":
		return "准备项目依赖"
	case "browser-runtime":
		return "验证 React 浏览器运行时"
	case "build":
		return "执行项目 Build"
	case "test":
		return "执行项目 Test"
	case "lint":
		return "执行项目 Lint"
	default:
		return "执行项目校验"
	}
}

func projectValidationCommandFailureMessage(kind string, exitCode int, output string) string {
	message := fmt.Sprintf("%s failed with exit code %d", kind, exitCode)
	if strings.TrimSpace(output) != "" {
		message += ": " + strings.TrimSpace(output)
	}
	return message
}
