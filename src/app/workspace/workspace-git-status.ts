import type {
  GitBranchCompareStatus,
  GitBranchCompareStatusValue,
  GitBranchListStatus,
  GitBranchListStatusValue,
  GitBranchListStatusSource,
  GitCommitDetailStatus,
  GitCommitListStatus,
  GitCommitListStatusValue,
  GitCommitListStatusSource,
  GitRemoteBranchListStatus,
  GitRemoteBranchListStatusValue,
  GitRemoteBranchListStatusSource,
  GitRemoteListStatus,
  GitRemoteListStatusValue,
  GitRemoteListStatusSource,
  GitStashListStatus,
  GitStashListStatusValue,
  GitStashListStatusSource,
  GitTagListStatus,
  GitTagListStatusValue,
  GitTagListStatusSource,
  GitWorktreeCleanlinessStatus,
  GitWorktreeStatusState,
  GitWorktreeStatusStateValue,
  GitWorktreeStatusStateSource,
} from './workspace-types';
import type { CommitRestoreSyncStage } from '@/lib/workspace/workspace-resource-operation-errors';

export type GitBranchCompareRefreshStatusSource = 'branch_compare_refresh' | 'workspace_bootstrap';

export type GitBranchCompareNoTargetStatusSource = 'branch_list_refresh' | 'workspace_bootstrap';

export type GitCommitDetailFreshStatusSource = 'commit_detail' | 'commit_list_refresh' | 'commit_restore';

type FreshGitCommitListStatusOptions = {
  source?: GitCommitListStatusSource;
  commitCount: number;
};

type StaleGitCommitListStatusOptions = {
  source?: GitCommitListStatusSource;
  previousStatus?: GitCommitListStatus | null;
  reasonMessage: string;
};

type FreshGitBranchListStatusOptions = {
  source?: GitBranchListStatusSource;
  branchCount: number;
};

type StaleGitBranchListStatusOptions = {
  source?: GitBranchListStatusSource;
  previousStatus?: GitBranchListStatus | null;
  reasonMessage: string;
};

type FreshGitRemoteListStatusOptions = {
  source?: GitRemoteListStatusSource;
  remoteCount: number;
};

type StaleGitRemoteListStatusOptions = {
  source?: GitRemoteListStatusSource;
  previousStatus?: GitRemoteListStatus | null;
  reasonMessage: string;
};

type FreshGitRemoteBranchListStatusOptions = {
  source?: GitRemoteBranchListStatusSource;
  remoteBranchCount: number;
};

type StaleGitRemoteBranchListStatusOptions = {
  source?: GitRemoteBranchListStatusSource;
  previousStatus?: GitRemoteBranchListStatus | null;
  reasonMessage: string;
};

type FreshGitTagListStatusOptions = {
  source?: GitTagListStatusSource;
  tagCount: number;
};

type StaleGitTagListStatusOptions = {
  source?: GitTagListStatusSource;
  previousStatus?: GitTagListStatus | null;
  reasonMessage: string;
};

type FreshGitStashListStatusOptions = {
  source?: GitStashListStatusSource;
  stashCount: number;
};

type StaleGitStashListStatusOptions = {
  source?: GitStashListStatusSource;
  previousStatus?: GitStashListStatus | null;
  reasonMessage: string;
};

type FreshGitWorktreeStatusOptions = {
  source?: GitWorktreeStatusStateSource;
  status: GitWorktreeCleanlinessStatus;
  dirtyFiles: number;
};

type StaleGitWorktreeStatusOptions = {
  source?: GitWorktreeStatusStateSource;
  previousStatus?: GitWorktreeStatusState | null;
  reasonMessage: string;
};

type FreshGitBranchCompareStatusOptions = {
  source?: GitBranchCompareRefreshStatusSource;
  baseBranch: string;
  headBranch: string;
};

type StaleGitBranchCompareStatusOptions = {
  source?: GitBranchCompareRefreshStatusSource;
  previousStatus?: GitBranchCompareStatus | null;
  baseBranch: string;
  headBranch: string;
  reasonMessage: string;
};

