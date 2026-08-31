package orchestration

import "strings"

const (
	EngineeringStatusPending       = "pending"
	EngineeringStatusRunning       = "running"
	EngineeringStatusPassed        = "passed"
	EngineeringStatusFailed        = "failed"
	EngineeringStatusNotApplicable = "not_applicable"

	ProjectBootstrapStateSchemaVersion = "v1"
)

// WorkflowState 描述主链路工作流状态。
type WorkflowState struct {
	Stage  string
	Mode   string
	Status string
}

// ValidationState 描述验证门禁状态。
type ValidationState struct {
	Gate         string
	Status       string
	FailureItems []ValidationFailureItem
}

// ValidationFailureItem 描述验证门禁失败项。
type ValidationFailureItem struct {
	ID         string
	Title      string
	Detail     string
	Severity   string
	Suggestion string
	FilePath   string
	LineNumber int
	Column     int
	SearchText string
}

// RuntimeState 描述运行时准备状态。
type RuntimeState struct {
	ProjectID   string
	AppType     string
	ProjectName string
	Status      string
}

// ExecutionState 描述自动推进与暂停确认语义。
type ExecutionState struct {
	AutoProgressEnabled  bool
	AwaitingConfirmation bool
	PauseReason          string
	ApprovalBoundary     string
	CurrentTask          string
	NextAction           string
}

// RecoveryState 描述阻断后的恢复与重试语义。
type RecoveryState struct {
	Blocked       bool
	ReasonCode    string
	ReasonMessage string
	ResumeStage   string
	ResumeMode    string
	CanRetry      bool
	RetryLabel    string
	RetryPrompt   string
}

// BootstrapDecisionItem 描述前置设计决策项快照。
type BootstrapDecisionItem struct {
	ID                string
	Domain            string
	Title             string
	Description       string
	Bucket            string
	Status            string
	Owner             string
	Rationale         string
	RecommendedOption string
	SelectedOption    string
	Notes             string
	RisksIfUnset      []string
	FollowupActions   []string
	ArtifactTargets   []string
}

// BootstrapGateResult 描述前置设计门禁结果。
type BootstrapGateResult struct {
	Decision      string
	Reasons       []string
	BlockingItems []string
	WarningItems  []string
	NextAction    string
}

// BootstrapDesignReadiness describes whether Foundation has enough pre-generation design facts.
type BootstrapDesignReadiness struct {
	Status                  string
	TechStackReady          bool
	ArchitectureReady       bool
	DirectoryStructureReady bool
	InterfaceContractReady  bool
	DataModelReady          bool
	MissingItems            []string
}

// BootstrapState 描述 Project Foundation / bootstrap 的最小状态快照。
type BootstrapState struct {
	SchemaVersion       string
	Status              string
	TemplateID          string
	ProjectType         string
	RequiredDecisions   []BootstrapDecisionItem
	ReservedExtensions  []BootstrapDecisionItem
	DeferredDecisions   []BootstrapDecisionItem
	Blockers            []string
	NextAction          string
	ApprovalRequired    bool
	FoundationRiskLevel string
	DesignReadiness     *BootstrapDesignReadiness
	GateResult          *BootstrapGateResult
}

// EngineeringState 描述主链路最小工程状态快照。
type EngineeringState struct {
	Workflow       WorkflowState
	Validation     ValidationState
	Runtime        RuntimeState
	Execution      ExecutionState
	Recovery       *RecoveryState
	BootstrapState *BootstrapState
}

