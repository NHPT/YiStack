package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"yistack/internal/model"
	"yistack/pkg/database"
)

// AdminRepository 管理员仓储
type AdminRepository struct {
	db *gorm.DB
}

// NewAdminRepository 创建管理员仓储
func NewAdminRepository(db database.Database) *AdminRepository {
	return &AdminRepository{db: db.GetDB()}
}

func (r *AdminRepository) FindByEmail(ctx context.Context, email string) (*model.Admin, error) {
	var admin model.Admin
	err := r.db.Where("email = ?", email).First(&admin).Error
	if err != nil {
		return nil, err
	}
	return &admin, nil
}

func (r *AdminRepository) FindByID(ctx context.Context, id string) (*model.Admin, error) {
	var admin model.Admin
	err := r.db.Where("id = ?", id).First(&admin).Error
	if err != nil {
		return nil, err
	}
	return &admin, nil
}

func (r *AdminRepository) Create(ctx context.Context, admin *model.Admin) error {
	return r.db.Create(admin).Error
}

func (r *AdminRepository) Update(ctx context.Context, admin *model.Admin) error {
	return r.db.Save(admin).Error
}

func (r *AdminRepository) UpdateLastLogin(ctx context.Context, id string) error {
	return r.db.Model(&model.Admin{}).Where("id = ?", id).Update("last_login_at", time.Now()).Error
}

func (r *AdminRepository) List(ctx context.Context, page, pageSize int) ([]model.Admin, int64, error) {
	var admins []model.Admin
	var total int64
	r.db.Model(&model.Admin{}).Count(&total)
	offset := (page - 1) * pageSize
	err := r.db.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&admins).Error
	return admins, total, err
}

func (r *AdminRepository) Delete(ctx context.Context, id string) error {
	return r.db.Where("id = ?", id).Delete(&model.Admin{}).Error
}

func (r *AdminRepository) ListRoles(ctx context.Context) ([]model.AdminRole, error) {
	var roles []model.AdminRole
	err := r.db.WithContext(ctx).Order("is_system DESC, created_at DESC").Find(&roles).Error
	return roles, err
}

func (r *AdminRepository) FindRoleByID(ctx context.Context, id string) (*model.AdminRole, error) {
	var role model.AdminRole
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&role).Error; err != nil {
		return nil, err
	}
	return &role, nil
}

func (r *AdminRepository) CreateRole(ctx context.Context, role *model.AdminRole) error {
	return r.db.WithContext(ctx).Create(role).Error
}

func (r *AdminRepository) UpdateRole(ctx context.Context, role *model.AdminRole) error {
	return r.db.WithContext(ctx).Save(role).Error
}

func (r *AdminRepository) DeleteRole(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.AdminRole{}).Error
}

func (r *AdminRepository) ListPermissions(ctx context.Context) ([]model.AdminPermission, error) {
	var permissions []model.AdminPermission
	err := r.db.WithContext(ctx).Order("code ASC").Find(&permissions).Error
	return permissions, err
}

func (r *AdminRepository) GetRolePermissions(ctx context.Context, roleID string) ([]model.AdminPermission, error) {
	var permissions []model.AdminPermission
	err := r.db.WithContext(ctx).
		Table("admin_permissions").
		Select("admin_permissions.*").
		Joins("JOIN admin_role_permissions ON admin_role_permissions.permission_id = admin_permissions.id").
		Where("admin_role_permissions.role_id = ?", roleID).
		Order("admin_permissions.code ASC").
		Scan(&permissions).Error
	return permissions, err
}

func (r *AdminRepository) ReplaceRolePermissions(ctx context.Context, roleID string, permissionIDs []string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("role_id = ?", roleID).Delete(&model.AdminRolePermission{}).Error; err != nil {
			return err
		}
		if len(permissionIDs) == 0 {
			return nil
		}
		records := make([]model.AdminRolePermission, 0, len(permissionIDs))
		for _, permissionID := range permissionIDs {
			records = append(records, model.AdminRolePermission{
				RoleID:       roleID,
				PermissionID: permissionID,
			})
		}
		return tx.Create(&records).Error
	})
}

