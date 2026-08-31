import type {
  CapabilityProviderPreflightItem,
  CapabilityProviderPreflightItemList,
  CapabilityProviderPreflightMetadata,
  CapabilityProviderPreflightResponse,
  CapabilityProviderPreflightStatus,
} from '@/lib/admin/api';
import type { AdminCopy } from '@/lib/admin/i18n';
import type { ReactNode } from 'react';
import type {
  AdminCapabilityPreflightFiltersSnapshot,
  AdminCapabilityPreflightFiltersSnapshotSource,
  AdminCapabilityPreflightFiltersSnapshotStatus,
  AdminCapabilityPreflightDynamicFilterValue,
  AdminCapabilityPreflightItemSnapshotSource,
  AdminCapabilityPreflightItemSnapshotStatus,
  AdminCapabilityPreflightItemSnapshot,
  AdminCapabilityPreflightRunbookItemSnapshotSource,
  AdminCapabilityPreflightRunbookItemSnapshotStatus,
  AdminCapabilityPreflightRunbookKind,
  AdminCapabilityPreflightRunbookItemSnapshot,
  AdminCapabilityPreflightSeverityFilterValue,
  AdminCapabilityPreflightStatusFilterValue,
} from '../workspace/workspace-types';
import type {
  CapabilityPreflightActiveFilterSummaryModel,
  CapabilityPreflightConfigKeyFilter,
  CapabilityPreflightConfigKeySummaryItem,
  CapabilityPreflightFocusedConfigKeySummaryModel,
  CapabilityPreflightFocusedReasonCodeSummaryModel,
  CapabilityPreflightConfigKeySummaryModel,
  CapabilityPreflightPrioritySummaryModel,
  CapabilityPreflightProviderSummaryItem,
  CapabilityPreflightProviderSummaryModel,
  CapabilityPreflightReasonCodeFilter,
  CapabilityPreflightReasonCodeSummaryItem,
  CapabilityPreflightReasonCodeSummaryModel,
  CapabilityPreflightSeverityFilter,
  CapabilityPreflightSnapshotFreshnessModel,
  CapabilityPreflightStatusFilter,
} from './admin-capability-preflight-model';
import { getCapabilityPreflightConfigKeys } from './admin-capability-preflight-model';
import type { AdminDiagnosticTone } from './admin-diagnostics-view';
import { AdminDiagnosticSection } from './admin-diagnostics-view';

type AdminCapabilityPreflightHeaderProps = {
  copy: AdminCopy;
  providerPreflight: CapabilityProviderPreflightResponse | null;
};

type AdminCapabilityPreflightBoundaryNoticeProps = {
  copy: AdminCopy;
};

type AdminCapabilityPreflightPrioritySummaryProps = {
  copy: AdminCopy;
  summary: CapabilityPreflightPrioritySummaryModel;
};

type AdminCapabilityPreflightProviderSummaryProps = {
  copy: AdminCopy;
  summary: CapabilityPreflightProviderSummaryModel;
};

type AdminCapabilityPreflightConfigKeySummaryProps = {
  copy: AdminCopy;
  summary: CapabilityPreflightConfigKeySummaryModel;
  selectedConfigKey: CapabilityPreflightConfigKeyFilter;
  onConfigKeySelect: (value: CapabilityPreflightConfigKeyFilter) => void;
};

type AdminCapabilityPreflightReasonCodeRunbookProps = {
  copy: AdminCopy;
  summary: CapabilityPreflightReasonCodeSummaryModel;
  selectedReasonCode: CapabilityPreflightReasonCodeFilter;
  onReasonCodeSelect: (value: CapabilityPreflightReasonCodeFilter) => void;
};

type AdminCapabilityPreflightFiltersProps = {
  copy: AdminCopy;
  statusFilter: CapabilityPreflightStatusFilter;
  severityFilter: CapabilityPreflightSeverityFilter;
  configKeyFilter: CapabilityPreflightConfigKeyFilter;
  reasonCodeFilter: CapabilityPreflightReasonCodeFilter;
  activeFilterSummary: CapabilityPreflightActiveFilterSummaryModel;
  focusedConfigKeySummary: CapabilityPreflightFocusedConfigKeySummaryModel;
  focusedReasonCodeSummary: CapabilityPreflightFocusedReasonCodeSummaryModel;
  diagnosticLinkCopied: boolean;
  diagnosticLinkCopyError: string;
  canClearFilters: boolean;
  canCopyDiagnosticLink: boolean;
  onStatusFilterChange: (value: CapabilityPreflightStatusFilter) => void;
  onSeverityFilterChange: (value: CapabilityPreflightSeverityFilter) => void;
  onConfigKeyFilterClear: () => void;
  onReasonCodeFilterClear: () => void;
  onAllFiltersClear: () => void;
  onDiagnosticLinkCopy: () => void;
};

type AdminCapabilityPreflightItemListProps = {
  copy: AdminCopy;
  items: CapabilityProviderPreflightItemList;
};

type AdminCapabilityPreflightSnapshotFooterProps = {
  copy: AdminCopy;
  providerPreflight: CapabilityProviderPreflightResponse | null;
  snapshotFreshness: CapabilityPreflightSnapshotFreshnessModel;
};

type CapabilityPreflightMetadataEntry = {
  key: string;
  value: string;
};

function getCapabilityPreflightListLabel(values: readonly string[], separator: string): string {
  const hasValues = values.length > 0;
  return hasValues === true ? values.join(separator) : '-';
}

function hasCapabilityPreflightPrimaryItem(
  item: CapabilityProviderPreflightItem | null,
): item is CapabilityProviderPreflightItem {
  return item !== null;
}

function shouldRenderCapabilityPreflightPrimaryIssue(
  item: CapabilityProviderPreflightItem | null,
): item is CapabilityProviderPreflightItem {
  const hasPrimaryItem = hasCapabilityPreflightPrimaryItem(item);
  return hasPrimaryItem === true;
}

function shouldRenderCapabilityPreflightPriorityHealthy(item: CapabilityProviderPreflightItem | null): boolean {
  const hasPrimaryItem = hasCapabilityPreflightPrimaryItem(item);
  return hasPrimaryItem === false;
}

function shouldRenderCapabilityPreflightPrimaryConfigKeys(configKeys: readonly string[]): boolean {
  const hasConfigKeys = configKeys.length > 0;
  return hasConfigKeys === true;
}

function shouldRenderCapabilityPreflightProviderSummaryItems(
  summary: CapabilityPreflightProviderSummaryModel,
): boolean {
  const hasProviders = summary.providerCount > 0;
  return hasProviders === true;
}

