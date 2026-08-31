import { cn } from '@/lib/utils';

import type {
  WorkspaceProjectBootstrapMessageRestoreSource,
  WorkspaceProjectBootstrapMessageRestoreStatus,
  WorkspaceProjectBootstrapSnapshot,
  WorkspaceProjectBootstrapSnapshotSource,
  WorkspaceProjectBootstrapSnapshotStatus,
} from './workspace-types';

function hasWorkspaceProjectBootstrapSnapshotTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

export function buildWorkspaceProjectBootstrapSnapshot({
  hasMounted,
  projectIdParam,
  projectParam,
  projectId,
  projectName,
  isRestoringWorkspace,
  messageRestoreStatus,
}: {
  hasMounted: boolean;
  projectIdParam: string | null;
  projectParam: string | null;
  projectId: string | null;
  projectName: string | null;
  isRestoringWorkspace: boolean;
  messageRestoreStatus: WorkspaceProjectBootstrapMessageRestoreStatus;
}): WorkspaceProjectBootstrapSnapshot {
  const hasRouteProjectId = hasWorkspaceProjectBootstrapSnapshotTextValue(projectIdParam);
  const hasRouteProjectPayload = hasWorkspaceProjectBootstrapSnapshotTextValue(projectParam);
  const hasProject = hasWorkspaceProjectBootstrapSnapshotTextValue(projectId);
  const canRedirectHome = hasMounted === true
    && hasProject === false
    && hasRouteProjectId === false
    && hasRouteProjectPayload === false;
  const status: WorkspaceProjectBootstrapSnapshotStatus = isRestoringWorkspace
    ? 'messages_restoring'
    : hasProject
      ? 'project_ready'
      : hasRouteProjectId
        ? 'route_project_pending'
        : hasRouteProjectPayload
          ? 'route_payload_pending'
          : canRedirectHome
            ? 'no_entry_redirect_pending'
            : 'local_snapshot_probe';
  const source: WorkspaceProjectBootstrapSnapshotSource = status === 'messages_restoring'
    ? 'workspace_session_snapshot'
    : status === 'project_ready'
      ? 'current_project'
      : status === 'route_project_pending'
        ? 'route_project_id'
        : status === 'route_payload_pending'
          ? 'route_project_payload'
          : status === 'no_entry_redirect_pending'
            ? 'route_guard'
            : 'local_workspace_snapshot';
  const messageRestoreSource = getWorkspaceProjectBootstrapMessageRestoreSource(messageRestoreStatus);
  const messageRestoreMessage = getWorkspaceProjectBootstrapMessageRestoreMessage(messageRestoreStatus);
  const messageRestoreRecovery = getWorkspaceProjectBootstrapMessageRestoreRecovery(messageRestoreStatus);

  return {
    status,
    source,
    messageRestoreStatus,
    messageRestoreSource,
    hasMounted,
    hasRouteProjectId,
    hasRouteProjectPayload,
    hasProject,
    isRestoringWorkspace,
    canRedirectHome,
    projectId,
    projectName,
    message: status === 'messages_restoring'
      ? 'Workspace 正在恢复后端消息或本地会话快照。'
      : status === 'project_ready'
        ? `Workspace 项目上下文已就绪。${messageRestoreMessage}`
        : status === 'route_project_pending'
          ? 'Workspace 正在通过 URL projectId 恢复项目。'
          : status === 'route_payload_pending'
            ? 'Workspace 正在通过 URL 项目 payload 初始化。'
            : status === 'no_entry_redirect_pending'
              ? 'Workspace 未发现入口项目，正在等待返回首页保护。'
              : 'Workspace 正在探测本地项目快照。',
    recovery: status === 'messages_restoring'
      ? '等待消息恢复完成；若失败，会回退到本地会话快照并在消息流中说明。'
      : status === 'project_ready'
        ? messageRestoreRecovery
        : status === 'route_project_pending'
          ? '等待后端项目详情或本地 Workspace 项目快照兜底。'
          : status === 'route_payload_pending'
            ? '等待 URL payload 解析；若失败，会继续尝试本地 Workspace 项目快照。'
            : status === 'no_entry_redirect_pending'
              ? '等待路由保护返回首页，或从项目列表重新进入 Workspace。'
              : '等待本地 yistack_current_project 读取；若不存在，路由保护会返回首页。',
    updatedAt: 'derived',
  };
}

function getWorkspaceProjectBootstrapMessageRestoreSource(
  status: WorkspaceProjectBootstrapMessageRestoreStatus,
): WorkspaceProjectBootstrapMessageRestoreSource {
  if (status === 'backend_history_restored') {
    return 'backend_history';
  }

  if (status === 'session_snapshot_restored' || status === 'restore_failed_session_snapshot') {
    return 'workspace_session_snapshot';
  }

  if (status === 'empty_history_no_session') {
    return 'empty_backend_history';
  }

  if (status === 'restore_failed_no_snapshot') {
    return 'restore_failure';
  }

  return 'none';
}

function getWorkspaceProjectBootstrapMessageRestoreMessage(
  status: WorkspaceProjectBootstrapMessageRestoreStatus,
): string {
  if (status === 'backend_history_restored') {
    return '历史消息已从后端真源恢复，并与本地 session snapshot 合并。';
  }

  if (status === 'session_snapshot_restored') {
    return '后端历史消息为空，当前聊天和工程状态来自本地 session snapshot。';
  }

  if (status === 'empty_history_no_session') {
    return '后端历史消息为空，且没有可用本地 session snapshot。';
  }

  if (status === 'restore_failed_session_snapshot') {
    return '后端历史消息恢复失败，当前聊天和工程状态已回退到本地 session snapshot。';
  }

  if (status === 'restore_failed_no_snapshot') {
    return '后端历史消息恢复失败，且没有可用本地 session snapshot 兜底。';
  }

  if (status === 'restoring') {
    return '历史消息恢复仍在进行中。';
  }

  return '历史消息恢复尚未开始。';
}

