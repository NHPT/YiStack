package orchestration

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"yistack/internal/service"
)

// BootstrapOrchestrator 承接 Project Foundation / bootstrap 的最小编排。
type BootstrapOrchestrator struct{}

// NewBootstrapOrchestrator 创建 Foundation 编排入口。
func NewBootstrapOrchestrator() *BootstrapOrchestrator {
	return &BootstrapOrchestrator{}
}

func isBootstrapWorkflowStage(stage string) bool {
	switch strings.TrimSpace(stage) {
	case WorkflowStageBootstrap, WorkflowStageBootstrapReview, WorkflowStageBootstrapConfirmed:
		return true
	default:
		return false
	}
}

// Generate 执行最小 Foundation 编排，并输出结构化 bootstrap 事件。
func (o *BootstrapOrchestrator) Generate(ctx context.Context, command GenerateCommand, handler service.StreamEventHandler) error {
	command = command.normalized()
	ctx = withOrchestrationContext(ctx, command.Context)

	state := buildBootstrapEngineeringState(command)
	ctx = withEngineeringState(ctx, state)

	finalState := finalizeBootstrapEngineeringState(state, command)
	steps := buildBootstrapWorkflowSteps(state, finalState, command)
	for _, step := range steps {
		if err := emitEngineeringStateStep(handler, step); err != nil {
			return err
		}
	}

	if handler == nil {
		return nil
	}

	return handler(service.StreamEventDone, map[string]interface{}{
		"message":          finalState.Execution.NextAction,
		"content":          firstNonEmpty(finalState.Execution.NextAction, finalState.BootstrapState.NextAction),
		"engineeringState": engineeringStatePayload(finalState),
		"bootstrap_state":  bootstrapStatePayload(finalState.BootstrapState),
		"workflow_stage":   command.Context.WorkflowStage,
		"workflow_mode":    command.Context.WorkflowMode,
	})
}

func buildBootstrapEngineeringState(command GenerateCommand) EngineeringState {
	state := BuildEngineeringState(command.Context)
	templateID, projectType, riskLevel, required, reserved, deferred := scaffoldBootstrapState(command)
	enrichBootstrapState(state.BootstrapState, command.Context.WorkflowStage, command.Prompt, templateID, projectType, riskLevel, required, reserved, deferred)
	return state
}

func finalizeBootstrapEngineeringState(state EngineeringState, command GenerateCommand) EngineeringState {
	if strings.TrimSpace(command.Context.WorkflowStage) != WorkflowStageBootstrapConfirmed {
		return state
	}
	return state.
		withWorkflowStatus(EngineeringStatusPassed).
		withCurrentTask("Project Foundation 已确认").
		withNextAction("进入 Plan 阶段")
}

