#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(scriptDir, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function fail(message) {
  console.error(`[YES] API response contract invalid: ${message}`);
  process.exit(1);
}

function assertNoLegacyCodeResponse(relativePath) {
  const source = readProjectFile(relativePath);
  if (source.includes('"code"')) {
    fail(`${relativePath} must use { success, data/error } instead of legacy { code, message, data }`);
  }
}

[
  'backend/internal/handler/auth_handler.go',
  'backend/internal/handler/models_handler.go',
  'backend/internal/handler/llm_provider.go',
].forEach(assertNoLegacyCodeResponse);

const projectHandler = readProjectFile('backend/internal/handler/project.go');
if (projectHandler.includes('"code": 0')) {
  fail('backend/internal/handler/project.go must not return legacy code:0 project list responses');
}

const backendServerRoutes = readProjectFile('backend/cmd/server/main.go');
const projectMessageSaveRoutes = backendServerRoutes.match(/project\.POST\("\/:id\/messages", projectHandler\.SaveMessages\)/g) ?? [];
if (projectMessageSaveRoutes.length !== 1) {
  fail(`backend/cmd/server/main.go must register POST /api/project/:id/messages exactly once, found ${projectMessageSaveRoutes.length}`);
}
if (!backendServerRoutes.includes('project.POST("/plans", projectHandler.GeneratePlans)')) {
  fail('backend/cmd/server/main.go must register POST /api/project/plans inside the authenticated project route group');
}
if (backendServerRoutes.includes('api.POST("/project/plans", projectHandler.GeneratePlans)')) {
  fail('backend/cmd/server/main.go must not register POST /api/project/plans as a public API route');
}
if (!backendServerRoutes.includes('llm.GET("/config", modelsHandler.GetCurrent)')) {
  fail('backend/cmd/server/main.go must expose ordinary LLM config as a read-only GET route');
}
if (backendServerRoutes.includes('llm.PUT("/config"')) {
  fail('backend/cmd/server/main.go must not expose ordinary LLM config writes; use Admin config/provider APIs instead');
}
if (!backendServerRoutes.includes('project.POST("/:id/restore", projectHandler.RestoreDeleted)')) {
  fail('backend/cmd/server/main.go must expose POST /api/project/:id/restore inside the authenticated project route group');
}
[
  'auth.POST("/register", authHandler.Register)',
  'auth.POST("/login", authHandler.Login)',
  'auth.POST("/refresh", authHandler.RefreshToken)',
  'authProtected.GET("/profile", authHandler.GetProfile)',
  'authProtected.PUT("/profile", authHandler.UpdateProfile)',
  'authProtected.POST("/change-password", authHandler.ChangePassword)',
  'authProtected.POST("/logout", authHandler.Logout)',
].forEach((snippet) => {
  if (!backendServerRoutes.includes(snippet)) {
    fail(`backend/cmd/server/main.go must preserve ordinary Auth route registration: ${snippet}`);
  }
});
if (backendServerRoutes.includes('"/userinfo"')) {
  fail('backend/cmd/server/main.go must not expose legacy /api/auth/userinfo; ordinary profile reads use /api/auth/profile');
}

const apiClient = readProjectFile('src/lib/api/index.ts');
const apiErrorDisplay = readProjectFile('src/lib/api-error-display.ts');
const backendProxySource = readProjectFile('src/app/api/_utils/backend-proxy.ts');
const modelsHandler = readProjectFile('backend/internal/handler/models_handler.go');
const errorMiddleware = readProjectFile('backend/internal/middleware/error_middleware.go');
const llmConfigProxyRoute = readProjectFile('src/app/api/llm/config/route.ts');
const projectRestoreProxyRoute = readProjectFile('src/app/api/project/[id]/restore/route.ts');
const authRefreshProxyRoute = readProjectFile('src/app/api/auth/refresh/route.ts');
const apiDocs = readProjectFile('docs/API.md');
const developerGuide = readProjectFile('docs/DEVELOPER_GUIDE.md');
[
  'result.code',
  'data.code',
  'code !== 0',
  'code === 0',
  '兼容两种响应格式',
].forEach((snippet) => {
  if (apiClient.includes(snippet)) {
    fail(`src/lib/api/index.ts still contains legacy code response handling: ${snippet}`);
  }
});

[
  'ChatMessageRole',
  'export interface ProjectMessage',
  'role: ChatMessageRole;',
  'export type ProjectMessageSaveInput = {',
  'messages: ProjectMessageSaveInput[],',
].forEach((snippet) => {
  if (!apiClient.includes(snippet)) {
    fail(`src/lib/api/index.ts must model project messages through the shared chat message role contract: ${snippet}`);
  }
});
if (apiClient.includes("role: 'user' | 'assistant' | 'system'")) {
  fail('src/lib/api/index.ts must not inline project message role unions; use ChatMessageRole and ProjectMessageSaveInput');
}

[
  'formatUserVisibleApiError',
  'type ApiErrorDisplaySuffixSegment = string;',
  'type ApiErrorDisplaySuffixSegmentList = ApiErrorDisplaySuffixSegment[];',
  'source?: unknown;',
  'details?: unknown;',
  '来源：${source}',
  'function getApiErrorDisplayText(value: unknown): string',
  'function addApiErrorDisplaySuffixSegment(',
  'function materializeApiErrorDisplaySuffixSegments(',
  'const suffixSegments = materializeApiErrorDisplaySuffixSegments(message, source, details);',
].forEach((snippet) => {
  if (!apiErrorDisplay.includes(snippet)) {
    fail(`src/lib/api-error-display.ts must format structured source/details for user-visible UI errors: ${snippet}`);
  }
});
[
  '.filter((item) => item && !message.includes(item))',
  '[sourceMessage, details]',
].forEach((snippet) => {
  if (apiErrorDisplay.includes(snippet)) {
    fail(`src/lib/api-error-display.ts must materialize user-visible structured error suffixes without inline array filters: ${snippet}`);
  }
});

const authOperationErrors = readProjectFile('src/lib/auth-operation-errors.ts');
if (!authOperationErrors.includes('export type AuthOperationErrorDetails = string')
  || !authOperationErrors.includes('fallback: AuthOperationErrorDetails')
  || !authOperationErrors.includes('formatUserVisibleApiError(error, fallback)')
  || authOperationErrors.includes('fallback: string')) {
  fail('auth-operation-errors.ts must preserve structured source/details for Auth submit failures');
}

if (!readProjectFile('src/app/auth/page.tsx')
  .includes("formatAuthOperationFailure(err, '操作失败，请稍后重试')")) {
  fail('src/app/auth/page.tsx must use the shared Auth operation formatter for user-visible submit failures');
}

