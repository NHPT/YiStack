package orchestration

import (
	"context"
	"fmt"
	"strings"

	"yistack/internal/service"
)

func prepareCapabilityWorkflowContext(
	ctx context.Context,
	command GenerateCommand,
	state EngineeringState,
	handler service.StreamEventHandler,
	executor CapabilityExecutor,
	registry CapabilityProviderRegistry,
) (context.Context, CapabilityContext, error) {
	capabilityContext := ResolveCapabilityContext(command.Context)
	if command.Online {
		capabilityContext = withOptionalOnlineContextCapability(capabilityContext)
	}
	ctx = withCapabilityContext(ctx, capabilityContext)
	resolution := registry.Resolve(capabilityContext)
	ctx = withCapabilityResolution(ctx, resolution)
	executionAudit := BuildCapabilityExecutionAudit(resolution)
	ctx = withCapabilityExecutionAudit(ctx, executionAudit)
	ctx = withCapabilityExecutionRequest(ctx, CapabilityExecutionRequest{
		UserID:    command.UserID,
		ProjectID: command.ProjectID,
	})
	if executor == nil {
		executor = NoopCapabilityExecutor{}
	}
	executionResult := executor.Execute(ctx, executionAudit)
	if strings.TrimSpace(executionResult.CapabilityProfile) == "" {
		executionResult.CapabilityProfile = strings.TrimSpace(capabilityContext.Profile)
	}
	ctx = withCapabilityExecutionResult(ctx, executionResult)
	if command.Online {
		ctx = service.WithOnlineContextCapabilitySnapshot(ctx, onlineContextCapabilitySnapshotFromExecutionResult(executionResult))
	}
	if strings.TrimSpace(executionResult.Status) == CapabilityExecutionResultStatusBlocked {
		blockedState := buildBlockedCapabilityEngineeringState(state, command, executionResult)
		ctx = withEngineeringState(ctx, blockedState)
		_ = emitCapabilityResolveStep(handler, blockedState, capabilityContext, resolution, executionAudit, executionResult, "failed")
		return ctx, capabilityContext, &CapabilityGateError{
			State:  blockedState,
			Result: executionResult,
		}
	}

	_ = emitCapabilityResolveStep(handler, state, capabilityContext, resolution, executionAudit, executionResult, "done")

	return ctx, capabilityContext, nil
}

func onlineContextCapabilitySnapshotFromExecutionResult(result CapabilityExecutionResult) service.OnlineContextCapabilitySnapshot {
	for _, item := range result.Items {
		if strings.TrimSpace(item.CapabilityID) != CapabilityOnlineContextSearchCrawl {
			continue
		}
		artifacts := make([]service.OnlineContextCapabilityArtifact, 0, len(item.Artifacts))
		for _, artifact := range item.Artifacts {
			artifacts = append(artifacts, service.OnlineContextCapabilityArtifact{
				ID:         strings.TrimSpace(artifact.ID),
				Type:       strings.TrimSpace(artifact.Type),
				Name:       strings.TrimSpace(artifact.Name),
				URI:        strings.TrimSpace(artifact.URI),
				SourceNote: strings.TrimSpace(artifact.SourceNote),
				Metadata:   artifact.Metadata,
			})
		}
		return service.OnlineContextCapabilitySnapshot{
			CapabilityID:   strings.TrimSpace(item.CapabilityID),
			Provider:       strings.TrimSpace(item.Provider),
			Status:         strings.TrimSpace(item.Status),
			ReasonCode:     strings.TrimSpace(item.ReasonCode),
			SourceNote:     strings.TrimSpace(item.SourceNote),
			Metadata:       item.Metadata,
			Artifacts:      artifacts,
			SourceSnapshot: "capability_execution_result",
		}
	}

	return service.OnlineContextCapabilitySnapshot{
		CapabilityID:   CapabilityOnlineContextSearchCrawl,
		Provider:       CapabilityProviderMCP,
		Status:         CapabilityExecutionResultStatusSkipped,
		ReasonCode:     "online_context_capability_missing",
		SourceNote:     "联网模式已请求，但本轮能力执行结果没有返回 online_context.search_crawl 项；主链路继续执行并注入 provider unavailable 事实。",
		SourceSnapshot: "capability_execution_result",
	}
}

