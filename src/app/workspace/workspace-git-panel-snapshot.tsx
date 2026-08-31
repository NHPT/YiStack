'use client';

import type { ReactNode } from 'react';

import type { GitBranch, GitBranchCompare, GitBranchCompareCommit, GitBranchCompareFile, GitCommit, GitDiff, GitRemoteBranch, GitStash, GitTag, GitWorktreeFile, GitWorktreeStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

import type {
  GitBranchCompareFileApplyConfirmationSnapshot,
  GitBranchCompareFileApplyConfirmationSnapshotAction,
  GitBranchCompareFileApplyConfirmationSnapshotSource,
  GitBranchCompareFileApplyConfirmationSnapshotStatus,
  GitBranchCompareFileApplyConfirmationRiskLevel,
  GitBranchCompareSnapshot,
  GitBranchCompareSnapshotSource,
  GitBranchCompareSnapshotStatus,
  GitBranchCompareStatus,
  GitBranchCompareStatusValue,
  GitBranchListStatus,
  GitBranchMutationConfirmationAction,
  GitBranchMutationConfirmationSnapshot,
  GitBranchMutationConfirmationSnapshotAction,
  GitBranchMutationConfirmationSnapshotSource,
  GitBranchMutationConfirmationSnapshotStatus,
  GitBranchMutationConfirmationRiskLevel,
  GitBranchSnapshot,
  GitBranchSnapshotSource,
  GitBranchSnapshotStatus,
  GitBranchSwitchConfirmationSnapshot,
  GitBranchSwitchConfirmationSnapshotAction,
  GitBranchSwitchConfirmationSnapshotSource,
  GitBranchSwitchConfirmationSnapshotStatus,
  GitBranchSwitchConfirmationRiskLevel,
  GitBranchListStatusValue,
  GitCommitDetailSnapshot,
  GitCommitDetailSnapshotSource,
  GitCommitDetailSnapshotStatus,
  GitCommitDetailStatus,
  GitCommitDetailStatusValue,
  GitCommitFileRestoreConfirmationSnapshot,
  GitCommitFileRestoreConfirmationSnapshotAction,
  GitCommitFileRestoreConfirmationSnapshotSource,
  GitCommitFileRestoreConfirmationSnapshotStatus,
  GitCommitFileRestoreConfirmationRiskLevel,
  GitCommitItemSnapshot,
  GitCommitItemSnapshotSource,
  GitCommitItemSnapshotStatus,
  GitCommitListStatus,
  GitCommitListStatusValue,
  GitDiffFileItemSnapshot,
  GitDiffFileItemSnapshotSource,
  GitDiffFileItemSnapshotStatus,
  GitPanelSnapshot,
  GitPanelSnapshotSource,
  GitPanelSnapshotStatus,
  GitRemoteBranchCreateConfirmationSnapshot,
  GitRemoteBranchCreateConfirmationSnapshotAction,
  GitRemoteBranchCreateConfirmationSnapshotSource,
  GitRemoteBranchCreateConfirmationSnapshotStatus,
  GitRemoteBranchCreateConfirmationRiskLevel,
  GitRemoteBranchListStatus,
  GitRemoteBranchListStatusValue,
  GitRemoteBranchRefreshConfirmationSnapshot,
  GitRemoteBranchRefreshConfirmationSnapshotAction,
  GitRemoteBranchRefreshConfirmationSnapshotSource,
  GitRemoteBranchRefreshConfirmationSnapshotStatus,
  GitRemoteBranchRefreshConfirmationRiskLevel,
  GitRemoteBranchSnapshot,
  GitRemoteBranchSnapshotSource,
  GitRemoteBranchSnapshotStatus,
  GitStashListStatus,
  GitStashListStatusValue,
  GitStashMutationConfirmationAction,
  GitStashMutationConfirmationSnapshot,
  GitStashMutationConfirmationSnapshotAction,
  GitStashMutationConfirmationSnapshotSource,
  GitStashMutationConfirmationSnapshotStatus,
  GitStashMutationConfirmationRiskLevel,
  GitStashSnapshot,
  GitStashSnapshotSource,
  GitStashSnapshotStatus,
  GitTagListStatus,
  GitTagListStatusValue,
  GitTagMutationConfirmationAction,
  GitTagMutationConfirmationSnapshot,
  GitTagMutationConfirmationSnapshotAction,
  GitTagMutationConfirmationSnapshotSource,
  GitTagMutationConfirmationSnapshotStatus,
  GitTagMutationConfirmationRiskLevel,
  GitTagSnapshot,
  GitTagSnapshotSource,
  GitTagSnapshotStatus,
  GitWorktreeCleanlinessStatus,
  GitWorktreeCommitConfirmationSnapshot,
  GitWorktreeCommitConfirmationSnapshotAction,
  GitWorktreeCommitConfirmationSnapshotSource,
  GitWorktreeCommitConfirmationSnapshotStatus,
  GitWorktreeCommitConfirmationRiskLevel,
  GitWorktreeFileDiscardConfirmationSnapshot,
  GitWorktreeFileDiscardConfirmationSnapshotAction,
  GitWorktreeFileDiscardConfirmationSnapshotSource,
  GitWorktreeFileDiscardConfirmationSnapshotStatus,
  GitWorktreeFileDiscardConfirmationRiskLevel,
  GitWorktreeSnapshot,
  GitWorktreeSnapshotSource,
  GitWorktreeSnapshotStatus,
  GitWorktreeStatusState,
  GitWorktreeStatusStateValue,
  GitWorktreeVisibleDirtyFileList,
} from './workspace-types';
import { normalizeCommitVersion } from './workspace-page-helpers';

export type GitBranchMutationConfirmation = {
  action: GitBranchMutationConfirmationAction;
  branchName: string;
  nextBranchName?: string;
};

export type GitBranchSwitchConfirmation = {
  action: 'switch';
  currentBranch?: string;
  targetBranch: string;
  readinessStatus?: string;
  dirtyFiles?: number;
  canSwitch?: boolean;
};

export type GitBranchCompareFileApplyConfirmation = {
  action: 'apply';
  baseBranch: string;
  headBranch: string;
  filePath: string;
};

export type GitCommitFileRestoreConfirmation = {
  action: 'restore';
  commit: GitCommit;
  filePath: string;
};

export type GitTagMutationConfirmation = {
  action: GitTagMutationConfirmationAction;
  tagName: string;
  targetCommit?: string;
};

export type GitRemoteBranchRefreshConfirmation = {
  action: 'refresh';
  remoteName: string;
};

export type GitRemoteBranchCreateConfirmation = {
  action: 'create_tracking';
  remoteBranchName: string;
  localBranchName: string;
};

export type GitRemoteBranchCreateLocalNameDraftMap = {
  [remoteBranchName: string]: string;
};

export type GitStashMutationConfirmation = {
  action: GitStashMutationConfirmationAction;
  stashRef?: string;
  stashMessage?: string;
  branch?: string;
  targetCommit?: string;
};

export type GitWorktreeFileDiscardConfirmation = {
  action: 'discard';
  filePath: string;
};

export type GitWorktreeCommitConfirmation = {
  action: 'commit';
  commitMessage: string;
  currentBranch?: string;
  dirtyFiles?: number;
};

function hasGitSnapshotTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getGitSnapshotLabel<TGitSnapshotLabel extends string>(
  value: TGitSnapshotLabel | null | undefined,
  fallback: TGitSnapshotLabel,
): TGitSnapshotLabel {
  const hasLabelValue = hasGitSnapshotTextValue(value);

  return hasLabelValue === true ? value : fallback;
}

function getGitSnapshotTrimmedValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmedValue = value.trim();
  const hasTrimmedValue = hasGitSnapshotTextValue(trimmedValue);

  return hasTrimmedValue === true ? trimmedValue : null;
}

function getGitSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

type GitPanelSnapshotStatusList = readonly GitPanelSnapshotStatus[];

const GIT_PANEL_LIST_STALE_STATUSES: GitPanelSnapshotStatusList = [
  'list_stale_with_cache',
  'list_stale_without_cache',
];

const GIT_PANEL_EMPTY_STATUSES: GitPanelSnapshotStatusList = [
  'empty',
  'diff_empty',
];

function isGitPanelSnapshotStatusIn(
  status: GitPanelSnapshotStatus,
  statuses: GitPanelSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function getGitPanelSelectedHashValue(selectedCommit: GitCommit | null): string {
  if (selectedCommit === null) {
    return '';
  }

  return selectedCommit.hash;
}

function getGitPanelSelectedHashLabel(selectedHashValue: string): string {
  const hasSelectedHash = selectedHashValue.length > 0;

  if (hasSelectedHash === true) {
    return normalizeCommitVersion(selectedHashValue);
  }

  return 'none';
}

function getGitPanelSelectedCommitDiffFileCount(selectedCommit: GitCommit | null): number {
  if (selectedCommit === null) {
    return 0;
  }

  const diffFiles = selectedCommit.diff;
  if (Array.isArray(diffFiles) === true) {
    return diffFiles.length;
  }

  return 0;
}

function getGitPanelCommitListStatusValue(
  status: GitCommitListStatus | null,
): GitCommitListStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  return status.status;
}

function getGitPanelCommitDetailStatusValue(
  status: GitCommitDetailStatus | null,
): GitCommitDetailStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  return status.status;
}

function getGitPanelCommitListStatusLabel(
  statusValue: GitCommitListStatusValue | undefined,
): GitCommitListStatusValue | 'unknown' {
  if (statusValue === undefined) {
    return 'unknown';
  }

  return statusValue;
}

function getGitPanelCommitDetailStatusLabel({
  detailIsStale,
  statusValue,
}: {
  detailIsStale: boolean;
  statusValue: GitCommitDetailStatusValue | undefined;
}): GitCommitDetailStatusValue | 'none' {
  if (detailIsStale === true) {
    return 'stale_from_cache';
  }

  if (statusValue === undefined) {
    return 'none';
  }

  return statusValue;
}

function hasGitPanelSelectedCommitDetailStaleStatus({
  hasSelectedCommit,
  selectedCommit,
  gitCommitDetailStatus,
}: {
  hasSelectedCommit: boolean;
  selectedCommit: GitCommit | null;
  gitCommitDetailStatus: GitCommitDetailStatus | null;
}): boolean {
  if (hasSelectedCommit === false) {
    return false;
  }

  if (selectedCommit === null) {
    return false;
  }

  if (gitCommitDetailStatus === null) {
    return false;
  }

  const detailStatusValue = getGitPanelCommitDetailStatusValue(gitCommitDetailStatus);
  if (detailStatusValue !== 'stale_from_cache') {
    return false;
  }

  const detailMatchesSelectedCommit = gitCommitDetailStatus.commitHash === selectedCommit.hash;
  return detailMatchesSelectedCommit === true;
}

function getGitPanelSnapshotStatus({
  commitCount,
  diffFileCount,
  hasSelectedCommit,
  detailIsStale,
  listStatusValue,
}: {
  commitCount: number;
  diffFileCount: number;
  hasSelectedCommit: boolean;
  detailIsStale: boolean;
  listStatusValue: GitCommitListStatusValue | undefined;
}): GitPanelSnapshotStatus {
  if (listStatusValue === 'stale_without_cache') {
    return 'list_stale_without_cache';
  }

  if (listStatusValue === 'stale_with_cache') {
    return 'list_stale_with_cache';
  }

  if (detailIsStale === true) {
    return 'detail_stale';
  }

  const hasCommits = commitCount > 0;
  if (hasCommits === false) {
    return 'empty';
  }

  if (hasSelectedCommit === true) {
    const hasDiffFiles = diffFileCount > 0;
    if (hasDiffFiles === true) {
      return 'selected';
    }

    return 'diff_empty';
  }

  return 'fresh';
}

function getGitPanelSnapshotSource(status: GitPanelSnapshotStatus): GitPanelSnapshotSource {
  const hasListStaleStatus = isGitPanelSnapshotStatusIn(status, GIT_PANEL_LIST_STALE_STATUSES);
  if (hasListStaleStatus === true) {
    return 'list_status';
  }

  if (status === 'detail_stale') {
    return 'detail_status';
  }

  if (status === 'selected') {
    return 'selection';
  }

  if (status === 'diff_empty') {
    return 'diff';
  }

  return 'commit_list';
}

function getGitPanelSnapshotMessage(status: GitPanelSnapshotStatus): string {
  switch (status) {
    case 'list_stale_without_cache':
      return 'Git 提交列表当前没有可确认快照。';
    case 'list_stale_with_cache':
      return 'Git 提交列表当前显示旧快照。';
    case 'detail_stale':
      return '当前版本详情来自缓存快照。';
    case 'empty':
      return '当前没有 Git 提交记录。';
    case 'diff_empty':
      return '已选择提交，但当前没有变更详情。';
    case 'selected':
      return '已选择提交并展示变更详情。';
    case 'fresh':
      return 'Git 提交列表已就绪。';
  }
}

function getGitPanelSnapshotRecovery(status: GitPanelSnapshotStatus): string {
  switch (status) {
    case 'list_stale_without_cache':
      return '刷新 Git 提交列表，确认后端是否已有可用提交历史。';
    case 'list_stale_with_cache':
      return '刷新 Git 面板以确认最新提交列表。';
    case 'detail_stale':
      return '重新查看该提交，或刷新 Git 列表后确认详情是否仍可用。';
    case 'empty':
      return '等待生成、保存或文件事务创建新的 Git 快照。';
    case 'diff_empty':
      return '确认该提交是否没有 diff 详情，必要时刷新提交列表。';
    case 'selected':
    case 'fresh':
      return '可继续查看提交详情或回到聊天恢复链路。';
  }
}

export function buildGitPanelSnapshot({
  gitCommits,
  gitCommitListStatus,
  selectedCommit,
  gitCommitDetailStatus,
}: {
  gitCommits: GitCommit[];
  gitCommitListStatus: GitCommitListStatus | null;
  selectedCommit: GitCommit | null;
  gitCommitDetailStatus: GitCommitDetailStatus | null;
}): GitPanelSnapshot {
  const selectedHashValue = getGitPanelSelectedHashValue(selectedCommit);
  const hasSelectedCommit = selectedCommit !== null;
  const detailIsStale = hasGitPanelSelectedCommitDetailStaleStatus({
    hasSelectedCommit,
    selectedCommit,
    gitCommitDetailStatus,
  });
  const diffFileCount = getGitPanelSelectedCommitDiffFileCount(selectedCommit);
  const selectedHashLabel = getGitPanelSelectedHashLabel(selectedHashValue);
  const commitListStatusValue = getGitPanelCommitListStatusValue(gitCommitListStatus);
  const commitDetailStatusValue = getGitPanelCommitDetailStatusValue(gitCommitDetailStatus);
  const listStatusValue = getGitPanelCommitListStatusLabel(commitListStatusValue);
  const detailStatusValue = getGitPanelCommitDetailStatusLabel({
    detailIsStale,
    statusValue: commitDetailStatusValue,
  });
  const commitCount = gitCommits.length;
  const status = getGitPanelSnapshotStatus({
    commitCount,
    diffFileCount,
    hasSelectedCommit,
    detailIsStale,
    listStatusValue: commitListStatusValue,
  });
  const source = getGitPanelSnapshotSource(status);

  return {
    status,
    source,
    commitCount,
    hasSelectedCommit,
    selectedHash: selectedHashLabel,
    diffFileCount,
    listStatus: listStatusValue,
    detailStatus: detailStatusValue,
    message: getGitPanelSnapshotMessage(status),
    recovery: getGitPanelSnapshotRecovery(status),
    updatedAt: 'derived',
  };
}

