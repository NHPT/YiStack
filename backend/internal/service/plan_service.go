package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"

	"yistack/config"
	"yistack/internal/model"
	"yistack/internal/prompt"
	"yistack/pkg/llm"
)

const planJSONMarker = "<<PLANS_JSON>>"

// PlanService 方案服务
type PlanService struct {
	projectRepo             ProjectRepo
	chatRepo                ChatMessageRepo
	llmClient               *llm.ProviderManager
	providerMgr             *ProviderManagerService
	llmCfg                  *config.LLMConfig
	visualContextSigningKey string
	systemConfigSvc         *SystemConfigService
}

// NewPlanService 创建方案服务
func NewPlanService(
	projectRepo ProjectRepo,
	chatRepo ChatMessageRepo,
	llmClient *llm.ProviderManager,
	providerMgr *ProviderManagerService,
	llmCfg *config.LLMConfig,
	systemConfigSvc *SystemConfigService,
	visualContextSigningKey string,
) *PlanService {
	return &PlanService{
		projectRepo:             projectRepo,
		chatRepo:                chatRepo,
		llmClient:               llmClient,
		providerMgr:             providerMgr,
		llmCfg:                  llmCfg,
		visualContextSigningKey: visualContextSigningKey,
		systemConfigSvc:         systemConfigSvc,
	}
}

// GeneratePlansRequest 生成方案请求
type GeneratePlansRequest struct {
	UserID                    string                        `json:"user_id"`
	ProjectID                 string                        `json:"project_id"`
	Description               string                        `json:"description"`
	AppType                   string                        `json:"app_type"`
	Language                  string                        `json:"language"`
	Provider                  string                        `json:"provider"`
	UserFeedback              string                        `json:"user_feedback"`
	FoundationContext         string                        `json:"foundation_context"`
	CurrentPlans              []model.Plan                  `json:"current_plans"`
	VisualAttachments         []model.VisualAttachmentInput `json:"visual_attachments"`
	VisualContext             *model.VisualContext          `json:"visual_context,omitempty"`
	VisualAttachmentsPrepared bool                          `json:"-"`
}

// GeneratePlansResponse 生成方案响应
type GeneratePlansResponse struct {
	Plans              []model.Plan     `json:"plans"`
	SuggestedQuestions []string         `json:"suggestedQuestions,omitempty"`
	SuggestedActions   []guidanceAction `json:"suggestedActions,omitempty"`
}

// GeneratePlans 执行非流式方案生成，适合服务端内部直接拿完整结果的场景。
func (s *PlanService) GeneratePlans(ctx context.Context, req *GeneratePlansRequest) (*GeneratePlansResponse, error) {
	resp, _, err := s.generatePlansInternal(ctx, req, nil)
	return resp, err
}

// GeneratePlansStream 执行流式方案生成。
// 前端可以先消费分析文本，最终再拿到完整方案数组和分析摘要。
func (s *PlanService) GeneratePlansStream(ctx context.Context, req *GeneratePlansRequest, handler StreamEventHandler) (*GeneratePlansResponse, string, error) {
	return s.generatePlansInternal(ctx, req, handler)
}

