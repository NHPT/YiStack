package handler

import (
	"errors"
	"testing"

	"yistack/internal/orchestration"
)

func TestBuildGenerateStreamErrorPayloadValidationGateBlocked(t *testing.T) {
	payload := buildGenerateStreamErrorPayload(&orchestration.ValidationGateError{
		Gate: "validate-before-preview",
		State: orchestration.EngineeringState{
			Workflow: orchestration.WorkflowState{
				Stage:  orchestration.WorkflowStageImplement,
				Mode:   orchestration.WorkflowModeImplement,
				Status: orchestration.EngineeringStatusFailed,
			},
			Validation: orchestration.ValidationState{
				Gate:   orchestration.ValidationGateBeforePreview,
				Status: orchestration.EngineeringStatusFailed,
				FailureItems: []orchestration.ValidationFailureItem{
					{
						ID:         "validate-before-preview:1",
						Title:      "前端类型检查失败",
						Detail:     "web/src/app/page.tsx:10:5 error TS2322",
						Severity:   "error",
						Suggestion: "优先在 web 目录修复 TypeScript 类型错误，再重新运行 YES 校验。",
						FilePath:   "src/app/page.tsx",
						LineNumber: 10,
						Column:     5,
						SearchText: "web/src/app/page.tsx:10:5 error TS2322",
					},
				},
			},
			Execution: orchestration.ExecutionState{
				AwaitingConfirmation: true,
				PauseReason:          "validation_gate_blocked",
				ApprovalBoundary:     "validation_gate",
				NextAction:           "修复校验失败项后重试",
			},
			Recovery: &orchestration.RecoveryState{
				Blocked:       true,
				ReasonCode:    "validation_gate_blocked",
				ReasonMessage: "YES 校验未通过",
				ResumeStage:   orchestration.WorkflowStageImplement,
				ResumeMode:    orchestration.WorkflowModeImplement,
				CanRetry:      true,
				RetryLabel:    "修复后重跑校验",
				RetryPrompt:   "校验失败项已修复。请重新运行 YES Validation Gate。",
			},
		},
		Err: errors.New("exit status 1"),
	})

	if payload["code"] != "validation_gate_blocked" {
		t.Fatalf("expected validation gate blocked code, got %v", payload["code"])
	}
	if payload["blocking"] != true {
		t.Fatalf("expected blocking=true, got %v", payload["blocking"])
	}

	engineeringState, ok := payload["engineeringState"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected engineeringState payload, got %T", payload["engineeringState"])
	}
	validation, ok := engineeringState["validation"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected validation payload, got %T", engineeringState["validation"])
	}
	if validation["status"] != orchestration.EngineeringStatusFailed {
		t.Fatalf("expected validation status %q, got %v", orchestration.EngineeringStatusFailed, validation["status"])
	}
	failureItems, ok := validation["failure_items"].([]map[string]interface{})
	if !ok {
		t.Fatalf("expected validation failure items, got %T", validation["failure_items"])
	}
	if len(failureItems) != 1 {
		t.Fatalf("expected one validation failure item, got %d", len(failureItems))
	}
	if failureItems[0]["title"] != "前端类型检查失败" {
		t.Fatalf("expected frontend failure title, got %v", failureItems[0]["title"])
	}
	if failureItems[0]["file_path"] != "src/app/page.tsx" {
		t.Fatalf("expected failure file path %q, got %v", "src/app/page.tsx", failureItems[0]["file_path"])
	}
	if failureItems[0]["line_number"] != 10 {
		t.Fatalf("expected failure line 10, got %v", failureItems[0]["line_number"])
	}
	execution, ok := engineeringState["execution"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected execution payload, got %T", engineeringState["execution"])
	}
	if execution["pause_reason"] != "validation_gate_blocked" {
		t.Fatalf("expected pause reason %q, got %v", "validation_gate_blocked", execution["pause_reason"])
	}
	recovery, ok := engineeringState["recovery"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected recovery payload, got %T", engineeringState["recovery"])
	}
	if recovery["reason_code"] != "validation_gate_blocked" {
		t.Fatalf("expected recovery reason %q, got %v", "validation_gate_blocked", recovery["reason_code"])
	}
	if recovery["can_retry"] != true {
		t.Fatalf("expected can_retry=true, got %v", recovery["can_retry"])
	}
}

