package orchestration

import (
	"context"
	"net/url"
	"strings"
	"time"
)

type capabilityRunnerBoundaryContextKey struct{}

// CapabilityRunnerBoundary 描述真实 Skill / MCP client runner 的最小运行边界。
type CapabilityRunnerBoundary struct {
	Timeout        time.Duration
	NetworkEnabled bool
	AllowedTargets []string
	PermissionNote string
}

func withCapabilityRunnerBoundary(ctx context.Context, boundary CapabilityRunnerBoundary) context.Context {
	return context.WithValue(ctx, capabilityRunnerBoundaryContextKey{}, boundary)
}

func CapabilityRunnerBoundaryFromContext(ctx context.Context) (CapabilityRunnerBoundary, bool) {
	boundary, ok := ctx.Value(capabilityRunnerBoundaryContextKey{}).(CapabilityRunnerBoundary)
	return boundary, ok
}

func (b CapabilityRunnerBoundary) Context(parent context.Context) (context.Context, context.CancelFunc) {
	if b.Timeout <= 0 {
		return parent, func() {}
	}
	return context.WithTimeout(parent, b.Timeout)
}

func (b CapabilityRunnerBoundary) ValidateNetworkTarget(rawTarget string) CapabilityProviderRunResult {
	target := strings.TrimSpace(rawTarget)
	if target == "" {
		return blockedCapabilityProviderRunResult(
			"provider_runner_network_target_invalid",
			"外部 provider runner 未声明网络调用目标，网络调用被阻断。",
			map[string]interface{}{
				"network_enabled": b.NetworkEnabled,
			},
		)
	}
	if !b.NetworkEnabled {
		return blockedCapabilityProviderRunResult(
			"provider_runner_network_disabled",
			"外部 provider runner 请求网络调用，但当前网络边界默认关闭。",
			map[string]interface{}{
				"network_enabled": false,
				"target":          target,
			},
		)
	}

	normalizedTarget, ok := normalizeCapabilityNetworkTarget(target)
	if !ok {
		return blockedCapabilityProviderRunResult(
			"provider_runner_network_target_invalid",
			"外部 provider runner 声明了非法网络调用目标。",
			map[string]interface{}{
				"network_enabled": true,
				"target":          target,
			},
		)
	}

	if !b.targetAllowed(normalizedTarget) {
		return blockedCapabilityProviderRunResult(
			"provider_runner_network_target_denied",
			"外部 provider runner 的网络调用目标不在 allowlist 中。",
			map[string]interface{}{
				"network_enabled": true,
				"target":          normalizedTarget,
				"allowed_targets": b.AllowedTargets,
			},
		)
	}

	return CapabilityProviderRunResult{
		Status:     CapabilityExecutionResultStatusExecuted,
		ReasonCode: "provider_runner_network_target_allowed",
		SourceNote: firstNonEmpty(
			strings.TrimSpace(b.PermissionNote),
			"外部 provider runner 网络调用目标已通过 allowlist 校验。",
		),
		Metadata: map[string]interface{}{
			"network_enabled": true,
			"target":          normalizedTarget,
			"allowed_targets": b.AllowedTargets,
		},
	}
}

func (b CapabilityRunnerBoundary) targetAllowed(target string) bool {
	for _, allowed := range b.AllowedTargets {
		normalizedAllowed, ok := normalizeCapabilityNetworkTarget(allowed)
		if ok && normalizedAllowed == target {
			return true
		}
	}
	return false
}

func normalizeCapabilityNetworkTarget(rawTarget string) (string, bool) {
	target := strings.TrimSpace(strings.ToLower(rawTarget))
	if target == "" {
		return "", false
	}

	parsed, err := url.Parse(target)
	if err == nil && parsed.Host != "" {
		if parsed.Scheme != "https" && parsed.Scheme != "http" {
			return "", false
		}
		return parsed.Host, true
	}
	if strings.Contains(target, "://") || strings.ContainsAny(target, "/?#") {
		return "", false
	}
	return target, true
}

func blockedCapabilityProviderRunResult(reasonCode, sourceNote string, metadata map[string]interface{}) CapabilityProviderRunResult {
	return CapabilityProviderRunResult{
		Status:     CapabilityExecutionResultStatusBlocked,
		ReasonCode: reasonCode,
		SourceNote: sourceNote,
		Metadata:   capabilityMetadataPayload(metadata),
	}
}
