import type {
  AdminProviderHealthDiagnosticsSnapshot,
  AdminProviderHealthDiagnosticsSnapshotSource,
  AdminProviderHealthDiagnosticsSnapshotStatus,
  AdminProviderHealthRuntimeFilterValue,
  AdminProviderHealthSeverityFilterValue,
} from '../workspace/workspace-types';
import type {
  AdminProviderHealthActiveFilterSummary,
  AdminProviderHealthDiagnosticsSummary,
  AdminProviderHealthRuntimeFilter,
  AdminProviderHealthSeverityFilter,
} from './admin-provider-health-diagnostics-model';

function getAdminProviderHealthDiagnosticsProviderSummaryCount(
  summary: AdminProviderHealthDiagnosticsSummary,
): number {
  const hasProviderSummaries = Array.isArray(summary.providerSummaries) === true;
  return hasProviderSummaries === true ? summary.providerSummaries.length : 0;
}

function shouldRenderAdminProviderHealthDiagnosticsFilteredEmpty(
  summary: AdminProviderHealthDiagnosticsSummary,
  hasActiveFilters: boolean,
): boolean {
  const providerSummaryCount = getAdminProviderHealthDiagnosticsProviderSummaryCount(summary);
  const hasProviderSummaries = Array.isArray(summary.providerSummaries) === true && providerSummaryCount > 0;
  const shouldRenderFilteredEmpty = hasActiveFilters === true && hasProviderSummaries === false;
  return shouldRenderFilteredEmpty === true;
}

export function buildAdminProviderHealthDiagnosticsSnapshot({
  summary,
  activeFilterSummary,
  severityFilter,
  runtimeFilter,
  diagnosticLinkCopyError,
  diagnosticUrlSyncError,
}: {
  summary: AdminProviderHealthDiagnosticsSummary;
  activeFilterSummary: AdminProviderHealthActiveFilterSummary;
  severityFilter: AdminProviderHealthSeverityFilter;
  runtimeFilter: AdminProviderHealthRuntimeFilter;
  diagnosticLinkCopyError: string;
  diagnosticUrlSyncError: string;
}): AdminProviderHealthDiagnosticsSnapshot {
  const hasCopyError = diagnosticLinkCopyError.length > 0;
  const hasUrlSyncError = diagnosticUrlSyncError.length > 0;
  const hasActiveFilters = activeFilterSummary.activeFilterCount > 0;
  const hasIssues = summary.blockedCount > 0 || summary.warningCount > 0 || summary.driftCount > 0;
  const canClearFilters = hasActiveFilters === true;
  const canCopyDiagnosticLink = true;
  const snapshotSeverityFilter: AdminProviderHealthSeverityFilterValue = severityFilter;
  const snapshotRuntimeFilter: AdminProviderHealthRuntimeFilterValue = runtimeFilter;
  const hasRuntimeSummary = summary.driftCount > 0 || summary.loadedProviderCount > 0;
  const shouldRenderFilteredEmpty = shouldRenderAdminProviderHealthDiagnosticsFilteredEmpty(summary, hasActiveFilters);
  const status: AdminProviderHealthDiagnosticsSnapshotStatus = hasUrlSyncError === true
    ? 'url_sync_failed'
    : hasCopyError === true
      ? 'copy_failed'
      : shouldRenderFilteredEmpty === true
        ? 'filtered_empty'
        : hasActiveFilters === true
          ? 'filtered'
          : summary.totalProviderCount === 0
            ? 'empty'
            : hasIssues === true
              ? 'issue_detected'
              : 'healthy';
  const source: AdminProviderHealthDiagnosticsSnapshotSource = status === 'url_sync_failed'
    ? 'diagnostic_url'
    : status === 'copy_failed'
      ? 'diagnostic_link'
      : status === 'filtered' || status === 'filtered_empty'
        ? 'provider_filter'
        : hasRuntimeSummary === true
          ? 'provider_runtime'
          : 'provider_snapshot';

  return {
    status,
    source,
    totalProviderCount: activeFilterSummary.totalProviderCount,
    matchedProviderCount: activeFilterSummary.matchedProviderCount,
    enabledProviderCount: summary.enabledProviderCount,
    loadedProviderCount: summary.loadedProviderCount,
    driftCount: summary.driftCount,
    blockedCount: summary.blockedCount,
    warningCount: summary.warningCount,
    readyCount: summary.readyCount,
    idleCount: summary.idleCount,
    priorityProviderCount: summary.priorityProviders.length,
    activeFilterCount: activeFilterSummary.activeFilterCount,
    severityFilter: snapshotSeverityFilter,
    runtimeFilter: snapshotRuntimeFilter,
    defaultProviderName: summary.defaultProviderName,
    activeProviderName: summary.activeProviderName,
    hasCopyError,
    hasUrlSyncError,
    canClearFilters,
    canCopyDiagnosticLink,
    message: status === 'url_sync_failed'
      ? 'Admin Provider Health 筛选已在卡片内生效，但地址栏同步失败。'
      : status === 'copy_failed'
        ? 'Admin Provider Health 诊断链接复制失败。'
        : status === 'filtered_empty'
          ? 'Admin Provider Health 当前筛选没有匹配 Provider。'
          : status === 'filtered'
            ? 'Admin Provider Health 正在展示筛选后的 Provider 运行态。'
            : status === 'empty'
              ? 'Admin Provider Health 当前没有 Provider 可诊断。'
              : status === 'issue_detected'
                ? 'Admin Provider Health 检测到配置阻断、运行态漂移或警告 Provider。'
                : 'Admin Provider Health 当前没有明显配置态与运行态漂移。',
    recovery: status === 'url_sync_failed'
      ? '手动复制当前地址或重新选择筛选条件，避免分享旧诊断链接。'
      : status === 'copy_failed'
        ? '手动复制浏览器地址栏中的诊断 URL。'
        : status === 'filtered_empty'
          ? '清除筛选或调整 provider_health/provider_runtime 条件后重新查看。'
          : status === 'filtered'
            ? '可复制诊断链接共享当前筛选，或清除筛选回到全量 Provider。'
            : status === 'empty'
              ? '确认 LLM Provider 列表是否已初始化；本诊断不会创建或 reload Provider。'
              : status === 'issue_detected'
                ? '优先查看 priority providers 和 next action，再按既定 LLM 管理流程处理。'
                : '保持观察；可复制诊断链接用于运维协作。',
    updatedAt: 'derived',
  };
}