// CapabilityGateError 表示能力执行层在进入主链路前阻断。
type CapabilityGateError struct {
	State  EngineeringState
	Result CapabilityExecutionResult
}

func (e *CapabilityGateError) Error() string {
	if e == nil {
		return ""
	}
	if item, ok := firstBlockedCapabilityResultItem(e.Result); ok {
		return fmt.Sprintf("capability execution blocked: %s", firstNonEmpty(item.SourceNote, item.ReasonCode, item.CapabilityID))
	}
	return ErrCapabilityExecutionBlocked.Error()
}

func (e *CapabilityGateError) Unwrap() error {
	return ErrCapabilityExecutionBlocked
}

func emitCapabilityResolveStep(
	handler service.StreamEventHandler,
	state EngineeringState,
	capabilityContext CapabilityContext,
	resolution CapabilityResolution,
	executionAudit CapabilityExecutionAudit,
	executionResult CapabilityExecutionResult,
	status string,
) error {
	return emitEngineeringStateStep(handler, buildEngineeringStateStep(
		"capability:resolve",
		"capability_resolve",
		"解析能力计划",
		capabilityResolveDetail(executionResult),
		status,
		state,
		map[string]interface{}{
			"capability_plan":     capabilityContextMeta(capabilityContext),
			"provider_resolution": capabilityResolutionMeta(resolution),
			"execution_audit":     capabilityExecutionAuditMeta(executionAudit),
			"execution_result":    capabilityExecutionResultMeta(executionResult),
			"source_note":         "能力计划与 provider 可用性由编排层统一解析；外部 Skill / MCP 只能经注入的 provider runner 执行，缺失 runner 时会阻断并进入恢复状态。",
		},
	))
}

func capabilityResolveDetail(result CapabilityExecutionResult) string {
	if strings.TrimSpace(result.Status) == CapabilityExecutionResultStatusBlocked {
		if item, ok := firstBlockedCapabilityResultItem(result); ok {
			return firstNonEmpty(
				strings.TrimSpace(item.SourceNote),
				fmt.Sprintf("能力 %s 执行被阻断。", item.CapabilityID),
			)
		}
		return "能力执行被阻断，主链路暂停。"
	}
	return "已根据当前编排阶段解析本次主链路能力计划，等待后续阶段消费。"
}

func buildBlockedCapabilityEngineeringState(state EngineeringState, command GenerateCommand, result CapabilityExecutionResult) EngineeringState {
	return state.withWorkflowStatus(EngineeringStatusFailed).
		withCurrentTask("处理能力执行阻断").
		withExecutionAutoProgress(false).
		withExecutionPause(true, "capability_execution_blocked", "capability_provider_runner", "接入缺失能力 runner 后重试").
		withRecovery(buildCapabilityExecutionRecoveryState(command, result))
}

func buildCapabilityExecutionRecoveryState(command GenerateCommand, result CapabilityExecutionResult) *RecoveryState {
	reasonCode := "capability_execution_blocked"
	reasonMessage := "能力执行被阻断，主链路已暂停。"
	if item, ok := firstBlockedCapabilityResultItem(result); ok {
		reasonCode = firstNonEmpty(strings.TrimSpace(item.ReasonCode), reasonCode)
		reasonMessage = firstNonEmpty(strings.TrimSpace(item.SourceNote), reasonMessage)
	}

	return &RecoveryState{
		Blocked:       true,
		ReasonCode:    reasonCode,
		ReasonMessage: reasonMessage,
		ResumeStage:   strings.TrimSpace(command.Context.WorkflowStage),
		ResumeMode:    strings.TrimSpace(command.Context.WorkflowMode),
		CanRetry:      true,
		RetryLabel:    "修复能力 provider 后重试",
		RetryPrompt:   "请确认缺失的 Skill / MCP runner 已接入或调整能力计划，然后重试当前工作流。",
	}
}

func firstBlockedCapabilityResultItem(result CapabilityExecutionResult) (CapabilityExecutionResultItem, bool) {
	for _, item := range result.Items {
		if strings.TrimSpace(item.Status) == CapabilityExecutionResultStatusBlocked {
			return item, true
		}
	}
	return CapabilityExecutionResultItem{}, false
}
