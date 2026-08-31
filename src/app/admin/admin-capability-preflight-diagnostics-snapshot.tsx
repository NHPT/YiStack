import type { CapabilityProviderPreflightResponse } from '@/lib/admin/api';

import type {
  AdminCapabilityPreflightDiagnosticsSnapshot,
  AdminCapabilityPreflightDiagnosticsSnapshotSource,
  AdminCapabilityPreflightDiagnosticsSnapshotStatus,
  AdminCapabilityPreflightDynamicFilterValue,
  AdminCapabilityPreflightSeverityFilterValue,
  AdminCapabilityPreflightStatusFilterValue,
  AdminCapabilityPreflightTimestampState,
} from '../workspace/workspace-types';
import type {
  CapabilityPreflightActiveFilterSummaryModel,
  CapabilityPreflightConfigKeyFilter,
  CapabilityPreflightConfigKeySummaryModel,
  CapabilityPreflightPrioritySummaryModel,
  CapabilityPreflightProviderSummaryModel,
  CapabilityPreflightReasonCodeFilter,
  CapabilityPreflightReasonCodeSummaryModel,
  CapabilityPreflightSeverityFilter,
  CapabilityPreflightSnapshotFreshnessModel,
  CapabilityPreflightStatusFilter,
} from './admin-capability-preflight-model';

function getAdminCapabilityPreflightDiagnosticsItemCount(
  providerPreflight: CapabilityProviderPreflightResponse | null,
): number {
  const hasProviderPreflight = providerPreflight !== null;
  return hasProviderPreflight === true ? providerPreflight.items.length : 0;
}

function hasAdminCapabilityPreflightDiagnosticsItems(
  providerPreflight: CapabilityProviderPreflightResponse | null,
): boolean {
  const itemCount = getAdminCapabilityPreflightDiagnosticsItemCount(providerPreflight);
  const hasItems = providerPreflight !== null && Array.isArray(providerPreflight.items) === true && itemCount > 0;
  return hasItems === true;
}

