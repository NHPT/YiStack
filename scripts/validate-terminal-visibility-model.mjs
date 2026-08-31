#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function fail(message) {
  console.error(`[YES] Terminal visibility model invalid: ${message}`);
  process.exit(1);
}

function assertIncludes(source, snippet, message) {
  if (!source.includes(snippet)) {
    fail(`${message}: missing ${snippet}`);
  }
}

function assertNotIncludes(source, snippet, message) {
  if (source.includes(snippet)) {
    fail(`${message}: found ${snippet}`);
  }
}

const terminalSource = readProjectFile('src/components/terminal.tsx');
const terminalPanelSnapshot = readProjectFile('src/app/workspace/workspace-terminal-panel-snapshot.ts');
const terminalCloseConfirmationSnapshot = readProjectFile('src/app/workspace/workspace-terminal-close-confirmation-snapshot.tsx');
const workspaceTypes = readProjectFile('src/app/workspace/workspace-types.ts');
const terminalLocalErrors = readProjectFile('src/lib/workspace/terminal-local-errors.ts');
const validationLayer = readProjectFile('docs/engineering/VALIDATION_LAYER.md');
const yesScript = readProjectFile('scripts/validate-yes.sh');

[
  "export type TerminalConnectionSnapshotStatus = 'idle' | 'ticket_requesting' | 'websocket_connecting' | 'pty_ready' | 'manual_closed' | 'remote_closed' | 'input_send_failed' | 'error'",
  "export type TerminalConnectionSnapshotSource = 'workspace_project' | 'terminal_ticket' | 'terminal_websocket' | 'container_pty' | 'user_action'",
  'export type TerminalConnectionSnapshot = {',
  'status: TerminalConnectionSnapshotStatus;',
  'source: TerminalConnectionSnapshotSource;',
].forEach((snippet) => {
  assertIncludes(workspaceTypes, snippet, 'terminal connection phases should be registered in workspace snapshot types');
});

[
  'TerminalConnectionSnapshotStatus',
  'TerminalConnectionSnapshotSource',
  'const [connectionSnapshot, setConnectionSnapshot] = useState<TerminalConnectionSnapshot>',
  'const updateConnectionSnapshot = useCallback',
  'nextStatus: TerminalConnectionSnapshotStatus',
  'source: TerminalConnectionSnapshotSource',
  "'ticket_requesting'",
  "'websocket_connecting'",
  "'pty_ready'",
  "'input_send_failed'",
  '正在申请终端 WebSocket 短期票据',
  'WebSocket 已打开，正在等待容器 PTY ready 消息',
  '容器 PTY 已连接，终端输入会发送到当前项目容器',
  'Phase: {connectionSnapshot.status}',
  'Source: {connectionSnapshot.source}',
  'data-testid="workspace-terminal-connection-snapshot"',
  '终端连接状态：',
  '恢复建议：{connectionSnapshot.recovery}',
].forEach((snippet) => {
  assertIncludes(terminalSource, snippet, 'terminal connection phases should be modeled as a structured visible snapshot');
});

[
  "TerminalConnectionSnapshot['status']",
  "TerminalConnectionSnapshot['source']",
].forEach((snippet) => {
  assertNotIncludes(terminalSource, snippet, 'terminal connection helper should not infer status/source from indexed snapshot access');
});

[
  "export type TerminalThemeMode = 'dark' | 'light'",
  "export type TerminalPanelSnapshotStatus = 'project_missing' | 'inactive' | 'mounting' | 'starting' | 'ready' | 'closed' | 'error'",
  "export type TerminalPanelSnapshotSource = 'workspace_project' | 'panel_visibility' | 'xterm_mount' | 'connection_snapshot' | 'user_action'",
  "export type TerminalPanelConnectionStatus = 'idle' | 'connecting' | 'connected' | 'closed' | 'error'",
  'export type TerminalPanelSnapshot = {',
  'status: TerminalPanelSnapshotStatus;',
  'source: TerminalPanelSnapshotSource;',
].forEach((snippet) => {
  assertIncludes(workspaceTypes, snippet, 'terminal panel readiness should be registered in workspace snapshot types');
});

