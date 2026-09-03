package orchestration

import (
	"context"
	"errors"
	"log"

	"yistack/internal/service"
)

func executeGenerationWorkflowStage(
	ctx context.Context,
	generatorService *service.GeneratorService,
	command GenerateCommand,
	state EngineeringState,
	stateRecorder EngineeringStateRecorder,
	handler service.StreamEventHandler,
) (context.Context, error) {
	_ = emitEngineeringStateStep(handler, buildGenerationWorkflowStageStep(
		command,
		state,
		"orchestration:"+command.Context.WorkflowStage,
		"进入生成阶段",
		state.Execution.CurrentTask,
		"running",
		map[string]any{
			"awaiting_confirmation": state.Execution.AwaitingConfirmation,
		},
	))

	if generatorService == nil {
		return finishFailedGenerationWorkflowStage(ctx, command, state, ErrGenerateOrchestrationUnavailable, handler)
	}

	generationHandler := wrapGenerationWorkflowStepRecorder(ctx, stateRecorder, command, handler)
	if err := generatorService.Generate(ctx, buildServiceGenerateRequest(command), generationHandler); err != nil {
		return finishFailedGenerationWorkflowStage(ctx, command, state, err, handler)
	}

	doneState := buildGenerationDoneState(state)
	ctx = withEngineeringState(ctx, doneState)
	_ = emitEngineeringStateStep(handler, buildGenerationWorkflowStageStep(
		command,
		doneState,
		"orchestration:"+command.Context.WorkflowStage+":done",
		"生成阶段完成",
		"模型输出、项目级 Validation Gate、预览、浏览器验收与版本快照已完成。",
		"done",
		nil,
	))
	return ctx, nil
}

func wrapGenerationWorkflowStepRecorder(
	ctx context.Context,
	stateRecorder EngineeringStateRecorder,
	command GenerateCommand,
	handler service.StreamEventHandler,
) service.StreamEventHandler {
	stepRecorder, ok := stateRecorder.(WorkflowStepRecorder)
	if !ok || stepRecorder == nil {
		return handler
	}

	return func(eventName service.StreamEventName, payload service.StreamEventPayload) error {
		if eventName == service.StreamEventStep {
			if step, ok := payload.(map[string]any); ok {
				if err := stepRecorder.RecordWorkflowStep(ctx, workflowStepRecordParams{
					ProjectID:     command.ProjectID,
					UserID:        command.UserID,
					Model:         command.Model,
					WorkflowStage: command.Context.WorkflowStage,
					WorkflowMode:  command.Context.WorkflowMode,
					Step:          step,
				}); err != nil {
					log.Printf("Warning: failed to persist generation workflow step for project %s: %v", command.ProjectID, err)
				}
			}
		}
		if handler == nil {
			return nil
		}
		return handler(eventName, payload)
	}
}

func buildServiceGenerateRequest(command GenerateCommand) *service.GenerateRequest {
	return &service.GenerateRequest{
		UserID:                    command.UserID,
		ProjectID:                 command.ProjectID,
		Prompt:                    command.Prompt,
		ConversationStage:         command.Context.WorkflowStage,
		PlanContext:               command.PlanContext,
		AppType:                   command.AppType,
		ProjectName:               command.ProjectName,
		VisualAttachments:         command.VisualAttachments,
		VisualContext:             command.VisualContext,
		VisualEdit:                command.VisualEdit,
		VisualAttachmentsPrepared: command.VisualAttachmentsPrepared,
		Mode:                      command.Context.WorkflowMode,
		Online:                    command.Online,
		Model:                     command.Model,
		Provider:                  command.Provider,
		Temperature:               command.Temperature,
		BrowserAcceptance:         buildServiceBrowserAcceptanceSpec(command.BrowserAcceptance),
	}
}

