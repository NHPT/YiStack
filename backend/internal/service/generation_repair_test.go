package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"yistack/internal/model"
	"yistack/internal/prompt"
)

type generationRepairGeneratorStub struct {
	results    []generationRepairResult
	errors     []error
	requests   []generationRepairRequest
	onGenerate func(generationRepairRequest)
}

func (s *generationRepairGeneratorStub) GenerateRepair(_ context.Context, request generationRepairRequest) (generationRepairResult, error) {
	s.requests = append(s.requests, request)
	index := len(s.requests) - 1
	if s.onGenerate != nil {
		s.onGenerate(request)
	}
	if index < len(s.errors) && s.errors[index] != nil {
		return generationRepairResult{}, s.errors[index]
	}
	if index >= len(s.results) {
		return generationRepairResult{}, errors.New("unexpected repair request")
	}
	return s.results[index], nil
}

type generatedProjectValidatorSequenceStub struct {
	results []*ProjectValidationResult
	errors  []error
	calls   int
}

func (s *generatedProjectValidatorSequenceStub) Validate(_ context.Context, _ string, _ *model.Project, _ StreamEventHandler) (*ProjectValidationResult, error) {
	index := s.calls
	s.calls++
	if index >= len(s.results) {
		return nil, errors.New("unexpected validation request")
	}
	return s.results[index], s.errors[index]
}

func TestDecodeGenerationRepairResultUsesStrictContract(t *testing.T) {
	baseHash := generationContentHash("before")
	result, err := decodeGenerationRepairResult(`{
		"schema_version":"generation_repair.v1",
		"operations":[{"operation":"patch","path":"app.ts","base_hash":"` + baseHash + `","edits":[{"old_text":"before","new_text":"after"}],"description":"fix"}],
		"message":"fixed"
	}`)
	if err != nil {
		t.Fatalf("expected repair contract to pass: %v", err)
	}
	if result.SchemaVersion != prompt.GenerationRepairSchemaVersion || len(result.Operations) != 1 {
		t.Fatalf("unexpected repair result: %#v", result)
	}
	if _, err := decodeGenerationRepairResult(`{"schema_version":"generation_repair.v1","operations":[],"message":"none"}`); err == nil {
		t.Fatal("empty repair operations must fail")
	}
}

func TestDecodeGenerationRepairResultNormalizesOnlyOperationSeparators(t *testing.T) {
	raw := `{"schema_version":"generation_repair.v1","operations":[{"operation":"create","path":"a.txt","content":"a","description":"a"},"{"operation":"create","path":"b.txt","content":"b","description":"b"}],"message":"fixed"}`
	result, err := decodeGenerationRepairResult(raw)
	if err != nil {
		t.Fatalf("expected malformed operation separator to be normalized: %v", err)
	}
	if result.NormalizedSeparators != 1 ||
		len(result.Operations) != 2 ||
		result.Operations[0].Path != "a.txt" ||
		result.Operations[1].Path != "b.txt" {
		t.Fatalf("unexpected normalized repair result: %#v", result)
	}

	valid := `{"schema_version":"generation_repair.v1","operations":[{"operation":"create","path":"a.txt","content":"},\"{\"operation","description":"a"}],"message":"fixed"}`
	result, err = decodeGenerationRepairResult(valid)
	if err != nil {
		t.Fatalf("valid repair content must remain decodable: %v", err)
	}
	if result.NormalizedSeparators != 0 ||
		result.Operations[0].Content != `},"{"operation` {
		t.Fatalf("valid repair content must remain unchanged: %#v", result)
	}
}

func TestRunGenerationRepairSchemaAttemptsRetriesDecodeFailure(t *testing.T) {
	valid := `{"schema_version":"generation_repair.v1","operations":[{"operation":"create","path":"a.txt","content":"a","description":"a"}],"message":"fixed"}`
	calls := 0
	previousErrors := []error{}
	result, err := runGenerationRepairSchemaAttempts(
		generationRepairSchemaAttempts,
		func(attempt int, previousErr error) (string, error) {
			calls++
			previousErrors = append(previousErrors, previousErr)
			if attempt == 1 {
				return `{not-json`, nil
			}
			return valid, nil
		},
	)
	if err != nil {
		t.Fatalf("expected repair schema retry to pass: %v", err)
	}
	if calls != 2 || previousErrors[0] != nil || previousErrors[1] == nil {
		t.Fatalf("expected second schema attempt to receive decode error: calls=%d errors=%#v", calls, previousErrors)
	}
	if result.SchemaAttempt != 2 || result.SchemaMaxAttempts != generationRepairSchemaAttempts {
		t.Fatalf("unexpected schema attempt evidence: %#v", result)
	}
	if instruction := generationRepairSchemaRetryInstruction(previousErrors[1]); !strings.Contains(instruction, "严格 JSON 解码") ||
		!strings.Contains(instruction, "operations 数组项必须是直接对象") {
		t.Fatalf("unexpected repair schema retry instruction: %q", instruction)
	}
}

func TestRunGenerationRepairSchemaAttemptsStopsAtBudget(t *testing.T) {
	calls := 0
	_, err := runGenerationRepairSchemaAttempts(
		generationRepairSchemaAttempts,
		func(_ int, _ error) (string, error) {
			calls++
			return `{not-json`, nil
		},
	)
	if err == nil || calls != generationRepairSchemaAttempts {
		t.Fatalf("expected bounded schema failure after %d calls, calls=%d err=%v", generationRepairSchemaAttempts, calls, err)
	}
}

func TestRunGenerationRepairProtocolAttemptsRetriesSnapshotMismatch(t *testing.T) {
	content := `{"name":"app","scripts":{"build":"next build"}}`
	baseHash := generationContentHash(content)
	calls := 0
	previousErrors := []error{}
	result, err := runGenerationRepairProtocolAttempts(
		generationRepairSchemaAttempts,
		func(attempt int, previousErr error) (string, error) {
			calls++
			previousErrors = append(previousErrors, previousErr)
			if attempt == 1 {
				return `{
					"schema_version":"generation_repair.v1",
					"operations":[{
						"operation":"patch",
						"path":"package.json",
						"base_hash":"` + baseHash + `",
						"edits":[{"old_text":"missing","new_text":"fixed"}],
						"description":"invalid patch context"
					}],
					"message":"attempted"
				}`, nil
			}
			return `{
				"schema_version":"generation_repair.v1",
				"operations":[{
					"operation":"replace",
					"path":"package.json",
					"base_hash":"` + baseHash + `",
					"content":"{\"name\":\"app\",\"scripts\":{\"build\":\"next build\"},\"dependencies\":{\"next\":\"14.2.31\"}}",
					"description":"replace incompatible manifest"
				}],
				"message":"fixed"
			}`, nil
		},
		func(result generationRepairResult) error {
			return validateGenerationRepairOperationStates(
				result.Operations,
				[]GenerationRepairFileState{{
					Path: "package.json", Exists: true,
					SHA256: baseHash, Content: content,
				}},
			)
		},
	)
	if err != nil {
		t.Fatalf("expected protocol retry to recover: %v", err)
	}
	if calls != 2 || previousErrors[0] != nil ||
		previousErrors[1] == nil ||
		!strings.Contains(previousErrors[1].Error(), "matched 0 times") {
		t.Fatalf(
			"expected snapshot mismatch on the second protocol request: calls=%d errors=%#v",
			calls,
			previousErrors,
		)
	}
	if result.SchemaAttempt != 2 ||
		result.SchemaMaxAttempts != generationRepairSchemaAttempts ||
		len(result.Operations) != 1 ||
		result.Operations[0].Operation != GenerationFileOperationReplace {
		t.Fatalf("unexpected protocol retry result: %#v", result)
	}
}

