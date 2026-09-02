import type {
  Dispatch,
  RefObject,
  SetStateAction,
} from 'react';

import type {
  FileNode,
  GitBranch,
  GitBranchCompare,
  GitBranchSwitchReadiness,
  GitCommit,
  GitRemote,
  GitRemoteBranch,
  GitStash,
  GitTag,
  GitWorktreeStatus,
} from '@/lib/types';

import type {
  ChatAttachmentSnapshot,
  ChatMode,
  ChatModelRegistrySnapshot,
  EditorBufferStatus,
  ExplorerSnapshotStatus,
  GitBranchCompareStatus,
  GitBranchListStatus,
  GitCommitDetailStatus,
  GitCommitListStatus,
  GitRemoteBranchListStatus,
  GitRemoteListStatus,
  GitStashListStatus,
  GitTagListStatus,
  GitWorktreeStatusState,
  IDETab,
  WorkspaceContextMenu,
  WorkspaceEditorNavigationTarget,
  WorkspaceOpenFilePathList,
  WorkspaceProjectInfo,
} from './workspace-types';
import type { WorkspacePlanGenerationProjectIdSet } from './workspace-plan-generation-types';
import type { WorkspacePageUiModel } from './workspace-page-ui-contract';

export type WorkspaceAttachment = {
  name: string;
  size: number;
  type: 'image/png' | 'image/jpeg';
  dataUrl: string;
};

export type WorkspaceAvailableModel = WorkspacePageUiModel;

export type WorkspacePageLocalStateSetter<T> = Dispatch<SetStateAction<T>>;

