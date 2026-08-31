package orchestration

import "strings"

const (
	CapabilityProviderInternal                 = "internal"
	CapabilityProviderSkill                    = "skill"
	CapabilityProviderMCP                      = "mcp"
	CapabilityOrchestrationContext             = "orchestration.context"
	CapabilityEngineeringStateSnapshot         = "engineering_state.snapshot"
	CapabilityFoundationDecisionSynthesis      = "foundation.decision_synthesis"
	CapabilityPlanOptionSynthesis              = "plan.option_synthesis"
	CapabilityGenerationContentStream          = "generation.content_stream"
	CapabilityValidationBeforePreview          = "validation.before_preview"
	CapabilityDiscussionResponse               = "discussion.response"
	CapabilitySkillContractDryRun              = "skill.contract_dry_run"
	CapabilityMCPContractDryRun                = "mcp.contract_dry_run"
	CapabilityProfileImplementationSkillDryRun = "implementation-skill-dry-run-capability-profile"
	CapabilityProfileImplementationMCPDryRun   = "implementation-mcp-dry-run-capability-profile"
	CapabilityOnlineContextSearchCrawl         = "online_context.search_crawl"
)

// CapabilityDescriptor 描述编排层可选择的一项能力。
// sourceNote 用于说明能力选择来源，避免后续能力层变成不可追踪的隐式分支。
type CapabilityDescriptor struct {
	ID         string
	Name       string
	Provider   string
	Purpose    string
	Version    string
	Required   bool
	SourceNote string
}

// CapabilityCatalogDefinition describes the canonical capability catalog entry.
type CapabilityCatalogDefinition struct {
	ID            string
	Name          string
	Provider      string
	Purpose       string
	Version       string
	Required      bool
	WorkflowModes []string
	Profiles      []string
	OnlineOnly    bool
	SourceNote    string
}

// CapabilityContext 描述单次编排解析出的能力计划。
type CapabilityContext struct {
	WorkflowStage string
	WorkflowMode  string
	Profile       string
	Capabilities  []CapabilityDescriptor
	SourceNote    string
}

