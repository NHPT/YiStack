#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function assertIncludes(content, expected, message) {
  assert.ok(content.includes(expected), message);
}

function assertNotIncludes(content, expected, message) {
  assert.ok(!content.includes(expected), message);
}

function assertPathExists(relativePath, message) {
  assert.ok(fs.existsSync(path.join(rootDir, relativePath)), message);
}

function readSourceSection(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `Missing source section start: ${startNeedle}`);
  const end = source.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `Missing source section end: ${endNeedle}`);
  return source.slice(start, end);
}

const professionalEfficiencySource = readText('src/lib/workspace/professional-efficiency-contract.ts');
const projectsPageSource = readText('src/app/projects/page.tsx');
const backendServerSource = readText('backend/cmd/server/main.go');
const backendGitServiceSource = readText('backend/internal/service/git.go');
const backendProjectFilesHandlerSource = readText('backend/internal/handler/project_files_handler.go');
const backendProjectBackupHandlerSource = readText('backend/internal/handler/project_backup_handler.go');
const backendProjectBackupServiceSource = readText('backend/internal/service/project_backup_service.go');
const backendProjectRuntimeHandlerSource = readText('backend/internal/handler/project_runtime_handler.go');
const backendProjectResourceMonitoringServiceSource = readText('backend/internal/service/project_resource_monitoring_service.go');
const backendAdminConfigHandlerSource = readText('backend/internal/handler/admin_config_handler.go');
const backendAdminConfigServiceSource = readText('backend/internal/service/admin_console_config_service.go');
const backendLLMProviderHandlerSource = readText('backend/internal/handler/llm_provider.go');
const backendLLMProviderAdminServiceSource = readText('backend/internal/service/llm_provider_admin_service.go');
const backendLLMProviderRepositorySource = readText('backend/pkg/supabase/repository.go');
const backendProviderManagerServiceSource = readText('backend/internal/service/provider_manager_service.go');
const frontendApiSource = readText('src/lib/api/index.ts');
const adminApiSource = readText('src/lib/admin/api.ts');
const adminLLMProviderTestProxySource = readText('src/app/api/admin/llm/providers/test/route.ts');
const frontendTypesSource = readText('src/lib/types.ts');
const workspaceResourceOperationsSource = readText('src/app/workspace/use-workspace-resource-operations.ts');
const desktopGitPanelSource = readText('src/app/workspace/workspace-ide-desktop-git-panel.tsx');
const mobileGitPanelSource = readText('src/app/workspace/workspace-ide-mobile-git-panel.tsx');
const adminPromptsPageSource = readText('src/app/admin/prompts/page.tsx');
const adminLLMPageSource = readText('src/app/admin/llm/page.tsx');
const adminLLMDiscoverModelsSource = readSourceSection(
  adminLLMPageSource,
  'const handleDiscoverModels = async () =>',
  'const openSaveConfirmation =',
);
const validationLayerSource = readText('docs/engineering/VALIDATION_LAYER.md');

assertIncludes(
  professionalEfficiencySource,
  'export const PROFESSIONAL_EFFICIENCY_DOMAINS',
  'LT-07 should expose a named professional efficiency domain list',
);
assertIncludes(
  professionalEfficiencySource,
  'export type ProfessionalEfficiencyDefinition = {',
  'LT-07 should expose a named professional efficiency definition contract',
);
for (const field of [
  'domain',
  'title',
  'primarySurface',
  'entrypoints',
  'boundary',
  'recovery',
  'validationSource',
]) {
  assertIncludes(
    professionalEfficiencySource,
    field,
    `ProfessionalEfficiencyDefinition should include ${field}`,
  );
}

for (const domain of [
  'git_deep_integration',
  'backup_recovery',
  'resource_monitoring',
  'prompt_management',
  'multi_model_strategy',
]) {
  assertIncludes(
    professionalEfficiencySource,
    domain,
    `Professional efficiency catalog should include ${domain}`,
  );
}

