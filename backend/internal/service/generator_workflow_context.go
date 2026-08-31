package service

import "strings"

const (
	serviceWorkflowStageBootstrap          = "bootstrap"
	serviceWorkflowStageBootstrapReview    = "bootstrap_review"
	serviceWorkflowStageBootstrapConfirmed = "bootstrap_confirmed"
	serviceWorkflowStagePlanAnalysis       = "plan-analysis"
	serviceWorkflowStagePlanSelection      = "plan-selection"
	serviceWorkflowStagePlanApproved       = "plan-approved"
	serviceWorkflowStageImplement          = "implement"
	serviceWorkflowModeFoundation          = "foundation"
	serviceWorkflowModePlan                = "plan"
	serviceWorkflowModeDiscuss             = "discuss"
	serviceWorkflowModeImplement           = "implement"
)

// workflowStage 返回进入 service 前已由 orchestration 归一化的 workflow stage。
func (r *GenerateRequest) workflowStage(defaultStage string) string {
	if r == nil {
		return strings.TrimSpace(defaultStage)
	}
	stage := strings.TrimSpace(r.ConversationStage)
	if stage != "" {
		return stage
	}
	if mode := strings.TrimSpace(r.Mode); mode != "" {
		return mode
	}
	return strings.TrimSpace(defaultStage)
}

// workflowMode 返回进入 service 前已由 orchestration 归一化的 workflow mode。
func (r *GenerateRequest) workflowMode(defaultMode string) string {
	if r == nil {
		return strings.TrimSpace(defaultMode)
	}
	if mode := strings.TrimSpace(r.Mode); mode != "" {
		return mode
	}

	switch strings.TrimSpace(r.ConversationStage) {
	case serviceWorkflowStageBootstrap, serviceWorkflowStageBootstrapReview, serviceWorkflowStageBootstrapConfirmed:
		return serviceWorkflowModeFoundation
	case serviceWorkflowStagePlanAnalysis:
		return serviceWorkflowModePlan
	case serviceWorkflowStagePlanSelection:
		return serviceWorkflowModeDiscuss
	case serviceWorkflowStagePlanApproved, serviceWorkflowStageImplement:
		return serviceWorkflowModeImplement
	default:
		return strings.TrimSpace(defaultMode)
	}
}
