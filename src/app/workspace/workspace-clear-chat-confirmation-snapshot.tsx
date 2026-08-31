import { cn } from '@/lib/utils';

import type {
  ClearChatConfirmationRiskLevel,
  ClearChatConfirmationSnapshot,
  ClearChatConfirmationSnapshotAction,
  ClearChatConfirmationSnapshotSource,
  ClearChatConfirmationSnapshotStatus,
  ClearChatConfirmationSurface,
} from './workspace-types';

function getClearChatConfirmationProjectName(projectName: string | null | undefined): string | null {
  const hasProjectName = projectName !== null && projectName !== undefined;
  if (hasProjectName === false) {
    return null;
  }

  const normalizedProjectName = projectName.trim();
  const hasNormalizedProjectName = normalizedProjectName.length > 0;
  if (hasNormalizedProjectName === false) {
    return null;
  }

  return normalizedProjectName;
}

function hasClearChatConfirmationTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

export function buildClearChatConfirmationSnapshot({
  isOpen,
  isConfirming,
  isMobile,
  projectName,
}: {
  isOpen: boolean;
  isConfirming: boolean;
  isMobile: boolean;
  projectName?: string | null;
}): ClearChatConfirmationSnapshot {
  const normalizedProjectName = getClearChatConfirmationProjectName(projectName);
  const hasProjectName = hasClearChatConfirmationTextValue(normalizedProjectName);
  const status: ClearChatConfirmationSnapshotStatus = isConfirming
    ? 'confirming'
    : isOpen
      ? 'awaiting_confirmation'
      : 'closed';
  const isActionActive = status !== 'closed';
  const source: ClearChatConfirmationSnapshotSource = isActionActive ? 'dialog_state' : 'header_action';
  const action: ClearChatConfirmationSnapshotAction = isActionActive ? 'clear_chat' : 'none';
  const surface: ClearChatConfirmationSurface = isMobile ? 'mobile' : 'desktop';
  const riskLevel: ClearChatConfirmationRiskLevel = isActionActive ? 'medium' : 'none';
  const canConfirm = isOpen === true && isConfirming === false;
  const canCancel = isOpen === true && isConfirming === false;

  return {
    status,
    source,
    action,
    surface,
    projectName: normalizedProjectName,
    hasProjectName,
    resetsMessages: true,
    resetsPreviewUrl: true,
    resetsEditorBuffers: true,
    resetsOpenFiles: true,
    canConfirm,
    canCancel,
    riskLevel,
    message: isActionActive
      ? '清空对话等待确认；确认后会清理当前 Workspace 的聊天消息和本地工作区显示状态。'
      : '当前没有待确认的清空对话动作。',
    recovery: isActionActive
      ? '确认后会复用既有 clearChat 链路清空消息、Preview 地址、编辑器 buffer、打开文件和 pending close 状态；取消不会修改当前聊天或编辑器状态。'
      : '点击清空对话会先进入确认边界，再允许执行本地清理。',
    updatedAt: 'derived',
  };
}

function getClearChatConfirmationSnapshotClassName(snapshot: ClearChatConfirmationSnapshot) {
  if (snapshot.status === 'awaiting_confirmation' || snapshot.status === 'confirming') {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function getClearChatConfirmationSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = hasClearChatConfirmationTextValue(value);

  return hasValue === true ? value : fallback;
}

function getClearChatConfirmationSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function getClearChatConfirmationSnapshotResetLabel(value: boolean): string {
  return value === true ? 'reset' : 'keep';
}

export function ClearChatConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: ClearChatConfirmationSnapshot;
}) {
  const projectNameLabel = getClearChatConfirmationSnapshotLabel(snapshot.projectName, 'none');
  const resetsMessagesLabel = getClearChatConfirmationSnapshotResetLabel(snapshot.resetsMessages);
  const resetsPreviewUrlLabel = getClearChatConfirmationSnapshotResetLabel(snapshot.resetsPreviewUrl);
  const resetsEditorBuffersLabel = getClearChatConfirmationSnapshotResetLabel(snapshot.resetsEditorBuffers);
  const resetsOpenFilesLabel = getClearChatConfirmationSnapshotResetLabel(snapshot.resetsOpenFiles);
  const canConfirmLabel = getClearChatConfirmationSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getClearChatConfirmationSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-clear-chat-confirmation-snapshot"
      className={cn('rounded-lg border px-3 py-2 text-xs', getClearChatConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">清空对话确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Surface: {snapshot.surface}</span>
        <span>Project: {projectNameLabel}</span>
        <span>Messages: {resetsMessagesLabel}</span>
        <span>Preview: {resetsPreviewUrlLabel}</span>
        <span>Editor: {resetsEditorBuffersLabel}</span>
        <span>OpenFiles: {resetsOpenFilesLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>Updated: {snapshot.updatedAt}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}
