package service

import (
	"context"
	"errors"
	"testing"

	"yistack/pkg/llm"
)

type structuredOutputFallbackProvider struct {
	calls                  int
	responseFormatObserved []bool
	unsupported            bool
}

func (p *structuredOutputFallbackProvider) Chat(_ context.Context, _ []llm.Message, opts ...llm.Option) (*llm.ChatResponse, error) {
	request := &llm.ChatRequest{}
	for _, option := range opts {
		option(request)
	}
	p.calls++
	p.responseFormatObserved = append(p.responseFormatObserved, request.ResponseFormat != nil)
	if request.ResponseFormat != nil && p.unsupported {
		return nil, errors.New("request failed with status 400: response_format json_schema unsupported")
	}
	return &llm.ChatResponse{}, nil
}

func (p *structuredOutputFallbackProvider) StreamChat(_ context.Context, _ []llm.Message, handler llm.StreamChunkHandler, opts ...llm.Option) error {
	request := &llm.ChatRequest{}
	for _, option := range opts {
		option(request)
	}
	p.calls++
	p.responseFormatObserved = append(p.responseFormatObserved, request.ResponseFormat != nil)
	if request.ResponseFormat != nil && p.unsupported {
		return errors.New("request failed with status 400: response_format json_schema unsupported")
	}
	if handler != nil {
		return handler(&llm.StreamChunk{
			Choices: []llm.StreamChoice{{
				Delta: map[string]interface{}{"content": `{"schema_version":"generation_result.v2"}`},
			}},
		})
	}
	return nil
}

func TestStreamWithProviderFallbackRetriesWithoutUnsupportedJSONSchema(t *testing.T) {
	manager := llm.NewProviderManager()
	provider := &structuredOutputFallbackProvider{unsupported: true}
	manager.RegisterProvider("provider-a", provider, &llm.ProviderConfig{Model: "model-a"})

	recordedUses := 0
	var streamed string
	providerName, modelName, err := streamWithProviderFallback(
		context.Background(),
		manager,
		nil,
		"provider-a",
		"model-a",
		&llm.ChatRequest{
			ResponseFormat: generationResultResponseFormat(),
		},
		func(chunk *llm.StreamChunk) error {
			if chunk != nil && len(chunk.Choices) > 0 {
				content, _ := extractStreamDeltaParts(chunk.Choices[0].Delta)
				streamed += content
			}
			return nil
		},
		func(context.Context, string) {
			recordedUses++
		},
	)

	if err != nil {
		t.Fatalf("expected prompt-only strict JSON fallback to succeed, got %v", err)
	}
	if providerName != "provider-a" || modelName != "model-a" {
		t.Fatalf("expected selected provider/model, got %q/%q", providerName, modelName)
	}
	if provider.calls != 2 {
		t.Fatalf("expected one structured attempt and one fallback attempt, got %d", provider.calls)
	}
	if len(provider.responseFormatObserved) != 2 || provider.responseFormatObserved[0] != true || provider.responseFormatObserved[1] != false {
		t.Fatalf("expected structured then prompt-only calls, got %#v", provider.responseFormatObserved)
	}
	if streamed == "" {
		t.Fatal("expected fallback stream content")
	}
	if recordedUses != 1 {
		t.Fatalf("expected one successful real provider call to be counted, got %d", recordedUses)
	}
}

func TestChatWithProviderFallbackRetriesWithoutUnsupportedJSONSchema(t *testing.T) {
	manager := llm.NewProviderManager()
	provider := &structuredOutputFallbackProvider{unsupported: true}
	manager.RegisterProvider("provider-a", provider, &llm.ProviderConfig{Model: "model-a"})

	recordedUses := 0
	_, providerName, modelName, err := chatWithProviderFallback(
		context.Background(),
		manager,
		nil,
		"provider-a",
		"model-a",
		&llm.ChatRequest{ResponseFormat: generationResultResponseFormat()},
		func(context.Context, string) {
			recordedUses++
		},
	)

	if err != nil {
		t.Fatalf("expected prompt-only strict JSON fallback to succeed, got %v", err)
	}
	if providerName != "provider-a" || modelName != "model-a" || provider.calls != 2 {
		t.Fatalf("unexpected fallback result provider=%q model=%q calls=%d", providerName, modelName, provider.calls)
	}
	if recordedUses != 1 {
		t.Fatalf("expected one successful provider use, got %d", recordedUses)
	}
}
