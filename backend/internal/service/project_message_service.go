package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"yistack/internal/model"
)

// ProjectStoredMessage 项目手工备注消息 DTO。
// 该接口仅接收用户主动输入的备注，不允许伪造 assistant/system 消息。
type ProjectStoredMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
	Model   string `json:"model,omitempty"`
}

// ProjectMessageService 项目消息服务。
// 它负责工作台消息的查询、追加保存和删除，避免 handler 直接依赖 repo。
type ProjectMessageService struct {
	chatRepo             ChatMessageRepo
	engineeringStateRepo EngineeringStateRepo
}

// NewProjectMessageService 创建项目消息服务。
func NewProjectMessageService(chatRepo ChatMessageRepo, engineeringStateRepos ...EngineeringStateRepo) *ProjectMessageService {
	var engineeringStateRepo EngineeringStateRepo
	if len(engineeringStateRepos) > 0 {
		engineeringStateRepo = engineeringStateRepos[0]
	}
	return &ProjectMessageService{
		chatRepo:             chatRepo,
		engineeringStateRepo: engineeringStateRepo,
	}
}

// GetProjectMessages 获取项目消息列表。
func (s *ProjectMessageService) GetProjectMessages(ctx context.Context, projectID string) ([]model.ChatMessage, error) {
	if s == nil || s.chatRepo == nil {
		return []model.ChatMessage{}, nil
	}
	return s.chatRepo.ListByProjectID(ctx, projectID)
}

// GetLatestEngineeringStateSnapshot 恢复最新工程状态快照。
// 优先读取项目级状态表，缺失时回退到历史 workflow 消息。
func (s *ProjectMessageService) GetLatestEngineeringStateSnapshot(ctx context.Context, projectID string) (map[string]interface{}, bool, error) {
	if s != nil && s.engineeringStateRepo != nil {
		if state, err := s.engineeringStateRepo.FindByProjectID(ctx, projectID); err == nil && state != nil {
			if snapshot, ok := engineeringStateSnapshotFromRawJSON(state.State); ok {
				return snapshot, true, nil
			}
		}
	}

	messages, err := s.GetProjectMessages(ctx, projectID)
	if err != nil {
		return nil, false, err
	}

	for index := len(messages) - 1; index >= 0; index-- {
		snapshot, ok := engineeringStateSnapshotFromMessage(messages[index])
		if ok {
			return snapshot, true, nil
		}
	}
	return nil, false, nil
}

func engineeringStateSnapshotFromMessage(message model.ChatMessage) (map[string]interface{}, bool) {
	content := strings.TrimSpace(message.Content)
	if content == "" {
		return nil, false
	}

	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(content), &payload); err != nil {
		return nil, false
	}

	rawState, ok := payload["engineeringState"].(map[string]interface{})
	if !ok || len(rawState) == 0 {
		return nil, false
	}
	return rawState, true
}

func engineeringStateSnapshotFromRawJSON(raw string) (map[string]interface{}, bool) {
	content := strings.TrimSpace(raw)
	if content == "" {
		return nil, false
	}

	var snapshot map[string]interface{}
	if err := json.Unmarshal([]byte(content), &snapshot); err != nil {
		return nil, false
	}
	if len(snapshot) == 0 {
		return nil, false
	}
	return snapshot, true
}

// SaveProjectMessages 追加保存用户手工备注。
func (s *ProjectMessageService) SaveProjectMessages(ctx context.Context, projectID, userID string, messages []ProjectStoredMessage) error {
	if s == nil || s.chatRepo == nil {
		return nil
	}

	for _, item := range messages {
		role := strings.ToLower(strings.TrimSpace(item.Role))
		content := strings.TrimSpace(item.Content)
		if role == "" || content == "" {
			continue
		}
		if role != "user" {
			return fmt.Errorf("only manual user messages can be saved via this endpoint")
		}
		if err := s.chatRepo.Create(ctx, &model.ChatMessage{
			ProjectID: projectID,
			UserID:    userID,
			Role:      "user",
			Content:   content,
			Model:     strings.TrimSpace(item.Model),
		}); err != nil {
			return err
		}
	}

	return nil
}

// DeleteProjectMessages 删除项目所有消息。
func (s *ProjectMessageService) DeleteProjectMessages(ctx context.Context, projectID string) error {
	if s == nil || s.chatRepo == nil {
		return nil
	}
	return s.chatRepo.DeleteByProjectID(ctx, projectID)
}
