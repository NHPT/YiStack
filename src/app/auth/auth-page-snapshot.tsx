import { cn } from '@/lib/utils';

import type {
  AuthPageMode,
  AuthPageSnapshot,
  AuthPageSnapshotSource,
  AuthPageSnapshotStatus,
} from '../workspace/workspace-types';

export function buildAuthPageSnapshot({
  mode,
  redirectTarget,
  authLoading,
  isAuthenticated,
  isSubmitting,
  error,
  authStorageNotice,
  email,
  password,
  username,
  sourceOverride,
}: {
  mode: AuthPageMode;
  redirectTarget: string;
  authLoading: boolean;
  isAuthenticated: boolean;
  isSubmitting: boolean;
  error: string | null;
  authStorageNotice: string | null;
  email: string;
  password: string;
  username: string;
  sourceOverride?: 'suspense';
}): AuthPageSnapshot {
  const emailLength = email.trim().length;
  const passwordLength = password.length;
  const usernameLength = username.trim().length;
  const hasError = error !== null;
  const hasStorageNotice = authStorageNotice !== null;
  const hasEmail = emailLength > 0;
  const hasPassword = passwordLength >= 6;
  const hasUsername = usernameLength > 0;
  const isRegisterMode = mode === 'register';
  const canSubmit = authLoading === false
    && isAuthenticated === false
    && isSubmitting === false
    && hasEmail === true
    && hasPassword === true
    && (mode === 'login' || hasUsername === true);
  const canToggleMode = isSubmitting === false;
  const canReturnHome = isSubmitting === false;
  const status: AuthPageSnapshotStatus = sourceOverride === 'suspense'
    ? 'suspense_pending'
    : authLoading === true
      ? 'auth_checking'
      : isAuthenticated === true
        ? 'authenticated_redirect'
        : isSubmitting === true
          ? 'submitting'
          : hasError === true
            ? 'auth_failed'
            : hasStorageNotice === true
              ? 'storage_notice'
              : canSubmit === false
                ? 'form_incomplete'
                : isRegisterMode === true
                  ? 'register_ready'
                  : 'login_ready';
  const source: AuthPageSnapshotSource = status === 'suspense_pending'
    ? 'suspense'
    : status === 'auth_checking' || status === 'authenticated_redirect'
      ? 'auth_gate'
      : status === 'submitting' || status === 'auth_failed'
        ? 'auth_operation'
        : status === 'storage_notice'
          ? 'auth_storage'
          : 'auth_form';

  return {
    status,
    source,
    mode,
    redirectTarget,
    authLoading,
    isAuthenticated,
    isSubmitting,
    hasError,
    hasStorageNotice,
    emailLength,
    passwordLength,
    usernameLength,
    canSubmit,
    canToggleMode,
    canReturnHome,
    message: status === 'suspense_pending'
      ? 'Auth 页面 Suspense fallback 正在等待表单挂载。'
      : status === 'auth_checking'
        ? '正在恢复或校验登录态。'
        : status === 'authenticated_redirect'
          ? '已登录，正在跳转到目标页面。'
          : status === 'submitting'
            ? `${mode === 'login' ? '登录' : '注册'}请求正在提交。`
            : status === 'auth_failed'
              ? '认证操作失败，当前仍停留在 Auth 页面。'
              : status === 'storage_notice'
                ? '本地认证存储存在可恢复提示。'
                : status === 'form_incomplete'
                  ? '认证表单尚未满足提交条件。'
                  : status === 'register_ready'
                    ? '注册表单已就绪，可以提交。'
                    : '登录表单已就绪，可以提交。',
    recovery: status === 'suspense_pending'
      ? '等待 Auth 表单挂载完成。'
      : status === 'auth_checking'
        ? '等待登录态校验完成；若长时间停留，可刷新页面。'
        : status === 'authenticated_redirect'
          ? `等待跳转到 ${redirectTarget}。`
          : status === 'submitting'
            ? '等待当前请求返回，避免重复提交。'
            : status === 'auth_failed'
              ? '检查邮箱、密码或注册用户名后重试。'
              : status === 'storage_notice'
                ? '按提示确认本地登录存储状态，必要时重新登录。'
                : status === 'form_incomplete'
                  ? mode === 'register'
                    ? '填写邮箱、至少 6 位密码和用户名后再注册。'
                    : '填写邮箱和至少 6 位密码后再登录。'
                  : `提交后将进入 ${redirectTarget}。`,
    updatedAt: 'derived',
  };
}

function getAuthPageSnapshotClassName(snapshot: AuthPageSnapshot) {
  if (snapshot.status === 'auth_failed') {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }
  if (snapshot.status === 'storage_notice' || snapshot.status === 'form_incomplete') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (snapshot.status === 'suspense_pending' || snapshot.status === 'auth_checking' || snapshot.status === 'submitting' || snapshot.status === 'authenticated_redirect') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

function getAuthPageSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function AuthPageSnapshotStrip({ snapshot }: { snapshot: AuthPageSnapshot }) {
  const authLoadingLabel = getAuthPageSnapshotBooleanLabel(snapshot.authLoading);
  const isAuthenticatedLabel = getAuthPageSnapshotBooleanLabel(snapshot.isAuthenticated);
  const isSubmittingLabel = getAuthPageSnapshotBooleanLabel(snapshot.isSubmitting);
  const hasErrorLabel = getAuthPageSnapshotBooleanLabel(snapshot.hasError);
  const hasStorageNoticeLabel = getAuthPageSnapshotBooleanLabel(snapshot.hasStorageNotice);
  const canSubmitLabel = getAuthPageSnapshotBooleanLabel(snapshot.canSubmit);
  const canToggleModeLabel = getAuthPageSnapshotBooleanLabel(snapshot.canToggleMode);
  const canReturnHomeLabel = getAuthPageSnapshotBooleanLabel(snapshot.canReturnHome);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="auth-page-snapshot"
      className={cn('mb-6 rounded-md border px-3 py-2 text-xs', getAuthPageSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Auth 页面快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Mode: {snapshot.mode}</span>
        <span>Redirect: {snapshot.redirectTarget}</span>
        <span>AuthLoading: {authLoadingLabel}</span>
        <span>Authenticated: {isAuthenticatedLabel}</span>
        <span>Submitting: {isSubmittingLabel}</span>
        <span>Error: {hasErrorLabel}</span>
        <span>Storage: {hasStorageNoticeLabel}</span>
        <span>EmailChars: {snapshot.emailLength}</span>
        <span>PasswordChars: {snapshot.passwordLength}</span>
        <span>UsernameChars: {snapshot.usernameLength}</span>
        <span>Submit: {canSubmitLabel}</span>
        <span>Toggle: {canToggleModeLabel}</span>
        <span>Home: {canReturnHomeLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
