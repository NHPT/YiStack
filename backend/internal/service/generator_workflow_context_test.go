package service

import "testing"

func TestGenerateRequestWorkflowModeInfersDiscussFromPlanSelection(t *testing.T) {
	req := &GenerateRequest{
		ConversationStage: serviceWorkflowStagePlanSelection,
	}

	if mode := req.workflowMode(serviceWorkflowModeImplement); mode != serviceWorkflowModeDiscuss {
		t.Fatalf("expected workflow mode %q, got %q", serviceWorkflowModeDiscuss, mode)
	}
}

func TestGenerateRequestWorkflowContextKeepsNormalizedValues(t *testing.T) {
	req := &GenerateRequest{
		ConversationStage: serviceWorkflowStagePlanSelection,
		Mode:              serviceWorkflowModeDiscuss,
	}

	if stage := req.workflowStage(serviceWorkflowStageImplement); stage != serviceWorkflowStagePlanSelection {
		t.Fatalf("expected workflow stage %q, got %q", serviceWorkflowStagePlanSelection, stage)
	}
	if mode := req.workflowMode(serviceWorkflowModeImplement); mode != serviceWorkflowModeDiscuss {
		t.Fatalf("expected workflow mode %q, got %q", serviceWorkflowModeDiscuss, mode)
	}
}

func TestGenerateRequestWorkflowContextUsesDefaults(t *testing.T) {
	req := &GenerateRequest{}

	if stage := req.workflowStage(serviceWorkflowStageImplement); stage != serviceWorkflowStageImplement {
		t.Fatalf("expected default workflow stage %q, got %q", serviceWorkflowStageImplement, stage)
	}
	if mode := req.workflowMode(serviceWorkflowModeImplement); mode != serviceWorkflowModeImplement {
		t.Fatalf("expected default workflow mode %q, got %q", serviceWorkflowModeImplement, mode)
	}
}