// CapabilityCatalogDefinitions returns the canonical capability catalog.
func CapabilityCatalogDefinitions() []CapabilityCatalogDefinition {
	return []CapabilityCatalogDefinition{
		{
			ID:         CapabilityOrchestrationContext,
			Name:       "编排上下文",
			Provider:   CapabilityProviderInternal,
			Purpose:    "提供 workflow stage/mode、runtime project 和 validation gate 等主链路上下文",
			Version:    "v1",
			Required:   true,
			SourceNote: "由 OrchestrationContext 归一化结果生成。",
		},
		{
			ID:         CapabilityEngineeringStateSnapshot,
			Name:       "工程状态快照",
			Provider:   CapabilityProviderInternal,
			Purpose:    "提供 workflow、runtime、validation、execution、recovery 与 bootstrap_state 的统一状态快照",
			Version:    "v1",
			Required:   true,
			SourceNote: "由 BuildEngineeringState 与项目级 engineering_state 快照入口生成。",
		},
		{
			ID:            CapabilityFoundationDecisionSynthesis,
			Name:          "Foundation 决策整理",
			Provider:      CapabilityProviderInternal,
			Purpose:       "整理 must_decide_now 决策、暂缓项、风险和下一步动作",
			Version:       "v1",
			Required:      true,
			WorkflowModes: []string{WorkflowModeFoundation},
			SourceNote:    "由 Project Foundation 编排阶段选择。",
		},
		{
			ID:            CapabilityPlanOptionSynthesis,
			Name:          "方案生成与比较",
			Provider:      CapabilityProviderInternal,
			Purpose:       "生成候选方案、推荐方案和选择边界",
			Version:       "v1",
			Required:      true,
			WorkflowModes: []string{WorkflowModePlan},
			SourceNote:    "由 Plan 编排阶段选择。",
		},
		{
			ID:            CapabilityGenerationContentStream,
			Name:          "实现内容生成",
			Provider:      CapabilityProviderInternal,
			Purpose:       "构建提示词、消费 LLM 流并输出代码与说明",
			Version:       "v1",
			Required:      true,
			WorkflowModes: []string{WorkflowModeImplement},
			SourceNote:    "由 Implementation 生成阶段选择。",
		},
		{
			ID:            CapabilityValidationBeforePreview,
			Name:          "预览前校验",
			Provider:      CapabilityProviderInternal,
			Purpose:       "运行 YES Validation Gate 并生成失败恢复状态",
			Version:       "v1",
			Required:      true,
			WorkflowModes: []string{WorkflowModeImplement},
			SourceNote:    "由实现模式默认 Validation Gate 选择。",
		},
		{
			ID:            CapabilityDiscussionResponse,
			Name:          "需求讨论回应",
			Provider:      CapabilityProviderInternal,
			Purpose:       "回应用户澄清、约束补充和非实现类讨论",
			Version:       "v1",
			Required:      true,
			WorkflowModes: []string{WorkflowModeDiscuss},
			SourceNote:    "由非实现 workflow mode 选择。",
		},
		{
			ID:       CapabilitySkillContractDryRun,
			Name:     "Skill 契约验证",
			Provider: CapabilityProviderSkill,
			Purpose:  "验证 Skill provider、执行策略和 runner 注入链路，不发起真实外部调用",
			Version:  "v1",
			Required: true,
			Profiles: []string{
				CapabilityProfileImplementationSkillDryRun,
			},
			SourceNote: "由 CapabilityProfile 显式选择 Skill dry-run 契约能力。",
		},
		{
			ID:       CapabilityMCPContractDryRun,
			Name:     "MCP 契约验证",
			Provider: CapabilityProviderMCP,
			Purpose:  "验证 MCP provider、执行策略和 runner 注入链路，不发起真实外部调用",
			Version:  "v1",
			Required: true,
			Profiles: []string{
				CapabilityProfileImplementationMCPDryRun,
			},
			SourceNote: "由 CapabilityProfile 显式选择 MCP dry-run 契约能力。",
		},
		{
			ID:         CapabilityOnlineContextSearchCrawl,
			Name:       "联网上下文搜索抓取",
			Provider:   CapabilityProviderMCP,
			Purpose:    "在联网模式下通过受控 MCP provider 获取搜索/抓取上下文；provider 不可用时只写入审计并继续主链路",
			Version:    "v1",
			Required:   false,
			OnlineOnly: true,
			SourceNote: "由 GenerateCommand.Online=true 选择；真实执行必须继续经过 Capability runner、网络 allowlist 和审计边界。",
		},
	}
}

// ResolveCapabilityContext 基于已归一化的编排上下文解析本次链路的能力计划。
func ResolveCapabilityContext(ctx OrchestrationContext) CapabilityContext {
	stage := strings.TrimSpace(ctx.WorkflowStage)
	mode := strings.TrimSpace(ctx.WorkflowMode)
	profile := strings.TrimSpace(ctx.CapabilityProfile)
	if profile == "" {
		profile = defaultCapabilityProfile(stage, mode)
	}

	capabilities := capabilityDescriptorsForCatalog(stage, mode, profile, false)

	return CapabilityContext{
		WorkflowStage: stage,
		WorkflowMode:  mode,
		Profile:       profile,
		Capabilities:  capabilities,
		SourceNote:    "能力计划由已归一化 OrchestrationContext 静态解析；当前阶段只建立 Skill / MCP 接入契约，不执行外部能力。",
	}
}

func withOptionalOnlineContextCapability(ctx CapabilityContext) CapabilityContext {
	if capability, ok := capabilityDescriptorByID(CapabilityOnlineContextSearchCrawl); ok {
		ctx.Capabilities = append(ctx.Capabilities, capability)
	}
	ctx.SourceNote = strings.TrimSpace(ctx.SourceNote) + " 联网模式开启时会附加可选 online_context.search_crawl 能力；该能力不可用不会阻断主生成链路。"
	return ctx
}

