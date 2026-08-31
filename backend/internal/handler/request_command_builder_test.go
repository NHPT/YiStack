package handler

import (
	"testing"

	"yistack/internal/orchestration"
)

func TestGenerateRequestToGenerateCommandBuildsOrchestrationContext(t *testing.T) {
	req := &GenerateRequest{
		ProjectID:         "project-1",
		Prompt:            "build blog",
		ConversationStage: orchestration.WorkflowStagePlanSelection,
		PlanContext:       "plan context",
		AppType:           "web",
		ProjectName:       "demo",
		Mode:              orchestration.WorkflowModeDiscuss,
		CapabilityProfile: orchestration.CapabilityProfileImplementationSkillDryRun,
		BrowserAcceptance: orchestration.BrowserAcceptanceContract{
			RequiredText: []string{"Demo ready"},
			Actions:      []orchestration.BrowserAcceptanceAction{{Type: "click", Selector: "[data-testid=run]", ExpectText: "Done"}},
		},
	}

	command := req.toGenerateCommand("user-1")

	if command.Context.WorkflowStage != orchestration.WorkflowStagePlanSelection {
		t.Fatalf("expected workflow stage %q, got %q", orchestration.WorkflowStagePlanSelection, command.Context.WorkflowStage)
	}
	if command.Context.WorkflowMode != orchestration.WorkflowModeDiscuss {
		t.Fatalf("expected workflow mode %q, got %q", orchestration.WorkflowModeDiscuss, command.Context.WorkflowMode)
	}
	if command.Context.RuntimeProjectID != "project-1" {
		t.Fatalf("expected runtime project id %q, got %q", "project-1", command.Context.RuntimeProjectID)
	}
	if command.Context.RuntimeAppType != "web" {
		t.Fatalf("expected runtime app type %q, got %q", "web", command.Context.RuntimeAppType)
	}
	if command.Context.RuntimeProject != "demo" {
		t.Fatalf("expected runtime project %q, got %q", "demo", command.Context.RuntimeProject)
	}
	if command.Context.CapabilityProfile != orchestration.CapabilityProfileImplementationSkillDryRun {
		t.Fatalf("expected capability profile %q, got %q", orchestration.CapabilityProfileImplementationSkillDryRun, command.Context.CapabilityProfile)
	}
	if len(command.BrowserAcceptance.RequiredText) != 1 || len(command.BrowserAcceptance.Actions) != 1 {
		t.Fatalf("expected browser acceptance contract, got %#v", command.BrowserAcceptance)
	}
}

func TestGenerateRequestToGenerateCommandInfersDiscussModeForPlanSelection(t *testing.T) {
	req := &GenerateRequest{
		ConversationStage: orchestration.WorkflowStagePlanSelection,
	}

	command := req.toGenerateCommand("user-1")

	if command.Context.WorkflowMode != orchestration.WorkflowModeDiscuss {
		t.Fatalf("expected inferred workflow mode %q, got %q", orchestration.WorkflowModeDiscuss, command.Context.WorkflowMode)
	}
}

func TestGenerateRequestToGenerateCommandInfersFoundationModeForBootstrap(t *testing.T) {
	req := &GenerateRequest{
		ConversationStage: orchestration.WorkflowStageBootstrap,
	}

	command := req.toGenerateCommand("user-1")

	if command.Context.WorkflowMode != orchestration.WorkflowModeFoundation {
		t.Fatalf("expected inferred workflow mode %q, got %q", orchestration.WorkflowModeFoundation, command.Context.WorkflowMode)
	}
}

func TestGenerateRequestToGenerateCommandInfersImplementModeForPlanApproved(t *testing.T) {
	req := &GenerateRequest{
		ConversationStage: orchestration.WorkflowStagePlanApproved,
	}

	command := req.toGenerateCommand("user-1")

	if command.Context.WorkflowMode != orchestration.WorkflowModeImplement {
		t.Fatalf("expected inferred workflow mode %q, got %q", orchestration.WorkflowModeImplement, command.Context.WorkflowMode)
	}
}

func TestGeneratePlansRequestToGeneratePlansCommandBuildsOrchestrationContext(t *testing.T) {
	req := &GeneratePlansRequest{
		ProjectID:   "project-1",
		Description: "build blog",
		AppType:     "web",
		Provider:    "ollama-cloud::gpt-oss:20b",
	}

	command := req.toGeneratePlansCommand("user-1")

	if command.Context.WorkflowStage != orchestration.WorkflowStagePlanAnalysis {
		t.Fatalf("expected workflow stage %q, got %q", orchestration.WorkflowStagePlanAnalysis, command.Context.WorkflowStage)
	}
	if command.Context.WorkflowMode != orchestration.WorkflowModePlan {
		t.Fatalf("expected workflow mode %q, got %q", orchestration.WorkflowModePlan, command.Context.WorkflowMode)
	}
	if command.Context.RuntimeProjectID != "project-1" {
		t.Fatalf("expected runtime project id %q, got %q", "project-1", command.Context.RuntimeProjectID)
	}
	if command.Context.RuntimeAppType != "web" {
		t.Fatalf("expected runtime app type %q, got %q", "web", command.Context.RuntimeAppType)
	}
	if command.Provider != "ollama-cloud::gpt-oss:20b" {
		t.Fatalf("expected provider to be propagated, got %q", command.Provider)
	}
}
