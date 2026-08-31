import type { AdminDashboardHealthSummary } from './admin-dashboard-health-summary-model';
import type {
  AdminDashboardPageSnapshot,
  AdminDashboardPageSnapshotSource,
  AdminDashboardPageSnapshotStatus,
  AdminSessionSnapshotRole,
} from '../workspace/workspace-types';
import type { AdminSessionRole } from '@/lib/admin/api';

type AdminDashboardProfileSnapshotInput = {
  role: AdminSessionRole;
} | null;

function hasAdminDashboardPageProfile(
  profile: AdminDashboardProfileSnapshotInput,
): profile is Exclude<AdminDashboardProfileSnapshotInput, null> {
  return profile !== null;
}

function isAdminDashboardPageSuperAdmin(profile: AdminDashboardProfileSnapshotInput): boolean {
  const hasProfile = hasAdminDashboardPageProfile(profile);
  const isSuperAdmin = hasProfile === true && profile.role === 'super_admin';
  return isSuperAdmin === true;
}

function getAdminDashboardPageRole(profile: AdminDashboardProfileSnapshotInput): AdminSessionSnapshotRole {
  const hasProfile = hasAdminDashboardPageProfile(profile);
  return hasProfile === true ? profile.role : 'none';
}

export function buildAdminDashboardPageSnapshot({
  profile,
  loading,
  cardCount,
  quickLinkCount,
  recentLogCount,
  adminProjectCount,
  hasProviderSnapshot,
  hasProviderPreflight,
  healthSummary,
}: {
  profile: AdminDashboardProfileSnapshotInput;
  loading: boolean;
  cardCount: number;
  quickLinkCount: number;
  recentLogCount: number;
  adminProjectCount: number;
  hasProviderSnapshot: boolean;
  hasProviderPreflight: boolean;
  healthSummary: AdminDashboardHealthSummary;
}): AdminDashboardPageSnapshot {
  const hasProfile = hasAdminDashboardPageProfile(profile);
  const isSuperAdmin = isAdminDashboardPageSuperAdmin(profile);
  const diagnosticsInputReady = isSuperAdmin === false || (hasProviderSnapshot === true && hasProviderPreflight === true);
  const canOpenDiagnostics = isSuperAdmin === true;
  const canOpenQuickLinks = quickLinkCount > 0;
  const isLoading = loading === true;
  const status: AdminDashboardPageSnapshotStatus = hasProfile === false
    ? 'profile_missing'
    : isLoading === true && cardCount === 0
      ? 'loading'
      : cardCount === 0 && quickLinkCount === 0
        ? 'empty'
        : isSuperAdmin === false
          ? 'limited_ready'
          : diagnosticsInputReady === true
            ? 'diagnostics_ready'
            : 'diagnostics_partial';
  const source: AdminDashboardPageSnapshotSource = status === 'profile_missing'
    ? 'admin_profile'
    : status === 'loading' || status === 'empty'
      ? 'dashboard_data'
      : status === 'limited_ready'
        ? 'dashboard_permissions'
        : 'dashboard_diagnostics';
  const role = getAdminDashboardPageRole(profile);

  return {
    status,
    source,
    role,
    isSuperAdmin,
    isLoading,
    cardCount,
    quickLinkCount,
    recentLogCount,
    adminProjectCount,
    hasProviderSnapshot,
    hasProviderPreflight,
    healthTone: healthSummary.tone,
    blockerCount: healthSummary.blockerCount,
    warningCount: healthSummary.warningCount,
    pendingCount: healthSummary.pendingCount,
    auditSignalCount: healthSummary.auditSignalCount,
    canOpenDiagnostics,
    canOpenQuickLinks,
    message: status === 'profile_missing'
      ? 'Admin Dashboard 尚未获得管理员 profile。'
      : status === 'loading'
        ? 'Admin Dashboard 正在加载统计卡片和诊断输入。'
        : status === 'empty'
          ? '当前权限下没有可展示的 Dashboard 统计或快捷入口。'
          : status === 'limited_ready'
            ? 'Admin Dashboard 已按当前管理员权限展示可用统计和快捷入口。'
            : status === 'diagnostics_partial'
              ? 'Admin Dashboard 已展示，但 super_admin 诊断输入仍有部分未返回。'
              : 'Admin Dashboard super_admin 诊断输入已就绪。',
    recovery: status === 'profile_missing'
      ? '等待 Admin Layout 完成 profile 校验。'
      : status === 'loading'
        ? '等待 Dashboard 请求返回；各请求失败会保持当前可用数据。'
        : status === 'empty'
          ? '检查当前管理员权限或稍后刷新 Dashboard。'
          : status === 'limited_ready'
            ? '需要更多模块时由 super_admin 调整权限。'
            : status === 'diagnostics_partial'
              ? '查看各诊断卡的 pending/empty 状态，必要时刷新页面重新拉取。'
              : '可以继续处理 health summary 指向的诊断分组。',
    updatedAt: 'derived',
  };
}

function getAdminDashboardPageSnapshotClassName(snapshot: AdminDashboardPageSnapshot) {
  if (snapshot.status === 'profile_missing' || snapshot.status === 'empty') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  if (snapshot.status === 'loading' || snapshot.status === 'diagnostics_partial') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

function getAdminDashboardPageSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function AdminDashboardPageSnapshotStrip({ snapshot }: { snapshot: AdminDashboardPageSnapshot }) {
  const isSuperAdminLabel = getAdminDashboardPageSnapshotBooleanLabel(snapshot.isSuperAdmin);
  const isLoadingLabel = getAdminDashboardPageSnapshotBooleanLabel(snapshot.isLoading);
  const hasProviderSnapshotLabel = getAdminDashboardPageSnapshotBooleanLabel(snapshot.hasProviderSnapshot);
  const hasProviderPreflightLabel = getAdminDashboardPageSnapshotBooleanLabel(snapshot.hasProviderPreflight);
  const canOpenDiagnosticsLabel = getAdminDashboardPageSnapshotBooleanLabel(snapshot.canOpenDiagnostics);
  const canOpenQuickLinksLabel = getAdminDashboardPageSnapshotBooleanLabel(snapshot.canOpenQuickLinks);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-dashboard-page-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminDashboardPageSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Dashboard 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Role: {snapshot.role}</span>
        <span>SuperAdmin: {isSuperAdminLabel}</span>
        <span>Loading: {isLoadingLabel}</span>
        <span>Cards: {snapshot.cardCount}</span>
        <span>QuickLinks: {snapshot.quickLinkCount}</span>
        <span>Logs: {snapshot.recentLogCount}</span>
        <span>Projects: {snapshot.adminProjectCount}</span>
        <span>Provider: {hasProviderSnapshotLabel}</span>
        <span>Preflight: {hasProviderPreflightLabel}</span>
        <span>Tone: {snapshot.healthTone}</span>
        <span>Blockers: {snapshot.blockerCount}</span>
        <span>Warnings: {snapshot.warningCount}</span>
        <span>Pending: {snapshot.pendingCount}</span>
        <span>AuditSignals: {snapshot.auditSignalCount}</span>
        <span>Diagnostics: {canOpenDiagnosticsLabel}</span>
        <span>QuickAccess: {canOpenQuickLinksLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
