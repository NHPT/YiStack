package orchestration

import (
	"context"
	"encoding/json"
	"strings"

	"yistack/internal/model"
)

// CapabilityExecutionAuditLogRepo 是能力执行审计的最小落库接口。
type CapabilityExecutionAuditLogRepo interface {
	Create(ctx context.Context, audit *model.ProjectCapabilityExecutionAudit) error
}

// RecordingCapabilityExecutor 在委托 executor 产出结果后，追加记录能力执行审计。
type RecordingCapabilityExecutor struct {
	Delegate  CapabilityExecutor
	AuditRepo CapabilityExecutionAuditLogRepo
}

func (e RecordingCapabilityExecutor) Execute(ctx context.Context, audit CapabilityExecutionAudit) CapabilityExecutionResult {
	delegate := e.Delegate
	if delegate == nil {
		delegate = NoopCapabilityExecutor{}
	}
	result := delegate.Execute(ctx, audit)
	e.record(ctx, audit, result)
	return result
}

func (e RecordingCapabilityExecutor) record(ctx context.Context, audit CapabilityExecutionAudit, result CapabilityExecutionResult) {
	if e.AuditRepo == nil {
		return
	}

	orchestrationContext, _ := OrchestrationContextFromContext(ctx)
	requestContext, _ := CapabilityExecutionRequestFromContext(ctx)
	capabilityContext, _ := CapabilityContextFromContext(ctx)
	resolution, _ := CapabilityResolutionFromContext(ctx)

	projectID := firstNonEmpty(
		strings.TrimSpace(requestContext.ProjectID),
		strings.TrimSpace(orchestrationContext.RuntimeProjectID),
	)
	if projectID == "" {
		return
	}

	record := &model.ProjectCapabilityExecutionAudit{
		ProjectID:          projectID,
		UserID:             strings.TrimSpace(requestContext.UserID),
		WorkflowStage:      strings.TrimSpace(orchestrationContext.WorkflowStage),
		WorkflowMode:       strings.TrimSpace(orchestrationContext.WorkflowMode),
		CapabilityProfile:  firstNonEmpty(strings.TrimSpace(capabilityContext.Profile), strings.TrimSpace(resolution.Profile)),
		Status:             strings.TrimSpace(result.Status),
		ProviderResolution: capabilityAuditJSON(capabilityResolutionMeta(resolution)),
		ExecutionAudit:     capabilityAuditJSON(capabilityExecutionAuditMeta(audit)),
		ExecutionResult:    capabilityAuditJSON(capabilityExecutionResultMeta(result)),
		SourceNote:         "能力执行审计由 RecordingCapabilityExecutor 在编排层统一记录；失败写入不阻断主链路。",
	}

	// 审计写入是观测增强，不应反向破坏生成链路。
	_ = e.AuditRepo.Create(ctx, record)
}

func capabilityAuditJSON(value interface{}) string {
	payload, err := json.Marshal(value)
	if err != nil {
		return "{}"
	}
	return string(payload)
}
