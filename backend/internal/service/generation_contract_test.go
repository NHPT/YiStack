package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"yistack/internal/model"
	"yistack/internal/prompt"
	"yistack/pkg/container"
)

type generationCommandExecution struct {
	result *container.ExecResult
	err    error
}

type generationCommandExecutorStub struct {
	executions []generationCommandExecution
	commands   []string
	args       [][]string
	workDirs   []string
}

func (s *generationCommandExecutorStub) ExecuteInContainer(_ context.Context, opts *container.RunOptions) (*container.ExecResult, error) {
	if opts != nil {
		args := append([]string(nil), opts.Args...)
		command := strings.Join(args, " ")
		if command == "" {
			command = opts.Command
		}
		s.commands = append(s.commands, command)
		s.args = append(s.args, args)
		s.workDirs = append(s.workDirs, opts.WorkDir)
	}
	index := len(s.commands) - 1
	if index < 0 || index >= len(s.executions) {
		return nil, errors.New("unexpected command execution")
	}
	execution := s.executions[index]
	return execution.result, execution.err
}

func TestDecodeGenerationResultAcceptsVersionedStrictContract(t *testing.T) {
	result, err := decodeGenerationResult(`{
		"schema_version":"generation_result.v2",
		"operations":[{"operation":"create","path":" ./src/../page.tsx ","content":"export default 1","description":" page "}],
		"message":" generated ",
		"commands":[]
	}`)
	if err != nil {
		t.Fatalf("expected strict generation result to pass: %v", err)
	}
	if result.SchemaVersion != prompt.GenerationResultSchemaVersion {
		t.Fatalf("expected schema version %q, got %q", prompt.GenerationResultSchemaVersion, result.SchemaVersion)
	}
	if len(result.Operations) != 1 || result.Operations[0].Path != "page.tsx" || result.Operations[0].Description != "page" {
		t.Fatalf("expected normalized generated operation, got %#v", result.Operations)
	}
	if result.Message != "generated" || result.Commands == nil || len(result.Commands) != 0 {
		t.Fatalf("expected normalized message and explicit empty commands, got %#v", result)
	}
}

func TestNormalizeGenerationResultWireFormatRepairsOnlyOperationSeparators(t *testing.T) {
	raw := `{"schema_version":"generation_result.v2","operations":[{"operation":"create","path":"a.txt","content":"a","description":"a"},"{"operation":"create","path":"b.txt","content":"b","description":"b"}],"message":"done","commands":[]}`
	normalized, count := normalizeGenerationResultWireFormat(raw)
	if count != 1 {
		t.Fatalf("expected one normalized separator, got %d", count)
	}
	result, err := decodeGenerationResult(normalized)
	if err != nil {
		t.Fatalf("normalized result must pass strict decoding: %v", err)
	}
	if len(result.Operations) != 2 ||
		result.Operations[0].Path != "a.txt" ||
		result.Operations[1].Path != "b.txt" {
		t.Fatalf("unexpected normalized operations: %#v", result.Operations)
	}

	valid := `{"schema_version":"generation_result.v2","operations":[{"operation":"create","path":"a.txt","content":"},\"{\"operation","description":"a"}],"message":"done","commands":[]}`
	unchanged, count := normalizeGenerationResultWireFormat(valid)
	if count != 0 || unchanged != valid {
		t.Fatalf("valid JSON content must remain unchanged: count=%d content=%q", count, unchanged)
	}
}

func TestDecodeGenerationResultRejectsInvalidContractsWithoutReadmeFallback(t *testing.T) {
	tests := []struct {
		name string
		raw  string
	}{
		{name: "malformed", raw: `{not-json`},
		{name: "legacy unversioned", raw: `{"files":[{"path":"README.md","content":"legacy","description":"legacy"}],"message":"done","commands":[]}`},
		{name: "unknown root field", raw: `{"schema_version":"generation_result.v2","operations":[{"operation":"create","path":"a.txt","content":"a","description":"a"}],"message":"done","commands":[],"extra":true}`},
		{name: "unsafe path", raw: `{"schema_version":"generation_result.v2","operations":[{"operation":"create","path":"../outside.txt","content":"a","description":"a"}],"message":"done","commands":[]}`},
		{name: "duplicate normalized path", raw: `{"schema_version":"generation_result.v2","operations":[{"operation":"create","path":"src/../a.txt","content":"a","description":"a"},{"operation":"create","path":"a.txt","content":"b","description":"b"}],"message":"done","commands":[]}`},
		{name: "missing commands", raw: `{"schema_version":"generation_result.v2","operations":[{"operation":"create","path":"a.txt","content":"a","description":"a"}],"message":"done"}`},
		{name: "trailing json", raw: `{"schema_version":"generation_result.v2","operations":[{"operation":"create","path":"a.txt","content":"a","description":"a"}],"message":"done","commands":[]} {}`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result, err := decodeGenerationResult(test.raw)
			if err == nil {
				t.Fatalf("expected invalid generation result to fail, got %#v", result)
			}
			if GenerationFailureCode(err) != GenerationFailureCodeSchemaInvalid {
				t.Fatalf("expected schema failure code, got %q: %v", GenerationFailureCode(err), err)
			}
			if len(result.Operations) != 0 {
				t.Fatalf("invalid result must not create fallback operations, got %#v", result.Operations)
			}
		})
	}
}

