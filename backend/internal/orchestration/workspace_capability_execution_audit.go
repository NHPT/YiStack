package orchestration

import "strings"

const (
	CapabilityExecutionStatusDeferred = "deferred"
	CapabilityExecutionStatusSkipped  = "skipped"
	CapabilityExecutionStatusBlocked  = "blocked"
)

// CapabilityExecutionAuditItem 描述单项能力在本轮编排中的执行审计状态。
type CapabilityExecutionAuditItem struct {
	CapabilityID             string
	CapabilityName           string
	CapabilityVersion        string
	CapabilityCatalogSource  string
	Provider                 string
	ProviderResolutionStatus string
	Required                 bool
	Status                   string
	ReasonCode               string
	SourceNote               string
}

// CapabilityExecutionAudit 描述能力执行前的最小审计摘要。
type CapabilityExecutionAudit struct {
	Status     string
	Items      []CapabilityExecutionAuditItem
	SourceNote string
}

// BuildCapabilityExecutionAudit 基于 provider resolution 生成执行审计摘要。
func BuildCapabilityExecutionAudit(resolution CapabilityResolution) CapabilityExecutionAudit {
	items := make([]CapabilityExecutionAuditItem, 0, len(resolution.Items))
	status := CapabilityExecutionStatusDeferred

	for _, item := range resolution.Items {
		auditItem := CapabilityExecutionAuditItem{
			CapabilityID:             strings.TrimSpace(item.Capability.ID),
			CapabilityName:           strings.TrimSpace(item.Capability.Name),
			CapabilityVersion:        strings.TrimSpace(item.Capability.Version),
			CapabilityCatalogSource:  strings.TrimSpace(item.Capability.SourceNote),
			Provider:                 strings.TrimSpace(item.Capability.Provider),
			ProviderResolutionStatus: strings.TrimSpace(item.Status),
			Required:                 item.Capability.Required,
			Status:                   CapabilityExecutionStatusDeferred,
			ReasonCode:               "handled_by_existing_stage",
			SourceNote:               "该能力由现有编排或 service 阶段承接，本轮只记录审计状态，不新增独立执行器。",
		}

		if strings.TrimSpace(item.Status) == CapabilityResolutionStatusBlocked {
			auditItem.Status = CapabilityExecutionStatusBlocked
			auditItem.ReasonCode = "provider_unavailable"
			auditItem.SourceNote = firstNonEmpty(
				strings.TrimSpace(item.SourceNote),
				"能力 provider 不可用，能力执行被阻断。",
			)
			status = CapabilityExecutionStatusBlocked
		} else if strings.TrimSpace(item.Status) == CapabilityResolutionStatusSkipped {
			auditItem.Status = CapabilityExecutionStatusSkipped
			auditItem.ReasonCode = "optional_provider_unavailable"
			auditItem.SourceNote = firstNonEmpty(
				strings.TrimSpace(item.SourceNote),
				"可选能力 provider 不可用，主链路继续执行。",
			)
		} else if item.Capability.Provider == CapabilityProviderSkill || item.Capability.Provider == CapabilityProviderMCP {
			auditItem.Status = CapabilityExecutionStatusDeferred
			auditItem.ReasonCode = "external_provider_ready_for_execution"
			auditItem.SourceNote = "Skill / MCP provider 已解析为可执行候选；真实执行仍需通过 execution policy、runner 注入和网络边界。"
		}

		items = append(items, auditItem)
	}

	return CapabilityExecutionAudit{
		Status:     status,
		Items:      items,
		SourceNote: "能力执行审计记录 provider 解析后的执行候选、跳过和阻断状态；真实 Skill / MCP 调用必须继续经过 execution policy、runner boundary 和审计落库。",
	}
}

func capabilityExecutionAuditMeta(audit CapabilityExecutionAudit) map[string]interface{} {
	items := make([]map[string]interface{}, 0, len(audit.Items))
	for _, item := range audit.Items {
		items = append(items, map[string]interface{}{
			"capability_id":              strings.TrimSpace(item.CapabilityID),
			"capability_name":            strings.TrimSpace(item.CapabilityName),
			"capability_version":         strings.TrimSpace(item.CapabilityVersion),
			"capability_catalog_source":  strings.TrimSpace(item.CapabilityCatalogSource),
			"provider":                   strings.TrimSpace(item.Provider),
			"provider_resolution_status": strings.TrimSpace(item.ProviderResolutionStatus),
			"required":                   item.Required,
			"status":                     strings.TrimSpace(item.Status),
			"reason_code":                strings.TrimSpace(item.ReasonCode),
			"source_note":                strings.TrimSpace(item.SourceNote),
		})
	}

	return map[string]interface{}{
		"status":      strings.TrimSpace(audit.Status),
		"items":       items,
		"source_note": strings.TrimSpace(audit.SourceNote),
	}
}