// generatePlansInternal 收口方案生成的主逻辑，统一处理 prompt 构建、LLM 调用、解析和消息落库。
func (s *PlanService) generatePlansInternal(ctx context.Context, req *GeneratePlansRequest, handler StreamEventHandler) (*GeneratePlansResponse, string, error) {
	if err := s.ensureProviderRuntimeReady(ctx); err != nil {
		return nil, "", fmt.Errorf("LLM provider not ready: %w", err)
	}
	if err := s.prepareRequestVisualContext(ctx, req, handler); err != nil {
		return nil, "", err
	}
	req.FoundationContext = appendVisualContextPrompt(req.FoundationContext, req.VisualContext)

	systemPromptOverride := s.lookupPlanSystemPrompt(ctx)
	currentPlanSummary := summarizePlanCandidates(req.CurrentPlans)
	userPrompt := prompt.BuildPlanUserPrompt(req.Description, req.AppType, req.Language, req.UserFeedback, currentPlanSummary, req.FoundationContext)
	startMessage := "正在分析需求并生成技术方案..."
	progressMessage := "正在权衡技术栈与实现路径..."
	structureMessage := "正在整理并结构化候选技术方案..."
	if strings.TrimSpace(req.UserFeedback) != "" {
		startMessage = "正在根据你补充的需求重新规划技术方案..."
		progressMessage = "正在结合上一轮候选方案与新约束重新分析..."
		structureMessage = "正在输出更新后的候选技术方案..."
	}

	currentProviderName := initialProviderName(s.llmClient, req.Provider)
	modelName := resolveModelForProvider(s.llmClient, s.llmCfg, currentProviderName, "")
	if handler != nil {
		_ = emitStreamEvent(handler, StreamEventStart, map[string]interface{}{
			"message":  startMessage,
			"model":    modelName,
			"provider": currentProviderName,
		})
		_ = emitWorkflowStep(handler, "plan-analysis", "reasoning", "分析需求与约束", startMessage, "running", map[string]interface{}{
			"appType": req.AppType,
		})
		_ = emitStreamEvent(handler, StreamEventProgress, map[string]interface{}{
			"message":  progressMessage,
			"progress": 20,
		})
	}

	var analysis string
	var plans []model.Plan
	var err error
	if handler != nil {
		analysisReq := &llm.ChatRequest{
			Model: modelName,
			Messages: []llm.Message{
				{Role: "system", Content: prompt.BuildPlanAnalysisSystemPrompt(systemPromptOverride)},
				{Role: "user", Content: prompt.BuildPlanAnalysisUserPrompt(req.Description, req.AppType, req.Language, req.UserFeedback, currentPlanSummary, req.FoundationContext)},
			},
			Temperature: 0.7,
			Stream:      true,
		}

		var streamedAnalysis string
		var usedProvider string
		var usedModel string
		streamedAnalysis, usedProvider, usedModel, err = s.streamPlanAnalysisWithFallback(ctx, req.Provider, analysisReq, handler)
		if err != nil {
			_ = emitWorkflowStep(handler, "plan-analysis", "reasoning", "分析需求与约束", err.Error(), "failed", nil)
			return nil, "", fmt.Errorf("LLM 调用失败: %w，请检查 LLM 服务配置是否正确", err)
		}
		if usedProvider != "" {
			currentProviderName = usedProvider
		}
		if usedModel != "" {
			modelName = usedModel
		}
		analysis = strings.TrimSpace(streamedAnalysis)
		_ = emitWorkflowStep(handler, "plan-analysis", "reasoning", "分析需求与约束", "分析完成，开始整理候选方案。", "done", nil)
		_ = emitWorkflowStep(handler, "plan-structure", "plan_update", "生成候选技术方案", structureMessage, "running", nil)
		_ = emitStreamEvent(handler, StreamEventProgress, map[string]interface{}{
			"message":  structureMessage,
			"progress": 72,
		})

		lineReq := &llm.ChatRequest{
			Model: modelName,
			Messages: []llm.Message{
				{Role: "system", Content: prompt.BuildPlanLineSystemPrompt(systemPromptOverride)},
				{Role: "user", Content: prompt.BuildPlanLineUserPrompt(req.Description, req.AppType, req.Language, analysis, req.UserFeedback, currentPlanSummary, req.FoundationContext)},
			},
			Temperature: 0.4,
			Stream:      true,
		}

		plans, usedProvider, usedModel, err = s.streamPlanCandidatesWithFallback(ctx, req.Provider, lineReq, handler)
		if err != nil {
			_ = emitWorkflowStep(handler, "plan-structure", "plan_update", "生成候选技术方案", err.Error(), "failed", nil)
			return nil, analysis, fmt.Errorf("方案结构化失败: %w", err)
		}
		if usedProvider != "" {
			currentProviderName = usedProvider
		}
		if usedModel != "" {
			modelName = usedModel
		}
		if len(plans) == 0 {
			_ = emitWorkflowStep(handler, "plan-structure", "plan_update", "生成候选技术方案", "未生成任何可用候选方案。", "failed", nil)
			return nil, analysis, errors.New("LLM returned no plan candidates")
		}
		_ = emitWorkflowStep(handler, "plan-structure", "plan_update", "生成候选技术方案", fmt.Sprintf("已生成 %d 个候选方案。", len(plans)), "done", map[string]interface{}{
			"planCount": len(plans),
		})
	} else {
		chatReq := &llm.ChatRequest{
			Model: modelName,
			Messages: []llm.Message{
				{Role: "system", Content: prompt.BuildPlanSystemPrompt(systemPromptOverride)},
				{Role: "user", Content: userPrompt},
			},
			Temperature: 0.7,
		}
		var resp *llm.ChatResponse
		var usedProvider string
		var usedModel string
		resp, usedProvider, usedModel, err = s.chatPlanWithFallback(ctx, req.Provider, chatReq)
		if err != nil {
			return nil, "", fmt.Errorf("LLM 调用失败: %w，请检查 LLM 服务配置是否正确", err)
		}
		if usedProvider != "" {
			currentProviderName = usedProvider
		}
		if usedModel != "" {
			modelName = usedModel
		}
		if resp == nil || len(resp.Choices) == 0 {
			return nil, "", errors.New("LLM returned no response")
		}
		analysis, plans, err = parseGeneratedPlans(resp.Choices[0].Message.Content)
		if err != nil {
			return nil, analysis, err
		}
	}
	if req.VisualContext != nil {
		for index := range plans {
			plans[index].VisualContext = req.VisualContext
		}
	}

	guidance := buildDynamicGuidance(
		ctx,
		s.llmClient,
		s.llmCfg,
		req.Provider,
		"",
		"plan-selection",
		visiblePlanRequestContent(req, userPrompt),
		strings.Join([]string{analysis, summarizePlanCandidates(plans)}, "\n\n"),
		currentPlanSummary,
	)
	response := &GeneratePlansResponse{
		Plans:              plans,
		SuggestedQuestions: guidance.SuggestedQuestions,
		SuggestedActions:   guidance.SuggestedActions,
	}
	s.persistPlanConversation(ctx, req, userPrompt, response, analysis)
	return response, analysis, nil
}

