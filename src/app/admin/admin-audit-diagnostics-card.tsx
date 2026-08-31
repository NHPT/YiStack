'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { AuditLog } from '@/lib/admin/api';
import type { AdminCopy } from '@/lib/admin/i18n';
import {
  buildAdminAuditDiagnosticsSnapshot,
  AdminAuditDiagnosticsSnapshotStrip,
} from './admin-audit-diagnostics-snapshot';
import { AdminDiagnosticSection, type AdminDiagnosticTone } from './admin-diagnostics-view';
import { useAdminDiagnosticLinkCopy } from './use-admin-diagnostic-link-copy';
import { useAdminDiagnosticUrlSync } from './use-admin-diagnostic-url-sync';
import {
  ADMIN_AUDIT_ACTION_QUERY_PARAM,
  ADMIN_AUDIT_TARGET_TYPE_QUERY_PARAM,
  clearAdminAuditFilterSearch,
  deriveAdminAuditActiveFilterSummary,
  deriveAdminAuditDiagnosticsSummary,
  filterAdminAuditLogs,
  normalizeAdminAuditFilterValue,
  type AdminAuditActiveFilterSummary,
  type AdminAuditActionCountList,
  type AdminAuditDiagnosticsSummaryModel,
  type AdminAuditFilterValue,
  type AdminAuditTargetTypeCountList,
  updateAdminAuditActionSearch,
  updateAdminAuditTargetTypeSearch,
} from './admin-audit-diagnostics-model';

type AdminAuditDiagnosticsCardProps = {
  copy: AdminCopy;
  logs: AuditLog[];
};

function getAdminAuditDiagnosticsCardLabel(value: string | null): string {
  const hasValue = value !== null && value.length > 0;
  return hasValue === true ? value : '-';
}

function shouldRenderAdminAuditLatestContext(summary: AdminAuditDiagnosticsSummaryModel): boolean {
  const hasLatestAction = summary.latestAction !== null && summary.latestAction.length > 0;
  const hasLatestAt = summary.latestAt !== null && summary.latestAt.length > 0;
  return hasLatestAction === true && hasLatestAt === true;
}

function shouldRenderAdminAuditFilteredEmpty(
  filteredLogs: AuditLog[],
  activeFilterSummary: AdminAuditActiveFilterSummary,
): boolean {
  const hasFilteredLogs = filteredLogs.length > 0;
  const hasActiveFilters = activeFilterSummary.activeFilterCount > 0;
  return hasFilteredLogs === false && hasActiveFilters === true;
}

function getAdminAuditActiveFilterLabelSuffix(summary: AdminAuditActiveFilterSummary): string {
  const hasActiveLabels = summary.activeLabels.length > 0;
  return hasActiveLabels === true ? ` / ${summary.activeLabels.join(' / ')}` : '';
}

function getAdminAuditActionBadgeTone(summary: AdminAuditDiagnosticsSummaryModel): AdminDiagnosticTone {
  const hasActions = summary.actionCount > 0;
  if (hasActions === true) {
    return 'info';
  }
  return 'neutral';
}

function getAdminAuditEmptyMessage(summary: AdminAuditDiagnosticsSummaryModel, copy: AdminCopy): string | undefined {
  const hasLogs = summary.totalLogCount > 0;
  if (hasLogs === true) {
    return undefined;
  }
  return copy.emptyAudit;
}

function getAdminAuditDiagnosticLinkCopyActionLabel(isCopied: boolean, copy: AdminCopy): string {
  if (isCopied === true) {
    return copy.auditDiagnosticsDiagnosticLinkCopied;
  }
  return copy.auditDiagnosticsCopyDiagnosticLink;
}

function shouldRenderAdminAuditTopActions(summary: AdminAuditDiagnosticsSummaryModel): boolean {
  const topActionCount = summary.topActions.length;
  return topActionCount > 0;
}

function shouldRenderAdminAuditTargetTypes(summary: AdminAuditDiagnosticsSummaryModel): boolean {
  const targetTypeCount = summary.targetTypes.length;
  return targetTypeCount > 0;
}

function shouldRenderAdminAuditDiagnosticsContent(summary: AdminAuditDiagnosticsSummaryModel): boolean {
  const totalLogCount = summary.totalLogCount;
  return totalLogCount > 0;
}

function shouldRenderAdminAuditDiagnosticLinkCopyError(error: string | null): boolean {
  const hasError = error !== null && error.length > 0;
  return hasError === true;
}

function shouldRenderAdminAuditDiagnosticUrlSyncError(error: string | null): boolean {
  const hasError = error !== null && error.length > 0;
  return hasError === true;
}

function materializeAdminAuditActionOptionNodes(items: AdminAuditActionCountList): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const item of items) {
    nodes.push(
      <option key={item.action} value={item.action}>{item.action}</option>,
    );
  }

  return nodes;
}

