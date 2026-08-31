package handler

import (
	"context"
	"errors"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/internal/service"
)

type createEnterpriseOrganizationRequest struct {
	Slug        string `json:"slug"`
	DisplayName string `json:"display_name"`
	Status      string `json:"status"`
}

type createEnterpriseTeamRequest struct {
	OrganizationID string `json:"organization_id"`
	Slug           string `json:"slug"`
	DisplayName    string `json:"display_name"`
	Status         string `json:"status"`
}

type bindEnterpriseMemberRequest struct {
	OrganizationID string `json:"organization_id"`
	TeamID         string `json:"team_id"`
	UserID         string `json:"user_id"`
	Status         string `json:"status"`
}

type migrateEnterpriseProjectOwnershipRequest struct {
	ProjectRecordID string `json:"project_record_id"`
	OrganizationID  string `json:"organization_id"`
	TeamID          string `json:"team_id"`
	ConfirmMigrate  bool   `json:"confirm_migrate"`
}

type recordEnterpriseProjectAccessGuardActivationManualApprovalRequest struct {
	ConfirmManualApproval bool   `json:"confirm_manual_approval"`
	ApprovalNote          string `json:"approval_note"`
}

type recordEnterpriseProjectAccessGuardActivationExecutionRequest struct {
	ConfirmActivationExecution bool   `json:"confirm_activation_execution"`
	ExecutionNote              string `json:"execution_note"`
}

type recordEnterpriseProjectAccessGuardPostActivationValidationRequest struct {
	ConfirmPostActivationValidation bool   `json:"confirm_post_activation_validation"`
	ValidationNote                  string `json:"validation_note"`
}

type recordEnterpriseProjectAccessGuardRollbackEvidenceRequest struct {
	ConfirmRollbackEvidence bool   `json:"confirm_rollback_evidence"`
	RollbackNote            string `json:"rollback_note"`
	RollbackReference       string `json:"rollback_reference"`
}

type activateEnterpriseProjectAccessGuardAuthorizationRequest struct {
	ConfirmEnterpriseAuthorizationActivation bool   `json:"confirm_enterprise_authorization_activation"`
	ActivationNote                           string `json:"activation_note"`
}

type createEnterpriseAuditExportTaskRequest struct {
	Format            string                 `json:"format"`
	Reason            string                 `json:"reason"`
	Filters           map[string]interface{} `json:"filters"`
	TimeRangeStart    string                 `json:"time_range_start"`
	TimeRangeEnd      string                 `json:"time_range_end"`
	IdempotencyKey    string                 `json:"idempotency_key"`
	ConfirmCreateTask bool                   `json:"confirm_create_task"`
}

type transitionEnterpriseAuditExportTaskStatusRequest struct {
	TaskID                  string `json:"task_id"`
	TargetStatus            string `json:"target_status"`
	Reason                  string `json:"reason"`
	ConfirmStatusTransition bool   `json:"confirm_status_transition"`
}

type persistEnterpriseAuditExportWorkerExecutionRequestRequest struct {
	TaskID                 string `json:"task_id"`
	Reason                 string `json:"reason"`
	IdempotencyKey         string `json:"idempotency_key"`
	BatchLimit             int    `json:"batch_limit"`
	ConfirmWorkerExecution bool   `json:"confirm_worker_execution"`
}

type dryRunEnterpriseAuditExportWorkerExecutionRequestRequest struct {
	RequestID                    string `json:"request_id"`
	Reason                       string `json:"reason"`
	ConfirmWorkerExecutionDryRun bool   `json:"confirm_worker_execution_dry_run"`
}

type generateEnterpriseAuditExportWorkerExecutionArtifactRequest struct {
	RequestID                      string `json:"request_id"`
	Reason                         string `json:"reason"`
	ConfirmWorkerExecutionArtifact bool   `json:"confirm_worker_execution_artifact"`
}

type storeEnterpriseAuditExportWorkerExecutionOutputStorageRequest struct {
	RequestID                           string `json:"request_id"`
	Reason                              string `json:"reason"`
	ConfirmWorkerExecutionOutputStorage bool   `json:"confirm_worker_execution_output_storage"`
}

