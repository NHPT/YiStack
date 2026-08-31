import type {
  AdminLoginPageSnapshot,
  AdminLoginPageSnapshotSource,
  AdminLoginPageSnapshotStatus,
} from '../../workspace/workspace-types';

function getAdminLoginSnapshotClassName(snapshot: AdminLoginPageSnapshot) {
  if (snapshot.status === 'login_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'storage_notice' || snapshot.status === 'form_incomplete') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  if (snapshot.status === 'submitting' || snapshot.status === 'redirecting') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

function getAdminLoginSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function buildAdminLoginPageSnapshot({
  email,
  password,
  error,
  authStorageNotice,
  loading,
  redirecting,
  redirectTarget,
}: {
  email: string;
  password: string;
  error: string;
  authStorageNotice: string | null;
  loading: boolean;
  redirecting: boolean;
  redirectTarget: string;
}): AdminLoginPageSnapshot {
  const emailLength = email.trim().length;
  const passwordLength = password.length;
  const hasError = error.length > 0;
  const hasStorageNotice = authStorageNotice !== null && authStorageNotice.length > 0;
  const canSubmit = loading === false && redirecting === false && emailLength > 0 && passwordLength > 0;
  const canReturnHome = loading === false && redirecting === false;
  const status: AdminLoginPageSnapshotStatus = redirecting === true
    ? 'redirecting'
    : loading === true
      ? 'submitting'
      : hasError === true
        ? 'login_failed'
        : hasStorageNotice === true
          ? 'storage_notice'
          : canSubmit === true
            ? 'ready'
            : 'form_incomplete';
  const source: AdminLoginPageSnapshotSource = status === 'redirecting'
    ? 'admin_redirect'
    : status === 'submitting' || status === 'login_failed'
      ? 'admin_auth_operation'
      : status === 'storage_notice'
        ? 'admin_auth_storage'
        : 'admin_form';

  return {
    status,
    source,
    redirectTarget,
    emailLength,
    passwordLength,
    isSubmitting: loading,
    isRedirecting: redirecting,
    hasError,
    hasStorageNotice,
    canSubmit,
    canReturnHome,
    message: status === 'redirecting'
      ? 'Admin 登录成功，正在进入管理后台。'
      : status === 'submitting'
        ? 'Admin 登录请求正在提交。'
        : status === 'login_failed'
          ? 'Admin 登录失败，当前仍停留在登录页。'
          : status === 'storage_notice'
            ? 'Admin 本地凭据存在可恢复提示。'
            : status === 'ready'
              ? 'Admin 登录表单已就绪，可以提交。'
              : 'Admin 登录表单尚未满足提交条件。',
    recovery: status === 'redirecting'
      ? `等待跳转到 ${redirectTarget}。`
      : status === 'submitting'
        ? '等待当前请求返回，避免重复提交。'
        : status === 'login_failed'
          ? '检查管理员邮箱、密码或后端鉴权状态后重试。'
          : status === 'storage_notice'
            ? '按提示检查浏览器本地存储权限，再重新登录。'
            : status === 'ready'
              ? `提交后将进入 ${redirectTarget}。`
              : '填写管理员邮箱和密码后再登录。',
    updatedAt: 'derived',
  };
}

export function AdminLoginPageSnapshotStrip({ snapshot }: { snapshot: AdminLoginPageSnapshot }) {
  const isSubmittingLabel = getAdminLoginSnapshotBooleanLabel(snapshot.isSubmitting);
  const isRedirectingLabel = getAdminLoginSnapshotBooleanLabel(snapshot.isRedirecting);
  const hasErrorLabel = getAdminLoginSnapshotBooleanLabel(snapshot.hasError);
  const hasStorageNoticeLabel = getAdminLoginSnapshotBooleanLabel(snapshot.hasStorageNotice);
  const canSubmitLabel = getAdminLoginSnapshotBooleanLabel(snapshot.canSubmit);
  const canReturnHomeLabel = getAdminLoginSnapshotBooleanLabel(snapshot.canReturnHome);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-login-page-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminLoginSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin 登录快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Redirect: {snapshot.redirectTarget}</span>
        <span>EmailChars: {snapshot.emailLength}</span>
        <span>PasswordChars: {snapshot.passwordLength}</span>
        <span>Submitting: {isSubmittingLabel}</span>
        <span>Redirecting: {isRedirectingLabel}</span>
        <span>Error: {hasErrorLabel}</span>
        <span>Storage: {hasStorageNoticeLabel}</span>
        <span>Submit: {canSubmitLabel}</span>
        <span>Home: {canReturnHomeLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