func (s *PlanService) ensureProviderRuntimeReady(ctx context.Context) error {
	if s == nil || s.llmClient == nil {
		return errors.New("LLM provider manager not initialized")
	}
	if len(s.llmClient.ListProviders()) > 0 && strings.TrimSpace(s.llmClient.GetCurrentName()) != "" {
		return nil
	}
	if s.providerMgr == nil {
		return errors.New("no LLM provider available")
	}
	if err := s.providerMgr.EnsureLoaded(ctx); err != nil {
		return err
	}
	if len(s.llmClient.ListProviders()) == 0 || strings.TrimSpace(s.llmClient.GetCurrentName()) == "" {
		return errors.New("no LLM provider available")
	}
	return nil
}

func (s *PlanService) recordProviderUse(ctx context.Context, providerName string) {
	if s == nil || s.providerMgr == nil {
		return
	}
	_ = s.providerMgr.RecordProviderUse(ctx, providerName)
}

// lookupPlanSystemPrompt 读取可配置的方案系统提示词；读取失败时回退到默认 prompt。
func (s *PlanService) lookupPlanSystemPrompt(ctx context.Context) string {
	if s.systemConfigSvc == nil {
		return ""
	}
	value, err := s.systemConfigSvc.GetConfig(ctx, prompt.ProjectPlansSystemPromptKey)
	if err != nil {
		return ""
	}
	return value
}

