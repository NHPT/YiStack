'use client';

import { useWorkspaceIdeInteractions } from './use-workspace-ide-interactions';
import { useWorkspaceResourceOperations } from './use-workspace-resource-operations';
import type { ProjectRuntimeStatus } from '@/lib/api';
import type {
  WorkspaceMessageListAction,
  WorkspaceProjectPanelRefreshMessagesAction,
} from './workspace-flow-state-contract';
import type { WorkspacePageLocalStateContract } from './workspace-page-local-state-contract';
import type { WorkspacePageProjectActionsContract } from './workspace-page-project-actions-contract';
import type {
  WorkspaceFileTreeRefreshOptions,
  WorkspaceGitResourceRefreshOptions,
  WorkspaceRuntimeStatusSnapshotOptions,
} from './workspace-runtime-resources-contract';
import type { WorkspaceShellStateSetter } from './workspace-shell-state-contract';
import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceProjectPanelManualRefreshStatus,
} from '@/lib/workspace/engineering-state';
import type {
  GitBranch,
  GitCommit,
  GitRemote,
  GitRemoteBranch,
  GitStash,
  GitTag,
  GitWorktreeStatus,
} from '@/lib/types';
import { formatWorkspaceResourceOperationFailure } from '@/lib/workspace/workspace-resource-operation-errors';
import { formatWorkspaceRuntimeResourceFailure } from '@/lib/workspace/workspace-runtime-resource-errors';
import {
  removeFilePathFromTree,
  renameFilePathInTree,
  upsertFilePathIntoTree,
} from './workspace-page-helpers';
import {
  buildFreshExplorerSnapshotStatus,
  buildStaleExplorerSnapshotStatus,
} from './workspace-explorer-snapshot-status';
import type { ExplorerSnapshotStatus, WorkspaceChatMessage, WorkspaceMobileView, WorkspaceProjectInfo } from './workspace-types';

type LocalState = WorkspacePageLocalStateContract;

function shouldUseWorkspacePageProjectActionMobileIdeView(isMobile: boolean): boolean {
  const shouldUseMobileIdeView = isMobile === true;
  return shouldUseMobileIdeView === true;
}

function applyWorkspacePageProjectActionMobileIdeView(
  isMobile: boolean,
  setMobileView: WorkspaceShellStateSetter<WorkspaceMobileView>,
) {
  const shouldUseMobileIdeView = shouldUseWorkspacePageProjectActionMobileIdeView(isMobile);
  if (shouldUseMobileIdeView === true) {
    setMobileView('ide');
  }
}

export type WorkspacePageProjectActionsFlowState = {
  applyProjectPanelRefreshMessages: WorkspaceProjectPanelRefreshMessagesAction;
  applyIdeInteractionMessages: WorkspaceMessageListAction;
  applyResourceFileMessages: WorkspaceMessageListAction;
  applyResourceGitMessages: WorkspaceMessageListAction;
};

export type WorkspacePageProjectActionsShellState = {
  isMobile: boolean;
  mobileEditingFile: string | null;
  setMobileEditingFile: WorkspaceShellStateSetter<string | null>;
  mobileFileContent: string;
  setMobileFileContent: WorkspaceShellStateSetter<string>;
  setMobileView: WorkspaceShellStateSetter<WorkspaceMobileView>;
  requestPreviewReload: () => void;
};

export type WorkspacePageProjectActionsRuntimeResources = {
  fetchProjectDetail: (projectId: string) => Promise<void>;
  fetchRuntimeStatusSnapshot: (
    projectId: string,
    fallbackMessage?: string,
    options?: WorkspaceRuntimeStatusSnapshotOptions,
  ) => Promise<ProjectRuntimeStatus | null>;
  refreshProjectFileTree: (
    projectId: string,
    force?: boolean,
    options?: WorkspaceFileTreeRefreshOptions,
  ) => Promise<void>;
  fetchProjectBranches: (
    projectId: string,
    preferredTargetBranch?: string,
    options?: WorkspaceGitResourceRefreshOptions,
  ) => Promise<GitBranch[]>;
  fetchProjectRemotes: (
    projectId: string,
    options?: WorkspaceGitResourceRefreshOptions,
  ) => Promise<GitRemote[]>;
  fetchProjectRemoteBranches: (
    projectId: string,
    options?: WorkspaceGitResourceRefreshOptions,
  ) => Promise<GitRemoteBranch[]>;
  fetchProjectTags: (
    projectId: string,
    options?: WorkspaceGitResourceRefreshOptions,
  ) => Promise<GitTag[]>;
  fetchProjectStashes: (
    projectId: string,
    options?: WorkspaceGitResourceRefreshOptions,
  ) => Promise<GitStash[]>;
  fetchProjectWorktreeStatus: (
    projectId: string,
    options?: WorkspaceGitResourceRefreshOptions,
  ) => Promise<GitWorktreeStatus | null>;
  fetchProjectCommits: (
    projectId: string,
    options?: WorkspaceGitResourceRefreshOptions,
  ) => Promise<GitCommit[]>;
};

