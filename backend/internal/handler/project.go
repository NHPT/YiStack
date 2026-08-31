// Package handler HTTP 处理器
package handler

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/config"
	"yistack/internal/model"
	"yistack/internal/orchestration"
	"yistack/internal/service"
)

// ProjectHandler 项目处理器。
// 它只负责项目相关 HTTP 协议转换，具体业务由不同 service 协作完成。
type ProjectHandler struct {
	projectService         *service.ProjectService
	planOrchestrator       *orchestration.PlanOrchestrator
	generateOrchestrator   *orchestration.GenerateOrchestrator
	projectMessageService  *service.ProjectMessageService
	capabilityAuditService *service.CapabilityExecutionAuditService
	jwtSecret              string
	authJWTSecret          string
	previewTokenTTL        time.Duration
	allowedOrigins         []string
}

// NewProjectHandler 创建项目处理器。
func NewProjectHandler(projectService *service.ProjectService, planOrchestrator *orchestration.PlanOrchestrator, generateOrchestrator *orchestration.GenerateOrchestrator, projectMessageService *service.ProjectMessageService, capabilityAuditService *service.CapabilityExecutionAuditService, cfg *config.Config) *ProjectHandler {
	authSecret := ""
	allowedOrigins := []string(nil)
	if cfg != nil {
		authSecret = cfg.JWT.Secret
		allowedOrigins = append(allowedOrigins, cfg.CORS.AllowedOrigins...)
	}
	return &ProjectHandler{
		projectService:         projectService,
		planOrchestrator:       planOrchestrator,
		generateOrchestrator:   generateOrchestrator,
		projectMessageService:  projectMessageService,
		capabilityAuditService: capabilityAuditService,
		jwtSecret:              previewJWTSecret(cfg),
		authJWTSecret:          authSecret,
		previewTokenTTL:        previewTokenTTL(cfg),
		allowedOrigins:         allowedOrigins,
	}
}

func (h *ProjectHandler) currentUserID(ctx *app.RequestContext) (string, bool) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(consts.StatusUnauthorized, map[string]interface{}{
			"error": "Unauthorized",
		})
		return "", false
	}
	uid, ok := userID.(string)
	if !ok || uid == "" {
		ctx.JSON(consts.StatusUnauthorized, map[string]interface{}{
			"error": "Invalid user ID",
		})
		return "", false
	}
	return uid, true
}

func projectRequestAccessAllowed(ctx *app.RequestContext, projectID string, decision service.ProjectAccessDecision) bool {
	if ctx == nil {
		return false
	}
	method := string(ctx.Request.Method())
	path := strings.TrimSuffix(string(ctx.Path()), "/")
	if strings.Contains(path, "/backups") || strings.Contains(path, "/preview-share") || strings.Contains(path, "/resource-alert") {
		return decision.CanManage()
	}
	if strings.Contains(path, "/terminal") {
		return decision.CanWrite()
	}
	if method == "GET" || method == "HEAD" {
		return decision.CanRead()
	}
	root := "/api/project/" + strings.TrimSpace(projectID)
	if path == root || strings.Contains(path, "/backups") || strings.Contains(path, "/preview-share") || strings.Contains(path, "/resource-alert") {
		return decision.CanManage()
	}
	return decision.CanWrite()
}

func classifyContainerStartStatus(err error) int {
	if err == nil {
		return consts.StatusOK
	}

	message := strings.ToLower(err.Error())
	if strings.Contains(message, "container manager not available") ||
		strings.Contains(message, "podman not available") ||
		strings.Contains(message, "connection refused") ||
		strings.Contains(message, "no such file or directory") ||
		strings.Contains(message, "cannot connect") ||
		strings.Contains(message, "failed to create container") {
		return consts.StatusServiceUnavailable
	}

	return consts.StatusInternalServerError
}