function materializeAdminAuditTargetTypeOptionNodes(items: AdminAuditTargetTypeCountList): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const item of items) {
    nodes.push(
      <option key={item.targetType} value={item.targetType}>{item.targetType}</option>,
    );
  }

  return nodes;
}

function getAdminAuditTopActionSummaryLabel(items: AdminAuditActionCountList): string {
  const segments: string[] = [];

  for (const item of items) {
    segments.push(`${item.action} (${item.count})`);
  }

  return segments.join(', ');
}

function getAdminAuditTargetTypeSummaryLabel(items: AdminAuditTargetTypeCountList): string {
  const segments: string[] = [];

  for (const item of items) {
    segments.push(`${item.targetType} (${item.count})`);
  }

  return segments.join(', ');
}

function materializeAdminAuditDiagnosticLogNodes(logs: AuditLog[]): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const log of logs) {
    nodes.push(
      <div key={log.id} className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 dark:border-gray-700 dark:bg-gray-950/20">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-900 dark:text-white">{log.action}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{log.created_at}</span>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {log.target_type} / {getAdminAuditDiagnosticsCardLabel(log.target_id)} / {getAdminAuditDiagnosticsCardLabel(log.ip_address)}
        </p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{log.detail}</p>
      </div>,
    );
  }

  return nodes;
}

