package orchestration

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

// CapabilityProviderRunResult 是单个外部 provider runner 的最小返回结构。
type CapabilityProviderRunResult struct {
	Status     string                        `json:"status"`
	ReasonCode string                        `json:"reason_code"`
	SourceNote string                        `json:"source_note"`
	Metadata   map[string]interface{}        `json:"metadata"`
	Artifacts  []CapabilityExecutionArtifact `json:"artifacts"`
}

// CapabilityProviderRunner 是 Skill / MCP runner 的最小适配接口。
type CapabilityProviderRunner interface {
	ExecuteCapability(ctx context.Context, item CapabilityExecutionAuditItem) CapabilityProviderRunResult
}

// CapabilityExecutionPolicy 描述外部 provider 是否允许在当前组合根中真实执行。
type CapabilityExecutionPolicy struct {
	EnableSkill bool
	EnableMCP   bool
	SourceNote  string
}

// ExternalCapabilityExecutor 将已通过审计的外部能力分派给 Skill / MCP runner。
// 未注入 runner 时不会静默成功，而是返回 blocked，等待恢复策略处理。
type ExternalCapabilityExecutor struct {
	Fallback    CapabilityExecutor
	SkillRunner CapabilityProviderRunner
	MCPRunner   CapabilityProviderRunner
	Policy      CapabilityExecutionPolicy
	Boundary    CapabilityRunnerBoundary
}

func (e ExternalCapabilityExecutor) Execute(ctx context.Context, audit CapabilityExecutionAudit) CapabilityExecutionResult {
	items := make([]CapabilityExecutionResultItem, 0, len(audit.Items))
	status := CapabilityExecutionResultStatusDeferred

	for _, auditItem := range audit.Items {
		resultItem := e.executeAuditItem(ctx, auditItem)
		status = mergeCapabilityExecutionResultStatus(status, resultItem.Status)
		items = append(items, resultItem)
	}

	return CapabilityExecutionResult{
		Status:     status,
		Items:      items,
		SourceNote: "ExternalCapabilityExecutor 只分派已解析且被执行策略允许的 Skill / MCP 能力；策略未启用或未注入 runner 时返回 blocked，不执行隐式降级。",
	}
}

func (e ExternalCapabilityExecutor) executeAuditItem(ctx context.Context, auditItem CapabilityExecutionAuditItem) CapabilityExecutionResultItem {
	if strings.TrimSpace(auditItem.Status) == CapabilityExecutionStatusBlocked {
		return capabilityExecutionResultFromAudit(auditItem, CapabilityExecutionResultStatusBlocked, auditItem.ReasonCode, auditItem.SourceNote)
	}
	if strings.TrimSpace(auditItem.Status) == CapabilityExecutionStatusSkipped &&
		strings.TrimSpace(auditItem.ReasonCode) == "optional_provider_unavailable" {
		return capabilityExecutionResultFromAudit(auditItem, CapabilityExecutionResultStatusSkipped, auditItem.ReasonCode, auditItem.SourceNote)
	}

	provider := strings.TrimSpace(auditItem.Provider)
	if provider != CapabilityProviderSkill && provider != CapabilityProviderMCP {
		fallback := e.Fallback
		if fallback == nil {
			fallback = NoopCapabilityExecutor{}
		}
		result := fallback.Execute(ctx, CapabilityExecutionAudit{Items: []CapabilityExecutionAuditItem{auditItem}})
		if len(result.Items) == 0 {
			return capabilityExecutionResultFromAudit(auditItem, CapabilityExecutionResultStatusDeferred, auditItem.ReasonCode, auditItem.SourceNote)
		}
		return result.Items[0]
	}

	if !e.policyAllowsProvider(provider) {
		result := capabilityExecutionResultFromAudit(
			auditItem,
			CapabilityExecutionResultStatusBlocked,
			"external_capability_execution_disabled",
			firstNonEmpty(
				strings.TrimSpace(e.Policy.SourceNote),
				"外部能力 provider 已解析，但当前执行策略未允许真实调用 Skill / MCP runner。",
			),
		)
		return optionalCapabilityExecutionResult(auditItem, result)
	}

	runner := e.runnerForProvider(provider)
	if runner == nil {
		result := capabilityExecutionResultFromAudit(
			auditItem,
			CapabilityExecutionResultStatusBlocked,
			"provider_runner_unavailable",
			"能力 provider 已解析为外部执行，但组合根尚未注入对应 Skill / MCP runner。",
		)
		return optionalCapabilityExecutionResult(auditItem, result)
	}

	runnerCtx, cancel := e.Boundary.Context(ctx)
	defer cancel()
	runnerCtx = withCapabilityRunnerBoundary(runnerCtx, e.Boundary)

	runResult := executeCapabilityProviderRunner(runnerCtx, runner, auditItem)
	return optionalCapabilityExecutionResult(auditItem, capabilityExecutionResultFromRunResult(auditItem, runResult))
}