func (h *ProjectHandler) requireOwnedProject(c context.Context, ctx *app.RequestContext, projectID string) (*service.ProjectService, *model.Project, bool) {
	if h.projectService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{
			"error": "Project service not available",
		})
		return nil, nil, false
	}

	uid, ok := h.currentUserID(ctx)
	if !ok {
		return nil, nil, false
	}

	decision := h.projectService.AuthorizeProjectAccess(c, uid, projectID)
	if decision.Status == service.ProjectAccessDecisionGranted && !projectRequestAccessAllowed(ctx, projectID, decision) {
		ctx.JSON(consts.StatusForbidden, map[string]interface{}{"error": "Project role does not allow this operation"})
		return nil, nil, false
	}
	switch decision.Status {
	case service.ProjectAccessDecisionGranted:
		return h.projectService, decision.Project, true
	case service.ProjectAccessDecisionProjectNotFound:
		ctx.JSON(consts.StatusNotFound, map[string]interface{}{
			"error": "Project not found",
		})
		return nil, nil, false
	case service.ProjectAccessDecisionForbidden:
		ctx.JSON(consts.StatusForbidden, map[string]interface{}{
			"error": "You don't have permission to access this project",
		})
		return nil, nil, false
	case service.ProjectAccessDecisionUnauthenticated:
		ctx.JSON(consts.StatusUnauthorized, map[string]interface{}{
			"error": "Unauthorized",
		})
		return nil, nil, false
	case service.ProjectAccessDecisionServiceUnavailable:
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{
			"error": "Project service not available",
		})
		return nil, nil, false
	default:
		ctx.JSON(consts.StatusForbidden, map[string]interface{}{
			"error": "You don't have permission to access this project",
		})
		return nil, nil, false
	}
}

func (h *ProjectHandler) buildProjectResponse(c context.Context, project *model.Project, userID string, includeEngineeringState bool) map[string]interface{} {
	previewURL := ""
	internalPort := 0
	if h != nil && h.projectService != nil && project != nil {
		previewURL = h.projectService.BuildProjectPreviewURL(project.ProjectID)
		internalPort = project.ContainerPort
	}

	response := map[string]interface{}{
		"id":                    project.ID,
		"project_id":            project.ProjectID,
		"name":                  project.Name,
		"description":           project.Description,
		"app_type":              project.AppType,
		"tech_stack":            project.TechStack,
		"plan_id":               project.PlanID,
		"plan_data":             project.PlanData,
		"container_port":        project.ContainerPort,
		"internal_port":         internalPort,
		"preview_url":           previewURL,
		"preview_share_enabled": project.PreviewShareEnabled,
		"preview_share_id":      project.PreviewShareID,
		"preview_share_url":     buildProjectResponsePreviewShareURL(project),
		"container_status":      project.ContainerStatus,
	}
	if !project.CreatedAt.IsZero() {
		response["created_at"] = project.CreatedAt
	}
	if !project.UpdatedAt.IsZero() {
		response["updated_at"] = project.UpdatedAt
	}
	if h != nil && h.projectService != nil && strings.TrimSpace(userID) != "" {
		decision := h.projectService.AuthorizeProjectAccess(c, userID, project.ProjectID)
		response["access_role"] = decision.AccessRole
		response["can_write"] = decision.CanWrite()
		response["can_manage_members"] = decision.CanManage()
	}
	if includeEngineeringState && h != nil && h.projectMessageService != nil && project != nil {
		if snapshot, ok, err := h.projectMessageService.GetLatestEngineeringStateSnapshot(c, project.ProjectID); err == nil && ok {
			response["engineering_state"] = snapshot
		}
	}

	return response
}

func buildProjectResponsePreviewShareURL(project *model.Project) string {
	if project == nil || project.PreviewShareEnabled == false {
		return ""
	}
	previewShareID := strings.TrimSpace(project.PreviewShareID)
	if previewShareID == "" {
		return ""
	}
	return "/preview/" + previewShareID
}

func buildAdminProjectResponse(project *model.Project, runtimeStatus *service.ProjectRuntimeStatus) map[string]interface{} {
	response := map[string]interface{}{
		"id":               project.ID,
		"project_id":       project.ProjectID,
		"user_id":          project.UserID,
		"name":             project.Name,
		"description":      project.Description,
		"app_type":         project.AppType,
		"tech_stack":       project.TechStack,
		"plan_id":          project.PlanID,
		"container_port":   project.ContainerPort,
		"internal_port":    project.ContainerPort,
		"container_status": project.ContainerStatus,
	}
	if !project.CreatedAt.IsZero() {
		response["created_at"] = project.CreatedAt
	}
	if !project.UpdatedAt.IsZero() {
		response["updated_at"] = project.UpdatedAt
	}
	if runtimeStatus != nil {
		response["runtime_status"] = runtimeStatus
	}
	return response
}

