import { cn } from '@/lib/utils';
import { getTechStackLabels } from '@/lib/tech-stack';
import type { Project } from '@/lib/api';
import type { ProjectRuntimeContainerStatus } from '@/lib/types';

import type {
  ProjectCardSnapshot,
  ProjectCardSnapshotSource,
  ProjectCardSnapshotStatus,
} from '../workspace/workspace-types';

export type ProjectCardDeletionRecoveryCleanupScope = string;
export type ProjectCardDeletionRecoveryCleanupScopeList = ProjectCardDeletionRecoveryCleanupScope[];

export type ProjectCardDeletionRecovery = {
  reason: string;
  cleanupScope: ProjectCardDeletionRecoveryCleanupScopeList;
} | null;

type ProjectCardContainerStatusList = readonly ProjectRuntimeContainerStatus[];
type ProjectCardSnapshotStatusList = readonly ProjectCardSnapshotStatus[];

const defaultCleanupScope = 'container / project_directory / chat_messages / generated_file_metadata / git_commits';

const PROJECT_CARD_STARTING_CONTAINER_STATUSES: ProjectCardContainerStatusList = [
  'creating',
  'starting',
];

const PROJECT_CARD_STOPPED_CONTAINER_STATUSES: ProjectCardContainerStatusList = [
  'stopped',
  'exited',
];

const PROJECT_CARD_ERROR_CONTAINER_STATUSES: ProjectCardContainerStatusList = [
  'error',
  'failed',
];

const PROJECT_CARD_WARNING_SNAPSHOT_STATUSES: ProjectCardSnapshotStatusList = [
  'deletion_recovery',
  'runtime_missing',
  'runtime_error',
];

const PROJECT_CARD_ACTIVE_SNAPSHOT_STATUSES: ProjectCardSnapshotStatusList = [
  'runtime_stopping',
  'runtime_starting',
];

