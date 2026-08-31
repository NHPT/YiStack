package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"yistack/config"
	"yistack/internal/orchestration"
)

func TestBuildCapabilityProviderRegistryDefaultsToDisabled(t *testing.T) {
	registry := buildCapabilityProviderRegistry(nil)
	resolution := registry.Resolve(capabilityTestContext())

	if resolution.Status != orchestration.CapabilityResolutionStatusBlocked {
		t.Fatalf("expected default capability provider registry to block external provider, got %q", resolution.Status)
	}
}

func TestBuildCapabilityProviderRegistryUsesConfig(t *testing.T) {
	registry := buildCapabilityProviderRegistry(&config.Config{
		Capability: config.CapabilityConfig{
			EnableSkillProvider: true,
			ExecutionPolicyNote: "测试配置启用 Skill provider。",
		},
	})
	resolution := registry.Resolve(capabilityTestContext())

	if resolution.Status != orchestration.CapabilityResolutionStatusResolved {
		t.Fatalf("expected configured capability provider registry to resolve external provider, got %q", resolution.Status)
	}
}

func TestBuildCapabilityExecutionPolicyDefaultsToDisabled(t *testing.T) {
	policy := buildCapabilityExecutionPolicy(nil)

	if policy.EnableSkill {
		t.Fatal("expected skill execution to be disabled without config")
	}
	if policy.EnableMCP {
		t.Fatal("expected MCP execution to be disabled without config")
	}
	if policy.SourceNote == "" {
		t.Fatal("expected disabled policy source note")
	}
}

func TestBuildCapabilityExecutionPolicyUsesConfig(t *testing.T) {
	policy := buildCapabilityExecutionPolicy(&config.Config{
		Capability: config.CapabilityConfig{
			EnableSkillExecution: true,
			EnableMCPExecution:   true,
			ExecutionPolicyNote:  "测试配置允许外部能力执行。",
		},
	})

	if !policy.EnableSkill {
		t.Fatal("expected skill execution to be enabled from config")
	}
	if !policy.EnableMCP {
		t.Fatal("expected MCP execution to be enabled from config")
	}
	if policy.SourceNote != "测试配置允许外部能力执行。" {
		t.Fatalf("expected policy source note from config, got %q", policy.SourceNote)
	}
}

func TestBuildCapabilityProviderRunnerDefaultsToNil(t *testing.T) {
	runner := buildCapabilityProviderRunner(orchestration.CapabilityProviderSkill, nil)

	if runner != nil {
		t.Fatal("expected no capability provider runner without config")
	}
}

func TestBuildCapabilityProviderRunnerUsesDryRunMode(t *testing.T) {
	runner := buildCapabilityProviderRunner(orchestration.CapabilityProviderSkill, &config.Config{
		Capability: config.CapabilityConfig{
			SkillRunnerMode:     "dry-run",
			ExecutionPolicyNote: "测试 dry-run runner。",
		},
	})

	if runner == nil {
		t.Fatal("expected dry-run capability provider runner")
	}
	result := runner.ExecuteCapability(context.Background(), orchestration.CapabilityExecutionAuditItem{
		CapabilityID: "skill.example",
		Provider:     orchestration.CapabilityProviderSkill,
	})
	if result.Status != orchestration.CapabilityExecutionResultStatusExecuted {
		t.Fatalf("expected dry-run runner to return executed status, got %q", result.Status)
	}
	if result.ReasonCode != "skill_dry_run_executed" {
		t.Fatalf("expected skill dry-run reason, got %q", result.ReasonCode)
	}
}

func TestBuildCapabilityProviderRunnerUsesContractMode(t *testing.T) {
	manifestPath := filepath.Join(t.TempDir(), "skill-contract.json")
	if err := os.WriteFile(manifestPath, []byte(`{
		"source_note": "测试 contract manifest。",
		"capabilities": {
			"skill.example": {
				"status": "executed",
				"reason_code": "skill_contract_executed",
				"metadata": {"from_manifest": true}
			}
		}
	}`), 0o600); err != nil {
		t.Fatalf("write manifest: %v", err)
	}

	runner := buildCapabilityProviderRunner(orchestration.CapabilityProviderSkill, &config.Config{
		Capability: config.CapabilityConfig{
			SkillRunnerMode:     "contract",
			SkillRunnerManifest: manifestPath,
			ExecutionPolicyNote: "测试 contract runner。",
		},
	})

	if runner == nil {
		t.Fatal("expected contract capability provider runner")
	}
	result := runner.ExecuteCapability(context.Background(), orchestration.CapabilityExecutionAuditItem{
		CapabilityID: "skill.example",
		Provider:     orchestration.CapabilityProviderSkill,
	})
	if result.Status != orchestration.CapabilityExecutionResultStatusExecuted {
		t.Fatalf("expected contract runner to return executed status, got %q", result.Status)
	}
	if result.ReasonCode != "skill_contract_executed" {
		t.Fatalf("expected skill contract reason, got %q", result.ReasonCode)
	}
	if result.Metadata["runner_mode"] != "contract" {
		t.Fatalf("expected contract runner metadata, got %+v", result.Metadata)
	}
}

