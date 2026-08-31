// Package main 程序入口
package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/joho/godotenv"
	"gorm.io/gorm"

	"yistack/config"
	"yistack/internal/handler"
	"yistack/internal/middleware"
	"yistack/internal/model"
	"yistack/internal/service"
	"yistack/pkg/container"
	"yistack/pkg/llm"
)

func main() {
	// 统一从项目根目录 .env 读取配置。
	// 开发脚本常在 backend/ 目录内启动，这里同时兼容 `../.env` 与 `.env` 两种工作目录。
	if shouldLoadDotEnv() {
		if err := godotenv.Load("../.env", ".env"); err != nil {
			log.Println("No .env file found, using environment variables")
		}
	} else {
		log.Println("Skipping .env loading because YISTACK_SKIP_DOTENV=true")
	}
	// 加载配置
	cfg := config.Load()

	bootstrap, err := bootstrapApplication(cfg)
	if err != nil {
		log.Fatalf("Application bootstrap failed: %v", err)
	}
	previewGateway := handler.NewPreviewGateway(bootstrap.services.projectService, cfg)
	backgroundCtx, stopBackgroundTasks := context.WithCancel(context.Background())
	if bootstrap.services.projectService != nil {
		bootstrap.services.projectService.StartProjectAutomaticBackupScheduler(backgroundCtx)
	}

	// 创建服务器
	port := cfg.Server.Port
	if port == "" {
		port = "8080"
	}

	host := strings.TrimSpace(cfg.Server.Host)
	if host == "" {
		host = "127.0.0.1"
	}

	h := server.New(
		server.WithHostPorts(net.JoinHostPort(host, port)),
	)

	// 全局中间件
	h.Use(middleware.Recovery())                             // 恢复 panic
	h.Use(middleware.RequestID())                            // 请求 ID
	h.Use(middleware.SecurityHeaders())                      // 安全头
	h.Use(middleware.CORS())                                 // CORS
	h.Use(middleware.RequestLogger(&middleware.LoggerConfig{ // 日志
		EnableRequestBody:  false,
		EnableResponseBody: false,
	}))
	h.Use(middleware.ErrorHandler()) // 错误处理

	// 限流中间件（每分钟 60 次请求）
	rateLimiter := middleware.NewRateLimiter(middleware.NewRateLimiterConfig(60))
	h.Use(rateLimiter.RateLimit())

	// 注册路由
	registerRoutes(
		h,
		bootstrap.handlers.modelsHandler,
		bootstrap.handlers.generateHandler,
		bootstrap.handlers.projectHandler,
		bootstrap.handlers.githubHandler,
		bootstrap.handlers.deploymentHandler,
		bootstrap.handlers.collaborationHandler,
		bootstrap.handlers.authHandler,
		bootstrap.handlers.adminHandler,
		bootstrap.handlers.adminAuthHandler,
		bootstrap.handlers.llmProviderHandler,
		bootstrap.repositories.userRepo,
		bootstrap.repositories.adminRepo,
		bootstrap.capabilityProviderPreflight,
		&cfg.JWT,
	)

	// 启动服务器
	go func() {
		fmt.Printf("🚀 YiStack Backend Server starting on %s\n", net.JoinHostPort(host, port))
		if err := h.Run(); err != nil {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	var previewServer *http.Server
	if cfg.Container.PreviewPort > 0 && previewGateway != nil {
		previewListenAddr := buildPreviewListenAddr(cfg)
		previewServer = &http.Server{
			Addr:              previewListenAddr,
			Handler:           previewGateway,
			ReadHeaderTimeout: 10 * time.Second,
		}
		go func() {
			log.Printf("🚀 YiStack Preview Gateway starting on %s", previewListenAddr)
			if err := previewServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Fatalf("Preview gateway failed to start: %v", err)
			}
		}()
	}

	// 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	fmt.Println("Shutting down server...")
	stopBackgroundTasks()

	if previewServer != nil {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_ = previewServer.Shutdown(shutdownCtx)
		cancel()
	}

	if bootstrap.db != nil {
		bootstrap.db.Close()
	}

	fmt.Println("Server stopped")
}

func buildPreviewListenAddr(cfg *config.Config) string {
	if cfg == nil {
		return "127.0.0.1:3100"
	}

	port := cfg.Container.PreviewPort
	if port <= 0 {
		port = 3100
	}

	host := strings.TrimSpace(cfg.Container.PreviewBindHost)
	if host == "" {
		host = "127.0.0.1"
	}

	return net.JoinHostPort(host, fmt.Sprintf("%d", port))
}

// migrateDatabase 迁移数据库表结构
func migrateDatabase(db *gorm.DB) error {
	if err := db.AutoMigrate(
		// 用户相关
		&model.User{},
		&model.Admin{},
		&model.AdminRole{},
		&model.AdminPermission{},
		&model.AdminRolePermission{},
		&model.AdminUserRole{},
		&model.AdminSetting{},
		&model.AdminAuditLog{},
		&model.EnterpriseOrganization{},
		&model.EnterpriseTeam{},
		&model.EnterpriseMember{},
		&model.EnterpriseProjectOwnership{},
		&model.EnterpriseProjectAccessGuardActivationAudit{},
		&model.EnterpriseAuditExportTask{},
		&model.EnterpriseAuditExportDeliveryReport{},
		&model.EnterpriseAuditExportWorkerExecutionRequest{},

		// 项目相关
		&model.Project{},
		&model.ProjectFile{},
		&model.ProjectEngineeringState{},
		&model.ProjectCapabilityExecutionAudit{},
		&model.ProjectResourceAlertEvent{},
		&model.GenerationJob{},
		&model.GenerationAttempt{},
		&model.GenerationEvent{},
		&model.GitHubConnection{},
		&model.GitHubOAuthState{},
		&model.GitHubProjectBinding{},
		&model.GitHubSyncOperation{},
		&model.GitHubWebhookDelivery{},
		&model.ProjectDeploymentBinding{},
		&model.ProjectDeploymentRelease{},
		&model.ProjectDeploymentDomain{},
		&model.ProjectDeploymentOperation{},
		&model.ProjectMember{},
		&model.ProjectCollaborationAudit{},
		&model.OfficialProjectTemplate{},
		&model.OfficialProjectTemplateVersion{},
		&model.OfficialProjectTemplateAudit{},
		&model.Commit{},
		&model.Plan{},

		// 聊天相关
		&model.ChatMessage{},

		// 系统配置
		&model.SystemConfig{},

		// LLM 提供商配置
		&model.LLMProvider{},
	); err != nil {
		return err
	}

	return nil
}

// initLLMProviders 初始化默认 LLM 提供商
func initLLMProviders(repo service.LLMProviderRepo) error {
	if repo == nil {
		return nil
	}
	return repo.InitDefaults(context.TODO())
}

// initLLMFromEnv 从环境变量初始化 LLM 配置
func initLLMFromEnv(repo service.LLMProviderRepo) {
	if repo == nil {
		return
	}

	ctx := context.Background()

	// 检查并更新各个提供商的 API Key
	providers := map[string]string{
		"doubao":     os.Getenv("DOUBAO_API_KEY"),
		"openai":     os.Getenv("OPENAI_API_KEY"),
		"qwen":       os.Getenv("QWEN_API_KEY"),
		"openrouter": os.Getenv("OPENROUTER_API_KEY"),
		"kimi":       os.Getenv("KIMI_API_KEY"),
		"deepseek":   os.Getenv("DEEPSEEK_API_KEY"),
	}

	for name, apiKey := range providers {
		if apiKey == "" {
			continue
		}

		provider, err := repo.FindByName(ctx, name)
		if err != nil {
			continue
		}

		provider.APIKey = apiKey
		if err := repo.Update(ctx, provider); err != nil {
			log.Printf("Failed to update %s API key: %v", name, err)
		} else {
			log.Printf("Updated %s API key from environment", name)
		}
	}
}

func shouldLoadDotEnv() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("YISTACK_SKIP_DOTENV")), "true") == false
}

