import { cn } from '@/lib/utils';

import type {
  WorkspacePanelSurface,
  WorkspacePageHeaderSnapshot,
  WorkspacePageHeaderSnapshotSource,
  WorkspacePageHeaderSnapshotStatus,
} from './workspace-types';

function getWorkspacePageHeaderProjectName(projectName: string | null | undefined): string | undefined {
  if (projectName === null) {
    return undefined;
  }

  if (projectName === undefined) {
    return undefined;
  }

  return projectName.trim();
}

function hasWorkspacePageHeaderProjectName(normalizedProjectName: string | undefined): boolean {
  if (normalizedProjectName === undefined) {
    return false;
  }

  const hasProjectName = normalizedProjectName.length > 0;
  return hasProjectName === true;
}

function getWorkspacePageHeaderSnapshotStatus(
  hasProjectName: boolean,
): WorkspacePageHeaderSnapshotStatus {
  if (hasProjectName === true) {
    return 'project_named';
  }

  return 'project_fallback';
}

function getWorkspacePageHeaderSnapshotSource(
  hasProjectName: boolean,
): WorkspacePageHeaderSnapshotSource {
  if (hasProjectName === true) {
    return 'project_info';
  }

  return 'route_fallback';
}

function getWorkspacePageHeaderSnapshotSurface(isMobile: boolean): WorkspacePanelSurface {
  if (isMobile === true) {
    return 'mobile';
  }

  return 'desktop';
}

function getWorkspacePageHeaderDisplayName({
  hasProjectName,
  normalizedProjectName,
}: {
  hasProjectName: boolean;
  normalizedProjectName: string | undefined;
}): string {
  if (hasProjectName === false) {
    return '我的项目';
  }

  if (normalizedProjectName === undefined) {
    return '我的项目';
  }

  return normalizedProjectName;
}

function getWorkspacePageHeaderSnapshotMessage(hasProjectName: boolean): string {
  if (hasProjectName === true) {
    return 'Workspace 顶栏已绑定项目名称。';
  }

  return 'Workspace 顶栏正在使用默认项目名称。';
}

function getWorkspacePageHeaderSnapshotRecovery(hasProjectName: boolean): string {
  if (hasProjectName === true) {
    return '可通过返回、Home 链接或清空对话继续操作。';
  }

  return '等待项目上下文加载；若持续显示默认名称，请检查项目 bootstrap 快照。';
}

export function buildWorkspacePageHeaderSnapshot({
  isMobile,
  projectName,
  canGoBack,
  canClearChat,
  hasSettingsAction,
}: {
  isMobile: boolean;
  projectName?: string | null;
  canGoBack: boolean;
  canClearChat: boolean;
  hasSettingsAction: boolean;
}): WorkspacePageHeaderSnapshot {
  const normalizedProjectName = getWorkspacePageHeaderProjectName(projectName);
  const hasProjectName = hasWorkspacePageHeaderProjectName(normalizedProjectName);
  const status = getWorkspacePageHeaderSnapshotStatus(hasProjectName);
  const source = getWorkspacePageHeaderSnapshotSource(hasProjectName);
  const surface = getWorkspacePageHeaderSnapshotSurface(isMobile);
  const displayName = getWorkspacePageHeaderDisplayName({
    hasProjectName,
    normalizedProjectName,
  });
  const message = getWorkspacePageHeaderSnapshotMessage(hasProjectName);
  const recovery = getWorkspacePageHeaderSnapshotRecovery(hasProjectName);

  return {
    status,
    source,
    surface,
    displayName,
    hasProjectName,
    canGoBack,
    canClearChat,
    hasSettingsAction,
    homeLinkAvailable: true,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getWorkspacePageHeaderSnapshotClassName(snapshot: WorkspacePageHeaderSnapshot) {
  if (snapshot.status === 'project_fallback') {
    return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function getWorkspacePageHeaderSnapshotProjectNameLabel(value: boolean): string {
  return value === true ? 'yes' : 'fallback';
}

function getWorkspacePageHeaderSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function WorkspacePageHeaderSnapshotStrip({ snapshot }: { snapshot: WorkspacePageHeaderSnapshot }) {
  const hasProjectNameLabel = getWorkspacePageHeaderSnapshotProjectNameLabel(snapshot.hasProjectName);
  const canGoBackLabel = getWorkspacePageHeaderSnapshotBooleanLabel(snapshot.canGoBack);
  const canClearChatLabel = getWorkspacePageHeaderSnapshotBooleanLabel(snapshot.canClearChat);
  const hasSettingsActionLabel = getWorkspacePageHeaderSnapshotBooleanLabel(snapshot.hasSettingsAction);
  const homeLinkAvailableLabel = getWorkspacePageHeaderSnapshotBooleanLabel(snapshot.homeLinkAvailable);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-page-header-snapshot"
      className={cn('border-b px-3 py-2 text-xs', getWorkspacePageHeaderSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Workspace 顶栏快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Surface: {snapshot.surface}</span>
        <span>Name: {snapshot.displayName}</span>
        <span>ProjectName: {hasProjectNameLabel}</span>
        <span>Back: {canGoBackLabel}</span>
        <span>ClearChat: {canClearChatLabel}</span>
        <span>Settings: {hasSettingsActionLabel}</span>
        <span>HomeLink: {homeLinkAvailableLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