func TestGenerationRepairSchemaRetryDisablesPatchForNoOp(t *testing.T) {
	noOpErr := errors.New("operations[0].edits[0] must change content")
	if generationRepairAllowsPatch("", noOpErr) {
		t.Fatal("schema retry after a no-op edit must disable patch")
	}
	if !generationRepairAllowsPatch("", errors.New("decode repair result: unexpected EOF")) {
		t.Fatal("syntax-only schema retry should preserve patch support")
	}
}

func TestGenerationRepairRetryRequiresReplaceAfterPatchContextMismatch(t *testing.T) {
	previousError := `repair patch path "main.go" is incompatible with the current snapshot: edits[0].old_text must match exactly once, matched 0 times`
	if !generationRepairRequiresReplace(previousError) {
		t.Fatal("patch context mismatch must require a replace retry")
	}
	instruction := generationRepairRetryInstruction(previousError)
	if !strings.Contains(instruction, "禁止 patch") ||
		!strings.Contains(instruction, "使用 replace") ||
		!strings.Contains(instruction, "当前 SHA-256") {
		t.Fatalf("unexpected patch mismatch retry instruction: %q", instruction)
	}

	responseFormat := generationRepairResponseFormatForPaths(
		false,
		[]string{"app.ts", "package.json"},
	)
	encoded, err := json.Marshal(responseFormat)
	if err != nil {
		t.Fatalf("encode retry response format: %v", err)
	}
	schema := string(encoded)
	if strings.Contains(schema, `"const":"patch"`) {
		t.Fatalf("patch must be excluded from mismatch retry schema: %s", schema)
	}
	if strings.Contains(schema, `"const":"delete"`) {
		t.Fatalf("delete must be excluded from replace retry schema: %s", schema)
	}
	if !strings.Contains(schema, `"const":"replace"`) {
		t.Fatalf("replace must remain available in mismatch retry schema: %s", schema)
	}
	if !strings.Contains(schema, `"enum":["app.ts","package.json"]`) {
		t.Fatalf("repair schema must constrain operation paths: %s", schema)
	}

	unicodeError := "build failed: Expected unicode escape"
	if !generationRepairRequiresReplace(unicodeError) {
		t.Fatal("literal escaped newline failure must require a replace retry")
	}
	unicodeInstruction := generationRepairRetryInstruction(unicodeError)
	if !strings.Contains(unicodeInstruction, `\n`) ||
		!strings.Contains(unicodeInstruction, "真实换行") {
		t.Fatalf("unexpected escaped newline retry instruction: %q", unicodeInstruction)
	}

	noOpError := "operations[0].edits[0] must change content"
	if !generationRepairRequiresReplace(noOpError) {
		t.Fatal("no-op patch must require a replace retry")
	}
	noOpInstruction := generationRepairRetryInstruction(noOpError)
	if !strings.Contains(noOpInstruction, "no-op") ||
		!strings.Contains(noOpInstruction, "禁止 patch") ||
		!strings.Contains(noOpInstruction, "实际不同") {
		t.Fatalf("unexpected no-op retry instruction: %q", noOpInstruction)
	}

	decodeInstruction := generationRepairRetryInstruction(
		"decode repair result: invalid character ':' after array element",
	)
	if !strings.Contains(decodeInstruction, "单一 JSON 对象") ||
		!strings.Contains(decodeInstruction, "对象以逗号直接分隔") {
		t.Fatalf("unexpected malformed JSON retry instruction: %q", decodeInstruction)
	}
}

func TestRepairGeneratedProjectPassesAfterBoundedPatch(t *testing.T) {
	workspace := &memoryGenerationWorkspace{files: map[string]string{"app.ts": "bad"}, dirty: map[string]bool{"app.ts": true}}
	generator := &generationRepairGeneratorStub{results: []generationRepairResult{{
		SchemaVersion: prompt.GenerationRepairSchemaVersion,
		Operations: []GenerationFileOperation{{
			Operation: GenerationFileOperationPatch, Path: "app.ts", BaseHash: generationContentHash("bad"),
			Edits: []GenerationTextEdit{{OldText: "bad", NewText: "good"}}, Description: "fix build",
		}}, Message: "fixed",
	}}}
	passed := &ProjectValidationResult{Status: ProjectValidationStatusPassed, Checks: []ProjectValidationCheck{}}
	validator := &generatedProjectValidatorSequenceStub{results: []*ProjectValidationResult{passed}, errors: []error{nil}}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.fileWorkspace = workspace
	service.repairGenerator = generator
	service.projectValidator = validator
	result := &generationResult{
		Operations: []GenerationFileOperation{{Operation: GenerationFileOperationCreate, Path: "app.ts", ResultHash: generationContentHash("bad")}},
		Files:      []FileToGenerate{{Path: "app.ts", Content: "bad"}},
	}
	initialValidation := &ProjectValidationResult{Status: ProjectValidationStatusFailed, FailureFingerprint: "initial"}

	err := service.repairGeneratedProject(context.Background(), &GenerateRequest{
		ProjectID: "project", Provider: "provider-a", Model: "model-a", Prompt: "build app",
	}, &model.Project{ProjectID: "project"}, result, initialValidation, errors.New("build failed"), func(StreamEventName, StreamEventPayload) error { return nil })
	if err != nil {
		t.Fatalf("expected repair to pass: %v", err)
	}
	if workspace.files["app.ts"] != "good" || result.Repair == nil || result.Repair.Status != "passed" {
		t.Fatalf("unexpected repaired state: files=%#v evidence=%#v", workspace.files, result.Repair)
	}
	if len(generator.requests) != 1 || generator.requests[0].Provider != "provider-a" || generator.requests[0].Model != "model-a" {
		t.Fatalf("repair must preserve request provider/model: %#v", generator.requests)
	}
}

