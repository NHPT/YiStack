package orchestration

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"yistack/internal/model"
	"yistack/internal/service"
)

type stubValidationGateRunner struct {
	result ValidationGateResult
	err    error
	gates  []string
}

type capturedStreamEvent struct {
	name    service.StreamEventName
	payload service.StreamEventPayload
}

func (r *stubValidationGateRunner) Run(_ context.Context, gate string, _ EngineeringState) (ValidationGateResult, error) {
	r.gates = append(r.gates, gate)
	return r.result, r.err
}

func newCapturedStreamHandler(events *[]capturedStreamEvent) service.StreamEventHandler {
	return func(name service.StreamEventName, payload service.StreamEventPayload) error {
		if events != nil {
			*events = append(*events, capturedStreamEvent{name: name, payload: payload})
		}
		return nil
	}
}

func assertStepEngineeringStatePhase(t *testing.T, payload map[string]interface{}, expectedStatus string) map[string]interface{} {
	t.Helper()

	engineeringState, ok := payload["engineeringState"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected engineeringState payload, got %T", payload["engineeringState"])
	}
	phase, ok := engineeringState["phase"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected phase payload, got %T", engineeringState["phase"])
	}

	requiredFields := []string{"current_phase", "current_task", "completed_tasks", "blockers", "next_action", "status"}
	for _, field := range requiredFields {
		if _, ok := phase[field]; !ok {
			t.Fatalf("expected phase field %q in payload %+v", field, phase)
		}
	}
	if currentPhase, ok := phase["current_phase"].(string); !ok || strings.TrimSpace(currentPhase) == "" {
		t.Fatalf("expected non-empty phase current_phase, got %v", phase["current_phase"])
	}
	if expectedStatus != "" && phase["status"] != expectedStatus {
		t.Fatalf("expected phase status %q, got %v", expectedStatus, phase["status"])
	}

	return engineeringState
}

func assertCapturedStepEngineeringStatePhase(t *testing.T, events []capturedStreamEvent, expectedID string, expectedStepStatus string, expectedPhaseStatus string) map[string]interface{} {
	t.Helper()

	for _, event := range events {
		if event.name != "step" {
			continue
		}
		payload, ok := event.payload.(map[string]interface{})
		if !ok {
			t.Fatalf("expected step payload map, got %T", event.payload)
		}
		if payload["id"] != expectedID || payload["status"] != expectedStepStatus {
			continue
		}
		return assertStepEngineeringStatePhase(t, payload, expectedPhaseStatus)
	}

	t.Fatalf("expected step event %s with status %s", expectedID, expectedStepStatus)
	return nil
}

type stubChatMessageRepo struct {
	messages []model.ChatMessage
}

type stubEngineeringStateRepo struct {
	state *model.ProjectEngineeringState
}

type stubCapabilityExecutor struct {
	result CapabilityExecutionResult
	calls  int
	audit  CapabilityExecutionAudit
}

type stubCapabilityAuditRepo struct {
	records []model.ProjectCapabilityExecutionAudit
}

type stubCapabilityProviderRunner struct {
	result CapabilityProviderRunResult
	calls  int
}

type panicCapabilityProviderRunner struct{}

type boundaryProbeCapabilityProviderRunner struct {
	boundary CapabilityRunnerBoundary
	ok       bool
}

type waitingCapabilityProviderRunner struct{}

type stubProjectArtifactLoader struct {
	content string
	found   bool
	err     error
}

func (l *stubProjectArtifactLoader) LoadProjectArtifact(_ context.Context, _, _ string) (string, bool, error) {
	return l.content, l.found, l.err
}

func (r *stubChatMessageRepo) Create(_ context.Context, msg *model.ChatMessage) error {
	if msg != nil {
		r.messages = append(r.messages, *msg)
	}
	return nil
}

func (r *stubChatMessageRepo) ListByProjectID(_ context.Context, _ string) ([]model.ChatMessage, error) {
	return r.messages, nil
}

func (r *stubChatMessageRepo) DeleteByProjectID(_ context.Context, _ string) error {
	r.messages = nil
	return nil
}

func (r *stubEngineeringStateRepo) UpsertSnapshot(_ context.Context, state *model.ProjectEngineeringState) error {
	r.state = state
	return nil
}

func (r *stubEngineeringStateRepo) FindByProjectID(_ context.Context, _ string) (*model.ProjectEngineeringState, error) {
	return r.state, nil
}

func (r *stubEngineeringStateRepo) DeleteByProjectID(_ context.Context, _ string) error {
	r.state = nil
	return nil
}

func (e *stubCapabilityExecutor) Execute(_ context.Context, audit CapabilityExecutionAudit) CapabilityExecutionResult {
	e.calls++
	e.audit = audit
	return e.result
}

func (r *stubCapabilityAuditRepo) Create(_ context.Context, audit *model.ProjectCapabilityExecutionAudit) error {
	if audit != nil {
		r.records = append(r.records, *audit)
	}
	return nil
}

func (r *stubCapabilityProviderRunner) ExecuteCapability(_ context.Context, _ CapabilityExecutionAuditItem) CapabilityProviderRunResult {
	r.calls++
	return r.result
}

func (panicCapabilityProviderRunner) ExecuteCapability(_ context.Context, _ CapabilityExecutionAuditItem) CapabilityProviderRunResult {
	panic("测试 runner panic")
}

func (r *boundaryProbeCapabilityProviderRunner) ExecuteCapability(ctx context.Context, _ CapabilityExecutionAuditItem) CapabilityProviderRunResult {
	r.boundary, r.ok = CapabilityRunnerBoundaryFromContext(ctx)
	return CapabilityProviderRunResult{
		Status:     CapabilityExecutionResultStatusExecuted,
		ReasonCode: "boundary_probe_executed",
		SourceNote: "测试 runner 已读取 capability runner boundary。",
	}
}

func (waitingCapabilityProviderRunner) ExecuteCapability(ctx context.Context, _ CapabilityExecutionAuditItem) CapabilityProviderRunResult {
	<-ctx.Done()
	return CapabilityProviderRunResult{
		Status:     CapabilityExecutionResultStatusExecuted,
		ReasonCode: "waiting_runner_finished",
		SourceNote: "测试 runner 等待 context 结束。",
	}
}

func TestGeneratePlansCommandNormalizedDefaults(t *testing.T) {
	command := (GeneratePlansCommand{
		ProjectID: "project-1",
		AppType:   "web",
	}).normalized()

	if command.Context.WorkflowStage != WorkflowStagePlanAnalysis {
		t.Fatalf("expected workflow stage %q, got %q", WorkflowStagePlanAnalysis, command.Context.WorkflowStage)
	}
	if command.Context.WorkflowMode != WorkflowModePlan {
		t.Fatalf("expected workflow mode %q, got %q", WorkflowModePlan, command.Context.WorkflowMode)
	}
	if command.Context.RequestSource != RequestSourceHTTP {
		t.Fatalf("expected request source %q, got %q", RequestSourceHTTP, command.Context.RequestSource)
	}
	if command.Context.RuntimeProjectID != "project-1" {
		t.Fatalf("expected runtime project id %q, got %q", "project-1", command.Context.RuntimeProjectID)
	}
	if command.Context.RuntimeAppType != "web" {
		t.Fatalf("expected runtime app type %q, got %q", "web", command.Context.RuntimeAppType)
	}
}

func TestWorkflowStageDefinitionsCoverCoreStages(t *testing.T) {
	definitions := WorkflowStageDefinitions()
	expectedStages := []string{
		WorkflowStageBootstrap,
		WorkflowStageBootstrapReview,
		WorkflowStageBootstrapConfirmed,
		WorkflowStagePlanAnalysis,
		WorkflowStagePlanSelection,
		WorkflowStagePlanApproved,
		WorkflowStageImplement,
	}
	for _, expectedStage := range expectedStages {
		found := false
		for _, definition := range definitions {
			if definition.Stage != expectedStage {
				continue
			}
			found = true
			if strings.TrimSpace(definition.DefaultMode) == "" {
				t.Fatalf("expected default mode for stage %q", expectedStage)
			}
			if strings.TrimSpace(definition.ApprovalBoundary) == "" {
				t.Fatalf("expected approval boundary for stage %q", expectedStage)
			}
		}
		if !found {
			t.Fatalf("expected workflow stage definition for %q", expectedStage)
		}
	}
}

func TestGenerateCommandNormalizedDefaults(t *testing.T) {
	command := (GenerateCommand{
		ProjectID:   "project-1",
		AppType:     "web",
		ProjectName: "demo",
	}).normalized()

	if command.Context.WorkflowStage != WorkflowStageImplement {
		t.Fatalf("expected workflow stage %q, got %q", WorkflowStageImplement, command.Context.WorkflowStage)
	}
	if command.Context.WorkflowMode != WorkflowModeImplement {
		t.Fatalf("expected workflow mode %q, got %q", WorkflowModeImplement, command.Context.WorkflowMode)
	}
	if command.Context.RequestSource != RequestSourceHTTP {
		t.Fatalf("expected request source %q, got %q", RequestSourceHTTP, command.Context.RequestSource)
	}
	if command.Context.ValidationGate != ValidationGateBeforePreview {
		t.Fatalf("expected validation gate %q, got %q", ValidationGateBeforePreview, command.Context.ValidationGate)
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
}

func TestGenerateCommandNormalizedUsesConversationStage(t *testing.T) {
	command := (GenerateCommand{
		ConversationStage: "plan-selection",
		Mode:              "discuss",
	}).normalized()

	if command.Context.WorkflowStage != "plan-selection" {
		t.Fatalf("expected workflow stage %q, got %q", "plan-selection", command.Context.WorkflowStage)
	}
	if command.Context.WorkflowMode != "discuss" {
		t.Fatalf("expected workflow mode %q, got %q", "discuss", command.Context.WorkflowMode)
	}
	if command.Context.ValidationGate != "" {
		t.Fatalf("expected validation gate to be empty, got %q", command.Context.ValidationGate)
	}
}

func TestResolveWorkflowStageModeInfersModeFromStage(t *testing.T) {
	stage, mode := ResolveWorkflowStageMode(WorkflowStagePlanApproved, "", "", "")

	if stage != WorkflowStagePlanApproved {
		t.Fatalf("expected workflow stage %q, got %q", WorkflowStagePlanApproved, stage)
	}
	if mode != WorkflowModeImplement {
		t.Fatalf("expected workflow mode %q, got %q", WorkflowModeImplement, mode)
	}
}

func TestResolveWorkflowStageModeUsesDefaults(t *testing.T) {
	stage, mode := ResolveWorkflowStageMode("", "", WorkflowStageImplement, WorkflowModeImplement)

	if stage != WorkflowStageImplement {
		t.Fatalf("expected workflow stage %q, got %q", WorkflowStageImplement, stage)
	}
	if mode != WorkflowModeImplement {
		t.Fatalf("expected workflow mode %q, got %q", WorkflowModeImplement, mode)
	}
}

func TestGenerateCommandNormalizedPrefersExplicitContext(t *testing.T) {
	command := (GenerateCommand{
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStagePlanSelection,
			WorkflowMode:  WorkflowModeDiscuss,
		},
		ConversationStage: WorkflowStageImplement,
		Mode:              WorkflowModeImplement,
	}).normalized()

	if command.Context.WorkflowStage != WorkflowStagePlanSelection {
		t.Fatalf("expected workflow stage %q, got %q", WorkflowStagePlanSelection, command.Context.WorkflowStage)
	}
	if command.Context.WorkflowMode != WorkflowModeDiscuss {
		t.Fatalf("expected workflow mode %q, got %q", WorkflowModeDiscuss, command.Context.WorkflowMode)
	}
	if command.Context.ValidationGate != "" {
		t.Fatalf("expected validation gate to remain empty, got %q", command.Context.ValidationGate)
	}
}

func TestGenerateCommandNormalizedUsesFoundationModeForBootstrap(t *testing.T) {
	command := (GenerateCommand{
		ConversationStage: WorkflowStageBootstrap,
	}).normalized()

	if command.Context.WorkflowStage != WorkflowStageBootstrap {
		t.Fatalf("expected workflow stage %q, got %q", WorkflowStageBootstrap, command.Context.WorkflowStage)
	}
	if command.Context.WorkflowMode != WorkflowModeFoundation {
		t.Fatalf("expected workflow mode %q, got %q", WorkflowModeFoundation, command.Context.WorkflowMode)
	}
	if command.Context.ValidationGate != "" {
		t.Fatalf("expected validation gate to remain empty, got %q", command.Context.ValidationGate)
	}
}

func TestBuildServiceGenerateRequestUsesNormalizedWorkflowContext(t *testing.T) {
	command := (GenerateCommand{
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStagePlanApproved,
			WorkflowMode:  WorkflowModeImplement,
		},
		UserID:            "user-1",
		ProjectID:         "project-1",
		Prompt:            "继续实现",
		ConversationStage: WorkflowStagePlanSelection,
		Mode:              WorkflowModeDiscuss,
		PlanContext:       "plan-a",
		AppType:           "web",
		ProjectName:       "demo",
		Online:            true,
		Model:             "model-a",
		Provider:          "provider-a",
		Temperature:       0.2,
	}).normalized()

	req := buildServiceGenerateRequest(command)
	if req.ConversationStage != WorkflowStagePlanApproved {
		t.Fatalf("expected service stage %q, got %q", WorkflowStagePlanApproved, req.ConversationStage)
	}
	if req.Mode != WorkflowModeImplement {
		t.Fatalf("expected service mode %q, got %q", WorkflowModeImplement, req.Mode)
	}
	if req.PlanContext != "plan-a" || req.Prompt != "继续实现" || req.ProjectID != "project-1" {
		t.Fatalf("expected core request fields to be preserved, got %+v", req)
	}
}

func TestBuildGenerationDoneStateIncludesProjectValidation(t *testing.T) {
	state := BuildEngineeringState(OrchestrationContext{
		WorkflowStage: WorkflowStageImplement,
		WorkflowMode:  WorkflowModeImplement,
	})

	doneState := buildGenerationDoneState(state)
	if doneState.Workflow.Status != EngineeringStatusPassed {
		t.Fatalf("expected workflow status %q, got %q", EngineeringStatusPassed, doneState.Workflow.Status)
	}
	if doneState.Execution.CurrentTask != "生成阶段完成" {
		t.Fatalf("expected generation done task, got %q", doneState.Execution.CurrentTask)
	}
	if doneState.Validation.Status != EngineeringStatusPassed {
		t.Fatalf("expected project validation status %q, got %q", EngineeringStatusPassed, doneState.Validation.Status)
	}
	if doneState.Execution.NextAction != "继续后续迭代" {
		t.Fatalf("expected iteration next action, got %q", doneState.Execution.NextAction)
	}

	step := buildGenerationWorkflowStageStep(
		GenerateCommand{Context: OrchestrationContext{WorkflowStage: WorkflowStageImplement, WorkflowMode: WorkflowModeImplement}},
		doneState,
		"orchestration:"+WorkflowStageImplement+":done",
		"生成阶段完成",
		"模型输出、项目级 Validation Gate、预览与版本快照已完成。",
		"done",
		nil,
	)
	assertStepEngineeringStatePhase(t, step, EngineeringStatusPassed)
}

func TestBuildPlanAnalysisDoneStateAwaitsSelection(t *testing.T) {
	command := GeneratePlansCommand{
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStagePlanAnalysis,
			WorkflowMode:  WorkflowModePlan,
		},
	}
	state := BuildEngineeringState(command.Context).
		withCurrentTask("分析需求并生成候选方案").
		withNextAction("等待候选方案生成完成")

	doneState := buildPlanAnalysisDoneState(state)
	if doneState.Workflow.Status != EngineeringStatusPassed {
		t.Fatalf("expected workflow status %q, got %q", EngineeringStatusPassed, doneState.Workflow.Status)
	}
	if doneState.Execution.CurrentTask != "方案生成完成" {
		t.Fatalf("expected plan done task, got %q", doneState.Execution.CurrentTask)
	}
	if doneState.Execution.NextAction != "等待用户选择方案或确认推荐方案" {
		t.Fatalf("expected plan selection next action, got %q", doneState.Execution.NextAction)
	}

	step := buildPlanAnalysisWorkflowStageStep(
		command,
		doneState,
		"orchestration:plan-analysis:done",
		"方案生成完成",
		"候选技术方案已生成，等待用户选择方案或确认推荐方案。",
		"done",
		nil,
	)
	assertStepEngineeringStatePhase(t, step, EngineeringStatusPassed)
}