func marshalBootstrapStateEnvelope(state *BootstrapState) (string, error) {
	if state == nil {
		state = &BootstrapState{SchemaVersion: ProjectBootstrapStateSchemaVersion}
	}
	payload := map[string]interface{}{
		"schema_version": firstNonEmpty(state.SchemaVersion, ProjectBootstrapStateSchemaVersion),
		"updated_at":     time.Now().UTC().Format(time.RFC3339),
		"state":          bootstrapStatePayload(state),
	}
	raw, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func recordBootstrapEngineeringState(ctx context.Context, recorder EngineeringStateRecorder, command GenerateCommand, state EngineeringState) {
	if recorder == nil || state.BootstrapState == nil {
		return
	}

	detail := firstNonEmpty(
		state.Execution.NextAction,
		state.BootstrapState.NextAction,
		"Project Foundation 状态已写入统一工程状态快照。",
	)
	step := buildEngineeringStateStep(
		"bootstrap:state_recorded",
		"bootstrap_state_recorded",
		"记录 Project Foundation 状态",
		detail,
		"done",
		state,
		map[string]interface{}{
			"event_name":     "bootstrap_state_recorded",
			"workflow_stage": command.Context.WorkflowStage,
			"workflow_mode":  command.Context.WorkflowMode,
			"status":         state.BootstrapState.Status,
			"template_id":    state.BootstrapState.TemplateID,
			"project_type":   state.BootstrapState.ProjectType,
		},
	)

	_ = recorder.RecordEngineeringState(ctx, engineeringStateRecordParams{
		ProjectID: command.ProjectID,
		UserID:    command.UserID,
		Model:     command.Model,
		State:     state,
		Step:      step,
		Content:   detail,
	})
}

func scaffoldBootstrapState(command GenerateCommand) (string, string, string, []BootstrapDecisionItem, []BootstrapDecisionItem, []BootstrapDecisionItem) {
	templateID, projectType, riskLevel := classifyBootstrapTemplate(command.AppType)

	required := []BootstrapDecisionItem{
		bootstrapDecisionItem("identity.auth_mode", "identity", "身份认证方式", "must_decide_now", "shared", "邮箱登录 / 邀请制 / SSO", ".yistack/foundation/foundation-brief.md", ".yistack/foundation/engineering-policy.md"),
		bootstrapDecisionItem("ui.i18n_strategy", "ui", "国际化策略", "must_decide_now", "shared", "明确默认语言与本地化范围", ".yistack/foundation/foundation-brief.md"),
		bootstrapDecisionItem("contract.error_model", "contract", "错误模型与错误码", "must_decide_now", "shared", "统一错误结构与错误码", ".yistack/foundation/engineering-policy.md", ".yistack/foundation/architecture-lifecycle-spec.md"),
		bootstrapDecisionItem("config.source_of_truth", "config", "配置真源", "must_decide_now", "shared", "明确配置优先级与唯一真源", ".yistack/foundation/engineering-policy.md"),
		bootstrapDecisionItem("tech_stack.runtime_profile", "tech_stack", "技术栈与运行时 Profile", "must_decide_now", "shared", "明确前端、后端、运行时 profile 与部署边界", ".yistack/foundation/foundation-brief.md", ".yistack/foundation/architecture-lifecycle-spec.md"),
		bootstrapDecisionItem("architecture.boundary", "architecture", "架构边界", "must_decide_now", "shared", "明确模块边界、状态真源与跨层调用方向", ".yistack/foundation/architecture-lifecycle-spec.md"),
		bootstrapDecisionItem("project.directory_structure", "project", "目录结构与工件命名空间", "must_decide_now", "shared", "业务代码、docs 与 .yistack 内部工件必须分层", ".yistack/foundation/engineering-policy.md", ".yistack/foundation/architecture-lifecycle-spec.md"),
		bootstrapDecisionItem("api.interface_contract", "api", "接口契约与错误模型", "must_decide_now", "shared", "明确 API 形态、错误包装、source/details 和恢复语义", ".yistack/foundation/engineering-policy.md", ".yistack/foundation/architecture-lifecycle-spec.md"),
		bootstrapDecisionItem("data.model_strategy", "data", "数据模型与持久化策略", "must_decide_now", "shared", "当前 Supabase 真源，后续保持 PostgreSQL / MySQL 可迁移边界", ".yistack/foundation/foundation-brief.md", ".yistack/foundation/architecture-lifecycle-spec.md"),
	}

	reserved := []BootstrapDecisionItem{
		bootstrapDecisionItem("lifecycle.recovery_strategy", "lifecycle", "恢复与回滚策略", "reserve_extension_now", "shared", "先保留恢复接口和边界", ".yistack/foundation/architecture-lifecycle-spec.md"),
		bootstrapDecisionItem("config.feature_flags", "config", "Feature Flag 扩展口", "reserve_extension_now", "ai", "预留开关控制边界", ".yistack/foundation/engineering-policy.md"),
	}

	deferred := []BootstrapDecisionItem{
		bootstrapDecisionItem("release.canary_strategy", "release", "灰度发布策略", "defer_with_record", "shared", "首版先登记暂缓条件", ".yistack/foundation/deferred-decisions.md"),
	}

	switch templateID {
	case "admin_console":
		required = append(required,
			bootstrapDecisionItem("authz.permission_model", "authz", "权限模型", "must_decide_now", "shared", "RBAC 优先", ".yistack/foundation/engineering-policy.md"),
			bootstrapDecisionItem("security.audit_log_scope", "security", "审计日志范围", "must_decide_now", "shared", "关键管理动作必须记录", ".yistack/foundation/engineering-policy.md"),
		)
	case "ai_agent_platform":
		required = append(required,
			bootstrapDecisionItem("ai.provider_registry", "ai", "Provider Registry", "must_decide_now", "shared", "Provider 与 Model 分离管理", ".yistack/foundation/architecture-lifecycle-spec.md"),
			bootstrapDecisionItem("ai.tool_registry_contract", "ai", "Tool / Skill / MCP 契约", "must_decide_now", "shared", "独立契约与版本化", ".yistack/foundation/architecture-lifecycle-spec.md"),
		)
		reserved = append(reserved,
			bootstrapDecisionItem("ai.memory_strategy", "ai", "Memory 策略", "reserve_extension_now", "shared", "预留 Memory 抽象边界", ".yistack/foundation/architecture-lifecycle-spec.md"),
		)
	case "saas_app":
		required = append(required,
			bootstrapDecisionItem("identity.tenant_model", "identity", "租户模型", "must_decide_now", "shared", "优先 tenant + organization 最小模型", ".yistack/foundation/foundation-brief.md"),
			bootstrapDecisionItem("billing.quota_model", "billing", "配额模型", "must_decide_now", "shared", "先定义 tenant / project 两级配额", ".yistack/foundation/architecture-lifecycle-spec.md"),
		)
	default:
		reserved = append(reserved,
			bootstrapDecisionItem("identity.sso_oidc", "identity", "SSO 扩展口", "reserve_extension_now", "shared", "内部工具先预留企业登录兼容口", ".yistack/foundation/engineering-policy.md"),
		)
	}

	return templateID, projectType, riskLevel, required, reserved, deferred
}

func classifyBootstrapTemplate(appType string) (string, string, string) {
	normalized := strings.ToLower(strings.TrimSpace(appType))
	switch {
	case strings.Contains(normalized, "admin"):
		return "admin_console", "admin_console", "medium"
	case strings.Contains(normalized, "agent"), strings.Contains(normalized, "ai"):
		return "ai_agent_platform", "ai_agent_platform", "high"
	case strings.Contains(normalized, "saas"):
		return "saas_app", "saas_app", "medium"
	default:
		return "internal_tool", firstNonEmpty(normalized, "internal_tool"), "low"
	}
}

func bootstrapDecisionItem(id, domain, title, bucket, owner, recommendation string, artifactTargets ...string) BootstrapDecisionItem {
	return BootstrapDecisionItem{
		ID:                id,
		Domain:            domain,
		Title:             title,
		Bucket:            bucket,
		Status:            "recommended",
		Owner:             owner,
		RecommendedOption: recommendation,
		ArtifactTargets:   artifactTargets,
	}
}

func enrichBootstrapState(state *BootstrapState, stage, prompt, templateID, projectType, riskLevel string, required, reserved, deferred []BootstrapDecisionItem) {
	if state == nil {
		return
	}

	confirmations := parseBootstrapDecisionSelections(prompt)
	state.TemplateID = templateID
	state.ProjectType = projectType
	state.FoundationRiskLevel = riskLevel
	state.RequiredDecisions = bootstrapDecisionItemsForStage(stage, required, confirmations)
	state.ReservedExtensions = bootstrapDecisionItemsForStage(stage, reserved, confirmations)
	state.DeferredDecisions = bootstrapDecisionItemsForStage(stage, deferred, confirmations)
	state.DesignReadiness = buildBootstrapDesignReadiness(state.RequiredDecisions)
	state.Blockers = []string{}
	if state.Status == "awaiting_confirmation" {
		state.Blockers = []string{"must_decide_now 项待确认"}
	}
}

func buildBootstrapDesignReadiness(requiredDecisions []BootstrapDecisionItem) *BootstrapDesignReadiness {
	readiness := &BootstrapDesignReadiness{}
	for _, item := range requiredDecisions {
		isConfirmed := strings.TrimSpace(item.Status) == "confirmed"
		switch strings.TrimSpace(item.ID) {
		case "tech_stack.runtime_profile":
			readiness.TechStackReady = isConfirmed
		case "architecture.boundary":
			readiness.ArchitectureReady = isConfirmed
		case "project.directory_structure":
			readiness.DirectoryStructureReady = isConfirmed
		case "api.interface_contract":
			readiness.InterfaceContractReady = isConfirmed
		case "data.model_strategy":
			readiness.DataModelReady = isConfirmed
		}
	}
	readiness.MissingItems = missingBootstrapDesignReadinessItems(readiness)
	if len(readiness.MissingItems) == 0 {
		readiness.Status = "ready"
	} else {
		readiness.Status = "blocked"
	}
	return readiness
}

func missingBootstrapDesignReadinessItems(readiness *BootstrapDesignReadiness) []string {
	if readiness == nil {
		return []string{
			"技术栈与运行时 Profile",
			"架构边界",
			"目录结构与工件命名空间",
			"接口契约与错误模型",
			"数据模型与持久化策略",
		}
	}
	missingItems := []string{}
	if !readiness.TechStackReady {
		missingItems = append(missingItems, "技术栈与运行时 Profile")
	}
	if !readiness.ArchitectureReady {
		missingItems = append(missingItems, "架构边界")
	}
	if !readiness.DirectoryStructureReady {
		missingItems = append(missingItems, "目录结构与工件命名空间")
	}
	if !readiness.InterfaceContractReady {
		missingItems = append(missingItems, "接口契约与错误模型")
	}
	if !readiness.DataModelReady {
		missingItems = append(missingItems, "数据模型与持久化策略")
	}
	return normalizeStringSlice(missingItems)
}

type bootstrapDecisionConfirmation struct {
	SelectedOption string
	Notes          string
}

func parseBootstrapDecisionSelections(prompt string) map[string]bootstrapDecisionConfirmation {
	lines := strings.Split(prompt, "\n")
	selections := make(map[string]bootstrapDecisionConfirmation)
	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if !strings.HasPrefix(line, "- ") {
			continue
		}

		body := strings.TrimSpace(strings.TrimPrefix(line, "- "))
		openIndex := strings.LastIndex(body, "(")
		closeIndex := strings.Index(body, "):")
		if openIndex <= 0 || closeIndex <= openIndex {
			continue
		}

		id := strings.TrimSpace(body[openIndex+1 : closeIndex])
		if id == "" {
			continue
		}

		selectionText := strings.TrimSpace(body[closeIndex+2:])
		if selectionText == "" {
			continue
		}

		selectedOption := selectionText
		notes := ""
		if notesIndex := strings.Index(selectionText, "；备注："); notesIndex >= 0 {
			selectedOption = strings.TrimSpace(selectionText[:notesIndex])
			notes = strings.TrimSpace(selectionText[notesIndex+len("；备注："):])
		}
		if notes == "" {
			if notesIndex := strings.Index(selectionText, ";备注:"); notesIndex >= 0 {
				selectedOption = strings.TrimSpace(selectionText[:notesIndex])
				notes = strings.TrimSpace(selectionText[notesIndex+len(";备注:"):])
			} else if notesIndex := strings.Index(selectionText, "; notes:"); notesIndex >= 0 {
				selectedOption = strings.TrimSpace(selectionText[:notesIndex])
				notes = strings.TrimSpace(selectionText[notesIndex+len("; notes:"):])
			}
		}

		selections[id] = bootstrapDecisionConfirmation{
			SelectedOption: strings.TrimSpace(selectedOption),
			Notes:          notes,
		}
	}
	return selections
}