func TestRepairGeneratedProjectRetriesInvalidResultWithinBudget(t *testing.T) {
	workspace := &memoryGenerationWorkspace{files: map[string]string{"app.ts": "bad"}, dirty: map[string]bool{"app.ts": true}}
	generator := &generationRepairGeneratorStub{
		results: []generationRepairResult{
			{},
			{SchemaVersion: prompt.GenerationRepairSchemaVersion, Operations: []GenerationFileOperation{{
				Operation: GenerationFileOperationReplace, Path: "app.ts", BaseHash: generationContentHash("bad"),
				Content: "good", Description: "fix after invalid output",
			}}, Message: "fixed"},
		},
		errors: []error{errors.New("repair result is empty")},
	}
	passed := &ProjectValidationResult{Status: ProjectValidationStatusPassed, Checks: []ProjectValidationCheck{}}
	validator := &generatedProjectValidatorSequenceStub{results: []*ProjectValidationResult{passed}, errors: []error{nil}}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.fileWorkspace = workspace
	service.repairGenerator = generator
	service.projectValidator = validator
	result := &generationResult{Operations: []GenerationFileOperation{{
		Operation: GenerationFileOperationCreate, Path: "app.ts", ResultHash: generationContentHash("bad"),
	}}}

	err := service.repairGeneratedProject(context.Background(), &GenerateRequest{ProjectID: "project"}, &model.Project{ProjectID: "project"}, result, &ProjectValidationResult{FailureFingerprint: "initial"}, errors.New("build failed"), func(StreamEventName, StreamEventPayload) error { return nil })
	if err != nil {
		t.Fatalf("expected second repair attempt to recover: %v", err)
	}
	if len(generator.requests) != 2 || workspace.files["app.ts"] != "good" {
		t.Fatalf("unexpected repair retries: requests=%d files=%#v", len(generator.requests), workspace.files)
	}
	if result.Repair == nil || result.Repair.Status != "passed" || len(result.Repair.Attempts) != 2 || result.Repair.Attempts[0].Status != "failed" || result.Repair.Attempts[1].Status != "passed" {
		t.Fatalf("unexpected repair attempt evidence: %#v", result.Repair)
	}
	if generator.requests[1].PreviousError != "repair result is empty" {
		t.Fatalf("second repair attempt must receive the previous protocol error, got %q", generator.requests[1].PreviousError)
	}
}

func TestRepairGeneratedProjectStopsOnRepeatedFingerprint(t *testing.T) {
	workspace := &memoryGenerationWorkspace{files: map[string]string{"app.ts": "bad"}, dirty: map[string]bool{"app.ts": true}}
	generator := &generationRepairGeneratorStub{results: []generationRepairResult{{
		SchemaVersion: prompt.GenerationRepairSchemaVersion,
		Operations: []GenerationFileOperation{{
			Operation: GenerationFileOperationReplace, Path: "app.ts", BaseHash: generationContentHash("bad"), Content: "still bad", Description: "attempt",
		}}, Message: "attempted",
	}}}
	failed := &ProjectValidationResult{Status: ProjectValidationStatusFailed, FailureFingerprint: "same"}
	validator := &generatedProjectValidatorSequenceStub{results: []*ProjectValidationResult{failed}, errors: []error{errors.New("same failure")}}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.fileWorkspace = workspace
	service.repairGenerator = generator
	service.projectValidator = validator
	result := &generationResult{Operations: []GenerationFileOperation{{Operation: GenerationFileOperationCreate, Path: "app.ts", ResultHash: generationContentHash("bad")}}}

	err := service.repairGeneratedProject(context.Background(), &GenerateRequest{ProjectID: "project"}, &model.Project{ProjectID: "project"}, result, failed, errors.New("same failure"), func(StreamEventName, StreamEventPayload) error { return nil })
	if GenerationFailureCode(err) != GenerationFailureCodeRepairRepeatedFailure {
		t.Fatalf("expected repeated fingerprint stop, got %v", err)
	}
	if validator.calls != 1 || result.Repair == nil || result.Repair.StopReason != GenerationFailureCodeRepairRepeatedFailure {
		t.Fatalf("unexpected repeated failure evidence: calls=%d evidence=%#v", validator.calls, result.Repair)
	}
}

func TestValidateAndRepairGeneratedProjectRepairsExecutionCommandFailure(t *testing.T) {
	invalidPackage := `{\"name\":\"app\"}`
	validPackage := `{"name":"app","scripts":{"build":"vite build"}}`
	workspace := &memoryGenerationWorkspace{files: map[string]string{"package.json": invalidPackage}, dirty: map[string]bool{"package.json": true}}
	generator := &generationRepairGeneratorStub{results: []generationRepairResult{{
		SchemaVersion: prompt.GenerationRepairSchemaVersion,
		Operations: []GenerationFileOperation{{
			Operation: GenerationFileOperationReplace, Path: "package.json", BaseHash: generationContentHash(invalidPackage),
			Content: validPackage, Description: "fix invalid package manifest",
		}},
		Message: "fixed package manifest",
	}}}
	failed := &ProjectValidationResult{Status: ProjectValidationStatusFailed, FailureFingerprint: "invalid-package"}
	passed := &ProjectValidationResult{Status: ProjectValidationStatusPassed, Checks: []ProjectValidationCheck{}}
	validator := &generatedProjectValidatorSequenceStub{
		results: []*ProjectValidationResult{failed, passed},
		errors:  []error{errors.New("parse package.json"), nil},
	}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.fileWorkspace = workspace
	service.repairGenerator = generator
	service.projectValidator = validator
	result := &generationResult{Operations: []GenerationFileOperation{{
		Operation: GenerationFileOperationCreate, Path: "package.json", ResultHash: generationContentHash(invalidPackage),
	}}}
	commandErr := newGenerationCommandFailure("pnpm install", nil, "Invalid package.json", errors.New("invalid manifest"))

	err := service.validateAndRepairGeneratedProject(context.Background(), &GenerateRequest{
		ProjectID: "project", Provider: "provider-a", Model: "model-a", Prompt: "build app",
	}, &model.Project{ProjectID: "project"}, result, commandErr, func(StreamEventName, StreamEventPayload) error { return nil })
	if err != nil {
		t.Fatalf("expected command failure diagnostics to be repaired: %v", err)
	}
	if workspace.files["package.json"] != validPackage {
		t.Fatalf("expected valid repaired package.json, got %q", workspace.files["package.json"])
	}
	if validator.calls != 2 || result.Repair == nil || result.Repair.Status != "passed" {
		t.Fatalf("unexpected validation/repair evidence: calls=%d evidence=%#v", validator.calls, result.Repair)
	}
}

