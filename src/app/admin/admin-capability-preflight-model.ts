import type {
  CapabilityProviderPreflightItem,
  CapabilityProviderPreflightItemList,
  CapabilityProviderPreflightMetadata,
  CapabilityProviderPreflightNextAction,
  CapabilityProviderPreflightProvider,
  CapabilityProviderPreflightReasonCode,
  CapabilityProviderPreflightRunnerMode,
  CapabilityProviderPreflightSeverity,
  CapabilityProviderPreflightStatus,
} from '@/lib/admin/api';

export type CapabilityPreflightStatusFilter = CapabilityProviderPreflightStatus | 'all';
export type CapabilityPreflightSeverityFilter = CapabilityProviderPreflightSeverity | 'all';
export type CapabilityPreflightConfigKeyFilter = string | 'all';
export type CapabilityPreflightReasonCodeFilter = CapabilityProviderPreflightReasonCode | 'all';

export const CAPABILITY_PREFLIGHT_STATUS_QUERY_PARAM = 'status';
export const CAPABILITY_PREFLIGHT_SEVERITY_QUERY_PARAM = 'severity';
export const CAPABILITY_PREFLIGHT_CONFIG_KEY_QUERY_PARAM = 'config_key';
export const CAPABILITY_PREFLIGHT_REASON_CODE_QUERY_PARAM = 'reason_code';

const CAPABILITY_PREFLIGHT_STATUS_FILTERS: CapabilityPreflightStatusFilter[] = ['all', 'ready', 'skipped', 'blocked'];
const CAPABILITY_PREFLIGHT_SEVERITY_FILTERS: CapabilityPreflightSeverityFilter[] = ['all', 'info', 'warning', 'critical'];

export type CapabilityPreflightProviderName = CapabilityProviderPreflightProvider;
export type CapabilityPreflightProviderNameList = CapabilityPreflightProviderName[];
export type CapabilityPreflightReasonCode = CapabilityProviderPreflightReasonCode;
export type CapabilityPreflightReasonCodeList = CapabilityPreflightReasonCode[];
export type CapabilityPreflightConfigKey = string;
export type CapabilityPreflightConfigKeyList = CapabilityPreflightConfigKey[];
export type CapabilityPreflightNextAction = CapabilityProviderPreflightNextAction;
export type CapabilityPreflightNextActionList = CapabilityPreflightNextAction[];
export type CapabilityPreflightRunnerMode = CapabilityProviderPreflightRunnerMode;
export type CapabilityPreflightRunnerModeList = CapabilityPreflightRunnerMode[];

export type CapabilityPreflightPrioritySummaryModel = {
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  primaryItem: CapabilityProviderPreflightItem | null;
};

export type CapabilityPreflightConfigKeySummaryItem = {
  key: CapabilityPreflightConfigKey;
  providers: CapabilityPreflightProviderNameList;
  reasonCodes: CapabilityPreflightReasonCodeList;
};

export type CapabilityPreflightConfigKeySummaryModel = {
  items: CapabilityPreflightConfigKeySummaryItem[];
  affectedKeyCount: number;
};

export type CapabilityPreflightFocusedConfigKeySummaryModel = {
  key: CapabilityPreflightConfigKey;
  providerCount: number;
  reasonCodeCount: number;
  matchedItemCount: number;
  providers: CapabilityPreflightProviderNameList;
  reasonCodes: CapabilityPreflightReasonCodeList;
} | null;

export type CapabilityPreflightReasonCodeSummaryItem = {
  reasonCode: CapabilityPreflightReasonCode;
  providers: CapabilityPreflightProviderNameList;
  configKeys: CapabilityPreflightConfigKeyList;
  nextActions: CapabilityPreflightNextActionList;
};

export type CapabilityPreflightReasonCodeSummaryModel = {
  items: CapabilityPreflightReasonCodeSummaryItem[];
  affectedReasonCodeCount: number;
};

export type CapabilityPreflightProviderSummaryItem = {
  provider: CapabilityPreflightProviderName;
  itemCount: number;
  highestSeverity: CapabilityProviderPreflightSeverity;
  status: CapabilityProviderPreflightStatus;
  runnerModes: CapabilityPreflightRunnerModeList;
  reasonCodes: CapabilityPreflightReasonCodeList;
  configKeys: CapabilityPreflightConfigKeyList;
  nextActions: CapabilityPreflightNextActionList;
};

