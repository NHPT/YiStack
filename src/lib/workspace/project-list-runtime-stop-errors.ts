import type { ProjectListOperationErrorDetails } from '@/lib/workspace/project-list-operation-errors';
import type { Project, ProjectContainerStopResponse, ProjectRuntimeStatus } from '@/lib/api';
import type {
  ProjectContainerStatusPersistenceStatus,
  ProjectContainerStopContainerStatus,
  ProjectContainerStopStatus,
  ProjectRuntimeLifecycleStatus,
  ProjectRuntimeStatusPersistenceStatus,
} from '@/lib/types';
import { formatProjectListOperationError } from '@/lib/workspace/project-list-operation-errors';

export type ProjectRuntimeStopFailureRawObject = {
  [fieldName: string]: unknown;
};
export type ProjectRuntimeStopSummarySegment = string;
export type ProjectRuntimeStopSummarySegmentList = ProjectRuntimeStopSummarySegment[];

type ProjectRuntimeStopFailureData = {
  stopStatus?: ProjectContainerStopStatus;
  containerStatus?: ProjectContainerStopContainerStatus;
  containerStatusPersistence?: ProjectContainerStatusPersistenceStatus;
  containerStatusPersistenceError?: string;
  runtimeStatus?: ProjectRuntimeStatus;
};

function readProjectRuntimeStopFailureRawObject(value: unknown): ProjectRuntimeStopFailureRawObject | null {
  const hasObject = value !== null && typeof value === 'object' && Array.isArray(value) === false;
  return hasObject === true
    ? value as ProjectRuntimeStopFailureRawObject
    : null;
}