func TestOrchestrationContextFromContext(t *testing.T) {
	expected := OrchestrationContext{
		WorkflowStage:    WorkflowStagePlanAnalysis,
		WorkflowMode:     WorkflowModePlan,
		RequestSource:    RequestSourceHTTP,
		ValidationGate:   "validate-before-preview",
		RuntimeProjectID: "project-1",
		RuntimeAppType:   "web",
		RuntimeProject:   "demo",
	}
	ctx := withOrchestrationContext(context.Background(), expected)

	actual, ok := OrchestrationContextFromContext(ctx)
	if !ok {
		t.Fatal("expected orchestration context to be attached")
	}
	if !reflect.DeepEqual(actual, expected) {
		t.Fatalf("expected %+v, got %+v", expected, actual)
	}
}

func TestBuildEngineeringState(t *testing.T) {
	state := BuildEngineeringState(OrchestrationContext{
		WorkflowStage:    WorkflowStageImplement,
		WorkflowMode:     WorkflowModeImplement,
		RequestSource:    RequestSourceHTTP,
		ValidationGate:   ValidationGateBeforePreview,
		RuntimeProjectID: "project-1",
		RuntimeAppType:   "web",
		RuntimeProject:   "demo",
	})

	if state.Workflow.Status != EngineeringStatusRunning {
		t.Fatalf("expected workflow status %q, got %q", EngineeringStatusRunning, state.Workflow.Status)
	}
	if state.Validation.Status != EngineeringStatusPending {
		t.Fatalf("expected validation status %q, got %q", EngineeringStatusPending, state.Validation.Status)
	}
	if state.Runtime.Status != EngineeringStatusPending {
		t.Fatalf("expected runtime status %q, got %q", EngineeringStatusPending, state.Runtime.Status)
	}
	if state.Execution.AutoProgressEnabled != true {
		t.Fatalf("expected execution auto progress enabled, got %v", state.Execution.AutoProgressEnabled)
	}
	if state.Execution.CurrentTask != "执行已批准计划" {
		t.Fatalf("expected current task %q, got %q", "执行已批准计划", state.Execution.CurrentTask)
	}
}

func TestBuildEngineeringStateWithoutValidationAndRuntime(t *testing.T) {
	state := BuildEngineeringState(OrchestrationContext{
		WorkflowStage: WorkflowStagePlanAnalysis,
		WorkflowMode:  WorkflowModePlan,
	})

	if state.Workflow.Status != EngineeringStatusRunning {
		t.Fatalf("expected workflow status %q, got %q", EngineeringStatusRunning, state.Workflow.Status)
	}
	if state.Validation.Status != EngineeringStatusNotApplicable {
		t.Fatalf("expected validation status %q, got %q", EngineeringStatusNotApplicable, state.Validation.Status)
	}
	if state.Runtime.Status != EngineeringStatusNotApplicable {
		t.Fatalf("expected runtime status %q, got %q", EngineeringStatusNotApplicable, state.Runtime.Status)
	}
}

func TestBuildEngineeringStatePlanSelectionAwaitsConfirmation(t *testing.T) {
	state := BuildEngineeringState(OrchestrationContext{
		WorkflowStage: "plan-selection",
		WorkflowMode:  "discuss",
	})

	if state.Execution.AwaitingConfirmation != true {
		t.Fatalf("expected awaiting confirmation, got %v", state.Execution.AwaitingConfirmation)
	}
	if state.Execution.PauseReason != "awaiting_plan_confirmation" {
		t.Fatalf("expected pause reason %q, got %q", "awaiting_plan_confirmation", state.Execution.PauseReason)
	}
	if state.Execution.ApprovalBoundary != "plan_selection" {
		t.Fatalf("expected approval boundary %q, got %q", "plan_selection", state.Execution.ApprovalBoundary)
	}
}

func TestBuildEngineeringStatePlanApprovedEnablesAutoProgress(t *testing.T) {
	state := BuildEngineeringState(OrchestrationContext{
		WorkflowStage: WorkflowStagePlanApproved,
		WorkflowMode:  WorkflowModeImplement,
	})

	if state.Execution.AutoProgressEnabled != true {
		t.Fatalf("expected auto progress enabled, got %v", state.Execution.AutoProgressEnabled)
	}
	if state.Execution.AwaitingConfirmation {
		t.Fatalf("expected awaiting confirmation to be false")
	}
	if state.Execution.ApprovalBoundary != "approved_plan" {
		t.Fatalf("expected approval boundary %q, got %q", "approved_plan", state.Execution.ApprovalBoundary)
	}
	if state.Execution.CurrentTask != "按已批准计划自动推进实现" {
		t.Fatalf("expected current task %q, got %q", "按已批准计划自动推进实现", state.Execution.CurrentTask)
	}
}

func TestBuildEngineeringStateBootstrapReviewIncludesFoundationState(t *testing.T) {
	state := BuildEngineeringState(OrchestrationContext{
		WorkflowStage: "bootstrap_review",
		WorkflowMode:  WorkflowModeDiscuss,
	})

	if state.BootstrapState == nil {
		t.Fatal("expected bootstrap state to be present")
	}
	if state.BootstrapState.SchemaVersion != "v1" {
		t.Fatalf("expected schema version %q, got %q", "v1", state.BootstrapState.SchemaVersion)
	}
	if state.BootstrapState.Status != "awaiting_confirmation" {
		t.Fatalf("expected bootstrap status %q, got %q", "awaiting_confirmation", state.BootstrapState.Status)
	}
	if state.BootstrapState.ApprovalRequired != true {
		t.Fatalf("expected approval required, got %v", state.BootstrapState.ApprovalRequired)
	}
	if state.Execution.AwaitingConfirmation != true {
		t.Fatalf("expected execution awaiting confirmation, got %v", state.Execution.AwaitingConfirmation)
	}
	if state.Execution.PauseReason != "awaiting_foundation_confirmation" {
		t.Fatalf("expected pause reason %q, got %q", "awaiting_foundation_confirmation", state.Execution.PauseReason)
	}
}

func TestBuildEngineeringStateStepIncludesEngineeringState(t *testing.T) {
	state := EngineeringState{
		Workflow: WorkflowState{
			Stage:  WorkflowStageImplement,
			Mode:   WorkflowModeImplement,
			Status: EngineeringStatusRunning,
		},
		Execution: ExecutionState{
			AutoProgressEnabled: true,
			CurrentTask:         "按已批准计划生成实现",
			NextAction:          "等待代码生成结果",
		},
	}

	payload := buildEngineeringStateStep(
		"orchestration:implement",
		"orchestration",
		"进入生成阶段",
		"按已批准计划生成实现",
		"running",
		state,
		map[string]interface{}{"workflow_stage": WorkflowStageImplement},
	)

	engineeringState := assertStepEngineeringStatePhase(t, payload, EngineeringStatusRunning)
	execution, ok := engineeringState["execution"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected execution payload, got %T", engineeringState["execution"])
	}
	if execution["current_task"] != "按已批准计划生成实现" {
		t.Fatalf("expected current_task %q, got %v", "按已批准计划生成实现", execution["current_task"])
	}
	phase := engineeringState["phase"].(map[string]interface{})
	if phase["current_phase"] != "实现阶段" {
		t.Fatalf("expected current_phase %q, got %v", "实现阶段", phase["current_phase"])
	}
	if phase["current_task"] != "按已批准计划生成实现" {
		t.Fatalf("expected phase current_task %q, got %v", "按已批准计划生成实现", phase["current_task"])
	}
	if phase["next_action"] != "等待代码生成结果" {
		t.Fatalf("expected phase next_action %q, got %v", "等待代码生成结果", phase["next_action"])
	}
}

func TestBuildEngineeringStateStepIncludesBootstrapState(t *testing.T) {
	state := EngineeringState{
		Workflow: WorkflowState{
			Stage:  "bootstrap_review",
			Mode:   WorkflowModeDiscuss,
			Status: EngineeringStatusRunning,
		},
		BootstrapState: &BootstrapState{
			SchemaVersion:    "v1",
			Status:           "awaiting_confirmation",
			ApprovalRequired: true,
			NextAction:       "确认前置设计决策后进入 Plan 阶段",
			GateResult: &BootstrapGateResult{
				Decision:   "warn",
				Reasons:    []string{"Project Foundation 等待确认"},
				NextAction: "确认前置设计决策后继续",
			},
		},
	}

	payload := buildEngineeringStateStep(
		"orchestration:bootstrap_review",
		"orchestration",
		"进入 Foundation 阶段",
		"等待确认前置设计决策",
		"running",
		state,
		nil,
	)

	engineeringState, ok := payload["engineeringState"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected engineeringState payload, got %T", payload["engineeringState"])
	}
	bootstrapState, ok := engineeringState["bootstrap_state"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected bootstrap_state payload, got %T", engineeringState["bootstrap_state"])
	}
	if bootstrapState["status"] != "awaiting_confirmation" {
		t.Fatalf("expected bootstrap status %q, got %v", "awaiting_confirmation", bootstrapState["status"])
	}
	gateResult, ok := bootstrapState["gate_result"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected gate_result payload, got %T", bootstrapState["gate_result"])
	}
	if gateResult["decision"] != "warn" {
		t.Fatalf("expected gate decision %q, got %v", "warn", gateResult["decision"])
	}
}

func TestEngineeringStateFromContext(t *testing.T) {
	expected := EngineeringState{
		Workflow: WorkflowState{
			Stage:  WorkflowStageImplement,
			Mode:   WorkflowModeImplement,
			Status: EngineeringStatusRunning,
		},
		Validation: ValidationState{
			Gate:   ValidationGateBeforePreview,
			Status: EngineeringStatusPending,
		},
		Runtime: RuntimeState{
			ProjectID:   "project-1",
			AppType:     "web",
			ProjectName: "demo",
			Status:      EngineeringStatusPending,
		},
	}
	ctx := withEngineeringState(context.Background(), expected)

	actual, ok := EngineeringStateFromContext(ctx)
	if !ok {
		t.Fatal("expected engineering state to be attached")
	}
	if !reflect.DeepEqual(actual, expected) {
		t.Fatalf("expected %+v, got %+v", expected, actual)
	}
}

func TestExecuteValidationGatePassed(t *testing.T) {
	runner := &stubValidationGateRunner{
		result: ValidationGateResult{Summary: "validation passed"},
	}
	recorderRepo := &stubChatMessageRepo{}
	recorder := NewChatMessageEngineeringStateRecorder(recorderRepo)
	var events []capturedStreamEvent
	ctx := withEngineeringState(context.Background(), EngineeringState{
		Workflow: WorkflowState{
			Stage:  WorkflowStageImplement,
			Mode:   WorkflowModeImplement,
			Status: EngineeringStatusRunning,
		},
		Validation: ValidationState{
			Gate:   ValidationGateBeforePreview,
			Status: EngineeringStatusPending,
		},
	})

	nextCtx, err := executeValidationGate(ctx, runner, recorder, GenerateCommand{
		ProjectID: "project-1",
		UserID:    "user-1",
		Model:     "test-model",
	}, newCapturedStreamHandler(&events))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(runner.gates) != 1 || runner.gates[0] != ValidationGateBeforePreview {
		t.Fatalf("expected gate %q to be executed, got %+v", ValidationGateBeforePreview, runner.gates)
	}

	state, ok := EngineeringStateFromContext(nextCtx)
	if !ok {
		t.Fatal("expected engineering state in context")
	}
	if state.Validation.Status != EngineeringStatusPassed {
		t.Fatalf("expected validation status %q, got %q", EngineeringStatusPassed, state.Validation.Status)
	}
	if state.Workflow.Status != EngineeringStatusPassed {
		t.Fatalf("expected workflow status %q, got %q", EngineeringStatusPassed, state.Workflow.Status)
	}
	assertCapturedStepEngineeringStatePhase(t, events, "validation:"+ValidationGateBeforePreview, "running", EngineeringStatusRunning)
	assertCapturedStepEngineeringStatePhase(t, events, "validation:"+ValidationGateBeforePreview, "done", EngineeringStatusPassed)
	if len(recorderRepo.messages) != 1 {
		t.Fatalf("expected 1 recorded message, got %d", len(recorderRepo.messages))
	}
	var recordedPayload map[string]interface{}
	if err := json.Unmarshal([]byte(recorderRepo.messages[0].Content), &recordedPayload); err != nil {
		t.Fatalf("expected recorded validation payload json, got %v", err)
	}
	assertStepEngineeringStatePhase(t, recordedPayload, EngineeringStatusPassed)
}

func TestExecuteValidationGateFailed(t *testing.T) {
	runner := &stubValidationGateRunner{
		result: ValidationGateResult{Output: "[YES] Running frontend type check...\nweb/src/app/page.tsx:10:5 error TS2322\n[YES] Validation failed."},
		err:    errors.New("exit status 1"),
	}
	recorderRepo := &stubChatMessageRepo{}
	recorder := NewChatMessageEngineeringStateRecorder(recorderRepo)
	var events []capturedStreamEvent
	ctx := withEngineeringState(context.Background(), EngineeringState{
		Workflow: WorkflowState{
			Stage:  WorkflowStageImplement,
			Mode:   WorkflowModeImplement,
			Status: EngineeringStatusRunning,
		},
		Validation: ValidationState{
			Gate:   ValidationGateBeforePreview,
			Status: EngineeringStatusPending,
		},
	})

	nextCtx, err := executeValidationGate(ctx, runner, recorder, GenerateCommand{
		ProjectID: "project-1",
		UserID:    "user-1",
		Model:     "test-model",
	}, newCapturedStreamHandler(&events))
	if err == nil || !isValidationGateError(err) {
		t.Fatalf("expected validation gate error, got %v", err)
	}

	state, ok := EngineeringStateFromContext(nextCtx)
	if !ok {
		t.Fatal("expected engineering state in context")
	}
	if state.Validation.Status != EngineeringStatusFailed {
		t.Fatalf("expected validation status %q, got %q", EngineeringStatusFailed, state.Validation.Status)
	}
	if state.Workflow.Status != EngineeringStatusFailed {
		t.Fatalf("expected workflow status %q, got %q", EngineeringStatusFailed, state.Workflow.Status)
	}
	if state.Execution.AwaitingConfirmation != true {
		t.Fatalf("expected awaiting confirmation after validation failure, got %v", state.Execution.AwaitingConfirmation)
	}
	if state.Execution.PauseReason != "validation_gate_blocked" {
		t.Fatalf("expected pause reason %q, got %q", "validation_gate_blocked", state.Execution.PauseReason)
	}
	if state.Execution.NextAction != "修复校验失败项后重试" {
		t.Fatalf("expected next action %q, got %q", "修复校验失败项后重试", state.Execution.NextAction)
	}
	if state.Recovery == nil {
		t.Fatal("expected recovery state after validation failure")
	}
	if state.Recovery.ReasonCode != "validation_gate_blocked" {
		t.Fatalf("expected recovery reason %q, got %q", "validation_gate_blocked", state.Recovery.ReasonCode)
	}
	if !state.Recovery.CanRetry {
		t.Fatal("expected validation recovery to be retryable")
	}
	if state.Recovery.RetryLabel != "修复后重跑校验" {
		t.Fatalf("expected retry label %q, got %q", "修复后重跑校验", state.Recovery.RetryLabel)
	}
	if len(state.Validation.FailureItems) == 0 {
		t.Fatal("expected validation failure items")
	}
	if state.Validation.FailureItems[0].Title != "前端类型检查失败" {
		t.Fatalf("expected frontend failure title, got %q", state.Validation.FailureItems[0].Title)
	}
	if state.Validation.FailureItems[0].FilePath != "src/app/page.tsx" {
		t.Fatalf("expected failure file path %q, got %q", "src/app/page.tsx", state.Validation.FailureItems[0].FilePath)
	}
	if state.Validation.FailureItems[0].LineNumber != 10 {
		t.Fatalf("expected failure line 10, got %d", state.Validation.FailureItems[0].LineNumber)
	}
	if state.Validation.FailureItems[0].Column != 5 {
		t.Fatalf("expected failure column 5, got %d", state.Validation.FailureItems[0].Column)
	}
	assertCapturedStepEngineeringStatePhase(t, events, "validation:"+ValidationGateBeforePreview, "running", EngineeringStatusRunning)
	assertCapturedStepEngineeringStatePhase(t, events, "validation:"+ValidationGateBeforePreview, "failed", EngineeringStatusFailed)
	if len(recorderRepo.messages) != 1 {
		t.Fatalf("expected 1 recorded message, got %d", len(recorderRepo.messages))
	}
	var recordedPayload map[string]interface{}
	if err := json.Unmarshal([]byte(recorderRepo.messages[0].Content), &recordedPayload); err != nil {
		t.Fatalf("expected recorded validation payload json, got %v", err)
	}
	recordedEngineeringState := assertStepEngineeringStatePhase(t, recordedPayload, EngineeringStatusFailed)
	if _, ok := recordedEngineeringState["recovery"].(map[string]interface{}); !ok {
		t.Fatalf("expected recorded validation recovery payload, got %T", recordedEngineeringState["recovery"])
	}
}