func engineeringStatePayload(state EngineeringState) map[string]interface{} {
	payload := map[string]interface{}{
		"workflow": map[string]interface{}{
			"stage":  strings.TrimSpace(state.Workflow.Stage),
			"mode":   strings.TrimSpace(state.Workflow.Mode),
			"status": strings.TrimSpace(state.Workflow.Status),
		},
		"validation": map[string]interface{}{
			"gate":          strings.TrimSpace(state.Validation.Gate),
			"status":        strings.TrimSpace(state.Validation.Status),
			"failure_items": validationFailureItemsPayload(state.Validation.FailureItems),
		},
		"runtime": map[string]interface{}{
			"project_id":   strings.TrimSpace(state.Runtime.ProjectID),
			"app_type":     strings.TrimSpace(state.Runtime.AppType),
			"project_name": strings.TrimSpace(state.Runtime.ProjectName),
			"status":       strings.TrimSpace(state.Runtime.Status),
		},
		"phase": phaseStatePayload(state),
		"execution": map[string]interface{}{
			"auto_progress_enabled": state.Execution.AutoProgressEnabled,
			"awaiting_confirmation": state.Execution.AwaitingConfirmation,
			"pause_reason":          strings.TrimSpace(state.Execution.PauseReason),
			"approval_boundary":     strings.TrimSpace(state.Execution.ApprovalBoundary),
			"current_task":          strings.TrimSpace(state.Execution.CurrentTask),
			"next_action":           strings.TrimSpace(state.Execution.NextAction),
		},
	}
	if state.Recovery != nil {
		payload["recovery"] = map[string]interface{}{
			"blocked":        state.Recovery.Blocked,
			"reason_code":    strings.TrimSpace(state.Recovery.ReasonCode),
			"reason_message": strings.TrimSpace(state.Recovery.ReasonMessage),
			"resume_stage":   strings.TrimSpace(state.Recovery.ResumeStage),
			"resume_mode":    strings.TrimSpace(state.Recovery.ResumeMode),
			"can_retry":      state.Recovery.CanRetry,
			"retry_label":    strings.TrimSpace(state.Recovery.RetryLabel),
			"retry_prompt":   strings.TrimSpace(state.Recovery.RetryPrompt),
		}
	}
	if bootstrapPayload := bootstrapStatePayload(state.BootstrapState); bootstrapPayload != nil {
		payload["bootstrap_state"] = bootstrapPayload
	}
	return payload
}

func phaseStatePayload(state EngineeringState) map[string]interface{} {
	blockers := collectEngineeringStateBlockers(state)
	completedTasks := collectEngineeringStateCompletedTasks(state)
	nextAction := firstNonEmpty(
		state.Execution.NextAction,
		bootstrapNextAction(state.BootstrapState),
	)

	return map[string]interface{}{
		"current_phase":   workflowPhaseLabel(state.Workflow.Stage),
		"current_task":    strings.TrimSpace(state.Execution.CurrentTask),
		"completed_tasks": completedTasks,
		"blockers":        blockers,
		"next_action":     strings.TrimSpace(nextAction),
		"status":          strings.TrimSpace(state.Workflow.Status),
	}
}

func workflowPhaseLabel(stage string) string {
	switch strings.TrimSpace(stage) {
	case WorkflowStageBootstrap:
		return "项目基础设定"
	case WorkflowStageBootstrapReview:
		return "基础设定确认"
	case WorkflowStageBootstrapConfirmed:
		return "基础设定已确认"
	case WorkflowStagePlanAnalysis:
		return "方案分析"
	case WorkflowStagePlanSelection:
		return "方案选择"
	case WorkflowStagePlanApproved:
		return "已批准方案"
	case WorkflowStageImplement:
		return "实现阶段"
	default:
		return strings.TrimSpace(stage)
	}
}

func collectEngineeringStateCompletedTasks(state EngineeringState) []string {
	tasks := []string{}
	if state.BootstrapState != nil && strings.TrimSpace(state.BootstrapState.Status) == "completed" {
		tasks = append(tasks, "Project Foundation 已确认")
	}
	if strings.TrimSpace(state.Validation.Status) == EngineeringStatusPassed {
		tasks = append(tasks, "YES 校验通过")
	}
	if strings.TrimSpace(state.Runtime.Status) == EngineeringStatusPassed {
		tasks = append(tasks, "运行时已就绪")
	}
	if strings.TrimSpace(state.Workflow.Status) == EngineeringStatusPassed && strings.TrimSpace(state.Execution.CurrentTask) != "" {
		tasks = append(tasks, strings.TrimSpace(state.Execution.CurrentTask))
	}
	return normalizeStringSlice(tasks)
}

