// Package handler HTTP 处理器
package handler

import (
	"context"

	"github.com/cloudwego/hertz/pkg/app"

	"yistack/pkg/llm"
)

// ModelsHandler 模型处理器
type ModelsHandler struct {
	llmClient *llm.ProviderManager
}

// NewModelsHandler 创建模型处理器
func NewModelsHandler(llmClient *llm.ProviderManager) *ModelsHandler {
	return &ModelsHandler{llmClient: llmClient}
}

// GetModels 获取可用模型列表
// GET /api/chat/models
func (h *ModelsHandler) GetModels(c context.Context, ctx *app.RequestContext) {
	if h.llmClient == nil {
		ctx.JSON(500, map[string]interface{}{
			"success": false,
			"error":   "LLM client not initialized",
		})
		return
	}

	providers := h.llmClient.ListProvidersDetailed()

	ctx.JSON(200, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"providers": providers,
			"current":   h.llmClient.GetCurrentName(),
		},
	})
}

// GetCurrent 获取当前模型配置
// GET /api/llm/config
func (h *ModelsHandler) GetCurrent(c context.Context, ctx *app.RequestContext) {
	if h.llmClient == nil {
		ctx.JSON(500, map[string]interface{}{
			"success": false,
			"error":   "LLM client not initialized",
		})
		return
	}

	current := h.llmClient.GetCurrentName()
	config := h.llmClient.GetConfig(current)

	ctx.JSON(200, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"current_provider": current,
			"config":           config,
		},
	})
}