[
  'export interface AuthRefreshResponse',
  'token: string;',
  'expires_at?: number;',
  'expires_in?: number;',
  'token_type?: string;',
  'refresh_token?: string;',
  'refreshToken: async (token: string): Promise<AuthRefreshResponse>',
  "request<AuthRefreshResponse>('/auth/refresh'",
].forEach((snippet) => {
  if (!apiClient.includes(snippet)) {
    fail(`src/lib/api/index.ts must model ordinary Auth refresh response through AuthRefreshResponse: ${snippet}`);
  }
});
if (apiClient.includes("refreshToken: async (token: string): Promise<{ token: string }>")
  || apiClient.includes("request<{ token: string }>('/auth/refresh'")) {
  fail('src/lib/api/index.ts must not regress ordinary Auth refresh response to an anonymous token object');
}
[
  'backendPath: \'/api/auth/refresh\'',
  "bodyMode: 'json'",
  "buildBackendProxyErrorBody('auth refresh', error)",
].forEach((snippet) => {
  if (!authRefreshProxyRoute.includes(snippet)) {
    fail(`src/app/api/auth/refresh/route.ts must proxy ordinary Auth refresh with structured errors: ${snippet}`);
  }
});
[
  '"token":         resp.Token',
  '"expires_at":    resp.ExpiresAt',
  '"expires_in":    resp.ExpiresIn',
  '"token_type":    resp.TokenType',
  '"refresh_token": resp.RefreshToken',
].forEach((snippet) => {
  if (!readProjectFile('backend/internal/handler/auth_handler.go').includes(snippet)) {
    fail(`backend ordinary Auth refresh handler must preserve session response field: ${snippet}`);
  }
});

[
  'UpdateConfig',
  'not implemented',
  'PUT /api/llm/config',
].forEach((snippet) => {
  if (modelsHandler.includes(snippet)) {
    fail(`backend/internal/handler/models_handler.go must not keep legacy ordinary LLM config update code: ${snippet}`);
  }
});

if (llmConfigProxyRoute.includes('export async function PUT') || llmConfigProxyRoute.includes('llm config update')) {
  fail('src/app/api/llm/config/route.ts must remain read-only; ordinary LLM config writes belong to Admin APIs');
}

if (apiClient.includes('updateConfig: async')) {
  fail('src/lib/api/index.ts must not expose ordinary llmApi.updateConfig for the read-only /api/llm/config endpoint');
}

[
  'ProjectSoftDeleteRestoreResponse',
  'ProjectSoftDeleteRestoreResult',
  'ProjectRestoreMutationStatus',
  'restore_status: ProjectRestoreMutationStatus;',
  'restored_project?: ProjectPayload;',
  'restored_project?: Project;',
  'restore_window_seconds',
  'restoreDeleted: async (id: string): Promise<ProjectSoftDeleteRestoreResult>',
  "`/project/${id}/restore`",
].forEach((snippet) => {
  if (!apiClient.includes(snippet)) {
    fail(`src/lib/api/index.ts must expose the project soft-delete restore API contract: ${snippet}`);
  }
});
if (apiClient.includes("restore_status: 'restored' | 'blocked'")) {
  fail('src/lib/api/index.ts must not inline project soft-delete restore status; use ProjectRestoreMutationStatus');
}
if (apiClient.includes("Omit<ProjectSoftDeleteRestoreResponse, 'restored_project'> & { restored_project?: Project }")) {
  fail('src/lib/api/index.ts must not derive the normalized soft-delete restore response with Omit/intersection; use ProjectSoftDeleteRestoreResult');
}

[
  'export async function POST',
  'backendPath: `/api/project/${id}/restore`',
  "buildBackendProxyErrorBody('project soft delete restore', error)",
].forEach((snippet) => {
  if (!projectRestoreProxyRoute.includes(snippet)) {
    fail(`src/app/api/project/[id]/restore/route.ts must proxy soft-delete restore requests: ${snippet}`);
  }
});

[
  'RestoreDeletedProject',
  'RestoreDeletedByOwner',
  'ProjectDeletionRestoreWindow',
  'restore_window_seconds',
  'can_restore',
  'restore_scope',
  'restore_boundary',
].forEach((snippet) => {
  if (!projectHandler.includes(snippet) && !readProjectFile('backend/internal/service/project_service.go').includes(snippet)) {
    fail(`project soft-delete restore backend contract must preserve owner guard, window and response fields: ${snippet}`);
  }
});

[
  'let errorBody: unknown',
  'JSON.parse(errorText)',
  'Keep the text fallback for non-JSON stream errors.',
].forEach((snippet) => {
  if (!backendProxySource.includes(snippet)) {
    fail(`streaming Next proxy errors must preserve backend JSON error payloads before falling back to text: ${snippet}`);
  }
});

if (!readProjectFile('src/lib/workspace/plan-generation-errors.ts')
  .includes("formatUserVisibleApiError(error, '请重试')")) {
  fail('plan-generation-errors.ts must preserve structured source/details when plan generation fails');
}

if (!readProjectFile('src/app/workspace/workspace-plan-generation-lifecycle.ts')
  .includes('生成技术方案失败：${formatPlanGenerationFailure(payload.error)}')) {
  fail('workspace-plan-generation-lifecycle.ts must use the plan generation error formatter');
}

if (!readProjectFile('src/lib/workspace/capability-audit-operation-errors.ts')
  .includes("formatUserVisibleApiError(error, '能力审计加载失败')")) {
  fail('capability-audit-operation-errors.ts must preserve structured source/details when Capability Audit loading fails');
}

if (!readProjectFile('src/app/workspace/workspace-capability-audit-panel.tsx')
  .includes('formatCapabilityAuditLoadFailure(err)')) {
  fail('workspace-capability-audit-panel.tsx must use the Capability Audit load error formatter');
}

if (!readProjectFile('src/lib/workspace/workspace-model-list-errors.ts')
  .includes("formatUserVisibleApiError(error, '请稍后重试')")) {
  fail('workspace-model-list-errors.ts must preserve structured source/details when Workspace model list loading fails');
}

if (!readProjectFile('src/app/workspace/use-workspace-page-ui.tsx')
  .includes('formatWorkspaceModelListLoadFailure(error)')) {
  fail('use-workspace-page-ui.tsx must use the Workspace model list load error formatter');
}

if (!readProjectFile('src/lib/workspace/workspace-generation-control-errors.ts')
  .includes("formatUserVisibleApiError(error, '请稍后重试')")) {
  fail('workspace-generation-control-errors.ts must preserve structured source/details when manual stop generation sync fails');
}

