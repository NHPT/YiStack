import { cn } from '@/lib/utils';

import type {
  TerminalCloseConfirmationRiskLevel,
  TerminalCloseConfirmationSnapshot,
  TerminalCloseConfirmationSnapshotAction,
  TerminalCloseConfirmationSnapshotSource,
  TerminalCloseConfirmationSnapshotStatus,
  TerminalPanelSnapshot,
} from './workspace-types';

export function buildTerminalCloseConfirmationSnapshot({
  isOpen,
  isConfirming,
  terminalPanelSnapshot,
  inputBufferLength,
}: {
  isOpen: boolean;
  isConfirming: boolean;
  terminalPanelSnapshot: TerminalPanelSnapshot;
  inputBufferLength: number;
}): TerminalCloseConfirmationSnapshot {
  const normalizedInputBufferLength = Math.max(0, inputBufferLength);
  const hasPendingInput = normalizedInputBufferLength > 0;
  const canConfirm = isOpen === true && terminalPanelSnapshot.socketReady === true && isConfirming === false;
  const canCancel = isOpen === true && isConfirming === false;
  const status: TerminalCloseConfirmationSnapshotStatus = isOpen
    ? isConfirming
      ? 'confirming'
      : 'awaiting_confirmation'
    : 'closed';
  const source: TerminalCloseConfirmationSnapshotSource = isOpen ? 'terminal_session' : 'dialog_state';
  const action: TerminalCloseConfirmationSnapshotAction = isOpen ? 'close_terminal' : 'none';
  const riskLevel: TerminalCloseConfirmationRiskLevel = isOpen
    ? hasPendingInput
      ? 'medium'
      : 'low'
    : 'none';

  return {
    status,
    source,
    action,
    hasProject: terminalPanelSnapshot.hasProject,
    socketReady: terminalPanelSnapshot.socketReady,
    inputBufferLength: normalizedInputBufferLength,
    hasPendingInput,
    canConfirm,
    canCancel,
    riskLevel,
    message: isOpen
      ? hasPendingInput
        ? 'Terminal 关闭等待确认；仍有待发送输入尚未确认写入容器 PTY。'
        : 'Terminal 关闭等待确认。'
      : '当前没有待确认的 Terminal 关闭动作。',
    recovery: isOpen
      ? '确认关闭会断开当前 WebSocket、清空待发送输入 buffer，并写入 manual_closed 连接快照；取消不会关闭 PTY 会话或清理输入 buffer。'
      : '点击关闭终端时会先进入确认边界，再执行既有手动关闭链路。',
    updatedAt: terminalPanelSnapshot.updatedAt,
  };
}

function getTerminalCloseConfirmationSnapshotClassName(snapshot: TerminalCloseConfirmationSnapshot) {
  if (snapshot.status === 'confirming') {
    return 'border-amber-300/70 bg-amber-500/10 text-amber-800 dark:text-amber-200';
  }
  if (snapshot.riskLevel === 'medium') {
    return 'border-destructive/60 bg-destructive/10 text-destructive';
  }
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-amber-300/70 bg-amber-500/10 text-amber-800 dark:text-amber-200';
  }
  return 'border-border bg-muted/40 text-muted-foreground';
}

function getTerminalCloseConfirmationSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function getTerminalCloseConfirmationSnapshotSocketLabel(value: boolean): string {
  return value === true ? 'ready' : 'not_ready';
}

export function TerminalCloseConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: TerminalCloseConfirmationSnapshot;
}) {
  const hasProjectLabel = getTerminalCloseConfirmationSnapshotBooleanLabel(snapshot.hasProject);
  const socketReadyLabel = getTerminalCloseConfirmationSnapshotSocketLabel(snapshot.socketReady);
  const canConfirmLabel = getTerminalCloseConfirmationSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getTerminalCloseConfirmationSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-terminal-close-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getTerminalCloseConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Terminal 关闭确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Project: {hasProjectLabel}</span>
        <span>Socket: {socketReadyLabel}</span>
        <span>PendingInput: {snapshot.inputBufferLength}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
