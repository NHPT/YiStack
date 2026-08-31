package service

import (
	"context"

	"yistack/config"
	"yistack/internal/model"
	"yistack/pkg/llm"
)

// ChatService 聊天服务
type ChatService struct {
	chatRepo  ChatMessageRepo
	llmClient *llm.ProviderManager
	llmCfg    *config.LLMConfig
}

// NewChatService 创建聊天服务
func NewChatService(chatRepo ChatMessageRepo, llmClient *llm.ProviderManager, llmCfg *config.LLMConfig) *ChatService {
	return &ChatService{
		chatRepo:  chatRepo,
		llmClient: llmClient,
		llmCfg:    llmCfg,
	}
}

// ChatMessageDTO 聊天消息 DTO
type ChatMessageDTO struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest 聊天请求
type ChatRequest struct {
	UserID    string           `json:"user_id"`
	ProjectID string           `json:"project_id"`
	Messages  []ChatMessageDTO `json:"messages"`
	Model     string           `json:"model"`
}

// Chat 处理普通聊天请求，并在成功后写入会话记录。
func (s *ChatService) Chat(ctx context.Context, req *ChatRequest, callback func(string, error) error) error {
	modelName := req.Model
	if modelName == "" {
		modelName = s.llmCfg.DefaultModel
	}

	messages := make([]llm.Message, len(req.Messages))
	for i, msg := range req.Messages {
		messages[i] = llm.Message{
			Role:    msg.Role,
			Content: msg.Content,
		}
	}

	chatReq := &llm.ChatRequest{
		Model:       modelName,
		Messages:    messages,
		Temperature: s.llmCfg.DefaultTemperature,
	}
	resp, err := s.llmClient.Chat(ctx, chatReq)
	if err != nil {
		return callback("", err)
	}
	if resp == nil {
		return callback("", nil)
	}

	content := ""
	if len(resp.Choices) > 0 {
		content = resp.Choices[0].Message.Content
	}

	for _, msg := range req.Messages {
		chatMsg := &model.ChatMessage{
			ProjectID: req.ProjectID,
			UserID:    req.UserID,
			Role:      msg.Role,
			Content:   msg.Content,
			Model:     modelName,
		}
		s.chatRepo.Create(ctx, chatMsg)
	}

	if content != "" {
		chatMsg := &model.ChatMessage{
			ProjectID: req.ProjectID,
			UserID:    req.UserID,
			Role:      "assistant",
			Content:   content,
			Model:     modelName,
			Tokens:    resp.Usage.TotalTokens,
		}
		s.chatRepo.Create(ctx, chatMsg)
	}

	return callback(content, nil)
}

// GetProjectMessages 获取项目消息
func (s *ChatService) GetProjectMessages(ctx context.Context, projectID string) ([]model.ChatMessage, error) {
	return s.chatRepo.ListByProjectID(ctx, projectID)
}