function getAdminProviderHealthDiagnosticsSnapshotClassName(snapshot: AdminProviderHealthDiagnosticsSnapshot) {
  if (snapshot.status === 'url_sync_failed' || snapshot.status === 'copy_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'issue_detected' || snapshot.status === 'filtered_empty') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  if (snapshot.status === 'filtered') {
    return 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
  }
  if (snapshot.status === 'healthy') {
    return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
  }
  return 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300';
}

function getAdminProviderHealthDiagnosticsSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function AdminProviderHealthDiagnosticsSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminProviderHealthDiagnosticsSnapshot;
}) {
  const hasCopyErrorLabel = getAdminProviderHealthDiagnosticsSnapshotBooleanLabel(snapshot.hasCopyError);
  const hasUrlSyncErrorLabel = getAdminProviderHealthDiagnosticsSnapshotBooleanLabel(snapshot.hasUrlSyncError);
  const canClearFiltersLabel = getAdminProviderHealthDiagnosticsSnapshotBooleanLabel(snapshot.canClearFilters);
  const canCopyDiagnosticLinkLabel = getAdminProviderHealthDiagnosticsSnapshotBooleanLabel(
    snapshot.canCopyDiagnosticLink,
  );

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-provider-health-diagnostics-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminProviderHealthDiagnosticsSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Provider Health 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Total: {snapshot.totalProviderCount}</span>
        <span>Matched: {snapshot.matchedProviderCount}</span>
        <span>Enabled: {snapshot.enabledProviderCount}</span>
        <span>Loaded: {snapshot.loadedProviderCount}</span>
        <span>Drift: {snapshot.driftCount}</span>
        <span>Blocked: {snapshot.blockedCount}</span>
        <span>Warning: {snapshot.warningCount}</span>
        <span>Ready: {snapshot.readyCount}</span>
        <span>Idle: {snapshot.idleCount}</span>
        <span>Priority: {snapshot.priorityProviderCount}</span>
        <span>Filters: {snapshot.activeFilterCount}</span>
        <span>SeverityFilter: {snapshot.severityFilter}</span>
        <span>RuntimeFilter: {snapshot.runtimeFilter}</span>
        <span>Default: {snapshot.defaultProviderName}</span>
        <span>Active: {snapshot.activeProviderName}</span>
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
