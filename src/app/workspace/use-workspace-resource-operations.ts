import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { projectApi } from '@/lib/api';
import type { ProjectFileWriteResponse, ProjectRuntimeStatus } from '@/lib/api';
import type { CollaborationEvent } from '@/lib/collaboration-api';
import type { GitBranch, GitBranchCompareFileApplyResult, GitBranchCreateFromRemoteResult, GitBranchCreateResult, GitBranchDeleteResult, GitBranchRenameResult, GitBranchSwitchReadiness, GitBranchSwitchResult, GitCommit, GitCommitFileRestoreResult, GitRemoteBranch, GitRemoteBranchRefreshResult, GitStash, GitStashApplyResult, GitStashCreateResult, GitTag, GitTagCreateResult, GitTagDeleteResult, GitWorktreeCommitResult, GitWorktreeFileDiscardResult, GitWorktreeStatus } from '@/lib/types';
import { appendWorkspaceDebugEvent } from '@/lib/workspace/workspace-debug-events';
import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceWorkflowStatus,
} from '@/lib/workspace/engineering-state';
import {
  type CommitRestoreSyncStage,
  formatWorkspaceFileWriteSkippedCommitNotice,
  formatWorkspaceResourceOperationFailure,
  formatWorkspaceResourceStructuredStatusError,
  getCommitRestoreSyncStageLabel,
  resolveCommitRestoreSyncStageFromError,
  runCommitRestoreSyncStage,
} from '@/lib/workspace/workspace-resource-operation-errors';

import type {
  EditorBufferStatus,
  GitCommitDetailStatus,
  GuidanceAction,
  WorkspaceChatMessage,
  WorkspaceOpenFilePathList,
  WorkspaceProjectInfo,
} from './workspace-types';
import {
  buildCommitRestoreStaleGitCommitDetailStatus,
  buildFreshGitCommitDetailStatus,
  buildViewCommitCacheFallbackGitCommitDetailStatus,
} from './workspace-git-status';
import {
  buildDirtyEditorBufferStatus,
  buildFileReadEditorBufferStatus,
  buildFileSaveEditorBufferStatus,
} from './workspace-editor-buffer-status';
import {
  getWorkspaceEditorBufferContent,
  hasWorkspaceEditorBufferContent,
} from './workspace-editor-buffer-content';
import type { WorkspaceResourceOperationsContract } from './workspace-resource-operations-contract';
import type { WorkspaceRuntimeStatusSnapshotOptions } from './workspace-runtime-resources-contract';
import { appTypeNeedsRuntime } from './workspace-page-helpers';

export type WorkspaceResourceOperationCompletedTask = string;
export type WorkspaceResourceOperationCompletedTaskList = WorkspaceResourceOperationCompletedTask[];
export type WorkspaceResourceOperationCompletedSyncTask = string;
export type WorkspaceResourceOperationCompletedSyncTaskList = WorkspaceResourceOperationCompletedSyncTask[];
export type WorkspaceResourceOperationFailure = string;
export type WorkspaceResourceOperationFailureList = WorkspaceResourceOperationFailure[];
type WorkspaceResourceOperationSavePromise = Promise<boolean>;
type WorkspaceResourceOperationSavePromiseMap = Map<string, WorkspaceResourceOperationSavePromise>;
type WorkspaceResourceOperationQueuedSaveContentMap = Map<string, string>;
type WorkspaceResourceOperationErrorLike = {
  code?: unknown;
  reasonCode?: unknown;
  source?: unknown;
  details?: unknown;
  message?: unknown;
};
type WorkspaceFileSaveFailureReasonCode =
  | 'file_save_failed_dirty_buffer_retained'
  | 'file_save_backend_unreachable_dirty_buffer_retained';

function hasWorkspaceResourceOperationPathValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function hasWorkspaceResourceOperationTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function isWorkspaceResourceOperationErrorLike(error: unknown): error is WorkspaceResourceOperationErrorLike {
  return typeof error === 'object' && error !== null;
}

function getWorkspaceResourceOperationErrorText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.toLowerCase();
}

function hasWorkspaceResourceOperationBackendUnreachableText(value: string): boolean {
  if (value.includes('backend_unreachable')) {
    return true;
  }

  if (value.includes('fetch failed')) {
    return true;
  }

  if (value.includes('connection refused')) {
    return true;
  }

  return value.includes('econnrefused');
}

function isWorkspaceResourceOperationBackendUnreachable(error: unknown): boolean {
  if (isWorkspaceResourceOperationErrorLike(error) === false) {
    return false;
  }

  const reasonCode = getWorkspaceResourceOperationErrorText(error.reasonCode);
  if (reasonCode === 'backend_unreachable') {
    return true;
  }

  const source = getWorkspaceResourceOperationErrorText(error.source);
  if (source !== 'next_api_proxy') {
    return false;
  }

  const details = getWorkspaceResourceOperationErrorText(error.details);
  if (hasWorkspaceResourceOperationBackendUnreachableText(details) === true) {
    return true;
  }

  const message = getWorkspaceResourceOperationErrorText(error.message);
  return hasWorkspaceResourceOperationBackendUnreachableText(message);
}

function isWorkspaceResourceOperationRevisionConflict(error: unknown): boolean {
  if (isWorkspaceResourceOperationErrorLike(error) === false) {
    return false;
  }

  return error.code === 409 || error.reasonCode === 'file_revision_conflict';
}

function getFileSaveFailureReasonCode(isBackendUnreachable: boolean): WorkspaceFileSaveFailureReasonCode {
  if (isBackendUnreachable === true) {
    return 'file_save_backend_unreachable_dirty_buffer_retained';
  }

  return 'file_save_failed_dirty_buffer_retained';
}

function getFileSaveFailureStatusContent(isBackendUnreachable: boolean): string {
  if (isBackendUnreachable === true) {
    return '后端不可达，保存未写入';
  }

  return '保存失败，本地修改仍保留';
}