type UseWorkspacePageProjectActionsOptions = {
  localState: LocalState;
  flowState: WorkspacePageProjectActionsFlowState;
  shellState: WorkspacePageProjectActionsShellState;
  runtimeResources: WorkspacePageProjectActionsRuntimeResources;
};

type WorkspacePageProjectActionFailureMessageList = string[];

function hasWorkspacePageProjectActionTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function materializeWorkspacePageProjectActionRejectedResults(
  results: PromiseSettledResult<unknown>[],
): PromiseRejectedResult[] {
  const rejectedResults: PromiseRejectedResult[] = [];

  for (const result of results) {
    const isRejectedResult = result.status === 'rejected';
    if (isRejectedResult === true) {
      rejectedResults.push(result);
    }
  }

  return rejectedResults;
}

function getWorkspacePageProjectActionPersistedProject(projectInfo: WorkspaceProjectInfo | null): WorkspaceProjectInfo | null {
  if (projectInfo === null) {
    return null;
  }

  const isPersistedProject = projectInfo.isPersisted === true;
  if (isPersistedProject === false) {
    return null;
  }

  const hasProjectId = hasWorkspacePageProjectActionTextValue(projectInfo.projectId);
  if (hasProjectId === false) {
    return null;
  }

  return projectInfo;
}

function getWorkspacePageProjectActionFallbackMessage(value: string | null | undefined, fallback: string): string {
  const hasValue = hasWorkspacePageProjectActionTextValue(value);
  if (hasValue === true) {
    return value;
  }

  return fallback;
}

function getWorkspacePageProjectActionFailureMessages(failures: PromiseRejectedResult[]): WorkspacePageProjectActionFailureMessageList {
  const failureMessages: WorkspacePageProjectActionFailureMessageList = [];
  for (const failure of failures) {
    const failureMessage = formatWorkspaceRuntimeResourceFailure(failure.reason);
    const hasFailureMessage = hasWorkspacePageProjectActionTextValue(failureMessage);
    if (hasFailureMessage === true) {
      failureMessages.push(failureMessage);
    }
  }

  return failureMessages;
}

function getWorkspacePageProjectActionFailureMessage(failures: PromiseRejectedResult[]): string {
  const failureMessages = getWorkspacePageProjectActionFailureMessages(failures);
  const joinedFailureMessage = failureMessages.join('；');
  return getWorkspacePageProjectActionFallbackMessage(joinedFailureMessage, '未知错误');
}