func TestValidateAndRepairGeneratedProjectClearsRecoveredCommandFailure(t *testing.T) {
	passed := &ProjectValidationResult{
		Status: ProjectValidationStatusPassed,
		Checks: []ProjectValidationCheck{{
			ID: "prepare", Kind: "prepare", Status: ProjectValidationStatusPassed,
		}},
	}
	validator := &generatedProjectValidatorSequenceStub{
		results: []*ProjectValidationResult{passed},
		errors:  []error{nil},
	}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.projectValidator = validator
	result := &generationResult{}
	commandErr := newGenerationCommandFailure(
		"pnpm install", nil, "context deadline exceeded", context.DeadlineExceeded,
	)

	err := service.validateAndRepairGeneratedProject(
		context.Background(),
		&GenerateRequest{ProjectID: "project"},
		&model.Project{ProjectID: "project"},
		result,
		commandErr,
		func(StreamEventName, StreamEventPayload) error { return nil },
	)
	if err != nil {
		t.Fatalf("passing validation must recover a repairable command failure: %v", err)
	}
	if validator.calls != 1 || result.ProjectValidation != passed || result.Repair != nil {
		t.Fatalf(
			"unexpected recovered command evidence: calls=%d validation=%#v repair=%#v",
			validator.calls, result.ProjectValidation, result.Repair,
		)
	}
}

func TestGenerationCommandRepairabilityPreservesPolicyBlock(t *testing.T) {
	executionFailure := newGenerationCommandFailure("pnpm install", nil, "failed", errors.New("failed"))
	if !isRepairableGenerationCommandFailure(executionFailure) {
		t.Fatal("execution command failure should enter validation/repair")
	}
	policyFailure := newGenerationCommandFailure("curl example.com", nil, "denied", errors.New("denied"))
	policyFailure.Check = "policy"
	if isRepairableGenerationCommandFailure(policyFailure) {
		t.Fatal("policy rejection must remain blocking")
	}
}

func TestGenerationRepairGuidanceForNextWorkStoreInvariant(t *testing.T) {
	validation := &ProjectValidationResult{
		Stack: ProjectValidationStackNodeNextJS,
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "Invariant: Expected workStore to be initialized",
		}},
	}
	guidance := strings.Join(generationRepairGuidance(validation), "\n")
	if !strings.Contains(guidance, "await new Promise") || !strings.Contains(guidance, "setTimeout") || !strings.Contains(guidance, "同步读取确定性本地数据") {
		t.Fatalf("expected actionable workStore guidance, got %q", guidance)
	}
}

func TestGenerationRepairGuidanceForNextTypeScriptCompatibility(t *testing.T) {
	validation := &ProjectValidationResult{
		Stack: ProjectValidationStackNodeNextJS,
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: `Compiled successfully
It looks like you are trying to use TypeScript but do not have the required packages installed.
The "id" argument must be of type string. Received undefined`,
		}},
	}
	guidance := strings.Join(generationRepairGuidance(validation), "\n")
	if !strings.Contains(guidance, "package.json") ||
		!strings.Contains(guidance, "typescript 精确固定为 5.4.5") ||
		!strings.Contains(guidance, "不得仅修改页面源码") {
		t.Fatalf("expected actionable Next.js TypeScript compatibility guidance, got %q", guidance)
	}
}

func TestGenerationRepairGuidanceForHTTPXASGITransport(t *testing.T) {
	validation := &ProjectValidationResult{
		RuntimeProfile: "python-fastapi",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "TypeError: AsyncClient.__init__() got an unexpected keyword argument 'app'",
		}},
	}
	guidance := strings.Join(generationRepairGuidance(validation), "\n")
	if !strings.Contains(guidance, "httpx.ASGITransport(app=app)") ||
		!strings.Contains(guidance, "AsyncClient(transport=transport") ||
		!strings.Contains(guidance, "不得仅添加 pytest-asyncio") {
		t.Fatalf("expected actionable httpx ASGI transport guidance, got %q", guidance)
	}
}

func TestGenerationRepairGuidanceForMalformedPackageJSON(t *testing.T) {
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-nextjs",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: `parse package.json: invalid character '\' looking for beginning of object key string`,
		}},
	}
	guidance := strings.Join(generationRepairGuidance(validation), "\n")
	if !strings.Contains(guidance, `字面量 \n`) ||
		!strings.Contains(guidance, "紧凑单行标准 JSON") ||
		!strings.Contains(guidance, "replace.content") {
		t.Fatalf("expected actionable malformed package.json guidance, got %q", guidance)
	}
}

func TestGenerationRepairGuidanceForMissingSupabaseConfig(t *testing.T) {
	validation := &ProjectValidationResult{
		Stack: ProjectValidationStackNodeNextJS,
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "Error: supabaseUrl is required.",
		}},
	}
	guidance := strings.Join(generationRepairGuidance(validation), "\n")
	if !strings.Contains(guidance, "所有实际调用 createClient 的源码模块") ||
		!strings.Contains(guidance, "确定性本地 demo/fixture") ||
		!strings.Contains(guidance, "不得用伪造 URL/key") {
		t.Fatalf("expected actionable Supabase fallback guidance, got %q", guidance)
	}
}

