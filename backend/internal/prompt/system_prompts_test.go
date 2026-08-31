package prompt

import (
	"strings"
	"testing"
)

func TestBuildGenerateSystemPromptAppendsRuntimeFactsToOverride(t *testing.T) {
	got := BuildGenerateSystemPrompt("custom implement prompt", "node-nextjs", "PROJECT_CONTEXT", "ONLINE_CONTEXT")

	for _, expected := range []string{
		"custom implement prompt",
		"运行配置：\nnode-nextjs",
		"当前项目稳定上下文：\nPROJECT_CONTEXT",
		"联网上下文：\nONLINE_CONTEXT",
	} {
		if !strings.Contains(got, expected) {
			t.Fatalf("expected generate system prompt to include %q, got:\n%s", expected, got)
		}
	}
}

func TestBuildGenerateSystemPromptUsesDefaultTemplateWhenOverrideEmpty(t *testing.T) {
	got := BuildGenerateSystemPrompt("", "node-react", "stable context", "online disabled")

	for _, expected := range []string{
		"你是一个应用生成助手",
		"运行配置：node-react",
		"stable context",
		"联网上下文：",
		"online disabled",
	} {
		if !strings.Contains(got, expected) {
			t.Fatalf("expected default generate system prompt to include %q, got:\n%s", expected, got)
		}
	}
}

func TestBuildPlanUserPromptIncludesFoundationContext(t *testing.T) {
	got := BuildPlanUserPrompt(
		"构建项目",
		"web",
		"TypeScript",
		"",
		"",
		"生成前设计 readiness 摘要：\n- 状态：ready",
	)

	for _, expected := range []string{
		"用户需求：构建项目",
		"Project Foundation 生成前设计真源：",
		"生成前设计 readiness 摘要：",
		"- 状态：ready",
	} {
		if !strings.Contains(got, expected) {
			t.Fatalf("expected plan user prompt to include %q, got:\n%s", expected, got)
		}
	}
}

func TestBuildDiscussSystemPromptAppendsProjectFactsToOverride(t *testing.T) {
	got := BuildDiscussSystemPrompt("custom discuss prompt", "YiStack", "node-nextjs", "web", "联网", "PROJECT_CONTEXT", "ONLINE_CONTEXT")

	for _, expected := range []string{
		"custom discuss prompt",
		"当前项目事实：",
		"- 项目名称：YiStack",
		"- 运行配置：node-nextjs",
		"- 应用类型：web",
		"- 联网模式：联网",
		"项目上下文：\nPROJECT_CONTEXT",
		"联网上下文：\nONLINE_CONTEXT",
	} {
		if !strings.Contains(got, expected) {
			t.Fatalf("expected discuss system prompt to include %q, got:\n%s", expected, got)
		}
	}
}

func TestPromptConfigKeysAreStable(t *testing.T) {
	expected := map[string]string{
		ProjectPlansSystemPromptKey:  "prompt.project_plans.system",
		ChatDiscussSystemPromptKey:   "prompt.chat.discuss.system",
		ChatImplementSystemPromptKey: "prompt.chat.implement.system",
	}
	for got, want := range expected {
		if got != want {
			t.Fatalf("expected prompt key %q, got %q", want, got)
		}
	}
}
