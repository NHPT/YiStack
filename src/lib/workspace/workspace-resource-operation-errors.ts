import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type WorkspaceResourceSyncStage =
  | 'project_detail'
  | 'file_tree'
  | 'commit_list';

export type CommitRestoreSyncStage = WorkspaceResourceSyncStage;
export type CommitRestoreSyncStageSource =
  | 'commit_restore_project_detail_sync'
  | 'commit_restore_file_tree_sync'
  | 'commit_restore_commit_list_sync';
export type CommitRestoreSyncStageLabelMap = {
  [stage in CommitRestoreSyncStage]: string;
};
export type CommitRestoreSyncStageSourceMap = {
  [stage in CommitRestoreSyncStage]: CommitRestoreSyncStageSource;
};
export type WorkspaceResourceOperationErrorDetails = string;
export type WorkspaceResourceStructuredStatusMessage = string;
export type WorkspaceResourceStructuredStatusSource = string;
export type WorkspaceResourceStructuredStatusDetails = string;

type CommitRestoreSyncStageSourceCarrier = {
  source?: unknown;
};

const commitRestoreSyncStageLabels: CommitRestoreSyncStageLabelMap = {
  project_detail: '项目详情同步',
  file_tree: 'Explorer 文件树同步',
  commit_list: 'Git 提交列表同步',
};

const commitRestoreSyncStageSources: CommitRestoreSyncStageSourceMap = {
  project_detail: 'commit_restore_project_detail_sync',
  file_tree: 'commit_restore_file_tree_sync',
  commit_list: 'commit_restore_commit_list_sync',
};

function isCommitRestoreSyncStageSourceCarrier(value: unknown): value is CommitRestoreSyncStageSourceCarrier {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'source' in value;
}

export function resolveCommitRestoreSyncStageFromSource(source: unknown): CommitRestoreSyncStage | undefined {
  switch (source) {
    case 'commit_restore_project_detail_sync':
      return 'project_detail';
    case 'commit_restore_file_tree_sync':
      return 'file_tree';
    case 'commit_restore_commit_list_sync':
      return 'commit_list';
    default:
      return undefined;
  }
}

export function resolveCommitRestoreSyncStageFromError(error: unknown): CommitRestoreSyncStage | undefined {
  if (!isCommitRestoreSyncStageSourceCarrier(error)) {
    return undefined;
  }
  return resolveCommitRestoreSyncStageFromSource(error.source);
}

export function getCommitRestoreSyncStageLabel(stage: CommitRestoreSyncStage) {
  return commitRestoreSyncStageLabels[stage];
}

export function formatWorkspaceResourceOperationFailure(
  error: unknown,
  fallback: WorkspaceResourceOperationErrorDetails = '请稍后重试',
) {
  return formatUserVisibleApiError(error, fallback);
}

export function formatWorkspaceResourceStructuredStatusError(
  message: WorkspaceResourceStructuredStatusMessage | undefined,
  source: WorkspaceResourceStructuredStatusSource | undefined,
  details: WorkspaceResourceStructuredStatusDetails | undefined,
  fallback: WorkspaceResourceOperationErrorDetails,
) {
  return formatUserVisibleApiError({
    message,
    source,
    details,
  }, fallback);
}

export function formatWorkspaceFileWriteSkippedCommitNotice(filePath: string, statusLabel: string) {
  return `文件 \`${filePath}\` 已保存，${statusLabel || '后端判断内容无变化'}，因此没有创建新的 Git 快照。当前编辑器保存快照已更新；Git 面板可能保持在原提交，这是预期状态而不是提交列表同步失败。`;
}

export function buildCommitRestoreSyncStageError(
  stage: CommitRestoreSyncStage,
  error: unknown,
  projectId: string,
  commitHash: string,
) {
  const reason = formatWorkspaceResourceOperationFailure(error);
  return Object.assign(new Error(`${getCommitRestoreSyncStageLabel(stage)}失败：${reason}`), {
    source: commitRestoreSyncStageSources[stage],
    details: `project_id=${projectId}；commit_hash=${commitHash}；stage=${stage}；reason=${reason}`,
  });
}

export async function runCommitRestoreSyncStage(
  stage: CommitRestoreSyncStage,
  operation: () => Promise<void>,
  projectId: string,
  commitHash: string,
) {
  try {
    await operation();
  } catch (error) {
    throw buildCommitRestoreSyncStageError(stage, error, projectId, commitHash);
  }
}
