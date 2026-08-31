import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { ApiError, projectApi } from '@/lib/api';
import type { Project, ProjectRuntimeStatus } from '@/lib/api';
import type { FileNode, GitBranch, GitBranchCompare, GitBranchSwitchReadiness, GitCommit, GitRemote, GitRemoteBranch, GitStash, GitTag, GitWorktreeStatus } from '@/lib/types';
import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceRuntimeStatus,
} from '@/lib/workspace/engineering-state';
import { formatPreviewUrlBuildFailure } from '@/lib/workspace/preview-url-build-errors';
import { appendWorkspaceDebugEvent } from '@/lib/workspace/workspace-debug-events';
import {
  buildProjectDetailFileTreeParseError,
  buildRuntimeStatusFailureError,
  buildRuntimeStatusWaitTimeoutError,
  formatWorkspaceRuntimeResourceFailure,
} from '@/lib/workspace/workspace-runtime-resource-errors';

import type { ExplorerSnapshotStatus, GitBranchCompareStatus, GitBranchListStatus, GitCommitListStatus, GitRemoteBranchListStatus, GitRemoteListStatus, GitStashListStatus, GitTagListStatus, GitWorktreeStatusState, PreviewUrlStatus, WorkspaceChatMessage, WorkspacePreviewUrlSurface, WorkspaceProjectInfo } from './workspace-types';
import type { ProjectPreviewUrlBuildResult } from './workspace-page-helpers';
import {
  buildFreshExplorerSnapshotStatus,
  buildStaleExplorerSnapshotStatus,
} from './workspace-explorer-snapshot-status';
import {
  buildFreshGitBranchCompareStatus,
  buildFreshGitBranchListStatus,
  buildFreshGitCommitListStatus,
  buildFreshGitRemoteBranchListStatus,
  buildFreshGitRemoteListStatus,
  buildFreshGitStashListStatus,
  buildFreshGitTagListStatus,
  buildFreshGitWorktreeStatus,
  buildNoTargetGitBranchCompareStatus,
  buildStaleGitBranchCompareStatus,
  buildStaleGitBranchListStatus,
  buildStaleGitCommitListStatus,
  buildStaleGitRemoteBranchListStatus,
  buildStaleGitRemoteListStatus,
  buildStaleGitStashListStatus,
  buildStaleGitTagListStatus,
  buildStaleGitWorktreeStatus,
} from './workspace-git-status';
import {
  buildPreviewUrlBuildFailureStatus,
  buildProjectDetailPreviewUrlStatus,
  buildRuntimeFreshPreviewUrlStatus,
} from './workspace-preview-url-status';
import type {
  WorkspaceFileTreeRefreshOptions,
  WorkspaceGitResourceRefreshOptions,
  WorkspaceRuntimeReadinessOptions,
  WorkspaceRuntimeStatusSnapshotOptions,
  WorkspaceRuntimeResourcesContract,
} from './workspace-runtime-resources-contract';

const FILE_TREE_REFRESH_THROTTLE_MS = 700;
const FILE_TREE_REFRESH_FAILURE_NOTICE_COOLDOWN_MS = 30_000;
const PROJECT_DETAIL_REFRESH_FAILURE_NOTICE_COOLDOWN_MS = 30_000;
const PROJECT_DETAIL_FILE_TREE_PARSE_FAILURE_NOTICE_COOLDOWN_MS = 30_000;
const RUNTIME_STATUS_SNAPSHOT_FAILURE_NOTICE_COOLDOWN_MS = 30_000;
const GIT_BRANCHES_REFRESH_FAILURE_NOTICE_COOLDOWN_MS = 30_000;
const GIT_REMOTES_REFRESH_FAILURE_NOTICE_COOLDOWN_MS = 30_000;
const GIT_REMOTE_BRANCHES_REFRESH_FAILURE_NOTICE_COOLDOWN_MS = 30_000;
const GIT_COMMITS_REFRESH_FAILURE_NOTICE_COOLDOWN_MS = 30_000;
const GIT_TAGS_REFRESH_FAILURE_NOTICE_COOLDOWN_MS = 30_000;
const GIT_STASHES_REFRESH_FAILURE_NOTICE_COOLDOWN_MS = 30_000;
const GIT_WORKTREE_STATUS_REFRESH_FAILURE_NOTICE_COOLDOWN_MS = 30_000;
const WORKSPACE_BOOTSTRAP_FAILURE_NOTICE_COOLDOWN_MS = 30_000;
const PREVIEW_URL_BUILD_FAILURE_NOTICE_COOLDOWN_MS = 30_000;

type WorkspaceRuntimeResourceMessageList = WorkspaceChatMessage[];

function getWorkspaceRuntimeResourceMessageIndex(
  messages: WorkspaceChatMessage[],
  messageId: string,
): number {
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const isTargetMessage = message.id === messageId;
    if (isTargetMessage === true) {
      return index;
    }
  }

  return -1;
}

function materializeWorkspaceRuntimeResourceUpsertedMessages(
  messages: WorkspaceChatMessage[],
  nextMessage: WorkspaceChatMessage,
): WorkspaceRuntimeResourceMessageList {
  const nextMessages: WorkspaceRuntimeResourceMessageList = [];
  const existingIndex = getWorkspaceRuntimeResourceMessageIndex(messages, nextMessage.id);

  for (let index = 0; index < messages.length; index += 1) {
    const shouldSkipExistingMessage = index === existingIndex;
    if (shouldSkipExistingMessage === true) {
      continue;
    }

    nextMessages.push(messages[index]);
  }

  nextMessages.push(nextMessage);
  return nextMessages;
}

