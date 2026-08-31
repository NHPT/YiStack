import type { ReactNode } from 'react';

import type {
  AdminDashboardDiagnosticsLayoutSnapshot,
  AdminDashboardDiagnosticsLayoutSnapshotSource,
  AdminDashboardDiagnosticsLayoutSnapshotStatus,
} from '../workspace/workspace-types';
import type { AdminDashboardHealthSummary } from './admin-dashboard-health-summary-model';

function hasDiagnosticsNode(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false;
}

function countRenderedAdminDashboardDiagnosticsLayoutSections(sections: readonly boolean[]): number {
  let count = 0;

  for (const hasSection of sections) {
    if (hasSection === true) {
      count += 1;
    }
  }

  return count;
}

export function buildAdminDashboardDiagnosticsLayoutSnapshot({
  healthSummary,
  priorityDiagnostics,
  runtimeDiagnostics,
  configDiagnostics,
  auditDiagnostics,
}: {
  healthSummary: AdminDashboardHealthSummary;
  priorityDiagnostics: ReactNode;
  runtimeDiagnostics: ReactNode;
  configDiagnostics: ReactNode;
  auditDiagnostics: ReactNode;
}): AdminDashboardDiagnosticsLayoutSnapshot {
  const hasPriorityDiagnostics = hasDiagnosticsNode(priorityDiagnostics);
  const hasRuntimeDiagnostics = hasDiagnosticsNode(runtimeDiagnostics);
  const hasConfigDiagnostics = hasDiagnosticsNode(configDiagnostics);
  const hasAuditDiagnostics = hasDiagnosticsNode(auditDiagnostics);
  const renderedSectionCount = countRenderedAdminDashboardDiagnosticsLayoutSections([
    hasPriorityDiagnostics,
    hasRuntimeDiagnostics,
    hasConfigDiagnostics,
    hasAuditDiagnostics,
  ]);
  const allSectionsReady = renderedSectionCount === 4;
  const hasOperationalSignals = healthSummary.blockerCount > 0
    || healthSummary.warningCount > 0
    || healthSummary.pendingCount > 0;
  const hasPriorityIssues = healthSummary.priorityIssues.length > 0;
  const hasRunbookItems = healthSummary.runbookItems.length > 0;
  const hasFocusSections = healthSummary.focusSections.length > 0;
  const hasAuditSignals = healthSummary.auditSignalCount > 0;
  const canNavigatePriority = hasPriorityDiagnostics === true;
  const canNavigateRuntime = hasRuntimeDiagnostics === true;
  const canNavigateConfig = hasConfigDiagnostics === true;
  const canNavigateAudit = hasAuditDiagnostics === true;
  const status: AdminDashboardDiagnosticsLayoutSnapshotStatus = allSectionsReady === false
    ? 'not_ready'
    : healthSummary.blockerCount > 0
      ? 'critical'
      : healthSummary.warningCount > 0 || healthSummary.pendingCount > 0
        ? 'warning'
        : hasAuditSignals === true
          ? 'audit_only'
          : healthSummary.tone === 'success'
            ? 'healthy'
            : 'ready';
  const source: AdminDashboardDiagnosticsLayoutSnapshotSource = hasPriorityIssues === true
    ? 'priority_issues'
    : hasRunbookItems === true
      ? 'runbook'
      : hasFocusSections === true
        ? 'focus_sections'
        : hasOperationalSignals === true || hasAuditSignals === true
          ? 'health_summary'
          : 'diagnostics_layout';

  return {
    status,
    source,
    sectionCount: 4,
    renderedSectionCount,
    focusSectionCount: healthSummary.focusSections.length,
    runbookItemCount: healthSummary.runbookItems.length,
    priorityIssueCount: healthSummary.priorityIssues.length,
    blockerCount: healthSummary.blockerCount,
    warningCount: healthSummary.warningCount,
    pendingCount: healthSummary.pendingCount,
    auditSignalCount: healthSummary.auditSignalCount,
    hasPriorityDiagnostics,
    hasRuntimeDiagnostics,
    hasConfigDiagnostics,
    hasAuditDiagnostics,
    canNavigatePriority,
    canNavigateRuntime,
    canNavigateConfig,
    canNavigateAudit,
    message: status === 'not_ready'
      ? 'Admin Diagnostics Layout 仍缺少部分诊断分组。'
      : status === 'critical'
        ? 'Admin Diagnostics Layout 检测到需要优先处理的阻断信号。'
        : status === 'warning'
          ? 'Admin Diagnostics Layout 检测到告警或待处理线索。'
          : status === 'audit_only'
            ? 'Admin Diagnostics Layout 当前主要是审计上下文信号。'
            : status === 'healthy'
              ? 'Admin Diagnostics Layout 当前四个诊断分组均已就绪且无阻断告警。'
              : 'Admin Diagnostics Layout 四个诊断分组已就绪，等待更多诊断快照判断健康状态。',
    recovery: status === 'not_ready'
      ? '确认 Provider Health、Runtime Health、Capability Preflight 和 Audit 四个诊断卡片均已挂载。'
      : status === 'critical'
        ? '先进入 Priority 或 Config 诊断分组处理阻断，再回看 Runtime 和 Audit。'
        : status === 'warning'
          ? '按 Focus Areas 或 Runbook 的锚点顺序处理 warning、pending 和 drift。'
          : status === 'audit_only'
            ? '结合 Audit 分组确认最近操作是否解释当前系统状态。'
            : status === 'healthy'
              ? '保持观察；可继续使用四个诊断分组进行只读运维协作。'
              : '等待 provider、runtime、preflight 快照补齐后再判断总体健康。',
    updatedAt: 'derived',
  };
}