function getWorkspaceProjectBootstrapMessageRestoreRecovery(
  status: WorkspaceProjectBootstrapMessageRestoreStatus,
): string {
  if (status === 'backend_history_restored') {
    return '可继续编辑；后端历史、工程状态和本地未保存编辑器状态已完成恢复。';
  }

  if (status === 'session_snapshot_restored') {
    return '可继续基于本地 session snapshot 编辑；稍后刷新可再次尝试同步后端历史消息。';
  }

  if (status === 'empty_history_no_session') {
    return '当前聊天和工程状态可能不完整；可继续使用文件区，稍后刷新或重新打开项目复核后端历史。';
  }

  if (status === 'restore_failed_session_snapshot') {
    return '可继续基于本地 session snapshot 编辑；后端恢复后刷新项目以重新同步历史消息。';
  }

  if (status === 'restore_failed_no_snapshot') {
    return '当前聊天和工程状态可能缺失；请稍后刷新项目或从项目列表重新打开。';
  }

  if (status === 'restoring') {
    return '等待历史消息恢复完成；恢复失败时会显示本地 session snapshot 是否可用。';
  }

  return '等待项目恢复流程启动；如果长时间停留，请从项目列表重新打开。';
}

function hasWorkspaceProjectBootstrapRestoreWarning(
  status: WorkspaceProjectBootstrapMessageRestoreStatus,
): boolean {
  if (status === 'restore_failed_session_snapshot') {
    return true;
  }

  if (status === 'restore_failed_no_snapshot') {
    return true;
  }

  return status === 'empty_history_no_session';
}

function getWorkspaceProjectBootstrapSnapshotClassName(snapshot: WorkspaceProjectBootstrapSnapshot) {
  if (snapshot.status === 'no_entry_redirect_pending') {
    return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100';
  }
  if (hasWorkspaceProjectBootstrapRestoreWarning(snapshot.messageRestoreStatus) === true) {
    return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100';
  }
  if (snapshot.status === 'messages_restoring' || snapshot.status === 'route_project_pending' || snapshot.status === 'route_payload_pending') {
    return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function getWorkspaceProjectBootstrapSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = hasWorkspaceProjectBootstrapSnapshotTextValue(value);

  return hasValue === true ? value : fallback;
}

function getWorkspaceProjectBootstrapSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function getWorkspaceProjectBootstrapSnapshotRestoreLabel(value: boolean): string {
  return value === true ? 'restoring' : 'idle';
}

function getWorkspaceProjectBootstrapMessageRestoreLabel(
  status: WorkspaceProjectBootstrapMessageRestoreStatus,
): string {
  return status;
}

function getWorkspaceProjectBootstrapMessageRestoreSourceLabel(
  source: WorkspaceProjectBootstrapMessageRestoreSource,
): string {
  return source;
}

export function WorkspaceProjectBootstrapSnapshotStrip({ snapshot }: { snapshot: WorkspaceProjectBootstrapSnapshot }) {
  const projectIdLabel = getWorkspaceProjectBootstrapSnapshotLabel(snapshot.projectId, 'none');
  const projectNameLabel = getWorkspaceProjectBootstrapSnapshotLabel(snapshot.projectName, 'none');
  const hasMountedLabel = getWorkspaceProjectBootstrapSnapshotBooleanLabel(snapshot.hasMounted);
  const hasRouteProjectIdLabel = getWorkspaceProjectBootstrapSnapshotBooleanLabel(snapshot.hasRouteProjectId);
  const hasRouteProjectPayloadLabel = getWorkspaceProjectBootstrapSnapshotBooleanLabel(snapshot.hasRouteProjectPayload);
  const hasProjectLabel = getWorkspaceProjectBootstrapSnapshotBooleanLabel(snapshot.hasProject);
  const isRestoringWorkspaceLabel = getWorkspaceProjectBootstrapSnapshotRestoreLabel(snapshot.isRestoringWorkspace);
  const canRedirectHomeLabel = getWorkspaceProjectBootstrapSnapshotBooleanLabel(snapshot.canRedirectHome);
  const messageRestoreStatusLabel = getWorkspaceProjectBootstrapMessageRestoreLabel(snapshot.messageRestoreStatus);
  const messageRestoreSourceLabel = getWorkspaceProjectBootstrapMessageRestoreSourceLabel(snapshot.messageRestoreSource);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-project-bootstrap-snapshot"
      className={cn('border-b px-3 py-2 text-xs', getWorkspaceProjectBootstrapSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">项目入口快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Mounted: {hasMountedLabel}</span>
        <span>RouteProject: {hasRouteProjectIdLabel}</span>
        <span>RoutePayload: {hasRouteProjectPayloadLabel}</span>
        <span>Project: {hasProjectLabel}</span>
        <span>Messages: {isRestoringWorkspaceLabel}</span>
        <span>MessageRestore: {messageRestoreStatusLabel}</span>
        <span>RestoreSource: {messageRestoreSourceLabel}</span>
        <span>HomeRedirect: {canRedirectHomeLabel}</span>
        <span>ProjectId: {projectIdLabel}</span>
        <span>Name: {projectNameLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
