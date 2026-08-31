import type { AuditLog } from '@/lib/admin/api';

export const ADMIN_AUDIT_ACTION_QUERY_PARAM = 'audit_action';
export const ADMIN_AUDIT_TARGET_TYPE_QUERY_PARAM = 'audit_target_type';

export type AdminAuditFilterValue = string | 'all';

export type AdminAuditActionName = string;
export type AdminAuditTargetTypeName = string;

export type AdminAuditActionCount = {
  action: AdminAuditActionName;
  count: number;
};

export type AdminAuditActionCountList = AdminAuditActionCount[];
export type AdminAuditActionCountMap = Map<AdminAuditActionName, number>;

export type AdminAuditTargetTypeCount = {
  targetType: AdminAuditTargetTypeName;
  count: number;
};

export type AdminAuditTargetTypeCountList = AdminAuditTargetTypeCount[];
export type AdminAuditTargetTypeCountMap = Map<AdminAuditTargetTypeName, number>;

export type AdminAuditDiagnosticsSummaryModel = {
  totalLogCount: number;
  actionCount: number;
  targetTypeCount: number;
  latestAction: string | null;
  latestTargetType: string | null;
  latestAt: string | null;
  topActions: AdminAuditActionCountList;
  targetTypes: AdminAuditTargetTypeCountList;
};

export type AdminAuditFilterState = {
  actionFilter: AdminAuditFilterValue;
  targetTypeFilter: AdminAuditFilterValue;
};

export type AdminAuditActiveFilterLabel = string;
export type AdminAuditActiveFilterLabelList = AdminAuditActiveFilterLabel[];

export type AdminAuditActiveFilterSummary = {
  activeFilterCount: number;
  matchedLogCount: number;
  totalLogCount: number;
  activeLabels: AdminAuditActiveFilterLabelList;
};

export type AdminAuditSortableCountEntry = {
  count: number;
  [fieldName: string]: string | number;
};

function sortCountEntries<T extends AdminAuditSortableCountEntry>(
  entries: T[],
  labelKey: keyof T,
): T[] {
  return [...entries].sort((left, right) => {
    const countDiff = right.count - left.count;
    if (countDiff !== 0) return countDiff;
    return String(left[labelKey]).localeCompare(String(right[labelKey]));
  });
}