func (r *AdminRepository) GetAdminRoles(ctx context.Context, adminID string) ([]model.AdminRole, error) {
	var roles []model.AdminRole
	err := r.db.WithContext(ctx).
		Table("admin_roles").
		Select("admin_roles.*").
		Joins("JOIN admin_user_roles ON admin_user_roles.role_id = admin_roles.id").
		Where("admin_user_roles.admin_id = ?", adminID).
		Order("admin_roles.is_system DESC, admin_roles.created_at DESC").
		Scan(&roles).Error
	return roles, err
}

func (r *AdminRepository) ReplaceAdminRoles(ctx context.Context, adminID string, roleIDs []string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("admin_id = ?", adminID).Delete(&model.AdminUserRole{}).Error; err != nil {
			return err
		}
		if len(roleIDs) == 0 {
			return nil
		}
		records := make([]model.AdminUserRole, 0, len(roleIDs))
		for _, roleID := range roleIDs {
			records = append(records, model.AdminUserRole{
				AdminID: adminID,
				RoleID:  roleID,
			})
		}
		return tx.Create(&records).Error
	})
}

func (r *AdminRepository) GetAdminPermissionCodes(ctx context.Context, adminID string) ([]string, error) {
	var rows []struct {
		Code string `json:"code"`
	}
	err := r.db.WithContext(ctx).
		Table("admin_permissions").
		Select("DISTINCT admin_permissions.code").
		Joins("JOIN admin_role_permissions ON admin_role_permissions.permission_id = admin_permissions.id").
		Joins("JOIN admin_user_roles ON admin_user_roles.role_id = admin_role_permissions.role_id").
		Where("admin_user_roles.admin_id = ?", adminID).
		Order("admin_permissions.code ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]string, 0, len(rows))
	for _, row := range rows {
		result = append(result, row.Code)
	}
	return result, nil
}

func (r *AdminRepository) CountEnterpriseOrganizations(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.EnterpriseOrganization{}).Count(&count).Error
	return count, err
}

func (r *AdminRepository) CountEnterpriseTeams(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.EnterpriseTeam{}).Count(&count).Error
	return count, err
}

func (r *AdminRepository) CountEnterpriseMembers(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.EnterpriseMember{}).Count(&count).Error
	return count, err
}

func (r *AdminRepository) CountEnterpriseProjectOwnerships(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.EnterpriseProjectOwnership{}).Count(&count).Error
	return count, err
}

func (r *AdminRepository) CountEnterpriseProjectAccessGuardActivationAudits(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.EnterpriseProjectAccessGuardActivationAudit{}).Count(&count).Error
	return count, err
}

func (r *AdminRepository) CountEnterpriseAuditExportTasks(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.EnterpriseAuditExportTask{}).Count(&count).Error
	return count, err
}

func (r *AdminRepository) FindEnterpriseAuditExportTaskByID(ctx context.Context, taskID string) (*model.EnterpriseAuditExportTask, error) {
	var task model.EnterpriseAuditExportTask
	if err := r.db.WithContext(ctx).Where("id = ?", taskID).First(&task).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &task, nil
}

func (r *AdminRepository) FindEnterpriseAuditExportTaskByIdempotencyKey(ctx context.Context, idempotencyKey string) (*model.EnterpriseAuditExportTask, error) {
	var task model.EnterpriseAuditExportTask
	if err := r.db.WithContext(ctx).Where("idempotency_key = ?", idempotencyKey).First(&task).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &task, nil
}

func (r *AdminRepository) ListEnterpriseAuditExportTasks(ctx context.Context, limit int) ([]model.EnterpriseAuditExportTask, error) {
	if limit <= 0 {
		limit = 50
	}
	var tasks []model.EnterpriseAuditExportTask
	err := r.db.WithContext(ctx).Order("created_at DESC").Limit(limit).Find(&tasks).Error
	return tasks, err
}

func (r *AdminRepository) CountEnterpriseAuditExportDeliveryReports(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.EnterpriseAuditExportDeliveryReport{}).Count(&count).Error
	return count, err
}

