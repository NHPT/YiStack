package service

import (
	"context"
	"fmt"

	"yistack/internal/model"
)

// ListUsers 获取用户列表。
func (s *AdminConsoleService) ListUsers(ctx context.Context, offset, limit int) ([]model.User, int64, error) {
	if s == nil || s.userRepo == nil {
		return nil, 0, fmt.Errorf("user service not available")
	}
	return s.userRepo.List(ctx, offset, limit)
}

// UpdateUser 更新用户角色与状态。
func (s *AdminConsoleService) UpdateUser(ctx context.Context, operatorID, userID, role, status, ip string) (*model.User, error) {
	if s == nil || s.userRepo == nil {
		return nil, fmt.Errorf("user service not available")
	}
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if role != "" {
		user.Role = role
	}
	if status != "" {
		user.Status = status
	}
	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, err
	}
	s.writeAudit(ctx, operatorID, "update_user", "user", userID, "Updated user: role="+role+" status="+status, ip)
	return user, nil
}

// DeleteUser 以软删除方式禁用用户。
func (s *AdminConsoleService) DeleteUser(ctx context.Context, operatorID, userID, ip string) (*model.User, error) {
	if s == nil || s.userRepo == nil {
		return nil, fmt.Errorf("user service not available")
	}
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	user.Status = "deleted"
	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, err
	}
	s.writeAudit(ctx, operatorID, "delete_user", "user", userID, "Deleted user: "+user.Email, ip)
	return user, nil
}

// ListAuditLogs 获取审计日志。
func (s *AdminConsoleService) ListAuditLogs(ctx context.Context, offset, limit int) ([]model.AdminAuditLog, error) {
	if s == nil || s.auditRepo == nil {
		return nil, fmt.Errorf("audit service not available")
	}
	return s.auditRepo.List(ctx, offset, limit)
}
