package orchestration

import (
	"context"

	"yistack/internal/service"
)

// GenerateOrchestrator 承接生成链路的最小编排。
type GenerateOrchestrator struct {
	generatorService      *service.GeneratorService
	projectService        *service.ProjectService
	stateRecorder         EngineeringStateRecorder
	bootstrapOrchestrator *BootstrapOrchestrator
	capabilityExecutor    CapabilityExecutor
	capabilityRegistry    CapabilityProviderRegistry
	generationJobService  *service.GenerationJobService
}

// GenerateOrchestratorOptions 描述生成编排入口的可选能力层依赖。
type GenerateOrchestratorOptions struct {
	GenerationJobService *service.GenerationJobService
	CapabilityExecutor   CapabilityExecutor
	CapabilityRegistry   CapabilityProviderRegistry
}

// NewGenerateOrchestrator 创建生成链路编排入口。
func NewGenerateOrchestrator(generatorService *service.GeneratorService, projectService *service.ProjectService, _ ValidationGateRunner, stateRecorder EngineeringStateRecorder, capabilityExecutors ...CapabilityExecutor) *GenerateOrchestrator {
	options := GenerateOrchestratorOptions{}
	if len(capabilityExecutors) > 0 && capabilityExecutors[0] != nil {
		options.CapabilityExecutor = capabilityExecutors[0]
	}
	return NewGenerateOrchestratorWithOptions(generatorService, projectService, nil, stateRecorder, options)
}

// NewGenerateOrchestratorWithOptions 创建可注入能力层依赖的生成链路编排入口。
func NewGenerateOrchestratorWithOptions(generatorService *service.GeneratorService, projectService *service.ProjectService, _ ValidationGateRunner, stateRecorder EngineeringStateRecorder, options GenerateOrchestratorOptions) *GenerateOrchestrator {
	capabilityExecutor := options.CapabilityExecutor
	if capabilityExecutor == nil {
		capabilityExecutor = NoopCapabilityExecutor{}
	}
	capabilityRegistry := options.CapabilityRegistry
	if len(capabilityRegistry.providers) == 0 {
		capabilityRegistry = NewDefaultCapabilityProviderRegistry()
	}
	return &GenerateOrchestrator{
		generatorService:      generatorService,
		projectService:        projectService,
		stateRecorder:         stateRecorder,
		bootstrapOrchestrator: NewBootstrapOrchestrator(),
		capabilityExecutor:    capabilityExecutor,
		capabilityRegistry:    capabilityRegistry,
		generationJobService:  options.GenerationJobService,
	}
}

func (o *GenerateOrchestrator) Generate(ctx context.Context, command GenerateCommand, handler service.StreamEventHandler) error {
	command = command.normalized()
	if isBootstrapWorkflowStage(command.Context.WorkflowStage) {
		return o.executeBootstrapWorkflowStage(ctx, command, handler)
	}

	ctx = withOrchestrationContext(ctx, command.Context)
	state := BuildEngineeringState(command.Context)
	switch command.Context.WorkflowMode {
	case WorkflowModeImplement:
		state = state.
			withCurrentTask("按已批准计划生成实现").
			withNextAction("等待代码生成结果")
	default:
		state = state.
			withExecutionAutoProgress(false).
			withCurrentTask("回应需求讨论或方案澄清").
			withNextAction("等待用户确认方案或继续补充约束")
	}
	ctx = withEngineeringState(ctx, state)
	capabilityExecutor := CapabilityExecutor(NoopCapabilityExecutor{})
	if o != nil && o.capabilityExecutor != nil {
		capabilityExecutor = o.capabilityExecutor
	}
	capabilityRegistry := NewDefaultCapabilityProviderRegistry()
	if o != nil && len(o.capabilityRegistry.providers) > 0 {
		capabilityRegistry = o.capabilityRegistry
	}
	var capabilityErr error
	ctx, _, capabilityErr = prepareCapabilityWorkflowContext(ctx, command, state, handler, capabilityExecutor, capabilityRegistry)
	if capabilityErr != nil {
		return capabilityErr
	}
	if latestState, ok := EngineeringStateFromContext(ctx); ok {
		state = latestState
	}

	var generatorService *service.GeneratorService
	var projectService *service.ProjectService
	var stateRecorder EngineeringStateRecorder
	if o != nil {
		generatorService = o.generatorService
		projectService = o.projectService
		stateRecorder = o.stateRecorder
	}

	if generatorService == nil {
		_, err := executeGenerationWorkflowStage(ctx, generatorService, command, state, stateRecorder, handler)
		return err
	}
	if command.Prompt == "" {
		return ErrPromptRequired
	}
	if err := ensureOwnedProjectAccess(ctx, projectService, command.UserID, command.ProjectID); err != nil {
		return err
	}
	if _, err := executeFoundationGate(ctx, command, generatorService, state, handler); err != nil {
		return err
	}

	var generationErr error
	ctx, generationErr = executeGenerationWorkflowStage(ctx, generatorService, command, state, stateRecorder, handler)
	if generationErr != nil {
		return generationErr
	}
	return nil
}

func (o *GenerateOrchestrator) StopGeneration(ctx context.Context, projectID string) bool {
	if o == nil {
		return false
	}
	if o.generationJobService != nil && o.generationJobService.Available() {
		stopped, _ := o.generationJobService.StopProject(ctx, projectID, "user_requested_stop")
		if stopped {
			return true
		}
	}
	if o.generatorService == nil {
		return false
	}
	return o.generatorService.StopGeneration(ctx, projectID)
}

func (o *GenerateOrchestrator) IsGenerationActive(projectID string) bool {
	if o == nil {
		return false
	}
	if o.generationJobService != nil && o.generationJobService.Available() {
		job, err := o.generationJobService.LatestJob(context.Background(), projectID)
		if err == nil {
			return service.IsGenerationJobActiveStatus(job.Status)
		}
	}
	if o.generatorService == nil {
		return false
	}
	return o.generatorService.IsGenerationActive(projectID)
}