// ListAdminProjects GET /api/admin/projects 获取管理员只读项目列表。
func (h *ProjectHandler) ListAdminProjects(c context.Context, ctx *app.RequestContext) {
	role, _ := ctx.Get("role")
	if role != "super_admin" {
		ctx.JSON(consts.StatusForbidden, map[string]interface{}{
			"error": "Only super_admin can list all projects",
		})
		return
	}
	if h.projectService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{
			"error": "Project service not available",
		})
		return
	}

	page := 1
	pageSize := 20
	if p := ctx.Query("page"); p != "" {
		if parsed, ok := parseInt(p); ok {
			page = parsed
		}
	}
	if ps := ctx.Query("pageSize"); ps != "" {
		if parsed, ok := parseInt(ps); ok {
			pageSize = parsed
		}
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	projects, total, err := h.projectService.ListProjects(c, page, pageSize)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to list projects",
		})
		return
	}

	projectResponses := make([]map[string]interface{}, 0, len(projects))
	for i := range projects {
		runtimeStatus, statusErr := h.projectService.GetStoredProjectRuntimeStatusForProject(&projects[i])
		if statusErr != nil {
			log.Printf("Warning: failed to read admin runtime status snapshot for project %s: %v", projects[i].ProjectID, statusErr)
		}
		projectResponses = append(projectResponses, buildAdminProjectResponse(&projects[i], runtimeStatus))
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"projects": projectResponses,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

func (h *ProjectHandler) currentUserIDValue(ctx *app.RequestContext) string {
	if ctx == nil {
		return ""
	}
	userID, exists := ctx.Get("user_id")
	if !exists {
		return ""
	}
	uid, _ := userID.(string)
	return strings.TrimSpace(uid)
}

func (h *ProjectHandler) buildSignedPreviewURL(projectID, userID, previewURL string) (signed string) {
	signed = strings.TrimSpace(previewURL)
	defer func() {
		if recovered := recover(); recovered != nil {
			log.Printf("[PANIC] build signed preview url for project %s: %v", projectID, recovered)
		}
	}()
	if h == nil || signed == "" {
		return signed
	}
	token, err := issuePreviewAccessToken(projectID, userID, h.jwtSecret, h.previewTokenTTL)
	if err != nil {
		return signed
	}
	return attachPreviewToken(signed, token)
}

func (h *ProjectHandler) EnablePreviewShare(c context.Context, ctx *app.RequestContext) {
	projectID := strings.TrimSpace(ctx.Param("id"))
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}
	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}
	result, err := projectService.EnableProjectPreviewShare(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to enable preview share",
			"details": err.Error(),
		})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

func (h *ProjectHandler) DisablePreviewShare(c context.Context, ctx *app.RequestContext) {
	projectID := strings.TrimSpace(ctx.Param("id"))
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}
	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}
	result, err := projectService.DisableProjectPreviewShare(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to disable preview share",
			"details": err.Error(),
		})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// CreateProjectRequest 创建项目请求。
type CreateProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	AppType     string `json:"app_type"`
	TechStack   string `json:"tech_stack"`
	PlanID      string `json:"plan_id"`
	PlanData    string `json:"plan_data"`
}

// Create POST /api/project/create 创建项目。
func (h *ProjectHandler) Create(c context.Context, ctx *app.RequestContext) {
	if string(ctx.Request.Method()) == "POST" {
		h.create(c, ctx)
		return
	}
	ctx.JSON(consts.StatusMethodNotAllowed, map[string]interface{}{
		"error": "Method not allowed",
	})
}

func (h *ProjectHandler) create(c context.Context, ctx *app.RequestContext) {
	var req CreateProjectRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	req.normalize()

	if h.projectService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{
			"success": false,
			"error":   "Project service unavailable",
			"details": "当前项目服务未连接数据库，无法创建项目记录",
		})
		return
	}

	uid, ok := h.currentUserID(ctx)
	if !ok {
		return
	}

	project, err := h.projectService.CreateProject(c, &service.CreateProjectRequest{
		UserID:      uid,
		Name:        req.Name,
		Description: req.Description,
		AppType:     req.AppType,
		TechStack:   req.TechStack,
		PlanID:      req.PlanID,
		PlanData:    req.PlanData,
	})
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to create project",
			"details": err.Error(),
		})
		return
	}

	if project.CreatedAt.IsZero() || project.UpdatedAt.IsZero() {
		if refreshedProject, refreshErr := h.projectService.GetProject(c, project.ProjectID); refreshErr == nil && refreshedProject != nil {
			project = refreshedProject
		}
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    h.buildProjectResponse(c, project, h.currentUserIDValue(ctx), true),
	})
}

