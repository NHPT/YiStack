import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from 'react';

import type { WorkflowStep } from '@/components/workspace/chat-message-content';
import type { FileNode, FileNodeType, GitCommit } from '@/lib/types';
import type {
  WorkspaceEditorNavigationTarget,
  WorkspaceExplorerContextOperation,
  WorkspaceExplorerContextOperationInput,
} from './workspace-types';

export type WorkspacePageProjectActionsContract = {
  saveFile: (filePath: string, content: string) => Promise<boolean>;
  handleViewCommit: (commit: GitCommit) => Promise<void>;
  handleRestoreCommit: (commit: GitCommit) => void;
  handleRestoreCommitFile: (commit: GitCommit, filePath: string) => Promise<void>;
  handleCommitWorktree: (message: string) => Promise<void>;
  handleDiscardWorktreeFile: (filePath: string) => Promise<void>;
  handleApplyGitBranchCompareFile: (baseBranch: string, headBranch: string, filePath: string) => Promise<void>;
  handleCreateGitStash: (message: string) => Promise<void>;
  handleApplyGitStash: (stashRef: string) => Promise<void>;
  handleCreateGitBranch: (branchName: string) => Promise<void>;
  handleCreateGitTag: (tagName: string) => Promise<void>;
  handleDeleteGitTag: (tagName: string) => Promise<void>;
  handleCreateGitBranchFromRemote: (remoteBranch: string, branchName: string) => Promise<void>;
  handleRefreshGitRemoteBranches: (remoteName: string) => Promise<void>;
  handleDeleteGitBranch: (branchName: string) => Promise<void>;
  handleRenameGitBranch: (previousName: string, nextName: string) => Promise<void>;
  handleSwitchGitBranch: (targetBranch: string) => Promise<void>;
  confirmRestoreCommit: () => Promise<void>;
  reflectFilePathInTree: (path: string, leafType?: FileNodeType) => void;
  isFileDirty: (path: string | null) => boolean;
  closeWorkspaceFile: (path: string, discardChanges?: boolean) => void;
  requestCloseWorkspaceFile: (path: string) => void;
  applyIncrementalWorkflowStep: (step: WorkflowStep) => void;
  openWorkspaceFile: (target: string | WorkspaceEditorNavigationTarget) => Promise<void>;
  toggleFolder: (path: string) => void;
  showContextMenu: (event: ReactMouseEvent, node: FileNode) => void;
  handleExplorerContextOperation: (
    operation: WorkspaceExplorerContextOperation,
    node: FileNode | null,
    input?: WorkspaceExplorerContextOperationInput,
  ) => Promise<void>;
  handleUnavailableExplorerContextOperation: (
    operation: WorkspaceExplorerContextOperation,
    node: FileNode | null,
  ) => void;
  downloadFile: (path: string, content: string) => void;
  openExplorerPanel: () => void;
  refreshExplorerPanel: () => Promise<void>;
  openGitPanel: () => void;
  refreshGitPanel: () => Promise<void>;
  mobileFileContent: string;
  setMobileFileContent: Dispatch<SetStateAction<string>>;
};
