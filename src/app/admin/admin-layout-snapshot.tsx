import type {
  AdminLayoutSnapshot,
  AdminLayoutSnapshotSource,
  AdminLayoutSnapshotStatus,
  AdminPermissionCodeList,
  AdminSessionSnapshotRole,
} from '../workspace/workspace-types';
import type { AdminSessionRole } from '@/lib/admin/api';

type AdminLayoutProfileSnapshotInput = {
  role: AdminSessionRole;
  raw_role: string;
  permission_codes: AdminPermissionCodeList;
} | null;

export function buildAdminLayoutSnapshot({
  pathname,
  checking,
  authed,
  adminInfo,
  authStorageNotice,
  visibleNavCount,
  statusHint,
}: {
  pathname: string;
  checking: boolean;
  authed: boolean;
  adminInfo: AdminLayoutProfileSnapshotInput;
  authStorageNotice: string | null;
  visibleNavCount: number;
  statusHint: AdminLayoutSnapshotStatus | null;
}): AdminLayoutSnapshot {
  const hasAdminInfo = adminInfo !== null;
  const hasStorageNotice = authStorageNotice !== null && authStorageNotice.length > 0;
  const hasStatusHint = statusHint !== null;
  const isLoginRoute = pathname === '/admin/login';
  const canRenderChildren = isLoginRoute === true || (authed === true && hasAdminInfo === true && checking === false);
  const canLogout = authed === true && hasAdminInfo === true && isLoginRoute === false;
  const canOpenNav = authed === true && hasAdminInfo === true && visibleNavCount > 0 && isLoginRoute === false;
  const status: AdminLayoutSnapshotStatus = isLoginRoute === true
    ? 'login_route'
    : hasStatusHint === true
      ? statusHint
      : checking === true
      ? 'checking'
      : authed === true && hasAdminInfo === true
          ? hasStorageNotice === true
          ? 'profile_cache_write_failed'
          : 'ready'
        : 'unauthenticated';
  const source: AdminLayoutSnapshotSource = status === 'login_route'
    ? 'route'
    : status === 'token_missing_redirect' || status === 'token_read_failed_redirect'
      ? 'token_storage'
      : status === 'cached_profile_ready' || status === 'profile_cache_read_failed' || status === 'profile_cache_write_failed'
        ? 'profile_cache'
        : status === 'profile_cache_url_cleanup_failed'
          ? 'browser_history'
          : status === 'profile_verified' || status === 'profile_verification_failed_redirect'
            ? 'profile_api'
            : 'admin_session';
  const role: AdminSessionSnapshotRole = hasAdminInfo === true ? adminInfo.role : 'none';
  const rawRole = hasAdminInfo === true ? adminInfo.raw_role : 'none';
  const permissionCount = hasAdminInfo === true ? adminInfo.permission_codes.length : 0;

  return {
    status,
    source,
    pathname,
    isChecking: checking,
    isAuthed: authed,
    hasAdminInfo,
    role,
    rawRole,
    permissionCount,
    visibleNavCount,
    hasStorageNotice,
    canRenderChildren,
    canLogout,
    canOpenNav,
    message: status === 'login_route'
      ? '当前位于 Admin 登录路由，Layout 不渲染后台外壳。'
      : status === 'checking'
        ? 'Admin Layout 正在校验 token 和管理员 profile。'
        : status === 'token_missing_redirect'
          ? '未找到 Admin token，正在跳转登录页。'
          : status === 'token_read_failed_redirect'
            ? 'Admin token 读取失败，正在携带 storage 来源跳转登录页。'
            : status === 'cached_profile_ready'
              ? '已从本地 profile cache 恢复管理员信息，后端校验仍在后台刷新。'
              : status === 'profile_cache_read_failed'
                ? '本地 profile cache 读取失败，正在继续后端 profile 校验。'
                : status === 'profile_cache_write_failed'
                  ? '后端 profile 已校验，但本地 profile cache 写入失败。'
                  : status === 'profile_cache_url_cleanup_failed'
                    ? 'profile cache URL 状态已展示，但地址栏临时参数清理失败。'
                    : status === 'profile_verified'
                      ? '后端 profile 校验通过，Admin Layout 已获得权威管理员信息。'
                      : status === 'profile_verification_failed_redirect'
                        ? '后端 profile 校验失败，正在清理凭据并跳转登录页。'
                        : status === 'ready'
                          ? 'Admin Layout 已就绪，可以渲染后台导航和页面内容。'
                          : 'Admin Layout 未获得有效登录态。',
    recovery: status === 'login_route'
      ? '登录成功后会重新进入 Admin Layout 鉴权流程。'
      : status === 'checking'
        ? '等待 token/profile 校验完成。'
        : status === 'token_missing_redirect'
          ? '重新登录以写入 Admin token。'
          : status === 'token_read_failed_redirect'
            ? '检查浏览器 localStorage 权限后重新登录。'
            : status === 'cached_profile_ready'
              ? '等待后端 profile 校验刷新缓存。'
              : status === 'profile_cache_read_failed'
                ? '检查 sessionStorage 权限；页面会继续以后端 profile 为准。'
                : status === 'profile_cache_write_failed'
                  ? '刷新前可继续使用当前后端 profile，刷新后可能需要重新校验。'
                  : status === 'profile_cache_url_cleanup_failed'
                    ? '如果刷新后重复看到旧提示，请以后端最新 profile 校验结果为准。'
                    : status === 'profile_verified'
                      ? '继续使用后台；导航权限由后端 profile 权限码派生。'
                      : status === 'profile_verification_failed_redirect'
                        ? '重新登录；若清理凭据失败，登录页会展示 storage 来源。'
                        : status === 'ready'
                          ? '可以继续访问已授权的 Admin 页面。'
                          : '等待跳转登录页或重新登录。',
    updatedAt: 'derived',
  };
}