// List GET /api/project/list 获取项目列表。
func (h *ProjectHandler) List(c context.Context, ctx *app.RequestContext) {
	if h.projectService == nil {
		ctx.JSON(consts.StatusOK, map[string]interface{}{
			"success": true,
			"data":    map[string]interface{}{"projects": []interface{}{}, "total": 0},
		})
		return
	}

	uid, ok := h.currentUserID(ctx)
	if !ok {
		return
	}

	page := 1
	pageSize := 20
	if p := ctx.Query("page"); p != "" {
		if parsed, ok := parseInt(p); ok {
			page = parsed
		}
	}
	if ps := ctx.Query("pageSize"); ps != "" {
		if parsed, ok := parseInt(ps); ok {
			pageSize = parsed
		}
	}

	projects, total, err := h.projectService.ListUserProjects(c, uid, page, pageSize)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to list projects",
		})
		return
	}

	projectResponses := make([]map[string]interface{}, 0, len(projects))
	for i := range projects {
		projectResponses = append(projectResponses, h.buildProjectResponse(c, &projects[i], uid, true))
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"projects": projectResponses,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

// Get GET /api/project/:id 获取单个项目。
func (h *ProjectHandler) Get(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	_, project, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    h.buildProjectResponse(c, project, h.currentUserIDValue(ctx), true),
	})
}

// Delete DELETE /api/project/:id 删除项目。
func (h *ProjectHandler) Delete(c context.Context, ctx *app.RequestContext) {
	defer func() {
		if recovered := recover(); recovered != nil {
			log.Printf("[PANIC] delete project %s: %v", ctx.Param("id"), recovered)
			ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
				"error":   "Failed to delete project",
				"details": fmt.Sprintf("internal server panic: %v", recovered),
			})
			ctx.Abort()
		}
	}()

	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	if err := projectService.DeleteProjectAsync(c, projectID); err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to delete project",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusAccepted, map[string]interface{}{
		"success": true,
		"message": "Project deletion accepted; background cleanup is pending",
		"data": map[string]interface{}{
			"project_id":             projectID,
			"deletion_status":        "accepted",
			"cleanup_status":         "background_cleanup_pending",
			"cleanup_scope":          service.ProjectDeletionCleanupScope(),
			"cleanup_strategy":       "soft_delete_then_async_cleanup",
			"restore_window_seconds": int(service.ProjectDeletionRestoreWindow().Seconds()),
			"can_restore":            true,
		},
	})
}

// RestoreDeleted POST /api/project/:id/restore 在后台清理窗口内恢复软删项目。
func (h *ProjectHandler) RestoreDeleted(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}
	if h.projectService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{
			"error": "Project service not available",
		})
		return
	}
	uid, ok := h.currentUserID(ctx)
	if !ok {
		return
	}

	project, err := h.projectService.RestoreDeletedProject(c, projectID, uid)
	if err != nil {
		ctx.JSON(consts.StatusConflict, map[string]interface{}{
			"success": false,
			"error":   "Failed to restore deleted project",
			"details": err.Error(),
			"data": map[string]interface{}{
				"project_id":     projectID,
				"restore_status": "blocked",
				"can_restore":    false,
				"recovery":       "项目删除恢复窗口可能已过期，或后台清理已开始；请刷新项目列表确认最新状态。",
			},
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Project restored from soft delete window",
		"data": map[string]interface{}{
			"project_id":          projectID,
			"restore_status":      "restored",
			"can_restore":         false,
			"cleanup_status":      "cancelled_by_user_restore",
			"cleanup_strategy":    "soft_delete_restore_before_async_cleanup",
			"restored_project":    h.buildProjectResponse(c, project, uid, true),
			"restore_scope":       []string{"project_record.deleted_at"},
			"restore_boundary":    "只恢复项目软删标记，不启动容器、不恢复已清理资源、不执行 Git 或备份写操作。",
			"restore_window_open": false,
		},
	})
}

// Update PUT /api/project/:id 更新项目。
func (h *ProjectHandler) Update(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	var updates map[string]interface{}
	if err := ctx.Bind(&updates); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	if err := projectService.UpdateProject(c, projectID, updates); err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to update project",
			"details": err.Error(),
		})
		return
	}

	updatedProject, err := projectService.GetProject(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusOK, map[string]interface{}{
			"success": true,
			"message": "Project updated",
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Project updated",
		"data":    h.buildProjectResponse(c, updatedProject, h.currentUserIDValue(ctx), true),
	})
}

func parseInt(s string) (int, bool) {
	var n int
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, false
		}
		n = n*10 + int(c-'0')
	}
	return n, true
}
