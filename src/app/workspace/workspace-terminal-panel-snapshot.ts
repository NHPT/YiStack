import type {
  TerminalConnectionSnapshot,
  TerminalPanelConnectionStatus,
  TerminalPanelSnapshot,
  TerminalPanelSnapshotSource,
  TerminalPanelSnapshotStatus,
  TerminalThemeMode,
} from './workspace-types';

type TerminalPanelBooleanFactList = readonly boolean[];
type TerminalPanelConnectionStatusList = readonly TerminalPanelConnectionStatus[];
type TerminalPanelSnapshotStatusList = readonly TerminalPanelSnapshotStatus[];

const TERMINAL_PANEL_STARTING_CONNECTION_STATUSES: TerminalPanelConnectionStatusList = [
  'connecting',
];

const TERMINAL_PANEL_ERROR_BANNER_CONNECTION_STATUSES: TerminalPanelConnectionStatusList = [
  'error',
  'closed',
];

const TERMINAL_PANEL_USER_ACTION_STATUSES: TerminalPanelSnapshotStatusList = [
  'closed',
];

type TerminalPanelSnapshotOptions = {
  projectId: string | null;
  active: boolean;
  terminalMounted: boolean;
  socketReady: boolean;
  isStarting: boolean;
  connectionSnapshot: TerminalConnectionSnapshot;
  themeMode: TerminalThemeMode;
  status: TerminalPanelConnectionStatus;
};

function hasTerminalPanelTrueFact(values: TerminalPanelBooleanFactList): boolean {
  for (const value of values) {
    if (value === true) {
      return true;
    }
  }

  return false;
}