type NoTargetGitBranchCompareStatusOptions = {
  source?: GitBranchCompareNoTargetStatusSource;
  baseBranch?: string;
};

type FreshGitCommitDetailStatusOptions = {
  source: GitCommitDetailFreshStatusSource;
  commitHash: string;
};

type ViewCommitCacheFallbackGitCommitDetailStatusOptions = {
  commitHash: string;
  failureMessage?: string;
};

type CommitRestoreStaleGitCommitDetailStatusOptions = {
  commitHash: string;
  syncFailureStage?: CommitRestoreSyncStage;
};

type GitResourceUsableCacheStatusValue =
  | GitCommitListStatusValue
  | GitBranchListStatusValue
  | GitRemoteListStatusValue
  | GitRemoteBranchListStatusValue
  | GitTagListStatusValue
  | GitStashListStatusValue
  | GitWorktreeStatusStateValue
  | GitBranchCompareStatusValue;

type GitResourceUsableCacheStatusList = readonly GitResourceUsableCacheStatusValue[];

type GitResourceStaleStatusValue = 'stale_with_cache' | 'stale_without_cache';

type StaleGitResourceStatusMessageOptions = {
  hasUsableCache: boolean;
  reasonMessage: string;
  resourceName: string;
  cachedSnapshotLabel: string;
  missingSnapshotLabel: string;
};

const GIT_RESOURCE_USABLE_CACHE_STATUSES: GitResourceUsableCacheStatusList = [
  'fresh',
  'stale_with_cache',
];

function isGitResourceUsableCacheStatusValue(
  statusValue: GitResourceUsableCacheStatusValue | undefined,
): boolean {
  if (statusValue === undefined) {
    return false;
  }

  for (const candidate of GIT_RESOURCE_USABLE_CACHE_STATUSES) {
    const matchedStatus = candidate === statusValue;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function getStaleGitResourceStatus(hasUsableCache: boolean): GitResourceStaleStatusValue {
  if (hasUsableCache === true) {
    return 'stale_with_cache';
  }

  return 'stale_without_cache';
}

function getStaleGitResourceStatusMessage({
  hasUsableCache,
  reasonMessage,
  resourceName,
  cachedSnapshotLabel,
  missingSnapshotLabel,
}: StaleGitResourceStatusMessageOptions): string {
  if (hasUsableCache === true) {
    return `${resourceName}同步失败：${reasonMessage}。当前 Git 面板仍显示上一次成功同步的旧${cachedSnapshotLabel}。`;
  }

  return `${resourceName}同步失败：${reasonMessage}。当前 Git 面板没有可确认的后端${missingSnapshotLabel}。`;
}

function getGitCommitListStatusValue(
  status: GitCommitListStatus | null | undefined,
): GitCommitListStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  if (status === undefined) {
    return undefined;
  }

  return status.status;
}

function getGitBranchListStatusValue(
  status: GitBranchListStatus | null | undefined,
): GitBranchListStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  if (status === undefined) {
    return undefined;
  }

  return status.status;
}

function getGitRemoteListStatusValue(
  status: GitRemoteListStatus | null | undefined,
): GitRemoteListStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  if (status === undefined) {
    return undefined;
  }

  return status.status;
}

function getGitRemoteBranchListStatusValue(
  status: GitRemoteBranchListStatus | null | undefined,
): GitRemoteBranchListStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  if (status === undefined) {
    return undefined;
  }

  return status.status;
}

function getGitTagListStatusValue(
  status: GitTagListStatus | null | undefined,
): GitTagListStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  if (status === undefined) {
    return undefined;
  }

  return status.status;
}

function getGitStashListStatusValue(
  status: GitStashListStatus | null | undefined,
): GitStashListStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  if (status === undefined) {
    return undefined;
  }

  return status.status;
}

function getGitWorktreeStatusStateValue(
  status: GitWorktreeStatusState | null | undefined,
): GitWorktreeStatusStateValue | undefined {
  if (status === null) {
    return undefined;
  }

  if (status === undefined) {
    return undefined;
  }

  return status.status;
}

function getGitBranchCompareStatusValue(
  status: GitBranchCompareStatus | null | undefined,
): GitBranchCompareStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  if (status === undefined) {
    return undefined;
  }

  return status.status;
}