function getAdminLayoutSnapshotClassName(snapshot: AdminLayoutSnapshot) {
  if (snapshot.status === 'token_read_failed_redirect' || snapshot.status === 'profile_verification_failed_redirect' || snapshot.status === 'unauthenticated') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'profile_cache_read_failed' || snapshot.status === 'profile_cache_write_failed' || snapshot.status === 'profile_cache_url_cleanup_failed' || snapshot.status === 'token_missing_redirect') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  if (snapshot.status === 'checking' || snapshot.status === 'cached_profile_ready' || snapshot.status === 'profile_verified') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

function getAdminLayoutSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function AdminLayoutSnapshotStrip({ snapshot }: { snapshot: AdminLayoutSnapshot }) {
  const isCheckingLabel = getAdminLayoutSnapshotBooleanLabel(snapshot.isChecking);
  const isAuthedLabel = getAdminLayoutSnapshotBooleanLabel(snapshot.isAuthed);
  const hasAdminInfoLabel = getAdminLayoutSnapshotBooleanLabel(snapshot.hasAdminInfo);
  const hasStorageNoticeLabel = getAdminLayoutSnapshotBooleanLabel(snapshot.hasStorageNotice);
  const canRenderChildrenLabel = getAdminLayoutSnapshotBooleanLabel(snapshot.canRenderChildren);
  const canLogoutLabel = getAdminLayoutSnapshotBooleanLabel(snapshot.canLogout);
  const canOpenNavLabel = getAdminLayoutSnapshotBooleanLabel(snapshot.canOpenNav);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-layout-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminLayoutSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Layout 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Path: {snapshot.pathname}</span>
        <span>Checking: {isCheckingLabel}</span>
        <span>Authed: {isAuthedLabel}</span>
        <span>Profile: {hasAdminInfoLabel}</span>
        <span>Role: {snapshot.role}</span>
        <span>RawRole: {snapshot.rawRole}</span>
        <span>Permissions: {snapshot.permissionCount}</span>
        <span>Nav: {snapshot.visibleNavCount}</span>
        <span>Notice: {hasStorageNoticeLabel}</span>
        <span>Children: {canRenderChildrenLabel}</span>
        <span>Logout: {canLogoutLabel}</span>
        <span>OpenNav: {canOpenNavLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
