// Package handler HTTP 处理器
package handler

import (
	"context"
	"encoding/json"
	"strconv"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/internal/model"
	"yistack/internal/service"
)

// ============================================
// LLMProviderHandler LLM 提供商管理处理器
// ============================================

// LLMProviderHandler LLM 提供商处理器
type LLMProviderHandler struct {
	adminService *service.LLMProviderAdminService
}

// NewLLMProviderHandler 创建 LLM 提供商处理器
func NewLLMProviderHandler(repo service.LLMProviderRepo, providerMgr *service.ProviderManagerService) *LLMProviderHandler {
	return &LLMProviderHandler{
		adminService: service.NewLLMProviderAdminService(repo, providerMgr),
	}
}

// isDBAvailable 检查数据库是否可用
func (h *LLMProviderHandler) isDBAvailable(ctx *app.RequestContext) bool {
	if h.adminService == nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "database not connected, please configure SUPABASE_DB_PASSWORD in .env",
		})
		return false
	}
	if err := h.adminService.EnsureAvailable(); err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return false
	}
	return true
}

// List GET /api/llm/providers 获取所有 LLM 提供商
func (h *LLMProviderHandler) List(c context.Context, ctx *app.RequestContext) {
	if !h.isDBAvailable(ctx) {
		return
	}
	providers, defaultID, defaultName, err := h.adminService.ListProviders(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to list providers",
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"providers":    providers,
			"default_id":   defaultID,
			"default_name": defaultName,
		},
	})
}

// ListAdmin GET /api/admin/llm/providers 获取管理端 LLM 提供商配置列表。
func (h *LLMProviderHandler) ListAdmin(c context.Context, ctx *app.RequestContext) {
	if !h.isDBAvailable(ctx) {
		return
	}
	providers, defaultID, defaultName, err := h.adminService.ListAdminProviders(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to list providers",
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"providers":    providers,
			"default_id":   defaultID,
			"default_name": defaultName,
		},
	})
}

// Get GET /api/llm/providers/:id 获取单个提供商
func (h *LLMProviderHandler) Get(c context.Context, ctx *app.RequestContext) {
	if !h.isDBAvailable(ctx) {
		return
	}
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid provider ID",
		})
		return
	}

	provider, err := h.adminService.GetProvider(c, int64(id))
	if err != nil {
		ctx.JSON(consts.StatusNotFound, map[string]interface{}{
			"error": "Provider not found",
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    provider,
	})
}

// GetAdmin GET /api/admin/llm/providers/:id 获取单个提供商的管理端安全配置。
func (h *LLMProviderHandler) GetAdmin(c context.Context, ctx *app.RequestContext) {
	if !h.isDBAvailable(ctx) {
		return
	}
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid provider ID",
		})
		return
	}

	provider, err := h.adminService.GetAdminProvider(c, int64(id))
	if err != nil {
		ctx.JSON(consts.StatusNotFound, map[string]interface{}{
			"error": "Provider not found",
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    provider,
	})
}

// CreateRequest 创建提供商请求
type CreateProviderRequest struct {
	Name        string                            `json:"name" form:"name"`                 // 提供商唯一标识
	DisplayName string                            `json:"display_name" form:"display_name"` // 显示名称
	Type        string                            `json:"type" form:"type"`                 // cloud 或 local
	APIKey      string                            `json:"api_key" form:"api_key"`           // API Key
	BaseURL     string                            `json:"base_url" form:"base_url"`         // Base URL
	Model       string                            `json:"model" form:"model"`               // 默认模型
	Enabled     bool                              `json:"enabled" form:"enabled"`           // 是否启用
	IsDefault   bool                              `json:"is_default" form:"is_default"`     // 是否默认
	Priority    int                               `json:"priority" form:"priority"`         // 优先级
	SortOrder   int                               `json:"sort_order" form:"sort_order"`     // 排序
	ExtraConfig string                            `json:"extra_config" form:"extra_config"` // 额外配置 JSON
	Models      []service.LLMProviderModelRequest `json:"models" form:"models"`             // Provider 下的模型列表
}

// Create POST /api/llm/providers 创建提供商
func (h *LLMProviderHandler) Create(c context.Context, ctx *app.RequestContext) {
	if !h.isDBAvailable(ctx) {
		return
	}
	var req CreateProviderRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	// 验证必填字段
	if req.Name == "" || req.BaseURL == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Name and BaseURL are required",
		})
		return
	}

	provider, err := h.adminService.CreateProvider(c, &service.LLMProviderCreateRequest{
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Type:        req.Type,
		APIKey:      req.APIKey,
		BaseURL:     req.BaseURL,
		Model:       req.Model,
		Enabled:     req.Enabled,
		IsDefault:   req.IsDefault,
		Priority:    req.Priority,
		SortOrder:   req.SortOrder,
		ExtraConfig: req.ExtraConfig,
		Models:      req.Models,
	})
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to create provider",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    provider,
	})
}