type completeEnterpriseAuditExportWorkerExecutionTaskRequest struct {
	RequestID                            string `json:"request_id"`
	Reason                               string `json:"reason"`
	ConfirmWorkerExecutionTaskCompletion bool   `json:"confirm_worker_execution_task_completion"`
}

type generateEnterpriseAuditExportDeliveryReportRequest struct {
	Reason                string `json:"reason"`
	IdempotencyKey        string `json:"idempotency_key"`
	ConfirmGenerateReport bool   `json:"confirm_generate_report"`
}

type storeEnterpriseAuditExportDeliveryReportRequest struct {
	Reason             string `json:"reason"`
	IdempotencyKey     string `json:"idempotency_key"`
	ReportFormat       string `json:"report_format"`
	ReportContent      string `json:"report_content"`
	GeneratedAt        string `json:"generated_at"`
	ConfirmStoreReport bool   `json:"confirm_store_report"`
}

// GetEnterpriseSsoDiscoveryReadiness 获取企业 SSO OIDC discovery 只读预检。
// GET /api/admin/enterprise/sso-discovery-readiness
func (h *AdminHandler) GetEnterpriseSsoDiscoveryReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseSsoDiscoveryReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterprisePrivateDeploymentReadiness 获取私有部署只读 readiness。
// GET /api/admin/enterprise/private-deployment-readiness
func (h *AdminHandler) GetEnterprisePrivateDeploymentReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterprisePrivateDeploymentReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseCommercialReadiness 获取商业化发布前只读 readiness。
// GET /api/admin/enterprise/commercial-readiness
func (h *AdminHandler) GetEnterpriseCommercialReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseCommercialReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseOrganizationReadiness 获取企业组织治理只读 readiness。
// GET /api/admin/enterprise/organization-readiness
func (h *AdminHandler) GetEnterpriseOrganizationReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseOrganizationReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseProjectOwnershipReadiness 获取企业项目归属迁移只读 readiness。
// GET /api/admin/enterprise/project-ownership-readiness
func (h *AdminHandler) GetEnterpriseProjectOwnershipReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseProjectOwnershipReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseProjectOwnershipPreflight 获取企业项目归属迁移只读预检。
// GET /api/admin/enterprise/project-ownership-preflight
func (h *AdminHandler) GetEnterpriseProjectOwnershipPreflight(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	preflight, err := h.adminService.GetEnterpriseProjectOwnershipPreflight(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    preflight,
	})
}

// GetEnterpriseProjectOwnershipMappings 获取企业项目归属映射只读回读。
// GET /api/admin/enterprise/project-ownership-mappings
func (h *AdminHandler) GetEnterpriseProjectOwnershipMappings(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	mappings, err := h.adminService.GetEnterpriseProjectOwnershipMappings(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    mappings,
	})
}

// GetEnterpriseProjectOwnershipOwnerGuardReadiness 获取企业项目归属 owner guard 接线只读 readiness。
// GET /api/admin/enterprise/project-ownership-owner-guard-readiness
func (h *AdminHandler) GetEnterpriseProjectOwnershipOwnerGuardReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseProjectOwnershipOwnerGuardReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseProjectAccessGuardSwitchReadiness 获取 Project Access Guard 企业映射授权切换只读 readiness。
// GET /api/admin/enterprise/project-access-guard-switch-readiness
func (h *AdminHandler) GetEnterpriseProjectAccessGuardSwitchReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseProjectAccessGuardSwitchReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseProjectAccessGuardAuthorizationDryRunEvidence 获取 Project Access Guard 企业授权 dry-run 只读 evidence。
// GET /api/admin/enterprise/project-access-guard-authorization-dry-run
func (h *AdminHandler) GetEnterpriseProjectAccessGuardAuthorizationDryRunEvidence(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	evidence, err := h.adminService.GetEnterpriseProjectAccessGuardAuthorizationDryRunEvidence(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    evidence,
	})
}

