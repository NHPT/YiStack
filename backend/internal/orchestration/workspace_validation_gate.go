package orchestration

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"

	"yistack/internal/service"
)

var (
	validationColonLocationPattern = regexp.MustCompile(`([A-Za-z0-9_./@+-]+\.(?:tsx|ts|jsx|js|go|md|json|css|scss|yml|yaml)):(\d+):(\d+)`)
	validationLineLocationPattern  = regexp.MustCompile(`([A-Za-z0-9_./@+-]+\.(?:tsx|ts|jsx|js|go|md|json|css|scss|yml|yaml)):(\d+)(?:\s|:)`)
	validationParenLocationPattern = regexp.MustCompile(`([A-Za-z0-9_./@+-]+\.(?:tsx|ts|jsx|js|go|md|json|css|scss|yml|yaml))\((\d+),(\d+)\)`)
)

// ValidationGateResult 描述最小验证门禁执行结果。
type ValidationGateResult struct {
	Summary string
	Output  string
}

// ValidationGateRunner 执行最小 Validation Gate。
type ValidationGateRunner interface {
	Run(ctx context.Context, gate string, state EngineeringState) (ValidationGateResult, error)
}

// ShellValidationGateRunner 通过 shell 执行验证脚本。
type ShellValidationGateRunner struct {
	repoRoot string
}

// ValidationGateError 表示验证门禁执行失败。
type ValidationGateError struct {
	Gate   string
	State  EngineeringState
	Output string
	Err    error
}

func (e *ValidationGateError) Error() string {
	if e == nil {
		return ""
	}
	if strings.TrimSpace(e.Output) != "" {
		return fmt.Sprintf("validation gate %s failed: %s", e.Gate, summarizeValidationOutput(e.Output, e.Err))
	}
	if e.Err != nil {
		return fmt.Sprintf("validation gate %s failed: %v", e.Gate, e.Err)
	}
	return fmt.Sprintf("validation gate %s failed", e.Gate)
}

func (e *ValidationGateError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

// NewShellValidationGateRunner 创建 shell validation runner。
func NewShellValidationGateRunner(repoRoot string) *ShellValidationGateRunner {
	return &ShellValidationGateRunner{repoRoot: strings.TrimSpace(repoRoot)}
}

func (r *ShellValidationGateRunner) Run(ctx context.Context, gate string, _ EngineeringState) (ValidationGateResult, error) {
	if strings.TrimSpace(gate) == "" {
		return ValidationGateResult{}, nil
	}
	if strings.TrimSpace(r.repoRoot) == "" {
		return ValidationGateResult{}, ErrValidationGateUnavailable
	}

	switch gate {
	case ValidationGateBeforePreview:
		cmd := exec.CommandContext(ctx, "bash", "./scripts/validate-yes.sh")
		cmd.Dir = r.repoRoot
		output, err := cmd.CombinedOutput()
		result := ValidationGateResult{
			Summary: "YES validation passed, ready for preview.",
			Output:  strings.TrimSpace(string(output)),
		}
		if err != nil {
			result.Summary = "YES validation failed, preview remains blocked."
			return result, err
		}
		return result, nil
	default:
		return ValidationGateResult{}, fmt.Errorf("unsupported validation gate: %s", gate)
	}
}

func executeValidationGate(ctx context.Context, runner ValidationGateRunner, recorder EngineeringStateRecorder, command GenerateCommand, handler service.StreamEventHandler) (context.Context, error) {
	state, ok := EngineeringStateFromContext(ctx)
	if !ok || strings.TrimSpace(state.Validation.Gate) == "" {
		return ctx, nil
	}

	ctx, state = startValidationWorkflowStage(ctx, state, handler)

	if runner == nil {
		return finishFailedValidationWorkflowStage(ctx, recorder, command, state, ValidationGateResult{
			Summary: "Validation Gate runner not available, preview remains blocked.",
		}, ErrValidationGateUnavailable, handler)
	}

	result, err := runner.Run(ctx, state.Validation.Gate, state)
	if err != nil {
		return finishFailedValidationWorkflowStage(ctx, recorder, command, state, result, err, handler)
	}

	return finishPassedValidationWorkflowStage(ctx, recorder, command, state, result, handler)
}

func parseValidationFailureItems(gate, output, summary string, fallback error) []ValidationFailureItem {
	gate = strings.TrimSpace(gate)
	if gate == "" {
		gate = ValidationGateBeforePreview
	}

	lines := collectValidationFailureLines(output)
	if len(lines) == 0 {
		if trimmed := strings.TrimSpace(summary); trimmed != "" {
			lines = append(lines, trimmed)
		} else if fallback != nil {
			lines = append(lines, fallback.Error())
		}
	}
	if len(lines) == 0 {
		lines = append(lines, "validation failed")
	}

	items := make([]ValidationFailureItem, 0, len(lines))
	seen := map[string]bool{}
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || seen[line] {
			continue
		}
		seen[line] = true
		location := extractValidationFailureLocation(line)
		items = append(items, ValidationFailureItem{
			ID:         fmt.Sprintf("%s:%d", gate, len(items)+1),
			Title:      inferValidationFailureTitle(line),
			Detail:     line,
			Severity:   "error",
			Suggestion: inferValidationFailureSuggestion(line),
			FilePath:   location.filePath,
			LineNumber: location.lineNumber,
			Column:     location.column,
			SearchText: location.searchText,
		})
	}
	return items
}

