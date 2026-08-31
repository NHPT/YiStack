import { cn } from '@/lib/utils';

import type {
  WorkspaceMobileShellSnapshot,
  WorkspaceMobileShellSnapshotSource,
  WorkspaceMobileShellSnapshotStatus,
  WorkspaceMobileShellVisiblePanel,
  WorkspaceMobileView,
} from './workspace-types';

type WorkspaceMobileShellSnapshotStatusList = readonly WorkspaceMobileShellSnapshotStatus[];

const WORKSPACE_MOBILE_SHELL_MISSING_PANEL_STATUSES: WorkspaceMobileShellSnapshotStatusList = [
  'chat_panel_missing',
  'ide_panel_missing',
];

function isWorkspaceMobileShellSnapshotStatusIn(
  status: WorkspaceMobileShellSnapshotStatus,
  statuses: WorkspaceMobileShellSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function getWorkspaceMobileShellVisiblePanel({
  mobileView,
  chatPanelMounted,
  idePanelMounted,
}: {
  mobileView: WorkspaceMobileView;
  chatPanelMounted: boolean;
  idePanelMounted: boolean;
}): WorkspaceMobileShellVisiblePanel {
  if (mobileView === 'chat') {
    if (chatPanelMounted === true) {
      return 'chat';
    }

    return 'missing';
  }

  if (idePanelMounted === true) {
    return 'ide';
  }

  return 'missing';
}

function getWorkspaceMobileShellSnapshotStatus({
  mobileView,
  chatPanelMounted,
  idePanelMounted,
}: {
  mobileView: WorkspaceMobileView;
  chatPanelMounted: boolean;
  idePanelMounted: boolean;
}): WorkspaceMobileShellSnapshotStatus {
  if (mobileView === 'chat') {
    if (chatPanelMounted === true) {
      return 'chat_active';
    }

    return 'chat_panel_missing';
  }

  if (idePanelMounted === true) {
    return 'ide_active';
  }

  return 'ide_panel_missing';
}

function getWorkspaceMobileShellSnapshotSource(
  visiblePanel: WorkspaceMobileShellVisiblePanel,
): WorkspaceMobileShellSnapshotSource {
  if (visiblePanel === 'missing') {
    return 'panel_mount';
  }

  return 'mobile_view';
}

function getWorkspaceMobileShellSnapshotMessage(status: WorkspaceMobileShellSnapshotStatus): string {
  if (status === 'chat_active') {
    return '移动端 Shell 当前展示聊天面板。';
  }

  if (status === 'ide_active') {
    return '移动端 Shell 当前展示 IDE 面板。';
  }

  if (status === 'chat_panel_missing') {
    return '移动端 Shell 已切到聊天视图，但聊天面板尚未挂载。';
  }

  return '移动端 Shell 已切到 IDE 视图，但 IDE 面板尚未挂载。';
}

function getWorkspaceMobileShellSnapshotRecovery(status: WorkspaceMobileShellSnapshotStatus): string {
  if (status === 'chat_panel_missing') {
    return '等待聊天面板挂载；若持续为空，请检查移动端 Chat panel 构建链路。';
  }

  if (status === 'ide_panel_missing') {
    return '等待 IDE 面板挂载；若持续为空，请检查移动端 IDE panel 构建链路。';
  }

  return '可通过底部导航在聊天与 IDE 之间切换。';
}

export function buildWorkspaceMobileShellSnapshot({
  mobileView,
  chatPanelMounted,
  idePanelMounted,
}: {
  mobileView: WorkspaceMobileView;
  chatPanelMounted: boolean;
  idePanelMounted: boolean;
}): WorkspaceMobileShellSnapshot {
  const visiblePanel = getWorkspaceMobileShellVisiblePanel({
    mobileView,
    chatPanelMounted,
    idePanelMounted,
  });
  const status = getWorkspaceMobileShellSnapshotStatus({
    mobileView,
    chatPanelMounted,
    idePanelMounted,
  });
  const source = getWorkspaceMobileShellSnapshotSource(visiblePanel);
  const message = getWorkspaceMobileShellSnapshotMessage(status);
  const recovery = getWorkspaceMobileShellSnapshotRecovery(status);

  return {
    status,
    source,
    activeView: mobileView,
    visiblePanel,
    chatPanelMounted,
    idePanelMounted,
    canOpenChat: chatPanelMounted,
    canOpenIde: idePanelMounted,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getWorkspaceMobileShellSnapshotClassName(snapshot: WorkspaceMobileShellSnapshot) {
  const hasMissingPanelStatus = isWorkspaceMobileShellSnapshotStatusIn(
    snapshot.status,
    WORKSPACE_MOBILE_SHELL_MISSING_PANEL_STATUSES,
  );
  if (hasMissingPanelStatus === true) {
    return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function getWorkspaceMobileShellSnapshotMountLabel(value: boolean): string {
  return value === true ? 'mounted' : 'missing';
}

function getWorkspaceMobileShellSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function WorkspaceMobileShellSnapshotStrip({ snapshot }: { snapshot: WorkspaceMobileShellSnapshot }) {
  const chatPanelMountedLabel = getWorkspaceMobileShellSnapshotMountLabel(snapshot.chatPanelMounted);
  const idePanelMountedLabel = getWorkspaceMobileShellSnapshotMountLabel(snapshot.idePanelMounted);
  const canOpenChatLabel = getWorkspaceMobileShellSnapshotBooleanLabel(snapshot.canOpenChat);
  const canOpenIdeLabel = getWorkspaceMobileShellSnapshotBooleanLabel(snapshot.canOpenIde);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-mobile-shell-snapshot"
      className={cn('border-b px-3 py-2 text-xs', getWorkspaceMobileShellSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">移动端外壳快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>View: {snapshot.activeView}</span>
        <span>Visible: {snapshot.visiblePanel}</span>
        <span>ChatPanel: {chatPanelMountedLabel}</span>
        <span>IdePanel: {idePanelMountedLabel}</span>
        <span>OpenChat: {canOpenChatLabel}</span>
        <span>OpenIde: {canOpenIdeLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