// initContainerManager 初始化容器管理器
func initContainerManager(cfg *config.Config) (*container.Manager, error) {
	if cfg == nil {
		return nil, fmt.Errorf("config is required")
	}

	// 创建配置
	containerConfig := &container.Config{
		SocketPath:     cfg.Container.SocketPath,
		ProjectDir:     cfg.Container.ProjectDir,
		TemplateDir:    cfg.Container.TemplateDir,
		PortRangeStart: cfg.Container.PortRangeStart,
		PortRangeEnd:   cfg.Container.PortRangeEnd,
		DefaultMemory:  cfg.Container.DefaultMemory,
		DefaultCPU:     parseCPU(cfg.Container.DefaultCPU),
		IdleTimeout:    time.Duration(cfg.Container.IdleTimeoutMin) * time.Minute,
		PreheatImages:  configuredPreheatImages(cfg),
	}

	// 创建容器管理器
	mgr, err := container.NewManager(containerConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create container manager: %w", err)
	}

	// 预热镜像（后台进行，不阻塞启动）
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()

		if err := mgr.PreheatImages(ctx); err != nil {
			log.Printf("Image preheating failed: %v", err)
		} else {
			log.Println("Image preheating completed")
		}
	}()

	// 创建必要目录
	if err := os.MkdirAll(cfg.Container.ProjectDir, 0755); err != nil {
		log.Printf("Failed to create project directory: %v", err)
	}
	if err := os.MkdirAll(cfg.Container.TemplateDir, 0755); err != nil {
		log.Printf("Failed to create template directory: %v", err)
	}

	return mgr, nil
}