[
  'export function buildTerminalPanelSnapshot',
  'TerminalPanelSnapshotStatus',
  'TerminalPanelSnapshotSource',
  'TerminalPanelConnectionStatus',
  'type TerminalPanelBooleanFactList = readonly boolean[]',
  'type TerminalPanelConnectionStatusList = readonly TerminalPanelConnectionStatus[]',
  'type TerminalPanelSnapshotStatusList = readonly TerminalPanelSnapshotStatus[]',
  'TERMINAL_PANEL_STARTING_CONNECTION_STATUSES',
  'TERMINAL_PANEL_ERROR_BANNER_CONNECTION_STATUSES',
  'TERMINAL_PANEL_USER_ACTION_STATUSES',
  'function hasTerminalPanelTrueFact',
  'function isTerminalPanelConnectionStatusIn',
  'function isTerminalPanelSnapshotStatusIn',
  'function hasTerminalPanelProject',
  'function canReconnectTerminalPanel',
  'function isTerminalPanelStarting',
  'function isTerminalPanelReady',
  'function hasTerminalPanelErrorBanner',
  'function getTerminalPanelSnapshotStatus',
  'function getTerminalPanelSnapshotSource',
  'function getTerminalPanelSnapshotMessage',
  'function getTerminalPanelSnapshotRecovery',
  'status: TerminalPanelConnectionStatus',
  'const hasProject = hasTerminalPanelProject(projectId)',
  'const canReconnect = canReconnectTerminalPanel({ hasProject, isStarting })',
  'const hasStartingState = isTerminalPanelStarting({ isStarting, status })',
  'const hasReadyState = isTerminalPanelReady({ status, socketReady })',
  'const hasErrorBanner = hasTerminalPanelErrorBanner(status)',
  'const panelStatus = getTerminalPanelSnapshotStatus',
  'const source = getTerminalPanelSnapshotSource(panelStatus)',
  'const message = getTerminalPanelSnapshotMessage(panelStatus)',
  'const recovery = getTerminalPanelSnapshotRecovery',
  "'project_missing'",
  "'inactive'",
  "'mounting'",
  "'starting'",
  "'ready'",
  "'error'",
  "'closed'",
].forEach((snippet) => {
  assertIncludes(terminalPanelSnapshot, snippet, 'terminal panel readiness should be derived by the shared snapshot helper');
});
[
  'Boolean(projectId)',
  'const hasProject = projectId !== null && projectId.length > 0',
  'const canReconnect = hasProject === true && isStarting === false',
  'panelStatus: TerminalPanelSnapshotStatus = !hasProject',
  'panelStatus: TerminalPanelSnapshotStatus = hasProject === false',
  'canReconnect: hasProject && !isStarting',
  "isStarting === true || status === 'connecting'",
  "status === 'connected' && socketReady === true",
  "status === 'error' || status === 'closed'",
  "source: TerminalPanelSnapshotSource = panelStatus === 'project_missing'",
  "message: panelStatus === 'project_missing'",
  "recovery: panelStatus === 'project_missing'",
].forEach((snippet) => {
  assertNotIncludes(terminalPanelSnapshot, snippet, 'terminal panel snapshot should not regress to implicit project or reconnect gates');
});
assertNotIncludes(
  terminalPanelSnapshot,
  "status: 'idle' | 'connecting' | 'connected' | 'closed' | 'error'",
  'terminal panel helper should consume the named connection status contract',
);
[
  "TerminalPanelSnapshot['status']",
  "TerminalPanelSnapshot['source']",
].forEach((snippet) => {
  assertNotIncludes(terminalPanelSnapshot, snippet, 'terminal panel helper should not infer status/source from indexed snapshot access');
});
[
  'values.find(',
  'statuses.find(',
  'const matchedValue = values.find',
  'const matchedStatus = statuses.find',
].forEach((snippet) => {
  assertNotIncludes(terminalPanelSnapshot, snippet, 'terminal panel helper should not regress boolean or status membership scans to Array.find callbacks');
});