func TestExecuteValidationGateUnavailableEmitsFailedState(t *testing.T) {
	recorderRepo := &stubChatMessageRepo{}
	recorder := NewChatMessageEngineeringStateRecorder(recorderRepo)
	var events []capturedStreamEvent
	ctx := withEngineeringState(context.Background(), EngineeringState{
		Workflow: WorkflowState{
			Stage:  WorkflowStageImplement,
			Mode:   WorkflowModeImplement,
			Status: EngineeringStatusRunning,
		},
		Validation: ValidationState{
			Gate:   ValidationGateBeforePreview,
			Status: EngineeringStatusPending,
		},
	})

	nextCtx, err := executeValidationGate(ctx, nil, recorder, GenerateCommand{
		ProjectID: "project-1",
		UserID:    "user-1",
		Model:     "test-model",
	}, newCapturedStreamHandler(&events))
	if err == nil || !isValidationGateError(err) {
		t.Fatalf("expected validation gate error, got %v", err)
	}
	if !errors.Is(err, ErrValidationGateUnavailable) {
		t.Fatalf("expected validation gate unavailable cause, got %v", err)
	}

	state, ok := EngineeringStateFromContext(nextCtx)
	if !ok {
		t.Fatal("expected engineering state in context")
	}
	if state.Validation.Status != EngineeringStatusFailed {
		t.Fatalf("expected validation status %q, got %q", EngineeringStatusFailed, state.Validation.Status)
	}
	if state.Recovery == nil || state.Recovery.ReasonCode != "validation_gate_blocked" {
		t.Fatalf("expected validation recovery state, got %+v", state.Recovery)
	}
	if len(state.Validation.FailureItems) == 0 || state.Validation.FailureItems[0].Detail != ErrValidationGateUnavailable.Error() {
		t.Fatalf("expected validation unavailable failure item, got %+v", state.Validation.FailureItems)
	}
	assertCapturedStepEngineeringStatePhase(t, events, "validation:"+ValidationGateBeforePreview, "running", EngineeringStatusRunning)
	assertCapturedStepEngineeringStatePhase(t, events, "validation:"+ValidationGateBeforePreview, "failed", EngineeringStatusFailed)
	if len(recorderRepo.messages) != 1 {
		t.Fatalf("expected 1 recorded message, got %d", len(recorderRepo.messages))
	}
	var recordedPayload map[string]interface{}
	if err := json.Unmarshal([]byte(recorderRepo.messages[0].Content), &recordedPayload); err != nil {
		t.Fatalf("expected recorded validation payload json, got %v", err)
	}
	recordedEngineeringState := assertStepEngineeringStatePhase(t, recordedPayload, EngineeringStatusFailed)
	if _, ok := recordedEngineeringState["recovery"].(map[string]interface{}); !ok {
		t.Fatalf("expected recorded validation recovery payload, got %T", recordedEngineeringState["recovery"])
	}
}

func TestParseValidationFailureItemsFallsBackToSummary(t *testing.T) {
	items := parseValidationFailureItems(ValidationGateBeforePreview, "", "YES validation failed, preview remains blocked.", errors.New("exit status 1"))
	if len(items) != 1 {
		t.Fatalf("expected one fallback failure item, got %d", len(items))
	}
	if items[0].Title != "YES 校验未通过" {
		t.Fatalf("expected YES failure title, got %q", items[0].Title)
	}
	if items[0].Suggestion == "" {
		t.Fatal("expected fallback item suggestion")
	}
}

func TestParseValidationFailureItemsExtractsLineOnlyLocations(t *testing.T) {
	items := parseValidationFailureItems(
		ValidationGateBeforePreview,
		"backend/internal/service/project_test.go:42: expected ready state\nexit status 1",
		"YES validation failed, preview remains blocked.",
		errors.New("exit status 1"),
	)
	if len(items) == 0 {
		t.Fatal("expected validation failure items")
	}
	if items[0].FilePath != "backend/internal/service/project_test.go" {
		t.Fatalf("expected line-only failure path, got %q", items[0].FilePath)
	}
	if items[0].LineNumber != 42 {
		t.Fatalf("expected line-only failure line 42, got %d", items[0].LineNumber)
	}
	if items[0].Column != 0 {
		t.Fatalf("expected line-only failure column 0, got %d", items[0].Column)
	}
	if items[0].SearchText != "backend/internal/service/project_test.go:42: expected ready state" {
		t.Fatalf("expected search text to preserve failure line, got %q", items[0].SearchText)
	}
}

func TestEvaluateFoundationGateStateBlocksMissingBootstrapState(t *testing.T) {
	state, reasons := evaluateFoundationGateState(false, "")
	if len(reasons) == 0 {
		t.Fatal("expected foundation gate to block missing bootstrap state")
	}
	if state == nil || state.GateResult == nil || state.GateResult.Decision != "block" {
		t.Fatalf("expected blocked bootstrap gate result, got %+v", state)
	}
}

func TestEvaluateFoundationGateStateBlocksUnconfirmedMustDecideNow(t *testing.T) {
	content := `{
  "schema_version": "v1",
  "state": {
    "schema_version": "v1",
    "status": "awaiting_confirmation",
    "required_decisions": [
      {
        "id": "identity.auth_mode",
        "title": "身份认证方式",
        "bucket": "must_decide_now",
        "status": "recommended"
      }
    ],
    "blockers": ["must_decide_now 项待确认"]
  }
}`

	state, reasons := evaluateFoundationGateState(true, content)
	if len(reasons) == 0 {
		t.Fatal("expected unconfirmed foundation decisions to block")
	}
	if state == nil || state.GateResult == nil || state.GateResult.Decision != "block" {
		t.Fatalf("expected blocked bootstrap gate result, got %+v", state)
	}
	if !strings.Contains(strings.Join(reasons, "\n"), "身份认证方式") {
		t.Fatalf("expected decision title in reasons, got %+v", reasons)
	}
}

func TestEvaluateFoundationGateStateAllowsCompletedFoundation(t *testing.T) {
	content := `{
  "schema_version": "v1",
  "state": {
    "schema_version": "v1",
    "status": "completed",
    "required_decisions": [
      {
        "id": "identity.auth_mode",
        "title": "身份认证方式",
        "bucket": "must_decide_now",
        "status": "confirmed"
      },
      {
        "id": "tech_stack.runtime_profile",
        "title": "技术栈与运行时 Profile",
        "bucket": "must_decide_now",
        "status": "confirmed"
      },
      {
        "id": "architecture.boundary",
        "title": "架构边界",
        "bucket": "must_decide_now",
        "status": "confirmed"
      },
      {
        "id": "project.directory_structure",
        "title": "目录结构与工件命名空间",
        "bucket": "must_decide_now",
        "status": "confirmed"
      },
      {
        "id": "api.interface_contract",
        "title": "接口契约与错误模型",
        "bucket": "must_decide_now",
        "status": "confirmed"
      },
      {
        "id": "data.model_strategy",
        "title": "数据模型与持久化策略",
        "bucket": "must_decide_now",
        "status": "confirmed"
      }
    ],
    "gate_result": {
      "decision": "allow",
      "reasons": ["Project Foundation 已确认"]
    }
  }
}`

	state, reasons := evaluateFoundationGateState(true, content)
	if len(reasons) != 0 {
		t.Fatalf("expected completed foundation to pass, got %+v", reasons)
	}
	if state == nil || state.Status != "completed" {
		t.Fatalf("expected completed bootstrap state, got %+v", state)
	}
	if state.DesignReadiness == nil || state.DesignReadiness.Status != "ready" {
		t.Fatalf("expected ready design readiness, got %+v", state.DesignReadiness)
	}
}

func TestEvaluateFoundationGateStateBlocksMissingDesignReadiness(t *testing.T) {
	content := `{
  "schema_version": "v1",
  "state": {
    "schema_version": "v1",
    "status": "completed",
    "required_decisions": [
      {
        "id": "identity.auth_mode",
        "title": "身份认证方式",
        "bucket": "must_decide_now",
        "status": "confirmed"
      }
    ],
    "gate_result": {
      "decision": "allow",
      "reasons": ["Project Foundation 已确认"]
    }
  }
}`

	state, reasons := evaluateFoundationGateState(true, content)
	if len(reasons) == 0 {
		t.Fatal("expected missing design readiness to block")
	}
	if state == nil || state.DesignReadiness == nil || state.DesignReadiness.Status != "blocked" {
		t.Fatalf("expected blocked design readiness, got %+v", state)
	}
	if !strings.Contains(strings.Join(reasons, "\n"), "生成前设计 readiness 未完成") {
		t.Fatalf("expected design readiness blocker, got %+v", reasons)
	}
}