// persistPlanConversation 将方案生成过程的用户输入与方案结果写回聊天记录，供 workspace 直接展示。
func (s *PlanService) persistPlanConversation(ctx context.Context, req *GeneratePlansRequest, userPrompt string, resp *GeneratePlansResponse, analysis string) {
	if s.chatRepo == nil || s.projectRepo == nil || strings.TrimSpace(req.ProjectID) == "" || strings.TrimSpace(req.UserID) == "" {
		return
	}

	project, err := s.projectRepo.FindByProjectID(ctx, req.ProjectID)
	if err != nil || project == nil || project.UserID != req.UserID {
		return
	}

	_ = s.chatRepo.Create(ctx, &model.ChatMessage{
		ProjectID:         req.ProjectID,
		UserID:            req.UserID,
		Role:              "user",
		Content:           visiblePlanRequestContent(req, userPrompt),
		VisualAttachments: marshalVisualAttachmentsSnapshot(req.VisualAttachments),
		VisualContext:     marshalVisualContextSnapshot(req.VisualContext),
	})

	recommendedPlanID := ""
	if len(resp.Plans) > 0 {
		recommendedPlanID = resp.Plans[0].ID
	}

	payload, err := json.Marshal(map[string]interface{}{
		"kind":               "plan-options",
		"content":            visiblePlanResponseContent(req),
		"analysis":           analysis,
		"plans":              resp.Plans,
		"recommendedPlanId":  recommendedPlanID,
		"suggestedQuestions": resp.SuggestedQuestions,
		"suggestedActions":   resp.SuggestedActions,
	})
	if err != nil {
		log.Printf("Warning: failed to marshal plan conversation payload: %v", err)
		return
	}

	_ = s.chatRepo.Create(ctx, &model.ChatMessage{
		ProjectID:     req.ProjectID,
		UserID:        req.UserID,
		Role:          "assistant",
		Content:       string(payload),
		VisualContext: marshalVisualContextSnapshot(req.VisualContext),
	})
}

func summarizePlanCandidates(plans []model.Plan) string {
	if len(plans) == 0 {
		return ""
	}

	var builder strings.Builder
	for index, plan := range plans {
		if index > 0 {
			builder.WriteString("\n\n")
		}
		builder.WriteString(fmt.Sprintf("%d. %s", index+1, strings.TrimSpace(plan.Name)))
		if profile := techStackRuntimeProfileRaw(plan.TechStack); profile != "" {
			builder.WriteString(fmt.Sprintf("（运行配置：%s）", profile))
		}
		if labels := techStackDisplayLabelsRaw(plan.TechStack); len(labels) > 0 {
			builder.WriteString("\n- 技术栈：")
			builder.WriteString(strings.Join(labels, "、"))
		}
		if len(plan.Features) > 0 {
			builder.WriteString("\n- 核心功能：")
			builder.WriteString(strings.Join(plan.Features, "、"))
		}
		if strings.TrimSpace(plan.Description) != "" {
			builder.WriteString("\n- 方案说明：")
			builder.WriteString(strings.TrimSpace(plan.Description))
		}
		if strings.TrimSpace(plan.Reasoning) != "" {
			builder.WriteString("\n- 推荐理由：")
			builder.WriteString(strings.TrimSpace(plan.Reasoning))
		}
	}
	return strings.TrimSpace(builder.String())
}

func visiblePlanRequestContent(req *GeneratePlansRequest, fallback string) string {
	feedback := strings.TrimSpace(req.UserFeedback)
	if feedback != "" {
		return feedback
	}

	description := strings.TrimSpace(req.Description)
	if description != "" {
		return description
	}

	return fallback
}

func visiblePlanResponseContent(req *GeneratePlansRequest) string {
	if strings.TrimSpace(req.UserFeedback) != "" {
		return "我已根据你刚补充的需求更新了候选技术方案。你可以继续补充要求，或选择一个方案开始实现；如果 120 秒内未选择，我会自动确认推荐方案。"
	}
	return "我已经完成需求分析，下面是推荐给你的技术方案。你可以手动选择一个方案继续实现；如果 120 秒内未选择，我会自动确认推荐方案。"
}

// chatPlanWithFallback 处理非流式方案生成时的 provider fallback。
func (s *PlanService) chatPlanWithFallback(ctx context.Context, requestedProvider string, chatReq *llm.ChatRequest) (*llm.ChatResponse, string, string, error) {
	return chatWithProviderFallback(ctx, s.llmClient, s.llmCfg, requestedProvider, "", chatReq, s.recordProviderUse)
}

