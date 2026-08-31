import type {
  AdminAuditPageSnapshot,
  AdminAuditPageSnapshotSource,
  AdminAuditPageSnapshotStatus,
} from '../../workspace/workspace-types';
import type { AdminAuditTargetId } from '@/lib/admin/api';

type AdminAuditLogSnapshotInput = {
  action: string;
  target_type: string;
  target_id: AdminAuditTargetId;
  ip_address: string;
  created_at: string;
};

type AdminAuditLogSnapshotInputList = AdminAuditLogSnapshotInput[];
type AdminAuditSnapshotValue = string;
type AdminAuditSnapshotValueList = AdminAuditSnapshotValue[];
type AdminAuditSnapshotValueSelector = (log: AdminAuditLogSnapshotInput) => AdminAuditSnapshotValue;

function countUnique(values: AdminAuditSnapshotValueList) {
  const uniqueValues = new Set<AdminAuditSnapshotValue>();

  for (const value of values) {
    const normalizedValue = value.trim();
    const hasValue = normalizedValue.length > 0;
    if (hasValue === true) {
      uniqueValues.add(normalizedValue);
    }
  }

  return uniqueValues.size;
}

function countUniqueAdminAuditLogValues(
  logs: AdminAuditLogSnapshotInputList,
  selectValue: AdminAuditSnapshotValueSelector,
): number {
  const values: AdminAuditSnapshotValueList = [];

  for (const log of logs) {
    values.push(selectValue(log));
  }

  return countUnique(values);
}

function countAdminAuditLogsWithMissingTarget(logs: AdminAuditLogSnapshotInputList): number {
  let count = 0;

  for (const log of logs) {
    const hasTargetType = log.target_type.trim().length > 0;
    const hasTargetId = log.target_id.trim().length > 0;
    const hasMissingTarget = hasTargetType === false || hasTargetId === false;
    if (hasMissingTarget === true) {
      count += 1;
    }
  }

  return count;
}

function countAdminAuditLogsWithInvalidTimestamp(logs: AdminAuditLogSnapshotInputList): number {
  let count = 0;

  for (const log of logs) {
    const hasValidTimestamp = isValidTimestamp(log.created_at);
    if (hasValidTimestamp === false) {
      count += 1;
    }
  }

  return count;
}

function isValidTimestamp(value: string) {
  return value.length > 0 && Number.isNaN(new Date(value).getTime()) === false;
}

function getAdminAuditPageSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = value !== null && value !== undefined && value.length > 0;

  return hasValue === true ? value : fallback;
}

function getAdminAuditPageSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function getAdminAuditPageSnapshotLatestLog(
  logs: AdminAuditLogSnapshotInputList,
): AdminAuditLogSnapshotInput | undefined {
  for (const log of logs) {
    return log;
  }

  return undefined;
}

export function buildAdminAuditPageSnapshot({
  loading,
  error,
  logs,
}: {
  loading: boolean;
  error: string;
  logs: AdminAuditLogSnapshotInputList;
}): AdminAuditPageSnapshot {
  const hasError = error.length > 0;
  const logCount = logs.length;
  const actionCount = countUniqueAdminAuditLogValues(logs, (log) => log.action);
  const targetTypeCount = countUniqueAdminAuditLogValues(logs, (log) => log.target_type);
  const ipAddressCount = countUniqueAdminAuditLogValues(logs, (log) => log.ip_address);
  const missingTargetCount = countAdminAuditLogsWithMissingTarget(logs);
  const invalidTimestampCount = countAdminAuditLogsWithInvalidTimestamp(logs);
  const latestLog = getAdminAuditPageSnapshotLatestLog(logs);
  const canReload = loading === false;
  const hasMissingTargets = missingTargetCount > 0;
  const status: AdminAuditPageSnapshotStatus = loading === true
    ? 'loading'
    : hasError === true
      ? 'load_failed'
      : logCount === 0
        ? 'empty'
        : invalidTimestampCount > 0
          ? 'invalid_timestamp'
          : 'ready';
  const source: AdminAuditPageSnapshotSource = status === 'loading' || status === 'load_failed' || status === 'empty'
    ? 'audit_list'
    : status === 'invalid_timestamp'
      ? 'audit_timestamp'
      : hasMissingTargets === true
        ? 'audit_target'
        : 'audit_action';

  return {
    status,
    source,
    logCount,
    actionCount,
    targetTypeCount,
    ipAddressCount,
    missingTargetCount,
    invalidTimestampCount,
    latestAction: getAdminAuditPageSnapshotLabel(latestLog?.action, 'none'),
    latestTargetType: getAdminAuditPageSnapshotLabel(latestLog?.target_type, 'none'),
    isLoading: loading,
    hasError,
    canReload,
    message: status === 'loading'
      ? 'Admin Audit 正在加载审计日志。'
      : status === 'load_failed'
        ? 'Admin Audit 审计日志加载失败。'
        : status === 'empty'
          ? 'Admin Audit 当前没有审计日志可展示。'
          : status === 'invalid_timestamp'
            ? 'Admin Audit 已加载，但存在无法解析的审计时间。'
            : hasMissingTargets === true
              ? 'Admin Audit 已加载，但部分日志缺少目标信息。'
              : 'Admin Audit 已就绪。',
    recovery: status === 'loading'
      ? '等待最近 50 条审计日志请求返回。'
      : status === 'load_failed'
        ? '稍后刷新审计日志页或检查 Admin API 可用性。'
        : status === 'empty'
          ? '执行管理员操作后再回到审计页确认日志写入。'
          : status === 'invalid_timestamp'
            ? '核对后端审计日志 created_at 格式，避免把未知时间误判为最近操作。'
            : hasMissingTargets === true
              ? '核对审计写入方的 target_type 和 target_id，避免定位目标时依赖空字段。'
              : '可以继续查看最近操作、目标、详情和 IP 来源。',
    updatedAt: 'derived',
  };
}

function getAdminAuditSnapshotClassName(snapshot: AdminAuditPageSnapshot) {
  if (snapshot.status === 'load_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'loading') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (snapshot.status === 'empty' || snapshot.status === 'invalid_timestamp' || snapshot.missingTargetCount > 0) {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

export function AdminAuditPageSnapshotStrip({ snapshot }: { snapshot: AdminAuditPageSnapshot }) {
  const isLoadingLabel = getAdminAuditPageSnapshotBooleanLabel(snapshot.isLoading);
  const hasErrorLabel = getAdminAuditPageSnapshotBooleanLabel(snapshot.hasError);
  const canReloadLabel = getAdminAuditPageSnapshotBooleanLabel(snapshot.canReload);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-audit-page-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminAuditSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Audit 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Logs: {snapshot.logCount}</span>
        <span>Actions: {snapshot.actionCount}</span>
        <span>Targets: {snapshot.targetTypeCount}</span>
        <span>IPs: {snapshot.ipAddressCount}</span>
        <span>MissingTargets: {snapshot.missingTargetCount}</span>
        <span>InvalidTimes: {snapshot.invalidTimestampCount}</span>
        <span>LatestAction: {snapshot.latestAction}</span>
        <span>LatestTarget: {snapshot.latestTargetType}</span>
        <span>Loading: {isLoadingLabel}</span>
        <span>Error: {hasErrorLabel}</span>
        <span>Reload: {canReloadLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