function buildExplorerManualRefreshState(
  status: WorkspaceProjectPanelManualRefreshStatus,
  reasonMessage?: string,
  snapshotStatus?: ExplorerSnapshotStatus | null,
): WorkspaceEngineeringStateSnapshot {
  const hasUsableSnapshot = snapshotStatus?.status === 'fresh' || snapshotStatus?.status === 'stale_with_snapshot';
  const hasLocalOperationOverlay = snapshotStatus?.status === 'stale_with_local_changes';
  const hasStreamPreview = snapshotStatus?.status === 'stale_with_stream_preview';
  const snapshotTask = status === 'passed'
    ? 'Explorer 文件树已刷新为后端真源'
    : hasStreamPreview
      ? 'Explorer 包含 Implementation 生成流本地预览但后端真源未确认'
    : hasLocalOperationOverlay
      ? 'Explorer 包含本地文件事务反映但后端真源未确认'
    : hasUsableSnapshot
      ? 'Explorer 仍显示上一次成功同步的旧快照'
      : 'Explorer 当前没有可确认的后端文件树快照';
  const snapshotNextAction = status === 'passed'
    ? '继续基于当前 Explorer 目录快照进行文件操作。'
    : hasStreamPreview
      ? '当前 Explorer 只能作为生成流本地预览参考；刷新成功前不要依赖它判断完整后端真源。'
    : hasLocalOperationOverlay
      ? '当前 Explorer 只能作为本地事务结果参考；刷新成功前不要依赖它判断完整后端真源。'
    : hasUsableSnapshot
      ? '当前 Explorer 仅可作为旧快照参考；刷新成功前不要依赖它判断后端真源。'
      : '先恢复 Explorer 文件树真源，再判断项目是否真的没有文件。';

  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: status === 'passed' ? 'passed' : 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: status === 'passed' ? 'Explorer 已重新刷新' : 'Explorer 重新刷新失败',
      completed_tasks: status === 'passed'
        ? ['已打开 Explorer 面板', '已从后端重新拉取文件树']
        : ['已打开 Explorer 面板', snapshotTask],
      blockers: reasonMessage ? [reasonMessage] : [],
      next_action: status === 'passed'
        ? '继续基于当前 Explorer 目录快照进行文件操作。'
        : snapshotNextAction,
      status: status === 'passed' ? 'passed' : 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: status === 'passed' ? 'Explorer 手动刷新已恢复' : 'Explorer 手动刷新失败',
      next_action: status === 'passed'
        ? '继续执行后续 Workspace 文件操作。'
        : snapshotNextAction,
    },
    recovery: {
      blocked: false,
      reason_code: status === 'passed'
        ? 'explorer_manual_refresh_recovered'
        : 'explorer_manual_refresh_failed',
      reason_message: status === 'passed'
        ? 'Explorer 已从后端真源重新拉取文件树。'
        : `${reasonMessage || 'Explorer 手动刷新失败'}；${snapshotTask}。`,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: status === 'failed',
      retry_label: status === 'failed' ? '重新刷新 Explorer' : undefined,
      retry_prompt: status === 'failed'
        ? '请重新刷新当前 Workspace Explorer 文件树，并在失败时检查 runtime/API 状态。'
        : undefined,
    },
  };
}

function appendProjectPanelRefreshMessage(
  applyProjectPanelRefreshMessages: WorkspaceProjectPanelRefreshMessagesAction,
  message: WorkspaceChatMessage,
) {
  applyProjectPanelRefreshMessages((prev) => [...prev, message]);
}