if (!readProjectFile('src/app/workspace/use-workspace-page-effects.ts')
  .includes('formatStopGenerationSyncFailure(error)')) {
  fail('use-workspace-page-effects.ts must use the stop generation sync error formatter');
}

if (!readProjectFile('src/lib/workspace/home-planning-entry-errors.ts')
  .includes("formatUserVisibleApiError(error, '未知错误')")) {
  fail('home-planning-entry-errors.ts must preserve structured source/details when home planning start fails');
}

if (!readProjectFile('src/app/page.tsx')
  .includes('开始规划失败: ${formatHomePlanningStartFailure(error)}')) {
  fail('src/app/page.tsx must use the home planning start error formatter');
}

if (!readProjectFile('src/lib/workspace/workspace-project-bootstrap-errors.ts')
  .includes("formatUserVisibleApiError(error, fallback)")) {
  fail('workspace-project-bootstrap-errors.ts must preserve structured source/details for project detail and history message bootstrap recovery failures');
}

if (!readProjectFile('src/lib/workspace/workspace-project-bootstrap-errors.ts')
  .includes("formatUserVisibleApiError(error, '项目详情 file_tree 字段格式无效')")) {
  fail('workspace-project-bootstrap-errors.ts must preserve structured source/details for project bootstrap file_tree parse failures');
}

if (!readProjectFile('src/app/workspace/use-workspace-project-bootstrap.ts')
  .includes('formatProjectBootstrapRecoveryFailure(error)')) {
  fail('use-workspace-project-bootstrap.ts must use the project bootstrap recovery error formatter');
}

if (!readProjectFile('src/app/workspace/use-workspace-project-bootstrap.ts')
  .includes('formatProjectBootstrapFileTreeParseFailure(error)')) {
  fail('use-workspace-project-bootstrap.ts must use the project bootstrap file_tree parse error formatter');
}

if (!readProjectFile('src/lib/workspace/workspace-runtime-resource-errors.ts')
  .includes('formatUserVisibleApiError(error, fallback)')) {
  fail('workspace-runtime-resource-errors.ts must preserve structured source/details for runtime resource failures');
}

if (!readProjectFile('src/app/workspace/use-workspace-runtime-resources.ts')
  .includes('formatWorkspaceRuntimeResourceFailure(error')) {
  fail('use-workspace-runtime-resources.ts must use the runtime resource error formatter');
}

const workspaceResourceOperationErrors = readProjectFile('src/lib/workspace/workspace-resource-operation-errors.ts');
if (!workspaceResourceOperationErrors.includes('export type WorkspaceResourceOperationErrorDetails = string')
  || !workspaceResourceOperationErrors.includes('fallback: WorkspaceResourceOperationErrorDetails')
  || !workspaceResourceOperationErrors.includes('formatUserVisibleApiError(error, fallback)')
  || workspaceResourceOperationErrors.includes('fallback: string')) {
  fail('workspace-resource-operation-errors.ts must preserve structured source/details for resource operation failures');
}

if (!readProjectFile('src/app/workspace/use-workspace-resource-operations.ts')
  .includes('formatWorkspaceResourceOperationFailure(error')) {
  fail('use-workspace-resource-operations.ts must use the resource operation error formatter');
}

if (!readProjectFile('src/app/workspace/use-workspace-ide-interactions.ts')
  .includes('formatWorkspaceResourceOperationFailure(error)')) {
  fail('use-workspace-ide-interactions.ts must use the resource operation error formatter for repair target refresh failures');
}

if (!readProjectFile('src/lib/workspace/plan-implementation-errors.ts')
  .includes("formatUserVisibleApiError(error, '请修复后重试')")) {
  fail('plan-implementation-errors.ts must preserve structured source/details when plan implementation launch fails');
}

if (!readProjectFile('src/app/workspace/use-workspace-plan-implementation-action.ts')
  .includes('formatPlanImplementationLaunchFailure(error)')) {
  fail('use-workspace-plan-implementation-action.ts must use the plan implementation error formatter');
}

if (!readProjectFile('src/lib/workspace/workspace-implementation-errors.ts')
  .includes("formatUserVisibleApiError(error, '请重试')")) {
  fail('workspace-implementation-errors.ts must preserve structured source/details for local generation_failed recovery reasons');
}

if (!readProjectFile('src/app/workspace/workspace-implementation-failure-effects.ts')
  .includes('formatImplementationGenerationFailure(error)')) {
  fail('workspace-implementation-failure-effects.ts must use the implementation generation error formatter');
}

