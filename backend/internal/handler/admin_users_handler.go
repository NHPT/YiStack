package handler

import (
	"context"
	"strconv"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"
)

// ListUsers 获取用户列表。
// GET /api/admin/users
func (h *AdminHandler) ListUsers(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requirePermission(c, ctx, "user.read"); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}

	limit := 50
	offset := 0
	if l := ctx.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}
	if o := ctx.Query("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}

	users, total, err := h.adminService.ListUsers(c, offset, limit)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": map[string]interface{}{"users": users, "total": total}})
}

// UpdateUser 更新用户。
// PUT /api/admin/users/:id
func (h *AdminHandler) UpdateUser(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requirePermission(c, ctx, "user.update")
	if !ok {
		return
	}
	userID := ctx.Param("id")
	if userID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "user id is required"})
		return
	}

	var req struct {
		Role   string `json:"role"`
		Status string `json:"status"`
	}
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}

	user, err := h.adminService.UpdateUser(c, operatorID, userID, req.Role, req.Status, string(ctx.ClientIP()))
	if err != nil {
		statusCode := consts.StatusInternalServerError
		if err.Error() == "record not found" || err.Error() == "user not found" {
			statusCode = consts.StatusNotFound
		}
		ctx.JSON(statusCode, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": user})
}

// DeleteUser 删除用户。
// DELETE /api/admin/users/:id
func (h *AdminHandler) DeleteUser(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requirePermission(c, ctx, "user.delete")
	if !ok {
		return
	}
	userID := ctx.Param("id")
	if userID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "user id is required"})
		return
	}

	if _, err := h.adminService.DeleteUser(c, operatorID, userID, string(ctx.ClientIP())); err != nil {
		statusCode := consts.StatusInternalServerError
		if err.Error() == "record not found" || err.Error() == "user not found" {
			statusCode = consts.StatusNotFound
		}
		ctx.JSON(statusCode, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": map[string]string{"id": userID}})
}

// ListAuditLogs 获取审计日志。
// GET /api/admin/audit
func (h *AdminHandler) ListAuditLogs(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requirePermission(c, ctx, "audit.read"); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}

	limit := 50
	offset := 0
	if l := ctx.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}
	if o := ctx.Query("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}

	logs, err := h.adminService.ListAuditLogs(c, offset, limit)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": map[string]interface{}{"logs": logs, "total": len(logs)}})
}