type validationFailureLocation struct {
	filePath   string
	lineNumber int
	column     int
	searchText string
}

func extractValidationFailureLocation(line string) validationFailureLocation {
	if match := validationColonLocationPattern.FindStringSubmatch(line); len(match) == 4 {
		return buildValidationFailureLocation(match[1], match[2], match[3], line)
	}
	if match := validationParenLocationPattern.FindStringSubmatch(line); len(match) == 4 {
		return buildValidationFailureLocation(match[1], match[2], match[3], line)
	}
	if match := validationLineLocationPattern.FindStringSubmatch(line); len(match) == 3 {
		return buildValidationFailureLocation(match[1], match[2], "0", line)
	}
	return validationFailureLocation{}
}

func buildValidationFailureLocation(filePath, lineNumber, column, searchText string) validationFailureLocation {
	line, _ := strconv.Atoi(lineNumber)
	col, _ := strconv.Atoi(column)
	return validationFailureLocation{
		filePath:   normalizeValidationFailurePath(filePath),
		lineNumber: line,
		column:     col,
		searchText: strings.TrimSpace(searchText),
	}
}

func normalizeValidationFailurePath(filePath string) string {
	normalized := strings.TrimSpace(filePath)
	normalized = strings.TrimPrefix(normalized, "./")
	normalized = strings.TrimPrefix(normalized, "web/")
	return normalized
}

func collectValidationFailureLines(output string) []string {
	output = strings.TrimSpace(output)
	if output == "" {
		return nil
	}

	lines := strings.Split(output, "\n")
	failures := make([]string, 0, len(lines))
	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			continue
		}
		lowered := strings.ToLower(line)
		if strings.Contains(lowered, "failed") ||
			strings.Contains(lowered, "error") ||
			strings.Contains(lowered, "err!") ||
			strings.Contains(lowered, "exit status") ||
			extractValidationFailureLocation(line).filePath != "" {
			failures = append(failures, line)
		}
	}
	return failures
}

func inferValidationFailureTitle(detail string) string {
	lowered := strings.ToLower(detail)
	switch {
	case strings.Contains(lowered, "frontend") || strings.Contains(lowered, "type check") || strings.Contains(lowered, "typescript") || strings.Contains(lowered, "tsc") || looksLikeFrontendSourceFailure(lowered):
		return "前端类型检查失败"
	case strings.Contains(lowered, "backend") || strings.Contains(lowered, "go test") || strings.Contains(lowered, "go build"):
		return "后端构建或测试失败"
	case strings.Contains(lowered, "kernel document") || strings.Contains(lowered, "document"):
		return "核心文档校验失败"
	case strings.Contains(lowered, "yes validation") || strings.Contains(lowered, "[yes]"):
		return "YES 校验未通过"
	default:
		return "Validation Gate 失败项"
	}
}