func finishFailedGenerationWorkflowStage(
	ctx context.Context,
	command GenerateCommand,
	state EngineeringState,
	err error,
	handler service.StreamEventHandler,
) (context.Context, error) {
	if err == nil {
		err = errors.New("generation failed")
	}
	failedState := buildGenerationFailedState(command, state, err)
	ctx = withEngineeringState(ctx, failedState)
	_ = emitEngineeringStateStep(handler, buildGenerationWorkflowStageStep(
		command,
		failedState,
		"orchestration:"+command.Context.WorkflowStage+":failed",
		"生成阶段失败",
		err.Error(),
		"failed",
		nil,
	))
	return ctx, err
}

func buildGenerationFailedState(command GenerateCommand, state EngineeringState, err error) EngineeringState {
	reasonCode := service.GenerationFailureCode(err)
	if reasonCode == "" {
		reasonCode = "generation_failed"
	}
	if reasonCode == service.GenerationFailureCodeProjectValidationFailed ||
		reasonCode == service.GenerationFailureCodeRepairBudgetExhausted ||
		reasonCode == service.GenerationFailureCodeRepairRepeatedFailure {
		state = state.withValidationStatus(EngineeringStatusFailed)
	}
	return state.
		withWorkflowStatus(EngineeringStatusFailed).
		withCurrentTask("生成阶段失败").
		withExecutionAutoProgress(false).
		withExecutionPause(true, reasonCode, "generation", "修复生成失败原因后重试").
		withRecovery(buildGenerationRecoveryState(command, reasonCode, err))
}

func buildGenerationRecoveryState(command GenerateCommand, reasonCode string, err error) *RecoveryState {
	reasonMessage := ""
	if err != nil {
		reasonMessage = err.Error()
	}
	if reasonMessage == "" {
		reasonMessage = "生成阶段失败，当前工作流已暂停。"
	}
	return &RecoveryState{
		Blocked:       true,
		ReasonCode:    reasonCode,
		ReasonMessage: reasonMessage,
		ResumeStage:   command.Context.WorkflowStage,
		ResumeMode:    command.Context.WorkflowMode,
		CanRetry:      true,
		RetryLabel:    "修复后重试生成",
		RetryPrompt:   buildGenerationRetryPrompt(command),
	}
}

func buildGenerationRetryPrompt(command GenerateCommand) string {
	stage := command.Context.WorkflowStage
	if stage == "" {
		stage = WorkflowStageImplement
	}
	mode := command.Context.WorkflowMode
	if mode == "" {
		mode = WorkflowModeImplement
	}
	return "生成失败原因已修复。请从当前阶段（" + stage + " / " + mode + "）重新执行生成，并在通过后继续后续 Validation Gate。"
}

func buildGenerationDoneState(state EngineeringState) EngineeringState {
	return state.
		withWorkflowStatus(EngineeringStatusPassed).
		withValidationStatus(EngineeringStatusPassed).
		withCurrentTask("生成阶段完成").
		withNextAction("继续后续迭代")
}

func buildGenerationWorkflowStageStep(
	command GenerateCommand,
	state EngineeringState,
	id string,
	title string,
	detail string,
	status string,
	extraMeta map[string]any,
) map[string]any {
	meta := map[string]any{
		"workflow_stage": command.Context.WorkflowStage,
		"workflow_mode":  command.Context.WorkflowMode,
	}
	for key, value := range extraMeta {
		meta[key] = value
	}

	return buildEngineeringStateStep(
		id,
		"orchestration",
		title,
		detail,
		status,
		state,
		meta,
	)
}

func buildServiceBrowserAcceptanceSpec(contract BrowserAcceptanceContract) service.BrowserAcceptanceSpec {
	actions := make([]service.BrowserAcceptanceAction, 0, len(contract.Actions))
	for _, action := range contract.Actions {
		actions = append(actions, service.BrowserAcceptanceAction{
			Type: action.Type, Selector: action.Selector, Text: action.Text, ExpectText: action.ExpectText,
		})
	}
	return service.BrowserAcceptanceSpec{RequiredText: contract.RequiredText, Actions: actions}
}
