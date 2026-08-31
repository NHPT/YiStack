#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const authStorage = read('src/lib/auth-storage.ts');
const authOperationErrors = read('src/lib/auth-operation-errors.ts');
const apiClient = read('src/lib/api/index.ts');
const authContext = read('src/contexts/auth-context.tsx');
const authPage = read('src/app/auth/page.tsx');
const homePage = read('src/app/page.tsx');
const validationLayer = read('docs/engineering/VALIDATION_LAYER.md');

assert.match(
  authStorage,
  /export type UserAuthStorageStatus = 'read_failed' \| 'write_failed' \| 'clear_failed';[\s\S]*export type UserAuthStorageSource = 'local_storage';[\s\S]*export type UserAuthStorageDetails = string;[\s\S]*export type UserAuthStorageFailureResult = \{[\s\S]*source: UserAuthStorageSource[\s\S]*message: UserAuthStorageDetails;[\s\S]*details: UserAuthStorageDetails;[\s\S]*export type UserAuthStorageResult<T = void> =[\s\S]*UserAuthStorageFailureResult[\s\S]*export function formatUserAuthStorageError\([\s\S]*fallback: UserAuthStorageDetails,[\s\S]*\): UserAuthStorageDetails[\s\S]*export function buildUserAuthStorageFailure\([\s\S]*status: UserAuthStorageStatus[\s\S]*fallback: UserAuthStorageDetails[\s\S]*\): UserAuthStorageFailureResult \{[\s\S]*source: 'local_storage'[\s\S]*message: details,[\s\S]*details,[\s\S]*export function formatUserAuthStorageFailure\([\s\S]*result: UserAuthStorageFailureResult,[\s\S]*fallback: UserAuthStorageDetails,[\s\S]*formatUserVisibleApiError\(\{[\s\S]*source: result\.source[\s\S]*details: result\.details/,
  'User auth storage failures should centralize local_storage source/details construction and shared visible formatting',
);
assert.doesNotMatch(
  authStorage,
  /details: string;|message: string;|fallback: string/,
  'User auth storage failure result should not regress message/details/fallback to raw strings',
);
assert.match(
  authStorage,
  /export function formatUserAuthCacheParseFailure\([\s\S]*error: unknown,[\s\S]*fallback: UserAuthStorageDetails = '普通用户缓存格式无效'[\s\S]*source: 'local_storage'[\s\S]*details,/,
  'User auth cache parse failures should centralize local_storage source/details formatting in auth-storage',
);
assert.match(
  authOperationErrors,
  /export type AuthOperationErrorDetails = string;[\s\S]*export function formatAuthOperationFailure\([\s\S]*fallback: AuthOperationErrorDetails,[\s\S]*formatUserVisibleApiError\(error, fallback\)/,
  'Auth operation failures should use a shared formatter that preserves structured source/details',
);
assert.doesNotMatch(
  authOperationErrors,
  /fallback: string/,
  'Auth operation failures should not regress to raw fallback strings',
);
assert.match(
  authStorage,
  /export function readUserAuthSessionStorage\(\): UserAuthStorageResult<UserAuthSessionStorage> \{[\s\S]*localStorage\.getItem\('yistack_token'\)[\s\S]*localStorage\.getItem\('yistack_user'\)[\s\S]*buildUserAuthStorageFailure\(error, 'read_failed', '浏览器拒绝读取普通登录凭据'\)/,
  'User auth session reads should use the shared failure builder instead of throwing from localStorage',
);
assert.match(
  authStorage,
  /export function persistUserAuthSessionStorage\(token: string, user: User\): UserAuthStorageResult \{[\s\S]*localStorage\.setItem\('yistack_token', token\);[\s\S]*localStorage\.setItem\('yistack_user', JSON\.stringify\(user\)\);[\s\S]*buildUserAuthStorageFailure\(error, 'write_failed', '浏览器拒绝保存普通登录凭据'\)/,
  'User auth login/register persistence should use the shared failure builder for structured source/details write failures',
);
assert.match(
  authStorage,
  /export function clearUserAuthSessionStorage\(\): UserAuthStorageResult<UserAuthClearValue> \{[\s\S]*localStorage\.removeItem\('yistack_token'\);[\s\S]*localStorage\.removeItem\('yistack_user'\);[\s\S]*localStorage\.removeItem\('yistack_current_project'\);[\s\S]*buildUserAuthStorageFailure\(error, 'clear_failed', '浏览器拒绝清理普通登录凭据或本地项目快照'\)/,
  'User auth logout/session expiry cleanup should use the shared failure builder for structured source/details clear failures',
);
assert.doesNotMatch(
  authContext,
  /localStorage\.(getItem|setItem|removeItem)/,
  'AuthProvider should use the shared structured auth storage helpers instead of direct localStorage access',
);
assert.doesNotMatch(
  authContext,
  /formatUserVisibleApiError\(/,
  'AuthProvider should not directly call the global visible API error formatter for local auth storage failures',
);
assert.match(
  authContext,
  /import type \{ UserAuthStorageFailureResult \} from '@\/lib\/auth-storage';[\s\S]*function buildUserAuthStorageError\([\s\S]*result: UserAuthStorageFailureResult/,
  'AuthProvider should consume an explicit UserAuthStorageFailureResult contract for local auth persistence failures',
);
assert.doesNotMatch(
  authContext,
  /ReturnType<typeof persistUserAuthSessionStorage>/,
  'AuthProvider should not infer local auth persistence failure contracts from persistUserAuthSessionStorage ReturnType',
);
assert.match(
  apiClient,
  /readUserAuthTokenStorage\(\)[\s\S]*yistack:auth-storage-failed[\s\S]*普通登录凭据读取失败：\$\{formatUserAuthStorageFailure\(result, '浏览器拒绝读取普通登录凭据'\)\}[\s\S]*当前请求无法确认 yistack_token/,
  'API client should surface token read failures with local_storage source/details through an auth storage event',
);
assert.match(
  apiClient,
  /clearUserAuthSessionStorage\(\)[\s\S]*yistack:auth-expired[\s\S]*登录已失效，但普通登录凭据清理失败：\$\{formatUserAuthStorageFailure\(clearResult, '浏览器拒绝清理普通登录凭据或本地项目快照'\)\}[\s\S]*yistack_token、yistack_user 或 yistack_current_project 可能仍残留/,
  'API client should surface auth cleanup failures with local_storage source/details after 401 session expiry',
);
assert.match(
  authContext,
  /const \[authStorageNotice, setAuthStorageNotice\] = useState<string \| null>\(null\);[\s\S]*普通登录凭据读取失败：\$\{formatUserAuthStorageFailure\(sessionResult, '浏览器拒绝读取普通登录凭据'\)\}[\s\S]*会按未登录状态展示[\s\S]*formatUserAuthCacheParseFailure\(error\)[\s\S]*普通登录缓存解析失败：\$\{reason\}[\s\S]*请重新登录以恢复会话/,
  'AuthProvider should expose read and parse failures as user-visible auth storage notices with local_storage source/details',
);
assert.match(
  authContext,
  /persistUserAuthSessionStorage\(response\.token, response\.user\)[\s\S]*const reason = formatUserAuthStorageFailure\(persistResult, '浏览器拒绝保存普通登录凭据'\);[\s\S]*登录成功但普通登录凭据保存失败：\$\{reason\}[\s\S]*throw buildUserAuthStorageError[\s\S]*persistUserAuthSessionStorage\(response\.token, response\.user\)[\s\S]*const reason = formatUserAuthStorageFailure\(persistResult, '浏览器拒绝保存普通登录凭据'\);[\s\S]*注册成功但普通登录凭据保存失败：\$\{reason\}[\s\S]*throw buildUserAuthStorageError/,
  'AuthProvider should stop login/register success flow when local auth persistence fails visibly with local_storage source/details',
);
assert.match(
  authContext,
  /clearUserAuthSessionStorage\(\)[\s\S]*普通登录凭据清理失败：\$\{formatUserAuthStorageFailure\(clearResult, '浏览器拒绝清理普通登录凭据或本地项目快照'\)\}[\s\S]*yistack_token、yistack_user 或 yistack_current_project 可能仍残留/,
  'AuthProvider logout should surface local auth cleanup failures with local_storage source/details',
);
assert.match(
  authContext,
  /persistUserProfileStorage\(updatedUser\)[\s\S]*普通用户缓存更新失败：\$\{formatUserAuthStorageFailure\(persistResult, '浏览器拒绝更新普通用户缓存'\)\}[\s\S]*刷新后可能仍恢复到旧 yistack_user/,
  'AuthProvider user profile updates should surface local cache write failures with local_storage source/details',
);
assert.doesNotMatch(
  authPage,
  /setError\(err\.message\)/,
  'Auth page must not bypass structured source/details by rendering bare err.message',
);
assert.doesNotMatch(
  authPage,
  /formatUserVisibleApiError\(/,
  'Auth page should not directly call the global visible API error formatter for submit failures',
);
assert.match(
  authPage,
  /import \{ formatAuthOperationFailure \} from '@\/lib\/auth-operation-errors';[\s\S]*catch \(err\) \{[\s\S]*setError\(formatAuthOperationFailure\(err, '操作失败，请稍后重试'\)\);/,
  'Auth page should render all submit failures through the shared Auth operation formatter',
);
assert.match(
  authPage,
  /authStorageNotice[\s\S]*<Alert role="status"[\s\S]*\{authStorageNotice\}/,
  'Auth page should render user auth storage notices as visible status feedback',
);
assert.match(
  homePage,
  /authStorageNotice[\s\S]*<p role="status"[\s\S]*\{authStorageNotice\}/,
  'Home page should render user auth storage notices near creation/login affordances',
);
assert.match(
  validationLayer,
  /普通用户 auth 本地凭据状态校验[\s\S]*yistack_token[\s\S]*yistack_user[\s\S]*source=local_storage[\s\S]*用户可见/,
  'Validation layer should document ordinary user auth storage source/details visibility requirements',
);
console.log('[YES] User auth storage model validation passed.');
