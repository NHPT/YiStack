import type { GitCommit } from '@/lib/types';

export type WorkspaceResourceOperationsContract = {
  saveFile: (filePath: string, content: string) => Promise<boolean>;
  handleViewCommit: (commit: GitCommit) => Promise<void>;
  handleRestoreCommit: (commit: GitCommit) => void;
  handleRestoreCommitFile: (commit: GitCommit, filePath: string) => Promise<void>;
  handleCommitWorktree: (message: string) => Promise<void>;
  handleDiscardWorktreeFile: (filePath: string) => Promise<void>;
  handleApplyGitBranchCompareFile: (
    baseBranch: string,
    headBranch: string,
    filePath: string,
  ) => Promise<void>;
  handleCreateGitStash: (message: string) => Promise<void>;
  handleApplyGitStash: (stashRef: string) => Promise<void>;
  handleCreateGitBranch: (branchName: string) => Promise<void>;
  handleCreateGitTag: (tagName: string) => Promise<void>;
  handleDeleteGitTag: (tagName: string) => Promise<void>;
  handleCreateGitBranchFromRemote: (
    remoteBranch: string,
    branchName: string,
  ) => Promise<void>;
  handleRefreshGitRemoteBranches: (remoteName: string) => Promise<void>;
  handleDeleteGitBranch: (branchName: string) => Promise<void>;
  handleRenameGitBranch: (
    previousName: string,
    nextName: string,
  ) => Promise<void>;
  handleSwitchGitBranch: (targetBranch: string) => Promise<void>;
  confirmRestoreCommit: () => Promise<void>;
};
