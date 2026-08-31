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
  console.error(`[YES] Admin API response contract invalid: ${message}`);
  process.exit(1);
}

function requireGoMapFields(source, fields, context) {
  const normalizedSource = source.replaceAll(' ', '');
  for (const [fieldName, valueExpression] of fields) {
    const expectedField = `"${fieldName}":${valueExpression}`;
    if (!normalizedSource.includes(expectedField)) {
      fail(`${context} must preserve response field: "${fieldName}": ${valueExpression}`);
    }
  }
}

const adminApiClient = readProjectFile('src/lib/admin/api.ts');
const authHandler = readProjectFile('backend/internal/handler/auth_handler.go');
const adminRolesHandler = readProjectFile('backend/internal/handler/admin_roles_handler.go');
const adminUsersHandler = readProjectFile('backend/internal/handler/admin_users_handler.go');
const adminConsoleSupportService = readProjectFile('backend/internal/service/admin_console_support_service.go');
const backendModels = readProjectFile('backend/internal/model/models.go');
const adminAuthSection = authHandler.split('// AdminAuthHandler 管理员认证处理器')[1]?.split('// GetUserIDFromContext')[0];

if (!adminAuthSection) {
  fail('could not locate AdminAuthHandler section in backend/internal/handler/auth_handler.go');
}

const forbiddenClientSnippets = [
  'data.code === 0',
  'result.token',
  'result.admin',
  'Array.isArray(data)',
  '| LLMProvider[]',
  '| { configs:',
  '| { users:',
];

for (const snippet of forbiddenClientSnippets) {
  if (adminApiClient.includes(snippet)) {
    fail(`src/lib/admin/api.ts still contains legacy response fallback: ${snippet}`);
  }
}

if (adminAuthSection.includes('"code"')) {
  fail('AdminAuthHandler must use { success, data/error } instead of legacy { code, message, data }');
}

if (!adminAuthSection.includes('"success": true') || !adminAuthSection.includes('"success": false')) {
  fail('AdminAuthHandler must emit explicit success true and success false responses');
}

[
  'export class AdminApiError extends Error',
  'export type AdminApiErrorDetails = string;',
  'export type AdminApiErrorSource = string;',
  'export type AdminApiErrorMetadata = {',
  'details?: AdminApiErrorDetails;',
  'source?: AdminApiErrorSource;',
  'export type AdminApiResponseRawObject = {',
  '[fieldName: string]: unknown;',
  'export type AdminRequestHeaderMap = {',
  '[headerName: string]: string;',
  'type AdminStructuredErrorSuffixSegment = string;',
  'type AdminStructuredErrorSuffixSegmentList = AdminStructuredErrorSuffixSegment[];',
  'metadata: AdminApiErrorMetadata = {}',
  'function buildAdminRequestHeaders(',
  'initialHeaders?: HeadersInit',
  '): AdminRequestHeaderMap',
  'const headers: AdminRequestHeaderMap = {',
  'for (const [key, value] of new Headers(initialHeaders))',
  'const headers = buildAdminRequestHeaders(token, options.headers);',
  'parseAdminResponseBody',
  'Promise<AdminApiResponseRawObject>',
  'JSON.parse(rawText) as AdminApiResponseRawObject',
  'throwStructuredAdminApiError',
  'fallback: AdminApiErrorDetails',
  'function extractAdminErrorMetadata(result: AdminApiResponseRawObject): AdminApiErrorMetadata',
  'result: AdminApiResponseRawObject',
  'satisfies AdminApiErrorMetadata',
  'formatStructuredAdminErrorMessage',
  'metadata: AdminApiErrorMetadata',
  'function getStructuredAdminErrorSourceSegment(',
  'function addStructuredAdminErrorSuffixSegment(',
  'function materializeStructuredAdminErrorSuffixSegments(',
  'const suffixSegments = materializeStructuredAdminErrorSuffixSegments(metadata);',
  'source: \'admin_api_client\'',
].forEach((snippet) => {
  if (!adminApiClient.includes(snippet)) {
    fail(`src/lib/admin/api.ts must preserve structured Admin proxy error source/details: ${snippet}`);
  }
});

