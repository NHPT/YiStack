import type { ComponentType, MouseEvent as ReactMouseEvent, ReactNode } from 'react';

import type { FileNode, GitBranch, GitBranchCompare, GitBranchSwitchReadiness, GitCommit, GitRemote, GitRemoteBranch, GitStash, GitTag, GitWorktreeStatus } from '@/lib/types';
import type { ProjectRuntimeStatus } from '@/lib/api';
import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceGateResult,
} from '@/lib/workspace/engineering-state';

import type {
  EditorBufferStatus,
  ExplorerSnapshotStatus,
  GitBranchCompareStatus,
  GitBranchListStatus,
  GitCommitDetailStatus,
  GitCommitListStatus,
  GitRemoteListStatus,
  GitRemoteBranchListStatus,
  GitStashListStatus,
  GitTagListStatus,
  GitWorktreeStatusState,
  IDETab,
  PreviewUrlStatus,
  WorkspaceBrowserDevice,
  WorkspaceEditorNavigationTarget,
  WorkspaceOpenFilePathList,
} from './workspace-types';
import type { WorkspaceFoundationDecisionConfirmation } from './workspace-prompt-actions-contract';

export type TabOption = {
  id: IDETab;
  label: string;
  icon: ReactNode;
};

export type MonacoEditorLanguage = 'json' | 'css' | 'markdown' | 'typescript';
export type MonacoEditorTheme = 'vs-light';
export type MonacoEditorLineNumbers = 'on';
export type MonacoEditorWordWrap = 'on';
export type MonacoEditorMinimapOptions = {
  enabled: boolean;
};
export type MonacoEditorOptions = {
  minimap: MonacoEditorMinimapOptions;
  fontSize: number;
  lineNumbers: MonacoEditorLineNumbers;
  scrollBeyondLastLine: boolean;
  automaticLayout: boolean;
  wordWrap: MonacoEditorWordWrap;
  readOnly?: boolean;
};
export type MonacoEditorMountAction = (editor: unknown) => void;
export type MonacoEditorChangeAction = (value: string | undefined) => void;
export type MonacoEditorComponentProps = {
  height: string;
  language: MonacoEditorLanguage;
  value: string;
  onMount: MonacoEditorMountAction;
  onChange: MonacoEditorChangeAction;
  theme: MonacoEditorTheme;
  options: MonacoEditorOptions;
};
export type MonacoEditorComponent = ComponentType<MonacoEditorComponentProps>;

export type WorkspaceGitSelectBranchCompareTargetAction = (targetBranch: string) => void | Promise<void>;
export type WorkspaceGitCreateBranchAction = (branchName: string) => void | Promise<void>;
export type WorkspaceGitCreateTagAction = (tagName: string) => void | Promise<void>;
export type WorkspaceGitDeleteTagAction = (tagName: string) => void | Promise<void>;
export type WorkspaceGitCreateBranchFromRemoteAction = (remoteBranch: string, branchName: string) => void | Promise<void>;
export type WorkspaceGitRefreshPanelAction = () => void | Promise<void>;
export type WorkspaceGitRefreshRemoteBranchesAction = (remoteName: string) => void | Promise<void>;
export type WorkspaceGitDeleteBranchAction = (branchName: string) => void | Promise<void>;
export type WorkspaceGitRenameBranchAction = (previousName: string, nextName: string) => void | Promise<void>;
export type WorkspaceGitSwitchBranchAction = (targetBranch: string) => void | Promise<void>;
export type WorkspaceGitViewCommitAction = (commit: GitCommit) => void | Promise<void>;
export type WorkspaceGitCommitWorktreeAction = (message: string) => void | Promise<void>;
export type WorkspaceGitDiscardWorktreeFileAction = (filePath: string) => void | Promise<void>;
export type WorkspaceGitRestoreCommitFileAction = (commit: GitCommit, filePath: string) => void | Promise<void>;
export type WorkspaceGitApplyBranchCompareFileAction = (baseBranch: string, headBranch: string, filePath: string) => void | Promise<void>;
export type WorkspaceGitCreateStashAction = (message: string) => void | Promise<void>;
export type WorkspaceGitApplyStashAction = (stashRef: string) => void | Promise<void>;
export type WorkspaceRuntimeRecoverAction = () => void | Promise<void>;
export type WorkspacePreviewHistoryNavigationAction = () => void;
export type WorkspacePreviewNavigateAction = (value: string) => void;
export type WorkspaceExplorerToggleFolderAction = (path: string) => void;
export type WorkspaceExplorerContextMenuAction = (event: ReactMouseEvent, node: FileNode) => void;
export type WorkspaceProjectExportAction = () => void;
export type WorkspaceEditorFileDirtyCheck = (path: string) => boolean;
export type WorkspaceEditorNavigationHandledAction = () => void;
export type WorkspaceEditorRequestCloseFileAction = (path: string) => void;
export type WorkspaceFoundationStartAction = () => void | Promise<void>;
export type WorkspaceFoundationOpenFileAction = (target: string | WorkspaceEditorNavigationTarget) => void | Promise<void>;
export type WorkspaceFoundationConfirmDecisionsAction = (
  decisions: WorkspaceFoundationDecisionConfirmation[],
) => void | Promise<void>;