func TestChatMessageEngineeringStateRecorder(t *testing.T) {
	repo := &stubChatMessageRepo{}
	stateRepo := &stubEngineeringStateRepo{}
	recorder := NewChatMessageEngineeringStateRecorder(repo, stateRepo)
	step := map[string]interface{}{
		"id":     "validation:" + ValidationGateBeforePreview,
		"kind":   "run_command",
		"title":  "运行 YES 最小验证",
		"detail": "validation passed",
		"status": "done",
	}

	err := recorder.RecordValidationState(context.Background(), engineeringStateRecordParams{
		ProjectID: "project-1",
		UserID:    "user-1",
		Model:     "test-model",
		State: EngineeringState{
			Validation: ValidationState{
				Gate:   ValidationGateBeforePreview,
				Status: EngineeringStatusPassed,
			},
		},
		Step:    step,
		Content: "validation passed",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(repo.messages) != 1 {
		t.Fatalf("expected 1 recorded message, got %d", len(repo.messages))
	}

	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(repo.messages[0].Content), &payload); err != nil {
		t.Fatalf("expected valid json payload, got %v", err)
	}
	if payload["kind"] != "workflow" {
		t.Fatalf("expected workflow kind, got %v", payload["kind"])
	}
	engineeringState, ok := payload["engineeringState"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected engineeringState payload, got %T", payload["engineeringState"])
	}
	validation, ok := engineeringState["validation"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected validation payload, got %T", engineeringState["validation"])
	}
	if validation["status"] != EngineeringStatusPassed {
		t.Fatalf("expected validation status %q, got %v", EngineeringStatusPassed, validation["status"])
	}
	execution, ok := engineeringState["execution"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected execution payload, got %T", engineeringState["execution"])
	}
	if execution["auto_progress_enabled"] != false {
		t.Fatalf("expected auto_progress_enabled=false, got %v", execution["auto_progress_enabled"])
	}
	if stateRepo.state == nil {
		t.Fatal("expected project engineering state snapshot")
	}
	if stateRepo.state.ProjectID != "project-1" {
		t.Fatalf("expected project id project-1, got %q", stateRepo.state.ProjectID)
	}
	if stateRepo.state.WorkflowStatus != "" {
		t.Fatalf("expected empty workflow status for validation-only state, got %q", stateRepo.state.WorkflowStatus)
	}
	var tableState map[string]interface{}
	if err := json.Unmarshal([]byte(stateRepo.state.State), &tableState); err != nil {
		t.Fatalf("expected table state json, got %v", err)
	}
	if _, ok := tableState["validation"].(map[string]interface{}); !ok {
		t.Fatalf("expected validation snapshot in table state, got %T", tableState["validation"])
	}

	bootstrapStep := map[string]interface{}{
		"id":     "bootstrap:state_recorded",
		"kind":   "bootstrap_state_recorded",
		"title":  "记录 Project Foundation 状态",
		"detail": "Project Foundation 已确认",
		"status": "done",
	}
	err = recorder.RecordEngineeringState(context.Background(), engineeringStateRecordParams{
		ProjectID: "project-1",
		UserID:    "user-1",
		Model:     "test-model",
		State: EngineeringState{
			Workflow: WorkflowState{
				Stage:  WorkflowStageBootstrapConfirmed,
				Mode:   WorkflowModeFoundation,
				Status: EngineeringStatusRunning,
			},
			BootstrapState: &BootstrapState{
				SchemaVersion: "v1",
				Status:        "completed",
				TemplateID:    "ai_agent_platform",
				ProjectType:   "ai_agent_platform",
				GateResult: &BootstrapGateResult{
					Decision:   "allow",
					Reasons:    []string{"Project Foundation 已确认"},
					NextAction: "继续进入 Plan 阶段",
				},
			},
		},
		Step:    bootstrapStep,
		Content: "Project Foundation 已确认",
	})
	if err != nil {
		t.Fatalf("expected no error recording bootstrap state, got %v", err)
	}
	if len(repo.messages) != 2 {
		t.Fatalf("expected 2 recorded messages, got %d", len(repo.messages))
	}

	var bootstrapPayload map[string]interface{}
	if err := json.Unmarshal([]byte(repo.messages[1].Content), &bootstrapPayload); err != nil {
		t.Fatalf("expected valid bootstrap json payload, got %v", err)
	}
	if bootstrapPayload["statusContent"] != "Project Foundation: completed" {
		t.Fatalf("expected foundation status content, got %v", bootstrapPayload["statusContent"])
	}
	bootstrapEngineeringState, ok := bootstrapPayload["engineeringState"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected bootstrap engineeringState payload, got %T", bootstrapPayload["engineeringState"])
	}
	bootstrapState, ok := bootstrapEngineeringState["bootstrap_state"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected bootstrap_state payload, got %T", bootstrapEngineeringState["bootstrap_state"])
	}
	if bootstrapState["status"] != "completed" {
		t.Fatalf("expected completed bootstrap status, got %v", bootstrapState["status"])
	}
	if bootstrapState["template_id"] != "ai_agent_platform" {
		t.Fatalf("expected template id, got %v", bootstrapState["template_id"])
	}
}

func TestChatMessageEngineeringStateRecorderRecordsWorkflowStep(t *testing.T) {
	repo := &stubChatMessageRepo{}
	recorder := NewChatMessageEngineeringStateRecorder(repo)

	err := recorder.RecordWorkflowStep(context.Background(), workflowStepRecordParams{
		ProjectID:     "project-1",
		UserID:        "user-1",
		Model:         "test-model",
		WorkflowStage: WorkflowStagePlanApproved,
		WorkflowMode:  WorkflowModeImplement,
		Step: map[string]interface{}{
			"id":     "generate-content",
			"kind":   "status_update",
			"title":  "生成回复与代码",
			"detail": "模型开始流式输出实现结果。",
			"status": "running",
		},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(repo.messages) != 1 {
		t.Fatalf("expected 1 recorded workflow step message, got %d", len(repo.messages))
	}
	if repo.messages[0].Role != "assistant" {
		t.Fatalf("expected assistant role, got %q", repo.messages[0].Role)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(repo.messages[0].Content), &payload); err != nil {
		t.Fatalf("expected valid workflow json payload, got %v", err)
	}
	if payload["kind"] != "workflow" {
		t.Fatalf("expected workflow kind, got %v", payload["kind"])
	}
	if payload["content"] != "模型开始流式输出实现结果。" {
		t.Fatalf("expected step detail as content, got %v", payload["content"])
	}
	if payload["statusContent"] != "生成回复与代码: running" {
		t.Fatalf("expected step status content, got %v", payload["statusContent"])
	}
	steps, ok := payload["workflowSteps"].([]interface{})
	if !ok || len(steps) != 1 {
		t.Fatalf("expected one workflow step, got %#v", payload["workflowSteps"])
	}
	step, ok := steps[0].(map[string]interface{})
	if !ok {
		t.Fatalf("expected workflow step object, got %T", steps[0])
	}
	meta, ok := step["meta"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected workflow meta, got %T", step["meta"])
	}
	if meta["workflow_stage"] != WorkflowStagePlanApproved {
		t.Fatalf("expected workflow stage meta, got %#v", meta)
	}
	if meta["workflow_mode"] != WorkflowModeImplement {
		t.Fatalf("expected workflow mode meta, got %#v", meta)
	}
}

func TestWrapGenerationWorkflowStepRecorderPersistsAndForwardsStepEvents(t *testing.T) {
	repo := &stubChatMessageRepo{}
	recorder := NewChatMessageEngineeringStateRecorder(repo)
	command := GenerateCommand{
		ProjectID: "project-1",
		UserID:    "user-1",
		Model:     "test-model",
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageImplement,
			WorkflowMode:  WorkflowModeImplement,
		},
	}
	var events []capturedStreamEvent
	handler := wrapGenerationWorkflowStepRecorder(context.Background(), recorder, command, newCapturedStreamHandler(&events))

	if err := handler(service.StreamEventProgress, map[string]interface{}{"message": "正在生成代码..."}); err != nil {
		t.Fatalf("expected progress forwarding, got %v", err)
	}
	if len(repo.messages) != 0 {
		t.Fatalf("expected non-step event not to persist, got %d messages", len(repo.messages))
	}

	if err := handler(service.StreamEventStep, map[string]interface{}{
		"id":     "prepare-runtime",
		"kind":   "run_command",
		"title":  "检查开发环境",
		"detail": "运行时环境已就绪。",
		"status": "done",
	}); err != nil {
		t.Fatalf("expected step forwarding, got %v", err)
	}
	if len(events) != 2 {
		t.Fatalf("expected forwarded events, got %d", len(events))
	}
	if events[1].name != "step" {
		t.Fatalf("expected forwarded step event, got %q", events[1].name)
	}
	if len(repo.messages) != 1 {
		t.Fatalf("expected one persisted step message, got %d", len(repo.messages))
	}
}

func TestGenerateCommandNormalizedValidationGateFeedsEngineeringState(t *testing.T) {
	command := (GenerateCommand{
		ProjectID:   "project-1",
		AppType:     "web",
		ProjectName: "demo",
	}).normalized()
	state := BuildEngineeringState(command.Context)

	if state.Validation.Gate != ValidationGateBeforePreview {
		t.Fatalf("expected validation gate %q, got %q", ValidationGateBeforePreview, state.Validation.Gate)
	}
	if state.Validation.Status != EngineeringStatusPending {
		t.Fatalf("expected validation status %q, got %q", EngineeringStatusPending, state.Validation.Status)
	}
}

func TestCapabilityCatalogDefinitionsCoverCoreCapabilities(t *testing.T) {
	definitions := CapabilityCatalogDefinitions()
	expectedCapabilities := map[string]struct {
		provider string
		required bool
	}{
		CapabilityOrchestrationContext:        {provider: CapabilityProviderInternal, required: true},
		CapabilityEngineeringStateSnapshot:    {provider: CapabilityProviderInternal, required: true},
		CapabilityFoundationDecisionSynthesis: {provider: CapabilityProviderInternal, required: true},
		CapabilityPlanOptionSynthesis:         {provider: CapabilityProviderInternal, required: true},
		CapabilityGenerationContentStream:     {provider: CapabilityProviderInternal, required: true},
		CapabilityValidationBeforePreview:     {provider: CapabilityProviderInternal, required: true},
		CapabilityDiscussionResponse:          {provider: CapabilityProviderInternal, required: true},
		CapabilitySkillContractDryRun:         {provider: CapabilityProviderSkill, required: true},
		CapabilityMCPContractDryRun:           {provider: CapabilityProviderMCP, required: true},
		CapabilityOnlineContextSearchCrawl:    {provider: CapabilityProviderMCP, required: false},
	}

	for capabilityID, expected := range expectedCapabilities {
		found := false
		for _, definition := range definitions {
			if definition.ID != capabilityID {
				continue
			}
			found = true
			if definition.Provider != expected.provider {
				t.Fatalf("expected provider %q for capability %q, got %q", expected.provider, capabilityID, definition.Provider)
			}
			if definition.Required != expected.required {
				t.Fatalf("expected required=%v for capability %q, got %v", expected.required, capabilityID, definition.Required)
			}
			if strings.TrimSpace(definition.Name) == "" {
				t.Fatalf("expected capability %q to have name", capabilityID)
			}
			if strings.TrimSpace(definition.Purpose) == "" {
				t.Fatalf("expected capability %q to have purpose", capabilityID)
			}
			if strings.TrimSpace(definition.SourceNote) == "" {
				t.Fatalf("expected capability %q to have source note", capabilityID)
			}
		}
		if !found {
			t.Fatalf("expected capability catalog definition for %q", capabilityID)
		}
	}
}

func TestResolveCapabilityContextForImplementation(t *testing.T) {
	command := (GenerateCommand{
		ProjectID: "project-1",
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageImplement,
			WorkflowMode:  WorkflowModeImplement,
		},
	}).normalized()

	capabilityContext := ResolveCapabilityContext(command.Context)
	if capabilityContext.Profile != "implementation-capability-profile" {
		t.Fatalf("expected implementation capability profile, got %q", capabilityContext.Profile)
	}

	foundGeneration := false
	foundValidation := false
	for _, capability := range capabilityContext.Capabilities {
		if capability.ID == CapabilityGenerationContentStream && capability.Provider == CapabilityProviderInternal && capability.Required {
			foundGeneration = true
		}
		if capability.ID == CapabilityValidationBeforePreview && capability.Provider == CapabilityProviderInternal && capability.Required {
			foundValidation = true
		}
		if strings.TrimSpace(capability.SourceNote) == "" {
			t.Fatalf("expected capability source note for %+v", capability)
		}
	}
	if !foundGeneration {
		t.Fatal("expected generation content capability")
	}
	if !foundValidation {
		t.Fatal("expected validation capability")
	}

	resolution := NewDefaultCapabilityProviderRegistry().Resolve(capabilityContext)
	if resolution.Status != CapabilityResolutionStatusResolved {
		t.Fatalf("expected resolved capability resolution, got %q", resolution.Status)
	}
	if len(resolution.Items) != len(capabilityContext.Capabilities) {
		t.Fatalf("expected %d resolution items, got %d", len(capabilityContext.Capabilities), len(resolution.Items))
	}
	foundInternalProvider := false
	for _, provider := range resolution.Providers {
		if provider.ID == CapabilityProviderInternal && provider.Enabled {
			foundInternalProvider = true
		}
	}
	if !foundInternalProvider {
		t.Fatal("expected enabled internal provider")
	}

	audit := BuildCapabilityExecutionAudit(resolution)
	if audit.Status != CapabilityExecutionStatusDeferred {
		t.Fatalf("expected deferred execution audit, got %q", audit.Status)
	}
	if len(audit.Items) != len(resolution.Items) {
		t.Fatalf("expected %d audit items, got %d", len(resolution.Items), len(audit.Items))
	}
	if audit.Items[0].Status != CapabilityExecutionStatusDeferred {
		t.Fatalf("expected deferred audit item, got %q", audit.Items[0].Status)
	}
	for _, item := range audit.Items {
		if strings.TrimSpace(item.CapabilityVersion) == "" {
			t.Fatalf("expected audit item capability version for %+v", item)
		}
		if strings.TrimSpace(item.CapabilityCatalogSource) == "" {
			t.Fatalf("expected audit item capability catalog source for %+v", item)
		}
		if strings.TrimSpace(item.ProviderResolutionStatus) == "" {
			t.Fatalf("expected audit item provider resolution status for %+v", item)
		}
	}
	result := NoopCapabilityExecutor{}.Execute(context.Background(), audit)
	if result.Status != CapabilityExecutionResultStatusDeferred {
		t.Fatalf("expected deferred execution result, got %q", result.Status)
	}
	if len(result.Items) != len(audit.Items) {
		t.Fatalf("expected %d execution result items, got %d", len(audit.Items), len(result.Items))
	}
}

func TestResolveCapabilityContextAddsSkillDryRunCapabilityForProfile(t *testing.T) {
	capabilityContext := ResolveCapabilityContext(OrchestrationContext{
		WorkflowStage:     WorkflowStageImplement,
		WorkflowMode:      WorkflowModeImplement,
		CapabilityProfile: CapabilityProfileImplementationSkillDryRun,
	})

	foundSkillDryRun := false
	for _, capability := range capabilityContext.Capabilities {
		if capability.ID == CapabilitySkillContractDryRun && capability.Provider == CapabilityProviderSkill && capability.Required {
			foundSkillDryRun = true
		}
	}
	if !foundSkillDryRun {
		t.Fatal("expected skill dry-run capability for explicit capability profile")
	}

	resolution := NewDefaultCapabilityProviderRegistry().Resolve(capabilityContext)
	if resolution.Status != CapabilityResolutionStatusBlocked {
		t.Fatalf("expected disabled default skill provider to block dry-run profile, got %q", resolution.Status)
	}
}

func TestCapabilityProviderRegistryBlocksDisabledProvider(t *testing.T) {
	resolution := NewDefaultCapabilityProviderRegistry().Resolve(CapabilityContext{
		Profile:      "test-skill-profile",
		WorkflowMode: WorkflowModeImplement,
		Capabilities: []CapabilityDescriptor{
			{
				ID:         "skill.example",
				Name:       "示例 Skill",
				Provider:   CapabilityProviderSkill,
				Purpose:    "验证禁用 provider 的阻断语义",
				Version:    "v1",
				Required:   true,
				SourceNote: "测试构造的 skill 能力。",
			},
		},
	})

	if resolution.Status != CapabilityResolutionStatusBlocked {
		t.Fatalf("expected blocked capability resolution, got %q", resolution.Status)
	}
	if len(resolution.Items) != 1 {
		t.Fatalf("expected 1 resolution item, got %d", len(resolution.Items))
	}
	if resolution.Items[0].Status != CapabilityResolutionStatusBlocked {
		t.Fatalf("expected blocked resolution item, got %q", resolution.Items[0].Status)
	}
	if strings.TrimSpace(resolution.Items[0].SourceNote) == "" {
		t.Fatal("expected blocked resolution source note")
	}
	audit := BuildCapabilityExecutionAudit(resolution)
	if audit.Status != CapabilityExecutionStatusBlocked {
		t.Fatalf("expected blocked execution audit, got %q", audit.Status)
	}
	if audit.Items[0].ReasonCode != "provider_unavailable" {
		t.Fatalf("expected provider_unavailable reason, got %q", audit.Items[0].ReasonCode)
	}
	result := NoopCapabilityExecutor{}.Execute(context.Background(), audit)
	if result.Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected blocked execution result, got %q", result.Status)
	}
	if result.Items[0].Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected blocked execution result item, got %q", result.Items[0].Status)
	}
}

func TestCapabilityProviderRegistryResolvesEnabledProvider(t *testing.T) {
	resolution := NewCapabilityProviderRegistry(CapabilityProviderRegistryOptions{
		EnableSkillProvider: true,
		SourceNote:          "测试配置启用 Skill provider。",
	}).Resolve(CapabilityContext{
		Profile:      "test-skill-profile",
		WorkflowMode: WorkflowModeImplement,
		Capabilities: []CapabilityDescriptor{
			{
				ID:         "skill.example",
				Name:       "示例 Skill",
				Provider:   CapabilityProviderSkill,
				Purpose:    "验证启用 provider 的解析语义",
				Version:    "v1",
				Required:   true,
				SourceNote: "测试构造的 skill 能力。",
			},
		},
	})

	if resolution.Status != CapabilityResolutionStatusResolved {
		t.Fatalf("expected resolved capability resolution, got %q", resolution.Status)
	}
	if len(resolution.Items) != 1 {
		t.Fatalf("expected 1 resolution item, got %d", len(resolution.Items))
	}
	if resolution.Items[0].Status != CapabilityResolutionStatusResolved {
		t.Fatalf("expected resolved resolution item, got %q", resolution.Items[0].Status)
	}
	audit := BuildCapabilityExecutionAudit(resolution)
	if audit.Status != CapabilityExecutionStatusDeferred {
		t.Fatalf("expected deferred execution audit before runner execution, got %q", audit.Status)
	}
	if audit.Items[0].Status != CapabilityExecutionStatusDeferred {
		t.Fatalf("expected deferred execution audit item before runner execution, got %q", audit.Items[0].Status)
	}
	if audit.Items[0].ReasonCode != "external_provider_ready_for_execution" {
		t.Fatalf("expected ready-for-execution reason before runner execution, got %q", audit.Items[0].ReasonCode)
	}
}

func TestPlanOrchestratorGeneratePlansStreamRequiresDescription(t *testing.T) {
	orchestrator := NewPlanOrchestrator(&service.PlanService{})

	_, _, err := orchestrator.GeneratePlansStream(context.Background(), GeneratePlansCommand{}, nil)
	if !errors.Is(err, ErrDescriptionRequired) {
		t.Fatalf("expected %v, got %v", ErrDescriptionRequired, err)
	}
}

func TestPlanOrchestratorGeneratePlansStreamBlocksMissingFoundation(t *testing.T) {
	orchestrator := NewPlanOrchestrator(&service.PlanService{}, &stubProjectArtifactLoader{})
	var events []capturedStreamEvent

	_, _, err := orchestrator.GeneratePlansStream(context.Background(), GeneratePlansCommand{
		ProjectID:   "project-1",
		Description: "构建 AI 工作台",
		AppType:     "ai",
	}, newCapturedStreamHandler(&events))
	if err == nil || !isFoundationGateError(err) {
		t.Fatalf("expected foundation gate error, got %v", err)
	}

	var foundationErr *FoundationGateError
	if !errors.As(err, &foundationErr) {
		t.Fatalf("expected foundation gate error, got %T", err)
	}
	if foundationErr.Gate != FoundationGateBeforePlan {
		t.Fatalf("expected gate %q, got %q", FoundationGateBeforePlan, foundationErr.Gate)
	}
	if foundationErr.State.Execution.PauseReason != "foundation_gate_blocked" {
		t.Fatalf("expected pause reason %q, got %q", "foundation_gate_blocked", foundationErr.State.Execution.PauseReason)
	}
	if foundationErr.State.Recovery == nil || foundationErr.State.Recovery.ResumeMode != WorkflowModeFoundation {
		t.Fatalf("expected foundation recovery state, got %+v", foundationErr.State.Recovery)
	}
	engineeringState := assertCapturedStepEngineeringStatePhase(t, events, "foundation:"+FoundationGateBeforePlan, "failed", EngineeringStatusFailed)
	if _, ok := engineeringState["recovery"].(map[string]interface{}); !ok {
		t.Fatalf("expected foundation gate recovery payload, got %T", engineeringState["recovery"])
	}
}

func TestPlanOrchestratorGeneratePlansStreamSurfacesFoundationArtifactReadFailure(t *testing.T) {
	orchestrator := NewPlanOrchestrator(&service.PlanService{}, &stubProjectArtifactLoader{err: errors.New("artifact store unavailable")})
	var events []capturedStreamEvent

	_, _, err := orchestrator.GeneratePlansStream(context.Background(), GeneratePlansCommand{
		ProjectID:   "project-1",
		Description: "构建 AI 工作台",
		AppType:     "ai",
	}, newCapturedStreamHandler(&events))
	if err == nil || !isFoundationGateError(err) {
		t.Fatalf("expected foundation gate error, got %v", err)
	}

	var foundationErr *FoundationGateError
	if !errors.As(err, &foundationErr) {
		t.Fatalf("expected foundation gate error, got %T", err)
	}
	if foundationErr.Gate != FoundationGateBeforePlan {
		t.Fatalf("expected gate %q, got %q", FoundationGateBeforePlan, foundationErr.Gate)
	}
	if foundationErr.State.BootstrapState == nil || !strings.Contains(strings.Join(foundationErr.State.BootstrapState.Blockers, "；"), service.ProjectBootstrapStatePath+" 读取失败") {
		t.Fatalf("expected bootstrap read failure blocker, got %+v", foundationErr.State.BootstrapState)
	}
	engineeringState := assertCapturedStepEngineeringStatePhase(t, events, "foundation:"+FoundationGateBeforePlan, "failed", EngineeringStatusFailed)
	recovery, ok := engineeringState["recovery"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected foundation gate recovery payload, got %T", engineeringState["recovery"])
	}
	if recovery["reason_code"] != "foundation_gate_blocked" {
		t.Fatalf("expected foundation gate recovery reason, got %#v", recovery)
	}
}

func TestExecuteFoundationGateBeforeImplementEmitsFailedState(t *testing.T) {
	var events []capturedStreamEvent
	command := GenerateCommand{
		ProjectID: "project-1",
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageImplement,
			WorkflowMode:  WorkflowModeImplement,
		},
	}
	state := BuildEngineeringState(command.Context)

	nextCtx, err := executeFoundationGate(
		context.Background(),
		command,
		&stubProjectArtifactLoader{},
		state,
		newCapturedStreamHandler(&events),
	)
	if err == nil || !isFoundationGateError(err) {
		t.Fatalf("expected foundation gate error, got %v", err)
	}

	var foundationErr *FoundationGateError
	if !errors.As(err, &foundationErr) {
		t.Fatalf("expected foundation gate error, got %T", err)
	}
	if foundationErr.Gate != FoundationGateBeforeImplement {
		t.Fatalf("expected gate %q, got %q", FoundationGateBeforeImplement, foundationErr.Gate)
	}
	if contextState, ok := EngineeringStateFromContext(nextCtx); !ok || contextState.Workflow.Status != EngineeringStatusFailed {
		t.Fatalf("expected failed engineering state in context, got %+v", contextState)
	}
	engineeringState := assertCapturedStepEngineeringStatePhase(t, events, "foundation:"+FoundationGateBeforeImplement, "failed", EngineeringStatusFailed)
	if _, ok := engineeringState["recovery"].(map[string]interface{}); !ok {
		t.Fatalf("expected foundation gate recovery payload, got %T", engineeringState["recovery"])
	}
}

