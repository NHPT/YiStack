package orchestration

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"yistack/internal/service"
)

const FoundationGateBeforeImplement = "foundation-before-implement"
const FoundationGateBeforePlan = "foundation-before-plan"

type projectArtifactLoader interface {
	LoadProjectArtifact(ctx context.Context, projectID, filePath string) (string, bool, error)
}

// FoundationGateError 表示 Project Foundation 门禁阻断。
type FoundationGateError struct {
	Gate  string
	State EngineeringState
	Err   error
}

func (e *FoundationGateError) Error() string {
	if e == nil {
		return ""
	}
	if e.Err != nil {
		return fmt.Sprintf("foundation gate %s blocked: %v", e.Gate, e.Err)
	}
	return fmt.Sprintf("foundation gate %s blocked", e.Gate)
}

func (e *FoundationGateError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

func isFoundationGateError(err error) bool {
	var target *FoundationGateError
	return errors.As(err, &target)
}

type persistedBootstrapStateEnvelope struct {
	SchemaVersion string                  `json:"schema_version"`
	State         persistedBootstrapState `json:"state"`
}

type persistedBootstrapState struct {
	SchemaVersion       string                             `json:"schema_version"`
	Status              string                             `json:"status"`
	TemplateID          string                             `json:"template_id"`
	ProjectType         string                             `json:"project_type"`
	RequiredDecisions   []persistedBootstrapDecisionItem   `json:"required_decisions"`
	ReservedExtensions  []persistedBootstrapDecisionItem   `json:"reserved_extensions"`
	DeferredDecisions   []persistedBootstrapDecisionItem   `json:"deferred_decisions"`
	Blockers            []string                           `json:"blockers"`
	NextAction          string                             `json:"next_action"`
	ApprovalRequired    bool                               `json:"approval_required"`
	FoundationRiskLevel string                             `json:"foundation_risk_level"`
	DesignReadiness     *persistedBootstrapDesignReadiness `json:"design_readiness"`
	GateResult          *persistedBootstrapGateResult      `json:"gate_result"`
}

type persistedBootstrapDesignReadiness struct {
	Status                  string   `json:"status"`
	TechStackReady          bool     `json:"tech_stack_ready"`
	ArchitectureReady       bool     `json:"architecture_ready"`
	DirectoryStructureReady bool     `json:"directory_structure_ready"`
	InterfaceContractReady  bool     `json:"interface_contract_ready"`
	DataModelReady          bool     `json:"data_model_ready"`
	MissingItems            []string `json:"missing_items"`
}

type persistedBootstrapDecisionItem struct {
	ID                string   `json:"id"`
	Domain            string   `json:"domain"`
	Title             string   `json:"title"`
	Description       string   `json:"description"`
	Bucket            string   `json:"bucket"`
	Status            string   `json:"status"`
	Owner             string   `json:"owner"`
	Rationale         string   `json:"rationale"`
	RecommendedOption string   `json:"recommended_option"`
	SelectedOption    string   `json:"selected_option"`
	Notes             string   `json:"notes"`
	RisksIfUnset      []string `json:"risks_if_unset"`
	FollowupActions   []string `json:"followup_actions"`
	ArtifactTargets   []string `json:"artifact_targets"`
}

type persistedBootstrapGateResult struct {
	Decision      string   `json:"decision"`
	Reasons       []string `json:"reasons"`
	BlockingItems []string `json:"blocking_items"`
	WarningItems  []string `json:"warning_items"`
	NextAction    string   `json:"next_action"`
}

func executeFoundationGate(ctx context.Context, command GenerateCommand, generatorService projectArtifactLoader, state EngineeringState, handler service.StreamEventHandler) (context.Context, error) {
	if strings.TrimSpace(command.Context.WorkflowMode) != WorkflowModeImplement {
		return ctx, nil
	}
	if generatorService == nil || strings.TrimSpace(command.ProjectID) == "" {
		return ctx, nil
	}

	content, found, err := generatorService.LoadProjectArtifact(ctx, command.ProjectID, service.ProjectBootstrapStatePath)
	if err != nil {
		reasons := []string{foundationGateArtifactReadFailureReason(err)}
		state.BootstrapState = buildBlockedBootstrapState(reasons)
		ctx, state = buildFoundationGateBlockedState(
			ctx,
			state,
			FoundationGateBeforeImplement,
			"检查 Project Foundation 门禁",
			"完成 Project Foundation 必要决策后重试",
			command.Context,
			reasons,
			buildFoundationGateRecoveryState(command, reasons),
			handler,
		)
		return ctx, &FoundationGateError{
			Gate:  FoundationGateBeforeImplement,
			State: state,
			Err:   fmt.Errorf("failed to read %s: %w", service.ProjectBootstrapStatePath, err),
		}
	}

	bootstrapState, reasons := evaluateFoundationGateState(found, content)
	if len(reasons) == 0 {
		return ctx, nil
	}

	state.BootstrapState = bootstrapState
	ctx, state = buildFoundationGateBlockedState(
		ctx,
		state,
		FoundationGateBeforeImplement,
		"检查 Project Foundation 门禁",
		"完成 Project Foundation 必要决策后重试",
		command.Context,
		reasons,
		buildFoundationGateRecoveryState(command, reasons),
		handler,
	)

	return ctx, &FoundationGateError{
		Gate:  FoundationGateBeforeImplement,
		State: state,
		Err:   errors.New(strings.Join(reasons, "; ")),
	}
}

func executeFoundationGateBeforePlan(ctx context.Context, command GeneratePlansCommand, artifactLoader projectArtifactLoader, state EngineeringState, handler service.StreamEventHandler) (context.Context, error) {
	if strings.TrimSpace(command.Context.WorkflowMode) != WorkflowModePlan {
		return ctx, nil
	}
	if artifactLoader == nil || strings.TrimSpace(command.ProjectID) == "" {
		return ctx, nil
	}

	content, found, err := artifactLoader.LoadProjectArtifact(ctx, command.ProjectID, service.ProjectBootstrapStatePath)
	if err != nil {
		reasons := []string{foundationGateArtifactReadFailureReason(err)}
		state.BootstrapState = buildBlockedBootstrapState(reasons)
		ctx, state = buildFoundationGateBlockedState(
			ctx,
			state,
			FoundationGateBeforePlan,
			"检查 Plan 前 Foundation 门禁",
			"完成 Project Foundation 必要决策后再生成 Plan",
			command.Context,
			reasons,
			buildFoundationGateRecoveryStateForPlan(command, reasons),
			handler,
		)
		return ctx, &FoundationGateError{
			Gate:  FoundationGateBeforePlan,
			State: state,
			Err:   fmt.Errorf("failed to read %s: %w", service.ProjectBootstrapStatePath, err),
		}
	}

	bootstrapState, reasons := evaluateFoundationGateState(found, content)
	if len(reasons) == 0 {
		return ctx, nil
	}

	state.BootstrapState = bootstrapState
	ctx, state = buildFoundationGateBlockedState(
		ctx,
		state,
		FoundationGateBeforePlan,
		"检查 Plan 前 Foundation 门禁",
		"完成 Project Foundation 必要决策后再生成 Plan",
		command.Context,
		reasons,
		buildFoundationGateRecoveryStateForPlan(command, reasons),
		handler,
	)

	return ctx, &FoundationGateError{
		Gate:  FoundationGateBeforePlan,
		State: state,
		Err:   errors.New(strings.Join(reasons, "; ")),
	}
}

func evaluateFoundationGateState(found bool, content string) (*BootstrapState, []string) {
	if !found || strings.TrimSpace(content) == "" {
		return buildBlockedBootstrapState([]string{"缺少 " + service.ProjectBootstrapStatePath + "，Project Foundation 尚未完成"}), []string{"缺少 " + service.ProjectBootstrapStatePath + "，Project Foundation 尚未完成"}
	}

	var envelope persistedBootstrapStateEnvelope
	if err := json.Unmarshal([]byte(content), &envelope); err != nil {
		reasons := []string{service.ProjectBootstrapStatePath + " 不是合法 JSON，无法确认 Project Foundation 状态"}
		return buildBlockedBootstrapState(reasons), reasons
	}

	state := bootstrapStateFromPersisted(envelope)
	reasons := foundationGateBlockingReasons(state)
	if len(reasons) == 0 {
		return state, nil
	}
	state.Status = firstNonEmpty(state.Status, "blocked")
	state.ApprovalRequired = true
	state.Blockers = mergeUniqueStrings(state.Blockers, reasons)
	state.GateResult = &BootstrapGateResult{
		Decision:      "block",
		Reasons:       reasons,
		BlockingItems: reasons,
		WarningItems:  []string{},
		NextAction:    "回到 Project Foundation review，确认 must_decide_now 决策后再进入实现。",
	}
	return state, reasons
}

func foundationGateBlockingReasons(state *BootstrapState) []string {
	if state == nil {
		return []string{"Project Foundation 状态缺失"}
	}

	reasons := make([]string, 0, 4)
	if strings.TrimSpace(state.Status) != "completed" {
		reasons = append(reasons, "Project Foundation 尚未确认完成")
	}
	for _, blocker := range state.Blockers {
		if trimmed := strings.TrimSpace(blocker); trimmed != "" {
			reasons = append(reasons, trimmed)
		}
	}
	for _, item := range state.RequiredDecisions {
		if strings.TrimSpace(item.Bucket) == "must_decide_now" && strings.TrimSpace(item.Status) != "confirmed" {
			reasons = append(reasons, fmt.Sprintf("must_decide_now 决策未确认：%s", firstNonEmpty(item.Title, item.ID)))
		}
	}
	designReadiness := buildBootstrapDesignReadiness(state.RequiredDecisions)
	state.DesignReadiness = designReadiness
	for _, missingItem := range missingBootstrapDesignReadinessItems(designReadiness) {
		reasons = append(reasons, "生成前设计 readiness 未完成："+missingItem)
	}
	return uniqueStrings(reasons)
}

func foundationGateArtifactReadFailureReason(err error) string {
	if err == nil {
		return service.ProjectBootstrapStatePath + " 读取失败，无法确认 Project Foundation 状态"
	}
	return fmt.Sprintf("%s 读取失败：%s", service.ProjectBootstrapStatePath, err.Error())
}

func buildFoundationGateBlockedState(
	ctx context.Context,
	state EngineeringState,
	gate string,
	stepTitle string,
	nextAction string,
	commandContext OrchestrationContext,
	reasons []string,
	recovery *RecoveryState,
	handler service.StreamEventHandler,
) (context.Context, EngineeringState) {
	state = state.withWorkflowStatus(EngineeringStatusFailed).
		withValidationStatus(EngineeringStatusFailed).
		withCurrentTask("处理 Project Foundation 门禁阻断").
		withExecutionAutoProgress(false).
		withExecutionPause(true, "foundation_gate_blocked", "foundation_review", nextAction).
		withRecovery(recovery)
	ctx = withEngineeringState(ctx, state)

	step := buildEngineeringStateStep(
		"foundation:"+gate,
		"foundation_gate",
		stepTitle,
		strings.Join(reasons, "；"),
		"failed",
		state,
		map[string]interface{}{
			"gate":           gate,
			"workflow_stage": commandContext.WorkflowStage,
			"workflow_mode":  commandContext.WorkflowMode,
		},
	)
	_ = emitEngineeringStateStep(handler, step)

	return ctx, state
}

func buildBlockedBootstrapState(reasons []string) *BootstrapState {
	return &BootstrapState{
		SchemaVersion:    ProjectBootstrapStateSchemaVersion,
		Status:           "blocked",
		Blockers:         normalizeStringSlice(reasons),
		ApprovalRequired: true,
		NextAction:       "回到 Project Foundation review，确认必要决策后再继续。",
		GateResult: &BootstrapGateResult{
			Decision:      "block",
			Reasons:       normalizeStringSlice(reasons),
			BlockingItems: normalizeStringSlice(reasons),
			WarningItems:  []string{},
			NextAction:    "回到 Project Foundation review，确认必要决策后再继续。",
		},
	}
}

func buildFoundationGateRecoveryState(command GenerateCommand, reasons []string) *RecoveryState {
	reasonMessage := "Project Foundation 尚未完成，已阻断进入实现。"
	if len(reasons) > 0 {
		reasonMessage = reasons[0]
	}
	return &RecoveryState{
		Blocked:       true,
		ReasonCode:    "foundation_gate_blocked",
		ReasonMessage: reasonMessage,
		ResumeStage:   WorkflowStageBootstrapReview,
		ResumeMode:    WorkflowModeFoundation,
		CanRetry:      true,
		RetryLabel:    "回到 Foundation 修复",
		RetryPrompt:   buildFoundationGateRetryPrompt(command),
	}
}

func buildFoundationGateRecoveryStateForPlan(command GeneratePlansCommand, reasons []string) *RecoveryState {
	reasonMessage := "Project Foundation 尚未完成，已阻断进入 Plan。"
	if len(reasons) > 0 {
		reasonMessage = reasons[0]
	}
	return &RecoveryState{
		Blocked:       true,
		ReasonCode:    "foundation_gate_blocked",
		ReasonMessage: reasonMessage,
		ResumeStage:   WorkflowStageBootstrapReview,
		ResumeMode:    WorkflowModeFoundation,
		CanRetry:      true,
		RetryLabel:    "回到 Foundation 修复",
		RetryPrompt:   buildFoundationGateRetryPromptForPlan(command),
	}
}

func buildFoundationGateRetryPromptForPlan(command GeneratePlansCommand) string {
	description := strings.TrimSpace(command.Description)
	if description == "" {
		description = "当前项目"
	}
	return "请回到 Project Foundation review，检查并确认 " + description + " 的 must_decide_now 决策项。完成确认后再生成 Plan。"
}

func buildFoundationGateRetryPrompt(command GenerateCommand) string {
	projectName := strings.TrimSpace(command.ProjectName)
	if projectName == "" {
		projectName = "当前项目"
	}
	return "请回到 Project Foundation review，检查并确认 " + projectName + " 的 must_decide_now 决策项。完成确认后再继续实现。"
}

func bootstrapStateFromPersisted(envelope persistedBootstrapStateEnvelope) *BootstrapState {
	raw := envelope.State
	return &BootstrapState{
		SchemaVersion:       firstNonEmpty(raw.SchemaVersion, envelope.SchemaVersion, ProjectBootstrapStateSchemaVersion),
		Status:              strings.TrimSpace(raw.Status),
		TemplateID:          strings.TrimSpace(raw.TemplateID),
		ProjectType:         strings.TrimSpace(raw.ProjectType),
		RequiredDecisions:   bootstrapDecisionItemsFromPersisted(raw.RequiredDecisions),
		ReservedExtensions:  bootstrapDecisionItemsFromPersisted(raw.ReservedExtensions),
		DeferredDecisions:   bootstrapDecisionItemsFromPersisted(raw.DeferredDecisions),
		Blockers:            normalizeStringSlice(raw.Blockers),
		NextAction:          strings.TrimSpace(raw.NextAction),
		ApprovalRequired:    raw.ApprovalRequired,
		FoundationRiskLevel: strings.TrimSpace(raw.FoundationRiskLevel),
		DesignReadiness:     bootstrapDesignReadinessFromPersisted(raw.DesignReadiness),
		GateResult:          bootstrapGateResultFromPersisted(raw.GateResult),
	}
}

func bootstrapDesignReadinessFromPersisted(readiness *persistedBootstrapDesignReadiness) *BootstrapDesignReadiness {
	if readiness == nil {
		return nil
	}
	return &BootstrapDesignReadiness{
		Status:                  strings.TrimSpace(readiness.Status),
		TechStackReady:          readiness.TechStackReady,
		ArchitectureReady:       readiness.ArchitectureReady,
		DirectoryStructureReady: readiness.DirectoryStructureReady,
		InterfaceContractReady:  readiness.InterfaceContractReady,
		DataModelReady:          readiness.DataModelReady,
		MissingItems:            normalizeStringSlice(readiness.MissingItems),
	}
}

func bootstrapDecisionItemsFromPersisted(items []persistedBootstrapDecisionItem) []BootstrapDecisionItem {
	if len(items) == 0 {
		return nil
	}
	next := make([]BootstrapDecisionItem, 0, len(items))
	for _, item := range items {
		next = append(next, BootstrapDecisionItem{
			ID:                strings.TrimSpace(item.ID),
			Domain:            strings.TrimSpace(item.Domain),
			Title:             strings.TrimSpace(item.Title),
			Description:       strings.TrimSpace(item.Description),
			Bucket:            strings.TrimSpace(item.Bucket),
			Status:            strings.TrimSpace(item.Status),
			Owner:             strings.TrimSpace(item.Owner),
			Rationale:         strings.TrimSpace(item.Rationale),
			RecommendedOption: strings.TrimSpace(item.RecommendedOption),
			SelectedOption:    strings.TrimSpace(item.SelectedOption),
			Notes:             strings.TrimSpace(item.Notes),
			RisksIfUnset:      normalizeStringSlice(item.RisksIfUnset),
			FollowupActions:   normalizeStringSlice(item.FollowupActions),
			ArtifactTargets:   normalizeStringSlice(item.ArtifactTargets),
		})
	}
	return next
}

func bootstrapGateResultFromPersisted(result *persistedBootstrapGateResult) *BootstrapGateResult {
	if result == nil {
		return nil
	}
	return &BootstrapGateResult{
		Decision:      strings.TrimSpace(result.Decision),
		Reasons:       normalizeStringSlice(result.Reasons),
		BlockingItems: normalizeStringSlice(result.BlockingItems),
		WarningItems:  normalizeStringSlice(result.WarningItems),
		NextAction:    strings.TrimSpace(result.NextAction),
	}
}

func mergeUniqueStrings(existing []string, values []string) []string {
	return uniqueStrings(append(append([]string{}, existing...), values...))
}

func uniqueStrings(values []string) []string {
	seen := map[string]bool{}
	next := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" || seen[trimmed] {
			continue
		}
		seen[trimmed] = true
		next = append(next, trimmed)
	}
	if len(next) == 0 {
		return []string{}
	}
	return next
}
