// API 客户端
// 与后端真实 API 交互
import {
  clearUserAuthSessionStorage,
  formatUserAuthStorageFailure,
  readUserAuthTokenStorage,
} from '@/lib/auth-storage';
import type { AIModelName, AIModelProviderConnectionTestMessage, AIModelProviderConnectionTestStatus, AIModelProvider, AIModelProviderType, ChatMessageRole, GitBranch, GitBranchCompare, GitBranchCompareFileApplyResult, GitBranchCreateFromRemoteResult, GitBranchCreateResult, GitBranchDeleteResult, GitBranchRenameResult, GitBranchSwitchReadiness, GitBranchSwitchResult, GitCommit, GitCommitFileRestoreResult, GitRemote, GitRemoteBranch, GitRemoteBranchRefreshResult, GitStash, GitStashApplyResult, GitStashCreateResult, GitTag, GitTagCreateResult, GitTagDeleteResult, GitWorktreeCommitResult, GitWorktreeFileDiscardResult, GitWorktreeStatus, ProjectBackupListResult, ProjectBackupPolicyReadiness, ProjectBackupRemoteDownloadResult, ProjectBackupRemoteInventoryResult, ProjectBackupRemoteRestoreResult, ProjectBackupRemoteStorageReadiness, ProjectBackupRemoteUploadResult, ProjectBackupRestorePreflightResult, ProjectBackupRestoreResult, ProjectBackupResult, ProjectContainerStatusPersistenceStatus, ProjectContainerStopContainerStatus, ProjectContainerStopStatus, ProjectResourceAlertEnforcementExecuteResult, ProjectResourceAlertEnforcementReadiness, ProjectResourceAlertEvaluationPreview, ProjectResourceAlertEventCreateResult, ProjectResourceAlertEventListResult, ProjectResourceAlertEventStatus, ProjectResourceAlertNotificationReadiness, ProjectResourceAlertNotificationSendResult, ProjectResourceAlertReadiness, ProjectResourceSnapshotResult, ProjectRestoreMutationStatus, ProjectRuntimeContainerStatus, ProjectRuntimeError, ProjectRuntimeLifecycleStatus, ProjectRuntimeMessage, ProjectRuntimePhase, ProjectRuntimeSpecHash, ProjectRuntimeStatusPersistenceStatus } from '@/lib/types';
import type { VisualAttachmentInput, VisualContext } from '@/lib/visual-context';
import type { WorkspaceBackendWorkflowStage, WorkspaceWorkflowMode } from '@/lib/workspace/workflow-contract';

// 使用环境变量或服务端地址（沙箱环境使用服务端域名）
const getApiBaseUrl = () => {
  // 1. 仅在前后端分域部署时显式配置公开 API 地址。
  //    常规部署建议保持为空，通过同源 /api 或反向代理访问，
  //    不要直接复用服务端专用的 BACKEND_URL（常见情况是 127.0.0.1，仅服务端可达）。
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // 2. 沙箱环境：使用服务端地址
  if (typeof window !== 'undefined') {
    // 指向服务端 API（在同一域名下使用相对路径，或使用服务端地址）
    return window.location.origin + '/api';
  }
  
  // 3. 默认值
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

// HTTP 方法类型
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

type RequestOptions = {
  method?: HttpMethod;
  body?: object;
  requireAuth?: boolean;
  signal?: AbortSignal;
};

export type HealthCheckResponse = {
  service: string;
  status: string;
};

export type ApiErrorDetails = string;
export type ApiErrorSource = string;
export type ApiErrorReasonCode = string;

export type ApiErrorMetadata = {
  details?: ApiErrorDetails;
  source?: ApiErrorSource;
  reasonCode?: ApiErrorReasonCode;
};

export type ApiResponseRawObject = {
  [fieldName: string]: unknown;
};

export type ApiRequestHeaderMap = {
  [headerName: string]: string;
};

type ApiStructuredErrorSuffixSegment = string;
type ApiStructuredErrorSuffixSegmentList = ApiStructuredErrorSuffixSegment[];

export type ApiErrorRequestContext = {
  hadAuthToken: string | null;
  requireAuth: boolean;
};

// 错误类型
export class ApiError extends Error {
  code: number;
  data?: unknown;
  details?: ApiErrorDetails;
  source?: ApiErrorSource;
  reasonCode?: ApiErrorReasonCode;
  
  constructor(
    message: string,
    code: number,
    data?: unknown,
    metadata: ApiErrorMetadata = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.data = data;
    this.details = metadata.details;
    this.source = metadata.source;
    this.reasonCode = metadata.reasonCode;
  }
}

// 获取认证 Token
function getAuthToken(): string | null {
  const result = readUserAuthTokenStorage();
  if (result.ok) {
    return result.value;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('yistack:auth-storage-failed', {
      detail: {
        message: `普通登录凭据读取失败：${formatUserAuthStorageFailure(result, '浏览器拒绝读取普通登录凭据')}。当前请求无法确认 yistack_token，可能会被后端判定为未登录；请检查浏览器本地存储权限后重新登录。`,
      },
    }));
  }
  return null;
}

function clearAuthSession() {
  if (typeof window === 'undefined') return;
  const clearResult = clearUserAuthSessionStorage();
  document.cookie = 'yistack_token=; Path=/; Max-Age=0; SameSite=Lax';
  if (!clearResult.ok) {
    window.dispatchEvent(new CustomEvent('yistack:auth-expired', {
      detail: {
        message: `登录已失效，但普通登录凭据清理失败：${formatUserAuthStorageFailure(clearResult, '浏览器拒绝清理普通登录凭据或本地项目快照')}。页面状态已退出登录，浏览器中的 yistack_token、yistack_user 或 yistack_current_project 可能仍残留；请检查本地存储权限后重新登录。`,
      },
    }));
    return;
  }
  if (clearResult.value.hadToken || clearResult.value.hadUser) {
    window.dispatchEvent(new Event('yistack:auth-expired'));
  }
}

function normalizeApiErrorMessage(message?: string, code?: number): string {
  if (code === 1002) {
    return '登录已失效，请重新登录';
  }

  switch (message) {
    case 'invalid or expired token':
      return '登录已失效，请重新登录';
    case 'missing authorization header':
      return '未检测到登录凭证，请重新登录';
    case 'invalid authorization format':
      return '登录凭证格式无效，请重新登录';
    case 'unauthorized':
      return '未登录或登录已失效';
    default:
      return message || '请求失败';
  }
}

