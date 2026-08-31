'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AdminLLMProvidersResponse } from '@/lib/admin/api';
import type { AdminCopy } from '@/lib/admin/i18n';
import { AdminDiagnosticSection, type AdminDiagnosticTone } from './admin-diagnostics-view';
import {
  buildAdminProviderHealthDiagnosticsSnapshot,
  AdminProviderHealthDiagnosticsSnapshotStrip,
} from './admin-provider-health-diagnostics-snapshot';
import { useAdminDiagnosticLinkCopy } from './use-admin-diagnostic-link-copy';
import { useAdminDiagnosticUrlSync } from './use-admin-diagnostic-url-sync';
import {
  ADMIN_PROVIDER_HEALTH_RUNTIME_QUERY_PARAM,
  ADMIN_PROVIDER_HEALTH_SEVERITY_QUERY_PARAM,
  clearAdminProviderHealthFilterSearch,
  deriveAdminProviderHealthActiveFilterSummary,
  deriveAdminProviderHealthDiagnosticsSummary,
  normalizeAdminProviderHealthRuntimeFilter,
  normalizeAdminProviderHealthSeverityFilter,
  type AdminProviderHealthActiveFilterSummary,
  type AdminProviderHealthDiagnosticsSummary,
  type AdminProviderHealthProviderSummary,
  type AdminProviderHealthRuntimeFilter,
  type AdminProviderHealthSeverityFilter,
  updateAdminProviderHealthRuntimeSearch,
  updateAdminProviderHealthSeveritySearch,
} from './admin-provider-health-diagnostics-model';

type AdminProviderHealthDiagnosticsCardProps = {
  copy: AdminCopy;
  snapshot: AdminLLMProvidersResponse | null;
};

function providerHealthTone(blockedCount: number, warningCount: number): AdminDiagnosticTone {
  if (blockedCount > 0) {
    return 'critical';
  }
  if (warningCount > 0) {
    return 'warning';
  }
  return 'success';
}

const providerHealthSeverityOptions: AdminProviderHealthSeverityFilter[] = ['all', 'blocked', 'warning', 'idle', 'ready'];
const providerHealthRuntimeOptions: AdminProviderHealthRuntimeFilter[] = ['all', 'loaded', 'not_loaded', 'active', 'inactive'];

function shouldRenderAdminProviderHealthFilteredEmpty(
  summary: AdminProviderHealthDiagnosticsSummary,
  activeFilterSummary: AdminProviderHealthActiveFilterSummary,
): boolean {
  const hasMatchedProviders = summary.providerSummaries.length > 0;
  const hasActiveFilters = activeFilterSummary.activeFilterCount > 0;
  return hasMatchedProviders === false && hasActiveFilters === true;
}

function getAdminProviderHealthActiveFilterLabelSuffix(summary: AdminProviderHealthActiveFilterSummary): string {
  const hasActiveLabels = summary.activeLabels.length > 0;
  return hasActiveLabels === true ? ` / ${summary.activeLabels.join(' / ')}` : '';
}

function getAdminProviderHealthDriftBadgeTone(summary: AdminProviderHealthDiagnosticsSummary): AdminDiagnosticTone {
  const hasDrift = summary.driftCount > 0;
  if (hasDrift === true) {
    return 'warning';
  }
  return 'neutral';
}

function getAdminProviderHealthBlockedBadgeTone(summary: AdminProviderHealthDiagnosticsSummary): AdminDiagnosticTone {
  const hasBlockedProviders = summary.blockedCount > 0;
  if (hasBlockedProviders === true) {
    return 'critical';
  }
  return 'neutral';
}

function getAdminProviderHealthEmptyMessage(summary: AdminProviderHealthDiagnosticsSummary, copy: AdminCopy): string | undefined {
  const hasProviders = summary.totalProviderCount > 0;
  if (hasProviders === true) {
    return undefined;
  }
  return copy.providerHealthEmpty;
}

function getAdminProviderHealthHealthyMessage(summary: AdminProviderHealthDiagnosticsSummary): string | undefined {
  const hasHealthyMessage = summary.healthyMessage.length > 0;
  if (hasHealthyMessage === false) {
    return undefined;
  }
  return summary.healthyMessage;
}

function getAdminProviderHealthFilterOptionLabel(option: string, copy: AdminCopy): string {
  const isAllOption = option === 'all';
  if (isAllOption === true) {
    return copy.providerHealthAll;
  }
  return option;
}

function getAdminProviderHealthDiagnosticLinkCopyActionLabel(isCopied: boolean, copy: AdminCopy): string {
  if (isCopied === true) {
    return copy.providerHealthDiagnosticLinkCopied;
  }
  return copy.providerHealthCopyDiagnosticLink;
}

function getAdminProviderHealthPriorityIdentityLabel(
  provider: AdminProviderHealthProviderSummary,
  copy: AdminCopy,
): string {
  if (provider.isDefault === true) {
    return copy.providerHealthDefaultBadge;
  }
  return provider.name;
}