func (e ExternalCapabilityExecutor) policyAllowsProvider(provider string) bool {
	switch strings.TrimSpace(provider) {
	case CapabilityProviderSkill:
		return e.Policy.EnableSkill
	case CapabilityProviderMCP:
		return e.Policy.EnableMCP
	default:
		return true
	}
}

func (e ExternalCapabilityExecutor) runnerForProvider(provider string) CapabilityProviderRunner {
	switch strings.TrimSpace(provider) {
	case CapabilityProviderSkill:
		return e.SkillRunner
	case CapabilityProviderMCP:
		return e.MCPRunner
	default:
		return nil
	}
}

func capabilityExecutionResultFromAudit(auditItem CapabilityExecutionAuditItem, status, reasonCode, sourceNote string) CapabilityExecutionResultItem {
	return CapabilityExecutionResultItem{
		CapabilityID: strings.TrimSpace(auditItem.CapabilityID),
		Provider:     strings.TrimSpace(auditItem.Provider),
		Status:       strings.TrimSpace(status),
		ReasonCode:   strings.TrimSpace(reasonCode),
		SourceNote:   strings.TrimSpace(sourceNote),
		Metadata:     capabilityExecutionResultMetadata(auditItem, nil, "capability_audit"),
	}
}

func capabilityExecutionResultFromRunResult(auditItem CapabilityExecutionAuditItem, runResult CapabilityProviderRunResult) CapabilityExecutionResultItem {
	status, reasonCode, sourceNote := normalizeProviderRunResult(runResult)
	return CapabilityExecutionResultItem{
		CapabilityID: strings.TrimSpace(auditItem.CapabilityID),
		Provider:     strings.TrimSpace(auditItem.Provider),
		Status:       status,
		ReasonCode:   reasonCode,
		SourceNote:   sourceNote,
		Metadata:     capabilityExecutionResultMetadata(auditItem, runResult.Metadata, "capability_runner"),
		Artifacts:    runResult.Artifacts,
	}
}

func capabilityExecutionResultMetadata(auditItem CapabilityExecutionAuditItem, runnerMetadata map[string]interface{}, source string) map[string]interface{} {
	metadata := capabilityMetadataPayload(runnerMetadata)
	metadata["source"] = strings.TrimSpace(source)
	metadata["capability_version"] = strings.TrimSpace(auditItem.CapabilityVersion)
	metadata["capability_catalog_source"] = strings.TrimSpace(auditItem.CapabilityCatalogSource)
	metadata["provider_resolution_status"] = strings.TrimSpace(auditItem.ProviderResolutionStatus)
	return metadata
}

func optionalCapabilityExecutionResult(auditItem CapabilityExecutionAuditItem, result CapabilityExecutionResultItem) CapabilityExecutionResultItem {
	if auditItem.Required || strings.TrimSpace(result.Status) != CapabilityExecutionResultStatusBlocked {
		return result
	}
	result.Status = CapabilityExecutionResultStatusSkipped
	if strings.TrimSpace(result.ReasonCode) == "" {
		result.ReasonCode = "optional_capability_execution_skipped"
	}
	if strings.TrimSpace(result.SourceNote) == "" {
		result.SourceNote = "可选外部能力未完成执行，主链路继续。"
	}
	if result.Metadata == nil {
		result.Metadata = map[string]interface{}{}
	}
	result.Metadata["optional"] = true
	result.Metadata["original_status"] = CapabilityExecutionResultStatusBlocked
	return result
}

