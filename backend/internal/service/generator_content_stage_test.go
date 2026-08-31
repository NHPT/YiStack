package service

import (
	"context"
	"strings"
	"testing"
)

func TestBuildGenerationChatRequestInjectsApprovedPlanContext(t *testing.T) {
	req := &GenerateRequest{
		Prompt:      "请开始实现",
		PlanContext: "方案 ID：plan-a\n方案名称：Next.js Dashboard\n核心功能：登录、审计",
	}

	chatReq := buildGenerationChatRequest(req, generationRuntimeStageResult{
		projectContext: "PROJECT_CONTEXT",
	}, "model-a", 0.2)

	if len(chatReq.Messages) != 2 {
		t.Fatalf("expected system and user messages, got %d", len(chatReq.Messages))
	}
	userPrompt := chatReq.Messages[1].Content
	for _, expected := range []string{
		"已批准方案上下文：",
		"方案 ID：plan-a",
		"方案名称：Next.js Dashboard",
		"用户实现请求：",
		"请开始实现",
		"实现必须完整继承已批准方案上下文",
	} {
		if !strings.Contains(userPrompt, expected) {
			t.Fatalf("expected user prompt to include %q, got:\n%s", expected, userPrompt)
		}
	}
}

func TestBuildGenerationChatRequestUsesConfiguredSystemPrompt(t *testing.T) {
	req := &GenerateRequest{Prompt: "请开始实现"}
	chatReq := buildGenerationChatRequestWithSystemPrompt(context.Background(), req, generationRuntimeStageResult{
		projectContext: "PROJECT_CONTEXT",
	}, "model-a", 0.2, "custom implement prompt")

	if len(chatReq.Messages) != 2 {
		t.Fatalf("expected system and user messages, got %d", len(chatReq.Messages))
	}
	systemPrompt := chatReq.Messages[0].Content
	for _, expected := range []string{
		"custom implement prompt",
		"当前项目稳定上下文：\nPROJECT_CONTEXT",
	} {
		if !strings.Contains(systemPrompt, expected) {
			t.Fatalf("expected system prompt to include %q, got:\n%s", expected, systemPrompt)
		}
	}
}

func TestBuildGenerationChatRequestInjectsOnlineContextDecision(t *testing.T) {
	req := &GenerateRequest{Prompt: "请开始实现", Online: true}
	chatReq := buildGenerationChatRequest(req, generationRuntimeStageResult{
		projectContext: "PROJECT_CONTEXT",
	}, "model-a", 0.2)

	if len(chatReq.Messages) != 2 {
		t.Fatalf("expected system and user messages, got %d", len(chatReq.Messages))
	}
	systemPrompt := chatReq.Messages[0].Content
	for _, expected := range []string{
		"联网上下文：",
		"状态：provider_unavailable",
		"原因码：online_context_provider_unavailable",
		"本次未执行外部请求",
	} {
		if !strings.Contains(systemPrompt, expected) {
			t.Fatalf("expected system prompt to include %q, got:\n%s", expected, systemPrompt)
		}
	}
}

func TestBuildGenerationChatRequestInjectsOnlineCapabilitySnapshot(t *testing.T) {
	req := &GenerateRequest{Prompt: "请开始实现", Online: true}
	ctx := WithOnlineContextCapabilitySnapshot(context.Background(), OnlineContextCapabilitySnapshot{
		CapabilityID: "online_context.search_crawl",
		Provider:     "mcp",
		Status:       "executed",
		ReasonCode:   "provider_runner_executed",
		SourceNote:   "测试 provider 已返回联网上下文产物。",
		Artifacts: []OnlineContextCapabilityArtifact{
			{
				Type:       "web_context",
				Name:       "Provider docs",
				URI:        "https://example.com/provider-docs",
				SourceNote: "测试 provider 产物。",
			},
		},
	})
	chatReq := buildGenerationChatRequestWithSystemPrompt(ctx, req, generationRuntimeStageResult{
		projectContext: "PROJECT_CONTEXT",
	}, "model-a", 0.2, "")

	systemPrompt := chatReq.Messages[0].Content
	for _, expected := range []string{
		"状态：provider_executed",
		"能力执行快照：",
		"capability_id：online_context.search_crawl",
		"https://example.com/provider-docs",
	} {
		if !strings.Contains(systemPrompt, expected) {
			t.Fatalf("expected system prompt to include %q, got:\n%s", expected, systemPrompt)
		}
	}
}

