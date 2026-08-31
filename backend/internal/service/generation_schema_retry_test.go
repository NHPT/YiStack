package service

import (
	"errors"
	"strings"
	"testing"
)

func TestRunGenerationContentAttemptsRetriesSchemaFailuresBeforeApply(t *testing.T) {
	outputs := []string{
		`{not-json`,
		`{"schema_version":"generation_result.v2","operations":[],"message":"invalid","commands":[]}`,
		`{"schema_version":"generation_result.v2","operations":[{"operation":"create","path":"index.html","content":"ok","description":"entry"}],"message":"done","commands":[]}`,
	}
	generationCalls := 0
	applyCalls := 0
	previousCodes := []string{}
	validatedAttempt := 0
	validatedMaxAttempts := 0

	err := runGenerationContentAttempts(
		defaultGenerationSchemaMaxAttempts,
		func(attempt int, previousErr error) (generationContentStageResult, error) {
			generationCalls++
			previousCodes = append(previousCodes, GenerationFailureCode(previousErr))
			return generationContentStageResult{rawContent: outputs[attempt-1]}, nil
		},
		func(contentStage generationContentStageResult) error {
			if _, err := decodeGenerationResult(contentStage.rawContent); err != nil {
				return err
			}
			applyCalls++
			validatedAttempt = contentStage.schemaAttempt
			validatedMaxAttempts = contentStage.schemaMaxAttempts
			return nil
		},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)
	if err != nil {
		t.Fatalf("expected third schema attempt to pass: %v", err)
	}
	if generationCalls != 3 || applyCalls != 1 {
		t.Fatalf("expected three generations and one apply, got generation=%d apply=%d", generationCalls, applyCalls)
	}
	if previousCodes[0] != "" || previousCodes[1] != GenerationFailureCodeSchemaInvalid || previousCodes[2] != GenerationFailureCodeSchemaInvalid {
		t.Fatalf("expected schema feedback only after rejected attempts, got %#v", previousCodes)
	}
	if validatedAttempt != 3 || validatedMaxAttempts != defaultGenerationSchemaMaxAttempts {
		t.Fatalf("expected validated attempt metadata 3/%d, got %d/%d", defaultGenerationSchemaMaxAttempts, validatedAttempt, validatedMaxAttempts)
	}
}

func TestRunGenerationContentAttemptsPreservesEarlierSchemaFeedback(t *testing.T) {
	previousMessages := make([]string, 0, 3)
	completionErrors := []error{
		newGenerationSchemaFailure(errors.New("visible text is missing")),
		newGenerationSchemaFailure(errors.New("operation shape is invalid")),
		nil,
	}

	err := runGenerationContentAttempts(
		3,
		func(_ int, previousErr error) (generationContentStageResult, error) {
			message := ""
			if previousErr != nil {
				message = previousErr.Error()
			}
			previousMessages = append(previousMessages, message)
			return generationContentStageResult{}, nil
		},
		func(contentStage generationContentStageResult) error {
			return completionErrors[contentStage.schemaAttempt-1]
		},
		nil,
	)
	if err != nil {
		t.Fatalf("expected third attempt to pass: %v", err)
	}
	if len(previousMessages) != 3 ||
		!strings.Contains(previousMessages[2], "visible text is missing") ||
		!strings.Contains(previousMessages[2], "operation shape is invalid") {
		t.Fatalf("expected third attempt to receive all prior schema failures, got %#v", previousMessages)
	}
}

func TestRunGenerationContentAttemptsStopsAtSchemaBudgetWithoutApply(t *testing.T) {
	generationCalls := 0
	applyCalls := 0
	err := runGenerationContentAttempts(
		2,
		func(int, error) (generationContentStageResult, error) {
			generationCalls++
			return generationContentStageResult{rawContent: `{not-json`}, nil
		},
		func(contentStage generationContentStageResult) error {
			if _, err := decodeGenerationResult(contentStage.rawContent); err != nil {
				return err
			}
			applyCalls++
			return nil
		},
		nil,
	)
	if GenerationFailureCode(err) != GenerationFailureCodeSchemaInvalid {
		t.Fatalf("expected final schema failure, got %v", err)
	}
	if generationCalls != 2 || applyCalls != 0 {
		t.Fatalf("invalid schema must exhaust two attempts without apply, got generation=%d apply=%d", generationCalls, applyCalls)
	}
}