export function buildAdminCapabilityPreflightDiagnosticsSnapshot({
  providerPreflight,
  activeFilterSummary,
  prioritySummary,
  providerSummary,
  configKeySummary,
  reasonCodeSummary,
  snapshotFreshness,
  statusFilter,
  severityFilter,
  configKeyFilter,
  reasonCodeFilter,
  diagnosticLinkCopyError,
  diagnosticUrlSyncError,
}: {
  providerPreflight: CapabilityProviderPreflightResponse | null;
  activeFilterSummary: CapabilityPreflightActiveFilterSummaryModel;
  prioritySummary: CapabilityPreflightPrioritySummaryModel;
  providerSummary: CapabilityPreflightProviderSummaryModel;
  configKeySummary: CapabilityPreflightConfigKeySummaryModel;
  reasonCodeSummary: CapabilityPreflightReasonCodeSummaryModel;
  snapshotFreshness: CapabilityPreflightSnapshotFreshnessModel;
  statusFilter: CapabilityPreflightStatusFilter;
  severityFilter: CapabilityPreflightSeverityFilter;
  configKeyFilter: CapabilityPreflightConfigKeyFilter;
  reasonCodeFilter: CapabilityPreflightReasonCodeFilter;
  diagnosticLinkCopyError: string;
  diagnosticUrlSyncError: string;
}): AdminCapabilityPreflightDiagnosticsSnapshot {
  const hasCopyError = diagnosticLinkCopyError.length > 0;
  const hasUrlSyncError = diagnosticUrlSyncError.length > 0;
  const hasActiveFilters = activeFilterSummary.activeFilterCount > 0;
  const hasIssues = prioritySummary.criticalCount > 0 || prioritySummary.warningCount > 0 || providerSummary.blockedProviderCount > 0;
  const canClearFilters = hasActiveFilters === true;
  const canCopyDiagnosticLink = true;
  const snapshotStatusFilter: AdminCapabilityPreflightStatusFilterValue = statusFilter;
  const snapshotSeverityFilter: AdminCapabilityPreflightSeverityFilterValue = severityFilter;
  const snapshotConfigKeyFilter: AdminCapabilityPreflightDynamicFilterValue = configKeyFilter;
  const snapshotReasonCodeFilter: AdminCapabilityPreflightDynamicFilterValue = reasonCodeFilter;
  const snapshotTimestampState: AdminCapabilityPreflightTimestampState = snapshotFreshness.timestampState;
  const hasGeneratedAt = snapshotTimestampState === 'available';
  const hasPreflightItems = hasAdminCapabilityPreflightDiagnosticsItems(providerPreflight);
  const status: AdminCapabilityPreflightDiagnosticsSnapshotStatus = hasUrlSyncError === true
    ? 'url_sync_failed'
    : hasCopyError === true
      ? 'copy_failed'
      : snapshotTimestampState === 'invalid'
        ? 'invalid_timestamp'
        : providerPreflight === null
          ? 'unavailable'
          : hasPreflightItems === false
            ? 'empty'
            : hasActiveFilters === true && activeFilterSummary.matchedItemCount === 0
              ? 'filtered_empty'
              : hasActiveFilters === true
                ? 'filtered'
                : hasIssues === true
                  ? 'issue_detected'
                  : 'healthy';
  const source: AdminCapabilityPreflightDiagnosticsSnapshotSource = status === 'url_sync_failed'
    ? 'diagnostic_url'
    : status === 'copy_failed'
      ? 'diagnostic_link'
      : status === 'filtered' || status === 'filtered_empty'
        ? 'provider_preflight_filter'
        : status === 'invalid_timestamp'
          ? 'provider_preflight_snapshot'
          : 'provider_preflight';

  return {
    status,
    source,
    totalItemCount: activeFilterSummary.totalItemCount,
    matchedItemCount: activeFilterSummary.matchedItemCount,
    providerCount: providerSummary.providerCount,
    blockedProviderCount: providerSummary.blockedProviderCount,
    readyProviderCount: providerSummary.readyProviderCount,
    skippedProviderCount: providerSummary.skippedProviderCount,
    criticalCount: prioritySummary.criticalCount,
    warningCount: prioritySummary.warningCount,
    infoCount: prioritySummary.infoCount,
    affectedConfigKeyCount: configKeySummary.affectedKeyCount,
    affectedReasonCodeCount: reasonCodeSummary.affectedReasonCodeCount,
    activeFilterCount: activeFilterSummary.activeFilterCount,
    statusFilter: snapshotStatusFilter,
    severityFilter: snapshotSeverityFilter,
    configKeyFilter: snapshotConfigKeyFilter,
    reasonCodeFilter: snapshotReasonCodeFilter,
    timestampState: snapshotTimestampState,
    hasGeneratedAt,
    hasCopyError,
    hasUrlSyncError,
    canClearFilters,
    canCopyDiagnosticLink,
    message: status === 'url_sync_failed'
      ? 'Admin Capability Preflight 筛选已在卡片内生效，但地址栏同步失败。'
      : status === 'copy_failed'
        ? 'Admin Capability Preflight 诊断链接复制失败。'
        : status === 'invalid_timestamp'
          ? 'Admin Capability Preflight 快照时间戳不可解析。'
          : status === 'unavailable'
            ? 'Admin Capability Preflight 当前没有可用启动快照。'
            : status === 'empty'
              ? 'Admin Capability Preflight 启动快照没有预检项。'
              : status === 'filtered_empty'
                ? 'Admin Capability Preflight 当前筛选没有匹配预检项。'
                : status === 'filtered'
                  ? 'Admin Capability Preflight 正在展示筛选后的预检项。'
                  : status === 'issue_detected'
                    ? 'Admin Capability Preflight 检测到阻断或警告预检项。'
                    : 'Admin Capability Preflight 当前没有阻断或警告预检项。',
    recovery: status === 'url_sync_failed'
      ? '手动复制当前地址或重新选择筛选条件，避免分享旧诊断链接。'
      : status === 'copy_failed'
        ? '手动复制浏览器地址栏中的诊断 URL。'
        : status === 'invalid_timestamp'
          ? '检查 provider preflight generated_at 来源，必要时按既定流程刷新后端快照。'
          : status === 'unavailable'
            ? '确认 capability/provider-preflight 只读接口是否返回快照。'
            : status === 'empty'
              ? '确认 provider preflight 规则是否已加载；本卡片不会重新执行预检。'
              : status === 'filtered_empty'
                ? '清除筛选或调整 status/severity/config_key/reason_code 条件后重新查看。'
                : status === 'filtered'
                  ? '可复制诊断链接共享当前筛选，或清除筛选回到完整启动快照。'
                  : status === 'issue_detected'
                    ? '优先查看 critical/warning、provider 总览、config key 和 reason_code 小抄。'
                    : '保持观察；可复制诊断链接用于运维协作。',
    updatedAt: 'derived',
  };
}