func configuredPreheatImages(cfg *config.Config) []string {
	if cfg == nil {
		return nil
	}

	seen := make(map[string]struct{})
	images := make([]string, 0, len(cfg.Container.Images))
	for _, item := range cfg.Container.Images {
		if item.Enabled != nil && !*item.Enabled {
			continue
		}
		image := strings.TrimSpace(item.Image)
		if image == "" {
			continue
		}
		if _, exists := seen[image]; exists {
			continue
		}
		seen[image] = struct{}{}
		images = append(images, image)
	}
	return images
}

// registerRoutes 注册路由
func registerRoutes(
	h *server.Hertz,
	modelsHandler *handler.ModelsHandler,
	generateHandler *handler.GenerateHandler,
	projectHandler *handler.ProjectHandler,
	githubHandler *handler.GitHubIntegrationHandler,
	deploymentHandler *handler.ProjectDeploymentHandler,
	collaborationHandler *handler.ProjectCollaborationHandler,
	authHandler *handler.AuthHandler,
	adminHandler *handler.AdminHandler,
	adminAuthHandler *handler.AdminAuthHandler,
	llmProviderHandler *handler.LLMProviderHandler,
	userRepo service.UserRepo,
	adminRepo service.AdminRepo,
	capabilityProviderPreflight capabilityProviderPreflightSnapshot,
	jwtCfg *config.JWTConfig,
) {
	// API 路由组
	api := h.Group("/api")

	// 健康检查（公开）
	api.GET("/health", func(c context.Context, ctx *app.RequestContext) {
		ctx.JSON(200, map[string]string{
			"service": "yistack-backend",
			"status":  "ok",
		})
	})

	// Auth 路由（公开）
	auth := api.Group("/auth")
	auth.POST("/register", authHandler.Register)
	auth.POST("/login", authHandler.Login)
	auth.POST("/refresh", authHandler.RefreshToken)

	// Auth 路由（需要认证）
	authProtected := api.Group("/auth")
	authProtected.Use(middleware.Auth(middleware.NewUserAuthConfig(jwtCfg, userRepo)))
	authProtected.GET("/profile", authHandler.GetProfile)
	authProtected.PUT("/profile", authHandler.UpdateProfile)
	authProtected.POST("/change-password", authHandler.ChangePassword)
	authProtected.POST("/logout", authHandler.Logout)

	// Admin Auth 路由（管理员登录）
	adminAuth := api.Group("/admin/auth")
	adminAuth.POST("/login", adminAuthHandler.Login)
	adminAuthProtected := api.Group("/admin/auth")
	adminAuthProtected.Use(middleware.Auth(middleware.NewAdminAuthConfig(jwtCfg, adminRepo)))
	adminAuthProtected.Use(middleware.RequireRole("admin", "super_admin"))
	adminAuthProtected.POST("/refresh", adminAuthHandler.RefreshToken)
	adminAuthProtected.GET("/profile", adminAuthHandler.GetProfile)
	adminAuthProtected.POST("/change-password", adminAuthHandler.ChangePassword)

	// Chat 路由
	// /generate 需要认证，确保生成链路具备用户身份与项目归属校验上下文。
	chat := api.Group("/chat")
	chat.GET("/models", modelsHandler.GetModels)
	chatProtected := api.Group("/chat")
	chatProtected.Use(middleware.Auth(middleware.NewUserAuthConfig(jwtCfg, userRepo)))
	chatProtected.POST("/generate", generateHandler.Generate)

	api.GET("/github/oauth/callback", githubHandler.CompleteOAuth)
	api.POST("/github/webhook", githubHandler.Webhook)
	githubProtected := api.Group("/github")
	githubProtected.Use(middleware.Auth(middleware.NewUserAuthConfig(jwtCfg, userRepo)))
	githubProtected.GET("/connection", githubHandler.GetConnection)
	githubProtected.POST("/oauth/start", githubHandler.StartOAuth)
	githubProtected.DELETE("/connection", githubHandler.Disconnect)
	githubProtected.GET("/repositories", githubHandler.ListRepositories)

	api.GET("/project/terminal/ws", projectHandler.TerminalWebSocket())

	// Project 路由（需要用户认证）
	project := api.Group("/project")
	project.Use(middleware.Auth(middleware.NewUserAuthConfig(jwtCfg, userRepo)))
	project.POST("/create", projectHandler.Create)
	project.GET("/list", projectHandler.List)
	project.GET("/templates", collaborationHandler.ListTemplates)
	project.GET("/templates/:template_id/versions", collaborationHandler.ListTemplateVersions)
	project.POST("/templates/create", collaborationHandler.CreateFromTemplate)
	project.GET("/:id/capability-audits", projectHandler.ListCapabilityAudits)
	project.GET("/:id", projectHandler.Get)
	project.GET("/:id/access", collaborationHandler.GetAccess)
	project.GET("/:id/members", collaborationHandler.ListMembers)
	project.POST("/:id/members", collaborationHandler.AddOrUpdateMember)
	project.DELETE("/:id/members", collaborationHandler.RemoveMember)
	project.GET("/:id/collaboration-audits", collaborationHandler.ListAudits)
	project.DELETE("/:id", projectHandler.Delete)
	project.POST("/:id/restore", projectHandler.RestoreDeleted)
	project.PUT("/:id", projectHandler.Update)
	project.POST("/:id/preview-share", projectHandler.EnablePreviewShare)
	project.DELETE("/:id/preview-share", projectHandler.DisablePreviewShare)
	project.GET("/:id/backups", projectHandler.ListBackups)
	project.GET("/:id/backups/policy-readiness", projectHandler.GetBackupPolicyReadiness)
	project.GET("/:id/backups/remote-storage-readiness", projectHandler.GetBackupRemoteStorageReadiness)
	project.GET("/:id/backups/remote-inventory", projectHandler.ListBackupRemoteInventory)
	project.POST("/:id/backups/remote-upload", projectHandler.UploadBackupToRemoteStorage)
	project.POST("/:id/backups/remote-download", projectHandler.DownloadBackupFromRemoteStorage)
	project.POST("/:id/backups/remote-restore", projectHandler.RestoreBackupFromRemoteStorage)
	project.GET("/:id/backups/:backup_id/download", projectHandler.DownloadBackup)
	project.POST("/:id/backups/create", projectHandler.CreateBackup)
	project.POST("/:id/backups/automatic-run", projectHandler.RunAutomaticBackup)
	project.POST("/:id/backups/restore-preflight", projectHandler.PreflightBackupRestore)
	project.POST("/:id/backups/restore", projectHandler.RestoreBackup)
	project.GET("/:id/messages", projectHandler.GetMessages)
	project.POST("/:id/messages", projectHandler.SaveMessages)
	project.GET("/:id/branches", projectHandler.GetBranches)
	project.GET("/:id/remotes", projectHandler.GetRemotes)
	project.GET("/:id/remote-branches", projectHandler.GetRemoteBranches)
	project.POST("/:id/remote-branches/refresh", projectHandler.RefreshRemoteBranches)
	project.GET("/:id/github/binding", githubHandler.GetProjectBinding)
	project.POST("/:id/github/import", githubHandler.ImportRepository)
	project.POST("/:id/github/pull", githubHandler.PullRepository)
	project.POST("/:id/github/push", githubHandler.PushRepository)
	project.GET("/:id/deployment/provider", deploymentHandler.GetProviderStatus)
	project.GET("/:id/deployment/releases", deploymentHandler.ListReleases)
	project.POST("/:id/deployment/releases", deploymentHandler.Deploy)
	project.GET("/:id/deployment/releases/:release_id", deploymentHandler.RefreshRelease)
	project.GET("/:id/deployment/releases/:release_id/logs", deploymentHandler.ReleaseLogs)
	project.POST("/:id/deployment/rollback", deploymentHandler.Rollback)
	project.GET("/:id/deployment/domains", deploymentHandler.ListDomains)
	project.POST("/:id/deployment/domains", deploymentHandler.AddDomain)
	project.POST("/:id/deployment/domains/verify", deploymentHandler.VerifyDomain)
	project.DELETE("/:id/deployment/domains", deploymentHandler.RemoveDomain)
	project.GET("/:id/tags", projectHandler.GetTags)
	project.POST("/:id/tags/create", projectHandler.CreateTag)
	project.POST("/:id/tags/delete", projectHandler.DeleteTag)
	project.GET("/:id/stashes", projectHandler.GetStashes)
	project.POST("/:id/stashes/create", projectHandler.CreateStash)
	project.POST("/:id/stashes/apply", projectHandler.ApplyStash)
	project.GET("/:id/worktree-status", projectHandler.GetWorktreeStatus)
	project.POST("/:id/worktree/commit", projectHandler.CommitWorktree)
	project.POST("/:id/worktree/discard-file", projectHandler.DiscardWorktreeFile)
	project.GET("/:id/branches/compare", projectHandler.GetBranchCompare)
	project.POST("/:id/branches/compare/apply-file", projectHandler.ApplyBranchCompareFile)
	project.GET("/:id/branches/switch-readiness", projectHandler.GetBranchSwitchReadiness)
	project.POST("/:id/branches/create", projectHandler.CreateBranch)
	project.POST("/:id/branches/delete", projectHandler.DeleteBranch)
	project.POST("/:id/branches/create-from-remote", projectHandler.CreateBranchFromRemote)
	project.POST("/:id/branches/rename", projectHandler.RenameBranch)
	project.POST("/:id/branches/switch", projectHandler.SwitchBranch)
	project.GET("/:id/commits", projectHandler.GetCommits)
	project.GET("/:id/commits/:hash", projectHandler.GetCommit)
	project.POST("/:id/commits/restore", projectHandler.RestoreCommit)
	project.POST("/:id/commits/restore-file", projectHandler.RestoreCommitFile)
	// 容器管理
	project.POST("/:id/start", projectHandler.StartContainer)
	project.GET("/:id/runtime-status", projectHandler.GetRuntimeStatus)
	project.POST("/:id/runtime-activity", projectHandler.TouchRuntimeActivity)
	project.GET("/:id/resource-snapshot", projectHandler.GetResourceSnapshot)
	project.GET("/:id/resource-alert-readiness", projectHandler.GetResourceAlertReadiness)
	project.GET("/:id/resource-alert-evaluation-preview", projectHandler.GetResourceAlertEvaluationPreview)
	project.GET("/:id/resource-alert-events", projectHandler.ListResourceAlertEvents)
	project.GET("/:id/resource-alert-notification-readiness", projectHandler.GetResourceAlertNotificationReadiness)
	project.GET("/:id/resource-alert-enforcement-readiness", projectHandler.GetResourceAlertEnforcementReadiness)
	project.POST("/:id/resource-alert-events/create", projectHandler.CreateResourceAlertEvent)
	project.POST("/:id/resource-alert-notification/send", projectHandler.SendResourceAlertNotification)
	project.POST("/:id/resource-alert-enforcement/execute", projectHandler.ExecuteResourceAlertEnforcement)
	project.POST("/:id/stop", projectHandler.StopContainer)
	project.GET("/:id/generation/status", projectHandler.GetGenerationStatus)
	project.GET("/:id/generation/events", projectHandler.GetGenerationEvents)
	project.POST("/:id/generation/stop", projectHandler.StopGeneration)
	project.POST("/start/:id", projectHandler.StartContainer)
	project.POST("/stop/:id", projectHandler.StopContainer)
	// 文件管理
	project.GET("/:id/files", projectHandler.GetFileTree)
	project.GET("/:id/files/content", projectHandler.ReadFile)
	project.PUT("/:id/files/content", projectHandler.WriteFile)
	project.POST("/:id/files/operation", projectHandler.ApplyFileOperation)
	// 容器命令执行
	project.POST("/:id/exec", projectHandler.ExecuteCommand)
	project.POST("/:id/terminal/ws-ticket", projectHandler.CreateTerminalWebSocketTicket)
	project.POST("/:id/terminal/sessions", projectHandler.CreateTerminalSession)
	project.GET("/:id/terminal/sessions/:sessionId/output", projectHandler.GetTerminalOutput)
	project.POST("/:id/terminal/sessions/:sessionId/input", projectHandler.SendTerminalInput)
	project.POST("/:id/terminal/sessions/:sessionId/resize", projectHandler.ResizeTerminalSession)
	project.DELETE("/:id/terminal/sessions/:sessionId", projectHandler.CloseTerminalSession)
	// 方案生成
	project.POST("/plans", projectHandler.GeneratePlans)

	// Admin 路由（需要管理员权限）
	admin := api.Group("/admin")
	admin.Use(middleware.Auth(middleware.NewAdminAuthConfig(jwtCfg, adminRepo)))
	admin.Use(middleware.RequireRole("admin", "super_admin"))
	admin.Use(middleware.RequireAdminPasswordChanged())
	admin.GET("/config", adminHandler.GetConfig)
	admin.PUT("/config/:key", adminHandler.UpdateConfig)
	admin.GET("/users", adminHandler.ListUsers)
	admin.PUT("/users/:id", adminHandler.UpdateUser)
	admin.DELETE("/users/:id", adminHandler.DeleteUser)
	admin.GET("/projects", projectHandler.ListAdminProjects)
	admin.GET("/project-templates", collaborationHandler.ListAdminTemplates)
	admin.POST("/project-templates", collaborationHandler.PublishTemplate)
	admin.GET("/project-templates/:template_id/versions", collaborationHandler.ListTemplateVersions)
	admin.POST("/project-templates/:template_id/rollback", collaborationHandler.RollbackTemplate)
	admin.GET("/audit", adminHandler.ListAuditLogs)
	admin.GET("/enterprise/sso-discovery-readiness", adminHandler.GetEnterpriseSsoDiscoveryReadiness)
	admin.GET("/enterprise/private-deployment-readiness", adminHandler.GetEnterprisePrivateDeploymentReadiness)
	admin.GET("/enterprise/commercial-readiness", adminHandler.GetEnterpriseCommercialReadiness)
	admin.GET("/enterprise/organization-readiness", adminHandler.GetEnterpriseOrganizationReadiness)
	admin.GET("/enterprise/project-ownership-readiness", adminHandler.GetEnterpriseProjectOwnershipReadiness)
	admin.GET("/enterprise/project-ownership-preflight", adminHandler.GetEnterpriseProjectOwnershipPreflight)
	admin.GET("/enterprise/project-ownership-mappings", adminHandler.GetEnterpriseProjectOwnershipMappings)
	admin.GET("/enterprise/project-ownership-owner-guard-readiness", adminHandler.GetEnterpriseProjectOwnershipOwnerGuardReadiness)
	admin.GET("/enterprise/project-access-guard-switch-readiness", adminHandler.GetEnterpriseProjectAccessGuardSwitchReadiness)
	admin.GET("/enterprise/project-access-guard-authorization-dry-run", adminHandler.GetEnterpriseProjectAccessGuardAuthorizationDryRunEvidence)
	admin.GET("/enterprise/project-access-guard-activation-readiness", adminHandler.GetEnterpriseProjectAccessGuardActivationReadiness)
	admin.GET("/enterprise/project-access-guard-activation-audit-readiness", adminHandler.GetEnterpriseProjectAccessGuardActivationAuditReadiness)
	admin.GET("/enterprise/audit-coverage-readiness", adminHandler.GetEnterpriseAuditCoverageReadiness)
	admin.GET("/enterprise/audit-export-readiness", adminHandler.GetEnterpriseAuditExportReadiness)
	admin.GET("/enterprise/audit-export-query-readiness", adminHandler.GetEnterpriseAuditExportQueryReadiness)
	admin.GET("/enterprise/audit-export-task-preflight-readiness", adminHandler.GetEnterpriseAuditExportTaskPreflightReadiness)
	admin.GET("/enterprise/audit-export-file-format-readiness", adminHandler.GetEnterpriseAuditExportFileFormatReadiness)
	admin.GET("/enterprise/audit-export-file-generator-readiness", adminHandler.GetEnterpriseAuditExportFileGeneratorReadiness)
	admin.GET("/enterprise/audit-export-task-create-request-readiness", adminHandler.GetEnterpriseAuditExportTaskCreateRequestReadiness)
	admin.GET("/enterprise/audit-export-task-persistence-readiness", adminHandler.GetEnterpriseAuditExportTaskPersistenceReadiness)
	admin.GET("/enterprise/audit-export-tasks", adminHandler.ListEnterpriseAuditExportTasks)
	admin.POST("/enterprise/audit-export-tasks", adminHandler.CreateEnterpriseAuditExportTask)
	admin.POST("/enterprise/audit-export-task-status-transitions", adminHandler.TransitionEnterpriseAuditExportTaskStatus)
	admin.GET("/enterprise/audit-export-worker-readiness", adminHandler.GetEnterpriseAuditExportWorkerReadiness)
	admin.GET("/enterprise/audit-export-worker-execution-request-readiness", adminHandler.GetEnterpriseAuditExportWorkerExecutionRequestReadiness)
	admin.GET("/enterprise/audit-export-worker-execution-request-persistence-readiness", adminHandler.GetEnterpriseAuditExportWorkerExecutionRequestPersistenceReadiness)
	admin.POST("/enterprise/audit-export-worker-execution-requests", adminHandler.PersistEnterpriseAuditExportWorkerExecutionRequest)
	admin.GET("/enterprise/audit-export-worker-execution-dry-run-readiness", adminHandler.GetEnterpriseAuditExportWorkerExecutionDryRunReadiness)
	admin.POST("/enterprise/audit-export-worker-execution-dry-run", adminHandler.DryRunEnterpriseAuditExportWorkerExecutionRequest)
	admin.GET("/enterprise/audit-export-worker-execution-artifact-readiness", adminHandler.GetEnterpriseAuditExportWorkerExecutionArtifactReadiness)
	admin.POST("/enterprise/audit-export-worker-execution-artifact", adminHandler.GenerateEnterpriseAuditExportWorkerExecutionArtifact)
	admin.GET("/enterprise/audit-export-worker-execution-output-storage-readiness", adminHandler.GetEnterpriseAuditExportWorkerExecutionOutputStorageReadiness)
	admin.POST("/enterprise/audit-export-worker-execution-output-storage", adminHandler.StoreEnterpriseAuditExportWorkerExecutionOutputStorage)
	admin.GET("/enterprise/audit-export-worker-execution-task-completion-readiness", adminHandler.GetEnterpriseAuditExportWorkerExecutionTaskCompletionReadiness)
	admin.POST("/enterprise/audit-export-worker-execution-task-completions", adminHandler.CompleteEnterpriseAuditExportWorkerExecutionTask)
	admin.GET("/enterprise/audit-export-task-status-transition-readiness", adminHandler.GetEnterpriseAuditExportTaskStatusTransitionReadiness)
	admin.GET("/enterprise/audit-export-archive-expiration-readiness", adminHandler.GetEnterpriseAuditExportArchiveExpirationReadiness)
	admin.GET("/enterprise/audit-export-delivery-report-readiness", adminHandler.GetEnterpriseAuditExportDeliveryReportReadiness)
	admin.GET("/enterprise/audit-export-delivery-report-completed-task-readiness", adminHandler.GetEnterpriseAuditExportDeliveryReportCompletedTaskReadiness)
	admin.GET("/enterprise/audit-export-delivery-report-generate-request-readiness", adminHandler.GetEnterpriseAuditExportDeliveryReportGenerateRequestReadiness)
	admin.GET("/enterprise/audit-export-delivery-report-storage-readiness", adminHandler.GetEnterpriseAuditExportDeliveryReportStorageReadiness)
	admin.GET("/enterprise/audit-export-delivery-report-stored-readiness", adminHandler.GetEnterpriseAuditExportDeliveryReportStoredReadiness)
	admin.POST("/enterprise/audit-export-delivery-report", adminHandler.GenerateEnterpriseAuditExportDeliveryReport)
	admin.POST("/enterprise/audit-export-delivery-report-storage", adminHandler.StoreEnterpriseAuditExportDeliveryReport)
	admin.GET("/enterprise/audit-retention-readiness", adminHandler.GetEnterpriseAuditRetentionReadiness)
	admin.POST("/enterprise/project-access-guard-activation/manual-approval", adminHandler.RecordEnterpriseProjectAccessGuardActivationManualApproval)
	admin.POST("/enterprise/project-access-guard-activation/execution", adminHandler.RecordEnterpriseProjectAccessGuardActivationExecution)
	admin.POST("/enterprise/project-access-guard-activation/post-validation", adminHandler.RecordEnterpriseProjectAccessGuardPostActivationValidation)
	admin.POST("/enterprise/project-access-guard-activation/rollback-evidence", adminHandler.RecordEnterpriseProjectAccessGuardRollbackEvidence)
	admin.POST("/enterprise/project-access-guard-activation/activate", adminHandler.ActivateEnterpriseProjectAccessGuardAuthorization)
	admin.POST("/enterprise/project-ownership-migrations", adminHandler.MigrateEnterpriseProjectOwnership)
	admin.GET("/enterprise/organizations", adminHandler.ListEnterpriseOrganizations)
	admin.POST("/enterprise/organizations", adminHandler.CreateEnterpriseOrganization)
	admin.GET("/enterprise/teams", adminHandler.ListEnterpriseTeams)
	admin.POST("/enterprise/teams", adminHandler.CreateEnterpriseTeam)
	admin.POST("/enterprise/members", adminHandler.BindEnterpriseMember)
	admin.GET("/admins", adminHandler.ListAdmins)
	admin.POST("/admins", adminHandler.CreateAdmin)
	admin.PUT("/admins/:id", adminHandler.UpdateAdmin)
	admin.DELETE("/admins/:id", adminHandler.DeleteAdmin)
	admin.PUT("/admins/:id/roles", adminHandler.ReplaceAdminRoles)
	admin.GET("/roles", adminHandler.ListRoles)
	admin.POST("/roles", adminHandler.CreateRole)
	admin.PUT("/roles/:id", adminHandler.UpdateRole)
	admin.DELETE("/roles/:id", adminHandler.DeleteRole)
	admin.GET("/permissions", adminHandler.ListPermissions)
	admin.GET("/capability/provider-preflight", func(c context.Context, ctx *app.RequestContext) {
		ctx.JSON(200, map[string]interface{}{
			"success": true,
			"data":    capabilityProviderPreflight,
		})
	})
	adminLLM := admin.Group("/llm")
	adminLLM.Use(middleware.RequireAdminPermission(adminRepo, "llm.provider.manage"))
	adminLLM.GET("/providers", llmProviderHandler.ListAdmin)
	adminLLM.GET("/providers/:id", llmProviderHandler.GetAdmin)
	adminLLM.POST("/providers", llmProviderHandler.Create)
	adminLLM.PUT("/providers/:id", llmProviderHandler.Update)
	adminLLM.DELETE("/providers/:id", llmProviderHandler.Delete)
	adminLLM.PUT("/providers/:id/default", llmProviderHandler.SetDefault)
	adminLLM.POST("/providers/:id/models/discover", llmProviderHandler.DiscoverModels)
	adminLLM.POST("/providers/reload", llmProviderHandler.Reload)
	adminLLM.POST("/providers/test", llmProviderHandler.TestConnection)

	// LLM Provider 路由
	llm := api.Group("/llm")

	// 公开路由（查看列表和测试连接）
	llm.GET("/providers", llmProviderHandler.List)
	llm.GET("/providers/:id", llmProviderHandler.Get)
	llm.POST("/providers/test", llmProviderHandler.TestConnection)
	llm.GET("/config", modelsHandler.GetCurrent)

}