func TestDeterministicGenerationRepairNormalizesEscapedPackageJSON(t *testing.T) {
	original := `{\n  "name": "support-command-center",\n  "scripts": {"build": "next build"}\n}\n`
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-nextjs",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: `parse package.json: invalid character '\' looking for beginning of object key string`,
		}},
	}
	result, ok := deterministicGenerationRepair([]GenerationRepairFileState{{
		Path: "package.json", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected deterministic manifest repair, got ok=%v result=%#v", ok, result)
	}
	operation := result.Operations[0]
	if operation.Operation != GenerationFileOperationReplace ||
		operation.BaseHash != generationContentHash(original) ||
		!json.Valid([]byte(operation.Content)) {
		t.Fatalf("expected valid package.json replacement, got %#v", operation)
	}
}

func TestRepairGeneratedProjectChainsDeterministicFixesWithinOneAttempt(t *testing.T) {
	page := `"use client"\nexport default function Page() { return <h1>Launch Checklist</h1>; }`
	workspace := &memoryGenerationWorkspace{
		files: map[string]string{"app/page.tsx": page},
		dirty: map[string]bool{"app/page.tsx": true},
	}
	initial := &ProjectValidationResult{
		RuntimeProfile:     "node-nextjs",
		Status:             ProjectValidationStatusFailed,
		FailureFingerprint: "missing-package",
		Checks: []ProjectValidationCheck{{
			ID:      "detect",
			Kind:    "detect",
			Status:  ProjectValidationStatusFailed,
			Message: `runtime profile "node-nextjs" requires package.json`,
		}},
	}
	escapedSource := &ProjectValidationResult{
		RuntimeProfile:     "node-nextjs",
		Status:             ProjectValidationStatusFailed,
		FailureFingerprint: "escaped-source",
		Checks: []ProjectValidationCheck{{
			ID:     "build",
			Kind:   "build",
			Status: ProjectValidationStatusFailed,
			Output: "app/page.tsx:1:13 Expected unicode escape",
		}},
	}
	passed := &ProjectValidationResult{
		RuntimeProfile: "node-nextjs",
		Status:         ProjectValidationStatusPassed,
	}
	validator := &generatedProjectValidatorSequenceStub{
		results: []*ProjectValidationResult{escapedSource, passed},
		errors:  []error{errors.New("escaped source"), nil},
	}
	generator := &generationRepairGeneratorStub{}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.fileWorkspace = workspace
	service.repairGenerator = generator
	service.projectValidator = validator
	result := &generationResult{Operations: []GenerationFileOperation{{
		Operation:  GenerationFileOperationCreate,
		Path:       "app/page.tsx",
		ResultHash: generationContentHash(page),
	}}}

	err := service.repairGeneratedProject(
		context.Background(),
		&GenerateRequest{ProjectID: "project"},
		&model.Project{ProjectID: "project"},
		result,
		initial,
		errors.New("missing package"),
		func(StreamEventName, StreamEventPayload) error { return nil },
	)
	if err != nil {
		t.Fatalf("expected chained deterministic repair to pass: %v", err)
	}
	if len(generator.requests) != 0 || validator.calls != 2 {
		t.Fatalf("expected no LLM repair and two validations, requests=%d calls=%d", len(generator.requests), validator.calls)
	}
	if _, ok := workspace.files["package.json"]; !ok || strings.Contains(workspace.files["app/page.tsx"], `\n`) {
		t.Fatalf("expected package and source fixes, files=%#v", workspace.files)
	}
	if result.Repair == nil || result.Repair.Status != "passed" || len(result.Repair.Attempts[0].Operations) != 2 {
		t.Fatalf("expected one successful attempt with both operations, evidence=%#v", result.Repair)
	}
}

func TestDeterministicGenerationRepairCreatesMissingNextPackageJSON(t *testing.T) {
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-nextjs",
		Checks: []ProjectValidationCheck{{
			ID:      "detect",
			Kind:    "detect",
			Status:  ProjectValidationStatusFailed,
			Message: `runtime profile "node-nextjs" requires package.json`,
		}},
	}
	result, ok := deterministicGenerationRepair([]GenerationRepairFileState{{
		Path:   "package.json",
		Exists: false,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected deterministic package creation, got ok=%v result=%#v", ok, result)
	}
	operation := result.Operations[0]
	if operation.Operation != GenerationFileOperationCreate || operation.Path != "package.json" {
		t.Fatalf("unexpected package operation: %#v", operation)
	}
	var manifest struct {
		Dependencies    map[string]string `json:"dependencies"`
		DevDependencies map[string]string `json:"devDependencies"`
	}
	if err := json.Unmarshal([]byte(operation.Content), &manifest); err != nil {
		t.Fatalf("expected valid package JSON: %v", err)
	}
	if manifest.Dependencies["next"] != verifiedNextVersion ||
		manifest.DevDependencies["typescript"] != "5.4.5" {
		t.Fatalf("unexpected verified package versions: %#v", manifest)
	}
}

func TestDeterministicGenerationRepairCreatesMissingFastAPIRequirements(t *testing.T) {
	validation := &ProjectValidationResult{
		RuntimeProfile: "python-fastapi",
		Checks: []ProjectValidationCheck{{
			ID:      "detect",
			Kind:    "detect",
			Status:  ProjectValidationStatusFailed,
			Message: `runtime profile "python-fastapi" requires requirements.txt or pyproject.toml`,
		}},
	}
	result, ok := deterministicGenerationRepair([]GenerationRepairFileState{{
		Path:   "requirements.txt",
		Exists: false,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected deterministic requirements creation, got ok=%v result=%#v", ok, result)
	}
	operation := result.Operations[0]
	if operation.Operation != GenerationFileOperationCreate || operation.Path != "requirements.txt" {
		t.Fatalf("unexpected requirements operation: %#v", operation)
	}
	for _, dependency := range []string{"fastapi==", "uvicorn==", "httpx==", "pytest=="} {
		if !strings.Contains(operation.Content, dependency) {
			t.Fatalf("expected verified dependency %q, got %q", dependency, operation.Content)
		}
	}
}

func TestGenerationRepairGuidanceForPythonStateIsolation(t *testing.T) {
	validation := &ProjectValidationResult{
		RuntimeProfile: "python-fastapi",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "assert response.json() == []\nE Left contains one more item",
		}},
	}
	guidance := strings.Join(generationRepairGuidance(validation), "\n")
	if !strings.Contains(guidance, "fixture 清空状态") ||
		!strings.Contains(guidance, "reload 应用模块") ||
		!strings.Contains(guidance, "禁止依赖测试执行顺序") {
		t.Fatalf("expected actionable Python test isolation guidance, got %q", guidance)
	}
}

func TestGenerationRepairGuidanceForViteReactRuntime(t *testing.T) {
	validation := &ProjectValidationResult{
		Stack: ProjectValidationStackNodeVite,
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "src/App.jsx:1:1: React is not defined at runtime",
		}},
	}
	guidance := strings.Join(generationRepairGuidance(validation), "\n")
	if !strings.Contains(guidance, "import React") || !strings.Contains(guidance, "vite.config") || !strings.Contains(guidance, "仅在 package.json 声明插件依赖不算启用") {
		t.Fatalf("expected actionable Vite React runtime guidance, got %q", guidance)
	}
}

func TestGenerationRepairGuidanceForTypeScriptImplicitAny(t *testing.T) {
	validation := &ProjectValidationResult{
		Stack: ProjectValidationStackNodeNextJS,
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "components/FilterBar.tsx:3:29 Type error: Binding element 'filters' implicitly has an 'any' type.",
		}},
	}
	guidance := strings.Join(generationRepairGuidance(validation), "\n")
	if !strings.Contains(guidance, "解构 props") || !strings.Contains(guidance, "strict/noImplicitAny") || !strings.Contains(guidance, "@ts-ignore") {
		t.Fatalf("expected actionable implicit-any guidance, got %q", guidance)
	}
}