function hasProjectCardSnapshotValue(value: string | undefined): value is string {
  if (value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getProjectCardSnapshotValue(value: string | undefined, fallback: string): string {
  const hasValue = hasProjectCardSnapshotValue(value);
  if (hasValue === false) {
    return fallback;
  }

  return value;
}

function getProjectCardSnapshotListCount<T>(values: readonly T[]): number {
  return values.length;
}

function hasProjectCardSnapshotPositiveCount(value: number): boolean {
  const hasPositiveCount = value > 0;
  return hasPositiveCount === true;
}

function isProjectCardContainerStatusIn(
  containerStatus: ProjectRuntimeContainerStatus,
  statuses: ProjectCardContainerStatusList,
): boolean {
  for (const candidate of statuses) {
    if (candidate === containerStatus) {
      return true;
    }
  }

  return false;
}

function isProjectCardSnapshotStatusIn(
  status: ProjectCardSnapshotStatus,
  statuses: ProjectCardSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    if (candidate === status) {
      return true;
    }
  }

  return false;
}

function normalizeContainerStatus(containerStatus?: ProjectRuntimeContainerStatus): ProjectRuntimeContainerStatus {
  return getProjectCardSnapshotValue(containerStatus, 'unknown');
}

function getProjectCardSnapshotStatus({
  hasDeletionRecovery,
  isStopping,
  containerStatus,
}: {
  hasDeletionRecovery: boolean;
  isStopping: boolean;
  containerStatus: ProjectRuntimeContainerStatus;
}): ProjectCardSnapshotStatus {
  if (hasDeletionRecovery === true) {
    return 'deletion_recovery';
  }

  if (isStopping === true) {
    return 'runtime_stopping';
  }

  if (containerStatus === 'running') {
    return 'runtime_running';
  }

  const isStarting = isProjectCardContainerStatusIn(containerStatus, PROJECT_CARD_STARTING_CONTAINER_STATUSES);
  if (isStarting === true) {
    return 'runtime_starting';
  }

  const isStopped = isProjectCardContainerStatusIn(containerStatus, PROJECT_CARD_STOPPED_CONTAINER_STATUSES);
  if (isStopped === true) {
    return 'runtime_stopped';
  }

  if (containerStatus === 'missing') {
    return 'runtime_missing';
  }

  const hasRuntimeError = isProjectCardContainerStatusIn(containerStatus, PROJECT_CARD_ERROR_CONTAINER_STATUSES);
  if (hasRuntimeError === true) {
    return 'runtime_error';
  }

  return 'runtime_unknown';
}

function getProjectCardSnapshotSource(hasDeletionRecovery: boolean, isStopping: boolean): ProjectCardSnapshotSource {
  if (hasDeletionRecovery === true) {
    return 'deletion_recovery';
  }

  if (isStopping === true) {
    return 'card_actions';
  }

  return 'runtime_status';
}

function getProjectCardDeletionRecoveryCleanupScope(
  deletionRecovery: ProjectCardDeletionRecovery,
  hasCleanupScope: boolean,
): string {
  if (deletionRecovery === null) {
    return defaultCleanupScope;
  }

  if (hasCleanupScope === false) {
    return defaultCleanupScope;
  }

  return deletionRecovery.cleanupScope.join(' / ');
}

export function buildProjectCardSnapshot({
  project,
  projectId,
  isHovered,
  isStopping,
  canStopRuntime,
  deletionRecovery,
}: {
  project: Project;
  projectId: string;
  isHovered: boolean;
  isStopping: boolean;
  canStopRuntime: boolean;
  deletionRecovery: ProjectCardDeletionRecovery;
}): ProjectCardSnapshot {
  const containerStatus = normalizeContainerStatus(project.container_status);
  const hasDeletionRecovery = deletionRecovery !== null;
  const deletionRecoveryCleanupScopeCount = deletionRecovery !== null
    ? getProjectCardSnapshotListCount(deletionRecovery.cleanupScope)
    : 0;
  const hasDeletionRecoveryCleanupScope = hasProjectCardSnapshotPositiveCount(deletionRecoveryCleanupScopeCount);
  const canEdit = isStopping === false;
  const canStopRuntimeAction = canStopRuntime === true && isStopping === false;
  const canDelete = isStopping === false;
  const status = getProjectCardSnapshotStatus({
    hasDeletionRecovery,
    isStopping,
    containerStatus,
  });
  const source = getProjectCardSnapshotSource(hasDeletionRecovery, isStopping);
  const cleanupScope = getProjectCardDeletionRecoveryCleanupScope(
    deletionRecovery,
    hasDeletionRecoveryCleanupScope,
  );
  const techStackLabels = getTechStackLabels(project.tech_stack);
  const techStackCount = getProjectCardSnapshotListCount(techStackLabels);

  return {
    status,
    source,
    projectId,
    projectName: getProjectCardSnapshotValue(project.name, projectId),
    appType: getProjectCardSnapshotValue(project.app_type, 'web'),
    containerStatus,
    isHovered,
    isStopping,
    canOpenWorkspace: true,
    canEdit,
    canStopRuntime: canStopRuntimeAction,
    canDelete,
    hasDeletionRecovery,
    cleanupScope,
    techStackCount,
    message: status === 'deletion_recovery'
      ? '项目曾因删除后台清理失败被系统恢复。'
      : status === 'runtime_stopping'
        ? '项目运行时正在停止，卡片操作暂时收敛。'
        : status === 'runtime_running'
          ? '项目运行时正在运行，可打开 Workspace 或停止运行时。'
          : status === 'runtime_starting'
            ? '项目运行时正在启动或创建。'
            : status === 'runtime_stopped'
              ? '项目运行时已停止，可打开 Workspace 查看项目状态。'
              : status === 'runtime_missing'
                ? '项目运行时容器缺失，需要检查 Runtime Health。'
                : status === 'runtime_error'
                  ? '项目运行时处于异常状态。'
                  : '项目运行时状态未知。',
    recovery: status === 'deletion_recovery'
      ? `确认关联资源状态后再重试删除。清理范围：${cleanupScope}。`
      : status === 'runtime_stopping'
        ? '等待停止动作返回；若长时间停留，请刷新列表或查看 Runtime Health。'
        : status === 'runtime_running'
          ? '可打开项目继续工作，或按需停止运行时。'
          : status === 'runtime_starting'
            ? '等待运行时启动完成；若失败，请查看 Runtime Health。'
            : status === 'runtime_stopped'
              ? '可打开项目恢复上下文，运行时会按需重新启动。'
              : status === 'runtime_missing'
                ? '刷新列表或查看 Runtime Health，确认容器是否已被清理。'
                : status === 'runtime_error'
                  ? '查看 Runtime Health 或重新进入 Workspace 触发恢复。'
                  : '刷新项目列表以获取最新运行时状态。',
    updatedAt: 'derived',
  };
}

function getProjectCardSnapshotClassName(snapshot: ProjectCardSnapshot) {
  const hasWarningStatus = isProjectCardSnapshotStatusIn(snapshot.status, PROJECT_CARD_WARNING_SNAPSHOT_STATUSES);
  if (hasWarningStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }

  const hasActiveStatus = isProjectCardSnapshotStatusIn(snapshot.status, PROJECT_CARD_ACTIVE_SNAPSHOT_STATUSES);
  if (hasActiveStatus === true) {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }

  return 'border-border bg-background/70 text-muted-foreground';
}

function getProjectCardSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function ProjectCardSnapshotStrip({ snapshot }: { snapshot: ProjectCardSnapshot }) {
  const isHoveredLabel = getProjectCardSnapshotBooleanLabel(snapshot.isHovered);
  const isStoppingLabel = getProjectCardSnapshotBooleanLabel(snapshot.isStopping);
  const canOpenWorkspaceLabel = getProjectCardSnapshotBooleanLabel(snapshot.canOpenWorkspace);
  const canEditLabel = getProjectCardSnapshotBooleanLabel(snapshot.canEdit);
  const canStopRuntimeLabel = getProjectCardSnapshotBooleanLabel(snapshot.canStopRuntime);
  const canDeleteLabel = getProjectCardSnapshotBooleanLabel(snapshot.canDelete);
  const hasDeletionRecoveryLabel = getProjectCardSnapshotBooleanLabel(snapshot.hasDeletionRecovery);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="project-card-snapshot"
      className={cn('mt-3 rounded-md border px-3 py-2 text-xs', getProjectCardSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">项目卡片快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Project: {snapshot.projectId}</span>
        <span>Runtime: {snapshot.containerStatus}</span>
        <span>Hover: {isHoveredLabel}</span>
        <span>Stopping: {isStoppingLabel}</span>
        <span>Open: {canOpenWorkspaceLabel}</span>
        <span>Edit: {canEditLabel}</span>
        <span>Stop: {canStopRuntimeLabel}</span>
        <span>Delete: {canDeleteLabel}</span>
        <span>Recovery: {hasDeletionRecoveryLabel}</span>
        <span>Tech: {snapshot.techStackCount}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
