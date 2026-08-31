package handler

import (
	"context"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/internal/service"
)

// AdminHandler 管理员控制台处理器。
// 认证信息读取属于 handler 职责；后台业务编排、审计与数据聚合收口到 AdminConsoleService。
type AdminHandler struct {
	adminService *service.AdminConsoleService
}

// NewAdminHandler 创建管理员处理器。
func NewAdminHandler(adminService *service.AdminConsoleService) *AdminHandler {
	return &AdminHandler{adminService: adminService}
}

func (h *AdminHandler) currentAdmin(ctx *app.RequestContext) (string, string, bool) {
	adminID, exists := ctx.Get("admin_id")
	if !exists {
		ctx.JSON(consts.StatusUnauthorized, map[string]interface{}{"success": false, "error": "admin authentication required"})
		return "", "", false
	}
	uid, ok := adminID.(string)
	if !ok || uid == "" {
		ctx.JSON(consts.StatusUnauthorized, map[string]interface{}{"success": false, "error": "invalid admin id"})
		return "", "", false
	}
	roleValue, _ := ctx.Get("role")
	role, _ := roleValue.(string)
	if role != "admin" && role != "super_admin" {
		ctx.JSON(consts.StatusForbidden, map[string]interface{}{"success": false, "error": "insufficient permissions"})
		return "", "", false
	}
	return uid, role, true
}

func (h *AdminHandler) requireSuperAdmin(ctx *app.RequestContext) (string, bool) {
	adminID, role, ok := h.currentAdmin(ctx)
	if !ok {
		return "", false
	}
	if role != "super_admin" {
		ctx.JSON(consts.StatusForbidden, map[string]interface{}{"success": false, "error": "super admin required"})
		return "", false
	}
	return adminID, true
}

func (h *AdminHandler) requirePermission(c context.Context, ctx *app.RequestContext, permission string) (string, bool) {
	adminID, role, ok := h.currentAdmin(ctx)
	if !ok {
		return "", false
	}
	if role == "super_admin" {
		return adminID, true
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return "", false
	}
	codes, err := h.adminService.GetPermissionCodeSet(c, adminID, role)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return "", false
	}
	if h.adminService.HasAnyPermission(codes, permission) {
		return adminID, true
	}
	ctx.JSON(consts.StatusForbidden, map[string]interface{}{"success": false, "error": "missing permission: " + permission})
	return "", false
}