async function getWorkspaceFileContentRevision(content: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getFileSaveFailureMessage({
  filePath,
  failureMessage,
  isBackendUnreachable,
}: {
  filePath: string;
  failureMessage: string;
  isBackendUnreachable: boolean;
}): string {
  if (isBackendUnreachable === true) {
    return `保存文件 \`${filePath}\` 失败：${failureMessage}。后端暂不可达，本地修改仍保留在编辑器和 session snapshot 中，未写入后端文件或 Git 状态；请等待后端恢复后重新保存。`;
  }

  return `保存文件 \`${filePath}\` 失败：${failureMessage}。本地修改仍保留在编辑器中，未更新保存快照或 Git 状态；请修复问题后重新保存。`;
}

function getWorkspaceResourceOperationProjectId(projectInfo: WorkspaceProjectInfo | null): string | null {
  if (projectInfo === null) {
    return null;
  }

  const hasProjectId = hasWorkspaceResourceOperationPathValue(projectInfo.projectId);
  if (hasProjectId === true) {
    return projectInfo.projectId;
  }

  return null;
}

function getWorkspaceResourceOperationBranchHead(branch: GitBranch | undefined): string | null {
  if (branch === undefined) {
    return null;
  }

  const hasLastCommit = hasWorkspaceResourceOperationTextValue(branch.last_commit);
  if (hasLastCommit === true) {
    return branch.last_commit;
  }

  return null;
}

function getWorkspaceResourceOperationPersistedProjectId(projectInfo: WorkspaceProjectInfo | null): string | null {
  if (projectInfo === null) {
    return null;
  }

  const isPersistedProject = projectInfo.isPersisted === true;
  if (isPersistedProject === false) {
    return null;
  }

  return getWorkspaceResourceOperationProjectId(projectInfo);
}

function getWorkspaceResourceOperationResultPath(
  resultPath: string | null | undefined,
  fallbackPath: string,
): string {
  const hasResultPath = hasWorkspaceResourceOperationPathValue(resultPath);
  if (hasResultPath === true) {
    return resultPath;
  }

  return fallbackPath;
}

function hasWorkspaceResourceOperationLastOpenFilePath(value: string | undefined): value is string {
  const hasLastOpenFile = value !== undefined;
  return hasLastOpenFile === true;
}

function getWorkspaceResourceOperationLastOpenFilePath(openFiles: WorkspaceOpenFilePathList): string | null {
  let lastOpenFile: string | undefined;

  for (const openFile of openFiles) {
    lastOpenFile = openFile;
  }

  if (hasWorkspaceResourceOperationLastOpenFilePath(lastOpenFile) === true) {
    return lastOpenFile;
  }

  return null;
}

function getWorkspaceResourceOperationOpenFilesWithoutPath(
  openFiles: WorkspaceOpenFilePathList,
  targetPath: string,
): WorkspaceOpenFilePathList {
  const remainingOpenFiles: WorkspaceOpenFilePathList = [];

  for (const openFile of openFiles) {
    const shouldRemoveOpenFile = openFile === targetPath;
    if (shouldRemoveOpenFile === false) {
      remainingOpenFiles.push(openFile);
    }
  }

  return remainingOpenFiles;
}

function getWorkspaceResourceOperationActiveFileAfterPathRemoval(
  current: string | null,
  nextOpenFiles: WorkspaceOpenFilePathList,
  targetPath: string,
): string | null {
  const shouldMoveActiveFile = current === targetPath;
  if (shouldMoveActiveFile === true) {
    return getWorkspaceResourceOperationLastOpenFilePath(nextOpenFiles);
  }

  return current;
}

function getWorkspaceResourceOperationCommitByHash(
  commits: GitCommit[],
  commitHash: string,
): GitCommit | undefined {
  for (const commit of commits) {
    const matchedCommit = commit.hash === commitHash;
    if (matchedCommit === true) {
      return commit;
    }
  }

  return undefined;
}

function getWorkspaceResourceOperationCurrentBranch(branches: GitBranch[]): GitBranch | undefined {
  for (const branch of branches) {
    if (branch.is_current === true) {
      return branch;
    }
  }

  return undefined;
}

function getWorkspaceResourceOperationRestoredCommitAfterRefresh({
  latestCommits,
  restoreCommit,
}: {
  latestCommits: GitCommit[];
  restoreCommit: GitCommit;
}): GitCommit {
  const refreshedRestoreCommit = getWorkspaceResourceOperationCommitByHash(latestCommits, restoreCommit.hash);
  if (refreshedRestoreCommit !== undefined) {
    return refreshedRestoreCommit;
  }

  return restoreCommit;
}

function hasWorkspaceResourceOperationWorktreeCommitRecordIssue(result: GitWorktreeCommitResult): boolean {
  const isCommitRecordMissing = result.status === 'committed_record_missing';
  if (isCommitRecordMissing === true) {
    return true;
  }

  const isCommitRecordFailed = result.status === 'committed_record_failed';
  return isCommitRecordFailed === true;
}

function hasWorkspaceResourceOperationFileSaveGitRecordIssue(writeResult: ProjectFileWriteResponse): boolean {
  const isCommitRecordMissing = writeResult.commit_status === 'created_record_missing';
  if (isCommitRecordMissing === true) {
    return true;
  }

  const isCommitRecordFailed = writeResult.commit_status === 'created_record_failed';
  return isCommitRecordFailed === true;
}

function getWorkspaceResourceOperationCommitRestoreSyncFailureStage(
  error: unknown,
): CommitRestoreSyncStage | undefined {
  return resolveCommitRestoreSyncStageFromError(error);
}

type UseWorkspaceResourceOperationsOptions = {
  projectInfo: WorkspaceProjectInfo | null;
  activeFile: string | null;
  files: Map<string, string>;
  savedFiles: Map<string, string>;
  mobileEditingFile: string | null;
  isRestoringCommit: boolean;
  pendingRestoreCommit: GitCommit | null;
  refreshProjectFileTree: (
    projectId: string,
    force?: boolean,
    options?: { throwOnFailure?: boolean; suppressNotice?: boolean },
  ) => Promise<void>;
  fetchProjectDetail: (projectId: string) => Promise<void>;
  fetchProjectBranches: (projectId: string, preferredTargetBranch?: string) => Promise<GitBranch[]>;
  fetchProjectRemoteBranches: (projectId: string) => Promise<GitRemoteBranch[]>;
  fetchProjectTags: (projectId: string) => Promise<GitTag[]>;
  fetchProjectStashes: (projectId: string) => Promise<GitStash[]>;
  fetchProjectWorktreeStatus: (
    projectId: string,
    options?: { throwOnFailure?: boolean; suppressNotice?: boolean },
  ) => Promise<GitWorktreeStatus | null>;
  fetchProjectCommits: (
    projectId: string,
    options?: { throwOnFailure?: boolean; suppressNotice?: boolean },
  ) => Promise<GitCommit[]>;
  fetchRuntimeStatusSnapshot: (
    projectId: string,
    fallbackMessage?: string,
    options?: WorkspaceRuntimeStatusSnapshotOptions,
  ) => Promise<ProjectRuntimeStatus | null>;
  requestPreviewReload: () => void;
  setFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setSavedFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setEditorBufferStatuses: Dispatch<SetStateAction<Map<string, EditorBufferStatus>>>;
  setOpenFiles: Dispatch<SetStateAction<WorkspaceOpenFilePathList>>;
  setActiveFile: Dispatch<SetStateAction<string | null>>;
  setMobileEditingFile: Dispatch<SetStateAction<string | null>>;
  setMobileFileContent: Dispatch<SetStateAction<string>>;
  applyResourceFileMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  applyResourceGitMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  setSelectedCommit: Dispatch<SetStateAction<GitCommit | null>>;
  setGitCommitDetailStatus: Dispatch<SetStateAction<GitCommitDetailStatus | null>>;
  setGitBranchSwitchReadiness: Dispatch<SetStateAction<GitBranchSwitchReadiness | null>>;
  setPendingRestoreCommit: Dispatch<SetStateAction<GitCommit | null>>;
  setIsRestoringCommit: Dispatch<SetStateAction<boolean>>;
  openGitView: () => void;
};

function buildCommitRestoreFailureState(
  commit: GitCommit,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `恢复版本 ${commit.hash} 失败`,
      completed_tasks: [],
      blockers: [reasonMessage],
      next_action: '打开 Git 面板检查提交列表，确认目标版本后重新执行恢复。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'commit_restore_failed',
      approval_boundary: 'git_restore',
      current_task: `恢复版本 ${commit.hash} 失败`,
      next_action: '确认目标提交后重新恢复',
    },
    recovery: {
      blocked: true,
      reason_code: 'commit_restore_failed',
      reason_message: reasonMessage,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function getGitBranchSwitchTargetBranchLabel(readiness: GitBranchSwitchReadiness): string {
  const targetBranch = readiness.target_branch;
  const hasTargetBranch = targetBranch.length > 0;
  if (hasTargetBranch === false) {
    return 'unknown';
  }

  return targetBranch;
}

function buildGitBranchSwitchBlockedState(readiness: GitBranchSwitchReadiness): WorkspaceEngineeringStateSnapshot {
  const targetBranchLabel = getGitBranchSwitchTargetBranchLabel(readiness);

  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `切换到分支 ${targetBranchLabel} 被预检阻断`,
      completed_tasks: ['已执行分支切换 readiness guard'],
      blockers: [readiness.message],
      next_action: readiness.recovery,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_switch_blocked',
      approval_boundary: 'git_branch_switch',
      current_task: `切换到分支 ${targetBranchLabel} 被预检阻断`,
      next_action: readiness.recovery,
    },
    recovery: {
      blocked: true,
      reason_code: `git_branch_switch_${readiness.status}`,
      reason_message: readiness.message,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchSwitchFailureState(
  targetBranch: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `切换到分支 ${targetBranch} 失败`,
      completed_tasks: [],
      blockers: [reasonMessage],
      next_action: '重新刷新分支列表和 readiness guard 后再尝试切换。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_switch_failed',
      approval_boundary: 'git_branch_switch',
      current_task: `切换到分支 ${targetBranch} 失败`,
      next_action: '确认分支状态后重新切换',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_branch_switch_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchSwitchSuccessState(result: GitBranchSwitchResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已切换到分支 ${result.current_branch}`,
      completed_tasks: [
        'Git 分支已切换',
        '项目详情已同步',
        'Explorer 文件树已同步',
        'Git 分支列表已同步',
        'Git 提交列表已同步',
        '编辑器缓存已清理',
      ],
      blockers: [],
      next_action: '继续基于目标分支编辑或查看 Git 面板确认状态。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: true,
      awaiting_confirmation: false,
      current_task: `已切换到分支 ${result.current_branch}`,
      next_action: '继续编辑目标分支',
    },
  };
}

function buildGitBranchSwitchPostSyncFailureState(
  result: GitBranchSwitchResult,
  reasonMessage: string,
  completedSyncTasks: WorkspaceResourceOperationCompletedSyncTaskList,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已切换到分支 ${result.current_branch}，但资源同步失败`,
      completed_tasks: ['Git 分支已切换', '编辑器缓存已清理', ...completedSyncTasks],
      blockers: [reasonMessage],
      next_action: '刷新 Explorer 与 Git 面板，确认当前分支资源真源后再继续编辑。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_switch_post_sync_failed',
      approval_boundary: 'git_branch_switch_sync',
      current_task: `分支 ${result.current_branch} 的资源同步失败`,
      next_action: '重新刷新 Explorer 与 Git 面板',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_branch_switch_post_sync_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchCreateFailureState(
  branchName: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `创建 Git 分支 ${branchName} 失败`,
      completed_tasks: [],
      blockers: [reasonMessage],
      next_action: '确认分支名合法且刷新分支列表后，重新创建本地分支。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_create_failed',
      approval_boundary: 'git_branch_create',
      current_task: `创建 Git 分支 ${branchName} 失败`,
      next_action: '确认分支名后重新创建',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_branch_create_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchCreateBlockedState(result: GitBranchCreateResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `创建 Git 分支 ${result.name} 被 guard 阻断`,
      completed_tasks: ['已检查目标分支是否已存在'],
      blockers: [result.message],
      next_action: result.recovery,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_create_blocked',
      approval_boundary: 'git_branch_create',
      current_task: `创建 Git 分支 ${result.name} 被 guard 阻断`,
      next_action: result.recovery,
    },
    recovery: {
      blocked: true,
      reason_code: 'git_branch_create_blocked',
      reason_message: result.message,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function getGitBranchCreateFromBranchLabel(result: GitBranchCreateResult): string {
  const fromBranch = result.from_branch;
  const hasFromBranch = fromBranch.length > 0;
  if (hasFromBranch === false) {
    return 'HEAD';
  }

  return fromBranch;
}

function buildGitBranchCreateSuccessState(result: GitBranchCreateResult): WorkspaceEngineeringStateSnapshot {
  const fromBranchLabel = getGitBranchCreateFromBranchLabel(result);

  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已创建 Git 分支 ${result.name}`,
      completed_tasks: [
        'Git 本地分支已创建',
        'Git 分支列表已同步',
        '新分支已设为对比目标',
      ],
      blockers: [],
      next_action: '如需进入新分支，请等待 readiness guard 通过后显式执行分支切换。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: true,
      awaiting_confirmation: false,
      current_task: `已创建 Git 分支 ${result.name}`,
      next_action: '检查分支对比和切换预检结果',
    },
    recovery: {
      blocked: false,
      reason_code: 'git_branch_create_completed',
      reason_message: `分支 ${result.name} 已从 ${fromBranchLabel} 创建`,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchCreatePostSyncFailureState(
  result: GitBranchCreateResult,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已创建 Git 分支 ${result.name}，但分支列表同步失败`,
      completed_tasks: ['Git 本地分支已创建'],
      blockers: [reasonMessage],
      next_action: '重新刷新 Git 分支列表，确认新分支已出现在后端真源中。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_create_post_sync_failed',
      approval_boundary: 'git_branch_create_sync',
      current_task: `分支 ${result.name} 创建后的列表同步失败`,
      next_action: '重新刷新 Git 分支列表',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_branch_create_post_sync_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitTagCreateFailureState(
  tagName: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `创建 Git 标签 ${tagName} 失败`,
      completed_tasks: [],
      blockers: [reasonMessage],
      next_action: '确认标签名合法且刷新标签列表后，重新创建本地标签。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_tag_create_failed',
      approval_boundary: 'git_tag_create',
      current_task: `创建 Git 标签 ${tagName} 失败`,
      next_action: '确认标签名后重新创建',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_tag_create_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitTagCreateBlockedState(result: GitTagCreateResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `创建 Git 标签 ${result.name} 被 guard 阻断`,
      completed_tasks: ['已检查目标标签是否已存在'],
      blockers: [result.message],
      next_action: result.recovery,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_tag_create_blocked',
      approval_boundary: 'git_tag_create',
      current_task: `创建 Git 标签 ${result.name} 被 guard 阻断`,
      next_action: result.recovery,
    },
    recovery: {
      blocked: true,
      reason_code: 'git_tag_create_blocked',
      reason_message: result.message,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function getGitTagCreateCurrentBranchLabel(result: GitTagCreateResult): string {
  const currentBranch = result.current_branch;
  const hasCurrentBranch = currentBranch.length > 0;
  if (hasCurrentBranch === false) {
    return 'HEAD';
  }

  return currentBranch;
}

function getGitTagCreateTargetCommitLabel(result: GitTagCreateResult): string {
  const targetCommit = result.target_commit;
  const hasTargetCommit = targetCommit.length > 0;
  if (hasTargetCommit === false) {
    return 'unknown';
  }

  return targetCommit;
}

function getGitTagCreateReasonTargetLabel(result: GitTagCreateResult): string {
  const targetCommit = result.target_commit;
  const hasTargetCommit = targetCommit.length > 0;
  if (hasTargetCommit === false) {
    return 'HEAD';
  }

  return targetCommit;
}

function buildGitTagCreateSuccessState(result: GitTagCreateResult): WorkspaceEngineeringStateSnapshot {
  const targetCommitLabel = getGitTagCreateReasonTargetLabel(result);

  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已创建 Git 标签 ${result.name}`,
      completed_tasks: [
        'Git 本地标签已创建',
        'Git 标签列表已同步',
        '未创建提交或修改工作区文件',
      ],
      blockers: [],
      next_action: '继续基于标签列表确认版本锚点；如需发布标签，应在受控远端写入能力补齐后执行。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: true,
      awaiting_confirmation: false,
      current_task: `已创建 Git 标签 ${result.name}`,
      next_action: '继续查看 Git 标签和提交历史',
    },
    recovery: {
      blocked: false,
      reason_code: 'git_tag_create_completed',
      reason_message: `标签 ${result.name} 已指向 ${targetCommitLabel}`,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitTagCreatePostSyncFailureState(
  result: GitTagCreateResult,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已创建 Git 标签 ${result.name}，但标签列表同步失败`,
      completed_tasks: ['Git 本地标签已创建', '未创建提交或修改工作区文件'],
      blockers: [reasonMessage],
      next_action: '重新刷新 Git 标签列表，确认新标签已出现在后端真源中。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_tag_create_post_sync_failed',
      approval_boundary: 'git_tag_create_sync',
      current_task: `标签 ${result.name} 创建后的列表同步失败`,
      next_action: '重新刷新 Git 标签列表',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_tag_create_post_sync_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitTagDeleteFailureState(
  tagName: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `删除 Git 标签 ${tagName} 失败`,
      completed_tasks: [],
      blockers: [reasonMessage],
      next_action: '刷新 Git 标签列表，确认目标标签仍存在后重新执行本地标签删除。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_tag_delete_failed',
      approval_boundary: 'git_tag_delete',
      current_task: `删除 Git 标签 ${tagName} 失败`,
      next_action: '确认标签真源后重新删除',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_tag_delete_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitTagDeleteBlockedState(result: GitTagDeleteResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `删除 Git 标签 ${result.name} 被 guard 阻断`,
      completed_tasks: ['已检查目标标签是否存在'],
      blockers: [result.message],
      next_action: result.recovery,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_tag_delete_blocked',
      approval_boundary: 'git_tag_delete',
      current_task: `删除 Git 标签 ${result.name} 被 guard 阻断`,
      next_action: result.recovery,
    },
    recovery: {
      blocked: true,
      reason_code: 'git_tag_delete_blocked',
      reason_message: result.message,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function getGitTagDeleteTargetCommitLabel(result: GitTagDeleteResult): string {
  const targetCommit = result.target_commit;
  const hasTargetCommit = targetCommit.length > 0;
  if (hasTargetCommit === false) {
    return 'unknown';
  }

  return targetCommit;
}

function buildGitTagDeleteSuccessState(result: GitTagDeleteResult): WorkspaceEngineeringStateSnapshot {
  const targetCommitLabel = getGitTagDeleteTargetCommitLabel(result);

  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已删除 Git 标签 ${result.name}`,
      completed_tasks: [
        'Git 本地标签已删除',
        'Git 标签列表已同步',
        '未 checkout、push 或修改工作区文件',
      ],
      blockers: [],
      next_action: '继续基于标签列表确认版本锚点；远端标签删除仍需等待受控远端写入能力。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: true,
      awaiting_confirmation: false,
      current_task: `已删除 Git 标签 ${result.name}`,
      next_action: '继续查看 Git 标签和提交历史',
    },
    recovery: {
      blocked: false,
      reason_code: 'git_tag_delete_completed',
      reason_message: `标签 ${result.name} 已从本地删除，原目标为 ${targetCommitLabel}`,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitTagDeletePostSyncFailureState(
  result: GitTagDeleteResult,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已删除 Git 标签 ${result.name}，但标签列表同步失败`,
      completed_tasks: ['Git 本地标签已删除', '未 checkout、push 或修改工作区文件'],
      blockers: [reasonMessage],
      next_action: '重新刷新 Git 标签列表，确认目标标签已从本地真源中消失。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_tag_delete_post_sync_failed',
      approval_boundary: 'git_tag_delete_sync',
      current_task: `标签 ${result.name} 删除后的列表同步失败`,
      next_action: '重新刷新 Git 标签列表',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_tag_delete_post_sync_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchCreateFromRemoteFailureState(
  remoteBranch: string,
  branchName: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `从远端引用 ${remoteBranch} 创建本地分支 ${branchName} 失败`,
      completed_tasks: [],
      blockers: [reasonMessage],
      next_action: '刷新远端分支列表和本地分支列表，确认 remote ref 与目标本地分支名后重新创建。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_create_from_remote_failed',
      approval_boundary: 'git_branch_create_from_remote',
      current_task: `从远端引用 ${remoteBranch} 创建本地分支 ${branchName} 失败`,
      next_action: '确认 remote ref 和分支名后重新创建',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_branch_create_from_remote_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchCreateFromRemoteBlockedState(result: GitBranchCreateFromRemoteResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `从远端引用 ${result.remote_branch} 创建本地分支 ${result.name} 被 guard 阻断`,
      completed_tasks: ['已检查本地已有 remote ref 与目标本地分支占用状态'],
      blockers: [result.message],
      next_action: result.recovery,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_create_from_remote_blocked',
      approval_boundary: 'git_branch_create_from_remote',
      current_task: `从远端引用 ${result.remote_branch} 创建本地分支 ${result.name} 被 guard 阻断`,
      next_action: result.recovery,
    },
    recovery: {
      blocked: true,
      reason_code: 'git_branch_create_from_remote_blocked',
      reason_message: result.message,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchCreateFromRemoteSuccessState(result: GitBranchCreateFromRemoteResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已从远端引用 ${result.remote_branch} 创建本地分支 ${result.name}`,
      completed_tasks: [
        '已确认本地 remote ref 存在',
        'Git 本地跟踪分支已创建',
        'Git 分支列表已同步',
        '新分支已设为对比目标',
      ],
      blockers: [],
      next_action: '如需进入新分支，请等待 readiness guard 通过后显式执行分支切换。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: true,
      awaiting_confirmation: false,
      current_task: `已从远端引用 ${result.remote_branch} 创建本地分支 ${result.name}`,
      next_action: '检查分支对比和切换预检结果',
    },
    recovery: {
      blocked: false,
      reason_code: 'git_branch_create_from_remote_completed',
      reason_message: `分支 ${result.name} 已从本地已有远端引用 ${result.remote_branch} 创建`,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchCreateFromRemotePostSyncFailureState(
  result: GitBranchCreateFromRemoteResult,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已从远端引用 ${result.remote_branch} 创建本地分支 ${result.name}，但分支列表同步失败`,
      completed_tasks: ['Git 本地跟踪分支已创建'],
      blockers: [reasonMessage],
      next_action: '重新刷新 Git 分支列表，确认新分支已出现在后端真源中。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_create_from_remote_post_sync_failed',
      approval_boundary: 'git_branch_create_from_remote_sync',
      current_task: `从远端引用创建分支 ${result.name} 后的列表同步失败`,
      next_action: '重新刷新 Git 分支列表',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_branch_create_from_remote_post_sync_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitRemoteBranchRefreshFailureState(
  remote: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `刷新 Git remote ${remote} 的远端引用失败`,
      completed_tasks: [],
      blockers: [reasonMessage],
      next_action: '确认 remote 名称、网络和凭据后重新执行远端引用刷新。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_remote_branch_refresh_failed',
      approval_boundary: 'git_remote_branch_refresh',
      current_task: `刷新 Git remote ${remote} 的远端引用失败`,
      next_action: '确认 remote 配置后重新刷新',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_remote_branch_refresh_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitRemoteBranchRefreshBlockedState(result: GitRemoteBranchRefreshResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `刷新 Git remote ${result.remote} 的远端引用被 guard 阻断`,
      completed_tasks: ['已检查 remote 配置并尝试受控刷新'],
      blockers: [result.message],
      next_action: result.recovery,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_remote_branch_refresh_blocked',
      approval_boundary: 'git_remote_branch_refresh',
      current_task: `刷新 Git remote ${result.remote} 的远端引用被 guard 阻断`,
      next_action: result.recovery,
    },
    recovery: {
      blocked: true,
      reason_code: 'git_remote_branch_refresh_blocked',
      reason_message: result.message,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitRemoteBranchRefreshSuccessState(result: GitRemoteBranchRefreshResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `Git remote ${result.remote} 的远端引用已刷新`,
      completed_tasks: [
        '已确认 remote 存在',
        '已执行受控 git fetch',
        '远端分支列表已重新同步',
      ],
      blockers: [],
      next_action: '继续查看远端分支列表，或从已有 remote ref 创建本地跟踪分支。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: true,
      awaiting_confirmation: false,
      current_task: `Git remote ${result.remote} 的远端引用已刷新`,
      next_action: '查看远端分支列表',
    },
    recovery: {
      blocked: false,
      reason_code: 'git_remote_branch_refresh_completed',
      reason_message: `remote ${result.remote} 的远端引用已刷新并重新同步列表`,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitRemoteBranchRefreshPostSyncFailureState(
  result: GitRemoteBranchRefreshResult,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `Git remote ${result.remote} 已刷新，但远端分支列表同步失败`,
      completed_tasks: ['已执行受控 git fetch'],
      blockers: [reasonMessage],
      next_action: '重新刷新远端分支列表，确认 Git 面板已读取最新 remote refs。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_remote_branch_refresh_post_sync_failed',
      approval_boundary: 'git_remote_branch_refresh_sync',
      current_task: `Git remote ${result.remote} 刷新后的远端分支列表同步失败`,
      next_action: '重新刷新 Git 远端分支列表',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_remote_branch_refresh_post_sync_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchDeleteFailureState(
  branchName: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `删除 Git 分支 ${branchName} 失败`,
      completed_tasks: [],
      blockers: [reasonMessage],
      next_action: '刷新分支列表，确认目标分支存在且不是当前分支后重新删除。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_delete_failed',
      approval_boundary: 'git_branch_delete',
      current_task: `删除 Git 分支 ${branchName} 失败`,
      next_action: '确认分支状态后重新删除',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_branch_delete_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchDeleteBlockedState(result: GitBranchDeleteResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `删除 Git 分支 ${result.name} 被 guard 阻断`,
      completed_tasks: ['已确认目标分支删除边界'],
      blockers: [result.message],
      next_action: result.recovery,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_delete_blocked',
      approval_boundary: 'git_branch_delete',
      current_task: `删除 Git 分支 ${result.name} 被 guard 阻断`,
      next_action: result.recovery,
    },
    recovery: {
      blocked: true,
      reason_code: 'git_branch_delete_blocked',
      reason_message: result.message,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function getGitBranchDeleteCurrentBranchLabel(result: GitBranchDeleteResult): string {
  const currentBranch = result.current_branch;
  const hasCurrentBranch = currentBranch.length > 0;
  if (hasCurrentBranch === false) {
    return 'unknown';
  }

  return currentBranch;
}

function buildGitBranchDeleteSuccessState(result: GitBranchDeleteResult): WorkspaceEngineeringStateSnapshot {
  const currentBranchLabel = getGitBranchDeleteCurrentBranchLabel(result);

  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已删除 Git 分支 ${result.name}`,
      completed_tasks: [
        'Git 本地分支已删除',
        'Git 分支列表已同步',
        '分支对比和切换预检目标已刷新',
      ],
      blockers: [],
      next_action: '继续基于当前分支编辑，或重新选择其他分支作为对比目标。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: true,
      awaiting_confirmation: false,
      current_task: `已删除 Git 分支 ${result.name}`,
      next_action: '检查分支列表和对比目标',
    },
    recovery: {
      blocked: false,
      reason_code: 'git_branch_delete_completed',
      reason_message: `分支 ${result.name} 已删除，当前分支仍为 ${currentBranchLabel}`,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchDeletePostSyncFailureState(
  result: GitBranchDeleteResult,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已删除 Git 分支 ${result.name}，但分支列表同步失败`,
      completed_tasks: ['Git 本地分支已删除'],
      blockers: [reasonMessage],
      next_action: '重新刷新 Git 分支列表，确认已删除分支不再出现在后端真源中。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_delete_post_sync_failed',
      approval_boundary: 'git_branch_delete_sync',
      current_task: `分支 ${result.name} 删除后的列表同步失败`,
      next_action: '重新刷新 Git 分支列表',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_branch_delete_post_sync_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchRenameFailureState(
  previousName: string,
  nextName: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `重命名 Git 分支 ${previousName} 失败`,
      completed_tasks: [],
      blockers: [reasonMessage],
      next_action: '刷新分支列表，确认源分支存在且新分支名未占用后重新重命名。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_rename_failed',
      approval_boundary: 'git_branch_rename',
      current_task: `重命名 Git 分支 ${previousName} 为 ${nextName} 失败`,
      next_action: '确认分支状态后重新重命名',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_branch_rename_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchRenameBlockedState(result: GitBranchRenameResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `重命名 Git 分支 ${result.previous_name} 被 guard 阻断`,
      completed_tasks: ['已确认源分支与目标分支边界'],
      blockers: [result.message],
      next_action: result.recovery,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_rename_blocked',
      approval_boundary: 'git_branch_rename',
      current_task: `重命名 Git 分支 ${result.previous_name} 被 guard 阻断`,
      next_action: result.recovery,
    },
    recovery: {
      blocked: true,
      reason_code: 'git_branch_rename_blocked',
      reason_message: result.message,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function getGitBranchRenameCurrentBranchLabel(result: GitBranchRenameResult): string {
  const currentBranch = result.current_branch;
  const hasCurrentBranch = currentBranch.length > 0;
  if (hasCurrentBranch === false) {
    return 'unknown';
  }

  return currentBranch;
}

function buildGitBranchRenameSuccessState(result: GitBranchRenameResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已重命名 Git 分支 ${result.previous_name}`,
      completed_tasks: [
        'Git 本地分支已重命名',
        'Git 分支列表已同步',
        '新分支名已设为对比目标',
      ],
      blockers: [],
      next_action: '继续查看分支对比和切换预检；进入该分支仍需显式通过 readiness guard。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: true,
      awaiting_confirmation: false,
      current_task: `已重命名 Git 分支 ${result.previous_name} 为 ${result.name}`,
      next_action: '检查分支对比和切换预检结果',
    },
    recovery: {
      blocked: false,
      reason_code: 'git_branch_rename_completed',
      reason_message: `分支 ${result.previous_name} 已重命名为 ${result.name}`,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitBranchRenamePostSyncFailureState(
  result: GitBranchRenameResult,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已重命名 Git 分支 ${result.previous_name}，但分支列表同步失败`,
      completed_tasks: ['Git 本地分支已重命名'],
      blockers: [reasonMessage],
      next_action: '重新刷新 Git 分支列表，确认新分支名已出现在后端真源中。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_branch_rename_post_sync_failed',
      approval_boundary: 'git_branch_rename_sync',
      current_task: `分支 ${result.previous_name} 重命名后的列表同步失败`,
      next_action: '重新刷新 Git 分支列表',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_branch_rename_post_sync_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildCommitRestoreSuccessState(commit: GitCommit): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `已恢复到版本 ${commit.hash}`,
      completed_tasks: [
        '项目详情已同步',
        'Explorer 文件树已同步',
        'Git 提交列表已同步',
        '编辑器缓存已清理',
      ],
      blockers: [],
      next_action: '在 Git 面板确认当前版本，或从 Explorer 重新打开文件继续编辑。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `已恢复到版本 ${commit.hash}`,
      next_action: '确认当前版本后继续编辑或运行验证。',
    },
    recovery: {
      blocked: false,
      reason_code: 'commit_restore_completed',
      reason_message: `工作区已恢复到版本 ${commit.hash}`,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildCommitRestorePostSyncFailureState(
  commit: GitCommit,
  stage: CommitRestoreSyncStage,
  reasonMessage: string,
  completedTasks: WorkspaceResourceOperationCompletedTaskList,
): WorkspaceEngineeringStateSnapshot {
  const stageLabel = getCommitRestoreSyncStageLabel(stage);
  let phaseNextAction = '重新刷新 Explorer 校准恢复后的文件树真源，再从 Explorer 重新打开文件。';
  let executionNextAction = '刷新 Explorer，确认工作区是否已展示目标版本文件树。';
  if (stage === 'commit_list') {
    phaseNextAction = '打开 Git 面板确认提交列表真源；必要时重新刷新 Explorer 校准恢复后的文件树。';
    executionNextAction = '打开 Git 面板确认当前提交列表是否已同步。';
  }
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `版本 ${commit.hash} 已恢复，但${stageLabel}失败`,
      completed_tasks: [
        '目标版本恢复请求已执行',
        '本地编辑器缓存已清理，避免展示恢复前内容',
        ...completedTasks,
      ],
      blockers: [`${stageLabel}失败：${reasonMessage}`],
      next_action: phaseNextAction,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `版本 ${commit.hash} 恢复后的${stageLabel}失败`,
      next_action: executionNextAction,
    },
    recovery: {
      blocked: false,
      reason_code: `commit_restore_${stage}_sync_failed_after_restore`,
      reason_message: `${stageLabel}失败：${reasonMessage}`,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildCommitFileRestoreFailureState(
  commit: GitCommit,
  filePath: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `恢复版本 ${commit.hash} 的文件 ${filePath} 失败`,
      completed_tasks: [],
      blockers: [reasonMessage],
      next_action: '打开 Git 面板确认提交详情和目标文件路径后重新执行单文件恢复。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'commit_file_restore_failed',
      approval_boundary: 'git_restore',
      current_task: `恢复文件 ${filePath} 失败`,
      next_action: '确认目标文件后重新恢复',
    },
    recovery: {
      blocked: true,
      reason_code: 'commit_file_restore_failed',
      reason_message: reasonMessage,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildCommitFileRestoreBlockedState(result: GitCommitFileRestoreResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `恢复文件 ${result.path} 被 guard 阻断`,
      completed_tasks: ['已检查目标文件 dirty 状态'],
      blockers: [result.message],
      next_action: result.recovery,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'commit_file_restore_failed',
      approval_boundary: 'git_restore',
      current_task: `恢复文件 ${result.path} 被 guard 阻断`,
      next_action: result.recovery,
    },
    recovery: {
      blocked: true,
      reason_code: 'commit_file_restore_blocked',
      reason_message: result.message,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildCommitFileRestoreSuccessState(
  result: GitCommitFileRestoreResult,
  completedTasks: WorkspaceResourceOperationCompletedTaskList,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `已从版本 ${result.hash} 恢复文件 ${result.path}`,
      completed_tasks: [
        '目标文件已恢复',
        '目标文件编辑器缓存已清理',
        ...completedTasks,
      ],
      blockers: [],
      next_action: '从 Explorer 重新打开该文件确认内容，或在 Git 面板查看恢复快照。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `已恢复文件 ${result.path}`,
      next_action: '重新打开文件确认内容',
    },
    recovery: {
      blocked: false,
      reason_code: 'commit_file_restore_completed',
      reason_message: `文件 ${result.path} 已从版本 ${result.hash} 恢复`,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildCommitFileRestorePostSyncFailureState(
  result: GitCommitFileRestoreResult,
  reasonMessage: string,
  completedTasks: WorkspaceResourceOperationCompletedTaskList,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `文件 ${result.path} 已恢复，但资源同步失败`,
      completed_tasks: [
        '目标文件恢复请求已执行',
        '目标文件编辑器缓存已清理',
        ...completedTasks,
      ],
      blockers: [reasonMessage],
      next_action: '刷新 Explorer 与 Git 面板，确认该文件和恢复快照真源后再继续编辑。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'commit_file_restore_failed',
      approval_boundary: 'git_restore',
      current_task: `文件 ${result.path} 恢复后的资源同步失败`,
      next_action: '重新刷新 Explorer 与 Git 面板',
    },
    recovery: {
      blocked: true,
      reason_code: 'commit_file_restore_post_sync_failed',
      reason_message: reasonMessage,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildWorktreeFileDiscardFailureState(
  filePath: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `丢弃 worktree 文件 ${filePath} 失败`,
      completed_tasks: [],
      blockers: [reasonMessage],
      next_action: '打开 Git 面板重新确认 worktree dirty 文件后再执行单文件丢弃。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'worktree_file_discard_failed',
      approval_boundary: 'git_restore',
      current_task: `丢弃 worktree 文件 ${filePath} 失败`,
      next_action: '确认 dirty 文件后重新丢弃',
    },
    recovery: {
      blocked: true,
      reason_code: 'worktree_file_discard_failed',
      reason_message: reasonMessage,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildWorktreeFileDiscardBlockedState(result: GitWorktreeFileDiscardResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `丢弃 worktree 文件 ${result.path} 被 guard 阻断`,
      completed_tasks: ['已检查目标路径 dirty 状态'],
      blockers: [result.message],
      next_action: result.recovery,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'worktree_file_discard_blocked',
      approval_boundary: 'git_restore',
      current_task: `丢弃 worktree 文件 ${result.path} 被 guard 阻断`,
      next_action: result.recovery,
    },
    recovery: {
      blocked: true,
      reason_code: 'worktree_file_discard_blocked',
      reason_message: result.message,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildWorktreeFileDiscardSuccessState(
  result: GitWorktreeFileDiscardResult,
  completedTasks: WorkspaceResourceOperationCompletedTaskList,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `已丢弃 worktree 文件 ${result.path} 的本地变更`,
      completed_tasks: [
        '目标文件 worktree 变更已丢弃',
        '目标文件编辑器缓存已清理',
        ...completedTasks,
      ],
      blockers: [],
      next_action: '从 Explorer 重新打开该文件确认内容，或刷新 Git 面板确认 worktree 状态。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `已丢弃 ${result.path} 的 worktree 变更`,
      next_action: '重新打开文件确认内容',
    },
    recovery: {
      blocked: false,
      reason_code: 'worktree_file_discard_completed',
      reason_message: `文件 ${result.path} 的 worktree 变更已丢弃`,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildWorktreeFileDiscardPostSyncFailureState(
  result: GitWorktreeFileDiscardResult,
  reasonMessage: string,
  completedTasks: WorkspaceResourceOperationCompletedTaskList,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `文件 ${result.path} 变更已丢弃，但资源同步失败`,
      completed_tasks: [
        '目标文件 worktree 变更丢弃请求已执行',
        '目标文件编辑器缓存已清理',
        ...completedTasks,
      ],
      blockers: [reasonMessage],
      next_action: '刷新 Explorer 与 Git 面板，确认文件真源和 worktree 状态后再继续编辑。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'worktree_file_discard_post_sync_failed',
      approval_boundary: 'git_restore',
      current_task: `文件 ${result.path} 丢弃后的资源同步失败`,
      next_action: '重新刷新 Explorer 与 Git 面板',
    },
    recovery: {
      blocked: true,
      reason_code: 'worktree_file_discard_post_sync_failed',
      reason_message: reasonMessage,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildBranchCompareFileApplyFailureState(
  baseBranch: string,
  headBranch: string,
  filePath: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `从分支 ${headBranch} 引入文件 ${filePath} 失败`,
      completed_tasks: [`已确认基准分支 ${baseBranch}`],
      blockers: [reasonMessage],
      next_action: '打开 Git 面板重新确认分支对比和目标文件后再执行引入。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'branch_compare_file_apply_failed',
      approval_boundary: 'git_restore',
      current_task: `引入文件 ${filePath} 失败`,
      next_action: '确认分支对比后重新引入',
    },
    recovery: {
      blocked: true,
      reason_code: 'branch_compare_file_apply_failed',
      reason_message: reasonMessage,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildBranchCompareFileApplyBlockedState(result: GitBranchCompareFileApplyResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `从分支 ${result.head_branch} 引入文件 ${result.path} 被 guard 阻断`,
      completed_tasks: ['已检查当前分支与目标文件 dirty 状态'],
      blockers: [result.message],
      next_action: result.recovery,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'branch_compare_file_apply_blocked',
      approval_boundary: 'git_restore',
      current_task: `引入文件 ${result.path} 被 guard 阻断`,
      next_action: result.recovery,
    },
    recovery: {
      blocked: true,
      reason_code: 'branch_compare_file_apply_blocked',
      reason_message: result.message,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildBranchCompareFileApplySuccessState(
  result: GitBranchCompareFileApplyResult,
  completedTasks: WorkspaceResourceOperationCompletedTaskList,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `已从分支 ${result.head_branch} 引入文件 ${result.path}`,
      completed_tasks: [
        '目标分支文件已引入当前工作区',
        '目标文件编辑器缓存已清理',
        ...completedTasks,
      ],
      blockers: [],
      next_action: '从 Explorer 重新打开该文件确认内容，或在 Git 面板查看引入快照。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `已引入文件 ${result.path}`,
      next_action: '重新打开文件确认内容',
    },
    recovery: {
      blocked: false,
      reason_code: 'branch_compare_file_apply_completed',
      reason_message: `文件 ${result.path} 已从分支 ${result.head_branch} 引入`,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildBranchCompareFileApplyPostSyncFailureState(
  result: GitBranchCompareFileApplyResult,
  reasonMessage: string,
  completedTasks: WorkspaceResourceOperationCompletedTaskList,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `文件 ${result.path} 已引入，但资源同步失败`,
      completed_tasks: [
        '目标分支文件引入请求已执行',
        '目标文件编辑器缓存已清理',
        ...completedTasks,
      ],
      blockers: [reasonMessage],
      next_action: '刷新 Explorer 与 Git 面板，确认该文件、分支对比和引入快照真源后再继续编辑。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'branch_compare_file_apply_post_sync_failed',
      approval_boundary: 'git_restore',
      current_task: `文件 ${result.path} 引入后的资源同步失败`,
      next_action: '重新刷新 Explorer 与 Git 面板',
    },
    recovery: {
      blocked: true,
      reason_code: 'branch_compare_file_apply_post_sync_failed',
      reason_message: reasonMessage,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitStashApplyFailureState(
  stashRef: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `应用 stash ${stashRef} 失败`,
      completed_tasks: [],
      blockers: [reasonMessage],
      next_action: '打开 Git 面板重新确认 stash 列表、worktree 状态和目标 stash ref 后再执行应用。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_stash_apply_failed',
      approval_boundary: 'git_restore',
      current_task: `应用 stash ${stashRef} 失败`,
      next_action: '确认 stash 与 worktree 状态后重新应用',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_stash_apply_failed',
      reason_message: reasonMessage,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitStashApplyBlockedState(result: GitStashApplyResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `应用 stash ${result.ref} 被 guard 阻断`,
      completed_tasks: ['已检查 worktree dirty 状态和 stash patch 可应用性'],
      blockers: [result.message],
      next_action: result.recovery,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_stash_apply_blocked',
      approval_boundary: 'git_restore',
      current_task: `应用 stash ${result.ref} 被 guard 阻断`,
      next_action: result.recovery,
    },
    recovery: {
      blocked: true,
      reason_code: 'git_stash_apply_blocked',
      reason_message: result.message,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitStashApplySuccessState(
  result: GitStashApplyResult,
  completedTasks: WorkspaceResourceOperationCompletedTaskList,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `已应用 stash ${result.ref}`,
      completed_tasks: [
        'stash 已受控应用到当前工作区',
        '编辑器缓存已清理',
        ...completedTasks,
      ],
      blockers: [],
      next_action: '从 Explorer 重新打开受影响文件确认内容，或在 Git 面板查看应用快照。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `已应用 stash ${result.ref}`,
      next_action: '重新打开受影响文件确认内容',
    },
    recovery: {
      blocked: false,
      reason_code: 'git_stash_apply_completed',
      reason_message: `stash ${result.ref} 已应用并保留 stash 记录`,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitStashApplyPostSyncFailureState(
  result: GitStashApplyResult,
  reasonMessage: string,
  completedTasks: WorkspaceResourceOperationCompletedTaskList,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `stash ${result.ref} 已应用，但资源同步失败`,
      completed_tasks: [
        'stash apply 请求已执行',
        '编辑器缓存已清理',
        ...completedTasks,
      ],
      blockers: [reasonMessage],
      next_action: '刷新 Explorer 与 Git 面板，确认 worktree、stash 列表和应用快照真源后再继续编辑。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_stash_apply_post_sync_failed',
      approval_boundary: 'git_restore',
      current_task: `stash ${result.ref} 应用后的资源同步失败`,
      next_action: '重新刷新 Explorer 与 Git 面板',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_stash_apply_post_sync_failed',
      reason_message: reasonMessage,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitStashCreateFailureState(
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: '创建 stash 失败',
      completed_tasks: [],
      blockers: [reasonMessage],
      next_action: '打开 Git 面板重新确认 worktree dirty 状态后再创建 stash。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_stash_create_failed',
      approval_boundary: 'git_restore',
      current_task: '创建 stash 失败',
      next_action: '确认 worktree 状态后重新创建 stash',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_stash_create_failed',
      reason_message: reasonMessage,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitStashCreateBlockedState(result: GitStashCreateResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: '创建 stash 被 guard 阻断',
      completed_tasks: ['已检查 worktree dirty 状态'],
      blockers: [result.message],
      next_action: result.recovery,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_stash_create_blocked',
      approval_boundary: 'git_restore',
      current_task: '创建 stash 被 guard 阻断',
      next_action: result.recovery,
    },
    recovery: {
      blocked: true,
      reason_code: 'git_stash_create_blocked',
      reason_message: result.message,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitStashCreateSuccessState(
  result: GitStashCreateResult,
  completedTasks: WorkspaceResourceOperationCompletedTaskList,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `已创建 stash ${result.ref}`,
      completed_tasks: [
        'worktree dirty 变更已保存为 stash',
        '编辑器缓存已清理',
        ...completedTasks,
      ],
      blockers: [],
      next_action: '从 Explorer 重新打开文件确认当前 worktree 内容，或在 Git 面板查看 stash 列表。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `已创建 stash ${result.ref}`,
      next_action: '查看 stash 列表或继续基于 clean worktree 开发',
    },
    recovery: {
      blocked: false,
      reason_code: 'git_stash_create_completed',
      reason_message: `stash ${result.ref} 已创建`,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildGitStashCreatePostSyncFailureState(
  result: GitStashCreateResult,
  reasonMessage: string,
  completedTasks: WorkspaceResourceOperationCompletedTaskList,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `stash ${result.ref} 已创建，但资源同步失败`,
      completed_tasks: [
        'stash create 请求已执行',
        '编辑器缓存已清理',
        ...completedTasks,
      ],
      blockers: [reasonMessage],
      next_action: '刷新 Explorer 与 Git 面板，确认 worktree 和 stash 列表真源后再继续编辑。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'git_stash_create_post_sync_failed',
      approval_boundary: 'git_restore',
      current_task: `stash ${result.ref} 创建后的资源同步失败`,
      next_action: '重新刷新 Explorer 与 Git 面板',
    },
    recovery: {
      blocked: true,
      reason_code: 'git_stash_create_post_sync_failed',
      reason_message: reasonMessage,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildCommitRestoreFailureActions(): GuidanceAction[] {
  return [
    {
      label: '打开 Git 面板',
      kind: 'open_git_panel',
    },
  ];
}

function buildCommitRestorePostSyncFailureActions(stage: CommitRestoreSyncStage): GuidanceAction[] {
  if (stage === 'commit_list') {
    return [
      {
        label: '打开 Git 面板',
        kind: 'open_git_panel',
      },
      {
        label: '重新刷新 Explorer',
        kind: 'refresh_explorer_panel',
      },
    ];
  }
  return [
    {
      label: '重新刷新 Explorer',
      kind: 'refresh_explorer_panel',
    },
    {
      label: '打开 Git 面板',
      kind: 'open_git_panel',
    },
  ];
}

function buildFileSaveResourceSyncFailureState(
  filePath: string,
  failures: WorkspaceResourceOperationFailureList,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `文件 ${filePath} 已保存，但资源同步失败`,
      completed_tasks: ['文件内容已写入后端', '编辑器保存快照已更新'],
      blockers: failures,
      next_action: '稍后刷新 Runtime、Explorer、Git worktree 状态或 Git 提交列表，确认资源视图已同步到最新状态。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `文件 ${filePath} 保存后的资源同步失败`,
      next_action: '刷新 Runtime、文件树、worktree 状态或提交列表确认最新状态，必要时重新保存文件。',
    },
    recovery: {
      blocked: false,
      reason_code: 'file_save_resource_sync_failed',
      reason_message: failures.join('；'),
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildFileSaveProjectDetailCacheFailureState(
  filePath: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `文件 ${filePath} 已保存，但项目详情 file_tree 缓存更新失败`,
      completed_tasks: ['文件内容已写入后端', '编辑器保存快照已更新'],
      blockers: [reasonMessage],
      next_action: '刷新 Explorer 读取容器真源；如果刷新或重新进入 Workspace，项目详情缓存可能仍是旧状态。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `文件 ${filePath} 保存后的项目详情 file_tree 缓存更新失败`,
      next_action: '刷新 Explorer 校准容器真源，必要时重新进入 Workspace 前先确认文件树。',
    },
    recovery: {
      blocked: false,
      reason_code: 'file_save_project_detail_file_tree_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildFileSaveGitCommitFailureState(
  filePath: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `文件 ${filePath} 已保存，但 Git 快照创建失败`,
      completed_tasks: ['文件内容已写入后端', '编辑器保存快照已更新'],
      blockers: [reasonMessage],
      next_action: '稍后再次保存或手动刷新提交列表，确认最新提交是否已经创建。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `文件 ${filePath} 保存后的 Git 快照创建失败`,
      next_action: '重新保存或刷新 Git 提交列表，确认最新提交关联。',
    },
    recovery: {
      blocked: false,
      reason_code: 'file_save_git_commit_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildWorktreeCommitFailureState(
  commitMessage: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `提交 worktree dirty 变更失败：${commitMessage}`,
      completed_tasks: [],
      blockers: [reasonMessage],
      next_action: '打开 Git 面板重新确认 worktree dirty 状态，必要时先保存文件或处理复杂 Git 状态后再提交。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'worktree_commit_failed',
      approval_boundary: 'git_worktree_commit',
      current_task: `提交 worktree dirty 变更失败：${commitMessage}`,
      next_action: '确认 worktree 状态后重新提交',
    },
    recovery: {
      blocked: true,
      reason_code: 'worktree_commit_failed',
      reason_message: reasonMessage,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildWorktreeCommitBlockedState(result: GitWorktreeCommitResult): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: '提交 worktree dirty 变更被 guard 阻断',
      completed_tasks: ['已检查 worktree dirty 状态'],
      blockers: [result.message],
      next_action: result.recovery,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'worktree_commit_blocked',
      approval_boundary: 'git_worktree_commit',
      current_task: '提交 worktree dirty 变更被 guard 阻断',
      next_action: result.recovery,
    },
    recovery: {
      blocked: true,
      reason_code: 'worktree_commit_blocked',
      reason_message: result.message,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function getGitWorktreeCommitHashLabel(result: GitWorktreeCommitResult): string {
  const commitHash = result.commit_hash;
  const hasCommitHash = commitHash.length > 0;
  if (hasCommitHash === false) {
    return 'unknown';
  }

  return commitHash;
}

function buildWorktreeCommitSuccessState(
  result: GitWorktreeCommitResult,
  completedTasks: WorkspaceResourceOperationCompletedTaskList,
): WorkspaceEngineeringStateSnapshot {
  const hasCommitRecordIssue = hasWorkspaceResourceOperationWorktreeCommitRecordIssue(result);
  const commitHashLabel = getGitWorktreeCommitHashLabel(result);
  let worktreeCommitStatus: WorkspaceWorkflowStatus = 'passed';
  if (hasCommitRecordIssue === true) {
    worktreeCommitStatus = 'failed';
  }

  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: worktreeCommitStatus,
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: hasCommitRecordIssue === true
        ? `worktree 已提交为 ${commitHashLabel}，但提交记录同步异常`
        : `worktree dirty 变更已提交为 ${commitHashLabel}`,
      completed_tasks: [
        'Git worktree dirty 变更已提交',
        ...completedTasks,
      ],
      blockers: hasCommitRecordIssue === true ? [result.message] : [],
      next_action: hasCommitRecordIssue === true
        ? result.recovery
        : '继续在 Git 面板确认最新提交，或基于 clean worktree 继续后续实现。',
      status: worktreeCommitStatus,
    },
    execution: {
      auto_progress_enabled: hasCommitRecordIssue === false,
      awaiting_confirmation: hasCommitRecordIssue === true,
      pause_reason: hasCommitRecordIssue === true ? 'worktree_commit_record_sync_failed' : undefined,
      approval_boundary: hasCommitRecordIssue === true ? 'git_worktree_commit_sync' : undefined,
      current_task: hasCommitRecordIssue === true
        ? `worktree 已提交为 ${commitHashLabel}，但提交记录同步异常`
        : `worktree dirty 变更已提交为 ${commitHashLabel}`,
      next_action: hasCommitRecordIssue === true ? result.recovery : '继续后续实现',
    },
    recovery: {
      blocked: hasCommitRecordIssue === true,
      reason_code: result.status === 'committed' ? 'worktree_commit_completed' : result.status,
      reason_message: result.message,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildWorktreeCommitPostSyncFailureState(
  result: GitWorktreeCommitResult,
  reasonMessage: string,
  completedTasks: WorkspaceResourceOperationCompletedTaskList,
): WorkspaceEngineeringStateSnapshot {
  const commitHashLabel = getGitWorktreeCommitHashLabel(result);

  return {
    workflow: {
      stage: 'git-restore',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '版本恢复',
      current_task: `worktree 已提交为 ${commitHashLabel}，但资源同步失败`,
      completed_tasks: [
        'Git worktree dirty 变更已提交',
        ...completedTasks,
      ],
      blockers: [reasonMessage],
      next_action: '刷新 Explorer 与 Git 面板，确认 worktree clean 状态和最新提交后再继续编辑。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'worktree_commit_post_sync_failed',
      approval_boundary: 'git_worktree_commit_sync',
      current_task: `worktree 提交 ${commitHashLabel} 后资源同步失败`,
      next_action: '重新刷新 Explorer 与 Git 面板',
    },
    recovery: {
      blocked: true,
      reason_code: 'worktree_commit_post_sync_failed',
      reason_message: reasonMessage,
      resume_stage: 'git-restore',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildFileSaveFailureState(
  filePath: string,
  reasonMessage: string,
  isBackendUnreachable: boolean,
): WorkspaceEngineeringStateSnapshot {
  const reasonCode = getFileSaveFailureReasonCode(isBackendUnreachable);
  let nextAction = '修复保存失败原因后重新保存；当前未更新保存快照或 Git 状态。';
  let executionNextAction = '重新保存前先确认后端文件接口或运行时状态已恢复。';

  if (isBackendUnreachable === true) {
    nextAction = '等待后端或 Next 代理恢复后重新保存；当前未更新保存快照或 Git 状态。';
    executionNextAction = '确认后端 /api/health 或代理链路恢复后，再重新保存当前文件。';
  }

  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `保存文件 ${filePath} 失败`,
      completed_tasks: ['本地编辑器修改仍保留'],
      blockers: [reasonMessage],
      next_action: nextAction,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `保存文件 ${filePath} 失败`,
      next_action: executionNextAction,
    },
    recovery: {
      blocked: false,
      reason_code: reasonCode,
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildFileSaveSkippedCommitState(
  filePath: string,
  statusLabel: string,
): WorkspaceEngineeringStateSnapshot {
  const reasonMessage = statusLabel || '后端判断内容无变化';
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `文件 ${filePath} 已保存，无需创建新的 Git 快照`,
      completed_tasks: ['文件内容已写入后端', '编辑器保存快照已更新', '无需创建新的 Git 快照'],
      blockers: [],
      next_action: '可以继续编辑；Git 面板保持在原提交是预期状态。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `文件 ${filePath} 无变化保存完成`,
      next_action: '继续编辑或在有内容变化后再次保存以创建新快照。',
    },
    recovery: {
      blocked: false,
      reason_code: 'file_save_git_commit_skipped_no_changes',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildFileReadFailureState(
  filePath: string,
  reasonMessage: string,
  fileTreeRefreshRecovered: boolean,
  recoveryDetail: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `打开文件 ${filePath} 失败`,
      completed_tasks: fileTreeRefreshRecovered
        ? ['文件树已刷新', '失效标签页已清理', '编辑器缓存已清理']
        : ['失效标签页已清理', '编辑器缓存已清理'],
      blockers: fileTreeRefreshRecovered ? [reasonMessage] : [reasonMessage, recoveryDetail],
      next_action: fileTreeRefreshRecovered
        ? '从 Explorer 重新选择文件，确认目标文件是否仍存在或可读。'
        : '稍后重新刷新文件树后，再从 Explorer 重新选择文件。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `打开文件 ${filePath} 失败`,
      next_action: fileTreeRefreshRecovered
        ? '从刷新后的 Explorer 重新选择文件。'
        : '先刷新 Explorer 校准目录真源，再重新选择文件。',
    },
    recovery: {
      blocked: false,
      reason_code: fileTreeRefreshRecovered
        ? 'file_read_failed_recovered'
        : 'file_read_failed_with_stale_explorer',
      reason_message: `${reasonMessage}；${recoveryDetail}`,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildViewCommitRefreshFailureState(
  commit: GitCommit,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `查看版本 ${commit.hash} 时提交详情读取失败`,
      completed_tasks: ['已打开当前缓存中的提交详情'],
      blockers: [reasonMessage],
      next_action: '稍后重新打开该提交，确认当前详情是否仍是最新快照。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `查看版本 ${commit.hash} 时提交详情读取失败`,
      next_action: '在 Git 面板重新打开该提交，或返回当前缓存详情继续排查。',
    },
    recovery: {
      blocked: false,
      reason_code: 'view_commit_detail_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

export function useWorkspaceResourceOperations({
  projectInfo,
  activeFile,
  files,
  savedFiles,
  mobileEditingFile,
  isRestoringCommit,
  pendingRestoreCommit,
  refreshProjectFileTree,
  fetchProjectDetail,
  fetchProjectBranches,
  fetchProjectRemoteBranches,
  fetchProjectTags,
  fetchProjectStashes,
  fetchProjectWorktreeStatus,
  fetchProjectCommits,
  fetchRuntimeStatusSnapshot,
  requestPreviewReload,
  setFiles,
  setSavedFiles,
  setEditorBufferStatuses,
  setOpenFiles,
  setActiveFile,
  setMobileEditingFile,
  setMobileFileContent,
  applyResourceFileMessages,
  applyResourceGitMessages,
  setSelectedCommit,
  setGitCommitDetailStatus,
  setGitBranchSwitchReadiness,
  setPendingRestoreCommit,
  setIsRestoringCommit,
  openGitView,
}: UseWorkspaceResourceOperationsOptions): WorkspaceResourceOperationsContract {
  const saveFilePromisesRef = useRef<WorkspaceResourceOperationSavePromiseMap>(new Map());
  const queuedSaveContentRef = useRef<WorkspaceResourceOperationQueuedSaveContentMap>(new Map());
  const collaborationEventSequenceRef = useRef(0);
  const filesRef = useRef(files);
  const savedFilesRef = useRef(savedFiles);
  filesRef.current = files;
  savedFilesRef.current = savedFiles;

  const performSaveFile = useCallback(async (filePath: string, content: string) => {
    const projectId = getWorkspaceResourceOperationPersistedProjectId(projectInfo);
    const hasFilePath = hasWorkspaceResourceOperationPathValue(filePath);
    if (projectId === null || hasFilePath === false) return false;

    let writeResult: ProjectFileWriteResponse;
    try {
      const expectedRevision = savedFilesRef.current.has(filePath)
        ? await getWorkspaceFileContentRevision(savedFilesRef.current.get(filePath) ?? '')
        : undefined;
      writeResult = await projectApi.writeFile(projectId, filePath, content, expectedRevision);
    } catch (error) {
      if (isWorkspaceResourceOperationRevisionConflict(error)) {
        window.dispatchEvent(new CustomEvent('yistack:collaboration-conflict', {
          detail: { path: filePath, actor: '其他协作者' },
        }));
      }
      const failureMessage = formatWorkspaceResourceOperationFailure(error, '请重试');
      const isBackendUnreachable = isWorkspaceResourceOperationBackendUnreachable(error);
      applyResourceFileMessages((prev) => [...prev, {
        id: `save-file-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: getFileSaveFailureMessage({ filePath, failureMessage, isBackendUnreachable }),
        statusContent: getFileSaveFailureStatusContent(isBackendUnreachable),
        engineeringState: buildFileSaveFailureState(filePath, failureMessage, isBackendUnreachable),
        timestamp: new Date().toISOString(),
      }]);
      return false;
    }

    const nextSavedFiles = new Map(savedFilesRef.current);
    nextSavedFiles.set(filePath, content);
    savedFilesRef.current = nextSavedFiles;
    setSavedFiles(nextSavedFiles);
    setEditorBufferStatuses((prev) => new Map(prev).set(filePath, buildFileSaveEditorBufferStatus(filePath)));
    requestPreviewReload();

    const postSaveSyncFailures: WorkspaceResourceOperationFailureList = [];
    if (writeResult.collaboration_event_status === 'failed') {
      postSaveSyncFailures.push(`协作事件同步失败：${writeResult.collaboration_event_error || '后端未记录文件保存事件'}`);
    }
    window.dispatchEvent(new CustomEvent('yistack:collaboration-conflict-resolved', {
      detail: { path: filePath },
    }));
    const shouldSyncRuntimeStatus = projectInfo !== null && appTypeNeedsRuntime(projectInfo.appType) === true;
    if (shouldSyncRuntimeStatus === true) {
      try {
        await fetchRuntimeStatusSnapshot(projectId, '保存后同步运行时状态...', {
          throwOnFailure: true,
          suppressNotice: true,
        });
      } catch (error) {
        postSaveSyncFailures.push(`Runtime 状态刷新失败：${formatWorkspaceResourceOperationFailure(error)}`);
      }
    }

    try {
      await refreshProjectFileTree(projectId, true, {
        throwOnFailure: true,
        suppressNotice: true,
      });
    } catch (error) {
      postSaveSyncFailures.push(`文件树刷新失败：${formatWorkspaceResourceOperationFailure(error)}`);
    }

    try {
      await fetchProjectWorktreeStatus(projectId, {
        throwOnFailure: true,
        suppressNotice: true,
      });
    } catch (error) {
      postSaveSyncFailures.push(`Git worktree 状态刷新失败：${formatWorkspaceResourceOperationFailure(error)}`);
    }

    try {
      await fetchProjectCommits(projectId, {
        throwOnFailure: true,
        suppressNotice: true,
      });
    } catch (error) {
      postSaveSyncFailures.push(`Git 提交列表刷新失败：${formatWorkspaceResourceOperationFailure(error)}`);
    }

    if (postSaveSyncFailures.length > 0) {
      applyResourceFileMessages((prev) => [...prev, {
        id: `save-file-resource-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `文件 \`${filePath}\` 已保存，但保存后的资源同步失败：${postSaveSyncFailures.join('；')}。当前编辑器保存快照已更新，Runtime、Explorer、Git worktree 状态或 Git 提交列表可能仍是旧状态；你可以稍后刷新 Runtime、文件树、worktree 状态或提交列表确认。`,
        statusContent: '保存后资源同步失败',
        engineeringState: buildFileSaveResourceSyncFailureState(filePath, postSaveSyncFailures),
        timestamp: new Date().toISOString(),
      }]);
    }

    if (writeResult.file_tree_status === 'failed') {
      const fileTreeFailureMessage = formatWorkspaceResourceStructuredStatusError(
        writeResult.file_tree_error,
        writeResult.file_tree_error_source,
        writeResult.file_tree_error_details,
        '请稍后重试',
      );
      applyResourceFileMessages((prev) => [...prev, {
        id: `save-file-tree-cache-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `文件 \`${filePath}\` 已保存，但后端项目详情 file_tree 缓存更新失败：${fileTreeFailureMessage}。当前编辑器保存快照已更新，Explorer 可通过文件树刷新读取容器真源，但刷新或重新进入 Workspace 时项目详情缓存可能仍是旧状态。`,
        statusContent: '项目详情 file_tree 缓存可能旧',
        engineeringState: buildFileSaveProjectDetailCacheFailureState(filePath, fileTreeFailureMessage),
        timestamp: new Date().toISOString(),
      }]);
    }

    const hasGitSnapshotRecordIssue = hasWorkspaceResourceOperationFileSaveGitRecordIssue(writeResult);

    if (writeResult.commit_status === 'failed') {
      const commitFailureMessage = formatWorkspaceResourceStructuredStatusError(
        writeResult.commit_error,
        writeResult.commit_error_source,
        writeResult.commit_error_details,
        '请稍后重试',
      );
      applyResourceFileMessages((prev) => [...prev, {
        id: `save-file-git-commit-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `文件 \`${filePath}\` 已保存，但 Git 快照创建失败：${commitFailureMessage}。当前编辑器保存快照已更新，Git 面板或最新提交关联可能仍是旧状态；你可以稍后再次保存或手动刷新提交列表确认。`,
        statusContent: 'Git 快照创建失败',
        engineeringState: buildFileSaveGitCommitFailureState(filePath, commitFailureMessage),
        timestamp: new Date().toISOString(),
      }]);
    }

    if (hasGitSnapshotRecordIssue === true) {
      const commitRecordFailureMessage = formatWorkspaceResourceStructuredStatusError(
        writeResult.commit_error,
        writeResult.commit_error_source,
        writeResult.commit_error_details,
        '请稍后刷新提交列表确认',
      );
      applyResourceFileMessages((prev) => [...prev, {
        id: `save-file-git-commit-record-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `文件 \`${filePath}\` 已保存，Git 快照已创建，但提交记录同步异常：${commitRecordFailureMessage}。Git 面板可继续从项目仓库读取真实提交历史，后台 commits 记录可能暂时缺失。`,
        statusContent: 'Git 快照记录同步异常',
        engineeringState: buildFileSaveGitCommitFailureState(filePath, commitRecordFailureMessage),
        timestamp: new Date().toISOString(),
      }]);
    }

    if (writeResult.commit_status === 'skipped_no_changes') {
      applyResourceFileMessages((prev) => [...prev, {
        id: `save-file-git-commit-skipped-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: formatWorkspaceFileWriteSkippedCommitNotice(filePath, writeResult.commit_status_label),
        statusContent: '文件已保存，无需新 Git 快照',
        engineeringState: buildFileSaveSkippedCommitState(filePath, writeResult.commit_status_label),
        timestamp: new Date().toISOString(),
      }]);
    }

    return true;
  }, [
    fetchProjectCommits,
    fetchRuntimeStatusSnapshot,
    fetchProjectWorktreeStatus,
    projectInfo,
    refreshProjectFileTree,
    requestPreviewReload,
    applyResourceFileMessages,
    setEditorBufferStatuses,
    setSavedFiles,
  ]);

  const saveFile = useCallback((filePath: string, content: string) => {
    const existingSavePromise = saveFilePromisesRef.current.get(filePath);
    if (existingSavePromise !== undefined) {
      queuedSaveContentRef.current.set(filePath, content);
      return existingSavePromise;
    }

    const savePromise = (async () => {
      let nextContent: string | undefined = content;
      let saveSucceeded = false;

      while (nextContent !== undefined) {
        const currentContent = nextContent;
        queuedSaveContentRef.current.delete(filePath);
        saveSucceeded = await performSaveFile(filePath, currentContent);
        const queuedContent = queuedSaveContentRef.current.get(filePath);
        if (queuedContent === undefined) {
          nextContent = undefined;
        } else {
          setEditorBufferStatuses((prev) => new Map(prev).set(filePath, buildDirtyEditorBufferStatus({
            filePath,
            source: 'user_edit',
          })));
          nextContent = queuedContent;
        }
      }

      return saveSucceeded;
    })().finally(() => {
      saveFilePromisesRef.current.delete(filePath);
      queuedSaveContentRef.current.delete(filePath);
    });

    saveFilePromisesRef.current.set(filePath, savePromise);
    return savePromise;
  }, [performSaveFile, setEditorBufferStatuses]);

  useEffect(() => {
    collaborationEventSequenceRef.current = 0;
  }, [projectInfo?.projectId]);

  useEffect(() => {
    const projectId = getWorkspaceResourceOperationPersistedProjectId(projectInfo);
    if (projectId === null) return;

    const handleCollaborationResourceChanged = (rawEvent: Event) => {
      if (!(rawEvent instanceof CustomEvent)) return;
      const event = rawEvent.detail as CollaborationEvent | undefined;
      if (!event || event.project_id !== projectId || event.sequence <= collaborationEventSequenceRef.current) return;
      collaborationEventSequenceRef.current = event.sequence;
      const resourcePath = event.resource_path ?? '';

      void (async () => {
        try {
          await refreshProjectFileTree(projectId, true, {
            throwOnFailure: true,
            suppressNotice: true,
          });
        } catch {
          return;
        }
        if (event.event_type !== 'file_saved' || !resourcePath || !filesRef.current.has(resourcePath)) return;

        const currentContent = filesRef.current.get(resourcePath);
        const savedContent = savedFilesRef.current.get(resourcePath);
        if (currentContent !== savedContent) {
          window.dispatchEvent(new CustomEvent('yistack:collaboration-conflict', {
            detail: { path: resourcePath, actor: event.actor_username },
          }));
          return;
        }
        try {
          const response = await projectApi.readFile(projectId, resourcePath);
          if (filesRef.current.get(resourcePath) !== savedFilesRef.current.get(resourcePath)) {
            window.dispatchEvent(new CustomEvent('yistack:collaboration-conflict', {
              detail: { path: resourcePath, actor: event.actor_username },
            }));
            return;
          }
          const nextFiles = new Map(filesRef.current).set(resourcePath, response.content);
          const nextSavedFiles = new Map(savedFilesRef.current).set(resourcePath, response.content);
          filesRef.current = nextFiles;
          savedFilesRef.current = nextSavedFiles;
          setFiles(nextFiles);
          setSavedFiles(nextSavedFiles);
          setEditorBufferStatuses((prev) => new Map(prev).set(
            resourcePath,
            buildFileReadEditorBufferStatus(resourcePath),
          ));
          requestPreviewReload();
        } catch {
          return;
        }
      })();
    };

    window.addEventListener('yistack:collaboration-resource-changed', handleCollaborationResourceChanged);
    return () => window.removeEventListener('yistack:collaboration-resource-changed', handleCollaborationResourceChanged);
  }, [
    projectInfo,
    refreshProjectFileTree,
    requestPreviewReload,
    setEditorBufferStatuses,
    setFiles,
    setSavedFiles,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        const hasActiveEditorBufferContent = hasWorkspaceEditorBufferContent(files, activeFile);
        if (hasActiveEditorBufferContent === true) {
          void saveFile(activeFile, getWorkspaceEditorBufferContent(files, activeFile));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, files, saveFile]);

  useEffect(() => {
    const projectId = getWorkspaceResourceOperationPersistedProjectId(projectInfo);
    const hasActiveFile = hasWorkspaceResourceOperationPathValue(activeFile);
    if (projectId === null || hasActiveFile === false) return;

    const hasActiveEditorBufferContent = hasWorkspaceEditorBufferContent(files, activeFile);
    if (hasActiveEditorBufferContent === true) {
      if (mobileEditingFile === activeFile) {
        setMobileFileContent(getWorkspaceEditorBufferContent(files, activeFile));
      }
      return;
    }

    const loadFileContent = async () => {
      try {
        const payload = await projectApi.readFile(projectId, activeFile);
        const content = typeof payload?.content === 'string' ? payload.content : '';
        setFiles((prev) => new Map(prev).set(activeFile, content));
        setSavedFiles((prev) => new Map(prev).set(activeFile, content));
        setEditorBufferStatuses((prev) => new Map(prev).set(activeFile, buildFileReadEditorBufferStatus(activeFile)));
        if (mobileEditingFile === activeFile) {
          setMobileFileContent(content);
        }
      } catch (error) {
        const readFailureReason = formatWorkspaceResourceOperationFailure(error, '文件可能已被删除、移动或暂不可读');
        let readFileRecoveryDetail = '已刷新文件树并清理失效标签页，请从 Explorer 重新选择文件。';
        let readFileTreeRefreshRecovered = true;
        try {
          await refreshProjectFileTree(projectId, true, {
            throwOnFailure: true,
            suppressNotice: true,
          });
        } catch (refreshError) {
          readFileTreeRefreshRecovered = false;
          readFileRecoveryDetail = `文件树刷新也失败：${formatWorkspaceResourceOperationFailure(refreshError)}。当前 Explorer 可能仍是旧快照；已清理失效标签页和编辑器缓存，你可以稍后重新刷新文件树后再选择文件。`;
        }
        setFiles((prev) => {
          const next = new Map(prev);
          next.delete(activeFile);
          return next;
        });
        setSavedFiles((prev) => {
          const next = new Map(prev);
          next.delete(activeFile);
          return next;
        });
        setEditorBufferStatuses((prev) => {
          const next = new Map(prev);
          next.delete(activeFile);
          return next;
        });
        setOpenFiles((prev) => {
          const next = getWorkspaceResourceOperationOpenFilesWithoutPath(prev, activeFile);
          setActiveFile((current) => getWorkspaceResourceOperationActiveFileAfterPathRemoval(current, next, activeFile));
          return next;
        });
        if (mobileEditingFile === activeFile) {
          setMobileEditingFile(null);
          setMobileFileContent('');
        }
        appendWorkspaceDebugEvent({
          projectId,
          category: 'file_system',
          severity: 'error',
          title: '文件读取失败',
          detail: readFailureReason,
          source: 'workspace_file_read',
          path: activeFile,
          recovery: readFileRecoveryDetail,
          engineeringState: buildFileReadFailureState(
            activeFile,
            readFailureReason,
            readFileTreeRefreshRecovered,
            readFileRecoveryDetail,
          ),
        });
      }
    };

    void loadFileContent();
  }, [
    activeFile,
    files,
    mobileEditingFile,
    projectInfo,
    refreshProjectFileTree,
    applyResourceFileMessages,
    setActiveFile,
    setEditorBufferStatuses,
    setFiles,
    setMobileEditingFile,
    setMobileFileContent,
    setOpenFiles,
    setSavedFiles,
    setSelectedCommit,
  ]);

  const handleViewCommit = useCallback(async (commit: GitCommit) => {
    let nextCommit = commit;
    const projectId = getWorkspaceResourceOperationProjectId(projectInfo);
    if (projectId !== null) {
      try {
        nextCommit = await projectApi.getCommit(projectId, commit.hash);
        setGitCommitDetailStatus(buildFreshGitCommitDetailStatus({
          source: 'commit_detail',
          commitHash: nextCommit.hash,
        }));
      } catch (error) {
        const failureMessage = formatWorkspaceResourceOperationFailure(error);
        setGitCommitDetailStatus(buildViewCommitCacheFallbackGitCommitDetailStatus({
          commitHash: commit.hash,
          failureMessage,
        }));
        applyResourceFileMessages((prev) => [...prev, {
          id: `view-commit-refresh-failed-${Date.now()}`,
          role: 'assistant',
          kind: 'workflow',
          content: `查看版本 \`${commit.hash}\` 时读取提交详情失败：${failureMessage}。已打开当前缓存中的提交详情，但 Git 面板可能仍是旧快照；你可以稍后重新打开该提交确认。`,
          statusContent: '版本详情可能是旧快照',
          engineeringState: buildViewCommitRefreshFailureState(commit, failureMessage),
          timestamp: new Date().toISOString(),
        }]);
      }
    }

    setSelectedCommit(nextCommit);
    openGitView();
  }, [applyResourceFileMessages, openGitView, projectInfo, setGitCommitDetailStatus, setSelectedCommit]);

  const handleRestoreCommit = useCallback((commit: GitCommit) => {
    const projectId = getWorkspaceResourceOperationProjectId(projectInfo);
    if (projectId === null || isRestoringCommit === true) return;
    setPendingRestoreCommit(commit);
  }, [isRestoringCommit, projectInfo, setPendingRestoreCommit]);

  const handleRestoreCommitFile = useCallback(async (commit: GitCommit, filePath: string) => {
    const projectId = getWorkspaceResourceOperationProjectId(projectInfo);
    if (projectId === null || isRestoringCommit === true) return;
    const normalizedFilePath = filePath.trim();
    const hasNormalizedFilePath = hasWorkspaceResourceOperationPathValue(normalizedFilePath);
    if (hasNormalizedFilePath === false) return;

    let result: GitCommitFileRestoreResult;
    try {
      result = await projectApi.restoreCommitFile(projectId, commit.hash, normalizedFilePath);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `restore-commit-file-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `从版本 \`${commit.hash}\` 恢复文件 \`${normalizedFilePath}\` 失败：${failureMessage}。当前工作区没有确认该文件已恢复，请打开 Git 面板和 Explorer 后重新确认。`,
        statusContent: '单文件版本恢复失败',
        engineeringState: buildCommitFileRestoreFailureState(commit, normalizedFilePath, failureMessage),
        suggestedActions: buildCommitRestoreFailureActions(),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    if (result.status === 'blocked') {
      applyResourceGitMessages((prev) => [...prev, {
        id: `restore-commit-file-blocked-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `从版本 \`${result.hash}\` 恢复文件 \`${result.path}\` 已被 guard 阻断：${result.message}。${result.recovery}`,
        statusContent: '单文件版本恢复被阻断',
        engineeringState: buildCommitFileRestoreBlockedState(result),
        suggestedActions: buildCommitRestoreFailureActions(),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    const completedSyncTasks: WorkspaceResourceOperationCompletedSyncTaskList = [];
    const restoredPath = getWorkspaceResourceOperationResultPath(result.path, normalizedFilePath);
    setFiles((prev) => {
      const next = new Map(prev);
      next.delete(restoredPath);
      return next;
    });
    setSavedFiles((prev) => {
      const next = new Map(prev);
      next.delete(restoredPath);
      return next;
    });
    setEditorBufferStatuses((prev) => {
      const next = new Map(prev);
      next.delete(restoredPath);
      return next;
    });
    setOpenFiles((prev) => getWorkspaceResourceOperationOpenFilesWithoutPath(prev, restoredPath));
    if (activeFile === restoredPath) setActiveFile(null);
    if (mobileEditingFile === restoredPath) {
      setMobileEditingFile(null);
      setMobileFileContent('');
    }

    try {
      await refreshProjectFileTree(projectId, true, {
        throwOnFailure: true,
        suppressNotice: true,
      });
      completedSyncTasks.push('Explorer 文件树已同步');
      await fetchProjectCommits(projectId);
      completedSyncTasks.push('Git 提交列表已同步');
      applyResourceGitMessages((prev) => [...prev, {
        id: `restore-commit-file-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `已从版本 \`${result.hash}\` 恢复文件 \`${restoredPath}\`${result.commit_hash ? `，并创建恢复快照 \`${result.commit_hash}\`` : ''}。Workspace 已清理该文件编辑器缓存，并重新同步 Explorer 与 Git 提交列表。`,
        statusContent: '单文件版本恢复完成',
        engineeringState: buildCommitFileRestoreSuccessState(result, completedSyncTasks),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `restore-commit-file-post-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `文件 \`${restoredPath}\` 的恢复请求已执行，且该文件编辑器缓存已清理；但恢复后的资源同步失败：${failureMessage}。请刷新 Explorer 与 Git 面板确认文件真源后再继续编辑。`,
        statusContent: '文件已恢复但资源同步失败',
        engineeringState: buildCommitFileRestorePostSyncFailureState(result, failureMessage, completedSyncTasks),
        suggestedActions: buildCommitRestorePostSyncFailureActions('commit_list'),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    activeFile,
    fetchProjectCommits,
    isRestoringCommit,
    mobileEditingFile,
    projectInfo,
    refreshProjectFileTree,
    setActiveFile,
    setEditorBufferStatuses,
    setFiles,
    applyResourceGitMessages,
    setMobileEditingFile,
    setMobileFileContent,
    setOpenFiles,
    setSavedFiles,
  ]);

  const handleDiscardWorktreeFile = useCallback(async (filePath: string) => {
    const projectId = getWorkspaceResourceOperationProjectId(projectInfo);
    if (projectId === null || isRestoringCommit === true) return;
    const normalizedFilePath = filePath.trim();
    const hasNormalizedFilePath = hasWorkspaceResourceOperationPathValue(normalizedFilePath);
    if (hasNormalizedFilePath === false) return;

    let result: GitWorktreeFileDiscardResult;
    try {
      result = await projectApi.discardWorktreeFile(projectId, normalizedFilePath);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `worktree-file-discard-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `丢弃 worktree 文件 \`${normalizedFilePath}\` 失败：${failureMessage}。当前工作区没有确认该文件变更已丢弃，请打开 Git 面板和 Explorer 后重新确认。`,
        statusContent: 'worktree 文件丢弃失败',
        engineeringState: buildWorktreeFileDiscardFailureState(normalizedFilePath, failureMessage),
        suggestedActions: buildCommitRestoreFailureActions(),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    if (result.status === 'blocked') {
      applyResourceGitMessages((prev) => [...prev, {
        id: `worktree-file-discard-blocked-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `丢弃 worktree 文件 \`${result.path}\` 已被 guard 阻断：${result.message}。${result.recovery}`,
        statusContent: 'worktree 文件丢弃被阻断',
        engineeringState: buildWorktreeFileDiscardBlockedState(result),
        suggestedActions: buildCommitRestoreFailureActions(),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    const completedSyncTasks: WorkspaceResourceOperationCompletedSyncTaskList = [];
    const discardedPath = getWorkspaceResourceOperationResultPath(result.path, normalizedFilePath);
    setFiles((prev) => {
      const next = new Map(prev);
      next.delete(discardedPath);
      return next;
    });
    setSavedFiles((prev) => {
      const next = new Map(prev);
      next.delete(discardedPath);
      return next;
    });
    setEditorBufferStatuses((prev) => {
      const next = new Map(prev);
      next.delete(discardedPath);
      return next;
    });
    setOpenFiles((prev) => getWorkspaceResourceOperationOpenFilesWithoutPath(prev, discardedPath));
    if (activeFile === discardedPath) setActiveFile(null);
    if (mobileEditingFile === discardedPath) {
      setMobileEditingFile(null);
      setMobileFileContent('');
    }

    try {
      await refreshProjectFileTree(projectId, true, {
        throwOnFailure: true,
        suppressNotice: true,
      });
      completedSyncTasks.push('Explorer 文件树已同步');
      await fetchProjectWorktreeStatus(projectId);
      completedSyncTasks.push('Git worktree 状态已同步');
      await fetchProjectCommits(projectId);
      completedSyncTasks.push('Git 提交列表已同步');
      applyResourceGitMessages((prev) => [...prev, {
        id: `worktree-file-discard-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `已丢弃 worktree 文件 \`${discardedPath}\` 的本地变更。Workspace 已清理该文件编辑器缓存，并重新同步 Explorer、worktree 与 Git 提交列表。`,
        statusContent: 'worktree 文件丢弃完成',
        engineeringState: buildWorktreeFileDiscardSuccessState(result, completedSyncTasks),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `worktree-file-discard-post-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `文件 \`${discardedPath}\` 的 worktree 丢弃请求已执行，且该文件编辑器缓存已清理；但丢弃后的资源同步失败：${failureMessage}。请刷新 Explorer 与 Git 面板确认文件真源后再继续编辑。`,
        statusContent: '文件已丢弃但资源同步失败',
        engineeringState: buildWorktreeFileDiscardPostSyncFailureState(result, failureMessage, completedSyncTasks),
        suggestedActions: buildCommitRestorePostSyncFailureActions('commit_list'),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    activeFile,
    fetchProjectCommits,
    fetchProjectWorktreeStatus,
    isRestoringCommit,
    mobileEditingFile,
    projectInfo,
    refreshProjectFileTree,
    setActiveFile,
    setEditorBufferStatuses,
    setFiles,
    applyResourceGitMessages,
    setMobileEditingFile,
    setMobileFileContent,
    setOpenFiles,
    setSavedFiles,
  ]);

  const handleCommitWorktree = useCallback(async (message: string) => {
    const projectId = getWorkspaceResourceOperationProjectId(projectInfo);
    if (projectId === null || isRestoringCommit === true) return;
    const normalizedMessage = message.trim();
    const hasNormalizedMessage = hasWorkspaceResourceOperationTextValue(normalizedMessage);
    if (hasNormalizedMessage === false) return;

    let result: GitWorktreeCommitResult;
    try {
      result = await projectApi.commitWorktree(projectId, normalizedMessage);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `worktree-commit-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `提交 worktree dirty 变更失败：${failureMessage}。当前 Git worktree 没有确认创建新提交，请打开 Git 面板刷新状态后重新确认。`,
        statusContent: 'worktree 提交失败',
        engineeringState: buildWorktreeCommitFailureState(normalizedMessage, failureMessage),
        suggestedActions: buildCommitRestoreFailureActions(),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    if (result.status === 'blocked') {
      applyResourceGitMessages((prev) => [...prev, {
        id: `worktree-commit-blocked-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `提交 worktree dirty 变更已被 guard 阻断：${result.message}。${result.recovery}`,
        statusContent: 'worktree 提交被阻断',
        engineeringState: buildWorktreeCommitBlockedState(result),
        suggestedActions: buildCommitRestoreFailureActions(),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    const completedSyncTasks: WorkspaceResourceOperationCompletedSyncTaskList = [];
    const committedHash = result.commit_hash.trim();
    const hasCommittedHash = hasWorkspaceResourceOperationTextValue(committedHash);
    const committedHashSegment = hasCommittedHash === true ? ` \`${committedHash}\`` : '';
    try {
      await refreshProjectFileTree(projectId, true, {
        throwOnFailure: true,
        suppressNotice: true,
      });
      completedSyncTasks.push('Explorer 文件树已同步');
      await fetchProjectWorktreeStatus(projectId);
      completedSyncTasks.push('Git worktree 状态已同步');
      const branches = await fetchProjectBranches(projectId);
      completedSyncTasks.push('Git 分支列表已同步');
      const commits = await fetchProjectCommits(projectId);
      completedSyncTasks.push('Git 提交列表已同步');

      if (hasCommittedHash === true) {
        const committedRecord = getWorkspaceResourceOperationCommitByHash(commits, committedHash);
        if (committedRecord !== undefined) {
          setSelectedCommit(committedRecord);
          completedSyncTasks.push('Git 面板已关联最新提交');
        }
      } else {
        const currentBranch = getWorkspaceResourceOperationCurrentBranch(branches);
        const currentBranchHead = getWorkspaceResourceOperationBranchHead(currentBranch);
        if (currentBranchHead !== null) {
          const committedRecord = getWorkspaceResourceOperationCommitByHash(commits, currentBranchHead);
          if (committedRecord !== undefined) {
            setSelectedCommit(committedRecord);
            completedSyncTasks.push('Git 面板已关联当前分支 HEAD');
          }
        }
      }

      const hasRecordIssue = result.status === 'committed_record_missing' || result.status === 'committed_record_failed';
      applyResourceGitMessages((prev) => [...prev, {
        id: `worktree-commit-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: hasRecordIssue
          ? `Git worktree dirty 变更已创建提交${committedHashSegment}，但提交记录同步存在异常：${result.message}。${result.recovery}`
          : `Git worktree dirty 变更已创建提交${committedHashSegment}。Workspace 已重新同步 Explorer、worktree、分支与 Git 提交列表。`,
        statusContent: hasRecordIssue ? 'worktree 已提交但记录同步异常' : 'worktree 提交完成',
        engineeringState: buildWorktreeCommitSuccessState(result, completedSyncTasks),
        suggestedActions: hasRecordIssue ? buildCommitRestorePostSyncFailureActions('commit_list') : undefined,
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `worktree-commit-post-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `Git worktree dirty 变更已创建提交${committedHashSegment}；但提交后的资源同步失败：${failureMessage}。请刷新 Explorer 与 Git 面板确认 worktree clean 状态和最新提交。`,
        statusContent: 'worktree 已提交但资源同步失败',
        engineeringState: buildWorktreeCommitPostSyncFailureState(result, failureMessage, completedSyncTasks),
        suggestedActions: buildCommitRestorePostSyncFailureActions('commit_list'),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    fetchProjectBranches,
    fetchProjectCommits,
    fetchProjectWorktreeStatus,
    isRestoringCommit,
    projectInfo,
    refreshProjectFileTree,
    applyResourceGitMessages,
    setSelectedCommit,
  ]);

  const handleApplyGitBranchCompareFile = useCallback(async (baseBranch: string, headBranch: string, filePath: string) => {
    const projectId = getWorkspaceResourceOperationProjectId(projectInfo);
    if (projectId === null || isRestoringCommit === true) return;
    const normalizedBaseBranch = baseBranch.trim();
    const normalizedHeadBranch = headBranch.trim();
    const normalizedFilePath = filePath.trim();
    const hasNormalizedBaseBranch = hasWorkspaceResourceOperationTextValue(normalizedBaseBranch);
    const hasNormalizedHeadBranch = hasWorkspaceResourceOperationTextValue(normalizedHeadBranch);
    const hasNormalizedFilePath = hasWorkspaceResourceOperationPathValue(normalizedFilePath);
    if (hasNormalizedBaseBranch === false || hasNormalizedHeadBranch === false || hasNormalizedFilePath === false) return;

    let result: GitBranchCompareFileApplyResult;
    try {
      result = await projectApi.applyBranchCompareFile(
        projectId,
        normalizedBaseBranch,
        normalizedHeadBranch,
        normalizedFilePath,
      );
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `branch-compare-file-apply-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `从分支 \`${normalizedHeadBranch}\` 引入文件 \`${normalizedFilePath}\` 失败：${failureMessage}。当前工作区没有确认该文件已引入，请打开 Git 面板和 Explorer 后重新确认。`,
        statusContent: '分支对比文件引入失败',
        engineeringState: buildBranchCompareFileApplyFailureState(
          normalizedBaseBranch,
          normalizedHeadBranch,
          normalizedFilePath,
          failureMessage,
        ),
        suggestedActions: buildCommitRestoreFailureActions(),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    if (result.status === 'blocked') {
      applyResourceGitMessages((prev) => [...prev, {
        id: `branch-compare-file-apply-blocked-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `从分支 \`${result.head_branch}\` 引入文件 \`${result.path}\` 已被 guard 阻断：${result.message}。${result.recovery}`,
        statusContent: '分支对比文件引入被阻断',
        engineeringState: buildBranchCompareFileApplyBlockedState(result),
        suggestedActions: buildCommitRestoreFailureActions(),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    const completedSyncTasks: WorkspaceResourceOperationCompletedSyncTaskList = [];
    const appliedPath = getWorkspaceResourceOperationResultPath(result.path, normalizedFilePath);
    const commitHash = result.commit_hash.trim();
    const hasCommitHash = hasWorkspaceResourceOperationTextValue(commitHash);
    const commitHashSegment = hasCommitHash === true ? `，并创建引入快照 \`${commitHash}\`` : '';
    setFiles((prev) => {
      const next = new Map(prev);
      next.delete(appliedPath);
      return next;
    });
    setSavedFiles((prev) => {
      const next = new Map(prev);
      next.delete(appliedPath);
      return next;
    });
    setEditorBufferStatuses((prev) => {
      const next = new Map(prev);
      next.delete(appliedPath);
      return next;
    });
    setOpenFiles((prev) => getWorkspaceResourceOperationOpenFilesWithoutPath(prev, appliedPath));
    if (activeFile === appliedPath) setActiveFile(null);
    if (mobileEditingFile === appliedPath) {
      setMobileEditingFile(null);
      setMobileFileContent('');
    }

    try {
      await refreshProjectFileTree(projectId, true, {
        throwOnFailure: true,
        suppressNotice: true,
      });
      completedSyncTasks.push('Explorer 文件树已同步');
      await fetchProjectCommits(projectId);
      completedSyncTasks.push('Git 提交列表已同步');
      await fetchProjectBranches(projectId, result.head_branch);
      completedSyncTasks.push('分支列表与分支对比已同步');
      applyResourceGitMessages((prev) => [...prev, {
        id: `branch-compare-file-apply-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `已从分支 \`${result.head_branch}\` 引入文件 \`${appliedPath}\`${commitHashSegment}。Workspace 已清理该文件编辑器缓存，并重新同步 Explorer、Git 提交列表和分支对比。`,
        statusContent: '分支对比文件引入完成',
        engineeringState: buildBranchCompareFileApplySuccessState(result, completedSyncTasks),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `branch-compare-file-apply-post-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `文件 \`${appliedPath}\` 的分支引入请求已执行，且该文件编辑器缓存已清理；但引入后的资源同步失败：${failureMessage}。请刷新 Explorer 与 Git 面板确认文件真源后再继续编辑。`,
        statusContent: '文件已引入但资源同步失败',
        engineeringState: buildBranchCompareFileApplyPostSyncFailureState(result, failureMessage, completedSyncTasks),
        suggestedActions: buildCommitRestorePostSyncFailureActions('commit_list'),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    activeFile,
    fetchProjectBranches,
    fetchProjectCommits,
    isRestoringCommit,
    mobileEditingFile,
    projectInfo,
    refreshProjectFileTree,
    setActiveFile,
    setEditorBufferStatuses,
    setFiles,
    applyResourceGitMessages,
    setMobileEditingFile,
    setMobileFileContent,
    setOpenFiles,
    setSavedFiles,
  ]);

  const handleCreateGitStash = useCallback(async (message: string) => {
    const projectId = getWorkspaceResourceOperationProjectId(projectInfo);
    if (projectId === null || isRestoringCommit === true) return;
    const normalizedMessage = message.trim();
    const hasNormalizedMessage = hasWorkspaceResourceOperationTextValue(normalizedMessage);
    if (hasNormalizedMessage === false) return;

    let result: GitStashCreateResult;
    try {
      result = await projectApi.createStash(projectId, normalizedMessage);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-stash-create-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `创建 stash 失败：${failureMessage}。当前工作区没有确认 dirty 变更已保存为 stash，请打开 Git 面板和 Explorer 后重新确认。`,
        statusContent: 'stash 创建失败',
        engineeringState: buildGitStashCreateFailureState(failureMessage),
        suggestedActions: buildCommitRestoreFailureActions(),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    if (result.status === 'blocked') {
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-stash-create-blocked-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `创建 stash 已被 guard 阻断：${result.message}。${result.recovery}`,
        statusContent: 'stash 创建被阻断',
        engineeringState: buildGitStashCreateBlockedState(result),
        suggestedActions: buildCommitRestoreFailureActions(),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    const completedSyncTasks: WorkspaceResourceOperationCompletedSyncTaskList = [];
    setFiles(new Map());
    setSavedFiles(new Map());
    setEditorBufferStatuses(new Map());
    setOpenFiles([]);
    setActiveFile(null);
    setMobileEditingFile(null);
    setMobileFileContent('');
    setSelectedCommit(null);
    setGitCommitDetailStatus(null);

    try {
      await refreshProjectFileTree(projectId, true, {
        throwOnFailure: true,
        suppressNotice: true,
      });
      completedSyncTasks.push('Explorer 文件树已同步');
      await fetchProjectWorktreeStatus(projectId);
      completedSyncTasks.push('Git worktree 状态已同步');
      await fetchProjectStashes(projectId);
      completedSyncTasks.push('Git stash 列表已同步');
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-stash-create-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `已创建 stash \`${result.ref}\`，保存 ${result.dirty_files} 个 dirty 文件。Workspace 已清理编辑器缓存，并重新同步 Explorer、worktree 与 stash 真源；该操作未提交、reset、pop、drop 或 clear stash。`,
        statusContent: 'stash 创建完成',
        engineeringState: buildGitStashCreateSuccessState(result, completedSyncTasks),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-stash-create-post-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `stash \`${result.ref}\` 的创建请求已执行，且编辑器缓存已清理；但创建后的资源同步失败：${failureMessage}。请刷新 Explorer 与 Git 面板确认文件、worktree 和 stash 真源后再继续编辑。`,
        statusContent: 'stash 已创建但资源同步失败',
        engineeringState: buildGitStashCreatePostSyncFailureState(result, failureMessage, completedSyncTasks),
        suggestedActions: buildCommitRestorePostSyncFailureActions('file_tree'),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    fetchProjectStashes,
    fetchProjectWorktreeStatus,
    isRestoringCommit,
    projectInfo,
    refreshProjectFileTree,
    setActiveFile,
    setEditorBufferStatuses,
    setFiles,
    setGitCommitDetailStatus,
    applyResourceGitMessages,
    setMobileEditingFile,
    setMobileFileContent,
    setOpenFiles,
    setSavedFiles,
  ]);

  const handleApplyGitStash = useCallback(async (stashRef: string) => {
    const projectId = getWorkspaceResourceOperationProjectId(projectInfo);
    if (projectId === null || isRestoringCommit === true) return;
    const normalizedStashRef = stashRef.trim();
    const hasNormalizedStashRef = hasWorkspaceResourceOperationTextValue(normalizedStashRef);
    if (hasNormalizedStashRef === false) return;

    let result: GitStashApplyResult;
    try {
      result = await projectApi.applyStash(projectId, normalizedStashRef);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-stash-apply-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `应用 stash \`${normalizedStashRef}\` 失败：${failureMessage}。当前工作区没有确认该 stash 已应用，请打开 Git 面板和 Explorer 后重新确认。`,
        statusContent: 'stash 应用失败',
        engineeringState: buildGitStashApplyFailureState(normalizedStashRef, failureMessage),
        suggestedActions: buildCommitRestoreFailureActions(),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    if (result.status === 'blocked') {
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-stash-apply-blocked-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `应用 stash \`${result.ref}\` 已被 guard 阻断：${result.message}。${result.recovery}`,
        statusContent: 'stash 应用被阻断',
        engineeringState: buildGitStashApplyBlockedState(result),
        suggestedActions: buildCommitRestoreFailureActions(),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    const completedSyncTasks: WorkspaceResourceOperationCompletedSyncTaskList = [];
    const commitHash = result.commit_hash.trim();
    const hasCommitHash = hasWorkspaceResourceOperationTextValue(commitHash);
    const commitHashSegment = hasCommitHash === true ? `，并创建应用快照 \`${commitHash}\`` : '';
    setFiles(new Map());
    setSavedFiles(new Map());
    setEditorBufferStatuses(new Map());
    setOpenFiles([]);
    setActiveFile(null);
    setMobileEditingFile(null);
    setMobileFileContent('');
    setSelectedCommit(null);
    setGitCommitDetailStatus(null);

    try {
      await refreshProjectFileTree(projectId, true, {
        throwOnFailure: true,
        suppressNotice: true,
      });
      completedSyncTasks.push('Explorer 文件树已同步');
      await fetchProjectWorktreeStatus(projectId);
      completedSyncTasks.push('Git worktree 状态已同步');
      await fetchProjectStashes(projectId);
      completedSyncTasks.push('Git stash 列表已同步');
      await fetchProjectCommits(projectId);
      completedSyncTasks.push('Git 提交列表已同步');
      await fetchProjectBranches(projectId);
      completedSyncTasks.push('Git 分支列表已同步');
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-stash-apply-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `已应用 stash \`${result.ref}\`${commitHashSegment}。Workspace 已清理编辑器缓存，并重新同步 Explorer、worktree、stash、提交和分支真源；stash 记录未被 pop/drop/clear。`,
        statusContent: 'stash 应用完成',
        engineeringState: buildGitStashApplySuccessState(result, completedSyncTasks),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-stash-apply-post-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `stash \`${result.ref}\` 的应用请求已执行，且编辑器缓存已清理；但应用后的资源同步失败：${failureMessage}。请刷新 Explorer 与 Git 面板确认文件和 Git 真源后再继续编辑。`,
        statusContent: 'stash 已应用但资源同步失败',
        engineeringState: buildGitStashApplyPostSyncFailureState(result, failureMessage, completedSyncTasks),
        suggestedActions: buildCommitRestorePostSyncFailureActions('commit_list'),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    fetchProjectBranches,
    fetchProjectCommits,
    fetchProjectStashes,
    fetchProjectWorktreeStatus,
    isRestoringCommit,
    projectInfo,
    refreshProjectFileTree,
    setActiveFile,
    setEditorBufferStatuses,
    setFiles,
    setGitCommitDetailStatus,
    applyResourceGitMessages,
    setMobileEditingFile,
    setMobileFileContent,
    setOpenFiles,
    setSavedFiles,
    setSelectedCommit,
  ]);

  const handleCreateGitBranch = useCallback(async (branchName: string) => {
    const projectId = getWorkspaceResourceOperationPersistedProjectId(projectInfo);
    if (projectId === null) return;
    const normalizedBranchName = branchName.trim();
    const hasNormalizedBranchName = hasWorkspaceResourceOperationTextValue(normalizedBranchName);
    if (hasNormalizedBranchName === false) return;

    let result: GitBranchCreateResult;
    try {
      result = await projectApi.createBranch(projectId, normalizedBranchName);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-create-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `创建 Git 分支 \`${normalizedBranchName}\` 失败：${failureMessage}。当前工作区没有确认新分支已创建，请刷新 Git 面板后重新确认。`,
        statusContent: 'Git 分支创建失败',
        engineeringState: buildGitBranchCreateFailureState(normalizedBranchName, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    if (result.status === 'blocked') {
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-create-blocked-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `创建 Git 分支 \`${result.name}\` 已被 guard 阻断：${result.message}。${result.recovery}`,
        statusContent: 'Git 分支创建被阻断',
        engineeringState: buildGitBranchCreateBlockedState(result),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    try {
      await fetchProjectBranches(projectId, result.name);
      const fromBranchLabel = getGitBranchCreateFromBranchLabel(result);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-create-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `已从 \`${fromBranchLabel}\` 创建 Git 分支 \`${result.name}\`，当前工作区未执行 checkout。Git 分支列表已同步，新分支已作为对比目标；如需进入该分支，请等待 readiness guard 通过后显式切换。`,
        statusContent: 'Git 分支创建完成',
        engineeringState: buildGitBranchCreateSuccessState(result),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-create-post-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `Git 分支 \`${result.name}\` 已创建，但分支列表同步失败：${failureMessage}。当前 Git 面板可能仍是旧分支快照，请重新刷新 Git 分支列表后再执行对比或切换。`,
        statusContent: '分支已创建但同步失败',
        engineeringState: buildGitBranchCreatePostSyncFailureState(result, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    fetchProjectBranches,
    projectInfo,
    applyResourceGitMessages,
  ]);

  const handleCreateGitTag = useCallback(async (tagName: string) => {
    const projectId = getWorkspaceResourceOperationPersistedProjectId(projectInfo);
    if (projectId === null) return;
    const normalizedTagName = tagName.trim();
    const hasNormalizedTagName = hasWorkspaceResourceOperationTextValue(normalizedTagName);
    if (hasNormalizedTagName === false) return;

    let result: GitTagCreateResult;
    try {
      result = await projectApi.createTag(projectId, normalizedTagName);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-tag-create-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `创建 Git 标签 \`${normalizedTagName}\` 失败：${failureMessage}。当前工作区没有确认新标签已创建，请刷新 Git 面板后重新确认。`,
        statusContent: 'Git 标签创建失败',
        engineeringState: buildGitTagCreateFailureState(normalizedTagName, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    if (result.status === 'blocked') {
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-tag-create-blocked-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `创建 Git 标签 \`${result.name}\` 已被 guard 阻断：${result.message}。${result.recovery}`,
        statusContent: 'Git 标签创建被阻断',
        engineeringState: buildGitTagCreateBlockedState(result),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    try {
      await fetchProjectTags(projectId);
      const currentBranchLabel = getGitTagCreateCurrentBranchLabel(result);
      const targetCommitLabel = getGitTagCreateTargetCommitLabel(result);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-tag-create-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `已在 \`${currentBranchLabel}\` 的当前 HEAD 创建 Git 标签 \`${result.name}\`，指向 \`${targetCommitLabel}\`。Workspace 已重新同步标签真源；该操作未执行 checkout、push tag、创建提交或修改工作区文件。`,
        statusContent: 'Git 标签创建完成',
        engineeringState: buildGitTagCreateSuccessState(result),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-tag-create-post-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `Git 标签 \`${result.name}\` 已创建，但标签列表同步失败：${failureMessage}。当前 Git 面板可能仍是旧标签快照，请重新刷新 Git 标签列表后再判断标签真源。`,
        statusContent: '标签已创建但同步失败',
        engineeringState: buildGitTagCreatePostSyncFailureState(result, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    fetchProjectTags,
    projectInfo,
    applyResourceGitMessages,
  ]);

  const handleDeleteGitTag = useCallback(async (tagName: string) => {
    const projectId = getWorkspaceResourceOperationPersistedProjectId(projectInfo);
    if (projectId === null) return;
    const normalizedTagName = tagName.trim();
    const hasNormalizedTagName = hasWorkspaceResourceOperationTextValue(normalizedTagName);
    if (hasNormalizedTagName === false) return;

    let result: GitTagDeleteResult;
    try {
      result = await projectApi.deleteTag(projectId, normalizedTagName);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-tag-delete-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `删除 Git 标签 \`${normalizedTagName}\` 失败：${failureMessage}。当前工作区没有确认目标标签已删除，请刷新 Git 面板后重新确认。`,
        statusContent: 'Git 标签删除失败',
        engineeringState: buildGitTagDeleteFailureState(normalizedTagName, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    if (result.status === 'blocked') {
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-tag-delete-blocked-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `删除 Git 标签 \`${result.name}\` 已被 guard 阻断：${result.message}。${result.recovery}`,
        statusContent: 'Git 标签删除被阻断',
        engineeringState: buildGitTagDeleteBlockedState(result),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    try {
      await fetchProjectTags(projectId);
      const targetCommitLabel = getGitTagDeleteTargetCommitLabel(result);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-tag-delete-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `已删除本地 Git 标签 \`${result.name}\`，原目标为 \`${targetCommitLabel}\`。Workspace 已重新同步标签真源；该操作未执行 checkout、push、删除远端标签、创建提交或修改工作区文件。`,
        statusContent: 'Git 标签删除完成',
        engineeringState: buildGitTagDeleteSuccessState(result),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-tag-delete-post-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `Git 标签 \`${result.name}\` 已删除，但标签列表同步失败：${failureMessage}。当前 Git 面板可能仍是旧标签快照，请重新刷新 Git 标签列表后再判断标签真源。`,
        statusContent: '标签已删除但同步失败',
        engineeringState: buildGitTagDeletePostSyncFailureState(result, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    fetchProjectTags,
    projectInfo,
    applyResourceGitMessages,
  ]);

  const handleCreateGitBranchFromRemote = useCallback(async (remoteBranch: string, branchName: string) => {
    const projectId = getWorkspaceResourceOperationPersistedProjectId(projectInfo);
    if (projectId === null) return;
    const normalizedRemoteBranch = remoteBranch.trim();
    const normalizedBranchName = branchName.trim();
    const hasNormalizedRemoteBranch = hasWorkspaceResourceOperationTextValue(normalizedRemoteBranch);
    const hasNormalizedBranchName = hasWorkspaceResourceOperationTextValue(normalizedBranchName);
    if (hasNormalizedRemoteBranch === false || hasNormalizedBranchName === false) return;

    let result: GitBranchCreateFromRemoteResult;
    try {
      result = await projectApi.createBranchFromRemote(projectId, normalizedRemoteBranch, normalizedBranchName);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-create-from-remote-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `从远端引用 \`${normalizedRemoteBranch}\` 创建本地分支 \`${normalizedBranchName}\` 失败：${failureMessage}。当前工作区没有确认新分支已创建；该操作不会执行 fetch，请刷新远端分支与本地分支列表后重新确认。`,
        statusContent: '从远端引用创建本地分支失败',
        engineeringState: buildGitBranchCreateFromRemoteFailureState(normalizedRemoteBranch, normalizedBranchName, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    if (result.status === 'blocked') {
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-create-from-remote-blocked-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `从远端引用 \`${result.remote_branch}\` 创建本地分支 \`${result.name}\` 已被 guard 阻断：${result.message}。${result.recovery}`,
        statusContent: '从远端引用创建本地分支被阻断',
        engineeringState: buildGitBranchCreateFromRemoteBlockedState(result),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    try {
      await fetchProjectBranches(projectId, result.name);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-create-from-remote-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `已从本地已有远端引用 \`${result.remote_branch}\` 创建本地跟踪分支 \`${result.name}\`，当前工作区未执行 checkout、fetch、pull、push 或 prune。Git 分支列表已同步，新分支已作为对比目标；如需进入该分支，请等待 readiness guard 通过后显式切换。`,
        statusContent: '从远端引用创建本地分支完成',
        engineeringState: buildGitBranchCreateFromRemoteSuccessState(result),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-create-from-remote-post-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `本地跟踪分支 \`${result.name}\` 已从远端引用 \`${result.remote_branch}\` 创建，但分支列表同步失败：${failureMessage}。当前 Git 面板可能仍是旧分支快照，请重新刷新 Git 分支列表后再执行对比或切换。`,
        statusContent: '远端引用分支已创建但同步失败',
        engineeringState: buildGitBranchCreateFromRemotePostSyncFailureState(result, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    fetchProjectBranches,
    projectInfo,
    applyResourceGitMessages,
  ]);

  const handleRefreshGitRemoteBranches = useCallback(async (remoteName: string) => {
    const projectId = getWorkspaceResourceOperationPersistedProjectId(projectInfo);
    if (projectId === null) return;
    const normalizedRemoteName = remoteName.trim();
    const hasNormalizedRemoteName = hasWorkspaceResourceOperationTextValue(normalizedRemoteName);
    if (hasNormalizedRemoteName === false) return;

    let result: GitRemoteBranchRefreshResult;
    try {
      result = await projectApi.refreshRemoteBranches(projectId, normalizedRemoteName);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-remote-branch-refresh-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `刷新 Git remote \`${normalizedRemoteName}\` 的远端引用失败：${failureMessage}。当前 Git 远端分支列表没有确认已更新；该操作不会执行 pull、push、prune、checkout 或修改工作区文件。`,
        statusContent: 'Git 远端引用刷新失败',
        engineeringState: buildGitRemoteBranchRefreshFailureState(normalizedRemoteName, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    if (result.status === 'blocked') {
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-remote-branch-refresh-blocked-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `刷新 Git remote \`${result.remote}\` 的远端引用已被 guard 阻断：${result.message}。${result.recovery}`,
        statusContent: 'Git 远端引用刷新被阻断',
        engineeringState: buildGitRemoteBranchRefreshBlockedState(result),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    try {
      await fetchProjectRemoteBranches(projectId);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-remote-branch-refresh-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `已受控刷新 Git remote \`${result.remote}\` 的远端引用，并重新同步远端分支列表。当前操作没有执行 pull、push、prune、checkout 或修改工作区文件。`,
        statusContent: 'Git 远端引用刷新完成',
        engineeringState: buildGitRemoteBranchRefreshSuccessState(result),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-remote-branch-refresh-post-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `Git remote \`${result.remote}\` 的远端引用已刷新，但远端分支列表同步失败：${failureMessage}。当前 Git 面板可能仍显示旧 remote refs，请重新刷新远端分支列表后再创建本地跟踪分支。`,
        statusContent: '远端引用已刷新但列表同步失败',
        engineeringState: buildGitRemoteBranchRefreshPostSyncFailureState(result, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    fetchProjectRemoteBranches,
    projectInfo,
    applyResourceGitMessages,
  ]);

  const handleDeleteGitBranch = useCallback(async (branchName: string) => {
    const projectId = getWorkspaceResourceOperationPersistedProjectId(projectInfo);
    if (projectId === null) return;
    const normalizedBranchName = branchName.trim();
    const hasNormalizedBranchName = hasWorkspaceResourceOperationTextValue(normalizedBranchName);
    if (hasNormalizedBranchName === false) return;

    let result: GitBranchDeleteResult;
    try {
      result = await projectApi.deleteBranch(projectId, normalizedBranchName);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-delete-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `删除 Git 分支 \`${normalizedBranchName}\` 失败：${failureMessage}。当前工作区没有确认该分支已删除，请刷新 Git 面板后重新确认。`,
        statusContent: 'Git 分支删除失败',
        engineeringState: buildGitBranchDeleteFailureState(normalizedBranchName, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    if (result.status === 'blocked') {
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-delete-blocked-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `删除 Git 分支 \`${result.name}\` 已被 guard 阻断：${result.message}。${result.recovery}`,
        statusContent: 'Git 分支删除被阻断',
        engineeringState: buildGitBranchDeleteBlockedState(result),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    try {
      await fetchProjectBranches(projectId, result.current_branch);
      const currentBranchLabel = getGitBranchDeleteCurrentBranchLabel(result);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-delete-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `已删除 Git 本地分支 \`${result.name}\`，当前分支仍为 \`${currentBranchLabel}\`。Workspace 未执行 checkout、switch、merge、reset 或远端删除，Git 分支列表已重新同步。`,
        statusContent: 'Git 分支删除完成',
        engineeringState: buildGitBranchDeleteSuccessState(result),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-delete-post-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `Git 分支 \`${result.name}\` 已删除，但分支列表同步失败：${failureMessage}。当前 Git 面板可能仍是旧分支快照，请重新刷新 Git 分支列表后再执行对比或切换。`,
        statusContent: '分支已删除但同步失败',
        engineeringState: buildGitBranchDeletePostSyncFailureState(result, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    fetchProjectBranches,
    projectInfo,
    applyResourceGitMessages,
  ]);

  const handleRenameGitBranch = useCallback(async (previousName: string, nextName: string) => {
    const projectId = getWorkspaceResourceOperationPersistedProjectId(projectInfo);
    if (projectId === null) return;
    const normalizedPreviousName = previousName.trim();
    const normalizedNextName = nextName.trim();
    const hasNormalizedPreviousName = hasWorkspaceResourceOperationTextValue(normalizedPreviousName);
    const hasNormalizedNextName = hasWorkspaceResourceOperationTextValue(normalizedNextName);
    if (hasNormalizedPreviousName === false || hasNormalizedNextName === false) return;

    let result: GitBranchRenameResult;
    try {
      result = await projectApi.renameBranch(projectId, normalizedPreviousName, normalizedNextName);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-rename-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `重命名 Git 分支 \`${normalizedPreviousName}\` 为 \`${normalizedNextName}\` 失败：${failureMessage}。当前工作区没有确认该分支已重命名，请刷新 Git 面板后重新确认。`,
        statusContent: 'Git 分支重命名失败',
        engineeringState: buildGitBranchRenameFailureState(normalizedPreviousName, normalizedNextName, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    if (result.status === 'blocked') {
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-rename-blocked-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `重命名 Git 分支 \`${result.previous_name}\` 为 \`${result.name}\` 已被 guard 阻断：${result.message}。${result.recovery}`,
        statusContent: 'Git 分支重命名被阻断',
        engineeringState: buildGitBranchRenameBlockedState(result),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    try {
      await fetchProjectBranches(projectId, result.name);
      const currentBranchLabel = getGitBranchRenameCurrentBranchLabel(result);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-rename-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `已将 Git 本地分支 \`${result.previous_name}\` 重命名为 \`${result.name}\`，当前分支仍为 \`${currentBranchLabel}\`。Workspace 未执行 checkout、switch、merge、reset、删除或远端操作，Git 分支列表已重新同步。`,
        statusContent: 'Git 分支重命名完成',
        engineeringState: buildGitBranchRenameSuccessState(result),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-rename-post-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `Git 分支 \`${result.previous_name}\` 已重命名为 \`${result.name}\`，但分支列表同步失败：${failureMessage}。当前 Git 面板可能仍是旧分支快照，请重新刷新 Git 分支列表后再执行对比或切换。`,
        statusContent: '分支已重命名但同步失败',
        engineeringState: buildGitBranchRenamePostSyncFailureState(result, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    fetchProjectBranches,
    projectInfo,
    applyResourceGitMessages,
  ]);

  const handleSwitchGitBranch = useCallback(async (targetBranch: string) => {
    const projectId = getWorkspaceResourceOperationPersistedProjectId(projectInfo);
    if (projectId === null) return;
    const normalizedTargetBranch = targetBranch.trim();
    const hasNormalizedTargetBranch = hasWorkspaceResourceOperationTextValue(normalizedTargetBranch);
    if (hasNormalizedTargetBranch === false) return;

    let result: GitBranchSwitchResult;
    try {
      result = await projectApi.switchBranch(projectId, normalizedTargetBranch);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-switch-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `切换到分支 \`${normalizedTargetBranch}\` 失败：${failureMessage}。当前工作区未确认切换成功，请刷新 Git 面板和 Explorer 后再继续。`,
        statusContent: 'Git 分支切换失败',
        engineeringState: buildGitBranchSwitchFailureState(normalizedTargetBranch, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    if (result.status === 'blocked') {
      setGitBranchSwitchReadiness(result.readiness);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-switch-blocked-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `切换到分支 \`${result.target_branch}\` 已被 readiness guard 阻断：${result.message}。${result.recovery}`,
        statusContent: 'Git 分支切换被预检阻断',
        engineeringState: buildGitBranchSwitchBlockedState(result.readiness),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    const completedSyncTasks: WorkspaceResourceOperationCompletedSyncTaskList = [];
    setFiles(new Map());
    setSavedFiles(new Map());
    setEditorBufferStatuses(new Map());
    setOpenFiles([]);
    setActiveFile(null);
    setMobileEditingFile(null);
    setMobileFileContent('');
    setSelectedCommit(null);
    setGitCommitDetailStatus(null);

    try {
      await fetchProjectDetail(projectId);
      completedSyncTasks.push('项目详情已同步');
      await refreshProjectFileTree(projectId, true, {
        throwOnFailure: true,
        suppressNotice: true,
      });
      completedSyncTasks.push('Explorer 文件树已同步');
      await fetchProjectBranches(projectId);
      completedSyncTasks.push('Git 分支列表已同步');
      await fetchProjectCommits(projectId);
      completedSyncTasks.push('Git 提交列表已同步');
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-switch-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `已切换到分支 \`${result.current_branch}\`。Workspace 已清理旧编辑器缓存，并重新同步项目详情、Explorer、Git 分支和提交列表。`,
        statusContent: 'Git 分支切换完成',
        engineeringState: buildGitBranchSwitchSuccessState(result),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      applyResourceGitMessages((prev) => [...prev, {
        id: `git-branch-switch-post-sync-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `分支已切换到 \`${result.current_branch}\`，且旧编辑器缓存已清理；但切换后的资源同步失败：${failureMessage}。请刷新 Explorer 与 Git 面板确认当前分支真源后再继续编辑。`,
        statusContent: '分支已切换但资源同步失败',
        engineeringState: buildGitBranchSwitchPostSyncFailureState(result, failureMessage, completedSyncTasks),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    fetchProjectBranches,
    fetchProjectCommits,
    fetchProjectDetail,
    projectInfo,
    refreshProjectFileTree,
    setActiveFile,
    setEditorBufferStatuses,
    setFiles,
    setGitBranchSwitchReadiness,
    setGitCommitDetailStatus,
    applyResourceGitMessages,
    setMobileEditingFile,
    setMobileFileContent,
    setOpenFiles,
    setSavedFiles,
    setSelectedCommit,
  ]);

  const confirmRestoreCommit = useCallback(async () => {
    const projectId = getWorkspaceResourceOperationProjectId(projectInfo);
    if (projectId === null || isRestoringCommit === true || pendingRestoreCommit === null) return;
    const restoreCommit = pendingRestoreCommit;

    const completedSyncTasks: WorkspaceResourceOperationCompletedSyncTaskList = [];
    try {
      setIsRestoringCommit(true);
      try {
        await projectApi.restoreCommit(projectId, restoreCommit.hash);
      } catch (error) {
        const failureMessage = formatWorkspaceResourceOperationFailure(error);
        applyResourceGitMessages((prev) => [...prev, {
          id: `restore-commit-failed-${Date.now()}`,
          role: 'assistant',
          kind: 'workflow',
          content: `回到版本 \`${restoreCommit.hash}\` 失败：${failureMessage}。当前工作区没有可靠恢复到目标提交，Explorer、编辑器缓存或 Git 面板仍可能停留在恢复前状态；请打开 Git 面板确认提交列表后重新恢复。`,
          statusContent: '版本恢复失败',
          engineeringState: buildCommitRestoreFailureState(restoreCommit, failureMessage),
          suggestedActions: buildCommitRestoreFailureActions(),
          timestamp: new Date().toISOString(),
        }]);
        return;
      }

      setFiles(new Map());
      setSavedFiles(new Map());
      setEditorBufferStatuses(new Map());
      setOpenFiles([]);
      setActiveFile(null);
      setMobileEditingFile(null);
      setMobileFileContent('');

      await runCommitRestoreSyncStage(
        'project_detail',
        () => fetchProjectDetail(projectId),
        projectId,
        restoreCommit.hash,
      );
      completedSyncTasks.push('项目详情已同步');
      await runCommitRestoreSyncStage(
        'file_tree',
        () => refreshProjectFileTree(projectId, true, {
          throwOnFailure: true,
          suppressNotice: true,
        }),
        projectId,
        restoreCommit.hash,
      );
      completedSyncTasks.push('Explorer 文件树已同步');
      let latestCommits: GitCommit[] = [];
      await runCommitRestoreSyncStage(
        'commit_list',
        async () => {
          latestCommits = await fetchProjectCommits(projectId);
        },
        projectId,
        restoreCommit.hash,
      );
      completedSyncTasks.push('Git 提交列表已同步');
      const restoredCommit = getWorkspaceResourceOperationRestoredCommitAfterRefresh({
        latestCommits,
        restoreCommit,
      });
      setSelectedCommit(restoredCommit);
      setGitCommitDetailStatus(buildFreshGitCommitDetailStatus({
        source: 'commit_restore',
        commitHash: restoredCommit.hash,
      }));
      applyResourceGitMessages((prev) => [...prev, {
        id: `restore-commit-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `已回到版本 \`${restoreCommit.hash}\`，当前工作区内容已恢复到该提交。`,
        statusContent: '版本恢复完成',
        engineeringState: buildCommitRestoreSuccessState(restoredCommit),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      const syncFailureStage = getWorkspaceResourceOperationCommitRestoreSyncFailureStage(error);
      if (syncFailureStage !== undefined) {
        setSelectedCommit(restoreCommit);
        setGitCommitDetailStatus(buildCommitRestoreStaleGitCommitDetailStatus({
          commitHash: restoreCommit.hash,
          syncFailureStage,
        }));
        applyResourceGitMessages((prev) => [...prev, {
          id: `restore-commit-post-sync-failed-${Date.now()}`,
          role: 'assistant',
          kind: 'workflow',
          content: `版本 \`${restoreCommit.hash}\` 的恢复请求已执行，且本地编辑器缓存已清理；但恢复后的资源同步失败：${failureMessage}。当前 Explorer 或 Git 面板可能还没有确认目标版本真源，请通过恢复入口重新校准。`,
          statusContent: '版本已恢复但资源同步失败',
          engineeringState: buildCommitRestorePostSyncFailureState(
            restoreCommit,
            syncFailureStage,
            failureMessage,
            completedSyncTasks,
          ),
          suggestedActions: buildCommitRestorePostSyncFailureActions(syncFailureStage),
          timestamp: new Date().toISOString(),
        }]);
        return;
      }
      applyResourceGitMessages((prev) => [...prev, {
        id: `restore-commit-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `回到版本 \`${restoreCommit.hash}\` 失败：${failureMessage}。当前工作区没有可靠恢复到目标提交，Explorer、编辑器缓存或 Git 面板仍可能停留在恢复前状态；请打开 Git 面板确认提交列表后重新恢复。`,
        statusContent: '版本恢复失败',
        engineeringState: buildCommitRestoreFailureState(restoreCommit, failureMessage),
        suggestedActions: buildCommitRestoreFailureActions(),
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setPendingRestoreCommit(null);
      setIsRestoringCommit(false);
    }
  }, [
    fetchProjectCommits,
    fetchProjectDetail,
    isRestoringCommit,
    pendingRestoreCommit,
    projectInfo,
    refreshProjectFileTree,
    setActiveFile,
    setEditorBufferStatuses,
    setFiles,
    setIsRestoringCommit,
    applyResourceGitMessages,
    setGitCommitDetailStatus,
    setMobileEditingFile,
    setMobileFileContent,
    setOpenFiles,
    setPendingRestoreCommit,
    setSavedFiles,
    setSelectedCommit,
  ]);

  return {
    saveFile,
    handleViewCommit,
    handleRestoreCommit,
    handleRestoreCommitFile,
    handleCommitWorktree,
    handleDiscardWorktreeFile,
    handleApplyGitBranchCompareFile,
    handleApplyGitStash,
    handleCreateGitStash,
    handleCreateGitBranch,
    handleCreateGitTag,
    handleDeleteGitTag,
    handleCreateGitBranchFromRemote,
    handleRefreshGitRemoteBranches,
    handleDeleteGitBranch,
    handleRenameGitBranch,
    handleSwitchGitBranch,
    confirmRestoreCommit,
  };
}
