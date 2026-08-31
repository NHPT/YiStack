'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { AdminProject } from '@/lib/admin/api';
import type { AdminCopy } from '@/lib/admin/i18n';
import { AdminDiagnosticSection, type AdminDiagnosticTone } from './admin-diagnostics-view';
import {
  buildAdminRuntimeHealthDiagnosticsSnapshot,
  AdminRuntimeHealthDiagnosticsSnapshotStrip,
} from './admin-runtime-health-diagnostics-snapshot';
import { useAdminDiagnosticLinkCopy } from './use-admin-diagnostic-link-copy';
import { useAdminDiagnosticUrlSync } from './use-admin-diagnostic-url-sync';
import {
  ADMIN_RUNTIME_HEALTH_PROJECT_QUERY_PARAM,
  ADMIN_RUNTIME_HEALTH_SEVERITY_QUERY_PARAM,
  ADMIN_RUNTIME_HEALTH_STATUS_QUERY_PARAM,
  clearAdminRuntimeHealthFilterSearch,
  deriveAdminRuntimeHealthActiveFilterSummary,
  deriveAdminRuntimeHealthDiagnosticsSummary,
  normalizeAdminRuntimeHealthProjectFilter,
  normalizeAdminRuntimeHealthSeverityFilter,
  normalizeAdminRuntimeHealthStatusFilter,
  type AdminRuntimeHealthActiveFilterSummary,
  type AdminRuntimeHealthDiagnosticsSummary,
  type AdminRuntimeHealthProjectFilter,
  type AdminRuntimeHealthProjectSummary,
  type AdminRuntimeHealthSeverityFilter,
  type AdminRuntimeHealthStatusFilter,
  updateAdminRuntimeHealthProjectSearch,
  updateAdminRuntimeHealthSeveritySearch,
  updateAdminRuntimeHealthStatusSearch,
} from './admin-runtime-health-diagnostics-model';

type AdminRuntimeHealthDiagnosticsCardProps = {
  copy: AdminCopy;
  projects: AdminProject[];
};

function runtimeTone(blockedCount: number, runningCount: number, unknownCount: number): AdminDiagnosticTone {
  if (blockedCount > 0) {
    return 'critical';
  }
  if (runningCount > 0 || unknownCount > 0) {
    return 'warning';
  }
  return 'success';
}

const runtimeSeverityOptions: AdminRuntimeHealthSeverityFilter[] = ['all', 'blocked', 'running', 'unknown', 'idle', 'ready'];
const runtimeStatusOptions: AdminRuntimeHealthStatusFilter[] = ['all', 'failed', 'preparing', 'starting', 'stopped', 'ready', 'unknown'];

function shouldRenderAdminRuntimeHealthFilteredEmpty(
  summary: AdminRuntimeHealthDiagnosticsSummary,
  activeFilterSummary: AdminRuntimeHealthActiveFilterSummary,
): boolean {
  const hasMatchedProjects = summary.projects.length > 0;
  const hasActiveFilters = activeFilterSummary.activeFilterCount > 0;
  return hasMatchedProjects === false && hasActiveFilters === true;
}

function getAdminRuntimeHealthActiveFilterLabelSuffix(summary: AdminRuntimeHealthActiveFilterSummary): string {
  const hasActiveLabels = summary.activeLabels.length > 0;
  return hasActiveLabels === true ? ` / ${summary.activeLabels.join(' / ')}` : '';
}

function getAdminRuntimeHealthRunningBadgeTone(summary: AdminRuntimeHealthDiagnosticsSummary): AdminDiagnosticTone {
  const hasRunningProjects = summary.runningCount > 0;
  if (hasRunningProjects === true) {
    return 'warning';
  }
  return 'neutral';
}

function getAdminRuntimeHealthBlockedBadgeTone(summary: AdminRuntimeHealthDiagnosticsSummary): AdminDiagnosticTone {
  const hasBlockedProjects = summary.blockedCount > 0;
  if (hasBlockedProjects === true) {
    return 'critical';
  }
  return 'neutral';
}