func TestRunGenerationContentAttemptsDoesNotRetryNonSchemaFailure(t *testing.T) {
	generationCalls := 0
	expectedErr := errors.New("project validation failed")
	err := runGenerationContentAttempts(
		defaultGenerationSchemaMaxAttempts,
		func(int, error) (generationContentStageResult, error) {
			generationCalls++
			return generationContentStageResult{rawContent: `{}`}, nil
		},
		func(generationContentStageResult) error { return expectedErr },
		nil,
	)
	if !errors.Is(err, expectedErr) || generationCalls != 1 {
		t.Fatalf("non-schema failure must stop immediately, calls=%d err=%v", generationCalls, err)
	}
}

func TestGenerationSchemaRetryRequestPreservesOriginalRequest(t *testing.T) {
	original := &GenerateRequest{Prompt: "build app", Provider: "provider::model", Model: "model"}
	retry := generationSchemaRetryRequest(original, newGenerationSchemaFailure(errors.New("bad json")))
	if retry == original {
		t.Fatal("retry request must be a copy")
	}
	if original.Prompt != "build app" {
		t.Fatalf("original prompt was mutated: %q", original.Prompt)
	}
	if !strings.Contains(retry.Prompt, "generation_result.v2") || !strings.Contains(retry.Prompt, "bad json") {
		t.Fatalf("retry prompt is missing strict schema feedback: %q", retry.Prompt)
	}
	if retry.Provider != original.Provider || retry.Model != original.Model {
		t.Fatalf("retry must preserve provider/model: %#v", retry)
	}
}

func TestGenerationSchemaRetryRequestRequiresReplaceForPatchMismatch(t *testing.T) {
	retry := generationSchemaRetryRequest(
		&GenerateRequest{Prompt: "patch the form"},
		newGenerationSchemaFailure(errors.New(
			"operations[0].edits[0].old_text must match exactly once, matched 0 times",
		)),
	)
	if !strings.Contains(retry.Prompt, "必须改用 replace") ||
		!strings.Contains(retry.Prompt, "不得再次猜测 patch 上下文") {
		t.Fatalf("expected patch mismatch retry to require replace, got %q", retry.Prompt)
	}
}

func TestGenerationSchemaRetryRequestRequiresVisibleRequiredText(t *testing.T) {
	retry := generationSchemaRetryRequest(
		&GenerateRequest{Prompt: "add search"},
		newGenerationSchemaFailure(errors.New(
			`browser acceptance required_text "Search" only appears in non-body metadata or attributes`,
		)),
	)
	if !strings.Contains(retry.Prompt, "普通可见 JSX/HTML 文本节点") ||
		!strings.Contains(retry.Prompt, "JavaScript 标识符均不满足验收") {
		t.Fatalf("expected visible text retry instruction, got %q", retry.Prompt)
	}
}

func TestValidateGenerationOperationsAgainstSnapshotRejectsPatchMismatch(t *testing.T) {
	content := `<button type="submit">Submit</button>`
	snapshot := &GenerationWorkspaceSnapshot{Files: []GenerationWorkspaceSnapshotFile{{
		Path:    "app/page.tsx",
		SHA256:  generationContentHash(content),
		Content: content,
	}}}
	err := validateGenerationOperationsAgainstSnapshot(
		[]GenerationFileOperation{{
			Operation: GenerationFileOperationPatch,
			Path:      "app/page.tsx",
			BaseHash:  generationContentHash(content),
			Edits: []GenerationTextEdit{{
				OldText: `<button type="submit"` + "\n" + `>Submit</button>`,
				NewText: `<button type="submit" data-testid="submit-form">Submit</button>`,
			}},
		}},
		snapshot,
	)
	if err == nil || !strings.Contains(err.Error(), "old_text must match exactly once") {
		t.Fatalf("expected snapshot patch mismatch, got %v", err)
	}
}

func TestStructuredOutputReasoningEffortUsesLowForGPTOSS(t *testing.T) {
	for _, model := range []string{"gpt-oss:20b", "ollama-cloud::GPT-OSS:120b"} {
		if effort := structuredOutputReasoningEffort(model); effort != "low" {
			t.Fatalf("expected low reasoning effort for %q, got %q", model, effort)
		}
	}
	if effort := structuredOutputReasoningEffort("deepseek-v4-pro"); effort != "" {
		t.Fatalf("non-GPT-OSS model must not receive an unsupported reasoning effort, got %q", effort)
	}
}