export type CapabilityPreflightProviderSummaryModel = {
  items: CapabilityPreflightProviderSummaryItem[];
  providerCount: number;
  blockedProviderCount: number;
  readyProviderCount: number;
  skippedProviderCount: number;
};

export type CapabilityPreflightFocusedReasonCodeSummaryModel = {
  reasonCode: CapabilityPreflightReasonCode;
  providerCount: number;
  configKeyCount: number;
  matchedItemCount: number;
  providers: CapabilityPreflightProviderNameList;
  configKeys: CapabilityPreflightConfigKeyList;
} | null;

export type CapabilityPreflightSnapshotFreshnessModel = {
  generatedAtLabel: string;
  ageLabel: string;
  timestampState: 'available' | 'missing' | 'invalid';
};

export type CapabilityPreflightFilterState = {
  statusFilter: CapabilityPreflightStatusFilter;
  severityFilter: CapabilityPreflightSeverityFilter;
  configKeyFilter: CapabilityPreflightConfigKeyFilter;
  reasonCodeFilter: CapabilityPreflightReasonCodeFilter;
};

export type CapabilityPreflightActiveFilterKind = keyof CapabilityPreflightFilterState;

export type CapabilityPreflightActiveFilterModel = {
  kind: CapabilityPreflightActiveFilterKind;
  value: string;
};

export type CapabilityPreflightActiveFilterList = CapabilityPreflightActiveFilterModel[];
export type CapabilityPreflightActiveFilterLabel = string;
export type CapabilityPreflightActiveFilterLabelList = CapabilityPreflightActiveFilterLabel[];

export type CapabilityPreflightActiveFilterSummaryModel = {
  activeFilterCount: number;
  matchedItemCount: number;
  totalItemCount: number;
  activeLabels: CapabilityPreflightActiveFilterLabelList;
  activeFilters: CapabilityPreflightActiveFilterList;
};