// GetEnterpriseProjectAccessGuardActivationReadiness 获取 Project Access Guard 企业授权 activation readiness 只读 evidence。
// GET /api/admin/enterprise/project-access-guard-activation-readiness
func (h *AdminHandler) GetEnterpriseProjectAccessGuardActivationReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseProjectAccessGuardActivationReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseProjectAccessGuardActivationAuditReadiness 获取 Project Access Guard activation audit schema 只读 readiness。
// GET /api/admin/enterprise/project-access-guard-activation-audit-readiness
func (h *AdminHandler) GetEnterpriseProjectAccessGuardActivationAuditReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseProjectAccessGuardActivationAuditReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditCoverageReadiness 获取企业治理审计覆盖只读 readiness。
// GET /api/admin/enterprise/audit-coverage-readiness
func (h *AdminHandler) GetEnterpriseAuditCoverageReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditCoverageReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// RecordEnterpriseProjectAccessGuardActivationManualApproval 记录 Project Access Guard activation 人工审批证据。
// POST /api/admin/enterprise/project-access-guard-activation/manual-approval
func (h *AdminHandler) RecordEnterpriseProjectAccessGuardActivationManualApproval(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req recordEnterpriseProjectAccessGuardActivationManualApprovalRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.RecordEnterpriseProjectAccessGuardActivationManualApproval(c, operatorID, service.EnterpriseProjectAccessGuardActivationManualApprovalInput{
		ConfirmManualApproval: req.ConfirmManualApproval,
		ApprovalNote:          req.ApprovalNote,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseProjectAccessGuardActivationManualApprovalValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// RecordEnterpriseProjectAccessGuardActivationExecution 记录 Project Access Guard activation execution 审计证据。
// POST /api/admin/enterprise/project-access-guard-activation/execution
func (h *AdminHandler) RecordEnterpriseProjectAccessGuardActivationExecution(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req recordEnterpriseProjectAccessGuardActivationExecutionRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.RecordEnterpriseProjectAccessGuardActivationExecution(c, operatorID, service.EnterpriseProjectAccessGuardActivationExecutionInput{
		ConfirmActivationExecution: req.ConfirmActivationExecution,
		ExecutionNote:              req.ExecutionNote,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseProjectAccessGuardActivationExecutionValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// RecordEnterpriseProjectAccessGuardPostActivationValidation 记录 Project Access Guard post-activation validation 审计证据。
// POST /api/admin/enterprise/project-access-guard-activation/post-validation
func (h *AdminHandler) RecordEnterpriseProjectAccessGuardPostActivationValidation(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req recordEnterpriseProjectAccessGuardPostActivationValidationRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.RecordEnterpriseProjectAccessGuardPostActivationValidation(c, operatorID, service.EnterpriseProjectAccessGuardPostActivationValidationInput{
		ConfirmPostActivationValidation: req.ConfirmPostActivationValidation,
		ValidationNote:                  req.ValidationNote,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseProjectAccessGuardPostActivationValidationValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// RecordEnterpriseProjectAccessGuardRollbackEvidence 记录 Project Access Guard rollback evidence 审计证据。
// POST /api/admin/enterprise/project-access-guard-activation/rollback-evidence
func (h *AdminHandler) RecordEnterpriseProjectAccessGuardRollbackEvidence(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req recordEnterpriseProjectAccessGuardRollbackEvidenceRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.RecordEnterpriseProjectAccessGuardRollbackEvidence(c, operatorID, service.EnterpriseProjectAccessGuardRollbackEvidenceInput{
		ConfirmRollbackEvidence: req.ConfirmRollbackEvidence,
		RollbackNote:            req.RollbackNote,
		RollbackReference:       req.RollbackReference,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseProjectAccessGuardRollbackEvidenceValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// ActivateEnterpriseProjectAccessGuardAuthorization 受控激活 Project Access Guard enterprise authorization。
// POST /api/admin/enterprise/project-access-guard-activation/activate
func (h *AdminHandler) ActivateEnterpriseProjectAccessGuardAuthorization(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req activateEnterpriseProjectAccessGuardAuthorizationRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.ActivateEnterpriseProjectAccessGuardAuthorization(c, operatorID, service.EnterpriseProjectAccessGuardAuthorizationActivationInput{
		ConfirmEnterpriseAuthorizationActivation: req.ConfirmEnterpriseAuthorizationActivation,
		ActivationNote:                           req.ActivationNote,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseProjectAccessGuardAuthorizationActivationValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// MigrateEnterpriseProjectOwnership 执行受控企业项目归属映射写入。
// POST /api/admin/enterprise/project-ownership-migrations
func (h *AdminHandler) MigrateEnterpriseProjectOwnership(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req migrateEnterpriseProjectOwnershipRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.MigrateEnterpriseProjectOwnership(c, operatorID, service.EnterpriseProjectOwnershipMigrateInput{
		ProjectRecordID: req.ProjectRecordID,
		OrganizationID:  req.OrganizationID,
		TeamID:          req.TeamID,
		ConfirmMigrate:  req.ConfirmMigrate,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseProjectOwnershipMigrateValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// ListEnterpriseOrganizations 获取企业组织列表。
// GET /api/admin/enterprise/organizations
func (h *AdminHandler) ListEnterpriseOrganizations(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	organizations, err := h.adminService.ListEnterpriseOrganizations(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    organizations,
	})
}

// ListEnterpriseTeams 获取企业团队列表。
// GET /api/admin/enterprise/teams
func (h *AdminHandler) ListEnterpriseTeams(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	teams, err := h.adminService.ListEnterpriseTeams(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    teams,
	})
}

// GetEnterpriseAuditExportReadiness 获取企业治理审计导出前置只读 readiness。
// GET /api/admin/enterprise/audit-export-readiness
func (h *AdminHandler) GetEnterpriseAuditExportReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportQueryReadiness 获取企业治理审计导出查询条件只读 readiness。
// GET /api/admin/enterprise/audit-export-query-readiness
func (h *AdminHandler) GetEnterpriseAuditExportQueryReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportQueryReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportTaskPreflightReadiness 获取企业治理审计导出任务创建前置只读 readiness。
// GET /api/admin/enterprise/audit-export-task-preflight-readiness
func (h *AdminHandler) GetEnterpriseAuditExportTaskPreflightReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportTaskPreflightReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportFileFormatReadiness 获取企业治理审计导出文件格式只读 readiness。
// GET /api/admin/enterprise/audit-export-file-format-readiness
func (h *AdminHandler) GetEnterpriseAuditExportFileFormatReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportFileFormatReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportFileGeneratorReadiness 获取企业治理审计导出文件生成器只读 readiness。
// GET /api/admin/enterprise/audit-export-file-generator-readiness
func (h *AdminHandler) GetEnterpriseAuditExportFileGeneratorReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportFileGeneratorReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportTaskCreateRequestReadiness 获取企业治理审计导出任务创建请求契约只读 readiness。
// GET /api/admin/enterprise/audit-export-task-create-request-readiness
func (h *AdminHandler) GetEnterpriseAuditExportTaskCreateRequestReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportTaskCreateRequestReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportTaskPersistenceReadiness 获取企业治理审计导出任务持久化契约只读 readiness。
// GET /api/admin/enterprise/audit-export-task-persistence-readiness
func (h *AdminHandler) GetEnterpriseAuditExportTaskPersistenceReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportTaskPersistenceReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// CreateEnterpriseAuditExportTask 受控创建企业治理审计导出任务。
// POST /api/admin/enterprise/audit-export-tasks
func (h *AdminHandler) CreateEnterpriseAuditExportTask(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req createEnterpriseAuditExportTaskRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.CreateEnterpriseAuditExportTask(c, operatorID, service.EnterpriseAuditExportTaskCreateInput{
		Format:            req.Format,
		Reason:            req.Reason,
		Filters:           req.Filters,
		TimeRangeStart:    req.TimeRangeStart,
		TimeRangeEnd:      req.TimeRangeEnd,
		IdempotencyKey:    req.IdempotencyKey,
		ConfirmCreateTask: req.ConfirmCreateTask,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseAuditExportTaskCreateValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// TransitionEnterpriseAuditExportTaskStatus 受控修改企业治理审计导出任务状态。
// POST /api/admin/enterprise/audit-export-task-status-transitions
func (h *AdminHandler) TransitionEnterpriseAuditExportTaskStatus(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req transitionEnterpriseAuditExportTaskStatusRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.TransitionEnterpriseAuditExportTaskStatus(c, operatorID, service.EnterpriseAuditExportTaskStatusTransitionInput{
		TaskID:                  req.TaskID,
		TargetStatus:            req.TargetStatus,
		Reason:                  req.Reason,
		ConfirmStatusTransition: req.ConfirmStatusTransition,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseAuditExportTaskStatusTransitionValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// ListEnterpriseAuditExportTasks 只读回读企业治理审计导出任务。
// GET /api/admin/enterprise/audit-export-tasks
func (h *AdminHandler) ListEnterpriseAuditExportTasks(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	result, err := h.adminService.ListEnterpriseAuditExportTasks(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GetEnterpriseAuditExportWorkerReadiness 获取企业治理审计导出 worker 只读 readiness。
// GET /api/admin/enterprise/audit-export-worker-readiness
func (h *AdminHandler) GetEnterpriseAuditExportWorkerReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportWorkerReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportWorkerExecutionRequestReadiness 获取企业治理审计导出 worker 执行请求契约 readiness。
// GET /api/admin/enterprise/audit-export-worker-execution-request-readiness
func (h *AdminHandler) GetEnterpriseAuditExportWorkerExecutionRequestReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportWorkerExecutionRequestReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportWorkerExecutionRequestPersistenceReadiness 获取企业治理审计导出 worker 执行请求持久化 readiness。
// GET /api/admin/enterprise/audit-export-worker-execution-request-persistence-readiness
func (h *AdminHandler) GetEnterpriseAuditExportWorkerExecutionRequestPersistenceReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportWorkerExecutionRequestPersistenceReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// PersistEnterpriseAuditExportWorkerExecutionRequest 受控持久化企业治理审计导出 worker execution request。
// POST /api/admin/enterprise/audit-export-worker-execution-requests
func (h *AdminHandler) PersistEnterpriseAuditExportWorkerExecutionRequest(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req persistEnterpriseAuditExportWorkerExecutionRequestRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.PersistEnterpriseAuditExportWorkerExecutionRequest(c, operatorID, service.EnterpriseAuditExportWorkerExecutionRequestPersistInput{
		TaskID:                 req.TaskID,
		Reason:                 req.Reason,
		IdempotencyKey:         req.IdempotencyKey,
		BatchLimit:             req.BatchLimit,
		ConfirmWorkerExecution: req.ConfirmWorkerExecution,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseAuditExportWorkerExecutionRequestPersistValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GetEnterpriseAuditExportWorkerExecutionDryRunReadiness 获取企业治理审计导出 worker execution dry-run readiness。
// GET /api/admin/enterprise/audit-export-worker-execution-dry-run-readiness
func (h *AdminHandler) GetEnterpriseAuditExportWorkerExecutionDryRunReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportWorkerExecutionDryRunReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportWorkerExecutionArtifactReadiness 获取企业治理审计导出 worker execution artifact readiness。
// GET /api/admin/enterprise/audit-export-worker-execution-artifact-readiness
func (h *AdminHandler) GetEnterpriseAuditExportWorkerExecutionArtifactReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportWorkerExecutionArtifactReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportWorkerExecutionOutputStorageReadiness 获取企业治理审计导出 worker execution output storage readiness。
// GET /api/admin/enterprise/audit-export-worker-execution-output-storage-readiness
func (h *AdminHandler) GetEnterpriseAuditExportWorkerExecutionOutputStorageReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportWorkerExecutionOutputStorageReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// DryRunEnterpriseAuditExportWorkerExecutionRequest 受控写入 worker execution dry-run result。
// POST /api/admin/enterprise/audit-export-worker-execution-dry-run
func (h *AdminHandler) DryRunEnterpriseAuditExportWorkerExecutionRequest(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req dryRunEnterpriseAuditExportWorkerExecutionRequestRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.DryRunEnterpriseAuditExportWorkerExecutionRequest(c, operatorID, service.EnterpriseAuditExportWorkerExecutionDryRunInput{
		RequestID:                    req.RequestID,
		Reason:                       req.Reason,
		ConfirmWorkerExecutionDryRun: req.ConfirmWorkerExecutionDryRun,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseAuditExportWorkerExecutionDryRunValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GenerateEnterpriseAuditExportWorkerExecutionArtifact 受控生成 worker execution artifact snapshot。
// POST /api/admin/enterprise/audit-export-worker-execution-artifact
func (h *AdminHandler) GenerateEnterpriseAuditExportWorkerExecutionArtifact(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req generateEnterpriseAuditExportWorkerExecutionArtifactRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.GenerateEnterpriseAuditExportWorkerExecutionArtifact(c, operatorID, service.EnterpriseAuditExportWorkerExecutionArtifactGenerateInput{
		RequestID:                      req.RequestID,
		Reason:                         req.Reason,
		ConfirmWorkerExecutionArtifact: req.ConfirmWorkerExecutionArtifact,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseAuditExportWorkerExecutionArtifactGenerateValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// StoreEnterpriseAuditExportWorkerExecutionOutputStorage 受控写入 worker execution output storage metadata。
// POST /api/admin/enterprise/audit-export-worker-execution-output-storage
func (h *AdminHandler) StoreEnterpriseAuditExportWorkerExecutionOutputStorage(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req storeEnterpriseAuditExportWorkerExecutionOutputStorageRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.StoreEnterpriseAuditExportWorkerExecutionOutputStorage(c, operatorID, service.EnterpriseAuditExportWorkerExecutionOutputStorageStoreInput{
		RequestID:                           req.RequestID,
		Reason:                              req.Reason,
		ConfirmWorkerExecutionOutputStorage: req.ConfirmWorkerExecutionOutputStorage,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseAuditExportWorkerExecutionOutputStorageStoreValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GetEnterpriseAuditExportWorkerExecutionTaskCompletionReadiness 获取 output_stored request 推进任务完成的只读 readiness。
// GET /api/admin/enterprise/audit-export-worker-execution-task-completion-readiness
func (h *AdminHandler) GetEnterpriseAuditExportWorkerExecutionTaskCompletionReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportWorkerExecutionTaskCompletionReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// CompleteEnterpriseAuditExportWorkerExecutionTask 受控使用 output_stored request 推进任务完成。
// POST /api/admin/enterprise/audit-export-worker-execution-task-completions
func (h *AdminHandler) CompleteEnterpriseAuditExportWorkerExecutionTask(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req completeEnterpriseAuditExportWorkerExecutionTaskRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.CompleteEnterpriseAuditExportWorkerExecutionTask(c, operatorID, service.EnterpriseAuditExportWorkerExecutionTaskCompletionInput{
		RequestID:                            req.RequestID,
		Reason:                               req.Reason,
		ConfirmWorkerExecutionTaskCompletion: req.ConfirmWorkerExecutionTaskCompletion,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseAuditExportWorkerExecutionTaskCompletionValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GetEnterpriseAuditExportTaskStatusTransitionReadiness 获取企业治理审计导出任务状态转移只读 preflight。
// GET /api/admin/enterprise/audit-export-task-status-transition-readiness
func (h *AdminHandler) GetEnterpriseAuditExportTaskStatusTransitionReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportTaskStatusTransitionReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportArchiveExpirationReadiness 获取企业治理审计导出归档/过期扫描只读 preflight。
// GET /api/admin/enterprise/audit-export-archive-expiration-readiness
func (h *AdminHandler) GetEnterpriseAuditExportArchiveExpirationReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportArchiveExpirationReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportDeliveryReportReadiness 获取企业治理审计导出交付报告只读 readiness。
// GET /api/admin/enterprise/audit-export-delivery-report-readiness
func (h *AdminHandler) GetEnterpriseAuditExportDeliveryReportReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportDeliveryReportReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportDeliveryReportCompletedTaskReadiness 获取 completed task 作为交付报告输入证据的只读 readiness。
// GET /api/admin/enterprise/audit-export-delivery-report-completed-task-readiness
func (h *AdminHandler) GetEnterpriseAuditExportDeliveryReportCompletedTaskReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportDeliveryReportCompletedTaskReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportDeliveryReportGenerateRequestReadiness 获取企业治理审计导出交付报告生成请求契约只读 readiness。
// GET /api/admin/enterprise/audit-export-delivery-report-generate-request-readiness
func (h *AdminHandler) GetEnterpriseAuditExportDeliveryReportGenerateRequestReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportDeliveryReportGenerateRequestReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportDeliveryReportStorageReadiness 获取企业治理审计导出交付报告存储契约只读 readiness。
// GET /api/admin/enterprise/audit-export-delivery-report-storage-readiness
func (h *AdminHandler) GetEnterpriseAuditExportDeliveryReportStorageReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportDeliveryReportStorageReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GetEnterpriseAuditExportDeliveryReportStoredReadiness 获取已存交付报告作为后续交付/归档输入证据的只读 readiness。
// GET /api/admin/enterprise/audit-export-delivery-report-stored-readiness
func (h *AdminHandler) GetEnterpriseAuditExportDeliveryReportStoredReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditExportDeliveryReportStoredReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// GenerateEnterpriseAuditExportDeliveryReport 受控生成企业治理审计导出交付报告 markdown。
// POST /api/admin/enterprise/audit-export-delivery-report
func (h *AdminHandler) GenerateEnterpriseAuditExportDeliveryReport(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req generateEnterpriseAuditExportDeliveryReportRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.GenerateEnterpriseAuditExportDeliveryReport(c, service.EnterpriseAuditExportDeliveryReportGenerateInput{
		Reason:                req.Reason,
		IdempotencyKey:        req.IdempotencyKey,
		ConfirmGenerateReport: req.ConfirmGenerateReport,
	})
	if err != nil {
		var validationErr service.EnterpriseAuditExportDeliveryReportGenerateValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// StoreEnterpriseAuditExportDeliveryReport 受控存储企业治理审计导出交付报告。
// POST /api/admin/enterprise/audit-export-delivery-report-storage
func (h *AdminHandler) StoreEnterpriseAuditExportDeliveryReport(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req storeEnterpriseAuditExportDeliveryReportRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	result, err := h.adminService.StoreEnterpriseAuditExportDeliveryReport(c, operatorID, service.EnterpriseAuditExportDeliveryReportStoreInput{
		Reason:             req.Reason,
		IdempotencyKey:     req.IdempotencyKey,
		ReportFormat:       req.ReportFormat,
		ReportContent:      req.ReportContent,
		GeneratedAt:        req.GeneratedAt,
		ConfirmStoreReport: req.ConfirmStoreReport,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseAuditExportDeliveryReportStoreValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GetEnterpriseAuditRetentionReadiness 获取企业治理审计保留策略只读 readiness。
// GET /api/admin/enterprise/audit-retention-readiness
func (h *AdminHandler) GetEnterpriseAuditRetentionReadiness(c context.Context, ctx *app.RequestContext) {
	if _, ok := h.requireSuperAdmin(ctx); !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	readiness, err := h.adminService.GetEnterpriseAuditRetentionReadiness(c)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

// CreateEnterpriseOrganization 创建企业组织。
// POST /api/admin/enterprise/organizations
func (h *AdminHandler) CreateEnterpriseOrganization(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req createEnterpriseOrganizationRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	organization, err := h.adminService.CreateEnterpriseOrganization(c, operatorID, service.EnterpriseOrganizationCreateInput{
		Slug:        req.Slug,
		DisplayName: req.DisplayName,
		Status:      req.Status,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseOrganizationCreateValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    organization,
	})
}

// CreateEnterpriseTeam 创建企业团队。
// POST /api/admin/enterprise/teams
func (h *AdminHandler) CreateEnterpriseTeam(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req createEnterpriseTeamRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	team, err := h.adminService.CreateEnterpriseTeam(c, operatorID, service.EnterpriseTeamCreateInput{
		OrganizationID: req.OrganizationID,
		Slug:           req.Slug,
		DisplayName:    req.DisplayName,
		Status:         req.Status,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseTeamCreateValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    team,
	})
}

// BindEnterpriseMember 绑定企业成员。
// POST /api/admin/enterprise/members
func (h *AdminHandler) BindEnterpriseMember(c context.Context, ctx *app.RequestContext) {
	operatorID, ok := h.requireSuperAdmin(ctx)
	if !ok {
		return
	}
	if h.adminService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "admin service not available"})
		return
	}
	var req bindEnterpriseMemberRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	member, err := h.adminService.BindEnterpriseMember(c, operatorID, service.EnterpriseMemberBindInput{
		OrganizationID: req.OrganizationID,
		TeamID:         req.TeamID,
		UserID:         req.UserID,
		Status:         req.Status,
	}, string(ctx.ClientIP()))
	if err != nil {
		var validationErr service.EnterpriseMemberBindValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"success": false, "error": validationErr.Error()})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    member,
	})
}
