package service

import (
	"context"
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"yistack/internal/model"
	"yistack/pkg/utils"
)

// ListAdmins 获取管理员列表和总数。
func (s *AdminConsoleService) ListAdmins(ctx context.Context, page, pageSize int) ([]map[string]interface{}, int64, error) {
	if s == nil || s.adminRepo == nil {
		return nil, 0, fmt.Errorf("admin repository not available")
	}
	admins, total, err := s.adminRepo.List(ctx, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	items := make([]map[string]interface{}, 0, len(admins))
	for _, admin := range admins {
		payload, err := s.buildAdminPayload(ctx, admin)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, payload)
	}
	return items, total, nil
}

// CreateAdmin 创建管理员并绑定角色。
func (s *AdminConsoleService) CreateAdmin(ctx context.Context, operatorID string, input AdminCreateInput, ip string) (map[string]interface{}, error) {
	if s == nil || s.adminRepo == nil {
		return nil, fmt.Errorf("admin repository not available")
	}
	role := input.Role
	if role == "" {
		role = "admin"
	}
	if role != "admin" && role != "super_admin" {
		return nil, fmt.Errorf("invalid system role")
	}
	status := input.Status
	if status == "" {
		status = "active"
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password")
	}
	admin := &model.Admin{
		ID:                 utils.GenerateUUID(),
		Email:              strings.TrimSpace(input.Email),
		Username:           strings.TrimSpace(input.Username),
		PasswordHash:       string(hashedPassword),
		Role:               role,
		Status:             status,
		MustChangePassword: true,
		AuthVersion:        1,
		AvatarURL:          input.AvatarURL,
	}
	if err := s.adminRepo.Create(ctx, admin); err != nil {
		return nil, err
	}
	if err := s.adminRepo.ReplaceAdminRoles(ctx, admin.ID, input.RoleIDs); err != nil {
		return nil, err
	}
	s.writeAudit(ctx, operatorID, "create_admin", "admin", admin.ID, "Created admin: "+admin.Email, ip)
	return s.buildAdminPayload(ctx, *admin)
}

// UpdateAdmin 更新管理员资料和角色。
func (s *AdminConsoleService) UpdateAdmin(ctx context.Context, operatorID, adminID string, input AdminUpdateInput, ip string) (map[string]interface{}, error) {
	if s == nil || s.adminRepo == nil {
		return nil, fmt.Errorf("admin repository not available")
	}
	admin, err := s.adminRepo.FindByID(ctx, adminID)
	if err != nil {
		return nil, err
	}
	if input.Email != "" {
		admin.Email = strings.TrimSpace(input.Email)
	}
	if input.Username != "" {
		admin.Username = strings.TrimSpace(input.Username)
	}
	if input.Role != "" {
		if input.Role != "admin" && input.Role != "super_admin" {
			return nil, fmt.Errorf("invalid system role")
		}
		if operatorID == adminID && input.Role != "super_admin" {
			return nil, fmt.Errorf("cannot downgrade current super admin")
		}
		admin.Role = input.Role
	}
	if input.Status != "" {
		admin.Status = input.Status
	}
	if input.AvatarURL != "" {
		admin.AvatarURL = input.AvatarURL
	}
	if input.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("failed to hash password")
		}
		admin.PasswordHash = string(hashedPassword)
		admin.MustChangePassword = true
		admin.AuthVersion++
		if admin.AuthVersion < 1 {
			admin.AuthVersion = 1
		}
	}
	if err := s.adminRepo.Update(ctx, admin); err != nil {
		return nil, err
	}
	if input.RoleIDs != nil {
		if err := s.adminRepo.ReplaceAdminRoles(ctx, admin.ID, input.RoleIDs); err != nil {
			return nil, err
		}
	}
	s.writeAudit(ctx, operatorID, "update_admin", "admin", admin.ID, "Updated admin: "+admin.Email, ip)
	return s.buildAdminPayload(ctx, *admin)
}

// DeleteAdmin 删除管理员。
func (s *AdminConsoleService) DeleteAdmin(ctx context.Context, operatorID, adminID, ip string) error {
	if s == nil || s.adminRepo == nil {
		return fmt.Errorf("admin repository not available")
	}
	if operatorID == adminID {
		return fmt.Errorf("cannot delete current super admin")
	}
	if err := s.adminRepo.Delete(ctx, adminID); err != nil {
		return err
	}
	s.writeAudit(ctx, operatorID, "delete_admin", "admin", adminID, "Deleted admin", ip)
	return nil
}