func TestGenerationRepairGuidanceForUnresolvedNextAlias(t *testing.T) {
	validation := &ProjectValidationResult{
		Stack: ProjectValidationStackNodeNextJS,
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "Module not found: Can\x27t resolve \x27@/components/Card\x27",
		}},
	}
	guidance := strings.Join(generationRepairGuidance(validation), "\n")
	if !strings.Contains(guidance, "./components/Card") || !strings.Contains(guidance, "禁止改成另一个 @/ 前缀") {
		t.Fatalf("expected actionable relative-import guidance, got %q", guidance)
	}
}

func TestGenerationRepairAllowedPathsIncludeDiagnosedNextRelativeImports(t *testing.T) {
	validation := &ProjectValidationResult{
		Stack: ProjectValidationStackNodeNextJS,
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: strings.Join([]string{
				"./app/catalog/page.tsx",
				"Module not found: Can't resolve '../../components/Loading'",
				"./app/layout.tsx",
				"Module not found: Can't resolve './globals.css'",
			}, "\n"),
		}},
	}
	allowed := generationRepairAllowedPathSet(map[string]struct{}{
		"app/catalog/page.tsx": {},
		"app/layout.tsx":       {},
	}, validation)
	for _, expected := range []string{"components/Loading.tsx", "app/globals.css"} {
		if _, exists := allowed[expected]; !exists {
			t.Fatalf("diagnosed relative import target %q is missing from allowed paths: %#v", expected, allowed)
		}
	}
	for _, forbidden := range []string{"globals.css", "../../components/Loading"} {
		if _, exists := allowed[forbidden]; exists {
			t.Fatalf("non-normalized path %q must not be allowed: %#v", forbidden, allowed)
		}
	}
}

func TestGenerationRepairAllowedPathsIncludeDiagnosedRuntimeManifest(t *testing.T) {
	tests := []struct {
		name           string
		runtimeProfile string
		message        string
		expected       string
	}{
		{
			name:           "python requirements manifest",
			runtimeProfile: "python-fastapi",
			message:        `runtime profile "python-fastapi" requires requirements.txt or pyproject.toml`,
			expected:       "requirements.txt",
		},
		{
			name:           "node package manifest",
			runtimeProfile: "node-nextjs",
			message:        `runtime profile "node-nextjs" requires package.json`,
			expected:       "package.json",
		},
		{
			name:           "go module manifest",
			runtimeProfile: "go-gin",
			message:        `runtime profile "go-gin" requires go.mod`,
			expected:       "go.mod",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			validation := &ProjectValidationResult{
				RuntimeProfile: test.runtimeProfile,
				Checks: []ProjectValidationCheck{{
					Kind: "detect", Status: ProjectValidationStatusFailed,
					Message: test.message,
				}},
			}
			allowed := generationRepairAllowedPathSet(
				map[string]struct{}{"app/page.tsx": {}}, validation,
			)
			if _, exists := allowed[test.expected]; !exists {
				t.Fatalf("diagnosed manifest %q is missing from allowed paths: %#v", test.expected, allowed)
			}
		})
	}
}

func TestGenerationRepairAllowedPathsIncludeNPMlockfileForOwnedManifest(t *testing.T) {
	allowed := generationRepairAllowedPathSet(
		map[string]struct{}{"package.json": {}},
		&ProjectValidationResult{RuntimeProfile: "node-react"},
	)
	if _, exists := allowed["package-lock.json"]; !exists {
		t.Fatalf("npm lockfile must be repairable with an owned package manifest: %#v", allowed)
	}
}

func TestRepairGeneratedProjectRetriesSnapshotIncompatibleOperation(t *testing.T) {
	workspace := &memoryGenerationWorkspace{files: map[string]string{"app.ts": "bad"}, dirty: map[string]bool{"app.ts": true}}
	generator := &generationRepairGeneratorStub{results: []generationRepairResult{
		{
			SchemaVersion: prompt.GenerationRepairSchemaVersion,
			Operations:    []GenerationFileOperation{{Operation: GenerationFileOperationCreate, Path: "app.ts", Content: "wrong", Description: "invalid create"}},
			Message:       "invalid create",
		},
		{
			SchemaVersion: prompt.GenerationRepairSchemaVersion,
			Operations: []GenerationFileOperation{{
				Operation: GenerationFileOperationPatch, Path: "app.ts", BaseHash: generationContentHash("bad"),
				Edits: []GenerationTextEdit{{OldText: "bad", NewText: "good"}}, Description: "valid patch",
			}},
			Message: "fixed",
		},
	}}
	validator := &generatedProjectValidatorSequenceStub{
		results: []*ProjectValidationResult{{Status: ProjectValidationStatusPassed}},
		errors:  []error{nil},
	}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.fileWorkspace = workspace
	service.repairGenerator = generator
	service.projectValidator = validator
	result := &generationResult{Operations: []GenerationFileOperation{{
		Operation: GenerationFileOperationCreate, Path: "app.ts", ResultHash: generationContentHash("bad"),
	}}}

	err := service.repairGeneratedProject(context.Background(), &GenerateRequest{ProjectID: "project"}, &model.Project{ProjectID: "project"}, result, &ProjectValidationResult{FailureFingerprint: "initial"}, errors.New("build failed"), func(StreamEventName, StreamEventPayload) error { return nil })
	if err != nil {
		t.Fatalf("expected snapshot-incompatible output to consume one repair attempt: %v", err)
	}
	if len(generator.requests) != 2 || !strings.Contains(generator.requests[1].PreviousError, "already exists") {
		t.Fatalf("second attempt must receive snapshot state feedback: %#v", generator.requests)
	}
	if workspace.files["app.ts"] != "good" || validator.calls != 1 {
		t.Fatalf("invalid create must not apply before the valid patch: files=%#v validator_calls=%d", workspace.files, validator.calls)
	}
}

