'use client';

import { useCallback } from 'react';
import type {
  Dispatch,
  RefObject,
  SetStateAction,
} from 'react';
import type { ProjectRuntimeStatus } from '@/lib/api';
import type { FileNode, GitBranch, GitBranchCompare, GitBranchSwitchReadiness, GitCommit, GitRemote, GitRemoteBranch, GitStash, GitTag, GitWorktreeStatus } from '@/lib/types';
import type { ChatAttachmentSnapshot, ChatMode, ChatModelRegistrySnapshot, ChatScrollSnapshot, EditorBufferStatus, ExplorerSnapshotStatus, GitBranchCompareStatus, GitBranchListStatus, GitCommitDetailStatus, GitCommitListStatus, GitRemoteBranchListStatus, GitRemoteListStatus, GitStashListStatus, GitTagListStatus, GitWorktreeStatusState, IDETab, PreviewUrlStatus, WorkspaceBrowserDevice, WorkspaceEditorNavigationTarget, WorkspaceOpenFilePathList, WorkspaceProjectInfo } from './workspace-types';
import type { WorkspacePageUiPreviewDeviceStyle, WorkspacePageUiTab } from './workspace-page-ui-contract';
import type {
  WorkspaceChatAdjustTextareaHeightAction,
  WorkspaceChatAttachment,
  WorkspaceChatAutoScrollEnabledState,
  WorkspaceChatAutoScrollStateUpdateAction,
  WorkspaceChatAskQuestionAction,
  WorkspaceChatCancelStopGenerateAction,
  WorkspaceChatFileUploadAction,
  WorkspaceChatKeyDownAction,
  WorkspaceChatMessageList,
  WorkspaceChatMessagesContainerRef,
  WorkspaceChatMessagesEndRef,
  WorkspaceChatModelOption,
  WorkspaceChatRemoveAttachmentAction,
  WorkspaceChatRestoreCommitAction,
  WorkspaceChatRunGuidanceAction,
  WorkspaceChatSelectPlanAction,
  WorkspaceChatStopGenerateAction,
  WorkspacePlanCountdownValue,
  WorkspacePlanSelectionReadyState,
  WorkspaceSelectedPlanId,
} from './workspace-chat-panel-types';
import type {
  MonacoEditorComponent,
  WorkspaceEditorFileDirtyCheck,
  WorkspaceEditorRequestCloseFileAction,
  WorkspaceExplorerContextMenuAction,
  WorkspaceExplorerToggleFolderAction,
  WorkspaceFoundationConfirmDecisionsAction,
  WorkspaceFoundationStartAction,
  WorkspacePreviewHistoryNavigationAction,
  WorkspacePreviewNavigateAction,
  WorkspaceProjectExportAction,
  WorkspaceRuntimeRecoverAction,
  WorkspaceGitApplyBranchCompareFileAction,
  WorkspaceGitApplyStashAction,
  WorkspaceGitCommitWorktreeAction,
  WorkspaceGitCreateBranchAction,
  WorkspaceGitCreateBranchFromRemoteAction,
  WorkspaceGitCreateStashAction,
  WorkspaceGitCreateTagAction,
  WorkspaceGitDeleteBranchAction,
  WorkspaceGitDeleteTagAction,
  WorkspaceGitDiscardWorktreeFileAction,
  WorkspaceGitRefreshPanelAction,
  WorkspaceGitRefreshRemoteBranchesAction,
  WorkspaceGitRenameBranchAction,
  WorkspaceGitRestoreCommitFileAction,
  WorkspaceGitSelectBranchCompareTargetAction,
  WorkspaceGitSwitchBranchAction,
  WorkspaceGitViewCommitAction,
} from './workspace-ide-subpanel-types';
import { buildChatInputSnapshot, buildChatModeSnapshot, getWorkspaceChatComposerSnapshotSelectedModel } from './workspace-chat-composer-snapshot';
import { buildStopGenerationConfirmationSnapshot } from './workspace-stop-generation-confirmation-snapshot';