func (r *AdminRepository) ListEnterpriseAuditExportDeliveryReports(ctx context.Context, limit int) ([]model.EnterpriseAuditExportDeliveryReport, error) {
	if limit <= 0 {
		limit = 25
	}
	var reports []model.EnterpriseAuditExportDeliveryReport
	err := r.db.WithContext(ctx).Order("created_at DESC").Limit(limit).Find(&reports).Error
	return reports, err
}

func (r *AdminRepository) CountEnterpriseAuditExportWorkerExecutionRequests(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.EnterpriseAuditExportWorkerExecutionRequest{}).Count(&count).Error
	return count, err
}

func (r *AdminRepository) CountEnterpriseAuditExportWorkerExecutionRequestsByStatus(ctx context.Context, status string) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.EnterpriseAuditExportWorkerExecutionRequest{}).Where("status = ?", status).Count(&count).Error
	return count, err
}

func (r *AdminRepository) FindEnterpriseAuditExportWorkerExecutionRequestByID(ctx context.Context, requestID string) (*model.EnterpriseAuditExportWorkerExecutionRequest, error) {
	var request model.EnterpriseAuditExportWorkerExecutionRequest
	if err := r.db.WithContext(ctx).Where("id = ?", requestID).First(&request).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &request, nil
}

func (r *AdminRepository) FindEnterpriseAuditExportWorkerExecutionRequestByIdempotencyKey(ctx context.Context, idempotencyKey string) (*model.EnterpriseAuditExportWorkerExecutionRequest, error) {
	var request model.EnterpriseAuditExportWorkerExecutionRequest
	if err := r.db.WithContext(ctx).Where("idempotency_key = ?", idempotencyKey).First(&request).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &request, nil
}

func (r *AdminRepository) CreateEnterpriseAuditExportWorkerExecutionRequest(ctx context.Context, request *model.EnterpriseAuditExportWorkerExecutionRequest) error {
	return r.db.WithContext(ctx).Create(request).Error
}

func (r *AdminRepository) UpdateEnterpriseAuditExportWorkerExecutionRequestExecutionResult(ctx context.Context, request *model.EnterpriseAuditExportWorkerExecutionRequest) error {
	if err := r.db.WithContext(ctx).Model(&model.EnterpriseAuditExportWorkerExecutionRequest{}).
		Where("id = ?", request.ID).
		Updates(map[string]any{
			"status":           request.Status,
			"execution_result": request.ExecutionResult,
			"output_path":      request.OutputPath,
			"checksum_sha256":  request.ChecksumSHA256,
			"row_count":        request.RowCount,
			"error_message":    request.ErrorMessage,
			"source":           request.Source,
			"updated_at":       time.Now(),
		}).Error; err != nil {
		return err
	}
	updatedRequest, err := r.FindEnterpriseAuditExportWorkerExecutionRequestByID(ctx, request.ID)
	if err != nil {
		return err
	}
	if updatedRequest != nil {
		*request = *updatedRequest
	}
	return nil
}

func (r *AdminRepository) FindEnterpriseAuditExportDeliveryReportByIdempotencyKey(ctx context.Context, idempotencyKey string) (*model.EnterpriseAuditExportDeliveryReport, error) {
	var report model.EnterpriseAuditExportDeliveryReport
	if err := r.db.WithContext(ctx).Where("idempotency_key = ?", idempotencyKey).First(&report).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &report, nil
}

func (r *AdminRepository) ListEnterpriseProjectAccessGuardActivationAudits(ctx context.Context, limit int) ([]model.EnterpriseProjectAccessGuardActivationAudit, error) {
	if limit <= 0 {
		limit = 50
	}
	var audits []model.EnterpriseProjectAccessGuardActivationAudit
	err := r.db.WithContext(ctx).Order("created_at DESC").Limit(limit).Find(&audits).Error
	return audits, err
}

func (r *AdminRepository) CreateEnterpriseProjectAccessGuardActivationAudit(ctx context.Context, audit *model.EnterpriseProjectAccessGuardActivationAudit) error {
	return r.db.WithContext(ctx).Create(audit).Error
}

