package handler

import (
	"context"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/internal/model"
)

// GeneratePlansRequest 生成方案请求。
type GeneratePlansRequest struct {
	Description  string       `json:"description"`
	AppType      string       `json:"app_type"`
	Language     string       `json:"language"`
	ProjectID    string       `json:"project_id"`
	Provider     string       `json:"provider"`
	UserFeedback string       `json:"user_feedback"`
	CurrentPlans []model.Plan `json:"current_plans"`
}

// GeneratePlans POST /api/project/plans 生成技术方案。
func (h *ProjectHandler) GeneratePlans(c context.Context, ctx *app.RequestContext) {
	var req GeneratePlansRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	req.normalize()

	uid, _ := stringContextValue(ctx, "user_id")

	command := req.toGeneratePlansCommand(uid)

	sseWriter := prepareSSEWriter(ctx)
	defer sseWriter.Close()

	eventHandler := newSSEJSONEventHandler(sseWriter)

	resp, analysis, err := h.planOrchestrator.GeneratePlansStream(c, command, eventHandler)
	if err != nil {
		if statusCode, payload, handled := classifyPlanOrchestrationError(err); handled {
			respondJSONError(ctx, statusCode, payload)
			return
		}
		_ = writeGeneratePlansStreamError(sseWriter, err)
		return
	}

	_ = writeGeneratePlansDone(sseWriter, resp, analysis)
}