if (/function extractAdminErrorMetadata\(result: Record<string, unknown>\)|parseAdminResponseBody\(res: Response\): Promise<Record<string, unknown>>|JSON\.parse\(rawText\) as Record<string, unknown>|result: Record<string, unknown>/.test(adminApiClient)) {
  fail('src/lib/admin/api.ts must parse Admin API response/error JSON through AdminApiResponseRawObject instead of anonymous Record raw objects');
}
if (/const headers: Record<string, string>|options\.headers as Record<string, string>|adminRequest[\s\S]*headers: Record<string, string>/.test(adminApiClient)) {
  fail('src/lib/admin/api.ts must build Admin request headers through AdminRequestHeaderMap and buildAdminRequestHeaders instead of anonymous Record casts');
}
if (/new Headers\(initialHeaders\)\.forEach|\[sourceMessage, metadata\.details\]\.filter\(Boolean\)|const sourceMessage = metadata\.source \?/.test(adminApiClient)) {
  fail('src/lib/admin/api.ts must materialize structured Admin errors and request headers through named readers instead of inline array/header callbacks');
}

[
  'metadata: { details?: string; source?: string } = {}',
  'details?: string;\n  source?: string;',
  'fallback: string',
].forEach((snippet) => {
  if (adminApiClient.includes(snippet)) {
    fail(`src/lib/admin/api.ts must not regress structured AdminApiError diagnostics to anonymous string metadata: ${snippet}`);
  }
});

const adminOperationErrors = readProjectFile('src/lib/admin/admin-operation-errors.ts');
if (!adminOperationErrors.includes('export type AdminOperationErrorDetails = string')
  || !adminOperationErrors.includes('fallback: AdminOperationErrorDetails')
  || !adminOperationErrors.includes('formatUserVisibleApiError(error, fallback)')
  || adminOperationErrors.includes('fallback: string')) {
  fail('src/lib/admin/admin-operation-errors.ts must preserve structured AdminApiError source/details in user-visible messages');
}

[
  ['src/app/admin/login/page.tsx', "formatAdminOperationFailure(err, '登录失败')"],
  ['src/app/admin/config/page.tsx', "formatAdminOperationFailure(err, '加载配置失败')"],
  ['src/app/admin/config/page.tsx', "formatAdminOperationFailure(err, '保存失败')"],
  ['src/app/admin/audit/page.tsx', "formatAdminOperationFailure(err, '加载审计日志失败')"],
  ['src/app/admin/admins/page.tsx', "formatAdminOperationFailure(err, '加载管理员失败')"],
  ['src/app/admin/admins/page.tsx', "formatAdminOperationFailure(err, '保存管理员失败')"],
  ['src/app/admin/roles/page.tsx', "formatAdminOperationFailure(err, '加载角色权限失败')"],
  ['src/app/admin/roles/page.tsx', "formatAdminOperationFailure(err, '保存角色失败')"],
  ['src/app/admin/users/page.tsx', "formatAdminOperationFailure(err, '加载用户失败')"],
  ['src/app/admin/llm/page.tsx', "formatAdminOperationFailure(err, '加载提供商失败')"],
  ['src/app/admin/llm/page.tsx', "formatAdminOperationFailure(err, '重载失败')"],
  ['src/app/admin/llm/page.tsx', "formatAdminOperationFailure(err, '保存失败')"],
  ['src/app/admin/llm/page.tsx', "formatAdminOperationFailure(err, '删除失败')"],
  ['src/app/admin/llm/page.tsx', "formatAdminOperationFailure(err, '切换状态失败')"],
  ['src/app/admin/llm/page.tsx', "formatAdminOperationFailure(err, '设置默认失败')"],
].forEach(([relativePath, snippet]) => {
  const source = readProjectFile(relativePath);
  if (!source.includes(snippet)) {
    fail(`${relativePath} must use the shared Admin operation error formatter: ${snippet}`);
  }
  if (source.includes('formatUserVisibleApiError')) {
    fail(`${relativePath} must not format Admin operation source/details locally`);
  }
});

