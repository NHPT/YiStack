package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"yistack/config"
	"yistack/internal/handler"
	"yistack/internal/orchestration"
	"yistack/internal/repository"
	"yistack/internal/service"
	"yistack/pkg/auth"
	"yistack/pkg/container"
	"yistack/pkg/database"
	"yistack/pkg/file"
	"yistack/pkg/llm"
	"yistack/pkg/supabase"
)

// repositorySet 收口后端依赖的仓储集合。
// 组合根只在这里决定采用哪一套仓储实现，避免 main.go 到处散落条件分支。
type repositorySet struct {
	projectRepo              service.ProjectRepo
	chatRepo                 service.ChatMessageRepo
	engineeringStateRepo     service.EngineeringStateRepo
	generationJobRepo        service.GenerationJobRepo
	capabilityAuditRepo      orchestration.CapabilityExecutionAuditLogRepo
	capabilityAuditQuery     service.CapabilityExecutionAuditRepo
	resourceAlertEventRepo   service.ProjectResourceAlertEventRepo
	fileRepo                 service.GeneratedFileRepo
	commitRepo               service.CommitRepo
	githubIntegrationRepo    service.GitHubIntegrationRepo
	projectDeploymentRepo    service.ProjectDeploymentRepo
	projectCollaborationRepo service.ProjectCollaborationRepo
	userRepo                 service.UserRepo
	systemConfigRepo         service.SystemConfigRepo
	llmProviderRepo          service.LLMProviderRepo
	adminRepo                service.AdminRepo
	auditRepo                service.AdminAuditLogRepo
}

// serviceSet 收口业务服务集合。
type serviceSet struct {
	llmClient              *llm.ProviderManager
	projectMessageService  *service.ProjectMessageService
	capabilityAuditService *service.CapabilityExecutionAuditService
	systemConfigService    *service.SystemConfigService
	providerMgrService     *service.ProviderManagerService
	projectService         *service.ProjectService
	githubIntegration      *service.GitHubIntegrationService
	projectDeployment      *service.ProjectDeploymentService
	projectCollaboration   *service.ProjectCollaborationService
	genService             *service.GeneratorService
	planService            *service.PlanService
	traditionalAuth        *service.AuthService
	supabaseAuth           *auth.SupabaseAuthService
}

// orchestrationSet 收口最小编排入口集合。
type orchestrationSet struct {
	plan     *orchestration.PlanOrchestrator
	generate *orchestration.GenerateOrchestrator
}