// ListRoles 获取角色列表。
func (s *AdminConsoleService) ListRoles(ctx context.Context) ([]map[string]interface{}, error) {
	if s == nil || s.adminRepo == nil {
		return nil, fmt.Errorf("admin repository not available")
	}
	roles, err := s.adminRepo.ListRoles(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]map[string]interface{}, 0, len(roles))
	for _, role := range roles {
		payload, err := s.buildRolePayload(ctx, role)
		if err != nil {
			return nil, err
		}
		items = append(items, payload)
	}
	return items, nil
}

// CreateRole 创建角色。
func (s *AdminConsoleService) CreateRole(ctx context.Context, operatorID string, input RoleUpsertInput, ip string) (map[string]interface{}, error) {
	if s == nil || s.adminRepo == nil {
		return nil, fmt.Errorf("admin repository not available")
	}
	status := input.Status
	if status == "" {
		status = "active"
	}
	role := &model.AdminRole{
		ID:          utils.GenerateUUID(),
		Name:        strings.TrimSpace(input.Name),
		DisplayName: strings.TrimSpace(input.DisplayName),
		Description: strings.TrimSpace(input.Description),
		Status:      status,
		IsSystem:    false,
	}
	if err := s.adminRepo.CreateRole(ctx, role); err != nil {
		return nil, err
	}
	if err := s.adminRepo.ReplaceRolePermissions(ctx, role.ID, input.PermissionIDs); err != nil {
		return nil, err
	}
	s.writeAudit(ctx, operatorID, "create_admin_role", "admin_role", role.ID, "Created admin role: "+role.Name, ip)
	return s.buildRolePayload(ctx, *role)
}

// UpdateRole 更新角色。
func (s *AdminConsoleService) UpdateRole(ctx context.Context, operatorID, roleID string, input RoleUpsertInput, ip string) (map[string]interface{}, error) {
	if s == nil || s.adminRepo == nil {
		return nil, fmt.Errorf("admin repository not available")
	}
	role, err := s.adminRepo.FindRoleByID(ctx, roleID)
	if err != nil {
		return nil, err
	}
	if input.Name != "" {
		role.Name = strings.TrimSpace(input.Name)
	}
	if input.DisplayName != "" {
		role.DisplayName = strings.TrimSpace(input.DisplayName)
	}
	if input.Description != "" {
		role.Description = strings.TrimSpace(input.Description)
	}
	if input.Status != "" {
		role.Status = input.Status
	}
	if err := s.adminRepo.UpdateRole(ctx, role); err != nil {
		return nil, err
	}
	if input.PermissionIDs != nil {
		if err := s.adminRepo.ReplaceRolePermissions(ctx, role.ID, input.PermissionIDs); err != nil {
			return nil, err
		}
	}
	s.writeAudit(ctx, operatorID, "update_admin_role", "admin_role", role.ID, "Updated admin role: "+role.Name, ip)
	return s.buildRolePayload(ctx, *role)
}

// DeleteRole 删除自定义角色。
func (s *AdminConsoleService) DeleteRole(ctx context.Context, operatorID, roleID, ip string) error {
	if s == nil || s.adminRepo == nil {
		return fmt.Errorf("admin repository not available")
	}
	role, err := s.adminRepo.FindRoleByID(ctx, roleID)
	if err != nil {
		return err
	}
	if role.IsSystem {
		return fmt.Errorf("system role cannot be deleted")
	}
	if err := s.adminRepo.DeleteRole(ctx, roleID); err != nil {
		return err
	}
	s.writeAudit(ctx, operatorID, "delete_admin_role", "admin_role", roleID, "Deleted admin role: "+role.Name, ip)
	return nil
}

// ListPermissions 获取权限点列表。
func (s *AdminConsoleService) ListPermissions(ctx context.Context) ([]model.AdminPermission, error) {
	if s == nil || s.adminRepo == nil {
		return nil, fmt.Errorf("admin repository not available")
	}
	return s.adminRepo.ListPermissions(ctx)
}

// ReplaceAdminRoles 更新管理员角色绑定。
func (s *AdminConsoleService) ReplaceAdminRoles(ctx context.Context, operatorID, adminID string, roleIDs []string, ip string) (map[string]interface{}, error) {
	if s == nil || s.adminRepo == nil {
		return nil, fmt.Errorf("admin repository not available")
	}
	if _, err := s.adminRepo.FindByID(ctx, adminID); err != nil {
		return nil, err
	}
	if err := s.adminRepo.ReplaceAdminRoles(ctx, adminID, roleIDs); err != nil {
		return nil, err
	}
	s.writeAudit(ctx, operatorID, "replace_admin_roles", "admin", adminID, "Updated admin role assignments", ip)
	admin, err := s.adminRepo.FindByID(ctx, adminID)
	if err != nil {
		return nil, err
	}
	return s.buildAdminPayload(ctx, *admin)
}