function getCapabilityPreflightPrioritySummaryTone(summary: CapabilityPreflightPrioritySummaryModel): AdminDiagnosticTone {
  const hasCriticalItems = summary.criticalCount > 0;
  if (hasCriticalItems === true) {
    return 'critical';
  }
  const hasWarningItems = summary.warningCount > 0;
  if (hasWarningItems === true) {
    return 'warning';
  }
  return 'success';
}

function isCapabilityPreflightProviderSummaryHealthy(summary: CapabilityPreflightProviderSummaryModel): boolean {
  const hasProviders = summary.providerCount > 0;
  const hasBlockedProviders = summary.blockedProviderCount > 0;
  const hasSkippedProviders = summary.skippedProviderCount > 0;
  return hasProviders === true && hasBlockedProviders === false && hasSkippedProviders === false;
}

function getCapabilityPreflightProviderSummaryEmptyMessage(
  summary: CapabilityPreflightProviderSummaryModel,
  copy: AdminCopy,
): string | undefined {
  const hasProviders = summary.providerCount > 0;
  if (hasProviders === true) {
    return undefined;
  }
  return copy.capabilityPreflightProviderSummaryEmpty;
}

function getCapabilityPreflightProviderSummaryHealthyMessage(isHealthy: boolean, copy: AdminCopy): string | undefined {
  if (isHealthy === false) {
    return undefined;
  }
  return copy.capabilityPreflightProviderSummaryHealthy;
}

function getCapabilityPreflightActiveFilterLabelSuffix(summary: CapabilityPreflightActiveFilterSummaryModel): string {
  const hasActiveLabels = summary.activeLabels.length > 0;
  return hasActiveLabels === true ? ` / ${summary.activeLabels.join(' / ')}` : '';
}

function getCapabilityPreflightDiagnosticLinkCopyActionLabel(isCopied: boolean, copy: AdminCopy): string {
  if (isCopied === true) {
    return copy.capabilityPreflightDiagnosticLinkCopied;
  }
  return copy.capabilityPreflightCopyDiagnosticLink;
}

function shouldRenderCapabilityPreflightDiagnosticLinkCopyError(error: string): boolean {
  const hasError = error.length > 0;
  return hasError === true;
}

function shouldRenderCapabilityPreflightActiveFilters(summary: CapabilityPreflightActiveFilterSummaryModel): boolean {
  const hasActiveFilters = summary.activeFilterCount > 0;
  return hasActiveFilters === true;
}

function shouldRenderCapabilityPreflightConfigKeyFilter(value: CapabilityPreflightConfigKeyFilter): boolean {
  return value !== 'all';
}

function shouldRenderCapabilityPreflightReasonCodeFilter(value: CapabilityPreflightReasonCodeFilter): boolean {
  return value !== 'all';
}

function hasCapabilityPreflightFocusedConfigKeySummary(
  summary: CapabilityPreflightFocusedConfigKeySummaryModel,
): summary is Exclude<CapabilityPreflightFocusedConfigKeySummaryModel, null> {
  return summary !== null;
}

function hasCapabilityPreflightFocusedReasonCodeSummary(
  summary: CapabilityPreflightFocusedReasonCodeSummaryModel,
): summary is Exclude<CapabilityPreflightFocusedReasonCodeSummaryModel, null> {
  return summary !== null;
}

function shouldRenderCapabilityPreflightItemNextAction(item: CapabilityProviderPreflightItem): boolean {
  const hasNextAction = item.next_action !== null && item.next_action !== undefined && item.next_action.length > 0;
  return hasNextAction === true;
}

function shouldRenderCapabilityPreflightItemConfigKeys(configKeys: readonly string[]): boolean {
  const hasConfigKeys = configKeys.length > 0;
  return hasConfigKeys === true;
}

function shouldRenderCapabilityPreflightItemMetadataEntries(
  metadataEntries: readonly CapabilityPreflightMetadataEntry[],
): boolean {
  const hasMetadataEntries = metadataEntries.length > 0;
  return hasMetadataEntries === true;
}

function getCapabilityPreflightItemCount(items: readonly CapabilityProviderPreflightItem[]): number {
  const hasItemList = Array.isArray(items) === true;
  return hasItemList === true ? items.length : 0;
}

function hasCapabilityPreflightItems(items: readonly CapabilityProviderPreflightItem[]): boolean {
  const itemCount = getCapabilityPreflightItemCount(items);
  const hasItems = Array.isArray(items) === true && itemCount > 0;
  return hasItems === true;
}

function shouldRenderCapabilityPreflightFilteredEmpty(items: readonly CapabilityProviderPreflightItem[]): boolean {
  const hasItems = hasCapabilityPreflightItems(items);
  return hasItems === false;
}

function getCapabilityPreflightItemRunnerModeLabel(item: CapabilityProviderPreflightItem): string {
  const hasRunnerMode = item.runner_mode.length > 0;
  return hasRunnerMode === true ? item.runner_mode : 'none';
}

function hasCapabilityProviderPreflightResponse(
  providerPreflight: CapabilityProviderPreflightResponse | null,
): providerPreflight is CapabilityProviderPreflightResponse {
  return providerPreflight !== null;
}

function hasCapabilityPreflightStatusCountValue(value: number | undefined): value is number {
  const hasStatusCount = value !== undefined && Number.isInteger(value) === true && value >= 0;
  return hasStatusCount === true;
}

function getCapabilityPreflightStatusCount(
  providerPreflight: CapabilityProviderPreflightResponse | null,
  status: CapabilityProviderPreflightStatus,
): number {
  const hasProviderPreflight = hasCapabilityProviderPreflightResponse(providerPreflight);
  if (hasProviderPreflight === false) {
    return 0;
  }
  const statusCount = providerPreflight.status_counts[status];
  const hasStatusCount = hasCapabilityPreflightStatusCountValue(statusCount);
  return hasStatusCount === true ? statusCount : 0;
}

function formatCapabilityPreflightMetadataValue(value: unknown): string {
  if (Array.isArray(value)) {
    const values: string[] = [];
    for (const item of value) {
      values.push(String(item));
    }
    return getCapabilityPreflightListLabel(values, ', ');
  }
  if (typeof value === 'boolean') {
    return value === true ? 'true' : 'false';
  }
  const hasObjectValue = value !== undefined && value !== null && typeof value === 'object';
  if (hasObjectValue === true) {
    return JSON.stringify(value);
  }
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  return String(value);
}

function getCapabilityPreflightMetadataEntries(metadata?: CapabilityProviderPreflightMetadata): CapabilityPreflightMetadataEntry[] {
  const entries: CapabilityPreflightMetadataEntry[] = [];
  const normalizedMetadata = metadata ?? {};

  for (const key in normalizedMetadata) {
    const hasMetadataEntry = Object.prototype.hasOwnProperty.call(normalizedMetadata, key);
    if (hasMetadataEntry === true) {
      entries.push({
        key,
        value: formatCapabilityPreflightMetadataValue(normalizedMetadata[key]),
      });
    }
  }

  return entries;
}