function extractStructuredErrorMetadata(result: ApiResponseRawObject): ApiErrorMetadata {
  return {
    details: typeof result.details === 'string' ? result.details : undefined,
    source: typeof result.source === 'string' ? result.source : undefined,
    reasonCode: typeof result.reason_code === 'string' ? result.reason_code : undefined,
  } satisfies ApiErrorMetadata;
}

function getStructuredApiErrorSourceSegment(
  source: ApiErrorSource | undefined,
): ApiStructuredErrorSuffixSegment | undefined {
  if (source === undefined) {
    return undefined;
  }

  return `来源：${source}`;
}

function addStructuredApiErrorSuffixSegment(
  segments: ApiStructuredErrorSuffixSegmentList,
  segment: ApiStructuredErrorSuffixSegment | undefined,
) {
  if (segment === undefined) {
    return;
  }

  segments.push(segment);
}

function materializeStructuredApiErrorSuffixSegments(
  metadata: ApiErrorMetadata,
): ApiStructuredErrorSuffixSegmentList {
  const segments: ApiStructuredErrorSuffixSegmentList = [];
  const sourceSegment = getStructuredApiErrorSourceSegment(metadata.source);

  addStructuredApiErrorSuffixSegment(segments, sourceSegment);
  addStructuredApiErrorSuffixSegment(segments, metadata.details);

  return segments;
}

function formatStructuredApiErrorMessage(
  message: string,
  metadata: ApiErrorMetadata,
) {
  const suffixSegments = materializeStructuredApiErrorSuffixSegments(metadata);
  const suffix = suffixSegments.join('；');
  return suffix ? `${message}（${suffix}）` : message;
}

function buildRequestConfig(options: RequestOptions = {}) {
  const { method = 'GET', body, requireAuth = false, signal } = options;
  const hadAuthToken = requireAuth ? getAuthToken() : null;

  const headers: ApiRequestHeaderMap = {
    'Content-Type': 'application/json',
  };

  if (requireAuth) {
    if (hadAuthToken) {
      headers['Authorization'] = `Bearer ${hadAuthToken}`;
    }
  }

  const config: RequestInit = {
    method,
    headers,
    signal,
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  return { config, hadAuthToken, requireAuth };
}

async function throwApiError(
  response: Response,
  options: ApiErrorRequestContext,
): Promise<never> {
  const { hadAuthToken, requireAuth } = options;
  const rawText = await response.text();
  let result: ApiResponseRawObject = {};

  if (rawText) {
    try {
      result = JSON.parse(rawText) as ApiResponseRawObject;
    } catch {
      throw new ApiError(rawText || `请求失败 (${response.status})`, response.status);
    }
  }

  const errorCode = response.status;
  const metadata = extractStructuredErrorMetadata(result);
  const errorMessage = normalizeApiErrorMessage(
    (typeof result.error === 'string' ? result.error : undefined)
      || (typeof result.message === 'string' ? result.message : undefined)
      || `请求失败 (${response.status})`,
    errorCode
  );

  if (requireAuth && hadAuthToken && response.status === 401) {
    clearAuthSession();
  }

  throw new ApiError(
    formatStructuredApiErrorMessage(errorMessage, metadata),
    errorCode,
    result.data,
    metadata,
  );
}

// 通用请求函数
async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { config, hadAuthToken, requireAuth } = buildRequestConfig(options);
  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  // HTTP 状态码优先
  if (!response.ok) {
    await throwApiError(response, { hadAuthToken, requireAuth });
  }

  const rawText = await response.text();
  let result: ApiResponseRawObject = {};
  if (rawText) {
    try {
      result = JSON.parse(rawText) as ApiResponseRawObject;
    } catch {
      throw new ApiError('响应格式无效', response.status || -1);
    }
  }

  if (result.success === false) {
    const errorCode = -1;
    const metadata = extractStructuredErrorMetadata(result);
    const errorMessage = normalizeApiErrorMessage(
      (typeof result.error === 'string' ? result.error : undefined)
        || (typeof result.message === 'string' ? result.message : undefined),
      errorCode
    );

    throw new ApiError(
      formatStructuredApiErrorMessage(errorMessage, metadata),
      errorCode,
      result.data,
      metadata,
    );
  }
  
  // 返回 data 字段，如果没有 data 字段则返回整个响应
  return (result.data !== undefined ? result.data : result) as T;
}

async function requestStream(
  endpoint: string,
  options: RequestOptions = {},
): Promise<Response> {
  const { config, hadAuthToken, requireAuth } = buildRequestConfig(options);
  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  if (!response.ok) {
    await throwApiError(response, { hadAuthToken, requireAuth });
  }
  return response;
}

// ============================================
// 认证 API
// ============================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  status: string;
  plan?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  refresh_token?: string;
}

export interface AuthRefreshResponse {
  token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  refresh_token?: string;
}

export const authApi = {
  // 用户登录
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: data,
    });
  },
  
  // 用户注册
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: data,
    });
  },
  
  // 刷新 Token
  refreshToken: async (token: string): Promise<AuthRefreshResponse> => {
    return request<AuthRefreshResponse>('/auth/refresh', {
      method: 'POST',
      body: { refresh_token: token },
    });
  },
};

// ============================================
// 项目 API
// ============================================

export type ProjectEngineeringStateRawObject = {
  [fieldName: string]: unknown;
};

interface ProjectPayload {
  id?: string;
  project_id?: string;
  name?: string;
  description?: string;
  app_type?: string;
  tech_stack?: string;
  container_id?: string;
  container_name?: string;
  container_port?: number;
  internal_port?: number;
  preview_url?: string;
  preview_share_enabled?: boolean;
  preview_share_id?: string;
  preview_share_url?: string;
  container_image?: string;
  container_status?: ProjectRuntimeContainerStatus;
  git_branch?: string;
  directory_path?: string;
  file_tree?: unknown;
  plan_id?: string;
  plan_data?: string;
  engineering_state?: ProjectEngineeringStateRawObject;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  app_type?: string;
  tech_stack?: string;
  container_id?: string;
  container_name?: string;
  container_port?: number;
  internal_port?: number;
  preview_url?: string;
  preview_share_enabled?: boolean;
  preview_share_id?: string;
  preview_share_url?: string;
  container_image?: string;
  container_status?: ProjectRuntimeContainerStatus;
  git_branch?: string;
  directory_path?: string;
  file_tree?: unknown;
  plan_id?: string;
  plan_data?: string;
  engineering_state?: ProjectEngineeringStateRawObject;
  created_at?: string;
  access_role?: 'owner' | 'editor' | 'viewer';
  can_write?: boolean;
  can_manage_members?: boolean;
  updated_at?: string;
}