export function useWorkspacePageProjectActions({
  localState,
  flowState,
  shellState,
  runtimeResources,
}: UseWorkspacePageProjectActionsOptions): WorkspacePageProjectActionsContract {
  const {
    projectInfo,
    setActiveTab,
    activeFile,
    setActiveFile,
    setEditorNavigationTarget,
    openFiles,
    setOpenFiles,
    files,
    setFiles,
    savedFiles,
    setSavedFiles,
    editorBufferStatuses,
    setEditorBufferStatuses,
    fileTree,
    explorerSnapshotStatus,
    setExplorerSnapshotStatus,
    setFileTree,
    setExpandedFolders,
    pendingCloseFile,
    setPendingCloseFile,
    setContextMenu,
    setSelectedCommit,
    setGitCommitDetailStatus,
    setGitBranchSwitchReadiness,
    isRestoringCommit,
    setIsRestoringCommit,
    pendingRestoreCommit,
    setPendingRestoreCommit,
  } = localState;

  const { applyProjectPanelRefreshMessages } = flowState;
  const {
    isMobile,
    mobileEditingFile,
    setMobileEditingFile,
    mobileFileContent,
    setMobileFileContent,
    setMobileView,
    requestPreviewReload,
  } = shellState;
  const {
    fetchProjectDetail,
    fetchRuntimeStatusSnapshot,
    refreshProjectFileTree,
    fetchProjectBranches,
    fetchProjectRemotes,
    fetchProjectRemoteBranches,
    fetchProjectTags,
    fetchProjectStashes,
    fetchProjectWorktreeStatus,
    fetchProjectCommits,
  } = runtimeResources;

  const openExplorerPanel = () => {
    setActiveTab('explorer');
    applyWorkspacePageProjectActionMobileIdeView(isMobile, setMobileView);
  };

  const refreshExplorerPanel = async () => {
    openExplorerPanel();
    const persistedProject = getWorkspacePageProjectActionPersistedProject(projectInfo);
    if (persistedProject === null) {
      const failureMessage = '当前项目尚未持久化，无法重新拉取后端文件树。';
      const nextSnapshotStatus = buildStaleExplorerSnapshotStatus({
        source: 'manual_refresh',
        previousStatus: explorerSnapshotStatus,
        hasLocalSnapshot: fileTree.length > 0,
        reasonMessage: failureMessage,
        failureKind: 'manual_refresh_unavailable',
      });
      setExplorerSnapshotStatus(nextSnapshotStatus);
      appendProjectPanelRefreshMessage(applyProjectPanelRefreshMessages, {
        id: `explorer-refresh-unavailable-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `Explorer 刷新暂不可用：${failureMessage}Workspace 将保持当前本地快照。`,
        statusContent: 'Explorer 刷新暂不可用',
        engineeringState: buildExplorerManualRefreshState('failed', failureMessage, nextSnapshotStatus),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const projectId = persistedProject.projectId;
    try {
      await refreshProjectFileTree(projectId, true, {
        throwOnFailure: true,
        suppressNotice: true,
      });
      const nextSnapshotStatus = buildFreshExplorerSnapshotStatus({
        source: 'manual_refresh',
        itemCount: fileTree.length,
      });
      setExplorerSnapshotStatus(nextSnapshotStatus);
      appendProjectPanelRefreshMessage(applyProjectPanelRefreshMessages, {
        id: `explorer-refresh-recovered-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: 'Explorer 已重新刷新：前端文件树已从后端真源重新拉取，可以继续基于当前目录快照操作。',
        statusContent: 'Explorer 已重新刷新',
        timestamp: new Date().toISOString(),
        engineeringState: buildExplorerManualRefreshState('passed', undefined, nextSnapshotStatus),
      });
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error);
      const nextSnapshotStatus = buildStaleExplorerSnapshotStatus({
        source: 'manual_refresh',
        previousStatus: explorerSnapshotStatus,
        hasLocalSnapshot: fileTree.length > 0,
        reasonMessage: failureMessage,
        failureKind: 'manual_refresh_failed',
      });
      setExplorerSnapshotStatus(nextSnapshotStatus);
      appendProjectPanelRefreshMessage(applyProjectPanelRefreshMessages, {
        id: `explorer-refresh-retry-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: nextSnapshotStatus.status === 'stale_with_stream_preview'
          ? `Explorer 重新刷新失败：${failureMessage}。当前目录树包含 Implementation 生成流本地预览，但后端真源仍未确认；请刷新成功后再用它判断完整后端文件树。`
          : nextSnapshotStatus.status === 'stale_with_local_changes'
          ? `Explorer 重新刷新失败：${failureMessage}。当前目录树包含本地文件事务反映，但后端真源仍未确认；请刷新成功后再用它判断完整后端文件树。`
          : nextSnapshotStatus.status === 'stale_with_snapshot'
            ? `Explorer 重新刷新失败：${failureMessage}。当前前端目录树仍是旧快照；请刷新成功后再用它判断后端真源。`
            : `Explorer 重新刷新失败：${failureMessage}。当前没有可确认的后端文件树快照；请先恢复 Explorer 后再判断项目是否真的没有文件。`,
        statusContent: 'Explorer 重新刷新失败',
        engineeringState: buildExplorerManualRefreshState('failed', failureMessage, nextSnapshotStatus),
        timestamp: new Date().toISOString(),
      });
    }
  };

  const openGitPanel = () => {
    setActiveTab('git');
    applyWorkspacePageProjectActionMobileIdeView(isMobile, setMobileView);
  };

  const refreshGitPanel = async () => {
    openGitPanel();
    const persistedProject = getWorkspacePageProjectActionPersistedProject(projectInfo);
    if (persistedProject === null) {
      return;
    }

    const refreshOptions = {
      throwOnFailure: true,
      suppressNotice: true,
    };
    const projectId = persistedProject.projectId;
    const results = await Promise.allSettled([
      fetchProjectWorktreeStatus(projectId, refreshOptions),
      fetchProjectBranches(projectId, undefined, refreshOptions),
      fetchProjectRemotes(projectId, refreshOptions),
      fetchProjectRemoteBranches(projectId, refreshOptions),
      fetchProjectTags(projectId, refreshOptions),
      fetchProjectStashes(projectId, refreshOptions),
      fetchProjectCommits(projectId, refreshOptions),
    ]);
    const failures = materializeWorkspacePageProjectActionRejectedResults(results);

    if (failures.length === 0) {
      return;
    }
  };

  const {
    saveFile,
    handleViewCommit,
    handleRestoreCommit,
    handleRestoreCommitFile,
    handleCommitWorktree,
    handleDiscardWorktreeFile,
    handleApplyGitBranchCompareFile,
    handleCreateGitStash,
    handleApplyGitStash,
    handleCreateGitBranch,
    handleCreateGitTag,
    handleDeleteGitTag,
    handleCreateGitBranchFromRemote,
    handleRefreshGitRemoteBranches,
    handleDeleteGitBranch,
    handleRenameGitBranch,
    handleSwitchGitBranch,
    confirmRestoreCommit,
  } = useWorkspaceResourceOperations({
    projectInfo,
    activeFile,
    files,
    mobileEditingFile,
    isRestoringCommit,
    pendingRestoreCommit,
    refreshProjectFileTree,
    fetchRuntimeStatusSnapshot,
    fetchProjectDetail,
    fetchProjectBranches,
    fetchProjectRemoteBranches,
    fetchProjectTags,
    fetchProjectStashes,
    fetchProjectWorktreeStatus,
    fetchProjectCommits,
    requestPreviewReload,
    setFiles,
    setSavedFiles,
    setEditorBufferStatuses,
    setOpenFiles,
    setActiveFile,
    setMobileEditingFile,
    setMobileFileContent,
    applyResourceFileMessages: flowState.applyResourceFileMessages,
    applyResourceGitMessages: flowState.applyResourceGitMessages,
    setSelectedCommit,
    setGitCommitDetailStatus,
    setGitBranchSwitchReadiness,
    setPendingRestoreCommit,
    setIsRestoringCommit,
    openGitView: () => {
      setActiveTab('git');
      applyWorkspacePageProjectActionMobileIdeView(isMobile, setMobileView);
    },
  });

  const {
    reflectFilePathInTree,
    isFileDirty,
    closeWorkspaceFile,
    requestCloseWorkspaceFile,
    applyIncrementalWorkflowStep,
    openWorkspaceFile,
    toggleFolder,
    showContextMenu,
    handleExplorerContextOperation,
    handleUnavailableExplorerContextOperation,
    downloadFile,
  } = useWorkspaceIdeInteractions({
    projectInfo,
    activeFile,
    mobileEditingFile,
    isMobile,
    files,
    savedFiles,
    editorBufferStatuses,
    openFiles,
    refreshProjectFileTree,
    setExplorerSnapshotStatus,
    setFileTree,
    setExpandedFolders,
    setFiles,
    setSavedFiles,
    setEditorBufferStatuses,
    setOpenFiles,
    setActiveFile,
    setEditorNavigationTarget,
    setMobileEditingFile,
    setMobileFileContent,
    applyIdeInteractionMessages: flowState.applyIdeInteractionMessages,
    pendingCloseFile,
    setPendingCloseFile,
    setContextMenu,
    showExplorerTab: openExplorerPanel,
    upsertFilePathIntoTree,
    removeFilePathFromTree,
    renameFilePathInTree,
  });

  return {
    saveFile,
    handleViewCommit,
    handleRestoreCommit,
    handleRestoreCommitFile,
    handleCommitWorktree,
    handleDiscardWorktreeFile,
    handleApplyGitBranchCompareFile,
    handleCreateGitStash,
    handleApplyGitStash,
    handleCreateGitBranch,
    handleCreateGitTag,
    handleDeleteGitTag,
    handleCreateGitBranchFromRemote,
    handleRefreshGitRemoteBranches,
    handleDeleteGitBranch,
    handleRenameGitBranch,
    handleSwitchGitBranch,
    confirmRestoreCommit,
    reflectFilePathInTree,
    isFileDirty,
    closeWorkspaceFile,
    requestCloseWorkspaceFile,
    applyIncrementalWorkflowStep,
    openWorkspaceFile,
    toggleFolder,
    showContextMenu,
    handleExplorerContextOperation,
    handleUnavailableExplorerContextOperation,
    downloadFile,
    openExplorerPanel,
    refreshExplorerPanel,
    openGitPanel,
    refreshGitPanel,
    mobileFileContent,
    setMobileFileContent,
  };
}
