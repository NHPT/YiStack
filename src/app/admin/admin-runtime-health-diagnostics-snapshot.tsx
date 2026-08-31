import type {
  AdminRuntimeHealthDiagnosticsSnapshot,
  AdminRuntimeHealthDiagnosticsSnapshotSource,
  AdminRuntimeHealthDiagnosticsSnapshotStatus,
  AdminRuntimeHealthDynamicFilterValue,
  AdminRuntimeHealthSeverityFilterValue,
} from '../workspace/workspace-types';
import type {
  AdminRuntimeHealthActiveFilterSummary,
  AdminRuntimeHealthDiagnosticsSummary,
  AdminRuntimeHealthProjectFilter,
  AdminRuntimeHealthSeverityFilter,
  AdminRuntimeHealthStatusFilter,
} from './admin-runtime-health-diagnostics-model';

function getAdminRuntimeHealthDiagnosticsProjectCount(
  summary: AdminRuntimeHealthDiagnosticsSummary,
): number {
  const hasProjects = Array.isArray(summary.projects) === true;
  return hasProjects === true ? summary.projects.length : 0;
}

function shouldRenderAdminRuntimeHealthDiagnosticsFilteredEmpty(
  summary: AdminRuntimeHealthDiagnosticsSummary,
  hasActiveFilters: boolean,
): boolean {
  const projectCount = getAdminRuntimeHealthDiagnosticsProjectCount(summary);
  const hasProjects = Array.isArray(summary.projects) === true && projectCount > 0;
  const shouldRenderFilteredEmpty = hasActiveFilters === true && hasProjects === false;
  return shouldRenderFilteredEmpty === true;
}

export function buildAdminRuntimeHealthDiagnosticsSnapshot({
  summary,
  activeFilterSummary,
  severityFilter,
  statusFilter,
  projectFilter,
  diagnosticLinkCopyError,
  diagnosticUrlSyncError,
}: {
  summary: AdminRuntimeHealthDiagnosticsSummary;
  activeFilterSummary: AdminRuntimeHealthActiveFilterSummary;
  severityFilter: AdminRuntimeHealthSeverityFilter;
  statusFilter: AdminRuntimeHealthStatusFilter;
  projectFilter: AdminRuntimeHealthProjectFilter;
  diagnosticLinkCopyError: string;
  diagnosticUrlSyncError: string;
}): AdminRuntimeHealthDiagnosticsSnapshot {
  const hasCopyError = diagnosticLinkCopyError.length > 0;
  const hasUrlSyncError = diagnosticUrlSyncError.length > 0;
  const hasFocusedProject = summary.focusedProject !== null;
  const hasActiveFilters = activeFilterSummary.activeFilterCount > 0;
  const hasIssues = summary.blockedCount > 0 || summary.runningCount > 0 || summary.unknownCount > 0;
  const canClearFilters = hasActiveFilters === true;
  const canCopyDiagnosticLink = true;
  const canClearProjectDrilldown = hasFocusedProject === true;
  const snapshotSeverityFilter: AdminRuntimeHealthSeverityFilterValue = severityFilter;
  const snapshotStatusFilter: AdminRuntimeHealthDynamicFilterValue = statusFilter;
  const snapshotProjectFilter: AdminRuntimeHealthDynamicFilterValue = projectFilter;
  const shouldRenderFilteredEmpty = shouldRenderAdminRuntimeHealthDiagnosticsFilteredEmpty(summary, hasActiveFilters);
  const status: AdminRuntimeHealthDiagnosticsSnapshotStatus = hasUrlSyncError === true
    ? 'url_sync_failed'
    : hasCopyError === true
      ? 'copy_failed'
      : hasFocusedProject === true
        ? 'focused'
        : shouldRenderFilteredEmpty === true
          ? 'filtered_empty'
          : hasActiveFilters === true
            ? 'filtered'
            : summary.totalProjectCount === 0
              ? 'empty'
              : hasIssues === true
                ? 'issue_detected'
                : 'healthy';
  const source: AdminRuntimeHealthDiagnosticsSnapshotSource = status === 'url_sync_failed'
    ? 'diagnostic_url'
    : status === 'copy_failed'
      ? 'diagnostic_link'
      : status === 'focused'
        ? 'runtime_project_drilldown'
        : status === 'filtered' || status === 'filtered_empty'
          ? 'runtime_filter'
          : 'runtime_projects';

  return {
    status,
    source,
    totalProjectCount: activeFilterSummary.totalProjectCount,
    matchedProjectCount: activeFilterSummary.matchedProjectCount,
    observedRuntimeCount: summary.observedRuntimeCount,
    readyCount: summary.readyCount,
    runningCount: summary.runningCount,
    blockedCount: summary.blockedCount,
    idleCount: summary.idleCount,
    unknownCount: summary.unknownCount,
    priorityProjectCount: summary.priorityProjects.length,
    activeFilterCount: activeFilterSummary.activeFilterCount,
    severityFilter: snapshotSeverityFilter,
    statusFilter: snapshotStatusFilter,
    projectFilter: snapshotProjectFilter,
    hasFocusedProject,
    hasCopyError,
    hasUrlSyncError,
    canClearFilters,
    canCopyDiagnosticLink,
    canClearProjectDrilldown,
    message: status === 'url_sync_failed'
      ? 'Admin Runtime Health 筛选已在卡片内生效，但地址栏同步失败。'
      : status === 'copy_failed'
        ? 'Admin Runtime Health 诊断链接复制失败。'
        : status === 'focused'
          ? 'Admin Runtime Health 正在展示单项目 drilldown。'
          : status === 'filtered_empty'
            ? 'Admin Runtime Health 当前筛选没有匹配项目。'
            : status === 'filtered'
              ? 'Admin Runtime Health 正在展示筛选后的 runtime 项目。'
              : status === 'empty'
                ? 'Admin Runtime Health 当前没有项目可诊断。'
                : status === 'issue_detected'
                  ? 'Admin Runtime Health 检测到阻断、运行中或未知 runtime 项目。'
                  : 'Admin Runtime Health 当前没有阻断、运行中或未知 runtime 项目。',
    recovery: status === 'url_sync_failed'
      ? '手动复制当前地址或重新选择筛选条件，避免分享旧诊断链接。'
      : status === 'copy_failed'
        ? '手动复制浏览器地址栏中的诊断 URL。'
        : status === 'focused'
          ? '查看项目详情和下一步动作，必要时清除项目 drilldown 回到总览。'
          : status === 'filtered_empty'
            ? '清除筛选或调整 severity/status/project 条件后重新查看。'
            : status === 'filtered'
              ? '可复制诊断链接共享当前筛选，或清除筛选回到全量项目。'
              : status === 'empty'
                ? '确认 Admin projects 只读接口是否返回可观测项目。'
                : status === 'issue_detected'
                  ? '优先查看 priority projects 和单项目 drilldown 的 next action。'
                  : '保持观察；可复制诊断链接用于运维协作。',
    updatedAt: 'derived',
  };
}

