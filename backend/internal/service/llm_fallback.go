package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"yistack/config"
	"yistack/pkg/llm"
)

type llmProviderUseRecorder func(ctx context.Context, providerName string)

// resolveModelForCurrentProvider 为当前 provider 解析最终要使用的模型名。
// 优先级是显式请求模型 > 当前 provider 配置模型 > 全局默认模型。
func resolveModelForCurrentProvider(llmClient *llm.ProviderManager, llmCfg *config.LLMConfig, requestedModel string) string {
	currentProvider := ""
	if llmClient != nil {
		currentProvider = llmClient.GetCurrentName()
	}
	return resolveModelForProvider(llmClient, llmCfg, currentProvider, requestedModel)
}

// resolveModelForProvider 为指定 provider 解析最终要使用的模型名。
func resolveModelForProvider(llmClient *llm.ProviderManager, llmCfg *config.LLMConfig, providerName string, requestedModel string) string {
	if requestedModel != "" {
		return requestedModel
	}
	if llmClient != nil {
		if cfg := llmClient.GetConfig(strings.TrimSpace(providerName)); cfg != nil && cfg.Model != "" {
			return cfg.Model
		}
	}
	if llmCfg != nil && llmCfg.DefaultModel != "" {
		return llmCfg.DefaultModel
	}
	return ""
}

// cloneChatRequest 复制请求对象，避免 fallback 重试时复用同一个请求实例引入副作用。
func cloneChatRequest(chatReq *llm.ChatRequest, model string) *llm.ChatRequest {
	if chatReq == nil {
		return nil
	}

	cloned := *chatReq
	if model != "" {
		cloned.Model = model
	}
	if len(chatReq.Messages) > 0 {
		cloned.Messages = append([]llm.Message(nil), chatReq.Messages...)
	}
	return &cloned
}

func cloneChatRequestWithoutResponseFormat(chatReq *llm.ChatRequest, model string) *llm.ChatRequest {
	cloned := cloneChatRequest(chatReq, model)
	if cloned != nil {
		cloned.ResponseFormat = nil
	}
	return cloned
}

func isStructuredResponseFormatUnsupported(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	if !strings.Contains(message, "status 400") && !strings.Contains(message, "status 422") {
		return false
	}
	return strings.Contains(message, "response_format") ||
		strings.Contains(message, "json_schema") ||
		strings.Contains(message, "structured output") ||
		strings.Contains(message, "unknown field")
}

func providerFallbackOrder(llmClient *llm.ProviderManager, requestedProvider string) ([]string, error) {
	if llmClient == nil {
		return nil, errors.New("LLM provider manager not initialized")
	}
	requestedProvider = strings.TrimSpace(requestedProvider)
	if requestedProvider != "" {
		if _, err := llmClient.GetProvider(requestedProvider); err != nil {
			return nil, fmt.Errorf("requested LLM provider %q is not loaded", requestedProvider)
		}
		return []string{requestedProvider}, nil
	}
	providers := llmClient.ListProviders()
	if len(providers) == 0 {
		return nil, errors.New("no LLM provider available")
	}
	return providers, nil
}

func initialProviderName(llmClient *llm.ProviderManager, requestedProvider string) string {
	requestedProvider = strings.TrimSpace(requestedProvider)
	if requestedProvider != "" {
		return requestedProvider
	}
	if llmClient == nil {
		return ""
	}
	return llmClient.GetCurrentName()
}

func recordLLMProviderUse(ctx context.Context, recordUse llmProviderUseRecorder, providerName string) {
	if recordUse == nil || strings.TrimSpace(providerName) == "" {
		return
	}
	recordUse(ctx, providerName)
}