func capabilityProviderPreflightStatusCounts(items []capabilityProviderPreflightItem) map[string]int {
	counts := map[string]int{
		"ready":   0,
		"skipped": 0,
		"blocked": 0,
	}
	for _, item := range items {
		if _, ok := counts[item.Status]; !ok {
			counts[item.Status] = 0
		}
		counts[item.Status]++
	}
	return counts
}

// initLLMClient 初始化 LLM 客户端
// 优先从数据库加载配置，如果没有数据库则使用环境变量配置

func initLLMClient(cfg *config.Config, repo service.LLMProviderRepo) *llm.ProviderManager {
	manager := llm.NewProviderManager()

	// 如果有数据库配置，使用数据库中的配置
	if repo != nil {
		ctx := context.Background()
		providers, err := repo.ListEnabled(ctx)
		if err == nil && len(providers) > 0 {
			for _, p := range providers {
				config := &llm.ProviderConfig{
					BaseURL: p.BaseURL,
					APIKey:  p.APIKey,
					Model:   p.Model,
				}

				provider := llm.NewDefaultProvider(p.BaseURL, p.APIKey, 120*time.Second)
				manager.RegisterProvider(p.Name, provider, config)
			}

			// 设置默认提供商
			if defaultP, err := repo.GetDefault(ctx); err == nil {
				manager.SetCurrent(defaultP.Name)
			}
			registerDeterministicLLMProvider(manager, cfg)

			return manager
		}
	}

	// 回退到环境变量配置
	if cfg.LLM.DoubaoAPIKey != "" {
		provider := llm.NewDefaultProvider(cfg.LLM.DoubaoBaseURL, cfg.LLM.DoubaoAPIKey, 120*time.Second)
		manager.RegisterProvider("doubao", provider, &llm.ProviderConfig{
			BaseURL: cfg.LLM.DoubaoBaseURL,
			APIKey:  cfg.LLM.DoubaoAPIKey,
			Model:   "doubao-seed-2.0-lite-260215",
		})
		manager.SetCurrent("doubao")
	}

	if cfg.LLM.OpenAIAPIKey != "" {
		provider := llm.NewDefaultProvider(cfg.LLM.OpenAIBaseURL, cfg.LLM.OpenAIAPIKey, 120*time.Second)
		manager.RegisterProvider("openai", provider, &llm.ProviderConfig{
			BaseURL: cfg.LLM.OpenAIBaseURL,
			APIKey:  cfg.LLM.OpenAIAPIKey,
			Model:   "gpt-4o",
		})
		if manager.GetCurrentName() == "" {
			manager.SetCurrent("openai")
		}
	}
	registerDeterministicLLMProvider(manager, cfg)

	return manager
}