func (s *PlanService) chatPlanJSONWithFallback(ctx context.Context, requestedProvider string, chatReq *llm.ChatRequest) (*llm.ChatResponse, string, string, error) {
	return chatWithProviderFallback(ctx, s.llmClient, s.llmCfg, requestedProvider, "", chatReq, s.recordProviderUse)
}

func (s *PlanService) streamPlanAnalysisWithFallback(ctx context.Context, requestedProvider string, chatReq *llm.ChatRequest, handler StreamEventHandler) (string, string, string, error) {
	var analysis strings.Builder

	providerName, modelName, err := streamWithProviderFallback(ctx, s.llmClient, s.llmCfg, requestedProvider, "", chatReq, func(chunk *llm.StreamChunk) error {
		if chunk == nil || len(chunk.Choices) == 0 || chunk.Choices[0].Delta == nil {
			return nil
		}
		content, _ := chunk.Choices[0].Delta["content"].(string)
		if content == "" {
			return nil
		}

		analysis.WriteString(content)
		return emitStreamEvent(handler, StreamEventChunk, map[string]interface{}{
			"content": content,
		})
	}, s.recordProviderUse)
	if err != nil {
		if providerName == "" {
			log.Printf("Plan analysis stream failed after trying providers: %v", err)
		}
		return "", providerName, modelName, err
	}

	return analysis.String(), providerName, modelName, nil
}

func (s *PlanService) streamPlanCandidatesWithFallback(ctx context.Context, requestedProvider string, chatReq *llm.ChatRequest, handler StreamEventHandler) ([]model.Plan, string, string, error) {
	var rawBuilder strings.Builder
	var pending strings.Builder
	plans := make([]model.Plan, 0, 3)

	emitPlan := func(plan model.Plan) error {
		if plan.ID == "" {
			plan.ID = fmt.Sprintf("plan_%d", len(plans)+1)
		}
		normalizePlanTechStack(&plan)
		plans = append(plans, plan)
		return emitStreamEvent(handler, StreamEventPlan, map[string]interface{}{
			"plan":  plan,
			"index": len(plans) - 1,
		})
	}

	flushCompleteLines := func(force bool) error {
		buffer := pending.String()
		if buffer == "" {
			return nil
		}

		lines := strings.Split(buffer, "\n")
		remainder := ""
		if !force {
			remainder = lines[len(lines)-1]
			lines = lines[:len(lines)-1]
		}

		for _, line := range lines {
			trimmed := normalizePlanLine(line)
			if trimmed == "" {
				continue
			}

			var plan model.Plan
			if err := json.Unmarshal([]byte(trimmed), &plan); err != nil {
				return err
			}
			if err := emitPlan(plan); err != nil {
				return err
			}
		}

		pending.Reset()
		pending.WriteString(remainder)
		return nil
	}

	providerName, modelName, err := streamWithProviderFallback(ctx, s.llmClient, s.llmCfg, requestedProvider, "", chatReq, func(chunk *llm.StreamChunk) error {
		if chunk == nil || len(chunk.Choices) == 0 || chunk.Choices[0].Delta == nil {
			return nil
		}
		content, _ := chunk.Choices[0].Delta["content"].(string)
		if content == "" {
			return nil
		}

		rawBuilder.WriteString(content)
		pending.WriteString(content)
		if err := flushCompleteLines(false); err != nil {
			return err
		}
		if len(plans) > 0 {
			progress := 72 + len(plans)*8
			if progress > 96 {
				progress = 96
			}
			return emitStreamEvent(handler, StreamEventProgress, map[string]interface{}{
				"message":  "候选方案正在逐个返回...",
				"progress": progress,
			})
		}
		return nil
	}, s.recordProviderUse)
	if err != nil {
		if providerName == "" {
			log.Printf("Plan candidate stream failed after trying providers: %v", err)
		}
		return nil, providerName, modelName, err
	}

	if err := flushCompleteLines(true); err != nil {
		analysis, fallbackPlans, parseErr := parseGeneratedPlans(rawBuilder.String())
		if parseErr != nil {
			return nil, providerName, modelName, fmt.Errorf("AI 返回的方案格式解析失败: %w", parseErr)
		}
		_ = analysis
		start := len(plans)
		if start > len(fallbackPlans) {
			start = len(fallbackPlans)
		}
		for _, plan := range fallbackPlans[start:] {
			if emitErr := emitPlan(plan); emitErr != nil {
				return nil, providerName, modelName, emitErr
			}
		}
	}

	if len(plans) == 0 {
		_, fallbackPlans, parseErr := parseGeneratedPlans(rawBuilder.String())
		if parseErr != nil {
			return nil, providerName, modelName, parseErr
		}
		for _, plan := range fallbackPlans {
			if emitErr := emitPlan(plan); emitErr != nil {
				return nil, providerName, modelName, emitErr
			}
		}
	}

	return plans, providerName, modelName, nil
}