func capabilityDescriptorsForCatalog(stage, mode, profile string, includeOnline bool) []CapabilityDescriptor {
	capabilities := []CapabilityDescriptor{}
	for _, definition := range CapabilityCatalogDefinitions() {
		if matchesCapabilityCatalogDefinition(definition, stage, mode, profile, includeOnline) == false {
			continue
		}
		capabilities = append(capabilities, capabilityDescriptorFromCatalogDefinition(definition))
	}
	return capabilities
}

func capabilityDescriptorByID(id string) (CapabilityDescriptor, bool) {
	normalizedID := strings.TrimSpace(id)
	for _, definition := range CapabilityCatalogDefinitions() {
		if strings.TrimSpace(definition.ID) != normalizedID {
			continue
		}
		return capabilityDescriptorFromCatalogDefinition(definition), true
	}
	return CapabilityDescriptor{}, false
}

func matchesCapabilityCatalogDefinition(definition CapabilityCatalogDefinition, _ string, mode, profile string, includeOnline bool) bool {
	if definition.OnlineOnly {
		return includeOnline
	}
	if capabilityCatalogListMatches(definition.Profiles, profile) {
		return true
	}
	if len(definition.Profiles) > 0 {
		return false
	}
	if capabilityCatalogListMatches(definition.WorkflowModes, mode) {
		return true
	}
	if len(definition.WorkflowModes) > 0 {
		return false
	}
	return isBaseCapabilityCatalogDefinition(definition)
}

func isBaseCapabilityCatalogDefinition(definition CapabilityCatalogDefinition) bool {
	return len(definition.WorkflowModes) == 0 && len(definition.Profiles) == 0
}

func capabilityCatalogListMatches(values []string, expected string) bool {
	normalizedExpected := strings.TrimSpace(expected)
	for _, value := range values {
		if strings.TrimSpace(value) == normalizedExpected {
			return true
		}
	}
	return false
}

func capabilityDescriptorFromCatalogDefinition(definition CapabilityCatalogDefinition) CapabilityDescriptor {
	version := strings.TrimSpace(definition.Version)
	if version == "" {
		version = "v1"
	}
	return CapabilityDescriptor{
		ID:         strings.TrimSpace(definition.ID),
		Name:       strings.TrimSpace(definition.Name),
		Provider:   strings.TrimSpace(definition.Provider),
		Purpose:    strings.TrimSpace(definition.Purpose),
		Version:    version,
		Required:   definition.Required,
		SourceNote: strings.TrimSpace(definition.SourceNote),
	}
}

func defaultCapabilityProfile(stage, mode string) string {
	switch strings.TrimSpace(mode) {
	case WorkflowModeFoundation:
		return "foundation-capability-profile"
	case WorkflowModePlan:
		return "plan-capability-profile"
	case WorkflowModeImplement:
		return "implementation-capability-profile"
	default:
		if strings.TrimSpace(stage) == WorkflowStagePlanSelection {
			return "plan-selection-capability-profile"
		}
		return "discussion-capability-profile"
	}
}

func capabilityContextMeta(ctx CapabilityContext) map[string]interface{} {
	items := make([]map[string]interface{}, 0, len(ctx.Capabilities))
	for _, capability := range ctx.Capabilities {
		items = append(items, map[string]interface{}{
			"id":          strings.TrimSpace(capability.ID),
			"name":        strings.TrimSpace(capability.Name),
			"provider":    strings.TrimSpace(capability.Provider),
			"purpose":     strings.TrimSpace(capability.Purpose),
			"version":     strings.TrimSpace(capability.Version),
			"required":    capability.Required,
			"source_note": strings.TrimSpace(capability.SourceNote),
		})
	}
	return map[string]interface{}{
		"profile":       strings.TrimSpace(ctx.Profile),
		"workflowStage": strings.TrimSpace(ctx.WorkflowStage),
		"workflowMode":  strings.TrimSpace(ctx.WorkflowMode),
		"capabilities":  items,
		"source_note":   strings.TrimSpace(ctx.SourceNote),
	}
}
