'use client';

import { useWorkspaceFlowState } from './use-workspace-flow-state';
import { useWorkspacePageLocalState } from './use-workspace-page-local-state';
import { useWorkspaceProjectBootstrap } from './use-workspace-project-bootstrap';
import { useWorkspaceRuntimeResources } from './use-workspace-runtime-resources';
import { useWorkspaceShellState } from './use-workspace-shell-state';
import {
  appTypeNeedsRuntime,
  buildInitialWorkspaceMessages,
  buildProjectPreviewUrlResult,
  clearPendingWorkspaceNavigation,
  deserializeWorkspaceMessage,
  hasFreshPendingWorkspaceNavigation,
  normalizeFileTreePayload,
  safeParseJSON,
} from './workspace-page-helpers';
import {
  normalizePlanSelectionMessages,
  removeLegacyPlaceholderMessages,
} from './workspace-plan-message-helpers';
import type { WorkspacePageFoundationContract } from './workspace-page-foundation-contract';
import type { WorkspacePlanGenerationProjectIdSet } from './workspace-plan-generation-types';

type UseWorkspacePageFoundationOptions = {
  authLoading: boolean;
  isAuthenticated: boolean;
  hasMounted: boolean;
  projectIdParam: string | null;
  projectParam: string | null;
  replaceHome: () => void;
  plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
};

export function useWorkspacePageFoundation({
  authLoading,
  isAuthenticated,
  hasMounted,
  projectIdParam,
  projectParam,
  replaceHome,
  plannedProjectIdsAcrossMounts,
}: UseWorkspacePageFoundationOptions): WorkspacePageFoundationContract {
  const localState = useWorkspacePageLocalState();

  const flowState = useWorkspaceFlowState({
    projectId: localState.projectInfo?.projectId,
    editorState: {
      activeFile: localState.activeFile,
      openFiles: localState.openFiles,
      files: localState.files,
      savedFiles: localState.savedFiles,
      editorBufferStatuses: localState.editorBufferStatuses,
      expandedFolders: localState.expandedFolders,
      searchQuery: localState.searchQuery,
      pendingCloseFile: localState.pendingCloseFile,
    },
    normalizePlanSelectionMessages,
    removeLegacyPlaceholderMessages,
  });

  const shellState = useWorkspaceShellState({
    messagesLength: flowState.messages.length,
  });

  const runtimeResources = useWorkspaceRuntimeResources({
    projectInfo: localState.projectInfo,
    isGenerating: localState.isGenerating,
    implementingPlanRef: localState.implementingPlanRef,
    safeParseJSON,
    normalizeFileTreePayload,
    buildProjectPreviewUrlResult,
    appTypeNeedsRuntime,
    setProjectInfo: localState.setProjectInfo,
    setFileTree: localState.setFileTree,
    setExplorerSnapshotStatus: localState.setExplorerSnapshotStatus,
    setExpandedFolders: localState.setExpandedFolders,
    setBrowserUrl: shellState.setBrowserUrl,
    setPreviewUrlStatus: shellState.setPreviewUrlStatus,
    setMobileBrowserUrl: shellState.setMobileBrowserUrl,
    setMobilePreviewUrlStatus: shellState.setMobilePreviewUrlStatus,
    setGenerationStage: localState.setGenerationStage,
    applyRuntimeResourceMessages: flowState.applyRuntimeResourceMessages,
    gitBranches: localState.gitBranches,
    gitBranchCompareTarget: localState.gitBranchCompareTarget,
    setGitBranches: localState.setGitBranches,
    setGitBranchListStatus: localState.setGitBranchListStatus,
    setGitRemotes: localState.setGitRemotes,
    setGitRemoteListStatus: localState.setGitRemoteListStatus,
    setGitRemoteBranches: localState.setGitRemoteBranches,
    setGitRemoteBranchListStatus: localState.setGitRemoteBranchListStatus,
    setGitTags: localState.setGitTags,
    setGitTagListStatus: localState.setGitTagListStatus,
    setGitStashes: localState.setGitStashes,
    setGitStashListStatus: localState.setGitStashListStatus,
    setGitWorktreeStatus: localState.setGitWorktreeStatus,
    setGitWorktreeStatusState: localState.setGitWorktreeStatusState,
    setGitBranchCompare: localState.setGitBranchCompare,
    setGitBranchCompareStatus: localState.setGitBranchCompareStatus,
    setGitBranchCompareTarget: localState.setGitBranchCompareTarget,
    setGitBranchSwitchReadiness: localState.setGitBranchSwitchReadiness,
    setGitCommits: localState.setGitCommits,
    setGitCommitListStatus: localState.setGitCommitListStatus,
    setSelectedCommit: localState.setSelectedCommit,
  });

  const { isRestoringWorkspace, messageRestoreStatus } = useWorkspaceProjectBootstrap({
    authLoading,
    isAuthenticated,
    hasMounted,
    projectIdParam,
    projectParam,
    projectInfo: localState.projectInfo,
    safeParseJSON,
    normalizeFileTreePayload,
    buildProjectPreviewUrlResult,
    buildInitialWorkspaceMessages,
    deserializeWorkspaceMessage,
    readWorkspaceSessionSnapshot: flowState.readWorkspaceSessionSnapshot,
    applyWorkspaceState: flowState.applyWorkspaceState,
    clearPendingWorkspaceNavigation,
    hasFreshPendingWorkspaceNavigation,
    routerReplaceHome: replaceHome,
    fetchProjectDetail: runtimeResources.fetchProjectDetail,
    setProjectInfo: localState.setProjectInfo,
    setActiveFile: localState.setActiveFile,
    setOpenFiles: localState.setOpenFiles,
    setFiles: localState.setFiles,
    setSavedFiles: localState.setSavedFiles,
    setEditorBufferStatuses: localState.setEditorBufferStatuses,
    setFileTree: localState.setFileTree,
    setExplorerSnapshotStatus: localState.setExplorerSnapshotStatus,
    setExpandedFolders: localState.setExpandedFolders,
    setSearchQuery: localState.setSearchQuery,
    setPendingCloseFile: localState.setPendingCloseFile,
    setBrowserUrl: shellState.setBrowserUrl,
    setPreviewUrlStatus: shellState.setPreviewUrlStatus,
    setMobileBrowserUrl: shellState.setMobileBrowserUrl,
    setMobilePreviewUrlStatus: shellState.setMobilePreviewUrlStatus,
    applyProjectBootstrapMessages: flowState.applyProjectBootstrapMessages,
    resetWorkspaceRuntimeBootstrapState: runtimeResources.resetWorkspaceRuntimeBootstrapState,
    initializedProjectIdRef: localState.initializedProjectIdRef,
    restoredProjectIdRef: localState.restoredProjectIdRef,
    routeProjectIdRef: localState.routeProjectIdRef,
    planningProjectIdRef: localState.planningProjectIdRef,
    plannedProjectIdsRef: localState.plannedProjectIdsRef,
    plannedProjectIdsAcrossMounts,
    autoPlanTriggeredRef: localState.autoPlanTriggeredRef,
  });

  return {
    localState,
    flowState,
    shellState,
    runtimeResources,
    isRestoringWorkspace,
    messageRestoreStatus,
  };
}