import {
  buildDesktopChatPanel,
  buildDesktopIdePanel,
  buildMobileChatPanel,
  buildMobileIdePanel,
} from './workspace-page-panel-builders';
import {
  buildChatPanelProps,
  buildDesktopIdePanelProps,
  buildMobileIdePanelProps,
  type ChatComposerProps,
  type ChatMessagesProps,
  type DesktopIdeProps,
  type MobileIdeProps,
} from './workspace-page-panel-props';
import { getWorkspaceEditorBufferContent } from './workspace-editor-buffer-content';
import type { WorkspaceEngineeringStateSnapshot, WorkspaceGateResult } from '@/lib/workspace/engineering-state';
import type { WorkspacePageContentContract } from './workspace-page-content-contract';

function hasWorkspacePageContentPersistedProject(projectInfo: WorkspaceProjectInfo | null): boolean {
  if (projectInfo === null) {
    return false;
  }

  const isPersistedProject = projectInfo.isPersisted === true;
  return isPersistedProject === true;
}

function getWorkspacePageContentProjectTextValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const hasValue = value.length > 0;
  if (hasValue === true) {
    return value;
  }

  return null;
}

function hasWorkspacePageContentAvailablePlans(availablePlansCount: number): boolean {
  const hasAvailablePlans = availablePlansCount > 0;
  return hasAvailablePlans === true;
}

function hasWorkspacePageContentSelectedPlan(selectedPlanId: WorkspaceSelectedPlanId): boolean {
  return selectedPlanId !== null;
}

function isWorkspacePageContentPlanSelectionPending(
  availablePlansCount: number,
  selectedPlanId: WorkspaceSelectedPlanId,
): boolean {
  const hasAvailablePlans = hasWorkspacePageContentAvailablePlans(availablePlansCount);
  const hasSelectedPlan = hasWorkspacePageContentSelectedPlan(selectedPlanId);
  return hasAvailablePlans === true && hasSelectedPlan === false;
}

function isWorkspacePageContentBusyGenerating(isGenerating: boolean, isPlanning: boolean): boolean {
  const hasGenerating = isGenerating === true;
  const hasPlanning = isPlanning === true;
  return hasGenerating === true || hasPlanning === true;
}

function hasWorkspacePageContentSaveSucceeded(ok: boolean): boolean {
  return ok === true;
}