for (const entrypoint of [
  'src/app/workspace/workspace-ide-desktop-git-panel.tsx',
  'src/app/workspace/workspace-ide-mobile-git-panel.tsx',
  'src/app/workspace/use-workspace-resource-operations.ts',
  'backend/internal/service/git.go',
  'backend/internal/service/project_backup_service.go',
  'backend/internal/handler/project_backup_handler.go',
  'src/app/projects/page.tsx',
  'src/app/api/project/[id]/backups',
  'backend/internal/service/project_resource_monitoring_service.go',
  'src/lib/workspace/runtime-health-diagnostics.ts',
  'src/app/api/project/[id]/resource-alert-events',
  'src/app/admin/prompts/page.tsx',
  'backend/init.sql',
  'backend/internal/service/project_prompt_context.go',
  'src/app/admin/llm/page.tsx',
  'src/app/admin/admin-provider-health-diagnostics-model.ts',
  'backend/internal/service/provider_manager_service.go',
  'backend/internal/service/llm_provider_admin_service.go',
]) {
  assertIncludes(
    professionalEfficiencySource,
    entrypoint,
    `Professional efficiency catalog should reference ${entrypoint}`,
  );
  assertPathExists(entrypoint, `Professional efficiency entrypoint should exist: ${entrypoint}`);
}