func TestCompleteGenerationArtifactsStageDoesNotEmitDoneForInvalidSchema(t *testing.T) {
	service := NewGeneratorService(GeneratorServiceOptions{})
	var events []StreamEventName
	err := service.completeGenerationArtifactsStage(
		context.Background(),
		&GenerateRequest{},
		generationRuntimeStageResult{},
		generationContentStageResult{rawContent: `{not-json`, usedModel: "test-model"},
		serviceWorkflowStageImplement,
		func(name StreamEventName, _ StreamEventPayload) error {
			events = append(events, name)
			return nil
		},
	)
	if GenerationFailureCode(err) != GenerationFailureCodeSchemaInvalid {
		t.Fatalf("expected schema failure, got %v", err)
	}
	for _, event := range events {
		if event == StreamEventDone {
			t.Fatalf("invalid schema must not emit done, got events %#v", events)
		}
	}
}

func TestRunGeneratedCommandsStopsOnFirstFailure(t *testing.T) {
	tests := []struct {
		name      string
		execution generationCommandExecution
		exitCode  *int
	}{
		{name: "execution error", execution: generationCommandExecution{err: errors.New("runtime unavailable")}},
		{name: "timeout", execution: generationCommandExecution{err: context.DeadlineExceeded}},
		{name: "nil result", execution: generationCommandExecution{}},
		{name: "non zero", execution: generationCommandExecution{result: &container.ExecResult{ExitCode: 9, Stderr: "build failed"}}, exitCode: intPointer(9)},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			executor := &generationCommandExecutorStub{executions: []generationCommandExecution{test.execution}}
			service := NewGeneratorService(GeneratorServiceOptions{})
			service.commandExecutor = executor
			var failedMeta map[string]any

			err := service.runGeneratedCommands(
				context.Background(),
				"project-1",
				&model.Project{ProjectID: "project-1"},
				[]string{"npm install", "go mod download"},
				func(name StreamEventName, payload StreamEventPayload) error {
					if name != StreamEventStep {
						return nil
					}
					step, _ := payload.(map[string]any)
					if step["status"] == "failed" {
						failedMeta, _ = step["meta"].(map[string]any)
					}
					return nil
				},
			)

			if GenerationFailureCode(err) != GenerationFailureCodeCommandFailed {
				t.Fatalf("expected command failure code, got %q: %v", GenerationFailureCode(err), err)
			}
			if len(executor.commands) != 1 || executor.commands[0] != "npm install" {
				t.Fatalf("expected command execution to stop immediately, got %#v", executor.commands)
			}
			if failedMeta["reason_code"] != GenerationFailureCodeCommandFailed {
				t.Fatalf("expected structured failed step metadata, got %#v", failedMeta)
			}
			var failure *GenerationFailureError
			if !errors.As(err, &failure) {
				t.Fatalf("expected GenerationFailureError, got %T", err)
			}
			if test.exitCode != nil && (failure.ExitCode == nil || *failure.ExitCode != *test.exitCode) {
				t.Fatalf("expected exit code %d, got %#v", *test.exitCode, failure.ExitCode)
			}
		})
	}
}

func TestRunGeneratedCommandsContinuesOnlyAfterSuccess(t *testing.T) {
	executor := &generationCommandExecutorStub{executions: []generationCommandExecution{
		{result: &container.ExecResult{ExitCode: 0, Stdout: "first ok"}},
		{result: &container.ExecResult{ExitCode: 0, Stdout: "second ok"}},
	}}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.commandExecutor = executor

	err := service.runGeneratedCommands(
		context.Background(),
		"project-1",
		&model.Project{ProjectID: "project-1"},
		[]string{"npm install", "go mod download"},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)
	if err != nil {
		t.Fatalf("expected successful commands, got %v", err)
	}
	if strings.Join(executor.commands, ",") != "npm install,go mod download" {
		t.Fatalf("expected both commands to run, got %#v", executor.commands)
	}
	for index, args := range executor.args {
		if len(args) == 0 || executor.workDirs[index] != "/workspace" {
			t.Fatalf("expected command %d to use structured argv in /workspace, args=%#v workdir=%q", index, args, executor.workDirs[index])
		}
	}
}