func bootstrapDecisionItemsForStage(stage string, items []BootstrapDecisionItem, confirmations map[string]bootstrapDecisionConfirmation) []BootstrapDecisionItem {
	if len(items) == 0 {
		return nil
	}

	next := make([]BootstrapDecisionItem, 0, len(items))
	for _, item := range items {
		cloned := item
		switch strings.TrimSpace(stage) {
		case WorkflowStageBootstrapConfirmed:
			cloned.Status = "confirmed"
			confirmation, ok := confirmations[cloned.ID]
			if ok {
				cloned.SelectedOption = firstNonEmpty(confirmation.SelectedOption, cloned.RecommendedOption)
				cloned.Notes = confirmation.Notes
			} else {
				cloned.SelectedOption = cloned.RecommendedOption
			}
		case WorkflowStageBootstrapReview:
			cloned.Status = "recommended"
		default:
			cloned.Status = "proposed"
		}
		next = append(next, cloned)
	}
	return next
}

func buildBootstrapWorkflowSteps(state EngineeringState, finalState EngineeringState, command GenerateCommand) []map[string]interface{} {
	if state.BootstrapState == nil {
		return nil
	}

	requiredIDs := make([]string, 0, len(state.BootstrapState.RequiredDecisions))
	for _, item := range state.BootstrapState.RequiredDecisions {
		requiredIDs = append(requiredIDs, item.ID)
	}

	steps := []map[string]interface{}{
		buildEngineeringStateStep(
			"bootstrap:started",
			"bootstrap_started",
			"进入 Project Foundation 阶段",
			firstNonEmpty(command.Prompt, "开始收集前置设计决策。"),
			"running",
			state,
			map[string]interface{}{
				"event_name":     "bootstrap_started",
				"workflow_stage": command.Context.WorkflowStage,
				"workflow_mode":  command.Context.WorkflowMode,
			},
		),
		buildEngineeringStateStep(
			"bootstrap:template_selected",
			"bootstrap_template_selected",
			"选择 Foundation 模板",
			"已根据当前项目类型加载第一版前置设计模板。",
			"done",
			state,
			map[string]interface{}{
				"event_name":     "bootstrap_template_selected",
				"template_id":    state.BootstrapState.TemplateID,
				"project_type":   state.BootstrapState.ProjectType,
				"risk_level":     state.BootstrapState.FoundationRiskLevel,
				"workflow_stage": command.Context.WorkflowStage,
			},
		),
		buildEngineeringStateStep(
			"bootstrap:decision_proposed",
			"bootstrap_decision_proposed",
			"生成前置设计决策",
			"已生成第一版 must_decide_now / reserve_extension_now / defer_with_record 决策清单。",
			"done",
			state,
			map[string]interface{}{
				"event_name":          "bootstrap_decision_proposed",
				"required_decisions":  len(state.BootstrapState.RequiredDecisions),
				"reserved_extensions": len(state.BootstrapState.ReservedExtensions),
				"deferred_decisions":  len(state.BootstrapState.DeferredDecisions),
				"decision_ids":        requiredIDs,
			},
		),
		buildEngineeringStateStep(
			"bootstrap:artifact_generated",
			"bootstrap_artifact_generated",
			"生成 Foundation 工件草案",
			"已为 Foundation Brief / Engineering Policy / Architecture Lifecycle Spec / Deferred Decisions 预留工件目标。",
			"done",
			state,
			map[string]interface{}{
				"event_name": "bootstrap_artifact_generated",
				"artifacts":  service.ProjectFoundationArtifactPaths(),
			},
		),
	}

	if strings.TrimSpace(command.Context.WorkflowStage) == WorkflowStageBootstrapConfirmed {
		steps = append(steps, buildEngineeringStateStep(
			"bootstrap:completed",
			"bootstrap_completed",
			"完成 Project Foundation 阶段",
			"前置设计已确认，可以继续进入 Plan 阶段。",
			"done",
			finalState,
			map[string]interface{}{
				"event_name": "bootstrap_completed",
				"artifacts":  service.ProjectFoundationArtifactPaths(),
			},
		))
	}

	return steps
}
