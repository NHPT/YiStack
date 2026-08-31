package handler

import (
	"errors"
	"testing"

	"yistack/internal/service"
)

func TestBuildGenerateStreamErrorPayloadStructuredGenerationFailure(t *testing.T) {
	exitCode := 7
	failure := &service.GenerationFailureError{
		Code:     service.GenerationFailureCodeCommandFailed,
		Stage:    "generation_command",
		Message:  "生成命令执行失败",
		Details:  "build failed",
		Command:  "pnpm build",
		ExitCode: &exitCode,
		Err:      errors.New("exit status 7"),
	}

	payload := buildGenerateStreamErrorPayload(failure)

	if payload["code"] != service.GenerationFailureCodeCommandFailed || payload["blocking"] != true {
		t.Fatalf("expected structured blocking failure, got %#v", payload)
	}
	if payload["stage"] != "generation_command" || payload["command"] != "pnpm build" || payload["exit_code"] != 7 {
		t.Fatalf("expected command failure evidence, got %#v", payload)
	}
	if payload["message"] != "生成命令执行失败" || payload["details"] != "build failed" {
		t.Fatalf("expected user message and details, got %#v", payload)
	}
}

func TestBuildGenerateStreamErrorPayloadProjectValidationFailure(t *testing.T) {
	exitCode := 2
	validation := &service.ProjectValidationResult{
		Status: service.ProjectValidationStatusFailed,
		Stack:  service.ProjectValidationStackNodeNextJS,
		Checks: []service.ProjectValidationCheck{{
			ID:       "build",
			Kind:     "build",
			Status:   service.ProjectValidationStatusFailed,
			ExitCode: &exitCode,
			Message:  "build failed",
		}},
	}
	failure := &service.GenerationFailureError{
		Code:             service.GenerationFailureCodeProjectValidationFailed,
		Stage:            "project_validation",
		Message:          "生成项目质量校验失败",
		Details:          "build failed",
		Command:          "npm run build",
		ExitCode:         &exitCode,
		Check:            "build",
		ValidationResult: validation,
	}

	payload := buildGenerateStreamErrorPayload(failure)

	if payload["code"] != service.GenerationFailureCodeProjectValidationFailed || payload["check"] != "build" {
		t.Fatalf("expected project validation failure payload, got %#v", payload)
	}
	if payload["project_validation"] != validation {
		t.Fatalf("expected project validation evidence, got %#v", payload["project_validation"])
	}
}

func TestBuildGenerateStreamErrorPayloadFileConflictAndRepairEvidence(t *testing.T) {
	evidence := &service.GenerationRepairEvidence{Status: "failed", MaxAttempts: 2, StopReason: service.GenerationFailureCodeRepairBudgetExhausted}
	conflict := &service.GenerationFileConflict{Operation: "patch", Path: "app.ts", Kind: "base_hash_mismatch", Message: "changed"}
	failure := &service.GenerationFailureError{
		Code: service.GenerationFailureCodeFileConflict, Stage: "generation_file_apply",
		Message: "生成文件操作被阻断", Details: "changed", FileConflict: conflict, RepairEvidence: evidence,
	}
	payload := buildGenerateStreamErrorPayload(failure)
	if payload["file_conflict"] != conflict || payload["repair"] != evidence {
		t.Fatalf("expected file conflict and repair evidence, got %#v", payload)
	}
}