export function AdminAuditDiagnosticsCard({ copy, logs }: AdminAuditDiagnosticsCardProps) {
  const [actionFilter, setActionFilter] = useState<AdminAuditFilterValue>('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState<AdminAuditFilterValue>('all');
  const { diagnosticLinkCopied, diagnosticLinkCopyError, copyCurrentDiagnosticLink } = useAdminDiagnosticLinkCopy();
  const { diagnosticUrlSyncError, replaceUrlSearch } = useAdminDiagnosticUrlSync();

  const readActionFilterFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    return normalizeAdminAuditFilterValue(
      new URLSearchParams(window.location.search).get(ADMIN_AUDIT_ACTION_QUERY_PARAM),
    );
  }, []);

  const readTargetTypeFilterFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    return normalizeAdminAuditFilterValue(
      new URLSearchParams(window.location.search).get(ADMIN_AUDIT_TARGET_TYPE_QUERY_PARAM),
    );
  }, []);

  const updateActionFilter = useCallback((nextFilter: AdminAuditFilterValue) => {
    setActionFilter(nextFilter);
    if (typeof window !== 'undefined') {
      replaceUrlSearch(updateAdminAuditActionSearch(window.location.search, nextFilter));
    }
  }, [replaceUrlSearch]);

  const updateTargetTypeFilter = useCallback((nextFilter: AdminAuditFilterValue) => {
    setTargetTypeFilter(nextFilter);
    if (typeof window !== 'undefined') {
      replaceUrlSearch(updateAdminAuditTargetTypeSearch(window.location.search, nextFilter));
    }
  }, [replaceUrlSearch]);

  const clearFilters = useCallback(() => {
    setActionFilter('all');
    setTargetTypeFilter('all');
    if (typeof window !== 'undefined') {
      replaceUrlSearch(clearAdminAuditFilterSearch(window.location.search));
    }
  }, [replaceUrlSearch]);

  useEffect(() => {
    setActionFilter(readActionFilterFromUrl());
    setTargetTypeFilter(readTargetTypeFilterFromUrl());

    const handlePopState = () => {
      setActionFilter(readActionFilterFromUrl());
      setTargetTypeFilter(readTargetTypeFilterFromUrl());
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [readActionFilterFromUrl, readTargetTypeFilterFromUrl]);

  const unfilteredSummary = useMemo(() => deriveAdminAuditDiagnosticsSummary(logs), [logs]);
  const filteredLogs = useMemo(() => (
    filterAdminAuditLogs(logs, { actionFilter, targetTypeFilter })
  ), [actionFilter, logs, targetTypeFilter]);
  const summary = useMemo(() => deriveAdminAuditDiagnosticsSummary(filteredLogs), [filteredLogs]);
  const activeFilterSummary = useMemo(() => (
    deriveAdminAuditActiveFilterSummary(logs, filteredLogs, { actionFilter, targetTypeFilter })
  ), [actionFilter, filteredLogs, logs, targetTypeFilter]);
  const shouldRenderLatestContext = shouldRenderAdminAuditLatestContext(summary);
  const shouldRenderFilteredEmpty = shouldRenderAdminAuditFilteredEmpty(filteredLogs, activeFilterSummary);
  const activeFilterLabelSuffix = getAdminAuditActiveFilterLabelSuffix(activeFilterSummary);
  const actionBadgeTone = getAdminAuditActionBadgeTone(summary);
  const emptyMessage = getAdminAuditEmptyMessage(unfilteredSummary, copy);
  const shouldRenderTopActions = shouldRenderAdminAuditTopActions(summary);
  const shouldRenderTargetTypes = shouldRenderAdminAuditTargetTypes(summary);
  const shouldRenderDiagnosticsContent = shouldRenderAdminAuditDiagnosticsContent(unfilteredSummary);
  const shouldRenderDiagnosticLinkCopyError = shouldRenderAdminAuditDiagnosticLinkCopyError(diagnosticLinkCopyError);
  const shouldRenderDiagnosticUrlSyncError = shouldRenderAdminAuditDiagnosticUrlSyncError(diagnosticUrlSyncError);
  const diagnosticLinkCopyActionLabel = getAdminAuditDiagnosticLinkCopyActionLabel(diagnosticLinkCopied, copy);
  const topActionSummaryLabel = getAdminAuditTopActionSummaryLabel(summary.topActions);
  const targetTypeSummaryLabel = getAdminAuditTargetTypeSummaryLabel(summary.targetTypes);
  const adminAuditDiagnosticsSnapshot = buildAdminAuditDiagnosticsSnapshot({
    summary,
    unfilteredSummary,
    activeFilterSummary,
    actionFilter,
    targetTypeFilter,
    diagnosticLinkCopyError,
    diagnosticUrlSyncError,
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <AdminAuditDiagnosticsSnapshotStrip snapshot={adminAuditDiagnosticsSnapshot} />
      <AdminDiagnosticSection
        title={copy.recentAudit}
        badges={[
          { label: `${copy.auditDiagnosticsLogs}: ${summary.totalLogCount}` },
          { label: `${copy.auditDiagnosticsActions}: ${summary.actionCount}`, tone: actionBadgeTone },
          { label: `${copy.auditDiagnosticsTargets}: ${summary.targetTypeCount}` },
        ]}
        emptyMessage={emptyMessage}
      >
        {shouldRenderDiagnosticsContent === true && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{copy.auditDiagnosticsReadOnlyBoundary}</p>
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-gray-700 dark:bg-gray-950/20">
              <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                {copy.auditDiagnosticsActionFilter}
                <select
                  value={actionFilter}
                  onChange={(event) => updateActionFilter(event.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  <option value="all">{copy.auditDiagnosticsAll}</option>
                  {materializeAdminAuditActionOptionNodes(unfilteredSummary.topActions)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                {copy.auditDiagnosticsTargetTypeFilter}
                <select
                  value={targetTypeFilter}
                  onChange={(event) => updateTargetTypeFilter(event.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  <option value="all">{copy.auditDiagnosticsAll}</option>
                  {materializeAdminAuditTargetTypeOptionNodes(unfilteredSummary.targetTypes)}
                </select>
              </label>
              <button
                type="button"
                onClick={clearFilters}
                disabled={adminAuditDiagnosticsSnapshot.canClearFilters === false}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {copy.auditDiagnosticsClearFilters}
              </button>
              <button
                type="button"
                onClick={copyCurrentDiagnosticLink}
                disabled={adminAuditDiagnosticsSnapshot.canCopyDiagnosticLink === false}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                {diagnosticLinkCopyActionLabel}
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {copy.auditDiagnosticsFilterSummary}: {activeFilterSummary.matchedLogCount}/{activeFilterSummary.totalLogCount}
                {activeFilterLabelSuffix}
              </span>
              {shouldRenderDiagnosticLinkCopyError === true && (
                <span role="status" className="text-xs text-red-600 dark:text-red-300">
                  {diagnosticLinkCopyError}
                </span>
              )}
              {shouldRenderDiagnosticUrlSyncError === true && (
                <span role="status" className="text-xs text-red-600 dark:text-red-300">
                  {diagnosticUrlSyncError}
                </span>
              )}
            </div>
            {shouldRenderLatestContext === true && (
              <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
                <span className="font-medium">{copy.auditDiagnosticsLatest}: </span>
                {summary.latestAction} / {summary.latestAt}
              </p>
            )}
            {shouldRenderTopActions === true && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">{copy.auditDiagnosticsTopActions}: </span>
                {topActionSummaryLabel}
              </p>
            )}
            {shouldRenderTargetTypes === true && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">{copy.auditDiagnosticsTargetTypes}: </span>
                {targetTypeSummaryLabel}
              </p>
            )}
            <div className="space-y-3">
              {materializeAdminAuditDiagnosticLogNodes(filteredLogs)}
            </div>
            {shouldRenderFilteredEmpty === true && (
              <p className="rounded-lg border border-dashed border-gray-200 bg-white/60 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950/20 dark:text-gray-400">
                {copy.auditDiagnosticsFilteredEmpty}
              </p>
            )}
          </div>
        )}
      </AdminDiagnosticSection>
    </div>
  );
}
