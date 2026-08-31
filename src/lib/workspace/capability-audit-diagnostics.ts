import type {
  CapabilityExecutionAuditCapabilityProfile,
  CapabilityExecutionAuditCreatedAt,
  CapabilityExecutionAuditRecord,
  CapabilityExecutionAuditSourceNote,
  CapabilityExecutionAuditStatus,
  CapabilityExecutionAuditWorkflowMode,
  CapabilityExecutionAuditWorkflowStage,
} from '@/lib/api';

export type CapabilityAuditDistributionItem = {
  label: string;
  count: number;
};
export type CapabilityAuditDistributionItemList = CapabilityAuditDistributionItem[];
export type CapabilityAuditDistributionCountMap = Map<string, number>;
export type CapabilityAuditStatusCounts = {
  [status in CapabilityExecutionAuditStatus]: number;
};
export type CapabilityAuditExecutionResultRawObject = {
  [fieldName: string]: unknown;
};
export type CapabilityAuditExecutionResultItemList = unknown[];
export type CapabilityAuditRecordReasonCode = string;
export type CapabilityAuditLatestRecord = {
  id: number;
  status: CapabilityExecutionAuditStatus;
  reason: CapabilityAuditRecordReasonCode;
  sourceNote: CapabilityExecutionAuditSourceNote;
  createdAt?: CapabilityExecutionAuditCreatedAt;
  capabilityProfile: CapabilityExecutionAuditCapabilityProfile;
  workflowStage: CapabilityExecutionAuditWorkflowStage;
  workflowMode: CapabilityExecutionAuditWorkflowMode;
};

export type CapabilityAuditSearchParamKey = string;
export type CapabilityAuditStatusFilter = 'all' | 'executed' | 'blocked' | 'deferred' | 'skipped' | 'unknown';
export type CapabilityAuditProfileFilter = string;
export type CapabilityAuditReasonFilter = string;
export type CapabilityAuditActiveFilterLabel = string;
export type CapabilityAuditActiveFilterLabelList = CapabilityAuditActiveFilterLabel[];
export type CapabilityAuditRuntimeSourceLabel = string;
export type CapabilityAuditRuntimeSourceLabelList = CapabilityAuditRuntimeSourceLabel[];
export type CapabilityAuditProfileFilterOption = CapabilityAuditProfileFilter;
export type CapabilityAuditProfileFilterOptionList = CapabilityAuditProfileFilterOption[];
export type CapabilityAuditProfileFilterOptionSet = Set<CapabilityAuditProfileFilterOption>;
export type CapabilityAuditReasonFilterOption = CapabilityAuditReasonFilter;
export type CapabilityAuditReasonFilterOptionList = CapabilityAuditReasonFilterOption[];
export type CapabilityAuditReasonFilterOptionSet = Set<CapabilityAuditReasonFilterOption>;

export const DEFAULT_CAPABILITY_AUDIT_PROFILE_FILTER_OPTIONS: CapabilityAuditProfileFilterOptionList = ['all'];
export const DEFAULT_CAPABILITY_AUDIT_REASON_FILTER_OPTIONS: CapabilityAuditReasonFilterOptionList = ['all'];

export const CAPABILITY_AUDIT_STATUS_QUERY_PARAM: CapabilityAuditSearchParamKey = 'capability_status';
export const CAPABILITY_AUDIT_PROFILE_QUERY_PARAM: CapabilityAuditSearchParamKey = 'capability_profile';
export const CAPABILITY_AUDIT_REASON_QUERY_PARAM: CapabilityAuditSearchParamKey = 'capability_reason';

export type CapabilityAuditDiagnosticsSummary = {
  loadedRecordCount: number;
  totalRecordCount: number;
  statusCounts: CapabilityAuditStatusCounts;
  executedCount: number;
  blockedCount: number;
  deferredCount: number;
  skippedCount: number;
  unknownCount: number;
  latestRecord: CapabilityAuditLatestRecord | null;
  capabilityProfiles: CapabilityAuditDistributionItemList;
  reasonCodes: CapabilityAuditDistributionItemList;
};

export type CapabilityAuditActiveFilterSummary = {
  activeFilterCount: number;
  sourceContextCount: number;
  statusFilter: CapabilityAuditStatusFilter;
  profileFilter: CapabilityAuditProfileFilter;
  reasonFilter: CapabilityAuditReasonFilter;
  matchedRecordCount: number;
  loadedRecordCount: number;
  totalRecordCount: number;
  matchSummary: string;
  sourceSummary: string;
  activeLabels: CapabilityAuditActiveFilterLabelList;
  runtimeSourceLabels: CapabilityAuditRuntimeSourceLabelList;
};