function getAdminRuntimeHealthEmptyMessage(summary: AdminRuntimeHealthDiagnosticsSummary, copy: AdminCopy): string | undefined {
  const hasProjects = summary.totalProjectCount > 0;
  if (hasProjects === true) {
    return undefined;
  }
  return copy.runtimeHealthEmpty;
}

function getAdminRuntimeHealthHealthyMessage(summary: AdminRuntimeHealthDiagnosticsSummary): string | undefined {
  const hasHealthyMessage = summary.healthyMessage.length > 0;
  if (hasHealthyMessage === false) {
    return undefined;
  }
  return summary.healthyMessage;
}

function getAdminRuntimeHealthFilterOptionLabel(option: string, copy: AdminCopy): string {
  const isAllOption = option === 'all';
  if (isAllOption === true) {
    return copy.runtimeHealthAll;
  }
  return option;
}

function getAdminRuntimeHealthDiagnosticLinkCopyActionLabel(isCopied: boolean, copy: AdminCopy): string {
  if (isCopied === true) {
    return copy.runtimeHealthDiagnosticLinkCopied;
  }
  return copy.runtimeHealthCopyDiagnosticLink;
}

function shouldRenderAdminRuntimeHealthPriorityProjects(summary: AdminRuntimeHealthDiagnosticsSummary): boolean {
  const priorityProjectCount = summary.priorityProjects.length;
  return priorityProjectCount > 0;
}

function shouldRenderAdminRuntimeHealthDiagnosticsContent(summary: AdminRuntimeHealthDiagnosticsSummary): boolean {
  const totalProjectCount = summary.totalProjectCount;
  return totalProjectCount > 0;
}

function shouldRenderAdminRuntimeHealthDiagnosticLinkCopyError(error: string | null): boolean {
  const hasError = error !== null && error.length > 0;
  return hasError === true;
}

function shouldRenderAdminRuntimeHealthDiagnosticUrlSyncError(error: string | null): boolean {
  const hasError = error !== null && error.length > 0;
  return hasError === true;
}

function shouldRenderAdminRuntimeHealthFocusedProject(summary: AdminRuntimeHealthDiagnosticsSummary): boolean {
  const hasFocusedProject = summary.focusedProject !== null;
  return hasFocusedProject === true;
}

function shouldRenderAdminRuntimeHealthProjectDrilldownMissing(
  summary: AdminRuntimeHealthDiagnosticsSummary,
  projectFilter: AdminRuntimeHealthProjectFilter,
): boolean {
  const hasFocusedProject = summary.focusedProject !== null;
  const hasProjectFilter = projectFilter !== 'all';
  return hasFocusedProject === false && hasProjectFilter === true;
}

function materializeAdminRuntimeHealthFilterOptionNodes(
  options: readonly string[],
  copy: AdminCopy,
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const option of options) {
    nodes.push(
      <option key={option} value={option}>{getAdminRuntimeHealthFilterOptionLabel(option, copy)}</option>,
    );
  }

  return nodes;
}

function materializeAdminRuntimeHealthProjectDrilldownOptionNodes(
  projects: readonly AdminRuntimeHealthProjectSummary[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const project of projects) {
    nodes.push(
      <option key={project.projectId} value={project.projectId}>
        {project.name} / {project.statusLabel} / persistence={project.persistenceLabel} / {project.updatedAtLabel}
      </option>,
    );
  }

  return nodes;
}

