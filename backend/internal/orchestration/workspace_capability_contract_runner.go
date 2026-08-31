package orchestration

import (
	"context"
	"encoding/json"
	"os"
	"strings"
)

// ContractCapabilityProviderRunner 从显式配置的本地 manifest 读取能力执行结果。
// 它用于验证真实 Skill / MCP client 的装配与结果映射契约，不触网、不调用外部系统。
type ContractCapabilityProviderRunner struct {
	Provider     string
	ManifestPath string
	SourceNote   string
}

type capabilityProviderContractManifest struct {
	Capabilities map[string]CapabilityProviderRunResult `json:"capabilities"`
	SourceNote   string                                 `json:"source_note"`
}

func (r ContractCapabilityProviderRunner) ExecuteCapability(ctx context.Context, item CapabilityExecutionAuditItem) CapabilityProviderRunResult {
	if err := ctx.Err(); err != nil {
		return capabilityProviderRunResultFromContextError(err)
	}

	provider := firstNonEmpty(strings.TrimSpace(r.Provider), strings.TrimSpace(item.Provider), "external")
	manifestPath := strings.TrimSpace(r.ManifestPath)
	if manifestPath == "" {
		return CapabilityProviderRunResult{
			Status:     CapabilityExecutionResultStatusBlocked,
			ReasonCode: "provider_runner_manifest_missing",
			SourceNote: "contract runner 未配置 manifest 路径，不能执行外部能力契约。",
			Metadata: map[string]interface{}{
				"runner_mode": "contract",
				"provider":    provider,
			},
		}
	}

	content, err := os.ReadFile(manifestPath)
	if err != nil {
		return CapabilityProviderRunResult{
			Status:     CapabilityExecutionResultStatusBlocked,
			ReasonCode: "provider_runner_manifest_unavailable",
			SourceNote: "contract runner 无法读取 manifest，外部能力契约执行被阻断。",
			Metadata: map[string]interface{}{
				"runner_mode":   "contract",
				"provider":      provider,
				"manifest_path": manifestPath,
				"error":         err.Error(),
			},
		}
	}

	var manifest capabilityProviderContractManifest
	if err := json.Unmarshal(content, &manifest); err != nil {
		return CapabilityProviderRunResult{
			Status:     CapabilityExecutionResultStatusBlocked,
			ReasonCode: "provider_runner_manifest_invalid",
			SourceNote: "contract runner 读取到的 manifest 不是合法 JSON 契约。",
			Metadata: map[string]interface{}{
				"runner_mode":   "contract",
				"provider":      provider,
				"manifest_path": manifestPath,
				"error":         err.Error(),
			},
		}
	}

	result, ok := manifest.Capabilities[strings.TrimSpace(item.CapabilityID)]
	if !ok {
		return CapabilityProviderRunResult{
			Status:     CapabilityExecutionResultStatusBlocked,
			ReasonCode: "provider_runner_contract_missing",
			SourceNote: "contract runner manifest 未声明当前 capability_id 的执行结果。",
			Metadata: map[string]interface{}{
				"runner_mode":    "contract",
				"provider":       provider,
				"manifest_path":  manifestPath,
				"capability_id":  strings.TrimSpace(item.CapabilityID),
				"manifest_count": len(manifest.Capabilities),
			},
		}
	}

	result.Metadata = mergeCapabilityMetadata(result.Metadata, map[string]interface{}{
		"runner_mode":   "contract",
		"provider":      provider,
		"manifest_path": manifestPath,
	})
	result.SourceNote = firstNonEmpty(
		strings.TrimSpace(result.SourceNote),
		strings.TrimSpace(manifest.SourceNote),
		strings.TrimSpace(r.SourceNote),
		"contract runner 已从本地 manifest 返回结构化能力执行结果；未发起真实外部调用。",
	)
	return result
}

func mergeCapabilityMetadata(primary, fallback map[string]interface{}) map[string]interface{} {
	merged := make(map[string]interface{}, len(fallback)+len(primary))
	for key, value := range fallback {
		merged[key] = value
	}
	for key, value := range primary {
		merged[key] = value
	}
	return merged
}