func TestExecuteFoundationGateBeforeImplementSurfacesArtifactReadFailure(t *testing.T) {
	var events []capturedStreamEvent
	command := GenerateCommand{
		ProjectID: "project-1",
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageImplement,
			WorkflowMode:  WorkflowModeImplement,
		},
	}
	state := BuildEngineeringState(command.Context)

	nextCtx, err := executeFoundationGate(
		context.Background(),
		command,
		&stubProjectArtifactLoader{err: errors.New("artifact store unavailable")},
		state,
		newCapturedStreamHandler(&events),
	)
	if err == nil || !isFoundationGateError(err) {
		t.Fatalf("expected foundation gate error, got %v", err)
	}

	var foundationErr *FoundationGateError
	if !errors.As(err, &foundationErr) {
		t.Fatalf("expected foundation gate error, got %T", err)
	}
	if foundationErr.Gate != FoundationGateBeforeImplement {
		t.Fatalf("expected gate %q, got %q", FoundationGateBeforeImplement, foundationErr.Gate)
	}
	if contextState, ok := EngineeringStateFromContext(nextCtx); !ok || contextState.Workflow.Status != EngineeringStatusFailed {
		t.Fatalf("expected failed engineering state in context, got %+v", contextState)
	}
	if foundationErr.State.BootstrapState == nil || !strings.Contains(strings.Join(foundationErr.State.BootstrapState.Blockers, "；"), service.ProjectBootstrapStatePath+" 读取失败") {
		t.Fatalf("expected bootstrap read failure blocker, got %+v", foundationErr.State.BootstrapState)
	}
	engineeringState := assertCapturedStepEngineeringStatePhase(t, events, "foundation:"+FoundationGateBeforeImplement, "failed", EngineeringStatusFailed)
	recovery, ok := engineeringState["recovery"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected foundation gate recovery payload, got %T", engineeringState["recovery"])
	}
	if recovery["reason_code"] != "foundation_gate_blocked" {
		t.Fatalf("expected foundation gate recovery reason, got %#v", recovery)
	}
}

func TestPersistBootstrapWorkflowStateSurfacesArtifactPersistenceFailure(t *testing.T) {
	var events []capturedStreamEvent
	orchestrator := NewGenerateOrchestrator(
		service.NewGeneratorService(service.GeneratorServiceOptions{}),
		nil,
		nil,
		nil,
	)

	err := orchestrator.persistBootstrapWorkflowState(context.Background(), GenerateCommand{
		ProjectID: "proj_bootstrap_artifact_unavailable",
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageBootstrapConfirmed,
			WorkflowMode:  WorkflowModeFoundation,
		},
	}, newCapturedStreamHandler(&events))

	if err == nil {
		t.Fatal("expected bootstrap persistence error")
	}
	var payload map[string]interface{}
	for _, event := range events {
		if event.name != service.StreamEventStep {
			continue
		}
		candidate, _ := event.payload.(map[string]interface{})
		if candidate["id"] == "bootstrap:state_persistence" {
			payload = candidate
			break
		}
	}
	if payload == nil {
		t.Fatalf("expected bootstrap persistence failed step, got %#v", events)
	}
	if payload["status"] != "failed" {
		t.Fatalf("expected failed bootstrap persistence status, got %#v", payload)
	}
	meta, _ := payload["meta"].(map[string]interface{})
	if meta["event_name"] != "bootstrap_state_persistence_failed" || meta["file_path"] != service.ProjectBootstrapStatePath {
		t.Fatalf("expected bootstrap persistence failure metadata, got %#v", meta)
	}
}

func TestPlanOrchestratorGeneratePlansStreamEmitsFailedStageEvent(t *testing.T) {
	orchestrator := NewPlanOrchestrator(&service.PlanService{})
	var events []capturedStreamEvent

	_, _, err := orchestrator.GeneratePlansStream(context.Background(), GeneratePlansCommand{
		Description: "构建 AI 工作台",
		AppType:     "ai",
	}, newCapturedStreamHandler(&events))
	if err == nil {
		t.Fatal("expected plan generation error")
	}

	foundFailedEvent := false
	for _, event := range events {
		if event.name != "step" {
			continue
		}
		payload, ok := event.payload.(map[string]interface{})
		if !ok {
			t.Fatalf("expected step payload map, got %T", event.payload)
		}
		if payload["id"] == "orchestration:plan-analysis:failed" && payload["status"] == "failed" {
			assertCapturedStepEngineeringStatePhase(t, events, "orchestration:plan-analysis", "running", EngineeringStatusRunning)
			engineeringState := assertCapturedStepEngineeringStatePhase(t, events, "orchestration:plan-analysis:failed", "failed", EngineeringStatusFailed)
			recovery, ok := engineeringState["recovery"].(map[string]interface{})
			if !ok {
				t.Fatalf("expected plan analysis recovery payload, got %T", engineeringState["recovery"])
			}
			if recovery["reason_code"] != "plan_generation_failed" {
				t.Fatalf("expected plan generation failed recovery reason, got %#v", recovery)
			}
			foundFailedEvent = true
		}
	}
	if !foundFailedEvent {
		t.Fatal("expected failed plan orchestration step event")
	}
}

func TestPlanOrchestratorUnavailableEmitsFailedPlanAnalysisState(t *testing.T) {
	orchestrator := NewPlanOrchestrator(nil)
	var events []capturedStreamEvent

	_, _, err := orchestrator.GeneratePlansStream(context.Background(), GeneratePlansCommand{
		Description: "构建 AI 工作台",
		AppType:     "ai",
	}, newCapturedStreamHandler(&events))
	if !errors.Is(err, ErrPlanOrchestrationUnavailable) {
		t.Fatalf("expected plan orchestration unavailable error, got %v", err)
	}

	runningState := assertCapturedStepEngineeringStatePhase(t, events, "orchestration:plan-analysis", "running", EngineeringStatusRunning)
	if _, ok := runningState["recovery"].(map[string]interface{}); ok {
		t.Fatalf("expected running plan analysis state without recovery, got %#v", runningState["recovery"])
	}
	failedState := assertCapturedStepEngineeringStatePhase(t, events, "orchestration:plan-analysis:failed", "failed", EngineeringStatusFailed)
	recovery, ok := failedState["recovery"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected plan unavailable recovery payload, got %T", failedState["recovery"])
	}
	if recovery["reason_code"] != "plan_generation_failed" || recovery["retry_label"] != "修复后重试方案生成" {
		t.Fatalf("expected plan generation failed recovery payload, got %#v", recovery)
	}
}

func TestBuildPlanFoundationContextUsesBootstrapDesignReadiness(t *testing.T) {
	artifactLoader := &stubProjectArtifactLoader{
		found: true,
		content: `{
  "schema_version": "v1",
  "state": {
    "design_readiness": {
      "status": "ready",
      "tech_stack_ready": true,
      "architecture_ready": true,
      "directory_structure_ready": true,
      "interface_contract_ready": true,
      "data_model_ready": true,
      "missing_items": []
    }
  }
}`,
	}

	foundationContext := buildPlanFoundationContext(context.Background(), GeneratePlansCommand{
		ProjectID: "project-foundation",
	}, artifactLoader)

	for _, expected := range []string{
		"生成前设计 readiness 摘要：",
		"- 状态：ready",
		"- 技术栈与运行时：ready",
		"- 数据模型：ready",
	} {
		if !strings.Contains(foundationContext, expected) {
			t.Fatalf("expected foundation context to include %q, got:\n%s", expected, foundationContext)
		}
	}
}

func TestGenerateOrchestratorGenerateRequiresPrompt(t *testing.T) {
	orchestrator := NewGenerateOrchestrator(&service.GeneratorService{}, nil, nil, nil)

	err := orchestrator.Generate(context.Background(), GenerateCommand{}, nil)
	if !errors.Is(err, ErrPromptRequired) {
		t.Fatalf("expected %v, got %v", ErrPromptRequired, err)
	}
}

func TestGenerateOrchestratorBootstrapStageRequiresPrompt(t *testing.T) {
	orchestrator := NewGenerateOrchestrator(nil, nil, nil, nil)

	err := orchestrator.Generate(context.Background(), GenerateCommand{
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageBootstrapReview,
			WorkflowMode:  WorkflowModeFoundation,
		},
	}, nil)
	if !errors.Is(err, ErrPromptRequired) {
		t.Fatalf("expected %v, got %v", ErrPromptRequired, err)
	}
}

func TestGenerateOrchestratorGenerateRequiresProjectServiceForPersistedProject(t *testing.T) {
	orchestrator := NewGenerateOrchestrator(&service.GeneratorService{}, nil, nil, nil)

	err := orchestrator.Generate(context.Background(), GenerateCommand{
		Prompt:    "build app",
		ProjectID: "project-1",
		UserID:    "user-1",
	}, nil)
	if !errors.Is(err, ErrProjectServiceUnavailable) {
		t.Fatalf("expected %v, got %v", ErrProjectServiceUnavailable, err)
	}
}

func TestGenerateOrchestratorGenerateEmitsFailedStageEvent(t *testing.T) {
	orchestrator := NewGenerateOrchestrator(&service.GeneratorService{}, nil, nil, nil)
	var events []capturedStreamEvent

	err := orchestrator.Generate(context.Background(), GenerateCommand{
		Prompt: "实现一个登录页",
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageImplement,
			WorkflowMode:  WorkflowModeDiscuss,
		},
	}, newCapturedStreamHandler(&events))
	if err == nil {
		t.Fatal("expected generation error")
	}

	foundCapabilityEvent := false
	foundFailedEvent := false
	for _, event := range events {
		if event.name != "step" {
			continue
		}
		payload, ok := event.payload.(map[string]interface{})
		if !ok {
			t.Fatalf("expected step payload map, got %T", event.payload)
		}
		if payload["id"] == "orchestration:"+WorkflowStageImplement+":failed" && payload["status"] == "failed" {
			assertCapturedStepEngineeringStatePhase(t, events, "orchestration:"+WorkflowStageImplement, "running", EngineeringStatusRunning)
			engineeringState := assertCapturedStepEngineeringStatePhase(t, events, "orchestration:"+WorkflowStageImplement+":failed", "failed", EngineeringStatusFailed)
			recovery, ok := engineeringState["recovery"].(map[string]interface{})
			if !ok {
				t.Fatalf("expected generation recovery payload, got %T", engineeringState["recovery"])
			}
			if recovery["reason_code"] != "generation_failed" {
				t.Fatalf("expected generation failed recovery reason, got %#v", recovery)
			}
			foundFailedEvent = true
		}
		if payload["id"] == "capability:resolve" && payload["status"] == "done" {
			assertStepEngineeringStatePhase(t, payload, EngineeringStatusRunning)
			meta, ok := payload["meta"].(map[string]interface{})
			if !ok {
				t.Fatalf("expected capability meta payload, got %T", payload["meta"])
			}
			plan, ok := meta["capability_plan"].(map[string]interface{})
			if !ok {
				t.Fatalf("expected capability plan meta, got %T", meta["capability_plan"])
			}
			if plan["profile"] != "discussion-capability-profile" {
				t.Fatalf("expected discussion capability profile, got %v", plan["profile"])
			}
			if _, ok := plan["capabilities"].([]map[string]interface{}); !ok {
				t.Fatalf("expected capabilities meta list, got %T", plan["capabilities"])
			}
			resolution, ok := meta["provider_resolution"].(map[string]interface{})
			if !ok {
				t.Fatalf("expected provider resolution meta, got %T", meta["provider_resolution"])
			}
			if resolution["status"] != CapabilityResolutionStatusResolved {
				t.Fatalf("expected resolved provider resolution, got %v", resolution["status"])
			}
			if _, ok := resolution["providers"].([]map[string]interface{}); !ok {
				t.Fatalf("expected providers meta list, got %T", resolution["providers"])
			}
			audit, ok := meta["execution_audit"].(map[string]interface{})
			if !ok {
				t.Fatalf("expected execution audit meta, got %T", meta["execution_audit"])
			}
			if audit["status"] != CapabilityExecutionStatusDeferred {
				t.Fatalf("expected deferred execution audit, got %v", audit["status"])
			}
			if _, ok := audit["items"].([]map[string]interface{}); !ok {
				t.Fatalf("expected execution audit items, got %T", audit["items"])
			}
			result, ok := meta["execution_result"].(map[string]interface{})
			if !ok {
				t.Fatalf("expected execution result meta, got %T", meta["execution_result"])
			}
			if result["status"] != CapabilityExecutionResultStatusDeferred {
				t.Fatalf("expected deferred execution result, got %v", result["status"])
			}
			if _, ok := result["items"].([]map[string]interface{}); !ok {
				t.Fatalf("expected execution result items, got %T", result["items"])
			}
			foundCapabilityEvent = true
		}
	}
	if !foundCapabilityEvent {
		t.Fatal("expected capability resolve step event")
	}
	if !foundFailedEvent {
		t.Fatal("expected failed generate orchestration step event")
	}
}

func TestGenerateOrchestratorUnavailableEmitsFailedGenerationState(t *testing.T) {
	orchestrator := NewGenerateOrchestrator(nil, nil, nil, nil)
	var events []capturedStreamEvent

	err := orchestrator.Generate(context.Background(), GenerateCommand{
		Prompt: "实现一个登录页",
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageImplement,
			WorkflowMode:  WorkflowModeImplement,
		},
	}, newCapturedStreamHandler(&events))
	if !errors.Is(err, ErrGenerateOrchestrationUnavailable) {
		t.Fatalf("expected generation unavailable error, got %v", err)
	}

	runningState := assertCapturedStepEngineeringStatePhase(t, events, "orchestration:"+WorkflowStageImplement, "running", EngineeringStatusRunning)
	if _, ok := runningState["recovery"].(map[string]interface{}); ok {
		t.Fatalf("expected running generation state without recovery, got %#v", runningState["recovery"])
	}
	failedState := assertCapturedStepEngineeringStatePhase(t, events, "orchestration:"+WorkflowStageImplement+":failed", "failed", EngineeringStatusFailed)
	recovery, ok := failedState["recovery"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected generation unavailable recovery payload, got %T", failedState["recovery"])
	}
	if recovery["reason_code"] != "generation_failed" || recovery["retry_label"] != "修复后重试生成" {
		t.Fatalf("expected generation failed recovery payload, got %#v", recovery)
	}
}

func TestGenerateOrchestratorUsesInjectedCapabilityExecutor(t *testing.T) {
	executor := &stubCapabilityExecutor{
		result: CapabilityExecutionResult{
			Status: CapabilityExecutionResultStatusBlocked,
			Items: []CapabilityExecutionResultItem{
				{
					CapabilityID: "custom.capability",
					Provider:     CapabilityProviderSkill,
					Status:       CapabilityExecutionResultStatusBlocked,
					ReasonCode:   "custom_executor_blocked",
					SourceNote:   "测试 executor 返回的执行结果。",
				},
			},
			SourceNote: "自定义 executor 结果。",
		},
	}
	orchestrator := NewGenerateOrchestrator(&service.GeneratorService{}, nil, nil, nil, executor)
	var events []capturedStreamEvent

	err := orchestrator.Generate(context.Background(), GenerateCommand{
		Prompt: "实现一个登录页",
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageImplement,
			WorkflowMode:  WorkflowModeDiscuss,
		},
	}, newCapturedStreamHandler(&events))
	if err == nil {
		t.Fatal("expected generation error")
	}
	if !errors.Is(err, ErrCapabilityExecutionBlocked) {
		t.Fatalf("expected capability execution blocked error, got %v", err)
	}
	if executor.calls != 1 {
		t.Fatalf("expected injected capability executor to be called once, got %d", executor.calls)
	}

	foundInjectedResult := false
	foundRecoveryState := false
	for _, event := range events {
		if event.name != "step" {
			continue
		}
		payload, ok := event.payload.(map[string]interface{})
		if !ok || payload["id"] != "capability:resolve" {
			continue
		}
		if payload["status"] != "failed" {
			t.Fatalf("expected failed capability resolve status, got %v", payload["status"])
		}
		engineeringState := assertStepEngineeringStatePhase(t, payload, EngineeringStatusFailed)
		meta, ok := payload["meta"].(map[string]interface{})
		if !ok {
			t.Fatalf("expected capability meta payload, got %T", payload["meta"])
		}
		result, ok := meta["execution_result"].(map[string]interface{})
		if !ok {
			t.Fatalf("expected execution result meta, got %T", meta["execution_result"])
		}
		if result["status"] == CapabilityExecutionResultStatusBlocked {
			foundInjectedResult = true
		}
		recovery, ok := engineeringState["recovery"].(map[string]interface{})
		if !ok {
			t.Fatalf("expected recovery payload, got %T", engineeringState["recovery"])
		}
		if recovery["reason_code"] == "custom_executor_blocked" && recovery["can_retry"] == true {
			foundRecoveryState = true
		}
	}
	if !foundInjectedResult {
		t.Fatal("expected capability resolve event to use injected execution result")
	}
	if !foundRecoveryState {
		t.Fatal("expected capability blocked recovery state")
	}
}