function readString(record: ProjectRuntimeStopFailureRawObject | null, key: string) {
  const hasRecord = record !== null;
  if (hasRecord === false) {
    return '';
  }
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readOptionalString(record: ProjectRuntimeStopFailureRawObject | null, key: string): string | undefined {
  const value = readString(record, key);
  const hasValue = value.length > 0;
  if (hasValue === false) {
    return undefined;
  }

  return value;
}

function readOptionalNumber(record: ProjectRuntimeStopFailureRawObject | null, key: string): number | undefined {
  const hasRecord = record !== null;
  if (hasRecord === false) {
    return undefined;
  }

  const value = record[key];
  const hasNumber = typeof value === 'number';
  if (hasNumber === false) {
    return undefined;
  }

  const hasFiniteNumber = Number.isFinite(value);
  if (hasFiniteNumber === false) {
    return undefined;
  }

  return value;
}

function hasProjectRuntimeStopTextValue(value: string | undefined): value is string {
  if (value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function hasProjectRuntimeStopSummarySegment(segment: ProjectRuntimeStopSummarySegment): boolean {
  const hasSegment = segment.length > 0;
  return hasSegment === true;
}

function getProjectRuntimeStopSummarySegments(
  segments: ProjectRuntimeStopSummarySegmentList,
): ProjectRuntimeStopSummarySegmentList {
  const summarySegments: ProjectRuntimeStopSummarySegmentList = [];
  for (const segment of segments) {
    const hasSegment = hasProjectRuntimeStopSummarySegment(segment);
    if (hasSegment === true) {
      summarySegments.push(segment);
    }
  }

  return summarySegments;
}

function getProjectRuntimeStopSummarySegment({
  key,
  value,
}: {
  key: string;
  value: string | undefined;
}): ProjectRuntimeStopSummarySegment {
  const hasValue = hasProjectRuntimeStopTextValue(value);
  if (hasValue === false) {
    return '';
  }

  return `${key}=${value}`;
}

function getProjectRuntimeStopFallbackMessage(value: string | undefined, fallback: string): string {
  const hasValue = hasProjectRuntimeStopTextValue(value);
  if (hasValue === false) {
    return fallback;
  }

  return value;
}

function getProjectRuntimeStopNoticeProjectName(project: Project, result: ProjectContainerStopResponse): string {
  const projectName = readString({ name: project.name }, 'name');
  const hasProjectName = projectName.length > 0;
  if (hasProjectName === true) {
    return projectName;
  }

  return result.project_id;
}

function readProjectRuntimeStopErrorData(error: unknown): unknown {
  const record = readProjectRuntimeStopFailureRawObject(error);
  const hasRecord = record !== null;
  if (hasRecord === false) {
    return undefined;
  }

  return record.data;
}

function readProjectRuntimeStopStatusPersistence(
  runtimeStatus: ProjectRuntimeStatus | undefined,
): ProjectRuntimeStatusPersistenceStatus | undefined {
  const hasRuntimeStatus = runtimeStatus !== undefined;
  if (hasRuntimeStatus === false) {
    return undefined;
  }

  return runtimeStatus.persistenceStatus;
}

function readProjectRuntimeStopStatusPersistenceError(runtimeStatus: ProjectRuntimeStatus | undefined): string | undefined {
  const hasRuntimeStatus = runtimeStatus !== undefined;
  if (hasRuntimeStatus === false) {
    return undefined;
  }

  return runtimeStatus.persistenceError;
}

function readProjectRuntimeStopFailureRuntimeStatus(
  errorData: ProjectRuntimeStopFailureData | null,
): ProjectRuntimeStatus | undefined {
  const hasErrorData = errorData !== null;
  if (hasErrorData === false) {
    return undefined;
  }

  return errorData.runtimeStatus;
}

function readProjectRuntimeStopFailureStopStatus(
  errorData: ProjectRuntimeStopFailureData | null,
): ProjectContainerStopStatus | undefined {
  const hasErrorData = errorData !== null;
  if (hasErrorData === false) {
    return undefined;
  }

  return errorData.stopStatus;
}

function readProjectRuntimeStopFailureContainerStatus(
  errorData: ProjectRuntimeStopFailureData | null,
): ProjectContainerStopContainerStatus | undefined {
  const hasErrorData = errorData !== null;
  if (hasErrorData === false) {
    return undefined;
  }

  return errorData.containerStatus;
}

function readProjectRuntimeStopFailureContainerPersistence(
  errorData: ProjectRuntimeStopFailureData | null,
): ProjectContainerStatusPersistenceStatus | undefined {
  const hasErrorData = errorData !== null;
  if (hasErrorData === false) {
    return undefined;
  }

  return errorData.containerStatusPersistence;
}

function readProjectRuntimeStopFailureContainerPersistenceError(
  errorData: ProjectRuntimeStopFailureData | null,
): string | undefined {
  const hasErrorData = errorData !== null;
  if (hasErrorData === false) {
    return undefined;
  }

  return errorData.containerStatusPersistenceError;
}

function readProjectRuntimeLifecycleStatus(value: unknown): ProjectRuntimeLifecycleStatus | undefined {
  switch (value) {
    case 'stopped':
      return 'stopped';
    case 'starting':
      return 'starting';
    case 'preparing':
      return 'preparing';
    case 'ready':
      return 'ready';
    case 'failed':
      return 'failed';
    default:
      return undefined;
  }
}

function readProjectContainerStopStatus(value: unknown): ProjectContainerStopStatus | undefined {
  switch (value) {
    case 'stopped':
      return 'stopped';
    case 'failed':
      return 'failed';
    default:
      return undefined;
  }
}

function readProjectContainerStopContainerStatus(value: unknown): ProjectContainerStopContainerStatus | undefined {
  switch (value) {
    case 'stopped':
      return 'stopped';
    case 'unavailable':
      return 'unavailable';
    default:
      return undefined;
  }
}

function readProjectContainerStatusPersistenceStatus(value: unknown): ProjectContainerStatusPersistenceStatus | undefined {
  switch (value) {
    case 'updated':
      return 'updated';
    case 'failed':
      return 'failed';
    default:
      return undefined;
  }
}

function readProjectRuntimeStatusPersistenceStatus(value: unknown): ProjectRuntimeStatusPersistenceStatus | undefined {
  switch (value) {
    case 'persisted':
      return 'persisted';
    case 'failed':
      return 'failed';
    default:
      return undefined;
  }
}

function readProjectRuntimeStatus(value: unknown): ProjectRuntimeStatus | undefined {
  const record = readProjectRuntimeStopFailureRawObject(value);
  const hasRecord = record !== null;
  if (hasRecord === false) {
    return undefined;
  }

  const status = readProjectRuntimeLifecycleStatus(record.status);
  const hasStatus = status !== undefined;
  if (hasStatus === false) {
    return undefined;
  }

  return {
    projectId: readOptionalString(record, 'projectId'),
    taskId: readOptionalString(record, 'taskId'),
    status,
    containerStatus: readOptionalString(record, 'containerStatus'),
    internalPort: readOptionalNumber(record, 'internalPort'),
    previewUrl: readOptionalString(record, 'previewUrl'),
    phase: readOptionalString(record, 'phase'),
    message: readOptionalString(record, 'message'),
    error: readOptionalString(record, 'error'),
    specHash: readOptionalString(record, 'specHash'),
    containerStatusPersistence: readProjectContainerStatusPersistenceStatus(record.containerStatusPersistence),
    containerStatusPersistenceError: readOptionalString(record, 'containerStatusPersistenceError'),
    persistenceStatus: readProjectRuntimeStatusPersistenceStatus(record.persistenceStatus),
    persistenceError: readOptionalString(record, 'persistenceError'),
    startedAt: readOptionalString(record, 'startedAt'),
    updatedAt: readOptionalString(record, 'updatedAt'),
    completedAt: readOptionalString(record, 'completedAt'),
  };
}

function readProjectRuntimeStopFailureData(value: unknown): ProjectRuntimeStopFailureData | null {
  const record = readProjectRuntimeStopFailureRawObject(value);
  const hasRecord = record !== null;
  if (hasRecord === false) {
    return null;
  }

  return {
    stopStatus: readProjectContainerStopStatus(record.stop_status),
    containerStatus: readProjectContainerStopContainerStatus(record.container_status),
    containerStatusPersistence: readProjectContainerStatusPersistenceStatus(record.container_status_persistence),
    containerStatusPersistenceError: readOptionalString(record, 'container_status_persistence_error'),
    runtimeStatus: readProjectRuntimeStatus(record.runtime_status),
  };
}

function formatStopRuntimeStatusSummary(runtimeStatus?: ProjectRuntimeStatus) {
  const hasRuntimeStatus = runtimeStatus !== undefined;
  if (hasRuntimeStatus === false) {
    return '';
  }

  const summarySegmentCandidates: ProjectRuntimeStopSummarySegmentList = [
    getProjectRuntimeStopSummarySegment({ key: 'runtime_status', value: runtimeStatus.status }),
    getProjectRuntimeStopSummarySegment({ key: 'runtime_container_status', value: runtimeStatus.containerStatus }),
    getProjectRuntimeStopSummarySegment({ key: 'runtime_phase', value: runtimeStatus.phase }),
    getProjectRuntimeStopSummarySegment({ key: 'runtime_persistence', value: runtimeStatus.persistenceStatus }),
    getProjectRuntimeStopSummarySegment({ key: 'runtime_persistence_error', value: runtimeStatus.persistenceError }),
    getProjectRuntimeStopSummarySegment({ key: 'runtime_container_status_persistence', value: runtimeStatus.containerStatusPersistence }),
    getProjectRuntimeStopSummarySegment({ key: 'runtime_container_status_persistence_error', value: runtimeStatus.containerStatusPersistenceError }),
    getProjectRuntimeStopSummarySegment({ key: 'runtime_message', value: runtimeStatus.message }),
    getProjectRuntimeStopSummarySegment({ key: 'runtime_error', value: runtimeStatus.error }),
  ];
  const summarySegmentList = getProjectRuntimeStopSummarySegments(summarySegmentCandidates);
  const summarySegments = summarySegmentList.join('；');

  const hasSummary = summarySegments.length > 0;
  return hasSummary === true ? `runtime_status 快照：${summarySegments}` : '';
}

export function formatProjectRuntimeStopNotice(project: Project, result: ProjectContainerStopResponse) {
  const runtimeStatus = result.runtime_status;
  const projectName = getProjectRuntimeStopNoticeProjectName(project, result);
  const containerStatusPersistenceFailureMessage = getProjectRuntimeStopFallbackMessage(
    result.container_status_persistence_error,
    '后端未返回同步失败原因',
  );
  const dbPersistence = result.container_status_persistence === 'updated'
    ? `项目列表 container_status 已同步为 ${result.container_status}`
    : `项目列表 container_status 同步失败：${containerStatusPersistenceFailureMessage}`;
  const runtimeStatusPersistence = readProjectRuntimeStopStatusPersistence(runtimeStatus);
  const runtimePersistenceFailureMessage = getProjectRuntimeStopFallbackMessage(
    readProjectRuntimeStopStatusPersistenceError(runtimeStatus),
    '后端未返回快照写入失败原因',
  );
  const runtimePersistence = runtimeStatusPersistence === 'persisted'
    ? 'runtime-status 停止快照已写入'
    : runtimeStatusPersistence === 'failed'
      ? `runtime-status 停止快照写入失败：${runtimePersistenceFailureMessage}`
      : '后端未返回 runtime-status 停止快照写入结果';

  return `项目 ${projectName} 停止运行时结果：stop_status=${result.stop_status}，container_status=${result.container_status}。${dbPersistence}；${runtimePersistence}。请以当前提示和后续 Runtime Health 快照为准，避免把容器停止误判为项目列表与 runtime-status 已全部同步。`;
}

export function formatProjectRuntimeStopFailure(
  error: unknown,
  fallback: ProjectListOperationErrorDetails,
) {
  const reason = formatProjectListOperationError(error, fallback);
  const rawErrorData = readProjectRuntimeStopErrorData(error);
  const errorData = readProjectRuntimeStopFailureData(rawErrorData);
  const runtimeStatusSummary = formatStopRuntimeStatusSummary(readProjectRuntimeStopFailureRuntimeStatus(errorData));
  const stopDataSummaryCandidates: ProjectRuntimeStopSummarySegmentList = [
    getProjectRuntimeStopSummarySegment({ key: 'stop_status', value: readProjectRuntimeStopFailureStopStatus(errorData) }),
    getProjectRuntimeStopSummarySegment({ key: 'container_status', value: readProjectRuntimeStopFailureContainerStatus(errorData) }),
    getProjectRuntimeStopSummarySegment({ key: 'container_status_persistence', value: readProjectRuntimeStopFailureContainerPersistence(errorData) }),
    getProjectRuntimeStopSummarySegment({ key: 'container_status_persistence_error', value: readProjectRuntimeStopFailureContainerPersistenceError(errorData) }),
    runtimeStatusSummary,
  ];
  const stopDataSummary = getProjectRuntimeStopSummarySegments(stopDataSummaryCandidates).join('；');

  const hasStopDataSummary = stopDataSummary.length > 0;
  return hasStopDataSummary === true ? `${reason}。后端停止结果：${stopDataSummary}` : reason;
}
