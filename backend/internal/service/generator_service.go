package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"

	"yistack/config"
	"yistack/internal/model"
	"yistack/pkg/container"
	"yistack/pkg/file"
	"yistack/pkg/llm"
)

type generationCommandExecutor interface {
	ExecuteInContainer(ctx context.Context, opts *container.RunOptions) (*container.ExecResult, error)
}

// GeneratorService 生成器服务
type GeneratorService struct {
	projectRepo             ProjectRepo
	collaborationRepo       ProjectCollaborationRepo
	chatRepo                ChatMessageRepo
	fileRepo                GeneratedFileRepo
	commitRepo              CommitRepo
	llmClient               *llm.ProviderManager
	providerMgr             *ProviderManagerService
	llmCfg                  *config.LLMConfig
	visualContextSigningKey string
	systemConfigSvc         *SystemConfigService
	containerMgr            *container.Manager
	commandExecutor         generationCommandExecutor
	projectValidator        generatedProjectValidator
	repairGenerator         generationRepairGenerator
	browserAcceptanceRunner BrowserAcceptanceRunner
	fileWorkspace           generationFileWorkspace
	fileSvc                 *file.Service
	containerCfg            *config.ContainerConfig
	activeMu                sync.Mutex
	activeTasks             map[string]context.CancelFunc
}

// GeneratorServiceOptions 生成服务依赖项。
type GeneratorServiceOptions struct {
	ProjectRepo             ProjectRepo
	CollaborationRepo       ProjectCollaborationRepo
	ChatRepo                ChatMessageRepo
	FileRepo                GeneratedFileRepo
	CommitRepo              CommitRepo
	LLMClient               *llm.ProviderManager
	ProviderMgr             *ProviderManagerService
	LLMCfg                  *config.LLMConfig
	VisualContextSigningKey string
	SystemConfigSvc         *SystemConfigService
	ContainerMgr            *container.Manager
	FileService             *file.Service
	ContainerCfg            *config.ContainerConfig
	BrowserAcceptanceRunner BrowserAcceptanceRunner
}

// NewGeneratorService 创建生成器服务。
// 统一采用 options 注入依赖，避免容器能力、文件能力扩展时继续复制新的构造器。
func NewGeneratorService(options GeneratorServiceOptions) *GeneratorService {
	configureProjectRootDir(options.ContainerCfg)
	service := &GeneratorService{
		projectRepo:             options.ProjectRepo,
		collaborationRepo:       options.CollaborationRepo,
		chatRepo:                options.ChatRepo,
		fileRepo:                options.FileRepo,
		commitRepo:              options.CommitRepo,
		llmClient:               options.LLMClient,
		providerMgr:             options.ProviderMgr,
		llmCfg:                  options.LLMCfg,
		visualContextSigningKey: options.VisualContextSigningKey,
		systemConfigSvc:         options.SystemConfigSvc,
		containerMgr:            options.ContainerMgr,
		fileSvc:                 options.FileService,
		containerCfg:            options.ContainerCfg,
		browserAcceptanceRunner: options.BrowserAcceptanceRunner,
		activeTasks:             make(map[string]context.CancelFunc),
	}
	if options.ContainerMgr != nil {
		service.commandExecutor = options.ContainerMgr
		service.projectValidator = NewContainerProjectValidationRunner(options.ContainerMgr)
		service.fileWorkspace = containerGenerationFileWorkspace{manager: options.ContainerMgr}
	}
	return service
}

// GenerateRequest 生成请求
type GenerateRequest struct {
	UserID                    string                        `json:"user_id"`
	ProjectID                 string                        `json:"project_id"`
	Prompt                    string                        `json:"prompt"`
	ConversationStage         string                        `json:"conversation_stage"`
	PlanContext               string                        `json:"plan_context"`
	AppType                   string                        `json:"app_type"`
	ProjectName               string                        `json:"project_name"`
	VisualAttachments         []model.VisualAttachmentInput `json:"visual_attachments"`
	VisualContext             *model.VisualContext          `json:"visual_context,omitempty"`
	VisualEdit                *model.VisualEditContext      `json:"visual_edit,omitempty"`
	VisualAttachmentsPrepared bool                          `json:"-"`
	Mode                      string                        `json:"mode"`
	Online                    bool                          `json:"online"`
	Model                     string                        `json:"model"`
	Provider                  string                        `json:"provider"`
	Temperature               float64                       `json:"temperature"`
	BrowserAcceptance         BrowserAcceptanceSpec         `json:"browser_acceptance"`
}