function isTerminalPanelConnectionStatusIn(
  status: TerminalPanelConnectionStatus,
  statuses: TerminalPanelConnectionStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function isTerminalPanelSnapshotStatusIn(
  status: TerminalPanelSnapshotStatus,
  statuses: TerminalPanelSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function hasTerminalPanelProject(projectId: string | null): boolean {
  if (projectId === null) {
    return false;
  }

  const hasProject = projectId.length > 0;
  return hasProject === true;
}

function canReconnectTerminalPanel({
  hasProject,
  isStarting,
}: {
  hasProject: boolean;
  isStarting: boolean;
}): boolean {
  if (hasProject === false) {
    return false;
  }

  return isStarting === false;
}

function isTerminalPanelStarting({
  isStarting,
  status,
}: {
  isStarting: boolean;
  status: TerminalPanelConnectionStatus;
}): boolean {
  const hasStartingConnectionStatus = isTerminalPanelConnectionStatusIn(
    status,
    TERMINAL_PANEL_STARTING_CONNECTION_STATUSES,
  );
  return hasTerminalPanelTrueFact([isStarting, hasStartingConnectionStatus]);
}

function isTerminalPanelReady({
  status,
  socketReady,
}: {
  status: TerminalPanelConnectionStatus;
  socketReady: boolean;
}): boolean {
  if (status !== 'connected') {
    return false;
  }

  return socketReady === true;
}

function hasTerminalPanelErrorBanner(status: TerminalPanelConnectionStatus): boolean {
  return isTerminalPanelConnectionStatusIn(status, TERMINAL_PANEL_ERROR_BANNER_CONNECTION_STATUSES);
}

function getTerminalPanelSnapshotStatus({
  hasProject,
  active,
  terminalMounted,
  hasStartingState,
  hasReadyState,
  status,
}: {
  hasProject: boolean;
  active: boolean;
  terminalMounted: boolean;
  hasStartingState: boolean;
  hasReadyState: boolean;
  status: TerminalPanelConnectionStatus;
}): TerminalPanelSnapshotStatus {
  if (hasProject === false) {
    return 'project_missing';
  }

  if (active === false) {
    return 'inactive';
  }

  if (terminalMounted === false) {
    return 'mounting';
  }

  if (hasStartingState === true) {
    return 'starting';
  }

  if (hasReadyState === true) {
    return 'ready';
  }

  if (status === 'error') {
    return 'error';
  }

  return 'closed';
}

function getTerminalPanelSnapshotSource(
  panelStatus: TerminalPanelSnapshotStatus,
): TerminalPanelSnapshotSource {
  if (panelStatus === 'project_missing') {
    return 'workspace_project';
  }

  if (panelStatus === 'inactive') {
    return 'panel_visibility';
  }

  if (panelStatus === 'mounting') {
    return 'xterm_mount';
  }

  const hasUserActionStatus = isTerminalPanelSnapshotStatusIn(panelStatus, TERMINAL_PANEL_USER_ACTION_STATUSES);
  if (hasUserActionStatus === true) {
    return 'user_action';
  }

  return 'connection_snapshot';
}

function getTerminalPanelSnapshotMessage(panelStatus: TerminalPanelSnapshotStatus): string {
  if (panelStatus === 'project_missing') {
    return 'Terminal 面板尚未绑定 Workspace 项目。';
  }

  if (panelStatus === 'inactive') {
    return 'Terminal 面板当前未激活，连接会等待面板打开。';
  }

  if (panelStatus === 'mounting') {
    return 'Terminal 容器正在挂载 xterm。';
  }

  if (panelStatus === 'starting') {
    return 'Terminal 正在建立连接。';
  }

  if (panelStatus === 'ready') {
    return 'Terminal 面板已就绪，输入会发送到当前项目容器。';
  }

  if (panelStatus === 'error') {
    return 'Terminal 面板存在连接或输入错误。';
  }

  return 'Terminal 面板当前未连接。';
}

function getTerminalPanelSnapshotRecovery({
  panelStatus,
  connectionSnapshot,
}: {
  panelStatus: TerminalPanelSnapshotStatus;
  connectionSnapshot: TerminalConnectionSnapshot;
}): string {
  if (panelStatus === 'project_missing') {
    return '先进入已绑定项目，再打开终端面板。';
  }

  if (panelStatus === 'inactive') {
    return '切换到终端 tab 后会自动建立或恢复连接。';
  }

  if (panelStatus === 'mounting') {
    return '等待 xterm 挂载完成；若持续为空，检查终端容器渲染。';
  }

  if (panelStatus === 'starting') {
    return connectionSnapshot.recovery;
  }

  if (panelStatus === 'ready') {
    return '可继续输入命令，或按需重启终端会话。';
  }

  return connectionSnapshot.recovery;
}

export function buildTerminalPanelSnapshot({
  projectId,
  active,
  terminalMounted,
  socketReady,
  isStarting,
  connectionSnapshot,
  themeMode,
  status,
}: TerminalPanelSnapshotOptions): TerminalPanelSnapshot {
  const hasProject = hasTerminalPanelProject(projectId);
  const canReconnect = canReconnectTerminalPanel({ hasProject, isStarting });
  const hasStartingState = isTerminalPanelStarting({ isStarting, status });
  const hasReadyState = isTerminalPanelReady({ status, socketReady });
  const hasErrorBanner = hasTerminalPanelErrorBanner(status);
  const panelStatus = getTerminalPanelSnapshotStatus({
    hasProject,
    active,
    terminalMounted,
    hasStartingState,
    hasReadyState,
    status,
  });
  const source = getTerminalPanelSnapshotSource(panelStatus);
  const message = getTerminalPanelSnapshotMessage(panelStatus);
  const recovery = getTerminalPanelSnapshotRecovery({
    panelStatus,
    connectionSnapshot,
  });

  return {
    status: panelStatus,
    source,
    hasProject,
    isActive: active,
    terminalMounted,
    socketReady,
    canReconnect,
    canClose: socketReady === true,
    theme: themeMode,
    hasErrorBanner,
    message,
    recovery,
    updatedAt: connectionSnapshot.updatedAt,
  };
}