func executeCapabilityProviderRunner(ctx context.Context, runner CapabilityProviderRunner, auditItem CapabilityExecutionAuditItem) (result CapabilityProviderRunResult) {
	if err := ctx.Err(); err != nil {
		return capabilityProviderRunResultFromContextError(err)
	}
	defer func() {
		if recovered := recover(); recovered != nil {
			result = CapabilityProviderRunResult{
				Status:     CapabilityExecutionResultStatusBlocked,
				ReasonCode: "provider_runner_failed",
				SourceNote: fmt.Sprintf("外部 provider runner 执行失败并触发 panic：%v", recovered),
				Metadata: map[string]interface{}{
					"failure_type": "panic",
				},
			}
		}
	}()

	result = runner.ExecuteCapability(ctx, auditItem)
	if err := ctx.Err(); err != nil {
		return capabilityProviderRunResultFromContextError(err)
	}
	return result
}

func capabilityProviderRunResultFromContextError(err error) CapabilityProviderRunResult {
	reasonCode := "provider_runner_cancelled"
	sourceNote := "外部 provider runner 执行已被取消。"
	if errors.Is(err, context.DeadlineExceeded) {
		reasonCode = "provider_runner_timeout"
		sourceNote = "外部 provider runner 执行超时。"
	}
	return CapabilityProviderRunResult{
		Status:     CapabilityExecutionResultStatusBlocked,
		ReasonCode: reasonCode,
		SourceNote: sourceNote,
		Metadata: map[string]interface{}{
			"error": err.Error(),
		},
	}
}

func normalizeProviderRunResult(result CapabilityProviderRunResult) (string, string, string) {
	status := strings.TrimSpace(result.Status)
	switch strings.TrimSpace(status) {
	case CapabilityExecutionResultStatusExecuted:
		return CapabilityExecutionResultStatusExecuted,
			firstNonEmpty(strings.TrimSpace(result.ReasonCode), "provider_runner_executed"),
			firstNonEmpty(strings.TrimSpace(result.SourceNote), "外部 provider runner 已完成该能力执行。")
	case CapabilityExecutionResultStatusSkipped:
		return CapabilityExecutionResultStatusSkipped,
			firstNonEmpty(strings.TrimSpace(result.ReasonCode), "provider_runner_skipped"),
			firstNonEmpty(strings.TrimSpace(result.SourceNote), "外部 provider runner 已跳过该能力执行。")
	case CapabilityExecutionResultStatusBlocked:
		return CapabilityExecutionResultStatusBlocked,
			firstNonEmpty(strings.TrimSpace(result.ReasonCode), "provider_runner_blocked"),
			firstNonEmpty(strings.TrimSpace(result.SourceNote), "外部 provider runner 阻断了该能力执行。")
	default:
		return CapabilityExecutionResultStatusBlocked,
			firstNonEmpty(strings.TrimSpace(result.ReasonCode), "provider_runner_invalid_result"),
			firstNonEmpty(strings.TrimSpace(result.SourceNote), "外部 provider runner 返回了无法识别的执行状态。")
	}
}

func mergeCapabilityExecutionResultStatus(current, next string) string {
	if strings.TrimSpace(next) == CapabilityExecutionResultStatusBlocked {
		return CapabilityExecutionResultStatusBlocked
	}
	if strings.TrimSpace(current) == CapabilityExecutionResultStatusBlocked {
		return CapabilityExecutionResultStatusBlocked
	}
	if strings.TrimSpace(next) == CapabilityExecutionResultStatusExecuted {
		return CapabilityExecutionResultStatusExecuted
	}
	if strings.TrimSpace(current) == CapabilityExecutionResultStatusExecuted {
		return CapabilityExecutionResultStatusExecuted
	}
	if strings.TrimSpace(next) == CapabilityExecutionResultStatusSkipped {
		return CapabilityExecutionResultStatusSkipped
	}
	if strings.TrimSpace(current) == CapabilityExecutionResultStatusSkipped {
		return CapabilityExecutionResultStatusSkipped
	}
	return CapabilityExecutionResultStatusDeferred
}