export type WorkspacePageLocalStateContract = {
  projectInfo: WorkspaceProjectInfo | null;
  setProjectInfo: WorkspacePageLocalStateSetter<WorkspaceProjectInfo | null>;
  input: string;
  setInput: WorkspacePageLocalStateSetter<string>;
  isGenerating: boolean;
  setIsGenerating: WorkspacePageLocalStateSetter<boolean>;
  generationStage: string;
  setGenerationStage: WorkspacePageLocalStateSetter<string>;
  isStopConfirming: boolean;
  setIsStopConfirming: WorkspacePageLocalStateSetter<boolean>;
  isPlanning: boolean;
  setIsPlanning: WorkspacePageLocalStateSetter<boolean>;
  selectedModel: string;
  setSelectedModel: WorkspacePageLocalStateSetter<string>;
  chatMode: ChatMode;
  setChatMode: WorkspacePageLocalStateSetter<ChatMode>;
  isOnline: boolean;
  setIsOnline: WorkspacePageLocalStateSetter<boolean>;
  attachedFiles: WorkspaceAttachment[];
  setAttachedFiles: WorkspacePageLocalStateSetter<WorkspaceAttachment[]>;
  chatAttachmentSnapshot: ChatAttachmentSnapshot;
  setChatAttachmentSnapshot: WorkspacePageLocalStateSetter<ChatAttachmentSnapshot>;
  availableModels: WorkspaceAvailableModel[];
  setAvailableModels: WorkspacePageLocalStateSetter<WorkspaceAvailableModel[]>;
  chatModelRegistrySnapshot: ChatModelRegistrySnapshot;
  setChatModelRegistrySnapshot: WorkspacePageLocalStateSetter<ChatModelRegistrySnapshot>;
  activeTab: IDETab;
  setActiveTab: WorkspacePageLocalStateSetter<IDETab>;
  activeFile: string | null;
  setActiveFile: WorkspacePageLocalStateSetter<string | null>;
  editorNavigationTarget: WorkspaceEditorNavigationTarget | null;
  setEditorNavigationTarget: WorkspacePageLocalStateSetter<WorkspaceEditorNavigationTarget | null>;
  openFiles: WorkspaceOpenFilePathList;
  setOpenFiles: WorkspacePageLocalStateSetter<WorkspaceOpenFilePathList>;
  files: Map<string, string>;
  setFiles: WorkspacePageLocalStateSetter<Map<string, string>>;
  savedFiles: Map<string, string>;
  setSavedFiles: WorkspacePageLocalStateSetter<Map<string, string>>;
  editorBufferStatuses: Map<string, EditorBufferStatus>;
  setEditorBufferStatuses: WorkspacePageLocalStateSetter<Map<string, EditorBufferStatus>>;
  fileTree: FileNode[];
  setFileTree: WorkspacePageLocalStateSetter<FileNode[]>;
  explorerSnapshotStatus: ExplorerSnapshotStatus | null;
  setExplorerSnapshotStatus: WorkspacePageLocalStateSetter<ExplorerSnapshotStatus | null>;
  expandedFolders: Set<string>;
  setExpandedFolders: WorkspacePageLocalStateSetter<Set<string>>;
  searchQuery: string;
  setSearchQuery: WorkspacePageLocalStateSetter<string>;
  pendingCloseFile: string | null;
  setPendingCloseFile: WorkspacePageLocalStateSetter<string | null>;
  contextMenu: WorkspaceContextMenu | null;
  setContextMenu: WorkspacePageLocalStateSetter<WorkspaceContextMenu | null>;
  gitCommits: GitCommit[];
  setGitCommits: WorkspacePageLocalStateSetter<GitCommit[]>;
  gitCommitListStatus: GitCommitListStatus | null;
  setGitCommitListStatus: WorkspacePageLocalStateSetter<GitCommitListStatus | null>;
  gitBranches: GitBranch[];
  setGitBranches: WorkspacePageLocalStateSetter<GitBranch[]>;
  gitBranchListStatus: GitBranchListStatus | null;
  setGitBranchListStatus: WorkspacePageLocalStateSetter<GitBranchListStatus | null>;
  gitRemotes: GitRemote[];
  setGitRemotes: WorkspacePageLocalStateSetter<GitRemote[]>;
  gitRemoteListStatus: GitRemoteListStatus | null;
  setGitRemoteListStatus: WorkspacePageLocalStateSetter<GitRemoteListStatus | null>;
  gitRemoteBranches: GitRemoteBranch[];
  setGitRemoteBranches: WorkspacePageLocalStateSetter<GitRemoteBranch[]>;
  gitRemoteBranchListStatus: GitRemoteBranchListStatus | null;
  setGitRemoteBranchListStatus: WorkspacePageLocalStateSetter<GitRemoteBranchListStatus | null>;
  gitTags: GitTag[];
  setGitTags: WorkspacePageLocalStateSetter<GitTag[]>;
  gitTagListStatus: GitTagListStatus | null;
  setGitTagListStatus: WorkspacePageLocalStateSetter<GitTagListStatus | null>;
  gitStashes: GitStash[];
  setGitStashes: WorkspacePageLocalStateSetter<GitStash[]>;
  gitStashListStatus: GitStashListStatus | null;
  setGitStashListStatus: WorkspacePageLocalStateSetter<GitStashListStatus | null>;
  gitWorktreeStatus: GitWorktreeStatus | null;
  setGitWorktreeStatus: WorkspacePageLocalStateSetter<GitWorktreeStatus | null>;
  gitWorktreeStatusState: GitWorktreeStatusState | null;
  setGitWorktreeStatusState: WorkspacePageLocalStateSetter<GitWorktreeStatusState | null>;
  gitBranchCompare: GitBranchCompare | null;
  setGitBranchCompare: WorkspacePageLocalStateSetter<GitBranchCompare | null>;
  gitBranchCompareStatus: GitBranchCompareStatus | null;
  setGitBranchCompareStatus: WorkspacePageLocalStateSetter<GitBranchCompareStatus | null>;
  gitBranchCompareTarget: string;
  setGitBranchCompareTarget: WorkspacePageLocalStateSetter<string>;
  gitBranchSwitchReadiness: GitBranchSwitchReadiness | null;
  setGitBranchSwitchReadiness: WorkspacePageLocalStateSetter<GitBranchSwitchReadiness | null>;
  selectedCommit: GitCommit | null;
  setSelectedCommit: WorkspacePageLocalStateSetter<GitCommit | null>;
  gitCommitDetailStatus: GitCommitDetailStatus | null;
  setGitCommitDetailStatus: WorkspacePageLocalStateSetter<GitCommitDetailStatus | null>;
  isRestoringCommit: boolean;
  setIsRestoringCommit: WorkspacePageLocalStateSetter<boolean>;
  pendingRestoreCommit: GitCommit | null;
  setPendingRestoreCommit: WorkspacePageLocalStateSetter<GitCommit | null>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  contextMenuRef: RefObject<HTMLDivElement | null>;
  initializedProjectIdRef: RefObject<string | null>;
  restoredProjectIdRef: RefObject<string | null>;
  routeProjectIdRef: RefObject<string | null>;
  requestedPlansRef: RefObject<WorkspacePlanGenerationProjectIdSet>;
  planningProjectIdRef: RefObject<string | null>;
  plannedProjectIdsRef: RefObject<WorkspacePlanGenerationProjectIdSet>;
  autoPlanTriggeredRef: RefObject<boolean>;
  implementingPlanRef: RefObject<boolean>;
  focusedPlanIdRef: RefObject<string | null>;
  generationAbortRef: RefObject<AbortController | null>;
  planningAbortRef: RefObject<AbortController | null>;
};
