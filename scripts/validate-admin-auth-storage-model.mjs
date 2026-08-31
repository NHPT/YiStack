import assert from 'node:assert/strict';
import fs from 'node:fs';

const adminApi = fs.readFileSync('src/lib/admin/api.ts', 'utf8');
const adminAuthStorageLocalErrors = fs.readFileSync('src/lib/admin/admin-auth-storage-local-errors.ts', 'utf8');
const adminAuthLocalErrors = fs.readFileSync('src/lib/admin/admin-auth-local-errors.ts', 'utf8');
const adminLayout = fs.readFileSync('src/app/admin/layout.tsx', 'utf8');
const adminLogin = fs.readFileSync('src/app/admin/login/page.tsx', 'utf8');
const validationLayer = fs.readFileSync('docs/engineering/VALIDATION_LAYER.md', 'utf8');

assert.equal(
  fs.existsSync('src/app/admin/admin-auth-local-errors.ts'),
  false,
  'Admin auth local visible error helper should live under src/lib/admin, not the app layer',
);
assert.match(
  adminAuthStorageLocalErrors,
  /export type AdminAuthStorageStatus = 'saved' \| 'read_failed' \| 'write_failed' \| 'clear_failed';[\s\S]*export type AdminAuthStorageFailureStatus = 'read_failed' \| 'write_failed' \| 'clear_failed';[\s\S]*export type AdminAuthStorageRedirectStatus = 'read_failed' \| 'clear_failed';[\s\S]*export type AdminAuthStorageSource = 'local_storage' \| 'session_storage';[\s\S]*export type AdminAuthStorageDetails = string;[\s\S]*export type AdminAuthStorageFailureResult = \{[\s\S]*status: AdminAuthStorageFailureStatus;[\s\S]*source: AdminAuthStorageSource;[\s\S]*message: AdminAuthStorageDetails;[\s\S]*details: AdminAuthStorageDetails;[\s\S]*\};[\s\S]*export function getAdminAuthStorageErrorDetails\([\s\S]*fallback: AdminAuthStorageDetails,[\s\S]*\): AdminAuthStorageDetails[\s\S]*export function buildAdminAuthStorageFailure\([\s\S]*status: AdminAuthStorageFailureStatus[\s\S]*source: AdminAuthStorageSource[\s\S]*fallback: AdminAuthStorageDetails[\s\S]*\): AdminAuthStorageFailureResult[\s\S]*message: details,[\s\S]*details,[\s\S]*export function formatAdminAuthStorageFailure\([\s\S]*result: AdminAuthStorageFailureResult,[\s\S]*fallback: AdminAuthStorageDetails,[\s\S]*formatUserVisibleApiError\(\{[\s\S]*source: result\.source[\s\S]*details: result\.details/,
  'Admin auth storage local errors should centralize source/details failure construction and shared visible formatting',
);
assert.doesNotMatch(
  adminAuthStorageLocalErrors,
  /Exclude<AdminAuthStorageStatus, 'saved'>|Extract<AdminAuthStorageResult|details: string;|message: string;|fallback: string/,
  'Admin auth storage local errors should not infer failure status/result or regress failure message/details/fallback to raw strings',
);
assert.match(
  adminAuthLocalErrors,
  /AdminAuthStorageDetails,[\s\S]*AdminAuthStorageSource,[\s\S]*export type AdminAuthBrowserHistorySource = 'browser_history';[\s\S]*export type AdminAuthBrowserHistoryDetails = AdminAuthStorageDetails;[\s\S]*export type AdminAuthStorageUrlSource = AdminAuthStorageSource;[\s\S]*export type AdminAuthStorageUrlDetails = AdminAuthStorageDetails;[\s\S]*export type AdminProfileCacheUrlStorageSource = AdminAuthStorageSource;[\s\S]*export type AdminProfileCacheUrlStorageDetails = AdminAuthStorageDetails;/,
  'Admin auth local visible helpers should expose named source/details contracts',
);
assert.match(
  adminAuthLocalErrors,
  /function resolveAdminAuthStorageUrlSource\(source: string \| null\): AdminAuthStorageUrlSource[\s\S]*export function resolveAdminProfileCacheUrlStorageSource\([\s\S]*source: string \| null,[\s\S]*\): AdminProfileCacheUrlStorageSource/,
  'Admin auth local visible helpers should normalize URL source values before formatting',
);
assert.match(
  adminAuthLocalErrors,
  /export function formatAdminAuthBrowserHistoryError\([\s\S]*fallback: AdminAuthBrowserHistoryDetails,[\s\S]*source: 'browser_history' satisfies AdminAuthBrowserHistorySource/,
  'Admin auth local browser_history failures should use named source/details contracts',
);
assert.match(
  adminAuthLocalErrors,
  /export function formatAdminAuthStorageUrlFailure\([\s\S]*fallback: AdminAuthStorageUrlDetails,[\s\S]*admin_auth_storage_source[\s\S]*const details: AdminAuthStorageUrlDetails[\s\S]*admin_auth_storage_details/,
  'Admin auth storage URL failures should use named source/details contracts',
);
assert.match(
  adminAuthLocalErrors,
  /export function formatAdminProfileCacheUrlStorageFailure\([\s\S]*source: AdminProfileCacheUrlStorageSource,[\s\S]*details: AdminProfileCacheUrlStorageDetails,[\s\S]*fallback: AdminProfileCacheUrlStorageDetails/,
  'Admin profile cache URL storage failures should use named source/details contracts',
);
assert.doesNotMatch(
  adminAuthLocalErrors,
  /source: string,|details: string,|fallback: string/,
  'Admin auth local visible helpers should not regress URL source/details parameters to raw strings',
);
assert.match(
  adminApi,
  /type AdminAuthStorageDetails,[\s\S]*export type \{[\s\S]*AdminAuthStorageDetails,[\s\S]*export interface AdminLoginResponse \{[\s\S]*token_storage_error_details\?: AdminAuthStorageDetails;[\s\S]*profile_cache_error_details\?: AdminAuthStorageDetails;/,
  'Admin login response should reuse AdminAuthStorageDetails for token/profile cache URL detail handoff',
);
assert.doesNotMatch(
  `${adminLayout}\n${adminLogin}`,
  /from ['"]\.\.?\/admin-auth-local-errors['"]/,
  'Admin auth app files should import local visible error helpers from src/lib/admin instead of a sibling app-layer helper',
);
assert.match(
  adminApi,
  /export function readAdminTokenStorage\(\): AdminAuthStorageResult<string \| null> \{[\s\S]*localStorage\.getItem\('admin_token'\)[\s\S]*buildAdminAuthStorageFailure\([\s\S]*'read_failed'[\s\S]*'local_storage'[\s\S]*'浏览器拒绝读取 Admin 登录凭据'/,
  'Admin auth token reads should use the shared local helper instead of throwing from localStorage',
);

assert.match(
  adminApi,
  /(?=[\s\S]*export function persistAdminTokenStorage\(token: string\): AdminAuthStorageResult \{[\s\S]*localStorage\.setItem\('admin_token', token\)[\s\S]*buildAdminAuthStorageFailure\([\s\S]*'write_failed'[\s\S]*'local_storage'[\s\S]*'浏览器拒绝保存 Admin 登录凭据')(?=[\s\S]*tokenStorageResult\.ok === false)(?=[\s\S]*登录成功但 Admin 登录凭据保存失败)(?=[\s\S]*source: tokenStorageResult\.source)/,
  'Admin login should fail visibly with local_storage source/details from the shared helper when the token cannot be persisted after backend auth succeeds',
);
assert.match(
  adminApi,
  /function hasAdminLoginToken\(token: string\): boolean \{[\s\S]*const hasToken = token\.length > 0;[\s\S]*return hasToken === true;[\s\S]*function canPersistAdminLoginStorage\(token: string\): boolean \{[\s\S]*const hasToken = hasAdminLoginToken\(token\);[\s\S]*const hasBrowserWindow = typeof window !== 'undefined';[\s\S]*return hasToken === true && hasBrowserWindow === true;[\s\S]*function hasAdminLoginProfileCacheInput\(admin: AdminProfile\): boolean \{[\s\S]*const hasAdminEmail = admin\.email\.length > 0;[\s\S]*const hasAdminRole = admin\.role\.length > 0;[\s\S]*return hasAdminEmail === true && hasAdminRole === true;[\s\S]*function getAdminLoginTokenStorageStatus\([\s\S]*result: AdminAuthStorageResult \| null,[\s\S]*\): AdminAuthStorageStatus \| undefined \{[\s\S]*const hasResult = result !== null;[\s\S]*return result\.ok === true \? 'saved' : result\.status;[\s\S]*function getAdminLoginProfileCacheStatus\([\s\S]*result: AdminAuthStorageResult \| null,[\s\S]*\): AdminAuthStorageStatus \| undefined \{[\s\S]*return result\.ok === true \? 'saved' : result\.status;[\s\S]*function getAdminLoginProfileCacheError\([\s\S]*\): AdminAuthStorageDetails \| undefined \{[\s\S]*if \(result\.ok === true\)[\s\S]*return result\.message;[\s\S]*function getAdminLoginProfileCacheErrorSource\([\s\S]*\): AdminAuthStorageSource \| undefined \{[\s\S]*if \(result\.ok === true\)[\s\S]*return result\.source;[\s\S]*function getAdminLoginProfileCacheErrorDetails\([\s\S]*\): AdminAuthStorageDetails \| undefined \{[\s\S]*if \(result\.ok === true\)[\s\S]*return result\.details;[\s\S]*const canPersistStorage = canPersistAdminLoginStorage\(token\);[\s\S]*if \(canPersistStorage === true\)[\s\S]*const hasProfileCacheInput = hasAdminLoginProfileCacheInput\(admin\);[\s\S]*if \(hasProfileCacheInput === true\)[\s\S]*permission_codes: admin\.permission_codes,[\s\S]*token_storage_status: getAdminLoginTokenStorageStatus\(tokenStorageResult\),[\s\S]*profile_cache_status: getAdminLoginProfileCacheStatus\(profileCacheResult\),[\s\S]*profile_cache_error: getAdminLoginProfileCacheError\(profileCacheResult\),[\s\S]*profile_cache_error_source: getAdminLoginProfileCacheErrorSource\(profileCacheResult\),[\s\S]*profile_cache_error_details: getAdminLoginProfileCacheErrorDetails\(profileCacheResult\),/,
  'Admin login storage response fields should be derived through named storage facts instead of optional chaining or truthy result gates',
);
assert.doesNotMatch(
  adminApi,
  /if \(token && typeof window !== 'undefined'\)|admin\?\.email|admin\?\.role|permission_codes: admin\.permission_codes \|\| \[\]|tokenStorageResult\?\.ok|profileCacheResult\?\.ok|profileCacheResult && !profileCacheResult\.ok|if \(!tokenStorageResult\.ok\)/,
  'Admin login storage response should not regress to token truthy gates, optional profile access, optional result chaining, OR permission fallback or implicit !ok checks',
);

assert.match(
  adminApi,
  /export function clearAdminTokenStorage\(\): AdminAuthStorageResult \{[\s\S]*localStorage\.removeItem\('admin_token'\)[\s\S]*buildAdminAuthStorageFailure\([\s\S]*'clear_failed'[\s\S]*'local_storage'[\s\S]*export function clearCachedAdminProfile\(\): AdminAuthStorageResult \{[\s\S]*sessionStorage\.removeItem\('admin_profile'\)[\s\S]*buildAdminAuthStorageFailure\([\s\S]*'clear_failed'[\s\S]*'session_storage'/,
  'Admin auth logout and failed-profile cleanup should use the shared local helper for structured source/details clear failures',
);

assert.match(
  adminApi,
  /export function readCachedAdminProfile\(\): AdminAuthStorageResult<AdminProfileCache \| null> \{[\s\S]*sessionStorage\.getItem\('admin_profile'\)[\s\S]*buildAdminAuthStorageFailure\([\s\S]*'read_failed'[\s\S]*'session_storage'[\s\S]*'浏览器拒绝读取 Admin 管理员缓存'[\s\S]*export function persistCachedAdminProfile\(profile: AdminProfileCache\): AdminAuthStorageResult \{[\s\S]*sessionStorage\.setItem\('admin_profile', JSON\.stringify\(profile\)\)[\s\S]*buildAdminAuthStorageFailure\([\s\S]*'write_failed'[\s\S]*'session_storage'[\s\S]*'浏览器拒绝保存 Admin 管理员缓存'/,
  'Admin profile cache reads and writes should use the shared local helper for structured session_storage source/details failures',
);
assert.match(
  adminApi,
  /export type AdminProfileCache = \{[\s\S]*email: string;[\s\S]*role: AdminSessionRole;[\s\S]*raw_role: string;[\s\S]*permission_codes: AdminPermissionCodeList;[\s\S]*\};[\s\S]*export type AdminProfileCacheRawPayload = \{[\s\S]*email\?: string;[\s\S]*role\?: string;[\s\S]*raw_role\?: string;[\s\S]*permission_codes\?: AdminPermissionCodeList;[\s\S]*\};[\s\S]*const parsed = JSON\.parse\(raw\) as AdminProfileCacheRawPayload;/,
  'Admin profile cache read should parse session storage through a named raw payload contract',
);
assert.match(
  adminApi,
  /export interface AdminProfile {[\s\S]*must_change_password: boolean;[\s\S]*type AdminProfileRawResponse = {[\s\S]*must_change_password\?: boolean;[\s\S]*export type AdminProfileCache = {[\s\S]*must_change_password: boolean;[\s\S]*export type AdminProfileCacheRawPayload = {[\s\S]*must_change_password\?: boolean;[\s\S]*must_change_password: parsed\.must_change_password !== false,/,
  `Admin profile and session cache contracts should preserve and fail closed on the forced password-change state`,
);
assert.doesNotMatch(
  adminApi,
  /JSON\.parse\(raw\) as \{[\s\S]*email\?: string;[\s\S]*role\?: string;[\s\S]*raw_role\?: string;[\s\S]*permission_codes\?: AdminPermissionCodeList;|AdminProfileCache = Pick<AdminProfile/,
  'Admin profile cache read should not regress to an inline session storage payload object or Pick-derived cache contract',
);

assert.match(
  adminLayout,
  /AdminAuthStorageRedirectStatus[\s\S]*function buildAdminAuthStorageFailureTarget\([\s\S]*status: AdminAuthStorageRedirectStatus,[\s\S]*admin_auth_storage_source[\s\S]*admin_auth_storage_details[\s\S]*const tokenResult = adminAuthApi\.readTokenStorage\(\);[\s\S]*router\.replace\(buildAdminAuthStorageFailureTarget\('read_failed', tokenResult\)\);/,
  'Admin layout should redirect with explicit auth storage read failure state and source/details through the named redirect status contract',
);
assert.doesNotMatch(
  adminLayout,
  /status: 'read_failed' \| 'clear_failed'/,
  'Admin layout should not regress auth storage redirect status to a local inline union',
);

assert.match(
  adminLayout,
  /Admin 管理员缓存读取失败：\$\{formatAdminAuthStorageFailure\(cachedProfileResult, '浏览器拒绝读取 Admin 管理员缓存'\)\}[\s\S]*继续向后端校验登录状态[\s\S]*Admin 管理员缓存保存失败：\$\{formatAdminAuthStorageFailure\(profileCacheResult, '浏览器拒绝保存 Admin 管理员缓存'\)\}[\s\S]*刷新后可能无法从本地 admin_profile 快速恢复管理员信息/,
  'Admin layout should show profile cache read and write failures with session_storage source/details without blocking backend profile auth',
);
assert.match(
  adminLayout,
  /admin_profile_cache_status'\) === 'failed'[\s\S]*resolveAdminProfileCacheUrlStorageSource\(url\.searchParams\.get\('admin_profile_cache_source'\)\)[\s\S]*admin_profile_cache_details[\s\S]*formatAdminProfileCacheUrlStorageFailure\(profileCacheSource, profileCacheDetails\)[\s\S]*url\.searchParams\.delete\('admin_profile_cache_status'\);[\s\S]*url\.searchParams\.delete\('admin_profile_cache_source'\);[\s\S]*url\.searchParams\.delete\('admin_profile_cache_details'\);[\s\S]*window\.history\.replaceState\(window\.history\.state, '', `\$\{url\.pathname\}\$\{url\.search\}\$\{url\.hash\}`\);[\s\S]*catch \(error\) \{[\s\S]*formatAdminAuthBrowserHistoryError\(error, '浏览器拒绝更新地址栏'\)[\s\S]*Admin 管理员缓存状态参数清理失败：\$\{reason\}[\s\S]*admin_profile_cache_status\/source\/details 参数可能仍会残留[\s\S]*以后端最新 profile 校验结果为准/,
  'Admin layout should surface profile cache URL status/source/details and cleanup failures through shared Admin auth local helpers with repeated stale warning risk',
);

assert.match(
  adminLayout,
  /const result = adminAuthApi\.logout\(\);[\s\S]*const failedStorageResult = !result\.token\.ok \? result\.token : \(!result\.profile\.ok \? result\.profile : undefined\);[\s\S]*buildAdminAuthStorageFailureTarget\('clear_failed', failedStorageResult\)[\s\S]*role="status"[\s\S]*\{authStorageNotice\}/,
  'Admin logout should surface auth storage clear failures with source/details and render a visible status banner',
);

assert.match(
  adminLogin,
  /import \{ formatAdminAuthStorageUrlFailure \} from '@\/lib\/admin\/admin-auth-local-errors';[\s\S]*new URLSearchParams\(window\.location\.search\)[\s\S]*params\.get\('admin_auth_storage'\)[\s\S]*formatAdminAuthStorageUrlFailure\(params, '浏览器拒绝访问本地 admin_token'\)[\s\S]*Admin 登录凭据读取失败：\$\{reason\}[\s\S]*formatAdminAuthStorageUrlFailure\(params, '浏览器拒绝清理 admin_token 或 admin_profile'\)[\s\S]*Admin 登录凭据清理失败：\$\{reason\}[\s\S]*旧凭据可能仍残留/,
  'Admin login page should explain auth token read and clear failures from URL state with source/details',
);
assert.doesNotMatch(
  adminLogin,
  /function formatAdminLoginStorageUrlFailure/,
  'Admin login page should not keep a page-local auth storage URL formatter',
);

assert.match(
  adminLogin,
  /function buildAdminProfileCacheFailureTarget\([\s\S]*admin_profile_cache_status: 'failed'[\s\S]*admin_profile_cache_source[\s\S]*admin_profile_cache_details[\s\S]*result\.profile_cache_status === 'write_failed'[\s\S]*buildAdminProfileCacheFailureTarget\(result\)/,
  'Admin login should pass profile cache write failure source/details into Admin layout after successful token persistence',
);

assert.match(
  validationLayer,
  /Admin auth 本地凭据状态校验[\s\S]*admin_token[\s\S]*admin_profile[\s\S]*source=local_storage[\s\S]*source=session_storage[\s\S]*source=browser_history[\s\S]*用户可见/,
  'Validation layer should document Admin auth local credential storage and URL cleanup source/details visibility requirements',
);
console.log('[YES] Admin auth storage model validation passed.');