[
  'type AdminProfileRawResponse = {',
  'id?: string;',
  'email: string;',
  'username?: string;',
  'role?: string;',
  'status?: string;',
  'must_change_password?: boolean;',
  'avatar_url?: string;',
  'created_at?: string;',
  'permission_codes?: AdminPermissionCodeList;',
  'type AdminLoginRawResponse = {',
  'token: string;',
  'expires_in?: number;',
  'admin: AdminProfileRawResponse;',
  'const loginResponse = await adminRequest<AdminLoginRawResponse>(\'/auth/login\'',
  'const profile = await adminRequest<AdminProfileRawResponse>(\'/auth/profile\');',
  `export interface AdminPasswordChangeRequest {`,
  `current_password: string;`,
  `new_password: string;`,
  `changePassword: async (data: AdminPasswordChangeRequest): Promise<AdminLoginResponse>`,
  "adminRequest<AdminLoginRawResponse>('/auth/change-password'",
  'expires_in: loginResponse.expires_in,',
].forEach((snippet) => {
  if (!adminApiClient.includes(snippet)) {
    fail(`src/lib/admin/api.ts must model Admin auth raw responses through explicit contracts: ${snippet}`);
  }
});
if (adminApiClient.includes("type AdminProfileRawResponse = Omit<AdminProfile")
  || adminApiClient.includes("type AdminLoginRawResponse = Omit<AdminLoginResponse")) {
  fail('src/lib/admin/api.ts must not derive Admin auth raw responses with Omit; use explicit raw response contracts');
}

[
  'type AdminRoleRawResponse = {',
  'id: AdminRoleId;',
  'name: string;',
  'display_name: string;',
  'description?: string;',
  'is_system: boolean;',
  'status?: string;',
  'permissions?: AdminPermission[];',
  'created_at: string;',
  'updated_at: string;',
  'function normalizeAdminRole(rawRole: AdminRoleRawResponse): AdminRole',
  "adminRequest<AdminRoleRawResponse[]>('/roles')",
  "adminRequest<AdminRoleRawResponse>('/roles'",
  'adminRequest<AdminRoleRawResponse>(`/roles/${id}`',
].forEach((snippet) => {
  if (!adminApiClient.includes(snippet)) {
    fail(`src/lib/admin/api.ts must model Admin role raw response through an explicit contract: ${snippet}`);
  }
});
requireGoMapFields(
  adminConsoleSupportService,
  [
    [`id`, `role.ID`],
    [`name`, `role.Name`],
    [`display_name`, `role.DisplayName`],
    [`description`, `role.Description`],
    [`is_system`, `role.IsSystem`],
    [`status`, `role.Status`],
    [`created_at`, `role.CreatedAt`],
    [`updated_at`, `role.UpdatedAt`],
  ],
  `backend Admin role payload builder`,
);
if (!adminConsoleSupportService.includes(`payload["permissions"] = permissions`)) {
  fail(`backend Admin role payload builder must preserve response field: permissions`);
}
if (adminApiClient.includes("type AdminRoleRawResponse = Omit<AdminRole")) {
  fail('src/lib/admin/api.ts must not derive Admin role raw response with Omit; use explicit raw response contract');
}

