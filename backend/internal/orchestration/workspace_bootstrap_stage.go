package orchestration

import (
	"context"
	"fmt"
	"strings"

	"yistack/internal/service"
)

func (o *GenerateOrchestrator) executeBootstrapWorkflowStage(ctx context.Context, command GenerateCommand, handler service.StreamEventHandler) error {
	if o == nil || o.bootstrapOrchestrator == nil {
		return ErrGenerateOrchestrationUnavailable
	}
	if err := ensureOwnedProjectAccess(ctx, o.projectService, command.UserID, command.ProjectID); err != nil {
		return err
	}
	if strings.TrimSpace(command.Prompt) == "" {
		return ErrPromptRequired
	}
	if err := o.bootstrapOrchestrator.Generate(ctx, command, handler); err != nil {
		return err
	}

	if err := o.persistBootstrapWorkflowState(ctx, command, handler); err != nil {
		return err
	}
	return nil
}

func (o *GenerateOrchestrator) persistBootstrapWorkflowState(ctx context.Context, command GenerateCommand, handler service.StreamEventHandler) error {
	if o == nil || o.generatorService == nil || strings.TrimSpace(command.ProjectID) == "" {
		return nil
	}

	state := finalizeBootstrapEngineeringState(buildBootstrapEngineeringState(command), command)
	if content, err := marshalBootstrapStateEnvelope(state.BootstrapState); err == nil {
		if persistErr := o.generatorService.PersistProjectArtifact(ctx, command.ProjectID, service.ProjectBootstrapStatePath, content); persistErr != nil {
			failedState := state.withWorkflowStatus(EngineeringStatusFailed).
				withCurrentTask("保存 Project Foundation 快照失败")
			_ = emitEngineeringStateStep(
				handler,
				buildEngineeringStateStep(
					"bootstrap:state_persistence",
					"bootstrap_state_persistence",
					"保存 Project Foundation 快照",
					fmt.Sprintf("%s 保存失败：%s", service.ProjectBootstrapStatePath, persistErr.Error()),
					"failed",
					failedState,
					map[string]interface{}{
						"event_name": "bootstrap_state_persistence_failed",
						"file_path":  service.ProjectBootstrapStatePath,
					},
				),
			)
			return fmt.Errorf("failed to persist bootstrap workflow state: %w", persistErr)
		}
	}
	recordBootstrapEngineeringState(ctx, o.stateRecorder, command, state)
	return nil
}