function getGitPanelSnapshotClassName(snapshot: GitPanelSnapshot) {
  const hasListStaleStatus = isGitPanelSnapshotStatusIn(snapshot.status, GIT_PANEL_LIST_STALE_STATUSES);
  const hasEmptyStatus = isGitPanelSnapshotStatusIn(snapshot.status, GIT_PANEL_EMPTY_STATUSES);

  if (hasListStaleStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (snapshot.status === 'detail_stale') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (hasEmptyStatus === true) {
    return 'border-muted-foreground/20 bg-muted/20 text-muted-foreground';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

type GitBranchSnapshotStatusList = readonly GitBranchSnapshotStatus[];
type GitBranchListStatusValueList = readonly GitBranchListStatusValue[];

const GIT_BRANCH_LIST_STALE_STATUS_VALUES: GitBranchListStatusValueList = [
  'stale_with_cache',
  'stale_without_cache',
];

const GIT_BRANCH_SNAPSHOT_WARNING_STATUSES: GitBranchSnapshotStatusList = [
  'missing',
];

const GIT_BRANCH_SNAPSHOT_INFO_STATUSES: GitBranchSnapshotStatusList = [
  'inferred_from_commit',
];

function isGitBranchSnapshotStatusIn(
  status: GitBranchSnapshotStatus,
  statuses: GitBranchSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function isGitBranchListStatusValueIn(
  statusValue: GitBranchListStatusValue | undefined,
  statuses: GitBranchListStatusValueList,
): boolean {
  if (statusValue === undefined) {
    return false;
  }

  for (const candidate of statuses) {
    const matchedStatus = candidate === statusValue;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function getGitBranchSnapshotCurrentBranches(gitBranches: GitBranch[]): GitBranch[] {
  const currentBranches: GitBranch[] = [];

  for (const branch of gitBranches) {
    if (branch.is_current === true) {
      currentBranches.push(branch);
    }
  }

  return currentBranches;
}

function getGitBranchSnapshotCurrentBranch(currentBranches: GitBranch[]): string {
  for (const branch of currentBranches) {
    const currentBranchValue = branch.name.trim();
    const hasCurrentBranch = currentBranchValue.length > 0;
    if (hasCurrentBranch === true) {
      return currentBranchValue;
    }
  }

  return '';
}

function getGitBranchSnapshotCommitBranches(selectedCommit: GitCommit | null): readonly string[] {
  if (selectedCommit === null) {
    return [];
  }

  return selectedCommit.branches;
}

function getGitBranchSnapshotInferredBranch(commitBranches: readonly string[]): string {
  for (const branchName of commitBranches) {
    const hasBranchName = branchName.length > 0;
    if (hasBranchName === true) {
      return branchName;
    }
  }

  return '';
}

function getGitBranchSnapshotBranch({
  currentBranch,
  normalizedProjectBranch,
  inferredBranch,
}: {
  currentBranch: string;
  normalizedProjectBranch: string;
  inferredBranch: string;
}): string {
  const hasCurrentBranch = currentBranch.length > 0;
  if (hasCurrentBranch === true) {
    return currentBranch;
  }

  const hasProjectBranch = normalizedProjectBranch.length > 0;
  if (hasProjectBranch === true) {
    return normalizedProjectBranch;
  }

  const hasInferredBranch = inferredBranch.length > 0;
  if (hasInferredBranch === true) {
    return inferredBranch;
  }

  return 'unknown';
}

function getGitBranchListStatusValue(
  status: GitBranchListStatus | null,
): GitBranchListStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  return status.status;
}

function getGitBranchListStatusLabel(
  statusValue: GitBranchListStatusValue | undefined,
): GitBranchListStatusValue | 'unknown' {
  if (statusValue === undefined) {
    return 'unknown';
  }

  return statusValue;
}

function isGitBranchListStale(statusValue: GitBranchListStatusValue | undefined): boolean {
  return isGitBranchListStatusValueIn(statusValue, GIT_BRANCH_LIST_STALE_STATUS_VALUES);
}

function getGitBranchSnapshotStatus({
  branchListIsStale,
  hasBranchList,
  hasCurrentBranch,
  hasProjectBranch,
  selectedCommitHasBranch,
}: {
  branchListIsStale: boolean;
  hasBranchList: boolean;
  hasCurrentBranch: boolean;
  hasProjectBranch: boolean;
  selectedCommitHasBranch: boolean;
}): GitBranchSnapshotStatus {
  if (branchListIsStale === true) {
    if (hasBranchList === true) {
      return 'branch_list_stale';
    }
  }

  if (hasCurrentBranch === true) {
    return 'branch_list_current';
  }

  if (hasProjectBranch === true) {
    return 'confirmed';
  }

  if (selectedCommitHasBranch === true) {
    return 'inferred_from_commit';
  }

  return 'missing';
}

function getGitBranchSnapshotSource({
  status,
  hasCurrentBranch,
  hasProjectBranch,
  selectedCommitHasBranch,
}: {
  status: GitBranchSnapshotStatus;
  hasCurrentBranch: boolean;
  hasProjectBranch: boolean;
  selectedCommitHasBranch: boolean;
}): GitBranchSnapshotSource {
  if (status === 'branch_list_stale') {
    return 'branch_list_status';
  }

  if (hasCurrentBranch === true) {
    return 'branch_list';
  }

  if (hasProjectBranch === true) {
    return 'project_info';
  }

  if (selectedCommitHasBranch === true) {
    return 'commit_branches';
  }

  return 'metadata';
}

function getGitBranchSnapshotMessage(status: GitBranchSnapshotStatus): string {
  switch (status) {
    case 'branch_list_stale':
      return 'Git 分支列表当前显示旧快照。';
    case 'branch_list_current':
      return 'Git 当前分支来自后端 Git 真源。';
    case 'confirmed':
      return 'Git 分支来自项目元数据。';
    case 'inferred_from_commit':
      return 'Git 分支从当前提交分支列表推断。';
    case 'missing':
      return '当前没有可确认的 Git 分支。';
  }
}

function getGitBranchSnapshotRecovery(status: GitBranchSnapshotStatus): string {
  switch (status) {
    case 'branch_list_stale':
      return '刷新 Git 分支列表，确认当前分支和可用分支是否变化。';
    case 'branch_list_current':
      return '可按该分支继续核对提交历史，后续可在此基础上接入切换分支。';
    case 'confirmed':
      return '可按该分支继续核对提交历史。';
    case 'inferred_from_commit':
      return '刷新项目详情，确认后端是否返回项目 git_branch。';
    case 'missing':
      return '刷新项目详情或提交列表，确认后端是否返回 Git 分支信息。';
  }
}

type GitRemoteBranchSnapshotStatusList = readonly GitRemoteBranchSnapshotStatus[];
type GitRemoteBranchListStatusValueList = readonly GitRemoteBranchListStatusValue[];
type GitTagSnapshotStatusList = readonly GitTagSnapshotStatus[];
type GitTagListStatusValueList = readonly GitTagListStatusValue[];
type GitStashSnapshotStatusList = readonly GitStashSnapshotStatus[];
type GitStashListStatusValueList = readonly GitStashListStatusValue[];

const GIT_REMOTE_BRANCH_LIST_STALE_STATUS_VALUES: GitRemoteBranchListStatusValueList = [
  'stale_with_cache',
  'stale_without_cache',
];

const GIT_REMOTE_BRANCH_SNAPSHOT_STALE_STATUSES: GitRemoteBranchSnapshotStatusList = [
  'stale_with_cache',
  'stale_without_cache',
];

const GIT_REMOTE_BRANCH_SNAPSHOT_EMPTY_STATUSES: GitRemoteBranchSnapshotStatusList = [
  'empty',
];

const GIT_TAG_LIST_STALE_STATUS_VALUES: GitTagListStatusValueList = [
  'stale_with_cache',
  'stale_without_cache',
];

const GIT_TAG_SNAPSHOT_STALE_STATUSES: GitTagSnapshotStatusList = [
  'stale_with_cache',
  'stale_without_cache',
];

const GIT_TAG_SNAPSHOT_EMPTY_STATUSES: GitTagSnapshotStatusList = [
  'empty',
];

const GIT_STASH_LIST_STALE_STATUS_VALUES: GitStashListStatusValueList = [
  'stale_with_cache',
  'stale_without_cache',
];

const GIT_STASH_SNAPSHOT_STALE_STATUSES: GitStashSnapshotStatusList = [
  'stale_with_cache',
  'stale_without_cache',
];

const GIT_STASH_SNAPSHOT_EMPTY_STATUSES: GitStashSnapshotStatusList = [
  'empty',
];

function isGitRemoteBranchSnapshotStatusIn(
  status: GitRemoteBranchSnapshotStatus,
  statuses: GitRemoteBranchSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function isGitRemoteBranchListStatusValueIn(
  statusValue: GitRemoteBranchListStatusValue | undefined,
  statuses: GitRemoteBranchListStatusValueList,
): boolean {
  if (statusValue === undefined) {
    return false;
  }

  for (const candidate of statuses) {
    const matchedStatus = candidate === statusValue;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function isGitTagSnapshotStatusIn(
  status: GitTagSnapshotStatus,
  statuses: GitTagSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function isGitTagListStatusValueIn(
  statusValue: GitTagListStatusValue | undefined,
  statuses: GitTagListStatusValueList,
): boolean {
  if (statusValue === undefined) {
    return false;
  }

  for (const candidate of statuses) {
    const matchedStatus = candidate === statusValue;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function isGitStashSnapshotStatusIn(
  status: GitStashSnapshotStatus,
  statuses: GitStashSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function isGitStashListStatusValueIn(
  statusValue: GitStashListStatusValue | undefined,
  statuses: GitStashListStatusValueList,
): boolean {
  if (statusValue === undefined) {
    return false;
  }

  for (const candidate of statuses) {
    const matchedStatus = candidate === statusValue;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function getGitRemoteBranchListStatusValue(
  status: GitRemoteBranchListStatus | null,
): GitRemoteBranchListStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  return status.status;
}

function getGitRemoteBranchListStatusLabel(
  statusValue: GitRemoteBranchListStatusValue | undefined,
): GitRemoteBranchListStatusValue | 'unknown' {
  if (statusValue === undefined) {
    return 'unknown';
  }

  return statusValue;
}

function isGitRemoteBranchListStale(statusValue: GitRemoteBranchListStatusValue | undefined): boolean {
  return isGitRemoteBranchListStatusValueIn(statusValue, GIT_REMOTE_BRANCH_LIST_STALE_STATUS_VALUES);
}

function getGitRemoteBranchSnapshotFirstBranch(gitRemoteBranches: GitRemoteBranch[]): GitRemoteBranch | undefined {
  for (const branch of gitRemoteBranches) {
    return branch;
  }

  return undefined;
}

function getGitRemoteBranchSnapshotLatestBranch(gitRemoteBranches: GitRemoteBranch[]): GitRemoteBranch | undefined {
  return getGitRemoteBranchSnapshotFirstBranch(gitRemoteBranches);
}

function getGitRemoteBranchSnapshotRemoteCount(gitRemoteBranches: GitRemoteBranch[]): number {
  const remoteNames = new Set<string>();

  for (const branch of gitRemoteBranches) {
    const hasRemoteName = branch.remote.length > 0;
    if (hasRemoteName === true) {
      remoteNames.add(branch.remote);
    }
  }

  return remoteNames.size;
}

function getGitRemoteBranchSnapshotLatestRemoteBranchLabel(latestRemoteBranch: GitRemoteBranch | undefined): string {
  if (latestRemoteBranch === undefined) {
    return 'none';
  }

  return getGitSnapshotLabel(latestRemoteBranch.name, 'none');
}

function getGitRemoteBranchSnapshotLatestRemoteLabel(latestRemoteBranch: GitRemoteBranch | undefined): string {
  if (latestRemoteBranch === undefined) {
    return 'unknown';
  }

  return getGitSnapshotLabel(latestRemoteBranch.remote, 'unknown');
}

function getGitRemoteBranchSnapshotLatestBranchLabel(latestRemoteBranch: GitRemoteBranch | undefined): string {
  if (latestRemoteBranch === undefined) {
    return 'unknown';
  }

  return getGitSnapshotLabel(latestRemoteBranch.branch, 'unknown');
}

function getGitRemoteBranchSnapshotLatestCommitLabel(latestRemoteBranch: GitRemoteBranch | undefined): string {
  if (latestRemoteBranch === undefined) {
    return 'unknown';
  }

  return getGitSnapshotLabel(latestRemoteBranch.last_commit, 'unknown');
}

function getGitRemoteBranchSnapshotStatus({
  listIsStale,
  statusValue,
  remoteBranchCount,
}: {
  listIsStale: boolean;
  statusValue: GitRemoteBranchListStatusValue | undefined;
  remoteBranchCount: number;
}): GitRemoteBranchSnapshotStatus {
  if (listIsStale === true) {
    if (statusValue === 'stale_with_cache') {
      return 'stale_with_cache';
    }

    return 'stale_without_cache';
  }

  const hasRemoteBranches = remoteBranchCount > 0;
  if (hasRemoteBranches === true) {
    return 'ready';
  }

  return 'empty';
}

function getGitRemoteBranchSnapshotSource(status: GitRemoteBranchSnapshotStatus): GitRemoteBranchSnapshotSource {
  const hasStaleStatus = isGitRemoteBranchSnapshotStatusIn(status, GIT_REMOTE_BRANCH_SNAPSHOT_STALE_STATUSES);
  if (hasStaleStatus === true) {
    return 'remote_branch_list_status';
  }

  return 'remote_branch_list';
}

function getGitRemoteBranchSnapshotMessage(status: GitRemoteBranchSnapshotStatus): string {
  switch (status) {
    case 'stale_with_cache':
      return 'Git 远端分支列表当前显示旧快照。';
    case 'stale_without_cache':
      return 'Git 远端分支列表当前没有可确认快照。';
    case 'empty':
      return '当前仓库没有可见 Git 远端分支。';
    case 'ready':
      return 'Git 远端分支列表已从后端真源读取。';
  }
}

function getGitRemoteBranchSnapshotRecovery(status: GitRemoteBranchSnapshotStatus): string {
  switch (status) {
    case 'stale_with_cache':
      return '刷新 Git 远端分支列表，确认远端引用是否变化。';
    case 'stale_without_cache':
      return '刷新 Git 面板，确认仓库是否已有可读取远端分支引用。';
    case 'empty':
      return '如需同步远端引用，请使用显式受控刷新入口；当前面板不会隐式 fetch。';
    case 'ready':
      return '可按 remote/branch 核对远端引用；除显式受控刷新外，当前面板不会 pull、push、prune 或删除远端分支。';
  }
}

function getGitTagListStatusValue(status: GitTagListStatus | null): GitTagListStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  return status.status;
}

function getGitTagListStatusLabel(statusValue: GitTagListStatusValue | undefined): GitTagListStatusValue | 'unknown' {
  if (statusValue === undefined) {
    return 'unknown';
  }

  return statusValue;
}

function isGitTagListStale(statusValue: GitTagListStatusValue | undefined): boolean {
  return isGitTagListStatusValueIn(statusValue, GIT_TAG_LIST_STALE_STATUS_VALUES);
}

function getGitTagSnapshotFirstTag(gitTags: GitTag[]): GitTag | undefined {
  for (const tag of gitTags) {
    return tag;
  }

  return undefined;
}

function getGitTagSnapshotLatestTag(gitTags: GitTag[]): GitTag | undefined {
  return getGitTagSnapshotFirstTag(gitTags);
}

function getGitTagSnapshotLatestTagLabel(latestTag: GitTag | undefined): string {
  if (latestTag === undefined) {
    return 'none';
  }

  return getGitSnapshotLabel(latestTag.name, 'none');
}

function getGitTagSnapshotLatestTargetCommitLabel(latestTag: GitTag | undefined): string {
  if (latestTag === undefined) {
    return 'unknown';
  }

  return getGitSnapshotLabel(latestTag.target_commit, 'unknown');
}

function getGitTagSnapshotStatus({
  listIsStale,
  statusValue,
  tagCount,
}: {
  listIsStale: boolean;
  statusValue: GitTagListStatusValue | undefined;
  tagCount: number;
}): GitTagSnapshotStatus {
  if (listIsStale === true) {
    if (statusValue === 'stale_with_cache') {
      return 'stale_with_cache';
    }

    return 'stale_without_cache';
  }

  const hasTags = tagCount > 0;
  if (hasTags === true) {
    return 'ready';
  }

  return 'empty';
}

function getGitTagSnapshotSource(status: GitTagSnapshotStatus): GitTagSnapshotSource {
  const hasStaleStatus = isGitTagSnapshotStatusIn(status, GIT_TAG_SNAPSHOT_STALE_STATUSES);
  if (hasStaleStatus === true) {
    return 'tag_list_status';
  }

  return 'tag_list';
}

function getGitTagSnapshotMessage(status: GitTagSnapshotStatus): string {
  switch (status) {
    case 'stale_with_cache':
      return 'Git 标签列表当前显示旧快照。';
    case 'stale_without_cache':
      return 'Git 标签列表当前没有可确认快照。';
    case 'empty':
      return '当前仓库没有可见 Git 标签。';
    case 'ready':
      return 'Git 标签列表已从后端真源读取。';
  }
}

function getGitTagSnapshotRecovery(status: GitTagSnapshotStatus): string {
  switch (status) {
    case 'stale_with_cache':
      return '刷新 Git 标签列表，确认版本标签是否变化。';
    case 'stale_without_cache':
      return '刷新 Git 面板，确认仓库是否已有可读取标签。';
    case 'empty':
      return '如需标签管理，后续应通过受控任务显式接入；当前面板只做只读观测。';
    case 'ready':
      return '可按标签核对版本锚点；当前面板不会创建、删除或推送标签。';
  }
}

function getGitStashListStatusValue(status: GitStashListStatus | null): GitStashListStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  return status.status;
}

function getGitStashListStatusLabel(
  statusValue: GitStashListStatusValue | undefined,
): GitStashListStatusValue | 'unknown' {
  if (statusValue === undefined) {
    return 'unknown';
  }

  return statusValue;
}

function isGitStashListStale(statusValue: GitStashListStatusValue | undefined): boolean {
  return isGitStashListStatusValueIn(statusValue, GIT_STASH_LIST_STALE_STATUS_VALUES);
}

function getGitStashSnapshotFirstStash(gitStashes: GitStash[]): GitStash | undefined {
  for (const stash of gitStashes) {
    return stash;
  }

  return undefined;
}

function getGitStashSnapshotLatestStash(gitStashes: GitStash[]): GitStash | undefined {
  return getGitStashSnapshotFirstStash(gitStashes);
}

function getGitStashSnapshotLatestRefLabel(latestStash: GitStash | undefined): string {
  if (latestStash === undefined) {
    return 'none';
  }

  return getGitSnapshotLabel(latestStash.ref, 'none');
}

function getGitStashSnapshotLatestBranchLabel(latestStash: GitStash | undefined): string {
  if (latestStash === undefined) {
    return 'unknown';
  }

  return getGitSnapshotLabel(latestStash.branch, 'unknown');
}

function getGitStashSnapshotLatestTargetCommitLabel(latestStash: GitStash | undefined): string {
  if (latestStash === undefined) {
    return 'unknown';
  }

  return getGitSnapshotLabel(latestStash.target_commit, 'unknown');
}

function getGitStashSnapshotStatus({
  listIsStale,
  statusValue,
  stashCount,
}: {
  listIsStale: boolean;
  statusValue: GitStashListStatusValue | undefined;
  stashCount: number;
}): GitStashSnapshotStatus {
  if (listIsStale === true) {
    if (statusValue === 'stale_with_cache') {
      return 'stale_with_cache';
    }

    return 'stale_without_cache';
  }

  const hasStashes = stashCount > 0;
  if (hasStashes === true) {
    return 'ready';
  }

  return 'empty';
}

function getGitStashSnapshotSource(status: GitStashSnapshotStatus): GitStashSnapshotSource {
  const hasStaleStatus = isGitStashSnapshotStatusIn(status, GIT_STASH_SNAPSHOT_STALE_STATUSES);
  if (hasStaleStatus === true) {
    return 'stash_list_status';
  }

  return 'stash_list';
}

function getGitStashSnapshotMessage(status: GitStashSnapshotStatus): string {
  switch (status) {
    case 'stale_with_cache':
      return 'Git stash 列表当前显示旧快照。';
    case 'stale_without_cache':
      return 'Git stash 列表当前没有可确认快照。';
    case 'empty':
      return '当前仓库没有可见 Git stash。';
    case 'ready':
      return 'Git stash 列表已从后端真源读取。';
  }
}

function getGitStashSnapshotRecovery(status: GitStashSnapshotStatus): string {
  switch (status) {
    case 'stale_with_cache':
      return '刷新 Git stash 列表，确认临时保存项是否变化。';
    case 'stale_without_cache':
      return '刷新 Git 面板，确认仓库是否已有可读取 stash。';
    case 'empty':
      return '如需 stash 管理，后续应通过受控任务显式接入；当前面板只做只读观测。';
    case 'ready':
      return '可按 stash ref 核对临时保存项；当前面板不会 apply、pop、drop 或 clear stash。';
  }
}

export function GitPanelSnapshotStrip({ snapshot }: { snapshot: GitPanelSnapshot }) {
  const hasSelectedCommitLabel = getGitSnapshotBooleanLabel(snapshot.hasSelectedCommit);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-panel-snapshot"
      className={cn('mx-3 mt-3 rounded-md border px-2.5 py-2 text-xs', getGitPanelSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Git 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Commits: {snapshot.commitCount}</span>
        <span>Selected: {hasSelectedCommitLabel}</span>
        <span>Hash: {snapshot.selectedHash}</span>
        <span>Diffs: {snapshot.diffFileCount}</span>
        <span>List: {snapshot.listStatus}</span>
        <span>Detail: {snapshot.detailStatus}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

export function buildGitBranchSnapshot({
  gitBranch,
  gitBranches,
  gitBranchListStatus,
  selectedCommit,
}: {
  gitBranch: string;
  gitBranches: GitBranch[];
  gitBranchListStatus: GitBranchListStatus | null;
  selectedCommit: GitCommit | null;
}): GitBranchSnapshot {
  const normalizedProjectBranch = gitBranch.trim();
  const currentBranches = getGitBranchSnapshotCurrentBranches(gitBranches);
  const currentBranch = getGitBranchSnapshotCurrentBranch(currentBranches);
  const commitBranches = getGitBranchSnapshotCommitBranches(selectedCommit);
  const inferredBranch = getGitBranchSnapshotInferredBranch(commitBranches);
  const hasProjectBranch = normalizedProjectBranch.length > 0;
  const hasCurrentBranch = currentBranch.length > 0;
  const selectedCommitHasBranch = inferredBranch.length > 0;
  const branch = getGitBranchSnapshotBranch({
    currentBranch,
    normalizedProjectBranch,
    inferredBranch,
  });
  const branchListStatusValue = getGitBranchListStatusValue(gitBranchListStatus);
  const listStatusValue = getGitBranchListStatusLabel(branchListStatusValue);
  const branchListIsStale = isGitBranchListStale(branchListStatusValue);
  const hasBranchList = gitBranches.length > 0;
  const status = getGitBranchSnapshotStatus({
    branchListIsStale,
    hasBranchList,
    hasCurrentBranch,
    hasProjectBranch,
    selectedCommitHasBranch,
  });
  const source = getGitBranchSnapshotSource({
    status,
    hasCurrentBranch,
    hasProjectBranch,
    selectedCommitHasBranch,
  });

  return {
    status,
    source,
    branch,
    branchCount: gitBranches.length,
    currentBranchCount: currentBranches.length,
    hasProjectBranch,
    hasBranchList,
    commitBranchCount: commitBranches.length,
    selectedCommitHasBranch,
    isDefaultBranch: branch === 'main',
    listStatus: listStatusValue,
    message: getGitBranchSnapshotMessage(status),
    recovery: getGitBranchSnapshotRecovery(status),
    updatedAt: 'derived',
  };
}

function getGitBranchSnapshotClassName(snapshot: GitBranchSnapshot) {
  const hasWarningStatus = isGitBranchSnapshotStatusIn(snapshot.status, GIT_BRANCH_SNAPSHOT_WARNING_STATUSES);
  const hasInfoStatus = isGitBranchSnapshotStatusIn(snapshot.status, GIT_BRANCH_SNAPSHOT_INFO_STATUSES);

  if (hasWarningStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (hasInfoStatus === true) {
    return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

export function GitBranchSnapshotStrip({ snapshot }: { snapshot: GitBranchSnapshot }) {
  const hasProjectBranchLabel = getGitSnapshotBooleanLabel(snapshot.hasProjectBranch);
  const hasBranchListLabel = getGitSnapshotBooleanLabel(snapshot.hasBranchList);
  const selectedCommitHasBranchLabel = getGitSnapshotBooleanLabel(snapshot.selectedCommitHasBranch);
  const isDefaultBranchLabel = getGitSnapshotBooleanLabel(snapshot.isDefaultBranch);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-branch-snapshot"
      className={cn('mx-3 mt-3 rounded-md border px-2.5 py-2 text-xs', getGitBranchSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Git Branch 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Branch: {snapshot.branch}</span>
        <span>Branches: {snapshot.branchCount}</span>
        <span>CurrentBranches: {snapshot.currentBranchCount}</span>
        <span>ProjectBranch: {hasProjectBranchLabel}</span>
        <span>BranchList: {hasBranchListLabel}</span>
        <span>CommitBranches: {snapshot.commitBranchCount}</span>
        <span>SelectedCommitBranch: {selectedCommitHasBranchLabel}</span>
        <span>Default: {isDefaultBranchLabel}</span>
        <span>List: {snapshot.listStatus}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

function getGitBranchCompareFileApplyConfirmationSnapshotAction(
  confirmation: GitBranchCompareFileApplyConfirmation | null,
): GitBranchCompareFileApplyConfirmationSnapshotAction {
  if (confirmation === null) {
    return 'none';
  }

  if (confirmation.action === 'apply') {
    return 'apply';
  }

  return 'none';
}

function getGitBranchCompareFileApplyConfirmationSnapshotStatus({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): GitBranchCompareFileApplyConfirmationSnapshotStatus {
  if (hasConfirmation === false) {
    return 'closed';
  }

  if (isConfirming === true) {
    return 'confirming';
  }

  return 'awaiting_confirmation';
}

function getGitBranchCompareFileApplyConfirmationSnapshotSource(
  action: GitBranchCompareFileApplyConfirmationSnapshotAction,
): GitBranchCompareFileApplyConfirmationSnapshotSource {
  if (action === 'apply') {
    return 'branch_compare_file_apply';
  }

  return 'dialog_state';
}

function canConfirmGitBranchCompareFileApplyConfirmationSnapshot({
  hasConfirmation,
  hasBaseBranch,
  hasHeadBranch,
  hasPath,
  isSameBranch,
  isConfirming,
}: {
  hasConfirmation: boolean;
  hasBaseBranch: boolean;
  hasHeadBranch: boolean;
  hasPath: boolean;
  isSameBranch: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (hasBaseBranch === false) {
    return false;
  }

  if (hasHeadBranch === false) {
    return false;
  }

  if (hasPath === false) {
    return false;
  }

  if (isSameBranch === true) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function canCancelGitBranchCompareFileApplyConfirmationSnapshot({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function getGitBranchCompareFileApplyConfirmationSnapshotRiskLevel(): GitBranchCompareFileApplyConfirmationRiskLevel {
  return 'high';
}

function getGitBranchCompareFileApplyConfirmationSnapshotMessage(
  status: GitBranchCompareFileApplyConfirmationSnapshotStatus,
): string {
  if (status === 'closed') {
    return 'Git 分支对比单文件引入确认弹窗未打开。';
  }

  if (status === 'confirming') {
    return 'Git 分支对比单文件引入正在提交，确认与取消入口暂时锁定。';
  }

  return 'Git 分支对比单文件引入确认已打开，等待用户确认 guarded checkout。';
}

function getGitBranchCompareFileApplyConfirmationSnapshotRecovery(hasConfirmation: boolean): string {
  if (hasConfirmation === true) {
    return '取消不会引入文件；确认后后端仍会阻断缺失分支、base/head 相同、当前分支偏离 base、目标文件缺失和目标路径 dirty，不会 merge、reset、切换分支或修改非目标文件。';
  }

  return '选择分支对比文件并触发引入后会显示确认边界。';
}

export function buildGitBranchCompareFileApplyConfirmationSnapshot({
  confirmation,
  isConfirming,
}: {
  confirmation: GitBranchCompareFileApplyConfirmation | null;
  isConfirming: boolean;
}): GitBranchCompareFileApplyConfirmationSnapshot {
  const hasConfirmation = confirmation !== null;
  const action = getGitBranchCompareFileApplyConfirmationSnapshotAction(confirmation);
  const baseBranch = getGitSnapshotTrimmedValue(confirmation?.baseBranch);
  const headBranch = getGitSnapshotTrimmedValue(confirmation?.headBranch);
  const filePath = getGitSnapshotTrimmedValue(confirmation?.filePath);
  const hasBaseBranch = hasGitSnapshotTextValue(baseBranch);
  const hasHeadBranch = hasGitSnapshotTextValue(headBranch);
  const hasPath = hasGitSnapshotTextValue(filePath);
  const isSameBranch = hasBaseBranch === true && hasHeadBranch === true && baseBranch === headBranch;
  const status = getGitBranchCompareFileApplyConfirmationSnapshotStatus({
    hasConfirmation,
    isConfirming,
  });
  const source = getGitBranchCompareFileApplyConfirmationSnapshotSource(action);
  const canConfirm = canConfirmGitBranchCompareFileApplyConfirmationSnapshot({
    hasConfirmation,
    hasBaseBranch,
    hasHeadBranch,
    hasPath,
    isSameBranch,
    isConfirming,
  });
  const canCancel = canCancelGitBranchCompareFileApplyConfirmationSnapshot({
    hasConfirmation,
    isConfirming,
  });
  const riskLevel = getGitBranchCompareFileApplyConfirmationSnapshotRiskLevel();
  const message = getGitBranchCompareFileApplyConfirmationSnapshotMessage(status);
  const recovery = getGitBranchCompareFileApplyConfirmationSnapshotRecovery(hasConfirmation);

  return {
    status,
    source,
    action,
    baseBranch,
    headBranch,
    filePath,
    hasBaseBranch,
    hasHeadBranch,
    hasPath,
    isSameBranch,
    canConfirm,
    canCancel,
    riskLevel,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getGitBranchCompareFileApplyConfirmationSnapshotClassName(snapshot: GitBranchCompareFileApplyConfirmationSnapshot) {
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-border bg-background/70 text-muted-foreground';
}

export function GitBranchCompareFileApplyConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: GitBranchCompareFileApplyConfirmationSnapshot;
}) {
  const baseBranchLabel = getGitSnapshotLabel(snapshot.baseBranch, 'none');
  const headBranchLabel = getGitSnapshotLabel(snapshot.headBranch, 'none');
  const filePathLabel = getGitSnapshotLabel(snapshot.filePath, 'none');
  const isSameBranchLabel = getGitSnapshotBooleanLabel(snapshot.isSameBranch);
  const canConfirmLabel = getGitSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getGitSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-branch-compare-file-apply-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getGitBranchCompareFileApplyConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Git 分支对比文件引入确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Base: {baseBranchLabel}</span>
        <span>Head: {headBranchLabel}</span>
        <span>Path: {filePathLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>SameBranch: {isSameBranchLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

function getGitBranchMutationConfirmationSnapshotAction(
  confirmation: GitBranchMutationConfirmation | null,
): GitBranchMutationConfirmationSnapshotAction {
  if (confirmation === null) {
    return 'none';
  }

  if (confirmation.action === 'create') {
    return 'create';
  }

  if (confirmation.action === 'delete') {
    return 'delete';
  }

  if (confirmation.action === 'rename') {
    return 'rename';
  }

  return 'none';
}

function getGitBranchMutationConfirmationSnapshotStatus({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): GitBranchMutationConfirmationSnapshotStatus {
  if (hasConfirmation === false) {
    return 'closed';
  }

  if (isConfirming === true) {
    return 'confirming';
  }

  return 'awaiting_confirmation';
}

function getGitBranchMutationConfirmationSnapshotSource(
  action: GitBranchMutationConfirmationSnapshotAction,
): GitBranchMutationConfirmationSnapshotSource {
  if (action === 'create') {
    return 'branch_create';
  }

  if (action === 'delete') {
    return 'branch_delete';
  }

  if (action === 'rename') {
    return 'branch_rename';
  }

  return 'dialog_state';
}

function hasGitBranchMutationConfirmationNextBranch(
  action: GitBranchMutationConfirmationSnapshotAction,
  nextBranchName: string | null,
): boolean {
  if (action !== 'rename') {
    return true;
  }

  return hasGitSnapshotTextValue(nextBranchName);
}

function canConfirmGitBranchMutationConfirmationSnapshot({
  hasConfirmation,
  hasBranch,
  hasNextBranch,
  isCurrentBranch,
  isConfirming,
}: {
  hasConfirmation: boolean;
  hasBranch: boolean;
  hasNextBranch: boolean;
  isCurrentBranch: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (hasBranch === false) {
    return false;
  }

  if (hasNextBranch === false) {
    return false;
  }

  if (isCurrentBranch === true) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function canCancelGitBranchMutationConfirmationSnapshot({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function getGitBranchMutationConfirmationSnapshotRiskLevel(
  action: GitBranchMutationConfirmationSnapshotAction,
): GitBranchMutationConfirmationRiskLevel {
  if (action === 'delete') {
    return 'high';
  }

  return 'medium';
}

function getGitBranchMutationConfirmationSnapshotMessage({
  action,
  status,
}: {
  action: GitBranchMutationConfirmationSnapshotAction;
  status: GitBranchMutationConfirmationSnapshotStatus;
}): string {
  if (status === 'closed') {
    return 'Git 分支受控操作确认弹窗未打开。';
  }

  if (status === 'confirming') {
    return 'Git 分支受控操作正在提交，确认与取消入口暂时锁定。';
  }

  if (action === 'create') {
    return '本地分支创建确认已打开，等待用户确认 guarded git branch。';
  }

  if (action === 'delete') {
    return '本地分支删除确认已打开，等待用户确认 guarded git branch -d。';
  }

  if (action === 'rename') {
    return '本地分支重命名确认已打开，等待用户确认 guarded git branch -m。';
  }

  return 'Git 分支受控操作确认边界已打开，等待用户确认。';
}

function getGitBranchMutationConfirmationSnapshotRecovery(
  action: GitBranchMutationConfirmationSnapshotAction,
): string {
  if (action === 'delete') {
    return '取消不会删除本地分支；确认后后端仍会阻断当前分支、缺失分支和 git branch -d 拒绝删除的场景。';
  }

  if (action === 'rename') {
    return '取消不会重命名本地分支；确认后后端仍会阻断当前分支、缺失分支、同名目标和已存在目标。';
  }

  if (action === 'create') {
    return '取消不会创建本地分支；确认后后端仍会阻断非法分支名、重复分支或缺失 HEAD，不会 checkout、switch、merge、reset 或修改工作区文件。';
  }

  return '选择目标分支并触发创建、删除或重命名后会显示确认边界。';
}

function hasGitBranchMutationConfirmationSnapshotWarningTone(
  snapshot: GitBranchMutationConfirmationSnapshot,
): boolean {
  if (snapshot.status === 'awaiting_confirmation') {
    return true;
  }

  if (snapshot.riskLevel === 'high') {
    return true;
  }

  return false;
}

export function buildGitBranchMutationConfirmationSnapshot({
  confirmation,
  currentBranch,
  isConfirming,
}: {
  confirmation: GitBranchMutationConfirmation | null;
  currentBranch: string;
  isConfirming: boolean;
}): GitBranchMutationConfirmationSnapshot {
  const hasConfirmation = confirmation !== null;
  const action = getGitBranchMutationConfirmationSnapshotAction(confirmation);
  const branchName = getGitSnapshotTrimmedValue(confirmation?.branchName);
  const nextBranchName = getGitSnapshotTrimmedValue(confirmation?.nextBranchName);
  const currentBranchValue = currentBranch.trim();
  const normalizedCurrentBranch = getGitSnapshotLabel(currentBranchValue, 'unknown');
  const hasBranch = hasGitSnapshotTextValue(branchName);
  const hasNextBranch = hasGitBranchMutationConfirmationNextBranch(action, nextBranchName);
  const isCurrentBranch = hasBranch === true && branchName === normalizedCurrentBranch;
  const status = getGitBranchMutationConfirmationSnapshotStatus({
    hasConfirmation,
    isConfirming,
  });
  const source = getGitBranchMutationConfirmationSnapshotSource(action);
  const canConfirm = canConfirmGitBranchMutationConfirmationSnapshot({
    hasConfirmation,
    hasBranch,
    hasNextBranch,
    isCurrentBranch,
    isConfirming,
  });
  const canCancel = canCancelGitBranchMutationConfirmationSnapshot({
    hasConfirmation,
    isConfirming,
  });
  const riskLevel = getGitBranchMutationConfirmationSnapshotRiskLevel(action);
  const message = getGitBranchMutationConfirmationSnapshotMessage({
    action,
    status,
  });
  const recovery = getGitBranchMutationConfirmationSnapshotRecovery(action);

  return {
    status,
    source,
    action,
    branchName,
    nextBranchName,
    currentBranch: normalizedCurrentBranch,
    hasBranch,
    hasNextBranch,
    isCurrentBranch,
    canConfirm,
    canCancel,
    riskLevel,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getGitBranchMutationConfirmationSnapshotClassName(snapshot: GitBranchMutationConfirmationSnapshot) {
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }

  const hasWarningTone = hasGitBranchMutationConfirmationSnapshotWarningTone(snapshot);
  if (hasWarningTone === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-border bg-background/70 text-muted-foreground';
}

export function GitBranchMutationConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: GitBranchMutationConfirmationSnapshot;
}) {
  const branchNameLabel = getGitSnapshotLabel(snapshot.branchName, 'none');
  const nextBranchNameLabel = getGitSnapshotLabel(snapshot.nextBranchName, 'none');
  const isCurrentBranchLabel = getGitSnapshotBooleanLabel(snapshot.isCurrentBranch);
  const canConfirmLabel = getGitSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getGitSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-branch-mutation-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getGitBranchMutationConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Git 分支受控操作确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Branch: {branchNameLabel}</span>
        <span>Next: {nextBranchNameLabel}</span>
        <span>Current: {snapshot.currentBranch}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>CurrentBranch: {isCurrentBranchLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

function getGitBranchSwitchConfirmationSnapshotAction(
  confirmation: GitBranchSwitchConfirmation | null,
): GitBranchSwitchConfirmationSnapshotAction {
  if (confirmation === null) {
    return 'none';
  }

  if (confirmation.action === 'switch') {
    return 'switch';
  }

  return 'none';
}

function getGitBranchSwitchConfirmationSnapshotStatus({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): GitBranchSwitchConfirmationSnapshotStatus {
  if (hasConfirmation === false) {
    return 'closed';
  }

  if (isConfirming === true) {
    return 'confirming';
  }

  return 'awaiting_confirmation';
}

function getGitBranchSwitchConfirmationSnapshotSource(
  action: GitBranchSwitchConfirmationSnapshotAction,
): GitBranchSwitchConfirmationSnapshotSource {
  if (action === 'switch') {
    return 'branch_switch';
  }

  return 'dialog_state';
}

function getGitBranchSwitchConfirmationDirtyFileCount(confirmation: GitBranchSwitchConfirmation | null): number {
  if (confirmation === null) {
    return 0;
  }

  if (confirmation.dirtyFiles === undefined) {
    return 0;
  }

  return confirmation.dirtyFiles;
}

function hasGitBranchSwitchConfirmationReadiness(confirmation: GitBranchSwitchConfirmation | null): boolean {
  if (confirmation === null) {
    return false;
  }

  return confirmation.canSwitch === true;
}

function canConfirmGitBranchSwitchConfirmationSnapshot({
  hasConfirmation,
  hasTargetBranch,
  readinessAllowsSwitch,
  isSameBranch,
  isConfirming,
}: {
  hasConfirmation: boolean;
  hasTargetBranch: boolean;
  readinessAllowsSwitch: boolean;
  isSameBranch: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (hasTargetBranch === false) {
    return false;
  }

  if (readinessAllowsSwitch === false) {
    return false;
  }

  if (isSameBranch === true) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function canCancelGitBranchSwitchConfirmationSnapshot({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function getGitBranchSwitchConfirmationSnapshotRiskLevel(): GitBranchSwitchConfirmationRiskLevel {
  return 'high';
}

function getGitBranchSwitchConfirmationSnapshotMessage(status: GitBranchSwitchConfirmationSnapshotStatus): string {
  if (status === 'closed') {
    return 'Git 分支切换确认弹窗未打开。';
  }

  if (status === 'confirming') {
    return 'Git 分支切换正在提交，确认与取消入口暂时锁定。';
  }

  return 'Git 分支切换确认已打开，等待用户确认 guarded switch。';
}

function getGitBranchSwitchConfirmationSnapshotRecovery(hasConfirmation: boolean): string {
  if (hasConfirmation === true) {
    return '取消不会切换分支；确认后后端仍会重新执行分支名、当前分支和 dirty worktree guard，不会 merge、reset、stash 或修改远端。';
  }

  return '分支切换 readiness 允许切换后会显示确认边界。';
}

export function buildGitBranchSwitchConfirmationSnapshot({
  confirmation,
  isConfirming,
}: {
  confirmation: GitBranchSwitchConfirmation | null;
  isConfirming: boolean;
}): GitBranchSwitchConfirmationSnapshot {
  const hasConfirmation = confirmation !== null;
  const action = getGitBranchSwitchConfirmationSnapshotAction(confirmation);
  const currentBranch = getGitSnapshotTrimmedValue(confirmation?.currentBranch);
  const targetBranch = getGitSnapshotTrimmedValue(confirmation?.targetBranch);
  const readinessStatusValue = getGitSnapshotTrimmedValue(confirmation?.readinessStatus);
  const readinessStatus = getGitSnapshotLabel(readinessStatusValue, 'unknown');
  const dirtyFileCount = getGitBranchSwitchConfirmationDirtyFileCount(confirmation);
  const dirtyFiles = Math.max(0, dirtyFileCount);
  const hasCurrentBranch = hasGitSnapshotTextValue(currentBranch);
  const hasTargetBranch = hasGitSnapshotTextValue(targetBranch);
  const isSameBranch = hasCurrentBranch === true && hasTargetBranch === true && currentBranch === targetBranch;
  const readinessAllowsSwitch = hasGitBranchSwitchConfirmationReadiness(confirmation);
  const status = getGitBranchSwitchConfirmationSnapshotStatus({
    hasConfirmation,
    isConfirming,
  });
  const source = getGitBranchSwitchConfirmationSnapshotSource(action);
  const canConfirm = canConfirmGitBranchSwitchConfirmationSnapshot({
    hasConfirmation,
    hasTargetBranch,
    readinessAllowsSwitch,
    isSameBranch,
    isConfirming,
  });
  const canCancel = canCancelGitBranchSwitchConfirmationSnapshot({
    hasConfirmation,
    isConfirming,
  });
  const riskLevel = getGitBranchSwitchConfirmationSnapshotRiskLevel();
  const message = getGitBranchSwitchConfirmationSnapshotMessage(status);
  const recovery = getGitBranchSwitchConfirmationSnapshotRecovery(hasConfirmation);

  return {
    status,
    source,
    action,
    currentBranch,
    targetBranch,
    readinessStatus,
    dirtyFiles,
    hasCurrentBranch,
    hasTargetBranch,
    isSameBranch,
    readinessAllowsSwitch,
    canConfirm,
    canCancel,
    riskLevel,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getGitBranchSwitchConfirmationSnapshotClassName(snapshot: GitBranchSwitchConfirmationSnapshot) {
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-border bg-background/70 text-muted-foreground';
}

export function GitBranchSwitchConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: GitBranchSwitchConfirmationSnapshot;
}) {
  const currentBranchLabel = getGitSnapshotLabel(snapshot.currentBranch, 'none');
  const targetBranchLabel = getGitSnapshotLabel(snapshot.targetBranch, 'none');
  const isSameBranchLabel = getGitSnapshotBooleanLabel(snapshot.isSameBranch);
  const readinessAllowsSwitchLabel = getGitSnapshotBooleanLabel(snapshot.readinessAllowsSwitch);
  const canConfirmLabel = getGitSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getGitSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-branch-switch-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getGitBranchSwitchConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Git 分支切换确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Current: {currentBranchLabel}</span>
        <span>Target: {targetBranchLabel}</span>
        <span>Readiness: {snapshot.readinessStatus}</span>
        <span>DirtyFiles: {snapshot.dirtyFiles}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>SameBranch: {isSameBranchLabel}</span>
        <span>Ready: {readinessAllowsSwitchLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

function getGitTagMutationConfirmationSnapshotAction(
  confirmation: GitTagMutationConfirmation | null,
): GitTagMutationConfirmationSnapshotAction {
  if (confirmation === null) {
    return 'none';
  }

  if (confirmation.action === 'create') {
    return 'create';
  }

  if (confirmation.action === 'delete') {
    return 'delete';
  }

  return 'none';
}

function getGitTagMutationConfirmationSnapshotTargetCommit({
  action,
  targetCommitValue,
}: {
  action: GitTagMutationConfirmationSnapshotAction;
  targetCommitValue: string | null;
}): string | null {
  if (targetCommitValue !== null) {
    return targetCommitValue;
  }

  if (action === 'create') {
    return 'HEAD';
  }

  return null;
}

function getGitTagMutationConfirmationSnapshotStatus({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): GitTagMutationConfirmationSnapshotStatus {
  if (hasConfirmation === false) {
    return 'closed';
  }

  if (isConfirming === true) {
    return 'confirming';
  }

  return 'awaiting_confirmation';
}

function getGitTagMutationConfirmationSnapshotSource(
  action: GitTagMutationConfirmationSnapshotAction,
): GitTagMutationConfirmationSnapshotSource {
  if (action === 'create') {
    return 'tag_create';
  }

  if (action === 'delete') {
    return 'tag_delete';
  }

  return 'dialog_state';
}

function canConfirmGitTagMutationConfirmationSnapshot({
  hasConfirmation,
  hasTag,
  isConfirming,
}: {
  hasConfirmation: boolean;
  hasTag: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (hasTag === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function canCancelGitTagMutationConfirmationSnapshot({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function getGitTagMutationConfirmationSnapshotRiskLevel(): GitTagMutationConfirmationRiskLevel {
  return 'high';
}

function getGitTagMutationConfirmationSnapshotMessage({
  action,
  status,
}: {
  action: GitTagMutationConfirmationSnapshotAction;
  status: GitTagMutationConfirmationSnapshotStatus;
}): string {
  if (status === 'closed') {
    return 'Git 标签受控操作确认弹窗未打开。';
  }

  if (status === 'confirming') {
    return 'Git 标签受控操作正在提交，确认与取消入口暂时锁定。';
  }

  if (action === 'create') {
    return '本地标签创建确认已打开，等待用户确认 guarded git tag。';
  }

  return '本地标签删除确认已打开，等待用户确认 guarded git tag -d。';
}

function getGitTagMutationConfirmationSnapshotRecovery({
  action,
  hasConfirmation,
}: {
  action: GitTagMutationConfirmationSnapshotAction;
  hasConfirmation: boolean;
}): string {
  if (hasConfirmation === false) {
    return '触发本地标签创建或删除后会显示确认边界。';
  }

  if (action === 'create') {
    return '取消不会创建本地标签；确认后后端仍会阻断重复标签和非法标签名，不会 checkout、push tag、创建提交或修改工作区文件。';
  }

  return '取消不会删除本地标签；确认后后端仍会阻断缺失标签和非法标签名，不会删除远端标签或修改工作区文件。';
}

export function buildGitTagMutationConfirmationSnapshot({
  confirmation,
  isConfirming,
}: {
  confirmation: GitTagMutationConfirmation | null;
  isConfirming: boolean;
}): GitTagMutationConfirmationSnapshot {
  const hasConfirmation = confirmation !== null;
  const action = getGitTagMutationConfirmationSnapshotAction(confirmation);
  const tagName = getGitSnapshotTrimmedValue(confirmation?.tagName);
  const targetCommitValue = getGitSnapshotTrimmedValue(confirmation?.targetCommit);
  const targetCommit = getGitTagMutationConfirmationSnapshotTargetCommit({
    action,
    targetCommitValue,
  });
  const hasTag = hasGitSnapshotTextValue(tagName);
  const hasTargetCommit = hasGitSnapshotTextValue(targetCommit);
  const status = getGitTagMutationConfirmationSnapshotStatus({
    hasConfirmation,
    isConfirming,
  });
  const source = getGitTagMutationConfirmationSnapshotSource(action);
  const canConfirm = canConfirmGitTagMutationConfirmationSnapshot({
    hasConfirmation,
    hasTag,
    isConfirming,
  });
  const canCancel = canCancelGitTagMutationConfirmationSnapshot({
    hasConfirmation,
    isConfirming,
  });
  const riskLevel = getGitTagMutationConfirmationSnapshotRiskLevel();
  const message = getGitTagMutationConfirmationSnapshotMessage({
    action,
    status,
  });
  const recovery = getGitTagMutationConfirmationSnapshotRecovery({
    action,
    hasConfirmation,
  });

  return {
    status,
    source,
    action,
    tagName,
    targetCommit,
    hasTag,
    hasTargetCommit,
    canConfirm,
    canCancel,
    riskLevel,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getGitTagMutationConfirmationSnapshotClassName(snapshot: GitTagMutationConfirmationSnapshot) {
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-border bg-background/70 text-muted-foreground';
}

export function GitTagMutationConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: GitTagMutationConfirmationSnapshot;
}) {
  const tagNameLabel = getGitSnapshotLabel(snapshot.tagName, 'none');
  const targetCommitLabel = getGitSnapshotLabel(snapshot.targetCommit, 'unknown');
  const hasTagLabel = getGitSnapshotBooleanLabel(snapshot.hasTag);
  const hasTargetCommitLabel = getGitSnapshotBooleanLabel(snapshot.hasTargetCommit);
  const canConfirmLabel = getGitSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getGitSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-tag-mutation-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getGitTagMutationConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Git 标签受控操作确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Tag: {tagNameLabel}</span>
        <span>Commit: {targetCommitLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>HasTag: {hasTagLabel}</span>
        <span>TargetCommit: {hasTargetCommitLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function buildGitRemoteBranchSnapshot({
  gitRemoteBranches,
  gitRemoteBranchListStatus,
}: {
  gitRemoteBranches: GitRemoteBranch[];
  gitRemoteBranchListStatus: GitRemoteBranchListStatus | null;
}): GitRemoteBranchSnapshot {
  const latestRemoteBranch = getGitRemoteBranchSnapshotLatestBranch(gitRemoteBranches);
  const statusValue = getGitRemoteBranchListStatusValue(gitRemoteBranchListStatus);
  const listStatusValue = getGitRemoteBranchListStatusLabel(statusValue);
  const listIsStale = isGitRemoteBranchListStale(statusValue);
  const remoteBranchCount = gitRemoteBranches.length;
  const remoteCount = getGitRemoteBranchSnapshotRemoteCount(gitRemoteBranches);
  const latestRemoteBranchLabel = getGitRemoteBranchSnapshotLatestRemoteBranchLabel(latestRemoteBranch);
  const latestRemoteLabel = getGitRemoteBranchSnapshotLatestRemoteLabel(latestRemoteBranch);
  const latestBranchLabel = getGitRemoteBranchSnapshotLatestBranchLabel(latestRemoteBranch);
  const latestCommitLabel = getGitRemoteBranchSnapshotLatestCommitLabel(latestRemoteBranch);
  const status = getGitRemoteBranchSnapshotStatus({
    listIsStale,
    statusValue,
    remoteBranchCount,
  });
  const source = getGitRemoteBranchSnapshotSource(status);

  return {
    status,
    source,
    remoteBranchCount,
    remoteCount,
    hasRemoteBranches: remoteBranchCount > 0,
    listStatus: listStatusValue,
    latestRemoteBranch: latestRemoteBranchLabel,
    latestRemote: latestRemoteLabel,
    latestBranch: latestBranchLabel,
    latestCommit: latestCommitLabel,
    message: getGitRemoteBranchSnapshotMessage(status),
    recovery: getGitRemoteBranchSnapshotRecovery(status),
    updatedAt: 'derived',
  };
}

function getGitRemoteBranchSnapshotClassName(snapshot: GitRemoteBranchSnapshot) {
  const hasStaleStatus = isGitRemoteBranchSnapshotStatusIn(snapshot.status, GIT_REMOTE_BRANCH_SNAPSHOT_STALE_STATUSES);
  const hasEmptyStatus = isGitRemoteBranchSnapshotStatusIn(snapshot.status, GIT_REMOTE_BRANCH_SNAPSHOT_EMPTY_STATUSES);

  if (hasStaleStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (hasEmptyStatus === true) {
    return 'border-muted-foreground/20 bg-muted/20 text-muted-foreground';
  }
  return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
}

export function GitRemoteBranchSnapshotStrip({ snapshot }: { snapshot: GitRemoteBranchSnapshot }) {
  const hasRemoteBranchesLabel = getGitSnapshotBooleanLabel(snapshot.hasRemoteBranches);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-remote-branch-snapshot"
      className={cn('mx-3 mt-3 rounded-md border px-2.5 py-2 text-xs', getGitRemoteBranchSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Git Remote Branch 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>RemoteBranches: {snapshot.remoteBranchCount}</span>
        <span>Remotes: {snapshot.remoteCount}</span>
        <span>HasRemoteBranches: {hasRemoteBranchesLabel}</span>
        <span>Latest: {snapshot.latestRemoteBranch}</span>
        <span>Remote: {snapshot.latestRemote}</span>
        <span>Branch: {snapshot.latestBranch}</span>
        <span>Commit: {snapshot.latestCommit}</span>
        <span>List: {snapshot.listStatus}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

function getGitRemoteBranchRefreshConfirmationSnapshotAction(
  confirmation: GitRemoteBranchRefreshConfirmation | null,
): GitRemoteBranchRefreshConfirmationSnapshotAction {
  if (confirmation === null) {
    return 'none';
  }

  if (confirmation.action === 'refresh') {
    return 'refresh';
  }

  return 'none';
}

function getGitRemoteBranchRefreshConfirmationSnapshotStatus({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): GitRemoteBranchRefreshConfirmationSnapshotStatus {
  if (hasConfirmation === false) {
    return 'closed';
  }

  if (isConfirming === true) {
    return 'confirming';
  }

  return 'awaiting_confirmation';
}

function getGitRemoteBranchRefreshConfirmationSnapshotSource(
  action: GitRemoteBranchRefreshConfirmationSnapshotAction,
): GitRemoteBranchRefreshConfirmationSnapshotSource {
  if (action === 'refresh') {
    return 'remote_branch_refresh';
  }

  return 'dialog_state';
}

function canConfirmGitRemoteBranchRefreshConfirmationSnapshot({
  hasConfirmation,
  hasRemote,
  isConfirming,
}: {
  hasConfirmation: boolean;
  hasRemote: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (hasRemote === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function canCancelGitRemoteBranchRefreshConfirmationSnapshot({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function getGitRemoteBranchRefreshConfirmationSnapshotRiskLevel(): GitRemoteBranchRefreshConfirmationRiskLevel {
  return 'high';
}

function getGitRemoteBranchRefreshConfirmationSnapshotMessage(
  status: GitRemoteBranchRefreshConfirmationSnapshotStatus,
): string {
  if (status === 'closed') {
    return 'Git remote refs 刷新确认弹窗未打开。';
  }

  if (status === 'confirming') {
    return 'Git remote refs 刷新正在提交，确认与取消入口暂时锁定。';
  }

  return 'Git remote refs 刷新确认已打开，等待用户确认受控 git fetch。';
}

function getGitRemoteBranchRefreshConfirmationSnapshotRecovery(hasConfirmation: boolean): string {
  if (hasConfirmation === true) {
    return '取消不会刷新 remote refs；确认后后端仍会阻断非法 remote 和缺失 remote，只执行 git fetch <remote>，不会 pull、push、prune、checkout 或修改工作区文件。';
  }

  return '触发 remote refs 刷新后会显示确认边界。';
}

function getGitRemoteBranchCreateConfirmationSnapshotAction(
  confirmation: GitRemoteBranchCreateConfirmation | null,
): GitRemoteBranchCreateConfirmationSnapshotAction {
  if (confirmation === null) {
    return 'none';
  }

  if (confirmation.action === 'create_tracking') {
    return 'create_tracking';
  }

  return 'none';
}

function getGitRemoteBranchCreateConfirmationSnapshotStatus({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): GitRemoteBranchCreateConfirmationSnapshotStatus {
  if (hasConfirmation === false) {
    return 'closed';
  }

  if (isConfirming === true) {
    return 'confirming';
  }

  return 'awaiting_confirmation';
}

function getGitRemoteBranchCreateConfirmationSnapshotSource(
  action: GitRemoteBranchCreateConfirmationSnapshotAction,
): GitRemoteBranchCreateConfirmationSnapshotSource {
  if (action === 'create_tracking') {
    return 'remote_branch_create';
  }

  return 'dialog_state';
}

function canConfirmGitRemoteBranchCreateConfirmationSnapshot({
  hasConfirmation,
  hasRemoteBranch,
  hasLocalBranch,
  isConfirming,
}: {
  hasConfirmation: boolean;
  hasRemoteBranch: boolean;
  hasLocalBranch: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (hasRemoteBranch === false) {
    return false;
  }

  if (hasLocalBranch === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function canCancelGitRemoteBranchCreateConfirmationSnapshot({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function getGitRemoteBranchCreateConfirmationSnapshotRiskLevel(): GitRemoteBranchCreateConfirmationRiskLevel {
  return 'medium';
}

function getGitRemoteBranchCreateConfirmationSnapshotMessage(
  status: GitRemoteBranchCreateConfirmationSnapshotStatus,
): string {
  if (status === 'closed') {
    return 'Git remote tracking branch 创建确认弹窗未打开。';
  }

  if (status === 'confirming') {
    return 'Git remote tracking branch 创建正在提交，确认与取消入口暂时锁定。';
  }

  return 'Git remote tracking branch 创建确认已打开，等待用户确认 guarded git branch --track。';
}

function getGitRemoteBranchCreateConfirmationSnapshotRecovery(hasConfirmation: boolean): string {
  if (hasConfirmation === true) {
    return '取消不会创建本地 tracking branch；确认后后端仍会阻断非法 remote ref、缺失 remote ref、非法本地分支名和本地分支名占用，不会 fetch、pull、push、prune、checkout、switch 或修改工作区文件。';
  }

  return '触发从 remote ref 创建本地 tracking branch 后会显示确认边界。';
}

export function buildGitRemoteBranchRefreshConfirmationSnapshot({
  confirmation,
  isConfirming,
}: {
  confirmation: GitRemoteBranchRefreshConfirmation | null;
  isConfirming: boolean;
}): GitRemoteBranchRefreshConfirmationSnapshot {
  const hasConfirmation = confirmation !== null;
  const action = getGitRemoteBranchRefreshConfirmationSnapshotAction(confirmation);
  const remoteName = getGitSnapshotTrimmedValue(confirmation?.remoteName);
  const hasRemote = hasGitSnapshotTextValue(remoteName);
  const status = getGitRemoteBranchRefreshConfirmationSnapshotStatus({
    hasConfirmation,
    isConfirming,
  });
  const source = getGitRemoteBranchRefreshConfirmationSnapshotSource(action);
  const canConfirm = canConfirmGitRemoteBranchRefreshConfirmationSnapshot({
    hasConfirmation,
    hasRemote,
    isConfirming,
  });
  const canCancel = canCancelGitRemoteBranchRefreshConfirmationSnapshot({
    hasConfirmation,
    isConfirming,
  });
  const riskLevel = getGitRemoteBranchRefreshConfirmationSnapshotRiskLevel();
  const message = getGitRemoteBranchRefreshConfirmationSnapshotMessage(status);
  const recovery = getGitRemoteBranchRefreshConfirmationSnapshotRecovery(hasConfirmation);

  return {
    status,
    source,
    action,
    remoteName,
    hasRemote,
    canConfirm,
    canCancel,
    riskLevel,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getGitRemoteBranchRefreshConfirmationSnapshotClassName(snapshot: GitRemoteBranchRefreshConfirmationSnapshot) {
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-border bg-background/70 text-muted-foreground';
}

export function GitRemoteBranchRefreshConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: GitRemoteBranchRefreshConfirmationSnapshot;
}) {
  const remoteNameLabel = getGitSnapshotLabel(snapshot.remoteName, 'none');
  const hasRemoteLabel = getGitSnapshotBooleanLabel(snapshot.hasRemote);
  const canConfirmLabel = getGitSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getGitSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-remote-branch-refresh-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getGitRemoteBranchRefreshConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Git remote refs 刷新确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Remote: {remoteNameLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>HasRemote: {hasRemoteLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function buildGitRemoteBranchCreateConfirmationSnapshot({
  confirmation,
  isConfirming,
}: {
  confirmation: GitRemoteBranchCreateConfirmation | null;
  isConfirming: boolean;
}): GitRemoteBranchCreateConfirmationSnapshot {
  const hasConfirmation = confirmation !== null;
  const action = getGitRemoteBranchCreateConfirmationSnapshotAction(confirmation);
  const remoteBranchName = getGitSnapshotTrimmedValue(confirmation?.remoteBranchName);
  const localBranchName = getGitSnapshotTrimmedValue(confirmation?.localBranchName);
  const hasRemoteBranch = hasGitSnapshotTextValue(remoteBranchName);
  const hasLocalBranch = hasGitSnapshotTextValue(localBranchName);
  const status = getGitRemoteBranchCreateConfirmationSnapshotStatus({
    hasConfirmation,
    isConfirming,
  });
  const source = getGitRemoteBranchCreateConfirmationSnapshotSource(action);
  const canConfirm = canConfirmGitRemoteBranchCreateConfirmationSnapshot({
    hasConfirmation,
    hasRemoteBranch,
    hasLocalBranch,
    isConfirming,
  });
  const canCancel = canCancelGitRemoteBranchCreateConfirmationSnapshot({
    hasConfirmation,
    isConfirming,
  });
  const riskLevel = getGitRemoteBranchCreateConfirmationSnapshotRiskLevel();
  const message = getGitRemoteBranchCreateConfirmationSnapshotMessage(status);
  const recovery = getGitRemoteBranchCreateConfirmationSnapshotRecovery(hasConfirmation);

  return {
    status,
    source,
    action,
    remoteBranchName,
    localBranchName,
    hasRemoteBranch,
    hasLocalBranch,
    canConfirm,
    canCancel,
    riskLevel,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getGitRemoteBranchCreateConfirmationSnapshotClassName(snapshot: GitRemoteBranchCreateConfirmationSnapshot) {
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-border bg-background/70 text-muted-foreground';
}

export function GitRemoteBranchCreateConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: GitRemoteBranchCreateConfirmationSnapshot;
}) {
  const remoteBranchNameLabel = getGitSnapshotLabel(snapshot.remoteBranchName, 'none');
  const localBranchNameLabel = getGitSnapshotLabel(snapshot.localBranchName, 'none');
  const hasRemoteBranchLabel = getGitSnapshotBooleanLabel(snapshot.hasRemoteBranch);
  const hasLocalBranchLabel = getGitSnapshotBooleanLabel(snapshot.hasLocalBranch);
  const canConfirmLabel = getGitSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getGitSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-remote-branch-create-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getGitRemoteBranchCreateConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Git remote tracking branch 创建确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>RemoteBranch: {remoteBranchNameLabel}</span>
        <span>LocalBranch: {localBranchNameLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>HasRemoteBranch: {hasRemoteBranchLabel}</span>
        <span>HasLocalBranch: {hasLocalBranchLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function buildGitTagSnapshot({
  gitTags,
  gitTagListStatus,
}: {
  gitTags: GitTag[];
  gitTagListStatus: GitTagListStatus | null;
}): GitTagSnapshot {
  const latestTag = getGitTagSnapshotLatestTag(gitTags);
  const statusValue = getGitTagListStatusValue(gitTagListStatus);
  const listStatusValue = getGitTagListStatusLabel(statusValue);
  const listIsStale = isGitTagListStale(statusValue);
  const tagCount = gitTags.length;
  const latestTagLabel = getGitTagSnapshotLatestTagLabel(latestTag);
  const latestTargetCommitLabel = getGitTagSnapshotLatestTargetCommitLabel(latestTag);
  const status = getGitTagSnapshotStatus({
    listIsStale,
    statusValue,
    tagCount,
  });
  const source = getGitTagSnapshotSource(status);

  return {
    status,
    source,
    tagCount,
    hasTags: tagCount > 0,
    listStatus: listStatusValue,
    latestTag: latestTagLabel,
    latestTargetCommit: latestTargetCommitLabel,
    message: getGitTagSnapshotMessage(status),
    recovery: getGitTagSnapshotRecovery(status),
    updatedAt: 'derived',
  };
}

function getGitTagSnapshotClassName(snapshot: GitTagSnapshot) {
  const hasStaleStatus = isGitTagSnapshotStatusIn(snapshot.status, GIT_TAG_SNAPSHOT_STALE_STATUSES);
  const hasEmptyStatus = isGitTagSnapshotStatusIn(snapshot.status, GIT_TAG_SNAPSHOT_EMPTY_STATUSES);

  if (hasStaleStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (hasEmptyStatus === true) {
    return 'border-muted-foreground/20 bg-muted/20 text-muted-foreground';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

export function GitTagSnapshotStrip({ snapshot }: { snapshot: GitTagSnapshot }) {
  const hasTagsLabel = getGitSnapshotBooleanLabel(snapshot.hasTags);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-tag-snapshot"
      className={cn('mx-3 mt-3 rounded-md border px-2.5 py-2 text-xs', getGitTagSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Git Tag 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Tags: {snapshot.tagCount}</span>
        <span>HasTags: {hasTagsLabel}</span>
        <span>Latest: {snapshot.latestTag}</span>
        <span>Target: {snapshot.latestTargetCommit}</span>
        <span>List: {snapshot.listStatus}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

export function buildGitStashSnapshot({
  gitStashes,
  gitStashListStatus,
}: {
  gitStashes: GitStash[];
  gitStashListStatus: GitStashListStatus | null;
}): GitStashSnapshot {
  const latestStash = getGitStashSnapshotLatestStash(gitStashes);
  const statusValue = getGitStashListStatusValue(gitStashListStatus);
  const listStatusValue = getGitStashListStatusLabel(statusValue);
  const listIsStale = isGitStashListStale(statusValue);
  const stashCount = gitStashes.length;
  const latestRefLabel = getGitStashSnapshotLatestRefLabel(latestStash);
  const latestBranchLabel = getGitStashSnapshotLatestBranchLabel(latestStash);
  const latestTargetCommitLabel = getGitStashSnapshotLatestTargetCommitLabel(latestStash);
  const status = getGitStashSnapshotStatus({
    listIsStale,
    statusValue,
    stashCount,
  });
  const source = getGitStashSnapshotSource(status);

  return {
    status,
    source,
    stashCount,
    hasStashes: stashCount > 0,
    listStatus: listStatusValue,
    latestRef: latestRefLabel,
    latestBranch: latestBranchLabel,
    latestTargetCommit: latestTargetCommitLabel,
    message: getGitStashSnapshotMessage(status),
    recovery: getGitStashSnapshotRecovery(status),
    updatedAt: 'derived',
  };
}

function getGitStashSnapshotClassName(snapshot: GitStashSnapshot) {
  const hasStaleStatus = isGitStashSnapshotStatusIn(snapshot.status, GIT_STASH_SNAPSHOT_STALE_STATUSES);
  const hasEmptyStatus = isGitStashSnapshotStatusIn(snapshot.status, GIT_STASH_SNAPSHOT_EMPTY_STATUSES);

  if (hasStaleStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (hasEmptyStatus === true) {
    return 'border-muted-foreground/20 bg-muted/20 text-muted-foreground';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

export function GitStashSnapshotStrip({ snapshot }: { snapshot: GitStashSnapshot }) {
  const hasStashesLabel = getGitSnapshotBooleanLabel(snapshot.hasStashes);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-stash-snapshot"
      className={cn('mx-3 mt-3 rounded-md border px-2.5 py-2 text-xs', getGitStashSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Git Stash 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Stashes: {snapshot.stashCount}</span>
        <span>HasStashes: {hasStashesLabel}</span>
        <span>Latest: {snapshot.latestRef}</span>
        <span>Branch: {snapshot.latestBranch}</span>
        <span>Target: {snapshot.latestTargetCommit}</span>
        <span>List: {snapshot.listStatus}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

function getGitStashMutationConfirmationSnapshotAction(
  confirmation: GitStashMutationConfirmation | null,
): GitStashMutationConfirmationSnapshotAction {
  if (confirmation === null) {
    return 'none';
  }

  if (confirmation.action === 'apply') {
    return 'apply';
  }

  if (confirmation.action === 'create') {
    return 'create';
  }

  return 'none';
}

function getGitStashMutationConfirmationSnapshotStatus({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): GitStashMutationConfirmationSnapshotStatus {
  if (hasConfirmation === false) {
    return 'closed';
  }

  if (isConfirming === true) {
    return 'confirming';
  }

  return 'awaiting_confirmation';
}

function getGitStashMutationConfirmationSnapshotSource(
  action: GitStashMutationConfirmationSnapshotAction,
): GitStashMutationConfirmationSnapshotSource {
  if (action === 'apply') {
    return 'stash_apply';
  }

  if (action === 'create') {
    return 'stash_create';
  }

  return 'dialog_state';
}

function canConfirmGitStashMutationConfirmationSnapshot({
  action,
  hasConfirmation,
  hasStashMessage,
  hasStashRef,
  isConfirming,
}: {
  action: GitStashMutationConfirmationSnapshotAction;
  hasConfirmation: boolean;
  hasStashMessage: boolean;
  hasStashRef: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (action === 'apply' && hasStashRef === false) {
    return false;
  }

  if (action === 'create' && hasStashMessage === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function canCancelGitStashMutationConfirmationSnapshot({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function getGitStashMutationConfirmationSnapshotRiskLevel(): GitStashMutationConfirmationRiskLevel {
  return 'high';
}

function getGitStashMutationConfirmationSnapshotMessage(
  action: GitStashMutationConfirmationSnapshotAction,
  status: GitStashMutationConfirmationSnapshotStatus,
): string {
  if (status === 'closed') {
    return 'Git stash mutation 确认弹窗未打开。';
  }

  if (status === 'confirming') {
    if (action === 'create') {
      return 'Git stash create 正在提交，确认与取消入口暂时锁定。';
    }

    return 'Git stash apply 正在提交，确认与取消入口暂时锁定。';
  }

  if (action === 'create') {
    return 'Git stash create 确认已打开，等待用户确认 guarded git stash push --include-untracked。';
  }

  return 'Git stash apply 确认已打开，等待用户确认 guarded git stash apply --index。';
}

function getGitStashMutationConfirmationSnapshotRecovery(
  action: GitStashMutationConfirmationSnapshotAction,
  hasConfirmation: boolean,
): string {
  if (hasConfirmation === true) {
    if (action === 'create') {
      return '取消不会创建 stash；确认后后端仍会阻断空 message、clean worktree 和 runtime 不可用，不会提交、reset、pop、drop 或 clear stash。';
    }

    return '取消不会应用 stash；确认后后端仍会阻断非法 ref、缺失 ref、dirty worktree 和 patch 预检失败，不会 pop、drop 或 clear stash。';
  }

  return '选择目标 stash 应用或填写 stash message 创建后会显示确认边界。';
}

export function buildGitStashMutationConfirmationSnapshot({
  confirmation,
  isConfirming,
}: {
  confirmation: GitStashMutationConfirmation | null;
  isConfirming: boolean;
}): GitStashMutationConfirmationSnapshot {
  const hasConfirmation = confirmation !== null;
  const action = getGitStashMutationConfirmationSnapshotAction(confirmation);
  const stashRef = getGitSnapshotTrimmedValue(confirmation?.stashRef);
  const stashMessage = getGitSnapshotTrimmedValue(confirmation?.stashMessage);
  const branch = getGitSnapshotTrimmedValue(confirmation?.branch);
  const targetCommit = getGitSnapshotTrimmedValue(confirmation?.targetCommit);
  const hasStashRef = hasGitSnapshotTextValue(stashRef);
  const hasStashMessage = hasGitSnapshotTextValue(stashMessage);
  const hasTargetCommit = hasGitSnapshotTextValue(targetCommit);
  const status = getGitStashMutationConfirmationSnapshotStatus({
    hasConfirmation,
    isConfirming,
  });
  const source = getGitStashMutationConfirmationSnapshotSource(action);
  const canConfirm = canConfirmGitStashMutationConfirmationSnapshot({
    action,
    hasConfirmation,
    hasStashMessage,
    hasStashRef,
    isConfirming,
  });
  const canCancel = canCancelGitStashMutationConfirmationSnapshot({
    hasConfirmation,
    isConfirming,
  });
  const riskLevel = getGitStashMutationConfirmationSnapshotRiskLevel();
  const message = getGitStashMutationConfirmationSnapshotMessage(action, status);
  const recovery = getGitStashMutationConfirmationSnapshotRecovery(action, hasConfirmation);

  return {
    status,
    source,
    action,
    stashRef,
    stashMessage,
    branch,
    targetCommit,
    hasStashRef,
    hasStashMessage,
    hasTargetCommit,
    canConfirm,
    canCancel,
    riskLevel,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getGitStashMutationConfirmationSnapshotClassName(snapshot: GitStashMutationConfirmationSnapshot) {
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-border bg-background/70 text-muted-foreground';
}

export function GitStashMutationConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: GitStashMutationConfirmationSnapshot;
}) {
  const stashRefLabel = getGitSnapshotLabel(snapshot.stashRef, 'none');
  const stashMessageLabel = getGitSnapshotLabel(snapshot.stashMessage, 'none');
  const branchLabel = getGitSnapshotLabel(snapshot.branch, 'unknown');
  const targetCommitLabel = getGitSnapshotLabel(snapshot.targetCommit, 'unknown');
  const hasStashRefLabel = getGitSnapshotBooleanLabel(snapshot.hasStashRef);
  const hasStashMessageLabel = getGitSnapshotBooleanLabel(snapshot.hasStashMessage);
  const hasTargetCommitLabel = getGitSnapshotBooleanLabel(snapshot.hasTargetCommit);
  const canConfirmLabel = getGitSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getGitSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-stash-mutation-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getGitStashMutationConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Git stash apply 确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Ref: {stashRefLabel}</span>
        <span>Message: {stashMessageLabel}</span>
        <span>Branch: {branchLabel}</span>
        <span>Commit: {targetCommitLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>HasRef: {hasStashRefLabel}</span>
        <span>HasMessage: {hasStashMessageLabel}</span>
        <span>TargetCommit: {hasTargetCommitLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

type GitWorktreeSnapshotStatusList = readonly GitWorktreeSnapshotStatus[];
type GitWorktreeStatusStateValueList = readonly GitWorktreeStatusStateValue[];

const GIT_WORKTREE_STATUS_STALE_VALUES: GitWorktreeStatusStateValueList = [
  'stale_with_cache',
  'stale_without_cache',
];

const GIT_WORKTREE_SNAPSHOT_STALE_STATUSES: GitWorktreeSnapshotStatusList = [
  'stale_with_cache',
  'stale_without_cache',
];

const GIT_WORKTREE_SNAPSHOT_WARNING_STATUSES: GitWorktreeSnapshotStatusList = [
  'stale_with_cache',
  'stale_without_cache',
  'missing',
];

const GIT_WORKTREE_SNAPSHOT_DIRTY_STATUSES: GitWorktreeSnapshotStatusList = [
  'dirty',
];

function isGitWorktreeSnapshotStatusIn(
  status: GitWorktreeSnapshotStatus,
  statuses: GitWorktreeSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function isGitWorktreeStatusStateValueIn(
  statusValue: GitWorktreeStatusStateValue | undefined,
  statuses: GitWorktreeStatusStateValueList,
): boolean {
  if (statusValue === undefined) {
    return false;
  }

  for (const candidate of statuses) {
    const matchedStatus = candidate === statusValue;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function getGitWorktreeStatusStateValue(
  statusState: GitWorktreeStatusState | null,
): GitWorktreeStatusStateValue | undefined {
  if (statusState === null) {
    return undefined;
  }

  return statusState.status;
}

function getGitWorktreeStatusStateLabel(
  statusValue: GitWorktreeStatusStateValue | undefined,
): GitWorktreeStatusStateValue | 'unknown' {
  if (statusValue === undefined) {
    return 'unknown';
  }

  return statusValue;
}

function isGitWorktreeStatusStateStale(statusValue: GitWorktreeStatusStateValue | undefined): boolean {
  return isGitWorktreeStatusStateValueIn(statusValue, GIT_WORKTREE_STATUS_STALE_VALUES);
}

function hasGitWorktreeStatus(gitWorktreeStatus: GitWorktreeStatus | null): boolean {
  return gitWorktreeStatus !== null;
}

function getGitWorktreeCurrentBranchLabel(gitWorktreeStatus: GitWorktreeStatus | null): string {
  if (gitWorktreeStatus === null) {
    return 'unknown';
  }

  return getGitSnapshotLabel(gitWorktreeStatus.current_branch, 'unknown');
}

function getGitWorktreeDirtyFiles(gitWorktreeStatus: GitWorktreeStatus | null): GitWorktreeFile[] {
  if (gitWorktreeStatus === null) {
    return [];
  }

  return gitWorktreeStatus.files;
}

function getGitWorktreeDirtyFileCount(gitWorktreeStatus: GitWorktreeStatus | null): number {
  if (gitWorktreeStatus === null) {
    return 0;
  }

  return gitWorktreeStatus.dirty_files;
}

function getGitWorktreeDiffFileCount(gitWorktreeStatus: GitWorktreeStatus | null): number {
  if (gitWorktreeStatus === null) {
    return 0;
  }

  return gitWorktreeStatus.diff_files;
}

function getGitWorktreeAdditions(gitWorktreeStatus: GitWorktreeStatus | null): number {
  if (gitWorktreeStatus === null) {
    return 0;
  }

  return gitWorktreeStatus.additions;
}

function getGitWorktreeDeletions(gitWorktreeStatus: GitWorktreeStatus | null): number {
  if (gitWorktreeStatus === null) {
    return 0;
  }

  return gitWorktreeStatus.deletions;
}

function hasGitWorktreeDiffPreview(gitWorktreeStatus: GitWorktreeStatus | null): boolean {
  if (gitWorktreeStatus === null) {
    return false;
  }

  const hasDiffPreview = gitWorktreeStatus.diff.length > 0;
  return hasDiffPreview === true;
}

function getGitWorktreeRecoveryValue(gitWorktreeStatus: GitWorktreeStatus | null): string {
  if (gitWorktreeStatus === null) {
    return '';
  }

  return gitWorktreeStatus.recovery;
}

function getGitWorktreeDirtyFileOriginalPathValue(file: GitWorktreeFile): string {
  if (file.original_path === undefined) {
    return '';
  }

  return file.original_path;
}

function getGitWorktreeDirtyFilePathLabel(file: GitWorktreeFile): string {
  const originalPathValue = getGitWorktreeDirtyFileOriginalPathValue(file);
  const hasOriginalPath = originalPathValue.length > 0;

  if (hasOriginalPath === true) {
    return `${originalPathValue} -> ${file.path}`;
  }

  return file.path;
}

function getGitWorktreeVisibleDirtyFiles(dirtyFiles: GitWorktreeFile[]): GitWorktreeVisibleDirtyFileList {
  const visibleDirtyFiles: GitWorktreeVisibleDirtyFileList = [];

  for (const file of dirtyFiles) {
    const shouldStop = visibleDirtyFiles.length >= 5;
    if (shouldStop === true) {
      break;
    }

    const pathLabel = getGitWorktreeDirtyFilePathLabel(file);
    visibleDirtyFiles.push(`${file.status}:${pathLabel}`);
  }

  return visibleDirtyFiles;
}

function getGitWorktreeCleanlinessStatusValue(
  gitWorktreeStatus: GitWorktreeStatus | null,
): GitWorktreeCleanlinessStatus | undefined {
  if (gitWorktreeStatus === null) {
    return undefined;
  }

  return gitWorktreeStatus.status;
}

function getGitWorktreeSnapshotStatus({
  stateIsStale,
  stateStatusValue,
  cleanlinessStatusValue,
}: {
  stateIsStale: boolean;
  stateStatusValue: GitWorktreeStatusStateValue | undefined;
  cleanlinessStatusValue: GitWorktreeCleanlinessStatus | undefined;
}): GitWorktreeSnapshotStatus {
  if (stateIsStale === true) {
    if (stateStatusValue === 'stale_with_cache') {
      return 'stale_with_cache';
    }

    return 'stale_without_cache';
  }

  if (cleanlinessStatusValue === 'dirty') {
    return 'dirty';
  }

  if (cleanlinessStatusValue === 'clean') {
    return 'clean';
  }

  return 'missing';
}

function getGitWorktreeSnapshotSource({
  status,
  hasStatus,
  hasDiffPreview,
}: {
  status: GitWorktreeSnapshotStatus;
  hasStatus: boolean;
  hasDiffPreview: boolean;
}): GitWorktreeSnapshotSource {
  const hasStaleStatus = isGitWorktreeSnapshotStatusIn(status, GIT_WORKTREE_SNAPSHOT_STALE_STATUSES);

  if (hasStaleStatus === true) {
    return 'worktree_status_cache';
  }

  if (hasStatus === true) {
    if (hasDiffPreview === true) {
      return 'worktree_diff';
    }

    return 'worktree_status';
  }

  return 'metadata';
}

function getGitWorktreeSnapshotMessage(status: GitWorktreeSnapshotStatus): string {
  switch (status) {
    case 'stale_with_cache':
      return 'Git worktree 状态当前显示旧快照。';
    case 'stale_without_cache':
      return 'Git worktree 状态当前没有可确认快照。';
    case 'dirty':
      return 'Git worktree 存在未提交变更。';
    case 'clean':
      return 'Git worktree 当前没有未提交变更。';
    case 'missing':
      return '当前没有可确认的 Git worktree 状态。';
  }
}

function getGitWorktreeSnapshotRecovery({
  status,
  recoveryValue,
}: {
  status: GitWorktreeSnapshotStatus;
  recoveryValue: string;
}): string {
  const hasRecoveryValue = recoveryValue.length > 0;

  switch (status) {
    case 'stale_with_cache':
      return '刷新 Git 面板，确认 worktree clean/dirty 状态是否变化。';
    case 'stale_without_cache':
      return '刷新 Git 面板，确认后端是否可读取 worktree 状态。';
    case 'dirty':
      if (hasRecoveryValue === true) {
        return recoveryValue;
      }

      return '先保存并生成 Git 快照，或处理本地变更后再执行受控写操作。';
    case 'clean':
      if (hasRecoveryValue === true) {
        return recoveryValue;
      }

      return '可继续查看提交、分支和远端引用；后续写操作仍需通过各自 guard。';
    case 'missing':
      return '刷新 Git 面板以读取 worktree 状态。';
  }
}

export function buildGitWorktreeSnapshot({
  gitWorktreeStatus,
  gitWorktreeStatusState,
}: {
  gitWorktreeStatus: GitWorktreeStatus | null;
  gitWorktreeStatusState: GitWorktreeStatusState | null;
}): GitWorktreeSnapshot {
  const statusStateValue = getGitWorktreeStatusStateValue(gitWorktreeStatusState);
  const statusValue = getGitWorktreeStatusStateLabel(statusStateValue);
  const stateIsStale = isGitWorktreeStatusStateStale(statusStateValue);
  const hasStatus = hasGitWorktreeStatus(gitWorktreeStatus);
  const hasDiffPreview = hasGitWorktreeDiffPreview(gitWorktreeStatus);
  const dirtyFiles = getGitWorktreeDirtyFiles(gitWorktreeStatus);
  const currentBranchLabel = getGitWorktreeCurrentBranchLabel(gitWorktreeStatus);
  const dirtyFileCount = getGitWorktreeDirtyFileCount(gitWorktreeStatus);
  const diffFileCount = getGitWorktreeDiffFileCount(gitWorktreeStatus);
  const additions = getGitWorktreeAdditions(gitWorktreeStatus);
  const deletions = getGitWorktreeDeletions(gitWorktreeStatus);
  const recoveryValue = getGitWorktreeRecoveryValue(gitWorktreeStatus);
  const visibleDirtyFiles = getGitWorktreeVisibleDirtyFiles(dirtyFiles);
  const cleanlinessStatusValue = getGitWorktreeCleanlinessStatusValue(gitWorktreeStatus);
  const status = getGitWorktreeSnapshotStatus({
    stateIsStale,
    stateStatusValue: statusStateValue,
    cleanlinessStatusValue,
  });
  const source = getGitWorktreeSnapshotSource({
    status,
    hasStatus,
    hasDiffPreview,
  });

  return {
    status,
    source,
    currentBranch: currentBranchLabel,
    dirtyFiles: dirtyFileCount,
    visibleDirtyFiles,
    hiddenDirtyFileCount: Math.max(0, dirtyFiles.length - visibleDirtyFiles.length),
    diffFileCount,
    additions,
    deletions,
    hasDiffPreview,
    hasStatus,
    statusValue,
    message: getGitWorktreeSnapshotMessage(status),
    recovery: getGitWorktreeSnapshotRecovery({
      status,
      recoveryValue,
    }),
    updatedAt: 'derived',
  };
}

function getGitWorktreeSnapshotClassName(snapshot: GitWorktreeSnapshot) {
  const hasWarningStatus = isGitWorktreeSnapshotStatusIn(snapshot.status, GIT_WORKTREE_SNAPSHOT_WARNING_STATUSES);
  const hasDirtyStatus = isGitWorktreeSnapshotStatusIn(snapshot.status, GIT_WORKTREE_SNAPSHOT_DIRTY_STATUSES);

  if (hasWarningStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (hasDirtyStatus === true) {
    return 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

function getGitWorktreeVisibleDirtyFileNodes(snapshot: GitWorktreeSnapshot): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const file of snapshot.visibleDirtyFiles) {
    nodes.push(
      <span key={file} className="rounded bg-background/70 px-1.5 py-0.5 font-mono">
        {file}
      </span>,
    );
  }

  const hasHiddenDirtyFiles = snapshot.hiddenDirtyFileCount > 0;
  if (hasHiddenDirtyFiles === true) {
    nodes.push(
      <span key="hidden-dirty-file-count" className="rounded bg-background/70 px-1.5 py-0.5">
        +{snapshot.hiddenDirtyFileCount} more
      </span>,
    );
  }

  return nodes;
}

export function GitWorktreeSnapshotStrip({ snapshot }: { snapshot: GitWorktreeSnapshot }) {
  const hasDiffPreviewLabel = getGitSnapshotBooleanLabel(snapshot.hasDiffPreview);
  const hasStatusLabel = getGitSnapshotBooleanLabel(snapshot.hasStatus);
  const visibleDirtyFileNodes = getGitWorktreeVisibleDirtyFileNodes(snapshot);
  const canRenderVisibleDirtyFileNodes = visibleDirtyFileNodes.length > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-worktree-snapshot"
      className={cn('mx-3 mt-3 rounded-md border px-2.5 py-2 text-xs', getGitWorktreeSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Git Worktree 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Branch: {snapshot.currentBranch}</span>
        <span>DirtyFiles: {snapshot.dirtyFiles}</span>
        <span>DiffFiles: {snapshot.diffFileCount}</span>
        <span>Add: {snapshot.additions}</span>
        <span>Del: {snapshot.deletions}</span>
        <span>DiffPreview: {hasDiffPreviewLabel}</span>
        <span>Status: {snapshot.statusValue}</span>
        <span>Confirmed: {hasStatusLabel}</span>
      </div>
      {canRenderVisibleDirtyFileNodes === true && (
        <div className="mt-1 flex flex-wrap gap-1">
          {visibleDirtyFileNodes}
        </div>
      )}
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

function getGitWorktreeCommitConfirmationSnapshotAction(
  confirmation: GitWorktreeCommitConfirmation | null,
): GitWorktreeCommitConfirmationSnapshotAction {
  if (confirmation === null) {
    return 'none';
  }

  if (confirmation.action === 'commit') {
    return 'commit';
  }

  return 'none';
}

function getGitWorktreeCommitConfirmationCurrentBranch(currentBranchValue: string | null): string {
  if (currentBranchValue !== null) {
    return currentBranchValue;
  }

  return 'unknown';
}

function getGitWorktreeCommitConfirmationDirtyFileCount(confirmation: GitWorktreeCommitConfirmation | null): number {
  if (confirmation === null) {
    return 0;
  }

  if (confirmation.dirtyFiles === undefined) {
    return 0;
  }

  return confirmation.dirtyFiles;
}

function getGitWorktreeCommitConfirmationMessageLength(commitMessage: string | null): number {
  if (commitMessage === null) {
    return 0;
  }

  return commitMessage.length;
}

function getGitWorktreeCommitConfirmationSnapshotStatus({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): GitWorktreeCommitConfirmationSnapshotStatus {
  if (hasConfirmation === false) {
    return 'closed';
  }

  if (isConfirming === true) {
    return 'confirming';
  }

  return 'awaiting_confirmation';
}

function getGitWorktreeCommitConfirmationSnapshotSource(
  action: GitWorktreeCommitConfirmationSnapshotAction,
): GitWorktreeCommitConfirmationSnapshotSource {
  if (action === 'commit') {
    return 'worktree_commit';
  }

  return 'dialog_state';
}

function canConfirmGitWorktreeCommitConfirmationSnapshot({
  hasConfirmation,
  hasMessage,
  hasDirtyFiles,
  isConfirming,
}: {
  hasConfirmation: boolean;
  hasMessage: boolean;
  hasDirtyFiles: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (hasMessage === false) {
    return false;
  }

  if (hasDirtyFiles === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function canCancelGitWorktreeCommitConfirmationSnapshot({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function getGitWorktreeCommitConfirmationSnapshotRiskLevel(): GitWorktreeCommitConfirmationRiskLevel {
  return 'high';
}

function getGitWorktreeCommitConfirmationSnapshotMessage(
  status: GitWorktreeCommitConfirmationSnapshotStatus,
): string {
  if (status === 'closed') {
    return 'Git worktree commit 确认弹窗未打开。';
  }

  if (status === 'confirming') {
    return 'Git worktree commit 正在提交，确认与取消入口暂时锁定。';
  }

  return 'Git worktree commit 确认已打开，等待用户确认提交当前全部 dirty 变更。';
}

function getGitWorktreeCommitConfirmationSnapshotRecovery(hasConfirmation: boolean): string {
  if (hasConfirmation === true) {
    return '取消不会创建提交；确认后仍走既有显式 POST，后端复用 git add -A 与 git commit -m，并按原链路刷新 Explorer、worktree 与 Git 提交列表。';
  }

  return '输入提交信息并触发提交后会显示确认边界。';
}

export function buildGitWorktreeCommitConfirmationSnapshot({
  confirmation,
  isConfirming,
}: {
  confirmation: GitWorktreeCommitConfirmation | null;
  isConfirming: boolean;
}): GitWorktreeCommitConfirmationSnapshot {
  const hasConfirmation = confirmation !== null;
  const action = getGitWorktreeCommitConfirmationSnapshotAction(confirmation);
  const commitMessage = getGitSnapshotTrimmedValue(confirmation?.commitMessage);
  const currentBranchValue = getGitSnapshotTrimmedValue(confirmation?.currentBranch);
  const currentBranch = getGitWorktreeCommitConfirmationCurrentBranch(currentBranchValue);
  const dirtyFileCount = getGitWorktreeCommitConfirmationDirtyFileCount(confirmation);
  const dirtyFiles = Math.max(0, dirtyFileCount);
  const messageLength = getGitWorktreeCommitConfirmationMessageLength(commitMessage);
  const hasMessage = hasGitSnapshotTextValue(commitMessage);
  const hasDirtyFiles = dirtyFiles > 0;
  const status = getGitWorktreeCommitConfirmationSnapshotStatus({
    hasConfirmation,
    isConfirming,
  });
  const source = getGitWorktreeCommitConfirmationSnapshotSource(action);
  const canConfirm = canConfirmGitWorktreeCommitConfirmationSnapshot({
    hasConfirmation,
    hasMessage,
    hasDirtyFiles,
    isConfirming,
  });
  const canCancel = canCancelGitWorktreeCommitConfirmationSnapshot({
    hasConfirmation,
    isConfirming,
  });
  const riskLevel = getGitWorktreeCommitConfirmationSnapshotRiskLevel();
  const message = getGitWorktreeCommitConfirmationSnapshotMessage(status);
  const recovery = getGitWorktreeCommitConfirmationSnapshotRecovery(hasConfirmation);

  return {
    status,
    source,
    action,
    commitMessage,
    messageLength,
    currentBranch,
    dirtyFiles,
    hasMessage,
    hasDirtyFiles,
    canConfirm,
    canCancel,
    riskLevel,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getGitWorktreeCommitConfirmationSnapshotClassName(snapshot: GitWorktreeCommitConfirmationSnapshot) {
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-border bg-background/70 text-muted-foreground';
}

export function GitWorktreeCommitConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: GitWorktreeCommitConfirmationSnapshot;
}) {
  const commitMessageLabel = getGitSnapshotLabel(snapshot.commitMessage, 'none');
  const hasMessageLabel = getGitSnapshotBooleanLabel(snapshot.hasMessage);
  const hasDirtyFilesLabel = getGitSnapshotBooleanLabel(snapshot.hasDirtyFiles);
  const canConfirmLabel = getGitSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getGitSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-worktree-commit-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getGitWorktreeCommitConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Git worktree commit 确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Branch: {snapshot.currentBranch}</span>
        <span>DirtyFiles: {snapshot.dirtyFiles}</span>
        <span>MessageLength: {snapshot.messageLength}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>HasMessage: {hasMessageLabel}</span>
        <span>HasDirtyFiles: {hasDirtyFilesLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">Commit: {commitMessageLabel}</p>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

function getGitWorktreeFileDiscardConfirmationSnapshotAction(
  confirmation: GitWorktreeFileDiscardConfirmation | null,
): GitWorktreeFileDiscardConfirmationSnapshotAction {
  if (confirmation === null) {
    return 'none';
  }

  if (confirmation.action === 'discard') {
    return 'discard';
  }

  return 'none';
}

function getGitWorktreeFileDiscardConfirmationSnapshotStatus({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): GitWorktreeFileDiscardConfirmationSnapshotStatus {
  if (hasConfirmation === false) {
    return 'closed';
  }

  if (isConfirming === true) {
    return 'confirming';
  }

  return 'awaiting_confirmation';
}

function getGitWorktreeFileDiscardConfirmationSnapshotSource(
  action: GitWorktreeFileDiscardConfirmationSnapshotAction,
): GitWorktreeFileDiscardConfirmationSnapshotSource {
  if (action === 'discard') {
    return 'worktree_file_discard';
  }

  return 'dialog_state';
}

function canConfirmGitWorktreeFileDiscardConfirmationSnapshot({
  hasConfirmation,
  hasPath,
  isConfirming,
}: {
  hasConfirmation: boolean;
  hasPath: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (hasPath === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function canCancelGitWorktreeFileDiscardConfirmationSnapshot({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function getGitWorktreeFileDiscardConfirmationSnapshotRiskLevel(): GitWorktreeFileDiscardConfirmationRiskLevel {
  return 'high';
}

function getGitWorktreeFileDiscardConfirmationSnapshotMessage(
  status: GitWorktreeFileDiscardConfirmationSnapshotStatus,
): string {
  if (status === 'closed') {
    return 'Git worktree 单文件丢弃确认弹窗未打开。';
  }

  if (status === 'confirming') {
    return 'Git worktree 单文件丢弃正在提交，确认与取消入口暂时锁定。';
  }

  return 'Git worktree 单文件丢弃确认已打开，等待用户确认 guarded discard-file。';
}

function getGitWorktreeFileDiscardConfirmationSnapshotRecovery(hasConfirmation: boolean): string {
  if (hasConfirmation === true) {
    return '取消不会丢弃文件变更；确认后后端仍会阻断缺失路径、复杂 Git 状态、多 dirty 记录和路径越界，不会执行整仓 reset、clean、stash 或分支切换。';
  }

  return '选择 dirty worktree 文件并触发丢弃后会显示确认边界。';
}

export function buildGitWorktreeFileDiscardConfirmationSnapshot({
  confirmation,
  isConfirming,
}: {
  confirmation: GitWorktreeFileDiscardConfirmation | null;
  isConfirming: boolean;
}): GitWorktreeFileDiscardConfirmationSnapshot {
  const hasConfirmation = confirmation !== null;
  const action = getGitWorktreeFileDiscardConfirmationSnapshotAction(confirmation);
  const filePath = getGitSnapshotTrimmedValue(confirmation?.filePath);
  const hasPath = hasGitSnapshotTextValue(filePath);
  const status = getGitWorktreeFileDiscardConfirmationSnapshotStatus({
    hasConfirmation,
    isConfirming,
  });
  const source = getGitWorktreeFileDiscardConfirmationSnapshotSource(action);
  const canConfirm = canConfirmGitWorktreeFileDiscardConfirmationSnapshot({
    hasConfirmation,
    hasPath,
    isConfirming,
  });
  const canCancel = canCancelGitWorktreeFileDiscardConfirmationSnapshot({
    hasConfirmation,
    isConfirming,
  });
  const riskLevel = getGitWorktreeFileDiscardConfirmationSnapshotRiskLevel();
  const message = getGitWorktreeFileDiscardConfirmationSnapshotMessage(status);
  const recovery = getGitWorktreeFileDiscardConfirmationSnapshotRecovery(hasConfirmation);

  return {
    status,
    source,
    action,
    filePath,
    hasPath,
    canConfirm,
    canCancel,
    riskLevel,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getGitWorktreeFileDiscardConfirmationSnapshotClassName(snapshot: GitWorktreeFileDiscardConfirmationSnapshot) {
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-border bg-background/70 text-muted-foreground';
}

export function GitWorktreeFileDiscardConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: GitWorktreeFileDiscardConfirmationSnapshot;
}) {
  const filePathLabel = getGitSnapshotLabel(snapshot.filePath, 'none');
  const hasPathLabel = getGitSnapshotBooleanLabel(snapshot.hasPath);
  const canConfirmLabel = getGitSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getGitSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-worktree-file-discard-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getGitWorktreeFileDiscardConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Git worktree 文件丢弃确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Path: {filePathLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>HasPath: {hasPathLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

type GitBranchCompareSnapshotStatusList = readonly GitBranchCompareSnapshotStatus[];
type GitBranchCompareStatusValueList = readonly GitBranchCompareStatusValue[];

const GIT_BRANCH_COMPARE_STATUS_STALE_VALUES: GitBranchCompareStatusValueList = [
  'stale_with_cache',
  'stale_without_cache',
];

const GIT_BRANCH_COMPARE_SNAPSHOT_STATUS_SOURCE_STATUSES: GitBranchCompareSnapshotStatusList = [
  'stale_with_cache',
  'stale_without_cache',
  'no_target',
];

const GIT_BRANCH_COMPARE_SNAPSHOT_WARNING_STATUSES: GitBranchCompareSnapshotStatusList = [
  'stale_with_cache',
  'stale_without_cache',
  'no_target',
  'missing',
];

const GIT_BRANCH_COMPARE_SNAPSHOT_EMPTY_STATUSES: GitBranchCompareSnapshotStatusList = [
  'empty',
];

function isGitBranchCompareSnapshotStatusIn(
  status: GitBranchCompareSnapshotStatus,
  statuses: GitBranchCompareSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function isGitBranchCompareStatusValueIn(
  statusValue: GitBranchCompareStatusValue | undefined,
  statuses: GitBranchCompareStatusValueList,
): boolean {
  if (statusValue === undefined) {
    return false;
  }

  for (const candidate of statuses) {
    const matchedStatus = candidate === statusValue;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function getGitBranchCompareStatusValue(
  status: GitBranchCompareStatus | null,
): GitBranchCompareStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  return status.status;
}

function getGitBranchCompareStatusLabel(
  statusValue: GitBranchCompareStatusValue | undefined,
): GitBranchCompareStatusValue | 'unknown' {
  if (statusValue === undefined) {
    return 'unknown';
  }

  return statusValue;
}

function isGitBranchCompareStatusStale(statusValue: GitBranchCompareStatusValue | undefined): boolean {
  return isGitBranchCompareStatusValueIn(statusValue, GIT_BRANCH_COMPARE_STATUS_STALE_VALUES);
}

function hasGitBranchCompare(gitBranchCompare: GitBranchCompare | null): boolean {
  return gitBranchCompare !== null;
}

function getGitBranchCompareBaseBranchValue(gitBranchCompare: GitBranchCompare | null): string {
  if (gitBranchCompare === null) {
    return '';
  }

  return gitBranchCompare.base_branch;
}

function getGitBranchCompareHeadBranchValue(gitBranchCompare: GitBranchCompare | null): string {
  if (gitBranchCompare === null) {
    return '';
  }

  return gitBranchCompare.head_branch;
}

function getGitBranchCompareStatusBaseBranchValue(status: GitBranchCompareStatus | null): string {
  if (status === null) {
    return '';
  }

  return status.baseBranch;
}

function getGitBranchCompareStatusHeadBranchValue(status: GitBranchCompareStatus | null): string {
  if (status === null) {
    return '';
  }

  return status.headBranch;
}

function hasGitBranchCompareBranchValue(branchValue: string): boolean {
  const hasBranchValue = branchValue.length > 0;
  return hasBranchValue === true;
}

function getGitBranchCompareBranchLabel({
  compareBranchValue,
  statusBranchValue,
}: {
  compareBranchValue: string;
  statusBranchValue: string;
}): string {
  const hasCompareBranch = hasGitBranchCompareBranchValue(compareBranchValue);
  if (hasCompareBranch === true) {
    return compareBranchValue;
  }

  const hasStatusBranch = hasGitBranchCompareBranchValue(statusBranchValue);
  if (hasStatusBranch === true) {
    return statusBranchValue;
  }

  return 'unknown';
}

function hasGitBranchCompareTarget({
  compareHeadBranchValue,
  statusHeadBranchValue,
}: {
  compareHeadBranchValue: string;
  statusHeadBranchValue: string;
}): boolean {
  const hasCompareHeadBranch = hasGitBranchCompareBranchValue(compareHeadBranchValue);
  if (hasCompareHeadBranch === true) {
    return true;
  }

  return hasGitBranchCompareBranchValue(statusHeadBranchValue);
}

function getGitBranchCompareCommitsAhead(gitBranchCompare: GitBranchCompare | null): number {
  if (gitBranchCompare === null) {
    return 0;
  }

  return gitBranchCompare.commits_ahead;
}

function getGitBranchCompareFilesChanged(gitBranchCompare: GitBranchCompare | null): number {
  if (gitBranchCompare === null) {
    return 0;
  }

  return gitBranchCompare.files_changed;
}

function getGitBranchCompareAdditions(gitBranchCompare: GitBranchCompare | null): number {
  if (gitBranchCompare === null) {
    return 0;
  }

  return gitBranchCompare.additions;
}

function getGitBranchCompareDeletions(gitBranchCompare: GitBranchCompare | null): number {
  if (gitBranchCompare === null) {
    return 0;
  }

  return gitBranchCompare.deletions;
}

function getGitBranchCompareFilePreview(gitBranchCompare: GitBranchCompare | null): GitBranchCompareFile[] {
  if (gitBranchCompare === null) {
    return [];
  }

  return gitBranchCompare.files;
}

function getGitBranchCompareCommitPreview(
  gitBranchCompare: GitBranchCompare | null,
): GitBranchCompareCommit[] {
  if (gitBranchCompare === null) {
    return [];
  }

  return gitBranchCompare.commits;
}

function hasGitBranchCompareChangedFiles(filesChanged: number): boolean {
  const hasChangedFiles = filesChanged > 0;
  return hasChangedFiles === true;
}

function hasGitBranchCompareAheadCommits(commitsAhead: number): boolean {
  const hasAheadCommits = commitsAhead > 0;
  return hasAheadCommits === true;
}

function hasGitBranchCompareChanges({
  filesChanged,
  commitsAhead,
}: {
  filesChanged: number;
  commitsAhead: number;
}): boolean {
  const hasChangedFiles = hasGitBranchCompareChangedFiles(filesChanged);
  if (hasChangedFiles === true) {
    return true;
  }

  return hasGitBranchCompareAheadCommits(commitsAhead);
}

function getGitBranchCompareHiddenFileCount({
  filesChanged,
  filePreview,
}: {
  filesChanged: number;
  filePreview: GitBranchCompareFile[];
}): number {
  return Math.max(filesChanged - filePreview.length, 0);
}

function getGitBranchCompareHiddenCommitCount({
  commitsAhead,
  commitPreview,
}: {
  commitsAhead: number;
  commitPreview: GitBranchCompareCommit[];
}): number {
  return Math.max(commitsAhead - commitPreview.length, 0);
}

function getGitBranchCompareFilePatchValue(file: GitBranchCompareFile): string {
  return file.content.trim();
}

function hasGitBranchCompareFilePatch(file: GitBranchCompareFile): boolean {
  const filePatchValue = getGitBranchCompareFilePatchValue(file);
  const hasFilePatch = filePatchValue.length > 0;
  return hasFilePatch === true;
}

function getGitBranchCompareFilePatchPreviewCount(filePreview: GitBranchCompareFile[]): number {
  let patchPreviewCount = 0;

  for (const file of filePreview) {
    const hasFilePatch = hasGitBranchCompareFilePatch(file);
    if (hasFilePatch === true) {
      patchPreviewCount += 1;
    }
  }

  return patchPreviewCount;
}

function getGitBranchCompareSnapshotStatus({
  statusValue,
  statusIsStale,
  hasCompare,
  hasCompareChanges,
}: {
  statusValue: GitBranchCompareStatusValue | undefined;
  statusIsStale: boolean;
  hasCompare: boolean;
  hasCompareChanges: boolean;
}): GitBranchCompareSnapshotStatus {
  if (statusValue === 'no_target') {
    return 'no_target';
  }

  if (statusIsStale === true) {
    if (statusValue === 'stale_with_cache') {
      return 'stale_with_cache';
    }

    return 'stale_without_cache';
  }

  if (hasCompare === true) {
    if (hasCompareChanges === true) {
      return 'ready';
    }

    return 'empty';
  }

  return 'missing';
}

function getGitBranchCompareSnapshotSource({
  status,
  hasCompare,
}: {
  status: GitBranchCompareSnapshotStatus;
  hasCompare: boolean;
}): GitBranchCompareSnapshotSource {
  const hasStatusSource = isGitBranchCompareSnapshotStatusIn(status, GIT_BRANCH_COMPARE_SNAPSHOT_STATUS_SOURCE_STATUSES);

  if (hasStatusSource === true) {
    return 'branch_compare_status';
  }

  if (hasCompare === true) {
    return 'branch_compare';
  }

  return 'metadata';
}

function getGitBranchCompareSnapshotMessage(status: GitBranchCompareSnapshotStatus): string {
  switch (status) {
    case 'no_target':
      return '当前没有可对比的目标分支。';
    case 'stale_with_cache':
      return 'Git 分支对比当前显示旧快照。';
    case 'stale_without_cache':
      return 'Git 分支对比当前没有可确认快照。';
    case 'empty':
      return '目标分支相对基准分支没有可见变更。';
    case 'ready':
      return 'Git 分支对比已从后端真源读取。';
    case 'missing':
      return '当前没有可确认的 Git 分支对比。';
  }
}

function getGitBranchCompareSnapshotRecovery(status: GitBranchCompareSnapshotStatus): string {
  switch (status) {
    case 'no_target':
      return '创建或同步第二个分支后再查看对比。';
    case 'stale_with_cache':
      return '刷新 Git 分支列表和分支对比，确认目标分支是否变化。';
    case 'stale_without_cache':
      return '刷新 Git 分支列表，确认是否存在可对比分支。';
    case 'empty':
      return '可继续查看提交历史，后续切换分支前无需处理差异。';
    case 'ready':
      return '切换或合并分支前，可先核对 ahead commits 和文件变更规模。';
    case 'missing':
      return '刷新 Git 分支列表以生成只读分支对比。';
  }
}

export function buildGitBranchCompareSnapshot({
  gitBranchCompare,
  gitBranchCompareStatus,
}: {
  gitBranchCompare: GitBranchCompare | null;
  gitBranchCompareStatus: GitBranchCompareStatus | null;
}): GitBranchCompareSnapshot {
  const statusValue = getGitBranchCompareStatusValue(gitBranchCompareStatus);
  const statusLabel = getGitBranchCompareStatusLabel(statusValue);
  const statusIsStale = isGitBranchCompareStatusStale(statusValue);
  const hasCompare = hasGitBranchCompare(gitBranchCompare);
  const compareBaseBranchValue = getGitBranchCompareBaseBranchValue(gitBranchCompare);
  const compareHeadBranchValue = getGitBranchCompareHeadBranchValue(gitBranchCompare);
  const statusBaseBranchValue = getGitBranchCompareStatusBaseBranchValue(gitBranchCompareStatus);
  const statusHeadBranchValue = getGitBranchCompareStatusHeadBranchValue(gitBranchCompareStatus);
  const hasCompareTarget = hasGitBranchCompareTarget({
    compareHeadBranchValue,
    statusHeadBranchValue,
  });
  const baseBranchLabel = getGitBranchCompareBranchLabel({
    compareBranchValue: compareBaseBranchValue,
    statusBranchValue: statusBaseBranchValue,
  });
  const headBranchLabel = getGitBranchCompareBranchLabel({
    compareBranchValue: compareHeadBranchValue,
    statusBranchValue: statusHeadBranchValue,
  });
  const commitsAhead = getGitBranchCompareCommitsAhead(gitBranchCompare);
  const filesChanged = getGitBranchCompareFilesChanged(gitBranchCompare);
  const additions = getGitBranchCompareAdditions(gitBranchCompare);
  const deletions = getGitBranchCompareDeletions(gitBranchCompare);
  const filePreview = getGitBranchCompareFilePreview(gitBranchCompare);
  const commitPreview = getGitBranchCompareCommitPreview(gitBranchCompare);
  const hasCompareChanges = hasGitBranchCompareChanges({
    filesChanged,
    commitsAhead,
  });
  const hiddenFileCount = getGitBranchCompareHiddenFileCount({
    filesChanged,
    filePreview,
  });
  const hiddenCommitCount = getGitBranchCompareHiddenCommitCount({
    commitsAhead,
    commitPreview,
  });
  const filePatchPreviewCount = getGitBranchCompareFilePatchPreviewCount(filePreview);
  const status = getGitBranchCompareSnapshotStatus({
    statusValue,
    statusIsStale,
    hasCompare,
    hasCompareChanges,
  });
  const source = getGitBranchCompareSnapshotSource({
    status,
    hasCompare,
  });

  return {
    status,
    source,
    baseBranch: baseBranchLabel,
    headBranch: headBranchLabel,
    commitsAhead,
    filesChanged,
    additions,
    deletions,
    filePreview,
    hiddenFileCount,
    filePatchPreviewCount,
    commitPreview,
    hiddenCommitCount,
    hasCompare,
    hasTarget: hasCompareTarget,
    statusValue: statusLabel,
    message: getGitBranchCompareSnapshotMessage(status),
    recovery: getGitBranchCompareSnapshotRecovery(status),
    updatedAt: 'derived',
  };
}

function getGitBranchCompareSnapshotClassName(snapshot: GitBranchCompareSnapshot) {
  const hasWarningStatus = isGitBranchCompareSnapshotStatusIn(snapshot.status, GIT_BRANCH_COMPARE_SNAPSHOT_WARNING_STATUSES);
  const hasEmptyStatus = isGitBranchCompareSnapshotStatusIn(snapshot.status, GIT_BRANCH_COMPARE_SNAPSHOT_EMPTY_STATUSES);

  if (hasWarningStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (hasEmptyStatus === true) {
    return 'border-muted-foreground/20 bg-muted/20 text-muted-foreground';
  }
  return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300';
}

function getGitBranchCompareFilePreviewNodes(filePreview: GitBranchCompareFile[]): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const file of filePreview) {
    const hasFilePatch = hasGitBranchCompareFilePatch(file);
    const isBinaryLabel = getGitSnapshotBooleanLabel(file.is_binary);
    const hasFilePatchLabel = getGitSnapshotBooleanLabel(hasFilePatch);

    nodes.push(
      <div key={file.path} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-current/10 bg-background/50 px-2 py-1">
        <code className="max-w-full truncate rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{file.path}</code>
        <span>Add: {file.additions}</span>
        <span>Del: {file.deletions}</span>
        <span>Binary: {isBinaryLabel}</span>
        <span>Patch: {hasFilePatchLabel}</span>
        {hasFilePatch === true && (
          <pre className="mt-1 max-h-48 w-full overflow-auto rounded bg-muted/60 p-2 font-mono text-[10px] leading-relaxed text-foreground">
            {file.content}
          </pre>
        )}
      </div>,
    );
  }

  return nodes;
}

function getGitBranchCompareCommitPreviewNodes(commitPreview: GitBranchCompareCommit[]): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const commit of commitPreview) {
    const commitMessageLabel = getGitSnapshotLabel(commit.message, 'No commit message');
    const commitAuthorLabel = getGitSnapshotLabel(commit.author, 'unknown author');
    const commitTimeLabel = getGitSnapshotLabel(commit.time, 'unknown time');

    nodes.push(
      <div key={commit.hash} className="rounded border border-current/10 bg-background/50 px-2 py-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{commit.hash}</code>
          <span className="font-medium">{commitMessageLabel}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 opacity-80">
          <span>{commitAuthorLabel}</span>
          <span>{commitTimeLabel}</span>
        </div>
      </div>,
    );
  }

  return nodes;
}

export function GitBranchCompareSnapshotStrip({ snapshot }: { snapshot: GitBranchCompareSnapshot }) {
  const hasCompareLabel = getGitSnapshotBooleanLabel(snapshot.hasCompare);
  const hasTargetLabel = getGitSnapshotBooleanLabel(snapshot.hasTarget);
  const filePreviewNodes = getGitBranchCompareFilePreviewNodes(snapshot.filePreview);
  const commitPreviewNodes = getGitBranchCompareCommitPreviewNodes(snapshot.commitPreview);
  const canRenderFilePreviewNodes = filePreviewNodes.length > 0;
  const canRenderCommitPreviewNodes = commitPreviewNodes.length > 0;
  const hasHiddenFileCount = snapshot.hiddenFileCount > 0;
  const hasHiddenCommitCount = snapshot.hiddenCommitCount > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-branch-compare-snapshot"
      className={cn('mx-3 mt-3 rounded-md border px-2.5 py-2 text-xs', getGitBranchCompareSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Git Branch Compare 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Base: {snapshot.baseBranch}</span>
        <span>Head: {snapshot.headBranch}</span>
        <span>Ahead: {snapshot.commitsAhead}</span>
        <span>Files: {snapshot.filesChanged}</span>
        <span>Add: {snapshot.additions}</span>
        <span>Del: {snapshot.deletions}</span>
        <span>File preview: {snapshot.filePreview.length}</span>
        <span>File patches: {snapshot.filePatchPreviewCount}</span>
        <span>Hidden files: {snapshot.hiddenFileCount}</span>
        <span>Commit preview: {snapshot.commitPreview.length}</span>
        <span>Hidden commits: {snapshot.hiddenCommitCount}</span>
        <span>Compare: {hasCompareLabel}</span>
        <span>Target: {hasTargetLabel}</span>
        <span>Status: {snapshot.statusValue}</span>
      </div>
      {canRenderFilePreviewNodes === true && (
        <div className="mt-2 space-y-1">
          {filePreviewNodes}
          {hasHiddenFileCount === true && (
            <p className="opacity-80">还有 {snapshot.hiddenFileCount} 个 changed files 未在预览中展开。</p>
          )}
        </div>
      )}
      {canRenderCommitPreviewNodes === true && (
        <div className="mt-2 space-y-1">
          {commitPreviewNodes}
          {hasHiddenCommitCount === true && (
            <p className="opacity-80">还有 {snapshot.hiddenCommitCount} 个 ahead commits 未在预览中展开。</p>
          )}
        </div>
      )}
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

type GitCommitDetailSnapshotStatusList = readonly GitCommitDetailSnapshotStatus[];
type GitCommitItemSnapshotStatusList = readonly GitCommitItemSnapshotStatus[];

const GIT_COMMIT_DETAIL_SNAPSHOT_WARNING_STATUSES: GitCommitDetailSnapshotStatusList = [
  'stale_detail',
  'metadata_missing',
];

const GIT_COMMIT_DETAIL_SNAPSHOT_EMPTY_STATUSES: GitCommitDetailSnapshotStatusList = [
  'no_selection',
  'diff_empty',
];

const GIT_COMMIT_DETAIL_SNAPSHOT_DIFF_SOURCE_STATUSES: GitCommitDetailSnapshotStatusList = [
  'diff_ready',
  'diff_empty',
];

const GIT_COMMIT_ITEM_SNAPSHOT_WARNING_STATUSES: GitCommitItemSnapshotStatusList = [
  'stale_detail',
  'metadata_missing',
];

const GIT_COMMIT_ITEM_SNAPSHOT_EMPTY_STATUSES: GitCommitItemSnapshotStatusList = [
  'diff_empty',
];

const GIT_COMMIT_ITEM_SNAPSHOT_SELECTED_STATUSES: GitCommitItemSnapshotStatusList = [
  'selected',
];

const GIT_COMMIT_ITEM_SNAPSHOT_DIFF_SOURCE_STATUSES: GitCommitItemSnapshotStatusList = [
  'diff_ready',
  'diff_empty',
];

function isGitCommitDetailSnapshotStatusIn(
  status: GitCommitDetailSnapshotStatus,
  statuses: GitCommitDetailSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function isGitCommitItemSnapshotStatusIn(
  status: GitCommitItemSnapshotStatus,
  statuses: GitCommitItemSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function hasGitCommitSelectedCommit(selectedCommit: GitCommit | null): boolean {
  return selectedCommit !== null;
}

function getGitCommitDetailStatusValue(
  status: GitCommitDetailStatus | null,
): GitCommitDetailStatusValue | undefined {
  if (status === null) {
    return undefined;
  }

  return status.status;
}

function hasGitCommitDetailStaleStatus({
  hasSelectedCommit,
  selectedHashValue,
  gitCommitDetailStatus,
}: {
  hasSelectedCommit: boolean;
  selectedHashValue: string;
  gitCommitDetailStatus: GitCommitDetailStatus | null;
}): boolean {
  if (hasSelectedCommit === false) {
    return false;
  }

  if (gitCommitDetailStatus === null) {
    return false;
  }

  const statusValue = getGitCommitDetailStatusValue(gitCommitDetailStatus);
  if (statusValue !== 'stale_from_cache') {
    return false;
  }

  const detailMatchesSelectedCommit = gitCommitDetailStatus.commitHash === selectedHashValue;
  return detailMatchesSelectedCommit === true;
}

function getGitCommitDetailSelectedDiffFiles(selectedCommit: GitCommit | null): GitDiff[] {
  if (selectedCommit === null) {
    return [];
  }

  const selectedDiffFiles = selectedCommit.diff;
  if (Array.isArray(selectedDiffFiles) === true) {
    return selectedDiffFiles;
  }

  return [];
}

function getGitCommitDetailSelectedHashValue(selectedCommit: GitCommit | null): string {
  if (selectedCommit === null) {
    return '';
  }

  return selectedCommit.hash;
}

function getGitCommitShortHashLabel(hashValue: string, fallback: string): string {
  const hasHashValue = hashValue.length > 0;
  if (hasHashValue === true) {
    return normalizeCommitVersion(hashValue);
  }

  return fallback;
}

function getGitCommitDetailSelectedFileCount(selectedCommit: GitCommit | null): number {
  if (selectedCommit === null) {
    return 0;
  }

  return selectedCommit.files;
}

function getGitCommitDetailSelectedMessageValue(selectedCommit: GitCommit | null): string {
  if (selectedCommit === null) {
    return '';
  }

  return selectedCommit.message;
}

function getGitCommitDetailSelectedAuthorValue(selectedCommit: GitCommit | null): string {
  if (selectedCommit === null) {
    return '';
  }

  return selectedCommit.author;
}

function getGitCommitDetailSelectedEmailValue(selectedCommit: GitCommit | null): string {
  if (selectedCommit === null) {
    return '';
  }

  return selectedCommit.email;
}

function getGitCommitDetailSelectedTimeValue(selectedCommit: GitCommit | null): string {
  if (selectedCommit === null) {
    return '';
  }

  return selectedCommit.time;
}

function getGitCommitDiffLineCount(file: GitDiff): number {
  const hasContent = file.content.length > 0;
  if (hasContent === true) {
    return file.content.split('\n').length;
  }

  return 0;
}

function getGitCommitDetailDiffLineCount(selectedDiffFiles: GitDiff[]): number {
  let total = 0;

  for (const file of selectedDiffFiles) {
    const lineCount = getGitCommitDiffLineCount(file);
    total += lineCount;
  }

  return total;
}

function hasGitCommitTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function hasGitCommitDetailMetadata({
  hasMessage,
  hasAuthor,
  hasEmail,
  hasTime,
}: {
  hasMessage: boolean;
  hasAuthor: boolean;
  hasEmail: boolean;
  hasTime: boolean;
}): boolean {
  if (hasMessage === false) {
    return false;
  }

  if (hasAuthor === false) {
    return false;
  }

  if (hasEmail === false) {
    return false;
  }

  return hasTime === true;
}

function canInspectGitCommitDetailDiff({
  hasSelectedCommit,
  diffFileCount,
  diffLineCount,
}: {
  hasSelectedCommit: boolean;
  diffFileCount: number;
  diffLineCount: number;
}): boolean {
  if (hasSelectedCommit === false) {
    return false;
  }

  const hasDiffFiles = diffFileCount > 0;
  if (hasDiffFiles === false) {
    return false;
  }

  const hasDiffLines = diffLineCount > 0;
  return hasDiffLines === true;
}

function getGitCommitDetailSnapshotStatus({
  hasSelectedCommit,
  hasStaleDetail,
  diffFileCount,
  hasMetadataMissing,
  selectedFileCount,
}: {
  hasSelectedCommit: boolean;
  hasStaleDetail: boolean;
  diffFileCount: number;
  hasMetadataMissing: boolean;
  selectedFileCount: number;
}): GitCommitDetailSnapshotStatus {
  if (hasSelectedCommit === false) {
    return 'no_selection';
  }

  if (hasStaleDetail === true) {
    return 'stale_detail';
  }

  const hasDiffFiles = diffFileCount > 0;
  if (hasDiffFiles === true) {
    return 'diff_ready';
  }

  if (hasMetadataMissing === true) {
    return 'metadata_missing';
  }

  const hasSelectedFiles = selectedFileCount > 0;
  if (hasSelectedFiles === false) {
    return 'diff_empty';
  }

  return 'ready';
}

function getGitCommitDetailSnapshotSource(status: GitCommitDetailSnapshotStatus): GitCommitDetailSnapshotSource {
  if (status === 'no_selection') {
    return 'selection';
  }

  if (status === 'stale_detail') {
    return 'detail_status';
  }

  const hasDiffSourceStatus = isGitCommitDetailSnapshotStatusIn(status, GIT_COMMIT_DETAIL_SNAPSHOT_DIFF_SOURCE_STATUSES);
  if (hasDiffSourceStatus === true) {
    return 'diff';
  }

  if (status === 'metadata_missing') {
    return 'metadata';
  }

  return 'commit_detail';
}

function getGitCommitDetailSnapshotMessage(status: GitCommitDetailSnapshotStatus): string {
  switch (status) {
    case 'no_selection':
      return '当前尚未选择 Git 提交。';
    case 'stale_detail':
      return '当前提交详情来自缓存快照。';
    case 'diff_ready':
      return '当前提交详情包含可检查的 diff。';
    case 'diff_empty':
      return '当前提交没有可确认的 diff 详情。';
    case 'metadata_missing':
      return '当前提交详情缺少部分元数据。';
    case 'ready':
      return '当前提交详情已就绪。';
  }
}

function getGitCommitDetailSnapshotRecovery(status: GitCommitDetailSnapshotStatus): string {
  switch (status) {
    case 'no_selection':
      return '从左侧提交历史选择一个提交查看详情。';
    case 'stale_detail':
      return '重新查看该提交，或刷新 Git 列表后确认详情是否仍可用。';
    case 'metadata_missing':
      return '刷新 Git 提交列表，确认提交信息、作者、邮箱和时间是否完整。';
    case 'diff_empty':
      return '确认该提交是否没有 diff 详情，必要时刷新提交列表。';
    case 'diff_ready':
    case 'ready':
      return '可继续检查提交元数据与 diff 文件。';
  }
}

function hasGitCommitItemStaleDetail({
  isSelected,
  commitHash,
  gitCommitDetailStatus,
}: {
  isSelected: boolean;
  commitHash: string;
  gitCommitDetailStatus: GitCommitDetailStatus | null;
}): boolean {
  if (isSelected === false) {
    return false;
  }

  if (gitCommitDetailStatus === null) {
    return false;
  }

  const statusValue = getGitCommitDetailStatusValue(gitCommitDetailStatus);
  if (statusValue !== 'stale_from_cache') {
    return false;
  }

  const detailMatchesCommit = gitCommitDetailStatus.commitHash === commitHash;
  return detailMatchesCommit === true;
}

function getGitCommitItemDiffFileCount(commit: GitCommit): number {
  const diffFiles = commit.diff;
  if (Array.isArray(diffFiles) === true) {
    return diffFiles.length;
  }

  return 0;
}

function hasGitCommitItemMetadata({
  hasMessage,
  hasAuthor,
  hasTime,
}: {
  hasMessage: boolean;
  hasAuthor: boolean;
  hasTime: boolean;
}): boolean {
  if (hasMessage === false) {
    return false;
  }

  if (hasAuthor === false) {
    return false;
  }

  return hasTime === true;
}

function canViewGitCommitItem(commit: GitCommit): boolean {
  return hasGitCommitTextValue(commit.hash);
}

function getGitCommitItemSnapshotStatus({
  hasStaleDetail,
  isSelected,
  diffFileCount,
  hasMetadataMissing,
  fileCount,
}: {
  hasStaleDetail: boolean;
  isSelected: boolean;
  diffFileCount: number;
  hasMetadataMissing: boolean;
  fileCount: number;
}): GitCommitItemSnapshotStatus {
  if (hasStaleDetail === true) {
    return 'stale_detail';
  }

  if (isSelected === true) {
    return 'selected';
  }

  const hasDiffFiles = diffFileCount > 0;
  if (hasDiffFiles === true) {
    return 'diff_ready';
  }

  if (hasMetadataMissing === true) {
    return 'metadata_missing';
  }

  const hasFiles = fileCount > 0;
  if (hasFiles === false) {
    return 'diff_empty';
  }

  return 'ready';
}

function getGitCommitItemSnapshotSource(status: GitCommitItemSnapshotStatus): GitCommitItemSnapshotSource {
  if (status === 'stale_detail') {
    return 'detail_status';
  }

  if (status === 'selected') {
    return 'selection';
  }

  const hasDiffSourceStatus = isGitCommitItemSnapshotStatusIn(status, GIT_COMMIT_ITEM_SNAPSHOT_DIFF_SOURCE_STATUSES);
  if (hasDiffSourceStatus === true) {
    return 'diff';
  }

  if (status === 'metadata_missing') {
    return 'metadata';
  }

  return 'commit_item';
}

function getGitCommitItemSnapshotMessage(status: GitCommitItemSnapshotStatus): string {
  switch (status) {
    case 'stale_detail':
      return '该提交详情来自缓存快照。';
    case 'selected':
      return '该提交当前已选中。';
    case 'diff_ready':
      return '该提交带有可展开的 diff 详情。';
    case 'diff_empty':
      return '该提交没有可确认的 diff 详情。';
    case 'metadata_missing':
      return '该提交缺少部分元数据。';
    case 'ready':
      return '该提交条目可查看。';
  }
}

function getGitCommitItemSnapshotRecovery(status: GitCommitItemSnapshotStatus): string {
  switch (status) {
    case 'stale_detail':
      return '重新查看该提交，或刷新 Git 列表确认详情是否仍可用。';
    case 'metadata_missing':
      return '刷新 Git 提交列表，确认 hash、作者、时间和提交信息是否完整。';
    case 'diff_empty':
      return '查看提交详情或刷新 Git 列表确认该提交是否没有 diff。';
    case 'selected':
    case 'diff_ready':
    case 'ready':
      return '点击该提交可查看详情。';
  }
}

export function buildGitCommitDetailSnapshot({
  selectedCommit,
  gitCommitDetailStatus,
}: {
  selectedCommit: GitCommit | null;
  gitCommitDetailStatus: GitCommitDetailStatus | null;
}): GitCommitDetailSnapshot {
  const hasSelectedCommit = hasGitCommitSelectedCommit(selectedCommit);
  const selectedHashValue = getGitCommitDetailSelectedHashValue(selectedCommit);
  const hasStaleDetail = hasGitCommitDetailStaleStatus({
    hasSelectedCommit,
    selectedHashValue,
    gitCommitDetailStatus,
  });
  const selectedDiffFiles = getGitCommitDetailSelectedDiffFiles(selectedCommit);
  const selectedHashLabel = getGitSnapshotLabel(selectedHashValue, 'none');
  const selectedShortHashLabel = getGitCommitShortHashLabel(selectedHashValue, 'none');
  const selectedFileCount = getGitCommitDetailSelectedFileCount(selectedCommit);
  const selectedMessageValue = getGitCommitDetailSelectedMessageValue(selectedCommit);
  const selectedAuthorValue = getGitCommitDetailSelectedAuthorValue(selectedCommit);
  const selectedEmailValue = getGitCommitDetailSelectedEmailValue(selectedCommit);
  const selectedTimeValue = getGitCommitDetailSelectedTimeValue(selectedCommit);
  const diffFileCount = selectedDiffFiles.length;
  const diffLineCount = getGitCommitDetailDiffLineCount(selectedDiffFiles);
  const hasMessage = hasGitCommitTextValue(selectedMessageValue);
  const hasAuthor = hasGitCommitTextValue(selectedAuthorValue);
  const hasEmail = hasGitCommitTextValue(selectedEmailValue);
  const hasTime = hasGitCommitTextValue(selectedTimeValue);
  const hasMetadata = hasGitCommitDetailMetadata({
    hasMessage,
    hasAuthor,
    hasEmail,
    hasTime,
  });
  const hasMetadataMissing = hasMetadata === false;
  const canInspectDiff = canInspectGitCommitDetailDiff({
    hasSelectedCommit,
    diffFileCount,
    diffLineCount,
  });
  const status = getGitCommitDetailSnapshotStatus({
    hasSelectedCommit,
    hasStaleDetail,
    diffFileCount,
    hasMetadataMissing,
    selectedFileCount,
  });
  const source = getGitCommitDetailSnapshotSource(status);

  return {
    status,
    source,
    hash: selectedHashLabel,
    shortHash: selectedShortHashLabel,
    fileCount: selectedFileCount,
    diffFileCount,
    diffLineCount,
    hasMessage,
    hasAuthor,
    hasEmail,
    hasTime,
    hasStaleDetail,
    canInspectDiff,
    message: getGitCommitDetailSnapshotMessage(status),
    recovery: getGitCommitDetailSnapshotRecovery(status),
    updatedAt: 'derived',
  };
}

function getGitCommitDetailSnapshotClassName(snapshot: GitCommitDetailSnapshot) {
  const hasWarningStatus = isGitCommitDetailSnapshotStatusIn(snapshot.status, GIT_COMMIT_DETAIL_SNAPSHOT_WARNING_STATUSES);
  const hasEmptyStatus = isGitCommitDetailSnapshotStatusIn(snapshot.status, GIT_COMMIT_DETAIL_SNAPSHOT_EMPTY_STATUSES);

  if (hasWarningStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (hasEmptyStatus === true) {
    return 'border-muted-foreground/20 bg-muted/20 text-muted-foreground';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

export function GitCommitDetailSnapshotStrip({ snapshot }: { snapshot: GitCommitDetailSnapshot }) {
  const hasMessageLabel = getGitSnapshotBooleanLabel(snapshot.hasMessage);
  const hasAuthorLabel = getGitSnapshotBooleanLabel(snapshot.hasAuthor);
  const hasEmailLabel = getGitSnapshotBooleanLabel(snapshot.hasEmail);
  const hasTimeLabel = getGitSnapshotBooleanLabel(snapshot.hasTime);
  const hasStaleDetailLabel = getGitSnapshotBooleanLabel(snapshot.hasStaleDetail);
  const canInspectDiffLabel = getGitSnapshotBooleanLabel(snapshot.canInspectDiff);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-commit-detail-snapshot"
      className={cn('rounded-md border px-2.5 py-2 text-xs', getGitCommitDetailSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Git Commit Detail 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Hash: {snapshot.shortHash}</span>
        <span>Files: {snapshot.fileCount}</span>
        <span>Diffs: {snapshot.diffFileCount}</span>
        <span>Lines: {snapshot.diffLineCount}</span>
        <span>Message: {hasMessageLabel}</span>
        <span>Author: {hasAuthorLabel}</span>
        <span>Email: {hasEmailLabel}</span>
        <span>Time: {hasTimeLabel}</span>
        <span>StaleDetail: {hasStaleDetailLabel}</span>
        <span>InspectDiff: {canInspectDiffLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

function getGitCommitFileRestoreConfirmationSnapshotAction(
  confirmation: GitCommitFileRestoreConfirmation | null,
): GitCommitFileRestoreConfirmationSnapshotAction {
  if (confirmation === null) {
    return 'none';
  }

  if (confirmation.action === 'restore') {
    return 'restore';
  }

  return 'none';
}

function getGitCommitFileRestoreConfirmationShortHash(commitHash: string | null): string {
  if (commitHash === null) {
    return 'none';
  }

  return normalizeCommitVersion(commitHash);
}

function getGitCommitFileRestoreConfirmationSnapshotStatus({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): GitCommitFileRestoreConfirmationSnapshotStatus {
  if (hasConfirmation === false) {
    return 'closed';
  }

  if (isConfirming === true) {
    return 'confirming';
  }

  return 'awaiting_confirmation';
}

function getGitCommitFileRestoreConfirmationSnapshotSource(
  action: GitCommitFileRestoreConfirmationSnapshotAction,
): GitCommitFileRestoreConfirmationSnapshotSource {
  if (action === 'restore') {
    return 'commit_file_restore';
  }

  return 'dialog_state';
}

function canConfirmGitCommitFileRestoreConfirmationSnapshot({
  hasConfirmation,
  hasCommit,
  hasFilePath,
  isConfirming,
}: {
  hasConfirmation: boolean;
  hasCommit: boolean;
  hasFilePath: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (hasCommit === false) {
    return false;
  }

  if (hasFilePath === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function canCancelGitCommitFileRestoreConfirmationSnapshot({
  hasConfirmation,
  isConfirming,
}: {
  hasConfirmation: boolean;
  isConfirming: boolean;
}): boolean {
  if (hasConfirmation === false) {
    return false;
  }

  if (isConfirming === true) {
    return false;
  }

  return true;
}

function getGitCommitFileRestoreConfirmationSnapshotRiskLevel(): GitCommitFileRestoreConfirmationRiskLevel {
  return 'high';
}

function getGitCommitFileRestoreConfirmationSnapshotMessage(
  status: GitCommitFileRestoreConfirmationSnapshotStatus,
): string {
  if (status === 'closed') {
    return 'Git commit file restore 确认弹窗未打开。';
  }

  if (status === 'confirming') {
    return 'Git commit file restore 正在提交，确认与取消入口暂时锁定。';
  }

  return 'Git commit file restore 确认已打开，等待用户确认 guarded checkout 单文件恢复。';
}

function getGitCommitFileRestoreConfirmationSnapshotRecovery(hasConfirmation: boolean): string {
  if (hasConfirmation === true) {
    return '取消不会恢复历史文件；确认后后端仍会复核 commit、路径和目标文件 dirty 状态，只对目标文件执行 guarded checkout，不会 reset、merge、切换分支或修改非目标文件。';
  }

  return '触发恢复此文件后会显示确认边界。';
}

export function buildGitCommitFileRestoreConfirmationSnapshot({
  confirmation,
  isConfirming,
}: {
  confirmation: GitCommitFileRestoreConfirmation | null;
  isConfirming: boolean;
}): GitCommitFileRestoreConfirmationSnapshot {
  const hasConfirmation = confirmation !== null;
  const action = getGitCommitFileRestoreConfirmationSnapshotAction(confirmation);
  const commitHash = getGitSnapshotTrimmedValue(confirmation?.commit.hash);
  const filePath = getGitSnapshotTrimmedValue(confirmation?.filePath);
  const hasCommit = hasGitSnapshotTextValue(commitHash);
  const hasFilePath = hasGitSnapshotTextValue(filePath);
  const shortHash = getGitCommitFileRestoreConfirmationShortHash(commitHash);
  const status = getGitCommitFileRestoreConfirmationSnapshotStatus({
    hasConfirmation,
    isConfirming,
  });
  const source = getGitCommitFileRestoreConfirmationSnapshotSource(action);
  const canConfirm = canConfirmGitCommitFileRestoreConfirmationSnapshot({
    hasConfirmation,
    hasCommit,
    hasFilePath,
    isConfirming,
  });
  const canCancel = canCancelGitCommitFileRestoreConfirmationSnapshot({
    hasConfirmation,
    isConfirming,
  });
  const riskLevel = getGitCommitFileRestoreConfirmationSnapshotRiskLevel();
  const message = getGitCommitFileRestoreConfirmationSnapshotMessage(status);
  const recovery = getGitCommitFileRestoreConfirmationSnapshotRecovery(hasConfirmation);

  return {
    status,
    source,
    action,
    commitHash,
    shortHash,
    filePath,
    hasCommit,
    hasFilePath,
    canConfirm,
    canCancel,
    riskLevel,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getGitCommitFileRestoreConfirmationSnapshotClassName(snapshot: GitCommitFileRestoreConfirmationSnapshot) {
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-border bg-background/70 text-muted-foreground';
}

export function GitCommitFileRestoreConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: GitCommitFileRestoreConfirmationSnapshot;
}) {
  const filePathLabel = getGitSnapshotLabel(snapshot.filePath, 'none');
  const hasCommitLabel = getGitSnapshotBooleanLabel(snapshot.hasCommit);
  const hasFilePathLabel = getGitSnapshotBooleanLabel(snapshot.hasFilePath);
  const canConfirmLabel = getGitSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getGitSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-commit-file-restore-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getGitCommitFileRestoreConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Git commit file restore 确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Commit: {snapshot.shortHash}</span>
        <span>Path: {filePathLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>HasCommit: {hasCommitLabel}</span>
        <span>HasPath: {hasFilePathLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function buildGitCommitItemSnapshot({
  commit,
  index,
  isSelected,
  gitCommitDetailStatus,
}: {
  commit: GitCommit;
  index: number;
  isSelected: boolean;
  gitCommitDetailStatus: GitCommitDetailStatus | null;
}): GitCommitItemSnapshot {
  const hasStaleDetail = hasGitCommitItemStaleDetail({
    isSelected,
    commitHash: commit.hash,
    gitCommitDetailStatus,
  });
  const diffFileCount = getGitCommitItemDiffFileCount(commit);
  const commitHashLabel = getGitSnapshotLabel(commit.hash, 'unknown');
  const commitShortHashLabel = getGitCommitShortHashLabel(commit.hash, 'unknown');
  const hasMessage = hasGitCommitTextValue(commit.message);
  const hasAuthor = hasGitCommitTextValue(commit.author);
  const hasTime = hasGitCommitTextValue(commit.time);
  const hasMetadata = hasGitCommitItemMetadata({
    hasMessage,
    hasAuthor,
    hasTime,
  });
  const hasMetadataMissing = hasMetadata === false;
  const canView = canViewGitCommitItem(commit);
  const status = getGitCommitItemSnapshotStatus({
    hasStaleDetail,
    isSelected,
    diffFileCount,
    hasMetadataMissing,
    fileCount: commit.files,
  });
  const source = getGitCommitItemSnapshotSource(status);

  return {
    status,
    source,
    hash: commitHashLabel,
    shortHash: commitShortHashLabel,
    index,
    fileCount: commit.files,
    diffFileCount,
    hasMessage,
    hasAuthor,
    hasTime,
    isSelected,
    hasStaleDetail,
    canView,
    message: getGitCommitItemSnapshotMessage(status),
    recovery: getGitCommitItemSnapshotRecovery(status),
    updatedAt: 'derived',
  };
}

function getGitCommitItemSnapshotClassName(snapshot: GitCommitItemSnapshot) {
  const hasWarningStatus = isGitCommitItemSnapshotStatusIn(snapshot.status, GIT_COMMIT_ITEM_SNAPSHOT_WARNING_STATUSES);
  const hasEmptyStatus = isGitCommitItemSnapshotStatusIn(snapshot.status, GIT_COMMIT_ITEM_SNAPSHOT_EMPTY_STATUSES);
  const hasSelectedStatus = isGitCommitItemSnapshotStatusIn(snapshot.status, GIT_COMMIT_ITEM_SNAPSHOT_SELECTED_STATUSES);

  if (hasWarningStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (hasEmptyStatus === true) {
    return 'border-muted-foreground/20 bg-muted/20 text-muted-foreground';
  }
  if (hasSelectedStatus === true) {
    return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

export function GitCommitItemSnapshotStrip({ snapshot }: { snapshot: GitCommitItemSnapshot }) {
  const isSelectedLabel = getGitSnapshotBooleanLabel(snapshot.isSelected);
  const hasStaleDetailLabel = getGitSnapshotBooleanLabel(snapshot.hasStaleDetail);
  const hasMessageLabel = getGitSnapshotBooleanLabel(snapshot.hasMessage);
  const hasAuthorLabel = getGitSnapshotBooleanLabel(snapshot.hasAuthor);
  const hasTimeLabel = getGitSnapshotBooleanLabel(snapshot.hasTime);
  const canViewLabel = getGitSnapshotBooleanLabel(snapshot.canView);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-commit-item-snapshot"
      className={cn('mt-2 rounded-md border px-2.5 py-2 text-xs', getGitCommitItemSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Git Commit Item 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Hash: {snapshot.shortHash}</span>
        <span>Index: {snapshot.index}</span>
        <span>Files: {snapshot.fileCount}</span>
        <span>Diffs: {snapshot.diffFileCount}</span>
        <span>Selected: {isSelectedLabel}</span>
        <span>StaleDetail: {hasStaleDetailLabel}</span>
        <span>Message: {hasMessageLabel}</span>
        <span>Author: {hasAuthorLabel}</span>
        <span>Time: {hasTimeLabel}</span>
        <span>View: {canViewLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

type GitDiffFileItemSnapshotStatusList = readonly GitDiffFileItemSnapshotStatus[];

const GIT_DIFF_FILE_ITEM_SNAPSHOT_WARNING_STATUSES: GitDiffFileItemSnapshotStatusList = [
  'path_missing',
  'empty_diff',
];

const GIT_DIFF_FILE_ITEM_SNAPSHOT_INFO_STATUSES: GitDiffFileItemSnapshotStatusList = [
  'metadata_only',
];

function isGitDiffFileItemSnapshotStatusIn(
  status: GitDiffFileItemSnapshotStatus,
  statuses: GitDiffFileItemSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function hasGitDiffFileItemPath(file: GitDiff): boolean {
  const hasPath = file.path.length > 0;
  return hasPath === true;
}

function getGitDiffFileItemPathLabel(file: GitDiff): string {
  return getGitSnapshotLabel(file.path, 'unknown');
}

function hasGitDiffFileItemContent(file: GitDiff): boolean {
  const hasContent = file.content.length > 0;
  return hasContent === true;
}

function getGitDiffFileItemLineCount(file: GitDiff): number {
  const hasContent = hasGitDiffFileItemContent(file);
  if (hasContent === true) {
    return file.content.split('\n').length;
  }

  return 0;
}

function hasGitDiffFileItemAdditions(file: GitDiff): boolean {
  const hasAdditions = file.additions > 0;
  return hasAdditions === true;
}

function hasGitDiffFileItemDeletions(file: GitDiff): boolean {
  const hasDeletions = file.deletions > 0;
  return hasDeletions === true;
}

function hasGitDiffFileItemMixedChanges({
  hasAdditions,
  hasDeletions,
}: {
  hasAdditions: boolean;
  hasDeletions: boolean;
}): boolean {
  if (hasAdditions === false) {
    return false;
  }

  return hasDeletions === true;
}

function canExpandGitDiffFileItem({
  hasPath,
  lineCount,
}: {
  hasPath: boolean;
  lineCount: number;
}): boolean {
  if (hasPath === false) {
    return false;
  }

  const hasLines = lineCount > 0;
  return hasLines === true;
}

function getGitDiffFileItemSnapshotStatus({
  hasPath,
  lineCount,
  hasMixedChanges,
  hasAdditions,
  hasDeletions,
}: {
  hasPath: boolean;
  lineCount: number;
  hasMixedChanges: boolean;
  hasAdditions: boolean;
  hasDeletions: boolean;
}): GitDiffFileItemSnapshotStatus {
  if (hasPath === false) {
    return 'path_missing';
  }

  if (lineCount === 0) {
    return 'empty_diff';
  }

  if (hasMixedChanges === true) {
    return 'mixed_changes';
  }

  if (hasAdditions === true) {
    return 'added_only';
  }

  if (hasDeletions === true) {
    return 'deleted_only';
  }

  return 'metadata_only';
}

function getGitDiffFileItemSnapshotSource(
  status: GitDiffFileItemSnapshotStatus,
): GitDiffFileItemSnapshotSource {
  if (status === 'path_missing') {
    return 'metadata';
  }

  if (status === 'empty_diff') {
    return 'diff_content';
  }

  if (status === 'metadata_only') {
    return 'diff_file';
  }

  return 'diff_stats';
}

function getGitDiffFileItemSnapshotMessage(status: GitDiffFileItemSnapshotStatus): string {
  if (status === 'path_missing') {
    return '该 diff 文件缺少路径。';
  }

  if (status === 'empty_diff') {
    return '该 diff 文件没有可展示内容。';
  }

  if (status === 'mixed_changes') {
    return '该 diff 文件同时包含新增和删除。';
  }

  if (status === 'added_only') {
    return '该 diff 文件仅包含新增。';
  }

  if (status === 'deleted_only') {
    return '该 diff 文件仅包含删除。';
  }

  return '该 diff 文件只有元数据变化。';
}

function getGitDiffFileItemSnapshotRecovery(status: GitDiffFileItemSnapshotStatus): string {
  const hasWarningStatus = isGitDiffFileItemSnapshotStatusIn(
    status,
    GIT_DIFF_FILE_ITEM_SNAPSHOT_WARNING_STATUSES,
  );
  if (hasWarningStatus === true) {
    return '刷新 Git 提交详情，确认后端是否返回完整 diff 文件信息。';
  }

  return '可展开查看该文件 diff 内容。';
}

export function buildGitDiffFileItemSnapshot({
  file,
  index,
}: {
  file: GitDiff;
  index: number;
}): GitDiffFileItemSnapshot {
  const hasPath = hasGitDiffFileItemPath(file);
  const filePathLabel = getGitDiffFileItemPathLabel(file);
  const hasContent = hasGitDiffFileItemContent(file);
  const lineCount = getGitDiffFileItemLineCount(file);
  const hasAdditions = hasGitDiffFileItemAdditions(file);
  const hasDeletions = hasGitDiffFileItemDeletions(file);
  const hasMixedChanges = hasGitDiffFileItemMixedChanges({
    hasAdditions,
    hasDeletions,
  });
  const canExpand = canExpandGitDiffFileItem({
    hasPath,
    lineCount,
  });
  const status = getGitDiffFileItemSnapshotStatus({
    hasPath,
    lineCount,
    hasMixedChanges,
    hasAdditions,
    hasDeletions,
  });
  const source = getGitDiffFileItemSnapshotSource(status);

  return {
    status,
    source,
    path: filePathLabel,
    index,
    additions: file.additions,
    deletions: file.deletions,
    lineCount,
    hasPath,
    hasContent,
    hasAdditions,
    hasDeletions,
    canExpand,
    message: getGitDiffFileItemSnapshotMessage(status),
    recovery: getGitDiffFileItemSnapshotRecovery(status),
    updatedAt: 'derived',
  };
}

function getGitDiffFileItemSnapshotClassName(snapshot: GitDiffFileItemSnapshot) {
  const hasWarningStatus = isGitDiffFileItemSnapshotStatusIn(
    snapshot.status,
    GIT_DIFF_FILE_ITEM_SNAPSHOT_WARNING_STATUSES,
  );
  const hasInfoStatus = isGitDiffFileItemSnapshotStatusIn(
    snapshot.status,
    GIT_DIFF_FILE_ITEM_SNAPSHOT_INFO_STATUSES,
  );

  if (hasWarningStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (hasInfoStatus === true) {
    return 'border-muted-foreground/20 bg-muted/20 text-muted-foreground';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

export function GitDiffFileItemSnapshotStrip({ snapshot }: { snapshot: GitDiffFileItemSnapshot }) {
  const hasPathLabel = getGitSnapshotBooleanLabel(snapshot.hasPath);
  const hasContentLabel = getGitSnapshotBooleanLabel(snapshot.hasContent);
  const hasAdditionsLabel = getGitSnapshotBooleanLabel(snapshot.hasAdditions);
  const hasDeletionsLabel = getGitSnapshotBooleanLabel(snapshot.hasDeletions);
  const canExpandLabel = getGitSnapshotBooleanLabel(snapshot.canExpand);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-git-diff-file-item-snapshot"
      className={cn('mt-2 rounded-md border px-2.5 py-2 text-xs', getGitDiffFileItemSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Git Diff File Item 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Path: {snapshot.path}</span>
        <span>Index: {snapshot.index}</span>
        <span>Add: {snapshot.additions}</span>
        <span>Del: {snapshot.deletions}</span>
        <span>Lines: {snapshot.lineCount}</span>
        <span>PathOk: {hasPathLabel}</span>
        <span>Content: {hasContentLabel}</span>
        <span>HasAdd: {hasAdditionsLabel}</span>
        <span>HasDel: {hasDeletionsLabel}</span>
        <span>Expand: {canExpandLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}