func normalizePlanLine(line string) string {
	trimmed := strings.TrimSpace(line)
	trimmed = strings.TrimSuffix(trimmed, ",")
	if trimmed == "" || trimmed == "[" || trimmed == "]" || strings.HasPrefix(trimmed, "```") {
		return ""
	}
	return trimmed
}

// streamPlanOutputWithFallback 处理流式方案生成。
// 它只会把分析文本流式发给前端，JSON 方案体会留在服务端解析，避免前端接到半截 JSON。
func (s *PlanService) streamPlanOutputWithFallback(ctx context.Context, chatReq *llm.ChatRequest, handler StreamEventHandler) (string, string, string, error) {
	var rawBuilder strings.Builder
	var pending strings.Builder
	markerFound := false
	jsonProgressBytes := 0
	nextJSONProgressThreshold := 512

	providerName, modelName, err := streamWithProviderFallback(ctx, s.llmClient, s.llmCfg, "", "", chatReq, func(chunk *llm.StreamChunk) error {
		if chunk == nil || len(chunk.Choices) == 0 || chunk.Choices[0].Delta == nil {
			return nil
		}
		content, _ := chunk.Choices[0].Delta["content"].(string)
		if content == "" {
			return nil
		}

		rawBuilder.WriteString(content)
		if markerFound {
			jsonProgressBytes += len(content)
			if jsonProgressBytes >= nextJSONProgressThreshold {
				progress := 60 + jsonProgressBytes/256
				if progress > 92 {
					progress = 92
				}
				if err := emitStreamEvent(handler, StreamEventProgress, map[string]interface{}{
					"message":  "正在整理并校验候选技术方案...",
					"progress": progress,
				}); err != nil {
					return err
				}
				nextJSONProgressThreshold += 512
			}
			return nil
		}

		pending.WriteString(content)
		pendingText := pending.String()
		if idx := strings.Index(pendingText, planJSONMarker); idx >= 0 {
			if err := emitStreamEvent(handler, StreamEventChunk, map[string]interface{}{
				"content": pendingText[:idx],
			}); err != nil {
				return err
			}
			if err := emitStreamEvent(handler, StreamEventProgress, map[string]interface{}{
				"message":  "正在整理并校验候选技术方案...",
				"progress": 55,
			}); err != nil {
				return err
			}
			pending.Reset()
			markerFound = true
			return nil
		}

		safeByteLen := len(pendingText) - len(planJSONMarker) + 1
		if safeByteLen <= 0 {
			return nil
		}
		safeText, remainder := splitUTF8SafePrefix(pendingText, safeByteLen)
		if safeText == "" {
			return nil
		}
		if err := emitStreamEvent(handler, StreamEventChunk, map[string]interface{}{
			"content": safeText,
		}); err != nil {
			return err
		}
		pending.Reset()
		pending.WriteString(remainder)
		return nil
	}, s.recordProviderUse)
	if err != nil {
		if providerName == "" {
			log.Printf("Plan stream failed after trying providers: %v", err)
		}
		return "", providerName, modelName, err
	}
	if !markerFound {
		if err := emitStreamEvent(handler, StreamEventChunk, map[string]interface{}{
			"content": pending.String(),
		}); err != nil {
			return "", providerName, modelName, err
		}
	}
	return rawBuilder.String(), providerName, modelName, nil
}

