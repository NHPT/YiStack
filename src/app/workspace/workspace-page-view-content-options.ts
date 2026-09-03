import type {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
} from 'react';

import type { UseWorkspacePageContentOptions } from './use-workspace-page-content';
import type { Plan } from '@/lib/api';
import type { FileNode, GitCommit } from '@/lib/types';
import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceGateResult,
} from '@/lib/workspace/engineering-state';
import type {
  MonacoEditorComponent,
  WorkspaceFoundationConfirmDecisionsAction,
  WorkspaceFoundationStartAction,
} from './workspace-ide-subpanel-types';
import type { WorkspacePageLocalStateContract } from './workspace-page-local-state-contract';
import type {
  WorkspacePageUiModel,
  WorkspacePageUiPreviewDeviceStyle,
  WorkspacePageUiTab,
} from './workspace-page-ui-contract';
import type { WorkspaceShellStateSetter } from './workspace-shell-state-contract';
import type {
  ChatScrollSnapshot,
  ExplorerSnapshotStatus,
  GuidanceAction,
  PreviewUrlStatus,
  WorkspaceBrowserDevice,
  WorkspaceBrowserHistoryUrlList,
  WorkspaceChatMessage,
  WorkspaceEditorNavigationTarget,
  WorkspaceMobileView,
  WorkspaceProjectInfo,
} from './workspace-types';

type LocalState = WorkspacePageLocalStateContract;

