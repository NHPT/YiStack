package service

import (
	"context"
)

// AdminCreateInput 创建管理员的输入参数。
type AdminCreateInput struct {
	Email     string
	Username  string
	Password  string
	Role      string
	Status    string
	AvatarURL string
	RoleIDs   []string
}

// AdminUpdateInput 更新管理员的输入参数。
type AdminUpdateInput struct {
	Email     string
	Username  string
	Password  string
	Role      string
	Status    string
	AvatarURL string
	RoleIDs   []string
}

// RoleUpsertInput 创建或更新角色的输入参数。
type RoleUpsertInput struct {
	Name          string
	DisplayName   string
	Description   string
	Status        string
	PermissionIDs []string
}

// AdminConsoleService 承载后台控制台应用逻辑。
// handler 只负责权限前置校验与 HTTP 协议转换，具体数据修改、审计与聚合由该服务统一处理。
type AdminConsoleService struct {
	systemConfigService *SystemConfigService
	userRepo            UserRepo
	auditRepo           AdminAuditLogRepo
	adminRepo           AdminRepo
	projectRepo         ProjectRepo
}

// NewAdminConsoleService 创建后台控制台服务。
func NewAdminConsoleService(systemConfigService *SystemConfigService, userRepo UserRepo, auditRepo AdminAuditLogRepo, adminRepo AdminRepo, projectRepo ProjectRepo) *AdminConsoleService {
	return &AdminConsoleService{
		systemConfigService: systemConfigService,
		userRepo:            userRepo,
		auditRepo:           auditRepo,
		adminRepo:           adminRepo,
		projectRepo:         projectRepo,
	}
}

// GetPermissionCodeSet 获取管理员权限集合。
func (s *AdminConsoleService) GetPermissionCodeSet(ctx context.Context, adminID, role string) (map[string]struct{}, error) {
	if role == "super_admin" {
		return map[string]struct{}{}, nil
	}
	if s == nil || s.adminRepo == nil {
		return nil, nil
	}
	codes, err := s.adminRepo.GetAdminPermissionCodes(ctx, adminID)
	if err != nil {
		return nil, err
	}
	result := make(map[string]struct{}, len(codes))
	for _, code := range codes {
		result[code] = struct{}{}
	}
	return result, nil
}

// HasAnyPermission 判断权限集合中是否包含任意一个目标权限。
func (s *AdminConsoleService) HasAnyPermission(codes map[string]struct{}, permissions ...string) bool {
	for _, permission := range permissions {
		if _, ok := codes[permission]; ok {
			return true
		}
	}
	return false
}