export type SharedExplorerProps = {
  filteredTree: FileNode[];
  hasOriginalFileTreeData: boolean;
  explorerSnapshotStatus: ExplorerSnapshotStatus | null;
  searchQuery: string;
  expandedFolders: Set<string>;
  activeFile: string | null;
  onSearchQueryChange: (value: string) => void;
  onToggleFolder: WorkspaceExplorerToggleFolderAction;
  onSelectFile: (path: string) => void | Promise<void>;
  onContextMenu: WorkspaceExplorerContextMenuAction;
};

export type SharedGitProps = {
  projectId: string | null;
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
  selectedCommit: GitCommit | null;
  gitCommitDetailStatus: GitCommitDetailStatus | null;
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
  onOpenFile: (path: string) => void | Promise<void>;
  onCopyText: (text: string) => void | Promise<void>;
  onViewCommit: WorkspaceGitViewCommitAction;
  onCommitWorktree: WorkspaceGitCommitWorktreeAction;
  onDiscardWorktreeFile: WorkspaceGitDiscardWorktreeFileAction;
  onRestoreCommitFile: WorkspaceGitRestoreCommitFileAction;
  onApplyGitBranchCompareFile: WorkspaceGitApplyBranchCompareFileAction;
  onCreateGitStash: WorkspaceGitCreateStashAction;
  onApplyGitStash: WorkspaceGitApplyStashAction;
};

export type SharedPreviewProps = {
  browserDevice: WorkspaceBrowserDevice;
  onSetBrowserDevice: (device: WorkspaceBrowserDevice) => void;
};

export type DesktopExplorerPanelProps = SharedExplorerProps & {
  openFiles: WorkspaceOpenFilePathList;
  activeFileContent: string;
  activeFileBufferStatus: EditorBufferStatus | null;
  editorNavigationTarget: WorkspaceEditorNavigationTarget | null;
  onEditorNavigationHandled: () => void;
  isFileDirty: WorkspaceEditorFileDirtyCheck;
  onExportProject: WorkspaceProjectExportAction;
  onSelectOpenFile: (path: string) => void;
  onRequestCloseFile: WorkspaceEditorRequestCloseFileAction;
  onSaveActiveFile: () => void;
  onCopyActiveFile: () => void;
  onUpdateActiveFileContent: (value: string) => void;
  monacoEditor: MonacoEditorComponent;
};

export type DesktopPreviewPanelProps = {
  projectId: string | null;
  browserUrl: string;
  previewUrlStatus: PreviewUrlStatus | null;
  previewReloadToken: number;
  onChangeBrowserUrl: (value: string) => void;
  onOpenRuntimeHomeUrl: (value: string) => void;
  previewDeviceStyle: { width: string; height: string };
  runtimeStatus?: ProjectRuntimeStatus;
  onOpenCapabilityAudit: () => void;
  onRecoverRuntime: WorkspaceRuntimeRecoverAction;
};

export type MobileExplorerEditorProps = {
  mobileEditingFile: string;
  mobileFileContent: string;
  mobileEditorBufferStatus: EditorBufferStatus | null;
  editorNavigationTarget: WorkspaceEditorNavigationTarget | null;
  onEditorNavigationHandled: WorkspaceEditorNavigationHandledAction;
  onClose: () => void;
  onCopy: () => void;
  onSave: () => void;
  isFileDirty: WorkspaceEditorFileDirtyCheck;
  onUpdateMobileFileContent: (value: string) => void;
  monacoEditor: MonacoEditorComponent;
};

