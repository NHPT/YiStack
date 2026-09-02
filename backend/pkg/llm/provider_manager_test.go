package llm

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

type providerManagerNoopProvider struct{}

func (p providerManagerNoopProvider) Chat(ctx context.Context, messages []Message, opts ...Option) (*ChatResponse, error) {
	return &ChatResponse{}, nil
}

func (p providerManagerNoopProvider) StreamChat(ctx context.Context, messages []Message, handler StreamChunkHandler, opts ...Option) error {
	return nil
}

type providerManagerRecordingProvider struct {
	lastModel           string
	lastMaxTokens       int
	lastReasoningEffort string
}

func (p *providerManagerRecordingProvider) Chat(ctx context.Context, messages []Message, opts ...Option) (*ChatResponse, error) {
	req := &ChatRequest{}
	for _, opt := range opts {
		opt(req)
	}
	p.lastModel = req.Model
	p.lastMaxTokens = req.MaxTokens
	p.lastReasoningEffort = req.ReasoningEffort
	return &ChatResponse{}, nil
}

func (p *providerManagerRecordingProvider) StreamChat(ctx context.Context, messages []Message, handler StreamChunkHandler, opts ...Option) error {
	req := &ChatRequest{}
	for _, opt := range opts {
		opt(req)
	}
	p.lastModel = req.Model
	p.lastMaxTokens = req.MaxTokens
	p.lastReasoningEffort = req.ReasoningEffort
	return nil
}

func TestProviderManagerListProvidersUsesRegistrationOrder(t *testing.T) {
	manager := NewProviderManager()
	manager.RegisterProvider("doubao", providerManagerNoopProvider{}, &ProviderConfig{Model: "doubao"})
	manager.RegisterProvider("openai", providerManagerNoopProvider{}, &ProviderConfig{Model: "openai"})
	manager.RegisterProvider("deterministic", providerManagerNoopProvider{}, &ProviderConfig{Model: deterministicProviderModel})

	providers := manager.ListProviders()
	want := []string{"doubao", "openai", "deterministic"}
	if len(providers) != len(want) {
		t.Fatalf("expected provider count %d, got %#v", len(want), providers)
	}
	for index, provider := range providers {
		if provider != want[index] {
			t.Fatalf("expected providers %#v, got %#v", want, providers)
		}
	}
}

func TestProviderManagerListProvidersRemovesUnregisteredProviderFromOrder(t *testing.T) {
	manager := NewProviderManager()
	manager.RegisterProvider("doubao", providerManagerNoopProvider{}, &ProviderConfig{Model: "doubao"})
	manager.RegisterProvider("deterministic", providerManagerNoopProvider{}, &ProviderConfig{Model: deterministicProviderModel})
	if err := manager.SetCurrent("doubao"); err != nil {
		t.Fatalf("expected current provider to be set: %v", err)
	}

	manager.UnregisterProvider("doubao")

	providers := manager.ListProviders()
	if len(providers) != 1 || providers[0] != "deterministic" {
		t.Fatalf("expected deterministic provider to remain, got %#v", providers)
	}
	if manager.GetCurrentName() != "deterministic" {
		t.Fatalf("expected current provider to move to deterministic, got %q", manager.GetCurrentName())
	}
}

func TestProviderManagerChatWithProviderDoesNotChangeCurrent(t *testing.T) {
	manager := NewProviderManager()
	first := &providerManagerRecordingProvider{}
	second := &providerManagerRecordingProvider{}
	manager.RegisterProvider("first", first, &ProviderConfig{Model: "first-model"})
	manager.RegisterProvider("second", second, &ProviderConfig{Model: "second-model"})
	if err := manager.SetCurrent("first"); err != nil {
		t.Fatalf("expected current provider to be set: %v", err)
	}

	if _, err := manager.ChatWithProvider(context.Background(), "second", &ChatRequest{MaxTokens: 1234, ReasoningEffort: "low"}); err != nil {
		t.Fatalf("expected scoped provider chat to succeed: %v", err)
	}

	if manager.GetCurrentName() != "first" {
		t.Fatalf("expected current provider to remain first, got %q", manager.GetCurrentName())
	}
	if second.lastModel != "second-model" {
		t.Fatalf("expected second provider model, got %q", second.lastModel)
	}
	if second.lastMaxTokens != 1234 {
		t.Fatalf("expected request max tokens to be forwarded, got %d", second.lastMaxTokens)
	}
	if second.lastReasoningEffort != "low" {
		t.Fatalf("expected request reasoning effort to be forwarded, got %q", second.lastReasoningEffort)
	}
	if first.lastModel != "" {
		t.Fatalf("expected first provider to be untouched, got model %q", first.lastModel)
	}
}

func TestProviderManagerUsesConfiguredMaxTokensWhenRequestOmitsBudget(t *testing.T) {
	manager := NewProviderManager()
	provider := &providerManagerRecordingProvider{}
	manager.RegisterProvider("configured", provider, &ProviderConfig{
		Model:     "configured-model",
		MaxTokens: 4096,
	})

	if _, err := manager.ChatWithProvider(
		context.Background(),
		"configured",
		&ChatRequest{},
	); err != nil {
		t.Fatalf("expected configured provider chat to succeed: %v", err)
	}
	if provider.lastMaxTokens != 4096 {
		t.Fatalf(
			"expected configured chat max tokens, got %d",
			provider.lastMaxTokens,
		)
	}

	provider.lastMaxTokens = 0
	if err := manager.StreamChatWithProvider(
		context.Background(),
		"configured",
		&ChatRequest{Stream: true},
		nil,
	); err != nil {
		t.Fatalf("expected configured provider stream to succeed: %v", err)
	}
	if provider.lastMaxTokens != 4096 {
		t.Fatalf(
			"expected configured stream max tokens, got %d",
			provider.lastMaxTokens,
		)
	}
}