function getAdminProviderHealthPriorityRuntimeLabel(
  provider: AdminProviderHealthProviderSummary,
  copy: AdminCopy,
): string {
  if (provider.isRuntimeLoaded === true) {
    return copy.providerHealthLoaded;
  }
  return copy.providerHealthNotLoaded;
}

function shouldRenderAdminProviderHealthPriorityProviders(summary: AdminProviderHealthDiagnosticsSummary): boolean {
  const priorityProviderCount = summary.priorityProviders.length;
  return priorityProviderCount > 0;
}

function shouldRenderAdminProviderHealthDiagnosticsContent(summary: AdminProviderHealthDiagnosticsSummary): boolean {
  const totalProviderCount = summary.totalProviderCount;
  return totalProviderCount > 0;
}

function shouldRenderAdminProviderHealthDiagnosticLinkCopyError(error: string | null): boolean {
  const hasError = error !== null && error.length > 0;
  return hasError === true;
}

function shouldRenderAdminProviderHealthDiagnosticUrlSyncError(error: string | null): boolean {
  const hasError = error !== null && error.length > 0;
  return hasError === true;
}

function materializeAdminProviderHealthFilterOptionNodes(
  options: readonly string[],
  copy: AdminCopy,
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const option of options) {
    nodes.push(
      <option key={option} value={option}>{getAdminProviderHealthFilterOptionLabel(option, copy)}</option>,
    );
  }

  return nodes;
}

function materializeAdminProviderHealthPriorityProviderNodes(
  providers: readonly AdminProviderHealthProviderSummary[],
  copy: AdminCopy,
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const provider of providers) {
    const providerIdentityLabel = getAdminProviderHealthPriorityIdentityLabel(provider, copy);
    const providerRuntimeLabel = getAdminProviderHealthPriorityRuntimeLabel(provider, copy);

    nodes.push(
      <div key={provider.id} className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 dark:border-gray-700 dark:bg-gray-950/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">{provider.displayName}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {providerIdentityLabel} / {providerRuntimeLabel}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {provider.model} / {provider.baseUrl}
        </p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{provider.message}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">{copy.providerHealthNextAction}: </span>
          {provider.nextAction}
        </p>
      </div>,
    );
  }

  return nodes;
}

