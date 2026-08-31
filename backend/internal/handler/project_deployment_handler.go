package handler

import (
	"context"
	"errors"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/internal/model"
	"yistack/internal/service"
)

type ProjectDeploymentHandler struct {
	deployment *service.ProjectDeploymentService
	projects   *service.ProjectService
}

func NewProjectDeploymentHandler(deployment *service.ProjectDeploymentService, projects *service.ProjectService) *ProjectDeploymentHandler {
	return &ProjectDeploymentHandler{deployment: deployment, projects: projects}
}

func (h *ProjectDeploymentHandler) GetProviderStatus(c context.Context, ctx *app.RequestContext) {
	_, _, ok := h.requireProject(c, ctx)
	if !ok {
		return
	}
	h.respond(ctx, h.deployment.ProviderStatus(), nil)
}
func (h *ProjectDeploymentHandler) ListReleases(c context.Context, ctx *app.RequestContext) {
	userID, project, ok := h.requireProject(c, ctx)
	if !ok {
		return
	}
	result, err := h.deployment.ListReleases(c, userID, project.ProjectID)
	h.respond(ctx, result, err)
}
func (h *ProjectDeploymentHandler) Deploy(c context.Context, ctx *app.RequestContext) {
	userID, project, ok := h.requireProject(c, ctx)
	if !ok {
		return
	}
	var request service.DeployProjectRequest
	if err := ctx.Bind(&request); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Invalid request"})
		return
	}
	request.IdempotencyKey = deploymentIdempotencyKey(ctx, request.IdempotencyKey)
	result, err := h.deployment.Deploy(c, userID, project, request)
	h.respond(ctx, result, err)
}
func (h *ProjectDeploymentHandler) RefreshRelease(c context.Context, ctx *app.RequestContext) {
	userID, project, ok := h.requireProject(c, ctx)
	if !ok {
		return
	}
	result, err := h.deployment.RefreshRelease(c, userID, project.ProjectID, ctx.Param("release_id"))
	h.respond(ctx, result, err)
}
func (h *ProjectDeploymentHandler) ReleaseLogs(c context.Context, ctx *app.RequestContext) {
	userID, project, ok := h.requireProject(c, ctx)
	if !ok {
		return
	}
	result, err := h.deployment.ReleaseLogs(c, userID, project.ProjectID, ctx.Param("release_id"))
	h.respond(ctx, result, err)
}
func (h *ProjectDeploymentHandler) Rollback(c context.Context, ctx *app.RequestContext) {
	userID, project, ok := h.requireProject(c, ctx)
	if !ok {
		return
	}
	var request service.RollbackDeploymentRequest
	if err := ctx.Bind(&request); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Invalid request"})
		return
	}
	request.IdempotencyKey = deploymentIdempotencyKey(ctx, request.IdempotencyKey)
	result, err := h.deployment.Rollback(c, userID, project.ProjectID, request)
	h.respond(ctx, result, err)
}
func (h *ProjectDeploymentHandler) ListDomains(c context.Context, ctx *app.RequestContext) {
	userID, project, ok := h.requireProject(c, ctx)
	if !ok {
		return
	}
	result, err := h.deployment.ListDomains(c, userID, project.ProjectID)
	h.respond(ctx, result, err)
}
func (h *ProjectDeploymentHandler) AddDomain(c context.Context, ctx *app.RequestContext) {
	h.domainMutation(c, ctx, "add")
}
func (h *ProjectDeploymentHandler) VerifyDomain(c context.Context, ctx *app.RequestContext) {
	h.domainMutation(c, ctx, "verify")
}
func (h *ProjectDeploymentHandler) RemoveDomain(c context.Context, ctx *app.RequestContext) {
	h.domainMutation(c, ctx, "remove")
}

func (h *ProjectDeploymentHandler) domainMutation(c context.Context, ctx *app.RequestContext, kind string) {
	userID, project, ok := h.requireProject(c, ctx)
	if !ok {
		return
	}
	var request service.DeploymentDomainRequest
	if err := ctx.Bind(&request); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Invalid request"})
		return
	}
	request.IdempotencyKey = deploymentIdempotencyKey(ctx, request.IdempotencyKey)
	var result *service.DeploymentMutationResult
	var err error
	switch kind {
	case "add":
		result, err = h.deployment.AddDomain(c, userID, project.ProjectID, request)
	case "verify":
		result, err = h.deployment.VerifyDomain(c, userID, project.ProjectID, request)
	default:
		result, err = h.deployment.RemoveDomain(c, userID, project.ProjectID, request)
	}
	h.respond(ctx, result, err)
}

func (h *ProjectDeploymentHandler) requireProject(c context.Context, ctx *app.RequestContext) (string, *model.Project, bool) {
	userID, ok := deploymentCurrentUserID(ctx)
	if !ok {
		return "", nil, false
	}
	if h == nil || h.projects == nil || h.deployment == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"error": "Deployment service not available"})
		return "", nil, false
	}
	decision := h.projects.AuthorizeProjectAccess(c, userID, ctx.Param("id"))
	if decision.Status != service.ProjectAccessDecisionGranted || decision.Project == nil || !decision.CanManage() {
		status := consts.StatusForbidden
		if decision.Status == service.ProjectAccessDecisionProjectNotFound {
			status = consts.StatusNotFound
		}
		ctx.JSON(status, map[string]interface{}{"error": "Project access denied"})
		return "", nil, false
	}
	return userID, decision.Project, true
}

func (h *ProjectDeploymentHandler) respond(ctx *app.RequestContext, data interface{}, err error) {
	if err == nil {
		ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": data})
		return
	}
	status := consts.StatusInternalServerError
	code := "deployment_failed"
	message := "Deployment operation failed"
	var target *service.DeploymentError
	if errors.As(err, &target) {
		code = target.Code
		message = target.Message
		switch {
		case strings.Contains(code, "not_configured"), strings.Contains(code, "unavailable"):
			status = consts.StatusServiceUnavailable
		case strings.Contains(code, "forbidden"):
			status = consts.StatusForbidden
		case strings.Contains(code, "not_found"), strings.Contains(code, "missing"):
			status = consts.StatusNotFound
		case strings.Contains(code, "conflict"), strings.Contains(code, "dirty"), strings.Contains(code, "stale"), strings.Contains(code, "in_progress"), strings.Contains(code, "confirmation"), strings.Contains(code, "required"):
			status = consts.StatusConflict
		case strings.Contains(code, "invalid"), strings.Contains(code, "too_large"):
			status = consts.StatusBadRequest
		}
	}
	ctx.JSON(status, map[string]interface{}{"error": message, "code": code})
}

func deploymentCurrentUserID(ctx *app.RequestContext) (string, bool) {
	value, exists := ctx.Get("user_id")
	userID, ok := value.(string)
	if !exists || !ok || strings.TrimSpace(userID) == "" {
		ctx.JSON(consts.StatusUnauthorized, map[string]interface{}{"error": "Unauthorized"})
		return "", false
	}
	return strings.TrimSpace(userID), true
}
func deploymentIdempotencyKey(ctx *app.RequestContext, fallback string) string {
	if value := strings.TrimSpace(string(ctx.GetHeader("Idempotency-Key"))); value != "" {
		return value
	}
	return strings.TrimSpace(fallback)
}