[
  'TerminalPanelConnectionStatus',
  'const statusRef = useRef<TerminalPanelConnectionStatus>',
  'const [status, setStatus] = useState<TerminalPanelConnectionStatus>',
  'const hasTerminalProjectId = projectId !== null && projectId.length > 0',
  'const hasTerminalSocket = socketRef.current !== null',
  'const canStartTerminalSession = hasTerminalProjectId === true && isStartingRef.current === false',
  'const canCloseTerminalSession = hasTerminalSocket === true',
  'const terminalMounted = xtermRef.current !== null',
  "const terminalSocketReady = typeof WebSocket !== 'undefined' && socketRef.current?.readyState === WebSocket.OPEN",
  "function getTerminalPanelSnapshotBooleanLabel(value: boolean): string",
  "function getTerminalPanelSnapshotSocketLabel(value: boolean): string",
  "import { buildTerminalPanelSnapshot } from '@/app/workspace/workspace-terminal-panel-snapshot'",
  'terminalMounted,',
  'socketReady: terminalSocketReady',
  'const terminalPanelSnapshot = buildTerminalPanelSnapshot',
  'const terminalPanelHasProjectLabel = getTerminalPanelSnapshotBooleanLabel(terminalPanelSnapshot.hasProject)',
  'const terminalPanelCanReconnectLabel = getTerminalPanelSnapshotBooleanLabel(terminalPanelSnapshot.canReconnect)',
  'const terminalPanelSocketReadyLabel = getTerminalPanelSnapshotSocketLabel(terminalPanelSnapshot.socketReady)',
  'data-testid="workspace-terminal-panel-snapshot"',
  '终端面板快照',
  'Phase: {terminalPanelSnapshot.status}',
  'Source: {terminalPanelSnapshot.source}',
  'Project: {terminalPanelHasProjectLabel}',
  'Active: {terminalPanelIsActiveLabel}',
  'Mounted: {terminalPanelMountedLabel}',
  'Socket: {terminalPanelSocketReadyLabel}',
  'Reconnect: {terminalPanelCanReconnectLabel}',
  'Close: {terminalPanelCanCloseLabel}',
  'Theme: {terminalPanelSnapshot.theme}',
  'Banner: {terminalPanelHasErrorBannerLabel}',
  '恢复建议：{terminalPanelSnapshot.recovery}',
].forEach((snippet) => {
  assertIncludes(terminalSource, snippet, 'terminal panel readiness should be modeled as a structured visible snapshot');
});
assertNotIncludes(
  terminalSource,
  "useState<'idle' | 'connecting' | 'connected' | 'closed' | 'error'>",
  'terminal component should keep panel connection state behind the named TerminalPanelConnectionStatus contract',
);
assertNotIncludes(
  terminalSource,
  "useRef<'idle' | 'connecting' | 'connected' | 'closed' | 'error'>",
  'terminal component should keep panel connection refs behind the named TerminalPanelConnectionStatus contract',
);
[
  'disabled={canStartTerminalSession === false}',
  'disabled={canCloseTerminalSession === false}',
].forEach((snippet) => {
  assertIncludes(terminalSource, snippet, 'terminal toolbar action buttons should consume explicit local gates');
});
[
  'disabled={!projectId || isStartingRef.current}',
  'disabled={!socketRef.current}',
  'terminalMounted: Boolean(xtermRef.current)',
  "terminalPanelSnapshot.hasProject ? 'yes' : 'no'",
  "terminalPanelSnapshot.socketReady ? 'ready' : 'not_ready'",
  "terminalPanelSnapshot.canReconnect ? 'yes' : 'no'",
].forEach((snippet) => {
  assertNotIncludes(terminalSource, snippet, 'terminal toolbar action buttons should not regress to implicit truthy gates');
});

