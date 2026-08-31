package service

import (
	"context"
	"fmt"

	"yistack/internal/model"
)

// ListVisibleConfigs 根据管理员权限返回可见配置。
func (s *AdminConsoleService) ListVisibleConfigs(ctx context.Context, adminID, role string) ([]model.SystemConfig, error) {
	if s == nil || s.systemConfigService == nil {
		return nil, fmt.Errorf("system config service not available")
	}

	permissionCodes, err := s.GetPermissionCodeSet(ctx, adminID, role)
	if err != nil {
		return nil, err
	}
	canReadAll := role == "super_admin" || s.HasAnyPermission(permissionCodes, PermissionSystemConfigRead)
	canReadContainer := role == "super_admin" || s.HasAnyPermission(permissionCodes, PermissionContainerConfigRead, PermissionSystemConfigRead)
	if !canReadAll && !canReadContainer {
		return nil, fmt.Errorf("missing permission: system.config.read")
	}

	configs, err := s.systemConfigService.ListConfigItems(ctx)
	if err != nil {
		return nil, err
	}
	return FilterVisibleConfigs(configs, canReadAll, canReadContainer), nil
}

// UpdateConfig 更新后台配置并写审计。
func (s *AdminConsoleService) UpdateConfig(ctx context.Context, adminID, role, key, value, ip string) error {
	if s == nil || s.systemConfigService == nil {
		return fmt.Errorf("system config service not available")
	}
	if IsSensitiveSystemConfigKey(key) {
		return fmt.Errorf("敏感配置必须通过受控 Secret Storage 维护，不能写入普通 system_config")
	}

	permissionCodes, err := s.GetPermissionCodeSet(ctx, adminID, role)
	if err != nil {
		return err
	}
	canUpdateAll := role == "super_admin" || s.HasAnyPermission(permissionCodes, PermissionSystemConfigUpdate)
	canUpdateContainer := role == "super_admin" || s.HasAnyPermission(permissionCodes, PermissionContainerConfigUpdate, PermissionSystemConfigUpdate)
	if IsContainerConfigKey(key) {
		if !canUpdateContainer {
			return fmt.Errorf("missing permission: system.container_config.update")
		}
	} else if !canUpdateAll {
		return fmt.Errorf("missing permission: system.config.update")
	}

	if err := s.systemConfigService.UpdateConfig(ctx, key, value); err != nil {
		return err
	}
	s.writeAudit(ctx, adminID, "update_config", "config", key, "Updated config: "+key, ip)
	return nil
}