function hasProjectDetailPreviewSourceUrl(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function hasWorkspaceRuntimeResourceTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getWorkspaceRuntimeResourcePersistedProject(projectInfo: WorkspaceProjectInfo | null): WorkspaceProjectInfo | null {
  if (projectInfo === null) {
    return null;
  }

  const isPersistedProject = projectInfo.isPersisted === true;
  if (isPersistedProject === false) {
    return null;
  }

  const hasProjectId = hasWorkspaceRuntimeResourceTextValue(projectInfo.projectId);
  if (hasProjectId === false) {
    return null;
  }

  return projectInfo;
}

function shouldFetchWorkspaceBootstrapGitResources({
  fileTreeFetched,
}: {
  fileTreeFetched: boolean;
}): boolean {
  return fileTreeFetched === true;
}

function shouldFetchWorkspaceBootstrapFileTree(projectInfo: WorkspaceProjectInfo): boolean {
  const isPersistedProject = projectInfo.isPersisted === true;
  return isPersistedProject === true;
}

function hasWorkspaceRuntimeSelectedPlan(projectInfo: WorkspaceProjectInfo): boolean {
  const hasPlanId = hasWorkspaceRuntimeResourceTextValue(projectInfo.planId);
  if (hasPlanId === true) {
    return true;
  }

  const hasPlanData = hasWorkspaceRuntimeResourceTextValue(projectInfo.planData);
  return hasPlanData === true;
}

function getWorkspaceRuntimeResourceStatusValue(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return value.toLowerCase();
}

function getWorkspaceRuntimeProjectRuntimeStatusValue(runtimeStatus: ProjectRuntimeStatus | null | undefined): string {
  if (runtimeStatus === null || runtimeStatus === undefined) {
    return '';
  }

  return getWorkspaceRuntimeResourceStatusValue(runtimeStatus.status);
}

function getWorkspaceRuntimeResourceTextValue(value: string | null | undefined, fallback: string): string {
  const hasValue = hasWorkspaceRuntimeResourceTextValue(value);
  if (hasValue === true) {
    return value;
  }

  return fallback;
}

function getWorkspaceRuntimeResourceOptionalFallbackTextValue<T extends string>(
  value: T | null | undefined,
  fallback: T | undefined,
): T | undefined {
  const hasValue = hasWorkspaceRuntimeResourceTextValue(value);
  if (hasValue === true) {
    return value;
  }

  return fallback;
}

function getWorkspaceRuntimeResourceOptionalTextValue(value: string | null | undefined): string | undefined {
  const hasValue = hasWorkspaceRuntimeResourceTextValue(value);
  if (hasValue === true) {
    return value;
  }

  return undefined;
}

function getWorkspaceRuntimeResourceNumberValue(value: number | null | undefined, fallback: number | undefined): number | undefined {
  if (value === null || value === undefined) {
    return fallback;
  }

  return value;
}

function getWorkspaceRuntimeResourceProjectAppType(projectInfo: WorkspaceProjectInfo | null): string | undefined {
  if (projectInfo === null) {
    return undefined;
  }

  return getWorkspaceRuntimeResourceOptionalTextValue(projectInfo.appType);
}

function getWorkspaceRuntimeResourceProjectName(projectInfo: WorkspaceProjectInfo | null): string | undefined {
  if (projectInfo === null) {
    return undefined;
  }

  return getWorkspaceRuntimeResourceOptionalTextValue(projectInfo.projectName);
}

function getWorkspaceRuntimeResourcePreviewStatusUrl(status: PreviewUrlStatus | null): string {
  if (status === null) {
    return 'about:blank';
  }

  return getWorkspaceRuntimeResourceTextValue(status.url, 'about:blank');
}

function getWorkspaceRuntimeResourceEngineeringNextAction(
  engineeringState: WorkspaceEngineeringStateSnapshot,
  fallbackMessage: string,
): string {
  if (engineeringState.execution === undefined) {
    return fallbackMessage;
  }

  return getWorkspaceRuntimeResourceTextValue(engineeringState.execution.next_action, fallbackMessage);
}

function isWorkspaceRuntimeResourceEngineeringStateStreaming(
  engineeringState: WorkspaceEngineeringStateSnapshot,
): boolean {
  if (engineeringState.runtime === undefined) {
    return false;
  }

  const isRunning = engineeringState.runtime.status === 'running';
  if (isRunning === true) {
    return true;
  }

  const isPending = engineeringState.runtime.status === 'pending';
  return isPending === true;
}

function appendWorkspaceRuntimeDebugEvent({
  projectId,
  title,
  detail,
  source,
  recovery,
}: {
  projectId: string;
  title: string;
  detail: string;
  source: string;
  recovery: string;
}): void {
  appendWorkspaceDebugEvent({
    projectId,
    category: 'runtime',
    severity: 'warning',
    title,
    detail,
    source,
    recovery,
  });
}

function getWorkspaceRuntimeResourceProjectDetailAppType(
  projectAppType: string | null | undefined,
  projectInfo: WorkspaceProjectInfo | null,
): string | undefined {
  const appType = getWorkspaceRuntimeResourceOptionalTextValue(projectAppType);
  if (appType !== undefined) {
    return appType;
  }

  return getWorkspaceRuntimeResourceProjectAppType(projectInfo);
}

function getWorkspaceRuntimeResourceFirstBranch(branches: GitBranch[]): GitBranch | undefined {
  for (const branch of branches) {
    return branch;
  }

  return undefined;
}

function getWorkspaceRuntimeResourceCurrentBranchName(branches: GitBranch[]): string {
  for (const branch of branches) {
    const isCurrentBranch = branch.is_current === true;
    const hasBranchName = hasWorkspaceRuntimeResourceTextValue(branch.name);
    if (isCurrentBranch === true && hasBranchName === true) {
      return branch.name;
    }
  }

  const firstBranch = getWorkspaceRuntimeResourceFirstBranch(branches);
  if (firstBranch === undefined) {
    return '';
  }

  return getWorkspaceRuntimeResourceTextValue(firstBranch.name, '');
}

function getWorkspaceRuntimeResourceTargetBranchName(
  branches: GitBranch[],
  preferredTargetBranch: string,
  currentBranch: string,
): string {
  const preferredTarget = preferredTargetBranch.trim();
  const hasPreferredTarget = hasWorkspaceRuntimeResourceTextValue(preferredTarget);
  if (hasPreferredTarget === true) {
    for (const branch of branches) {
      const isPreferredBranch = branch.name === preferredTarget;
      const isDifferentBranch = branch.name !== currentBranch;
      if (isPreferredBranch === true && isDifferentBranch === true) {
        return branch.name;
      }
    }
  }

  for (const branch of branches) {
    const hasBranchName = hasWorkspaceRuntimeResourceTextValue(branch.name);
    const isDifferentBranch = branch.name !== currentBranch;
    if (hasBranchName === true && isDifferentBranch === true) {
      return branch.name;
    }
  }

  return '';
}

function hasWorkspaceRuntimeResourceBranchCompareTarget(currentBranch: string, targetBranch: string): boolean {
  const hasCurrentBranch = hasWorkspaceRuntimeResourceTextValue(currentBranch);
  if (hasCurrentBranch === false) {
    return false;
  }

  const hasTargetBranch = hasWorkspaceRuntimeResourceTextValue(targetBranch);
  return hasTargetBranch === true;
}

function getWorkspaceRuntimeResourceBranchCompareStatusBaseBranch(status: GitBranchCompareStatus | null): string {
  if (status === null) {
    return '';
  }

  return getWorkspaceRuntimeResourceTextValue(status.baseBranch, '');
}

function getWorkspaceRuntimeResourceBranchCompareStatusHeadBranch(status: GitBranchCompareStatus | null): string {
  if (status === null) {
    return '';
  }

  return getWorkspaceRuntimeResourceTextValue(status.headBranch, '');
}

function getWorkspaceRuntimeResourceNoticeTimestamp(
  noticeMap: Map<string, number>,
  projectId: string,
): number {
  const lastNoticeAt = noticeMap.get(projectId);
  if (lastNoticeAt === undefined) {
    return 0;
  }

  return lastNoticeAt;
}

function shouldPublishWorkspaceRuntimeResourceNotice(
  now: number,
  lastNoticeAt: number,
  cooldownMs: number,
): boolean {
  const elapsedMs = now - lastNoticeAt;
  const cooldownElapsed = elapsedMs >= cooldownMs;
  return cooldownElapsed === true;
}

function shouldPublishWorkspaceRuntimeResourceRefreshNotice(
  options: WorkspaceFileTreeRefreshOptions | WorkspaceGitResourceRefreshOptions,
  now: number,
  lastNoticeAt: number,
  cooldownMs: number,
): boolean {
  const isSuppressed = options.suppressNotice === true;
  if (isSuppressed === true) {
    return false;
  }

  return shouldPublishWorkspaceRuntimeResourceNotice(now, lastNoticeAt, cooldownMs);
}

type UseWorkspaceRuntimeResourcesOptions = {
  projectInfo: WorkspaceProjectInfo | null;
  isGenerating: boolean;
  implementingPlanRef: MutableRefObject<boolean>;
  safeParseJSON: <T>(raw: string, fallback: T) => T;
  normalizeFileTreePayload: (tree: FileNode | FileNode[] | null | undefined) => FileNode[];
  buildProjectPreviewUrlResult: (projectId: string, explicitPreviewUrl?: string | null) => ProjectPreviewUrlBuildResult;
  appTypeNeedsRuntime: (appType?: string | null) => boolean;
  setProjectInfo: Dispatch<SetStateAction<WorkspaceProjectInfo | null>>;
  setFileTree: Dispatch<SetStateAction<FileNode[]>>;
  setExplorerSnapshotStatus: Dispatch<SetStateAction<ExplorerSnapshotStatus | null>>;
  setExpandedFolders: Dispatch<SetStateAction<Set<string>>>;
  setBrowserUrl: Dispatch<SetStateAction<string>>;
  setPreviewUrlStatus: Dispatch<SetStateAction<PreviewUrlStatus | null>>;
  setMobileBrowserUrl: Dispatch<SetStateAction<string>>;
  setMobilePreviewUrlStatus: Dispatch<SetStateAction<PreviewUrlStatus | null>>;
  setGenerationStage: Dispatch<SetStateAction<string>>;
  applyRuntimeResourceMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  gitBranches: GitBranch[];
  gitBranchCompareTarget: string;
  setGitBranches: Dispatch<SetStateAction<GitBranch[]>>;
  setGitBranchListStatus: Dispatch<SetStateAction<GitBranchListStatus | null>>;
  setGitRemotes: Dispatch<SetStateAction<GitRemote[]>>;
  setGitRemoteListStatus: Dispatch<SetStateAction<GitRemoteListStatus | null>>;
  setGitRemoteBranches: Dispatch<SetStateAction<GitRemoteBranch[]>>;
  setGitRemoteBranchListStatus: Dispatch<SetStateAction<GitRemoteBranchListStatus | null>>;
  setGitTags: Dispatch<SetStateAction<GitTag[]>>;
  setGitTagListStatus: Dispatch<SetStateAction<GitTagListStatus | null>>;
  setGitStashes: Dispatch<SetStateAction<GitStash[]>>;
  setGitStashListStatus: Dispatch<SetStateAction<GitStashListStatus | null>>;
  setGitWorktreeStatus: Dispatch<SetStateAction<GitWorktreeStatus | null>>;
  setGitWorktreeStatusState: Dispatch<SetStateAction<GitWorktreeStatusState | null>>;
  setGitBranchCompare: Dispatch<SetStateAction<GitBranchCompare | null>>;
  setGitBranchCompareStatus: Dispatch<SetStateAction<GitBranchCompareStatus | null>>;
  setGitBranchCompareTarget: Dispatch<SetStateAction<string>>;
  setGitBranchSwitchReadiness: Dispatch<SetStateAction<GitBranchSwitchReadiness | null>>;
  setGitCommits: Dispatch<SetStateAction<GitCommit[]>>;
  setGitCommitListStatus: Dispatch<SetStateAction<GitCommitListStatus | null>>;
  setSelectedCommit: Dispatch<SetStateAction<GitCommit | null>>;
};

type PendingFileTreeRefresh = {
  projectId: string;
  options: WorkspaceFileTreeRefreshOptions;
};

function hasWorkspaceRuntimeFileTreeRefreshTimer(timerId: number | null): timerId is number {
  return timerId !== null;
}

function hasWorkspaceRuntimePendingFileTreeRefresh(
  pendingRefresh: PendingFileTreeRefresh | null,
): pendingRefresh is PendingFileTreeRefresh {
  return pendingRefresh !== null;
}

function isWorkspaceRuntimeResourceEffectActive(cancelled: boolean): boolean {
  return cancelled === false;
}

function shouldWorkspaceRuntimeResourceThrowOnFailure(
  options: WorkspaceFileTreeRefreshOptions | WorkspaceGitResourceRefreshOptions,
): boolean {
  return options.throwOnFailure === true;
}

function shouldBypassWorkspaceRuntimeFileTreeRefreshThrottle(force: boolean): boolean {
  return force === true;
}

function hasWorkspaceRuntimeReadinessInFlight(
  readiness: Promise<ProjectRuntimeStatus> | undefined,
): readiness is Promise<ProjectRuntimeStatus> {
  return readiness !== undefined;
}

function mapRuntimeEngineeringStatus(status?: string): WorkspaceRuntimeStatus {
  switch (getWorkspaceRuntimeResourceStatusValue(status)) {
    case 'ready':
      return 'passed';
    case 'failed':
      return 'failed';
    case 'starting':
    case 'preparing':
    case 'running':
      return 'running';
    default:
      return 'pending';
  }
}

function isWorkspaceRuntimeResourcePreviewBuildReady(
  result: ProjectPreviewUrlBuildResult,
): result is Extract<ProjectPreviewUrlBuildResult, { ok: true }> {
  const isReady = result.ok === true;
  return isReady === true;
}

function shouldAppendWorkspaceRuntimeResourcePreviewBuildFailure(
  result: ProjectPreviewUrlBuildResult,
): result is Extract<ProjectPreviewUrlBuildResult, { ok: false }> {
  const isReady = isWorkspaceRuntimeResourcePreviewBuildReady(result);
  if (isReady === true) {
    return false;
  }

  const hasProjectIdFailure = result.reasonCode === 'missing_project_id';
  if (hasProjectIdFailure === true) {
    return false;
  }

  return true;
}

function hasWorkspaceRuntimeResourceProjectFileTreePayload(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return hasWorkspaceRuntimeResourceTextValue(value);
  }

  const isObjectPayload = typeof value === 'object';
  return isObjectPayload === true;
}

