package handler

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/internal/model"
	"yistack/internal/service"
)

// StartContainer POST /api/project/:id/start 启动项目容器。
func (h *ProjectHandler) StartContainer(c context.Context, ctx *app.RequestContext) {
	defer func() {
		if recovered := recover(); recovered != nil {
			log.Printf("[PANIC] start container %s: %v", ctx.Param("id"), recovered)
			ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
				"error":   "Failed to start container",
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

	status, err := projectService.StartProjectContainerAsync(c, projectID)
	if err != nil {
		statusCode := classifyContainerStartStatus(err)
		ctx.JSON(statusCode, map[string]interface{}{
			"error":   "Failed to start container",
			"details": err.Error(),
		})
		return
	}

	httpStatus := consts.StatusAccepted
	if status != nil && (status.Status == "ready" || status.Status == "failed") {
		httpStatus = consts.StatusOK
	}
	ctx.JSON(httpStatus, map[string]interface{}{
		"success": true,
		"message": "Container start accepted",
		"data":    status,
	})
}

// GetRuntimeStatus GET /api/project/:id/runtime-status 获取项目开发运行时状态。
func (h *ProjectHandler) GetRuntimeStatus(c context.Context, ctx *app.RequestContext) {
	defer func() {
		if recovered := recover(); recovered != nil {
			log.Printf("[PANIC] get runtime status %s: %v", ctx.Param("id"), recovered)
			projectID := ctx.Param("id")
			ctx.JSON(consts.StatusOK, map[string]interface{}{
				"success": true,
				"data": map[string]interface{}{
					"projectId":       projectID,
					"status":          "failed",
					"containerStatus": "unknown",
					"phase":           "status",
					"message":         "获取运行时状态失败",
					"error":           fmt.Sprintf("internal server panic: %v", recovered),
				},
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

	projectService, project, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}
	projectService.TouchProjectRuntimeActivity(c, project, "runtime_status")

	status, err := projectService.GetProjectRuntimeStatusForProject(c, project)
	if err != nil {
		ctx.JSON(consts.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"projectId":       projectID,
				"status":          "failed",
				"containerStatus": "unknown",
				"phase":           "status",
				"message":         "获取运行时状态失败",
				"error":           err.Error(),
			},
		})
		return
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    status,
	})
}

// GetResourceSnapshot GET /api/project/:id/resource-snapshot 获取项目运行时资源只读快照。
func (h *ProjectHandler) GetResourceSnapshot(c context.Context, ctx *app.RequestContext) {
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

	result, err := projectService.GetProjectResourceSnapshot(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to get project resource snapshot",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GetResourceAlertReadiness GET /api/project/:id/resource-alert-readiness 获取项目资源告警策略只读就绪度。
func (h *ProjectHandler) GetResourceAlertReadiness(c context.Context, ctx *app.RequestContext) {
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

	result, err := projectService.GetProjectResourceAlertReadiness(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to get project resource alert readiness",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GetResourceAlertEvaluationPreview GET /api/project/:id/resource-alert-evaluation-preview 获取项目资源告警评估只读预览。
func (h *ProjectHandler) GetResourceAlertEvaluationPreview(c context.Context, ctx *app.RequestContext) {
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

	result, err := projectService.GetProjectResourceAlertEvaluationPreview(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to get project resource alert evaluation preview",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// CreateResourceAlertEvent POST /api/project/:id/resource-alert-events/create 受控创建项目资源告警事件。
func (h *ProjectHandler) CreateResourceAlertEvent(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req projectResourceAlertEventCreateRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	projectService, project, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.CreateProjectResourceAlertEvent(c, projectID, project.UserID, req.ConfirmCreate)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to create project resource alert event",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// ListResourceAlertEvents GET /api/project/:id/resource-alert-events 只读查询项目资源告警事件。
func (h *ProjectHandler) ListResourceAlertEvents(c context.Context, ctx *app.RequestContext) {
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

	result, err := projectService.ListProjectResourceAlertEvents(
		c,
		projectID,
		strings.TrimSpace(ctx.Query("status")),
		parseNonNegativeQueryInt(ctx.Query("offset"), 0),
		parseNonNegativeQueryInt(ctx.Query("limit"), 20),
	)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to list project resource alert events",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GetResourceAlertNotificationReadiness GET /api/project/:id/resource-alert-notification-readiness 获取项目资源告警通知通道只读就绪度。
func (h *ProjectHandler) GetResourceAlertNotificationReadiness(c context.Context, ctx *app.RequestContext) {
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

	result, err := projectService.GetProjectResourceAlertNotificationReadiness(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to get project resource alert notification readiness",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// SendResourceAlertNotification POST /api/project/:id/resource-alert-notification/send 受控发送项目资源告警通知。
func (h *ProjectHandler) SendResourceAlertNotification(c context.Context, ctx *app.RequestContext) {
	projectID := strings.TrimSpace(ctx.Param("id"))
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req projectResourceAlertNotificationSendRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	projectService, project, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.SendProjectResourceAlertNotification(c, projectID, project.UserID, req.ConfirmSend)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to send project resource alert notification",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GetResourceAlertEnforcementReadiness GET /api/project/:id/resource-alert-enforcement-readiness 获取项目资源告警硬配额执行只读就绪度。
func (h *ProjectHandler) GetResourceAlertEnforcementReadiness(c context.Context, ctx *app.RequestContext) {
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

	result, err := projectService.GetProjectResourceAlertEnforcementReadiness(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to get project resource alert enforcement readiness",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// ExecuteResourceAlertEnforcement POST /api/project/:id/resource-alert-enforcement/execute 受控执行项目资源告警硬配额动作。
func (h *ProjectHandler) ExecuteResourceAlertEnforcement(c context.Context, ctx *app.RequestContext) {
	projectID := strings.TrimSpace(ctx.Param("id"))
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req projectResourceAlertEnforcementExecuteRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	projectService, project, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.ExecuteProjectResourceAlertEnforcement(c, projectID, project.UserID, req.ConfirmExecute)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to execute project resource alert enforcement",
			"details": err.Error(),
			"data":    result,
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// TouchRuntimeActivity POST /api/project/:id/runtime-activity 刷新运行时活动时间。
func (h *ProjectHandler) TouchRuntimeActivity(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	projectService, project, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	status := projectService.TouchProjectRuntimeActivity(c, project, "runtime_activity_api")
	httpStatus := consts.StatusOK
	if status.ActivityStatus == "failed" || status.ActivityStatus == "inspect_failed" {
		httpStatus = consts.StatusServiceUnavailable
	}
	ctx.JSON(httpStatus, map[string]interface{}{
		"success": status.ActivityStatus != "failed" && status.ActivityStatus != "inspect_failed",
		"data":    status,
	})
}

// StopContainer POST /api/project/:id/stop 停止项目容器。
func (h *ProjectHandler) StopContainer(c context.Context, ctx *app.RequestContext) {
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

	result, err := projectService.StopProjectContainer(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to stop container",
			"details": err.Error(),
			"data":    result,
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Container stopped",
		"data":    result,
	})
}

// StopGeneration POST /api/project/:id/generation/stop 停止当前项目生成任务。
func (h *ProjectHandler) StopGeneration(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Project ID is required"})
		return
	}
	_, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	stopped := false
	if h.generateOrchestrator != nil && h.generateOrchestrator.SupportsGenerationJobs() {
		var err error
		stopped, err = h.generateOrchestrator.StopGenerationJob(c, projectID)
		if err != nil && !strings.Contains(strings.ToLower(err.Error()), "not found") {
			ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"error": "Failed to stop generation job", "details": err.Error()})
			return
		}
	} else if h.generateOrchestrator != nil {
		stopped = h.generateOrchestrator.StopGeneration(context.Background(), projectID)
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true, "message": "Generation stop requested", "generation_stopped": stopped,
	})
}

// GetGenerationStatus returns the durable latest Job summary.
func (h *ProjectHandler) GetGenerationStatus(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Project ID is required"})
		return
	}
	_, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	active := false
	var jobPayload any
	if h.generateOrchestrator != nil && h.generateOrchestrator.SupportsGenerationJobs() {
		job, err := h.generateOrchestrator.LatestGenerationJob(c, projectID)
		if err == nil && job != nil {
			active = service.IsGenerationJobActiveStatus(job.Status)
			jobPayload = generationJobResponse(job)
		} else if err != nil && !strings.Contains(strings.ToLower(err.Error()), "not found") {
			ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{"error": "Failed to read generation job", "details": err.Error()})
			return
		}
	} else if h.generateOrchestrator != nil {
		active = h.generateOrchestrator.IsGenerationActive(projectID)
	}
	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true, "project_id": projectID, "generation_active": active, "generation_job": jobPayload,
	})
}

// GetGenerationEvents replays persisted events and follows the active Job until terminal.
func (h *ProjectHandler) GetGenerationEvents(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{"error": "Project ID is required"})
		return
	}
	_, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}
	if h.generateOrchestrator == nil || !h.generateOrchestrator.SupportsGenerationJobs() {
		ctx.JSON(consts.StatusServiceUnavailable, map[string]interface{}{"error": "Generation job service not available"})
		return
	}
	jobID := strings.TrimSpace(ctx.Query("job_id"))
	var job *model.GenerationJob
	var err error
	if jobID == "" {
		job, err = h.generateOrchestrator.LatestGenerationJob(c, projectID)
	} else {
		job, err = h.generateOrchestrator.GenerationJob(c, jobID)
	}
	if err != nil || job == nil {
		ctx.JSON(consts.StatusNotFound, map[string]interface{}{"error": "Generation job not found"})
		return
	}
	if job.ProjectID != projectID {
		ctx.JSON(consts.StatusForbidden, map[string]interface{}{"error": "Generation job does not belong to project"})
		return
	}

	sseWriter := prepareSSEWriter(ctx)
	defer sseWriter.Close()
	if err := h.generateOrchestrator.StreamGenerationJob(c, job.ID, generationEventCursor(ctx), func(event model.GenerationEvent) error {
		return writeGenerationSSEEvent(sseWriter, event)
	}); err != nil && !errors.Is(err, context.Canceled) && !errors.Is(c.Err(), context.Canceled) {
		_ = writeSSEJSONEvent(sseWriter, service.StreamEventError, map[string]any{
			"code": "generation_event_replay_failed", "blocking": true,
			"message": "生成事件回放失败", "details": err.Error(), "job_id": job.ID,
		})
	}
}

func generationJobResponse(job *model.GenerationJob) map[string]interface{} {
	if job == nil {
		return nil
	}
	return map[string]interface{}{
		"id": job.ID, "project_id": job.ProjectID, "idempotency_key": job.IdempotencyKey, "status": job.Status,
		"workflow_stage": job.WorkflowStage, "workflow_mode": job.WorkflowMode,
		"provider": job.Provider, "model": job.Model, "current_attempt": job.CurrentAttempt,
		"last_event_sequence": job.EventSequence, "error_code": job.ErrorCode,
		"error_message": job.ErrorMessage, "stop_reason": job.StopReason,
		"created_at": job.CreatedAt, "updated_at": job.UpdatedAt,
		"started_at": job.StartedAt, "completed_at": job.CompletedAt,
	}
}

// ExecuteCommandRequest 执行命令请求。
type ExecuteCommandRequest struct {
	Command string `json:"command"`
}

type CreateTerminalSessionRequest struct {
	Rows int `json:"rows"`
	Cols int `json:"cols"`
}

type TerminalInputRequest struct {
	Input string `json:"input"`
}

type TerminalResizeRequest struct {
	Rows int `json:"rows"`
	Cols int `json:"cols"`
}

type projectResourceAlertEventCreateRequest struct {
	ConfirmCreate bool `json:"confirm_create"`
}

type projectResourceAlertNotificationSendRequest struct {
	ConfirmSend bool `json:"confirm_send"`
}

type projectResourceAlertEnforcementExecuteRequest struct {
	ConfirmExecute bool `json:"confirm_execute"`
}

// ExecuteCommand POST /api/project/:id/exec 在容器中执行命令。
func (h *ProjectHandler) ExecuteCommand(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req ExecuteCommandRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	if req.Command == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Command is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.ExecuteInContainer(c, projectID, req.Command)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to execute command",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

func (h *ProjectHandler) CreateTerminalSession(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req CreateTerminalSessionRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	session, err := projectService.CreateTerminalSession(c, projectID, req.Rows, req.Cols)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to create terminal session",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    session,
	})
}

func (h *ProjectHandler) GetTerminalOutput(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	sessionID := ctx.Param("sessionId")
	if projectID == "" || sessionID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID and session ID are required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	cursorText := string(ctx.Query("cursor"))
	var cursor int64
	if cursorText != "" {
		parsed, err := strconv.ParseInt(cursorText, 10, 64)
		if err != nil {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
				"error": "Invalid cursor",
			})
			return
		}
		cursor = parsed
	}

	output, err := projectService.ReadTerminalOutput(c, projectID, sessionID, cursor)
	if err != nil {
		ctx.JSON(consts.StatusNotFound, map[string]interface{}{
			"error":   "Failed to read terminal output",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    output,
	})
}

func (h *ProjectHandler) SendTerminalInput(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	sessionID := ctx.Param("sessionId")
	if projectID == "" || sessionID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID and session ID are required",
		})
		return
	}

	var req TerminalInputRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	if err := projectService.SendTerminalInput(c, projectID, sessionID, req.Input); err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to send terminal input",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
	})
}

func (h *ProjectHandler) ResizeTerminalSession(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	sessionID := ctx.Param("sessionId")
	if projectID == "" || sessionID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID and session ID are required",
		})
		return
	}

	var req TerminalResizeRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	if err := projectService.ResizeTerminalSession(c, projectID, sessionID, req.Rows, req.Cols); err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to resize terminal session",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
	})
}

func (h *ProjectHandler) CloseTerminalSession(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	sessionID := ctx.Param("sessionId")
	if projectID == "" || sessionID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID and session ID are required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	if err := projectService.CloseTerminalSession(c, projectID, sessionID); err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to close terminal session",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
	})
}