func TestRecordingCapabilityExecutorPersistsExecutionAudit(t *testing.T) {
	capabilityContext := ResolveCapabilityContext(OrchestrationContext{
		WorkflowStage:    WorkflowStageImplement,
		WorkflowMode:     WorkflowModeImplement,
		RuntimeProjectID: "project-1",
	})
	resolution := NewDefaultCapabilityProviderRegistry().Resolve(capabilityContext)
	audit := BuildCapabilityExecutionAudit(resolution)
	delegate := &stubCapabilityExecutor{
		result: CapabilityExecutionResult{
			Status: CapabilityExecutionResultStatusDeferred,
			Items: []CapabilityExecutionResultItem{
				{
					CapabilityID: "generation.content_stream",
					Provider:     CapabilityProviderInternal,
					Status:       CapabilityExecutionResultStatusDeferred,
					ReasonCode:   "handled_by_existing_stage",
					SourceNote:   "测试执行结果。",
				},
			},
			SourceNote: "测试记录 executor。",
		},
	}
	repo := &stubCapabilityAuditRepo{}

	ctx := context.Background()
	ctx = withOrchestrationContext(ctx, OrchestrationContext{
		WorkflowStage:    WorkflowStageImplement,
		WorkflowMode:     WorkflowModeImplement,
		RuntimeProjectID: "project-1",
	})
	ctx = withCapabilityExecutionRequest(ctx, CapabilityExecutionRequest{
		UserID:    "user-1",
		ProjectID: "project-1",
	})
	ctx = withCapabilityContext(ctx, capabilityContext)
	ctx = withCapabilityResolution(ctx, resolution)

	result := (RecordingCapabilityExecutor{
		Delegate:  delegate,
		AuditRepo: repo,
	}).Execute(ctx, audit)

	if delegate.calls != 1 {
		t.Fatalf("expected delegate executor to be called once, got %d", delegate.calls)
	}
	if result.Status != CapabilityExecutionResultStatusDeferred {
		t.Fatalf("expected deferred execution result, got %q", result.Status)
	}
	if len(repo.records) != 1 {
		t.Fatalf("expected 1 capability audit record, got %d", len(repo.records))
	}

	record := repo.records[0]
	if record.ProjectID != "project-1" {
		t.Fatalf("expected project id %q, got %q", "project-1", record.ProjectID)
	}
	if record.UserID != "user-1" {
		t.Fatalf("expected user id %q, got %q", "user-1", record.UserID)
	}
	if record.WorkflowStage != WorkflowStageImplement {
		t.Fatalf("expected workflow stage %q, got %q", WorkflowStageImplement, record.WorkflowStage)
	}
	if record.CapabilityProfile != "implementation-capability-profile" {
		t.Fatalf("expected implementation capability profile, got %q", record.CapabilityProfile)
	}
	if record.Status != CapabilityExecutionResultStatusDeferred {
		t.Fatalf("expected audit record status %q, got %q", CapabilityExecutionResultStatusDeferred, record.Status)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(record.ExecutionResult), &payload); err != nil {
		t.Fatalf("expected execution result JSON, got %v", err)
	}
	if payload["status"] != CapabilityExecutionResultStatusDeferred {
		t.Fatalf("expected persisted result status %q, got %v", CapabilityExecutionResultStatusDeferred, payload["status"])
	}
	if record.ProviderResolution == "" || record.ExecutionAudit == "" || record.ExecutionResult == "" {
		t.Fatal("expected persisted capability audit JSON fields")
	}
}

func TestExternalCapabilityExecutorBlocksDisabledExternalExecutionPolicy(t *testing.T) {
	registry := NewDefaultCapabilityProviderRegistry()
	registry.Register(CapabilityProviderDefinition{
		ID:         CapabilityProviderSkill,
		Name:       "Skill Provider",
		Type:       CapabilityProviderSkill,
		Version:    "v1",
		Enabled:    true,
		SourceNote: "测试启用 skill provider。",
	})
	resolution := registry.Resolve(CapabilityContext{
		Profile:      "test-skill-profile",
		WorkflowMode: WorkflowModeImplement,
		Capabilities: []CapabilityDescriptor{
			{
				ID:         "skill.example",
				Name:       "示例 Skill",
				Provider:   CapabilityProviderSkill,
				Purpose:    "验证 Skill runner 缺失时的阻断语义",
				Version:    "v1",
				Required:   true,
				SourceNote: "测试构造的 skill 能力。",
			},
		},
	})
	audit := BuildCapabilityExecutionAudit(resolution)
	runner := &stubCapabilityProviderRunner{
		result: CapabilityProviderRunResult{
			Status:     CapabilityExecutionResultStatusExecuted,
			ReasonCode: "skill_runner_executed",
			SourceNote: "测试 Skill runner 已执行。",
		},
	}

	result := (ExternalCapabilityExecutor{
		Fallback:    NoopCapabilityExecutor{},
		SkillRunner: runner,
	}).Execute(context.Background(), audit)

	if result.Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected blocked result status, got %q", result.Status)
	}
	if len(result.Items) != 1 {
		t.Fatalf("expected 1 result item, got %d", len(result.Items))
	}
	if runner.calls != 0 {
		t.Fatalf("expected disabled policy to skip runner call, got %d", runner.calls)
	}
	if result.Items[0].ReasonCode != "external_capability_execution_disabled" {
		t.Fatalf("expected external execution disabled reason, got %q", result.Items[0].ReasonCode)
	}
}

func TestExternalCapabilityExecutorBlocksMissingSkillRunner(t *testing.T) {
	registry := NewDefaultCapabilityProviderRegistry()
	registry.Register(CapabilityProviderDefinition{
		ID:         CapabilityProviderSkill,
		Name:       "Skill Provider",
		Type:       CapabilityProviderSkill,
		Version:    "v1",
		Enabled:    true,
		SourceNote: "测试启用 skill provider。",
	})
	resolution := registry.Resolve(CapabilityContext{
		Profile:      "test-skill-profile",
		WorkflowMode: WorkflowModeImplement,
		Capabilities: []CapabilityDescriptor{
			{
				ID:         "skill.example",
				Name:       "示例 Skill",
				Provider:   CapabilityProviderSkill,
				Purpose:    "验证 Skill runner 缺失时的阻断语义",
				Version:    "v1",
				Required:   true,
				SourceNote: "测试构造的 skill 能力。",
			},
		},
	})
	audit := BuildCapabilityExecutionAudit(resolution)

	result := (ExternalCapabilityExecutor{
		Fallback: NoopCapabilityExecutor{},
		Policy: CapabilityExecutionPolicy{
			EnableSkill: true,
			SourceNote:  "测试允许 Skill runner 执行。",
		},
	}).Execute(context.Background(), audit)

	if result.Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected blocked result status, got %q", result.Status)
	}
	if len(result.Items) != 1 {
		t.Fatalf("expected 1 result item, got %d", len(result.Items))
	}
	if result.Items[0].ReasonCode != "provider_runner_unavailable" {
		t.Fatalf("expected provider runner unavailable reason, got %q", result.Items[0].ReasonCode)
	}
}

func TestExternalCapabilityExecutorUsesInjectedSkillRunner(t *testing.T) {
	registry := NewDefaultCapabilityProviderRegistry()
	registry.Register(CapabilityProviderDefinition{
		ID:         CapabilityProviderSkill,
		Name:       "Skill Provider",
		Type:       CapabilityProviderSkill,
		Version:    "v1",
		Enabled:    true,
		SourceNote: "测试启用 skill provider。",
	})
	resolution := registry.Resolve(CapabilityContext{
		Profile:      "test-skill-profile",
		WorkflowMode: WorkflowModeImplement,
		Capabilities: []CapabilityDescriptor{
			{
				ID:         "skill.example",
				Name:       "示例 Skill",
				Provider:   CapabilityProviderSkill,
				Purpose:    "验证 Skill runner 注入后的执行语义",
				Version:    "v1",
				Required:   true,
				SourceNote: "测试构造的 skill 能力。",
			},
		},
	})
	audit := BuildCapabilityExecutionAudit(resolution)
	runner := &stubCapabilityProviderRunner{
		result: CapabilityProviderRunResult{
			Status:     CapabilityExecutionResultStatusExecuted,
			ReasonCode: "skill_runner_executed",
			SourceNote: "测试 Skill runner 已执行。",
		},
	}

	result := (ExternalCapabilityExecutor{
		Fallback:    NoopCapabilityExecutor{},
		SkillRunner: runner,
		Policy: CapabilityExecutionPolicy{
			EnableSkill: true,
			SourceNote:  "测试允许 Skill runner 执行。",
		},
	}).Execute(context.Background(), audit)

	if runner.calls != 1 {
		t.Fatalf("expected skill runner to be called once, got %d", runner.calls)
	}
	if result.Status != CapabilityExecutionResultStatusExecuted {
		t.Fatalf("expected executed result status, got %q", result.Status)
	}
	if result.Items[0].ReasonCode != "skill_runner_executed" {
		t.Fatalf("expected skill runner reason, got %q", result.Items[0].ReasonCode)
	}
}

func TestExternalCapabilityExecutorUsesDryRunSkillRunner(t *testing.T) {
	registry := NewCapabilityProviderRegistry(CapabilityProviderRegistryOptions{
		EnableSkillProvider: true,
		SourceNote:          "测试启用 skill provider。",
	})
	resolution := registry.Resolve(CapabilityContext{
		Profile:      "test-skill-profile",
		WorkflowMode: WorkflowModeImplement,
		Capabilities: []CapabilityDescriptor{
			{
				ID:         "skill.example",
				Name:       "示例 Skill",
				Provider:   CapabilityProviderSkill,
				Purpose:    "验证 dry-run Skill runner 的执行语义",
				Version:    "v1",
				Required:   true,
				SourceNote: "测试构造的 skill 能力。",
			},
		},
	})
	audit := BuildCapabilityExecutionAudit(resolution)

	result := (ExternalCapabilityExecutor{
		Fallback: NoopCapabilityExecutor{},
		SkillRunner: DryRunCapabilityProviderRunner{
			Provider:   CapabilityProviderSkill,
			SourceNote: "测试 dry-run runner 已执行。",
		},
		Policy: CapabilityExecutionPolicy{
			EnableSkill: true,
			SourceNote:  "测试允许 Skill runner 执行。",
		},
	}).Execute(context.Background(), audit)

	if result.Status != CapabilityExecutionResultStatusExecuted {
		t.Fatalf("expected executed result status, got %q", result.Status)
	}
	if result.Items[0].ReasonCode != "skill_dry_run_executed" {
		t.Fatalf("expected dry-run skill reason, got %q", result.Items[0].ReasonCode)
	}
	if result.Items[0].Metadata["runner_mode"] != "dry-run" {
		t.Fatalf("expected dry-run metadata, got %+v", result.Items[0].Metadata)
	}
	if result.Items[0].Metadata["source"] != "capability_runner" ||
		result.Items[0].Metadata["capability_version"] != "v1" ||
		result.Items[0].Metadata["provider_resolution_status"] != CapabilityResolutionStatusResolved {
		t.Fatalf("expected catalog evidence metadata, got %+v", result.Items[0].Metadata)
	}
	if len(result.Items[0].Artifacts) != 1 || result.Items[0].Artifacts[0].Type != "capability_contract" {
		t.Fatalf("expected dry-run contract artifact, got %+v", result.Items[0].Artifacts)
	}
}

func TestExternalCapabilityExecutorBlocksInvalidRunnerResult(t *testing.T) {
	audit := BuildCapabilityExecutionAudit(NewCapabilityProviderRegistry(CapabilityProviderRegistryOptions{
		EnableSkillProvider: true,
	}).Resolve(CapabilityContext{
		Profile:      "test-skill-profile",
		WorkflowMode: WorkflowModeImplement,
		Capabilities: []CapabilityDescriptor{
			{
				ID:         "skill.example",
				Name:       "示例 Skill",
				Provider:   CapabilityProviderSkill,
				Purpose:    "验证 runner 非法结果",
				Version:    "v1",
				Required:   true,
				SourceNote: "测试构造的 skill 能力。",
			},
		},
	}))

	result := (ExternalCapabilityExecutor{
		Fallback: NoopCapabilityExecutor{},
		SkillRunner: &stubCapabilityProviderRunner{
			result: CapabilityProviderRunResult{Status: "unknown"},
		},
		Policy: CapabilityExecutionPolicy{EnableSkill: true},
	}).Execute(context.Background(), audit)

	if result.Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected blocked result for invalid runner status, got %q", result.Status)
	}
	if result.Items[0].ReasonCode != "provider_runner_invalid_result" {
		t.Fatalf("expected invalid runner result reason, got %q", result.Items[0].ReasonCode)
	}
}

func TestExternalCapabilityExecutorBlocksPanickingRunner(t *testing.T) {
	audit := BuildCapabilityExecutionAudit(NewCapabilityProviderRegistry(CapabilityProviderRegistryOptions{
		EnableSkillProvider: true,
	}).Resolve(CapabilityContext{
		Profile:      "test-skill-profile",
		WorkflowMode: WorkflowModeImplement,
		Capabilities: []CapabilityDescriptor{
			{
				ID:         "skill.example",
				Name:       "示例 Skill",
				Provider:   CapabilityProviderSkill,
				Purpose:    "验证 runner panic 失败分类",
				Version:    "v1",
				Required:   true,
				SourceNote: "测试构造的 skill 能力。",
			},
		},
	}))

	result := (ExternalCapabilityExecutor{
		Fallback:    NoopCapabilityExecutor{},
		SkillRunner: panicCapabilityProviderRunner{},
		Policy:      CapabilityExecutionPolicy{EnableSkill: true},
	}).Execute(context.Background(), audit)

	if result.Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected blocked result for panicking runner, got %q", result.Status)
	}
	if result.Items[0].ReasonCode != "provider_runner_failed" {
		t.Fatalf("expected provider runner failed reason, got %q", result.Items[0].ReasonCode)
	}
	if result.Items[0].Metadata["failure_type"] != "panic" {
		t.Fatalf("expected panic failure metadata, got %+v", result.Items[0].Metadata)
	}
}

func TestContractCapabilityProviderRunnerReadsManifest(t *testing.T) {
	manifestPath := filepath.Join(t.TempDir(), "mcp-contract.json")
	if err := os.WriteFile(manifestPath, []byte(`{
		"source_note": "测试 manifest 默认来源。",
		"capabilities": {
			"mcp.example": {
				"status": "executed",
				"reason_code": "mcp_contract_executed",
				"metadata": {"from_manifest": true},
				"artifacts": [
					{
						"id": "mcp.example.artifact",
						"type": "capability_contract",
						"name": "MCP 契约结果",
						"source_note": "测试 artifact。"
					}
				]
			}
		}
	}`), 0o600); err != nil {
		t.Fatalf("write manifest: %v", err)
	}

	result := ContractCapabilityProviderRunner{
		Provider:     CapabilityProviderMCP,
		ManifestPath: manifestPath,
	}.ExecuteCapability(context.Background(), CapabilityExecutionAuditItem{
		CapabilityID: "mcp.example",
		Provider:     CapabilityProviderMCP,
	})

	if result.Status != CapabilityExecutionResultStatusExecuted {
		t.Fatalf("expected executed result, got %q", result.Status)
	}
	if result.ReasonCode != "mcp_contract_executed" {
		t.Fatalf("expected manifest reason, got %q", result.ReasonCode)
	}
	if result.Metadata["runner_mode"] != "contract" || result.Metadata["from_manifest"] != true {
		t.Fatalf("expected merged contract metadata, got %+v", result.Metadata)
	}
	if len(result.Artifacts) != 1 || result.Artifacts[0].Type != "capability_contract" {
		t.Fatalf("expected manifest artifact, got %+v", result.Artifacts)
	}
}

func TestContractCapabilityProviderRunnerBlocksMissingCapability(t *testing.T) {
	manifestPath := filepath.Join(t.TempDir(), "skill-contract.json")
	if err := os.WriteFile(manifestPath, []byte(`{"capabilities": {}}`), 0o600); err != nil {
		t.Fatalf("write manifest: %v", err)
	}

	result := ContractCapabilityProviderRunner{
		Provider:     CapabilityProviderSkill,
		ManifestPath: manifestPath,
	}.ExecuteCapability(context.Background(), CapabilityExecutionAuditItem{
		CapabilityID: "skill.missing",
		Provider:     CapabilityProviderSkill,
	})

	if result.Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected blocked result, got %q", result.Status)
	}
	if result.ReasonCode != "provider_runner_contract_missing" {
		t.Fatalf("expected missing contract reason, got %q", result.ReasonCode)
	}
}

