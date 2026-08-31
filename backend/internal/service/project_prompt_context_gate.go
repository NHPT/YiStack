package service

import (
	"errors"
	"strings"
)

const contextMemoryIsolationGate = "context-memory-isolation"

func emitProjectPromptContextConflict(handler StreamEventHandler, req *GenerateRequest, err error) error {
	if handler == nil || req == nil || err == nil {
		return nil
	}

	var conflictErr *ProjectPromptContextConflictError
	if !errors.As(err, &conflictErr) || conflictErr == nil {
		return nil
	}

	detail := "检测到当前项目上下文不可用或冲突，已阻断继续生成。"
	_ = emitWorkflowStep(handler, "load-project-context", "read_file", "读取项目上下文", detail, "failed", map[string]interface{}{
		"code":      "context_gate_blocked",
		"gate":      contextMemoryIsolationGate,
		"projectId": strings.TrimSpace(req.ProjectID),
		"reasons":   normalizedConflictReasons(conflictErr.Reasons),
	})

	return handler(StreamEventError, buildProjectPromptContextGatePayload(req, conflictErr))
}

func buildProjectPromptContextGatePayload(req *GenerateRequest, err *ProjectPromptContextConflictError) map[string]interface{} {
	reasons := normalizedConflictReasons(nil)
	if err != nil {
		reasons = normalizedConflictReasons(err.Reasons)
	}

	projectID := ""
	projectName := ""
	appType := ""
	mode := "implement"
	stage := ""
	if req != nil {
		projectID = strings.TrimSpace(req.ProjectID)
		projectName = strings.TrimSpace(req.ProjectName)
		appType = strings.TrimSpace(req.AppType)
		mode = req.workflowMode(mode)
		stage = req.workflowStage("")
	}

	reasonMessage := "检测到当前项目上下文不可用或冲突，已阻断继续生成。"
	nextAction := "确认 .yistack/PROJECT_CONTEXT.md 与 .yistack/foundation/bootstrap_state.json 可读取且属于当前项目后重试。"
	retryLabel := "修复后重试"
	retryPrompt := buildProjectPromptContextRetryPrompt(stage, mode)

	return map[string]interface{}{
		"error":   firstNonEmpty(errorString(err), "project prompt context conflict detected"),
		"message": reasonMessage,
		"code":    "context_gate_blocked",
		"gate":    contextMemoryIsolationGate,
		"gate_result": map[string]interface{}{
			"decision":       "block",
			"reasons":        reasons,
			"blocking_items": reasons,
			"warning_items":  []string{},
			"next_action":    nextAction,
		},
		"engineeringState": map[string]interface{}{
			"workflow": map[string]interface{}{
				"stage":  stage,
				"mode":   mode,
				"status": "failed",
			},
			"validation": map[string]interface{}{
				"gate":   contextMemoryIsolationGate,
				"status": "failed",
			},
			"runtime": map[string]interface{}{
				"project_id":   projectID,
				"app_type":     appType,
				"project_name": projectName,
				"status":       "pending",
			},
			"execution": map[string]interface{}{
				"auto_progress_enabled": false,
				"awaiting_confirmation": true,
				"pause_reason":          "context_gate_blocked",
				"approval_boundary":     "context_governance",
				"current_task":          "处理项目上下文冲突",
				"next_action":           nextAction,
			},
			"recovery": map[string]interface{}{
				"blocked":        true,
				"reason_code":    "context_gate_blocked",
				"reason_message": reasonMessage,
				"resume_stage":   stage,
				"resume_mode":    mode,
				"can_retry":      true,
				"retry_label":    retryLabel,
				"retry_prompt":   retryPrompt,
			},
		},
	}
}

func buildProjectPromptContextRetryPrompt(stage, mode string) string {
	workflowMode := strings.TrimSpace(mode)
	if workflowMode == "" {
		workflowMode = "implement"
	}

	workflowStage := strings.TrimSpace(stage)
	stageHint := ""
	if workflowStage != "" {
		stageHint = "，并继续当前阶段（" + workflowStage + "）"
	}

	switch workflowMode {
	case "foundation":
		return "当前项目上下文已修复。请重新读取 .yistack/PROJECT_CONTEXT.md 与 .yistack/foundation/bootstrap_state.json，确认当前项目命名空间无冲突" + stageHint + "。"
	case "discuss":
		return "当前项目上下文已修复。请重新读取 .yistack/PROJECT_CONTEXT.md 与 .yistack/foundation/bootstrap_state.json，基于当前项目命名空间继续之前的技术探讨任务" + stageHint + "。"
	default:
		return "当前项目上下文已修复。请重新读取 .yistack/PROJECT_CONTEXT.md 与 .yistack/foundation/bootstrap_state.json，基于当前项目命名空间继续之前的实现任务" + stageHint + "。"
	}
}

func normalizedConflictReasons(reasons []string) []string {
	if len(reasons) == 0 {
		return []string{}
	}
	normalized := make([]string, 0, len(reasons))
	for _, reason := range reasons {
		if trimmed := strings.TrimSpace(reason); trimmed != "" {
			normalized = append(normalized, trimmed)
		}
	}
	if len(normalized) == 0 {
		return []string{}
	}
	return normalized
}

func errorString(err error) string {
	if err == nil {
		return ""
	}
	return strings.TrimSpace(err.Error())
}
