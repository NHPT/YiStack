package handler

import (
	"strings"

	"yistack/internal/orchestration"
)

func (r *GenerateRequest) toGenerateCommand(userID string) orchestration.GenerateCommand {
	if r == nil {
		return orchestration.GenerateCommand{UserID: userID}
	}
	return orchestration.GenerateCommand{
		Context:           buildGenerateOrchestrationContext(r),
		UserID:            userID,
		ProjectID:         r.ProjectID,
		Prompt:            r.Prompt,
		AppType:           r.AppType,
		ProjectName:       r.ProjectName,
		ConversationStage: r.ConversationStage,
		PlanContext:       r.PlanContext,
		Mode:              r.Mode,
		Online:            r.Online,
		Provider:          r.Provider,
		Model:             r.Model,
		Temperature:       r.Temperature,
		BrowserAcceptance: r.BrowserAcceptance,
	}
}

func (r *GeneratePlansRequest) toGeneratePlansCommand(userID string) orchestration.GeneratePlansCommand {
	if r == nil {
		return orchestration.GeneratePlansCommand{UserID: userID}
	}
	return orchestration.GeneratePlansCommand{
		Context:      buildGeneratePlansOrchestrationContext(r),
		UserID:       userID,
		ProjectID:    r.ProjectID,
		Description:  r.Description,
		AppType:      r.AppType,
		Language:     r.Language,
		Provider:     r.Provider,
		UserFeedback: r.UserFeedback,
		CurrentPlans: r.CurrentPlans,
	}
}

func buildGenerateOrchestrationContext(r *GenerateRequest) orchestration.OrchestrationContext {
	if r == nil {
		return orchestration.OrchestrationContext{}
	}

	stage := strings.TrimSpace(r.ConversationStage)
	mode := strings.TrimSpace(r.Mode)
	stage, mode = orchestration.ResolveWorkflowStageMode(stage, mode, "", "")

	return orchestration.OrchestrationContext{
		WorkflowStage:     stage,
		WorkflowMode:      mode,
		CapabilityProfile: strings.TrimSpace(r.CapabilityProfile),
		RuntimeProjectID:  strings.TrimSpace(r.ProjectID),
		RuntimeAppType:    strings.TrimSpace(r.AppType),
		RuntimeProject:    strings.TrimSpace(r.ProjectName),
	}
}

func buildGeneratePlansOrchestrationContext(r *GeneratePlansRequest) orchestration.OrchestrationContext {
	if r == nil {
		return orchestration.OrchestrationContext{}
	}

	return orchestration.OrchestrationContext{
		WorkflowStage:    orchestration.WorkflowStagePlanAnalysis,
		WorkflowMode:     orchestration.WorkflowModePlan,
		RuntimeProjectID: strings.TrimSpace(r.ProjectID),
		RuntimeAppType:   strings.TrimSpace(r.AppType),
	}
}