// FileToGenerate 待生成的文件
type FileToGenerate struct {
	Path        string `json:"path"`
	Content     string `json:"content"`
	Description string `json:"description"`
}

// Generate 执行实现模式的主流程。
// 这里负责串起状态推进、LLM 生成与流式回传；生成结果的落地应用交由独立协作函数处理。
func (s *GeneratorService) Generate(ctx context.Context, req *GenerateRequest, handler StreamEventHandler) error {
	if err := s.ensureGenerateProjectAccess(ctx, req); err != nil {
		return err
	}
	preparedVisualEdit, err := PrepareVisualEditContext(req.VisualEdit)
	if err != nil {
		return err
	}
	req.VisualEdit = preparedVisualEdit
	if err := s.ensureProviderRuntimeReady(ctx); err != nil {
		return fmt.Errorf("LLM provider not ready: %w", err)
	}
	if err := s.prepareRequestVisualContext(ctx, req, handler); err != nil {
		return err
	}

	generateCtx := ctx
	if req.ProjectID != "" {
		var cancel context.CancelFunc
		generateCtx, cancel = context.WithCancel(ctx)
		s.registerActiveTask(req.ProjectID, cancel)
		defer s.unregisterActiveTask(req.ProjectID, cancel)
		defer cancel()
	}

	workflowMode := req.workflowMode(serviceWorkflowModeImplement)
	workflowStage := req.workflowStage(serviceWorkflowStageImplement)

	if strings.EqualFold(workflowMode, serviceWorkflowModeDiscuss) {
		return s.generateDiscussion(generateCtx, req, handler)
	}

	initialProvider := initialProviderName(s.llmClient, req.Provider)
	modelName := resolveModelForProvider(s.llmClient, s.llmCfg, initialProvider, req.Model)
	temperature := req.Temperature
	if temperature == 0 {
		temperature = s.llmCfg.DefaultTemperature
	}

	if s.chatRepo != nil && req.ProjectID != "" && strings.TrimSpace(req.Prompt) != "" {
		_ = s.chatRepo.Create(generateCtx, &model.ChatMessage{
			ProjectID:         req.ProjectID,
			UserID:            req.UserID,
			Role:              "user",
			Content:           req.Prompt,
			VisualAttachments: marshalVisualAttachmentsSnapshot(req.VisualAttachments),
			VisualContext:     marshalVisualContextSnapshot(req.VisualContext),
			Model:             modelName,
		})
	}

	_ = handler(StreamEventStart, map[string]interface{}{
		"status":   "understanding",
		"message":  "正在理解您的需求...",
		"model":    modelName,
		"provider": initialProvider,
	})
	_ = emitWorkflowStep(handler, "understand-request", "status_update", "理解需求与约束", "正在整理当前项目目标、技术栈和用户约束。", "running", map[string]interface{}{
		"mode": workflowMode,
	})
	_ = emitOnlineContextDecision(handler, buildOnlineContextDecision(generateCtx, req))
	_ = handler(StreamEventProgress, map[string]interface{}{
		"progress": 20,
		"message":  "正在生成代码...",
	})

	runtimeStage, err := s.prepareGenerationRuntimeStage(generateCtx, req, handler)
	if err != nil {
		return err
	}

	return runGenerationContentAttempts(
		defaultGenerationSchemaMaxAttempts,
		func(_ int, previousErr error) (generationContentStageResult, error) {
			retryRequest := generationSchemaRetryRequest(req, previousErr)
			return s.streamGenerationContentStage(generateCtx, retryRequest, runtimeStage, modelName, temperature, handler)
		},
		func(contentStage generationContentStageResult) error {
			return s.completeGenerationArtifactsStage(generateCtx, req, runtimeStage, contentStage, workflowStage, handler)
		},
		handler,
	)
}

