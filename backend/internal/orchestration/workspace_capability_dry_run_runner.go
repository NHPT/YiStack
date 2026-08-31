package orchestration

import (
	"context"
	"strings"
)

// DryRunCapabilityProviderRunner 是外部 provider 的最小契约 runner。
// 它只返回结构化执行结果，不触网、不读取外部系统，用于验证组合根注入链路。
type DryRunCapabilityProviderRunner struct {
	Provider   string
	SourceNote string
}

func (r DryRunCapabilityProviderRunner) ExecuteCapability(_ context.Context, item CapabilityExecutionAuditItem) CapabilityProviderRunResult {
	provider := firstNonEmpty(strings.TrimSpace(r.Provider), strings.TrimSpace(item.Provider), "external")
	return CapabilityProviderRunResult{
		Status:     CapabilityExecutionResultStatusExecuted,
		ReasonCode: provider + "_dry_run_executed",
		SourceNote: firstNonEmpty(
			strings.TrimSpace(r.SourceNote),
			"外部 "+provider+" provider 已通过 dry-run runner 完成契约验证；未发起真实外部调用。",
		),
		Metadata: map[string]interface{}{
			"runner_mode":   "dry-run",
			"external_call": false,
			"provider":      provider,
		},
		Artifacts: []CapabilityExecutionArtifact{
			{
				ID:         strings.TrimSpace(item.CapabilityID) + ".dry_run_contract",
				Type:       "capability_contract",
				Name:       "dry-run runner 契约验证结果",
				SourceNote: "dry-run runner 只产出契约验证 artifact，不代表真实外部系统结果。",
				Metadata: map[string]interface{}{
					"runner_mode": "dry-run",
					"provider":    provider,
				},
			},
		},
	}
}