const planGenerationStreamEvents = readProjectFile('src/app/workspace/workspace-plan-generation-stream-events.ts');
const workspaceStreamBoundaryErrors = readProjectFile('src/lib/workspace/workspace-stream-boundary-errors.ts');
const implementationStreamTypes = readProjectFile('src/app/workspace/workspace-implementation-stream-types.ts');
const workspaceTypes = readProjectFile('src/app/workspace/workspace-types.ts');
const workspacePageHelpers = readProjectFile('src/app/workspace/workspace-page-helpers.ts');
const planGenerationStreamTypes = readProjectFile('src/app/workspace/workspace-plan-generation-stream-types.ts');
const orchestrationExecutionTypes = readProjectFile('src/app/workspace/workspace-orchestration-execution-types.ts');
const orchestrationHookTypes = readProjectFile('src/app/workspace/workspace-orchestration-hook-types.ts');
[
  'export type WorkspaceStreamErrorFieldKey =',
  'export type WorkspaceStreamErrorMessage = string;',
  'export type WorkspaceStreamErrorCode = string;',
  'export type WorkspaceStreamErrorSource = string;',
  'export type WorkspaceStreamErrorDetails = string;',
  'export type WorkspaceStreamErrorGate = string;',
  "export type WorkspaceStreamExecutionResultStatus = 'deferred' | 'skipped' | 'executed' | 'blocked' | 'unknown';",
  'export type WorkspaceStreamExecutionArtifact = {',
  'export type WorkspaceStreamExecutionArtifactList = WorkspaceStreamExecutionArtifact[];',
  'export type WorkspaceStreamExecutionResultItem = {',
  'export type WorkspaceStreamExecutionResultItemList = WorkspaceStreamExecutionResultItem[];',
  'export type WorkspaceStreamExecutionResult = {',
  'status: WorkspaceStreamExecutionResultStatus;',
  'capabilityProfile: string;',
  'items: WorkspaceStreamExecutionResultItemList;',
  'export type WorkspacePlanStreamError = Error & {',
  'export type WorkspaceSSEStreamUnreadableError = Error & {',
  'export type WorkspaceImplementationStreamPayloadErrorInput = {',
  'export type WorkspaceImplementationStreamPayloadError = Error & {',
  'key: WorkspaceStreamErrorFieldKey,',
  '): WorkspaceStreamErrorFieldValue | undefined',
  'export function readWorkspaceStreamErrorSource',
  'export function readWorkspaceStreamErrorMessage',
  'export function readWorkspaceStreamErrorDetails',
  'function readWorkspaceStreamExecutionArtifact(value: unknown): WorkspaceStreamExecutionArtifact',
  'function readWorkspaceStreamExecutionArtifactList(value: unknown): WorkspaceStreamExecutionArtifactList',
  'function readWorkspaceStreamExecutionResultItem(value: unknown): WorkspaceStreamExecutionResultItem',
  'function readWorkspaceStreamExecutionResultItemList(value: unknown): WorkspaceStreamExecutionResultItemList',
  'export function readWorkspaceStreamExecutionResult',
  '): WorkspacePlanStreamError',
  '): WorkspaceSSEStreamUnreadableError',
  'streamError: WorkspaceImplementationStreamPayloadErrorInput',
  '): WorkspaceImplementationStreamPayloadError',
].forEach((snippet) => {
  if (!workspaceStreamBoundaryErrors.includes(snippet)) {
    fail(`workspace-stream-boundary-errors.ts must name stream boundary source/details/code/gate payload contracts: ${snippet}`);
  }
});
[
  'WorkspaceStreamErrorCode',
  'WorkspaceStreamErrorDetails',
  'WorkspaceStreamErrorGate',
  'WorkspaceStreamErrorMessage',
  'WorkspaceStreamErrorSource',
  'WorkspaceStreamExecutionResult',
  'message: WorkspaceStreamErrorMessage;',
  'code?: WorkspaceStreamErrorCode;',
  'source?: WorkspaceStreamErrorSource;',
  'details?: WorkspaceStreamErrorDetails;',
  'gate?: WorkspaceStreamErrorGate;',
  'executionResult?: WorkspaceStreamExecutionResult;',
].forEach((snippet) => {
  if (!implementationStreamTypes.includes(snippet)) {
    fail(`workspace-implementation-stream-types.ts must consume named stream boundary error contracts: ${snippet}`);
  }
});
if (/buildImplementationStreamPayloadError\(streamError: \{[\s\S]*message: string;[\s\S]*code\?: string;[\s\S]*source\?: string;[\s\S]*details\?: string;[\s\S]*gate\?: string;/.test(workspaceStreamBoundaryErrors)
  || /export type GenerationStreamError = \{[\s\S]*message: string;[\s\S]*code\?: string;[\s\S]*source\?: string;[\s\S]*details\?: string;[\s\S]*gate\?: string;/.test(implementationStreamTypes)
  || workspaceStreamBoundaryErrors.includes('export type WorkspaceStreamExecutionResult = Record<string, unknown>;')
  || workspaceStreamBoundaryErrors.includes('WorkspaceStreamExecutionResultMetadata = Record<string, unknown>;')
  || workspaceStreamBoundaryErrors.includes('key: string)')
  || workspaceStreamBoundaryErrors.includes("readWorkspaceStreamErrorField(data, 'source') || 'plan_generation_stream'")
  || workspaceStreamBoundaryErrors.includes("readWorkspaceStreamErrorField(data, 'details')\n    || readWorkspaceStreamErrorField(data, 'error')")
  || workspaceStreamBoundaryErrors.includes('return items.map((item) => {')
  || workspaceStreamBoundaryErrors.includes('items: rawItems.map((item) => {')) {
  fail('Workspace stream boundary errors must not regress to inline payload objects or raw source/details/code/gate string contracts');
}
[
  'export type WorkspaceStreamBoundaryPayload = {',
  '[fieldName: string]: unknown;',
  'export type WorkspaceStreamBoundaryObject = WorkspaceStreamBoundaryPayload;',
  'export type WorkspaceStreamBoundaryItemList = unknown[];',
  'export type WorkspaceStreamExecutionResultMetadata = WorkspaceStreamBoundaryObject;',
  'data: WorkspaceStreamBoundaryPayload,',
  'function readWorkspaceStreamObject(value: unknown): WorkspaceStreamBoundaryObject',
  'function readWorkspaceStreamBoundaryItemList(value: unknown): WorkspaceStreamBoundaryItemList',
].forEach((snippet) => {
  if (!workspaceStreamBoundaryErrors.includes(snippet)) {
    fail(`workspace-stream-boundary-errors.ts must consume named stream boundary payload contracts: ${snippet}`);
  }
});
[
  'export function buildPlanStreamError',
  "const source = readWorkspaceStreamErrorSource(data, 'plan_generation_stream');",
  'const details = readWorkspaceStreamErrorDetails(data, message);',
  'source,',
  'engineeringState,',
].forEach((snippet) => {
  if (!workspaceStreamBoundaryErrors.includes(snippet)) {
    fail(`workspace-stream-boundary-errors.ts must preserve structured source/details from plan SSE error payloads: ${snippet}`);
  }
});
[
  'throw buildPlanStreamError(data, message, engineeringState);',
  'throw buildPlanFoundationGateBlockedStreamError(message, engineeringState);',
].forEach((snippet) => {
  if (!planGenerationStreamEvents.includes(snippet)) {
    fail(`workspace-plan-generation-stream-events.ts must consume stream boundary helpers: ${snippet}`);
  }
});
if (planGenerationStreamEvents.includes('function buildPlanStreamError')) {
  fail('workspace-plan-generation-stream-events.ts must not reassemble plan SSE source/details locally');
}
if (planGenerationStreamEvents.includes("throw new Error(context.getEventMessage(data, '生成技术方案失败'))")) {
  fail('workspace-plan-generation-stream-events.ts must not collapse plan SSE error payloads to bare Error');
}
[
  'export type WorkspaceEventMessage = string;',
  'export type WorkspaceEventMessageFallback = WorkspaceEventMessage;',
  'export type WorkspaceEventMessageResolver = (',
  'fallback: WorkspaceEventMessageFallback,',
].forEach((snippet) => {
  if (!workspaceTypes.includes(snippet)) {
    fail(`workspace-types.ts must name Workspace SSE event message contracts: ${snippet}`);
  }
});
[
  'WorkspaceEventMessage',
  'WorkspaceEventMessageFallback',
  'fallback: WorkspaceEventMessageFallback',
].forEach((snippet) => {
  if (!workspacePageHelpers.includes(snippet)) {
    fail(`src/app/workspace/workspace-page-helpers.ts must consume named Workspace SSE event message fallback contract: ${snippet}`);
  }
});
[
  ['src/app/workspace/workspace-plan-generation-stream-types.ts', planGenerationStreamTypes],
  ['src/app/workspace/workspace-implementation-stream-types.ts', implementationStreamTypes],
  ['src/app/workspace/workspace-orchestration-execution-types.ts', orchestrationExecutionTypes],
  ['src/app/workspace/workspace-orchestration-hook-types.ts', orchestrationHookTypes],
].forEach(([relativePath, source]) => {
  [
    'WorkspaceEventMessageResolver',
    'getEventMessage: WorkspaceEventMessageResolver',
  ].forEach((snippet) => {
    if (!source.includes(snippet)) {
      fail(`${relativePath} must consume named Workspace SSE event message fallback contract: ${snippet}`);
    }
  });
  if (/getEventMessage: \(data: Record<string, unknown>, fallback: string\) => string/.test(source)
    || /function getEventMessage\([\s\S]*fallback: string/.test(source)) {
    fail(`${relativePath} must not regress getEventMessage fallback to raw string`);
  }
});
const orchestrationShared = readProjectFile('src/app/workspace/workspace-orchestration-shared.ts');
const implementationStreamEvents = readProjectFile('src/app/workspace/workspace-implementation-stream-events.ts');
[
  'export function buildImplementationStreamPayloadError',
  'new Error(streamError.message)',
  'source: streamError.source',
  'details: streamError.details',
  'engineeringState: streamError.engineeringState',
  'executionResult: streamError.executionResult',
].forEach((snippet) => {
  if (!workspaceStreamBoundaryErrors.includes(snippet)) {
    fail(`workspace-stream-boundary-errors.ts must preserve structured source/details from implementation SSE error payloads: ${snippet}`);
  }
});
[
  "const message = readWorkspaceStreamErrorMessage(data, '生成失败');",
  "source: readWorkspaceStreamErrorSource(data, 'implementation_generation_stream')",
  'details: readWorkspaceStreamErrorDetails(data, message)',
  'readWorkspaceStreamExecutionResult(data.execution_result)',
  'buildImplementationStreamPayloadError(streamError)',
].forEach((snippet) => {
  if (!implementationStreamEvents.includes(snippet)) {
    fail(`workspace-implementation-stream-events.ts must consume stream boundary helpers for implementation SSE errors: ${snippet}`);
  }
});
if (implementationStreamEvents.includes('function readImplementationStreamErrorField')
  || implementationStreamEvents.includes("readWorkspaceStreamErrorField(data, 'source') || 'implementation_generation_stream'")
  || implementationStreamEvents.includes("readWorkspaceStreamErrorField(data, 'details')\n      || readWorkspaceStreamErrorField(data, 'error')")
  || implementationStreamEvents.includes('data.execution_result as Record<string, unknown>')
  || implementationStreamEvents.includes('Object.assign(new Error(streamError.message)')) {
  fail('workspace-implementation-stream-events.ts must not reassemble implementation SSE source/details locally');
}
[
  'export function buildSSEStreamUnreadableError',
  "source: WorkspaceStreamErrorSource = 'sse_stream_reader'",
  'response.body is unavailable; the browser could not attach an SSE reader',
].forEach((snippet) => {
  if (!workspaceStreamBoundaryErrors.includes(snippet)) {
    fail(`workspace-stream-boundary-errors.ts must build structured source/details when SSE response body is unreadable: ${snippet}`);
  }
});
[
  'unreadableSource?: string;',
  'throw buildSSEStreamUnreadableError(unreadableMessage, unreadableSource);',
].forEach((snippet) => {
  if (!orchestrationShared.includes(snippet)) {
    fail(`workspace-orchestration-shared.ts must consume stream boundary helpers when SSE response body is unreadable: ${snippet}`);
  }
});
if (orchestrationShared.includes('function buildSSEStreamUnreadableError')) {
  fail('workspace-orchestration-shared.ts must not reassemble SSE reader source/details locally');
}
[
  ['src/app/workspace/workspace-implementation-stream.ts', "unreadableSource: 'implementation_generation_stream_reader'"],
  ['src/app/workspace/workspace-plan-generation-stream.ts', "unreadableSource: 'plan_generation_stream_reader'"],
].forEach(([relativePath, snippet]) => {
  const source = readProjectFile(relativePath);
  if (!source.includes(snippet)) {
    fail(`${relativePath} must identify the specific SSE reader source for unreadable response bodies: ${snippet}`);
  }
});

[
  'export type ApiErrorDetails = string;',
  'export type ApiErrorSource = string;',
  'export type ApiErrorReasonCode = string;',
  'export type ApiErrorMetadata = {',
  'details?: ApiErrorDetails;',
  'source?: ApiErrorSource;',
  'reasonCode?: ApiErrorReasonCode;',
  'export type ApiResponseRawObject = {',
  '[fieldName: string]: unknown;',
  'export type ApiRequestHeaderMap = {',
  '[headerName: string]: string;',
  'type ApiStructuredErrorSuffixSegment = string;',
  'type ApiStructuredErrorSuffixSegmentList = ApiStructuredErrorSuffixSegment[];',
  'export type ApiErrorRequestContext = {',
  'hadAuthToken: string | null;',
  'requireAuth: boolean;',
  'metadata: ApiErrorMetadata = {}',
  'extractStructuredErrorMetadata',
  'function extractStructuredErrorMetadata(result: ApiResponseRawObject): ApiErrorMetadata',
  'options: ApiErrorRequestContext',
  'const headers: ApiRequestHeaderMap = {',
  'let result: ApiResponseRawObject = {}',
  'JSON.parse(rawText) as ApiResponseRawObject',
  'satisfies ApiErrorMetadata',
  'formatStructuredApiErrorMessage',
  'metadata: ApiErrorMetadata',
  'function getStructuredApiErrorSourceSegment(',
  'function addStructuredApiErrorSuffixSegment(',
  'function materializeStructuredApiErrorSuffixSegments(',
  'const suffixSegments = materializeStructuredApiErrorSuffixSegments(metadata);',
  'this.reasonCode = metadata.reasonCode',
  "reasonCode: typeof result.reason_code === 'string' ? result.reason_code : undefined",
  'metadata',
].forEach((snippet) => {
  if (!apiClient.includes(snippet)) {
    fail(`src/lib/api/index.ts must preserve structured proxy error source/details/reason_code on ApiError: ${snippet}`);
  }
});

if (/function extractStructuredErrorMetadata\(result: Record<string, unknown>\)|let result: Record<string, unknown> = \{\}|JSON\.parse\(rawText\) as Record<string, unknown>/.test(apiClient)) {
  fail('src/lib/api/index.ts must parse ordinary API response/error JSON through ApiResponseRawObject instead of anonymous Record raw objects');
}
if (/const headers: Record<string, string>/.test(apiClient)) {
  fail('src/lib/api/index.ts must build ordinary request headers through ApiRequestHeaderMap instead of an anonymous Record contract');
}
if (/\[sourceMessage, metadata\.details\]\.filter\(Boolean\)|const sourceMessage = metadata\.source \?/.test(apiClient)) {
  fail('src/lib/api/index.ts must materialize structured API error suffixes through named segment readers instead of inline array filters');
}
if (/options: \{ hadAuthToken: string \| null; requireAuth: boolean \}/.test(apiClient)) {
  fail('src/lib/api/index.ts must pass ApiError request auth context through ApiErrorRequestContext instead of an inline object contract');
}

[
  'metadata: { details?: string; source?: string; reasonCode?: string } = {}',
  'metadata: { details?: string; source?: string }',
  'details?: string;\n  source?: string;\n  reasonCode?: string;',
].forEach((snippet) => {
  if (apiClient.includes(snippet)) {
    fail(`src/lib/api/index.ts must not regress structured ApiError diagnostics to anonymous string metadata: ${snippet}`);
  }
});

const workspacePageUi = readProjectFile('src/app/workspace/use-workspace-page-ui.tsx');
[
  '模型列表加载失败',
  '当前模型下拉可能为空或不是最新状态',
  'applyPageUiMessages((prev) => [...prev, {',
].forEach((snippet) => {
  if (!workspacePageUi.includes(snippet)) {
    fail(`src/app/workspace/use-workspace-page-ui.tsx must surface LLM provider list failures: ${snippet}`);
  }
});
if (workspacePageUi.includes('静默失败，模型列表保持为空')) {
  fail('src/app/workspace/use-workspace-page-ui.tsx must not silently hide LLM provider list failures');
}

const backendProxy = readProjectFile('src/app/api/_utils/backend-proxy.ts');
const healthRoute = readProjectFile('src/app/api/health/route.ts');
[
  'export type BackendProxyErrorBody = {',
  'success: false;',
  "source: 'next_api_proxy';",
  "reason_code: 'backend_unreachable' | 'proxy_error';",
  'export type BackendProxyRequestHeaderMap = {',
  '[headerName: string]: string;',
  'export function buildBackendProxyErrorBody(scope: string, error: unknown): BackendProxyErrorBody',
  '): BackendProxyRequestHeaderMap',
  'const headers: BackendProxyRequestHeaderMap = {}',
  'source: \'next_api_proxy\'',
  'details: reason',
  "reason_code: backendUnreachable ? 'backend_unreachable' : 'proxy_error'",
  'Verify the Go backend is running and BACKEND_URL points to a reachable /api/health endpoint',
  "errorBody ?? buildBackendProxyErrorBody('backend request', error)",
].forEach((snippet) => {
  if (!backendProxy.includes(snippet)) {
    fail(`src/app/api/_utils/backend-proxy.ts must expose structured proxy fallback errors: ${snippet}`);
  }
});
if (backendProxy.includes("error: 'Internal server error'")) {
  fail('src/app/api/_utils/backend-proxy.ts must not expose a generic Internal server error fallback');
}
[
  "backendPath: '/api/health'",
  "buildBackendProxyErrorBody('backend health', error)",
].forEach((snippet) => {
  if (!healthRoute.includes(snippet)) {
    fail(`src/app/api/health/route.ts must proxy backend health with structured backend_unreachable diagnostics: ${snippet}`);
  }
});

const devScript = readProjectFile('scripts/dev.sh');
const startScript = readProjectFile('scripts/start.sh');
[
  ['scripts/dev.sh', devScript, 'go-backend.log'],
  ['scripts/start.sh', startScript, 'backend.log'],
].forEach(([relativePath, source, logFile]) => {
  [
    'BACKEND_READY=false',
    'kill -0 "$BACKEND_PID"',
    'Backend did not become ready in time',
    'Health endpoint: http://${BACKEND_HOST}:${BACKEND_PORT}/api/health',
    logFile,
  ].forEach((snippet) => {
    if (!source.includes(snippet)) {
      fail(`${relativePath} must fail fast with backend health diagnostics before starting or declaring the frontend ready: ${snippet}`);
    }
  });
});

[
  ['src/app/api/auth/login/route.ts', 'auth login'],
  ['src/app/api/auth/register/route.ts', 'auth register'],
  ['src/app/api/auth/refresh/route.ts', 'auth refresh'],
  ['src/app/api/auth/logout/route.ts', 'auth logout'],
  ['src/app/api/auth/profile/route.ts', 'auth profile', 'auth profile update'],
  ['src/app/api/auth/change-password/route.ts', 'auth change password'],
  ['src/app/api/chat/models/route.ts', 'chat models'],
  ['src/app/api/chat/generate/route.ts', 'chat generate stream'],
  ['src/app/api/project/plans/route.ts', 'project plans stream'],
  ['src/app/api/project/list/route.ts', 'project list'],
  ['src/app/api/project/create/route.ts', 'project create'],
  ['src/app/api/project/[id]/route.ts', 'project detail', 'project update', 'project delete'],
  ['src/app/api/project/[id]/start/route.ts', 'project runtime start'],
  ['src/app/api/project/[id]/stop/route.ts', 'project runtime stop'],
  ['src/app/api/project/[id]/runtime-status/route.ts', 'project runtime status'],
  ['src/app/api/project/[id]/terminal/ws-ticket/route.ts', 'project terminal ws ticket'],
  ['src/app/api/project/[id]/generation/stop/route.ts', 'project generation stop'],
  ['src/app/api/project/[id]/resource-snapshot/route.ts', 'project resource snapshot'],
  ['src/app/api/project/[id]/resource-alert-readiness/route.ts', 'project resource alert readiness'],
  ['src/app/api/project/[id]/resource-alert-evaluation-preview/route.ts', 'project resource alert evaluation preview'],
  ['src/app/api/project/[id]/resource-alert-events/route.ts', 'project resource alert events'],
  ['src/app/api/project/[id]/resource-alert-events/create/route.ts', 'project resource alert event create'],
  ['src/app/api/project/[id]/resource-alert-notification-readiness/route.ts', 'project resource alert notification readiness'],
  ['src/app/api/project/[id]/resource-alert-notification/send/route.ts', 'project resource alert notification send'],
  ['src/app/api/project/[id]/resource-alert-enforcement-readiness/route.ts', 'project resource alert enforcement readiness'],
  ['src/app/api/project/[id]/resource-alert-enforcement/execute/route.ts', 'project resource alert enforcement execute'],
  ['src/app/api/project/[id]/files/route.ts', 'project file tree'],
  ['src/app/api/project/[id]/files/content/route.ts', 'project file content read', 'project file content write'],
  ['src/app/api/project/[id]/commits/route.ts', 'project commits'],
  ['src/app/api/project/[id]/commits/restore/route.ts', 'project commit restore'],
  ['src/app/api/project/[id]/commits/restore-file/route.ts', 'project commit file restore'],
  ['src/app/api/project/[id]/branches/compare/apply-file/route.ts', 'project branch compare file apply'],
  ['src/app/api/project/[id]/branches/create/route.ts', 'project branch create'],
  ['src/app/api/project/[id]/branches/create-from-remote/route.ts', 'project branch create from remote'],
  ['src/app/api/project/[id]/branches/delete/route.ts', 'project branch delete'],
  ['src/app/api/project/[id]/branches/rename/route.ts', 'project branch rename'],
  ['src/app/api/project/[id]/remotes/route.ts', 'project git remotes'],
  ['src/app/api/project/[id]/remote-branches/route.ts', 'project remote branches'],
  ['src/app/api/project/[id]/remote-branches/refresh/route.ts', 'project remote branches refresh'],
  ['src/app/api/project/[id]/tags/route.ts', 'project tags'],
  ['src/app/api/project/[id]/tags/create/route.ts', 'project tag create'],
  ['src/app/api/project/[id]/tags/delete/route.ts', 'project tag delete'],
  ['src/app/api/project/[id]/stashes/route.ts', 'project stashes'],
  ['src/app/api/project/[id]/stashes/apply/route.ts', 'project stash apply'],
  ['src/app/api/project/[id]/backups/route.ts', 'project backup list'],
  ['src/app/api/project/[id]/backups/policy-readiness/route.ts', 'project backup policy readiness'],
  ['src/app/api/project/[id]/backups/remote-storage-readiness/route.ts', 'project backup remote storage readiness'],
  ['src/app/api/project/[id]/backups/remote-inventory/route.ts', 'project backup remote inventory'],
  ['src/app/api/project/[id]/backups/remote-upload/route.ts', 'project backup remote upload'],
  ['src/app/api/project/[id]/backups/remote-download/route.ts', 'project backup remote download'],
  ['src/app/api/project/[id]/backups/remote-restore/route.ts', 'project backup remote restore'],
  ['src/app/api/project/[id]/backups/create/route.ts', 'project backup create'],
  ['src/app/api/project/[id]/backups/automatic-run/route.ts', 'project automatic backup run'],
  ['src/app/api/project/[id]/backups/[backupId]/download/route.ts', 'project backup download'],
  ['src/app/api/project/[id]/backups/restore-preflight/route.ts', 'project backup restore preflight'],
  ['src/app/api/project/[id]/backups/restore/route.ts', 'project backup restore'],
  ['src/app/api/project/[id]/messages/route.ts', 'project messages read', 'project messages write'],
  ['src/app/api/project/[id]/capability-audits/route.ts', 'project capability audits'],
  ['src/app/api/llm/providers/route.ts', 'llm providers'],
  ['src/app/api/llm/providers/[id]/route.ts', 'llm provider detail'],
  ['src/app/api/llm/config/route.ts', 'llm config read'],
].forEach(([relativePath, ...scopes]) => {
  const source = readProjectFile(relativePath);
  [
    'buildBackendProxyErrorBody',
    'errorBody:',
  ].forEach((snippet) => {
    if (!source.includes(snippet)) {
      fail(`${relativePath} must surface Next proxy fallback errors with structured source/details: ${snippet}`);
    }
  });
  scopes.forEach((scope) => {
    if (!source.includes(scope)) {
      fail(`${relativePath} must expose a stable proxy failure scope: ${scope}`);
    }
  });
  if (source.includes("error: 'Internal server error'")) {
    fail(`${relativePath} must not collapse Next proxy fallback errors to Internal server error`);
  }
  if (source.includes('code: 500') || source.includes('"code"')) {
    fail(`${relativePath} must not return legacy { code, message, data } proxy fallback errors`);
  }
});

const projectRuntimeStatusProxy = readProjectFile('src/app/api/project/[id]/runtime-status/route.ts');
[
  'errorStatus: 503',
  'error: \'Runtime status service unavailable\'',
  '...body',
].forEach((snippet) => {
  if (!projectRuntimeStatusProxy.includes(snippet)) {
    fail(`src/app/api/project/[id]/runtime-status/route.ts must preserve 503 runtime status fallback with source/details: ${snippet}`);
  }
});

const projectCapabilityAuditsProxy = readProjectFile('src/app/api/project/[id]/capability-audits/route.ts');
[
  'responseMode: \'text-or-json\'',
  'errorStatus: 503',
  'error: \'Capability audit service unavailable\'',
  '...body',
].forEach((snippet) => {
  if (!projectCapabilityAuditsProxy.includes(snippet)) {
    fail(`src/app/api/project/[id]/capability-audits/route.ts must preserve 503 capability audit fallback with source/details: ${snippet}`);
  }
});

if (/type ProxyErrorBody =\s*\|\s*Record<string, unknown>|Record<string, unknown>\s*\|\s*\(\(error: unknown\) => Record<string, unknown>\)|buildBackendProxyErrorBody\(scope: string, error: unknown\): Record<string, unknown>/.test(backendProxy)) {
  fail('src/app/api/_utils/backend-proxy.ts must expose proxy error bodies through BackendProxyErrorBody instead of anonymous Record contracts');
}
if (/const headers: Record<string, string>|function buildProxyHeaders\([\s\S]*\): Record<string, string>/.test(backendProxy)) {
  fail('src/app/api/_utils/backend-proxy.ts must build forwarded headers through BackendProxyRequestHeaderMap instead of anonymous Record contracts');
}

[
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/register/route.ts',
  'src/app/api/auth/refresh/route.ts',
  'src/app/api/auth/logout/route.ts',
  'src/app/api/auth/profile/route.ts',
  'src/app/api/auth/change-password/route.ts',
].forEach((relativePath) => {
  const source = readProjectFile(relativePath);
  if (source.includes('code: 500') || source.includes('"code"') || source.includes("error: 'Internal server error'")) {
    fail(`${relativePath} must use structured { success:false, error, details, source } proxy fallback errors`);
  }
});
if (fs.existsSync(path.join(rootDir, 'src/app/api/auth/userinfo/route.ts'))) {
  fail('src/app/api/auth/userinfo/route.ts must not reappear; backend ordinary Auth has no /api/auth/userinfo route');
}

const authHandler = readProjectFile('backend/internal/handler/auth_handler.go');
const authMiddleware = readProjectFile('backend/internal/middleware/auth_middleware.go');
[
  'func writeAuthError(ctx *app.RequestContext, statusCode int, message string)',
  '"success": false',
  '"error":   message',
  'func writeAuthSession(ctx *app.RequestContext, session *AuthSession)',
  '"success": true',
  '"data":    data',
  'func writeAuthUser(ctx *app.RequestContext, user *model.User)',
].forEach((snippet) => {
  if (!authHandler.includes(snippet)) {
    fail(`backend/internal/handler/auth_handler.go must keep ordinary Auth success/data/error response envelope: ${snippet}`);
  }
});

[
  'type AuthUserLookup interface',
  'FindByID(ctx context.Context, id string) (*model.User, error)',
  'type AuthAdminLookup interface',
  'FindByID(ctx context.Context, id string) (*model.Admin, error)',
  'cfg.AdminRepo.FindByID(c, claims.UserID)',
  'cfg.UserRepo.FindByID(c, claims.UserID)',
  '"登录用户不存在，请重新登录"',
  '"管理员登录状态已失效，请重新登录"',
  'func NewUserAuthConfig(jwtCfg *config.JWTConfig, userRepo AuthUserLookup) *AuthConfig',
  'func NewAdminAuthConfig(jwtCfg *config.JWTConfig, adminRepo AuthAdminLookup) *AuthConfig',
].forEach((snippet) => {
  if (!authMiddleware.includes(snippet)) {
    fail(`backend/internal/middleware/auth_middleware.go must validate JWT subjects against users/admins before protected handlers run: ${snippet}`);
  }
});
[
  'authProtected.Use(middleware.Auth(middleware.NewUserAuthConfig(jwtCfg, userRepo)))',
  'chatProtected.Use(middleware.Auth(middleware.NewUserAuthConfig(jwtCfg, userRepo)))',
  'project.Use(middleware.Auth(middleware.NewUserAuthConfig(jwtCfg, userRepo)))',
  'adminAuthProtected.Use(middleware.Auth(middleware.NewAdminAuthConfig(jwtCfg, adminRepo)))',
  'admin.Use(middleware.Auth(middleware.NewAdminAuthConfig(jwtCfg, adminRepo)))',
].forEach((snippet) => {
  if (!backendServerRoutes.includes(snippet)) {
    fail(`backend/cmd/server/main.go must inject user/admin repositories into Auth middleware: ${snippet}`);
  }
});
[
  'authProtected.Use(middleware.Auth(middleware.NewAuthConfig(jwtCfg)))',
  'chatProtected.Use(middleware.Auth(middleware.NewAuthConfig(jwtCfg)))',
  'project.Use(middleware.Auth(middleware.NewAuthConfig(jwtCfg)))',
  'admin.Use(middleware.Auth(middleware.NewAuthConfig(nil)))',
].forEach((snippet) => {
  if (backendServerRoutes.includes(snippet)) {
    fail(`backend/cmd/server/main.go must not use Auth middleware without subject existence validation: ${snippet}`);
  }
});
[
  'type ErrorResponse struct',
  'Success    bool   `json:"success"`',
  'Error      string `json:"error"`',
  'ReasonCode string `json:"reason_code,omitempty"`',
  'func responseReasonCode(code int) string',
  'return "auth_required"',
  'map[string]any{',
  '"success": true',
].forEach((snippet) => {
  if (!errorMiddleware.includes(snippet)) {
    fail(`backend/internal/middleware/error_middleware.go must use success/error/reason_code instead of legacy code/message/data: ${snippet}`);
  }
});
[
  '`json:"code"`',
  '`json:"message"`',
  '"code":    0',
  '"message": "success"',
].forEach((snippet) => {
  if (errorMiddleware.includes(snippet)) {
    fail(`backend/internal/middleware/error_middleware.go must not expose legacy code/message/data response fields: ${snippet}`);
  }
});

[
  '普通用户认证接口统一返回 `{ success, data/error }`',
  '### GET `/api/auth/profile`',
  '### POST `/api/auth/change-password`',
  '"success": true',
  '"data": null',
].forEach((snippet) => {
  if (!apiDocs.includes(snippet)) {
    fail(`docs/API.md must document ordinary Auth success/data/error response contracts: ${snippet}`);
  }
});
[
  'code": 0',
  '"message": "success"',
].forEach((snippet) => {
  if (apiDocs.includes(snippet)) {
    fail(`docs/API.md must not document legacy code/message success envelopes: ${snippet}`);
  }
});
[
  'success: boolean;',
  'data?: T;',
  'error?: string;',
  'source?: string;',
  'reason_code?: string;',
  'source=next_api_proxy',
  'reason_code=backend_unreachable',
].forEach((snippet) => {
  if (!developerGuide.includes(snippet)) {
    fail(`docs/DEVELOPER_GUIDE.md must describe current success/data/error API response model: ${snippet}`);
  }
});
[
  'code: number;',
  'message: string;',
  'SUCCESS: 0',
].forEach((snippet) => {
  if (developerGuide.includes(snippet)) {
    fail(`docs/DEVELOPER_GUIDE.md must not present legacy code/message API response model: ${snippet}`);
  }
});

const llmProvidersProxy = readProjectFile('src/app/api/llm/providers/route.ts');
[
  'data.data.providers',
  'Array.isArray(data.data.providers)',
].forEach((snippet) => {
  if (llmProvidersProxy.includes(snippet)) {
    fail(`src/app/api/llm/providers/route.ts must proxy the backend public provider response without legacy remapping: ${snippet}`);
  }
});

const llmProviderDetailProxy = readProjectFile('src/app/api/llm/providers/[id]/route.ts');
[
  'data?.data',
  'data.data =',
  'display_name: data.data.display_name',
].forEach((snippet) => {
  if (llmProviderDetailProxy.includes(snippet)) {
    fail(`src/app/api/llm/providers/[id]/route.ts must rely on backend LLMProviderPublicResponse instead of duplicating field remapping: ${snippet}`);
  }
});

console.log('[YES] API response contract validation passed.');