func TestContractCapabilityProviderRunnerBlocksMissingManifestPath(t *testing.T) {
	result := ContractCapabilityProviderRunner{
		Provider: CapabilityProviderSkill,
	}.ExecuteCapability(context.Background(), CapabilityExecutionAuditItem{
		CapabilityID: "skill.example",
		Provider:     CapabilityProviderSkill,
	})

	if result.Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected blocked result, got %q", result.Status)
	}
	if result.ReasonCode != "provider_runner_manifest_missing" {
		t.Fatalf("expected missing manifest reason, got %q", result.ReasonCode)
	}
}

func TestCapabilityRunnerBoundaryBlocksNetworkByDefault(t *testing.T) {
	result := CapabilityRunnerBoundary{}.ValidateNetworkTarget("https://mcp.example.com/tools")

	if result.Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected blocked network result, got %q", result.Status)
	}
	if result.ReasonCode != "provider_runner_network_disabled" {
		t.Fatalf("expected network disabled reason, got %q", result.ReasonCode)
	}
}

func TestCapabilityRunnerBoundaryAllowsOnlyAllowlistedTarget(t *testing.T) {
	boundary := CapabilityRunnerBoundary{
		NetworkEnabled: true,
		AllowedTargets: []string{
			"mcp.example.com",
		},
		PermissionNote: "测试 allowlist 来源。",
	}

	allowed := boundary.ValidateNetworkTarget("https://mcp.example.com/tools")
	if allowed.Status != CapabilityExecutionResultStatusExecuted {
		t.Fatalf("expected allowlisted target to pass, got %q", allowed.Status)
	}
	if allowed.ReasonCode != "provider_runner_network_target_allowed" {
		t.Fatalf("expected allowed target reason, got %q", allowed.ReasonCode)
	}

	denied := boundary.ValidateNetworkTarget("https://other.example.com/tools")
	if denied.Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected non-allowlisted target to block, got %q", denied.Status)
	}
	if denied.ReasonCode != "provider_runner_network_target_denied" {
		t.Fatalf("expected target denied reason, got %q", denied.ReasonCode)
	}
}

func TestExternalCapabilityExecutorInjectsRunnerBoundary(t *testing.T) {
	audit := BuildCapabilityExecutionAudit(NewCapabilityProviderRegistry(CapabilityProviderRegistryOptions{
		EnableSkillProvider: true,
	}).Resolve(CapabilityContext{
		Profile:      "test-skill-profile",
		WorkflowMode: WorkflowModeImplement,
		Capabilities: []CapabilityDescriptor{
			{
				ID:         "skill.example",
				Name:       "示例 Skill",
				Provider:   CapabilityProviderSkill,
				Purpose:    "验证 runner boundary 注入",
				Version:    "v1",
				Required:   true,
				SourceNote: "测试构造的 skill 能力。",
			},
		},
	}))
	runner := &boundaryProbeCapabilityProviderRunner{}

	result := (ExternalCapabilityExecutor{
		Fallback:    NoopCapabilityExecutor{},
		SkillRunner: runner,
		Policy: CapabilityExecutionPolicy{
			EnableSkill: true,
		},
		Boundary: CapabilityRunnerBoundary{
			Timeout:        time.Second,
			NetworkEnabled: true,
			AllowedTargets: []string{"mcp.example.com"},
			PermissionNote: "测试 boundary 来源。",
		},
	}).Execute(context.Background(), audit)

	if result.Status != CapabilityExecutionResultStatusExecuted {
		t.Fatalf("expected executed result, got %q", result.Status)
	}
	if !runner.ok {
		t.Fatal("expected runner to receive capability boundary in context")
	}
	if !runner.boundary.NetworkEnabled || len(runner.boundary.AllowedTargets) != 1 {
		t.Fatalf("expected injected network boundary, got %+v", runner.boundary)
	}
}

func TestExternalCapabilityExecutorAppliesRunnerTimeout(t *testing.T) {
	audit := BuildCapabilityExecutionAudit(NewCapabilityProviderRegistry(CapabilityProviderRegistryOptions{
		EnableSkillProvider: true,
	}).Resolve(CapabilityContext{
		Profile:      "test-skill-profile",
		WorkflowMode: WorkflowModeImplement,
		Capabilities: []CapabilityDescriptor{
			{
				ID:         "skill.example",
				Name:       "示例 Skill",
				Provider:   CapabilityProviderSkill,
				Purpose:    "验证 runner timeout",
				Version:    "v1",
				Required:   true,
				SourceNote: "测试构造的 skill 能力。",
			},
		},
	}))

	result := (ExternalCapabilityExecutor{
		Fallback:    NoopCapabilityExecutor{},
		SkillRunner: waitingCapabilityProviderRunner{},
		Policy: CapabilityExecutionPolicy{
			EnableSkill: true,
		},
		Boundary: CapabilityRunnerBoundary{
			Timeout: time.Millisecond,
		},
	}).Execute(context.Background(), audit)

	if result.Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected timeout to block result, got %q", result.Status)
	}
	if result.Items[0].ReasonCode != "provider_runner_timeout" {
		t.Fatalf("expected timeout reason, got %q", result.Items[0].ReasonCode)
	}
}

func TestMCPHTTPCapabilityProviderRunnerBlocksMissingEndpoint(t *testing.T) {
	result := MCPHTTPCapabilityProviderRunner{}.ExecuteCapability(context.Background(), CapabilityExecutionAuditItem{
		CapabilityID: "mcp.example",
		Provider:     CapabilityProviderMCP,
	})

	if result.Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected blocked result, got %q", result.Status)
	}
	if result.ReasonCode != "provider_runner_endpoint_missing" {
		t.Fatalf("expected endpoint missing reason, got %q", result.ReasonCode)
	}
}

func TestMCPHTTPCapabilityProviderRunnerBlocksWhenNetworkDisabled(t *testing.T) {
	result := MCPHTTPCapabilityProviderRunner{
		Endpoint: "https://mcp.example.com/capabilities",
	}.ExecuteCapability(context.Background(), CapabilityExecutionAuditItem{
		CapabilityID: "mcp.example",
		Provider:     CapabilityProviderMCP,
	})

	if result.Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected blocked result, got %q", result.Status)
	}
	if result.ReasonCode != "provider_runner_network_disabled" {
		t.Fatalf("expected network disabled reason, got %q", result.ReasonCode)
	}
}

func TestMCPHTTPCapabilityProviderRunnerExecutesAllowlistedEndpoint(t *testing.T) {
	var captured capabilityProviderHTTPRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", r.Method)
		}
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"status": "executed",
			"reason_code": "mcp_http_executed",
			"source_note": "测试 MCP HTTP runner 已执行。",
			"metadata": {"from_server": true}
		}`))
	}))
	defer server.Close()

	ctx := withCapabilityRunnerBoundary(context.Background(), CapabilityRunnerBoundary{
		NetworkEnabled: true,
		AllowedTargets: []string{
			server.URL,
		},
		PermissionNote: "测试 allowlist。",
	})
	ctx = withOrchestrationContext(ctx, OrchestrationContext{
		WorkflowStage: WorkflowStageImplement,
		WorkflowMode:  WorkflowModeImplement,
	})
	ctx = withCapabilityContext(ctx, CapabilityContext{
		Profile: "test-mcp-http-profile",
	})
	ctx = withCapabilityExecutionRequest(ctx, CapabilityExecutionRequest{
		ProjectID: "project-1",
		UserID:    "user-1",
	})
	result := MCPHTTPCapabilityProviderRunner{
		Endpoint: server.URL,
	}.ExecuteCapability(ctx, CapabilityExecutionAuditItem{
		CapabilityID:             "mcp.example",
		CapabilityName:           "示例 MCP",
		CapabilityVersion:        "v1",
		CapabilityCatalogSource:  "测试 catalog 来源。",
		Provider:                 CapabilityProviderMCP,
		ProviderResolutionStatus: CapabilityResolutionStatusResolved,
		Required:                 true,
		ReasonCode:               "external_provider_ready_for_execution",
		SourceNote:               "测试审计来源。",
	})

	if captured.CapabilityID != "mcp.example" ||
		captured.CapabilityVersion != "v1" ||
		captured.ProviderResolutionStatus != CapabilityResolutionStatusResolved ||
		captured.WorkflowStage != WorkflowStageImplement ||
		captured.WorkflowMode != WorkflowModeImplement ||
		captured.CapabilityProfile != "test-mcp-http-profile" ||
		captured.ProjectID != "project-1" ||
		captured.UserID != "user-1" ||
		captured.Required != true {
		t.Fatalf("expected capability id in request, got %+v", captured)
	}
	if result.Status != CapabilityExecutionResultStatusExecuted {
		t.Fatalf("expected executed result, got %q", result.Status)
	}
	if result.ReasonCode != "mcp_http_executed" {
		t.Fatalf("expected MCP HTTP reason, got %q", result.ReasonCode)
	}
	if result.Metadata["runner_mode"] != "mcp-http" || result.Metadata["from_server"] != true {
		t.Fatalf("expected merged HTTP metadata, got %+v", result.Metadata)
	}
}

func TestMCPHTTPCapabilityProviderRunnerBlocksHTTPFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "failed", http.StatusBadGateway)
	}))
	defer server.Close()

	ctx := withCapabilityRunnerBoundary(context.Background(), CapabilityRunnerBoundary{
		NetworkEnabled: true,
		AllowedTargets: []string{
			server.URL,
		},
	})
	result := MCPHTTPCapabilityProviderRunner{
		Endpoint: server.URL,
	}.ExecuteCapability(ctx, CapabilityExecutionAuditItem{
		CapabilityID: "mcp.example",
		Provider:     CapabilityProviderMCP,
	})

	if result.Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected blocked result, got %q", result.Status)
	}
	if result.ReasonCode != "provider_runner_http_failed" {
		t.Fatalf("expected HTTP failed reason, got %q", result.ReasonCode)
	}
}

func TestMCPHTTPCapabilityProviderRunnerBlocksInvalidJSONResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`not-json`))
	}))
	defer server.Close()

	ctx := withCapabilityRunnerBoundary(context.Background(), CapabilityRunnerBoundary{
		NetworkEnabled: true,
		AllowedTargets: []string{
			server.URL,
		},
	})
	result := MCPHTTPCapabilityProviderRunner{
		Endpoint: server.URL,
	}.ExecuteCapability(ctx, CapabilityExecutionAuditItem{
		CapabilityID: "mcp.example",
		Provider:     CapabilityProviderMCP,
	})

	if result.Status != CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected blocked result, got %q", result.Status)
	}
	if result.ReasonCode != "provider_runner_invalid_response" {
		t.Fatalf("expected invalid response reason, got %q", result.ReasonCode)
	}
}

func TestSkillHTTPCapabilityProviderRunnerExecutesAllowlistedEndpoint(t *testing.T) {
	var captured capabilityProviderHTTPRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", r.Method)
		}
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"status": "executed",
			"reason_code": "skill_http_executed",
			"source_note": "测试 Skill HTTP runner 已执行。",
			"metadata": {"from_server": true}
		}`))
	}))
	defer server.Close()

	ctx := withCapabilityRunnerBoundary(context.Background(), CapabilityRunnerBoundary{
		NetworkEnabled: true,
		AllowedTargets: []string{
			server.URL,
		},
		PermissionNote: "测试 Skill allowlist。",
	})
	ctx = withOrchestrationContext(ctx, OrchestrationContext{
		WorkflowStage: WorkflowStageImplement,
		WorkflowMode:  WorkflowModeImplement,
	})
	ctx = withCapabilityContext(ctx, CapabilityContext{
		Profile: "test-skill-http-profile",
	})
	ctx = withCapabilityExecutionRequest(ctx, CapabilityExecutionRequest{
		ProjectID: "project-2",
		UserID:    "user-2",
	})
	result := SkillHTTPCapabilityProviderRunner{
		Endpoint: server.URL,
	}.ExecuteCapability(ctx, CapabilityExecutionAuditItem{
		CapabilityID:             "skill.example",
		CapabilityName:           "示例 Skill",
		CapabilityVersion:        "v1",
		CapabilityCatalogSource:  "测试 Skill catalog 来源。",
		Provider:                 CapabilityProviderSkill,
		ProviderResolutionStatus: CapabilityResolutionStatusResolved,
		Required:                 true,
		ReasonCode:               "external_provider_ready_for_execution",
		SourceNote:               "测试 Skill 审计来源。",
	})

	if captured.Provider != CapabilityProviderSkill ||
		captured.CapabilityID != "skill.example" ||
		captured.CapabilityVersion != "v1" ||
		captured.ProviderResolutionStatus != CapabilityResolutionStatusResolved ||
		captured.WorkflowStage != WorkflowStageImplement ||
		captured.WorkflowMode != WorkflowModeImplement ||
		captured.CapabilityProfile != "test-skill-http-profile" ||
		captured.ProjectID != "project-2" ||
		captured.UserID != "user-2" ||
		captured.Required != true {
		t.Fatalf("expected skill request payload, got %+v", captured)
	}
	if result.Status != CapabilityExecutionResultStatusExecuted {
		t.Fatalf("expected executed result, got %q", result.Status)
	}
	if result.ReasonCode != "skill_http_executed" {
		t.Fatalf("expected Skill HTTP reason, got %q", result.ReasonCode)
	}
	if result.Metadata["runner_mode"] != "skill-http" || result.Metadata["from_server"] != true {
		t.Fatalf("expected merged Skill HTTP metadata, got %+v", result.Metadata)
	}
}

func TestGenerateOrchestratorExecutesSkillDryRunCapabilityProfile(t *testing.T) {
	orchestrator := NewGenerateOrchestratorWithOptions(nil, nil, nil, nil, GenerateOrchestratorOptions{
		CapabilityExecutor: ExternalCapabilityExecutor{
			Fallback: NoopCapabilityExecutor{},
			SkillRunner: DryRunCapabilityProviderRunner{
				Provider:   CapabilityProviderSkill,
				SourceNote: "测试 dry-run runner 已执行。",
			},
			Policy: CapabilityExecutionPolicy{
				EnableSkill: true,
				SourceNote:  "测试允许 Skill runner 执行。",
			},
		},
		CapabilityRegistry: NewCapabilityProviderRegistry(CapabilityProviderRegistryOptions{
			EnableSkillProvider: true,
			SourceNote:          "测试启用 Skill provider。",
		}),
	})
	var events []capturedStreamEvent

	err := orchestrator.Generate(context.Background(), GenerateCommand{
		Prompt: "验证 Skill dry-run 能力链路",
		Context: OrchestrationContext{
			WorkflowStage:     WorkflowStageImplement,
			WorkflowMode:      WorkflowModeImplement,
			CapabilityProfile: CapabilityProfileImplementationSkillDryRun,
		},
	}, newCapturedStreamHandler(&events))
	if !errors.Is(err, ErrGenerateOrchestrationUnavailable) {
		t.Fatalf("expected generation to stop after capability resolve because generator is unavailable, got %v", err)
	}

	foundExecutedDryRun := false
	for _, event := range events {
		if event.name != "step" {
			continue
		}
		payload, ok := event.payload.(map[string]interface{})
		if !ok || payload["id"] != "capability:resolve" {
			continue
		}
		if payload["status"] != "done" {
			t.Fatalf("expected done capability resolve status, got %v", payload["status"])
		}
		meta, ok := payload["meta"].(map[string]interface{})
		if !ok {
			t.Fatalf("expected capability meta payload, got %T", payload["meta"])
		}
		result, ok := meta["execution_result"].(map[string]interface{})
		if !ok {
			t.Fatalf("expected execution result meta, got %T", meta["execution_result"])
		}
		if result["status"] != CapabilityExecutionResultStatusExecuted {
			t.Fatalf("expected executed capability result, got %v", result["status"])
		}
		items, ok := result["items"].([]map[string]interface{})
		if !ok {
			t.Fatalf("expected execution result items, got %T", result["items"])
		}
		for _, item := range items {
			if item["capability_id"] == "skill.contract_dry_run" && item["reason_code"] == "skill_dry_run_executed" {
				foundExecutedDryRun = true
			}
		}
	}
	if !foundExecutedDryRun {
		t.Fatal("expected dry-run skill capability execution result in capability resolve event")
	}
}

