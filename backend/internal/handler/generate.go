// Package handler HTTP 处理器
package handler

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/internal/model"
	"yistack/internal/orchestration"
)

func toJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

type GenerateHandler struct {
	generateOrchestrator *orchestration.GenerateOrchestrator
}

func NewGenerateHandler(generateOrchestrator *orchestration.GenerateOrchestrator) *GenerateHandler {
	return &GenerateHandler{generateOrchestrator: generateOrchestrator}
}

type GenerateRequest struct {
	ProjectID         string                                  `json:"project_id"`
	Prompt            string                                  `json:"prompt"`
	ConversationStage string                                  `json:"conversation_stage"`
	PlanContext       string                                  `json:"plan_context"`
	AppType           string                                  `json:"app_type"`
	ProjectName       string                                  `json:"project_name"`
	Mode              string                                  `json:"mode"`
	Online            bool                                    `json:"online"`
	CapabilityProfile string                                  `json:"capability_profile"`
	Provider          string                                  `json:"provider"`
	Model             string                                  `json:"model"`
	Temperature       float64                                 `json:"temperature"`
	IdempotencyKey    string                                  `json:"idempotency_key"`
	BrowserAcceptance orchestration.BrowserAcceptanceContract `json:"browser_acceptance"`
}

func (h *GenerateHandler) Generate(c context.Context, ctx *app.RequestContext) {
	if string(ctx.Request.Method()) == "POST" {
		h.generate(c, ctx)
		return
	}
	ctx.JSON(consts.StatusMethodNotAllowed, map[string]any{"error": "Method not allowed"})
}

func (h *GenerateHandler) generate(c context.Context, ctx *app.RequestContext) {
	var req GenerateRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]any{"error": "Invalid request body"})
		return
	}
	req.normalize()
	userID, _ := stringContextValue(ctx, "user_id")
	if h.generateOrchestrator == nil {
		sseWriter := prepareSSEWriter(ctx)
		defer sseWriter.Close()
		_ = writeGenerateServiceUnavailable(sseWriter)
		return
	}

	command := req.toGenerateCommand(userID)
	if h.generateOrchestrator.SupportsGenerationJobs() {
		idempotencyKey := strings.TrimSpace(req.IdempotencyKey)
		if headerKey := strings.TrimSpace(string(ctx.Request.Header.Peek("Idempotency-Key"))); headerKey != "" {
			idempotencyKey = headerKey
		}
		startResult, err := h.generateOrchestrator.StartGenerationJob(c, command, idempotencyKey)
		if err != nil {
			if statusCode, payload, handled := classifyGenerateOrchestrationError(err); handled {
				respondJSONError(ctx, statusCode, payload)
				return
			}
			respondJSONError(ctx, consts.StatusInternalServerError, map[string]any{
				"error": "Failed to create generation job", "details": err.Error(),
			})
			return
		}
		ctx.Response.Header.Set("X-Generation-Job-ID", startResult.Job.ID)
		sseWriter := prepareSSEWriter(ctx)
		defer sseWriter.Close()
		cursor := generationEventCursor(ctx)
		err = h.generateOrchestrator.StreamGenerationJob(c, startResult.Job.ID, cursor, func(event model.GenerationEvent) error {
			return writeGenerationSSEEvent(sseWriter, event)
		})
		if err != nil && !errors.Is(err, context.Canceled) && !errors.Is(c.Err(), context.Canceled) {
			_ = writeSSEJSONEvent(sseWriter, "error", map[string]any{
				"code": "generation_event_replay_failed", "blocking": true,
				"message": "生成事件流读取失败", "details": err.Error(), "job_id": startResult.Job.ID,
			})
		}
		return
	}

	sseWriter := prepareSSEWriter(ctx)
	defer sseWriter.Close()
	handler := newLoggedSSEJSONEventHandler(sseWriter, "generate-sse", req.ProjectID)
	if err := h.generateOrchestrator.Generate(c, command, handler); err != nil {
		if statusCode, payload, handled := classifyGenerateOrchestrationError(err); handled {
			respondJSONError(ctx, statusCode, payload)
			return
		}
		_ = writeGenerateStreamError(sseWriter, err)
	}
}