func TestBuildGenerationUserPromptKeepsPromptWhenPlanContextEmpty(t *testing.T) {
	userPrompt := buildGenerationUserPrompt(&GenerateRequest{
		Prompt:      "  请继续实现  ",
		PlanContext: "   ",
	})

	if userPrompt != "请继续实现" {
		t.Fatalf("expected trimmed prompt without plan context wrapper, got %q", userPrompt)
	}
}

func TestBuildGenerationUserPromptIncludesBrowserAcceptanceContract(t *testing.T) {
	userPrompt := buildGenerationUserPrompt(&GenerateRequest{
		Prompt: "Build a kanban board titled Signal Delivery Board",
		BrowserAcceptance: BrowserAcceptanceSpec{
			RequiredText: []string{"Signal Delivery Board"},
			Actions: []BrowserAcceptanceAction{{
				Type:       "click",
				Selector:   "[data-testid='primary-action']",
				ExpectText: "Workspace opened",
			}},
		},
	})

	for _, expected := range []string{
		"浏览器验收契约（实现必须满足）",
		`"required_text":["Signal Delivery Board"]`,
		`"selector":"[data-testid='primary-action']"`,
		`"expect_text":"Workspace opened"`,
		"固定访问 Preview 根路径 GET /",
		"普通可见页面正文",
		"仅写入 document.title",
		"placeholder",
		"作为 JSX/HTML 可见文本节点渲染",
		"不得先用 useEffect、setTimeout",
		"当 actions 为空时",
		"可见且可操作的真实控件",
		"form 必须设置 noValidate",
		"完全相同的原文",
		"确定性字面量后置条件",
	} {
		if !strings.Contains(userPrompt, expected) {
			t.Fatalf("expected browser acceptance prompt to include %q, got:\n%s", expected, userPrompt)
		}
	}
}

func TestValidateGenerationBrowserActionGroundingAcceptsLiteralPostcondition(t *testing.T) {
	err := validateGenerationBrowserActionGrounding(
		[]GenerationFileOperation{{
			Operation: GenerationFileOperationCreate,
			Path:      "public/index.html",
			Content:   `<button onclick="output.textContent = 'Sample order loaded'">Load</button>`,
		}},
		BrowserAcceptanceSpec{Actions: []BrowserAcceptanceAction{{
			Type:       "click",
			Selector:   "[data-testid='load-orders']",
			ExpectText: "Sample order loaded",
		}}},
	)
	if err != nil {
		t.Fatalf("expected grounded action postcondition, got %v", err)
	}
}

func TestValidateGenerationBrowserActionGroundingRejectsMissingPostcondition(t *testing.T) {
	err := validateGenerationBrowserActionGrounding(
		[]GenerationFileOperation{{
			Operation: GenerationFileOperationCreate,
			Path:      "public/index.html",
			Content:   `<button data-testid="load-orders">Load</button>`,
		}},
		BrowserAcceptanceSpec{Actions: []BrowserAcceptanceAction{{
			Type:       "click",
			Selector:   "[data-testid='load-orders']",
			ExpectText: "Sample order loaded",
		}}},
	)
	if err == nil || !strings.Contains(err.Error(), "Sample order loaded") {
		t.Fatalf("expected missing postcondition error, got %v", err)
	}
}

func TestValidateGenerationBrowserActionGroundingRejectsBlockedCustomValidation(t *testing.T) {
	operation := GenerationFileOperation{
		Operation: GenerationFileOperationReplace,
		Path:      "app/page.tsx",
		Content: strings.Join([]string{
			`<form onSubmit={handleSubmit}>`,
			`  <input required />`,
			`  <button type="submit" data-testid="submit-form">Submit</button>`,
			`  {error && <p>Please complete required fields</p>}`,
			`</form>`,
		}, "\n"),
	}
	spec := BrowserAcceptanceSpec{Actions: []BrowserAcceptanceAction{{
		Type:       "click",
		Selector:   "[data-testid='submit-form']",
		ExpectText: "Please complete required fields",
	}}}
	if err := validateGenerationBrowserActionGrounding(
		[]GenerationFileOperation{operation},
		spec,
	); err == nil || !strings.Contains(err.Error(), "add noValidate") {
		t.Fatalf("expected native validation blocker, got %v", err)
	}

	operation.Content = strings.Replace(
		operation.Content,
		"<form onSubmit={handleSubmit}>",
		"<form onSubmit={handleSubmit} noValidate>",
		1,
	)
	if err := validateGenerationBrowserActionGrounding(
		[]GenerationFileOperation{operation},
		spec,
	); err != nil {
		t.Fatalf("expected noValidate form to preserve custom validation, got %v", err)
	}
}