[
  "export type TerminalCloseConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming'",
  "export type TerminalCloseConfirmationSnapshotSource = 'dialog_state' | 'terminal_session'",
  "export type TerminalCloseConfirmationSnapshotAction = 'none' | 'close_terminal'",
  "export type TerminalCloseConfirmationRiskLevel = 'none' | 'low' | 'medium'",
  'export type TerminalCloseConfirmationSnapshot = {',
  'status: TerminalCloseConfirmationSnapshotStatus;',
  'source: TerminalCloseConfirmationSnapshotSource;',
  'action: TerminalCloseConfirmationSnapshotAction;',
  'inputBufferLength: number',
  'hasPendingInput: boolean',
  'canConfirm: boolean',
  'canCancel: boolean',
  'riskLevel: TerminalCloseConfirmationRiskLevel;',
].forEach((snippet) => {
  assertIncludes(workspaceTypes, snippet, 'terminal close confirmation should be registered in workspace snapshot types');
});

[
  'export function buildTerminalCloseConfirmationSnapshot',
  'TerminalCloseConfirmationSnapshotStatus',
  'TerminalCloseConfirmationSnapshotSource',
  'TerminalCloseConfirmationSnapshotAction',
  'TerminalCloseConfirmationRiskLevel',
  'status: TerminalCloseConfirmationSnapshotStatus = isOpen',
  'source: TerminalCloseConfirmationSnapshotSource = isOpen',
  'action: TerminalCloseConfirmationSnapshotAction = isOpen',
  'riskLevel: TerminalCloseConfirmationRiskLevel = isOpen',
  "'confirming'",
  "'awaiting_confirmation'",
  "'closed'",
  'const canConfirm = isOpen === true && terminalPanelSnapshot.socketReady === true && isConfirming === false',
  'const canCancel = isOpen === true && isConfirming === false',
  'hasPendingInput',
  'function getTerminalCloseConfirmationSnapshotBooleanLabel(value: boolean): string',
  'function getTerminalCloseConfirmationSnapshotSocketLabel(value: boolean): string',
  'const hasProjectLabel = getTerminalCloseConfirmationSnapshotBooleanLabel(snapshot.hasProject)',
  'const socketReadyLabel = getTerminalCloseConfirmationSnapshotSocketLabel(snapshot.socketReady)',
  'const canConfirmLabel = getTerminalCloseConfirmationSnapshotBooleanLabel(snapshot.canConfirm)',
  'const canCancelLabel = getTerminalCloseConfirmationSnapshotBooleanLabel(snapshot.canCancel)',
  'data-testid="workspace-terminal-close-confirmation-snapshot"',
  'Terminal 关闭确认快照',
  'Phase: {snapshot.status}',
  'Project: {hasProjectLabel}',
  'Socket: {socketReadyLabel}',
  'PendingInput: {snapshot.inputBufferLength}',
  'Confirm: {canConfirmLabel}',
  'Cancel: {canCancelLabel}',
].forEach((snippet) => {
  assertIncludes(terminalCloseConfirmationSnapshot, snippet, 'terminal close confirmation should expose socket, pending input and capability through a stable snapshot target');
});
[
  '&& !isConfirming',
  "snapshot.hasProject ? 'yes' : 'no'",
  "snapshot.socketReady ? 'ready' : 'not_ready'",
  "snapshot.canConfirm ? 'yes' : 'no'",
  "snapshot.canCancel ? 'yes' : 'no'",
].forEach((snippet) => {
  assertNotIncludes(terminalCloseConfirmationSnapshot, snippet, 'terminal close confirmation should not regress to implicit negation capability gates');
});
[
  "TerminalCloseConfirmationSnapshot['status']",
  "TerminalCloseConfirmationSnapshot['source']",
  "TerminalCloseConfirmationSnapshot['action']",
  "TerminalCloseConfirmationSnapshot['riskLevel']",
].forEach((snippet) => {
  assertNotIncludes(terminalCloseConfirmationSnapshot, snippet, 'terminal close confirmation helper should not infer status/source/action/risk from indexed snapshot access');
});

