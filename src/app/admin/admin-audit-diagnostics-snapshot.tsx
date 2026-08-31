import type {
  AdminAuditDiagnosticsSnapshot,
  AdminAuditDiagnosticsSnapshotSource,
  AdminAuditDiagnosticsSnapshotStatus,
  AdminAuditDynamicFilterValue,
} from '../workspace/workspace-types';
import type {
  AdminAuditActiveFilterSummary,
  AdminAuditDiagnosticsSummaryModel,
  AdminAuditFilterValue,
} from './admin-audit-diagnostics-model';

function getAdminAuditDiagnosticsSnapshotLabel(value: string | null, fallback: string): string {
  const hasValue = value !== null && value.length > 0;

  return hasValue === true ? value : fallback;
}

export function buildAdminAuditDiagnosticsSnapshot({
  summary,
  unfilteredSummary,
  activeFilterSummary,
  actionFilter,
  targetTypeFilter,
  diagnosticLinkCopyError,
  diagnosticUrlSyncError,
}: {
  summary: AdminAuditDiagnosticsSummaryModel;
  unfilteredSummary: AdminAuditDiagnosticsSummaryModel;
  activeFilterSummary: AdminAuditActiveFilterSummary;
  actionFilter: AdminAuditFilterValue;
  targetTypeFilter: AdminAuditFilterValue;
  diagnosticLinkCopyError: string;
  diagnosticUrlSyncError: string;
}): AdminAuditDiagnosticsSnapshot {
  const hasCopyError = diagnosticLinkCopyError.length > 0;
  const hasUrlSyncError = diagnosticUrlSyncError.length > 0;
  const hasActiveFilters = activeFilterSummary.activeFilterCount > 0;
  const hasLatestAction = summary.latestAction !== null && summary.latestAction.length > 0;
  const hasLatestTargetType = summary.latestTargetType !== null && summary.latestTargetType.length > 0;
  const hasLatestAt = summary.latestAt !== null && summary.latestAt.length > 0;
  const hasLatestContext = hasLatestAction === true || hasLatestTargetType === true || hasLatestAt === true;
  const latestActionLabel = getAdminAuditDiagnosticsSnapshotLabel(summary.latestAction, 'none');
  const latestTargetTypeLabel = getAdminAuditDiagnosticsSnapshotLabel(summary.latestTargetType, 'none');
  const canClearFilters = hasActiveFilters === true;
  const canCopyDiagnosticLink = true;
  const snapshotActionFilter: AdminAuditDynamicFilterValue = actionFilter;
  const snapshotTargetTypeFilter: AdminAuditDynamicFilterValue = targetTypeFilter;
  const status: AdminAuditDiagnosticsSnapshotStatus = hasUrlSyncError === true
    ? 'url_sync_failed'
    : hasCopyError === true
      ? 'copy_failed'
      : hasActiveFilters === true && summary.totalLogCount === 0
        ? 'filtered_empty'
        : hasActiveFilters === true
          ? 'filtered'
          : unfilteredSummary.totalLogCount === 0
            ? 'empty'
            : hasLatestContext === true
              ? 'activity_detected'
              : 'ready';
  const source: AdminAuditDiagnosticsSnapshotSource = status === 'url_sync_failed'
    ? 'diagnostic_url'
    : status === 'copy_failed'
      ? 'diagnostic_link'
      : status === 'filtered' || status === 'filtered_empty'
        ? 'audit_filter'
        : hasLatestContext === true
          ? 'audit_context'
          : 'audit_logs';

  return {
    status,
    source,
    totalLogCount: activeFilterSummary.totalLogCount,
    matchedLogCount: activeFilterSummary.matchedLogCount,
    actionCount: summary.actionCount,
    targetTypeCount: summary.targetTypeCount,
    topActionCount: summary.topActions.length,
    targetTypeOptionCount: summary.targetTypes.length,
    activeFilterCount: activeFilterSummary.activeFilterCount,
    actionFilter: snapshotActionFilter,
    targetTypeFilter: snapshotTargetTypeFilter,
    latestAction: latestActionLabel,
    latestTargetType: latestTargetTypeLabel,
    hasLatestAt,
    hasCopyError,
    hasUrlSyncError,
    canClearFilters,
    canCopyDiagnosticLink,
    message: status === 'url_sync_failed'
      ? 'Admin Audit Diagnostics 筛选已在卡片内生效，但地址栏同步失败。'
      : status === 'copy_failed'
        ? 'Admin Audit Diagnostics 诊断链接复制失败。'
        : status === 'filtered_empty'
          ? 'Admin Audit Diagnostics 当前筛选没有匹配审计日志。'
          : status === 'filtered'
            ? 'Admin Audit Diagnostics 正在展示筛选后的审计日志。'
            : status === 'empty'
              ? 'Admin Audit Diagnostics 当前没有审计日志可诊断。'
              : status === 'activity_detected'
                ? 'Admin Audit Diagnostics 已捕获最近审计上下文。'
                : 'Admin Audit Diagnostics 已就绪。',
    recovery: status === 'url_sync_failed'
      ? '手动复制当前地址或重新选择筛选条件，避免分享旧诊断链接。'
      : status === 'copy_failed'
        ? '手动复制浏览器地址栏中的诊断 URL。'
        : status === 'filtered_empty'
          ? '清除筛选或调整 audit_action/audit_target_type 条件后重新查看。'
          : status === 'filtered'
            ? '可复制诊断链接共享当前筛选，或清除筛选回到最近审计日志。'
            : status === 'empty'
              ? '执行管理员操作后再回到 Dashboard 确认审计写入。'
              : status === 'activity_detected'
                ? '结合 latest action、target type 和列表详情定位最近操作。'
                : '保持观察；可复制诊断链接用于运维协作。',
    updatedAt: 'derived',
  };
}