function getCapabilityPreflightSeverityClassName(severity: string): string {
  if (severity === 'critical') {
    return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200';
  }
  if (severity === 'warning') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200';
  }
  return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200';
}

function isCapabilityPreflightItemBlocked(item: CapabilityProviderPreflightItem): boolean {
  const isBlocked = item.status === 'blocked';
  return isBlocked === true;
}

function getCapabilityPreflightRunbookSelectionClassName(isSelected: boolean): string {
  if (isSelected === true) {
    return 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100';
  }
  return 'border-white/70 bg-white/70 hover:border-blue-200 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-950/30 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10';
}

function getCapabilityPreflightConfigKeyToggleTarget(
  selectedConfigKey: CapabilityPreflightConfigKeyFilter,
  configKey: string,
): CapabilityPreflightConfigKeyFilter {
  const isSelected = selectedConfigKey === configKey;
  return isSelected === true ? 'all' : configKey;
}

function getCapabilityPreflightReasonCodeToggleTarget(
  selectedReasonCode: CapabilityPreflightReasonCodeFilter,
  reasonCode: string,
): CapabilityPreflightReasonCodeFilter {
  const isSelected = selectedReasonCode === reasonCode;
  return isSelected === true ? 'all' : reasonCode;
}

function getCapabilityPreflightItemContainerClassName(isBlocked: boolean): string {
  if (isBlocked === true) {
    return 'border-red-100 bg-red-50/70 dark:border-red-500/20 dark:bg-red-500/10';
  }
  return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40';
}

function getCapabilityPreflightItemProviderClassName(isBlocked: boolean): string {
  if (isBlocked === true) {
    return 'text-red-800 dark:text-red-200';
  }
  return 'text-gray-900 dark:text-gray-100';
}

function getCapabilityPreflightItemStatusClassName(isBlocked: boolean): string {
  if (isBlocked === true) {
    return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200';
  }
  return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
}

function getCapabilityPreflightItemSourceNoteClassName(isBlocked: boolean): string {
  if (isBlocked === true) {
    return 'text-red-700 dark:text-red-200';
  }
  return 'text-gray-600 dark:text-gray-300';
}

function materializeAdminCapabilityPreflightProviderSummaryItemNodes(
  items: readonly CapabilityPreflightProviderSummaryItem[],
  copy: AdminCopy,
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const item of items) {
    nodes.push(
      <div
        key={item.provider}
        className="rounded-lg border border-white/70 bg-white/80 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-950/30"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.provider}</span>
          <span className={`rounded-full px-2 py-0.5 ${getCapabilityPreflightSeverityClassName(item.highestSeverity)}`}>
            {item.highestSeverity}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {item.status}
          </span>
          <span className="text-gray-500 dark:text-gray-400">{item.itemCount} items</span>
        </div>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          <span className="font-medium">{copy.capabilityPreflightProviderRunnerModes}: </span>
          {getCapabilityPreflightListLabel(item.runnerModes, ', ')}
        </p>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          <span className="font-medium">{copy.capabilityPreflightProviderReasonCodes}: </span>
          {getCapabilityPreflightListLabel(item.reasonCodes, ', ')}
        </p>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          <span className="font-medium">{copy.capabilityPreflightRunbookConfigKeys}: </span>
          {getCapabilityPreflightListLabel(item.configKeys, ', ')}
        </p>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          <span className="font-medium">{copy.capabilityPreflightRunbookNextActions}: </span>
          {getCapabilityPreflightListLabel(item.nextActions, ' / ')}
        </p>
      </div>,
    );
  }

  return nodes;
}

function materializeAdminCapabilityPreflightConfigKeySummaryItemNodes(
  items: readonly CapabilityPreflightConfigKeySummaryItem[],
  selectedConfigKey: CapabilityPreflightConfigKeyFilter,
  onConfigKeySelect: (value: CapabilityPreflightConfigKeyFilter) => void,
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const item of items) {
    const isSelected = selectedConfigKey === item.key;
    const runbookSelectionClassName = getCapabilityPreflightRunbookSelectionClassName(isSelected);
    const toggleTarget = getCapabilityPreflightConfigKeyToggleTarget(selectedConfigKey, item.key);
    const runbookItemSnapshot = buildAdminCapabilityPreflightRunbookItemSnapshot({
      kind: 'config_key',
      value: item.key,
      isSelected,
      providerCount: item.providers.length,
      reasonCodeCount: item.reasonCodes.length,
      configKeyCount: 1,
      nextActionCount: 0,
    });

    nodes.push(
      <button
        type="button"
        key={item.key}
        onClick={() => onConfigKeySelect(toggleTarget)}
        className={`rounded-lg border px-3 py-2 text-left transition ${runbookSelectionClassName}`}
      >
        <p className="font-medium text-gray-800 dark:text-gray-100">{item.key}</p>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          {getCapabilityPreflightListLabel(item.providers, ', ')} / {getCapabilityPreflightListLabel(item.reasonCodes, ', ')}
        </p>
        <AdminCapabilityPreflightRunbookItemSnapshotStrip snapshot={runbookItemSnapshot} />
      </button>,
    );
  }

  return nodes;
}

function materializeAdminCapabilityPreflightReasonCodeRunbookItemNodes(
  items: readonly CapabilityPreflightReasonCodeSummaryItem[],
  copy: AdminCopy,
  selectedReasonCode: CapabilityPreflightReasonCodeFilter,
  onReasonCodeSelect: (value: CapabilityPreflightReasonCodeFilter) => void,
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const item of items) {
    const isSelected = selectedReasonCode === item.reasonCode;
    const runbookSelectionClassName = getCapabilityPreflightRunbookSelectionClassName(isSelected);
    const toggleTarget = getCapabilityPreflightReasonCodeToggleTarget(selectedReasonCode, item.reasonCode);
    const runbookItemSnapshot = buildAdminCapabilityPreflightRunbookItemSnapshot({
      kind: 'reason_code',
      value: item.reasonCode,
      isSelected,
      providerCount: item.providers.length,
      reasonCodeCount: 1,
      configKeyCount: item.configKeys.length,
      nextActionCount: item.nextActions.length,
    });

    nodes.push(
      <button
        type="button"
        key={item.reasonCode}
        onClick={() => onReasonCodeSelect(toggleTarget)}
        className={`rounded-lg border px-3 py-2 text-left transition ${runbookSelectionClassName}`}
      >
        <p className="font-medium text-gray-800 dark:text-gray-100">{item.reasonCode}</p>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          <span className="font-medium">{copy.capabilityPreflightRunbookProviders}: </span>
          {getCapabilityPreflightListLabel(item.providers, ', ')}
        </p>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          <span className="font-medium">{copy.capabilityPreflightRunbookConfigKeys}: </span>
          {getCapabilityPreflightListLabel(item.configKeys, ', ')}
        </p>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          <span className="font-medium">{copy.capabilityPreflightRunbookNextActions}: </span>
          {getCapabilityPreflightListLabel(item.nextActions, ' / ')}
        </p>
        <AdminCapabilityPreflightRunbookItemSnapshotStrip snapshot={runbookItemSnapshot} />
      </button>,
    );
  }

  return nodes;
}