func TestBuildGenerateStreamErrorPayloadFoundationGateBlocked(t *testing.T) {
	payload := buildGenerateStreamErrorPayload(&orchestration.FoundationGateError{
		Gate: orchestration.FoundationGateBeforeImplement,
		State: orchestration.EngineeringState{
			Workflow: orchestration.WorkflowState{
				Stage:  orchestration.WorkflowStageImplement,
				Mode:   orchestration.WorkflowModeImplement,
				Status: orchestration.EngineeringStatusFailed,
			},
			BootstrapState: &orchestration.BootstrapState{
				Status:   "blocked",
				Blockers: []string{"must_decide_now 项待确认"},
				GateResult: &orchestration.BootstrapGateResult{
					Decision:      "block",
					Reasons:       []string{"Project Foundation 尚未确认完成"},
					BlockingItems: []string{"must_decide_now 项待确认"},
					NextAction:    "回到 Project Foundation review",
				},
			},
			Recovery: &orchestration.RecoveryState{
				Blocked:       true,
				ReasonCode:    "foundation_gate_blocked",
				ReasonMessage: "Project Foundation 尚未确认完成",
				ResumeStage:   orchestration.WorkflowStageBootstrapReview,
				ResumeMode:    orchestration.WorkflowModeFoundation,
				CanRetry:      true,
				RetryLabel:    "回到 Foundation 修复",
				RetryPrompt:   "请回到 Project Foundation review。",
			},
		},
		Err: errors.New("Project Foundation 尚未确认完成"),
	})

	if payload["code"] != "foundation_gate_blocked" {
		t.Fatalf("expected foundation gate blocked code, got %v", payload["code"])
	}
	if payload["blocking"] != true {
		t.Fatalf("expected blocking=true, got %v", payload["blocking"])
	}
	gateResult, ok := payload["gate_result"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected gate_result payload, got %T", payload["gate_result"])
	}
	if gateResult["decision"] != "block" {
		t.Fatalf("expected gate decision block, got %v", gateResult["decision"])
	}
	engineeringState, ok := payload["engineeringState"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected engineeringState payload, got %T", payload["engineeringState"])
	}
	recovery, ok := engineeringState["recovery"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected recovery payload, got %T", engineeringState["recovery"])
	}
	if recovery["reason_code"] != "foundation_gate_blocked" {
		t.Fatalf("expected recovery reason %q, got %v", "foundation_gate_blocked", recovery["reason_code"])
	}
}

