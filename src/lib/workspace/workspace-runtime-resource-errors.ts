import { formatUserVisibleApiError } from '@/lib/api-error-display';
import type { ProjectRuntimeStatus } from '@/lib/api';

export type WorkspaceRuntimeResourceFailureSegment = string;
export type WorkspaceRuntimeResourceFailureSegmentList = WorkspaceRuntimeResourceFailureSegment[];
export type WorkspaceRuntimeResourceFailureMessage = string;

export function formatWorkspaceRuntimeResourceFailure(error: unknown, fallback = '请稍后重试') {
  return formatUserVisibleApiError(error, fallback);
}

function hasWorkspaceRuntimeResourceValue(value: string | undefined): value is string {
  if (value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getWorkspaceRuntimeResourceFallbackValue(
  value: string | undefined,
  fallback: string,
): string {
  const hasValue = hasWorkspaceRuntimeResourceValue(value);
  if (hasValue === false) {
    return fallback;
  }

  return value;
}

function getRuntimeStatusFailureSegment({
  key,
  value,
}: {
  key: string;
  value: string | undefined;
}): WorkspaceRuntimeResourceFailureSegment | undefined {
  const hasValue = hasWorkspaceRuntimeResourceValue(value);
  if (hasValue === false) {
    return undefined;
  }

  return `${key}=${value}`;
}

function getRuntimeStatusFailureMessage(
  status: ProjectRuntimeStatus,
  fallbackMessage: WorkspaceRuntimeResourceFailureMessage,
): WorkspaceRuntimeResourceFailureMessage {
  const errorMessage = getWorkspaceRuntimeResourceFallbackValue(status.error, '');
  const hasErrorMessage = hasWorkspaceRuntimeResourceValue(errorMessage);
  if (hasErrorMessage === true) {
    return errorMessage;
  }

  return getWorkspaceRuntimeResourceFallbackValue(status.message, fallbackMessage);
}

function formatRuntimeStatusFailureDetails(projectId: string, status: ProjectRuntimeStatus) {
  const statusProjectId = getWorkspaceRuntimeResourceFallbackValue(status.projectId, projectId);
  const segments: WorkspaceRuntimeResourceFailureSegmentList = [
    `project_id=${statusProjectId}`,
    `status=${status.status}`,
  ];
  const optionalSegments: Array<WorkspaceRuntimeResourceFailureSegment | undefined> = [
    getRuntimeStatusFailureSegment({ key: 'phase', value: status.phase }),
    getRuntimeStatusFailureSegment({ key: 'container_status', value: status.containerStatus }),
    getRuntimeStatusFailureSegment({
      key: 'container_status_persistence',
      value: status.containerStatusPersistence,
    }),
    getRuntimeStatusFailureSegment({
      key: 'container_status_persistence_error',
      value: status.containerStatusPersistenceError,
    }),
    getRuntimeStatusFailureSegment({ key: 'persistence_status', value: status.persistenceStatus }),
    getRuntimeStatusFailureSegment({ key: 'persistence_error', value: status.persistenceError }),
    getRuntimeStatusFailureSegment({ key: 'error', value: status.error }),
    getRuntimeStatusFailureSegment({ key: 'message', value: status.message }),
  ];

  for (const segment of optionalSegments) {
    const hasSegment = segment !== undefined;
    if (hasSegment === true) {
      segments.push(segment);
    }
  }

  return segments.join('；');
}

export function buildRuntimeStatusFailureError(
  projectId: string,
  status: ProjectRuntimeStatus,
  fallbackMessage = '开发环境准备失败',
) {
  const message = getRuntimeStatusFailureMessage(status, fallbackMessage);
  return Object.assign(new Error(message), {
    source: 'runtime_status_snapshot',
    details: formatRuntimeStatusFailureDetails(projectId, status),
  });
}

export function buildRuntimeStatusWaitTimeoutError(projectId: string, maxAttempts: number) {
  return Object.assign(new Error('开发环境准备超时，请检查网络或 apt 源配置'), {
    source: 'runtime_status_wait',
    details: `project_id=${projectId}；max_attempts=${maxAttempts}；poll_interval_ms=5000`,
  });
}

export function buildProjectDetailFileTreeParseError(projectId: string, stage: string) {
  return Object.assign(new Error('项目详情 file_tree 字段不是有效的文件树结构'), {
    source: 'project_detail_file_tree_parse',
    details: `project_id=${projectId}；stage=${stage}；field=file_tree`,
  });
}