func TestValidateGenerationBrowserActionGroundingRejectsMissingScaffoldText(t *testing.T) {
	err := validateGenerationBrowserActionGrounding(
		[]GenerationFileOperation{{
			Operation: GenerationFileOperationCreate,
			Path:      "package.json",
			Content:   `{"dependencies":{"next":"13.5.6"}}`,
		}},
		BrowserAcceptanceSpec{RequiredText: []string{"Aperture Catalog"}},
	)
	if err == nil || !strings.Contains(err.Error(), "Aperture Catalog") {
		t.Fatalf("expected missing scaffold text error, got %v", err)
	}
}

func TestValidateGenerationBrowserActionGroundingRejectsPlaceholderOnlyText(t *testing.T) {
	operation := GenerationFileOperation{
		Operation: GenerationFileOperationPatch,
		Path:      "src/App.jsx",
		Edits: []GenerationTextEdit{{
			OldText: `<ul>{records}</ul>`,
			NewText: strings.Join([]string{
				`const [search, setSearch] = useState("");`,
				`<input data-testid="global-search" placeholder="Search" onChange={event => setSearch(event.target.value)} />`,
				`<ul>{records}</ul>`,
			}, "\n"),
		}},
	}
	err := validateGenerationBrowserActionGrounding(
		[]GenerationFileOperation{operation},
		BrowserAcceptanceSpec{RequiredText: []string{"Search"}},
	)
	if err == nil || !strings.Contains(err.Error(), "non-body metadata or attributes") {
		t.Fatalf("expected placeholder-only required text rejection, got %v", err)
	}

	operation.Edits[0].NewText = strings.Join([]string{
		`<label htmlFor="global-search">Search</label>`,
		`<input id="global-search" data-testid="global-search" placeholder="Search records" />`,
		`<ul>{records}</ul>`,
	}, "\n")
	if err := validateGenerationBrowserActionGrounding(
		[]GenerationFileOperation{operation},
		BrowserAcceptanceSpec{RequiredText: []string{"Search"}},
	); err != nil {
		t.Fatalf("expected visible label to ground required text, got %v", err)
	}
}

func TestValidateGenerationBrowserActionGroundingRejectsHiddenRequiredText(t *testing.T) {
	tests := []struct {
		name    string
		content string
	}{
		{
			name:    "inline display none",
			content: `<label style={{display:'none'}}>Search</label><input placeholder="Search" />`,
		},
		{
			name:    "hidden attribute",
			content: `<p hidden>Search</p><input placeholder="Search" />`,
		},
		{
			name:    "screen reader only class",
			content: `<span className="sr-only">Search</span><input placeholder="Search" />`,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateGenerationBrowserActionGrounding(
				[]GenerationFileOperation{{
					Operation: GenerationFileOperationPatch,
					Path:      "src/App.jsx",
					Edits: []GenerationTextEdit{{
						NewText: test.content,
					}},
				}},
				BrowserAcceptanceSpec{RequiredText: []string{"Search"}},
			)
			if err == nil || !strings.Contains(err.Error(), "non-body metadata or attributes") {
				t.Fatalf("expected hidden required text rejection, got %v", err)
			}
		})
	}
}

func TestValidateGenerationBrowserActionGroundingAllowsExistingPagePatch(t *testing.T) {
	err := validateGenerationBrowserActionGrounding(
		[]GenerationFileOperation{{
			Operation: GenerationFileOperationPatch,
			Path:      "app/page.tsx",
			Edits: []GenerationTextEdit{{
				OldText: "const light = true",
				NewText: "const light = false",
			}},
		}},
		BrowserAcceptanceSpec{RequiredText: []string{"Existing heading"}},
	)
	if err != nil {
		t.Fatalf("expected unchanged required text to be allowed for incremental patch, got %v", err)
	}
}