[
  'buildTerminalCloseConfirmationSnapshot',
  'TerminalCloseConfirmationSnapshotStrip',
  'const [isTerminalCloseConfirmationOpen, setIsTerminalCloseConfirmationOpen] = useState(false)',
  'const terminalCloseConfirmationSnapshot = buildTerminalCloseConfirmationSnapshot',
  'inputBufferLength: inputBufferRef.current.length',
  'terminalCloseConfirmationSnapshot.canConfirm !== true',
  'onClick={() => setIsTerminalCloseConfirmationOpen(true)}',
  'open === false && isTerminalCloseConfirming === true',
  '<TerminalCloseConfirmationSnapshotStrip snapshot={terminalCloseConfirmationSnapshot} />',
  'disabled={terminalCloseConfirmationSnapshot.canCancel === false}',
  'disabled={terminalCloseConfirmationSnapshot.canConfirm === false}',
  'variant="destructive"',
  'terminalCloseConfirmationSnapshot.canConfirm === true',
  'handleManualClose()',
].forEach((snippet) => {
  assertIncludes(terminalSource, snippet, 'terminal close should open a structured confirmation before closing the WebSocket PTY session');
});
assertNotIncludes(
  terminalSource,
  'onClick={handleManualClose}\n            disabled={!socketRef.current}',
  'terminal close toolbar button must not directly close the WebSocket PTY session',
);
[
  'if (!terminalCloseConfirmationSnapshot.canConfirm) {',
  'if (!open && isTerminalCloseConfirming) {',
  'disabled={!terminalCloseConfirmationSnapshot.canCancel}',
  'disabled={!terminalCloseConfirmationSnapshot.canConfirm}',
  'onClick={handleManualClose}',
].forEach((snippet) => {
  assertNotIncludes(terminalSource, snippet, 'terminal close confirmation should use explicit canConfirm/canCancel and open-state gates');
});

[
  'type TerminalConnectionSnapshot = {',
  'type TerminalPanelSnapshot = {',
  'type TerminalCloseConfirmationSnapshot = {',
  "type TerminalThemeMode = 'dark' | 'light'",
].forEach((snippet) => {
  assertNotIncludes(terminalSource, snippet, 'terminal snapshot types should not remain local to the terminal component');
});

[
  "type TerminalWebSocketInputPayload = {",
  "type: 'input';",
  'data: string;',
  "type TerminalWebSocketResizePayload = {",
  "type: 'resize';",
  'rows: number;',
  'cols: number;',
  'export type TerminalWebSocketSendPayload =',
  'type TerminalSendResult',
  'payload: TerminalWebSocketSendPayload',
  "from '@/lib/workspace/terminal-local-errors'",
  'formatTerminalWebSocketError(error,',
  "formatTerminalWebSocketState('终端连接不可用', 'WebSocket is not open')",
  '浏览器拒绝写入终端 WebSocket',
  "setStatusMessage(`终端输入发送失败：${sendResult.reason}`)",
  '当前输入未确认写入容器 PTY',
  "formatTerminalWebSocketState('WebSocket 握手失败或连接异常', 'browser WebSocket onerror fired')",
  "formatTerminalWebSocketError(error, '终端连接失败')",
  'role={status === \'error\' ? \'alert\' : \'status\'}',
].forEach((snippet) => {
  assertIncludes(terminalSource, snippet, 'terminal WebSocket failures should be user-visible with structured source/details');
});
assertNotIncludes(
  terminalSource,
  'payload: Record<string, unknown>',
  'terminal WebSocket send payload should use a named protocol contract instead of anonymous Record',
);

