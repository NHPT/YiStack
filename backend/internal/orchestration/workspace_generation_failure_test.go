package orchestration

import (
	"errors"
	"testing"

	"yistack/internal/service"
)

func TestBuildGenerationFailedStatePreservesStructuredReasonCode(t *testing.T) {
	command := GenerateCommand{
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageImplement,
			WorkflowMode:  WorkflowModeImplement,
		},
	}
	failure := &service.GenerationFailureError{
		Code:    service.GenerationFailureCodeSchemaInvalid,
		Message: "生成结果协议校验失败",
		Details: "schema_version is missing",
		Err:     errors.New("schema_version is missing"),
	}

	state := buildGenerationFailedState(command, EngineeringState{}, failure)

	if state.Execution.PauseReason != service.GenerationFailureCodeSchemaInvalid {
		t.Fatalf("expected structured pause reason, got %#v", state.Execution)
	}
	if state.Recovery == nil || state.Recovery.ReasonCode != service.GenerationFailureCodeSchemaInvalid {
		t.Fatalf("expected structured recovery reason, got %#v", state.Recovery)
	}
	if state.Recovery.ReasonMessage != failure.Error() || state.Recovery.CanRetry != true {
		t.Fatalf("expected failure evidence and retry path, got %#v", state.Recovery)
	}
}

func TestBuildGenerationFailedStateMarksProjectValidationFailed(t *testing.T) {
	command := GenerateCommand{
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageImplement,
			WorkflowMode:  WorkflowModeImplement,
		},
	}
	failure := &service.GenerationFailureError{
		Code:    service.GenerationFailureCodeProjectValidationFailed,
		Message: "生成项目质量校验失败",
		Details: "build failed",
	}

	state := buildGenerationFailedState(command, BuildEngineeringState(command.Context), failure)

	if state.Validation.Status != EngineeringStatusFailed {
		t.Fatalf("expected failed validation state, got %#v", state.Validation)
	}
	if state.Execution.PauseReason != service.GenerationFailureCodeProjectValidationFailed {
		t.Fatalf("expected project validation pause reason, got %#v", state.Execution)
	}
	if state.Recovery == nil || state.Recovery.ReasonCode != service.GenerationFailureCodeProjectValidationFailed {
		t.Fatalf("expected project validation recovery, got %#v", state.Recovery)
	}
}

func TestBuildGenerationFailedStateMarksRepairBudgetAsValidationFailure(t *testing.T) {
	command := GenerateCommand{Context: OrchestrationContext{WorkflowStage: WorkflowStageImplement, WorkflowMode: WorkflowModeImplement}}
	failure := &service.GenerationFailureError{Code: service.GenerationFailureCodeRepairBudgetExhausted, Message: "有限自动修复未通过"}
	state := buildGenerationFailedState(command, BuildEngineeringState(command.Context), failure)
	if state.Validation.Status != EngineeringStatusFailed || state.Execution.PauseReason != service.GenerationFailureCodeRepairBudgetExhausted {
		t.Fatalf("expected repair budget to preserve failed validation state, got %#v", state)
	}
}
