package service

import (
	"context"

	"yistack/internal/model"
)

func (s *AdminConsoleService) writeAudit(ctx context.Context, adminID, action, targetType, targetID, detail, ip string) {
	if s == nil || s.auditRepo == nil || adminID == "" {
		return
	}
	_ = s.auditRepo.Create(ctx, &model.AdminAuditLog{
		AdminID:    adminID,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Detail:     detail,
		IPAddress:  ip,
	})
}

func (s *AdminConsoleService) buildAdminPayload(ctx context.Context, admin model.Admin) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"id":                   admin.ID,
		"email":                admin.Email,
		"username":             admin.Username,
		"role":                 admin.Role,
		"status":               admin.Status,
		"must_change_password": admin.MustChangePassword,
		"avatar_url":           admin.AvatarURL,
		"last_login_at":        admin.LastLoginAt,
		"created_at":           admin.CreatedAt,
		"updated_at":           admin.UpdatedAt,
	}
	if s.adminRepo == nil {
		return payload, nil
	}
	if roles, err := s.adminRepo.GetAdminRoles(ctx, admin.ID); err == nil {
		payload["assigned_roles"] = roles
	}
	if permissions, err := s.adminRepo.GetAdminPermissionCodes(ctx, admin.ID); err == nil {
		payload["permission_codes"] = permissions
	}
	return payload, nil
}

func (s *AdminConsoleService) buildRolePayload(ctx context.Context, role model.AdminRole) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"id":           role.ID,
		"name":         role.Name,
		"display_name": role.DisplayName,
		"description":  role.Description,
		"is_system":    role.IsSystem,
		"status":       role.Status,
		"created_at":   role.CreatedAt,
		"updated_at":   role.UpdatedAt,
	}
	if s.adminRepo == nil {
		return payload, nil
	}
	if permissions, err := s.adminRepo.GetRolePermissions(ctx, role.ID); err == nil {
		payload["permissions"] = permissions
	}
	return payload, nil
}
