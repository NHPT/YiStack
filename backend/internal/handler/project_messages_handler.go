package handler

import (
	"context"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/internal/service"
)

// GetMessages GET /api/project/:id/messages 获取项目聊天消息。
func (h *ProjectHandler) GetMessages(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	_, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	if h.projectMessageService == nil {
		ctx.JSON(consts.StatusOK, map[string]interface{}{
			"success": true,
			"data":    []interface{}{},
		})
		return
	}

	messages, err := h.projectMessageService.GetProjectMessages(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to load project messages",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    messages,
	})
}

// SaveMessages POST /api/project/:id/messages 保存项目聊天消息。
func (h *ProjectHandler) SaveMessages(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	_, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	if h.projectMessageService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{
			"error": "Project message service not available",
		})
		return
	}

	uid, ok := h.currentUserID(ctx)
	if !ok {
		return
	}

	var req struct {
		Messages []service.ProjectStoredMessage `json:"messages"`
	}
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	if err := h.projectMessageService.SaveProjectMessages(c, projectID, uid, req.Messages); err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to save project messages",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Project messages saved",
	})
}