function hasUsableGitCommitListCache(status?: GitCommitListStatus | null): boolean {
  const statusValue = getGitCommitListStatusValue(status);
  return isGitResourceUsableCacheStatusValue(statusValue);
}

function hasUsableGitBranchListCache(status?: GitBranchListStatus | null): boolean {
  const statusValue = getGitBranchListStatusValue(status);
  return isGitResourceUsableCacheStatusValue(statusValue);
}

function hasUsableGitRemoteListCache(status?: GitRemoteListStatus | null): boolean {
  const statusValue = getGitRemoteListStatusValue(status);
  return isGitResourceUsableCacheStatusValue(statusValue);
}

function hasUsableGitRemoteBranchListCache(status?: GitRemoteBranchListStatus | null): boolean {
  const statusValue = getGitRemoteBranchListStatusValue(status);
  return isGitResourceUsableCacheStatusValue(statusValue);
}

function hasUsableGitTagListCache(status?: GitTagListStatus | null): boolean {
  const statusValue = getGitTagListStatusValue(status);
  return isGitResourceUsableCacheStatusValue(statusValue);
}

function hasUsableGitStashListCache(status?: GitStashListStatus | null): boolean {
  const statusValue = getGitStashListStatusValue(status);
  return isGitResourceUsableCacheStatusValue(statusValue);
}

function hasUsableGitWorktreeStatusCache(status?: GitWorktreeStatusState | null): boolean {
  const statusValue = getGitWorktreeStatusStateValue(status);
  return isGitResourceUsableCacheStatusValue(statusValue);
}

function hasUsableGitBranchCompareCache(status?: GitBranchCompareStatus | null): boolean {
  const statusValue = getGitBranchCompareStatusValue(status);
  return isGitResourceUsableCacheStatusValue(statusValue);
}