function materializeAdminRuntimeHealthPriorityProjectNodes(
  projects: readonly AdminRuntimeHealthProjectSummary[],
  copy: AdminCopy,
  onOpenProjectDrilldown: (projectFilter: AdminRuntimeHealthProjectFilter) => void,
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const project of projects) {
    nodes.push(
      <div key={project.projectId} className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 dark:border-gray-700 dark:bg-gray-950/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">{project.name}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {project.statusLabel} / {project.containerLabel} / persistence={project.persistenceLabel} / {project.updatedAtLabel}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {project.appType} / {project.phaseLabel}
        </p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{project.message}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">{copy.runtimeHealthNextAction}: </span>
          {project.nextAction}
        </p>
        <button
          type="button"
          onClick={() => onOpenProjectDrilldown(project.projectId)}
          className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {copy.runtimeHealthOpenProjectDrilldown}
        </button>
      </div>,
    );
  }

  return nodes;
}

export function AdminRuntimeHealthDiagnosticsCard({ copy, projects }: AdminRuntimeHealthDiagnosticsCardProps) {
  const [severityFilter, setSeverityFilter] = useState<AdminRuntimeHealthSeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<AdminRuntimeHealthStatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState<AdminRuntimeHealthProjectFilter>('all');
  const { diagnosticLinkCopied, diagnosticLinkCopyError, copyCurrentDiagnosticLink } = useAdminDiagnosticLinkCopy();
  const { diagnosticUrlSyncError, replaceUrlSearch } = useAdminDiagnosticUrlSync();

  const readSeverityFilterFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    return normalizeAdminRuntimeHealthSeverityFilter(
      new URLSearchParams(window.location.search).get(ADMIN_RUNTIME_HEALTH_SEVERITY_QUERY_PARAM),
    );
  }, []);

  const readStatusFilterFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    return normalizeAdminRuntimeHealthStatusFilter(
      new URLSearchParams(window.location.search).get(ADMIN_RUNTIME_HEALTH_STATUS_QUERY_PARAM),
    );
  }, []);

  const readProjectFilterFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    return normalizeAdminRuntimeHealthProjectFilter(
      new URLSearchParams(window.location.search).get(ADMIN_RUNTIME_HEALTH_PROJECT_QUERY_PARAM),
    );
  }, []);

  const updateSeverityFilter = useCallback((nextFilter: AdminRuntimeHealthSeverityFilter) => {
    setSeverityFilter(nextFilter);
    if (typeof window !== 'undefined') {
      replaceUrlSearch(updateAdminRuntimeHealthSeveritySearch(window.location.search, nextFilter));
    }
  }, [replaceUrlSearch]);

  const updateStatusFilter = useCallback((nextFilter: AdminRuntimeHealthStatusFilter) => {
    setStatusFilter(nextFilter);
    if (typeof window !== 'undefined') {
      replaceUrlSearch(updateAdminRuntimeHealthStatusSearch(window.location.search, nextFilter));
    }
  }, [replaceUrlSearch]);

  const updateProjectFilter = useCallback((nextFilter: AdminRuntimeHealthProjectFilter) => {
    setProjectFilter(nextFilter);
    if (typeof window !== 'undefined') {
      replaceUrlSearch(updateAdminRuntimeHealthProjectSearch(window.location.search, nextFilter));
    }
  }, [replaceUrlSearch]);

  const clearFilters = useCallback(() => {
    setSeverityFilter('all');
    setStatusFilter('all');
    setProjectFilter('all');
    if (typeof window !== 'undefined') {
      replaceUrlSearch(clearAdminRuntimeHealthFilterSearch(window.location.search));
    }
  }, [replaceUrlSearch]);

  useEffect(() => {
    setSeverityFilter(readSeverityFilterFromUrl());
    setStatusFilter(readStatusFilterFromUrl());
    setProjectFilter(readProjectFilterFromUrl());

    const handlePopState = () => {
      setSeverityFilter(readSeverityFilterFromUrl());
      setStatusFilter(readStatusFilterFromUrl());
      setProjectFilter(readProjectFilterFromUrl());
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [readProjectFilterFromUrl, readSeverityFilterFromUrl, readStatusFilterFromUrl]);

  const unfilteredSummary = useMemo(() => (
    deriveAdminRuntimeHealthDiagnosticsSummary(projects)
  ), [projects]);

  const summary = useMemo(() => (
    deriveAdminRuntimeHealthDiagnosticsSummary(projects, { severityFilter, statusFilter, projectFilter })
  ), [projectFilter, projects, severityFilter, statusFilter]);

  const activeFilterSummary = useMemo(() => (
    deriveAdminRuntimeHealthActiveFilterSummary(
      unfilteredSummary.projects,
      summary.projects,
      { severityFilter, statusFilter, projectFilter },
    )
  ), [projectFilter, severityFilter, statusFilter, summary.projects, unfilteredSummary.projects]);

  const tone = runtimeTone(summary.blockedCount, summary.runningCount, summary.unknownCount);
  const runningBadgeTone = getAdminRuntimeHealthRunningBadgeTone(summary);
  const blockedBadgeTone = getAdminRuntimeHealthBlockedBadgeTone(summary);
  const emptyMessage = getAdminRuntimeHealthEmptyMessage(summary, copy);
  const healthyMessage = getAdminRuntimeHealthHealthyMessage(summary);
  const shouldRenderFilteredEmpty = shouldRenderAdminRuntimeHealthFilteredEmpty(summary, activeFilterSummary);
  const activeFilterLabelSuffix = getAdminRuntimeHealthActiveFilterLabelSuffix(activeFilterSummary);
  const shouldRenderPriorityProjects = shouldRenderAdminRuntimeHealthPriorityProjects(summary);
  const shouldRenderDiagnosticsContent = shouldRenderAdminRuntimeHealthDiagnosticsContent(summary);
  const shouldRenderDiagnosticLinkCopyError = shouldRenderAdminRuntimeHealthDiagnosticLinkCopyError(diagnosticLinkCopyError);
  const shouldRenderDiagnosticUrlSyncError = shouldRenderAdminRuntimeHealthDiagnosticUrlSyncError(diagnosticUrlSyncError);
  const shouldRenderFocusedProject = shouldRenderAdminRuntimeHealthFocusedProject(summary);
  const shouldRenderProjectDrilldownMissing = shouldRenderAdminRuntimeHealthProjectDrilldownMissing(summary, projectFilter);
  const diagnosticLinkCopyActionLabel = getAdminRuntimeHealthDiagnosticLinkCopyActionLabel(diagnosticLinkCopied, copy);
  const adminRuntimeHealthDiagnosticsSnapshot = buildAdminRuntimeHealthDiagnosticsSnapshot({
    summary,
    activeFilterSummary,
    severityFilter,
    statusFilter,
    projectFilter,
    diagnosticLinkCopyError,
    diagnosticUrlSyncError,
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <AdminRuntimeHealthDiagnosticsSnapshotStrip snapshot={adminRuntimeHealthDiagnosticsSnapshot} />
      <AdminDiagnosticSection
        title={copy.runtimeHealthDiagnostics}
        tone={tone}
        badges={[
          { label: `${copy.runtimeHealthProjects}: ${summary.totalProjectCount}` },
          { label: `${copy.runtimeHealthObserved}: ${summary.observedRuntimeCount}`, tone: 'info' },
          { label: `${copy.runtimeHealthReady}: ${summary.readyCount}`, tone: 'success' },
          { label: `${copy.runtimeHealthRunning}: ${summary.runningCount}`, tone: runningBadgeTone },
          { label: `${copy.runtimeHealthBlocked}: ${summary.blockedCount}`, tone: blockedBadgeTone },
        ]}
        emptyMessage={emptyMessage}
        healthyMessage={healthyMessage}
      >
        {shouldRenderDiagnosticsContent === true && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {copy.runtimeHealthReadOnlyBoundary}
            </p>
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-gray-700 dark:bg-gray-950/20">
              <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                {copy.runtimeHealthSeverityFilter}
                <select
                  value={severityFilter}
                  onChange={(event) => updateSeverityFilter(event.target.value as AdminRuntimeHealthSeverityFilter)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  {materializeAdminRuntimeHealthFilterOptionNodes(runtimeSeverityOptions, copy)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                {copy.runtimeHealthStatusFilter}
                <select
                  value={statusFilter}
                  onChange={(event) => updateStatusFilter(event.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  {materializeAdminRuntimeHealthFilterOptionNodes(runtimeStatusOptions, copy)}
                </select>
              </label>
              <button
                type="button"
                onClick={clearFilters}
                disabled={adminRuntimeHealthDiagnosticsSnapshot.canClearFilters === false}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {copy.runtimeHealthClearFilters}
              </button>
              <button
                type="button"
                onClick={copyCurrentDiagnosticLink}
                disabled={adminRuntimeHealthDiagnosticsSnapshot.canCopyDiagnosticLink === false}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                {diagnosticLinkCopyActionLabel}
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {copy.runtimeHealthFilterSummary}: {activeFilterSummary.matchedProjectCount}/{activeFilterSummary.totalProjectCount}
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
            <div className="rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-gray-700 dark:bg-gray-950/20">
              <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                {copy.runtimeHealthProjectDrilldown}
                <select
                  value={projectFilter}
                  onChange={(event) => updateProjectFilter(event.target.value)}
                  className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  <option value="all">{copy.runtimeHealthProjectDrilldownAll}</option>
                  {materializeAdminRuntimeHealthProjectDrilldownOptionNodes(unfilteredSummary.projects)}
                </select>
              </label>
              {shouldRenderFocusedProject === true && summary.focusedProject !== null && (
                <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{summary.focusedProject.name}</span>
                    <span className="text-xs">{summary.focusedProject.statusLabel} / {summary.focusedProject.containerLabel}</span>
                  </div>
                  <p className="mt-1 text-xs">
                    {summary.focusedProject.projectId} / {summary.focusedProject.appType} / {summary.focusedProject.phaseLabel} / persistence={summary.focusedProject.persistenceLabel}
                  </p>
                  <p className="mt-2">{summary.focusedProject.message}</p>
                  <p className="mt-1 text-xs">
                    <span className="font-medium">{copy.runtimeHealthNextAction}: </span>
                    {summary.focusedProject.nextAction}
                  </p>
                  <p className="mt-1 text-xs">{copy.runtimeHealthUpdatedAt}: {summary.focusedProject.updatedAtLabel}</p>
                  <button
                    type="button"
                    onClick={() => updateProjectFilter('all')}
                    disabled={adminRuntimeHealthDiagnosticsSnapshot.canClearProjectDrilldown === false}
                    className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                  >
                    {copy.runtimeHealthClearProjectDrilldown}
                  </button>
                </div>
              )}
              {shouldRenderProjectDrilldownMissing === true && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{copy.runtimeHealthProjectDrilldownMissing}</p>
              )}
            </div>
            <div className="grid gap-2 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-5 dark:text-gray-300">
              <span>{copy.runtimeHealthReady}: {summary.readyCount}</span>
              <span>{copy.runtimeHealthRunning}: {summary.runningCount}</span>
              <span>{copy.runtimeHealthBlocked}: {summary.blockedCount}</span>
              <span>{copy.runtimeHealthIdle}: {summary.idleCount}</span>
              <span>{copy.runtimeHealthUnknown}: {summary.unknownCount}</span>
            </div>
            {shouldRenderPriorityProjects === true && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{copy.runtimeHealthPriorityProjects}</p>
                {materializeAdminRuntimeHealthPriorityProjectNodes(summary.priorityProjects, copy, updateProjectFilter)}
              </div>
            )}
            {shouldRenderFilteredEmpty === true && (
              <p className="rounded-lg border border-dashed border-gray-200 bg-white/60 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950/20 dark:text-gray-400">
                {copy.runtimeHealthFilteredEmpty}
              </p>
            )}
          </div>
        )}
      </AdminDiagnosticSection>
    </div>
  );
}