function getAdminAuditDiagnosticsSnapshotClassName(snapshot: AdminAuditDiagnosticsSnapshot) {
  if (snapshot.status === 'url_sync_failed' || snapshot.status === 'copy_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'filtered_empty') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  if (snapshot.status === 'filtered' || snapshot.status === 'activity_detected') {
    return 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
  }
  if (snapshot.status === 'ready') {
    return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
  }
  return 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300';
}

function getAdminAuditDiagnosticsSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function AdminAuditDiagnosticsSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminAuditDiagnosticsSnapshot;
}) {
  const hasLatestAtLabel = getAdminAuditDiagnosticsSnapshotBooleanLabel(snapshot.hasLatestAt);
  const hasCopyErrorLabel = getAdminAuditDiagnosticsSnapshotBooleanLabel(snapshot.hasCopyError);
  const hasUrlSyncErrorLabel = getAdminAuditDiagnosticsSnapshotBooleanLabel(snapshot.hasUrlSyncError);
  const canClearFiltersLabel = getAdminAuditDiagnosticsSnapshotBooleanLabel(snapshot.canClearFilters);
  const canCopyDiagnosticLinkLabel = getAdminAuditDiagnosticsSnapshotBooleanLabel(snapshot.canCopyDiagnosticLink);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-audit-diagnostics-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminAuditDiagnosticsSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Audit Diagnostics 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Total: {snapshot.totalLogCount}</span>
        <span>Matched: {snapshot.matchedLogCount}</span>
        <span>Actions: {snapshot.actionCount}</span>
        <span>Targets: {snapshot.targetTypeCount}</span>
        <span>TopActions: {snapshot.topActionCount}</span>
        <span>TargetOptions: {snapshot.targetTypeOptionCount}</span>
        <span>Filters: {snapshot.activeFilterCount}</span>
        <span>ActionFilter: {snapshot.actionFilter}</span>
        <span>TargetTypeFilter: {snapshot.targetTypeFilter}</span>
        <span>LatestAction: {snapshot.latestAction}</span>
        <span>LatestTarget: {snapshot.latestTargetType}</span>
        <span>LatestAt: {hasLatestAtLabel}</span>
        <span>CopyError: {hasCopyErrorLabel}</span>
        <span>UrlError: {hasUrlSyncErrorLabel}</span>
        <span>ClearFilters: {canClearFiltersLabel}</span>
        <span>CopyLink: {canCopyDiagnosticLinkLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