[
  'AIModelProviderBaseUrl,',
  'AIModelProviderExtraConfig,',
  'AIModelProviderReloadMessage,',
  'AIModelProviderType,',
  'export type AdminLLMProviderType = AIModelProviderType;',
  'type: AdminLLMProviderType;',
  'type?: AIModelProviderType;',
  'type?: AdminLLMProviderType;',
  'base_url: AIModelProviderBaseUrl;',
  'base_url?: AIModelProviderBaseUrl;',
  'extra_config: AIModelProviderExtraConfig;',
  'extra_config?: AIModelProviderExtraConfig;',
  'models?: LLMProviderModel[];',
  'models?: LLMProviderModelCreate[];',
  'export interface LLMProviderModel {',
  'runtime_id: AIModelProvider;',
  'export interface LLMProviderModelDiscoveryResult {',
  'message?: AIModelProviderReloadMessage;',
  'export type AdminPermissionCodeList = AdminPermissionCode[];',
  'export type AdminPermissionIdList = AdminPermissionId[];',
  'export type AdminRoleIdList = AdminRoleId[];',
  'permission_codes: AdminPermissionCodeList;',
  'permission_codes?: AdminPermissionCodeList;',
  'permission_ids: AdminPermissionIdList;',
  'permission_ids?: AdminPermissionIdList;',
  'role_ids?: AdminRoleIdList;',
].forEach((snippet) => {
  if (!adminApiClient.includes(snippet)) {
    fail(`src/lib/admin/api.ts must name Admin RBAC list contracts: ${snippet}`);
  }
});

[
  'type: \'cloud\' | \'local\';',
  'type?: \'cloud\' | \'local\';',
  'permission_codes: string[];',
  'permission_codes?: string[];',
  'permission_ids: string[];',
  'permission_ids?: string[];',
  'role_ids?: string[];',
].forEach((snippet) => {
  if (adminApiClient.includes(snippet)) {
    fail(`src/lib/admin/api.ts must not keep Admin RBAC lists as anonymous arrays: ${snippet}`);
  }
});

[
  'type AdminManagerListRawResponse = {',
  'type AdminManagerRawResponse = {',
  'id: AdminManagerId;',
  'email: string;',
  'username?: string;',
  'role?: string;',
  'status?: string;',
  'must_change_password?: boolean;',
  'avatar_url?: string;',
  'last_login_at?: string | null;',
  'assigned_roles?: AdminRoleRawResponse[];',
  'permission_codes?: AdminPermissionCodeList;',
  'created_at: string;',
  'updated_at?: string;',
  'must_change_password: rawManager.must_change_password !== false,',
  'admins: AdminManagerRawResponse[];',
  'total: number;',
  'page: number;',
  'pageSize: number;',
  'export interface AdminManagerListResponse',
  'admins: AdminManager[];',
  'type AdminManagerList = AdminManager[];',
  'function normalizeAdminManagerList(admins: AdminManagerRawResponse[]): AdminManagerList',
  'function normalizeAdminManagerListResponse(data: AdminManagerListRawResponse): AdminManagerListResponse',
  'list: async (): Promise<AdminManagerListResponse>',
  "adminRequest<AdminManagerListRawResponse>('/admins')",
].forEach((snippet) => {
  if (!adminApiClient.includes(snippet)) {
    fail(`src/lib/admin/api.ts must model Admin manager list response through named contracts: ${snippet}`);
  }
});
requireGoMapFields(
  adminConsoleSupportService,
  [
    [`id`, `admin.ID`],
    [`email`, `admin.Email`],
    [`username`, `admin.Username`],
    [`role`, `admin.Role`],
    [`status`, `admin.Status`],
    [`must_change_password`, `admin.MustChangePassword`],
    [`avatar_url`, `admin.AvatarURL`],
    [`last_login_at`, `admin.LastLoginAt`],
    [`created_at`, `admin.CreatedAt`],
    [`updated_at`, `admin.UpdatedAt`],
  ],
  `backend Admin manager payload builder`,
);
[
  `payload["assigned_roles"] = roles`,
  `payload["permission_codes"] = permissions`,
].forEach((snippet) => {
  if (!adminConsoleSupportService.includes(snippet)) {
    fail(`backend Admin manager payload builder must preserve response field: ${snippet}`);
  }
});
[
  '"admins": admins',
  '"total": total',
  '"page": page',
  '"pageSize": pageSize',
].forEach((snippet) => {
  if (!adminRolesHandler.includes(snippet)) {
    fail(`backend Admin manager list handler must preserve response field: ${snippet}`);
  }
});
if (adminApiClient.includes('list: async (): Promise<{ admins: AdminManager[]; total: number; page: number; pageSize: number }>')
  || adminApiClient.includes('adminRequest<{ admins: AdminManagerRawResponse[]; total: number; page: number; pageSize: number }>(\'/admins\')')
  || adminApiClient.includes("type AdminManagerRawResponse = Omit<AdminManager")) {
  fail('src/lib/admin/api.ts must not regress Admin manager list response to anonymous list objects');
}