function hasWorkspacePageViewContentGitBranchValue(value: string | undefined): value is string {
  if (value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getWorkspacePageViewContentGitBranch(projectInfo: WorkspaceProjectInfo | null): string {
  const hasProjectInfo = projectInfo !== null;
  if (hasProjectInfo === false) {
    return '';
  }

  const gitBranch = projectInfo.gitBranch;
  const hasGitBranch = hasWorkspacePageViewContentGitBranchValue(gitBranch);
  if (hasGitBranch === false) {
    return '';
  }

  return gitBranch;
}

export type WorkspacePageViewContentFlowState = {
  messages: WorkspaceChatMessage[];
  availablePlans: Plan[];
  selectedPlanId: string | null;
  planCountdown: number;
  planSelectionReady: boolean;
  currentEngineeringState: WorkspaceEngineeringStateSnapshot | undefined;
  currentGateResult: WorkspaceGateResult | undefined;
};

export type WorkspacePageViewContentShellState = {
  setChatExpanded: WorkspaceShellStateSetter<boolean>;
  setMobileView: WorkspaceShellStateSetter<WorkspaceMobileView>;
  isChatAutoScrollEnabled: boolean;
  setIsChatAutoScrollEnabled: WorkspaceShellStateSetter<boolean>;
  chatScrollSnapshot: ChatScrollSnapshot;
  browserUrl: string;
  setBrowserUrl: WorkspaceShellStateSetter<string>;
  previewUrlStatus: PreviewUrlStatus | null;
  setPreviewUrlStatus: WorkspaceShellStateSetter<PreviewUrlStatus | null>;
  previewReloadToken: number;
  browserDevice: WorkspaceBrowserDevice;
  setBrowserDevice: WorkspaceShellStateSetter<WorkspaceBrowserDevice>;
  mobileEditingFile: string | null;
  setMobileEditingFile: WorkspaceShellStateSetter<string | null>;
  mobileFileContent: string;
  setMobileFileContent: WorkspaceShellStateSetter<string>;
  mobileBrowserUrl: string;
  setMobileBrowserUrl: WorkspaceShellStateSetter<string>;
  mobilePreviewUrlStatus: PreviewUrlStatus | null;
  setMobilePreviewUrlStatus: WorkspaceShellStateSetter<PreviewUrlStatus | null>;
  browserHistory: WorkspaceBrowserHistoryUrlList;
  historyIndex: number;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  desktopMessagesRef: RefObject<HTMLDivElement | null>;
  mobileMessagesRef: RefObject<HTMLDivElement | null>;
  updateChatAutoScrollState: (element: HTMLDivElement | null) => void;
  scrollToBottom: () => void;
  navigateTo: (url: string) => void;
  goBrowserBack: () => void;
  goForward: () => void;
};

export type WorkspacePageViewContentUiState = {
  adjustTextareaHeight: (value?: string) => void;
  handleKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  copyToClipboard: (text: string) => Promise<void>;
  exportProject: () => void;
  handleFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  handleImagePaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  removeAttachment: (index: number) => void;
  filteredTree: FileNode[];
  hasOriginalFileTreeData: boolean;
  explorerSnapshotStatus: ExplorerSnapshotStatus | null;
  models: WorkspacePageUiModel[];
  tabs: WorkspacePageUiTab[];
  previewDeviceStyle: WorkspacePageUiPreviewDeviceStyle;
};

export type UseWorkspacePageViewContentOptions = {
  localState: LocalState;
  flowState: WorkspacePageViewContentFlowState;
  shellState: WorkspacePageViewContentShellState;
  monacoEditor: MonacoEditorComponent;
  uiState: WorkspacePageViewContentUiState;
  actions: {
    saveFile: (path: string, content: string) => Promise<boolean>;
    handleViewCommit: (commit: GitCommit) => Promise<void>;
    handleRestoreCommit: (commit: GitCommit) => void;
    handleRestoreCommitFile: (commit: GitCommit, filePath: string) => Promise<void>;
    handleCommitWorktree: (message: string) => Promise<void>;
    handleDiscardWorktreeFile: (filePath: string) => Promise<void>;
    handleApplyGitBranchCompareFile: (baseBranch: string, headBranch: string, filePath: string) => Promise<void>;
    handleCreateGitStash: (message: string) => Promise<void>;
    handleApplyGitStash: (stashRef: string) => Promise<void>;
    handleStopGenerate: () => void;
    handleGenerate: () => Promise<void>;
    handleVisualEdit: UseWorkspacePageContentOptions['handleVisualEdit'];
    handleRecoverRuntime: () => Promise<void>;
    handleStartFoundation: WorkspaceFoundationStartAction;
    handleConfirmFoundationDecisions: WorkspaceFoundationConfirmDecisionsAction;
    foundationActionLabel: string;
    foundationStatusLabel: string;
    handleSuggestedQuestion: (question: string) => Promise<void>;
    handleSuggestedAction: (action: GuidanceAction) => Promise<void>;
    handleSelectGitBranchCompareTarget: (targetBranch: string) => Promise<void>;
    handleCreateGitBranch: (branchName: string) => Promise<void>;
    handleCreateGitTag: (tagName: string) => Promise<void>;
    handleDeleteGitTag: (tagName: string) => Promise<void>;
    handleCreateGitBranchFromRemote: (remoteBranch: string, branchName: string) => Promise<void>;
    refreshGitPanel: () => Promise<void>;
    handleRefreshGitRemoteBranches: (remoteName: string) => Promise<void>;
    handleDeleteGitBranch: (branchName: string) => Promise<void>;
    handleRenameGitBranch: (previousName: string, nextName: string) => Promise<void>;
    handleSwitchGitBranch: (targetBranch: string) => Promise<void>;
    handleCancelStopGenerate: () => void;
    openWorkspaceFile: (target: string | WorkspaceEditorNavigationTarget) => Promise<void> | void;
    toggleFolder: (path: string) => void;
    showContextMenu: (event: ReactMouseEvent, node: FileNode) => void;
    isFileDirty: (path: string | null) => boolean;
    requestCloseWorkspaceFile: (path: string) => void;
    closeWorkspaceFile: (path: string, discard?: boolean) => void;
    choosePlanAndImplement: (plan: Plan) => Promise<void>;
  };
};

export function buildWorkspacePageContentOptions({
  localState,
  flowState,
  shellState,
  monacoEditor,
  uiState,
  actions,
}: UseWorkspacePageViewContentOptions): UseWorkspacePageContentOptions {
  const {
    textareaRef,
    input,
    setInput,
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
    activeTab,
    setActiveTab,
    activeFile,
    editorNavigationTarget,
    setEditorNavigationTarget,
    setActiveFile,
    openFiles,
    files,
    setFiles,
    editorBufferStatuses,
    setEditorBufferStatuses,
    expandedFolders,
    pendingCloseFile,
    setPendingCloseFile,
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
    gitCommits,
    gitCommitListStatus,
    selectedCommit,
    gitCommitDetailStatus,
    projectInfo,
    searchQuery,
    setSearchQuery,
  } = localState;

  const {
    messages,
    availablePlans,
    selectedPlanId,
    planCountdown,
    planSelectionReady,
    currentEngineeringState,
    currentGateResult,
  } = flowState;

  const {
    setChatExpanded,
    setMobileView,
    isChatAutoScrollEnabled,
    setIsChatAutoScrollEnabled,
    chatScrollSnapshot,
    browserUrl,
    setBrowserUrl,
    previewUrlStatus,
    setPreviewUrlStatus,
    previewReloadToken,
    browserDevice,
    setBrowserDevice,
    mobileEditingFile,
    setMobileEditingFile,
    mobileFileContent,
    setMobileFileContent,
    mobileBrowserUrl,
    setMobileBrowserUrl,
    mobilePreviewUrlStatus,
    setMobilePreviewUrlStatus,
    browserHistory,
    historyIndex,
    messagesEndRef,
    desktopMessagesRef,
    mobileMessagesRef,
    updateChatAutoScrollState,
    scrollToBottom,
    navigateTo,
    goBrowserBack,
    goForward,
  } = shellState;

  return {
    textareaRef,
    input,
    setInput,
    setChatExpanded,
    setMobileView,
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
    models: uiState.models,
    messages,
    planCountdown,
    planSelectionReady,
    selectedPlanId,
    availablePlansCount: availablePlans.length,
    desktopMessagesRef,
    mobileMessagesRef,
    messagesEndRef,
    isChatAutoScrollEnabled,
    chatScrollSnapshot,
    setIsChatAutoScrollEnabled,
    updateChatAutoScrollState,
    scrollToBottom,
    choosePlanAndImplement: (plan) => void actions.choosePlanAndImplement(plan),
    handleSuggestedQuestion: (question) => void actions.handleSuggestedQuestion(question),
    handleSuggestedAction: (action) => void actions.handleSuggestedAction(action),
    handleRestoreCommit: actions.handleRestoreCommit,
    handleRestoreCommitFile: (commit, filePath) => void actions.handleRestoreCommitFile(commit, filePath),
    onCommitWorktree: (message) => void actions.handleCommitWorktree(message),
    onDiscardWorktreeFile: (filePath) => void actions.handleDiscardWorktreeFile(filePath),
    onApplyGitBranchCompareFile: (baseBranch, headBranch, filePath) => void actions.handleApplyGitBranchCompareFile(baseBranch, headBranch, filePath),
    handleViewCommit: actions.handleViewCommit,
    openWorkspaceFile: (target) => void actions.openWorkspaceFile(target),
    adjustTextareaHeight: uiState.adjustTextareaHeight,
    handleKeyDown: uiState.handleKeyDown,
    removeAttachment: uiState.removeAttachment,
    handleFileUpload: uiState.handleFileUpload,
    handleImagePaste: uiState.handleImagePaste,
    handleStopGenerate: actions.handleStopGenerate,
    handleCancelStopGenerate: actions.handleCancelStopGenerate,
    handleGenerate: async () => {
      await actions.handleGenerate();
    },
    handleVisualEdit: actions.handleVisualEdit,
    handleRecoverRuntime: async () => {
      await actions.handleRecoverRuntime();
    },
    foundationStatusLabel: actions.foundationStatusLabel,
    engineeringState: currentEngineeringState,
    contextGateResult: currentGateResult,
    foundationActionLabel: actions.foundationActionLabel,
    tabs: uiState.tabs,
    activeTab,
    gitBranch: getWorkspacePageViewContentGitBranch(projectInfo),
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
    onSelectGitBranchCompareTarget: (targetBranch) => void actions.handleSelectGitBranchCompareTarget(targetBranch),
    onCreateGitBranch: (branchName) => void actions.handleCreateGitBranch(branchName),
    onCreateGitTag: (tagName) => void actions.handleCreateGitTag(tagName),
    onDeleteGitTag: (tagName) => void actions.handleDeleteGitTag(tagName),
    onCreateGitBranchFromRemote: (remoteBranch, branchName) => void actions.handleCreateGitBranchFromRemote(remoteBranch, branchName),
    onRefreshGitPanel: () => void actions.refreshGitPanel(),
    onRefreshGitRemoteBranches: (remoteName) => void actions.handleRefreshGitRemoteBranches(remoteName),
    onDeleteGitBranch: (branchName) => void actions.handleDeleteGitBranch(branchName),
    onRenameGitBranch: (previousName, nextName) => void actions.handleRenameGitBranch(previousName, nextName),
    onSwitchGitBranch: (targetBranch) => void actions.handleSwitchGitBranch(targetBranch),
    onCreateGitStash: (message) => void actions.handleCreateGitStash(message),
    onApplyGitStash: (stashRef) => void actions.handleApplyGitStash(stashRef),
    setActiveTab,
    gitCommits,
    gitCommitListStatus,
    browserDevice,
    setBrowserDevice,
    previewDeviceStyle: uiState.previewDeviceStyle,
    browserUrl,
    previewUrlStatus,
    previewReloadToken,
    runtimeStatus: projectInfo?.runtimeStatus,
    setBrowserUrl,
    setPreviewUrlStatus,
    searchQuery,
    setSearchQuery,
    filteredTree: uiState.filteredTree,
    hasOriginalFileTreeData: uiState.hasOriginalFileTreeData,
    explorerSnapshotStatus: uiState.explorerSnapshotStatus,
    expandedFolders,
    activeFile,
    editorNavigationTarget,
    clearEditorNavigationTarget: () => setEditorNavigationTarget(null),
    setActiveFile,
    openFiles,
    files,
    editorBufferStatuses,
    setEditorBufferStatuses,
    setFiles,
    mobileEditingFile,
    setMobileEditingFile,
    mobileFileContent,
    setMobileFileContent,
    selectedCommit,
    gitCommitDetailStatus,
    projectId: projectInfo?.projectId || null,
    monacoEditor,
    handleStartFoundation: async () => {
      await actions.handleStartFoundation();
    },
    handleConfirmFoundationDecisions: actions.handleConfirmFoundationDecisions,
    exportProject: uiState.exportProject,
    toggleFolder: actions.toggleFolder,
    showContextMenu: actions.showContextMenu,
    isFileDirty: actions.isFileDirty,
    requestCloseWorkspaceFile: actions.requestCloseWorkspaceFile,
    saveFile: actions.saveFile,
    copyToClipboard: uiState.copyToClipboard,
    historyIndex,
    browserHistoryLength: browserHistory.length,
    mobileBrowserUrl,
    mobilePreviewUrlStatus,
    setMobileBrowserUrl,
    setMobilePreviewUrlStatus,
    navigateTo,
    goBrowserBack,
    goForward,
    pendingCloseFile,
    setPendingCloseFile,
    closeWorkspaceFile: actions.closeWorkspaceFile,
    onCollapseDesktopChat: () => setChatExpanded(false),
  };
}