func TestBuildGenerateStreamErrorPayloadCapabilityGateBlocked(t *testing.T) {
	payload := buildGenerateStreamErrorPayload(&orchestration.CapabilityGateError{
		State: orchestration.EngineeringState{
			Workflow: orchestration.WorkflowState{
				Stage:  orchestration.WorkflowStageImplement,
				Mode:   orchestration.WorkflowModeImplement,
				Status: orchestration.EngineeringStatusFailed,
			},
			Execution: orchestration.ExecutionState{
				AwaitingConfirmation: true,
				PauseReason:          "capability_execution_blocked",
				ApprovalBoundary:     "capability_provider_runner",
				NextAction:           "接入缺失能力 runner 后重试",
			},
			Recovery: &orchestration.RecoveryState{
				Blocked:       true,
				ReasonCode:    "provider_runner_unavailable",
				ReasonMessage: "能力 provider 已解析为外部执行，但组合根尚未注入对应 Skill / MCP runner。",
				ResumeStage:   orchestration.WorkflowStageImplement,
				ResumeMode:    orchestration.WorkflowModeImplement,
				CanRetry:      true,
				RetryLabel:    "修复能力 provider 后重试",
				RetryPrompt:   "请确认缺失的 Skill / MCP runner 已接入或调整能力计划，然后重试当前工作流。",
			},
		},
		Result: orchestration.CapabilityExecutionResult{
			Status: orchestration.CapabilityExecutionResultStatusBlocked,
			Items: []orchestration.CapabilityExecutionResultItem{
				{
					CapabilityID: "skill.example",
					Provider:     orchestration.CapabilityProviderSkill,
					Status:       orchestration.CapabilityExecutionResultStatusBlocked,
					ReasonCode:   "provider_runner_unavailable",
					SourceNote:   "能力 provider 已解析为外部执行，但组合根尚未注入对应 Skill / MCP runner。",
					Metadata: map[string]interface{}{
						"runner": "missing",
					},
					Artifacts: []orchestration.CapabilityExecutionArtifact{
						{
							ID:         "skill.example.contract",
							Type:       "capability_contract",
							Name:       "Skill 契约",
							SourceNote: "测试 artifact。",
						},
					},
				},
			},
			SourceNote: "ExternalCapabilityExecutor 阻断。",
		},
	})

	if payload["code"] != "capability_execution_blocked" {
		t.Fatalf("expected capability execution blocked code, got %v", payload["code"])
	}
	if payload["blocking"] != true {
		t.Fatalf("expected blocking=true, got %v", payload["blocking"])
	}

	engineeringState, ok := payload["engineeringState"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected engineeringState payload, got %T", payload["engineeringState"])
	}
	recovery, ok := engineeringState["recovery"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected recovery payload, got %T", engineeringState["recovery"])
	}
	if recovery["reason_code"] != "provider_runner_unavailable" {
		t.Fatalf("expected provider runner unavailable reason, got %v", recovery["reason_code"])
	}

	result, ok := payload["execution_result"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected execution result payload, got %T", payload["execution_result"])
	}
	if result["status"] != orchestration.CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected blocked execution result, got %v", result["status"])
	}
	items, ok := result["items"].([]map[string]interface{})
	if !ok {
		t.Fatalf("expected execution result items, got %T", result["items"])
	}
	if len(items) != 1 || items[0]["reason_code"] != "provider_runner_unavailable" {
		t.Fatalf("expected provider runner unavailable item, got %+v", items)
	}
	metadata, ok := items[0]["metadata"].(map[string]interface{})
	if !ok || metadata["runner"] != "missing" {
		t.Fatalf("expected execution result metadata, got %+v", items[0]["metadata"])
	}
	artifacts, ok := items[0]["artifacts"].([]map[string]interface{})
	if !ok || len(artifacts) != 1 || artifacts[0]["type"] != "capability_contract" {
		t.Fatalf("expected execution result artifacts, got %+v", items[0]["artifacts"])
	}
}

func TestGeneratePlansStreamErrorPayloadFoundationGateBlocked(t *testing.T) {
	payload := buildGenerateStreamErrorPayload(&orchestration.FoundationGateError{
		Gate: orchestration.FoundationGateBeforePlan,
		State: orchestration.EngineeringState{
			Workflow: orchestration.WorkflowState{
				Stage:  orchestration.WorkflowStagePlanAnalysis,
				Mode:   orchestration.WorkflowModePlan,
				Status: orchestration.EngineeringStatusFailed,
			},
			Execution: orchestration.ExecutionState{
				PauseReason: "foundation_gate_blocked",
				NextAction:  "完成 Project Foundation 必要决策后再生成 Plan",
			},
			BootstrapState: &orchestration.BootstrapState{
				Status: "blocked",
				GateResult: &orchestration.BootstrapGateResult{
					Decision:      "block",
					Reasons:       []string{"Project Foundation 尚未确认完成"},
					BlockingItems: []string{"Project Foundation 尚未确认完成"},
					NextAction:    "回到 Project Foundation review",
				},
			},
		},
		Err: errors.New("Project Foundation 尚未确认完成"),
	})

	if payload["code"] != "foundation_gate_blocked" {
		t.Fatalf("expected foundation gate blocked code, got %v", payload["code"])
	}
	if payload["gate"] != orchestration.FoundationGateBeforePlan {
		t.Fatalf("expected gate %q, got %v", orchestration.FoundationGateBeforePlan, payload["gate"])
	}
}

func TestBuildGenerateStreamErrorPayloadGenericError(t *testing.T) {
	payload := buildGenerateStreamErrorPayload(errors.New("boom"))

	if payload["code"] != nil {
		t.Fatalf("expected no structured code, got %v", payload["code"])
	}
	if payload["message"] != "boom" {
		t.Fatalf("expected generic message %q, got %v", "boom", payload["message"])
	}
}