// parseGeneratedPlans 从模型原始输出中拆出分析文本和方案 JSON，并标准化缺失的方案 ID。
func parseGeneratedPlans(content string) (string, []model.Plan, error) {
	trimmed := strings.TrimSpace(content)
	analysis := ""
	jsonPart := trimmed

	if idx := strings.Index(trimmed, planJSONMarker); idx >= 0 {
		analysis = strings.TrimSpace(trimmed[:idx])
		jsonPart = strings.TrimSpace(trimmed[idx+len(planJSONMarker):])
	}

	jsonPart = strings.TrimSpace(strings.TrimPrefix(jsonPart, "```json"))
	jsonPart = strings.TrimSpace(strings.TrimPrefix(jsonPart, "```"))
	jsonPart = strings.TrimSpace(strings.TrimSuffix(jsonPart, "```"))

	if extracted, ok := extractFirstJSONArray(jsonPart); ok {
		jsonPart = extracted
	}

	var plans []model.Plan
	if err := json.Unmarshal([]byte(jsonPart), &plans); err != nil {
		objectPlans, objectErr := parsePlanObjects(jsonPart)
		if objectErr != nil {
			return analysis, nil, fmt.Errorf("AI 返回的方案格式解析失败: %w", err)
		}
		plans = objectPlans
	}

	for i := range plans {
		if plans[i].ID == "" {
			plans[i].ID = fmt.Sprintf("plan_%d", i+1)
		}
		normalizePlanTechStack(&plans[i])
	}

	return analysis, plans, nil
}

func parsePlanObjects(input string) ([]model.Plan, error) {
	candidates := extractJSONObjectCandidates(input)
	if len(candidates) == 0 {
		return nil, fmt.Errorf("未找到可解析的方案 JSON 对象")
	}

	plans := make([]model.Plan, 0, len(candidates))
	for _, candidate := range candidates {
		var plan model.Plan
		if err := json.Unmarshal([]byte(candidate), &plan); err != nil {
			continue
		}
		plans = append(plans, plan)
	}
	if len(plans) == 0 {
		return nil, fmt.Errorf("未找到可解析的方案 JSON 对象")
	}
	return plans, nil
}

func extractFirstJSONArray(input string) (string, bool) {
	text := strings.TrimSpace(input)
	if text == "" {
		return "", false
	}

	start := strings.Index(text, "[")
	if start < 0 {
		return "", false
	}

	inString := false
	escaped := false
	depth := 0

	for i := start; i < len(text); i++ {
		ch := text[i]
		if inString {
			if escaped {
				escaped = false
				continue
			}
			if ch == '\\' {
				escaped = true
				continue
			}
			if ch == '"' {
				inString = false
			}
			continue
		}

		switch ch {
		case '"':
			inString = true
		case '[':
			depth++
		case ']':
			depth--
			if depth == 0 {
				return strings.TrimSpace(text[start : i+1]), true
			}
		}
	}

	return "", false
}

func extractJSONObjectCandidates(input string) []string {
	text := strings.TrimSpace(input)
	if text == "" {
		return nil
	}

	candidates := make([]string, 0, 3)
	inString := false
	escaped := false
	depth := 0
	start := -1

	for i := 0; i < len(text); i++ {
		ch := text[i]
		if inString {
			if escaped {
				escaped = false
				continue
			}
			if ch == '\\' {
				escaped = true
				continue
			}
			if ch == '"' {
				inString = false
			}
			continue
		}

		switch ch {
		case '"':
			inString = true
		case '{':
			if depth == 0 {
				start = i
			}
			depth++
		case '}':
			if depth == 0 {
				continue
			}
			depth--
			if depth == 0 && start >= 0 {
				candidates = append(candidates, strings.TrimSpace(text[start:i+1]))
				start = -1
			}
		}
	}

	return candidates
}