function getAdminCapabilityPreflightDiagnosticsSnapshotClassName(snapshot: AdminCapabilityPreflightDiagnosticsSnapshot) {
  if (snapshot.status === 'url_sync_failed' || snapshot.status === 'copy_failed' || snapshot.status === 'invalid_timestamp') {
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

function getAdminCapabilityPreflightDiagnosticsSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function AdminCapabilityPreflightDiagnosticsSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminCapabilityPreflightDiagnosticsSnapshot;
}) {
  const hasGeneratedAtLabel = getAdminCapabilityPreflightDiagnosticsSnapshotBooleanLabel(snapshot.hasGeneratedAt);
  const hasCopyErrorLabel = getAdminCapabilityPreflightDiagnosticsSnapshotBooleanLabel(snapshot.hasCopyError);
  const hasUrlSyncErrorLabel = getAdminCapabilityPreflightDiagnosticsSnapshotBooleanLabel(snapshot.hasUrlSyncError);
  const canClearFiltersLabel = getAdminCapabilityPreflightDiagnosticsSnapshotBooleanLabel(snapshot.canClearFilters);
  const canCopyDiagnosticLinkLabel = getAdminCapabilityPreflightDiagnosticsSnapshotBooleanLabel(
    snapshot.canCopyDiagnosticLink,
  );

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-capability-preflight-diagnostics-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminCapabilityPreflightDiagnosticsSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Capability Preflight 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Total: {snapshot.totalItemCount}</span>
        <span>Matched: {snapshot.matchedItemCount}</span>
        <span>Providers: {snapshot.providerCount}</span>
        <span>Blocked: {snapshot.blockedProviderCount}</span>
        <span>Ready: {snapshot.readyProviderCount}</span>
        <span>Skipped: {snapshot.skippedProviderCount}</span>
        <span>Critical: {snapshot.criticalCount}</span>
        <span>Warning: {snapshot.warningCount}</span>
        <span>Info: {snapshot.infoCount}</span>
        <span>ConfigKeys: {snapshot.affectedConfigKeyCount}</span>
        <span>ReasonCodes: {snapshot.affectedReasonCodeCount}</span>
        <span>Filters: {snapshot.activeFilterCount}</span>
        <span>StatusFilter: {snapshot.statusFilter}</span>
        <span>SeverityFilter: {snapshot.severityFilter}</span>
        <span>ConfigKeyFilter: {snapshot.configKeyFilter}</span>
        <span>ReasonCodeFilter: {snapshot.reasonCodeFilter}</span>
        <span>Timestamp: {snapshot.timestampState}</span>
        <span>GeneratedAt: {hasGeneratedAtLabel}</span>
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
