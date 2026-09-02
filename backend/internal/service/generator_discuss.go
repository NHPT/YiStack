package service

import (
	"context"
	"errors"
	"strings"

	"yistack/internal/model"
	"yistack/internal/prompt"
	"yistack/pkg/llm"
)

// generateDiscussion 处理探讨模式输出。
// 该路径只返回分析、澄清和建议，不触发文件写入、容器操作或项目实现。
func (s *GeneratorService) generateDiscussion(ctx context.Context, req *GenerateRequest, handler StreamEventHandler) error {
	workflowStage := req.workflowStage(serviceWorkflowModeDiscuss)

	modelName := req.Model
	if modelName == "" {
		modelName = resolveModelForProvider(s.llmClient, s.llmCfg, initialProviderName(s.llmClient, req.Provider), req.Model)
	}

	projectContext := ""
	projectName := req.ProjectName
	runtimeProfile := ""

	if req.ProjectID != "" {
		if project, err := s.projectRepo.FindByProjectID(ctx, req.ProjectID); err == nil && project != nil {
			if projectName == "" {
				projectName = project.Name
			}
			runtimeProfile = projectRuntimeProfile(project)
			if projectNeedsRuntime(project.AppType) {
				if s.containerMgr != nil {
					if _, _, runtimeErr := ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile); runtimeErr == nil {
						var contextErr error
						projectContext, contextErr = s.loadProjectPromptContext(ctx, project)
						if contextErr != nil {
							_ = emitProjectPromptContextConflict(handler, req, contextErr)
							return contextErr
						}
					}
				} else {
					var contextErr error
					projectContext, contextErr = s.loadProjectPromptContext(ctx, project)
					if contextErr != nil {
						_ = emitProjectPromptContextConflict(handler, req, contextErr)
						return contextErr
					}
				}
			}
		}
	}

	onlineContext := buildOnlineContextDecision(ctx, req)
	_ = emitOnlineContextDecision(handler, onlineContext)

	systemPromptOverride := s.lookupPromptSystemConfig(ctx, prompt.ChatDiscussSystemPromptKey)
	systemPrompt := prompt.BuildDiscussSystemPrompt(
		systemPromptOverride,
		fallbackText(projectName, "未命名项目"),
		fallbackText(runtimeProfile, "待确定"),
		fallbackText(req.AppType, "web"),
		boolToModeText(req.Online),
		fallbackText(projectContext, "暂无项目上下文"),
		onlineContext.PromptSection(),
	)
	if strings.EqualFold(workflowStage, serviceWorkflowStagePlanSelection) && strings.TrimSpace(req.PlanContext) != "" {
		systemPrompt = strings.TrimSpace(systemPrompt) + "\n\n" +
			"当前会话仍处于方案确认阶段。你的职责是解释候选方案、比较取舍、回答追问或帮助用户补充约束。" + "\n" +
			"不要开始实现，不要输出代码文件，不要假定用户已经确认方案。" + "\n\n" +
			"候选方案上下文如下：" + "\n" + strings.TrimSpace(req.PlanContext)
	}
	systemPrompt = appendVisualContextPrompt(systemPrompt, req.VisualContext)

	messages := []llm.Message{
		{Role: "system", Content: systemPrompt},
	}

	if s.chatRepo != nil && req.ProjectID != "" {
		if history, err := s.chatRepo.ListByProjectID(ctx, req.ProjectID); err == nil {
			start := 0
			if len(history) > 12 {
				start = len(history) - 12
			}
			for _, item := range history[start:] {
				content := strings.TrimSpace(item.Content)
				if content == "" {
					continue
				}
				messages = append(messages, llm.Message{
					Role:    item.Role,
					Content: content,
				})
			}
		}
	}

	messages = append(messages, llm.Message{
		Role:    "user",
		Content: req.Prompt,
	})

	if s.chatRepo != nil && req.ProjectID != "" && strings.TrimSpace(req.Prompt) != "" {
		_ = s.chatRepo.Create(ctx, &model.ChatMessage{
			ProjectID:         req.ProjectID,
			UserID:            req.UserID,
			Role:              "user",
			Content:           req.Prompt,
			VisualAttachments: marshalVisualAttachmentsSnapshot(req.VisualAttachments),
			VisualContext:     marshalVisualContextSnapshot(req.VisualContext),
			Model:             modelName,
		})
	}

	chatReq := &llm.ChatRequest{
		Model:       modelName,
		Messages:    messages,
		Temperature: 0.4,
	}

	currentProviderName := initialProviderName(s.llmClient, req.Provider)
	_ = handler(StreamEventStart, map[string]interface{}{
		"model":    modelName,
		"provider": currentProviderName,
		"mode":     "discuss",
	})

	var fullContent strings.Builder
	reasoningBuffer := newReasoningStreamBuffer(func(reasoning string) error {
		return handler(StreamEventChunk, map[string]interface{}{
			"mode":             "discuss",
			"reasoningContent": reasoning,
		})
	})
	usedProvider, usedModel, streamErr := s.streamLLMWithProviderFallback(ctx, req.Provider, req.Model, chatReq, func(chunk *llm.StreamChunk) error {
		if chunk == nil || len(chunk.Choices) == 0 || chunk.Choices[0].Delta == nil {
			return nil
		}
		delta := chunk.Choices[0].Delta
		content, reasoning := extractStreamDeltaParts(delta)
		if content == "" && reasoning == "" {
			return nil
		}
		if content != "" {
			fullContent.WriteString(content)
		}
		if content != "" {
			if err := handler(StreamEventChunk, map[string]interface{}{
				"mode":    "discuss",
				"content": content,
			}); err != nil {
				return err
			}
		}
		if reasoning != "" {
			if err := reasoningBuffer.Append(reasoning); err != nil {
				return err
			}
		}
		return nil
	})
	if flushErr := reasoningBuffer.Flush(); flushErr != nil && streamErr == nil {
		streamErr = flushErr
	}
	if usedModel == "" {
		usedModel = modelName
	}

	if streamErr != nil {
		if errors.Is(streamErr, context.Canceled) || errors.Is(ctx.Err(), context.Canceled) {
			s.persistAssistantDraftMessage(req, usedModel, "探讨已停止，以下为已输出草稿：", fullContent.String())
			return handler(StreamEventError, map[string]interface{}{
				"error":   streamErr.Error(),
				"message": "探讨已停止",
			})
		}
		if s.chatRepo != nil && req.ProjectID != "" {
			_ = s.chatRepo.Create(ctx, &model.ChatMessage{
				ProjectID:     req.ProjectID,
				UserID:        req.UserID,
				Role:          "assistant",
				Content:       "探讨失败: " + streamErr.Error(),
				VisualContext: marshalVisualContextSnapshot(req.VisualContext),
				Model:         usedModel,
			})
		}
		return handler(StreamEventError, map[string]interface{}{
			"error":   streamErr.Error(),
			"message": streamErr.Error(),
		})
	}

	assistantContent := strings.TrimSpace(fullContent.String())
	if assistantContent != "" && s.chatRepo != nil && req.ProjectID != "" {
		_ = s.chatRepo.Create(ctx, &model.ChatMessage{
			ProjectID:     req.ProjectID,
			UserID:        req.UserID,
			Role:          "assistant",
			Content:       assistantContent,
			VisualContext: marshalVisualContextSnapshot(req.VisualContext),
			Model:         usedModel,
		})
	}

	guidance := buildDynamicGuidance(
		ctx,
		s.llmClient,
		s.llmCfg,
		req.Provider,
		req.Model,
		fallbackText(workflowStage, serviceWorkflowModeDiscuss),
		req.Prompt,
		assistantContent,
		req.PlanContext,
	)

	return handler(StreamEventDone, map[string]interface{}{
		"progress":           100,
		"message":            "探讨完成",
		"content":            assistantContent,
		"mode":               "discuss",
		"provider":           fallbackText(usedProvider, currentProviderName),
		"files":              []FileToGenerate{},
		"commands":           []string{},
		"suggestedQuestions": guidance.SuggestedQuestions,
		"suggestedActions":   guidance.SuggestedActions,
	})
}

// boolToModeText 将联网开关转换为提示词中更易理解的模式说明。
func boolToModeText(online bool) string {
	if online {
		return "已开启。允许结合公开技术常识回答，但不应编造未核实的具体版本或第三方细节。"
	}
	return "已关闭。仅基于项目上下文、已选方案和通用工程经验回答。"
}