export interface ProjectRuntimeStatus {
  projectId?: string;
  taskId?: string;
  status: ProjectRuntimeLifecycleStatus;
  containerStatus?: ProjectRuntimeContainerStatus;
  internalPort?: number;
  previewUrl?: string;
  phase?: ProjectRuntimePhase;
  message?: ProjectRuntimeMessage;
  error?: ProjectRuntimeError;
  specHash?: ProjectRuntimeSpecHash;
  containerStatusPersistence?: ProjectContainerStatusPersistenceStatus;
  containerStatusPersistenceError?: string;
  persistenceStatus?: ProjectRuntimeStatusPersistenceStatus;
  persistenceError?: string;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

export type ProjectRuntimeActivityStatusValue =
  | 'touched'
  | 'not_required'
  | 'unavailable'
  | 'inspect_failed'
  | 'missing'
  | 'inactive'
  | 'failed';

export type ProjectRuntimeActivitySource = string;

export type ProjectRuntimeActivityMessage = string;

export type ProjectRuntimeActivityError = string;

export type ProjectResourceAlertEventListOptions = {
  limit?: number;
  offset?: number;
  status?: ProjectResourceAlertEventStatus;
};

export interface ProjectRuntimeActivityStatus {
  projectId?: string;
  activityStatus: ProjectRuntimeActivityStatusValue;
  containerStatus?: ProjectRuntimeContainerStatus;
  source?: ProjectRuntimeActivitySource;
  message?: ProjectRuntimeActivityMessage;
  error?: ProjectRuntimeActivityError;
  updatedAt?: string;
}

export type CapabilityExecutionAuditProjectId = string;
export type CapabilityExecutionAuditUserId = string;
export type CapabilityExecutionAuditWorkflowStage = string;
export type CapabilityExecutionAuditWorkflowMode = string;
export type CapabilityExecutionAuditCapabilityProfile = string;
export type CapabilityExecutionAuditStatus = string;
export type CapabilityExecutionAuditSourceNote = string;
export type CapabilityExecutionAuditCreatedAt = string;
export type CapabilityExecutionAuditListStatusFilter = CapabilityExecutionAuditStatus;
export type CapabilityExecutionAuditListCapabilityProfileFilter = CapabilityExecutionAuditCapabilityProfile;

export interface CapabilityExecutionAuditRecord {
  id: number;
  project_id: CapabilityExecutionAuditProjectId;
  user_id?: CapabilityExecutionAuditUserId;
  workflow_stage?: CapabilityExecutionAuditWorkflowStage;
  workflow_mode?: CapabilityExecutionAuditWorkflowMode;
  capability_profile?: CapabilityExecutionAuditCapabilityProfile;
  status?: CapabilityExecutionAuditStatus;
  provider_resolution?: unknown;
  execution_audit?: unknown;
  execution_result?: unknown;
  source_note?: CapabilityExecutionAuditSourceNote;
  created_at?: CapabilityExecutionAuditCreatedAt;
}

export interface CapabilityExecutionAuditListResponse {
  records: CapabilityExecutionAuditRecord[];
  total: number;
  offset: number;
  limit: number;
}

export type CapabilityExecutionAuditListOptions = {
  limit?: number;
  offset?: number;
  status?: CapabilityExecutionAuditListStatusFilter;
  capabilityProfile?: CapabilityExecutionAuditListCapabilityProfileFilter;
};

export interface TerminalWebSocketTicket {
  ticket: string;
}

export type TechStackProfile =
  | 'node-nextjs'
  | 'node-react'
  | 'node-vue'
  | 'node-express'
  | 'python-fastapi'
  | 'python-django'
  | 'python-flask'
  | 'go-gin'
  | 'go-fiber'
  | 'static-html'
  | string;

export type TechStackLegacyLabel = string;
export type TechStackLegacyLabelList = TechStackLegacyLabel[];

export type TechStackSummaryLabel = string;
export type TechStackSummaryList = TechStackSummaryLabel[];

export type PlanFeature = string;
export type PlanFeatureList = PlanFeature[];

export type TechStackPackageManager = string;

export type TechStackRuntimeConfig = {
  profile?: TechStackProfile;
  needs_container?: boolean;
  package_manager?: TechStackPackageManager;
};

export type TechStackSectionRawObject = {
  [fieldName: string]: unknown;
};

export type TechStackStructuredValue = {
  runtime?: TechStackRuntimeConfig;
  frontend?: TechStackSectionRawObject;
  backend?: TechStackSectionRawObject;
  database?: TechStackSectionRawObject;
  deployment?: TechStackSectionRawObject;
  summary?: TechStackSummaryList;
  [key: string]: unknown;
};

export type TechStackValue = TechStackLegacyLabelList | TechStackStructuredValue;

export interface ProjectMessage {
  id: number;
  project_id: string;
  user_id?: string;
  role: ChatMessageRole;
  content: string;
  model?: AIModelName;
  visual_attachments?: string;
  visual_context?: string;
  created_at?: string;
}

export type ProjectMessageSaveInput = {
  role: ChatMessageRole;
  content: string;
  model?: AIModelName;
};

export interface ProjectMessagesSaveResponse {
  success: boolean;
  message: string;
}

export interface ProjectCommitRestoreResponse {
  success: boolean;
  message: string;
}

export type ProjectFileTreeSyncStatus = 'updated' | 'failed';
export type ProjectFileTreeSyncError = string;
export type ProjectFileTreeSyncErrorSource = string;
export type ProjectFileTreeSyncErrorDetails = string;

export type ProjectGitSnapshotStatus =
  | 'created'
  | 'skipped_no_changes'
  | 'failed'
  | 'created_record_missing'
  | 'created_record_failed';
export type ProjectGitSnapshotError = string;
export type ProjectGitSnapshotErrorSource = string;
export type ProjectGitSnapshotErrorDetails = string;

export type ProjectDeletionCleanupScope = string;
export type ProjectDeletionCleanupScopeList = ProjectDeletionCleanupScope[];
export type ProjectSoftDeleteRestoreScope = string;
export type ProjectSoftDeleteRestoreScopeList = ProjectSoftDeleteRestoreScope[];

export type PlanComplexity = 'simple' | 'medium' | 'complex';

export interface Plan {
  id: string;
  name: string;
  description: string;
  tech_stack: TechStackValue;
  architecture: string;
  complexity: PlanComplexity;
  est_files: number;
  features: PlanFeatureList;
  reasoning: string;
  visual_context?: VisualContext;
}

export interface ChatGenerateRequest {
  prompt: string;
  project_id?: string;
  app_type?: string;
  project_name?: string;
  mode?: WorkspaceWorkflowMode;
  online?: boolean;
  provider?: AIModelProvider;
  temperature?: number;
  conversation_stage?: WorkspaceBackendWorkflowStage;
  capability_profile?: string;
  plan_context?: string;
  idempotency_key?: string;
  visual_attachments?: VisualAttachmentInput[];
  visual_context?: VisualContext;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
}

export interface ProjectListRawResponse {
  projects?: ProjectPayload[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface ProjectDeleteAcceptedResponse {
  project_id: string;
  deletion_status: 'accepted';
  cleanup_status: 'background_cleanup_pending';
  cleanup_scope: ProjectDeletionCleanupScopeList;
  cleanup_strategy: 'soft_delete_then_async_cleanup';
  restore_window_seconds: number;
  can_restore: boolean;
}

export interface ProjectSoftDeleteRestoreResponse {
  project_id: string;
  restore_status: ProjectRestoreMutationStatus;
  can_restore: boolean;
  cleanup_status?: 'cancelled_by_user_restore';
  cleanup_strategy?: 'soft_delete_restore_before_async_cleanup';
  restored_project?: ProjectPayload;
  restore_scope?: ProjectSoftDeleteRestoreScopeList;
  restore_boundary?: string;
  restore_window_open?: boolean;
  recovery?: string;
}

export interface ProjectSoftDeleteRestoreResult {
  project_id: string;
  restore_status: ProjectRestoreMutationStatus;
  can_restore: boolean;
  cleanup_status?: 'cancelled_by_user_restore';
  cleanup_strategy?: 'soft_delete_restore_before_async_cleanup';
  restored_project?: Project;
  restore_scope?: ProjectSoftDeleteRestoreScopeList;
  restore_boundary?: string;
  restore_window_open?: boolean;
  recovery?: string;
}

export interface ProjectFileReadResponse {
  path: string;
  content: string;
}

export interface ProjectFileWriteResponse {
  path: string;
  write_status: 'saved';
  file_tree_status: ProjectFileTreeSyncStatus;
  file_tree_status_label: string;
  file_tree_error?: ProjectFileTreeSyncError;
  file_tree_error_source?: ProjectFileTreeSyncErrorSource;
  file_tree_error_details?: ProjectFileTreeSyncErrorDetails;
  commit_status: ProjectGitSnapshotStatus;
  commit_status_label: string;
  commit_error?: ProjectGitSnapshotError;
  commit_error_source?: ProjectGitSnapshotErrorSource;
  commit_error_details?: ProjectGitSnapshotErrorDetails;
}

export type ProjectFileOperationKind =
  | 'create_file'
  | 'create_directory'
  | 'rename_file'
  | 'rename_directory'
  | 'delete_file'
  | 'delete_directory';

export interface ProjectFileOperationResponse {
  operation_status: 'applied';
  operation_status_label: string;
  operation: ProjectFileOperationKind;
  path: string;
  target_path?: string;
  file_tree_status: ProjectFileTreeSyncStatus;
  file_tree_status_label: string;
  file_tree_error?: ProjectFileTreeSyncError;
  file_tree_error_source?: ProjectFileTreeSyncErrorSource;
  file_tree_error_details?: ProjectFileTreeSyncErrorDetails;
  commit_status: ProjectGitSnapshotStatus;
  commit_status_label: string;
  commit_error?: ProjectGitSnapshotError;
  commit_error_source?: ProjectGitSnapshotErrorSource;
  commit_error_details?: ProjectGitSnapshotErrorDetails;
}

export interface ProjectContainerStopResponse {
  project_id: string;
  stop_status: ProjectContainerStopStatus;
  container_status: ProjectContainerStopContainerStatus;
  container_status_persistence: ProjectContainerStatusPersistenceStatus;
  container_status_persistence_error?: string;
  runtime_status?: ProjectRuntimeStatus;
}

export type ProjectGenerationJobStatus =
  | 'queued'
  | 'running'
  | 'repairing'
  | 'validating'
  | 'previewing'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export interface ProjectGenerationJobSummary {
  id: string;
  project_id: string;
  idempotency_key: string;
  status: ProjectGenerationJobStatus;
  workflow_stage: string;
  workflow_mode: string;
  provider: string;
  model: string;
  current_attempt: number;
  last_event_sequence: number;
  error_code: string;
  error_message: string;
  stop_reason: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}


export interface ProjectGenerationStopResponse {
  success: boolean;
  message: string;
  generation_stopped: boolean;
}

export interface ProjectGenerationStatusResponse {
  success: boolean;
  project_id: string;
  generation_active: boolean;
  generation_job: ProjectGenerationJobSummary | null;
}

export interface ProjectPreviewShareResult {
  project_id: string;
  preview_share_enabled: boolean;
  preview_share_id?: string;
  preview_share_path?: string;
  preview_share_url?: string;
  message: string;
}

function normalizeProject(project: ProjectPayload): Project {
  const projectId = project.project_id || project.id || '';
  return {
    id: project.id || projectId,
    project_id: projectId,
    name: project.name || '',
    description: project.description,
    app_type: project.app_type,
    tech_stack: project.tech_stack,
    container_id: project.container_id,
    container_name: project.container_name,
    container_port: project.container_port,
    internal_port: project.internal_port,
    preview_url: project.preview_url,
    preview_share_enabled: project.preview_share_enabled,
    preview_share_id: project.preview_share_id,
    preview_share_url: project.preview_share_url,
    container_image: project.container_image,
    container_status: project.container_status,
    git_branch: project.git_branch,
    directory_path: project.directory_path,
    file_tree: project.file_tree,
    plan_id: project.plan_id,
    plan_data: project.plan_data,
    engineering_state: project.engineering_state,
    created_at: project.created_at,
    updated_at: project.updated_at,
  };
}

function normalizeProjectListResponse(response: ProjectListRawResponse): ProjectListResponse {
  const projects: Project[] = [];
  const responseProjects = response.projects;
  const seenProjectIds = new Set<string>();
  const seenRecentProjectFingerprints = new Set<string>();

  if (responseProjects !== undefined) {
    for (const project of responseProjects) {
      const normalizedProject = normalizeProject(project);
      const projectId = normalizedProject.project_id;
      const hasSeenProject = seenProjectIds.has(projectId);
      if (hasSeenProject === true) {
        continue;
      }
      seenProjectIds.add(projectId);
      const recentFingerprint = getRecentProjectListFingerprint(normalizedProject);
      const hasRecentFingerprint = recentFingerprint !== null && seenRecentProjectFingerprints.has(recentFingerprint);
      if (hasRecentFingerprint === true) {
        continue;
      }
      if (recentFingerprint !== null) {
        seenRecentProjectFingerprints.add(recentFingerprint);
      }
      projects.push(normalizedProject);
    }
  }

  return {
    projects,
    total: response.total || 0,
  };
}

function getRecentProjectListFingerprint(project: Project): string | null {
  const createdAtValue = typeof project.created_at === 'string' ? project.created_at : '';
  const createdAt = Date.parse(createdAtValue);
  if (Number.isNaN(createdAt)) {
    return null;
  }

  const bucket = Math.floor(createdAt / (2 * 60 * 1000));
  return [
    getProjectListFingerprintText(project.name),
    getProjectListFingerprintText(project.description),
    getProjectListFingerprintText(project.app_type),
    String(bucket),
  ].join('\x1f');
}

function getProjectListFingerprintText(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }

  return value.trim();
}

export const projectApi = {
  // 创建项目
  create: async (data: {
    name?: string;
    description?: string;
    app_type?: string;
    tech_stack?: string;
    plan_id?: string;
    plan_data?: string;
  }): Promise<Project> => {
    const response = await request<ProjectPayload>('/project/create', {
      method: 'POST',
      body: data,
      requireAuth: true,
    });
    return normalizeProject(response);
  },
  
  // 获取项目列表
  list: async (): Promise<ProjectListResponse> => {
    const response = await request<ProjectListRawResponse>('/project/list', {
      requireAuth: true,
    });
    return normalizeProjectListResponse(response);
  },
  
  // 获取项目详情
  get: async (id: string): Promise<Project> => {
    const response = await request<ProjectPayload>(`/project/${id}`, {
      requireAuth: true,
    });
    return normalizeProject(response);
  },
  
  // 更新项目
  update: async (id: string, data: Partial<Project>): Promise<Project> => {
    const response = await request<ProjectPayload>(`/project/${id}`, {
      method: 'PUT',
      body: data,
      requireAuth: true,
    });
    return normalizeProject(response);
  },
  
  // 删除项目
  delete: async (id: string): Promise<ProjectDeleteAcceptedResponse> => {
    return request<ProjectDeleteAcceptedResponse>(`/project/${id}`, {
      method: 'DELETE',
      requireAuth: true,
    });
  },

  restoreDeleted: async (id: string): Promise<ProjectSoftDeleteRestoreResult> => {
    const response = await request<ProjectSoftDeleteRestoreResponse>(`/project/${id}/restore`, {
      method: 'POST',
      requireAuth: true,
    });
    return {
      ...response,
      restored_project: response.restored_project ? normalizeProject(response.restored_project) : undefined,
    };
  },

  enablePreviewShare: async (id: string): Promise<ProjectPreviewShareResult> => {
    return request<ProjectPreviewShareResult>(`/project/${id}/preview-share`, {
      method: 'POST',
      requireAuth: true,
    });
  },

  disablePreviewShare: async (id: string): Promise<ProjectPreviewShareResult> => {
    return request<ProjectPreviewShareResult>(`/project/${id}/preview-share`, {
      method: 'DELETE',
      requireAuth: true,
    });
  },

  // 启动项目容器
  startContainer: async (id: string): Promise<ProjectRuntimeStatus> => {
    return request<ProjectRuntimeStatus>(`/project/${id}/start`, {
      method: 'POST',
      requireAuth: true,
    });
  },

  getRuntimeStatus: async (id: string): Promise<ProjectRuntimeStatus> => {
    return request<ProjectRuntimeStatus>(`/project/${id}/runtime-status`, {
      requireAuth: true,
    });
  },

  getResourceSnapshot: async (id: string): Promise<ProjectResourceSnapshotResult> => {
    return request<ProjectResourceSnapshotResult>(`/project/${id}/resource-snapshot`, {
      requireAuth: true,
    });
  },

  getResourceAlertReadiness: async (id: string): Promise<ProjectResourceAlertReadiness> => {
    return request<ProjectResourceAlertReadiness>(`/project/${id}/resource-alert-readiness`, {
      requireAuth: true,
    });
  },

  getResourceAlertEvaluationPreview: async (id: string): Promise<ProjectResourceAlertEvaluationPreview> => {
    return request<ProjectResourceAlertEvaluationPreview>(`/project/${id}/resource-alert-evaluation-preview`, {
      requireAuth: true,
    });
  },

  createResourceAlertEvent: async (id: string, confirmCreate: boolean): Promise<ProjectResourceAlertEventCreateResult> => {
    return request<ProjectResourceAlertEventCreateResult>(`/project/${id}/resource-alert-events/create`, {
      method: 'POST',
      body: { confirm_create: confirmCreate },
      requireAuth: true,
    });
  },

  listResourceAlertEvents: async (id: string, options: ProjectResourceAlertEventListOptions = {}): Promise<ProjectResourceAlertEventListResult> => {
    const params = new URLSearchParams();
    params.set('limit', String(options.limit ?? 20));
    params.set('offset', String(options.offset ?? 0));
    if (options.status) {
      params.set('status', options.status);
    }
    return request<ProjectResourceAlertEventListResult>(`/project/${id}/resource-alert-events?${params.toString()}`, {
      requireAuth: true,
    });
  },

  getResourceAlertNotificationReadiness: async (id: string): Promise<ProjectResourceAlertNotificationReadiness> => {
    return request<ProjectResourceAlertNotificationReadiness>(`/project/${id}/resource-alert-notification-readiness`, {
      requireAuth: true,
    });
  },

  sendResourceAlertNotification: async (id: string, confirmSend: boolean): Promise<ProjectResourceAlertNotificationSendResult> => {
    return request<ProjectResourceAlertNotificationSendResult>(`/project/${id}/resource-alert-notification/send`, {
      method: 'POST',
      body: { confirm_send: confirmSend },
      requireAuth: true,
    });
  },

  getResourceAlertEnforcementReadiness: async (id: string): Promise<ProjectResourceAlertEnforcementReadiness> => {
    return request<ProjectResourceAlertEnforcementReadiness>(`/project/${id}/resource-alert-enforcement-readiness`, {
      requireAuth: true,
    });
  },

  executeResourceAlertEnforcement: async (id: string, confirmExecute: boolean): Promise<ProjectResourceAlertEnforcementExecuteResult> => {
    return request<ProjectResourceAlertEnforcementExecuteResult>(`/project/${id}/resource-alert-enforcement/execute`, {
      method: 'POST',
      body: { confirm_execute: confirmExecute },
      requireAuth: true,
    });
  },

  touchRuntimeActivity: async (id: string): Promise<ProjectRuntimeActivityStatus> => {
    return request<ProjectRuntimeActivityStatus>(`/project/${id}/runtime-activity`, {
      method: 'POST',
      requireAuth: true,
    });
  },

  listCapabilityAudits: async (
    id: string,
    options: CapabilityExecutionAuditListOptions = {},
  ): Promise<CapabilityExecutionAuditListResponse> => {
    const params = new URLSearchParams();
    params.set('limit', String(options.limit ?? 20));
    params.set('offset', String(options.offset ?? 0));
    if (options.status) {
      params.set('status', options.status);
    }
    if (options.capabilityProfile) {
      params.set('capability_profile', options.capabilityProfile);
    }

    return request<CapabilityExecutionAuditListResponse>(`/project/${id}/capability-audits?${params.toString()}`, {
      requireAuth: true,
    });
  },

  // 停止项目容器
  stopContainer: async (id: string): Promise<ProjectContainerStopResponse> => {
    return request<ProjectContainerStopResponse>(`/project/${id}/stop`, {
      method: 'POST',
      requireAuth: true,
    });
  },

  createBackup: async (id: string): Promise<ProjectBackupResult> => {
    return request<ProjectBackupResult>(`/project/${id}/backups/create`, {
      method: 'POST',
      requireAuth: true,
    });
  },

  runAutomaticBackup: async (id: string): Promise<ProjectBackupResult> => {
    return request<ProjectBackupResult>(`/project/${id}/backups/automatic-run`, {
      method: 'POST',
      requireAuth: true,
    });
  },

  listBackups: async (id: string): Promise<ProjectBackupListResult> => {
    return request<ProjectBackupListResult>(`/project/${id}/backups`, {
      requireAuth: true,
    });
  },

  getBackupPolicyReadiness: async (id: string): Promise<ProjectBackupPolicyReadiness> => {
    return request<ProjectBackupPolicyReadiness>(`/project/${id}/backups/policy-readiness`, {
      requireAuth: true,
    });
  },

  getBackupRemoteStorageReadiness: async (id: string): Promise<ProjectBackupRemoteStorageReadiness> => {
    return request<ProjectBackupRemoteStorageReadiness>(`/project/${id}/backups/remote-storage-readiness`, {
      requireAuth: true,
    });
  },

  getBackupRemoteInventory: async (id: string): Promise<ProjectBackupRemoteInventoryResult> => {
    return request<ProjectBackupRemoteInventoryResult>(`/project/${id}/backups/remote-inventory`, {
      requireAuth: true,
    });
  },

  uploadBackupToRemoteStorage: async (id: string, backupId: string): Promise<ProjectBackupRemoteUploadResult> => {
    return request<ProjectBackupRemoteUploadResult>(`/project/${id}/backups/remote-upload`, {
      method: 'POST',
      body: { backup_id: backupId },
      requireAuth: true,
    });
  },

  downloadBackupFromRemoteStorage: async (id: string, backupId: string): Promise<ProjectBackupRemoteDownloadResult> => {
    return request<ProjectBackupRemoteDownloadResult>(`/project/${id}/backups/remote-download`, {
      method: 'POST',
      body: { backup_id: backupId },
      requireAuth: true,
    });
  },

  restoreBackupFromRemoteStorage: async (id: string, backupId: string, confirmRestore: boolean): Promise<ProjectBackupRemoteRestoreResult> => {
    return request<ProjectBackupRemoteRestoreResult>(`/project/${id}/backups/remote-restore`, {
      method: 'POST',
      body: { backup_id: backupId, confirm_restore: confirmRestore },
      requireAuth: true,
    });
  },

  downloadBackup: async (id: string, backupId: string): Promise<Response> => {
    return requestStream(`/project/${id}/backups/${encodeURIComponent(backupId)}/download`, {
      requireAuth: true,
    });
  },

  preflightBackupRestore: async (id: string, backupId: string): Promise<ProjectBackupRestorePreflightResult> => {
    return request<ProjectBackupRestorePreflightResult>(`/project/${id}/backups/restore-preflight`, {
      method: 'POST',
      body: { backup_id: backupId },
      requireAuth: true,
    });
  },

  restoreBackup: async (id: string, backupId: string, confirmRestore: boolean): Promise<ProjectBackupRestoreResult> => {
    return request<ProjectBackupRestoreResult>(`/project/${id}/backups/restore`, {
      method: 'POST',
      body: { backup_id: backupId, confirm_restore: confirmRestore },
      requireAuth: true,
    });
  },

  // 停止项目当前生成任务
  stopGeneration: async (id: string): Promise<ProjectGenerationStopResponse> => {
    return request<ProjectGenerationStopResponse>(`/project/${id}/generation/stop`, {
      method: 'POST',
      requireAuth: true,
    });
  },

  getGenerationStatus: async (id: string): Promise<ProjectGenerationStatusResponse> => {
    return request<ProjectGenerationStatusResponse>(`/project/${id}/generation/status`, {
      requireAuth: true,
    });
  },
  replayGenerationEvents: async (id: string, jobId: string, cursor: number, signal?: AbortSignal): Promise<Response> => {
    const query = new URLSearchParams({ job_id: jobId, cursor: String(cursor) });
    return requestStream(`/project/${id}/generation/events?${query.toString()}`, {
      requireAuth: true,
      signal,
    });
  },


  // 获取项目文件树
  getFileTree: async (id: string): Promise<unknown> => {
    return request<unknown>(`/project/${id}/files`, {
      requireAuth: true,
    });
  },

  // 读取项目文件
  readFile: async (id: string, path: string): Promise<ProjectFileReadResponse> => {
    return request<ProjectFileReadResponse>(`/project/${id}/files/content?path=${encodeURIComponent(path)}`, {
      requireAuth: true,
    });
  },

  // 写入项目文件
  writeFile: async (id: string, path: string, content: string): Promise<ProjectFileWriteResponse> => {
    return request<ProjectFileWriteResponse>(`/project/${id}/files/content`, {
      method: 'PUT',
      body: { path, content },
      requireAuth: true,
    });
  },

  applyFileOperation: async (
    id: string,
    data: {
      operation: ProjectFileOperationKind;
      path: string;
      target_path?: string;
      content?: string;
    },
  ): Promise<ProjectFileOperationResponse> => {
    return request<ProjectFileOperationResponse>(`/project/${id}/files/operation`, {
      method: 'POST',
      body: data,
      requireAuth: true,
    });
  },

  createTerminalWebSocketTicket: async (
    id: string,
    data: { rows: number; cols: number },
  ): Promise<TerminalWebSocketTicket> => {
    return request<TerminalWebSocketTicket>(`/project/${id}/terminal/ws-ticket`, {
      method: 'POST',
      body: data,
      requireAuth: true,
    });
  },

  // 获取项目聊天消息
  getMessages: async (id: string): Promise<ProjectMessage[]> => {
    return request<ProjectMessage[]>(`/project/${id}/messages`, {
      requireAuth: true,
    });
  },

  // 保存项目聊天消息
  saveMessages: async (
    id: string,
    messages: ProjectMessageSaveInput[],
  ): Promise<ProjectMessagesSaveResponse> => {
    return request<ProjectMessagesSaveResponse>(`/project/${id}/messages`, {
      method: 'POST',
      body: { messages },
      requireAuth: true,
    });
  },

  // 获取项目 Git 提交历史
  getCommits: async (id: string): Promise<GitCommit[]> => {
    return request<GitCommit[]>(`/project/${id}/commits`, {
      requireAuth: true,
    });
  },

  getCommit: async (id: string, hash: string): Promise<GitCommit> => {
    return request<GitCommit>(`/project/${id}/commits/${hash}`, {
      requireAuth: true,
    });
  },

  getBranches: async (id: string): Promise<GitBranch[]> => {
    return request<GitBranch[]>(`/project/${id}/branches`, {
      requireAuth: true,
    });
  },

  getRemotes: async (id: string): Promise<GitRemote[]> => {
    return request<GitRemote[]>(`/project/${id}/remotes`, {
      requireAuth: true,
    });
  },

  getRemoteBranches: async (id: string): Promise<GitRemoteBranch[]> => {
    return request<GitRemoteBranch[]>(`/project/${id}/remote-branches`, {
      requireAuth: true,
    });
  },

  refreshRemoteBranches: async (id: string, remote: string): Promise<GitRemoteBranchRefreshResult> => {
    return request<GitRemoteBranchRefreshResult>(`/project/${id}/remote-branches/refresh`, {
      method: 'POST',
      body: { remote },
      requireAuth: true,
    });
  },

  getTags: async (id: string): Promise<GitTag[]> => {
    return request<GitTag[]>(`/project/${id}/tags`, {
      requireAuth: true,
    });
  },

  createTag: async (id: string, tagName: string): Promise<GitTagCreateResult> => {
    return request<GitTagCreateResult>(`/project/${id}/tags/create`, {
      method: 'POST',
      body: { name: tagName },
      requireAuth: true,
    });
  },

  deleteTag: async (id: string, tagName: string): Promise<GitTagDeleteResult> => {
    return request<GitTagDeleteResult>(`/project/${id}/tags/delete`, {
      method: 'POST',
      body: { name: tagName },
      requireAuth: true,
    });
  },

  getStashes: async (id: string): Promise<GitStash[]> => {
    return request<GitStash[]>(`/project/${id}/stashes`, {
      requireAuth: true,
    });
  },

  applyStash: async (id: string, ref: string): Promise<GitStashApplyResult> => {
    return request<GitStashApplyResult>(`/project/${id}/stashes/apply`, {
      method: 'POST',
      body: { ref },
      requireAuth: true,
    });
  },

  createStash: async (id: string, message: string): Promise<GitStashCreateResult> => {
    return request<GitStashCreateResult>(`/project/${id}/stashes/create`, {
      method: 'POST',
      body: { message },
      requireAuth: true,
    });
  },

  getWorktreeStatus: async (id: string): Promise<GitWorktreeStatus> => {
    return request<GitWorktreeStatus>(`/project/${id}/worktree-status`, {
      requireAuth: true,
    });
  },

  discardWorktreeFile: async (id: string, path: string): Promise<GitWorktreeFileDiscardResult> => {
    return request<GitWorktreeFileDiscardResult>(`/project/${id}/worktree/discard-file`, {
      method: 'POST',
      body: { path },
      requireAuth: true,
    });
  },

  getBranchCompare: async (id: string, baseBranch: string, headBranch: string): Promise<GitBranchCompare> => {
    const params = new URLSearchParams({
      base: baseBranch,
      head: headBranch,
    });
    return request<GitBranchCompare>(`/project/${id}/branches/compare?${params.toString()}`, {
      requireAuth: true,
    });
  },

  applyBranchCompareFile: async (id: string, baseBranch: string, headBranch: string, path: string): Promise<GitBranchCompareFileApplyResult> => {
    return request<GitBranchCompareFileApplyResult>(`/project/${id}/branches/compare/apply-file`, {
      method: 'POST',
      body: { base_branch: baseBranch, head_branch: headBranch, path },
      requireAuth: true,
    });
  },

  getBranchSwitchReadiness: async (id: string, targetBranch: string): Promise<GitBranchSwitchReadiness> => {
    const params = new URLSearchParams({
      target: targetBranch,
    });
    return request<GitBranchSwitchReadiness>(`/project/${id}/branches/switch-readiness?${params.toString()}`, {
      requireAuth: true,
    });
  },

  createBranch: async (id: string, branchName: string): Promise<GitBranchCreateResult> => {
    return request<GitBranchCreateResult>(`/project/${id}/branches/create`, {
      method: 'POST',
      body: { name: branchName },
      requireAuth: true,
    });
  },

  createBranchFromRemote: async (id: string, remoteBranch: string, branchName: string): Promise<GitBranchCreateFromRemoteResult> => {
    return request<GitBranchCreateFromRemoteResult>(`/project/${id}/branches/create-from-remote`, {
      method: 'POST',
      body: { remote_branch: remoteBranch, name: branchName },
      requireAuth: true,
    });
  },

  deleteBranch: async (id: string, branchName: string): Promise<GitBranchDeleteResult> => {
    return request<GitBranchDeleteResult>(`/project/${id}/branches/delete`, {
      method: 'POST',
      body: { name: branchName },
      requireAuth: true,
    });
  },

  renameBranch: async (id: string, previousName: string, nextName: string): Promise<GitBranchRenameResult> => {
    return request<GitBranchRenameResult>(`/project/${id}/branches/rename`, {
      method: 'POST',
      body: { previous_name: previousName, name: nextName },
      requireAuth: true,
    });
  },

  switchBranch: async (id: string, targetBranch: string): Promise<GitBranchSwitchResult> => {
    return request<GitBranchSwitchResult>(`/project/${id}/branches/switch`, {
      method: 'POST',
      body: { target: targetBranch },
      requireAuth: true,
    });
  },

  commitWorktree: async (id: string, message: string): Promise<GitWorktreeCommitResult> => {
    return request<GitWorktreeCommitResult>(`/project/${id}/worktree/commit`, {
      method: 'POST',
      body: { message },
      requireAuth: true,
    });
  },

  restoreCommit: async (id: string, hash: string): Promise<ProjectCommitRestoreResponse> => {
    return request<ProjectCommitRestoreResponse>(`/project/${id}/commits/restore`, {
      method: 'POST',
      body: { hash },
      requireAuth: true,
    });
  },

  restoreCommitFile: async (id: string, hash: string, path: string): Promise<GitCommitFileRestoreResult> => {
    return request<GitCommitFileRestoreResult>(`/project/${id}/commits/restore-file`, {
      method: 'POST',
      body: { hash, path },
      requireAuth: true,
    });
  },

  // 生成技术方案
  generatePlans: async (data: {
    description: string;
    app_type?: string;
    language?: string;
    project_id?: string;
    provider?: AIModelProvider;
    user_feedback?: string;
    current_plans?: Plan[];
    visual_attachments?: VisualAttachmentInput[];
    visual_context?: VisualContext;
  }): Promise<Plan[]> => {
    return request<Plan[]>('/project/plans', {
      method: 'POST',
      body: data,
      requireAuth: true,
    });
  },

  generatePlansStream: async (data: {
    description: string;
    app_type?: string;
    language?: string;
    project_id?: string;
    provider?: AIModelProvider;
    user_feedback?: string;
    current_plans?: Plan[];
    visual_attachments?: VisualAttachmentInput[];
    visual_context?: VisualContext;
  }, signal?: AbortSignal): Promise<Response> => {
    return requestStream('/project/plans', {
      method: 'POST',
      body: data,
      requireAuth: true,
      signal,
    });
  },
};

// ============================================
// LLM API
// ============================================

export interface LLMProvider {
  id: number;
  name: AIModelProvider;
  display_name: string;
  type: AIModelProviderType;
  model: AIModelName;
  is_default: boolean;
  models?: LLMProviderModel[];
}

export interface LLMProviderModel {
  id: number;
  provider_id: number;
  model_id: AIModelName;
  display_name: string;
  enabled: boolean;
  is_default: boolean;
  capability_tags?: string;
  context_window?: number;
  default_for?: string;
  priority?: number;
  sort_order?: number;
  runtime_id: AIModelProvider;
  runtime_loaded?: boolean;
  runtime_active?: boolean;
}

export interface LLMModel {
  id: AIModelName;
  name: AIModelName;
  description?: string;
}

export interface LLMProviderInfo {
  name: AIModelProvider;
  display_name: string;
  models: LLMModel[];
}

export interface LLMModelsResponse {
  providers: LLMProviderInfo[];
  current: AIModelProvider;
}

export interface LLMProviderListResponse {
  providers: LLMProvider[];
  default_name?: AIModelProvider;
}

export interface LLMConfig {
  current_provider: AIModelProvider;
  current_model: AIModelName;
  temperature: number;
  max_tokens: number;
}

export interface LLMProviderConnectionTestResponse {
  provider: AIModelProvider;
  model: AIModelName;
  has_api_key: boolean;
  status: AIModelProviderConnectionTestStatus;
  latency_ms: number;
  message: AIModelProviderConnectionTestMessage;
  recovery: string;
}

export const llmApi = {
  // 获取 LLM 提供商列表
  listProviders: async (): Promise<LLMProviderListResponse> => {
    const response = await request<{
      providers?: LLMProvider[];
      default_name?: AIModelProvider;
    }>('/llm/providers', {});

    return {
      providers: response.providers || [],
      default_name: response.default_name,
    };
  },
  
  // 获取 LLM 提供商详情
  getProvider: async (id: number): Promise<LLMProvider> => {
    return request<LLMProvider>(`/llm/providers/${id}`, {});
  },
  
  // 获取模型列表
  getModels: async (): Promise<LLMModelsResponse> => {
    return request<LLMModelsResponse>('/chat/models', {});
  },
  
  // 获取当前配置
  getConfig: async (): Promise<LLMConfig> => {
    return request<LLMConfig>('/llm/config', {});
  },
  
  // 测试连接
  testConnection: async (provider: AIModelProvider, model: AIModelName): Promise<LLMProviderConnectionTestResponse> => {
    return request<LLMProviderConnectionTestResponse>('/llm/providers/test', {
      method: 'POST',
      body: { provider, model },
    });
  },
};

export const chatApi = {
  generateStream: async (data: ChatGenerateRequest, signal?: AbortSignal): Promise<Response> => {
    return requestStream('/chat/generate', {
      method: 'POST',
      body: data,
      requireAuth: true,
      signal,
    });
  },
};

// ============================================
// 健康检查 API
// ============================================

export const healthApi = {
  check: async (): Promise<HealthCheckResponse> => {
    return request<HealthCheckResponse>('/health', {
      method: 'GET',
    });
  },
};

// 导出所有 API
const api = {
  auth: authApi,
  chat: chatApi,
  project: projectApi,
  llm: llmApi,
  health: healthApi,
};

export default api;