func TestGenerateOrchestratorExecutesSkillHTTPCapabilityProfile(t *testing.T) {
	var captured capabilityProviderHTTPRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", r.Method)
		}
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"status": "executed",
			"reason_code": "skill_http_orchestrator_executed",
			"source_note": "测试 GenerateOrchestrator 已触发 Skill HTTP runner。",
			"metadata": {"from_orchestrator_test_server": true},
			"artifacts": [
				{
					"id": "skill.contract_dry_run.http_result",
					"type": "skill_result",
					"name": "Skill HTTP 编排测试结果",
					"source_note": "测试 endpoint 返回的结构化 artifact。",
					"metadata": {"provider": "skill", "runner_mode": "skill-http"}
				}
			]
		}`))
	}))
	defer server.Close()

	orchestrator := NewGenerateOrchestratorWithOptions(nil, nil, nil, nil, GenerateOrchestratorOptions{
		CapabilityExecutor: ExternalCapabilityExecutor{
			Fallback: NoopCapabilityExecutor{},
			SkillRunner: SkillHTTPCapabilityProviderRunner{
				Endpoint: server.URL,
			},
			Policy: CapabilityExecutionPolicy{
				EnableSkill: true,
				SourceNote:  "测试允许 Skill HTTP runner 执行。",
			},
			Boundary: CapabilityRunnerBoundary{
				NetworkEnabled: true,
				AllowedTargets: []string{
					server.URL,
				},
			},
		},
		CapabilityRegistry: NewCapabilityProviderRegistry(CapabilityProviderRegistryOptions{
			EnableSkillProvider: true,
			SourceNote:          "测试启用 Skill provider。",
		}),
	})
	var events []capturedStreamEvent

	err := orchestrator.Generate(context.Background(), GenerateCommand{
		UserID:    "user-http-1",
		ProjectID: "project-http-1",
		Prompt:    "验证 Skill HTTP 能力链路",
		Context: OrchestrationContext{
			WorkflowStage:     WorkflowStageImplement,
			WorkflowMode:      WorkflowModeImplement,
			CapabilityProfile: CapabilityProfileImplementationSkillDryRun,
		},
	}, newCapturedStreamHandler(&events))
	if !errors.Is(err, ErrGenerateOrchestrationUnavailable) {
		t.Fatalf("expected generation to stop after capability resolve because generator is unavailable, got %v", err)
	}

	if captured.Provider != CapabilityProviderSkill ||
		captured.CapabilityID != CapabilitySkillContractDryRun ||
		captured.CapabilityVersion != "v1" ||
		captured.ProviderResolutionStatus != CapabilityResolutionStatusResolved ||
		captured.WorkflowStage != WorkflowStageImplement ||
		captured.WorkflowMode != WorkflowModeImplement ||
		captured.CapabilityProfile != CapabilityProfileImplementationSkillDryRun ||
		captured.ProjectID != "project-http-1" ||
		captured.UserID != "user-http-1" ||
		captured.Required != true {
		t.Fatalf("expected orchestrator skill HTTP request payload, got %+v", captured)
	}

	foundExecutedHTTP := false
	foundRunnerMetadata := false
	for _, event := range events {
		if event.name != "step" {
			continue
		}
		payload, ok := event.payload.(map[string]interface{})
		if !ok || payload["id"] != "capability:resolve" {
			continue
		}
		if payload["status"] != "done" {
			t.Fatalf("expected done capability resolve status, got %v", payload["status"])
		}
		meta, ok := payload["meta"].(map[string]interface{})
		if !ok {
			t.Fatalf("expected capability meta payload, got %T", payload["meta"])
		}
		result, ok := meta["execution_result"].(map[string]interface{})
		if !ok {
			t.Fatalf("expected execution result meta, got %T", meta["execution_result"])
		}
		if result["status"] != CapabilityExecutionResultStatusExecuted {
			t.Fatalf("expected executed capability result, got %v", result["status"])
		}
		for _, item := range result["items"].([]map[string]interface{}) {
			if item["capability_id"] != CapabilitySkillContractDryRun ||
				item["reason_code"] != "skill_http_orchestrator_executed" {
				continue
			}
			foundExecutedHTTP = true
			metadata := item["metadata"].(map[string]interface{})
			if metadata["source"] == "capability_runner" &&
				metadata["runner_mode"] == "skill-http" &&
				metadata["provider_resolution_status"] == CapabilityResolutionStatusResolved &&
				metadata["from_orchestrator_test_server"] == true {
				foundRunnerMetadata = true
			}
		}
	}
	if !foundExecutedHTTP {
		t.Fatal("expected Skill HTTP capability execution result in capability resolve event")
	}
	if !foundRunnerMetadata {
		t.Fatal("expected Skill HTTP runner metadata with catalog evidence in capability resolve event")
	}
}

func TestGenerateOrchestratorOnlineContextCapabilityIsOptionalWhenProviderUnavailable(t *testing.T) {
	orchestrator := NewGenerateOrchestratorWithOptions(nil, nil, nil, nil, GenerateOrchestratorOptions{
		CapabilityExecutor: ExternalCapabilityExecutor{
			Fallback: NoopCapabilityExecutor{},
		},
	})
	var events []capturedStreamEvent

	err := orchestrator.Generate(context.Background(), GenerateCommand{
		Prompt: "联网核验当前依赖版本",
		Online: true,
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageImplement,
			WorkflowMode:  WorkflowModeImplement,
		},
	}, newCapturedStreamHandler(&events))
	if !errors.Is(err, ErrGenerateOrchestrationUnavailable) {
		t.Fatalf("expected generation to continue past capability resolve and fail only because generator is unavailable, got %v", err)
	}

	foundOnlinePlan := false
	foundSkippedResolution := false
	foundSkippedAudit := false
	foundSkippedResult := false
	for _, event := range events {
		if event.name != "step" {
			continue
		}
		payload, ok := event.payload.(map[string]interface{})
		if !ok || payload["id"] != "capability:resolve" {
			continue
		}
		if payload["status"] != "done" {
			t.Fatalf("expected online optional capability to keep capability resolve done, got %v", payload["status"])
		}
		meta, ok := payload["meta"].(map[string]interface{})
		if !ok {
			t.Fatalf("expected capability meta payload, got %T", payload["meta"])
		}
		plan, ok := meta["capability_plan"].(map[string]interface{})
		if !ok {
			t.Fatalf("expected capability plan meta, got %T", meta["capability_plan"])
		}
		for _, item := range plan["capabilities"].([]map[string]interface{}) {
			if item["id"] == CapabilityOnlineContextSearchCrawl && item["required"] == false {
				foundOnlinePlan = true
			}
		}
		resolution := meta["provider_resolution"].(map[string]interface{})
		if resolution["status"] != CapabilityResolutionStatusResolved {
			t.Fatalf("expected optional online provider unavailable to keep resolution resolved, got %v", resolution["status"])
		}
		for _, item := range resolution["items"].([]map[string]interface{}) {
			if item["capability_id"] == CapabilityOnlineContextSearchCrawl && item["status"] == CapabilityResolutionStatusSkipped {
				foundSkippedResolution = true
			}
		}
		audit := meta["execution_audit"].(map[string]interface{})
		for _, item := range audit["items"].([]map[string]interface{}) {
			if item["capability_id"] == CapabilityOnlineContextSearchCrawl && item["reason_code"] == "optional_provider_unavailable" {
				foundSkippedAudit = true
			}
		}
		result := meta["execution_result"].(map[string]interface{})
		if result["status"] == CapabilityExecutionResultStatusBlocked {
			t.Fatalf("expected optional online capability not to block execution result, got %#v", result)
		}
		for _, item := range result["items"].([]map[string]interface{}) {
			if item["capability_id"] == CapabilityOnlineContextSearchCrawl && item["status"] == CapabilityExecutionResultStatusSkipped {
				foundSkippedResult = true
			}
		}
	}
	if !foundOnlinePlan {
		t.Fatal("expected online context capability in capability plan")
	}
	if !foundSkippedResolution {
		t.Fatal("expected skipped online context provider resolution")
	}
	if !foundSkippedAudit {
		t.Fatal("expected optional provider unavailable audit item")
	}
	if !foundSkippedResult {
		t.Fatal("expected skipped online context execution result")
	}
}

func TestGenerateOrchestratorOnlineContextCapabilityIsOptionalWhenExecutionPolicyDisabled(t *testing.T) {
	orchestrator := NewGenerateOrchestratorWithOptions(nil, nil, nil, nil, GenerateOrchestratorOptions{
		CapabilityExecutor: ExternalCapabilityExecutor{
			Fallback: NoopCapabilityExecutor{},
			Policy: CapabilityExecutionPolicy{
				EnableMCP:  false,
				SourceNote: "测试禁用 MCP runner 执行。",
			},
		},
		CapabilityRegistry: NewCapabilityProviderRegistry(CapabilityProviderRegistryOptions{
			EnableMCPProvider: true,
			SourceNote:        "测试启用 MCP provider 解析。",
		}),
	})
	var events []capturedStreamEvent

	err := orchestrator.Generate(context.Background(), GenerateCommand{
		Prompt: "联网核验当前依赖版本",
		Online: true,
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageImplement,
			WorkflowMode:  WorkflowModeImplement,
		},
	}, newCapturedStreamHandler(&events))
	if !errors.Is(err, ErrGenerateOrchestrationUnavailable) {
		t.Fatalf("expected generation to continue when optional online execution policy is disabled, got %v", err)
	}

	foundPolicySkipped := false
	for _, event := range events {
		if event.name != "step" {
			continue
		}
		payload, ok := event.payload.(map[string]interface{})
		if !ok || payload["id"] != "capability:resolve" {
			continue
		}
		if payload["status"] != "done" {
			t.Fatalf("expected optional online execution policy disabled to keep capability resolve done, got %v", payload["status"])
		}
		meta := payload["meta"].(map[string]interface{})
		result := meta["execution_result"].(map[string]interface{})
		if result["status"] == CapabilityExecutionResultStatusBlocked {
			t.Fatalf("expected optional online execution policy disabled not to block result, got %#v", result)
		}
		for _, item := range result["items"].([]map[string]interface{}) {
			if item["capability_id"] == CapabilityOnlineContextSearchCrawl &&
				item["status"] == CapabilityExecutionResultStatusSkipped &&
				item["reason_code"] == "external_capability_execution_disabled" {
				metadata := item["metadata"].(map[string]interface{})
				if metadata["optional"] == true && metadata["original_status"] == CapabilityExecutionResultStatusBlocked {
					foundPolicySkipped = true
				}
			}
		}
	}
	if !foundPolicySkipped {
		t.Fatal("expected optional online execution policy disabled result to be skipped with diagnostic metadata")
	}
}

func TestGenerateOrchestratorBootstrapStageEmitsFoundationEvents(t *testing.T) {
	orchestrator := NewGenerateOrchestrator(nil, nil, nil, nil)
	events := make([]capturedStreamEvent, 0)

	err := orchestrator.Generate(context.Background(), GenerateCommand{
		Prompt: "我们先做 Project Foundation 决策",
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageBootstrapReview,
			WorkflowMode:  WorkflowModeFoundation,
		},
		AppType: "ai_agent",
	}, newCapturedStreamHandler(&events))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(events) == 0 {
		t.Fatal("expected bootstrap events to be emitted")
	}

	stepCount := 0
	doneFound := false
	foundTemplateSelection := false
	foundBootstrapState := false
	for _, event := range events {
		if event.name == "step" {
			stepCount++
			payload, ok := event.payload.(map[string]interface{})
			if !ok {
				t.Fatalf("expected step payload map, got %T", event.payload)
			}
			meta, _ := payload["meta"].(map[string]interface{})
			if meta != nil && meta["event_name"] == "bootstrap_template_selected" {
				foundTemplateSelection = true
			}
			engineeringState := assertStepEngineeringStatePhase(t, payload, "")
			if _, ok := engineeringState["bootstrap_state"].(map[string]interface{}); ok {
				foundBootstrapState = true
			}
		}
		if event.name == "done" {
			doneFound = true
		}
	}

	if stepCount < 4 {
		t.Fatalf("expected at least 4 bootstrap step events, got %d", stepCount)
	}
	if !doneFound {
		t.Fatal("expected done event for bootstrap stage")
	}
	if !foundTemplateSelection {
		t.Fatal("expected bootstrap_template_selected event")
	}
	if !foundBootstrapState {
		t.Fatal("expected bootstrap_state in emitted engineeringState payload")
	}
}

func TestGenerateOrchestratorBootstrapConfirmedUsesWorkbenchSelections(t *testing.T) {
	orchestrator := NewGenerateOrchestrator(nil, nil, nil, nil)
	events := make([]capturedStreamEvent, 0)

	err := orchestrator.Generate(context.Background(), GenerateCommand{
		Prompt: "请确认当前 Project Foundation 决策，并基于以下工作台选择输出最终确认结果，准备进入下一阶段。\nMust Decide Now:\n- 身份认证方式 (identity.auth_mode): 邮箱登录 + 邀请码；备注：首版不接 SSO\nReserve Extension Now:\n- Feature Flag 扩展口 (config.feature_flags): 保留开关边界；备注：先只保留接口\n请将 must_decide_now 视为已确认，并给出 Gate 结论与下一步。",
		Context: OrchestrationContext{
			WorkflowStage: WorkflowStageBootstrapConfirmed,
			WorkflowMode:  WorkflowModeFoundation,
		},
		AppType: "ai_agent",
	}, newCapturedStreamHandler(&events))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	var donePayload map[string]interface{}
	foundCompletedStep := false
	for _, event := range events {
		if event.name == "step" {
			payload, ok := event.payload.(map[string]interface{})
			if !ok {
				t.Fatalf("expected step payload map, got %T", event.payload)
			}
			if payload["id"] == "bootstrap:completed" && payload["status"] == "done" {
				meta, _ := payload["meta"].(map[string]interface{})
				if meta["event_name"] != "bootstrap_completed" {
					t.Fatalf("expected bootstrap_completed event name, got %v", meta["event_name"])
				}
				assertStepEngineeringStatePhase(t, payload, EngineeringStatusPassed)
				foundCompletedStep = true
			}
		}
		if event.name == "done" {
			payload, ok := event.payload.(map[string]interface{})
			if !ok {
				t.Fatalf("expected done payload map, got %T", event.payload)
			}
			donePayload = payload
			break
		}
	}
	if donePayload == nil {
		t.Fatal("expected done event payload")
	}
	if !foundCompletedStep {
		t.Fatal("expected bootstrap_completed step event")
	}

	bootstrapState, ok := donePayload["bootstrap_state"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected bootstrap_state payload, got %T", donePayload["bootstrap_state"])
	}

	requiredDecisions, ok := bootstrapState["required_decisions"].([]map[string]interface{})
	if !ok {
		rawItems, rawOk := bootstrapState["required_decisions"].([]interface{})
		if !rawOk {
			t.Fatalf("expected required_decisions array, got %T", bootstrapState["required_decisions"])
		}
		requiredDecisions = make([]map[string]interface{}, 0, len(rawItems))
		for _, rawItem := range rawItems {
			item, itemOK := rawItem.(map[string]interface{})
			if !itemOK {
				t.Fatalf("expected decision payload map, got %T", rawItem)
			}
			requiredDecisions = append(requiredDecisions, item)
		}
	}

	var authMode map[string]interface{}
	for _, item := range requiredDecisions {
		if item["id"] == "identity.auth_mode" {
			authMode = item
			break
		}
	}
	if authMode == nil {
		t.Fatal("expected identity.auth_mode decision in required_decisions")
	}
	if authMode["selected_option"] != "邮箱登录 + 邀请码" {
		t.Fatalf("expected selected_option to use workbench value, got %v", authMode["selected_option"])
	}
	if authMode["notes"] != "首版不接 SSO" {
		t.Fatalf("expected notes to use workbench value, got %v", authMode["notes"])
	}
	designReadiness, ok := bootstrapState["design_readiness"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected design_readiness payload, got %T", bootstrapState["design_readiness"])
	}
	if designReadiness["status"] != "ready" {
		t.Fatalf("expected design readiness ready, got %v", designReadiness["status"])
	}
	if designReadiness["tech_stack_ready"] != true ||
		designReadiness["architecture_ready"] != true ||
		designReadiness["directory_structure_ready"] != true ||
		designReadiness["interface_contract_ready"] != true ||
		designReadiness["data_model_ready"] != true {
		t.Fatalf("expected all design readiness facts true, got %+v", designReadiness)
	}
}

func TestMarshalBootstrapStateEnvelopeIncludesEnvelopeAndState(t *testing.T) {
	raw, err := marshalBootstrapStateEnvelope(&BootstrapState{
		SchemaVersion: "v1",
		Status:        "completed",
		TemplateID:    "ai_agent_platform",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("expected valid json, got %v", err)
	}
	if payload["schema_version"] != "v1" {
		t.Fatalf("expected schema_version %q, got %v", "v1", payload["schema_version"])
	}
	updatedAt, ok := payload["updated_at"].(string)
	if !ok || strings.TrimSpace(updatedAt) == "" {
		t.Fatalf("expected updated_at string, got %v", payload["updated_at"])
	}
	state, ok := payload["state"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected state payload, got %T", payload["state"])
	}
	if state["status"] != "completed" {
		t.Fatalf("expected bootstrap status %q, got %v", "completed", state["status"])
	}
	if state["template_id"] != "ai_agent_platform" {
		t.Fatalf("expected template_id %q, got %v", "ai_agent_platform", state["template_id"])
	}
}