function getAdminDashboardDiagnosticsLayoutSnapshotClassName(snapshot: AdminDashboardDiagnosticsLayoutSnapshot) {
  if (snapshot.status === 'critical' || snapshot.status === 'not_ready') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'warning') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  if (snapshot.status === 'audit_only' || snapshot.status === 'ready') {
    return 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

function getAdminDashboardDiagnosticsLayoutSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function AdminDashboardDiagnosticsLayoutSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminDashboardDiagnosticsLayoutSnapshot;
}) {
  const hasPriorityDiagnosticsLabel = getAdminDashboardDiagnosticsLayoutSnapshotBooleanLabel(
    snapshot.hasPriorityDiagnostics,
  );
  const hasRuntimeDiagnosticsLabel = getAdminDashboardDiagnosticsLayoutSnapshotBooleanLabel(
    snapshot.hasRuntimeDiagnostics,
  );
  const hasConfigDiagnosticsLabel = getAdminDashboardDiagnosticsLayoutSnapshotBooleanLabel(
    snapshot.hasConfigDiagnostics,
  );
  const hasAuditDiagnosticsLabel = getAdminDashboardDiagnosticsLayoutSnapshotBooleanLabel(snapshot.hasAuditDiagnostics);
  const canNavigatePriorityLabel = getAdminDashboardDiagnosticsLayoutSnapshotBooleanLabel(snapshot.canNavigatePriority);
  const canNavigateRuntimeLabel = getAdminDashboardDiagnosticsLayoutSnapshotBooleanLabel(snapshot.canNavigateRuntime);
  const canNavigateConfigLabel = getAdminDashboardDiagnosticsLayoutSnapshotBooleanLabel(snapshot.canNavigateConfig);
  const canNavigateAuditLabel = getAdminDashboardDiagnosticsLayoutSnapshotBooleanLabel(snapshot.canNavigateAudit);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-dashboard-diagnostics-layout-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminDashboardDiagnosticsLayoutSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Diagnostics Layout 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Sections: {snapshot.renderedSectionCount}/{snapshot.sectionCount}</span>
        <span>Focus: {snapshot.focusSectionCount}</span>
        <span>Runbook: {snapshot.runbookItemCount}</span>
        <span>PriorityIssues: {snapshot.priorityIssueCount}</span>
        <span>Blockers: {snapshot.blockerCount}</span>
        <span>Warnings: {snapshot.warningCount}</span>
        <span>Pending: {snapshot.pendingCount}</span>
        <span>AuditSignals: {snapshot.auditSignalCount}</span>
        <span>Priority: {hasPriorityDiagnosticsLabel}</span>
        <span>Runtime: {hasRuntimeDiagnosticsLabel}</span>
        <span>Config: {hasConfigDiagnosticsLabel}</span>
        <span>Audit: {hasAuditDiagnosticsLabel}</span>
        <span>NavPriority: {canNavigatePriorityLabel}</span>
        <span>NavRuntime: {canNavigateRuntimeLabel}</span>
        <span>NavConfig: {canNavigateConfigLabel}</span>
        <span>NavAudit: {canNavigateAuditLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