export function buildFreshGitCommitListStatus({
  source = 'commit_list_refresh',
  commitCount,
}: FreshGitCommitListStatusOptions): GitCommitListStatus {
  return {
    status: 'fresh',
    source,
    message: commitCount > 0
      ? 'Git 提交列表已从后端真源刷新。'
      : 'Git 提交列表已刷新，后端当前返回空提交历史。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildStaleGitCommitListStatus({
  source = 'commit_list_refresh',
  previousStatus,
  reasonMessage,
}: StaleGitCommitListStatusOptions): GitCommitListStatus {
  const hasUsableCache = hasUsableGitCommitListCache(previousStatus);

  return {
    status: getStaleGitResourceStatus(hasUsableCache),
    source,
    message: getStaleGitResourceStatusMessage({
      hasUsableCache,
      reasonMessage,
      resourceName: 'Git 提交列表',
      cachedSnapshotLabel: '提交列表',
      missingSnapshotLabel: '提交列表快照',
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function buildFreshGitBranchListStatus({
  source = 'branch_list_refresh',
  branchCount,
}: FreshGitBranchListStatusOptions): GitBranchListStatus {
  return {
    status: 'fresh',
    source,
    message: branchCount > 0
      ? 'Git 分支列表已从后端真源刷新。'
      : 'Git 分支列表已刷新，后端当前返回空分支列表。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildStaleGitBranchListStatus({
  source = 'branch_list_refresh',
  previousStatus,
  reasonMessage,
}: StaleGitBranchListStatusOptions): GitBranchListStatus {
  const hasUsableCache = hasUsableGitBranchListCache(previousStatus);

  return {
    status: getStaleGitResourceStatus(hasUsableCache),
    source,
    message: getStaleGitResourceStatusMessage({
      hasUsableCache,
      reasonMessage,
      resourceName: 'Git 分支列表',
      cachedSnapshotLabel: '分支列表',
      missingSnapshotLabel: '分支列表快照',
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function buildFreshGitRemoteListStatus({
  source = 'remote_list_refresh',
  remoteCount,
}: FreshGitRemoteListStatusOptions): GitRemoteListStatus {
  return {
    status: 'fresh',
    source,
    message: remoteCount > 0
      ? 'Git remote 列表已从后端真源刷新。'
      : 'Git remote 列表已刷新，后端当前返回空 remote 列表。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildStaleGitRemoteListStatus({
  source = 'remote_list_refresh',
  previousStatus,
  reasonMessage,
}: StaleGitRemoteListStatusOptions): GitRemoteListStatus {
  const hasUsableCache = hasUsableGitRemoteListCache(previousStatus);

  return {
    status: getStaleGitResourceStatus(hasUsableCache),
    source,
    message: getStaleGitResourceStatusMessage({
      hasUsableCache,
      reasonMessage,
      resourceName: 'Git remote 列表',
      cachedSnapshotLabel: 'remote 列表',
      missingSnapshotLabel: 'remote 列表快照',
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function buildFreshGitRemoteBranchListStatus({
  source = 'remote_branch_list_refresh',
  remoteBranchCount,
}: FreshGitRemoteBranchListStatusOptions): GitRemoteBranchListStatus {
  return {
    status: 'fresh',
    source,
    message: remoteBranchCount > 0
      ? 'Git 远端分支列表已从后端真源刷新。'
      : 'Git 远端分支列表已刷新，后端当前返回空远端分支列表。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildStaleGitRemoteBranchListStatus({
  source = 'remote_branch_list_refresh',
  previousStatus,
  reasonMessage,
}: StaleGitRemoteBranchListStatusOptions): GitRemoteBranchListStatus {
  const hasUsableCache = hasUsableGitRemoteBranchListCache(previousStatus);

  return {
    status: getStaleGitResourceStatus(hasUsableCache),
    source,
    message: getStaleGitResourceStatusMessage({
      hasUsableCache,
      reasonMessage,
      resourceName: 'Git 远端分支列表',
      cachedSnapshotLabel: '远端分支列表',
      missingSnapshotLabel: '远端分支列表快照',
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function buildFreshGitTagListStatus({
  source = 'tag_list_refresh',
  tagCount,
}: FreshGitTagListStatusOptions): GitTagListStatus {
  return {
    status: 'fresh',
    source,
    message: tagCount > 0
      ? 'Git 标签列表已从后端真源刷新。'
      : 'Git 标签列表已刷新，后端当前返回空标签列表。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildStaleGitTagListStatus({
  source = 'tag_list_refresh',
  previousStatus,
  reasonMessage,
}: StaleGitTagListStatusOptions): GitTagListStatus {
  const hasUsableCache = hasUsableGitTagListCache(previousStatus);

  return {
    status: getStaleGitResourceStatus(hasUsableCache),
    source,
    message: getStaleGitResourceStatusMessage({
      hasUsableCache,
      reasonMessage,
      resourceName: 'Git 标签列表',
      cachedSnapshotLabel: '标签列表',
      missingSnapshotLabel: '标签列表快照',
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function buildFreshGitStashListStatus({
  source = 'stash_list_refresh',
  stashCount,
}: FreshGitStashListStatusOptions): GitStashListStatus {
  return {
    status: 'fresh',
    source,
    message: stashCount > 0
      ? 'Git stash 列表已从后端真源刷新。'
      : 'Git stash 列表已刷新，后端当前返回空 stash 列表。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildStaleGitStashListStatus({
  source = 'stash_list_refresh',
  previousStatus,
  reasonMessage,
}: StaleGitStashListStatusOptions): GitStashListStatus {
  const hasUsableCache = hasUsableGitStashListCache(previousStatus);

  return {
    status: getStaleGitResourceStatus(hasUsableCache),
    source,
    message: getStaleGitResourceStatusMessage({
      hasUsableCache,
      reasonMessage,
      resourceName: 'Git stash 列表',
      cachedSnapshotLabel: 'stash 列表',
      missingSnapshotLabel: 'stash 列表快照',
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function buildFreshGitWorktreeStatus({
  source = 'worktree_status_refresh',
  status,
  dirtyFiles,
}: FreshGitWorktreeStatusOptions): GitWorktreeStatusState {
  return {
    status: 'fresh',
    source,
    message: status === 'dirty'
      ? `Git worktree 状态已刷新，当前存在 ${dirtyFiles} 个未提交变更。`
      : 'Git worktree 状态已刷新，当前没有未提交变更。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildStaleGitWorktreeStatus({
  source = 'worktree_status_refresh',
  previousStatus,
  reasonMessage,
}: StaleGitWorktreeStatusOptions): GitWorktreeStatusState {
  const hasUsableCache = hasUsableGitWorktreeStatusCache(previousStatus);

  return {
    status: getStaleGitResourceStatus(hasUsableCache),
    source,
    message: getStaleGitResourceStatusMessage({
      hasUsableCache,
      reasonMessage,
      resourceName: 'Git worktree 状态',
      cachedSnapshotLabel: 'worktree 状态',
      missingSnapshotLabel: 'worktree 状态快照',
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function buildFreshGitBranchCompareStatus({
  source = 'branch_compare_refresh',
  baseBranch,
  headBranch,
}: FreshGitBranchCompareStatusOptions): GitBranchCompareStatus {
  return {
    status: 'fresh',
    source,
    baseBranch,
    headBranch,
    message: `Git 分支对比已从后端真源刷新：${baseBranch}...${headBranch}。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildStaleGitBranchCompareStatus({
  source = 'branch_compare_refresh',
  previousStatus,
  baseBranch,
  headBranch,
  reasonMessage,
}: StaleGitBranchCompareStatusOptions): GitBranchCompareStatus {
  const hasUsableCache = hasUsableGitBranchCompareCache(previousStatus);

  return {
    status: getStaleGitResourceStatus(hasUsableCache),
    source,
    baseBranch,
    headBranch,
    message: getStaleGitResourceStatusMessage({
      hasUsableCache,
      reasonMessage,
      resourceName: 'Git 分支对比',
      cachedSnapshotLabel: '分支对比',
      missingSnapshotLabel: '分支对比快照',
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function buildNoTargetGitBranchCompareStatus({
  source = 'branch_list_refresh',
  baseBranch = '',
}: NoTargetGitBranchCompareStatusOptions): GitBranchCompareStatus {
  return {
    status: 'no_target',
    source,
    baseBranch,
    headBranch: '',
    message: baseBranch
      ? `当前只有 ${baseBranch} 可作为分支对比基准，暂无可对比目标分支。`
      : '当前没有可确认的分支对比基准和目标分支。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildFreshGitCommitDetailStatus({
  source,
  commitHash,
}: FreshGitCommitDetailStatusOptions): GitCommitDetailStatus {
  return {
    status: 'fresh',
    source,
    commitHash,
    message: source === 'commit_restore'
      ? `版本 ${commitHash} 已在恢复后的 Git 提交列表中确认。`
      : source === 'commit_detail'
        ? `版本 ${commitHash} 的详情已从后端 Git 真源读取。`
        : `版本 ${commitHash} 已从最新 Git 提交列表确认。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildViewCommitCacheFallbackGitCommitDetailStatus({
  commitHash,
  failureMessage,
}: ViewCommitCacheFallbackGitCommitDetailStatusOptions): GitCommitDetailStatus {
  return {
    status: 'stale_from_cache',
    source: 'view_commit_cache_fallback',
    commitHash,
    message: failureMessage
      ? `查看版本 ${commitHash} 时读取提交详情失败：${failureMessage}。当前详情来自已打开的缓存快照。`
      : `查看版本 ${commitHash} 时未能在最新 Git 提交列表中确认该提交，当前详情来自已打开的缓存快照。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildCommitRestoreStaleGitCommitDetailStatus({
  commitHash,
  syncFailureStage,
}: CommitRestoreStaleGitCommitDetailStatusOptions): GitCommitDetailStatus {
  return {
    status: 'stale_from_cache',
    source: 'commit_restore',
    commitHash,
    message: syncFailureStage === 'commit_list'
      ? `版本 ${commitHash} 的恢复请求已执行，但 Git 提交列表尚未完成同步确认。当前详情仅可作为目标提交参考。`
      : `版本 ${commitHash} 的恢复请求已执行，但恢复后资源视图尚未完成同步确认。当前详情仅可作为目标提交参考。`,
    updatedAt: new Date().toISOString(),
  };
}
