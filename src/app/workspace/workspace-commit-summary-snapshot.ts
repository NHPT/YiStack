import type { GitCommit } from '@/lib/types';

import type {
  CommitSummarySnapshot,
  CommitSummarySnapshotSource,
  CommitSummarySnapshotStatus,
} from './workspace-types';

type CommitSummarySnapshotOptions = {
  commit: GitCommit;
  shortHash: string;
  canRestore: boolean;
  canView: boolean;
};

function getCommitSummarySnapshotMessage(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return value.trim();
}

function hasCommitSummarySnapshotMessage(message: string): boolean {
  const hasMessage = message.length > 0;
  return hasMessage === true;
}

export function buildCommitSummarySnapshot({
  commit,
  shortHash,
  canRestore,
  canView,
}: CommitSummarySnapshotOptions): CommitSummarySnapshot {
  const normalizedMessage = getCommitSummarySnapshotMessage(commit.message);
  const hasMessage = hasCommitSummarySnapshotMessage(normalizedMessage);
  const hasRestoreAction = canRestore === true;
  const hasViewAction = canView === true;
  const hasAllActions = hasRestoreAction === true && hasViewAction === true;
  const status: CommitSummarySnapshotStatus = hasMessage === false
    ? 'summary_missing'
    : hasAllActions === true
      ? 'ready'
      : hasRestoreAction === true
        ? 'restore_only'
        : hasViewAction === true
          ? 'view_only'
          : 'actions_missing';
  const source: CommitSummarySnapshotSource = status === 'summary_missing' ? 'commit_metadata' : 'commit_actions';

  return {
    status,
    source,
    shortHash,
    hasMessage,
    canRestore,
    canView,
    message: status === 'ready'
      ? '该版本摘要和操作入口已就绪。'
      : status === 'summary_missing'
        ? '该版本缺少提交摘要。'
        : status === 'actions_missing'
          ? '该版本缺少恢复和查看入口。'
          : status === 'restore_only'
            ? '该版本仅提供回到该版本入口。'
            : '该版本仅提供查看修改记录入口。',
    recovery: status === 'ready'
      ? '可查看修改记录或回到该版本；操作结果会进入 Git/Workspace 状态链路。'
      : status === 'summary_missing'
        ? '检查 Git commit 数据是否缺少 message 字段。'
        : '检查 ChatMessageContent 的 commit action wiring，确保恢复和查看入口都已传入。',
    updatedAt: 'derived',
  };
}