[
  'export interface AdminAuditListResponse',
  'logs: AuditLog[];',
  'total: number;',
  'list: async (params?: { limit?: number; offset?: number }): Promise<AdminAuditListResponse>',
  'adminRequest<AdminAuditListResponse>(`/audit${qs ? \'?\' + qs : \'\'}`)',
].forEach((snippet) => {
  if (!adminApiClient.includes(snippet)) {
    fail(`src/lib/admin/api.ts must model Admin audit list response through AdminAuditListResponse: ${snippet}`);
  }
});
[
  '"logs": logs',
  '"total": len(logs)',
].forEach((snippet) => {
  if (!adminUsersHandler.includes(snippet)) {
    fail(`backend Admin audit list handler must preserve response field: ${snippet}`);
  }
});
if (adminApiClient.includes('Promise<{ logs: AuditLog[]; total: number }>')
  || adminApiClient.includes('return adminRequest(`/audit${qs ? \'?\' + qs : \'\'}`);')) {
  fail('src/lib/admin/api.ts must not regress Admin audit list response to an anonymous logs/total object');
}

[
  'type AdminUserRawResponse = {',
  'id: AdminUserId;',
  'email: string;',
  'username?: string;',
  'avatar_url?: string;',
  'role?: string;',
  'status?: string;',
  'email_verified?: boolean;',
  'plan?: string;',
  'llm_model?: string;',
  'llm_temperature?: string;',
  'llm_max_tokens?: number;',
  'created_at: string;',
  'updated_at: string;',
  'instance_id?: string;',
  'type AdminUserListRawResponse = {',
  'users: AdminUserRawResponse[];',
  'total: number;',
  'type AdminUserList = AdminUser[];',
  'function normalizeAdminUserList(users: AdminUserRawResponse[]): AdminUserList',
  'function normalizeAdminUserListResponse(data: AdminUserListRawResponse): AdminUser[]',
  "adminRequest<AdminUserListRawResponse>('/users')",
].forEach((snippet) => {
  if (!adminApiClient.includes(snippet)) {
    fail(`src/lib/admin/api.ts must model Admin user list raw response through AdminUserListRawResponse: ${snippet}`);
  }
});
[
  'ID            string `gorm:"primaryKey;type:uuid" json:"id"`',
  'Email         string `gorm:"uniqueIndex;size:255;not null" json:"email"`',
  'Username      string `gorm:"uniqueIndex;size:100" json:"username"`',
  'AvatarURL     string `gorm:"column:avatar_url;size:500" json:"avatar_url"`',
  'Role          string `gorm:"size:20;default:\'user\'" json:"role"`',
  'Status        string `gorm:"size:20;default:\'active\'" json:"status"`',
  'EmailVerified bool   `gorm:"default:false" json:"email_verified"`',
  'Plan string `gorm:"size:20;default:\'free\'" json:"plan"`',
  'LLMModel       string `gorm:"column:llm_model;size:100;default:\'doubao-seed-2.0-lite-260215\'" json:"llm_model"`',
  'LLMTemperature string `gorm:"column:llm_temperature;size:20;default:\'0.7\'" json:"llm_temperature"`',
  'LLMMaxTokens   int    `gorm:"column:llm_max_tokens;default:4096" json:"llm_max_tokens"`',
  'CreatedAt time.Time `json:"created_at"`',
  'UpdatedAt time.Time `json:"updated_at"`',
  'InstanceID string `gorm:"column:instance_id;type:uuid" json:"instance_id,omitempty"`',
].forEach((snippet) => {
  if (!backendModels.includes(snippet)) {
    fail(`backend User model must preserve Admin user raw response field: ${snippet}`);
  }
});
[
  '"users": users',
  '"total": total',
].forEach((snippet) => {
  if (!adminUsersHandler.includes(snippet)) {
    fail(`backend Admin user list handler must preserve response field: ${snippet}`);
  }
});
if (adminApiClient.includes("adminRequest<{ users: AdminUserRawResponse[] }>('/users')")
  || adminApiClient.includes("type AdminUserRawResponse = Omit<AdminUser")) {
  fail('src/lib/admin/api.ts must not regress Admin user list raw response to an anonymous users object');
}

