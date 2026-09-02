import type {
  ChangeEvent,
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
} from 'react';

import type { ProjectRuntimeStatus } from '@/lib/api';
import type { WorkspaceEngineeringStateSnapshot } from '@/lib/workspace/engineering-state';
import type { WorkspaceGateResult } from '@/lib/workspace/engineering-state';
import type { FileNode, GitBranch, GitBranchCompare, GitBranchSwitchReadiness, GitCommit, GitRemote, GitRemoteBranch, GitStash, GitTag, GitWorktreeStatus } from '@/lib/types';
import type {
  WorkspaceChatAdjustTextareaHeightAction,
  WorkspaceChatAttachment,
  WorkspaceChatAutoScrollEnabledState,
  WorkspaceChatAutoScrollStateUpdateAction,
  WorkspaceChatAskQuestionAction,
  WorkspaceChatCancelStopGenerateAction,
  WorkspaceChatComposerProps,
  WorkspaceChatExampleClickAction,
  WorkspaceChatFileUploadAction,
  WorkspaceChatImagePasteAction,
  WorkspaceChatKeyDownAction,
  WorkspaceChatMessageList,
  WorkspaceChatMessagesProps,
  WorkspaceChatMessagesContainerRef,
  WorkspaceChatMessagesEndRef,
  WorkspaceChatModelOption,
  WorkspaceChatOpenFileAction,
  WorkspaceChatRemoveAttachmentAction,
  WorkspaceChatRestoreCommitAction,
  WorkspaceChatRunGuidanceAction,
  WorkspaceChatSelectPlanAction,
  WorkspaceChatStopGenerateAction,
  WorkspaceChatViewCommitAction,
  WorkspacePlanCountdownValue,
  WorkspacePlanSelectionReadyState,
  WorkspaceSelectedPlanId,
} from './workspace-chat-panel-types';
import type {
  DesktopIdeProps as WorkspaceDesktopIdeProps,
  MonacoEditorComponent,
  MobileIdeProps as WorkspaceMobileIdeProps,
  WorkspaceEditorFileDirtyCheck,
  WorkspaceEditorNavigationHandledAction,
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
import type { WorkspacePageUiPreviewDeviceStyle, WorkspacePageUiTab } from './workspace-page-ui-contract';
import type { ChatAttachmentSnapshot, ChatInputSnapshot, ChatMode, ChatModeSnapshot, ChatModelRegistrySnapshot, ChatScrollSnapshot, EditorBufferStatus, ExplorerSnapshotStatus, GitBranchCompareStatus, GitBranchListStatus, GitCommitDetailStatus, GitCommitListStatus, GitRemoteBranchListStatus, GitRemoteListStatus, GitStashListStatus, GitTagListStatus, GitWorktreeStatusState, IDETab, PreviewUrlStatus, StopGenerationConfirmationSnapshot, WorkspaceBrowserDevice, WorkspaceEditorNavigationTarget, WorkspaceOpenFilePathList } from './workspace-types';
import { buildDirtyEditorBufferStatus } from './workspace-editor-buffer-status';
import {
  getWorkspaceEditorBufferContent,
  getWorkspaceEditorBufferStatus,
  hasWorkspaceEditorBufferContent,
} from './workspace-editor-buffer-content';
import { buildManualPreviewUrlStatus, buildRuntimeHomePreviewUrlStatus } from './workspace-preview-url-status';

export type ChatMessagesProps = WorkspaceChatMessagesProps;
export type ChatComposerProps = WorkspaceChatComposerProps;
export type DesktopIdeProps = WorkspaceDesktopIdeProps;
export type MobileIdeProps = WorkspaceMobileIdeProps;

function hasWorkspacePagePanelActiveFile(activeFile: string | null): activeFile is string {
  if (activeFile === null) {
    return false;
  }

  const hasActiveFile = activeFile.length > 0;
  return hasActiveFile === true;
}

function hasWorkspacePagePanelMobileEditingFile(mobileEditingFile: string | null): mobileEditingFile is string {
  if (mobileEditingFile === null) {
    return false;
  }

  const hasMobileEditingFile = mobileEditingFile.length > 0;
  return hasMobileEditingFile === true;
}

type BuildChatPanelPropsOptions = {
  compact: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  chatInputSnapshot: ChatInputSnapshot;
  planSelectionPending: boolean;
  attachedFiles: WorkspaceChatAttachment[];
  chatAttachmentSnapshot: ChatAttachmentSnapshot;
  chatMode: ChatMode;
  chatModeSnapshot: ChatModeSnapshot;
  setChatMode: Dispatch<SetStateAction<ChatMode>>;
  models: WorkspaceChatModelOption[];
  selectedModel: string;
  setSelectedModel: Dispatch<SetStateAction<string>>;
  chatModelRegistrySnapshot: ChatModelRegistrySnapshot;
  isOnline: boolean;
  setIsOnline: Dispatch<SetStateAction<boolean>>;
  isBusyGenerating: boolean;
  isStopConfirming: boolean;
  stopGenerationConfirmationSnapshot: StopGenerationConfirmationSnapshot;
  messages: WorkspaceChatMessageList;
  isPlanning: boolean;
  isGenerating: boolean;
  generationStage: string;
  planCountdown: WorkspacePlanCountdownValue;
  planSelectionReady: WorkspacePlanSelectionReadyState;
  selectedPlanId: WorkspaceSelectedPlanId;
  isChatAutoScrollEnabled: WorkspaceChatAutoScrollEnabledState;
  chatScrollSnapshot: ChatScrollSnapshot;
  containerRef: WorkspaceChatMessagesContainerRef;
  messagesEndRef: WorkspaceChatMessagesEndRef;
  updateChatAutoScrollState: WorkspaceChatAutoScrollStateUpdateAction;
  enableAutoScroll: () => void;
  adjustTextareaHeight: WorkspaceChatAdjustTextareaHeightAction;
  handleKeyDown: WorkspaceChatKeyDownAction;
  handleImagePaste: WorkspaceChatImagePasteAction;
  removeAttachment: WorkspaceChatRemoveAttachmentAction;
  handleFileUpload: WorkspaceChatFileUploadAction;
  handleStopGenerate: WorkspaceChatStopGenerateAction;
  handleCancelStopGenerate: WorkspaceChatCancelStopGenerateAction;
  handleGenerate: () => Promise<void>;
  foundationStatusLabel: string;
  onExampleClick: WorkspaceChatExampleClickAction;
  onSelectPlan: WorkspaceChatSelectPlanAction;
  onAskQuestion: WorkspaceChatAskQuestionAction;
  onRunAction: WorkspaceChatRunGuidanceAction;
  onRestoreCommit: WorkspaceChatRestoreCommitAction;
  onViewCommit: WorkspaceChatViewCommitAction;
  onOpenFile: WorkspaceChatOpenFileAction;
};

export function buildChatPanelProps({
  compact,
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
  chatModelRegistrySnapshot,
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
  containerRef,
  messagesEndRef,
  updateChatAutoScrollState,
  enableAutoScroll,
  adjustTextareaHeight,
  handleKeyDown,
  handleImagePaste,
  removeAttachment,
  handleFileUpload,
  handleStopGenerate,
  handleCancelStopGenerate,
  handleGenerate,
  foundationStatusLabel,
  onExampleClick,
  onSelectPlan,
  onAskQuestion,
  onRunAction,
  onRestoreCommit,
  onViewCommit,
  onOpenFile,
}: BuildChatPanelPropsOptions) {
  return {
    messagesProps: {
      compact,
      messages,
      isPlanning,
      isGenerating,
      generationStage,
      planCountdown,
      planSelectionReady,
      selectedPlanId,
      isBusyGenerating,
      isChatAutoScrollEnabled,
      chatScrollSnapshot,
      containerRef,
      messagesEndRef,
      updateChatAutoScrollState,
      enableAutoScroll,
      onExampleClick,
      onSelectPlan,
      onAskQuestion,
      onRunAction,
      onRestoreCommit,
      onViewCommit,
      onOpenFile,
    } satisfies ChatMessagesProps,
    composerProps: {
      compact,
      textareaRef,
      input,
      chatInputSnapshot,
      planSelectionPending,
      attachedFiles,
      chatAttachmentSnapshot,
      chatMode,
      chatModeSnapshot,
      models,
      selectedModel,
      chatModelRegistrySnapshot,
      isOnline,
      isBusyGenerating,
      isStopConfirming,
      stopGenerationConfirmationSnapshot,
      setInput,
      adjustTextareaHeight,
      handleKeyDown,
      handleImagePaste,
      removeAttachment,
      setChatMode,
      setSelectedModel,
      toggleOnline: () => setIsOnline((prev) => !prev),
      handleFileUpload,
      handleStopGenerate,
      handleCancelStopGenerate,
      handleGenerate: () => void handleGenerate(),
      foundationStatusLabel,
    } satisfies ChatComposerProps,
  };
}

type BuildDesktopIdePanelPropsOptions = {
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
  gitCommits: GitCommit[];
  gitCommitListStatus: GitCommitListStatus | null;
  browserDevice: WorkspaceBrowserDevice;
  previewDeviceStyle: WorkspacePageUiPreviewDeviceStyle;
  browserUrl: string;
  previewUrlStatus: PreviewUrlStatus | null;
  previewReloadToken: number;
  runtimeStatus: ProjectRuntimeStatus | undefined;
  searchQuery: string;
  filteredTree: FileNode[];
  hasOriginalFileTreeData: boolean;
  explorerSnapshotStatus: ExplorerSnapshotStatus | null;
  expandedFolders: Set<string>;
  activeFile: string | null;
  editorNavigationTarget: WorkspaceEditorNavigationTarget | null;
  openFiles: WorkspaceOpenFilePathList;
  files: Map<string, string>;
  editorBufferStatuses: Map<string, EditorBufferStatus>;
  selectedCommit: GitCommit | null;
  gitCommitDetailStatus: GitCommitDetailStatus | null;
  projectId: string | null;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  contextGateResult?: WorkspaceGateResult;
  foundationActionLabel: string;
  foundationStatusLabel: string;
  monacoEditor: MonacoEditorComponent;
  setActiveTab: Dispatch<SetStateAction<IDETab>>;
  setBrowserDevice: Dispatch<SetStateAction<WorkspaceBrowserDevice>>;
  setBrowserUrl: Dispatch<SetStateAction<string>>;
  setPreviewUrlStatus: Dispatch<SetStateAction<PreviewUrlStatus | null>>;
  onRecoverRuntime: WorkspaceRuntimeRecoverAction;
  exportProject: WorkspaceProjectExportAction;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  toggleFolder: WorkspaceExplorerToggleFolderAction;
  openWorkspaceFile: (target: string | WorkspaceEditorNavigationTarget) => void | Promise<void>;
  showContextMenu: WorkspaceExplorerContextMenuAction;
  isFileDirty: WorkspaceEditorFileDirtyCheck;
  setActiveFile: Dispatch<SetStateAction<string | null>>;
  onEditorNavigationHandled: WorkspaceEditorNavigationHandledAction;
  requestCloseWorkspaceFile: WorkspaceEditorRequestCloseFileAction;
  setFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setEditorBufferStatuses: Dispatch<SetStateAction<Map<string, EditorBufferStatus>>>;
  saveFile: (path: string, content: string) => Promise<boolean>;
  copyToClipboard: (text: string) => Promise<void>;
  handleViewCommit: WorkspaceGitViewCommitAction;
  handleRestoreCommitFile: WorkspaceGitRestoreCommitFileAction;
  onCommitWorktree: WorkspaceGitCommitWorktreeAction;
  onDiscardWorktreeFile: WorkspaceGitDiscardWorktreeFileAction;
  onApplyGitBranchCompareFile: WorkspaceGitApplyBranchCompareFileAction;
  onCreateGitStash: WorkspaceGitCreateStashAction;
  onApplyGitStash: WorkspaceGitApplyStashAction;
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
  handleStartFoundation: WorkspaceFoundationStartAction;
  onConfirmFoundationDecisions: WorkspaceFoundationConfirmDecisionsAction;
};

export function buildDesktopIdePanelProps({
  tabs,
  activeTab,
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
  openFiles,
  files,
  editorBufferStatuses,
  selectedCommit,
  gitCommitDetailStatus,
  projectId,
  engineeringState,
  contextGateResult,
  foundationActionLabel,
  foundationStatusLabel,
  monacoEditor,
  setActiveTab,
  setBrowserDevice,
  setBrowserUrl,
  setPreviewUrlStatus,
  onRecoverRuntime,
  exportProject,
  setSearchQuery,
  toggleFolder,
  openWorkspaceFile,
  showContextMenu,
  isFileDirty,
  setActiveFile,
  onEditorNavigationHandled,
  requestCloseWorkspaceFile,
  setFiles,
  setEditorBufferStatuses,
  saveFile,
  copyToClipboard,
  handleViewCommit,
  handleRestoreCommitFile,
  onCommitWorktree,
  onDiscardWorktreeFile,
  onApplyGitBranchCompareFile,
  onCreateGitStash,
  onApplyGitStash,
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
  handleStartFoundation,
  onConfirmFoundationDecisions,
}: BuildDesktopIdePanelPropsOptions) {
  return {
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
    openFiles,
    filesSize: files.size,
    activeFileContent: getWorkspaceEditorBufferContent(files, activeFile),
    activeFileBufferStatus: getWorkspaceEditorBufferStatus(editorBufferStatuses, activeFile),
    selectedCommit,
    gitCommitDetailStatus,
    projectId,
    engineeringState,
    contextGateResult,
    foundationActionLabel,
    foundationStatusLabel,
    monacoEditor,
    onSelectTab: setActiveTab,
    onSetBrowserDevice: setBrowserDevice,
    onChangeBrowserUrl: (value) => {
      setBrowserUrl(value);
      setPreviewUrlStatus(buildManualPreviewUrlStatus({ surface: 'desktop', value }));
    },
    onOpenRuntimeHomeUrl: (value) => {
      setBrowserUrl(value);
      setPreviewUrlStatus(buildRuntimeHomePreviewUrlStatus({ surface: 'desktop', value }));
    },
    onRecoverRuntime,
    onExportProject: exportProject,
    onSearchQueryChange: setSearchQuery,
    onToggleFolder: toggleFolder,
    onSelectFile: openWorkspaceFile,
    onContextMenu: showContextMenu,
    isFileDirty,
    onSelectOpenFile: setActiveFile,
    onEditorNavigationHandled,
    onRequestCloseFile: requestCloseWorkspaceFile,
    onSaveActiveFile: () => {
      const hasActiveEditorBufferContent = hasWorkspaceEditorBufferContent(files, activeFile);
      if (hasActiveEditorBufferContent === true) {
        void saveFile(activeFile, getWorkspaceEditorBufferContent(files, activeFile));
      }
    },
    onCopyActiveFile: () => {
      const hasActiveEditorBufferContent = hasWorkspaceEditorBufferContent(files, activeFile);
      if (hasActiveEditorBufferContent === true) {
        void copyToClipboard(getWorkspaceEditorBufferContent(files, activeFile));
      }
    },
    onStartFoundation: handleStartFoundation,
    onOpenFoundationFile: openWorkspaceFile,
    onConfirmFoundationDecisions,
    onUpdateActiveFileContent: (value) => {
      if (hasWorkspacePagePanelActiveFile(activeFile) === true) {
        setFiles((prev) => new Map(prev).set(activeFile, value));
        setEditorBufferStatuses((prev) => new Map(prev).set(activeFile, buildDirtyEditorBufferStatus({
          filePath: activeFile,
          source: 'user_edit',
        })));
      }
    },
    onViewCommit: handleViewCommit,
    onRestoreCommitFile: handleRestoreCommitFile,
    onCommitWorktree,
    onDiscardWorktreeFile,
    onApplyGitBranchCompareFile,
    onCreateGitStash,
    onApplyGitStash,
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
    onOpenFile: openWorkspaceFile,
    onCopyText: copyToClipboard,
  } satisfies DesktopIdeProps;
}

type BuildMobileIdePanelPropsOptions = {
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
  browserDevice: WorkspaceBrowserDevice;
  historyIndex: number;
  browserHistoryLength: number;
  mobileBrowserUrl: string;
  mobilePreviewUrlStatus: PreviewUrlStatus | null;
  previewReloadToken: number;
  runtimeStatus: ProjectRuntimeStatus | undefined;
  searchQuery: string;
  filteredTree: FileNode[];
  hasOriginalFileTreeData: boolean;
  explorerSnapshotStatus: ExplorerSnapshotStatus | null;
  expandedFolders: Set<string>;
  activeFile: string | null;
  mobileEditingFile: string | null;
  mobileFileContent: string;
  editorBufferStatuses: Map<string, EditorBufferStatus>;
  editorNavigationTarget: WorkspaceEditorNavigationTarget | null;
  gitCommits: GitCommit[];
  gitCommitListStatus: GitCommitListStatus | null;
  selectedCommit: GitCommit | null;
  gitCommitDetailStatus: GitCommitDetailStatus | null;
  projectId: string | null;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  contextGateResult?: WorkspaceGateResult;
  foundationActionLabel: string;
  foundationStatusLabel: string;
  monacoEditor: MonacoEditorComponent;
  setActiveTab: Dispatch<SetStateAction<IDETab>>;
  setMobileEditingFile: Dispatch<SetStateAction<string | null>>;
  setBrowserDevice: Dispatch<SetStateAction<WorkspaceBrowserDevice>>;
  goBrowserBack: WorkspacePreviewHistoryNavigationAction;
  goForward: WorkspacePreviewHistoryNavigationAction;
  setMobileBrowserUrl: Dispatch<SetStateAction<string>>;
  setMobilePreviewUrlStatus: Dispatch<SetStateAction<PreviewUrlStatus | null>>;
  navigateTo: WorkspacePreviewNavigateAction;
  onRecoverRuntime: WorkspaceRuntimeRecoverAction;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  toggleFolder: WorkspaceExplorerToggleFolderAction;
  openWorkspaceFile: (target: string | WorkspaceEditorNavigationTarget) => void | Promise<void>;
  showContextMenu: WorkspaceExplorerContextMenuAction;
  isFileDirty: WorkspaceEditorFileDirtyCheck;
  onEditorNavigationHandled: WorkspaceEditorNavigationHandledAction;
  copyToClipboard: (text: string) => Promise<void>;
  setFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setEditorBufferStatuses: Dispatch<SetStateAction<Map<string, EditorBufferStatus>>>;
  saveFile: (path: string, content: string) => Promise<boolean>;
  setMobileFileContent: Dispatch<SetStateAction<string>>;
  handleViewCommit: WorkspaceGitViewCommitAction;
  handleRestoreCommitFile: WorkspaceGitRestoreCommitFileAction;
  onCommitWorktree: WorkspaceGitCommitWorktreeAction;
  onDiscardWorktreeFile: WorkspaceGitDiscardWorktreeFileAction;
  onApplyGitBranchCompareFile: WorkspaceGitApplyBranchCompareFileAction;
  onCreateGitStash: WorkspaceGitCreateStashAction;
  onApplyGitStash: WorkspaceGitApplyStashAction;
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
  handleStartFoundation: WorkspaceFoundationStartAction;
  onConfirmFoundationDecisions: WorkspaceFoundationConfirmDecisionsAction;
};

export function buildMobileIdePanelProps({
  tabs,
  activeTab,
  browserDevice,
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
  mobileEditingFile,
  mobileFileContent,
  editorBufferStatuses,
  editorNavigationTarget,
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
  onRecoverRuntime,
  setSearchQuery,
  toggleFolder,
  openWorkspaceFile,
  showContextMenu,
  isFileDirty,
  onEditorNavigationHandled,
  copyToClipboard,
  setFiles,
  setEditorBufferStatuses,
  saveFile,
  setMobileFileContent,
  handleViewCommit,
  handleRestoreCommitFile,
  onCommitWorktree,
  onDiscardWorktreeFile,
  onApplyGitBranchCompareFile,
  onCreateGitStash,
  onApplyGitStash,
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
  handleStartFoundation,
  onConfirmFoundationDecisions,
}: BuildMobileIdePanelPropsOptions) {
  return {
    tabs,
    activeTab,
    browserDevice,
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
    mobileEditingFile,
    mobileFileContent,
    mobileEditorBufferStatus: getWorkspaceEditorBufferStatus(editorBufferStatuses, mobileEditingFile),
    editorNavigationTarget,
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
    gitCommits,
    gitCommitListStatus,
    selectedCommit,
    gitCommitDetailStatus,
    projectId,
    engineeringState,
    contextGateResult,
    foundationActionLabel,
    foundationStatusLabel,
    monacoEditor,
    onSelectTab: (tabId) => {
      setActiveTab(tabId);
      setMobileEditingFile(null);
      if (tabId === 'preview') {
        setBrowserDevice('mobile');
      }
    },
    onSetBrowserDevice: setBrowserDevice,
    onGoBrowserBack: goBrowserBack,
    onGoForward: goForward,
    onChangeMobileBrowserUrl: (value) => {
      setMobileBrowserUrl(value);
      setMobilePreviewUrlStatus(buildManualPreviewUrlStatus({ surface: 'mobile', value }));
    },
    onOpenRuntimeHomeUrl: (value) => {
      navigateTo(value);
      setMobilePreviewUrlStatus(buildRuntimeHomePreviewUrlStatus({ surface: 'mobile', value }));
    },
    onNavigateTo: navigateTo,
    onRecoverRuntime,
    onSearchQueryChange: setSearchQuery,
    onToggleFolder: toggleFolder,
    onSelectFile: openWorkspaceFile,
    onContextMenu: showContextMenu,
    isFileDirty,
    onEditorNavigationHandled,
    onCloseMobileEditor: () => setMobileEditingFile(null),
    onCopyMobileFile: () => void copyToClipboard(mobileFileContent),
    onSaveMobileFile: () => {
      if (hasWorkspacePagePanelMobileEditingFile(mobileEditingFile) === true) {
        setFiles((prev) => new Map(prev).set(mobileEditingFile, mobileFileContent));
        void saveFile(mobileEditingFile, mobileFileContent);
      }
    },
    onStartFoundation: handleStartFoundation,
    onOpenFoundationFile: openWorkspaceFile,
    onConfirmFoundationDecisions,
    onUpdateMobileFileContent: (value) => {
      setMobileFileContent(value);
      if (hasWorkspacePagePanelMobileEditingFile(mobileEditingFile) === true) {
        setFiles((prev) => new Map(prev).set(mobileEditingFile, value));
        setEditorBufferStatuses((prev) => new Map(prev).set(mobileEditingFile, buildDirtyEditorBufferStatus({
          filePath: mobileEditingFile,
          source: 'mobile_edit',
        })));
      }
    },
    onViewCommit: handleViewCommit,
    onRestoreCommitFile: handleRestoreCommitFile,
    onCommitWorktree,
    onDiscardWorktreeFile,
    onApplyGitBranchCompareFile,
    onCreateGitStash,
    onApplyGitStash,
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
    onOpenFile: openWorkspaceFile,
    onCopyText: copyToClipboard,
  } satisfies MobileIdeProps;
}