function materializeAdminCapabilityPreflightMetadataEntryNodes(
  metadataEntries: readonly CapabilityPreflightMetadataEntry[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const entry of metadataEntries) {
    nodes.push(
      <div key={entry.key} className="min-w-0">
        <dt className="font-medium text-gray-500 dark:text-gray-400">{entry.key}</dt>
        <dd className="mt-0.5 truncate text-gray-800 dark:text-gray-200" title={entry.value}>{entry.value}</dd>
      </div>,
    );
  }

  return nodes;
}

function materializeAdminCapabilityPreflightItemNodes(
  copy: AdminCopy,
  items: CapabilityProviderPreflightItemList,
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const item of items) {
    const metadataEntries = getCapabilityPreflightMetadataEntries(item.metadata);
    const configKeys = getCapabilityPreflightConfigKeys(item.metadata);
    const shouldRenderNextAction = shouldRenderCapabilityPreflightItemNextAction(item);
    const shouldRenderConfigKeys = shouldRenderCapabilityPreflightItemConfigKeys(configKeys);
    const shouldRenderMetadataEntries = shouldRenderCapabilityPreflightItemMetadataEntries(metadataEntries);
    const runnerModeLabel = getCapabilityPreflightItemRunnerModeLabel(item);
    const isBlocked = isCapabilityPreflightItemBlocked(item);
    const itemContainerClassName = getCapabilityPreflightItemContainerClassName(isBlocked);
    const itemProviderClassName = getCapabilityPreflightItemProviderClassName(isBlocked);
    const itemStatusClassName = getCapabilityPreflightItemStatusClassName(isBlocked);
    const itemSourceNoteClassName = getCapabilityPreflightItemSourceNoteClassName(isBlocked);
    const adminCapabilityPreflightItemSnapshot = buildAdminCapabilityPreflightItemSnapshot({
      item,
      configKeyCount: configKeys.length,
      metadataCount: metadataEntries.length,
    });

    nodes.push(
      <div
        key={`${item.provider}-${item.runner_mode}-${item.reason_code}`}
        className={`rounded-xl border px-4 py-3 ${itemContainerClassName}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-semibold ${itemProviderClassName}`}>{item.provider}</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">{runnerModeLabel}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${itemStatusClassName}`}>{item.status}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${getCapabilityPreflightSeverityClassName(item.severity)}`}>
            {copy.capabilityPreflightSeverity}: {item.severity}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{item.reason_code}</span>
        </div>
        <AdminCapabilityPreflightItemSnapshotStrip snapshot={adminCapabilityPreflightItemSnapshot} />
        <p className={`mt-1 text-sm ${itemSourceNoteClassName}`}>{item.source_note}</p>
        {shouldRenderNextAction === true && (
          <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-gray-700 dark:bg-gray-950/30 dark:text-gray-200">
            <span className="font-medium">{copy.capabilityPreflightNextAction}: </span>
            {item.next_action}
          </p>
        )}
        {shouldRenderConfigKeys === true && (
          <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-gray-700 dark:bg-gray-950/30 dark:text-gray-200">
            <span className="font-medium">{copy.capabilityPreflightConfigKeys}: </span>
            {getCapabilityPreflightListLabel(configKeys, ', ')}
          </p>
        )}
        {shouldRenderMetadataEntries === true && (
          <div className="mt-3 rounded-lg border border-white/70 bg-white/70 p-3 dark:border-gray-700 dark:bg-gray-950/30">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{copy.capabilityPreflightMetadata}</p>
            <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
              {materializeAdminCapabilityPreflightMetadataEntryNodes(metadataEntries)}
            </dl>
          </div>
        )}
      </div>,
    );
  }

  return nodes;
}

function getAdminCapabilityPreflightSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = value !== null && value !== undefined && value.length > 0;

  return hasValue === true ? value : fallback;
}

function getAdminCapabilityPreflightSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function buildAdminCapabilityPreflightItemSnapshot({
  item,
  configKeyCount,
  metadataCount,
}: {
  item: CapabilityProviderPreflightItem;
  configKeyCount: number;
  metadataCount: number;
}): AdminCapabilityPreflightItemSnapshot {
  const providerLabel = getAdminCapabilityPreflightSnapshotLabel(item.provider, 'unknown');
  const runnerModeLabel = getAdminCapabilityPreflightSnapshotLabel(item.runner_mode, 'none');
  const reasonCodeLabel = getAdminCapabilityPreflightSnapshotLabel(item.reason_code, 'none');
  const hasReasonCode = reasonCodeLabel !== 'none';
  const hasNextAction = item.next_action !== null && item.next_action !== undefined && item.next_action.length > 0;
  const hasSourceNote = item.source_note !== null && item.source_note !== undefined && item.source_note.length > 0;
  const hasConfigKeys = configKeyCount > 0;
  const hasMetadata = metadataCount > 0;
  const canInspectMetadata = hasMetadata === true;
  const canFollowNextAction = hasNextAction === true;
  const status: AdminCapabilityPreflightItemSnapshotStatus = item.status === 'blocked'
    ? 'blocked'
    : hasNextAction === true
      ? 'action_required'
      : hasConfigKeys === true
        ? 'config_scoped'
        : hasMetadata === true
          ? 'metadata_only'
          : item.status === 'skipped'
            ? 'skipped'
            : 'ready';

  const source: AdminCapabilityPreflightItemSnapshotSource = status === 'blocked'
    ? 'severity'
    : status === 'action_required'
      ? 'next_action'
      : status === 'config_scoped' || status === 'metadata_only'
        ? 'metadata'
      : hasReasonCode === true
          ? 'reason_code'
          : 'preflight_item';

  return {
    status,
    source,
    provider: providerLabel,
    runnerMode: runnerModeLabel,
    itemStatus: item.status,
    severity: item.severity,
    reasonCode: reasonCodeLabel,
    configKeyCount,
    metadataCount,
    hasNextAction,
    hasSourceNote,
    canInspectMetadata,
    canFollowNextAction,
    message: status === 'blocked'
      ? 'Capability preflight item 当前阻断 provider 能力。'
      : status === 'action_required'
        ? 'Capability preflight item 提供了下一步处理动作。'
        : status === 'config_scoped'
          ? 'Capability preflight item 关联到具体 config key。'
          : status === 'metadata_only'
            ? 'Capability preflight item 仅提供 metadata 上下文。'
            : status === 'skipped'
              ? 'Capability preflight item 已跳过。'
              : 'Capability preflight item 已就绪。',
    recovery: status === 'blocked'
      ? '优先查看 severity、reason_code、config keys 和 next_action 后处理阻断项。'
      : status === 'action_required'
        ? '按 next_action 处理，必要时回到 provider/config 页面验证配置。'
        : status === 'config_scoped'
          ? '对照 config key 检查对应配置来源和值域。'
          : status === 'metadata_only'
            ? '展开 metadata 上下文确认该项是否需要后续治理。'
            : '保持观察；如状态变化，重新查看 provider preflight 快照。',
    updatedAt: 'derived',
  };
}

