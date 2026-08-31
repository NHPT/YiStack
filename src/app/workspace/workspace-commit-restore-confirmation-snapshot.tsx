'use client';

import type { GitCommit } from '@/lib/types';
import { cn } from '@/lib/utils';

import { normalizeCommitVersion } from './workspace-page-helpers';
import type {
  WorkspaceCommitRestoreConfirmationRiskLevel,
  WorkspaceCommitRestoreConfirmationSnapshot,
  WorkspaceCommitRestoreConfirmationSnapshotAction,
  WorkspaceCommitRestoreConfirmationSnapshotSource,
  WorkspaceCommitRestoreConfirmationSnapshotStatus,
} from './workspace-types';

function getWorkspaceCommitRestoreConfirmationTrimmedValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmedValue = value.trim();
  const hasTrimmedValue = hasWorkspaceCommitRestoreConfirmationTextValue(trimmedValue);

  return hasTrimmedValue === true ? trimmedValue : null;
}

function hasWorkspaceCommitRestoreConfirmationTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

export function buildWorkspaceCommitRestoreConfirmationSnapshot({
  commit,
  isRestoring,
}: {
  commit: GitCommit | null;
  isRestoring: boolean;
}): WorkspaceCommitRestoreConfirmationSnapshot {
  const hasPendingCommit = commit !== null;
  const commitHash = getWorkspaceCommitRestoreConfirmationTrimmedValue(commit?.hash);
  const commitMessage = getWorkspaceCommitRestoreConfirmationTrimmedValue(commit?.message);
  const author = getWorkspaceCommitRestoreConfirmationTrimmedValue(commit?.author);
  const hasCommitHash = hasWorkspaceCommitRestoreConfirmationTextValue(commitHash);
  const hasCommit = hasPendingCommit === true && hasCommitHash === true;
  const hasMessage = hasWorkspaceCommitRestoreConfirmationTextValue(commitMessage);
  const canConfirm = hasCommit === true && isRestoring === false;
  const canCancel = hasCommit === true && isRestoring === false;
  const status: WorkspaceCommitRestoreConfirmationSnapshotStatus = hasPendingCommit === true
    ? isRestoring === true
      ? 'confirming'
      : 'awaiting_confirmation'
    : 'closed';
  const source: WorkspaceCommitRestoreConfirmationSnapshotSource = hasPendingCommit === true ? 'commit_restore' : 'dialog_state';
  const action: WorkspaceCommitRestoreConfirmationSnapshotAction = hasPendingCommit === true ? 'restore' : 'none';
  const riskLevel: WorkspaceCommitRestoreConfirmationRiskLevel = 'critical';
  const shortHash = commitHash !== null ? normalizeCommitVersion(commitHash) : 'none';

  return {
    status,
    source,
    action,
    commitHash,
    shortHash,
    commitMessage,
    author,
    hasCommit,
    hasMessage,
    canConfirm,
    canCancel,
    riskLevel,
    message: hasPendingCommit === true
      ? isRestoring === true
        ? '正在执行整仓版本恢复。'
        : '即将把当前 Workspace 恢复到指定 Git 提交。'
      : '当前没有待确认的整仓版本恢复操作。',
    recovery: hasPendingCommit === true
      ? '确认后会调用既有 commit restore 后端链路，恢复成功后清理编辑器缓存并刷新项目详情、Explorer 与 Git 提交列表；取消不会调用后端恢复接口。'
      : '从聊天关联版本或 Git 提交列表重新选择一个提交后再执行恢复。',
    updatedAt: 'derived',
  };
}

function getWorkspaceCommitRestoreConfirmationSnapshotClassName(snapshot: WorkspaceCommitRestoreConfirmationSnapshot) {
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-destructive/30 bg-destructive/10 text-destructive';
  }
  return 'border-muted-foreground/20 bg-muted/20 text-muted-foreground';
}

function getWorkspaceCommitRestoreConfirmationSnapshotLabel(
  value: string | null | undefined,
  fallback: string,
): string {
  const hasValue = hasWorkspaceCommitRestoreConfirmationTextValue(value);

  return hasValue === true ? value : fallback;
}

function getWorkspaceCommitRestoreConfirmationSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function WorkspaceCommitRestoreConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: WorkspaceCommitRestoreConfirmationSnapshot;
}) {
  const authorLabel = getWorkspaceCommitRestoreConfirmationSnapshotLabel(snapshot.author, 'none');
  const commitHashLabel = getWorkspaceCommitRestoreConfirmationSnapshotLabel(snapshot.commitHash, 'none');
  const hasMessageLabel = getWorkspaceCommitRestoreConfirmationSnapshotBooleanLabel(snapshot.hasMessage);
  const canConfirmLabel = getWorkspaceCommitRestoreConfirmationSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getWorkspaceCommitRestoreConfirmationSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-commit-restore-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getWorkspaceCommitRestoreConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">整仓版本恢复确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Commit: {snapshot.shortHash}</span>
        <span>Message: {hasMessageLabel}</span>
        <span>Author: {authorLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 truncate opacity-80">目标提交：{commitHashLabel}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}