func collectEngineeringStateBlockers(state EngineeringState) []string {
	blockers := []string{}
	if state.BootstrapState != nil {
		blockers = append(blockers, state.BootstrapState.Blockers...)
		if state.BootstrapState.GateResult != nil {
			blockers = append(blockers, state.BootstrapState.GateResult.BlockingItems...)
		}
	}
	for _, item := range state.Validation.FailureItems {
		blockers = append(blockers, firstNonEmpty(item.Title, item.Detail, item.ID))
	}
	if state.Recovery != nil && state.Recovery.Blocked {
		blockers = append(blockers, firstNonEmpty(state.Recovery.ReasonMessage, state.Recovery.ReasonCode))
	}
	if strings.TrimSpace(state.Execution.PauseReason) != "" {
		blockers = append(blockers, strings.TrimSpace(state.Execution.PauseReason))
	}
	return normalizeStringSlice(blockers)
}

func bootstrapNextAction(state *BootstrapState) string {
	if state == nil {
		return ""
	}
	if state.GateResult != nil && strings.TrimSpace(state.GateResult.NextAction) != "" {
		return state.GateResult.NextAction
	}
	return state.NextAction
}

func validationFailureItemsPayload(items []ValidationFailureItem) []map[string]interface{} {
	if len(items) == 0 {
		return []map[string]interface{}{}
	}

	payload := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		payload = append(payload, map[string]interface{}{
			"id":          strings.TrimSpace(item.ID),
			"title":       strings.TrimSpace(item.Title),
			"detail":      strings.TrimSpace(item.Detail),
			"severity":    strings.TrimSpace(item.Severity),
			"suggestion":  strings.TrimSpace(item.Suggestion),
			"file_path":   strings.TrimSpace(item.FilePath),
			"line_number": item.LineNumber,
			"column":      item.Column,
			"search_text": strings.TrimSpace(item.SearchText),
		})
	}
	return payload
}

func bootstrapStatePayload(state *BootstrapState) map[string]interface{} {
	if state == nil {
		return nil
	}

	payload := map[string]interface{}{
		"schema_version":        firstNonEmpty(state.SchemaVersion, ProjectBootstrapStateSchemaVersion),
		"status":                strings.TrimSpace(state.Status),
		"template_id":           strings.TrimSpace(state.TemplateID),
		"project_type":          strings.TrimSpace(state.ProjectType),
		"required_decisions":    bootstrapDecisionItemsPayload(state.RequiredDecisions),
		"reserved_extensions":   bootstrapDecisionItemsPayload(state.ReservedExtensions),
		"deferred_decisions":    bootstrapDecisionItemsPayload(state.DeferredDecisions),
		"blockers":              normalizeStringSlice(state.Blockers),
		"next_action":           strings.TrimSpace(state.NextAction),
		"approval_required":     state.ApprovalRequired,
		"foundation_risk_level": strings.TrimSpace(state.FoundationRiskLevel),
	}
	if state.DesignReadiness != nil {
		payload["design_readiness"] = map[string]interface{}{
			"status":                    strings.TrimSpace(state.DesignReadiness.Status),
			"tech_stack_ready":          state.DesignReadiness.TechStackReady,
			"architecture_ready":        state.DesignReadiness.ArchitectureReady,
			"directory_structure_ready": state.DesignReadiness.DirectoryStructureReady,
			"interface_contract_ready":  state.DesignReadiness.InterfaceContractReady,
			"data_model_ready":          state.DesignReadiness.DataModelReady,
			"missing_items":             normalizeStringSlice(state.DesignReadiness.MissingItems),
		}
	}
	if state.GateResult != nil {
		payload["gate_result"] = map[string]interface{}{
			"decision":       strings.TrimSpace(state.GateResult.Decision),
			"reasons":        normalizeStringSlice(state.GateResult.Reasons),
			"blocking_items": normalizeStringSlice(state.GateResult.BlockingItems),
			"warning_items":  normalizeStringSlice(state.GateResult.WarningItems),
			"next_action":    strings.TrimSpace(state.GateResult.NextAction),
		}
	}
	return payload
}

