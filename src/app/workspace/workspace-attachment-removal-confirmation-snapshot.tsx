import { cn } from '@/lib/utils';

import type {
  AttachmentRemovalConfirmationRiskLevel,
  AttachmentRemovalConfirmationSnapshot,
  AttachmentRemovalConfirmationSnapshotAction,
  AttachmentRemovalConfirmationSnapshotSource,
  AttachmentRemovalConfirmationSnapshotStatus,
} from './workspace-types';

type AttachmentRemovalTarget = {
  name: string;
  size: number;
};

export function buildAttachmentRemovalConfirmationSnapshot({
  isOpen,
  isConfirming,
  attachment,
  attachmentIndex,
  attachmentCount,
}: {
  isOpen: boolean;
  isConfirming: boolean;
  attachment: AttachmentRemovalTarget | null;
  attachmentIndex: number | null;
  attachmentCount: number;
}): AttachmentRemovalConfirmationSnapshot {
  const hasAttachment = attachment !== null && attachmentIndex !== null;
  const canConfirm = isOpen === true && isConfirming === false && hasAttachment === true;
  const canCancel = isOpen === true && isConfirming === false;
  const status: AttachmentRemovalConfirmationSnapshotStatus = isConfirming
    ? 'confirming'
    : isOpen
      ? 'awaiting_confirmation'
      : 'closed';
  const isActionActive = status !== 'closed';
  const attachmentCountAfter = hasAttachment ? Math.max(0, attachmentCount - 1) : attachmentCount;
  const source: AttachmentRemovalConfirmationSnapshotSource = isActionActive ? 'dialog_state' : 'attachment_badge';
  const action: AttachmentRemovalConfirmationSnapshotAction = isActionActive ? 'remove_attachment' : 'none';
  const riskLevel: AttachmentRemovalConfirmationRiskLevel = isActionActive ? 'low' : 'none';

  return {
    status,
    source,
    action,
    fileName: attachment === null ? null : attachment.name,
    fileSize: attachment === null ? 0 : attachment.size,
    attachmentIndex,
    attachmentCountBefore: attachmentCount,
    attachmentCountAfter,
    hasAttachment,
    canConfirm,
    canCancel,
    riskLevel,
    message: isActionActive
      ? '附件移除等待确认；确认后会从本次待发送上下文中移除该文件。'
      : '当前没有待确认的附件移除动作。',
    recovery: isActionActive
      ? '确认后只会移除当前输入区选中的附件，不会删除本地文件、项目文件或已发送消息；取消会保留附件列表不变。'
      : '点击附件上的移除按钮会先进入确认边界，再允许更新待发送附件列表。',
    updatedAt: 'derived',
  };
}

function getAttachmentRemovalConfirmationSnapshotClassName(snapshot: AttachmentRemovalConfirmationSnapshot) {
  if (snapshot.status === 'awaiting_confirmation' || snapshot.status === 'confirming') {
    return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function hasAttachmentRemovalConfirmationTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getAttachmentRemovalConfirmationSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = hasAttachmentRemovalConfirmationTextValue(value);

  return hasValue === true ? value : fallback;
}

function getAttachmentRemovalConfirmationSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function AttachmentRemovalConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: AttachmentRemovalConfirmationSnapshot;
}) {
  const fileNameLabel = getAttachmentRemovalConfirmationSnapshotLabel(snapshot.fileName, 'none');
  const canConfirmLabel = getAttachmentRemovalConfirmationSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getAttachmentRemovalConfirmationSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-attachment-removal-confirmation-snapshot"
      className={cn('rounded-lg border px-3 py-2 text-xs', getAttachmentRemovalConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">附件移除确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>File: {fileNameLabel}</span>
        <span>Size: {snapshot.fileSize}</span>
        <span>Index: {snapshot.attachmentIndex === null ? 'none' : snapshot.attachmentIndex}</span>
        <span>Before: {snapshot.attachmentCountBefore}</span>
        <span>After: {snapshot.attachmentCountAfter}</span>
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
