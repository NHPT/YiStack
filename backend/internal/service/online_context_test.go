package service

import (
	"context"
	"strings"
	"testing"
)

func TestBuildOnlineContextDecisionDisabled(t *testing.T) {
	decision := buildOnlineContextDecision(context.Background(), &GenerateRequest{Online: false})

	if decision.Enabled {
		t.Fatalf("expected disabled online decision")
	}
	if decision.Status != onlineContextStatusDisabled {
		t.Fatalf("expected status %q, got %q", onlineContextStatusDisabled, decision.Status)
	}
	section := decision.PromptSection()
	for _, expected := range []string{
		"状态：disabled",
		"原因码：online_mode_disabled",
		"不会搜索、抓取或注入外部资料摘要",
	} {
		if !strings.Contains(section, expected) {
			t.Fatalf("expected prompt section to include %q, got:\n%s", expected, section)
		}
	}
}

func TestBuildOnlineContextDecisionProviderUnavailable(t *testing.T) {
	decision := buildOnlineContextDecision(context.Background(), &GenerateRequest{Online: true})

	if !decision.Enabled {
		t.Fatalf("expected enabled online decision")
	}
	if decision.Status != onlineContextStatusProviderUnavailable {
		t.Fatalf("expected status %q, got %q", onlineContextStatusProviderUnavailable, decision.Status)
	}
	section := decision.PromptSection()
	for _, expected := range []string{
		"状态：provider_unavailable",
		"原因码：online_context_provider_unavailable",
		"未配置真实搜索/抓取 provider",
		"不得编造具体版本",
	} {
		if !strings.Contains(section, expected) {
			t.Fatalf("expected prompt section to include %q, got:\n%s", expected, section)
		}
	}
}

func TestBuildOnlineContextDecisionUsesCapabilitySnapshot(t *testing.T) {
	ctx := WithOnlineContextCapabilitySnapshot(context.Background(), OnlineContextCapabilitySnapshot{
		CapabilityID: "online_context.search_crawl",
		Provider:     "mcp",
		Status:       "executed",
		ReasonCode:   "provider_runner_executed",
		SourceNote:   "测试 provider 已返回联网上下文产物。",
		Artifacts: []OnlineContextCapabilityArtifact{
			{
				ID:         "artifact-1",
				Type:       "web_context",
				Name:       "YiStack docs",
				URI:        "https://example.com/yistack",
				SourceNote: "测试资料摘要。",
			},
		},
		SourceSnapshot: "capability_execution_result",
	})
	decision := buildOnlineContextDecision(ctx, &GenerateRequest{Online: true})

	if decision.Status != onlineContextStatusProviderExecuted {
		t.Fatalf("expected provider executed status, got %q", decision.Status)
	}
	section := decision.PromptSection()
	for _, expected := range []string{
		"状态：provider_executed",
		"来源：capability_runner",
		"能力执行快照：",
		"capability_id：online_context.search_crawl",
		"Provider 产物：",
		"https://example.com/yistack",
	} {
		if !strings.Contains(section, expected) {
			t.Fatalf("expected prompt section to include %q, got:\n%s", expected, section)
		}
	}
	meta := decision.Meta()
	capability, ok := meta["capability"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected capability meta, got %T", meta["capability"])
	}
	if capability["status"] != "executed" || capability["reason_code"] != "provider_runner_executed" {
		t.Fatalf("expected executed capability meta, got %#v", capability)
	}
}
