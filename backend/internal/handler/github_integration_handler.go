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

const githubWebhookMaxBodyBytes = 1024 * 1024

type GitHubIntegrationHandler struct {
	integration    *service.GitHubIntegrationService
	projectService *service.ProjectService
}

func NewGitHubIntegrationHandler(
	integration *service.GitHubIntegrationService,
	projectService *service.ProjectService,
) *GitHubIntegrationHandler {
	return &GitHubIntegrationHandler{integration: integration, projectService: projectService}
}

func (h *GitHubIntegrationHandler) GetConnection(c context.Context, ctx *app.RequestContext) {
	userID, ok := githubCurrentUserID(ctx)
	if !ok {
		return
	}
	result, err := h.integration.GetConnectionStatus(c, userID)
	h.respond(ctx, result, err)
}

func (h *GitHubIntegrationHandler) StartOAuth(c context.Context, ctx *app.RequestContext) {
	userID, ok := githubCurrentUserID(ctx)
	if !ok {
		return
	}
	var request struct {
		ReturnPath string `json:"return_path"`
	}
	if err := ctx.Bind(&request); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Invalid request"})
		return
	}
	result, err := h.integration.StartOAuth(c, userID, request.ReturnPath)
	h.respond(ctx, result, err)
}

func (h *GitHubIntegrationHandler) CompleteOAuth(c context.Context, ctx *app.RequestContext) {
	if oauthError := strings.TrimSpace(ctx.Query("error")); oauthError != "" {
		h.respond(ctx, nil, &service.GitHubIntegrationError{
			Code: "github_oauth_denied", Message: "GitHub OAuth authorization was denied",
		})
		return
	}
	result, err := h.integration.CompleteOAuth(c, ctx.Query("code"), ctx.Query("state"))
	h.respond(ctx, result, err)
}

func (h *GitHubIntegrationHandler) Disconnect(c context.Context, ctx *app.RequestContext) {
	userID, ok := githubCurrentUserID(ctx)
	if !ok {
		return
	}
	err := h.integration.Disconnect(c, userID)
	h.respond(ctx, map[string]interface{}{"disconnected": err == nil}, err)
}

func (h *GitHubIntegrationHandler) ListRepositories(c context.Context, ctx *app.RequestContext) {
	userID, ok := githubCurrentUserID(ctx)
	if !ok {
		return
	}
	result, err := h.integration.ListRepositories(c, userID)
	h.respond(ctx, result, err)
}

func (h *GitHubIntegrationHandler) GetProjectBinding(c context.Context, ctx *app.RequestContext) {
	userID, project, ok := h.requireOwnedProject(c, ctx)
	if !ok {
		return
	}
	result, err := h.integration.GetProjectBinding(c, userID, project.ProjectID)
	h.respond(ctx, result, err)
}

func (h *GitHubIntegrationHandler) ImportRepository(c context.Context, ctx *app.RequestContext) {
	userID, project, ok := h.requireOwnedProject(c, ctx)
	if !ok {
		return
	}
	var request service.GitHubImportRequest
	if err := ctx.Bind(&request); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Invalid request"})
		return
	}
	request.IdempotencyKey = githubIdempotencyKey(ctx, request.IdempotencyKey)
	result, err := h.integration.ImportRepository(c, userID, project, request)
	h.respond(ctx, result, err)
}

func (h *GitHubIntegrationHandler) PullRepository(c context.Context, ctx *app.RequestContext) {
	userID, project, ok := h.requireOwnedProject(c, ctx)
	if !ok {
		return
	}
	var request service.GitHubPullRequest
	if err := ctx.Bind(&request); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Invalid request"})
		return
	}
	request.IdempotencyKey = githubIdempotencyKey(ctx, request.IdempotencyKey)
	result, err := h.integration.PullRepository(c, userID, project, request)
	h.respond(ctx, result, err)
}

func (h *GitHubIntegrationHandler) PushRepository(c context.Context, ctx *app.RequestContext) {
	userID, project, ok := h.requireOwnedProject(c, ctx)
	if !ok {
		return
	}
	var request service.GitHubPushRequest
	if err := ctx.Bind(&request); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Invalid request"})
		return
	}
	request.IdempotencyKey = githubIdempotencyKey(ctx, request.IdempotencyKey)
	result, err := h.integration.PushRepository(c, userID, project, request)
	h.respond(ctx, result, err)
}

func (h *GitHubIntegrationHandler) Webhook(c context.Context, ctx *app.RequestContext) {
	body := ctx.Request.Body()
	if len(body) > githubWebhookMaxBodyBytes {
		ctx.JSON(consts.StatusRequestEntityTooLarge, map[string]interface{}{"error": "GitHub webhook payload is too large"})
		return
	}
	result, err := h.integration.ProcessWebhook(
		c,
		string(ctx.GetHeader("X-GitHub-Delivery")),
		string(ctx.GetHeader("X-GitHub-Event")),
		string(ctx.GetHeader("X-Hub-Signature-256")),
		body,
	)
	h.respond(ctx, result, err)
}

func (h *GitHubIntegrationHandler) requireOwnedProject(
	c context.Context,
	ctx *app.RequestContext,
) (string, *model.Project, bool) {
	userID, ok := githubCurrentUserID(ctx)
	if !ok {
		return "", nil, false
	}
	if h == nil || h.projectService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"error": "Project service not available"})
		return "", nil, false
	}
	decision := h.projectService.AuthorizeProjectAccess(c, userID, ctx.Param("id"))
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

func (h *GitHubIntegrationHandler) respond(ctx *app.RequestContext, data interface{}, err error) {
	if err == nil {
		ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": data})
		return
	}
	status := consts.StatusInternalServerError
	code := "github_integration_failed"
	message := "GitHub integration failed"
	var integrationErr *service.GitHubIntegrationError
	if errors.As(err, &integrationErr) {
		code = integrationErr.Code
		message = integrationErr.Message
		switch {
		case strings.Contains(code, "not_configured"), strings.Contains(code, "unavailable"):
			status = consts.StatusServiceUnavailable
		case strings.Contains(code, "forbidden"):
			status = consts.StatusForbidden
		case strings.Contains(code, "not_connected"), strings.Contains(code, "not_bound"):
			status = consts.StatusNotFound
		case strings.Contains(code, "conflict"), strings.Contains(code, "dirty"),
			strings.Contains(code, "diverged"), strings.Contains(code, "ahead"),
			strings.Contains(code, "stale"), strings.Contains(code, "in_progress"),
			strings.Contains(code, "confirmation"):
			status = consts.StatusConflict
		case strings.Contains(code, "invalid"), strings.Contains(code, "required"),
			strings.Contains(code, "denied"):
			status = consts.StatusBadRequest
		}
	}
	ctx.JSON(status, map[string]interface{}{"error": message, "code": code})
}

func githubCurrentUserID(ctx *app.RequestContext) (string, bool) {
	value, exists := ctx.Get("user_id")
	userID, ok := value.(string)
	if !exists || !ok || strings.TrimSpace(userID) == "" {
		ctx.JSON(consts.StatusUnauthorized, map[string]interface{}{"error": "Unauthorized"})
		return "", false
	}
	return strings.TrimSpace(userID), true
}

func githubIdempotencyKey(ctx *app.RequestContext, fallback string) string {
	if value := strings.TrimSpace(string(ctx.GetHeader("Idempotency-Key"))); value != "" {
		return value
	}
	return strings.TrimSpace(fallback)
}