func TestBuildCapabilityProviderRunnerUsesMCPHTTPMode(t *testing.T) {
	runner := buildCapabilityProviderRunner(orchestration.CapabilityProviderMCP, &config.Config{
		Capability: config.CapabilityConfig{
			MCPRunnerMode:       "mcp-http",
			MCPRunnerEndpoint:   "https://mcp.example.com/capabilities",
			ExecutionPolicyNote: "测试 mcp-http runner。",
		},
	})

	if runner == nil {
		t.Fatal("expected mcp-http capability provider runner")
	}
	result := runner.ExecuteCapability(context.Background(), orchestration.CapabilityExecutionAuditItem{
		CapabilityID: "mcp.example",
		Provider:     orchestration.CapabilityProviderMCP,
	})
	if result.Status != orchestration.CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected missing boundary to block network, got %q", result.Status)
	}
	if result.ReasonCode != "provider_runner_network_disabled" {
		t.Fatalf("expected network disabled reason, got %q", result.ReasonCode)
	}
}

func TestBuildCapabilityProviderRunnerUsesSkillHTTPMode(t *testing.T) {
	runner := buildCapabilityProviderRunner(orchestration.CapabilityProviderSkill, &config.Config{
		Capability: config.CapabilityConfig{
			SkillRunnerMode:     "skill-http",
			SkillRunnerEndpoint: "https://skill.example.com/capabilities",
			ExecutionPolicyNote: "测试 skill-http runner。",
		},
	})

	if runner == nil {
		t.Fatal("expected skill-http capability provider runner")
	}
	result := runner.ExecuteCapability(context.Background(), orchestration.CapabilityExecutionAuditItem{
		CapabilityID: "skill.example",
		Provider:     orchestration.CapabilityProviderSkill,
	})
	if result.Status != orchestration.CapabilityExecutionResultStatusBlocked {
		t.Fatalf("expected missing boundary to block network, got %q", result.Status)
	}
	if result.ReasonCode != "provider_runner_network_disabled" {
		t.Fatalf("expected network disabled reason, got %q", result.ReasonCode)
	}
}

func TestBuildCapabilityProviderRunnerDoesNotUseMCPHTTPForSkill(t *testing.T) {
	runner := buildCapabilityProviderRunner(orchestration.CapabilityProviderSkill, &config.Config{
		Capability: config.CapabilityConfig{
			SkillRunnerMode: "mcp-http",
		},
	})

	if runner != nil {
		t.Fatal("expected mcp-http mode to be ignored for skill provider")
	}
}

func TestBuildCapabilityProviderRunnerDoesNotUseSkillHTTPForMCP(t *testing.T) {
	runner := buildCapabilityProviderRunner(orchestration.CapabilityProviderMCP, &config.Config{
		Capability: config.CapabilityConfig{
			MCPRunnerMode: "skill-http",
		},
	})

	if runner != nil {
		t.Fatal("expected skill-http mode to be ignored for mcp provider")
	}
}

func TestBuildCapabilityRunnerBoundaryDefaultsToNetworkDisabled(t *testing.T) {
	boundary := buildCapabilityRunnerBoundary(nil)

	if boundary.Timeout != 30*time.Second {
		t.Fatalf("expected default timeout 30s, got %s", boundary.Timeout)
	}
	if boundary.NetworkEnabled {
		t.Fatal("expected network boundary to default disabled")
	}
	if len(boundary.AllowedTargets) != 0 {
		t.Fatalf("expected empty allowlist by default, got %+v", boundary.AllowedTargets)
	}
}

func TestBuildCapabilityRunnerBoundaryUsesConfig(t *testing.T) {
	boundary := buildCapabilityRunnerBoundary(&config.Config{
		Capability: config.CapabilityConfig{
			RunnerTimeoutSeconds: 12,
			NetworkEnabled:       true,
			NetworkAllowlist: []string{
				"mcp.example.com",
				"skills.example.com",
			},
			ExecutionPolicyNote: "测试网络边界配置。",
		},
	})

	if boundary.Timeout != 12*time.Second {
		t.Fatalf("expected configured timeout 12s, got %s", boundary.Timeout)
	}
	if !boundary.NetworkEnabled {
		t.Fatal("expected network boundary to be enabled from config")
	}
	if len(boundary.AllowedTargets) != 2 {
		t.Fatalf("expected configured allowlist, got %+v", boundary.AllowedTargets)
	}
	if boundary.PermissionNote != "测试网络边界配置。" {
		t.Fatalf("expected permission note from config, got %q", boundary.PermissionNote)
	}
}