export type UseWorkspacePageContentOptions = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  projectInfo: WorkspaceProjectInfo | null;
  isGenerating: boolean;
  generationStage: string;
  isStopConfirming: boolean;
  isPlanning: boolean;
  selectedModel: string;
  setSelectedModel: Dispatch<SetStateAction<string>>;
  chatModelRegistrySnapshot: ChatModelRegistrySnapshot;
  chatMode: ChatMode;
  setChatMode: Dispatch<SetStateAction<ChatMode>>;
  isOnline: boolean;
  setIsOnline: Dispatch<SetStateAction<boolean>>;
  attachedFiles: WorkspaceChatAttachment[];
  chatAttachmentSnapshot: ChatAttachmentSnapshot;
  models: WorkspaceChatModelOption[];
  messages: WorkspaceChatMessageList;
  planCountdown: WorkspacePlanCountdownValue;
  planSelectionReady: WorkspacePlanSelectionReadyState;
  selectedPlanId: WorkspaceSelectedPlanId;
  availablePlansCount: number;
  desktopMessagesRef: WorkspaceChatMessagesContainerRef;
  mobileMessagesRef: WorkspaceChatMessagesContainerRef;
  messagesEndRef: WorkspaceChatMessagesEndRef;
  isChatAutoScrollEnabled: WorkspaceChatAutoScrollEnabledState;
  chatScrollSnapshot: ChatScrollSnapshot;
  setIsChatAutoScrollEnabled: Dispatch<SetStateAction<boolean>>;
  updateChatAutoScrollState: WorkspaceChatAutoScrollStateUpdateAction;
  scrollToBottom: () => void;
  choosePlanAndImplement: WorkspaceChatSelectPlanAction;
  handleSuggestedQuestion: WorkspaceChatAskQuestionAction;
  handleSuggestedAction: WorkspaceChatRunGuidanceAction;
  handleRestoreCommit: WorkspaceChatRestoreCommitAction;
  handleRestoreCommitFile: WorkspaceGitRestoreCommitFileAction;
  onCommitWorktree: WorkspaceGitCommitWorktreeAction;
  onDiscardWorktreeFile: WorkspaceGitDiscardWorktreeFileAction;
  onApplyGitBranchCompareFile: WorkspaceGitApplyBranchCompareFileAction;
  onCreateGitStash: WorkspaceGitCreateStashAction;
  onApplyGitStash: WorkspaceGitApplyStashAction;
  handleViewCommit: WorkspaceGitViewCommitAction;
  openWorkspaceFile: (target: string | WorkspaceEditorNavigationTarget) => Promise<void> | void;
  adjustTextareaHeight: WorkspaceChatAdjustTextareaHeightAction;
  handleKeyDown: WorkspaceChatKeyDownAction;
  removeAttachment: WorkspaceChatRemoveAttachmentAction;
  handleFileUpload: WorkspaceChatFileUploadAction;
  handleStopGenerate: WorkspaceChatStopGenerateAction;
  handleCancelStopGenerate: WorkspaceChatCancelStopGenerateAction;
  handleGenerate: () => Promise<void>;
  handleRecoverRuntime: WorkspaceRuntimeRecoverAction;
  foundationStatusLabel: string;
  tabs: WorkspacePageUiTab[];
  activeTab: IDETab;
  gitBranch: string;
  gitBranches: GitBranch[];
  gitBranchListStatus: GitBranchListStatus | null;
  gitRemotes: GitRemote[];
  gitRemoteListStatus: GitRemoteListStatus | null;
  gitRemoteBranches: GitRemoteBranch[];
  gitRemoteBranchListStatus: GitRemoteBranchListStatus | null;
  gitTags: GitTag[];
  gitTagListStatus: GitTagListStatus | null;
  gitStashes: GitStash[];
  gitStashListStatus: GitStashListStatus | null;
  gitWorktreeStatus: GitWorktreeStatus | null;
  gitWorktreeStatusState: GitWorktreeStatusState | null;
  gitBranchCompare: GitBranchCompare | null;
  gitBranchCompareStatus: GitBranchCompareStatus | null;
  gitBranchCompareTarget: string;
  gitBranchSwitchReadiness: GitBranchSwitchReadiness | null;
  onSelectGitBranchCompareTarget: WorkspaceGitSelectBranchCompareTargetAction;
  onCreateGitBranch: WorkspaceGitCreateBranchAction;
  onCreateGitTag: WorkspaceGitCreateTagAction;
  onDeleteGitTag: WorkspaceGitDeleteTagAction;
  onCreateGitBranchFromRemote: WorkspaceGitCreateBranchFromRemoteAction;
  onRefreshGitPanel: WorkspaceGitRefreshPanelAction;
  onRefreshGitRemoteBranches: WorkspaceGitRefreshRemoteBranchesAction;
  onDeleteGitBranch: WorkspaceGitDeleteBranchAction;
  onRenameGitBranch: WorkspaceGitRenameBranchAction;
  onSwitchGitBranch: WorkspaceGitSwitchBranchAction;
  setActiveTab: Dispatch<SetStateAction<IDETab>>;
  gitCommits: GitCommit[];
  gitCommitListStatus: GitCommitListStatus | null;
  browserDevice: WorkspaceBrowserDevice;
  setBrowserDevice: Dispatch<SetStateAction<WorkspaceBrowserDevice>>;
  previewDeviceStyle: WorkspacePageUiPreviewDeviceStyle;
  browserUrl: string;
  previewUrlStatus: PreviewUrlStatus | null;
  previewReloadToken: number;
  runtimeStatus?: ProjectRuntimeStatus;
  setBrowserUrl: Dispatch<SetStateAction<string>>;
  setPreviewUrlStatus: Dispatch<SetStateAction<PreviewUrlStatus | null>>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  filteredTree: FileNode[];
  hasOriginalFileTreeData: boolean;
  explorerSnapshotStatus: ExplorerSnapshotStatus | null;
  expandedFolders: Set<string>;
  activeFile: string | null;
  editorNavigationTarget: WorkspaceEditorNavigationTarget | null;
  clearEditorNavigationTarget: () => void;
  setActiveFile: Dispatch<SetStateAction<string | null>>;
  openFiles: WorkspaceOpenFilePathList;
  files: Map<string, string>;
  editorBufferStatuses: Map<string, EditorBufferStatus>;
  setEditorBufferStatuses: Dispatch<SetStateAction<Map<string, EditorBufferStatus>>>;
  setFiles: Dispatch<SetStateAction<Map<string, string>>>;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  contextGateResult?: WorkspaceGateResult;
  foundationActionLabel: string;
  mobileEditingFile: string | null;
  setMobileEditingFile: Dispatch<SetStateAction<string | null>>;
  mobileFileContent: string;
  setMobileFileContent: Dispatch<SetStateAction<string>>;
  selectedCommit: GitCommit | null;
  gitCommitDetailStatus: GitCommitDetailStatus | null;
  projectId: string | null;
  monacoEditor: MonacoEditorComponent;
  handleStartFoundation: WorkspaceFoundationStartAction;
  handleConfirmFoundationDecisions: WorkspaceFoundationConfirmDecisionsAction;
  exportProject: WorkspaceProjectExportAction;
  toggleFolder: WorkspaceExplorerToggleFolderAction;
  showContextMenu: WorkspaceExplorerContextMenuAction;
  isFileDirty: WorkspaceEditorFileDirtyCheck;
  requestCloseWorkspaceFile: WorkspaceEditorRequestCloseFileAction;
  saveFile: (path: string, content: string) => Promise<boolean>;
  copyToClipboard: (text: string) => Promise<void>;
  historyIndex: number;
  browserHistoryLength: number;
  mobileBrowserUrl: string;
  mobilePreviewUrlStatus: PreviewUrlStatus | null;
  setMobileBrowserUrl: Dispatch<SetStateAction<string>>;
  setMobilePreviewUrlStatus: Dispatch<SetStateAction<PreviewUrlStatus | null>>;
  navigateTo: WorkspacePreviewNavigateAction;
  goBrowserBack: WorkspacePreviewHistoryNavigationAction;
  goForward: WorkspacePreviewHistoryNavigationAction;
  pendingCloseFile: string | null;
  setPendingCloseFile: Dispatch<SetStateAction<string | null>>;
  closeWorkspaceFile: (path: string, discard?: boolean) => void;
  onCollapseDesktopChat: () => void;
};

