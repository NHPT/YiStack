package handler

import (
	"context"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"
)

// GetConfig 获取系统配置。
// GET /api/admin/config
func (h *AdminHandler) GetConfig(c context.Context, ctx *app.RequestContext) {
	adminID, role, ok := h.currentAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}

	configs, err := h.adminService.ListVisibleConfigs(c, adminID, role)
	if err != nil {
		statusCode := consts.StatusInternalServerError
		if err.Error() == "missing permission: system.config.read" {
			statusCode = consts.StatusForbidden
		}
		ctx.JSON(statusCode, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    configs,
	})
}

// UpdateConfig 更新系统配置。
// PUT /api/admin/config/:key
func (h *AdminHandler) UpdateConfig(c context.Context, ctx *app.RequestContext) {
	adminID, role, ok := h.currentAdmin(ctx)
	if !ok {
		return
	}
	key := ctx.Param("key")
	if key == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "key is required"})
		return
	}
	var req struct {
		Value string `json:"value"`
	}
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}

	if err := h.adminService.UpdateConfig(c, adminID, role, key, req.Value, string(ctx.ClientIP())); err != nil {
		statusCode := consts.StatusInternalServerError
		if err.Error() == "missing permission: system.config.update" || err.Error() == "missing permission: system.container_config.update" {
			statusCode = consts.StatusForbidden
		}
		ctx.JSON(statusCode, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": map[string]string{"key": key, "value": req.Value}})
}