function getAdminCapabilityPreflightItemSnapshotClassName(snapshot: AdminCapabilityPreflightItemSnapshot) {
  if (snapshot.status === 'blocked') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'action_required' || snapshot.status === 'config_scoped') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  if (snapshot.status === 'skipped' || snapshot.status === 'metadata_only') {
    return 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

export function AdminCapabilityPreflightItemSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminCapabilityPreflightItemSnapshot;
}) {
  const hasNextActionLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.hasNextAction);
  const hasSourceNoteLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.hasSourceNote);
  const canInspectMetadataLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.canInspectMetadata);
  const canFollowNextActionLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.canFollowNextAction);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-capability-preflight-item-snapshot"
      className={`mt-2 rounded-lg border px-3 py-2 text-xs ${getAdminCapabilityPreflightItemSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Capability Preflight Item 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Provider: {snapshot.provider}</span>
        <span>Runner: {snapshot.runnerMode}</span>
        <span>Status: {snapshot.itemStatus}</span>
        <span>Severity: {snapshot.severity}</span>
        <span>Reason: {snapshot.reasonCode}</span>
        <span>ConfigKeys: {snapshot.configKeyCount}</span>
        <span>Metadata: {snapshot.metadataCount}</span>
        <span>NextAction: {hasNextActionLabel}</span>
        <span>SourceNote: {hasSourceNoteLabel}</span>
        <span>InspectMetadata: {canInspectMetadataLabel}</span>
        <span>FollowNextAction: {canFollowNextActionLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function buildAdminCapabilityPreflightFiltersSnapshot({
  statusFilter,
  severityFilter,
  configKeyFilter,
  reasonCodeFilter,
  activeFilterSummary,
  focusedConfigKeySummary,
  focusedReasonCodeSummary,
  diagnosticLinkCopyError,
  canClearFilters,
  canCopyDiagnosticLink,
}: {
  statusFilter: CapabilityPreflightStatusFilter;
  severityFilter: CapabilityPreflightSeverityFilter;
  configKeyFilter: CapabilityPreflightConfigKeyFilter;
  reasonCodeFilter: CapabilityPreflightReasonCodeFilter;
  activeFilterSummary: CapabilityPreflightActiveFilterSummaryModel;
  focusedConfigKeySummary: CapabilityPreflightFocusedConfigKeySummaryModel;
  focusedReasonCodeSummary: CapabilityPreflightFocusedReasonCodeSummaryModel;
  diagnosticLinkCopyError: string;
  canClearFilters: boolean;
  canCopyDiagnosticLink: boolean;
}): AdminCapabilityPreflightFiltersSnapshot {
  const hasFocusedConfigKey = focusedConfigKeySummary !== null;
  const hasFocusedReasonCode = focusedReasonCodeSummary !== null;
  const hasDiagnosticLinkCopyError = diagnosticLinkCopyError.length > 0;
  const hasActiveFilters = activeFilterSummary.activeFilterCount > 0;
  const hasFilteredItems = activeFilterSummary.matchedItemCount > 0;
  const hasFocusedFilter = hasFocusedConfigKey === true || hasFocusedReasonCode === true;
  const hasCopyCapability = canCopyDiagnosticLink === true;
  const canClearConfigKeyFilter = configKeyFilter !== 'all';
  const canClearReasonCodeFilter = reasonCodeFilter !== 'all';
  const snapshotStatusFilter: AdminCapabilityPreflightStatusFilterValue = statusFilter;
  const snapshotSeverityFilter: AdminCapabilityPreflightSeverityFilterValue = severityFilter;
  const snapshotConfigKeyFilter: AdminCapabilityPreflightDynamicFilterValue = configKeyFilter;
  const snapshotReasonCodeFilter: AdminCapabilityPreflightDynamicFilterValue = reasonCodeFilter;
  const status: AdminCapabilityPreflightFiltersSnapshotStatus = hasDiagnosticLinkCopyError === true
    ? 'copy_failed'
    : hasFilteredItems === false && hasActiveFilters === true
      ? 'filtered_empty'
      : hasFocusedFilter === true
        ? 'focused'
        : hasActiveFilters === true
          ? 'active'
          : hasCopyCapability === true
            ? 'copy_ready'
            : 'idle';

  const source: AdminCapabilityPreflightFiltersSnapshotSource = hasDiagnosticLinkCopyError === true
    ? 'diagnostic_link'
    : hasFocusedFilter === true
      ? 'focus_summary'
      : hasActiveFilters === true
        ? 'active_filters'
        : 'preflight_filters';

  return {
    status,
    source,
    totalItemCount: activeFilterSummary.totalItemCount,
    matchedItemCount: activeFilterSummary.matchedItemCount,
    activeFilterCount: activeFilterSummary.activeFilterCount,
    statusFilter: snapshotStatusFilter,
    severityFilter: snapshotSeverityFilter,
    configKeyFilter: snapshotConfigKeyFilter,
    reasonCodeFilter: snapshotReasonCodeFilter,
    hasFocusedConfigKey,
    hasFocusedReasonCode,
    hasDiagnosticLinkCopyError,
    canClearFilters,
    canCopyDiagnosticLink,
    canClearConfigKeyFilter,
    canClearReasonCodeFilter,
    message: status === 'copy_failed'
      ? 'Capability preflight filters 诊断链接复制失败。'
      : status === 'filtered_empty'
        ? 'Capability preflight filters 当前筛选没有命中明细。'
        : status === 'focused'
          ? 'Capability preflight filters 正在展示聚焦筛选上下文。'
          : status === 'active'
            ? 'Capability preflight filters 已启用筛选条件。'
            : status === 'copy_ready'
              ? 'Capability preflight filters 可复制诊断链接。'
              : 'Capability preflight filters 处于默认状态。',
    recovery: status === 'copy_failed'
      ? '检查浏览器剪贴板权限，或手动复制当前诊断 URL。'
      : status === 'filtered_empty'
        ? '清除筛选或放宽 status/severity/config key/reason code 条件。'
        : status === 'focused'
          ? '可通过聚焦 chip 清除 config key 或 reason code 筛选。'
          : status === 'active'
            ? '如需回到全量明细，请使用清除筛选。'
            : '可继续调整筛选条件或复制诊断链接。',
    updatedAt: 'derived',
  };
}

function getAdminCapabilityPreflightFiltersSnapshotClassName(snapshot: AdminCapabilityPreflightFiltersSnapshot) {
  if (snapshot.status === 'copy_failed' || snapshot.status === 'filtered_empty') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'focused' || snapshot.status === 'active') {
    return 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

export function AdminCapabilityPreflightFiltersSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminCapabilityPreflightFiltersSnapshot;
}) {
  const hasFocusedConfigKeyLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.hasFocusedConfigKey);
  const hasFocusedReasonCodeLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.hasFocusedReasonCode);
  const hasDiagnosticLinkCopyErrorLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.hasDiagnosticLinkCopyError);
  const canClearFiltersLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.canClearFilters);
  const canCopyDiagnosticLinkLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.canCopyDiagnosticLink);
  const canClearConfigKeyFilterLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.canClearConfigKeyFilter);
  const canClearReasonCodeFilterLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.canClearReasonCodeFilter);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-capability-preflight-filters-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminCapabilityPreflightFiltersSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Capability Preflight Filters 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Matched: {snapshot.matchedItemCount}</span>
        <span>Total: {snapshot.totalItemCount}</span>
        <span>Filters: {snapshot.activeFilterCount}</span>
        <span>StatusFilter: {snapshot.statusFilter}</span>
        <span>SeverityFilter: {snapshot.severityFilter}</span>
        <span>ConfigKeyFilter: {snapshot.configKeyFilter}</span>
        <span>ReasonCodeFilter: {snapshot.reasonCodeFilter}</span>
        <span>FocusedConfig: {hasFocusedConfigKeyLabel}</span>
        <span>FocusedReason: {hasFocusedReasonCodeLabel}</span>
        <span>CopyError: {hasDiagnosticLinkCopyErrorLabel}</span>
        <span>ClearFilters: {canClearFiltersLabel}</span>
        <span>CopyLink: {canCopyDiagnosticLinkLabel}</span>
        <span>ClearConfig: {canClearConfigKeyFilterLabel}</span>
        <span>ClearReason: {canClearReasonCodeFilterLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function buildAdminCapabilityPreflightRunbookItemSnapshot({
  kind,
  value,
  isSelected,
  providerCount,
  reasonCodeCount,
  configKeyCount,
  nextActionCount,
}: {
  kind: AdminCapabilityPreflightRunbookKind;
  value: string;
  isSelected: boolean;
  providerCount: number;
  reasonCodeCount: number;
  configKeyCount: number;
  nextActionCount: number;
}): AdminCapabilityPreflightRunbookItemSnapshot {
  const hasSelection = isSelected === true;
  const canSelect = true;
  const canClearSelection = hasSelection === true;
  const hasRelatedProviders = providerCount > 0;
  const hasRelatedReasons = reasonCodeCount > 0;
  const hasRelatedConfigKeys = configKeyCount > 0;
  const hasNextActions = nextActionCount > 0;
  const hasRelatedReasonContext = hasRelatedReasons === true || hasRelatedConfigKeys === true;
  const status: AdminCapabilityPreflightRunbookItemSnapshotStatus = hasSelection === true
    ? 'selected'
    : hasNextActions === true
      ? 'actionable'
      : hasRelatedProviders === true
        ? 'provider_scoped'
        : hasRelatedReasonContext === true
          ? 'reason_scoped'
          : 'empty_context';

  const source: AdminCapabilityPreflightRunbookItemSnapshotSource = hasSelection === true
    ? 'selection'
    : kind === 'config_key'
      ? 'config_key_runbook'
      : hasNextActions === true
        ? 'related_context'
        : 'reason_code_runbook';

  return {
    status,
    source,
    kind,
    value,
    providerCount,
    reasonCodeCount,
    configKeyCount,
    nextActionCount,
    isSelected,
    canSelect,
    canClearSelection,
    hasRelatedProviders,
    hasRelatedReasons,
    hasRelatedConfigKeys,
    hasNextActions,
    message: status === 'selected'
      ? 'Capability preflight runbook item 当前已聚焦。'
      : status === 'actionable'
        ? 'Capability preflight runbook item 带有下一步处理动作。'
        : status === 'provider_scoped'
          ? 'Capability preflight runbook item 关联 provider 范围。'
          : status === 'reason_scoped'
            ? 'Capability preflight runbook item 关联 reason/config 上下文。'
            : 'Capability preflight runbook item 缺少关联上下文。',
    recovery: status === 'selected'
      ? '再次点击可清除该聚焦筛选。'
      : status === 'actionable'
        ? '查看 next actions 并对照相关 provider/config key 处理。'
        : status === 'empty_context'
          ? '检查 runbook summary 是否缺少关联 provider、reason code 或 config key。'
          : '点击该条目可聚焦对应预检明细。',
    updatedAt: 'derived',
  };
}

function getAdminCapabilityPreflightRunbookItemSnapshotClassName(snapshot: AdminCapabilityPreflightRunbookItemSnapshot) {
  if (snapshot.status === 'selected') {
    return 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
  }
  if (snapshot.status === 'actionable') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  if (snapshot.status === 'empty_context') {
    return 'border-gray-200 bg-white/70 text-gray-600 dark:border-gray-700 dark:bg-gray-950/20 dark:text-gray-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

export function AdminCapabilityPreflightRunbookItemSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminCapabilityPreflightRunbookItemSnapshot;
}) {
  const isSelectedLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.isSelected);
  const canSelectLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.canSelect);
  const canClearSelectionLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.canClearSelection);
  const hasRelatedProvidersLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.hasRelatedProviders);
  const hasRelatedReasonsLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.hasRelatedReasons);
  const hasRelatedConfigKeysLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.hasRelatedConfigKeys);
  const hasNextActionsLabel = getAdminCapabilityPreflightSnapshotBooleanLabel(snapshot.hasNextActions);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-capability-preflight-runbook-item-snapshot"
      className={`mt-2 rounded-lg border px-3 py-2 text-xs ${getAdminCapabilityPreflightRunbookItemSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Capability Preflight Runbook Item 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Kind: {snapshot.kind}</span>
        <span>Value: {snapshot.value}</span>
        <span>Providers: {snapshot.providerCount}</span>
        <span>Reasons: {snapshot.reasonCodeCount}</span>
        <span>ConfigKeys: {snapshot.configKeyCount}</span>
        <span>NextActions: {snapshot.nextActionCount}</span>
        <span>Selected: {isSelectedLabel}</span>
        <span>Select: {canSelectLabel}</span>
        <span>ClearSelection: {canClearSelectionLabel}</span>
        <span>RelatedProviders: {hasRelatedProvidersLabel}</span>
        <span>RelatedReasons: {hasRelatedReasonsLabel}</span>
        <span>RelatedConfigKeys: {hasRelatedConfigKeysLabel}</span>
        <span>HasNextActions: {hasNextActionsLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function AdminCapabilityPreflightHeader({ copy, providerPreflight }: AdminCapabilityPreflightHeaderProps) {
  const blockedStatusCount = getCapabilityPreflightStatusCount(providerPreflight, 'blocked');
  const readyStatusCount = getCapabilityPreflightStatusCount(providerPreflight, 'ready');
  const skippedStatusCount = getCapabilityPreflightStatusCount(providerPreflight, 'skipped');

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{copy.capabilityPreflight}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{copy.capabilityPreflightDescription}</p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-medium">
        <span className="rounded-full bg-red-50 px-3 py-1 text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {copy.capabilityPreflightBlocked}: {blockedStatusCount}
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {copy.capabilityPreflightReady}: {readyStatusCount}
        </span>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {copy.capabilityPreflightSkipped}: {skippedStatusCount}
        </span>
      </div>
    </div>
  );
}

export function AdminCapabilityPreflightBoundaryNotice({ copy }: AdminCapabilityPreflightBoundaryNoticeProps) {
  return (
    <AdminDiagnosticSection title={copy.capabilityPreflightBoundaryTitle} tone="info">
      <p className="mt-1 text-blue-700 dark:text-blue-200">{copy.capabilityPreflightBoundaryDescription}</p>
    </AdminDiagnosticSection>
  );
}

export function AdminCapabilityPreflightPrioritySummary({ copy, summary }: AdminCapabilityPreflightPrioritySummaryProps) {
  const summaryTone = getCapabilityPreflightPrioritySummaryTone(summary);
  const primaryItem = summary.primaryItem;
  const shouldRenderPrimaryIssue = shouldRenderCapabilityPreflightPrimaryIssue(primaryItem);
  const shouldRenderPriorityHealthy = shouldRenderCapabilityPreflightPriorityHealthy(primaryItem);
  const primaryConfigKeys = getCapabilityPreflightConfigKeys(primaryItem?.metadata);
  const shouldRenderPrimaryConfigKeys = shouldRenderCapabilityPreflightPrimaryConfigKeys(primaryConfigKeys);

  return (
    <AdminDiagnosticSection
      title={copy.capabilityPreflightPrioritySummary}
      tone={summaryTone}
      badges={[
        { label: `critical: ${summary.criticalCount}`, tone: 'critical' },
        { label: `warning: ${summary.warningCount}`, tone: 'warning' },
        { label: `info: ${summary.infoCount}`, tone: 'info' },
      ]}
    >
      {shouldRenderPrimaryIssue === true && primaryItem !== null && (
        <div className="mt-2 text-sm text-gray-700 dark:text-gray-200">
          <p>
            <span className="font-medium">{copy.capabilityPreflightPrimaryIssue}: </span>
            {primaryItem.provider} / {primaryItem.reason_code}
          </p>
          {shouldRenderPrimaryConfigKeys === true && (
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              <span className="font-medium">{copy.capabilityPreflightConfigKeys}: </span>
              {primaryConfigKeys.join(', ')}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            {primaryItem.next_action}
          </p>
        </div>
      )}
      {shouldRenderPriorityHealthy === true && (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-200">{copy.capabilityPreflightPriorityHealthy}</p>
      )}
    </AdminDiagnosticSection>
  );
}

export function AdminCapabilityPreflightProviderSummary({
  copy,
  summary,
}: AdminCapabilityPreflightProviderSummaryProps) {
  const isHealthy = isCapabilityPreflightProviderSummaryHealthy(summary);
  const emptyMessage = getCapabilityPreflightProviderSummaryEmptyMessage(summary, copy);
  const healthyMessage = getCapabilityPreflightProviderSummaryHealthyMessage(isHealthy, copy);
  const shouldRenderProviderSummaryItems = shouldRenderCapabilityPreflightProviderSummaryItems(summary);

  return (
    <AdminDiagnosticSection
      title={copy.capabilityPreflightProviderSummary}
      badges={[
        { label: `${copy.capabilityPreflightBlocked}: ${summary.blockedProviderCount}`, tone: 'critical' },
        { label: `${copy.capabilityPreflightReady}: ${summary.readyProviderCount}`, tone: 'success' },
        { label: `${copy.capabilityPreflightSkipped}: ${summary.skippedProviderCount}` },
      ]}
      emptyMessage={emptyMessage}
      healthyMessage={healthyMessage}
    >
      {shouldRenderProviderSummaryItems === true && (
        <div className="grid gap-2 lg:grid-cols-2">
          {materializeAdminCapabilityPreflightProviderSummaryItemNodes(summary.items, copy)}
        </div>
      )}
    </AdminDiagnosticSection>
  );
}

export function AdminCapabilityPreflightConfigKeySummary({
  copy,
  summary,
  selectedConfigKey,
  onConfigKeySelect,
}: AdminCapabilityPreflightConfigKeySummaryProps) {
  if (summary.affectedKeyCount === 0) {
    return null;
  }

  return (
    <AdminDiagnosticSection
      title={copy.capabilityPreflightConfigKeySummary}
      badges={[{ label: String(summary.affectedKeyCount) }]}
    >
      <div className="grid gap-2 text-xs lg:grid-cols-2">
        {materializeAdminCapabilityPreflightConfigKeySummaryItemNodes(
          summary.items,
          selectedConfigKey,
          onConfigKeySelect,
        )}
      </div>
    </AdminDiagnosticSection>
  );
}

export function AdminCapabilityPreflightReasonCodeRunbook({
  copy,
  summary,
  selectedReasonCode,
  onReasonCodeSelect,
}: AdminCapabilityPreflightReasonCodeRunbookProps) {
  if (summary.affectedReasonCodeCount === 0) {
    return null;
  }

  return (
    <AdminDiagnosticSection
      title={copy.capabilityPreflightReasonCodeRunbook}
      badges={[{ label: String(summary.affectedReasonCodeCount) }]}
    >
      <div className="grid gap-2 text-xs lg:grid-cols-2">
        {materializeAdminCapabilityPreflightReasonCodeRunbookItemNodes(
          summary.items,
          copy,
          selectedReasonCode,
          onReasonCodeSelect,
        )}
      </div>
    </AdminDiagnosticSection>
  );
}

export function AdminCapabilityPreflightFilters({
  copy,
  statusFilter,
  severityFilter,
  configKeyFilter,
  reasonCodeFilter,
  activeFilterSummary,
  focusedConfigKeySummary,
  focusedReasonCodeSummary,
  diagnosticLinkCopied,
  diagnosticLinkCopyError,
  canClearFilters,
  canCopyDiagnosticLink,
  onStatusFilterChange,
  onSeverityFilterChange,
  onConfigKeyFilterClear,
  onReasonCodeFilterClear,
  onAllFiltersClear,
  onDiagnosticLinkCopy,
}: AdminCapabilityPreflightFiltersProps) {
  const activeFilterLabelSuffix = getCapabilityPreflightActiveFilterLabelSuffix(activeFilterSummary);
  const shouldRenderDiagnosticLinkCopyError = shouldRenderCapabilityPreflightDiagnosticLinkCopyError(diagnosticLinkCopyError);
  const shouldRenderActiveFilters = shouldRenderCapabilityPreflightActiveFilters(activeFilterSummary);
  const shouldRenderConfigKeyFilter = shouldRenderCapabilityPreflightConfigKeyFilter(configKeyFilter);
  const shouldRenderReasonCodeFilter = shouldRenderCapabilityPreflightReasonCodeFilter(reasonCodeFilter);
  const hasFocusedConfigKeySummary = hasCapabilityPreflightFocusedConfigKeySummary(focusedConfigKeySummary);
  const hasFocusedReasonCodeSummary = hasCapabilityPreflightFocusedReasonCodeSummary(focusedReasonCodeSummary);
  const diagnosticLinkCopyActionLabel = getCapabilityPreflightDiagnosticLinkCopyActionLabel(diagnosticLinkCopied, copy);
  const adminCapabilityPreflightFiltersSnapshot = buildAdminCapabilityPreflightFiltersSnapshot({
    statusFilter,
    severityFilter,
    configKeyFilter,
    reasonCodeFilter,
    activeFilterSummary,
    focusedConfigKeySummary,
    focusedReasonCodeSummary,
    diagnosticLinkCopyError,
    canClearFilters,
    canCopyDiagnosticLink,
  });

  return (
    <div className="space-y-2">
      <AdminCapabilityPreflightFiltersSnapshotStrip snapshot={adminCapabilityPreflightFiltersSnapshot} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{copy.capabilityPreflightDetails}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {copy.capabilityPreflightFilterSummary}: {activeFilterSummary.matchedItemCount}/{activeFilterSummary.totalItemCount} items / {activeFilterSummary.activeFilterCount} filters
            {activeFilterLabelSuffix}
          </span>
          <button
            type="button"
            onClick={onDiagnosticLinkCopy}
            disabled={canCopyDiagnosticLink === false}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-700 hover:border-blue-200 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10"
          >
            {diagnosticLinkCopyActionLabel}
          </button>
          {shouldRenderDiagnosticLinkCopyError === true && (
            <span role="status" className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {diagnosticLinkCopyError}
            </span>
          )}
          {shouldRenderActiveFilters === true && (
            <button
              type="button"
              onClick={onAllFiltersClear}
              disabled={canClearFilters === false}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-700 hover:border-blue-200 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10"
            >
              {copy.capabilityPreflightClearFilters}
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {shouldRenderConfigKeyFilter === true && (
          <button
            type="button"
            onClick={onConfigKeyFilterClear}
            className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
          >
            {copy.capabilityPreflightConfigKeyFilter}: {configKeyFilter} x
          </button>
        )}
        {shouldRenderReasonCodeFilter === true && (
          <button
            type="button"
            onClick={onReasonCodeFilterClear}
            className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
          >
            {copy.capabilityPreflightReasonCodeFilter}: {reasonCodeFilter} x
          </button>
        )}
        {hasFocusedConfigKeySummary === true && (
          <span className="rounded-lg border border-blue-100 bg-white px-2 py-1 text-blue-700 dark:border-blue-500/20 dark:bg-gray-900 dark:text-blue-200">
            {copy.capabilityPreflightConfigKeyFocusSummary}: {focusedConfigKeySummary.matchedItemCount} items / {focusedConfigKeySummary.providerCount} providers / {focusedConfigKeySummary.reasonCodeCount} reasons
          </span>
        )}
        {hasFocusedReasonCodeSummary === true && (
          <span className="rounded-lg border border-blue-100 bg-white px-2 py-1 text-blue-700 dark:border-blue-500/20 dark:bg-gray-900 dark:text-blue-200">
            {copy.capabilityPreflightReasonCodeFocusSummary}: {focusedReasonCodeSummary.matchedItemCount} items / {focusedReasonCodeSummary.providerCount} providers / {focusedReasonCodeSummary.configKeyCount} config keys
          </span>
        )}
        <label className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <span>{copy.capabilityPreflightStatusFilter}</span>
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as CapabilityPreflightStatusFilter)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="all">{copy.capabilityPreflightAll}</option>
            <option value="blocked">{copy.capabilityPreflightBlocked}</option>
            <option value="ready">{copy.capabilityPreflightReady}</option>
            <option value="skipped">{copy.capabilityPreflightSkipped}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <span>{copy.capabilityPreflightSeverityFilter}</span>
          <select
            value={severityFilter}
            onChange={(event) => onSeverityFilterChange(event.target.value as CapabilityPreflightSeverityFilter)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="all">{copy.capabilityPreflightAll}</option>
            <option value="critical">critical</option>
            <option value="warning">warning</option>
            <option value="info">info</option>
          </select>
        </label>
      </div>
    </div>
  );
}

export function AdminCapabilityPreflightItemList({ copy, items }: AdminCapabilityPreflightItemListProps) {
  const shouldRenderFilteredEmpty = shouldRenderCapabilityPreflightFilteredEmpty(items);
  if (shouldRenderFilteredEmpty === true) {
    return (
      <p className="rounded-lg border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        {copy.capabilityPreflightFilteredEmpty}
      </p>
    );
  }

  return materializeAdminCapabilityPreflightItemNodes(copy, items);
}

export function AdminCapabilityPreflightSnapshotFooter({
  copy,
  providerPreflight,
  snapshotFreshness,
}: AdminCapabilityPreflightSnapshotFooterProps) {
  const hasProviderPreflight = hasCapabilityProviderPreflightResponse(providerPreflight);
  if (hasProviderPreflight === false) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
      <AdminDiagnosticSection title={copy.capabilityPreflightSnapshotFreshness}>
        <p className="mt-1">
          {copy.capabilityPreflightSnapshot}: {snapshotFreshness.generatedAtLabel}
          {snapshotFreshness.timestampState === 'available' ? ` / ${copy.capabilityPreflightSnapshotAge}: ${snapshotFreshness.ageLabel}` : ''}
        </p>
        <p className="mt-1">{copy.capabilityPreflightSnapshotRefreshHint}</p>
      </AdminDiagnosticSection>
      <p className="mt-1">{providerPreflight.source_note}</p>
    </div>
  );
}