export function AdminProviderHealthDiagnosticsCard({ copy, snapshot }: AdminProviderHealthDiagnosticsCardProps) {
  const [severityFilter, setSeverityFilter] = useState<AdminProviderHealthSeverityFilter>('all');
  const [runtimeFilter, setRuntimeFilter] = useState<AdminProviderHealthRuntimeFilter>('all');
  const { diagnosticLinkCopied, diagnosticLinkCopyError, copyCurrentDiagnosticLink } = useAdminDiagnosticLinkCopy();
  const { diagnosticUrlSyncError, replaceUrlSearch } = useAdminDiagnosticUrlSync();

  const readSeverityFilterFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    return normalizeAdminProviderHealthSeverityFilter(
      new URLSearchParams(window.location.search).get(ADMIN_PROVIDER_HEALTH_SEVERITY_QUERY_PARAM),
    );
  }, []);

  const readRuntimeFilterFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    return normalizeAdminProviderHealthRuntimeFilter(
      new URLSearchParams(window.location.search).get(ADMIN_PROVIDER_HEALTH_RUNTIME_QUERY_PARAM),
    );
  }, []);

  const updateSeverityFilter = useCallback((nextFilter: AdminProviderHealthSeverityFilter) => {
    setSeverityFilter(nextFilter);
    if (typeof window !== 'undefined') {
      replaceUrlSearch(updateAdminProviderHealthSeveritySearch(window.location.search, nextFilter));
    }
  }, [replaceUrlSearch]);

  const updateRuntimeFilter = useCallback((nextFilter: AdminProviderHealthRuntimeFilter) => {
    setRuntimeFilter(nextFilter);
    if (typeof window !== 'undefined') {
      replaceUrlSearch(updateAdminProviderHealthRuntimeSearch(window.location.search, nextFilter));
    }
  }, [replaceUrlSearch]);

  const clearFilters = useCallback(() => {
    setSeverityFilter('all');
    setRuntimeFilter('all');
    if (typeof window !== 'undefined') {
      replaceUrlSearch(clearAdminProviderHealthFilterSearch(window.location.search));
    }
  }, [replaceUrlSearch]);

  useEffect(() => {
    setSeverityFilter(readSeverityFilterFromUrl());
    setRuntimeFilter(readRuntimeFilterFromUrl());

    const handlePopState = () => {
      setSeverityFilter(readSeverityFilterFromUrl());
      setRuntimeFilter(readRuntimeFilterFromUrl());
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [readRuntimeFilterFromUrl, readSeverityFilterFromUrl]);

  const unfilteredSummary = useMemo(() => (
    deriveAdminProviderHealthDiagnosticsSummary(snapshot)
  ), [snapshot]);
  const summary = useMemo(() => (
    deriveAdminProviderHealthDiagnosticsSummary(snapshot, { severityFilter, runtimeFilter })
  ), [runtimeFilter, severityFilter, snapshot]);
  const activeFilterSummary = useMemo(() => (
    deriveAdminProviderHealthActiveFilterSummary(
      unfilteredSummary.providerSummaries,
      summary.providerSummaries,
      { severityFilter, runtimeFilter },
    )
  ), [runtimeFilter, severityFilter, summary.providerSummaries, unfilteredSummary.providerSummaries]);
  const tone = providerHealthTone(summary.blockedCount, summary.warningCount);
  const driftBadgeTone = getAdminProviderHealthDriftBadgeTone(summary);
  const blockedBadgeTone = getAdminProviderHealthBlockedBadgeTone(summary);
  const emptyMessage = getAdminProviderHealthEmptyMessage(summary, copy);
  const healthyMessage = getAdminProviderHealthHealthyMessage(summary);
  const shouldRenderFilteredEmpty = shouldRenderAdminProviderHealthFilteredEmpty(summary, activeFilterSummary);
  const activeFilterLabelSuffix = getAdminProviderHealthActiveFilterLabelSuffix(activeFilterSummary);
  const shouldRenderPriorityProviders = shouldRenderAdminProviderHealthPriorityProviders(summary);
  const shouldRenderDiagnosticsContent = shouldRenderAdminProviderHealthDiagnosticsContent(summary);
  const shouldRenderDiagnosticLinkCopyError = shouldRenderAdminProviderHealthDiagnosticLinkCopyError(diagnosticLinkCopyError);
  const shouldRenderDiagnosticUrlSyncError = shouldRenderAdminProviderHealthDiagnosticUrlSyncError(diagnosticUrlSyncError);
  const diagnosticLinkCopyActionLabel = getAdminProviderHealthDiagnosticLinkCopyActionLabel(diagnosticLinkCopied, copy);
  const adminProviderHealthDiagnosticsSnapshot = buildAdminProviderHealthDiagnosticsSnapshot({
    summary,
    activeFilterSummary,
    severityFilter,
    runtimeFilter,
    diagnosticLinkCopyError,
    diagnosticUrlSyncError,
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <AdminProviderHealthDiagnosticsSnapshotStrip snapshot={adminProviderHealthDiagnosticsSnapshot} />
      <AdminDiagnosticSection
        title={copy.providerHealthDiagnostics}
        tone={tone}
        badges={[
          { label: `${copy.providerHealthProviders}: ${summary.totalProviderCount}` },
          { label: `${copy.providerHealthEnabled}: ${summary.enabledProviderCount}`, tone: 'info' },
          { label: `${copy.providerHealthLoaded}: ${summary.loadedProviderCount}`, tone: 'info' },
          { label: `${copy.providerHealthDrift}: ${summary.driftCount}`, tone: driftBadgeTone },
          { label: `${copy.providerHealthBlocked}: ${summary.blockedCount}`, tone: blockedBadgeTone },
        ]}
        emptyMessage={emptyMessage}
        healthyMessage={healthyMessage}
      >
        {shouldRenderDiagnosticsContent === true && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{copy.providerHealthReadOnlyBoundary}</p>
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-gray-700 dark:bg-gray-950/20">
              <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                {copy.providerHealthSeverityFilter}
                <select
                  value={severityFilter}
                  onChange={(event) => updateSeverityFilter(event.target.value as AdminProviderHealthSeverityFilter)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  {materializeAdminProviderHealthFilterOptionNodes(providerHealthSeverityOptions, copy)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                {copy.providerHealthRuntimeFilter}
                <select
                  value={runtimeFilter}
                  onChange={(event) => updateRuntimeFilter(event.target.value as AdminProviderHealthRuntimeFilter)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  {materializeAdminProviderHealthFilterOptionNodes(providerHealthRuntimeOptions, copy)}
                </select>
              </label>
              <button
                type="button"
                onClick={clearFilters}
                disabled={adminProviderHealthDiagnosticsSnapshot.canClearFilters === false}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {copy.providerHealthClearFilters}
              </button>
              <button
                type="button"
                onClick={copyCurrentDiagnosticLink}
                disabled={adminProviderHealthDiagnosticsSnapshot.canCopyDiagnosticLink === false}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                {diagnosticLinkCopyActionLabel}
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {copy.providerHealthFilterSummary}: {activeFilterSummary.matchedProviderCount}/{activeFilterSummary.totalProviderCount}
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
            <div className="grid gap-2 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-4 dark:text-gray-300">
              <span>{copy.providerHealthDefault}: {summary.defaultProviderName}</span>
              <span>{copy.providerHealthActive}: {summary.activeProviderName}</span>
              <span>{copy.providerHealthReady}: {summary.readyCount}</span>
              <span>{copy.providerHealthIdle}: {summary.idleCount}</span>
            </div>
            {shouldRenderPriorityProviders === true && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{copy.providerHealthPriorityProviders}</p>
                {materializeAdminProviderHealthPriorityProviderNodes(summary.priorityProviders, copy)}
              </div>
            )}
            {shouldRenderFilteredEmpty === true && (
              <p className="rounded-lg border border-dashed border-gray-200 bg-white/60 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950/20 dark:text-gray-400">
                {copy.providerHealthFilteredEmpty}
              </p>
            )}
          </div>
        )}
      </AdminDiagnosticSection>
    </div>
  );
}