[
  'res.json().catch',
  'throw new Error(err.error',
  'throw new Error(err.message',
].forEach((snippet) => {
  if (adminApiClient.includes(snippet)) {
    fail(`src/lib/admin/api.ts must not collapse structured Admin proxy errors with legacy parsing: ${snippet}`);
  }
});

[
  ['src/app/api/admin/auth/login/route.ts', 'admin auth login'],
  ['src/app/api/admin/auth/profile/route.ts', 'admin auth profile'],
  ['src/app/api/admin/auth/refresh/route.ts', 'admin auth refresh'],
  ['src/app/api/admin/auth/change-password/route.ts', 'admin auth change password'],
  ['src/app/api/admin/config/route.ts', 'admin config list'],
  ['src/app/api/admin/config/[key]/route.ts', 'admin config update'],
  ['src/app/api/admin/permissions/route.ts', 'admin permissions'],
  ['src/app/api/admin/users/route.ts', 'admin users list'],
  ['src/app/api/admin/users/[id]/route.ts', 'admin user update', 'admin user delete'],
  ['src/app/api/admin/roles/route.ts', 'admin roles list', 'admin role create'],
  ['src/app/api/admin/roles/[id]/route.ts', 'admin role update', 'admin role delete'],
  ['src/app/api/admin/admins/route.ts', 'admin admins list'],
  ['src/app/api/admin/admins/[id]/route.ts', 'admin admin update', 'admin admin delete'],
  ['src/app/api/admin/audit/route.ts', 'admin audit list'],
  ['src/app/api/admin/projects/route.ts', 'admin projects'],
  ['src/app/api/admin/capability/provider-preflight/route.ts', 'admin provider preflight'],
  ['src/app/api/admin/llm/providers/route.ts', 'admin llm providers', 'admin llm provider create'],
  ['src/app/api/admin/llm/providers/[id]/route.ts', 'admin llm provider detail', 'admin llm provider update', 'admin llm provider delete'],
  ['src/app/api/admin/llm/providers/[id]/default/route.ts', 'admin llm provider set default'],
  ['src/app/api/admin/llm/providers/reload/route.ts', 'admin llm providers reload'],
].forEach(([relativePath, ...scopes]) => {
  const source = readProjectFile(relativePath);
  [
    'proxyBackendRequest',
    'buildBackendProxyErrorBody',
  ].forEach((snippet) => {
    if (!source.includes(snippet)) {
      fail(`${relativePath} must use the shared structured backend proxy: ${snippet}`);
    }
  });

  if (!source.includes('responseMode: \'text-or-json\'')) {
    fail(`${relativePath} must preserve Admin text-or-json backend response handling`);
  }

  scopes.forEach((scope) => {
    if (!source.includes(scope)) {
      fail(`${relativePath} must expose a stable Admin LLM proxy failure scope: ${scope}`);
    }
  });

  [
    'JSON.parse(text)',
    'Request failed:',
    'const BACKEND =',
    'const BACKEND_URL =',
    'fetch(',
  ].forEach((snippet) => {
    if (source.includes(snippet)) {
      fail(`${relativePath} must not use the legacy handwritten Admin proxy fallback: ${snippet}`);
    }
  });
});

const backendProxy = readProjectFile('src/app/api/_utils/backend-proxy.ts');
[
  'source: \'backend_text_response\'',
  'details',
  'error: rawText || `Request failed: ${response.status}`',
].forEach((snippet) => {
  if (!backendProxy.includes(snippet)) {
    fail(`backend text-or-json proxy fallback must preserve parse failure source/details: ${snippet}`);
  }
});

console.log('[YES] Admin API response contract validation passed.');