func TestBuildCapabilityProviderPreflightSkipsEmptyRunnerMode(t *testing.T) {
	items := buildCapabilityProviderPreflight(&config.Config{})

	if len(items) != 2 {
		t.Fatalf("expected two provider preflight items, got %d", len(items))
	}
	for _, item := range items {
		if item.Status != "skipped" {
			t.Fatalf("expected empty runner mode to be skipped, got %+v", item)
		}
		if item.ReasonCode != "provider_runner_mode_empty" {
			t.Fatalf("expected empty runner mode reason, got %q", item.ReasonCode)
		}
		if item.Severity != "warning" {
			t.Fatalf("expected skipped preflight severity warning, got %q", item.Severity)
		}
	}
}

func TestBuildCapabilityProviderPreflightBlocksMissingHTTPEndpoint(t *testing.T) {
	items := buildCapabilityProviderPreflight(&config.Config{
		Capability: config.CapabilityConfig{
			SkillRunnerMode: "skill-http",
		},
	})

	item := capabilityPreflightItemByProvider(t, items, orchestration.CapabilityProviderSkill)
	if item.Status != "blocked" {
		t.Fatalf("expected missing skill endpoint to block, got %+v", item)
	}
	if item.ReasonCode != "provider_runner_endpoint_missing" {
		t.Fatalf("expected endpoint missing reason, got %q", item.ReasonCode)
	}
	if item.NextAction == "" {
		t.Fatal("expected endpoint missing preflight item to include next_action")
	}
	if item.Severity != "critical" {
		t.Fatalf("expected blocked preflight severity critical, got %q", item.Severity)
	}
	if !preflightConfigKeysContain(item.Metadata["config_keys"], "CAPABILITY_SKILL_RUNNER_ENDPOINT") {
		t.Fatalf("expected missing endpoint metadata to include skill endpoint config key, got %+v", item.Metadata)
	}
}

func TestBuildCapabilityProviderPreflightReportsNetworkDisabled(t *testing.T) {
	items := buildCapabilityProviderPreflight(&config.Config{
		Capability: config.CapabilityConfig{
			MCPRunnerMode:     "mcp-http",
			MCPRunnerEndpoint: "https://mcp.example.com/capabilities",
			NetworkEnabled:    false,
		},
	})

	item := capabilityPreflightItemByProvider(t, items, orchestration.CapabilityProviderMCP)
	if item.Status != "blocked" {
		t.Fatalf("expected disabled network to block, got %+v", item)
	}
	if item.ReasonCode != "provider_runner_network_disabled" {
		t.Fatalf("expected network disabled reason, got %q", item.ReasonCode)
	}
}

func TestBuildCapabilityProviderPreflightReportsAllowlistDenied(t *testing.T) {
	items := buildCapabilityProviderPreflight(&config.Config{
		Capability: config.CapabilityConfig{
			SkillRunnerMode:     "skill-http",
			SkillRunnerEndpoint: "https://skill.example.com/capabilities",
			NetworkEnabled:      true,
			NetworkAllowlist: []string{
				"mcp.example.com",
			},
		},
	})

	item := capabilityPreflightItemByProvider(t, items, orchestration.CapabilityProviderSkill)
	if item.Status != "blocked" {
		t.Fatalf("expected allowlist mismatch to block, got %+v", item)
	}
	if item.ReasonCode != "provider_runner_network_target_denied" {
		t.Fatalf("expected allowlist denied reason, got %q", item.ReasonCode)
	}
	if item.NextAction == "" {
		t.Fatal("expected allowlist denied preflight item to include next_action")
	}
	if !preflightConfigKeysContain(item.Metadata["config_keys"], "CAPABILITY_RUNNER_NETWORK_ALLOWLIST") {
		t.Fatalf("expected allowlist denied metadata to include allowlist config key, got %+v", item.Metadata)
	}
}

