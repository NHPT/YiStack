package service

import (
	"context"
	"fmt"
	"strings"
)

const (
	onlineContextStatusDisabled            = "disabled"
	onlineContextStatusProviderUnavailable = "provider_unavailable"
	onlineContextStatusProviderExecuted    = "provider_executed"
)

type onlineContextCapabilitySnapshotContextKey struct{}

// OnlineContextCapabilityArtifact 是编排层传给 service 的联网 provider 产物快照。
// service 层只消费只读快照，不反向依赖 orchestration 包，避免生成链路出现包循环。
type OnlineContextCapabilityArtifact struct {
	ID         string
	Type       string
	Name       string
	URI        string
	SourceNote string
	Metadata   map[string]interface{}
}

// OnlineContextCapabilitySnapshot 描述本轮联网 provider 能力在 Capability runner 边界内的执行结果。
type OnlineContextCapabilitySnapshot struct {
	CapabilityID   string
	Provider       string
	Status         string
	ReasonCode     string
	SourceNote     string
	Metadata       map[string]interface{}
	Artifacts      []OnlineContextCapabilityArtifact
	SourceSnapshot string
}

type onlineContextDecision struct {
	Enabled      bool
	Status       string
	Source       string
	ReasonCode   string
	Summary      string
	Instructions []string
	Capability   *OnlineContextCapabilitySnapshot
}

func WithOnlineContextCapabilitySnapshot(ctx context.Context, snapshot OnlineContextCapabilitySnapshot) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, onlineContextCapabilitySnapshotContextKey{}, snapshot)
}

func onlineContextCapabilitySnapshotFromContext(ctx context.Context) (OnlineContextCapabilitySnapshot, bool) {
	if ctx == nil {
		return OnlineContextCapabilitySnapshot{}, false
	}
	snapshot, ok := ctx.Value(onlineContextCapabilitySnapshotContextKey{}).(OnlineContextCapabilitySnapshot)
	return snapshot, ok
}

func buildOnlineContextDecision(ctx context.Context, req *GenerateRequest) onlineContextDecision {
	if req == nil || !req.Online {
		return onlineContextDecision{
			Enabled:    false,
			Status:     onlineContextStatusDisabled,
			Source:     "request.online",
			ReasonCode: "online_mode_disabled",
			Summary:    "联网模式未开启；后端不会搜索、抓取或注入外部资料摘要。",
			Instructions: []string{
				"仅使用项目上下文、已批准方案、历史消息和通用工程经验回答。",
				"不要暗示本次请求已经访问公开网页或第三方文档。",
			},
		}
	}

	if snapshot, ok := onlineContextCapabilitySnapshotFromContext(ctx); ok {
		return buildOnlineContextDecisionFromCapabilitySnapshot(snapshot)
	}

	return onlineContextDecision{
		Enabled:    true,
		Status:     onlineContextStatusProviderUnavailable,
		Source:     "backend_online_context_provider",
		ReasonCode: "online_context_provider_unavailable",
		Summary:    "联网模式已请求，但当前后端未配置真实搜索/抓取 provider；本次未执行外部请求，也没有可注入的外部资料摘要。",
		Instructions: []string{
			"可以说明需要外部资料核实时的检查方向，但不得编造具体版本、发布日期、网页内容或 API 细节。",
			"如回答依赖外部事实，必须明确标注当前未联网核验，并建议用户提供链接或后续配置联网 provider。",
		},
	}
}

func buildOnlineContextDecisionFromCapabilitySnapshot(snapshot OnlineContextCapabilitySnapshot) onlineContextDecision {
	capability := snapshot
	status := strings.TrimSpace(snapshot.Status)
	if status == "executed" {
		return onlineContextDecision{
			Enabled:    true,
			Status:     onlineContextStatusProviderExecuted,
			Source:     "capability_runner",
			ReasonCode: firstNonEmpty(strings.TrimSpace(snapshot.ReasonCode), "online_context_provider_executed"),
			Summary: firstNonEmpty(
				strings.TrimSpace(snapshot.SourceNote),
				"联网模式已请求，联网上下文 provider 已通过 Capability runner 边界执行。",
			),
			Instructions: []string{
				"只能基于本节列出的 provider 产物、项目上下文、已批准方案和历史消息回答。",
				"不得补写 provider 产物中不存在的网页内容、版本号、发布日期或 API 细节。",
			},
			Capability: &capability,
		}
	}

	return onlineContextDecision{
		Enabled:    true,
		Status:     onlineContextStatusProviderUnavailable,
		Source:     "capability_runner",
		ReasonCode: "online_context_provider_unavailable",
		Summary: firstNonEmpty(
			strings.TrimSpace(snapshot.SourceNote),
			"联网模式已请求，但联网上下文 provider 未产生可注入资料；本次不得声称已经完成外部核验。",
		),
		Instructions: []string{
			"可以说明需要外部资料核实时的检查方向，但不得编造具体版本、发布日期、网页内容或 API 细节。",
			"如回答依赖外部事实，必须明确标注当前未联网核验，并建议用户提供链接或后续配置联网 provider。",
		},
		Capability: &capability,
	}
}

