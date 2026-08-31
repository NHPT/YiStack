import type { ProjectRuntimeStatus } from '@/lib/api';
import type {
  GitBranch,
  GitBranchCompare,
  GitCommit,
  GitRemote,
  GitRemoteBranch,
  GitStash,
  GitTag,
  GitWorktreeStatus,
} from '@/lib/types';

export type WorkspaceFileTreeRefreshOptions = {
  throwOnFailure?: boolean;
  suppressNotice?: boolean;
};

export type WorkspaceGitResourceRefreshOptions = {
  throwOnFailure?: boolean;
  suppressNotice?: boolean;
};

export type WorkspaceRuntimeStatusSnapshotOptions = {
  throwOnFailure?: boolean;
  suppressNotice?: boolean;
};

export type WorkspaceRuntimeReadinessOptions = {
  initialStage?: string;
  waitStage?: string;
};

export type WorkspaceRuntimeResourcesContract = {
  fetchProjectDetail: (projectId: string) => Promise<void>;
  fetchProjectFileTree: (
    projectId: string,
    options?: WorkspaceFileTreeRefreshOptions,
  ) => Promise<void>;
  refreshProjectFileTree: (
    projectId: string,
    force?: boolean,
    options?: WorkspaceFileTreeRefreshOptions,
  ) => Promise<void>;
  waitForProjectRuntimeReady: (projectId: string) => Promise<ProjectRuntimeStatus>;
  ensureProjectRuntimeReady: (
    projectId: string,
    options?: WorkspaceRuntimeReadinessOptions,
  ) => Promise<ProjectRuntimeStatus>;
  fetchRuntimeStatusSnapshot: (
    projectId: string,
    fallbackMessage?: string,
    options?: WorkspaceRuntimeStatusSnapshotOptions,
  ) => Promise<ProjectRuntimeStatus | null>;
  fetchProjectBranches: (
    projectId: string,
    preferredTargetBranch?: string,
    options?: WorkspaceGitResourceRefreshOptions,
  ) => Promise<GitBranch[]>;
  refreshProjectBranchCompareTarget: (
    projectId: string,
    targetBranch: string,
  ) => Promise<GitBranchCompare | null>;
  fetchProjectRemotes: (
    projectId: string,
    options?: WorkspaceGitResourceRefreshOptions,
  ) => Promise<GitRemote[]>;
  fetchProjectCommits: (
    projectId: string,
    options?: WorkspaceGitResourceRefreshOptions,
  ) => Promise<GitCommit[]>;
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
  resetWorkspaceRuntimeBootstrapState: (projectId: string) => void;
};