func TestBuildCapabilityProviderPreflightAllowsHTTPEndpoint(t *testing.T) {
	items := buildCapabilityProviderPreflight(&config.Config{
		Capability: config.CapabilityConfig{
			MCPRunnerMode:     "mcp-http",
			MCPRunnerEndpoint: "https://mcp.example.com/capabilities",
			NetworkEnabled:    true,
			NetworkAllowlist: []string{
				"mcp.example.com",
			},
		},
	})

	item := capabilityPreflightItemByProvider(t, items, orchestration.CapabilityProviderMCP)
	if item.Status != "ready" {
		t.Fatalf("expected allowlisted endpoint to be ready, got %+v", item)
	}
	if item.ReasonCode != "provider_runner_preflight_ready" {
		t.Fatalf("expected preflight ready reason, got %q", item.ReasonCode)
	}
	if item.Metadata["target"] != "mcp.example.com" {
		t.Fatalf("expected normalized target metadata, got %+v", item.Metadata)
	}
	if item.NextAction == "" {
		t.Fatal("expected ready preflight item to include next_action")
	}
	if item.Severity != "info" {
		t.Fatalf("expected ready preflight severity info, got %q", item.Severity)
	}
	if !preflightConfigKeysContain(item.Metadata["config_keys"], "CAPABILITY_MCP_RUNNER_ENDPOINT") {
		t.Fatalf("expected ready metadata to include mcp endpoint config key, got %+v", item.Metadata)
	}
}

func TestBuildCapabilityProviderPreflightBlocksRunnerModeMismatch(t *testing.T) {
	items := buildCapabilityProviderPreflight(&config.Config{
		Capability: config.CapabilityConfig{
			SkillRunnerMode: "mcp-http",
		},
	})

	item := capabilityPreflightItemByProvider(t, items, orchestration.CapabilityProviderSkill)
	if item.Status != "blocked" {
		t.Fatalf("expected mismatched runner mode to block, got %+v", item)
	}
	if item.ReasonCode != "provider_runner_mode_mismatch" {
		t.Fatalf("expected runner mode mismatch reason, got %q", item.ReasonCode)
	}
}

func TestCapabilityProviderPreflightStatusCounts(t *testing.T) {
	counts := capabilityProviderPreflightStatusCounts([]capabilityProviderPreflightItem{
		{Status: "ready"},
		{Status: "skipped"},
		{Status: "blocked"},
		{Status: "blocked"},
	})

	if counts["ready"] != 1 {
		t.Fatalf("expected one ready item, got %+v", counts)
	}
	if counts["skipped"] != 1 {
		t.Fatalf("expected one skipped item, got %+v", counts)
	}
	if counts["blocked"] != 2 {
		t.Fatalf("expected two blocked items, got %+v", counts)
	}
}

func TestBuildCapabilityProviderPreflightSnapshot(t *testing.T) {
	snapshot := buildCapabilityProviderPreflightSnapshot(&config.Config{
		Capability: config.CapabilityConfig{
			MCPRunnerMode:     "mcp-http",
			MCPRunnerEndpoint: "https://mcp.example.com/capabilities",
			NetworkEnabled:    true,
			NetworkAllowlist: []string{
				"mcp.example.com",
			},
		},
	})

	if snapshot.GeneratedAt == "" {
		t.Fatal("expected preflight snapshot generated_at")
	}
	if snapshot.SourceNote == "" {
		t.Fatal("expected preflight snapshot source_note")
	}
	if len(snapshot.Items) != 2 {
		t.Fatalf("expected two preflight items, got %d", len(snapshot.Items))
	}
	if snapshot.StatusCounts["ready"] != 1 {
		t.Fatalf("expected one ready item, got %+v", snapshot.StatusCounts)
	}
	if snapshot.StatusCounts["skipped"] != 1 {
		t.Fatalf("expected one skipped item, got %+v", snapshot.StatusCounts)
	}
	for _, item := range snapshot.Items {
		if item.NextAction == "" {
			t.Fatalf("expected preflight snapshot item to include next_action, got %+v", item)
		}
	}
}

func capabilityTestContext() orchestration.CapabilityContext {
	return orchestration.CapabilityContext{
		Profile:      "test-skill-profile",
		WorkflowMode: orchestration.WorkflowModeImplement,
		Capabilities: []orchestration.CapabilityDescriptor{
			{
				ID:         "skill.example",
				Name:       "示例 Skill",
				Provider:   orchestration.CapabilityProviderSkill,
				Purpose:    "验证配置化 provider registry",
				Version:    "v1",
				Required:   true,
				SourceNote: "测试构造的 skill 能力。",
			},
		},
	}
}

func preflightConfigKeysContain(raw interface{}, expected string) bool {
	keys, ok := raw.([]string)
	if !ok {
		return false
	}
	for _, key := range keys {
		if key == expected {
			return true
		}
	}
	return false
}

func capabilityPreflightItemByProvider(t *testing.T, items []capabilityProviderPreflightItem, provider string) capabilityProviderPreflightItem {
	t.Helper()
	for _, item := range items {
		if item.Provider == provider {
			return item
		}
	}
	t.Fatalf("expected preflight item for provider %q, got %+v", provider, items)
	return capabilityProviderPreflightItem{}
}
