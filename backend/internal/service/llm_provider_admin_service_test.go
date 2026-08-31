package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"yistack/internal/model"
)

func TestLLMProviderConnectionTestCallsCompatibleChatEndpoint(t *testing.T) {
	var observedPath string
	var observedAuthorization string
	var observedModel string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observedPath = r.URL.Path
		observedAuthorization = r.Header.Get("Authorization")
		var payload struct {
			Model string `json:"model"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode request payload: %v", err)
		}
		observedModel = payload.Model
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"test","model":"provider-model","choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`))
	}))
	defer server.Close()

	repo := &providerManagerServiceRepoStub{providers: []model.LLMProvider{{
		ID:      1,
		Name:    "test-provider",
		Type:    "cloud",
		BaseURL: server.URL,
		APIKey:  "secret-key",
		Model:   "provider-model",
		Enabled: true,
	}}}
	service := NewLLMProviderAdminService(repo, nil)

	result, err := service.BuildConnectionTestResult(context.Background(), &LLMProviderConnectionTestRequest{
		Provider: "test-provider",
	})
	if err != nil {
		t.Fatalf("BuildConnectionTestResult returned error: %v", err)
	}
	if result.Status != "ready" || result.HasAPIKey != true || result.Model != "provider-model" {
		t.Fatalf("expected ready connection test result, got %#v", result)
	}
	if observedPath != "/v1/chat/completions" {
		t.Fatalf("expected compatible chat endpoint, got %q", observedPath)
	}
	if observedAuthorization != "Bearer secret-key" {
		t.Fatalf("expected bearer authorization, got %q", observedAuthorization)
	}
	if observedModel != "provider-model" {
		t.Fatalf("expected model payload provider-model, got %q", observedModel)
	}
}

func TestLLMProviderSafeResponseAggregatesRuntimeLoadedFromProviderModels(t *testing.T) {
	provider := model.LLMProvider{
		ID:          1,
		Name:        "ollama-cloud",
		DisplayName: "Ollama (云端部署)",
		Type:        "cloud",
		Model:       "gpt-oss:20b",
		Enabled:     true,
	}
	models := []model.LLMProviderModel{{
		ProviderID: 1,
		ModelID:    "gpt-oss:20b",
		Enabled:    true,
		IsDefault:  true,
	}, {
		ProviderID: 1,
		ModelID:    "disabled-model",
		Enabled:    false,
	}}
	runtime := ProviderRuntimeSnapshot{
		CurrentProvider: "ollama-cloud::gpt-oss:20b",
		LoadedByName: map[string]struct{}{
			"ollama-cloud::gpt-oss:20b": {},
		},
	}

	response := toSafeLLMProvider(provider, models, runtime)
	if response.RuntimeLoaded != true {
		t.Fatalf("expected provider runtime_loaded from loaded child model, got false")
	}
	if response.RuntimeActive != true {
		t.Fatalf("expected provider runtime_active from current child model, got false")
	}
	if len(response.Models) != 2 {
		t.Fatalf("expected two model responses, got %d", len(response.Models))
	}
	if response.Models[0].RuntimeLoaded != true || response.Models[0].RuntimeActive != true {
		t.Fatalf("expected loaded child model to be loaded and active, got %#v", response.Models[0])
	}
	if response.Models[1].RuntimeLoaded == true || response.Models[1].RuntimeActive == true {
		t.Fatalf("disabled model should not be loaded or active, got %#v", response.Models[1])
	}
}

func TestLLMProviderConnectionTestBlocksIncompleteCloudProvider(t *testing.T) {
	repo := &providerManagerServiceRepoStub{providers: []model.LLMProvider{{
		ID:      1,
		Name:    "missing-key",
		Type:    "cloud",
		BaseURL: "https://example.invalid",
		Model:   "model-a",
		Enabled: true,
	}}}
	service := NewLLMProviderAdminService(repo, nil)

	result, err := service.BuildConnectionTestResult(context.Background(), &LLMProviderConnectionTestRequest{
		Provider: "missing-key",
	})
	if err != nil {
		t.Fatalf("BuildConnectionTestResult returned error: %v", err)
	}
	if result.Status != "blocked" || result.HasAPIKey != false {
		t.Fatalf("expected blocked connection test result without API key, got %#v", result)
	}
	if result.LatencyMS != 0 {
		t.Fatalf("blocked connection test should not call upstream, got latency=%d", result.LatencyMS)
	}
}

func TestLLMProviderConnectionTestReturnsFailedWithoutSecretLeak(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "upstream rejected request", http.StatusUnauthorized)
	}))
	defer server.Close()

	repo := &providerManagerServiceRepoStub{providers: []model.LLMProvider{{
		ID:      1,
		Name:    "bad-provider",
		Type:    "cloud",
		BaseURL: server.URL,
		APIKey:  "do-not-leak",
		Model:   "bad-model",
		Enabled: true,
	}}}
	service := NewLLMProviderAdminService(repo, nil)

	result, err := service.BuildConnectionTestResult(context.Background(), &LLMProviderConnectionTestRequest{
		Provider: "bad-provider",
	})
	if err != nil {
		t.Fatalf("BuildConnectionTestResult returned error: %v", err)
	}
	if result.Status != "failed" || result.HasAPIKey != true {
		t.Fatalf("expected failed connection test result, got %#v", result)
	}
	if result.Message == "" || result.Recovery == "" {
		t.Fatalf("failed result should include message and recovery: %#v", result)
	}
	if strings.Contains(result.Message, "do-not-leak") || strings.Contains(result.Recovery, "do-not-leak") {
		t.Fatalf("failed result leaked API key: %#v", result)
	}
}
