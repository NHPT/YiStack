package orchestration

import (
	"context"
	"errors"

	"yistack/internal/service"
)

// PlanOrchestrator 承接方案链路的最小编排。
type PlanOrchestrator struct {
	planService    *service.PlanService
	artifactLoader projectArtifactLoader
}

// NewPlanOrchestrator 创建方案链路编排入口。
func NewPlanOrchestrator(planService *service.PlanService, artifactLoaders ...projectArtifactLoader) *PlanOrchestrator {
	var artifactLoader projectArtifactLoader
	if len(artifactLoaders) > 0 {
		artifactLoader = artifactLoaders[0]
	}
	return &PlanOrchestrator{
		planService:    planService,
		artifactLoader: artifactLoader,
	}
}

func (o *PlanOrchestrator) GeneratePlansStream(ctx context.Context, command GeneratePlansCommand, handler service.StreamEventHandler) (*service.GeneratePlansResponse, string, error) {
	command = command.normalized()
	ctx = withOrchestrationContext(ctx, command.Context)
	state := BuildEngineeringState(command.Context).
		withCurrentTask("分析需求并生成候选方案").
		withNextAction("等待候选方案生成完成")
	ctx = withEngineeringState(ctx, state)

	if o == nil || o.planService == nil {
		emitPlanAnalysisRunningStep(command, state, handler)
		finishFailedPlanAnalysisWorkflowStage(command, state, ErrPlanOrchestrationUnavailable, handler)
		return nil, "", ErrPlanOrchestrationUnavailable
	}
	if command.Description == "" {
		return nil, "", ErrDescriptionRequired
	}
	if _, err := executeFoundationGateBeforePlan(ctx, command, o.artifactLoader, state, handler); err != nil {
		return nil, "", err
	}
	foundationContext := buildPlanFoundationContext(ctx, command, o.artifactLoader)

	emitPlanAnalysisRunningStep(command, state, handler)

	req := &service.GeneratePlansRequest{
		UserID:            command.UserID,
		ProjectID:         command.ProjectID,
		Description:       command.Description,
		AppType:           command.AppType,
		Language:          command.Language,
		Provider:          command.Provider,
		UserFeedback:      command.UserFeedback,
		FoundationContext: foundationContext,
		CurrentPlans:      command.CurrentPlans,
	}
	response, analysis, err := o.planService.GeneratePlansStream(ctx, req, handler)
	if err != nil {
		finishFailedPlanAnalysisWorkflowStage(command, state, err, handler)
		return nil, "", err
	}
	doneState := buildPlanAnalysisDoneState(state)
	_ = emitEngineeringStateStep(handler, buildPlanAnalysisWorkflowStageStep(
		command,
		doneState,
		"orchestration:plan-analysis:done",
		"方案生成完成",
		"候选技术方案已生成，等待用户选择方案或确认推荐方案。",
		"done",
		nil,
	))
	return response, analysis, nil
}

func buildPlanFoundationContext(ctx context.Context, command GeneratePlansCommand, artifactLoader projectArtifactLoader) string {
	if artifactLoader == nil || command.ProjectID == "" {
		return ""
	}
	content, found, err := artifactLoader.LoadProjectArtifact(ctx, command.ProjectID, service.ProjectBootstrapStatePath)
	if err != nil || !found {
		return ""
	}
	return service.BuildFoundationDesignReadinessPromptSummary(content)
}

func emitPlanAnalysisRunningStep(command GeneratePlansCommand, state EngineeringState, handler service.StreamEventHandler) {
	_ = emitEngineeringStateStep(handler, buildPlanAnalysisWorkflowStageStep(
		command,
		state,
		"orchestration:plan-analysis",
		"进入方案分析阶段",
		"正在分析需求并生成候选方案。",
		"running",
		nil,
	))
}

func finishFailedPlanAnalysisWorkflowStage(
	command GeneratePlansCommand,
	state EngineeringState,
	err error,
	handler service.StreamEventHandler,
) EngineeringState {
	if err == nil {
		err = errors.New("plan generation failed")
	}
	failedState := buildPlanAnalysisFailedState(command, state, err.Error())
	_ = emitEngineeringStateStep(handler, buildPlanAnalysisWorkflowStageStep(
		command,
		failedState,
		"orchestration:plan-analysis:failed",
		"方案生成失败",
		err.Error(),
		"failed",
		nil,
	))
	return failedState
}

func buildPlanAnalysisFailedState(command GeneratePlansCommand, state EngineeringState, detail string) EngineeringState {
	return state.
		withWorkflowStatus(EngineeringStatusFailed).
		withCurrentTask("方案生成失败").
		withExecutionAutoProgress(false).
		withExecutionPause(true, "plan_generation_failed", "plan_generation", "修复方案生成失败原因后重试").
		withRecovery(buildPlanAnalysisRecoveryState(command, detail))
}

func buildPlanAnalysisRecoveryState(command GeneratePlansCommand, detail string) *RecoveryState {
	reasonMessage := detail
	if reasonMessage == "" {
		reasonMessage = "方案生成失败，当前工作流已暂停。"
	}
	return &RecoveryState{
		Blocked:       true,
		ReasonCode:    "plan_generation_failed",
		ReasonMessage: reasonMessage,
		ResumeStage:   command.Context.WorkflowStage,
		ResumeMode:    command.Context.WorkflowMode,
		CanRetry:      true,
		RetryLabel:    "修复后重试方案生成",
		RetryPrompt:   buildPlanAnalysisRetryPrompt(command),
	}
}

func buildPlanAnalysisRetryPrompt(command GeneratePlansCommand) string {
	stage := command.Context.WorkflowStage
	if stage == "" {
		stage = WorkflowStagePlanAnalysis
	}
	mode := command.Context.WorkflowMode
	if mode == "" {
		mode = WorkflowModePlan
	}
	return "方案生成失败原因已修复。请从当前阶段（" + stage + " / " + mode + "）重新生成候选方案，并等待用户确认推荐方案。"
}

func buildPlanAnalysisDoneState(state EngineeringState) EngineeringState {
	return state.
		withWorkflowStatus(EngineeringStatusPassed).
		withCurrentTask("方案生成完成").
		withNextAction("等待用户选择方案或确认推荐方案")
}

func buildPlanAnalysisWorkflowStageStep(
	command GeneratePlansCommand,
	state EngineeringState,
	id string,
	title string,
	detail string,
	status string,
	meta map[string]interface{},
) map[string]interface{} {
	stepMeta := map[string]interface{}{
		"workflow_stage": command.Context.WorkflowStage,
		"workflow_mode":  command.Context.WorkflowMode,
	}
	for key, value := range meta {
		stepMeta[key] = value
	}
	return buildEngineeringStateStep(
		id,
		"orchestration",
		title,
		detail,
		status,
		state,
		stepMeta,
	)
}