export type MobilePreviewPanelProps = SharedPreviewProps & {
  projectId: string | null;
  historyIndex: number;
  browserHistoryLength: number;
  mobileBrowserUrl: string;
  mobilePreviewUrlStatus: PreviewUrlStatus | null;
  previewReloadToken: number;
  runtimeStatus?: ProjectRuntimeStatus;
  onOpenCapabilityAudit: () => void;
  onOpenRuntimeHomeUrl: (value: string) => void;
  onRecoverRuntime: WorkspaceRuntimeRecoverAction;
  onGoBrowserBack: WorkspacePreviewHistoryNavigationAction;
  onGoForward: WorkspacePreviewHistoryNavigationAction;
  onChangeMobileBrowserUrl: (value: string) => void;
  onNavigateTo: WorkspacePreviewNavigateAction;
};

export type DesktopIdeProps = SharedExplorerProps & SharedGitProps & SharedPreviewProps & {
  tabs: TabOption[];
  activeTab: IDETab;
  openFiles: WorkspaceOpenFilePathList;
  filesSize: number;
  activeFileContent: string;
  activeFileBufferStatus: EditorBufferStatus | null;
  editorNavigationTarget: WorkspaceEditorNavigationTarget | null;
  previewDeviceStyle: { width: string; height: string };
  browserUrl: string;
  previewUrlStatus: PreviewUrlStatus | null;
  previewReloadToken: number;
  runtimeStatus?: ProjectRuntimeStatus;
  projectId: string | null;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  contextGateResult?: WorkspaceGateResult;
  foundationActionLabel: string;
  foundationStatusLabel: string;
  monacoEditor: MonacoEditorComponent;
  onSelectTab: (tabId: IDETab) => void;
  onChangeBrowserUrl: (value: string) => void;
  onOpenRuntimeHomeUrl: (value: string) => void;
  onRecoverRuntime: WorkspaceRuntimeRecoverAction;
  onExportProject: WorkspaceProjectExportAction;
  isFileDirty: WorkspaceEditorFileDirtyCheck;
  onSelectOpenFile: (path: string) => void;
  onEditorNavigationHandled: WorkspaceEditorNavigationHandledAction;
  onRequestCloseFile: WorkspaceEditorRequestCloseFileAction;
  onSaveActiveFile: () => void;
  onCopyActiveFile: () => void;
  onUpdateActiveFileContent: (value: string) => void;
  onStartFoundation: WorkspaceFoundationStartAction;
  onOpenFoundationFile: WorkspaceFoundationOpenFileAction;
  onConfirmFoundationDecisions: WorkspaceFoundationConfirmDecisionsAction;
};

export type MobileIdeProps = SharedExplorerProps & SharedGitProps & SharedPreviewProps & {
  tabs: TabOption[];
  activeTab: IDETab;
  historyIndex: number;
  browserHistoryLength: number;
  mobileBrowserUrl: string;
  mobilePreviewUrlStatus: PreviewUrlStatus | null;
  previewReloadToken: number;
  runtimeStatus?: ProjectRuntimeStatus;
  mobileEditingFile: string | null;
  mobileFileContent: string;
  mobileEditorBufferStatus: EditorBufferStatus | null;
  editorNavigationTarget: WorkspaceEditorNavigationTarget | null;
  projectId: string | null;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  contextGateResult?: WorkspaceGateResult;
  foundationActionLabel: string;
  foundationStatusLabel: string;
  monacoEditor: MonacoEditorComponent;
  onSelectTab: (tabId: IDETab) => void;
  onGoBrowserBack: WorkspacePreviewHistoryNavigationAction;
  onGoForward: WorkspacePreviewHistoryNavigationAction;
  onChangeMobileBrowserUrl: (value: string) => void;
  onOpenRuntimeHomeUrl: (value: string) => void;
  onNavigateTo: WorkspacePreviewNavigateAction;
  onRecoverRuntime: WorkspaceRuntimeRecoverAction;
  isFileDirty: WorkspaceEditorFileDirtyCheck;
  onEditorNavigationHandled: WorkspaceEditorNavigationHandledAction;
  onCloseMobileEditor: () => void;
  onCopyMobileFile: () => void;
  onSaveMobileFile: () => void;
  onUpdateMobileFileContent: (value: string) => void;
  onStartFoundation: WorkspaceFoundationStartAction;
  onOpenFoundationFile: WorkspaceFoundationOpenFileAction;
  onConfirmFoundationDecisions: WorkspaceFoundationConfirmDecisionsAction;
};