function isCapabilityAuditExecutionResultRawObject(value: unknown): value is CapabilityAuditExecutionResultRawObject {
  if (value === null) {
    return false;
  }

  const hasObject = typeof value === 'object';
  const hasArray = Array.isArray(value);
  return hasObject === true && hasArray === false;
}

function readCapabilityAuditExecutionResultRawObject(value: unknown): CapabilityAuditExecutionResultRawObject {
  const hasRawObject = isCapabilityAuditExecutionResultRawObject(value);
  if (hasRawObject === false) {
    return {};
  }

  return value;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasCapabilityAuditQueryValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function getCapabilityAuditFilterValue(value?: string | null): string {
  const normalizedValue = readString(value);
  const hasValue = hasCapabilityAuditQueryValue(normalizedValue);
  if (hasValue === false) {
    return 'all';
  }

  return normalizedValue;
}

function shouldDeleteCapabilityAuditSearchParamValue(value: string): boolean {
  const hasValue = hasCapabilityAuditQueryValue(value);
  const isAllValue = value === 'all';
  return hasValue === false || isAllValue === true;
}

function getCapabilityAuditSearch(searchParams: URLSearchParams): string {
  const nextSearch = searchParams.toString();
  const hasNextSearch = hasCapabilityAuditQueryValue(nextSearch);
  if (hasNextSearch === false) {
    return '';
  }

  return `?${nextSearch}`;
}

function getCapabilityAuditDisplayValue(value: string, fallback: string): string {
  const hasValue = value.length > 0;
  if (hasValue === false) {
    return fallback;
  }

  return value;
}

function getCapabilityAuditFallbackValue(values: string[], fallback: string): string {
  for (const value of values) {
    const hasValue = value.length > 0;
    if (hasValue === true) {
      return value;
    }
  }

  return fallback;
}

function getCapabilityAuditExecutionResultItems(value: unknown): CapabilityAuditExecutionResultItemList {
  const hasItems = Array.isArray(value);
  if (hasItems === false) {
    return [];
  }

  return value;
}

function getCapabilityAuditFirstExecutionResultItem(
  items: CapabilityAuditExecutionResultItemList,
): CapabilityAuditExecutionResultRawObject {
  for (const item of items) {
    return readCapabilityAuditExecutionResultRawObject(item);
  }

  return {};
}

function getCapabilityAuditRecordStatusValue(
  record: CapabilityExecutionAuditRecord,
): CapabilityExecutionAuditStatus {
  return getCapabilityAuditDisplayValue(readString(record.status), 'unknown');
}

function getCapabilityAuditRecordProfileValue(
  record: CapabilityExecutionAuditRecord,
): CapabilityExecutionAuditCapabilityProfile {
  return getCapabilityAuditDisplayValue(readString(record.capability_profile), 'default-profile');
}

function getCapabilityAuditRecordWorkflowStageValue(
  record: CapabilityExecutionAuditRecord,
): CapabilityExecutionAuditWorkflowStage {
  return getCapabilityAuditDisplayValue(readString(record.workflow_stage), 'unknown-stage');
}

function getCapabilityAuditRecordWorkflowModeValue(
  record: CapabilityExecutionAuditRecord,
): CapabilityExecutionAuditWorkflowMode {
  return getCapabilityAuditDisplayValue(readString(record.workflow_mode), 'unknown-mode');
}

function getCapabilityAuditRuntimeSourceLabelInput(
  labels: CapabilityAuditRuntimeSourceLabelList | undefined,
): CapabilityAuditRuntimeSourceLabelList {
  const hasLabels = labels !== undefined;
  if (hasLabels === false) {
    return [];
  }

  return labels;
}

function hasCapabilityAuditRuntimeSourceLabel(label: CapabilityAuditRuntimeSourceLabel): boolean {
  const hasLabel = label.length > 0;
  return hasLabel === true;
}

function getCapabilityAuditRuntimeSourceLabels(
  labels: CapabilityAuditRuntimeSourceLabelList | undefined,
): CapabilityAuditRuntimeSourceLabelList {
  const runtimeSourceLabelInput = getCapabilityAuditRuntimeSourceLabelInput(labels);
  const runtimeSourceLabels: CapabilityAuditRuntimeSourceLabelList = [];
  for (const label of runtimeSourceLabelInput) {
    const normalizedLabel = readString(label);
    const hasLabel = hasCapabilityAuditRuntimeSourceLabel(normalizedLabel);
    if (hasLabel === true) {
      runtimeSourceLabels.push(normalizedLabel);
    }
  }

  return runtimeSourceLabels;
}

function getCapabilityAuditRuntimeSourceSummary(
  labels: CapabilityAuditRuntimeSourceLabelList,
): string {
  const hasRuntimeSourceLabels = labels.length > 0;
  if (hasRuntimeSourceLabels === false) {
    return '无外部诊断来源';
  }

  return `来源 ${labels.join(' / ')}`;
}

function getCapabilityAuditCreatedAtSortValue(value: CapabilityExecutionAuditCreatedAt | undefined): string {
  const hasValue = value !== undefined;
  if (hasValue === false) {
    return '';
  }

  return value;
}

function hasCapabilityAuditCreatedAtDisplayValue(
  value: CapabilityExecutionAuditCreatedAt | undefined,
): value is CapabilityExecutionAuditCreatedAt {
  if (value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function sortDistributionItems(items: CapabilityAuditDistributionItemList): CapabilityAuditDistributionItemList {
  return [...items].sort((left, right) => {
    const countDiff = right.count - left.count;
    if (countDiff !== 0) return countDiff;
    return left.label.localeCompare(right.label);
  });
}

function getCapabilityAuditDistributionItems(
  counts: CapabilityAuditDistributionCountMap,
): CapabilityAuditDistributionItemList {
  const items: CapabilityAuditDistributionItemList = [];
  for (const [label, count] of counts) {
    items.push({ label, count });
  }

  return items;
}

function getCapabilityAuditStatusCount(
  counts: CapabilityAuditStatusCounts,
  status: CapabilityExecutionAuditStatus,
): number {
  const count = counts[status];
  if (count === undefined) {
    return 0;
  }

  return count;
}

function addCapabilityAuditStatusCount(
  counts: CapabilityAuditStatusCounts,
  status: CapabilityExecutionAuditStatus,
) {
  const count = getCapabilityAuditStatusCount(counts, status);
  counts[status] = count + 1;
}

function getCapabilityAuditDistributionCount(
  counts: CapabilityAuditDistributionCountMap,
  label: string,
): number {
  const count = counts.get(label);
  if (count === undefined) {
    return 0;
  }

  return count;
}

function addCapabilityAuditDistributionCount(
  counts: CapabilityAuditDistributionCountMap,
  label: string,
) {
  const count = getCapabilityAuditDistributionCount(counts, label);
  counts.set(label, count + 1);
}

function getCapabilityAuditNonNegativeCount(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return Math.max(0, fallback);
  }

  return Math.max(0, value);
}

function materializeCapabilityAuditLatestRecord(
  record: CapabilityExecutionAuditRecord | undefined,
): CapabilityAuditLatestRecord | null {
  if (record === undefined) {
    return null;
  }

  return {
    id: record.id,
    status: getCapabilityAuditRecordStatusValue(record),
    reason: getCapabilityAuditRecordReason(record),
    sourceNote: getCapabilityAuditRecordSourceNote(record),
    createdAt: record.created_at,
    capabilityProfile: getCapabilityAuditRecordProfileValue(record),
    workflowStage: getCapabilityAuditRecordWorkflowStageValue(record),
    workflowMode: getCapabilityAuditRecordWorkflowModeValue(record),
  };
}

function getCapabilityAuditLatestSortedRecord(
  sortedRecords: CapabilityExecutionAuditRecord[],
): CapabilityExecutionAuditRecord | undefined {
  for (const record of sortedRecords) {
    return record;
  }

  return undefined;
}

function addCapabilityAuditFilterOption(
  values: Set<string>,
  option: string,
) {
  const normalizedOption = readString(option);
  const hasOption = hasCapabilityAuditQueryValue(normalizedOption);
  if (hasOption === true) {
    values.add(normalizedOption);
  }
}

function addCapabilityAuditFilterOptions(
  values: Set<string>,
  items: CapabilityAuditDistributionItemList,
) {
  for (const item of items) {
    addCapabilityAuditFilterOption(values, item.label);
  }
}

export function normalizeCapabilityAuditStatusFilter(value?: string | null): CapabilityAuditStatusFilter {
  switch (readString(value)) {
    case 'executed':
      return 'executed';
    case 'blocked':
      return 'blocked';
    case 'deferred':
      return 'deferred';
    case 'skipped':
      return 'skipped';
    case 'unknown':
      return 'unknown';
    default:
      return 'all';
  }
}

export function normalizeCapabilityAuditProfileFilter(value?: string | null): CapabilityAuditProfileFilter {
  return getCapabilityAuditFilterValue(value);
}

export function normalizeCapabilityAuditReasonFilter(value?: string | null): CapabilityAuditReasonFilter {
  return getCapabilityAuditFilterValue(value);
}

function updateCapabilityAuditSearchParam(search: string, key: CapabilityAuditSearchParamKey, value: string): string {
  const searchParams = new URLSearchParams(search);
  const normalizedValue = readString(value);
  const shouldDeleteParam = shouldDeleteCapabilityAuditSearchParamValue(normalizedValue);
  if (shouldDeleteParam === true) {
    searchParams.delete(key);
  } else {
    searchParams.set(key, normalizedValue);
  }
  return getCapabilityAuditSearch(searchParams);
}

export function updateCapabilityAuditStatusSearch(search: string, filter: CapabilityAuditStatusFilter): string {
  return updateCapabilityAuditSearchParam(search, CAPABILITY_AUDIT_STATUS_QUERY_PARAM, filter);
}

export function updateCapabilityAuditProfileSearch(search: string, filter: CapabilityAuditProfileFilter): string {
  return updateCapabilityAuditSearchParam(search, CAPABILITY_AUDIT_PROFILE_QUERY_PARAM, filter);
}

export function updateCapabilityAuditReasonSearch(search: string, filter: CapabilityAuditReasonFilter): string {
  return updateCapabilityAuditSearchParam(search, CAPABILITY_AUDIT_REASON_QUERY_PARAM, filter);
}

export function clearCapabilityAuditFilterSearch(search: string): string {
  const searchParams = new URLSearchParams(search);
  searchParams.delete(CAPABILITY_AUDIT_STATUS_QUERY_PARAM);
  searchParams.delete(CAPABILITY_AUDIT_PROFILE_QUERY_PARAM);
  searchParams.delete(CAPABILITY_AUDIT_REASON_QUERY_PARAM);
  return getCapabilityAuditSearch(searchParams);
}

export function buildCapabilityAuditProfileFilterOptions(
  items: CapabilityAuditDistributionItem[],
  currentFilter: CapabilityAuditProfileFilter,
): CapabilityAuditProfileFilterOptionList {
  const values: CapabilityAuditProfileFilterOptionSet = new Set(DEFAULT_CAPABILITY_AUDIT_PROFILE_FILTER_OPTIONS);
  if (currentFilter !== 'all') {
    addCapabilityAuditFilterOption(values, currentFilter);
  }
  addCapabilityAuditFilterOptions(values, items);
  return [...values];
}

export function buildCapabilityAuditReasonFilterOptions(
  items: CapabilityAuditDistributionItem[],
  currentFilter: CapabilityAuditReasonFilter,
): CapabilityAuditReasonFilterOptionList {
  const values: CapabilityAuditReasonFilterOptionSet = new Set(DEFAULT_CAPABILITY_AUDIT_REASON_FILTER_OPTIONS);
  if (currentFilter !== 'all') {
    addCapabilityAuditFilterOption(values, currentFilter);
  }
  addCapabilityAuditFilterOptions(values, items);
  return [...values];
}

export function deriveCapabilityAuditActiveFilterSummary(filters: {
  statusFilter: CapabilityAuditStatusFilter;
  profileFilter: CapabilityAuditProfileFilter;
  reasonFilter: CapabilityAuditReasonFilter;
  runtimeSourceLabels?: CapabilityAuditRuntimeSourceLabelList;
  matchedRecordCount?: number;
  loadedRecordCount?: number;
  totalRecordCount?: number;
}): CapabilityAuditActiveFilterSummary {
  const activeLabels: CapabilityAuditActiveFilterLabelList = [];
  if (filters.statusFilter !== 'all') {
    activeLabels.push(`status=${filters.statusFilter}`);
  }
  if (filters.profileFilter !== 'all') {
    activeLabels.push(`profile=${filters.profileFilter}`);
  }
  if (filters.reasonFilter !== 'all') {
    activeLabels.push(`reason=${filters.reasonFilter}`);
  }
  const runtimeSourceLabels = getCapabilityAuditRuntimeSourceLabels(filters.runtimeSourceLabels);
  const matchedRecordCount = getCapabilityAuditNonNegativeCount(filters.matchedRecordCount, 0);
  const loadedRecordCount = getCapabilityAuditNonNegativeCount(filters.loadedRecordCount, matchedRecordCount);
  const totalRecordCount = getCapabilityAuditNonNegativeCount(filters.totalRecordCount, loadedRecordCount);
  return {
    activeFilterCount: activeLabels.length,
    sourceContextCount: runtimeSourceLabels.length,
    statusFilter: filters.statusFilter,
    profileFilter: filters.profileFilter,
    reasonFilter: filters.reasonFilter,
    matchedRecordCount,
    loadedRecordCount,
    totalRecordCount,
    matchSummary: `命中 ${matchedRecordCount} / 已加载 ${loadedRecordCount} / 总计 ${totalRecordCount}`,
    sourceSummary: getCapabilityAuditRuntimeSourceSummary(runtimeSourceLabels),
    activeLabels,
    runtimeSourceLabels,
  };
}

export function getCapabilityAuditRecordReason(record: CapabilityExecutionAuditRecord): CapabilityAuditRecordReasonCode {
  const executionResult = readCapabilityAuditExecutionResultRawObject(record.execution_result);
  const items = getCapabilityAuditExecutionResultItems(executionResult.items);
  const firstItem = getCapabilityAuditFirstExecutionResultItem(items);
  return getCapabilityAuditFallbackValue(
    [
      readString(firstItem.reason_code),
      readString(executionResult.reason_code),
      readString(record.status),
    ],
    'unknown',
  );
}

export function getCapabilityAuditRecordSourceNote(record: CapabilityExecutionAuditRecord): CapabilityExecutionAuditSourceNote {
  const executionResult = readCapabilityAuditExecutionResultRawObject(record.execution_result);
  const items = getCapabilityAuditExecutionResultItems(executionResult.items);
  const firstItem = getCapabilityAuditFirstExecutionResultItem(items);
  return getCapabilityAuditFallbackValue(
    [
      readString(firstItem.source_note),
      readString(executionResult.source_note),
      readString(record.source_note),
    ],
    '暂无来源说明',
  );
}

export function formatCapabilityAuditTime(value?: CapabilityExecutionAuditCreatedAt): string {
  const hasValue = hasCapabilityAuditCreatedAtDisplayValue(value);
  if (hasValue === false) {
    return '未知时间';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function deriveCapabilityAuditDiagnosticsSummary(
  records: CapabilityExecutionAuditRecord[],
  totalRecordCount = records.length,
): CapabilityAuditDiagnosticsSummary {
  const statusCounts: CapabilityAuditStatusCounts = {};
  const profileCounts: CapabilityAuditDistributionCountMap = new Map<CapabilityExecutionAuditCapabilityProfile, number>();
  const reasonCounts: CapabilityAuditDistributionCountMap = new Map<CapabilityAuditRecordReasonCode, number>();
  const sortedRecords = [...records].sort((left, right) => {
    const rightCreatedAt = getCapabilityAuditCreatedAtSortValue(right.created_at);
    const leftCreatedAt = getCapabilityAuditCreatedAtSortValue(left.created_at);
    return rightCreatedAt.localeCompare(leftCreatedAt);
  });

  for (const record of sortedRecords) {
    const status = getCapabilityAuditRecordStatusValue(record);
    addCapabilityAuditStatusCount(statusCounts, status);

    const profile = getCapabilityAuditRecordProfileValue(record);
    addCapabilityAuditDistributionCount(profileCounts, profile);

    const reason = getCapabilityAuditRecordReason(record);
    addCapabilityAuditDistributionCount(reasonCounts, reason);
  }

  const latest = getCapabilityAuditLatestSortedRecord(sortedRecords);

  return {
    loadedRecordCount: records.length,
    totalRecordCount,
    statusCounts,
    executedCount: getCapabilityAuditStatusCount(statusCounts, 'executed'),
    blockedCount: getCapabilityAuditStatusCount(statusCounts, 'blocked'),
    deferredCount: getCapabilityAuditStatusCount(statusCounts, 'deferred'),
    skippedCount: getCapabilityAuditStatusCount(statusCounts, 'skipped'),
    unknownCount: getCapabilityAuditStatusCount(statusCounts, 'unknown'),
    latestRecord: materializeCapabilityAuditLatestRecord(latest),
    capabilityProfiles: sortDistributionItems(
      getCapabilityAuditDistributionItems(profileCounts),
    ),
    reasonCodes: sortDistributionItems(
      getCapabilityAuditDistributionItems(reasonCounts),
    ),
  };
}