function getAdminRuntimeHealthDiagnosticsSnapshotClassName(snapshot: AdminRuntimeHealthDiagnosticsSnapshot) {
  if (snapshot.status === 'url_sync_failed' || snapshot.status === 'copy_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'issue_detected' || snapshot.status === 'filtered_empty') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  if (snapshot.status === 'focused' || snapshot.status === 'filtered') {
    return 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
  }
  if (snapshot.status === 'healthy') {
    return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
  }
  return 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300';
}

function getAdminRuntimeHealthDiagnosticsSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function AdminRuntimeHealthDiagnosticsSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminRuntimeHealthDiagnosticsSnapshot;
}) {
  const hasFocusedProjectLabel = getAdminRuntimeHealthDiagnosticsSnapshotBooleanLabel(snapshot.hasFocusedProject);
  const hasCopyErrorLabel = getAdminRuntimeHealthDiagnosticsSnapshotBooleanLabel(snapshot.hasCopyError);
  const hasUrlSyncErrorLabel = getAdminRuntimeHealthDiagnosticsSnapshotBooleanLabel(snapshot.hasUrlSyncError);
  const canClearFiltersLabel = getAdminRuntimeHealthDiagnosticsSnapshotBooleanLabel(snapshot.canClearFilters);
  const canCopyDiagnosticLinkLabel = getAdminRuntimeHealthDiagnosticsSnapshotBooleanLabel(
    snapshot.canCopyDiagnosticLink,
  );
  const canClearProjectDrilldownLabel = getAdminRuntimeHealthDiagnosticsSnapshotBooleanLabel(
    snapshot.canClearProjectDrilldown,
  );

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-runtime-health-diagnostics-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminRuntimeHealthDiagnosticsSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Runtime Health 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Total: {snapshot.totalProjectCount}</span>
        <span>Matched: {snapshot.matchedProjectCount}</span>
        <span>Observed: {snapshot.observedRuntimeCount}</span>
        <span>Ready: {snapshot.readyCount}</span>
        <span>Running: {snapshot.runningCount}</span>
        <span>Blocked: {snapshot.blockedCount}</span>
        <span>Idle: {snapshot.idleCount}</span>
        <span>Unknown: {snapshot.unknownCount}</span>
        <span>Priority: {snapshot.priorityProjectCount}</span>
        <span>Filters: {snapshot.activeFilterCount}</span>
        <span>SeverityFilter: {snapshot.severityFilter}</span>
        <span>StatusFilter: {snapshot.statusFilter}</span>
        <span>ProjectFilter: {snapshot.projectFilter}</span>
        <span>Focused: {hasFocusedProjectLabel}</span>
        <span>CopyError: {hasCopyErrorLabel}</span>
        <span>UrlError: {hasUrlSyncErrorLabel}</span>
        <span>ClearFilters: {canClearFiltersLabel}</span>
        <span>CopyLink: {canCopyDiagnosticLinkLabel}</span>
        <span>ClearProject: {canClearProjectDrilldownLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