function getWorkspaceRuntimeResourceProjectFileTreePayload(project: Project): unknown {
  const hasFileTreePayload = hasWorkspaceRuntimeResourceProjectFileTreePayload(project.file_tree);
  if (hasFileTreePayload === false) {
    return undefined;
  }

  return project.file_tree;
}

function readWorkspaceRuntimeResourceProjectFileTree(
  payload: unknown,
  parseFileTree: <T>(raw: string, fallback: T) => T,
): FileNode | FileNode[] | null | undefined {
  if (typeof payload === 'string') {
    return parseFileTree<FileNode | FileNode[] | null>(payload, null);
  }

  return payload as FileNode | FileNode[] | null | undefined;
}

function hasWorkspaceRuntimeResourceParsedFileTree(tree: FileNode | FileNode[] | null | undefined): boolean {
  if (tree === null || tree === undefined) {
    return false;
  }

  return true;
}

function getWorkspaceRuntimeResourceReadinessInitialStage(
  options: WorkspaceRuntimeReadinessOptions | undefined,
): string | undefined {
  if (options === undefined) {
    return undefined;
  }

  return getWorkspaceRuntimeResourceOptionalTextValue(options.initialStage);
}

function getWorkspaceRuntimeResourceReadinessWaitStage(
  options: WorkspaceRuntimeReadinessOptions | undefined,
): string | undefined {
  if (options === undefined) {
    return undefined;
  }

  return getWorkspaceRuntimeResourceOptionalTextValue(options.waitStage);
}

function hasWorkspaceRuntimeResourceReadinessStage(stage: string | undefined): stage is string {
  const hasStage = stage !== undefined;
  return hasStage === true;
}

function getWorkspaceRuntimeResourceFirstCommit(commits: GitCommit[]): GitCommit | undefined {
  for (const commit of commits) {
    return commit;
  }

  return undefined;
}

function getWorkspaceRuntimeResourceSelectedCommit(
  commits: GitCommit[],
  previousCommit: GitCommit | null,
): GitCommit | null {
  const firstCommit = getWorkspaceRuntimeResourceFirstCommit(commits);
  if (firstCommit === undefined) {
    return null;
  }

  if (previousCommit !== null) {
    for (const commit of commits) {
      const isMatchedCommit = commit.hash === previousCommit.hash;
      if (isMatchedCommit === true) {
        return commit;
      }
    }
  }

  return firstCommit;
}

function buildRuntimeEngineeringState(
  projectId: string,
  projectInfo: WorkspaceProjectInfo | null,
  status: ProjectRuntimeStatus,
  fallbackMessage: string,
  autoProgressEnabled: boolean,
): WorkspaceEngineeringStateSnapshot {
  const runtimeStatus = mapRuntimeEngineeringStatus(status.status);
  const isFailed = runtimeStatus === 'failed';
  const isReady = runtimeStatus === 'passed';
  const message = getWorkspaceRuntimeResourceTextValue(status.message, fallbackMessage);
  const failureMessage = getWorkspaceRuntimeResourceTextValue(status.error, message);
  const currentTask = isReady
    ? '开发运行时已就绪'
    : isFailed
      ? '开发运行时准备失败'
      : '准备开发运行时';
  const nextAction = isReady
    ? '进入代码生成或刷新预览'
    : isFailed
      ? getWorkspaceRuntimeResourceTextValue(failureMessage, '检查运行时日志后重试')
      : getWorkspaceRuntimeResourceTextValue(message, '等待容器与运行时服务就绪');
  const projectAppType = getWorkspaceRuntimeResourceProjectAppType(projectInfo);
  const projectName = getWorkspaceRuntimeResourceProjectName(projectInfo);

  return {
    workflow: {
      stage: 'runtime-readiness',
      mode: autoProgressEnabled ? 'implement' : 'discuss',
      status: runtimeStatus === 'pending' ? 'running' : runtimeStatus,
    },
    validation: {
      status: 'not_applicable',
    },
    runtime: {
      project_id: projectId,
      app_type: projectAppType,
      project_name: projectName,
      status: runtimeStatus,
    },
    phase: {
      current_phase: '运行时准备',
      current_task: currentTask,
      completed_tasks: isReady ? ['开发运行时已就绪'] : [],
      blockers: isFailed ? [getWorkspaceRuntimeResourceTextValue(failureMessage, '运行时准备失败')] : [],
      next_action: nextAction,
      status: runtimeStatus,
    },
    execution: {
      auto_progress_enabled: autoProgressEnabled && !isFailed,
      awaiting_confirmation: isFailed,
      pause_reason: isFailed ? 'runtime_readiness_failed' : undefined,
      approval_boundary: isFailed ? 'runtime_recovery' : undefined,
      current_task: currentTask,
      next_action: nextAction,
    },
    recovery: isFailed ? {
      blocked: true,
      reason_code: 'runtime_readiness_failed',
      reason_message: getWorkspaceRuntimeResourceTextValue(failureMessage, '运行时准备失败'),
      resume_stage: 'runtime_recovery',
      resume_mode: 'implement',
      can_retry: true,
      retry_label: '重新恢复运行时',
      retry_prompt: `请恢复项目 ${projectId} 的开发运行时，优先检查容器状态、依赖安装和运行时日志后重试。`,
    } : undefined,
  };
}