func bootstrapDecisionItemsPayload(items []BootstrapDecisionItem) []map[string]interface{} {
	if len(items) == 0 {
		return []map[string]interface{}{}
	}

	payload := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		payload = append(payload, map[string]interface{}{
			"id":                 strings.TrimSpace(item.ID),
			"domain":             strings.TrimSpace(item.Domain),
			"title":              strings.TrimSpace(item.Title),
			"description":        strings.TrimSpace(item.Description),
			"bucket":             strings.TrimSpace(item.Bucket),
			"status":             strings.TrimSpace(item.Status),
			"owner":              strings.TrimSpace(item.Owner),
			"rationale":          strings.TrimSpace(item.Rationale),
			"recommended_option": strings.TrimSpace(item.RecommendedOption),
			"selected_option":    strings.TrimSpace(item.SelectedOption),
			"notes":              strings.TrimSpace(item.Notes),
			"risks_if_unset":     normalizeStringSlice(item.RisksIfUnset),
			"followup_actions":   normalizeStringSlice(item.FollowupActions),
			"artifact_targets":   normalizeStringSlice(item.ArtifactTargets),
		})
	}
	return payload
}

func normalizeStringSlice(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}

	normalized := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	if len(normalized) == 0 {
		return []string{}
	}
	return normalized
}

// EngineeringStatePayload 导出统一工程状态 payload，供 handler / recorder 复用。
func EngineeringStatePayload(state EngineeringState) map[string]interface{} {
	return engineeringStatePayload(state)
}

// BuildEngineeringState 从编排上下文推导最小工程状态快照。
func BuildEngineeringState(orchestrationContext OrchestrationContext) EngineeringState {
	workflowStatus := EngineeringStatusPending
	if strings.TrimSpace(orchestrationContext.WorkflowStage) != "" || strings.TrimSpace(orchestrationContext.WorkflowMode) != "" {
		workflowStatus = EngineeringStatusRunning
	}

	validationStatus := EngineeringStatusNotApplicable
	if strings.TrimSpace(orchestrationContext.ValidationGate) != "" {
		validationStatus = EngineeringStatusPending
	}

	runtimeStatus := EngineeringStatusNotApplicable
	if strings.TrimSpace(orchestrationContext.RuntimeProjectID) != "" ||
		strings.TrimSpace(orchestrationContext.RuntimeAppType) != "" ||
		strings.TrimSpace(orchestrationContext.RuntimeProject) != "" {
		runtimeStatus = EngineeringStatusPending
	}

	execution := ExecutionState{}
	workflowStage := strings.TrimSpace(orchestrationContext.WorkflowStage)
	workflowMode := strings.TrimSpace(orchestrationContext.WorkflowMode)
	bootstrapState := buildBootstrapState(orchestrationContext)
	if definition, ok := workflowStageDefinitionForStage(workflowStage); ok {
		execution.AutoProgressEnabled = definition.AutoProgressEnabled
		execution.ApprovalBoundary = definition.ApprovalBoundary
	}

	if workflowMode == WorkflowModeImplement {
		execution.AutoProgressEnabled = true
		execution.CurrentTask = "执行已批准计划"
	}

	if workflowStage == WorkflowStagePlanApproved {
		execution.AutoProgressEnabled = true
		execution.AwaitingConfirmation = false
		execution.PauseReason = ""
		execution.ApprovalBoundary = firstNonEmpty(execution.ApprovalBoundary, "approved_plan")
		execution.CurrentTask = "按已批准计划自动推进实现"
		execution.NextAction = "进入实现阶段并持续执行，直到遇到门禁、风险点或新的确认边界"
	}

	if workflowStage == WorkflowStagePlanSelection {
		execution.AwaitingConfirmation = true
		execution.PauseReason = "awaiting_plan_confirmation"
		execution.ApprovalBoundary = firstNonEmpty(execution.ApprovalBoundary, "plan_selection")
		execution.CurrentTask = firstNonEmpty(execution.CurrentTask, "等待方案确认")
		execution.NextAction = "确认推荐方案或继续补充约束"
	}

	if bootstrapState != nil {
		execution.AutoProgressEnabled = false
		execution.CurrentTask = firstNonEmpty(execution.CurrentTask, bootstrapCurrentTaskForStatus(bootstrapState.Status))
		execution.NextAction = firstNonEmpty(execution.NextAction, bootstrapState.NextAction)
		if bootstrapState.ApprovalRequired {
			execution.AwaitingConfirmation = true
			execution.PauseReason = firstNonEmpty(execution.PauseReason, "awaiting_foundation_confirmation")
			execution.ApprovalBoundary = firstNonEmpty(execution.ApprovalBoundary, "foundation_review")
		}
	}

	return EngineeringState{
		Workflow: WorkflowState{
			Stage:  orchestrationContext.WorkflowStage,
			Mode:   orchestrationContext.WorkflowMode,
			Status: workflowStatus,
		},
		Validation: ValidationState{
			Gate:   orchestrationContext.ValidationGate,
			Status: validationStatus,
		},
		Runtime: RuntimeState{
			ProjectID:   orchestrationContext.RuntimeProjectID,
			AppType:     orchestrationContext.RuntimeAppType,
			ProjectName: orchestrationContext.RuntimeProject,
			Status:      runtimeStatus,
		},
		Execution:      execution,
		BootstrapState: bootstrapState,
	}
}