func (s *GeneratorService) ensureProviderRuntimeReady(ctx context.Context) error {
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

func (s *GeneratorService) lookupPromptSystemConfig(ctx context.Context, key string) string {
	if s == nil || s.systemConfigSvc == nil {
		return ""
	}
	value, err := s.systemConfigSvc.GetConfig(ctx, key)
	if err != nil {
		return ""
	}
	return value
}

func (s *GeneratorService) ensureGenerateProjectAccess(ctx context.Context, req *GenerateRequest) error {
	if s == nil || req == nil || strings.TrimSpace(req.ProjectID) == "" {
		return nil
	}
	if s.projectRepo == nil {
		return errors.New("project repository not available")
	}
	if strings.TrimSpace(req.UserID) == "" {
		return errors.New("user id is required")
	}

	project, err := s.projectRepo.FindByProjectID(ctx, req.ProjectID)
	if err != nil {
		return fmt.Errorf("project not found: %w", err)
	}
	if project == nil {
		return errors.New("you don't have permission to access this project")
	}
	if strings.TrimSpace(project.UserID) == strings.TrimSpace(req.UserID) {
		return nil
	}
	if s.collaborationRepo != nil {
		member, memberErr := s.collaborationRepo.FindMember(ctx, req.ProjectID, req.UserID)
		if memberErr == nil && member != nil && member.Role == ProjectMemberRoleEditor {
			return nil
		}
	}
	return errors.New("you don't have permission to edit this project")
}

// callLLMWithFallback 封装非流式 LLM fallback，统一返回实际生效的 provider 和 model。
func (s *GeneratorService) callLLMWithFallback(ctx context.Context, requestedModel string, chatReq *llm.ChatRequest) (*llm.ChatResponse, string, string, error) {
	return chatWithProviderFallback(ctx, s.llmClient, s.llmCfg, "", requestedModel, chatReq, s.recordProviderUse)
}

// streamLLMWithFallback 封装流式 LLM fallback。
// 注意：一旦某个 provider 已经开始向前端输出内容，就不会再切换到下一个 provider。
func (s *GeneratorService) streamLLMWithFallback(ctx context.Context, requestedModel string, chatReq *llm.ChatRequest, handler llm.StreamChunkHandler) (string, string, error) {
	return s.streamLLMWithProviderFallback(ctx, "", requestedModel, chatReq, handler)
}

func (s *GeneratorService) streamLLMWithProviderFallback(ctx context.Context, requestedProvider string, requestedModel string, chatReq *llm.ChatRequest, handler llm.StreamChunkHandler) (string, string, error) {
	providerName, modelName, err := streamWithProviderFallback(ctx, s.llmClient, s.llmCfg, requestedProvider, requestedModel, chatReq, handler, s.recordProviderUse)
	if err != nil && providerName == "" {
		log.Printf("Stream failed after trying providers: %v", err)
	}
	return providerName, modelName, err
}

func (s *GeneratorService) recordProviderUse(ctx context.Context, providerName string) {
	if s == nil || s.providerMgr == nil {
		return
	}
	_ = s.providerMgr.RecordProviderUse(ctx, providerName)
}

// registerActiveTask 记录当前项目正在运行的生成任务。
// 如果同一项目已有旧任务，会先取消旧任务，再替换为新的 cancel 函数。
func (s *GeneratorService) registerActiveTask(projectID string, cancel context.CancelFunc) {
	if projectID == "" || cancel == nil {
		return
	}

	s.activeMu.Lock()
	defer s.activeMu.Unlock()

	if existing, ok := s.activeTasks[projectID]; ok && existing != nil {
		existing()
	}
	s.activeTasks[projectID] = cancel
}

// unregisterActiveTask 只移除当前这一次注册的任务，避免把更新后的新任务误删掉。
func (s *GeneratorService) unregisterActiveTask(projectID string, cancel context.CancelFunc) {
	if projectID == "" {
		return
	}

	s.activeMu.Lock()
	defer s.activeMu.Unlock()

	current, ok := s.activeTasks[projectID]
	if !ok {
		return
	}
	if fmt.Sprintf("%p", current) == fmt.Sprintf("%p", cancel) {
		delete(s.activeTasks, projectID)
	}
}

// StopGeneration 主动取消项目生成任务。
func (s *GeneratorService) StopGeneration(ctx context.Context, projectID string) bool {
	if projectID == "" {
		return false
	}

	s.activeMu.Lock()
	cancel, ok := s.activeTasks[projectID]
	if ok {
		delete(s.activeTasks, projectID)
	}
	s.activeMu.Unlock()

	if ok && cancel != nil {
		cancel()
	}

	return ok
}

// IsGenerationActive 只读检查当前项目是否仍有后端生成任务在运行。
func (s *GeneratorService) IsGenerationActive(projectID string) bool {
	if projectID == "" {
		return false
	}
	s.activeMu.Lock()
	defer s.activeMu.Unlock()
	_, ok := s.activeTasks[projectID]
	return ok
}