export function useWorkspaceRuntimeResources({
  projectInfo,
  isGenerating,
  implementingPlanRef,
  safeParseJSON,
  normalizeFileTreePayload,
  buildProjectPreviewUrlResult,
  appTypeNeedsRuntime,
  setProjectInfo,
  setFileTree,
  setExplorerSnapshotStatus,
  setExpandedFolders,
  setBrowserUrl,
  setPreviewUrlStatus,
  setMobileBrowserUrl,
  setMobilePreviewUrlStatus,
  setGenerationStage,
  applyRuntimeResourceMessages,
  gitBranches,
  gitBranchCompareTarget,
  setGitBranches,
  setGitBranchListStatus,
  setGitRemotes,
  setGitRemoteListStatus,
  setGitRemoteBranches,
  setGitRemoteBranchListStatus,
  setGitTags,
  setGitTagListStatus,
  setGitStashes,
  setGitStashListStatus,
  setGitWorktreeStatus,
  setGitWorktreeStatusState,
  setGitBranchCompare,
  setGitBranchCompareStatus,
  setGitBranchCompareTarget,
  setGitBranchSwitchReadiness,
  setGitCommits,
  setGitCommitListStatus,
  setSelectedCommit,
}: UseWorkspaceRuntimeResourcesOptions): WorkspaceRuntimeResourcesContract {
  const runtimeWaitInProgressRef = useRef(false);
  const runtimeReadinessInFlightRef = useRef<Map<string, Promise<ProjectRuntimeStatus>>>(new Map());
  const autoStartAttemptedProjectsRef = useRef<Set<string>>(new Set());
  const lastFileTreeRefreshAtRef = useRef(0);
  const pendingFileTreeRefreshRef = useRef<PendingFileTreeRefresh | null>(null);
  const fileTreeRefreshTimerRef = useRef<number | null>(null);
  const lastFileTreeRefreshFailureNoticeAtRef = useRef<Map<string, number>>(new Map());
  const lastProjectDetailRefreshFailureNoticeAtRef = useRef<Map<string, number>>(new Map());
  const lastProjectDetailFileTreeParseFailureNoticeAtRef = useRef<Map<string, number>>(new Map());
  const lastRuntimeStatusSnapshotFailureNoticeAtRef = useRef<Map<string, number>>(new Map());
  const lastGitBranchesRefreshFailureNoticeAtRef = useRef<Map<string, number>>(new Map());
  const lastGitRemotesRefreshFailureNoticeAtRef = useRef<Map<string, number>>(new Map());
  const lastGitRemoteBranchesRefreshFailureNoticeAtRef = useRef<Map<string, number>>(new Map());
  const lastGitCommitsRefreshFailureNoticeAtRef = useRef<Map<string, number>>(new Map());
  const lastGitTagsRefreshFailureNoticeAtRef = useRef<Map<string, number>>(new Map());
  const lastGitStashesRefreshFailureNoticeAtRef = useRef<Map<string, number>>(new Map());
  const lastGitWorktreeStatusRefreshFailureNoticeAtRef = useRef<Map<string, number>>(new Map());
  const lastWorkspaceBootstrapFailureNoticeAtRef = useRef<Map<string, number>>(new Map());
  const lastPreviewUrlBuildFailureNoticeAtRef = useRef<Map<string, number>>(new Map());
  const workspaceBootstrapInFlightRef = useRef<Set<string>>(new Set());
  const workspaceBootstrapCompletedRef = useRef<Set<string>>(new Set());
  const gitBranchCompareTargetRef = useRef(gitBranchCompareTarget);

  const shouldSyncProjectDetailPreviewUrl = useCallback(({
    explicitPreviewUrl,
    appType,
  }: {
    explicitPreviewUrl: string | null | undefined;
    appType: string | null | undefined;
  }): boolean => {
    const hasExplicitPreviewUrl = hasProjectDetailPreviewSourceUrl(explicitPreviewUrl);
    const needsRuntime = appTypeNeedsRuntime(appType);
    return hasExplicitPreviewUrl === true || needsRuntime === true;
  }, [appTypeNeedsRuntime]);

  useEffect(() => () => {
    const fileTreeRefreshTimer = fileTreeRefreshTimerRef.current;
    if (hasWorkspaceRuntimeFileTreeRefreshTimer(fileTreeRefreshTimer) === true) {
      window.clearTimeout(fileTreeRefreshTimer);
    }
  }, []);

  useEffect(() => {
    gitBranchCompareTargetRef.current = gitBranchCompareTarget;
  }, [gitBranchCompareTarget]);

  const expandRootFolder = useCallback(() => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.add('');
      return next;
    });
  }, [setExpandedFolders]);

  const sleep = useCallback((ms: number) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  }), []);

  const publishRuntimeEngineeringState = useCallback((
    projectId: string,
    status: ProjectRuntimeStatus,
    fallbackMessage: string,
  ) => {
    buildRuntimeEngineeringState(
      projectId,
      projectInfo,
      status,
      fallbackMessage,
      implementingPlanRef.current === true || isGenerating === true,
    );
  }, [implementingPlanRef, isGenerating, projectInfo]);

  const applyRuntimeStatus = useCallback((projectId: string, status: ProjectRuntimeStatus, fallbackMessage = '正在准备开发环境...') => {
    setProjectInfo((prev) => prev && prev.projectId === projectId ? {
      ...prev,
      previewUrl: getWorkspaceRuntimeResourceOptionalFallbackTextValue(status.previewUrl, prev.previewUrl),
      containerStatus: getWorkspaceRuntimeResourceOptionalFallbackTextValue(status.containerStatus, prev.containerStatus),
      runtimeStatus: status,
    } : prev);
    publishRuntimeEngineeringState(projectId, status, fallbackMessage);
  }, [publishRuntimeEngineeringState, setProjectInfo]);

  const appendPreviewUrlBuildFailureMessage = useCallback((
    projectId: string,
    result: ProjectPreviewUrlBuildResult,
    sourceLabel: string,
  ) => {
    const shouldAppendFailure = shouldAppendWorkspaceRuntimeResourcePreviewBuildFailure(result);
    if (shouldAppendFailure === false) return;

    const now = Date.now();
    const lastNoticeAt = getWorkspaceRuntimeResourceNoticeTimestamp(
      lastPreviewUrlBuildFailureNoticeAtRef.current,
      projectId,
    );
    const shouldPublishNotice = shouldPublishWorkspaceRuntimeResourceNotice(
      now,
      lastNoticeAt,
      PREVIEW_URL_BUILD_FAILURE_NOTICE_COOLDOWN_MS,
    );
    if (shouldPublishNotice === false) {
      return;
    }
    lastPreviewUrlBuildFailureNoticeAtRef.current.set(projectId, now);
    const reasonMessage = formatPreviewUrlBuildFailure(result);
    const buildFailureStatus = (surface: WorkspacePreviewUrlSurface, currentUrl: string): PreviewUrlStatus =>
      buildPreviewUrlBuildFailureStatus({
        surface,
        currentUrl,
        failurePrefix: `Preview URL 构建失败（${sourceLabel}）`,
        reasonMessage,
      });
    setPreviewUrlStatus((prev) => buildFailureStatus('desktop', getWorkspaceRuntimeResourcePreviewStatusUrl(prev)));
    setMobilePreviewUrlStatus((prev) => buildFailureStatus('mobile', getWorkspaceRuntimeResourcePreviewStatusUrl(prev)));
    applyRuntimeResourceMessages((prev) => [...prev, {
      id: `preview-url-build-failed-${projectId}-${now}`,
      role: 'assistant',
      content: `Preview URL 构建失败（${sourceLabel}）：${reasonMessage}当前 Preview 面板可能保持空白或旧地址；请检查同源 /preview/ 代理、NEXT_PUBLIC_PREVIEW_GATEWAY_URL 覆盖配置或内部 Preview Gateway 状态，或等待后端返回明确 previewUrl 后再刷新运行时状态。`,
      timestamp: new Date().toISOString(),
    }]);
  }, [applyRuntimeResourceMessages, setMobilePreviewUrlStatus, setPreviewUrlStatus]);

  const syncRuntimePreview = useCallback((projectId: string, explicitPreviewUrl?: string | null) => {
    const previewResult = buildProjectPreviewUrlResult(projectId, explicitPreviewUrl);
    const isPreviewReady = isWorkspaceRuntimeResourcePreviewBuildReady(previewResult);
    if (isPreviewReady === false) {
      appendPreviewUrlBuildFailureMessage(projectId, previewResult, '运行时状态同步');
      return;
    }

    setBrowserUrl(previewResult.url);
    setPreviewUrlStatus(buildRuntimeFreshPreviewUrlStatus({ surface: 'desktop', value: previewResult.url }));
    setMobileBrowserUrl(previewResult.url);
    setMobilePreviewUrlStatus(buildRuntimeFreshPreviewUrlStatus({ surface: 'mobile', value: previewResult.url }));
  }, [appendPreviewUrlBuildFailureMessage, buildProjectPreviewUrlResult, setBrowserUrl, setMobileBrowserUrl, setMobilePreviewUrlStatus, setPreviewUrlStatus]);

  const fetchRuntimeStatusSnapshot = useCallback(async (
    projectId: string,
    fallbackMessage = '正在同步运行时状态...',
    options: WorkspaceRuntimeStatusSnapshotOptions = {},
  ): Promise<ProjectRuntimeStatus | null> => {
    try {
      const status = await projectApi.getRuntimeStatus(projectId);
      applyRuntimeStatus(projectId, status, getWorkspaceRuntimeResourceTextValue(status.message, fallbackMessage));
      if (status.status === 'ready') {
        syncRuntimePreview(projectId, status.previewUrl);
      }
      lastRuntimeStatusSnapshotFailureNoticeAtRef.current.delete(projectId);
      return status;
    } catch (error) {
      const now = Date.now();
      const lastNoticeAt = getWorkspaceRuntimeResourceNoticeTimestamp(
        lastRuntimeStatusSnapshotFailureNoticeAtRef.current,
        projectId,
      );
      const shouldSuppressNotice = options.suppressNotice === true;
      const shouldPublishNotice = shouldSuppressNotice === false
        && shouldPublishWorkspaceRuntimeResourceNotice(
          now,
          lastNoticeAt,
          RUNTIME_STATUS_SNAPSHOT_FAILURE_NOTICE_COOLDOWN_MS,
        );
      if (shouldPublishNotice === true) {
        lastRuntimeStatusSnapshotFailureNoticeAtRef.current.set(projectId, now);
        applyRuntimeResourceMessages((prev) => [...prev, {
          id: `runtime-status-snapshot-failed-${projectId}-${now}`,
          role: 'assistant',
          content: `运行时快照同步失败：${formatWorkspaceRuntimeResourceFailure(error)}。当前 Runtime banner、Preview URL 或恢复入口可能仍是旧状态；你可以稍后重新同步运行时状态，已打开文件的本地编辑内容不会因此丢失。`,
          timestamp: new Date().toISOString(),
        }]);
      }
      const shouldThrowOnFailure = options.throwOnFailure === true;
      if (shouldThrowOnFailure === true) {
        throw error;
      }
      return null;
    }
  }, [applyRuntimeResourceMessages, applyRuntimeStatus, syncRuntimePreview]);

  const resetWorkspaceRuntimeBootstrapState = useCallback((projectId: string) => {
    autoStartAttemptedProjectsRef.current.delete(projectId);
    runtimeReadinessInFlightRef.current.delete(projectId);
    workspaceBootstrapInFlightRef.current.delete(projectId);
    workspaceBootstrapCompletedRef.current.delete(projectId);
    lastFileTreeRefreshAtRef.current = 0;
    pendingFileTreeRefreshRef.current = null;
    const fileTreeRefreshTimer = fileTreeRefreshTimerRef.current;
    if (hasWorkspaceRuntimeFileTreeRefreshTimer(fileTreeRefreshTimer) === true) {
      window.clearTimeout(fileTreeRefreshTimer);
      fileTreeRefreshTimerRef.current = null;
    }
    lastFileTreeRefreshFailureNoticeAtRef.current.delete(projectId);
    lastProjectDetailRefreshFailureNoticeAtRef.current.delete(projectId);
    lastProjectDetailFileTreeParseFailureNoticeAtRef.current.delete(projectId);
    lastRuntimeStatusSnapshotFailureNoticeAtRef.current.delete(projectId);
    lastGitBranchesRefreshFailureNoticeAtRef.current.delete(projectId);
    lastGitRemotesRefreshFailureNoticeAtRef.current.delete(projectId);
    lastGitRemoteBranchesRefreshFailureNoticeAtRef.current.delete(projectId);
    lastGitCommitsRefreshFailureNoticeAtRef.current.delete(projectId);
    lastGitTagsRefreshFailureNoticeAtRef.current.delete(projectId);
    lastGitStashesRefreshFailureNoticeAtRef.current.delete(projectId);
    lastGitWorktreeStatusRefreshFailureNoticeAtRef.current.delete(projectId);
    lastWorkspaceBootstrapFailureNoticeAtRef.current.delete(projectId);
    lastPreviewUrlBuildFailureNoticeAtRef.current.delete(projectId);
    const nextFileTreeRefreshTimer = fileTreeRefreshTimerRef.current;
    if (hasWorkspaceRuntimeFileTreeRefreshTimer(nextFileTreeRefreshTimer) === true) {
      window.clearTimeout(nextFileTreeRefreshTimer);
      fileTreeRefreshTimerRef.current = null;
    }
  }, []);

  const fetchProjectDetail = useCallback(async (projectId: string) => {
    const appendProjectDetailFileTreeParseFailureMessage = (error: unknown) => {
      const now = Date.now();
      const lastNoticeAt = getWorkspaceRuntimeResourceNoticeTimestamp(
        lastProjectDetailFileTreeParseFailureNoticeAtRef.current,
        projectId,
      );
      const shouldPublishNotice = shouldPublishWorkspaceRuntimeResourceNotice(
        now,
        lastNoticeAt,
        PROJECT_DETAIL_FILE_TREE_PARSE_FAILURE_NOTICE_COOLDOWN_MS,
      );
      if (shouldPublishNotice === false) {
        return;
      }
      lastProjectDetailFileTreeParseFailureNoticeAtRef.current.set(projectId, now);
      applyRuntimeResourceMessages((prev) => [...prev, {
        id: `project-detail-file-tree-parse-failed-${projectId}-${now}`,
        role: 'assistant',
        content: `项目详情文件树解析失败：${formatWorkspaceRuntimeResourceFailure(error, '项目详情 file_tree 字段格式无效')}。项目元信息、Preview URL 或运行时状态可能已同步，但当前 Explorer 仍可能是旧快照；你可以稍后重新刷新文件树或重新进入 Workspace，已打开文件的本地编辑内容不会因此丢失。`,
        timestamp: new Date().toISOString(),
      }]);
    };

    try {
      const project = await projectApi.get(projectId);
      setProjectInfo((prev) => prev && prev.projectId === projectId ? {
        ...prev,
        techStack: getWorkspaceRuntimeResourceOptionalFallbackTextValue(project.tech_stack, prev.techStack),
        planId: getWorkspaceRuntimeResourceOptionalFallbackTextValue(project.plan_id, prev.planId),
        planData: getWorkspaceRuntimeResourceOptionalFallbackTextValue(project.plan_data, prev.planData),
        containerPort: getWorkspaceRuntimeResourceNumberValue(project.container_port, prev.containerPort),
        previewUrl: getWorkspaceRuntimeResourceOptionalFallbackTextValue(project.preview_url, prev.previewUrl),
        containerStatus: getWorkspaceRuntimeResourceOptionalFallbackTextValue(project.container_status, prev.containerStatus),
        gitBranch: getWorkspaceRuntimeResourceOptionalFallbackTextValue(project.git_branch, prev.gitBranch),
        runtimeStatus: prev.runtimeStatus,
      } : prev);

      const shouldSyncPreviewUrl = shouldSyncProjectDetailPreviewUrl({
        explicitPreviewUrl: project.preview_url,
        appType: getWorkspaceRuntimeResourceProjectDetailAppType(project.app_type, projectInfo),
      });
      if (shouldSyncPreviewUrl === true) {
        const previewResult = buildProjectPreviewUrlResult(projectId, project.preview_url);
        const isPreviewReady = isWorkspaceRuntimeResourcePreviewBuildReady(previewResult);
        if (isPreviewReady === true) {
          setBrowserUrl((prev) => {
            if (prev !== 'about:blank') return prev;
            setPreviewUrlStatus(buildProjectDetailPreviewUrlStatus({ surface: 'desktop', value: previewResult.url }));
            return previewResult.url;
          });
          setMobileBrowserUrl((prev) => {
            if (prev !== 'about:blank') return prev;
            setMobilePreviewUrlStatus(buildProjectDetailPreviewUrlStatus({ surface: 'mobile', value: previewResult.url }));
            return previewResult.url;
          });
        } else {
          appendPreviewUrlBuildFailureMessage(projectId, previewResult, '项目详情刷新');
        }
      }

      const fileTreePayload = getWorkspaceRuntimeResourceProjectFileTreePayload(project);
      const hasFileTreePayload = hasWorkspaceRuntimeResourceProjectFileTreePayload(fileTreePayload);
      if (hasFileTreePayload === true) {
        try {
          const tree = readWorkspaceRuntimeResourceProjectFileTree(fileTreePayload, safeParseJSON);
          const hasParsedFileTree = hasWorkspaceRuntimeResourceParsedFileTree(tree);
          if (hasParsedFileTree === false) {
            appendProjectDetailFileTreeParseFailureMessage(buildProjectDetailFileTreeParseError(projectId, 'project_detail_refresh'));
          } else {
            const normalizedTree = normalizeFileTreePayload(tree);
            setFileTree(normalizedTree);
            setExplorerSnapshotStatus(buildFreshExplorerSnapshotStatus({
              source: 'project_detail',
              itemCount: normalizedTree.length,
            }));
            if (normalizedTree.length > 0) {
              expandRootFolder();
            }
            lastProjectDetailFileTreeParseFailureNoticeAtRef.current.delete(projectId);
          }
        } catch (error) {
          appendProjectDetailFileTreeParseFailureMessage(error);
        }
      }
      lastProjectDetailRefreshFailureNoticeAtRef.current.delete(projectId);
    } catch (error) {
      const now = Date.now();
      const lastNoticeAt = getWorkspaceRuntimeResourceNoticeTimestamp(
        lastProjectDetailRefreshFailureNoticeAtRef.current,
        projectId,
      );
      const shouldPublishNotice = shouldPublishWorkspaceRuntimeResourceNotice(
        now,
        lastNoticeAt,
        PROJECT_DETAIL_REFRESH_FAILURE_NOTICE_COOLDOWN_MS,
      );
      if (shouldPublishNotice === true) {
        lastProjectDetailRefreshFailureNoticeAtRef.current.set(projectId, now);
        applyRuntimeResourceMessages((prev) => [...prev, {
          id: `project-detail-refresh-failed-${projectId}-${now}`,
          role: 'assistant',
          content: `项目详情同步失败：${formatWorkspaceRuntimeResourceFailure(error)}。当前 preview URL、运行时快照或项目元信息可能仍是旧状态；你可以稍后重新刷新项目，已打开文件的本地编辑内容不会因此丢失。`,
          timestamp: new Date().toISOString(),
        }]);
      }
    }
  }, [
    appendPreviewUrlBuildFailureMessage,
    buildProjectPreviewUrlResult,
    expandRootFolder,
    normalizeFileTreePayload,
    projectInfo,
    safeParseJSON,
    setBrowserUrl,
    setPreviewUrlStatus,
    setFileTree,
    setExplorerSnapshotStatus,
    applyRuntimeResourceMessages,
    setMobileBrowserUrl,
    setMobilePreviewUrlStatus,
    setProjectInfo,
    shouldSyncProjectDetailPreviewUrl,
  ]);

  const fetchProjectFileTree = useCallback(async (
    projectId: string,
    options: WorkspaceFileTreeRefreshOptions = {},
  ) => {
    try {
      const tree = await projectApi.getFileTree(projectId) as FileNode | FileNode[] | null | undefined;
      const normalizedTree = normalizeFileTreePayload(tree);
      setFileTree(normalizedTree);
      setExplorerSnapshotStatus(buildFreshExplorerSnapshotStatus({
        source: 'file_tree_refresh',
        itemCount: normalizedTree.length,
      }));
      if (normalizedTree.length > 0) {
        expandRootFolder();
      }
      lastFileTreeRefreshFailureNoticeAtRef.current.delete(projectId);
    } catch (error) {
      const now = Date.now();
      const failureMessage = formatWorkspaceRuntimeResourceFailure(error);
      setExplorerSnapshotStatus((prev) => buildStaleExplorerSnapshotStatus({
        source: 'file_tree_refresh',
        previousStatus: prev,
        hasLocalSnapshot: false,
        reasonMessage: failureMessage,
        failureKind: 'refresh_failed',
      }));
      const lastNoticeAt = getWorkspaceRuntimeResourceNoticeTimestamp(
        lastFileTreeRefreshFailureNoticeAtRef.current,
        projectId,
      );
      const shouldPublishNotice = shouldPublishWorkspaceRuntimeResourceRefreshNotice(
        options,
        now,
        lastNoticeAt,
        FILE_TREE_REFRESH_FAILURE_NOTICE_COOLDOWN_MS,
      );
      if (shouldPublishNotice === true) {
        lastFileTreeRefreshFailureNoticeAtRef.current.set(projectId, now);
        applyRuntimeResourceMessages((prev) => [...prev, {
          id: `file-tree-refresh-failed-${projectId}-${now}`,
          role: 'assistant',
          content: `文件树同步失败：${failureMessage}。当前 Explorer 可能仍是旧快照；你可以稍后重新刷新文件树，已打开文件的本地编辑内容不会因此丢失。`,
          timestamp: new Date().toISOString(),
        }]);
      }
      const shouldThrowOnFailure = shouldWorkspaceRuntimeResourceThrowOnFailure(options);
      if (shouldThrowOnFailure === true) {
        throw error;
      }
    }
    }, [applyRuntimeResourceMessages, expandRootFolder, normalizeFileTreePayload, setExplorerSnapshotStatus, setFileTree]);

  const refreshProjectFileTree = useCallback(async (
    projectId: string,
    force = false,
    options: WorkspaceFileTreeRefreshOptions = {},
  ) => {
    const now = Date.now();
    const elapsed = now - lastFileTreeRefreshAtRef.current;

    const shouldBypassThrottle = shouldBypassWorkspaceRuntimeFileTreeRefreshThrottle(force);
    if (shouldBypassThrottle === true) {
      pendingFileTreeRefreshRef.current = null;
      const fileTreeRefreshTimer = fileTreeRefreshTimerRef.current;
      if (hasWorkspaceRuntimeFileTreeRefreshTimer(fileTreeRefreshTimer) === true) {
        window.clearTimeout(fileTreeRefreshTimer);
        fileTreeRefreshTimerRef.current = null;
      }
      lastFileTreeRefreshAtRef.current = now;
      await fetchProjectFileTree(projectId, options);
      return;
    }

    const shouldThrowOnFailure = shouldWorkspaceRuntimeResourceThrowOnFailure(options);
    if (shouldThrowOnFailure === true) {
      pendingFileTreeRefreshRef.current = null;
      const fileTreeRefreshTimer = fileTreeRefreshTimerRef.current;
      if (hasWorkspaceRuntimeFileTreeRefreshTimer(fileTreeRefreshTimer) === true) {
        window.clearTimeout(fileTreeRefreshTimer);
        fileTreeRefreshTimerRef.current = null;
      }
      lastFileTreeRefreshAtRef.current = now;
      await fetchProjectFileTree(projectId, options);
      return;
    }

    if (elapsed < FILE_TREE_REFRESH_THROTTLE_MS) {
      pendingFileTreeRefreshRef.current = { projectId, options };
      const hasFileTreeRefreshTimer = hasWorkspaceRuntimeFileTreeRefreshTimer(fileTreeRefreshTimerRef.current);
      if (hasFileTreeRefreshTimer === false) {
        fileTreeRefreshTimerRef.current = window.setTimeout(() => {
          const pendingRefresh = pendingFileTreeRefreshRef.current;
          pendingFileTreeRefreshRef.current = null;
          fileTreeRefreshTimerRef.current = null;
          if (hasWorkspaceRuntimePendingFileTreeRefresh(pendingRefresh) === false) {
            return;
          }
          lastFileTreeRefreshAtRef.current = Date.now();
          void fetchProjectFileTree(pendingRefresh.projectId, pendingRefresh.options);
        }, FILE_TREE_REFRESH_THROTTLE_MS - elapsed);
      }
      return;
    }

    pendingFileTreeRefreshRef.current = null;
    await fetchProjectFileTree(projectId, options);
    lastFileTreeRefreshAtRef.current = Date.now();
  }, [fetchProjectFileTree]);

  const waitForProjectRuntimeReady = useCallback(async (projectId: string): Promise<ProjectRuntimeStatus> => {
    runtimeWaitInProgressRef.current = true;
    try {
      const maxAttempts = 120;
      let transientFailureCount = 0;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        let status: ProjectRuntimeStatus;
        try {
          status = await projectApi.getRuntimeStatus(projectId);
          transientFailureCount = 0;
        } catch (error) {
          const isTransient = error instanceof ApiError && [500, 502, 503, 504].includes(error.code);
          if (!isTransient || transientFailureCount >= 5) {
            throw error;
          }
          transientFailureCount += 1;
          setGenerationStage('正在等待运行时状态服务恢复...');
          await sleep(2000);
          continue;
        }

        applyRuntimeStatus(projectId, status, getWorkspaceRuntimeResourceTextValue(status.message, '正在准备开发环境...'));

        if (status.status === 'ready') {
          syncRuntimePreview(projectId, status.previewUrl);
          setGenerationStage('开发环境已就绪，开始生成代码...');
          await fetchProjectDetail(projectId);
          return status;
        }

        if (status.status === 'failed') {
          publishRuntimeEngineeringState(
            projectId,
            status,
            getWorkspaceRuntimeResourceTextValue(
              status.message,
              getWorkspaceRuntimeResourceTextValue(status.error, '开发环境准备失败'),
            ),
          );
          throw buildRuntimeStatusFailureError(projectId, status);
        }

        setGenerationStage(getWorkspaceRuntimeResourceTextValue(status.message, '正在准备开发环境...'));
        await sleep(5000);
      }

      throw buildRuntimeStatusWaitTimeoutError(projectId, maxAttempts);
    } finally {
      runtimeWaitInProgressRef.current = false;
    }
  }, [
    applyRuntimeStatus,
    fetchProjectDetail,
    publishRuntimeEngineeringState,
    setGenerationStage,
    sleep,
    syncRuntimePreview,
  ]);

  const ensureProjectRuntimeReady = useCallback(async (
    projectId: string,
    options?: WorkspaceRuntimeReadinessOptions,
  ) => {
    const existingReadiness = runtimeReadinessInFlightRef.current.get(projectId);
    const hasReadinessInFlight = hasWorkspaceRuntimeReadinessInFlight(existingReadiness);
    if (hasReadinessInFlight === true) {
      const waitStage = getWorkspaceRuntimeResourceReadinessWaitStage(options);
      const initialStage = getWorkspaceRuntimeResourceReadinessInitialStage(options);
      const reuseStage = getWorkspaceRuntimeResourceTextValue(
        waitStage,
        getWorkspaceRuntimeResourceTextValue(initialStage, '运行时启动或恢复已在进行中...'),
      );
      setGenerationStage(reuseStage);
      publishRuntimeEngineeringState(projectId, {
        projectId,
        status: 'preparing',
        phase: 'runtime_readiness_in_flight',
        message: reuseStage,
        updatedAt: new Date().toISOString(),
      }, reuseStage);
      return existingReadiness;
    }

    const readinessPromise = (async () => {
      const initialStage = getWorkspaceRuntimeResourceReadinessInitialStage(options);
      const hasInitialStage = hasWorkspaceRuntimeResourceReadinessStage(initialStage);
      if (hasInitialStage === true) {
        setGenerationStage(initialStage);
      }

      const status = await projectApi.startContainer(projectId);
      applyRuntimeStatus(
        projectId,
        status,
        getWorkspaceRuntimeResourceTextValue(
          initialStage,
          getWorkspaceRuntimeResourceTextValue(
            getWorkspaceRuntimeResourceReadinessWaitStage(options),
            '正在启动开发环境...',
          ),
        ),
      );

      if (status.status === 'ready') {
        syncRuntimePreview(projectId, status.previewUrl);
        await fetchProjectDetail(projectId);
        return status;
      }

      if (status.status === 'failed') {
        publishRuntimeEngineeringState(
          projectId,
          status,
          getWorkspaceRuntimeResourceTextValue(
            status.message,
            getWorkspaceRuntimeResourceTextValue(status.error, '开发环境准备失败'),
          ),
        );
        throw buildRuntimeStatusFailureError(projectId, status);
      }

      const waitStage = getWorkspaceRuntimeResourceReadinessWaitStage(options);
      const hasWaitStage = hasWorkspaceRuntimeResourceReadinessStage(waitStage);
      if (hasWaitStage === true) {
        setGenerationStage(waitStage);
      }

      return waitForProjectRuntimeReady(projectId);
    })();

    runtimeReadinessInFlightRef.current.set(projectId, readinessPromise);
    try {
      return await readinessPromise;
    } finally {
      if (runtimeReadinessInFlightRef.current.get(projectId) === readinessPromise) {
        runtimeReadinessInFlightRef.current.delete(projectId);
      }
    }
  }, [
    applyRuntimeStatus,
    fetchProjectDetail,
    publishRuntimeEngineeringState,
    setGenerationStage,
    syncRuntimePreview,
    waitForProjectRuntimeReady,
  ]);

  const fetchProjectCommits = useCallback(async (projectId: string, options: WorkspaceGitResourceRefreshOptions = {}) => {
    try {
      const commits = await projectApi.getCommits(projectId);
      setGitCommits(commits);
      setGitCommitListStatus(buildFreshGitCommitListStatus({ commitCount: commits.length }));
      setSelectedCommit((prev) => {
        return getWorkspaceRuntimeResourceSelectedCommit(commits, prev);
      });
      lastGitCommitsRefreshFailureNoticeAtRef.current.delete(projectId);
      return commits;
    } catch (error) {
      const now = Date.now();
      const failureMessage = formatWorkspaceRuntimeResourceFailure(error);
      setGitCommitListStatus((prev) => buildStaleGitCommitListStatus({
        previousStatus: prev,
        reasonMessage: failureMessage,
      }));
      const lastNoticeAt = getWorkspaceRuntimeResourceNoticeTimestamp(
        lastGitCommitsRefreshFailureNoticeAtRef.current,
        projectId,
      );
      const shouldPublishNotice = shouldPublishWorkspaceRuntimeResourceRefreshNotice(
        options,
        now,
        lastNoticeAt,
        GIT_COMMITS_REFRESH_FAILURE_NOTICE_COOLDOWN_MS,
      );
      if (shouldPublishNotice === true) {
        lastGitCommitsRefreshFailureNoticeAtRef.current.set(projectId, now);
        applyRuntimeResourceMessages((prev) => [...prev, {
          id: `git-commits-refresh-failed-${projectId}-${now}`,
          role: 'assistant',
          content: `Git 提交列表同步失败：${failureMessage}。当前 Git 面板或关联到消息的最新 commit 可能仍是旧状态；你可以稍后重新刷新提交列表，已打开文件的本地编辑内容不会因此丢失。`,
          timestamp: new Date().toISOString(),
        }]);
      }
      const shouldThrowOnFailure = shouldWorkspaceRuntimeResourceThrowOnFailure(options);
      if (shouldThrowOnFailure === true) {
        throw error;
      }
      return [];
    }
  }, [applyRuntimeResourceMessages, setGitCommitListStatus, setGitCommits, setSelectedCommit]);

  const fetchProjectTags = useCallback(async (projectId: string, options: WorkspaceGitResourceRefreshOptions = {}) => {
    try {
      const tags = await projectApi.getTags(projectId);
      setGitTags(tags);
      setGitTagListStatus(buildFreshGitTagListStatus({ tagCount: tags.length }));
      lastGitTagsRefreshFailureNoticeAtRef.current.delete(projectId);
      return tags;
    } catch (error) {
      const now = Date.now();
      const failureMessage = formatWorkspaceRuntimeResourceFailure(error);
      setGitTagListStatus((prev) => buildStaleGitTagListStatus({
        previousStatus: prev,
        reasonMessage: failureMessage,
      }));
      const lastNoticeAt = getWorkspaceRuntimeResourceNoticeTimestamp(
        lastGitTagsRefreshFailureNoticeAtRef.current,
        projectId,
      );
      const shouldPublishNotice = shouldPublishWorkspaceRuntimeResourceRefreshNotice(
        options,
        now,
        lastNoticeAt,
        GIT_TAGS_REFRESH_FAILURE_NOTICE_COOLDOWN_MS,
      );
      if (shouldPublishNotice === true) {
        lastGitTagsRefreshFailureNoticeAtRef.current.set(projectId, now);
        applyRuntimeResourceMessages((prev) => [...prev, {
          id: `git-tags-refresh-failed-${projectId}-${now}`,
          role: 'assistant',
          content: `Git 标签列表同步失败：${failureMessage}。当前 Git 面板的标签信息可能仍是旧状态；你可以稍后重新刷新标签列表，提交详情和已打开文件不会因此丢失。`,
          timestamp: new Date().toISOString(),
        }]);
      }
      const shouldThrowOnFailure = shouldWorkspaceRuntimeResourceThrowOnFailure(options);
      if (shouldThrowOnFailure === true) {
        throw error;
      }
      return [];
    }
  }, [applyRuntimeResourceMessages, setGitTagListStatus, setGitTags]);

  const fetchProjectRemotes = useCallback(async (projectId: string, options: WorkspaceGitResourceRefreshOptions = {}) => {
    try {
      const remotes = await projectApi.getRemotes(projectId);
      setGitRemotes(remotes);
      setGitRemoteListStatus(buildFreshGitRemoteListStatus({ remoteCount: remotes.length }));
      lastGitRemotesRefreshFailureNoticeAtRef.current.delete(projectId);
      return remotes;
    } catch (error) {
      const now = Date.now();
      const failureMessage = formatWorkspaceRuntimeResourceFailure(error);
      setGitRemoteListStatus((prev) => buildStaleGitRemoteListStatus({
        previousStatus: prev,
        reasonMessage: failureMessage,
      }));
      const lastNoticeAt = getWorkspaceRuntimeResourceNoticeTimestamp(
        lastGitRemotesRefreshFailureNoticeAtRef.current,
        projectId,
      );
      const shouldPublishNotice = shouldPublishWorkspaceRuntimeResourceRefreshNotice(
        options,
        now,
        lastNoticeAt,
        GIT_REMOTES_REFRESH_FAILURE_NOTICE_COOLDOWN_MS,
      );
      if (shouldPublishNotice === true) {
        lastGitRemotesRefreshFailureNoticeAtRef.current.set(projectId, now);
        applyRuntimeResourceMessages((prev) => [...prev, {
          id: `git-remotes-refresh-failed-${projectId}-${now}`,
          role: 'assistant',
          content: `Git remote 列表同步失败：${failureMessage}。当前 Git 面板的 remote 选择可能仍是旧状态；你可以稍后重新刷新 Git 面板，提交详情和已打开文件不会因此丢失。`,
          timestamp: new Date().toISOString(),
        }]);
      }
      const shouldThrowOnFailure = shouldWorkspaceRuntimeResourceThrowOnFailure(options);
      if (shouldThrowOnFailure === true) {
        throw error;
      }
      return [];
    }
  }, [applyRuntimeResourceMessages, setGitRemoteListStatus, setGitRemotes]);

  const fetchProjectRemoteBranches = useCallback(async (projectId: string, options: WorkspaceGitResourceRefreshOptions = {}) => {
    try {
      const remoteBranches = await projectApi.getRemoteBranches(projectId);
      setGitRemoteBranches(remoteBranches);
      setGitRemoteBranchListStatus(buildFreshGitRemoteBranchListStatus({ remoteBranchCount: remoteBranches.length }));
      lastGitRemoteBranchesRefreshFailureNoticeAtRef.current.delete(projectId);
      return remoteBranches;
    } catch (error) {
      const now = Date.now();
      const failureMessage = formatWorkspaceRuntimeResourceFailure(error);
      setGitRemoteBranchListStatus((prev) => buildStaleGitRemoteBranchListStatus({
        previousStatus: prev,
        reasonMessage: failureMessage,
      }));
      const lastNoticeAt = getWorkspaceRuntimeResourceNoticeTimestamp(
        lastGitRemoteBranchesRefreshFailureNoticeAtRef.current,
        projectId,
      );
      const shouldPublishNotice = shouldPublishWorkspaceRuntimeResourceRefreshNotice(
        options,
        now,
        lastNoticeAt,
        GIT_REMOTE_BRANCHES_REFRESH_FAILURE_NOTICE_COOLDOWN_MS,
      );
      if (shouldPublishNotice === true) {
        lastGitRemoteBranchesRefreshFailureNoticeAtRef.current.set(projectId, now);
        applyRuntimeResourceMessages((prev) => [...prev, {
          id: `git-remote-branches-refresh-failed-${projectId}-${now}`,
          role: 'assistant',
          content: `Git 远端分支列表同步失败：${failureMessage}。当前 Git 面板的远端分支信息可能仍是旧状态；你可以稍后重新刷新远端分支列表，提交详情和已打开文件不会因此丢失。`,
          timestamp: new Date().toISOString(),
        }]);
      }
      const shouldThrowOnFailure = shouldWorkspaceRuntimeResourceThrowOnFailure(options);
      if (shouldThrowOnFailure === true) {
        throw error;
      }
      return [];
    }
  }, [applyRuntimeResourceMessages, setGitRemoteBranchListStatus, setGitRemoteBranches]);

  const fetchProjectStashes = useCallback(async (projectId: string, options: WorkspaceGitResourceRefreshOptions = {}) => {
    try {
      const stashes = await projectApi.getStashes(projectId);
      setGitStashes(stashes);
      setGitStashListStatus(buildFreshGitStashListStatus({ stashCount: stashes.length }));
      lastGitStashesRefreshFailureNoticeAtRef.current.delete(projectId);
      return stashes;
    } catch (error) {
      const now = Date.now();
      const failureMessage = formatWorkspaceRuntimeResourceFailure(error);
      setGitStashListStatus((prev) => buildStaleGitStashListStatus({
        previousStatus: prev,
        reasonMessage: failureMessage,
      }));
      const lastNoticeAt = getWorkspaceRuntimeResourceNoticeTimestamp(
        lastGitStashesRefreshFailureNoticeAtRef.current,
        projectId,
      );
      const shouldPublishNotice = shouldPublishWorkspaceRuntimeResourceRefreshNotice(
        options,
        now,
        lastNoticeAt,
        GIT_STASHES_REFRESH_FAILURE_NOTICE_COOLDOWN_MS,
      );
      if (shouldPublishNotice === true) {
        lastGitStashesRefreshFailureNoticeAtRef.current.set(projectId, now);
        applyRuntimeResourceMessages((prev) => [...prev, {
          id: `git-stashes-refresh-failed-${projectId}-${now}`,
          role: 'assistant',
          content: `Git stash 列表同步失败：${failureMessage}。当前 Git 面板的 stash 信息可能仍是旧状态；你可以稍后重新刷新 stash 列表，提交详情和已打开文件不会因此丢失。`,
          timestamp: new Date().toISOString(),
        }]);
      }
      const shouldThrowOnFailure = shouldWorkspaceRuntimeResourceThrowOnFailure(options);
      if (shouldThrowOnFailure === true) {
        throw error;
      }
      return [];
    }
  }, [applyRuntimeResourceMessages, setGitStashListStatus, setGitStashes]);

  const fetchProjectWorktreeStatus = useCallback(async (projectId: string, options: WorkspaceGitResourceRefreshOptions = {}) => {
    try {
      const status = await projectApi.getWorktreeStatus(projectId);
      setGitWorktreeStatus(status);
      setGitWorktreeStatusState(buildFreshGitWorktreeStatus({
        status: status.status,
        dirtyFiles: status.dirty_files,
      }));
      lastGitWorktreeStatusRefreshFailureNoticeAtRef.current.delete(projectId);
      return status;
    } catch (error) {
      const now = Date.now();
      const failureMessage = formatWorkspaceRuntimeResourceFailure(error);
      setGitWorktreeStatusState((prev) => buildStaleGitWorktreeStatus({
        previousStatus: prev,
        reasonMessage: failureMessage,
      }));
      const lastNoticeAt = getWorkspaceRuntimeResourceNoticeTimestamp(
        lastGitWorktreeStatusRefreshFailureNoticeAtRef.current,
        projectId,
      );
      const shouldPublishNotice = shouldPublishWorkspaceRuntimeResourceRefreshNotice(
        options,
        now,
        lastNoticeAt,
        GIT_WORKTREE_STATUS_REFRESH_FAILURE_NOTICE_COOLDOWN_MS,
      );
      if (shouldPublishNotice === true) {
        lastGitWorktreeStatusRefreshFailureNoticeAtRef.current.set(projectId, now);
        applyRuntimeResourceMessages((prev) => [...prev, {
          id: `git-worktree-status-refresh-failed-${projectId}-${now}`,
          role: 'assistant',
          content: `Git worktree 状态同步失败：${failureMessage}。当前 Git 面板的 clean/dirty 判断可能仍是旧状态；你可以稍后重新刷新 Git 面板，提交详情和已打开文件不会因此丢失。`,
          timestamp: new Date().toISOString(),
        }]);
      }
      const shouldThrowOnFailure = shouldWorkspaceRuntimeResourceThrowOnFailure(options);
      if (shouldThrowOnFailure === true) {
        throw error;
      }
      return null;
    }
  }, [applyRuntimeResourceMessages, setGitWorktreeStatus, setGitWorktreeStatusState]);

  const refreshProjectBranchCompare = useCallback(async (projectId: string, branches: GitBranch[], preferredTargetBranch = '') => {
    const currentBranch = getWorkspaceRuntimeResourceCurrentBranchName(branches);
    const targetBranch = getWorkspaceRuntimeResourceTargetBranchName(branches, preferredTargetBranch, currentBranch);
    const hasBranchCompareTarget = hasWorkspaceRuntimeResourceBranchCompareTarget(currentBranch, targetBranch);
    if (hasBranchCompareTarget === false) {
      setGitBranchCompare(null);
      setGitBranchCompareTarget('');
      setGitBranchSwitchReadiness(null);
      setGitBranchCompareStatus(buildNoTargetGitBranchCompareStatus({ baseBranch: currentBranch }));
      return null;
    }
    setGitBranchCompareTarget(targetBranch);
    try {
      const readiness = await projectApi.getBranchSwitchReadiness(projectId, targetBranch);
      setGitBranchSwitchReadiness(readiness);
    } catch {
      setGitBranchSwitchReadiness(null);
    }

    try {
      const compare = await projectApi.getBranchCompare(projectId, currentBranch, targetBranch);
      setGitBranchCompare(compare);
      setGitBranchCompareStatus(buildFreshGitBranchCompareStatus({
        baseBranch: compare.base_branch,
        headBranch: compare.head_branch,
      }));
      return compare;
    } catch (error) {
      const failureMessage = formatWorkspaceRuntimeResourceFailure(error);
      setGitBranchCompareStatus((prev) => buildStaleGitBranchCompareStatus({
        previousStatus: prev,
        baseBranch: currentBranch,
        headBranch: targetBranch,
        reasonMessage: failureMessage,
      }));
      return null;
    }
  }, [setGitBranchCompare, setGitBranchCompareStatus, setGitBranchCompareTarget, setGitBranchSwitchReadiness]);

  const refreshProjectBranchCompareTarget = useCallback(async (projectId: string, targetBranch: string) => {
    return refreshProjectBranchCompare(projectId, gitBranches, targetBranch);
  }, [gitBranches, refreshProjectBranchCompare]);

  const fetchProjectBranches = useCallback(async (
    projectId: string,
    preferredTargetBranch = gitBranchCompareTargetRef.current,
    options: WorkspaceGitResourceRefreshOptions = {},
  ) => {
    try {
      const branches = await projectApi.getBranches(projectId);
      setGitBranches(branches);
      setGitBranchListStatus(buildFreshGitBranchListStatus({ branchCount: branches.length }));
      await refreshProjectBranchCompare(projectId, branches, preferredTargetBranch);
      lastGitBranchesRefreshFailureNoticeAtRef.current.delete(projectId);
      return branches;
    } catch (error) {
      const now = Date.now();
      const failureMessage = formatWorkspaceRuntimeResourceFailure(error);
      setGitBranchListStatus((prev) => buildStaleGitBranchListStatus({
        previousStatus: prev,
        reasonMessage: failureMessage,
      }));
      setGitBranchSwitchReadiness(null);
      setGitBranchCompareStatus((prev) => buildStaleGitBranchCompareStatus({
        previousStatus: prev,
        baseBranch: getWorkspaceRuntimeResourceBranchCompareStatusBaseBranch(prev),
        headBranch: getWorkspaceRuntimeResourceBranchCompareStatusHeadBranch(prev),
        reasonMessage: failureMessage,
      }));
      const lastNoticeAt = getWorkspaceRuntimeResourceNoticeTimestamp(
        lastGitBranchesRefreshFailureNoticeAtRef.current,
        projectId,
      );
      const shouldPublishNotice = shouldPublishWorkspaceRuntimeResourceRefreshNotice(
        options,
        now,
        lastNoticeAt,
        GIT_BRANCHES_REFRESH_FAILURE_NOTICE_COOLDOWN_MS,
      );
      if (shouldPublishNotice === true) {
        lastGitBranchesRefreshFailureNoticeAtRef.current.set(projectId, now);
        applyRuntimeResourceMessages((prev) => [...prev, {
          id: `git-branches-refresh-failed-${projectId}-${now}`,
          role: 'assistant',
          content: `Git 分支列表同步失败：${failureMessage}。当前 Git 面板的分支信息可能仍是旧状态；你可以稍后重新刷新分支列表，提交详情和已打开文件不会因此丢失。`,
          timestamp: new Date().toISOString(),
        }]);
      }
      const shouldThrowOnFailure = shouldWorkspaceRuntimeResourceThrowOnFailure(options);
      if (shouldThrowOnFailure === true) {
        throw error;
      }
      return [];
    }
  }, [applyRuntimeResourceMessages, refreshProjectBranchCompare, setGitBranchCompareStatus, setGitBranchListStatus, setGitBranchSwitchReadiness, setGitBranches]);

  useEffect(() => {
    const persistedProject = getWorkspaceRuntimeResourcePersistedProject(projectInfo);
    if (persistedProject === null) return;
    const isImplementingPlan = implementingPlanRef.current === true;
    if (isImplementingPlan === true || isGenerating === true) return;

    const shouldFetchFileTree = shouldFetchWorkspaceBootstrapFileTree(persistedProject);
    if (shouldFetchFileTree === false) return;

    const currentProjectId = persistedProject.projectId;
    if (
      workspaceBootstrapCompletedRef.current.has(currentProjectId)
      || workspaceBootstrapInFlightRef.current.has(currentProjectId)
    ) {
      return;
    }

    let cancelled = false;
    workspaceBootstrapInFlightRef.current.add(currentProjectId);

    const bootstrapWorkspaceResources = async () => {
      try {
        await fetchProjectFileTree(currentProjectId);
        if (isWorkspaceRuntimeResourceEffectActive(cancelled) === false) return;
        const fileTreeFetched = true;

        const shouldFetchGitAfterFileTree = shouldFetchWorkspaceBootstrapGitResources({
          fileTreeFetched,
        });
        if (shouldFetchGitAfterFileTree === true) {
          await Promise.all([
            fetchProjectBranches(currentProjectId),
            fetchProjectCommits(currentProjectId),
            fetchProjectRemotes(currentProjectId),
            fetchProjectRemoteBranches(currentProjectId),
            fetchProjectTags(currentProjectId),
            fetchProjectStashes(currentProjectId),
            fetchProjectWorktreeStatus(currentProjectId),
          ]);
          if (isWorkspaceRuntimeResourceEffectActive(cancelled) === false) return;
        }

        const needsRuntime = appTypeNeedsRuntime(persistedProject.appType);
        const hasSelectedPlan = hasWorkspaceRuntimeSelectedPlan(persistedProject);
        let runtimeReady = false;

        if (needsRuntime === true) {
          const containerStatus = getWorkspaceRuntimeResourceStatusValue(persistedProject.containerStatus);
          let runtimeStatus = getWorkspaceRuntimeProjectRuntimeStatusValue(persistedProject.runtimeStatus);
          const hasRuntimeStatus = hasWorkspaceRuntimeResourceTextValue(runtimeStatus);

          if (containerStatus === 'running' && hasRuntimeStatus === false) {
            const snapshot = await fetchRuntimeStatusSnapshot(currentProjectId, '正在恢复运行时状态...');
            if (isWorkspaceRuntimeResourceEffectActive(cancelled) === false) return;
            const snapshotStatus = snapshot === null ? null : snapshot.status;
            runtimeStatus = getWorkspaceRuntimeResourceStatusValue(snapshotStatus);
          }

          const runtimePreparing = runtimeStatus === 'preparing' || runtimeStatus === 'starting';
          const runtimeFailed = runtimeStatus === 'failed';
          runtimeReady = runtimeStatus === 'ready';

          if (runtimePreparing === true) {
            await waitForProjectRuntimeReady(currentProjectId);
            if (isWorkspaceRuntimeResourceEffectActive(cancelled) === false) return;
            runtimeReady = true;
          } else if (runtimeReady === false && runtimeFailed === false && hasSelectedPlan === true) {
            autoStartAttemptedProjectsRef.current.add(currentProjectId);
            const status = await ensureProjectRuntimeReady(currentProjectId, {
              initialStage: '正在恢复开发环境...',
            });
            if (isWorkspaceRuntimeResourceEffectActive(cancelled) === false) return;
            if (status.status !== 'ready') return;
            runtimeReady = true;
          }
        }

        workspaceBootstrapCompletedRef.current.add(currentProjectId);
        lastWorkspaceBootstrapFailureNoticeAtRef.current.delete(currentProjectId);
      } catch (error) {
        workspaceBootstrapCompletedRef.current.delete(currentProjectId);
        autoStartAttemptedProjectsRef.current.delete(currentProjectId);
        if (isWorkspaceRuntimeResourceEffectActive(cancelled) === true) {
          console.error('workspace 初始化资源失败:', error);
          const now = Date.now();
          const lastNoticeAt = getWorkspaceRuntimeResourceNoticeTimestamp(
            lastWorkspaceBootstrapFailureNoticeAtRef.current,
            currentProjectId,
          );
          const shouldPublishNotice = shouldPublishWorkspaceRuntimeResourceNotice(
            now,
            lastNoticeAt,
            WORKSPACE_BOOTSTRAP_FAILURE_NOTICE_COOLDOWN_MS,
          );
          if (shouldPublishNotice === true) {
            lastWorkspaceBootstrapFailureNoticeAtRef.current.set(currentProjectId, now);
            applyRuntimeResourceMessages((prev) => [...prev, {
              id: `workspace-bootstrap-failed-${currentProjectId}-${now}`,
              role: 'assistant',
              content: `Workspace 资源恢复失败：${formatWorkspaceRuntimeResourceFailure(error)}。当前文件树、Git 面板或运行时恢复状态可能尚未同步；你可以稍后刷新项目或重新进入 Workspace，已打开文件的本地编辑内容不会因此丢失。`,
              timestamp: new Date().toISOString(),
            }]);
          }
        }
      } finally {
        workspaceBootstrapInFlightRef.current.delete(currentProjectId);
      }
    };

    void bootstrapWorkspaceResources();

    return () => {
      cancelled = true;
    };
  }, [
    appTypeNeedsRuntime,
    ensureProjectRuntimeReady,
    fetchProjectBranches,
    fetchProjectCommits,
    fetchProjectRemotes,
    fetchProjectRemoteBranches,
    fetchProjectStashes,
    fetchProjectTags,
    fetchProjectWorktreeStatus,
    fetchProjectDetail,
    fetchProjectFileTree,
    fetchRuntimeStatusSnapshot,
    implementingPlanRef,
    isGenerating,
    projectInfo,
    setGenerationStage,
    applyRuntimeResourceMessages,
    waitForProjectRuntimeReady,
  ]);

  return {
    fetchProjectDetail,
    fetchProjectFileTree,
    refreshProjectFileTree,
    waitForProjectRuntimeReady,
    ensureProjectRuntimeReady,
    fetchRuntimeStatusSnapshot,
    fetchProjectBranches,
    refreshProjectBranchCompareTarget,
    fetchProjectRemotes,
    fetchProjectCommits,
    fetchProjectRemoteBranches,
    fetchProjectTags,
    fetchProjectStashes,
    fetchProjectWorktreeStatus,
    resetWorkspaceRuntimeBootstrapState,
  };
}