// chatWithProviderFallback 按 provider 顺序执行非流式请求。
// 一旦某个 provider 成功，立即返回成功响应以及实际使用的 provider/model。
func chatWithProviderFallback(
	ctx context.Context,
	llmClient *llm.ProviderManager,
	llmCfg *config.LLMConfig,
	requestedProvider string,
	requestedModel string,
	chatReq *llm.ChatRequest,
	recordUse llmProviderUseRecorder,
) (*llm.ChatResponse, string, string, error) {
	providers, orderErr := providerFallbackOrder(llmClient, requestedProvider)
	if orderErr != nil {
		return nil, "", "", orderErr
	}

	var lastErr error
	for _, providerName := range providers {
		modelName := resolveModelForProvider(llmClient, llmCfg, providerName, requestedModel)
		resp, err := llmClient.ChatWithProvider(ctx, providerName, cloneChatRequest(chatReq, modelName))
		if err != nil && chatReq != nil && chatReq.ResponseFormat != nil && isStructuredResponseFormatUnsupported(err) {
			resp, err = llmClient.ChatWithProvider(ctx, providerName, cloneChatRequestWithoutResponseFormat(chatReq, modelName))
		}
		if err == nil {
			recordLLMProviderUse(ctx, recordUse, providerName)
			return resp, providerName, modelName, nil
		}
		lastErr = err
	}

	return nil, "", "", lastErr
}

// streamWithProviderFallback 按 provider 顺序执行流式请求。
// 只有在当前 provider 尚未向外发送有效内容时才允许切换，避免两个 provider 的输出混流。
func streamWithProviderFallback(
	ctx context.Context,
	llmClient *llm.ProviderManager,
	llmCfg *config.LLMConfig,
	requestedProvider string,
	requestedModel string,
	chatReq *llm.ChatRequest,
	handler llm.StreamChunkHandler,
	recordUse llmProviderUseRecorder,
) (string, string, error) {
	providers, orderErr := providerFallbackOrder(llmClient, requestedProvider)
	if orderErr != nil {
		return "", "", orderErr
	}

	var lastErr error
	for _, providerName := range providers {
		modelName := resolveModelForProvider(llmClient, llmCfg, providerName, requestedModel)
		emitted := false

		streamHandler := func(chunk *llm.StreamChunk) error {
			if !emitted && chunk != nil && len(chunk.Choices) > 0 && chunk.Choices[0].Delta != nil {
				content, reasoning := extractStreamDeltaParts(chunk.Choices[0].Delta)
				if content != "" || reasoning != "" {
					emitted = true
				}
			}
			return handler(chunk)
		}
		err := llmClient.StreamChatWithProvider(ctx, providerName, cloneChatRequest(chatReq, modelName), streamHandler)
		if err != nil && !emitted && chatReq != nil && chatReq.ResponseFormat != nil && isStructuredResponseFormatUnsupported(err) {
			err = llmClient.StreamChatWithProvider(ctx, providerName, cloneChatRequestWithoutResponseFormat(chatReq, modelName), streamHandler)
		}
		if err == nil {
			recordLLMProviderUse(ctx, recordUse, providerName)
			return providerName, modelName, nil
		}
		if emitted {
			return providerName, modelName, err
		}
		lastErr = err
	}

	return "", "", lastErr
}

func extractStreamDeltaParts(delta map[string]interface{}) (string, string) {
	if delta == nil {
		return "", ""
	}

	content := extractDeltaTextValue(delta["content"])
	reasoning := firstNonEmpty(
		extractDeltaTextValue(delta["reasoning_content"]),
		extractDeltaTextValue(delta["reasoning"]),
		extractDeltaTextValue(delta["reasoningContent"]),
	)

	return content, reasoning
}

func extractDeltaTextValue(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return typed
	case []interface{}:
		parts := make([]string, 0, len(typed))
		for _, item := range typed {
			if text := extractDeltaTextValue(item); hasVisibleText(text) {
				parts = append(parts, text)
			}
		}
		return strings.Join(parts, "")
	case map[string]interface{}:
		return firstNonEmpty(
			extractDeltaTextValue(typed["text"]),
			extractDeltaTextValue(typed["content"]),
			extractDeltaTextValue(typed["value"]),
		)
	default:
		return ""
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if hasVisibleText(value) {
			return value
		}
	}
	return ""
}

func hasVisibleText(value string) bool {
	return strings.TrimSpace(value) != ""
}
