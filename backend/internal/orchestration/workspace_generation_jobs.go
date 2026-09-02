package orchestration

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"yistack/internal/model"
	"yistack/internal/service"
)

func (o *GenerateOrchestrator) SupportsGenerationJobs() bool {
	return o != nil && o.generationJobService != nil && o.generationJobService.Available()
}

func (o *GenerateOrchestrator) StartGenerationJob(ctx context.Context, command GenerateCommand, idempotencyKey string) (*service.GenerationJobStartResult, error) {
	if !o.SupportsGenerationJobs() {
		return nil, errors.New("generation job service not available")
	}
	command = command.normalized()
	if !isBootstrapWorkflowStage(command.Context.WorkflowStage) && strings.TrimSpace(command.Prompt) == "" {
		return nil, ErrPromptRequired
	}
	if err := ensureOwnedProjectAccess(ctx, o.projectService, command.UserID, command.ProjectID); err != nil {
		return nil, err
	}
	if err := prepareGenerateCommandVisualAttachments(&command); err != nil {
		return nil, err
	}
	if err := prepareGenerateCommandVisualContext(ctx, o.generatorService, &command); err != nil {
		return nil, err
	}
	requestPayload, err := json.Marshal(command)
	if err != nil {
		return nil, err
	}
	return o.generationJobService.Start(ctx, service.GenerationJobSpec{
		ProjectID: command.ProjectID, UserID: command.UserID, IdempotencyKey: idempotencyKey,
		WorkflowStage: command.Context.WorkflowStage, WorkflowMode: command.Context.WorkflowMode,
		Provider: command.Provider, Model: command.Model, RequestPayload: string(requestPayload),
	}, func(runCtx context.Context, handler service.StreamEventHandler) error {
		return o.Generate(runCtx, command, handler)
	})
}

func (o *GenerateOrchestrator) StreamGenerationJob(ctx context.Context, jobID string, cursor int64, consume service.GenerationEventConsumer) error {
	if !o.SupportsGenerationJobs() {
		return errors.New("generation job service not available")
	}
	return o.generationJobService.StreamEvents(ctx, jobID, cursor, consume)
}

func (o *GenerateOrchestrator) LatestGenerationJob(ctx context.Context, projectID string) (*model.GenerationJob, error) {
	if !o.SupportsGenerationJobs() {
		return nil, errors.New("generation job service not available")
	}
	return o.generationJobService.LatestJob(ctx, projectID)
}

func (o *GenerateOrchestrator) GenerationJob(ctx context.Context, jobID string) (*model.GenerationJob, error) {
	if !o.SupportsGenerationJobs() {
		return nil, errors.New("generation job service not available")
	}
	return o.generationJobService.Job(ctx, jobID)
}

func (o *GenerateOrchestrator) StopGenerationJob(ctx context.Context, projectID string) (bool, error) {
	if !o.SupportsGenerationJobs() {
		return false, errors.New("generation job service not available")
	}
	return o.generationJobService.StopProject(ctx, projectID, "user_requested_stop")
}
