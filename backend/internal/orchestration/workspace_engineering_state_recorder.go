package orchestration

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"yistack/internal/model"
	"yistack/internal/service"
)

type engineeringStateRecordParams struct {
	ProjectID string
	UserID    string
	Model     string
	State     EngineeringState
	Step      map[string]interface{}
	Content   string
}

type workflowStepRecordParams struct {
	ProjectID     string
	UserID        string
	Model         string
	WorkflowStage string
	WorkflowMode  string
	Step          map[string]interface{}
}

// EngineeringStateRecorder 负责将最小工程状态回写到可查询位置。
type EngineeringStateRecorder interface {
	RecordEngineeringState(ctx context.Context, params engineeringStateRecordParams) error
	RecordValidationState(ctx context.Context, params engineeringStateRecordParams) error
}

// WorkflowStepRecorder 负责将生成阶段 step 事件追加为可恢复 workflow 消息。
type WorkflowStepRecorder interface {
	RecordWorkflowStep(ctx context.Context, params workflowStepRecordParams) error
}

// ChatMessageEngineeringStateRecorder 通过 chat_messages 落地 workflow 状态消息。
type ChatMessageEngineeringStateRecorder struct {
	chatRepo             service.ChatMessageRepo
	engineeringStateRepo service.EngineeringStateRepo
}

// NewChatMessageEngineeringStateRecorder 创建状态消息 recorder。
func NewChatMessageEngineeringStateRecorder(chatRepo service.ChatMessageRepo, engineeringStateRepos ...service.EngineeringStateRepo) *ChatMessageEngineeringStateRecorder {
	var engineeringStateRepo service.EngineeringStateRepo
	if len(engineeringStateRepos) > 0 {
		engineeringStateRepo = engineeringStateRepos[0]
	}
	return &ChatMessageEngineeringStateRecorder{
		chatRepo:             chatRepo,
		engineeringStateRepo: engineeringStateRepo,
	}
}

func (r *ChatMessageEngineeringStateRecorder) RecordEngineeringState(ctx context.Context, params engineeringStateRecordParams) error {
	if r == nil || strings.TrimSpace(params.ProjectID) == "" || (r.chatRepo == nil && r.engineeringStateRepo == nil) {
		return nil
	}

	statePayload := engineeringStatePayload(params.State)
	contentText := firstNonEmpty(strings.TrimSpace(params.Content), "工程状态已更新。")
	payload := map[string]interface{}{
		"kind":             "workflow",
		"content":          contentText,
		"statusContent":    buildEngineeringStatusContent(params.State),
		"engineeringState": statePayload,
		"workflowSteps":    []map[string]interface{}{params.Step},
		"streaming":        false,
	}

	content, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	persistCtx := ctx
	if persistCtx == nil {
		var cancel context.CancelFunc
		persistCtx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
	}

	if r.chatRepo != nil {
		if err := r.chatRepo.Create(persistCtx, &model.ChatMessage{
			ProjectID: params.ProjectID,
			UserID:    params.UserID,
			Role:      "assistant",
			Content:   string(content),
			Model:     strings.TrimSpace(params.Model),
		}); err != nil {
			return err
		}
	}

	return r.recordProjectEngineeringState(persistCtx, params, statePayload, contentText)
}

func (r *ChatMessageEngineeringStateRecorder) RecordValidationState(ctx context.Context, params engineeringStateRecordParams) error {
	return r.RecordEngineeringState(ctx, params)
}

func (r *ChatMessageEngineeringStateRecorder) RecordWorkflowStep(ctx context.Context, params workflowStepRecordParams) error {
	if r == nil || r.chatRepo == nil || strings.TrimSpace(params.ProjectID) == "" || len(params.Step) == 0 {
		return nil
	}

	step := normalizeRecordedWorkflowStep(params.Step, params.WorkflowStage, params.WorkflowMode)
	contentText := recordedWorkflowStepContent(step)
	payload := map[string]interface{}{
		"kind":          "workflow",
		"content":       contentText,
		"statusContent": recordedWorkflowStepStatusContent(step),
		"workflowSteps": []map[string]interface{}{step},
		"streaming":     false,
	}

	if state, ok := step["engineeringState"].(map[string]interface{}); ok && len(state) > 0 {
		payload["engineeringState"] = state
	}

	content, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	persistCtx := ctx
	if persistCtx == nil {
		var cancel context.CancelFunc
		persistCtx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
	}

	return r.chatRepo.Create(persistCtx, &model.ChatMessage{
		ProjectID: strings.TrimSpace(params.ProjectID),
		UserID:    strings.TrimSpace(params.UserID),
		Role:      "assistant",
		Content:   string(content),
		Model:     strings.TrimSpace(params.Model),
	})
}