func (r *AdminRepository) ListEnterpriseOrganizations(ctx context.Context) ([]model.EnterpriseOrganization, error) {
	var organizations []model.EnterpriseOrganization
	err := r.db.WithContext(ctx).Order("created_at DESC").Find(&organizations).Error
	return organizations, err
}

func (r *AdminRepository) FindEnterpriseOrganizationByID(ctx context.Context, id string) (*model.EnterpriseOrganization, error) {
	var organization model.EnterpriseOrganization
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&organization).Error; err != nil {
		return nil, err
	}
	return &organization, nil
}

func (r *AdminRepository) ListEnterpriseTeams(ctx context.Context) ([]model.EnterpriseTeam, error) {
	var teams []model.EnterpriseTeam
	err := r.db.WithContext(ctx).Order("created_at DESC").Find(&teams).Error
	return teams, err
}

func (r *AdminRepository) FindEnterpriseTeamByID(ctx context.Context, id string) (*model.EnterpriseTeam, error) {
	var team model.EnterpriseTeam
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&team).Error; err != nil {
		return nil, err
	}
	return &team, nil
}

func (r *AdminRepository) FindEnterpriseMembersByUserAndOrganizationID(ctx context.Context, userID, organizationID string) ([]model.EnterpriseMember, error) {
	var members []model.EnterpriseMember
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND organization_id = ?", userID, organizationID).
		Order("created_at DESC").
		Find(&members).Error
	return members, err
}

func (r *AdminRepository) ListEnterpriseProjectOwnerships(ctx context.Context) ([]model.EnterpriseProjectOwnership, error) {
	var ownerships []model.EnterpriseProjectOwnership
	err := r.db.WithContext(ctx).Order("created_at DESC").Find(&ownerships).Error
	return ownerships, err
}

func (r *AdminRepository) FindEnterpriseProjectOwnershipByProjectID(ctx context.Context, projectID string) (*model.EnterpriseProjectOwnership, error) {
	var ownership model.EnterpriseProjectOwnership
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).First(&ownership).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &ownership, nil
}

func (r *AdminRepository) CreateEnterpriseOrganization(ctx context.Context, organization *model.EnterpriseOrganization) error {
	return r.db.WithContext(ctx).Create(organization).Error
}

func (r *AdminRepository) CreateEnterpriseTeam(ctx context.Context, team *model.EnterpriseTeam) error {
	return r.db.WithContext(ctx).Create(team).Error
}

func (r *AdminRepository) CreateEnterpriseMember(ctx context.Context, member *model.EnterpriseMember) error {
	return r.db.WithContext(ctx).Create(member).Error
}

func (r *AdminRepository) CreateEnterpriseProjectOwnership(ctx context.Context, ownership *model.EnterpriseProjectOwnership) error {
	return r.db.WithContext(ctx).Create(ownership).Error
}

func (r *AdminRepository) CreateEnterpriseAuditExportTask(ctx context.Context, task *model.EnterpriseAuditExportTask) error {
	return r.db.WithContext(ctx).Create(task).Error
}

func (r *AdminRepository) UpdateEnterpriseAuditExportTaskStatus(ctx context.Context, task *model.EnterpriseAuditExportTask) error {
	if err := r.db.WithContext(ctx).Model(&model.EnterpriseAuditExportTask{}).
		Where("id = ?", task.ID).
		Updates(map[string]any{
			"status":     task.Status,
			"source":     task.Source,
			"updated_at": time.Now(),
		}).Error; err != nil {
		return err
	}
	updatedTask, err := r.FindEnterpriseAuditExportTaskByID(ctx, task.ID)
	if err != nil {
		return err
	}
	if updatedTask != nil {
		*task = *updatedTask
	}
	return nil
}

func (r *AdminRepository) CreateEnterpriseAuditExportDeliveryReport(ctx context.Context, report *model.EnterpriseAuditExportDeliveryReport) error {
	return r.db.WithContext(ctx).Create(report).Error
}