func buildBootstrapState(orchestrationContext OrchestrationContext) *BootstrapState {
	switch strings.TrimSpace(orchestrationContext.WorkflowStage) {
	case "bootstrap":
		return &BootstrapState{
			SchemaVersion: ProjectBootstrapStateSchemaVersion,
			Status:        "collecting_decisions",
			NextAction:    "继续补充前置设计决策与边界",
		}
	case "bootstrap_review":
		return &BootstrapState{
			SchemaVersion:    ProjectBootstrapStateSchemaVersion,
			Status:           "awaiting_confirmation",
			ApprovalRequired: true,
			NextAction:       "确认前置设计决策后进入 Plan 阶段",
			GateResult: &BootstrapGateResult{
				Decision:   "warn",
				Reasons:    []string{"Project Foundation 等待确认"},
				NextAction: "确认前置设计决策后继续",
			},
		}
	case "bootstrap_confirmed":
		return &BootstrapState{
			SchemaVersion: ProjectBootstrapStateSchemaVersion,
			Status:        "completed",
			NextAction:    "进入 Plan 阶段或继续补齐低风险工件",
			GateResult: &BootstrapGateResult{
				Decision:   "allow",
				Reasons:    []string{"Project Foundation 已确认"},
				NextAction: "继续进入 Plan 阶段",
			},
		}
	default:
		return nil
	}
}

func bootstrapCurrentTaskForStatus(status string) string {
	switch strings.TrimSpace(status) {
	case "collecting_decisions":
		return "收集 Project Foundation 决策"
	case "awaiting_confirmation":
		return "等待确认 Project Foundation 决策"
	case "completed":
		return "Project Foundation 已确认"
	case "blocked":
		return "Project Foundation 已阻断"
	default:
		return ""
	}
}

func (s EngineeringState) withValidationStatus(status string) EngineeringState {
	s.Validation.Status = status
	return s
}

func (s EngineeringState) withWorkflowStatus(status string) EngineeringState {
	s.Workflow.Status = status
	return s
}

func (s EngineeringState) withExecutionAutoProgress(enabled bool) EngineeringState {
	s.Execution.AutoProgressEnabled = enabled
	return s
}

func (s EngineeringState) withExecutionPause(awaiting bool, reason, boundary, nextAction string) EngineeringState {
	s.Execution.AwaitingConfirmation = awaiting
	s.Execution.PauseReason = strings.TrimSpace(reason)
	s.Execution.ApprovalBoundary = strings.TrimSpace(boundary)
	s.Execution.NextAction = strings.TrimSpace(nextAction)
	return s
}

func (s EngineeringState) withCurrentTask(task string) EngineeringState {
	s.Execution.CurrentTask = strings.TrimSpace(task)
	return s
}

func (s EngineeringState) withNextAction(nextAction string) EngineeringState {
	s.Execution.NextAction = strings.TrimSpace(nextAction)
	return s
}

func (s EngineeringState) withRecovery(recovery *RecoveryState) EngineeringState {
	s.Recovery = recovery
	return s
}
