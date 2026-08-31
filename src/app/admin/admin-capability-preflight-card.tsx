'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  CapabilityProviderPreflightItemList,
  CapabilityProviderPreflightResponse,
} from '@/lib/admin/api';
import type { AdminCopy } from '@/lib/admin/i18n';
import {
  buildAdminCapabilityPreflightDiagnosticsSnapshot,
  AdminCapabilityPreflightDiagnosticsSnapshotStrip,
} from './admin-capability-preflight-diagnostics-snapshot';
import {
  CAPABILITY_PREFLIGHT_CONFIG_KEY_QUERY_PARAM,
  CAPABILITY_PREFLIGHT_REASON_CODE_QUERY_PARAM,
  CAPABILITY_PREFLIGHT_SEVERITY_QUERY_PARAM,
  CAPABILITY_PREFLIGHT_STATUS_QUERY_PARAM,
  clearCapabilityPreflightFilterSearch,
  deriveCapabilityPreflightActiveFilterSummary,
  deriveCapabilityPreflightConfigKeySummary,
  deriveCapabilityPreflightFocusedConfigKeySummary,
  deriveCapabilityPreflightFocusedReasonCodeSummary,
  deriveCapabilityPreflightPrioritySummary,
  deriveCapabilityPreflightProviderSummary,
  deriveCapabilityPreflightReasonCodeSummary,
  deriveCapabilityPreflightSnapshotFreshness,
  filterCapabilityPreflightItems,
  normalizeCapabilityPreflightConfigKeyFilter,
  normalizeCapabilityPreflightReasonCodeFilter,
  normalizeCapabilityPreflightSeverityFilter,
  normalizeCapabilityPreflightStatusFilter,
  type CapabilityPreflightConfigKeyFilter,
  type CapabilityPreflightReasonCodeFilter,
  type CapabilityPreflightSeverityFilter,
  type CapabilityPreflightStatusFilter,
  updateCapabilityPreflightConfigKeySearch,
  updateCapabilityPreflightReasonCodeSearch,
  updateCapabilityPreflightSeveritySearch,
  updateCapabilityPreflightStatusSearch,
} from './admin-capability-preflight-model';
import {
  AdminCapabilityPreflightBoundaryNotice,
  AdminCapabilityPreflightFilters,
  AdminCapabilityPreflightConfigKeySummary,
  AdminCapabilityPreflightHeader,
  AdminCapabilityPreflightItemList,
  AdminCapabilityPreflightPrioritySummary,
  AdminCapabilityPreflightProviderSummary,
  AdminCapabilityPreflightReasonCodeRunbook,
  AdminCapabilityPreflightSnapshotFooter,
} from './admin-capability-preflight-view';
import { useAdminDiagnosticLinkCopy } from './use-admin-diagnostic-link-copy';
import { useAdminDiagnosticUrlSync } from './use-admin-diagnostic-url-sync';

type AdminCapabilityPreflightCardProps = {
  copy: AdminCopy;
  providerPreflight: CapabilityProviderPreflightResponse | null;
};

const EMPTY_CAPABILITY_PROVIDER_PREFLIGHT_ITEMS: CapabilityProviderPreflightItemList = [];

function getAdminCapabilityPreflightCardItems(
  providerPreflight: CapabilityProviderPreflightResponse | null,
): CapabilityProviderPreflightItemList {
  const hasProviderPreflight = providerPreflight !== null;
  if (hasProviderPreflight === false) {
    return EMPTY_CAPABILITY_PROVIDER_PREFLIGHT_ITEMS;
  }

  const hasProviderPreflightItems = Array.isArray(providerPreflight.items) === true;
  return hasProviderPreflightItems === true ? providerPreflight.items : EMPTY_CAPABILITY_PROVIDER_PREFLIGHT_ITEMS;
}

function getAdminCapabilityPreflightCardItemCount(items: CapabilityProviderPreflightItemList): number {
  const hasItemList = Array.isArray(items) === true;
  return hasItemList === true ? items.length : 0;
}

function hasAdminCapabilityPreflightCardItems(items: CapabilityProviderPreflightItemList): boolean {
  const itemCount = getAdminCapabilityPreflightCardItemCount(items);
  const hasItems = Array.isArray(items) === true && itemCount > 0;
  return hasItems === true;
}

function shouldRenderAdminCapabilityPreflightCardUnavailable(items: CapabilityProviderPreflightItemList): boolean {
  const hasItems = hasAdminCapabilityPreflightCardItems(items);
  return hasItems === false;
}