func TestGeneratedCommandPolicyRejectsShellAndRuntimeCommands(t *testing.T) {
	for _, command := range []string{
		"rm -rf /workspace",
		"npm install && curl https://example.com",
		"nohup node server.js &",
		"npm run build",
		"pnpm run build",
		"yarn run lint",
		"go generate ./...",
		"npm install arbitrary-package",
		"npm install --global typescript",
		"python3 -m pip install ../outside",
	} {
		if err := validateGeneratedCommandPolicy(command); err == nil {
			t.Fatalf("expected command %q to be rejected", command)
		}
	}
	for _, command := range []string{
		"npm ci",
		"npm install --legacy-peer-deps",
		"pnpm install --frozen-lockfile",
		"yarn install --immutable",
		"go mod download",
		"python3 -m pip install -r requirements.txt",
	} {
		if err := validateGeneratedCommandPolicy(command); err != nil {
			t.Fatalf("expected command %q to be allowed: %v", command, err)
		}
	}
}

func TestRunGeneratedCommandsUsesProjectPythonVirtualEnvironment(t *testing.T) {
	executor := &generationCommandExecutorStub{
		executions: []generationCommandExecution{
			{result: &container.ExecResult{ExitCode: 0}},
			{result: &container.ExecResult{ExitCode: 0, Stdout: "installed"}},
		},
	}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.commandExecutor = executor

	err := service.runGeneratedCommands(
		context.Background(),
		"project-1",
		&model.Project{ProjectID: "project-1"},
		[]string{"pip install -r requirements.txt"},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)
	if err != nil {
		t.Fatalf("expected controlled Python dependency preparation to pass: %v", err)
	}
	expected := []string{
		strings.Join(projectPythonVirtualEnvironmentCreationArgs(), " "),
		strings.Join(projectPythonPackageInstallArgs("-r", "requirements.txt"), " "),
	}
	if strings.Join(executor.commands, "\n") != strings.Join(expected, "\n") {
		t.Fatalf(
			"expected project virtual environment commands %#v, got %#v",
			expected,
			executor.commands,
		)
	}
}

func TestRunGeneratedCommandsRejectsPolicyViolationBeforeExecution(t *testing.T) {
	executor := &generationCommandExecutorStub{}
	service := NewGeneratorService(GeneratorServiceOptions{})
	service.commandExecutor = executor

	err := service.runGeneratedCommands(
		context.Background(),
		"project-1",
		&model.Project{ProjectID: "project-1"},
		[]string{"rm -rf /workspace"},
		func(StreamEventName, StreamEventPayload) error { return nil },
	)

	if GenerationFailureCode(err) != GenerationFailureCodeCommandFailed {
		t.Fatalf("expected controlled command failure, got %v", err)
	}
	if len(executor.commands) != 0 {
		t.Fatalf("rejected command must not reach the container, got %#v", executor.commands)
	}
}

func TestGenerationChatRequestUsesStrictJSONSchemaResponseFormat(t *testing.T) {
	request := buildGenerationChatRequest(
		&GenerateRequest{Prompt: "build app"},
		generationRuntimeStageResult{},
		"gpt-oss:20b",
		0.2,
	)
	if request.ResponseFormat == nil || request.ResponseFormat.Type != "json_schema" {
		t.Fatalf("expected JSON Schema response format, got %#v", request.ResponseFormat)
	}
	if request.ReasoningEffort != "low" {
		t.Fatalf("expected low GPT-OSS reasoning effort for structured output, got %q", request.ReasoningEffort)
	}
	if request.ResponseFormat.JSONSchema == nil || request.ResponseFormat.JSONSchema.Strict != true {
		t.Fatalf("expected strict JSON Schema, got %#v", request.ResponseFormat.JSONSchema)
	}
	properties, _ := request.ResponseFormat.JSONSchema.Schema["properties"].(map[string]any)
	version, _ := properties["schema_version"].(map[string]any)
	if version["const"] != prompt.GenerationResultSchemaVersion {
		t.Fatalf("expected schema version const %q, got %#v", prompt.GenerationResultSchemaVersion, version)
	}
}

func intPointer(value int) *int {
	return &value
}
