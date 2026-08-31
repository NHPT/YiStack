package orchestration

import (
	"context"
	"strings"
)

const (
	CapabilityExecutionResultStatusDeferred = "deferred"
	CapabilityExecutionResultStatusSkipped  = "skipped"
	CapabilityExecutionResultStatusExecuted = "executed"
	CapabilityExecutionResultStatusBlocked  = "blocked"
)

// CapabilityExecutionResultItem 描述单项能力的执行层结果。
type CapabilityExecutionResultItem struct {
	CapabilityID string
	Provider     string
	Status       string
	ReasonCode   string
	SourceNote   string
	Metadata     map[string]interface{}
	Artifacts    []CapabilityExecutionArtifact
}

// CapabilityExecutionArtifact 描述外部能力执行产出的最小结构化 artifact。
type CapabilityExecutionArtifact struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"`
	Name       string                 `json:"name"`
	URI        string                 `json:"uri"`
	SourceNote string                 `json:"source_note"`
	Metadata   map[string]interface{} `json:"metadata"`
}

// CapabilityExecutionResult 描述一次能力执行层处理结果。
type CapabilityExecutionResult struct {
	Status            string
	CapabilityProfile string
	Items             []CapabilityExecutionResultItem
	SourceNote        string
}

// CapabilityExecutor 是真实 Skill / MCP 执行器的最小接口。
type CapabilityExecutor interface {
	Execute(ctx context.Context, audit CapabilityExecutionAudit) CapabilityExecutionResult
}

// NoopCapabilityExecutor 是当前默认执行器。
// 它不调用外部 Skill / MCP，只把执行前审计转成稳定执行结果。
type NoopCapabilityExecutor struct{}

func (NoopCapabilityExecutor) Execute(_ context.Context, audit CapabilityExecutionAudit) CapabilityExecutionResult {
	items := make([]CapabilityExecutionResultItem, 0, len(audit.Items))
	status := CapabilityExecutionResultStatusDeferred

	for _, auditItem := range audit.Items {
		resultStatus := CapabilityExecutionResultStatusDeferred
		sourceNote := "默认执行器未调用外部能力；该能力继续由现有编排或 service 阶段承接。"
		switch strings.TrimSpace(auditItem.Status) {
		case CapabilityExecutionStatusBlocked:
			resultStatus = CapabilityExecutionResultStatusBlocked
			status = CapabilityExecutionResultStatusBlocked
			sourceNote = firstNonEmpty(
				strings.TrimSpace(auditItem.SourceNote),
				"默认执行器检测到能力已被审计阶段阻断。",
			)
		case CapabilityExecutionStatusSkipped:
			resultStatus = CapabilityExecutionResultStatusSkipped
			sourceNote = "默认执行器未注入外部能力运行器；该能力保持跳过状态。"
		}
		status = mergeCapabilityExecutionResultStatus(status, resultStatus)
		items = append(items, CapabilityExecutionResultItem{
			CapabilityID: strings.TrimSpace(auditItem.CapabilityID),
			Provider:     strings.TrimSpace(auditItem.Provider),
			Status:       resultStatus,
			ReasonCode:   strings.TrimSpace(auditItem.ReasonCode),
			SourceNote:   sourceNote,
			Metadata: map[string]interface{}{
				"executor": "noop",
			},
		})
	}

	return CapabilityExecutionResult{
		Status:     status,
		Items:      items,
		SourceNote: "NoopCapabilityExecutor 只固化执行层结果契约；真实 Skill / MCP 执行器将在后续阶段替换该实现。",
	}
}

func capabilityExecutionResultMeta(result CapabilityExecutionResult) map[string]interface{} {
	items := make([]map[string]interface{}, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, map[string]interface{}{
			"capability_id": strings.TrimSpace(item.CapabilityID),
			"provider":      strings.TrimSpace(item.Provider),
			"status":        strings.TrimSpace(item.Status),
			"reason_code":   strings.TrimSpace(item.ReasonCode),
			"source_note":   strings.TrimSpace(item.SourceNote),
			"metadata":      capabilityMetadataPayload(item.Metadata),
			"artifacts":     capabilityArtifactsPayload(item.Artifacts),
		})
	}

	return map[string]interface{}{
		"status":             strings.TrimSpace(result.Status),
		"capability_profile": strings.TrimSpace(result.CapabilityProfile),
		"items":              items,
		"source_note":        strings.TrimSpace(result.SourceNote),
	}
}

func capabilityMetadataPayload(metadata map[string]interface{}) map[string]interface{} {
	if len(metadata) == 0 {
		return map[string]interface{}{}
	}
	return metadata
}

func capabilityArtifactsPayload(artifacts []CapabilityExecutionArtifact) []map[string]interface{} {
	items := make([]map[string]interface{}, 0, len(artifacts))
	for _, artifact := range artifacts {
		items = append(items, map[string]interface{}{
			"id":          strings.TrimSpace(artifact.ID),
			"type":        strings.TrimSpace(artifact.Type),
			"name":        strings.TrimSpace(artifact.Name),
			"uri":         strings.TrimSpace(artifact.URI),
			"source_note": strings.TrimSpace(artifact.SourceNote),
			"metadata":    capabilityMetadataPayload(artifact.Metadata),
		})
	}
	return items
}
