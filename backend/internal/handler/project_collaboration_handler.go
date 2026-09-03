package handler

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/internal/model"
	"yistack/internal/service"
)

type ProjectCollaborationHandler struct {
	collaboration *service.ProjectCollaborationService
	projects      *service.ProjectService
}

func NewProjectCollaborationHandler(collaboration *service.ProjectCollaborationService, projects *service.ProjectService) *ProjectCollaborationHandler {
	return &ProjectCollaborationHandler{collaboration: collaboration, projects: projects}
}

type memberMutationPayload struct {
	Email   string `json:"email"`
	UserID  string `json:"user_id"`
	Role    string `json:"role"`
	Confirm bool   `json:"confirm"`
}
type removeMemberPayload struct {
	UserID  string `json:"user_id"`
	Confirm bool   `json:"confirm"`
}
type collaborationPresencePayload struct {
	ClientID      string `json:"client_id"`
	Activity      string `json:"activity"`
	CurrentFile   string `json:"current_file"`
	AfterSequence int64  `json:"after_sequence"`
}
type createFromTemplatePayload struct {
	Slug        string `json:"slug"`
	VersionID   string `json:"version_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Confirm     bool   `json:"confirm"`
}
type publishTemplatePayload struct {
	Slug                     string                         `json:"slug"`
	Name                     string                         `json:"name"`
	Description              string                         `json:"description"`
	AppType                  string                         `json:"app_type"`
	ExpectedCurrentVersionID string                         `json:"expected_current_version_id"`
	Files                    []service.OfficialTemplateFile `json:"files"`
	Confirm                  bool                           `json:"confirm"`
}
type rollbackTemplatePayload struct {
	TargetVersionID          string `json:"target_version_id"`
	ExpectedCurrentVersionID string `json:"expected_current_version_id"`
	Confirm                  bool   `json:"confirm"`
}

func (h *ProjectCollaborationHandler) GetAccess(c context.Context, ctx *app.RequestContext) {
	userID, project, ok := h.requireReadable(c, ctx)
	if !ok {
		return
	}
	access, err := h.collaboration.Access(c, userID, project)
	h.respond(ctx, access, err)
}
func (h *ProjectCollaborationHandler) ListMembers(c context.Context, ctx *app.RequestContext) {
	userID, ok := collaborationUserID(ctx)
	if !ok {
		return
	}
	result, err := h.collaboration.ListMembers(c, userID, ctx.Param("id"))
	h.respond(ctx, result, err)
}
func (h *ProjectCollaborationHandler) AddOrUpdateMember(c context.Context, ctx *app.RequestContext) {
	userID, ok := collaborationUserID(ctx)
	if !ok {
		return
	}
	var payload memberMutationPayload
	if err := ctx.Bind(&payload); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Invalid request"})
		return
	}
	result, err := h.collaboration.AddOrUpdateMember(c, userID, ctx.Param("id"), service.ProjectMemberMutationRequest{Email: payload.Email, UserID: payload.UserID, Role: payload.Role, Confirm: payload.Confirm})
	h.respond(ctx, result, err)
}
func (h *ProjectCollaborationHandler) RemoveMember(c context.Context, ctx *app.RequestContext) {
	userID, ok := collaborationUserID(ctx)
	if !ok {
		return
	}
	var payload removeMemberPayload
	if err := ctx.Bind(&payload); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Invalid request"})
		return
	}
	err := h.collaboration.RemoveMember(c, userID, ctx.Param("id"), strings.TrimSpace(payload.UserID), payload.Confirm)
	h.respond(ctx, map[string]interface{}{"removed": err == nil}, err)
}
func (h *ProjectCollaborationHandler) ListAudits(c context.Context, ctx *app.RequestContext) {
	userID, ok := collaborationUserID(ctx)
	if !ok {
		return
	}
	result, err := h.collaboration.ListAudits(c, userID, ctx.Param("id"))
	h.respond(ctx, result, err)
}
func (h *ProjectCollaborationHandler) GetCollaborationState(c context.Context, ctx *app.RequestContext) {
	userID, ok := collaborationUserID(ctx)
	if !ok {
		return
	}
	result, err := h.collaboration.Snapshot(c, userID, ctx.Param("id"), strings.TrimSpace(ctx.Query("session_id")), generationEventCursor(ctx))
	h.respond(ctx, result, err)
}
func (h *ProjectCollaborationHandler) TouchCollaborationPresence(c context.Context, ctx *app.RequestContext) {
	userID, ok := collaborationUserID(ctx)
	if !ok {
		return
	}
	var payload collaborationPresencePayload
	if err := ctx.Bind(&payload); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Invalid request"})
		return
	}
	result, err := h.collaboration.TouchPresence(c, userID, ctx.Param("id"), service.ProjectCollaborationPresenceRequest{
		ClientID: payload.ClientID, Activity: payload.Activity, CurrentFile: payload.CurrentFile, AfterSequence: payload.AfterSequence,
	})
	h.respond(ctx, result, err)
}
func (h *ProjectCollaborationHandler) LeaveCollaborationPresence(c context.Context, ctx *app.RequestContext) {
	userID, ok := collaborationUserID(ctx)
	if !ok {
		return
	}
	var payload collaborationPresencePayload
	if err := ctx.Bind(&payload); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Invalid request"})
		return
	}
	err := h.collaboration.LeavePresence(c, userID, ctx.Param("id"), payload.ClientID)
	h.respond(ctx, map[string]interface{}{"left": err == nil}, err)
}
func (h *ProjectCollaborationHandler) StreamCollaborationEvents(c context.Context, ctx *app.RequestContext) {
	userID, ok := collaborationUserID(ctx)
	if !ok {
		return
	}
	projectID := strings.TrimSpace(ctx.Param("id"))
	if _, _, ok := h.requireReadable(c, ctx); !ok {
		return
	}
	cursor := generationEventCursor(ctx)
	writer := prepareSSEWriter(ctx)
	defer writer.Close()
	keepAliveAt := time.Now()
	for {
		events, err := h.collaboration.Events(c, userID, projectID, cursor)
		if err != nil {
			_ = writer.WriteEvent(strconv.FormatInt(cursor, 10), "collaboration_error", []byte(toJSON(map[string]interface{}{
				"code": "collaboration_event_replay_failed", "message": err.Error(),
			})))
			return
		}
		for _, event := range events {
			if event.Sequence <= cursor {
				continue
			}
			if err := writer.WriteEvent(strconv.FormatInt(event.Sequence, 10), event.EventType, []byte(toJSON(event))); err != nil {
				return
			}
			cursor = event.Sequence
			keepAliveAt = time.Now()
		}
		if time.Since(keepAliveAt) >= 15*time.Second {
			if err := writer.WriteEvent(strconv.FormatInt(cursor, 10), "collaboration_heartbeat", []byte(toJSON(map[string]interface{}{
				"schema_version": service.ProjectCollaborationSchemaVersion,
				"project_id":     projectID,
				"cursor":         cursor,
			}))); err != nil {
				return
			}
			keepAliveAt = time.Now()
		}
		select {
		case <-c.Done():
			return
		case <-time.After(time.Second):
		}
	}
}
func (h *ProjectCollaborationHandler) ListTemplates(c context.Context, ctx *app.RequestContext) {
	result, err := h.collaboration.ListOfficialTemplates(c)
	h.respond(ctx, result, err)
}
func (h *ProjectCollaborationHandler) ListAdminTemplates(c context.Context, ctx *app.RequestContext) {
	if _, ok := collaborationAdminID(ctx); !ok {
		return
	}
	result, err := h.collaboration.ListOfficialTemplates(c)
	h.respond(ctx, result, err)
}
func (h *ProjectCollaborationHandler) ListTemplateVersions(c context.Context, ctx *app.RequestContext) {
	result, err := h.collaboration.ListTemplateVersions(c, ctx.Param("template_id"))
	h.respond(ctx, result, err)
}
func (h *ProjectCollaborationHandler) CreateFromTemplate(c context.Context, ctx *app.RequestContext) {
	userID, ok := collaborationUserID(ctx)
	if !ok {
		return
	}
	var payload createFromTemplatePayload
	if err := ctx.Bind(&payload); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Invalid request"})
		return
	}
	result, err := h.collaboration.CreateProjectFromTemplate(c, userID, service.CreateProjectFromTemplateRequest{Slug: payload.Slug, VersionID: payload.VersionID, Name: payload.Name, Description: payload.Description, Confirm: payload.Confirm})
	h.respond(ctx, result, err)
}
func (h *ProjectCollaborationHandler) PublishTemplate(c context.Context, ctx *app.RequestContext) {
	adminID, ok := collaborationAdminID(ctx)
	if !ok {
		return
	}
	var payload publishTemplatePayload
	if err := ctx.Bind(&payload); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Invalid request"})
		return
	}
	result, err := h.collaboration.PublishTemplate(c, adminID, service.PublishOfficialTemplateRequest{Slug: payload.Slug, Name: payload.Name, Description: payload.Description, AppType: payload.AppType, ExpectedCurrentVersionID: payload.ExpectedCurrentVersionID, Files: payload.Files, Confirm: payload.Confirm})
	h.respond(ctx, result, err)
}
func (h *ProjectCollaborationHandler) RollbackTemplate(c context.Context, ctx *app.RequestContext) {
	adminID, ok := collaborationAdminID(ctx)
	if !ok {
		return
	}
	var payload rollbackTemplatePayload
	if err := ctx.Bind(&payload); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Invalid request"})
		return
	}
	result, err := h.collaboration.RollbackTemplate(c, adminID, ctx.Param("template_id"), service.RollbackOfficialTemplateRequest{TargetVersionID: payload.TargetVersionID, ExpectedCurrentVersionID: payload.ExpectedCurrentVersionID, Confirm: payload.Confirm})
	h.respond(ctx, result, err)
}
func (h *ProjectCollaborationHandler) requireReadable(c context.Context, ctx *app.RequestContext) (string, *model.Project, bool) {
	userID, ok := collaborationUserID(ctx)
	if !ok {
		return "", nil, false
	}
	if h == nil || h.projects == nil || h.collaboration == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"error": "Collaboration service not available"})
		return "", nil, false
	}
	decision := h.projects.AuthorizeProjectAccess(c, userID, ctx.Param("id"))
	if !decision.CanRead() {
		ctx.JSON(consts.StatusForbidden, map[string]interface{}{"error": "Project access denied"})
		return "", nil, false
	}
	return userID, decision.Project, true
}
func (h *ProjectCollaborationHandler) respond(ctx *app.RequestContext, data interface{}, err error) {
	if err == nil {
		ctx.JSON(consts.StatusOK, map[string]interface{}{"success": true, "data": data})
		return
	}
	status := consts.StatusInternalServerError
	code := "collaboration_failed"
	message := "Collaboration operation failed"
	var target *service.ProjectCollaborationError
	if errors.As(err, &target) {
		code = target.Code
		message = target.Message
		switch {
		case strings.Contains(code, "required"), strings.Contains(code, "conflict"):
			status = consts.StatusConflict
		case strings.Contains(code, "not_found"):
			status = consts.StatusNotFound
		case strings.Contains(code, "owner"), strings.Contains(code, "forbidden"):
			status = consts.StatusForbidden
		case strings.Contains(code, "invalid"), strings.Contains(code, "too_large"):
			status = consts.StatusBadRequest
		case strings.Contains(code, "unavailable"):
			status = consts.StatusServiceUnavailable
		}
	}
	ctx.JSON(status, map[string]interface{}{"error": message, "code": code})
}
func collaborationUserID(ctx *app.RequestContext) (string, bool) {
	value, exists := ctx.Get("user_id")
	id, ok := value.(string)
	if !exists || !ok || strings.TrimSpace(id) == "" {
		ctx.JSON(consts.StatusUnauthorized, map[string]interface{}{"error": "Unauthorized"})
		return "", false
	}
	return strings.TrimSpace(id), true
}
func collaborationAdminID(ctx *app.RequestContext) (string, bool) {
	value, exists := ctx.Get("admin_id")
	id, ok := value.(string)
	roleValue, _ := ctx.Get("role")
	role, _ := roleValue.(string)
	if !exists || !ok || strings.TrimSpace(id) == "" || role != "super_admin" {
		ctx.JSON(consts.StatusForbidden, map[string]interface{}{"error": "super admin required"})
		return "", false
	}
	return strings.TrimSpace(id), true
}