export function useWorkspacePageContent({
  textareaRef,
  input,
  setInput,
  projectInfo,
  isGenerating,
  generationStage,
  isStopConfirming,
  isPlanning,
  selectedModel,
  setSelectedModel,
  chatModelRegistrySnapshot,
  chatMode,
  setChatMode,
  isOnline,
  setIsOnline,
  attachedFiles,
  chatAttachmentSnapshot,
  models,
  messages,
  planCountdown,
  planSelectionReady,
  selectedPlanId,
  availablePlansCount,
  desktopMessagesRef,
  mobileMessagesRef,
  messagesEndRef,
  isChatAutoScrollEnabled,
  chatScrollSnapshot,
  setIsChatAutoScrollEnabled,
  updateChatAutoScrollState,
  scrollToBottom,
  choosePlanAndImplement,
  handleSuggestedQuestion,
  handleSuggestedAction,
  handleRestoreCommit,
  handleRestoreCommitFile,
  onCommitWorktree,
  onDiscardWorktreeFile,
  onApplyGitBranchCompareFile,
  onCreateGitStash,
  onApplyGitStash,
  handleViewCommit,
  openWorkspaceFile,
  adjustTextareaHeight,
  handleKeyDown,
  removeAttachment,
  handleFileUpload,
  handleStopGenerate,
  handleCancelStopGenerate,
  handleGenerate,
  handleRecoverRuntime,
  foundationStatusLabel,
  tabs,
  activeTab,
  setActiveTab,
  gitCommits,
  gitBranch,
  gitBranches,
  gitBranchListStatus,
  gitRemotes,
  gitRemoteListStatus,
  gitRemoteBranches,
  gitRemoteBranchListStatus,
  gitTags,
  gitTagListStatus,
  gitStashes,
  gitStashListStatus,
  gitWorktreeStatus,
  gitWorktreeStatusState,
  gitBranchCompare,
  gitBranchCompareStatus,
  gitBranchCompareTarget,
  gitBranchSwitchReadiness,
  onSelectGitBranchCompareTarget,
  onCreateGitBranch,
  onCreateGitTag,
  onDeleteGitTag,
  onCreateGitBranchFromRemote,
  onRefreshGitPanel,
  onRefreshGitRemoteBranches,
  onDeleteGitBranch,
  onRenameGitBranch,
  onSwitchGitBranch,
  gitCommitListStatus,
  browserDevice,
  setBrowserDevice,
  previewDeviceStyle,
  browserUrl,
  previewUrlStatus,
  previewReloadToken,
  runtimeStatus,
  setBrowserUrl,
  setPreviewUrlStatus,
  searchQuery,
  setSearchQuery,
  filteredTree,
  hasOriginalFileTreeData,
  explorerSnapshotStatus,
  expandedFolders,
  activeFile,
  editorNavigationTarget,
  clearEditorNavigationTarget,
  setActiveFile,
  openFiles,
  files,
  editorBufferStatuses,
  setEditorBufferStatuses,
  setFiles,
  engineeringState,
  contextGateResult,
  foundationActionLabel,
  mobileEditingFile,
  setMobileEditingFile,
  mobileFileContent,
  setMobileFileContent,
  selectedCommit,
  gitCommitDetailStatus,
  projectId,
  monacoEditor,
  handleStartFoundation,
  handleConfirmFoundationDecisions,
  exportProject,
  toggleFolder,
  showContextMenu,
  isFileDirty,
  requestCloseWorkspaceFile,
  saveFile,
  copyToClipboard,
  historyIndex,
  browserHistoryLength,
  mobileBrowserUrl,
  mobilePreviewUrlStatus,
  setMobileBrowserUrl,
  setMobilePreviewUrlStatus,
  navigateTo,
  goBrowserBack,
  goForward,
  pendingCloseFile,
  setPendingCloseFile,
  closeWorkspaceFile,
  onCollapseDesktopChat,
}: UseWorkspacePageContentOptions): WorkspacePageContentContract {
  const planSelectionPending = isWorkspacePageContentPlanSelectionPending(
    availablePlansCount,
    selectedPlanId,
  );
  const isBusyGenerating = isWorkspacePageContentBusyGenerating(isGenerating, isPlanning);
  const chatInputSnapshot = buildChatInputSnapshot({
    input,
    planSelectionPending,
    isBusyGenerating,
    isStopConfirming,
    isPlanning,
    isGenerating,
    selectedModel,
    modelCount: models.length,
    attachmentCount: attachedFiles.length,
  });
  const visibleChatModelRegistrySnapshot = {
    ...chatModelRegistrySnapshot,
    selectedModel: getWorkspaceChatComposerSnapshotSelectedModel(selectedModel, chatModelRegistrySnapshot.selectedModel),
  };
  const chatModeSnapshot = buildChatModeSnapshot({
    chatMode,
    isOnline,
    foundationStatusLabel,
    isBusyGenerating,
    isStopConfirming,
    isPlanning,
    isGenerating,
  });
  const stopGenerationConfirmationSnapshot = buildStopGenerationConfirmationSnapshot({
    isStopConfirming,
    isPlanning,
    isGenerating,
    projectId: getWorkspacePageContentProjectTextValue(projectInfo?.projectId),
    projectName: getWorkspacePageContentProjectTextValue(projectInfo?.projectName),
    isPersistedProject: hasWorkspacePageContentPersistedProject(projectInfo),
    prompt: input,
  });

  const enableAutoScroll = useCallback(() => {
    setIsChatAutoScrollEnabled(true);
    scrollToBottom();
  }, [scrollToBottom, setIsChatAutoScrollEnabled]);

  const desktopChatPanel = buildDesktopChatPanel({
    onCollapseDesktopChat,
    engineeringState,
    ...buildChatPanelProps({
      compact: false,
      textareaRef,
      input,
      setInput,
      chatInputSnapshot,
      planSelectionPending,
      attachedFiles,
      chatAttachmentSnapshot,
      chatMode,
      chatModeSnapshot,
      setChatMode,
      models,
      selectedModel,
      setSelectedModel,
      chatModelRegistrySnapshot: visibleChatModelRegistrySnapshot,
      isOnline,
      setIsOnline,
      isBusyGenerating,
      isStopConfirming,
      stopGenerationConfirmationSnapshot,
      messages,
      isPlanning,
      isGenerating,
      generationStage,
      planCountdown,
      planSelectionReady,
      selectedPlanId,
      isChatAutoScrollEnabled,
      chatScrollSnapshot,
      containerRef: desktopMessagesRef,
      messagesEndRef,
      updateChatAutoScrollState,
      enableAutoScroll,
      adjustTextareaHeight,
      handleKeyDown,
      removeAttachment,
      handleFileUpload,
      handleStopGenerate,
      handleCancelStopGenerate,
      handleGenerate,
      foundationStatusLabel,
      onExampleClick: setInput,
      onSelectPlan: choosePlanAndImplement,
      onAskQuestion: handleSuggestedQuestion,
      onRunAction: handleSuggestedAction,
      onRestoreCommit: handleRestoreCommit,
      onViewCommit: handleViewCommit,
      onOpenFile: openWorkspaceFile,
    }),
  });

  const mobileChatPanel = buildMobileChatPanel(
    {
      engineeringState,
      ...buildChatPanelProps({
        compact: true,
        textareaRef,
        input,
        setInput,
        chatInputSnapshot,
        planSelectionPending,
        attachedFiles,
        chatAttachmentSnapshot,
        chatMode,
        chatModeSnapshot,
        setChatMode,
        models,
        selectedModel,
        setSelectedModel,
        chatModelRegistrySnapshot: visibleChatModelRegistrySnapshot,
        isOnline,
        setIsOnline,
        isBusyGenerating,
        isStopConfirming,
        stopGenerationConfirmationSnapshot,
        messages,
        isPlanning,
        isGenerating,
        generationStage,
        planCountdown,
        planSelectionReady,
        selectedPlanId,
        isChatAutoScrollEnabled,
        chatScrollSnapshot,
        containerRef: mobileMessagesRef,
        messagesEndRef,
        updateChatAutoScrollState,
        enableAutoScroll,
        adjustTextareaHeight,
        handleKeyDown,
        removeAttachment,
        handleFileUpload,
        handleStopGenerate,
        handleCancelStopGenerate,
        handleGenerate,
        foundationStatusLabel,
        onExampleClick: setInput,
        onSelectPlan: choosePlanAndImplement,
        onAskQuestion: handleSuggestedQuestion,
        onRunAction: handleSuggestedAction,
        onRestoreCommit: handleRestoreCommit,
        onViewCommit: handleViewCommit,
        onOpenFile: openWorkspaceFile,
      }),
    },
  );

  const desktopIdePanel = buildDesktopIdePanel(
    buildDesktopIdePanelProps({
      tabs,
      activeTab,
      gitBranch,
      gitBranches,
      gitBranchListStatus,
      gitRemotes,
      gitRemoteListStatus,
      gitRemoteBranches,
      gitRemoteBranchListStatus,
      gitTags,
      gitTagListStatus,
      gitStashes,
      gitStashListStatus,
      gitWorktreeStatus,
      gitWorktreeStatusState,
      gitBranchCompare,
      gitBranchCompareStatus,
      gitBranchCompareTarget,
      gitBranchSwitchReadiness,
      onSelectGitBranchCompareTarget,
      onCreateGitBranch,
      onCreateGitTag,
      onDeleteGitTag,
      onCreateGitBranchFromRemote,
      onRefreshGitPanel,
      onRefreshGitRemoteBranches,
      onDeleteGitBranch,
      onRenameGitBranch,
      onSwitchGitBranch,
      handleRestoreCommitFile,
      onCommitWorktree,
      onDiscardWorktreeFile,
      onApplyGitBranchCompareFile,
      onCreateGitStash,
      onApplyGitStash,
      gitCommits,
      gitCommitListStatus,
      browserDevice,
      previewDeviceStyle,
      browserUrl,
      previewUrlStatus,
      previewReloadToken,
      runtimeStatus,
      searchQuery,
      filteredTree,
      hasOriginalFileTreeData,
      explorerSnapshotStatus,
      expandedFolders,
      activeFile,
      editorNavigationTarget,
      onEditorNavigationHandled: clearEditorNavigationTarget,
      openFiles,
      files,
      editorBufferStatuses,
      setEditorBufferStatuses,
      engineeringState,
      contextGateResult,
      foundationActionLabel,
      foundationStatusLabel,
      selectedCommit,
      gitCommitDetailStatus,
      projectId,
      monacoEditor,
      setActiveTab,
      setBrowserDevice,
      setBrowserUrl,
      setPreviewUrlStatus,
      onRecoverRuntime: handleRecoverRuntime,
      exportProject,
      setSearchQuery,
      toggleFolder,
      openWorkspaceFile,
      showContextMenu,
      isFileDirty,
      setActiveFile,
      requestCloseWorkspaceFile,
      setFiles,
      saveFile,
      copyToClipboard,
      handleViewCommit,
      handleStartFoundation: () => void handleStartFoundation(),
      onConfirmFoundationDecisions: handleConfirmFoundationDecisions,
    }),
  );

  const mobileIdePanel = buildMobileIdePanel(
    buildMobileIdePanelProps({
      tabs,
      activeTab,
      browserDevice,
      gitBranch,
      historyIndex,
      browserHistoryLength,
      mobileBrowserUrl,
      mobilePreviewUrlStatus,
      previewReloadToken,
      runtimeStatus,
      searchQuery,
      filteredTree,
      hasOriginalFileTreeData,
      explorerSnapshotStatus,
      expandedFolders,
      activeFile,
      editorNavigationTarget,
      onEditorNavigationHandled: clearEditorNavigationTarget,
      mobileEditingFile,
      mobileFileContent,
      editorBufferStatuses,
      gitCommits,
      gitBranches,
      gitBranchListStatus,
      gitRemotes,
      gitRemoteListStatus,
      gitRemoteBranches,
      gitRemoteBranchListStatus,
      gitTags,
      gitTagListStatus,
      gitStashes,
      gitStashListStatus,
      gitWorktreeStatus,
      gitWorktreeStatusState,
      gitBranchCompare,
      gitBranchCompareStatus,
      gitBranchCompareTarget,
      gitBranchSwitchReadiness,
      onSelectGitBranchCompareTarget,
      onCreateGitBranch,
      onCreateGitTag,
      onDeleteGitTag,
      onCreateGitBranchFromRemote,
      onRefreshGitPanel,
      onRefreshGitRemoteBranches,
      onDeleteGitBranch,
      onRenameGitBranch,
      onSwitchGitBranch,
      handleRestoreCommitFile,
      onCommitWorktree,
      onDiscardWorktreeFile,
      onApplyGitBranchCompareFile,
      onCreateGitStash,
      onApplyGitStash,
      gitCommitListStatus,
      selectedCommit,
      gitCommitDetailStatus,
      projectId,
      engineeringState,
      contextGateResult,
      foundationActionLabel,
      foundationStatusLabel,
      monacoEditor,
      setActiveTab,
      setMobileEditingFile,
      setBrowserDevice,
      goBrowserBack,
      goForward,
      setMobileBrowserUrl,
      setMobilePreviewUrlStatus,
      navigateTo,
      onRecoverRuntime: handleRecoverRuntime,
      setSearchQuery,
      toggleFolder,
      openWorkspaceFile,
      showContextMenu,
      isFileDirty,
      copyToClipboard,
      setFiles,
      setEditorBufferStatuses,
      saveFile,
      setMobileFileContent,
      handleViewCommit,
      handleStartFoundation: () => void handleStartFoundation(),
      onConfirmFoundationDecisions: handleConfirmFoundationDecisions,
    }),
  );

  const savePendingCloseFile = useCallback(async () => {
    if (pendingCloseFile === null) return;
    const targetFile = pendingCloseFile;
    const ok = await saveFile(targetFile, getWorkspaceEditorBufferContent(files, targetFile));
    const hasSaveSucceeded = hasWorkspacePageContentSaveSucceeded(ok);
    if (hasSaveSucceeded === true) {
      closeWorkspaceFile(targetFile);
      setPendingCloseFile(null);
    } else {
      setPendingCloseFile(targetFile);
    }
  }, [closeWorkspaceFile, files, pendingCloseFile, saveFile, setPendingCloseFile]);

  return {
    desktopChatPanel,
    mobileChatPanel,
    desktopIdePanel,
    mobileIdePanel,
    savePendingCloseFile,
  };
}