func inferValidationFailureSuggestion(detail string) string {
	lowered := strings.ToLower(detail)
	switch {
	case strings.Contains(lowered, "frontend") || strings.Contains(lowered, "type check") || strings.Contains(lowered, "typescript") || strings.Contains(lowered, "tsc") || looksLikeFrontendSourceFailure(lowered):
		return "优先在 web 目录修复 TypeScript 类型错误，再重新运行 YES 校验。"
	case strings.Contains(lowered, "backend") || strings.Contains(lowered, "go test") || strings.Contains(lowered, "go build"):
		return "优先修复后端构建或测试失败项，再重新运行 YES 校验。"
	case strings.Contains(lowered, "kernel document") || strings.Contains(lowered, "document"):
		return "优先补齐或修正 YES 核心治理文档，再重新运行校验。"
	default:
		return "查看完整校验输出，修复该失败项后点击“修复后重跑校验”。"
	}
}

func looksLikeFrontendSourceFailure(loweredDetail string) bool {
	return strings.Contains(loweredDetail, ".tsx:") ||
		strings.Contains(loweredDetail, ".ts:") ||
		strings.Contains(loweredDetail, ".jsx:") ||
		strings.Contains(loweredDetail, ".js:")
}

func buildValidationGateRecoveryState(state EngineeringState, detail string) *RecoveryState {
	gate := strings.TrimSpace(state.Validation.Gate)
	if gate == "" {
		gate = ValidationGateBeforePreview
	}
	stage := strings.TrimSpace(state.Workflow.Stage)
	mode := strings.TrimSpace(state.Workflow.Mode)
	if mode == "" {
		mode = WorkflowModeImplement
	}
	reasonMessage := strings.TrimSpace(detail)
	if reasonMessage == "" {
		reasonMessage = "YES 校验未通过，当前阶段已被阻断。"
	}

	return &RecoveryState{
		Blocked:       true,
		ReasonCode:    "validation_gate_blocked",
		ReasonMessage: reasonMessage,
		ResumeStage:   stage,
		ResumeMode:    mode,
		CanRetry:      true,
		RetryLabel:    "修复后重跑校验",
		RetryPrompt:   buildValidationGateRetryPrompt(gate, stage, mode),
	}
}

func buildValidationGateRetryPrompt(gate, stage, mode string) string {
	gate = strings.TrimSpace(gate)
	if gate == "" {
		gate = ValidationGateBeforePreview
	}
	mode = strings.TrimSpace(mode)
	if mode == "" {
		mode = WorkflowModeImplement
	}
	stageHint := ""
	if trimmedStage := strings.TrimSpace(stage); trimmedStage != "" {
		stageHint = "，并在通过后恢复当前阶段（" + trimmedStage + "）"
	}
	return "校验失败项已修复。请重新运行 YES Validation Gate（" + gate + "），确认通过后继续当前 " + mode + " 工作流" + stageHint + "。"
}

func buildValidationWorkflowStep(gate, title, detail, status string, state EngineeringState) map[string]interface{} {
	return buildEngineeringStateStep(
		"validation:"+gate,
		"run_command",
		title,
		detail,
		status,
		state,
		map[string]interface{}{
			"gate":               gate,
			"validation_status":  state.Validation.Status,
			"workflow_stage":     state.Workflow.Stage,
			"workflow_mode":      state.Workflow.Mode,
			"runtime_project_id": state.Runtime.ProjectID,
		},
	)
}

func emitValidationWorkflowStep(handler service.StreamEventHandler, payload map[string]interface{}) error {
	return emitEngineeringStateStep(handler, payload)
}

func recordValidationState(ctx context.Context, recorder EngineeringStateRecorder, command GenerateCommand, state EngineeringState, step map[string]interface{}, detail string) {
	if recorder == nil {
		return
	}
	_ = recorder.RecordValidationState(ctx, engineeringStateRecordParams{
		ProjectID: command.ProjectID,
		UserID:    command.UserID,
		Model:     command.Model,
		State:     state,
		Step:      step,
		Content:   detail,
	})
}

func summarizeValidationOutput(output string, fallback error) string {
	output = strings.TrimSpace(output)
	if output != "" {
		lines := strings.Split(output, "\n")
		for i := len(lines) - 1; i >= 0; i-- {
			line := strings.TrimSpace(lines[i])
			if line != "" {
				return line
			}
		}
	}
	if fallback != nil {
		return fallback.Error()
	}
	return "validation failed"
}

func isValidationGateError(err error) bool {
	var target *ValidationGateError
	return errors.As(err, &target)
}
