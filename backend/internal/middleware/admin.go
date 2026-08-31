package middleware

import (
	"context"

	"github.com/cloudwego/hertz/pkg/app"
)

// AdminRequired 检查当前请求是否来自管理员
// JWT 中的 role 字段由 admin 登录时设置为 "admin" 或 "super_admin"
// 前置条件：必须先经过 Auth 中间件（JWT 验证）
func AdminRequired() app.HandlerFunc {
	return RequireRole("admin", "super_admin")
}

// SuperAdminRequired 仅允许超级管理员
func SuperAdminRequired() app.HandlerFunc {
	return RequireRole("super_admin")
}

// GetAdminIDFromContext 从上下文中获取管理员ID（UUID string）
func GetAdminIDFromContext(c context.Context, ctx *app.RequestContext) (string, bool) {
	if adminID, exists := ctx.Get("admin_id"); exists {
		if id, ok := adminID.(string); ok {
			return id, true
		}
	}
	// 兼容：也检查 user_id（admin JWT 中 user_id 即 admin_id）
	if userID, exists := ctx.Get("user_id"); exists {
		if id, ok := userID.(string); ok {
			return id, true
		}
	}
	return "", false
}

// GetRoleFromContext 从上下文中获取角色
func GetRoleFromContext(c context.Context, ctx *app.RequestContext) (string, bool) {
	if role, exists := ctx.Get("role"); exists {
		if r, ok := role.(string); ok {
			return r, true
		}
	}
	return "", false
}

// IsAdminRole 检查上下文中的角色是否为管理员
func IsAdminRole(c context.Context, ctx *app.RequestContext) bool {
	role, ok := GetRoleFromContext(c, ctx)
	if !ok {
		return false
	}
	return role == "admin" || role == "super_admin"
}

// respondAdminError 发送管理员权限错误响应
func respondAdminError(ctx *app.RequestContext, status int, message string) {
	ctx.JSON(status, map[string]interface{}{
		"code":    1003,
		"message": message,
		"data":    nil,
	})
}
