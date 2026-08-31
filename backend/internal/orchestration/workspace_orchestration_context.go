package orchestration

import "context"

type orchestrationContextKey struct{}
type engineeringStateContextKey struct{}
type capabilityContextKey struct{}
type capabilityResolutionContextKey struct{}
type capabilityExecutionAuditContextKey struct{}
type capabilityExecutionResultContextKey struct{}
type capabilityExecutionRequestContextKey struct{}

type CapabilityExecutionRequest struct {
	UserID    string
	ProjectID string
}

func withOrchestrationContext(ctx context.Context, orchestrationContext OrchestrationContext) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, orchestrationContextKey{}, orchestrationContext)
}

func withEngineeringState(ctx context.Context, engineeringState EngineeringState) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, engineeringStateContextKey{}, engineeringState)
}

func withCapabilityContext(ctx context.Context, capabilityContext CapabilityContext) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, capabilityContextKey{}, capabilityContext)
}

func withCapabilityResolution(ctx context.Context, resolution CapabilityResolution) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, capabilityResolutionContextKey{}, resolution)
}

func withCapabilityExecutionAudit(ctx context.Context, audit CapabilityExecutionAudit) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, capabilityExecutionAuditContextKey{}, audit)
}

func withCapabilityExecutionResult(ctx context.Context, result CapabilityExecutionResult) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, capabilityExecutionResultContextKey{}, result)
}

func withCapabilityExecutionRequest(ctx context.Context, request CapabilityExecutionRequest) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, capabilityExecutionRequestContextKey{}, request)
}

// OrchestrationContextFromContext 读取主链路编排上下文。
func OrchestrationContextFromContext(ctx context.Context) (OrchestrationContext, bool) {
	if ctx == nil {
		return OrchestrationContext{}, false
	}
	orchestrationContext, ok := ctx.Value(orchestrationContextKey{}).(OrchestrationContext)
	return orchestrationContext, ok
}

// EngineeringStateFromContext 读取主链路工程状态快照。
func EngineeringStateFromContext(ctx context.Context) (EngineeringState, bool) {
	if ctx == nil {
		return EngineeringState{}, false
	}
	engineeringState, ok := ctx.Value(engineeringStateContextKey{}).(EngineeringState)
	return engineeringState, ok
}

// CapabilityContextFromContext 读取主链路能力计划上下文。
func CapabilityContextFromContext(ctx context.Context) (CapabilityContext, bool) {
	if ctx == nil {
		return CapabilityContext{}, false
	}
	capabilityContext, ok := ctx.Value(capabilityContextKey{}).(CapabilityContext)
	return capabilityContext, ok
}

// CapabilityResolutionFromContext 读取主链路能力 provider 解析结果。
func CapabilityResolutionFromContext(ctx context.Context) (CapabilityResolution, bool) {
	if ctx == nil {
		return CapabilityResolution{}, false
	}
	resolution, ok := ctx.Value(capabilityResolutionContextKey{}).(CapabilityResolution)
	return resolution, ok
}

// CapabilityExecutionAuditFromContext 读取主链路能力执行审计摘要。
func CapabilityExecutionAuditFromContext(ctx context.Context) (CapabilityExecutionAudit, bool) {
	if ctx == nil {
		return CapabilityExecutionAudit{}, false
	}
	audit, ok := ctx.Value(capabilityExecutionAuditContextKey{}).(CapabilityExecutionAudit)
	return audit, ok
}

// CapabilityExecutionResultFromContext 读取主链路能力执行层结果。
func CapabilityExecutionResultFromContext(ctx context.Context) (CapabilityExecutionResult, bool) {
	if ctx == nil {
		return CapabilityExecutionResult{}, false
	}
	result, ok := ctx.Value(capabilityExecutionResultContextKey{}).(CapabilityExecutionResult)
	return result, ok
}

func CapabilityExecutionRequestFromContext(ctx context.Context) (CapabilityExecutionRequest, bool) {
	if ctx == nil {
		return CapabilityExecutionRequest{}, false
	}
	request, ok := ctx.Value(capabilityExecutionRequestContextKey{}).(CapabilityExecutionRequest)
	return request, ok
}