assertIncludes(
  professionalEfficiencySource,
  'getProfessionalEfficiencyDefinition',
  'Professional efficiency catalog should expose a definition reader',
);
assertIncludes(
  professionalEfficiencySource,
  'getProfessionalEfficiencyDefinitionList',
  'Professional efficiency catalog should expose a definition list reader',
);
assertNotIncludes(
  projectsPageSource,
  'getProfessionalEfficiencyDefinitionList',
  'Project list page must not consume the professional efficiency governance catalog',
);
assertNotIncludes(
  projectsPageSource,
  'materializeProfessionalEfficiencyCoverageNodes',
  'Project list page must not materialize professional efficiency governance coverage nodes',
);
assertNotIncludes(
  projectsPageSource,
  'data-testid="project-list-professional-efficiency-coverage"',
  'Project list page must not expose professional efficiency coverage to end users',
);
assertNotIncludes(
  projectsPageSource,
  '专业效率能力覆盖',
  'Project list page must not render professional efficiency governance copy to end users',
);
for (const [source, expected, message] of [
  [backendServerSource, 'project.POST("/:id/stashes/create", projectHandler.CreateStash)', 'Backend routes should expose controlled Git stash create'],
  [backendProjectFilesHandlerSource, 'func (h *ProjectHandler) CreateStash', 'Backend handler should expose controlled Git stash create'],
  [backendGitServiceSource, 'func (s *ProjectService) CreateProjectGitStash', 'Project service should implement controlled Git stash create'],
  [backendGitServiceSource, 'func createGitStashInContainer', 'Git service should implement container-level stash create guard'],
  [backendGitServiceSource, '"stash", "push", "--include-untracked", "-m", message', 'Git stash create should use structured argv and include untracked files'],
  [backendGitServiceSource, 'normalizeGitStashMessage', 'Git stash create should validate stash message input'],
  [frontendTypesSource, 'export interface GitStashCreateResult', 'Frontend shared types should model Git stash create result'],
  [frontendApiSource, 'createStash: async (id: string, message: string): Promise<GitStashCreateResult>', 'Frontend API should expose Git stash create'],
  [workspaceResourceOperationsSource, 'handleCreateGitStash', 'Workspace resource operations should handle Git stash create'],
  [desktopGitPanelSource, 'data-testid="workspace-git-stash-create"', 'Desktop Git panel should expose stash create UI'],
  [mobileGitPanelSource, 'data-testid="workspace-git-stash-create"', 'Mobile Git panel should expose stash create UI'],
]) {
  assertIncludes(source, expected, message);
}
for (const [source, expected, message] of [
  [backendServerSource, 'project.GET("/:id/backups", projectHandler.ListBackups)', 'Backend routes should expose project backup list'],
  [backendServerSource, 'project.POST("/:id/backups/create", projectHandler.CreateBackup)', 'Backend routes should expose controlled project backup create'],
  [backendServerSource, 'project.POST("/:id/backups/restore-preflight", projectHandler.PreflightBackupRestore)', 'Backend routes should expose backup restore preflight'],
  [backendServerSource, 'project.POST("/:id/backups/restore", projectHandler.RestoreBackup)', 'Backend routes should expose controlled backup restore'],
  [backendServerSource, 'project.POST("/:id/backups/remote-upload", projectHandler.UploadBackupToRemoteStorage)', 'Backend routes should expose backup remote upload'],
  [backendServerSource, 'project.POST("/:id/backups/remote-download", projectHandler.DownloadBackupFromRemoteStorage)', 'Backend routes should expose backup remote download'],
  [backendServerSource, 'project.POST("/:id/backups/remote-restore", projectHandler.RestoreBackupFromRemoteStorage)', 'Backend routes should expose backup remote restore'],
  [backendProjectBackupHandlerSource, 'func (h *ProjectHandler) CreateBackup', 'Backup handler should expose controlled create'],
  [backendProjectBackupHandlerSource, 'func (h *ProjectHandler) PreflightBackupRestore', 'Backup handler should expose restore preflight'],
  [backendProjectBackupHandlerSource, 'func (h *ProjectHandler) RestoreBackup', 'Backup handler should expose controlled restore'],
  [backendProjectBackupServiceSource, 'func (s *ProjectService) CreateProjectBackup', 'Project backup service should create local backups'],
  [backendProjectBackupServiceSource, 'func (s *ProjectService) PreflightProjectBackupRestore', 'Project backup service should preflight restore'],
  [backendProjectBackupServiceSource, 'func (s *ProjectService) RestoreProjectBackup', 'Project backup service should restore backups through a guard'],
  [backendProjectBackupServiceSource, 'func (s *ProjectService) UploadProjectBackupToRemoteStorage', 'Project backup service should upload verified backups to remote storage'],
  [backendProjectBackupServiceSource, 'func (s *ProjectService) DownloadProjectBackupFromRemoteStorage', 'Project backup service should import complete remote backup candidates'],
  [backendProjectBackupServiceSource, 'func (s *ProjectService) RestoreProjectBackupFromRemoteStorage', 'Project backup service should restore complete remote backup candidates'],
  [backendProjectBackupServiceSource, 'isSafeProjectBackupIdentity', 'Project backup service should validate backup identity input'],
  [backendProjectBackupServiceSource, 'checksumProjectBackupArchive', 'Project backup service should verify backup archive checksums'],
  [frontendApiSource, 'createBackup: async (id: string): Promise<ProjectBackupResult>', 'Frontend API should expose project backup create'],
  [frontendApiSource, 'preflightBackupRestore: async (id: string, backupId: string): Promise<ProjectBackupRestorePreflightResult>', 'Frontend API should expose backup restore preflight'],
  [frontendApiSource, 'restoreBackup: async (id: string, backupId: string, confirmRestore: boolean): Promise<ProjectBackupRestoreResult>', 'Frontend API should expose controlled backup restore'],
  [projectsPageSource, 'data-testid="project-card-create-backup"', 'Project list should expose user-visible backup create'],
  [projectsPageSource, 'data-testid="project-card-restore-backup"', 'Project list should expose user-visible backup restore'],
  [projectsPageSource, "kind: 'backup_restore'", 'Project list should require structured confirmation before backup restore'],
  [projectsPageSource, 'confirmLocalProjectBackupRestore', 'Project list should execute local backup restore only after confirmation'],
]) {
  assertIncludes(source, expected, message);
}
for (const [source, expected, message] of [
  [backendServerSource, 'project.GET("/:id/resource-snapshot", projectHandler.GetResourceSnapshot)', 'Backend routes should expose resource snapshot read'],
  [backendServerSource, 'project.GET("/:id/resource-alert-readiness", projectHandler.GetResourceAlertReadiness)', 'Backend routes should expose resource alert readiness'],
  [backendServerSource, 'project.POST("/:id/resource-alert-events/create", projectHandler.CreateResourceAlertEvent)', 'Backend routes should expose controlled resource alert event create'],
  [backendServerSource, 'project.POST("/:id/resource-alert-notification/send", projectHandler.SendResourceAlertNotification)', 'Backend routes should expose controlled resource alert notification send'],
  [backendServerSource, 'project.POST("/:id/resource-alert-enforcement/execute", projectHandler.ExecuteResourceAlertEnforcement)', 'Backend routes should expose controlled resource alert enforcement execute'],
  [backendProjectRuntimeHandlerSource, 'func (h *ProjectHandler) GetResourceSnapshot', 'Runtime handler should expose resource snapshot'],
  [backendProjectRuntimeHandlerSource, 'func (h *ProjectHandler) CreateResourceAlertEvent', 'Runtime handler should expose resource alert event create'],
  [backendProjectRuntimeHandlerSource, 'func (h *ProjectHandler) SendResourceAlertNotification', 'Runtime handler should expose resource alert notification send'],
  [backendProjectRuntimeHandlerSource, 'func (h *ProjectHandler) ExecuteResourceAlertEnforcement', 'Runtime handler should expose resource alert enforcement execute'],
  [backendProjectResourceMonitoringServiceSource, 'func (s *ProjectService) GetProjectResourceSnapshot', 'Resource monitoring service should compute project resource snapshots'],
  [backendProjectResourceMonitoringServiceSource, 'func (s *ProjectService) GetProjectResourceAlertReadiness', 'Resource monitoring service should compute alert readiness'],
  [backendProjectResourceMonitoringServiceSource, 'func (s *ProjectService) CreateProjectResourceAlertEvent', 'Resource monitoring service should create append-only alert events'],
  [backendProjectResourceMonitoringServiceSource, 'func (s *ProjectService) SendProjectResourceAlertNotification', 'Resource monitoring service should send controlled alert notifications'],
  [backendProjectResourceMonitoringServiceSource, 'func (s *ProjectService) ExecuteProjectResourceAlertEnforcement', 'Resource monitoring service should execute controlled hard-quota enforcement'],
  [backendProjectResourceMonitoringServiceSource, 'if !confirmSend {', 'Resource alert notification send should require explicit confirmation'],
  [backendProjectResourceMonitoringServiceSource, 'if !confirmExecute {', 'Resource alert enforcement should require explicit confirmation'],
  [frontendApiSource, 'getResourceSnapshot: async (id: string): Promise<ProjectResourceSnapshotResult>', 'Frontend API should expose resource snapshots'],
  [frontendApiSource, 'sendResourceAlertNotification: async (id: string, confirmSend: boolean): Promise<ProjectResourceAlertNotificationSendResult>', 'Frontend API should expose controlled alert notification send'],
  [frontendApiSource, 'executeResourceAlertEnforcement: async (id: string, confirmExecute: boolean): Promise<ProjectResourceAlertEnforcementExecuteResult>', 'Frontend API should expose controlled alert enforcement execute'],
  [projectsPageSource, 'data-testid="project-card-resource-observe"', 'Project list should expose user-visible resource snapshot'],
  [projectsPageSource, 'data-testid="project-card-resource-alert-event-create"', 'Project list should expose resource alert event create'],
  [projectsPageSource, 'data-testid="project-card-resource-alert-enforcement-execute"', 'Project list should expose controlled resource enforcement execute'],
]) {
  assertIncludes(source, expected, message);
}
for (const [source, expected, message] of [
  [backendServerSource, 'admin.GET("/config", adminHandler.GetConfig)', 'Admin routes should expose config list'],
  [backendServerSource, 'admin.PUT("/config/:key", adminHandler.UpdateConfig)', 'Admin routes should expose controlled config update'],
  [backendAdminConfigHandlerSource, 'func (h *AdminHandler) GetConfig', 'Admin config handler should expose config list'],
  [backendAdminConfigHandlerSource, 'func (h *AdminHandler) UpdateConfig', 'Admin config handler should expose config update'],
  [backendAdminConfigServiceSource, 'func (s *AdminConsoleService) ListVisibleConfigs', 'Admin config service should enforce visible config reads'],
  [backendAdminConfigServiceSource, 'func (s *AdminConsoleService) UpdateConfig', 'Admin config service should enforce config writes'],
  [backendAdminConfigServiceSource, 'missing permission: system.config.update', 'Admin config update should require system config permission'],
  [adminApiSource, 'export const adminConfigApi', 'Admin frontend API should expose config operations'],
  [adminApiSource, 'update: async (key: AdminSystemConfigKey, value: string): Promise<SystemConfig>', 'Admin frontend API should update config by key'],
  [adminPromptsPageSource, "key: 'prompt.project_plans.system'", 'Admin Prompt page should expose plan prompt profile'],
  [adminPromptsPageSource, "key: 'prompt.chat.discuss.system'", 'Admin Prompt page should expose discuss prompt profile'],
  [adminPromptsPageSource, "key: 'prompt.chat.implement.system'", 'Admin Prompt page should expose implement prompt profile'],
  [adminPromptsPageSource, "hasAdminPromptPermission(profile, 'system.config.update')", 'Admin Prompt page should gate writes by system config permission'],
  [adminPromptsPageSource, 'await adminConfigApi.update(key, editValue);', 'Admin Prompt page should persist prompt edits through Admin Config API'],
  [adminPromptsPageSource, 'AdminPromptSaveConfirmationSnapshotStrip', 'Admin Prompt page should require visible save confirmation evidence'],
]) {
  assertIncludes(source, expected, message);
}
for (const [source, expected, message] of [
  [backendServerSource, 'adminLLM.Use(middleware.RequireAdminPermission(adminRepo, "llm.provider.manage"))', 'Admin LLM routes should require provider manage permission'],
  [backendServerSource, 'adminLLM.POST("/providers", llmProviderHandler.Create)', 'Admin LLM routes should expose provider create'],
  [backendServerSource, 'adminLLM.PUT("/providers/:id", llmProviderHandler.Update)', 'Admin LLM routes should expose provider update'],
  [backendServerSource, 'adminLLM.PUT("/providers/:id/default", llmProviderHandler.SetDefault)', 'Admin LLM routes should expose default switch'],
  [backendServerSource, 'adminLLM.POST("/providers/reload", llmProviderHandler.Reload)', 'Admin LLM routes should expose runtime reload'],
  [backendServerSource, 'adminLLM.POST("/providers/test", llmProviderHandler.TestConnection)', 'Admin LLM routes should expose permission-guarded provider connection preflight'],
  [backendLLMProviderHandlerSource, 'func (h *LLMProviderHandler) Create', 'LLM provider handler should expose create'],
  [backendLLMProviderHandlerSource, 'func (h *LLMProviderHandler) Update', 'LLM provider handler should expose update'],
  [backendLLMProviderHandlerSource, 'Type        *string', 'LLM provider update handler should accept provider type changes'],
  [backendLLMProviderHandlerSource, 'func (h *LLMProviderHandler) SetDefault', 'LLM provider handler should expose default switch'],
  [backendLLMProviderHandlerSource, 'func (h *LLMProviderHandler) Reload', 'LLM provider handler should expose runtime reload'],
  [backendLLMProviderHandlerSource, 'func (h *LLMProviderHandler) TestConnection', 'LLM provider handler should expose connection preflight'],
  [backendLLMProviderAdminServiceSource, 'func (s *LLMProviderAdminService) CreateProvider', 'LLM provider admin service should create providers'],
  [backendLLMProviderAdminServiceSource, 'func (s *LLMProviderAdminService) UpdateProvider', 'LLM provider admin service should update providers'],
  [backendLLMProviderAdminServiceSource, 'provider.Type = *req.Type', 'LLM provider update service should persist provider type changes'],
  [backendLLMProviderAdminServiceSource, 'func (s *LLMProviderAdminService) SetDefaultProvider', 'LLM provider admin service should set defaults'],
  [backendLLMProviderAdminServiceSource, 'func (s *LLMProviderAdminService) ReloadProviders', 'LLM provider admin service should reload runtime providers'],
  [backendLLMProviderAdminServiceSource, 'func (s *LLMProviderAdminService) BuildConnectionTestResult', 'LLM provider admin service should build safe connection preflight results'],
  [backendLLMProviderAdminServiceSource, 'toSafeLLMProvider', 'LLM provider admin service should return safe provider views'],
  [backendLLMProviderAdminServiceSource, 'isLLMProviderRuntimeLoaded', 'LLM provider admin service should aggregate provider runtime loaded state from child model runtime IDs'],
  [backendLLMProviderAdminServiceSource, 'isLLMProviderRuntimeActive', 'LLM provider admin service should aggregate provider runtime active state from child model runtime IDs'],
  [backendProviderManagerServiceSource, 'func (s *ProviderManagerService) Reload(ctx context.Context) error', 'Provider manager should reload providers from database'],
  [backendProviderManagerServiceSource, 'ReloadFromDB(ctx, s.llmRepo)', 'Provider manager should reload providers from database repository'],
  [adminLLMProviderTestProxySource, "backendPath: '/api/admin/llm/providers/test'", 'Next admin proxy should route provider connection preflight through admin backend route'],
  [adminApiSource, 'export const adminLLMApi', 'Admin frontend API should expose LLM provider operations'],
  [adminApiSource, 'export interface AdminLLMProviderConnectionTestResponse', 'Admin frontend API should model provider connection preflight results'],
  [adminApiSource, 'createProvider: async (data: LLMProviderCreate): Promise<LLMProvider>', 'Admin frontend API should create LLM providers'],
  [adminApiSource, 'setDefault: async (id: AdminLLMProviderId): Promise<void>', 'Admin frontend API should set default provider'],
  [adminApiSource, 'testConnection: async (', 'Admin frontend API should expose provider connection preflight'],
  [adminLLMPageSource, 'AdminLLMProviderSaveConfirmationSnapshotStrip', 'Admin LLM page should require save confirmation evidence'],
  [adminLLMPageSource, 'AdminLLMProviderRuntimeMutationConfirmationSnapshotStrip', 'Admin LLM page should require runtime mutation confirmation evidence'],
  [adminLLMPageSource, 'adminLLMApi.setDefault(provider.id)', 'Admin LLM page should switch default through Admin LLM API'],
  [adminLLMPageSource, 'adminLLMApi.reload()', 'Admin LLM page should reload runtime providers through Admin LLM API'],
  [adminLLMPageSource, 'adminLLMApi.testConnection(provider.name, testModel)', 'Admin LLM page should run provider connection preflight through Admin LLM API'],
  [adminLLMPageSource, 'getAdminLLMProviderDefaultModel(provider)', 'Admin LLM page should run provider connection preflight against the default configured model'],
  [adminLLMPageSource, '模型列表（一行一个）', 'Admin LLM page should expose provider model list editing'],
  [adminLLMPageSource, 'adminLLMApi.discoverModels(editingProvider.id)', 'Admin LLM page should expose provider model auto-discovery'],
  [adminLLMPageSource, 'materializeAdminLLMProviderListAfterModelDiscovery', 'Admin LLM page should update discovered model list locally without full page reload'],
  [backendServerSource, 'adminLLM.POST("/providers/:id/models/discover", llmProviderHandler.DiscoverModels)', 'Admin LLM routes should expose provider model discovery'],
  [backendLLMProviderHandlerSource, 'func (h *LLMProviderHandler) DiscoverModels', 'LLM provider handler should expose model discovery'],
  [backendLLMProviderAdminServiceSource, 'func (s *LLMProviderAdminService) DiscoverProviderModels', 'LLM provider admin service should discover provider models'],
  [backendLLMProviderRepositorySource, 'llm_provider_models', 'LLM provider repository should use provider model storage'],
  [adminLLMPageSource, 'data-testid="admin-llm-provider-connection-test"', 'Admin LLM page should expose a user-visible provider connection preflight action'],
  [adminLLMPageSource, 'data-testid="admin-llm-provider-connection-test-result"', 'Admin LLM page should expose provider connection preflight result evidence'],
  [adminLLMPageSource, '配置齐备时发起受控真实模型连接测试；blocked 时不会访问上游，不暴露 API Key', 'Admin LLM page should disclose controlled real-call, blocked no-upstream and no-secret boundary for connection preflight'],
  [adminLLMPageSource, 'runtime_loaded', 'Admin LLM page should surface runtime loaded drift evidence'],
  [adminLLMPageSource, 'runtime_active', 'Admin LLM page should surface runtime active drift evidence'],
]) {
  assertIncludes(source, expected, message);
}
assertNotIncludes(
  adminLLMPageSource,
  '兼容字段：默认使用下方模型列表第一行。',
  'Admin LLM page should not expose the legacy single model input after provider/model one-to-many support',
);
assert.doesNotMatch(
  adminLLMDiscoverModelsSource,
  /await loadProviders\(\);/,
  'Admin LLM model discovery should not trigger full provider page reload after updating the model list',
);
assertIncludes(
  validationLayerSource,
  'LT-07 professional efficiency catalog contract 校验',
  'Validation Layer should document the LT-07 professional efficiency catalog gate',
);
console.log('[YES] LT-07 professional efficiency contract validation passed.');