function readString(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeAdminAuditFilterValue(value?: string | null): AdminAuditFilterValue {
  const normalizedValue = readString(value);
  const hasNormalizedValue = normalizedValue.length > 0;
  const isAllFilter = normalizedValue === 'all';
  return hasNormalizedValue === true && isAllFilter === false ? normalizedValue : 'all';
}

function updateAdminAuditSearchParam(search: string, key: string, value?: string | null): string {
  const searchParams = new URLSearchParams(search);
  const normalizedValue = readString(value);
  const hasNormalizedValue = normalizedValue.length > 0;
  const isAllFilter = normalizedValue === 'all';
  if (hasNormalizedValue === false || isAllFilter === true) {
    searchParams.delete(key);
  } else {
    searchParams.set(key, normalizedValue);
  }

  const nextSearch = searchParams.toString();
  return nextSearch ? `?${nextSearch}` : '';
}

export function updateAdminAuditActionSearch(search: string, actionFilter: AdminAuditFilterValue): string {
  return updateAdminAuditSearchParam(search, ADMIN_AUDIT_ACTION_QUERY_PARAM, actionFilter);
}

export function updateAdminAuditTargetTypeSearch(search: string, targetTypeFilter: AdminAuditFilterValue): string {
  return updateAdminAuditSearchParam(search, ADMIN_AUDIT_TARGET_TYPE_QUERY_PARAM, targetTypeFilter);
}

export function clearAdminAuditFilterSearch(search: string): string {
  const searchParams = new URLSearchParams(search);
  searchParams.delete(ADMIN_AUDIT_ACTION_QUERY_PARAM);
  searchParams.delete(ADMIN_AUDIT_TARGET_TYPE_QUERY_PARAM);

  const nextSearch = searchParams.toString();
  return nextSearch ? `?${nextSearch}` : '';
}

export function filterAdminAuditLogs(
  logs: AuditLog[],
  filters: AdminAuditFilterState,
): AuditLog[] {
  const filteredLogs: AuditLog[] = [];

  for (const log of logs) {
    const shouldIncludeLog = shouldIncludeAdminAuditLog(log, filters);
    if (shouldIncludeLog === true) {
      filteredLogs.push(log);
    }
  }

  return filteredLogs;
}

function shouldIncludeAdminAuditLog(log: AuditLog, filters: AdminAuditFilterState): boolean {
  const actionMatched = filters.actionFilter === 'all' || log.action.trim() === filters.actionFilter;
  const targetTypeMatched = filters.targetTypeFilter === 'all' || log.target_type.trim() === filters.targetTypeFilter;
  return actionMatched === true && targetTypeMatched === true;
}

export function deriveAdminAuditActiveFilterSummary(
  totalLogs: AuditLog[],
  matchedLogs: AuditLog[],
  filters: AdminAuditFilterState,
): AdminAuditActiveFilterSummary {
  const activeLabels: AdminAuditActiveFilterLabelList = [];
  const hasActionFilter = filters.actionFilter !== 'all';
  const hasTargetTypeFilter = filters.targetTypeFilter !== 'all';
  if (hasActionFilter === true) {
    activeLabels.push(`${ADMIN_AUDIT_ACTION_QUERY_PARAM}=${filters.actionFilter}`);
  }
  if (hasTargetTypeFilter === true) {
    activeLabels.push(`${ADMIN_AUDIT_TARGET_TYPE_QUERY_PARAM}=${filters.targetTypeFilter}`);
  }

  return {
    activeFilterCount: activeLabels.length,
    matchedLogCount: matchedLogs.length,
    totalLogCount: totalLogs.length,
    activeLabels,
  };
}

function getAdminAuditLatestSortedLog(sortedLogs: AuditLog[]): AuditLog | undefined {
  for (const log of sortedLogs) {
    return log;
  }

  return undefined;
}

export function deriveAdminAuditDiagnosticsSummary(logs: AuditLog[]): AdminAuditDiagnosticsSummaryModel {
  const actionCounts: AdminAuditActionCountMap = new Map<AdminAuditActionName, number>();
  const targetTypeCounts: AdminAuditTargetTypeCountMap = new Map<AdminAuditTargetTypeName, number>();
  const sortedLogs = [...logs].sort((left, right) => right.created_at.localeCompare(left.created_at));
  const latestLog = getAdminAuditLatestSortedLog(sortedLogs);

  for (const log of sortedLogs) {
    const action: AdminAuditActionName = log.action.trim();
    const hasAction = action.length > 0;
    if (hasAction === true) {
      actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
    }

    const targetType: AdminAuditTargetTypeName = log.target_type.trim();
    const hasTargetType = targetType.length > 0;
    if (hasTargetType === true) {
      targetTypeCounts.set(targetType, (targetTypeCounts.get(targetType) ?? 0) + 1);
    }
  }

  const topActions = sortCountEntries(readAdminAuditActionCountList(actionCounts), 'action');
  const targetTypes = sortCountEntries(readAdminAuditTargetTypeCountList(targetTypeCounts), 'targetType');

  return {
    totalLogCount: logs.length,
    actionCount: actionCounts.size,
    targetTypeCount: targetTypeCounts.size,
    latestAction: latestLog?.action ?? null,
    latestTargetType: latestLog?.target_type ?? null,
    latestAt: latestLog?.created_at ?? null,
    topActions,
    targetTypes,
  };
}

function readAdminAuditActionCountList(
  actionCounts: AdminAuditActionCountMap,
): AdminAuditActionCountList {
  const actionCountList: AdminAuditActionCountList = [];

  for (const [action, count] of actionCounts) {
    actionCountList.push({ action, count });
  }

  return actionCountList;
}

function readAdminAuditTargetTypeCountList(
  targetTypeCounts: AdminAuditTargetTypeCountMap,
): AdminAuditTargetTypeCountList {
  const targetTypeCountList: AdminAuditTargetTypeCountList = [];

  for (const [targetType, count] of targetTypeCounts) {
    targetTypeCountList.push({ targetType, count });
  }

  return targetTypeCountList;
}
