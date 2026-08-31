package handler

import (
	"context"
	"strconv"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/internal/service"
)

// ListCapabilityAudits GET /api/project/:id/capability-audits 获取项目能力执行审计记录。
func (h *ProjectHandler) ListCapabilityAudits(c context.Context, ctx *app.RequestContext) {
	projectID := strings.TrimSpace(ctx.Param("id"))
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Project ID is required",
		})
		return
	}

	_, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	if h.capabilityAuditService == nil {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{
			"success": false,
			"error":   "Capability execution audit service not available",
		})
		return
	}

	result, err := h.capabilityAuditService.ListByProject(c, service.CapabilityExecutionAuditListOptions{
		ProjectID:         projectID,
		Status:            strings.TrimSpace(ctx.Query("status")),
		CapabilityProfile: strings.TrimSpace(ctx.Query("capability_profile")),
		Offset:            parseNonNegativeQueryInt(ctx.Query("offset"), 0),
		Limit:             parseNonNegativeQueryInt(ctx.Query("limit"), 50),
	})
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Failed to load capability execution audits",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

func parseNonNegativeQueryInt(raw string, fallback int) int {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 0 {
		return fallback
	}
	return value
}