[
  'export type TerminalWebSocketLocalMessage = string',
  'export type TerminalWebSocketLocalDetails = string',
  'export type TerminalWebSocketStructuredError = {',
  'function readTerminalWebSocketStructuredError(error: unknown): TerminalWebSocketStructuredError | null',
  'const hasErrorObject = error !== null && typeof error ===',
  "const hasSourceField = 'source' in error",
  'function hasStructuredErrorSource(error: unknown): boolean',
  'const structuredError = readTerminalWebSocketStructuredError(error)',
  'const hasStructuredError = structuredError !== null',
  "const hasSource = typeof structuredError.source === 'string'",
  'export function formatTerminalWebSocketError',
  'fallback: TerminalWebSocketLocalDetails',
  'export function formatTerminalWebSocketState',
  'message: TerminalWebSocketLocalMessage',
  'details: TerminalWebSocketLocalDetails',
  "source: 'terminal_websocket'",
  'formatUserVisibleApiError(error, fallback)',
].forEach((snippet) => {
  assertIncludes(terminalLocalErrors, snippet, 'terminal WebSocket local errors should be centralized with structured source/details');
});
assertNotIncludes(
  terminalLocalErrors,
  'fallback: string',
  'terminal WebSocket local error fallback should not regress to raw string',
);
assertNotIncludes(
  terminalLocalErrors,
  'message: string, details: string',
  'terminal WebSocket state formatter should consume named message/details contracts',
);
assertNotIncludes(
  terminalLocalErrors,
  'return Boolean(',
  'terminal WebSocket local error source gate should not regress to Boolean coercion',
);

assertNotIncludes(
  terminalSource,
  'catch {\n      return false;',
  'terminal WebSocket send failures must not be silently collapsed to false',
);
assertNotIncludes(
  terminalSource,
  "setStatusMessage(error instanceof Error ? error.message : '终端连接失败')",
  'terminal connection failures must not render bare error.message',
);
assertNotIncludes(
  terminalSource,
  "source: 'terminal_websocket'",
  'terminal component should not duplicate terminal_websocket source formatting outside the shared helper',
);

assertIncludes(
  validationLayer,
  '终端输入发送、WebSocket 握手异常和终端连接启动失败必须通过 Terminal WebSocket local helper 保留 `source=terminal_websocket` 或已有代理来源',
  'Validation Layer should document terminal WebSocket source/details visibility',
);
assertIncludes(
  validationLayer,
  'Terminal 连接阶段必须维护 `workspace-types.ts` 的 `TerminalConnectionSnapshotStatus/Source` 与 `TerminalConnectionSnapshot`',
  'Validation Layer should document terminal connection snapshot shared type registration',
);
assertIncludes(
  validationLayer,
  'workspace-terminal-connection-snapshot',
  'Validation Layer should document terminal connection snapshot stable UI target',
);
assertIncludes(
  validationLayer,
  'Terminal 面板级快照必须维护 `TerminalPanelSnapshotStatus/Source` 与 `TerminalPanelConnectionStatus` 命名 contract',
  'Validation Layer should document terminal panel snapshot shared type registration',
);
assertIncludes(
  validationLayer,
  'Terminal component connection status contract 校验，包括 `TerminalPanel` 组件内部 `statusRef` 与 `status` state 必须直接消费 `TerminalPanelConnectionStatus`',
  'Validation Layer should document terminal component connection status contract consumption',
);
assertIncludes(
  validationLayer,
  'Terminal 关闭确认 snapshot 校验，包括 `TerminalCloseConfirmationSnapshotStatus/Source/Action` 与 `TerminalCloseConfirmationRiskLevel` 必须作为命名 contract 进入中央类型',
  'Validation Layer should document terminal close confirmation named contracts',
);
assertIncludes(
  validationLayer,
  'Terminal 关闭确认 snapshot 校验',
  'Validation Layer should document terminal close confirmation snapshot governance',
);
assertIncludes(
  yesScript,
  'validate-terminal-visibility-model.mjs',
  'YES validation should execute the terminal visibility model',
);

console.log('[YES] Terminal visibility model validation passed.');