func (r *ChatMessageEngineeringStateRecorder) recordProjectEngineeringState(ctx context.Context, params engineeringStateRecordParams, statePayload map[string]interface{}, content string) error {
	if r == nil || r.engineeringStateRepo == nil {
		return nil
	}

	stateContent, err := json.Marshal(statePayload)
	if err != nil {
		return err
	}

	return r.engineeringStateRepo.UpsertSnapshot(ctx, &model.ProjectEngineeringState{
		ProjectID:      strings.TrimSpace(params.ProjectID),
		UserID:         strings.TrimSpace(params.UserID),
		WorkflowStage:  strings.TrimSpace(params.State.Workflow.Stage),
		WorkflowMode:   strings.TrimSpace(params.State.Workflow.Mode),
		WorkflowStatus: strings.TrimSpace(params.State.Workflow.Status),
		State:          string(stateContent),
		Content:        strings.TrimSpace(content),
		Model:          strings.TrimSpace(params.Model),
	})
}

func buildEngineeringStatusContent(state EngineeringState) string {
	if state.BootstrapState != nil {
		status := strings.TrimSpace(state.BootstrapState.Status)
		if status != "" {
			return "Project Foundation: " + status
		}
		return "Project Foundation 状态已更新"
	}

	status := strings.TrimSpace(state.Validation.Status)
	gate := strings.TrimSpace(state.Validation.Gate)
	if gate != "" || status != "" {
		if gate == "" {
			return "Validation: " + status
		}
		if status == "" {
			return "Validation Gate: " + gate
		}
		return "Validation Gate: " + gate + " (" + status + ")"
	}

	stage := strings.TrimSpace(state.Workflow.Stage)
	workflowStatus := strings.TrimSpace(state.Workflow.Status)
	if stage == "" && workflowStatus == "" {
		return ""
	}
	if stage == "" {
		return "Workflow: " + workflowStatus
	}
	if workflowStatus == "" {
		return "Workflow: " + stage
	}
	return "Workflow: " + stage + " (" + workflowStatus + ")"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func normalizeRecordedWorkflowStep(step map[string]interface{}, workflowStage string, workflowMode string) map[string]interface{} {
	normalized := make(map[string]interface{}, len(step)+1)
	for key, value := range step {
		normalized[key] = value
	}

	meta := map[string]interface{}{}
	if rawMeta, ok := step["meta"].(map[string]interface{}); ok {
		for key, value := range rawMeta {
			meta[key] = value
		}
	}
	if _, ok := meta["workflow_stage"]; !ok && strings.TrimSpace(workflowStage) != "" {
		meta["workflow_stage"] = strings.TrimSpace(workflowStage)
	}
	if _, ok := meta["workflow_mode"]; !ok && strings.TrimSpace(workflowMode) != "" {
		meta["workflow_mode"] = strings.TrimSpace(workflowMode)
	}
	if len(meta) > 0 {
		normalized["meta"] = meta
	}

	return normalized
}

func recordedWorkflowStepContent(step map[string]interface{}) string {
	return firstNonEmpty(
		stringMapValue(step, "detail"),
		stringMapValue(step, "title"),
		"生成阶段状态已更新。",
	)
}

func recordedWorkflowStepStatusContent(step map[string]interface{}) string {
	title := stringMapValue(step, "title")
	status := stringMapValue(step, "status")
	if title == "" {
		return firstNonEmpty(status, "Workflow step")
	}
	if status == "" {
		return title
	}
	return fmt.Sprintf("%s: %s", title, status)
}

func stringMapValue(values map[string]interface{}, key string) string {
	if values == nil {
		return ""
	}
	value, ok := values[key]
	if !ok {
		return ""
	}
	text, ok := value.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(text)
}