func TestRepairGeneratedProjectRetriesPatchContextMismatch(t *testing.T) {
	workspace := &memoryGenerationWorkspace{files: map[string]string{"app.ts": "const value = \x27bad\x27\n"}, dirty: map[string]bool{"app.ts": true}}
	generator := &generationRepairGeneratorStub{results: []generationRepairResult{
		{
			SchemaVersion: prompt.GenerationRepairSchemaVersion,
			Operations: []GenerationFileOperation{{
				Operation: GenerationFileOperationPatch, Path: "app.ts", BaseHash: generationContentHash(workspace.files["app.ts"]),
				Edits: []GenerationTextEdit{{OldText: "const value = \x27missing\x27", NewText: "const value = \x27good\x27"}}, Description: "invalid patch context",
			}},
			Message: "invalid patch context",
		},
		{
			SchemaVersion: prompt.GenerationRepairSchemaVersion,
			Operations: []GenerationFileOperation{{
				Operation: GenerationFileOperationPatch, Path: "app.ts", BaseHash: generationContentHash(workspace.files["app.ts"]),
				Edits: []GenerationTextEdit{{OldText: "const value = \x27bad\x27", NewText: "const value = \x27good\x27"}}, Description: "valid patch context",
			}},
			Message: "fixed",
		},
	}}
	validator := &generatedProjectValidatorSequenceStub{
		results: []*ProjectValidationResult{{Status: ProjectValidationStatusPassed}},
		errors:  []error{nil},
	}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.fileWorkspace = workspace
	service.repairGenerator = generator
	service.projectValidator = validator
	result := &generationResult{Operations: []GenerationFileOperation{{
		Operation: GenerationFileOperationCreate, Path: "app.ts", ResultHash: generationContentHash(workspace.files["app.ts"]),
	}}}

	err := service.repairGeneratedProject(context.Background(), &GenerateRequest{ProjectID: "project"}, &model.Project{ProjectID: "project"}, result, &ProjectValidationResult{FailureFingerprint: "initial"}, errors.New("build failed"), func(StreamEventName, StreamEventPayload) error { return nil })
	if err != nil {
		t.Fatalf("expected patch context mismatch to consume one repair attempt: %v", err)
	}
	if len(generator.requests) != 2 || !strings.Contains(generator.requests[1].PreviousError, "matched 0 times") {
		t.Fatalf("second attempt must receive exact patch context feedback: %#v", generator.requests)
	}
	if workspace.files["app.ts"] != "const value = \x27good\x27\n" || validator.calls != 1 {
		t.Fatalf("invalid patch must not apply before the valid patch: files=%#v validator_calls=%d", workspace.files, validator.calls)
	}
}

func TestRepairGeneratedProjectRetriesNoOpPatchWithReplace(t *testing.T) {
	workspace := &memoryGenerationWorkspace{
		files: map[string]string{"events.py": "value = 'bad'\n"},
		dirty: map[string]bool{"events.py": true},
	}
	generator := &generationRepairGeneratorStub{results: []generationRepairResult{
		{
			SchemaVersion: prompt.GenerationRepairSchemaVersion,
			Operations: []GenerationFileOperation{{
				Operation: GenerationFileOperationPatch, Path: "events.py",
				BaseHash:    generationContentHash(workspace.files["events.py"]),
				Edits:       []GenerationTextEdit{{OldText: "value = 'bad'", NewText: "value = 'bad'"}},
				Description: "no-op patch",
			}},
			Message: "attempted",
		},
		{
			SchemaVersion: prompt.GenerationRepairSchemaVersion,
			Operations: []GenerationFileOperation{{
				Operation: GenerationFileOperationReplace, Path: "events.py",
				BaseHash: generationContentHash(workspace.files["events.py"]),
				Content:  "value = 'good'\n", Description: "replace after no-op",
			}},
			Message: "fixed",
		},
	}}
	validator := &generatedProjectValidatorSequenceStub{
		results: []*ProjectValidationResult{{Status: ProjectValidationStatusPassed}},
		errors:  []error{nil},
	}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.fileWorkspace = workspace
	service.repairGenerator = generator
	service.projectValidator = validator
	result := &generationResult{Operations: []GenerationFileOperation{{Operation: GenerationFileOperationCreate, Path: "events.py"}}}

	err := service.repairGeneratedProject(context.Background(), &GenerateRequest{ProjectID: "project"}, &model.Project{ProjectID: "project"}, result, &ProjectValidationResult{FailureFingerprint: "initial"}, errors.New("build failed"), func(StreamEventName, StreamEventPayload) error { return nil })
	if err != nil {
		t.Fatalf("expected replace retry to recover from no-op patch: %v", err)
	}
	if len(generator.requests) != 2 || !strings.Contains(generator.requests[1].PreviousError, "does not change") || workspace.files["events.py"] != "value = 'good'\n" {
		t.Fatalf("unexpected no-op retry state: requests=%#v files=%#v", generator.requests, workspace.files)
	}
}

func TestRepairGeneratedProjectAllowsDiagnosedNextRootLayoutCreation(t *testing.T) {
	workspace := &memoryGenerationWorkspace{
		files: map[string]string{"app/revenue-pulse/page.tsx": "export default function Page() { return null }"},
		dirty: map[string]bool{},
	}
	generator := &generationRepairGeneratorStub{results: []generationRepairResult{{
		SchemaVersion: prompt.GenerationRepairSchemaVersion,
		Operations: []GenerationFileOperation{{
			Operation: GenerationFileOperationCreate, Path: "app/layout.tsx",
			Content:     "export default function Layout({ children }) { return <html><body>{children}</body></html> }",
			Description: "add required Next.js root layout",
		}},
		Message: "added root layout",
	}}}
	validator := &generatedProjectValidatorSequenceStub{
		results: []*ProjectValidationResult{{Status: ProjectValidationStatusPassed}},
		errors:  []error{nil},
	}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.fileWorkspace = workspace
	service.repairGenerator = generator
	service.projectValidator = validator
	result := &generationResult{Operations: []GenerationFileOperation{{
		Operation: GenerationFileOperationCreate, Path: "app/revenue-pulse/page.tsx",
		ResultHash: generationContentHash(workspace.files["app/revenue-pulse/page.tsx"]),
	}}}
	initialValidation := &ProjectValidationResult{
		Status: ProjectValidationStatusFailed, Stack: ProjectValidationStackNodeNextJS, FailureFingerprint: "missing-layout",
		Checks: []ProjectValidationCheck{{
			ID: "build", Kind: "build", Status: ProjectValidationStatusFailed,
			Message: "page.tsx does not have a root layout",
		}},
	}

	err := service.repairGeneratedProject(context.Background(), &GenerateRequest{ProjectID: "project"}, &model.Project{ProjectID: "project"}, result, initialValidation, errors.New("build failed"), func(StreamEventName, StreamEventPayload) error { return nil })
	if err != nil {
		t.Fatalf("expected diagnosed root layout creation to pass: %v", err)
	}
	if _, exists := workspace.files["app/layout.tsx"]; !exists {
		t.Fatal("expected repair to create app/layout.tsx")
	}
	if len(generator.requests) != 1 || !containsGenerationPath(generator.requests[0].AllowedPaths, "app/layout.tsx") {
		t.Fatalf("repair request must expose the diagnosed missing layout path: %#v", generator.requests)
	}
	for _, file := range generator.requests[0].Files {
		if file.Path == "app/layout.tsx" && file.Exists {
			t.Fatalf("missing layout must be represented as exists=false: %#v", file)
		}
	}
}