function formatCapabilityPreflightSnapshotAge(ageMs: number): string {
  const normalizedAgeMs = Math.max(0, ageMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (normalizedAgeMs < minuteMs) {
    return '<1m';
  }
  if (normalizedAgeMs < hourMs) {
    return `${Math.floor(normalizedAgeMs / minuteMs)}m`;
  }
  if (normalizedAgeMs < dayMs) {
    return `${Math.floor(normalizedAgeMs / hourMs)}h`;
  }
  return `${Math.floor(normalizedAgeMs / dayMs)}d`;
}

export function deriveCapabilityPreflightSnapshotFreshness(
  generatedAt?: string | null,
  now: Date = new Date(),
): CapabilityPreflightSnapshotFreshnessModel {
  const normalizedGeneratedAt = generatedAt?.trim();
  const hasNormalizedGeneratedAt = normalizedGeneratedAt !== undefined && normalizedGeneratedAt.length > 0;
  if (hasNormalizedGeneratedAt === false) {
    return {
      generatedAtLabel: '-',
      ageLabel: '-',
      timestampState: 'missing',
    };
  }

  const generatedAtDate = new Date(normalizedGeneratedAt);
  if (Number.isNaN(generatedAtDate.getTime())) {
    return {
      generatedAtLabel: normalizedGeneratedAt,
      ageLabel: '-',
      timestampState: 'invalid',
    };
  }

  return {
    generatedAtLabel: normalizedGeneratedAt,
    ageLabel: formatCapabilityPreflightSnapshotAge(now.getTime() - generatedAtDate.getTime()),
    timestampState: 'available',
  };
}

export function getCapabilityPreflightConfigKeys(metadata?: CapabilityProviderPreflightMetadata): CapabilityPreflightConfigKeyList {
  const rawConfigKeys = metadata?.config_keys;
  const hasRawConfigKeyList = Array.isArray(rawConfigKeys);
  if (hasRawConfigKeyList === false) {
    return [];
  }

  const normalizedConfigKeys = new Set<CapabilityPreflightConfigKey>();
  for (const item of rawConfigKeys) {
    const normalizedConfigKey: CapabilityPreflightConfigKey = String(item).trim();
    const hasNormalizedConfigKey = normalizedConfigKey.length > 0;
    if (hasNormalizedConfigKey === true) {
      normalizedConfigKeys.add(normalizedConfigKey);
    }
  }

  return getSortedCapabilityPreflightValues(normalizedConfigKeys);
}

export function normalizeCapabilityPreflightStatusFilter(value?: string | null): CapabilityPreflightStatusFilter {
  const normalizedValue = value?.trim() as CapabilityPreflightStatusFilter | undefined;
  const hasNormalizedValue = normalizedValue !== undefined && normalizedValue.length > 0;
  const isKnownFilter = hasNormalizedValue === true && CAPABILITY_PREFLIGHT_STATUS_FILTERS.includes(normalizedValue);
  if (isKnownFilter === false) {
    return 'all';
  }
  return normalizedValue;
}

export function normalizeCapabilityPreflightSeverityFilter(value?: string | null): CapabilityPreflightSeverityFilter {
  const normalizedValue = value?.trim() as CapabilityPreflightSeverityFilter | undefined;
  const hasNormalizedValue = normalizedValue !== undefined && normalizedValue.length > 0;
  const isKnownFilter = hasNormalizedValue === true && CAPABILITY_PREFLIGHT_SEVERITY_FILTERS.includes(normalizedValue);
  if (isKnownFilter === false) {
    return 'all';
  }
  return normalizedValue;
}

export function normalizeCapabilityPreflightConfigKeyFilter(value?: string | null): CapabilityPreflightConfigKeyFilter {
  const normalizedValue = value?.trim();
  const hasNormalizedValue = normalizedValue !== undefined && normalizedValue.length > 0;
  const isAllFilter = normalizedValue === 'all';
  if (hasNormalizedValue === false || isAllFilter === true) {
    return 'all';
  }
  return normalizedValue;
}

export function normalizeCapabilityPreflightReasonCodeFilter(value?: string | null): CapabilityPreflightReasonCodeFilter {
  const normalizedValue = value?.trim();
  const hasNormalizedValue = normalizedValue !== undefined && normalizedValue.length > 0;
  const isAllFilter = normalizedValue === 'all';
  if (hasNormalizedValue === false || isAllFilter === true) {
    return 'all';
  }
  return normalizedValue;
}

export function updateCapabilityPreflightStatusSearch(
  search: string,
  statusFilter: CapabilityPreflightStatusFilter,
): string {
  const searchParams = new URLSearchParams(search);
  if (statusFilter === 'all') {
    searchParams.delete(CAPABILITY_PREFLIGHT_STATUS_QUERY_PARAM);
  } else {
    searchParams.set(CAPABILITY_PREFLIGHT_STATUS_QUERY_PARAM, statusFilter);
  }

  const nextSearch = searchParams.toString();
  return nextSearch ? `?${nextSearch}` : '';
}

export function updateCapabilityPreflightSeveritySearch(
  search: string,
  severityFilter: CapabilityPreflightSeverityFilter,
): string {
  const searchParams = new URLSearchParams(search);
  if (severityFilter === 'all') {
    searchParams.delete(CAPABILITY_PREFLIGHT_SEVERITY_QUERY_PARAM);
  } else {
    searchParams.set(CAPABILITY_PREFLIGHT_SEVERITY_QUERY_PARAM, severityFilter);
  }

  const nextSearch = searchParams.toString();
  return nextSearch ? `?${nextSearch}` : '';
}

export function updateCapabilityPreflightConfigKeySearch(
  search: string,
  configKeyFilter: CapabilityPreflightConfigKeyFilter,
): string {
  const searchParams = new URLSearchParams(search);
  if (configKeyFilter === 'all') {
    searchParams.delete(CAPABILITY_PREFLIGHT_CONFIG_KEY_QUERY_PARAM);
  } else {
    searchParams.set(CAPABILITY_PREFLIGHT_CONFIG_KEY_QUERY_PARAM, configKeyFilter);
  }

  const nextSearch = searchParams.toString();
  return nextSearch ? `?${nextSearch}` : '';
}

export function clearCapabilityPreflightFilterSearch(search: string): string {
  const searchParams = new URLSearchParams(search);
  searchParams.delete(CAPABILITY_PREFLIGHT_STATUS_QUERY_PARAM);
  searchParams.delete(CAPABILITY_PREFLIGHT_SEVERITY_QUERY_PARAM);
  searchParams.delete(CAPABILITY_PREFLIGHT_CONFIG_KEY_QUERY_PARAM);
  searchParams.delete(CAPABILITY_PREFLIGHT_REASON_CODE_QUERY_PARAM);

  const nextSearch = searchParams.toString();
  return nextSearch ? `?${nextSearch}` : '';
}

export function updateCapabilityPreflightReasonCodeSearch(
  search: string,
  reasonCodeFilter: CapabilityPreflightReasonCodeFilter,
): string {
  const searchParams = new URLSearchParams(search);
  if (reasonCodeFilter === 'all') {
    searchParams.delete(CAPABILITY_PREFLIGHT_REASON_CODE_QUERY_PARAM);
  } else {
    searchParams.set(CAPABILITY_PREFLIGHT_REASON_CODE_QUERY_PARAM, reasonCodeFilter);
  }

  const nextSearch = searchParams.toString();
  return nextSearch ? `?${nextSearch}` : '';
}

export function getCapabilityPreflightSeverityRank(severity: string): number {
  if (severity === 'critical') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

export function sortCapabilityPreflightItems(items: CapabilityProviderPreflightItemList): CapabilityProviderPreflightItemList {
  return [...items].sort((left, right) => {
    const severityDiff = getCapabilityPreflightSeverityRank(left.severity) - getCapabilityPreflightSeverityRank(right.severity);
    if (severityDiff !== 0) return severityDiff;
    return left.provider.localeCompare(right.provider);
  });
}

function getSortedCapabilityPreflightValues<TValue extends string>(values: ReadonlySet<TValue>): TValue[] {
  const sortedValues: TValue[] = [];
  for (const value of values) {
    sortedValues.push(value);
  }
  return sortedValues.sort((left, right) => left.localeCompare(right));
}

function hasCapabilityPreflightConfigKey(
  item: CapabilityProviderPreflightItem,
  configKeyFilter: CapabilityPreflightConfigKeyFilter,
): boolean {
  if (configKeyFilter === 'all') {
    return true;
  }

  const configKeys = getCapabilityPreflightConfigKeys(item.metadata);
  for (const configKey of configKeys) {
    const isMatched = configKey === configKeyFilter;
    if (isMatched === true) {
      return true;
    }
  }

  return false;
}

function shouldIncludeCapabilityPreflightItem(
  item: CapabilityProviderPreflightItem,
  statusFilter: CapabilityPreflightStatusFilter,
  severityFilter: CapabilityPreflightSeverityFilter,
  configKeyFilter: CapabilityPreflightConfigKeyFilter,
  reasonCodeFilter: CapabilityPreflightReasonCodeFilter,
): boolean {
  const statusMatched = statusFilter === 'all' || item.status === statusFilter;
  const severityMatched = severityFilter === 'all' || item.severity === severityFilter;
  const configKeyMatched = hasCapabilityPreflightConfigKey(item, configKeyFilter);
  const reasonCodeMatched = reasonCodeFilter === 'all' || item.reason_code === reasonCodeFilter;
  const shouldInclude = statusMatched === true && severityMatched === true && configKeyMatched === true && reasonCodeMatched === true;
  return shouldInclude === true;
}

export function filterCapabilityPreflightItems(
  items: CapabilityProviderPreflightItemList,
  statusFilter: CapabilityPreflightStatusFilter,
  severityFilter: CapabilityPreflightSeverityFilter,
  configKeyFilter: CapabilityPreflightConfigKeyFilter = 'all',
  reasonCodeFilter: CapabilityPreflightReasonCodeFilter = 'all',
): CapabilityProviderPreflightItemList {
  const filteredItems: CapabilityProviderPreflightItemList = [];
  const sortedItems = sortCapabilityPreflightItems(items);

  for (const item of sortedItems) {
    const shouldInclude = shouldIncludeCapabilityPreflightItem(
      item,
      statusFilter,
      severityFilter,
      configKeyFilter,
      reasonCodeFilter,
    );
    if (shouldInclude === true) {
      filteredItems.push(item);
    }
  }

  return filteredItems;
}

export function deriveCapabilityPreflightActiveFilterSummary(
  totalItems: CapabilityProviderPreflightItemList,
  matchedItems: CapabilityProviderPreflightItemList,
  filters: CapabilityPreflightFilterState,
): CapabilityPreflightActiveFilterSummaryModel {
  const activeFilters: CapabilityPreflightActiveFilterList = [];
  const activeLabels: CapabilityPreflightActiveFilterLabelList = [];
  const hasStatusFilter = filters.statusFilter !== 'all';
  const hasSeverityFilter = filters.severityFilter !== 'all';
  const hasConfigKeyFilter = filters.configKeyFilter !== 'all';
  const hasReasonCodeFilter = filters.reasonCodeFilter !== 'all';
  if (hasStatusFilter === true) {
    activeFilters.push({ kind: 'statusFilter', value: filters.statusFilter });
    activeLabels.push(`${CAPABILITY_PREFLIGHT_STATUS_QUERY_PARAM}=${filters.statusFilter}`);
  }
  if (hasSeverityFilter === true) {
    activeFilters.push({ kind: 'severityFilter', value: filters.severityFilter });
    activeLabels.push(`${CAPABILITY_PREFLIGHT_SEVERITY_QUERY_PARAM}=${filters.severityFilter}`);
  }
  if (hasConfigKeyFilter === true) {
    activeFilters.push({ kind: 'configKeyFilter', value: filters.configKeyFilter });
    activeLabels.push(`${CAPABILITY_PREFLIGHT_CONFIG_KEY_QUERY_PARAM}=${filters.configKeyFilter}`);
  }
  if (hasReasonCodeFilter === true) {
    activeFilters.push({ kind: 'reasonCodeFilter', value: filters.reasonCodeFilter });
    activeLabels.push(`${CAPABILITY_PREFLIGHT_REASON_CODE_QUERY_PARAM}=${filters.reasonCodeFilter}`);
  }

  return {
    activeFilterCount: activeFilters.length,
    matchedItemCount: matchedItems.length,
    totalItemCount: totalItems.length,
    activeLabels,
    activeFilters,
  };
}

export function deriveCapabilityPreflightPrioritySummary(
  items: CapabilityProviderPreflightItemList,
): CapabilityPreflightPrioritySummaryModel {
  const sortedItems = sortCapabilityPreflightItems(items);
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  let primaryCriticalItem: CapabilityProviderPreflightItem | null = null;
  let primaryWarningItem: CapabilityProviderPreflightItem | null = null;

  for (const item of sortedItems) {
    if (item.severity === 'critical') {
      criticalCount += 1;
      if (primaryCriticalItem === null) {
        primaryCriticalItem = item;
      }
    }
    if (item.severity === 'warning') {
      warningCount += 1;
      if (primaryWarningItem === null) {
        primaryWarningItem = item;
      }
    }
    if (item.severity === 'info') {
      infoCount += 1;
    }
  }

  return {
    criticalCount,
    warningCount,
    infoCount,
    primaryItem: primaryCriticalItem ?? primaryWarningItem,
  };
}

function getCapabilityPreflightDominantStatus(
  statuses: Set<CapabilityProviderPreflightStatus>,
): CapabilityProviderPreflightStatus {
  if (statuses.has('blocked')) {
    return 'blocked';
  }
  if (statuses.has('skipped')) {
    return 'skipped';
  }
  return 'ready';
}

function getCapabilityPreflightProviderSummaryCountByStatus(
  items: readonly CapabilityPreflightProviderSummaryItem[],
  status: CapabilityProviderPreflightStatus,
): number {
  let count = 0;
  for (const item of items) {
    const isMatched = item.status === status;
    if (isMatched === true) {
      count += 1;
    }
  }
  return count;
}

function getCapabilityPreflightFirstProviderItemSeverity(
  items: CapabilityProviderPreflightItemList,
): CapabilityProviderPreflightSeverity {
  for (const item of items) {
    return item.severity;
  }

  return 'info';
}

export function deriveCapabilityPreflightProviderSummary(
  items: CapabilityProviderPreflightItemList,
): CapabilityPreflightProviderSummaryModel {
  const summaryByProvider = new Map<CapabilityPreflightProviderName, {
    items: CapabilityProviderPreflightItemList;
    statuses: Set<CapabilityProviderPreflightStatus>;
    runnerModes: Set<CapabilityPreflightRunnerMode>;
    reasonCodes: Set<CapabilityPreflightReasonCode>;
    configKeys: Set<CapabilityPreflightConfigKey>;
    nextActions: Set<CapabilityPreflightNextAction>;
  }>();

  for (const item of sortCapabilityPreflightItems(items)) {
    const current = summaryByProvider.get(item.provider) ?? {
      items: [],
      statuses: new Set<CapabilityProviderPreflightStatus>(),
      runnerModes: new Set<CapabilityPreflightRunnerMode>(),
      reasonCodes: new Set<CapabilityPreflightReasonCode>(),
      configKeys: new Set<CapabilityPreflightConfigKey>(),
      nextActions: new Set<CapabilityPreflightNextAction>(),
    };
    current.items.push(item);
    current.statuses.add(item.status);
    if (item.runner_mode.trim()) {
      current.runnerModes.add(item.runner_mode.trim());
    }
    if (item.reason_code.trim()) {
      current.reasonCodes.add(item.reason_code.trim());
    }
    for (const key of getCapabilityPreflightConfigKeys(item.metadata)) {
      current.configKeys.add(key);
    }
    if (item.next_action.trim()) {
      current.nextActions.add(item.next_action.trim());
    }
    summaryByProvider.set(item.provider, current);
  }

  const summaryItems: CapabilityPreflightProviderSummaryItem[] = [];
  for (const [provider, value] of summaryByProvider) {
    const sortedProviderItems = sortCapabilityPreflightItems(value.items);
    summaryItems.push({
      provider,
      itemCount: value.items.length,
      highestSeverity: getCapabilityPreflightFirstProviderItemSeverity(sortedProviderItems),
      status: getCapabilityPreflightDominantStatus(value.statuses),
      runnerModes: getSortedCapabilityPreflightValues(value.runnerModes),
      reasonCodes: getSortedCapabilityPreflightValues(value.reasonCodes),
      configKeys: getSortedCapabilityPreflightValues(value.configKeys),
      nextActions: getSortedCapabilityPreflightValues(value.nextActions),
    });
  }
  summaryItems.sort((left, right) => {
    const severityDiff = getCapabilityPreflightSeverityRank(left.highestSeverity) - getCapabilityPreflightSeverityRank(right.highestSeverity);
    if (severityDiff !== 0) return severityDiff;
    return left.provider.localeCompare(right.provider);
  });

  return {
    items: summaryItems,
    providerCount: summaryItems.length,
    blockedProviderCount: getCapabilityPreflightProviderSummaryCountByStatus(summaryItems, 'blocked'),
    readyProviderCount: getCapabilityPreflightProviderSummaryCountByStatus(summaryItems, 'ready'),
    skippedProviderCount: getCapabilityPreflightProviderSummaryCountByStatus(summaryItems, 'skipped'),
  };
}

export function deriveCapabilityPreflightConfigKeySummary(
  items: CapabilityProviderPreflightItemList,
): CapabilityPreflightConfigKeySummaryModel {
  const summaryByKey = new Map<CapabilityPreflightConfigKey, {
    providers: Set<CapabilityPreflightProviderName>;
    reasonCodes: Set<CapabilityPreflightReasonCode>;
  }>();

  for (const item of sortCapabilityPreflightItems(items)) {
    for (const key of getCapabilityPreflightConfigKeys(item.metadata)) {
      const current = summaryByKey.get(key) ?? {
        providers: new Set<CapabilityPreflightProviderName>(),
        reasonCodes: new Set<CapabilityPreflightReasonCode>(),
      };
      current.providers.add(item.provider);
      current.reasonCodes.add(item.reason_code);
      summaryByKey.set(key, current);
    }
  }

  const summaryItems: CapabilityPreflightConfigKeySummaryItem[] = [];
  for (const [key, value] of summaryByKey) {
    summaryItems.push({
      key,
      providers: getSortedCapabilityPreflightValues(value.providers),
      reasonCodes: getSortedCapabilityPreflightValues(value.reasonCodes),
    });
  }
  summaryItems.sort((left, right) => left.key.localeCompare(right.key));

  return {
    items: summaryItems,
    affectedKeyCount: summaryItems.length,
  };
}

export function deriveCapabilityPreflightFocusedConfigKeySummary(
  summary: CapabilityPreflightConfigKeySummaryModel,
  configKeyFilter: CapabilityPreflightConfigKeyFilter,
  matchedItems: CapabilityProviderPreflightItemList,
): CapabilityPreflightFocusedConfigKeySummaryModel {
  if (configKeyFilter === 'all') {
    return null;
  }

  let summaryItem: CapabilityPreflightConfigKeySummaryItem | undefined;
  for (const item of summary.items) {
    const isMatched = item.key === configKeyFilter;
    if (isMatched === true) {
      summaryItem = item;
      break;
    }
  }
  const hasSummaryItem = summaryItem !== undefined;
  if (hasSummaryItem === false || summaryItem === undefined) {
    return {
      key: configKeyFilter,
      providerCount: 0,
      reasonCodeCount: 0,
      matchedItemCount: matchedItems.length,
      providers: [],
      reasonCodes: [],
    };
  }

  const resolvedSummaryItem = summaryItem;
  return {
    key: resolvedSummaryItem.key,
    providerCount: resolvedSummaryItem.providers.length,
    reasonCodeCount: resolvedSummaryItem.reasonCodes.length,
    matchedItemCount: matchedItems.length,
    providers: resolvedSummaryItem.providers,
    reasonCodes: resolvedSummaryItem.reasonCodes,
  };
}

export function deriveCapabilityPreflightReasonCodeSummary(
  items: CapabilityProviderPreflightItemList,
): CapabilityPreflightReasonCodeSummaryModel {
  const summaryByReasonCode = new Map<CapabilityPreflightReasonCode, {
    providers: Set<CapabilityPreflightProviderName>;
    configKeys: Set<CapabilityPreflightConfigKey>;
    nextActions: Set<CapabilityPreflightNextAction>;
  }>();

  for (const item of sortCapabilityPreflightItems(items)) {
    const reasonCode: CapabilityPreflightReasonCode = item.reason_code.trim();
    const hasReasonCode = reasonCode.length > 0;
    if (hasReasonCode === false) {
      continue;
    }

    const current = summaryByReasonCode.get(reasonCode) ?? {
      providers: new Set<CapabilityPreflightProviderName>(),
      configKeys: new Set<CapabilityPreflightConfigKey>(),
      nextActions: new Set<CapabilityPreflightNextAction>(),
    };
    current.providers.add(item.provider);
    for (const key of getCapabilityPreflightConfigKeys(item.metadata)) {
      current.configKeys.add(key);
    }
    if (item.next_action.trim()) {
      current.nextActions.add(item.next_action.trim());
    }
    summaryByReasonCode.set(reasonCode, current);
  }

  const summaryItems: CapabilityPreflightReasonCodeSummaryItem[] = [];
  for (const [reasonCode, value] of summaryByReasonCode) {
    summaryItems.push({
      reasonCode,
      providers: getSortedCapabilityPreflightValues(value.providers),
      configKeys: getSortedCapabilityPreflightValues(value.configKeys),
      nextActions: getSortedCapabilityPreflightValues(value.nextActions),
    });
  }
  summaryItems.sort((left, right) => left.reasonCode.localeCompare(right.reasonCode));

  return {
    items: summaryItems,
    affectedReasonCodeCount: summaryItems.length,
  };
}

export function deriveCapabilityPreflightFocusedReasonCodeSummary(
  summary: CapabilityPreflightReasonCodeSummaryModel,
  reasonCodeFilter: CapabilityPreflightReasonCodeFilter,
  matchedItems: CapabilityProviderPreflightItemList,
): CapabilityPreflightFocusedReasonCodeSummaryModel {
  if (reasonCodeFilter === 'all') {
    return null;
  }

  let summaryItem: CapabilityPreflightReasonCodeSummaryItem | undefined;
  for (const item of summary.items) {
    const isMatched = item.reasonCode === reasonCodeFilter;
    if (isMatched === true) {
      summaryItem = item;
      break;
    }
  }
  const hasSummaryItem = summaryItem !== undefined;
  if (hasSummaryItem === false || summaryItem === undefined) {
    return {
      reasonCode: reasonCodeFilter,
      providerCount: 0,
      configKeyCount: 0,
      matchedItemCount: matchedItems.length,
      providers: [],
      configKeys: [],
    };
  }

  const resolvedSummaryItem = summaryItem;
  return {
    reasonCode: resolvedSummaryItem.reasonCode,
    providerCount: resolvedSummaryItem.providers.length,
    configKeyCount: resolvedSummaryItem.configKeys.length,
    matchedItemCount: matchedItems.length,
    providers: resolvedSummaryItem.providers,
    configKeys: resolvedSummaryItem.configKeys,
  };
}