func (d onlineContextDecision) PromptSection() string {
	lines := []string{
		"状态：" + strings.TrimSpace(d.Status),
		"来源：" + strings.TrimSpace(d.Source),
		"原因码：" + strings.TrimSpace(d.ReasonCode),
		"摘要：" + strings.TrimSpace(d.Summary),
	}
	for _, instruction := range d.Instructions {
		if trimmed := strings.TrimSpace(instruction); trimmed != "" {
			lines = append(lines, "- "+trimmed)
		}
	}
	if d.Capability != nil {
		lines = append(lines,
			"能力执行快照：",
			"- capability_id："+strings.TrimSpace(d.Capability.CapabilityID),
			"- provider："+strings.TrimSpace(d.Capability.Provider),
			"- status："+strings.TrimSpace(d.Capability.Status),
			"- reason_code："+strings.TrimSpace(d.Capability.ReasonCode),
		)
		if len(d.Capability.Artifacts) > 0 {
			lines = append(lines, "Provider 产物：")
			for _, artifact := range d.Capability.Artifacts {
				lines = append(lines, fmt.Sprintf(
					"- %s | %s | %s | %s",
					strings.TrimSpace(artifact.Type),
					strings.TrimSpace(artifact.Name),
					strings.TrimSpace(artifact.URI),
					strings.TrimSpace(artifact.SourceNote),
				))
			}
		}
	}
	return strings.Join(lines, "\n")
}

func (d onlineContextDecision) Meta() map[string]interface{} {
	instructions := make([]string, 0, len(d.Instructions))
	for _, instruction := range d.Instructions {
		if trimmed := strings.TrimSpace(instruction); trimmed != "" {
			instructions = append(instructions, trimmed)
		}
	}
	meta := map[string]interface{}{
		"enabled":      d.Enabled,
		"status":       strings.TrimSpace(d.Status),
		"source":       strings.TrimSpace(d.Source),
		"reason_code":  strings.TrimSpace(d.ReasonCode),
		"summary":      strings.TrimSpace(d.Summary),
		"instructions": instructions,
	}
	if d.Capability != nil {
		meta["capability"] = onlineContextCapabilitySnapshotMeta(*d.Capability)
	}
	return meta
}

func onlineContextCapabilitySnapshotMeta(snapshot OnlineContextCapabilitySnapshot) map[string]interface{} {
	artifacts := make([]map[string]interface{}, 0, len(snapshot.Artifacts))
	for _, artifact := range snapshot.Artifacts {
		artifacts = append(artifacts, map[string]interface{}{
			"id":          strings.TrimSpace(artifact.ID),
			"type":        strings.TrimSpace(artifact.Type),
			"name":        strings.TrimSpace(artifact.Name),
			"uri":         strings.TrimSpace(artifact.URI),
			"source_note": strings.TrimSpace(artifact.SourceNote),
			"metadata":    capabilityMetadataPayload(artifact.Metadata),
		})
	}
	return map[string]interface{}{
		"capability_id":   strings.TrimSpace(snapshot.CapabilityID),
		"provider":        strings.TrimSpace(snapshot.Provider),
		"status":          strings.TrimSpace(snapshot.Status),
		"reason_code":     strings.TrimSpace(snapshot.ReasonCode),
		"source_note":     strings.TrimSpace(snapshot.SourceNote),
		"metadata":        capabilityMetadataPayload(snapshot.Metadata),
		"artifacts":       artifacts,
		"source_snapshot": strings.TrimSpace(snapshot.SourceSnapshot),
	}
}

func capabilityMetadataPayload(metadata map[string]interface{}) map[string]interface{} {
	if len(metadata) == 0 {
		return map[string]interface{}{}
	}
	return metadata
}

func emitOnlineContextDecision(handler StreamEventHandler, decision onlineContextDecision) error {
	status := "done"
	detail := decision.Summary
	if strings.TrimSpace(detail) == "" {
		detail = "联网上下文决策已完成。"
	}
	return emitWorkflowStep(handler, "resolve-online-context", "context_resolve", "解析联网上下文", detail, status, map[string]interface{}{
		"online_context": decision.Meta(),
	})
}