func registerDeterministicLLMProvider(manager *llm.ProviderManager, cfg *config.Config) {
	if manager == nil || cfg == nil || cfg.LLM.DeterministicEnabled == false {
		return
	}
	manager.RegisterProvider("deterministic", llm.NewDeterministicProvider(), &llm.ProviderConfig{
		BaseURL:     "local://deterministic",
		Model:       "yistack-deterministic-dev",
		DisplayName: "YiStack Deterministic Dev",
		Type:        "local",
		Temperature: 0,
		MaxTokens:   cfg.LLM.MaxTokens,
		Timeout:     cfg.LLM.Timeout,
	})
	if strings.EqualFold(strings.TrimSpace(cfg.LLM.ActiveProvider), "deterministic") || strings.TrimSpace(manager.GetCurrentName()) == "" {
		if err := manager.SetCurrent("deterministic"); err != nil {
			log.Printf("Warning: failed to activate deterministic LLM provider: %v", err)
		}
	}
}

// parseCPU 解析 CPU 配置字符串为 float64
func parseCPU(cpuStr string) float64 {
	if cpuStr == "" {
		return 1.0
	}
	var cpu float64
	_, err := fmt.Sscanf(cpuStr, "%f", &cpu)
	if err != nil || cpu <= 0 {
		return 1.0
	}
	return cpu
}
