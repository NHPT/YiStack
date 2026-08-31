package orchestration

import "strings"

const (
	CapabilityProviderStatusAvailable   = "available"
	CapabilityProviderStatusUnavailable = "unavailable"
	CapabilityResolutionStatusResolved  = "resolved"
	CapabilityResolutionStatusSkipped   = "skipped"
	CapabilityResolutionStatusBlocked   = "blocked"
)

// CapabilityProviderDefinition 描述一个可被编排层选择的能力 provider。
type CapabilityProviderDefinition struct {
	ID         string
	Name       string
	Type       string
	Version    string
	Enabled    bool
	SourceNote string
}

// CapabilityResolutionItem 描述单项能力的 provider 解析结果。
type CapabilityResolutionItem struct {
	Capability CapabilityDescriptor
	Provider   CapabilityProviderDefinition
	Status     string
	SourceNote string
}

// CapabilityResolution 描述一次能力计划的 provider 解析结果。
type CapabilityResolution struct {
	Profile    string
	Status     string
	Items      []CapabilityResolutionItem
	Providers  []CapabilityProviderDefinition
	SourceNote string
}

// CapabilityProviderRegistry 负责把能力计划解析到具体 provider。
type CapabilityProviderRegistry struct {
	providers map[string]CapabilityProviderDefinition
}

// CapabilityProviderRegistryOptions 描述外部 provider 是否允许被解析为可用。
type CapabilityProviderRegistryOptions struct {
	EnableSkillProvider bool
	EnableMCPProvider   bool
	SourceNote          string
}

// NewDefaultCapabilityProviderRegistry 创建默认 provider registry。
func NewDefaultCapabilityProviderRegistry() CapabilityProviderRegistry {
	return NewCapabilityProviderRegistry(CapabilityProviderRegistryOptions{})
}

// NewCapabilityProviderRegistry 创建可配置 provider registry。
func NewCapabilityProviderRegistry(options CapabilityProviderRegistryOptions) CapabilityProviderRegistry {
	registry := CapabilityProviderRegistry{
		providers: map[string]CapabilityProviderDefinition{},
	}
	registry.Register(CapabilityProviderDefinition{
		ID:         CapabilityProviderInternal,
		Name:       "内部编排能力",
		Type:       CapabilityProviderInternal,
		Version:    "v1",
		Enabled:    true,
		SourceNote: "默认内置 provider，承接当前后端已实现的编排、状态、生成与校验能力。",
	})
	registry.Register(CapabilityProviderDefinition{
		ID:         CapabilityProviderSkill,
		Name:       "Skill Provider",
		Type:       CapabilityProviderSkill,
		Version:    "v1",
		Enabled:    options.EnableSkillProvider,
		SourceNote: capabilityProviderSourceNote(options.EnableSkillProvider, options.SourceNote, "Skill"),
	})
	registry.Register(CapabilityProviderDefinition{
		ID:         CapabilityProviderMCP,
		Name:       "MCP Provider",
		Type:       CapabilityProviderMCP,
		Version:    "v1",
		Enabled:    options.EnableMCPProvider,
		SourceNote: capabilityProviderSourceNote(options.EnableMCPProvider, options.SourceNote, "MCP"),
	})
	return registry
}

func capabilityProviderSourceNote(enabled bool, sourceNote, providerName string) string {
	if enabled {
		return firstNonEmpty(
			strings.TrimSpace(sourceNote),
			providerName+" provider 已由组合根配置启用；真实执行仍需通过 execution policy 与 runner 注入门禁。",
		)
	}
	return providerName + " provider 默认禁用，等待真实运行时、权限边界、执行策略和审计策略接入。"
}

func (r *CapabilityProviderRegistry) Register(provider CapabilityProviderDefinition) {
	if r == nil {
		return
	}
	if r.providers == nil {
		r.providers = map[string]CapabilityProviderDefinition{}
	}
	id := strings.TrimSpace(provider.ID)
	if id == "" {
		return
	}
	provider.ID = id
	r.providers[id] = provider
}

func (r CapabilityProviderRegistry) Resolve(ctx CapabilityContext) CapabilityResolution {
	providers := r.providerList()
	items := make([]CapabilityResolutionItem, 0, len(ctx.Capabilities))
	status := CapabilityResolutionStatusResolved

	for _, capability := range ctx.Capabilities {
		providerID := strings.TrimSpace(capability.Provider)
		provider, ok := r.providers[providerID]
		itemStatus := CapabilityResolutionStatusResolved
		sourceNote := "能力已解析到可用 provider。"
		if !ok || !provider.Enabled {
			if capability.Required {
				itemStatus = CapabilityResolutionStatusBlocked
				status = CapabilityResolutionStatusBlocked
				if !ok {
					sourceNote = "能力声明的 provider 未在 registry 中注册。"
				} else {
					sourceNote = "能力声明的 provider 当前未启用。"
				}
			} else {
				itemStatus = CapabilityResolutionStatusSkipped
				if !ok {
					sourceNote = "可选能力声明的 provider 未在 registry 中注册；主链路继续执行，并把能力不可用写入审计。"
				} else {
					sourceNote = "可选能力声明的 provider 当前未启用；主链路继续执行，并把能力不可用写入审计。"
				}
			}
		}
		items = append(items, CapabilityResolutionItem{
			Capability: capability,
			Provider:   provider,
			Status:     itemStatus,
			SourceNote: sourceNote,
		})
	}

	return CapabilityResolution{
		Profile:    strings.TrimSpace(ctx.Profile),
		Status:     status,
		Items:      items,
		Providers:  providers,
		SourceNote: "provider registry 只解析能力归属与可用性；真实执行仍由后续能力执行阶段负责。",
	}
}

func (r CapabilityProviderRegistry) providerList() []CapabilityProviderDefinition {
	providers := make([]CapabilityProviderDefinition, 0, len(r.providers))
	for _, provider := range r.providers {
		providers = append(providers, provider)
	}
	return providers
}

func capabilityResolutionMeta(resolution CapabilityResolution) map[string]interface{} {
	items := make([]map[string]interface{}, 0, len(resolution.Items))
	for _, item := range resolution.Items {
		items = append(items, map[string]interface{}{
			"capability_id":   strings.TrimSpace(item.Capability.ID),
			"capability_name": strings.TrimSpace(item.Capability.Name),
			"provider":        strings.TrimSpace(item.Capability.Provider),
			"provider_name":   strings.TrimSpace(item.Provider.Name),
			"provider_type":   strings.TrimSpace(item.Provider.Type),
			"status":          strings.TrimSpace(item.Status),
			"source_note":     strings.TrimSpace(item.SourceNote),
		})
	}

	providers := make([]map[string]interface{}, 0, len(resolution.Providers))
	for _, provider := range resolution.Providers {
		status := CapabilityProviderStatusUnavailable
		if provider.Enabled {
			status = CapabilityProviderStatusAvailable
		}
		providers = append(providers, map[string]interface{}{
			"id":          strings.TrimSpace(provider.ID),
			"name":        strings.TrimSpace(provider.Name),
			"type":        strings.TrimSpace(provider.Type),
			"version":     strings.TrimSpace(provider.Version),
			"status":      status,
			"source_note": strings.TrimSpace(provider.SourceNote),
		})
	}

	return map[string]interface{}{
		"profile":     strings.TrimSpace(resolution.Profile),
		"status":      strings.TrimSpace(resolution.Status),
		"items":       items,
		"providers":   providers,
		"source_note": strings.TrimSpace(resolution.SourceNote),
	}
}
