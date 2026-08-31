package handler

import (
	"context"
	"strconv"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/internal/service"
)

type createAdminRequest struct {
	Email     string   `json:"email"`
	Username  string   `json:"username"`
	Password  string   `json:"password"`
	Role      string   `json:"role"`
	Status    string   `json:"status"`
	AvatarURL string   `json:"avatar_url"`
	RoleIDs   []string `json:"role_ids"`
}

type updateAdminRequest struct {
	Email     string   `json:"email"`
	Username  string   `json:"username"`
	Password  string   `json:"password"`
	Role      string   `json:"role"`
	Status    string   `json:"status"`
	AvatarURL string   `json:"avatar_url"`
	RoleIDs   []string `json:"role_ids"`
}

type upsertRoleRequest struct {
	Name          string   `json:"name"`
	DisplayName   string   `json:"display_name"`
	Description   string   `json:"description"`
	Status        string   `json:"status"`
	PermissionIDs []string `json:"permission_ids"`
}

// ListAdmins 获取管理员列表。
// GET /api/admin/admins
func (h *AdminHandler) ListAdmins(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}

	page := 1
	pageSize := 20
	if p := ctx.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if ps := ctx.Query("pageSize"); ps != "" {
		if v, err := strconv.Atoi(ps); err == nil && v > 0 {
			pageSize = v
		}
	}

	admins, total, err := h.adminService.ListAdmins(c, page, pageSize)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": map[string]interface{}{"admins": admins, "total": total, "page": page, "pageSize": pageSize}})
}

// CreateAdmin 创建管理员。
// POST /api/admin/admins
func (h *AdminHandler) CreateAdmin(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}

	var req createAdminRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	if req.Email == "" || req.Username == "" || req.Password == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "email, username and password are required"})
		return
	}

	payload, err := h.adminService.CreateAdmin(c, operatorID, service.AdminCreateInput{
		Email:     req.Email,
		Username:  req.Username,
		Password:  req.Password,
		Role:      req.Role,
		Status:    req.Status,
		AvatarURL: req.AvatarURL,
		RoleIDs:   req.RoleIDs,
	}, string(ctx.ClientIP()))
	if err != nil {
		statusCode := consts.StatusInternalServerError
		if err.Error() == "invalid system role" {
			statusCode = consts.StatusBadRequest
		}
		ctx.JSON(statusCode, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": payload})
}

// UpdateAdmin 更新管理员。
// PUT /api/admin/admins/:id
func (h *AdminHandler) UpdateAdmin(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	adminID := ctx.Param("id")
	if adminID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "admin id is required"})
		return
	}

	var req updateAdminRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}

	payload, err := h.adminService.UpdateAdmin(c, operatorID, adminID, service.AdminUpdateInput{
		Email:     req.Email,
		Username:  req.Username,
		Password:  req.Password,
		Role:      req.Role,
		Status:    req.Status,
		AvatarURL: req.AvatarURL,
		RoleIDs:   req.RoleIDs,
	}, string(ctx.ClientIP()))
	if err != nil {
		statusCode := consts.StatusInternalServerError
		switch err.Error() {
		case "invalid system role", "cannot downgrade current super admin":
			statusCode = consts.StatusBadRequest
		case "record not found", "admin not found":
			statusCode = consts.StatusNotFound
		}
		ctx.JSON(statusCode, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": payload})
}

// DeleteAdmin 删除管理员。
// DELETE /api/admin/admins/:id
func (h *AdminHandler) DeleteAdmin(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	adminID := ctx.Param("id")
	if adminID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "admin id is required"})
		return
	}

	if err := h.adminService.DeleteAdmin(c, operatorID, adminID, string(ctx.ClientIP())); err != nil {
		statusCode := consts.StatusInternalServerError
		if err.Error() == "cannot delete current super admin" {
			statusCode = consts.StatusBadRequest
		}
		ctx.JSON(statusCode, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": map[string]string{"id": adminID}})
}

// ListRoles 获取角色列表。
// GET /api/admin/roles
func (h *AdminHandler) ListRoles(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	roles, err := h.adminService.ListRoles(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": roles})
}

// CreateRole 创建角色。
// POST /api/admin/roles
func (h *AdminHandler) CreateRole(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	var req upsertRoleRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	if req.Name == "" || req.DisplayName == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "name and display_name are required"})
		return
	}

	payload, err := h.adminService.CreateRole(c, operatorID, service.RoleUpsertInput{
		Name:          req.Name,
		DisplayName:   req.DisplayName,
		Description:   req.Description,
		Status:        req.Status,
		PermissionIDs: req.PermissionIDs,
	}, string(ctx.ClientIP()))
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": payload})
}

// UpdateRole 更新角色。
// PUT /api/admin/roles/:id
func (h *AdminHandler) UpdateRole(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	roleID := ctx.Param("id")
	if roleID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "role id is required"})
		return
	}
	var req upsertRoleRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}

	payload, err := h.adminService.UpdateRole(c, operatorID, roleID, service.RoleUpsertInput{
		Name:          req.Name,
		DisplayName:   req.DisplayName,
		Description:   req.Description,
		Status:        req.Status,
		PermissionIDs: req.PermissionIDs,
	}, string(ctx.ClientIP()))
	if err != nil {
		statusCode := consts.StatusInternalServerError
		if err.Error() == "record not found" || err.Error() == "role not found" {
			statusCode = consts.StatusNotFound
		}
		ctx.JSON(statusCode, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": payload})
}

// DeleteRole 删除角色。
// DELETE /api/admin/roles/:id
func (h *AdminHandler) DeleteRole(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	roleID := ctx.Param("id")
	if roleID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "role id is required"})
		return
	}

	if err := h.adminService.DeleteRole(c, operatorID, roleID, string(ctx.ClientIP())); err != nil {
		statusCode := consts.StatusInternalServerError
		if err.Error() == "system role cannot be deleted" {
			statusCode = consts.StatusBadRequest
		}
		ctx.JSON(statusCode, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": map[string]string{"id": roleID}})
}

// ListPermissions 获取权限点列表。
// GET /api/admin/permissions
func (h *AdminHandler) ListPermissions(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	permissions, err := h.adminService.ListPermissions(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": permissions})
}

// ReplaceAdminRoles 更新管理员角色绑定。
// PUT /api/admin/admins/:id/roles
func (h *AdminHandler) ReplaceAdminRoles(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	adminID := ctx.Param("id")
	if adminID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "admin id is required"})
		return
	}
	var req struct {
		RoleIDs []string `json:"role_ids"`
	}
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}

	payload, err := h.adminService.ReplaceAdminRoles(c, operatorID, adminID, req.RoleIDs, string(ctx.ClientIP()))
	if err != nil {
		statusCode := consts.StatusInternalServerError
		if err.Error() == "record not found" || err.Error() == "admin not found" {
			statusCode = consts.StatusNotFound
		}
		ctx.JSON(statusCode, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": payload})
}