func containsGenerationPath(paths []string, target string) bool {
	for _, filePath := range paths {
		if filePath == target {
			return true
		}
	}
	return false
}

func TestValidateGenerationRepairPathsRejectsScopeExpansion(t *testing.T) {
	err := validateGenerationRepairPaths([]GenerationFileOperation{{Path: "outside.ts"}}, map[string]struct{}{"app.ts": {}})
	if err == nil {
		t.Fatal("repair path outside initial attempt must fail")
	}
}

func TestRepairGeneratedProjectStopsAtDefaultBudget(t *testing.T) {
	workspace := &memoryGenerationWorkspace{files: map[string]string{"app.ts": "v0"}, dirty: map[string]bool{"app.ts": true}}
	generator := &generationRepairGeneratorStub{results: []generationRepairResult{
		{SchemaVersion: prompt.GenerationRepairSchemaVersion, Operations: []GenerationFileOperation{{Operation: GenerationFileOperationReplace, Path: "app.ts", BaseHash: generationContentHash("v0"), Content: "v1", Description: "first"}}, Message: "first"},
		{SchemaVersion: prompt.GenerationRepairSchemaVersion, Operations: []GenerationFileOperation{{Operation: GenerationFileOperationReplace, Path: "app.ts", BaseHash: generationContentHash("v1"), Content: "v2", Description: "second"}}, Message: "second"},
	}}
	validator := &generatedProjectValidatorSequenceStub{
		results: []*ProjectValidationResult{
			{Status: ProjectValidationStatusFailed, FailureFingerprint: "fingerprint-1"},
			{Status: ProjectValidationStatusFailed, FailureFingerprint: "fingerprint-2"},
		},
		errors: []error{errors.New("first failure"), errors.New("second failure")},
	}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.fileWorkspace = workspace
	service.repairGenerator = generator
	service.projectValidator = validator
	result := &generationResult{Operations: []GenerationFileOperation{{Operation: GenerationFileOperationCreate, Path: "app.ts", ResultHash: generationContentHash("v0")}}}

	err := service.repairGeneratedProject(context.Background(), &GenerateRequest{ProjectID: "project"}, &model.Project{ProjectID: "project"}, result, &ProjectValidationResult{FailureFingerprint: "initial"}, errors.New("initial"), func(StreamEventName, StreamEventPayload) error { return nil })
	if GenerationFailureCode(err) != GenerationFailureCodeRepairBudgetExhausted {
		t.Fatalf("expected repair budget exhaustion, got %v", err)
	}
	if validator.calls != generationRepairDefaultAttempts || len(result.Repair.Attempts) != generationRepairDefaultAttempts {
		t.Fatalf("expected exactly %d attempts, calls=%d evidence=%#v", generationRepairDefaultAttempts, validator.calls, result.Repair)
	}
	if len(generator.requests) != 2 || !strings.Contains(generator.requests[1].PreviousError, "first failure") {
		t.Fatalf("next repair attempt must receive the prior validation error: %#v", generator.requests)
	}
}

func TestRepairGeneratedProjectUsesPostValidationSnapshotForToolchainChanges(t *testing.T) {
	workspace := &memoryGenerationWorkspace{files: map[string]string{"app.ts": "toolchain change"}, dirty: map[string]bool{}}
	generator := &generationRepairGeneratorStub{results: []generationRepairResult{{
		SchemaVersion: prompt.GenerationRepairSchemaVersion,
		Operations: []GenerationFileOperation{{
			Operation: GenerationFileOperationReplace, Path: "app.ts",
			BaseHash: generationContentHash("toolchain change"), Content: "fixed", Description: "repair current snapshot",
		}},
		Message: "fixed",
	}}}
	validator := &generatedProjectValidatorSequenceStub{
		results: []*ProjectValidationResult{{Status: ProjectValidationStatusPassed}},
		errors:  []error{nil},
	}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.fileWorkspace = workspace
	service.repairGenerator = generator
	service.projectValidator = validator
	result := &generationResult{Operations: []GenerationFileOperation{{
		Operation: GenerationFileOperationCreate, Path: "app.ts", ResultHash: generationContentHash("generated"),
	}}}

	err := service.repairGeneratedProject(context.Background(), &GenerateRequest{ProjectID: "project"}, &model.Project{ProjectID: "project"}, result, &ProjectValidationResult{FailureFingerprint: "initial"}, errors.New("build failed"), func(StreamEventName, StreamEventPayload) error { return nil })
	if err != nil {
		t.Fatalf("expected repair to use the post-validation snapshot: %v", err)
	}
	if workspace.files["app.ts"] != "fixed" || len(generator.requests) != 1 {
		t.Fatalf("unexpected repaired state: files=%#v requests=%#v", workspace.files, generator.requests)
	}
	files := generator.requests[0].Files
	if len(files) != 1 || files[0].SHA256 != generationContentHash("toolchain change") {
		t.Fatalf("repair prompt must use current post-validation content hash, got %#v", files)
	}
}

func TestRepairGeneratedProjectRejectsChangeAfterRepairSnapshot(t *testing.T) {
	workspace := &memoryGenerationWorkspace{files: map[string]string{"app.ts": "bad"}, dirty: map[string]bool{}}
	generator := &generationRepairGeneratorStub{results: []generationRepairResult{{
		SchemaVersion: prompt.GenerationRepairSchemaVersion,
		Operations: []GenerationFileOperation{{
			Operation: GenerationFileOperationReplace, Path: "app.ts",
			BaseHash: generationContentHash("bad"), Content: "fixed", Description: "repair snapshot",
		}},
		Message: "fixed",
	}}}
	generator.onGenerate = func(generationRepairRequest) {
		workspace.files["app.ts"] = "concurrent user change"
	}
	validator := &generatedProjectValidatorSequenceStub{}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.fileWorkspace = workspace
	service.repairGenerator = generator
	service.projectValidator = validator
	result := &generationResult{Operations: []GenerationFileOperation{{
		Operation: GenerationFileOperationCreate, Path: "app.ts", ResultHash: generationContentHash("bad"),
	}}}

	err := service.repairGeneratedProject(context.Background(), &GenerateRequest{ProjectID: "project"}, &model.Project{ProjectID: "project"}, result, &ProjectValidationResult{FailureFingerprint: "initial"}, errors.New("build failed"), func(StreamEventName, StreamEventPayload) error { return nil })
	if GenerationFailureCode(err) != GenerationFailureCodeFileConflict {
		t.Fatalf("expected post-snapshot concurrent change to be blocked, got %v", err)
	}
	if workspace.files["app.ts"] != "concurrent user change" || validator.calls != 0 {
		t.Fatalf("concurrent content must remain untouched, files=%#v validator_calls=%d", workspace.files, validator.calls)
	}
}