type capabilityProviderPreflightItem struct {
	Provider   string                 `json:"provider"`
	RunnerMode string                 `json:"runner_mode"`
	Status     string                 `json:"status"`
	Severity   string                 `json:"severity"`
	ReasonCode string                 `json:"reason_code"`
	SourceNote string                 `json:"source_note"`
	NextAction string                 `json:"next_action"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

type capabilityProviderPreflightSnapshot struct {
	GeneratedAt  string                            `json:"generated_at"`
	SourceNote   string                            `json:"source_note"`
	Items        []capabilityProviderPreflightItem `json:"items"`
	StatusCounts map[string]int                    `json:"status_counts"`
}

// handlerSet 收口所有 HTTP handler。
type handlerSet struct {
	modelsHandler        *handler.ModelsHandler
	generateHandler      *handler.GenerateHandler
	projectHandler       *handler.ProjectHandler
	githubHandler        *handler.GitHubIntegrationHandler
	deploymentHandler    *handler.ProjectDeploymentHandler
	collaborationHandler *handler.ProjectCollaborationHandler
	authHandler          *handler.AuthHandler
	adminHandler         *handler.AdminHandler
	adminAuthHandler     *handler.AdminAuthHandler
	llmProviderHandler   *handler.LLMProviderHandler
}

// appBootstrap 描述服务启动时已经装配完成的依赖图。
type appBootstrap struct {
	db                          database.Database
	repositories                repositorySet
	containerMgr                *container.Manager
	projectFileSvc              *file.Service
	services                    serviceSet
	orchestrations              orchestrationSet
	handlers                    handlerSet
	capabilityProviderPreflight capabilityProviderPreflightSnapshot
}

// bootstrapApplication 负责组装后端依赖图。
// 它把数据库、仓储、服务和 handler 的装配集中在一起，避免 main.go 继续退化为全局依赖表。
func bootstrapApplication(cfg *config.Config) (*appBootstrap, error) {
	db, supabaseClient, err := initDatabase(cfg)
	if err != nil {
		return nil, fmt.Errorf("initialize database: %w", err)
	}

	repositories, err := initRepositories(db, supabaseClient)
	if err != nil {
		return nil, err
	}
	services, containerMgr, projectFileSvc := initServices(cfg, repositories, supabaseClient)
	capabilityProviderPreflight := buildCapabilityProviderPreflightSnapshot(cfg)
	orchestrations := initOrchestrations(cfg, services, repositories)
	handlers := initHandlers(repositories, services, orchestrations, cfg)

	return &appBootstrap{
		db:                          db,
		repositories:                repositories,
		containerMgr:                containerMgr,
		projectFileSvc:              projectFileSvc,
		services:                    services,
		orchestrations:              orchestrations,
		handlers:                    handlers,
		capabilityProviderPreflight: capabilityProviderPreflight,
	}, nil
}

func initRepositories(db database.Database, supabaseClient *supabase.Client) (repositorySet, error) {
	repositories := repositorySet{}

	if db != nil && db.GetDB() != nil {
		if err := migrateDatabase(db.GetDB()); err != nil {
			return repositories, fmt.Errorf("migrate database: %w", err)
		}

		repositories.projectRepo = repository.NewProjectRepository(db)
		repositories.chatRepo = repository.NewChatMessageRepository(db)
		repositories.engineeringStateRepo = repository.NewEngineeringStateRepository(db)
		repositories.generationJobRepo = repository.NewGenerationJobRepository(db)
		capabilityAuditRepo := repository.NewCapabilityExecutionAuditRepository(db)
		repositories.capabilityAuditRepo = capabilityAuditRepo
		repositories.capabilityAuditQuery = capabilityAuditRepo
		repositories.resourceAlertEventRepo = repository.NewProjectResourceAlertEventRepository(db)
		repositories.fileRepo = repository.NewGeneratedFileRepository(db)
		repositories.commitRepo = repository.NewCommitRepository(db)
		repositories.githubIntegrationRepo = repository.NewGitHubIntegrationRepository(db)
		repositories.projectDeploymentRepo = repository.NewProjectDeploymentRepository(db)
		repositories.projectCollaborationRepo = repository.NewProjectCollaborationRepository(db)
		repositories.userRepo = repository.NewUserRepository(db)
		repositories.systemConfigRepo = repository.NewSystemConfigRepository(db)
		repositories.llmProviderRepo = repository.NewLLMProviderRepository(db)
		repositories.adminRepo = repository.NewAdminRepository(db)

		if err := initLLMProviders(repositories.llmProviderRepo); err != nil {
			log.Printf("Init LLM providers failed: %v", err)
		}
		initLLMFromEnv(repositories.llmProviderRepo)
		return repositories, nil
	}

	if supabaseClient != nil {
		log.Println("Using Supabase REST API repositories")
		supaRepo := supabase.NewSupabaseRepository(supabaseClient)
		repositories.projectRepo = supaRepo.ProjectRepository()
		repositories.chatRepo = supaRepo.ChatMessageRepository()
		repositories.engineeringStateRepo = supaRepo.EngineeringStateRepository()
		repositories.generationJobRepo = supaRepo.GenerationJobRepository()
		capabilityAuditRepo := supaRepo.CapabilityExecutionAuditRepository()
		repositories.capabilityAuditRepo = capabilityAuditRepo
		repositories.capabilityAuditQuery = capabilityAuditRepo
		repositories.resourceAlertEventRepo = supaRepo.ProjectResourceAlertEventRepository()
		repositories.fileRepo = supaRepo.GeneratedFileRepository()
		repositories.commitRepo = supaRepo.CommitRepository()
		repositories.githubIntegrationRepo = supaRepo.GitHubIntegrationRepository()
		repositories.projectDeploymentRepo = supaRepo.ProjectDeploymentRepository()
		repositories.projectCollaborationRepo = supaRepo.ProjectCollaborationRepository()
		repositories.userRepo = supaRepo.UserRepository()
		repositories.llmProviderRepo = supaRepo.LLMProviderRepository()
		repositories.systemConfigRepo = supaRepo.SystemConfigRepository()
		repositories.adminRepo = supaRepo.AdminRepository()
		repositories.auditRepo = supaRepo.AdminAuditLogRepository()
	}

	return repositories, nil
}

func initServices(cfg *config.Config, repositories repositorySet, supabaseClient *supabase.Client) (serviceSet, *container.Manager, *file.Service) {
	services := serviceSet{}
	projectFileSvc := file.NewService()
	log.Println("File service initialized")

	if repositories.systemConfigRepo != nil {
		services.systemConfigService = service.NewSystemConfigService(repositories.systemConfigRepo)
		if err := services.systemConfigService.InitDefaults(context.Background()); err != nil {
			log.Printf("Warning: failed to initialize system config defaults: %v", err)
		}
		if err := service.ApplySystemRuntimeConfig(context.Background(), cfg, repositories.systemConfigRepo); err != nil {
			log.Printf("Warning: failed to load runtime config from system_config: %v", err)
		}
	}

	services.llmClient = initLLMClient(cfg, repositories.llmProviderRepo)
	services.projectMessageService = service.NewProjectMessageService(repositories.chatRepo, repositories.engineeringStateRepo)
	if repositories.capabilityAuditQuery != nil {
		services.capabilityAuditService = service.NewCapabilityExecutionAuditService(repositories.capabilityAuditQuery)
	}

	if repositories.llmProviderRepo != nil {
		services.providerMgrService = service.NewProviderManagerService(services.llmClient, repositories.llmProviderRepo, &cfg.LLM)
		if err := services.providerMgrService.Reload(context.Background()); err != nil {
			log.Printf("Warning: Failed to load LLM providers from DB: %v", err)
		}
	}

	var containerMgr *container.Manager
	if cfg.Container.Enabled {
		var err error
		containerMgr, err = initContainerManager(cfg)
		if err != nil {
			log.Fatalf("Container manager initialization failed: %v", err)
		}
		log.Println("Container manager initialized")
	}

	if repositories.projectRepo != nil {
		services.projectService = service.NewProjectService(service.ProjectServiceOptions{
			ProjectRepo:            repositories.projectRepo,
			CollaborationRepo:      repositories.projectCollaborationRepo,
			OwnershipRepo:          repositories.adminRepo,
			FileRepo:               repositories.fileRepo,
			CommitRepo:             repositories.commitRepo,
			ChatRepo:               repositories.chatRepo,
			EngineeringStateRepo:   repositories.engineeringStateRepo,
			GenerationJobRepo:      repositories.generationJobRepo,
			CapabilityAuditRepo:    repositories.capabilityAuditQuery,
			ResourceAlertEventRepo: repositories.resourceAlertEventRepo,
			SystemConfigSvc:        services.systemConfigService,
			ContainerMgr:           containerMgr,
			FileService:            projectFileSvc,
			ContainerCfg:           &cfg.Container,
			ProjectCfg:             &cfg.Project,
			ProjectSecretCfg:       &cfg.ProjectSecrets,
		})
		services.projectService.StartContainerIdleReaper(context.Background())
		if repositories.githubIntegrationRepo != nil {
			services.githubIntegration = service.NewGitHubIntegrationService(
				repositories.githubIntegrationRepo,
				services.projectService,
				cfg.GitHub,
			)
		}
		if repositories.projectDeploymentRepo != nil {
			services.projectDeployment = service.NewProjectDeploymentService(
				repositories.projectDeploymentRepo,
				services.projectService,
				cfg.Deployment,
			)
		}
		if repositories.projectCollaborationRepo != nil && repositories.userRepo != nil {
			services.projectCollaboration = service.NewProjectCollaborationService(repositories.projectCollaborationRepo, services.projectService, repositories.userRepo)
			if err := services.projectCollaboration.EnsureBuiltinTemplates(context.Background()); err != nil {
				log.Printf("Warning: failed to initialize official templates: %v", err)
			}
		}
	}

	if repositories.projectRepo != nil && services.llmClient != nil {
		services.genService = service.NewGeneratorService(service.GeneratorServiceOptions{
			ProjectRepo:             repositories.projectRepo,
			CollaborationRepo:       repositories.projectCollaborationRepo,
			ChatRepo:                repositories.chatRepo,
			FileRepo:                repositories.fileRepo,
			CommitRepo:              repositories.commitRepo,
			LLMClient:               services.llmClient,
			ProviderMgr:             services.providerMgrService,
			LLMCfg:                  &cfg.LLM,
			SystemConfigSvc:         services.systemConfigService,
			ContainerMgr:            containerMgr,
			FileService:             projectFileSvc,
			ContainerCfg:            &cfg.Container,
			BrowserAcceptanceRunner: service.NewHTTPBrowserAcceptanceRunner(cfg.BrowserAcceptance.WorkerURL),
		})
	}

	if services.llmClient != nil {
		services.planService = service.NewPlanService(
			repositories.projectRepo,
			repositories.chatRepo,
			services.llmClient,
			services.providerMgrService,
			&cfg.LLM,
			services.systemConfigService,
		)
	}

	if supabaseClient != nil {
		services.supabaseAuth = auth.NewSupabaseAuthService(supabaseClient, &cfg.JWT, cfg.Database.SupabaseURL)
		log.Println("Auth service initialized with Supabase")
	} else if repositories.userRepo != nil {
		services.traditionalAuth = service.NewAuthService(repositories.userRepo, &cfg.JWT)
	}

	return services, containerMgr, projectFileSvc
}

func initOrchestrations(cfg *config.Config, services serviceSet, repositories repositorySet) orchestrationSet {
	generationJobService := service.NewGenerationJobService(repositories.generationJobRepo)
	stateRecorder := orchestration.NewChatMessageEngineeringStateRecorder(repositories.chatRepo, repositories.engineeringStateRepo)
	capabilityExecutor := orchestration.CapabilityExecutor(orchestration.NoopCapabilityExecutor{})
	capabilityRegistry := buildCapabilityProviderRegistry(cfg)
	logCapabilityProviderPreflight(buildCapabilityProviderPreflight(cfg))
	if repositories.capabilityAuditRepo != nil {
		capabilityExecutor = orchestration.RecordingCapabilityExecutor{
			Delegate: orchestration.ExternalCapabilityExecutor{
				Fallback: orchestration.NoopCapabilityExecutor{},
				SkillRunner: buildCapabilityProviderRunner(
					orchestration.CapabilityProviderSkill,
					cfg,
				),
				MCPRunner: buildCapabilityProviderRunner(
					orchestration.CapabilityProviderMCP,
					cfg,
				),
				Policy:   buildCapabilityExecutionPolicy(cfg),
				Boundary: buildCapabilityRunnerBoundary(cfg),
			},
			AuditRepo: repositories.capabilityAuditRepo,
		}
	}
	return orchestrationSet{
		plan: orchestration.NewPlanOrchestrator(services.planService, services.genService),
		generate: orchestration.NewGenerateOrchestratorWithOptions(services.genService, services.projectService, nil, stateRecorder, orchestration.GenerateOrchestratorOptions{
			GenerationJobService: generationJobService,
			CapabilityExecutor:   capabilityExecutor,
			CapabilityRegistry:   capabilityRegistry,
		}),
	}
}

func logCapabilityProviderPreflight(items []capabilityProviderPreflightItem) {
	for _, item := range items {
		if item.Status != "blocked" {
			continue
		}
		log.Printf("Capability provider preflight blocked: provider=%s runner_mode=%s reason=%s note=%s", item.Provider, item.RunnerMode, item.ReasonCode, item.SourceNote)
	}
}

func buildCapabilityProviderPreflightSnapshot(cfg *config.Config) capabilityProviderPreflightSnapshot {
	items := buildCapabilityProviderPreflight(cfg)
	return capabilityProviderPreflightSnapshot{
		GeneratedAt:  time.Now().UTC().Format(time.RFC3339),
		SourceNote:   "provider preflight 是服务启动时基于当前 CapabilityConfig 生成的只读配置快照；不会访问外部 endpoint，也不代表实时探测结果。",
		Items:        items,
		StatusCounts: capabilityProviderPreflightStatusCounts(items),
	}
}

func buildCapabilityProviderPreflight(cfg *config.Config) []capabilityProviderPreflightItem {
	if cfg == nil {
		return []capabilityProviderPreflightItem{
			capabilityProviderPreflightSkipped(orchestration.CapabilityProviderSkill, "", "provider_preflight_config_missing", "未加载能力配置；Skill runner 预检跳过，默认不启用真实外部调用。", nil),
			capabilityProviderPreflightSkipped(orchestration.CapabilityProviderMCP, "", "provider_preflight_config_missing", "未加载能力配置；MCP runner 预检跳过，默认不启用真实外部调用。", nil),
		}
	}

	boundary := buildCapabilityRunnerBoundary(cfg)
	return []capabilityProviderPreflightItem{
		buildCapabilityProviderPreflightItem(orchestration.CapabilityProviderSkill, cfg.Capability.SkillRunnerMode, cfg.Capability.SkillRunnerEndpoint, boundary),
		buildCapabilityProviderPreflightItem(orchestration.CapabilityProviderMCP, cfg.Capability.MCPRunnerMode, cfg.Capability.MCPRunnerEndpoint, boundary),
	}
}

func buildCapabilityProviderPreflightItem(provider, runnerMode, endpoint string, boundary orchestration.CapabilityRunnerBoundary) capabilityProviderPreflightItem {
	mode := strings.TrimSpace(strings.ToLower(runnerMode))
	metadata := map[string]interface{}{
		"provider":        provider,
		"runner_mode":     mode,
		"network_enabled": boundary.NetworkEnabled,
		"allowed_targets": boundary.AllowedTargets,
		"config_keys":     capabilityProviderPreflightConfigKeys(provider, "runner_mode"),
	}

	if mode == "" {
		return capabilityProviderPreflightSkipped(provider, mode, "provider_runner_mode_empty", "未配置外部 provider runner mode；预检跳过，默认不启用真实外部调用。", metadata)
	}
	if mode == "dry-run" || mode == "contract" {
		return capabilityProviderPreflightReady(provider, mode, "provider_runner_preflight_not_required", "当前 runner mode 不发起网络调用，无需 endpoint 预检。", metadata)
	}
	if provider == orchestration.CapabilityProviderSkill && mode != "skill-http" {
		return capabilityProviderPreflightBlocked(provider, mode, "provider_runner_mode_mismatch", "Skill provider 只能使用 dry-run、contract 或 skill-http runner mode。", metadata)
	}
	if provider == orchestration.CapabilityProviderMCP && mode != "mcp-http" {
		return capabilityProviderPreflightBlocked(provider, mode, "provider_runner_mode_mismatch", "MCP provider 只能使用 dry-run、contract 或 mcp-http runner mode。", metadata)
	}

	endpoint = strings.TrimSpace(endpoint)
	metadata["endpoint"] = endpoint
	metadata["config_keys"] = capabilityProviderPreflightConfigKeys(provider, "endpoint")
	if endpoint == "" {
		return capabilityProviderPreflightBlocked(provider, mode, "provider_runner_endpoint_missing", "HTTP runner mode 已启用，但未配置对应 endpoint。", metadata)
	}

	validation := boundary.ValidateNetworkTarget(endpoint)
	metadata = mergePreflightMetadata(metadata, validation.Metadata)
	if validation.Status != orchestration.CapabilityExecutionResultStatusExecuted {
		metadata["config_keys"] = capabilityProviderPreflightConfigKeys(provider, validation.ReasonCode)
		return capabilityProviderPreflightBlocked(provider, mode, validation.ReasonCode, validation.SourceNote, metadata)
	}
	metadata["config_keys"] = capabilityProviderPreflightConfigKeys(provider, "provider_runner_preflight_ready")
	return capabilityProviderPreflightReady(provider, mode, "provider_runner_preflight_ready", "HTTP runner endpoint 已通过网络边界预检。", metadata)
}

func capabilityProviderPreflightConfigKeys(provider, scope string) []string {
	runnerModeKey := "CAPABILITY_MCP_RUNNER_MODE"
	endpointKey := "CAPABILITY_MCP_RUNNER_ENDPOINT"
	if provider == orchestration.CapabilityProviderSkill {
		runnerModeKey = "CAPABILITY_SKILL_RUNNER_MODE"
		endpointKey = "CAPABILITY_SKILL_RUNNER_ENDPOINT"
	}

	switch scope {
	case "runner_mode", "provider_runner_mode_empty", "provider_runner_mode_mismatch":
		return []string{runnerModeKey}
	case "endpoint", "provider_runner_endpoint_missing", "provider_runner_network_target_invalid":
		return []string{runnerModeKey, endpointKey}
	case "provider_runner_network_disabled":
		return []string{runnerModeKey, endpointKey, "CAPABILITY_RUNNER_NETWORK_ENABLED"}
	case "provider_runner_network_target_denied":
		return []string{runnerModeKey, endpointKey, "CAPABILITY_RUNNER_NETWORK_ALLOWLIST"}
	case "provider_runner_preflight_ready":
		return []string{runnerModeKey, endpointKey, "CAPABILITY_RUNNER_NETWORK_ENABLED", "CAPABILITY_RUNNER_NETWORK_ALLOWLIST"}
	default:
		return []string{runnerModeKey}
	}
}

func capabilityProviderPreflightSkipped(provider, mode, reasonCode, sourceNote string, metadata map[string]interface{}) capabilityProviderPreflightItem {
	return capabilityProviderPreflightItem{
		Provider:   provider,
		RunnerMode: mode,
		Status:     "skipped",
		Severity:   capabilityProviderPreflightSeverity("skipped"),
		ReasonCode: reasonCode,
		SourceNote: sourceNote,
		NextAction: capabilityProviderPreflightNextAction(reasonCode, provider),
		Metadata:   metadata,
	}
}

func capabilityProviderPreflightReady(provider, mode, reasonCode, sourceNote string, metadata map[string]interface{}) capabilityProviderPreflightItem {
	return capabilityProviderPreflightItem{
		Provider:   provider,
		RunnerMode: mode,
		Status:     "ready",
		Severity:   capabilityProviderPreflightSeverity("ready"),
		ReasonCode: reasonCode,
		SourceNote: sourceNote,
		NextAction: capabilityProviderPreflightNextAction(reasonCode, provider),
		Metadata:   metadata,
	}
}

func capabilityProviderPreflightBlocked(provider, mode, reasonCode, sourceNote string, metadata map[string]interface{}) capabilityProviderPreflightItem {
	return capabilityProviderPreflightItem{
		Provider:   provider,
		RunnerMode: mode,
		Status:     "blocked",
		Severity:   capabilityProviderPreflightSeverity("blocked"),
		ReasonCode: reasonCode,
		SourceNote: sourceNote,
		NextAction: capabilityProviderPreflightNextAction(reasonCode, provider),
		Metadata:   metadata,
	}
}

func capabilityProviderPreflightSeverity(status string) string {
	switch status {
	case "ready":
		return "info"
	case "skipped":
		return "warning"
	case "blocked":
		return "critical"
	default:
		return "warning"
	}
}

func capabilityProviderPreflightNextAction(reasonCode, provider string) string {
	switch reasonCode {
	case "provider_preflight_config_missing":
		return "检查服务启动配置是否已加载 CapabilityConfig；保持默认关闭时无需处理。"
	case "provider_runner_mode_empty":
		return "如需启用外部能力，显式配置对应 provider runner mode；否则可保持跳过状态。"
	case "provider_runner_preflight_not_required":
		return "当前 runner mode 不需要 endpoint 预检；继续确认 provider enabled 与 execution policy 是否符合预期。"
	case "provider_runner_mode_mismatch":
		return "检查 " + provider + " 的 runner mode 是否与 provider 类型匹配。"
	case "provider_runner_endpoint_missing":
		return "为 HTTP runner mode 配置对应 endpoint，或切回 dry-run / contract / 空 runner mode。"
	case "provider_runner_network_disabled":
		return "确认是否允许真实网络调用；如需启用，配置网络开关与 allowlist。"
	case "provider_runner_network_target_invalid":
		return "检查 endpoint 是否为合法 URL，并确保目标可被网络边界解析。"
	case "provider_runner_network_target_denied":
		return "将 endpoint host 加入 CAPABILITY_RUNNER_NETWORK_ALLOWLIST，或改用已允许的目标。"
	case "provider_runner_preflight_ready":
		return "endpoint 已通过启动快照预检；真实执行仍需同时满足 provider、policy、runner 与 network 门禁。"
	default:
		return "查看 reason_code、source_note 与 metadata，按 CapabilityConfig 和网络边界配置排查。"
	}
}

func mergePreflightMetadata(base map[string]interface{}, values map[string]interface{}) map[string]interface{} {
	if base == nil {
		base = map[string]interface{}{}
	}
	for key, value := range values {
		base[key] = value
	}
	return base
}

func buildCapabilityProviderRunner(provider string, cfg *config.Config) orchestration.CapabilityProviderRunner {
	if cfg == nil {
		return nil
	}

	mode := ""
	manifestPath := ""
	endpoint := ""
	switch provider {
	case orchestration.CapabilityProviderSkill:
		mode = cfg.Capability.SkillRunnerMode
		manifestPath = cfg.Capability.SkillRunnerManifest
		endpoint = cfg.Capability.SkillRunnerEndpoint
	case orchestration.CapabilityProviderMCP:
		mode = cfg.Capability.MCPRunnerMode
		manifestPath = cfg.Capability.MCPRunnerManifest
		endpoint = cfg.Capability.MCPRunnerEndpoint
	}

	switch strings.TrimSpace(strings.ToLower(mode)) {
	case "dry-run":
		return orchestration.DryRunCapabilityProviderRunner{
			Provider:   provider,
			SourceNote: cfg.Capability.ExecutionPolicyNote,
		}
	case "contract":
		return orchestration.ContractCapabilityProviderRunner{
			Provider:     provider,
			ManifestPath: manifestPath,
			SourceNote:   cfg.Capability.ExecutionPolicyNote,
		}
	case "skill-http":
		if provider != orchestration.CapabilityProviderSkill {
			return nil
		}
		return orchestration.SkillHTTPCapabilityProviderRunner{
			Endpoint:   endpoint,
			SourceNote: cfg.Capability.ExecutionPolicyNote,
		}
	case "mcp-http":
		if provider != orchestration.CapabilityProviderMCP {
			return nil
		}
		return orchestration.MCPHTTPCapabilityProviderRunner{
			Endpoint:   endpoint,
			SourceNote: cfg.Capability.ExecutionPolicyNote,
		}
	default:
		return nil
	}
}

func buildCapabilityProviderRegistry(cfg *config.Config) orchestration.CapabilityProviderRegistry {
	if cfg == nil {
		return orchestration.NewDefaultCapabilityProviderRegistry()
	}

	return orchestration.NewCapabilityProviderRegistry(orchestration.CapabilityProviderRegistryOptions{
		EnableSkillProvider: cfg.Capability.EnableSkillProvider,
		EnableMCPProvider:   cfg.Capability.EnableMCPProvider,
		SourceNote:          cfg.Capability.ExecutionPolicyNote,
	})
}

func buildCapabilityExecutionPolicy(cfg *config.Config) orchestration.CapabilityExecutionPolicy {
	if cfg == nil {
		return orchestration.CapabilityExecutionPolicy{
			SourceNote: "未加载能力执行配置；默认不允许真实调用外部 Skill / MCP runner。",
		}
	}

	sourceNote := cfg.Capability.ExecutionPolicyNote
	if sourceNote == "" {
		sourceNote = "能力执行策略来自后端配置；未显式启用的外部 provider 保持禁用。"
	}

	return orchestration.CapabilityExecutionPolicy{
		EnableSkill: cfg.Capability.EnableSkillExecution,
		EnableMCP:   cfg.Capability.EnableMCPExecution,
		SourceNote:  sourceNote,
	}
}

func buildCapabilityRunnerBoundary(cfg *config.Config) orchestration.CapabilityRunnerBoundary {
	if cfg == nil {
		return orchestration.CapabilityRunnerBoundary{
			Timeout:        30 * time.Second,
			NetworkEnabled: false,
			PermissionNote: "未加载能力 runner 边界配置；默认关闭网络调用。",
		}
	}

	timeoutSeconds := cfg.Capability.RunnerTimeoutSeconds
	if timeoutSeconds <= 0 {
		timeoutSeconds = 30
	}

	return orchestration.CapabilityRunnerBoundary{
		Timeout:        time.Duration(timeoutSeconds) * time.Second,
		NetworkEnabled: cfg.Capability.NetworkEnabled,
		AllowedTargets: cfg.Capability.NetworkAllowlist,
		PermissionNote: firstNonEmptyString(
			cfg.Capability.ExecutionPolicyNote,
			"能力 runner 边界来自后端配置；网络调用默认关闭，启用后仍需 allowlist。",
		),
	}
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func detectRepoRoot() string {
	cwd, err := os.Getwd()
	if err != nil {
		return ""
	}
	if filepath.Base(cwd) == "backend" {
		return filepath.Dir(cwd)
	}
	return cwd
}

func initHandlers(repositories repositorySet, services serviceSet, orchestrations orchestrationSet, cfg *config.Config) handlerSet {
	handlers := handlerSet{
		modelsHandler:        handler.NewModelsHandler(services.llmClient),
		generateHandler:      handler.NewGenerateHandler(orchestrations.generate),
		projectHandler:       handler.NewProjectHandler(services.projectService, orchestrations.plan, orchestrations.generate, services.projectMessageService, services.capabilityAuditService, cfg),
		githubHandler:        handler.NewGitHubIntegrationHandler(services.githubIntegration, services.projectService),
		deploymentHandler:    handler.NewProjectDeploymentHandler(services.projectDeployment, services.projectService),
		collaborationHandler: handler.NewProjectCollaborationHandler(services.projectCollaboration, services.projectService),
		llmProviderHandler:   handler.NewLLMProviderHandler(repositories.llmProviderRepo, services.providerMgrService),
	}

	if services.supabaseAuth != nil {
		handlers.authHandler = handler.NewAuthHandler(services.supabaseAuth)
	} else if services.traditionalAuth != nil {
		handlers.authHandler = handler.NewAuthHandlerWithService(services.traditionalAuth)
	} else {
		log.Println("Warning: No auth service available")
	}

	if services.systemConfigService != nil {
		handlers.adminHandler = handler.NewAdminHandler(service.NewAdminConsoleService(
			services.systemConfigService,
			repositories.userRepo,
			repositories.auditRepo,
			repositories.adminRepo,
			repositories.projectRepo,
		))
	}

	if repositories.adminRepo != nil {
		handlers.adminAuthHandler = handler.NewAdminAuthHandler(repositories.adminRepo, &cfg.JWT)
	}

	return handlers
}