func TestDeterministicProviderRecognizesPlanLineUserProtocol(t *testing.T) {
	provider := NewDeterministicProvider()
	response, err := provider.Chat(context.Background(), []Message{
		{Role: "system", Content: "旧的数据库方案提示词"},
		{Role: "user", Content: "请基于以下信息，输出 2-3 个候选技术方案。注意：每个方案单独占一行，并且每一行都是完整 JSON 对象。"},
	})
	if err != nil {
		t.Fatalf("expected deterministic provider response, got %v", err)
	}
	if response == nil || len(response.Choices) == 0 {
		t.Fatal("expected deterministic choices")
	}
	content := response.Choices[0].Message.Content
	if !strings.Contains(content, "plan_nextjs_core_loop") {
		t.Fatalf("expected deterministic plan lines, got %q", content)
	}
}

func TestDeterministicProviderStreamChunksPreserveUTF8(t *testing.T) {
	chunks := splitDeterministicStreamChunks(strings.Repeat("核心生成产品闭环", 20))
	if len(chunks) == 0 {
		t.Fatal("expected chunks")
	}
	for _, chunk := range chunks {
		if strings.Contains(chunk, "�") {
			t.Fatalf("expected utf8-safe chunk, got %q", chunk)
		}
	}
}

func TestDeterministicProviderGenerationResultIncludesRunnableNextProject(t *testing.T) {
	content := deterministicGenerationResult(nil)
	var result struct {
		Operations []struct {
			Operation string `json:"operation"`
			Path      string `json:"path"`
		} `json:"operations"`
		Commands []string `json:"commands"`
	}
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		t.Fatalf("expected generation result json, got %v", err)
	}
	paths := map[string]bool{}
	for _, operation := range result.Operations {
		if operation.Operation != "create" {
			t.Fatalf("expected deterministic create operation, got %#v", operation)
		}
		paths[operation.Path] = true
	}
	for _, path := range []string{"package.json", "tsconfig.json", "src/app/layout.tsx", "src/app/page.tsx", "server.js"} {
		if paths[path] == false {
			t.Fatalf("expected generated file %q, got %#v", path, paths)
		}
	}
	if len(result.Commands) != 0 {
		t.Fatalf("expected Preview runtime to own server startup, got %#v", result.Commands)
	}
}

func TestDeterministicProviderUsesSnapshotHashesForExistingFiles(t *testing.T) {
	content := deterministicGenerationResult([]Message{{Role: "system", Content: strings.Join([]string{
		"当前项目文件快照（生成开始时的只读真源）：",
		"replace/patch/delete 的 base_hash 必须逐字使用对应文件的 sha256；未列出的路径只能使用 create。",
		`{"files":[{"path":"package.json","sha256":"hash-package","content":"{}"}],"omitted_files":0}`,
	}, "\n")}})
	var result struct {
		Operations []map[string]any `json:"operations"`
	}
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		t.Fatalf("decode deterministic result: %v", err)
	}
	if result.Operations[0]["operation"] != "replace" || result.Operations[0]["base_hash"] != "hash-package" {
		t.Fatalf("expected existing file replace with snapshot hash, got %#v", result.Operations[0])
	}
}

func TestDeterministicProviderReturnsVersionedRepairOperation(t *testing.T) {
	systemPrompt := strings.Join([]string{
		"generation_repair.v1",
		"结构化修复上下文：",
		`{"allowed_paths":["app.ts"],"files":[{"path":"app.ts","exists":true,"sha256":"hash-app","content":"bad"}]}`,
	}, "\n")
	content := buildDeterministicCompletion([]Message{{Role: "system", Content: systemPrompt}})
	var result struct {
		SchemaVersion string           `json:"schema_version"`
		Operations    []map[string]any `json:"operations"`
	}
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		t.Fatalf("decode deterministic repair: %v", err)
	}
	if result.SchemaVersion != "generation_repair.v1" || len(result.Operations) != 1 || result.Operations[0]["path"] != "app.ts" {
		t.Fatalf("unexpected deterministic repair result: %#v", result)
	}
}

func TestProviderManagerSupportsCapabilityUsesExactCaseInsensitiveTags(t *testing.T) {
	manager := NewProviderManager()
	manager.RegisterProvider("vision", providerManagerNoopProvider{}, &ProviderConfig{
		Model:          "vision-model",
		CapabilityTags: "chat, Vision ,coding",
	})
	manager.RegisterProvider("text", providerManagerNoopProvider{}, &ProviderConfig{
		Model:          "text-model",
		CapabilityTags: "chat,computer-vision-preview",
	})

	if !manager.SupportsCapability("vision", "vision") {
		t.Fatal("expected exact vision capability to be supported")
	}
	if manager.SupportsCapability("text", "vision") {
		t.Fatal("substring capability must not be accepted as vision")
	}
	if manager.SupportsCapability("missing", "vision") {
		t.Fatal("missing provider must not report capabilities")
	}
}

func TestProviderManagerGetConfigReturnsCopy(t *testing.T) {
	manager := NewProviderManager()
	manager.RegisterProvider("vision", providerManagerNoopProvider{}, &ProviderConfig{
		Model:          "vision-model",
		CapabilityTags: "vision",
	})

	config := manager.GetConfig("vision")
	if config == nil {
		t.Fatal("expected provider config")
	}
	config.CapabilityTags = "chat"
	if !manager.SupportsCapability("vision", "vision") {
		t.Fatal("mutating a config snapshot must not mutate manager state")
	}
}
