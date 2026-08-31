'use client';

import { cn } from '@/lib/utils';

import type {
  WorkspaceDirtyCloseConfirmationRiskLevel,
  WorkspaceDirtyCloseConfirmationSnapshot,
  WorkspaceDirtyCloseConfirmationSnapshotAction,
  WorkspaceDirtyCloseConfirmationSnapshotSource,
  WorkspaceDirtyCloseConfirmationSnapshotStatus,
} from './workspace-types';

function getWorkspaceFileName(path: string) {
  const pathSegments = materializeWorkspaceDirtyCloseFilePathSegments(path);
  const lastSegment = getWorkspaceDirtyCloseLastFilePathSegment(pathSegments);
  const hasLastSegment = lastSegment !== undefined;
  if (hasLastSegment === true) {
    return lastSegment;
  }

  return path;
}

function materializeWorkspaceDirtyCloseFilePathSegments(path: string): string[] {
  const pathSegments: string[] = [];
  for (const part of path.split('/')) {
    const hasPart = part.length > 0;
    if (hasPart === true) {
      pathSegments.push(part);
    }
  }

  return pathSegments;
}

function getWorkspaceDirtyCloseLastFilePathSegment(pathSegments: string[]): string | undefined {
  let lastSegment: string | undefined;

  for (const pathSegment of pathSegments) {
    lastSegment = pathSegment;
  }

  return lastSegment;
}

function getWorkspaceDirtyCloseConfirmationFilePath(filePath: string | null): string | null {
  const hasFilePath = filePath !== null;
  if (hasFilePath === false) {
    return null;
  }

  const normalizedFilePath = filePath.trim();
  const hasNormalizedFilePath = normalizedFilePath.length > 0;
  if (hasNormalizedFilePath === false) {
    return null;
  }

  return normalizedFilePath;
}

function hasWorkspaceDirtyCloseConfirmationTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

export function buildWorkspaceDirtyCloseConfirmationSnapshot({
  filePath,
  hasEditorBuffer,
  hasSavedSnapshot,
}: {
  filePath: string | null;
  hasEditorBuffer: boolean;
  hasSavedSnapshot: boolean;
}): WorkspaceDirtyCloseConfirmationSnapshot {
  const normalizedFilePath = getWorkspaceDirtyCloseConfirmationFilePath(filePath);
  const hasFile = hasWorkspaceDirtyCloseConfirmationTextValue(normalizedFilePath);
  const status: WorkspaceDirtyCloseConfirmationSnapshotStatus = hasFile ? 'awaiting_confirmation' : 'closed';
  const source: WorkspaceDirtyCloseConfirmationSnapshotSource = hasFile ? 'dirty_close' : 'dialog_state';
  const action: WorkspaceDirtyCloseConfirmationSnapshotAction = hasFile ? 'choose_save_or_discard' : 'none';
  const riskLevel: WorkspaceDirtyCloseConfirmationRiskLevel = hasFile ? 'high' : 'none';

  return {
    status,
    source,
    action,
    filePath: normalizedFilePath,
    fileName: normalizedFilePath !== null ? getWorkspaceFileName(normalizedFilePath) : null,
    hasFile,
    hasEditorBuffer,
    hasSavedSnapshot,
    canCancel: hasFile,
    canDiscard: hasFile,
    canSaveAndClose: hasFile,
    riskLevel,
    message: hasFile
      ? '当前文件存在未保存修改，关闭前需要选择保存或丢弃。'
      : '当前没有待确认的 dirty 文件关闭操作。',
    recovery: hasFile
      ? '选择保存并关闭会复用既有 saveFile 链路；选择不保存会丢弃当前未保存 editor buffer，并恢复到最近保存快照或关闭标签页，不写入后端文件，也不创建 Git 快照。'
      : '重新关闭 dirty 文件后会再次打开确认对话框。',
    updatedAt: 'derived',
  };
}

function getWorkspaceDirtyCloseConfirmationSnapshotClassName(snapshot: WorkspaceDirtyCloseConfirmationSnapshot) {
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-destructive/30 bg-destructive/10 text-destructive';
  }
  return 'border-muted-foreground/20 bg-muted/20 text-muted-foreground';
}

function getWorkspaceDirtyCloseConfirmationSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = hasWorkspaceDirtyCloseConfirmationTextValue(value);

  return hasValue === true ? value : fallback;
}

function getWorkspaceDirtyCloseConfirmationSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function WorkspaceDirtyCloseConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: WorkspaceDirtyCloseConfirmationSnapshot;
}) {
  const fileNameLabel = getWorkspaceDirtyCloseConfirmationSnapshotLabel(snapshot.fileName, 'none');
  const filePathLabel = getWorkspaceDirtyCloseConfirmationSnapshotLabel(snapshot.filePath, 'none');
  const hasEditorBufferLabel = getWorkspaceDirtyCloseConfirmationSnapshotBooleanLabel(snapshot.hasEditorBuffer);
  const hasSavedSnapshotLabel = getWorkspaceDirtyCloseConfirmationSnapshotBooleanLabel(snapshot.hasSavedSnapshot);
  const canCancelLabel = getWorkspaceDirtyCloseConfirmationSnapshotBooleanLabel(snapshot.canCancel);
  const canDiscardLabel = getWorkspaceDirtyCloseConfirmationSnapshotBooleanLabel(snapshot.canDiscard);
  const canSaveAndCloseLabel = getWorkspaceDirtyCloseConfirmationSnapshotBooleanLabel(snapshot.canSaveAndClose);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-dirty-close-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getWorkspaceDirtyCloseConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Dirty 文件关闭确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>File: {fileNameLabel}</span>
        <span>Buffer: {hasEditorBufferLabel}</span>
        <span>Saved: {hasSavedSnapshotLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>Cancel: {canCancelLabel}</span>
        <span>Discard: {canDiscardLabel}</span>
        <span>SaveClose: {canSaveAndCloseLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 truncate opacity-80">目标文件：{filePathLabel}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}