function shouldRenderAdminCapabilityPreflightCardContent(items: CapabilityProviderPreflightItemList): boolean {
  const hasItems = hasAdminCapabilityPreflightCardItems(items);
  return hasItems === true;
}

export function AdminCapabilityPreflightCard({ copy, providerPreflight }: AdminCapabilityPreflightCardProps) {
  const [providerPreflightStatusFilter, setProviderPreflightStatusFilter] = useState<CapabilityPreflightStatusFilter>('all');
  const [providerPreflightSeverityFilter, setProviderPreflightSeverityFilter] = useState<CapabilityPreflightSeverityFilter>('all');
  const [providerPreflightConfigKeyFilter, setProviderPreflightConfigKeyFilter] = useState<CapabilityPreflightConfigKeyFilter>('all');
  const [providerPreflightReasonCodeFilter, setProviderPreflightReasonCodeFilter] = useState<CapabilityPreflightReasonCodeFilter>('all');
  const {
    diagnosticLinkCopied: providerPreflightDiagnosticLinkCopied,
    diagnosticLinkCopyError: providerPreflightDiagnosticLinkCopyError,
    copyCurrentDiagnosticLink,
  } = useAdminDiagnosticLinkCopy();
  const { diagnosticUrlSyncError, replaceUrlSearch } = useAdminDiagnosticUrlSync();

  const readStatusFilterFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    return normalizeCapabilityPreflightStatusFilter(
      new URLSearchParams(window.location.search).get(CAPABILITY_PREFLIGHT_STATUS_QUERY_PARAM),
    );
  }, []);

  const readSeverityFilterFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    return normalizeCapabilityPreflightSeverityFilter(
      new URLSearchParams(window.location.search).get(CAPABILITY_PREFLIGHT_SEVERITY_QUERY_PARAM),
    );
  }, []);

  const readConfigKeyFilterFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    return normalizeCapabilityPreflightConfigKeyFilter(
      new URLSearchParams(window.location.search).get(CAPABILITY_PREFLIGHT_CONFIG_KEY_QUERY_PARAM),
    );
  }, []);

  const syncConfigKeyFilterToUrl = useCallback((nextFilter: CapabilityPreflightConfigKeyFilter) => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextSearch = updateCapabilityPreflightConfigKeySearch(window.location.search, nextFilter);
    replaceUrlSearch(nextSearch);
  }, [replaceUrlSearch]);

  const readReasonCodeFilterFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    return normalizeCapabilityPreflightReasonCodeFilter(
      new URLSearchParams(window.location.search).get(CAPABILITY_PREFLIGHT_REASON_CODE_QUERY_PARAM),
    );
  }, []);

  const syncReasonCodeFilterToUrl = useCallback((nextFilter: CapabilityPreflightReasonCodeFilter) => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextSearch = updateCapabilityPreflightReasonCodeSearch(window.location.search, nextFilter);
    replaceUrlSearch(nextSearch);
  }, [replaceUrlSearch]);

  const syncStatusFilterToUrl = useCallback((nextFilter: CapabilityPreflightStatusFilter) => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextSearch = updateCapabilityPreflightStatusSearch(window.location.search, nextFilter);
    replaceUrlSearch(nextSearch);
  }, [replaceUrlSearch]);

  const syncSeverityFilterToUrl = useCallback((nextFilter: CapabilityPreflightSeverityFilter) => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextSearch = updateCapabilityPreflightSeveritySearch(window.location.search, nextFilter);
    replaceUrlSearch(nextSearch);
  }, [replaceUrlSearch]);

  const updateProviderPreflightStatusFilter = useCallback((nextFilter: CapabilityPreflightStatusFilter) => {
    setProviderPreflightStatusFilter(nextFilter);
    syncStatusFilterToUrl(nextFilter);
  }, [syncStatusFilterToUrl]);

  const updateProviderPreflightSeverityFilter = useCallback((nextFilter: CapabilityPreflightSeverityFilter) => {
    setProviderPreflightSeverityFilter(nextFilter);
    syncSeverityFilterToUrl(nextFilter);
  }, [syncSeverityFilterToUrl]);

  const updateProviderPreflightConfigKeyFilter = useCallback((nextFilter: CapabilityPreflightConfigKeyFilter) => {
    setProviderPreflightConfigKeyFilter(nextFilter);
    syncConfigKeyFilterToUrl(nextFilter);
  }, [syncConfigKeyFilterToUrl]);

  const updateProviderPreflightReasonCodeFilter = useCallback((nextFilter: CapabilityPreflightReasonCodeFilter) => {
    setProviderPreflightReasonCodeFilter(nextFilter);
    syncReasonCodeFilterToUrl(nextFilter);
  }, [syncReasonCodeFilterToUrl]);

  const clearProviderPreflightFilters = useCallback(() => {
    setProviderPreflightStatusFilter('all');
    setProviderPreflightSeverityFilter('all');
    setProviderPreflightConfigKeyFilter('all');
    setProviderPreflightReasonCodeFilter('all');
    if (typeof window !== 'undefined') {
      replaceUrlSearch(clearCapabilityPreflightFilterSearch(window.location.search));
    }
  }, [replaceUrlSearch]);

  useEffect(() => {
    setProviderPreflightStatusFilter(readStatusFilterFromUrl());
    setProviderPreflightSeverityFilter(readSeverityFilterFromUrl());
    setProviderPreflightConfigKeyFilter(readConfigKeyFilterFromUrl());
    setProviderPreflightReasonCodeFilter(readReasonCodeFilterFromUrl());

    const handlePopState = () => {
      setProviderPreflightStatusFilter(readStatusFilterFromUrl());
      setProviderPreflightSeverityFilter(readSeverityFilterFromUrl());
      setProviderPreflightConfigKeyFilter(readConfigKeyFilterFromUrl());
      setProviderPreflightReasonCodeFilter(readReasonCodeFilterFromUrl());
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [readConfigKeyFilterFromUrl, readReasonCodeFilterFromUrl, readSeverityFilterFromUrl, readStatusFilterFromUrl]);

  const providerPreflightItems = useMemo(() => {
    return getAdminCapabilityPreflightCardItems(providerPreflight);
  }, [providerPreflight]);

  const filteredProviderPreflightItems = useMemo(() => {
    return filterCapabilityPreflightItems(
      providerPreflightItems,
      providerPreflightStatusFilter,
      providerPreflightSeverityFilter,
      providerPreflightConfigKeyFilter,
      providerPreflightReasonCodeFilter,
    );
  }, [
    providerPreflightItems,
    providerPreflightConfigKeyFilter,
    providerPreflightReasonCodeFilter,
    providerPreflightSeverityFilter,
    providerPreflightStatusFilter,
  ]);

  const providerPreflightPrioritySummary = useMemo(() => {
    return deriveCapabilityPreflightPrioritySummary(providerPreflightItems);
  }, [providerPreflightItems]);

  const providerPreflightProviderSummary = useMemo(() => {
    return deriveCapabilityPreflightProviderSummary(providerPreflightItems);
  }, [providerPreflightItems]);

  const providerPreflightConfigKeySummary = useMemo(() => {
    return deriveCapabilityPreflightConfigKeySummary(providerPreflightItems);
  }, [providerPreflightItems]);

  const providerPreflightFocusedConfigKeySummary = useMemo(() => {
    return deriveCapabilityPreflightFocusedConfigKeySummary(
      providerPreflightConfigKeySummary,
      providerPreflightConfigKeyFilter,
      filteredProviderPreflightItems,
    );
  }, [filteredProviderPreflightItems, providerPreflightConfigKeyFilter, providerPreflightConfigKeySummary]);

  const providerPreflightReasonCodeSummary = useMemo(() => {
    return deriveCapabilityPreflightReasonCodeSummary(providerPreflightItems);
  }, [providerPreflightItems]);

  const providerPreflightFocusedReasonCodeSummary = useMemo(() => {
    return deriveCapabilityPreflightFocusedReasonCodeSummary(
      providerPreflightReasonCodeSummary,
      providerPreflightReasonCodeFilter,
      filteredProviderPreflightItems,
    );
  }, [filteredProviderPreflightItems, providerPreflightReasonCodeFilter, providerPreflightReasonCodeSummary]);

  const providerPreflightActiveFilterSummary = useMemo(() => {
    return deriveCapabilityPreflightActiveFilterSummary(
      providerPreflightItems,
      filteredProviderPreflightItems,
      {
        statusFilter: providerPreflightStatusFilter,
        severityFilter: providerPreflightSeverityFilter,
        configKeyFilter: providerPreflightConfigKeyFilter,
        reasonCodeFilter: providerPreflightReasonCodeFilter,
      },
    );
  }, [
    filteredProviderPreflightItems,
    providerPreflightItems,
    providerPreflightConfigKeyFilter,
    providerPreflightReasonCodeFilter,
    providerPreflightSeverityFilter,
    providerPreflightStatusFilter,
  ]);

  const providerPreflightSnapshotFreshness = useMemo(() => {
    return deriveCapabilityPreflightSnapshotFreshness(providerPreflight?.generated_at);
  }, [providerPreflight?.generated_at]);
  const shouldRenderProviderPreflightUnavailable = shouldRenderAdminCapabilityPreflightCardUnavailable(providerPreflightItems);
  const shouldRenderProviderPreflightContent = shouldRenderAdminCapabilityPreflightCardContent(providerPreflightItems);
  const adminCapabilityPreflightDiagnosticsSnapshot = buildAdminCapabilityPreflightDiagnosticsSnapshot({
    providerPreflight,
    activeFilterSummary: providerPreflightActiveFilterSummary,
    prioritySummary: providerPreflightPrioritySummary,
    providerSummary: providerPreflightProviderSummary,
    configKeySummary: providerPreflightConfigKeySummary,
    reasonCodeSummary: providerPreflightReasonCodeSummary,
    snapshotFreshness: providerPreflightSnapshotFreshness,
    statusFilter: providerPreflightStatusFilter,
    severityFilter: providerPreflightSeverityFilter,
    configKeyFilter: providerPreflightConfigKeyFilter,
    reasonCodeFilter: providerPreflightReasonCodeFilter,
    diagnosticLinkCopyError: providerPreflightDiagnosticLinkCopyError,
    diagnosticUrlSyncError,
  });

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <AdminCapabilityPreflightHeader copy={copy} providerPreflight={providerPreflight} />
      <div className="mt-4">
        <AdminCapabilityPreflightDiagnosticsSnapshotStrip snapshot={adminCapabilityPreflightDiagnosticsSnapshot} />
      </div>
      <div className="mt-4 space-y-2">
        {shouldRenderProviderPreflightUnavailable === true && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{copy.capabilityPreflightUnavailable}</p>
        )}
        {shouldRenderProviderPreflightContent === true && (
          <div className="space-y-2">
            <AdminCapabilityPreflightBoundaryNotice copy={copy} />
            <AdminCapabilityPreflightPrioritySummary copy={copy} summary={providerPreflightPrioritySummary} />
            <AdminCapabilityPreflightProviderSummary copy={copy} summary={providerPreflightProviderSummary} />
            <AdminCapabilityPreflightConfigKeySummary
              copy={copy}
              summary={providerPreflightConfigKeySummary}
              selectedConfigKey={providerPreflightConfigKeyFilter}
              onConfigKeySelect={updateProviderPreflightConfigKeyFilter}
            />
            <AdminCapabilityPreflightReasonCodeRunbook
              copy={copy}
              summary={providerPreflightReasonCodeSummary}
              selectedReasonCode={providerPreflightReasonCodeFilter}
              onReasonCodeSelect={updateProviderPreflightReasonCodeFilter}
            />
            <AdminCapabilityPreflightFilters
              copy={copy}
              statusFilter={providerPreflightStatusFilter}
              severityFilter={providerPreflightSeverityFilter}
              configKeyFilter={providerPreflightConfigKeyFilter}
              reasonCodeFilter={providerPreflightReasonCodeFilter}
              activeFilterSummary={providerPreflightActiveFilterSummary}
              focusedConfigKeySummary={providerPreflightFocusedConfigKeySummary}
              focusedReasonCodeSummary={providerPreflightFocusedReasonCodeSummary}
              diagnosticLinkCopied={providerPreflightDiagnosticLinkCopied}
              diagnosticLinkCopyError={providerPreflightDiagnosticLinkCopyError || diagnosticUrlSyncError}
              canClearFilters={adminCapabilityPreflightDiagnosticsSnapshot.canClearFilters}
              canCopyDiagnosticLink={adminCapabilityPreflightDiagnosticsSnapshot.canCopyDiagnosticLink}
              onStatusFilterChange={updateProviderPreflightStatusFilter}
              onSeverityFilterChange={updateProviderPreflightSeverityFilter}
              onConfigKeyFilterClear={() => updateProviderPreflightConfigKeyFilter('all')}
              onReasonCodeFilterClear={() => updateProviderPreflightReasonCodeFilter('all')}
              onAllFiltersClear={clearProviderPreflightFilters}
              onDiagnosticLinkCopy={copyCurrentDiagnosticLink}
            />
            <AdminCapabilityPreflightItemList copy={copy} items={filteredProviderPreflightItems} />
          </div>
        )}
      </div>
      <AdminCapabilityPreflightSnapshotFooter
        copy={copy}
        providerPreflight={providerPreflight}
        snapshotFreshness={providerPreflightSnapshotFreshness}
      />
    </section>
  );
}