// UpdateRequest 更新提供商请求
type UpdateProviderRequest struct {
	DisplayName *string                            `json:"display_name" form:"display_name"`
	Type        *string                            `json:"type" form:"type"`
	APIKey      *string                            `json:"api_key" form:"api_key"`
	BaseURL     *string                            `json:"base_url" form:"base_url"`
	Model       *string                            `json:"model" form:"model"`
	Enabled     *bool                              `json:"enabled" form:"enabled"`
	IsDefault   *bool                              `json:"is_default" form:"is_default"`
	Priority    *int                               `json:"priority" form:"priority"`
	SortOrder   *int                               `json:"sort_order" form:"sort_order"`
	ExtraConfig *string                            `json:"extra_config" form:"extra_config"`
	Models      *[]service.LLMProviderModelRequest `json:"models" form:"models"`
}

// Update PUT /api/llm/providers/:id 更新提供商
func (h *LLMProviderHandler) Update(c context.Context, ctx *app.RequestContext) {
	if !h.isDBAvailable(ctx) {
		return
	}
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid provider ID",
		})
		return
	}

	var req UpdateProviderRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	provider, err := h.adminService.UpdateProvider(c, int64(id), &service.LLMProviderUpdateRequest{
		DisplayName: req.DisplayName,
		Type:        req.Type,
		APIKey:      req.APIKey,
		BaseURL:     req.BaseURL,
		Model:       req.Model,
		Enabled:     req.Enabled,
		IsDefault:   req.IsDefault,
		Priority:    req.Priority,
		SortOrder:   req.SortOrder,
		ExtraConfig: req.ExtraConfig,
		Models:      req.Models,
	})
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to update provider",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    provider,
	})
}

// Delete DELETE /api/llm/providers/:id 删除提供商
func (h *LLMProviderHandler) Delete(c context.Context, ctx *app.RequestContext) {
	if !h.isDBAvailable(ctx) {
		return
	}
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid provider ID",
		})
		return
	}

	if err := h.adminService.DeleteProvider(c, int64(id)); err != nil {
		statusCode := consts.StatusInternalServerError
		if err.Error() == "cannot delete default provider" {
			statusCode = consts.StatusBadRequest
		}
		ctx.JSON(statusCode, map[string]interface{}{
			"error":   "Failed to delete provider",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Provider deleted",
	})
}

// SetDefault PUT /api/llm/providers/:id/default 设置默认
func (h *LLMProviderHandler) SetDefault(c context.Context, ctx *app.RequestContext) {
	if !h.isDBAvailable(ctx) {
		return
	}
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid provider ID",
		})
		return
	}

	if err := h.adminService.SetDefaultProvider(c, int64(id)); err != nil {
		statusCode := consts.StatusInternalServerError
		if err.Error() == "cannot set disabled provider as default" {
			statusCode = consts.StatusBadRequest
		}
		ctx.JSON(statusCode, map[string]interface{}{
			"error":   "Failed to set default provider",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Default provider updated",
	})
}

// DiscoverModels POST /api/admin/llm/providers/:id/models/discover 自动发现并同步 Provider 模型列表。
func (h *LLMProviderHandler) DiscoverModels(c context.Context, ctx *app.RequestContext) {
	if !h.isDBAvailable(ctx) {
		return
	}
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid provider ID",
		})
		return
	}
	result, err := h.adminService.DiscoverProviderModels(c, id)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to discover provider models",
			"details": err.Error(),
		})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// TestRequest 测试连接请求
type TestRequest struct {
	Provider string `json:"provider"` // 提供商名称
	Model    string `json:"model"`    // 模型名称
	APIKey   string `json:"api_key"`  // API Key（可选，用于测试）
	BaseURL  string `json:"base_url"` // Base URL（可选）
	Message  string `json:"message"`  // 测试消息
}

// TestConnection POST /api/llm/providers/test 测试连接
func (h *LLMProviderHandler) TestConnection(c context.Context, ctx *app.RequestContext) {
	var req TestRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	// 如果提供了提供商 ID，从数据库获取配置
	if req.Provider == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Provider is required",
		})
		return
	}

	result, err := h.adminService.BuildConnectionTestResult(c, &service.LLMProviderConnectionTestRequest{
		Provider: req.Provider,
		Model:    req.Model,
		APIKey:   req.APIKey,
		BaseURL:  req.BaseURL,
		Message:  req.Message,
	})
	if err != nil {
		ctx.JSON(consts.StatusNotFound, map[string]interface{}{
			"error":   "Provider not found",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// ============================================
// 辅助函数
// ============================================

// ParseExtraConfig 解析额外配置
func ParseExtraConfig(jsonStr string) *model.LLMProviderExtraConfig {
	if jsonStr == "" {
		return &model.LLMProviderExtraConfig{}
	}
	var config model.LLMProviderExtraConfig
	if err := json.Unmarshal([]byte(jsonStr), &config); err != nil {
		return &model.LLMProviderExtraConfig{}
	}
	return &config
}

// Reload POST /api/llm/providers/reload 热加载 LLM 配置（无需重启后端）
func (h *LLMProviderHandler) Reload(c context.Context, ctx *app.RequestContext) {
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{
			"success": false,
			"error":   "Provider service not initialized",
		})
		return
	}

	providers, err := h.adminService.ReloadProviders(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Failed to reload: " + err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success":   true,
		"message":   "LLM providers reloaded successfully",
		"providers": providers,
	})
}
