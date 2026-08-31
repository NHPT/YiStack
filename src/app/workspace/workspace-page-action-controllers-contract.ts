import type { GitCommit } from '@/lib/types';

import type { WorkspacePageAiActionsContract } from './workspace-page-ai-actions-contract';
import type { WorkspacePageLocalStateSetter } from './workspace-page-local-state-contract';
import type { WorkspacePageProjectActionsContract } from './workspace-page-project-actions-contract';
import type { WorkspaceOpenFilePathList } from './workspace-types';

export type WorkspacePageActionControllersContract =
  WorkspacePageProjectActionsContract
  & WorkspacePageAiActionsContract
  & {
    pendingCloseFile: string | null;
    setPendingCloseFile: WorkspacePageLocalStateSetter<string | null>;
    gitCommits: GitCommit[];
    openFiles: WorkspaceOpenFilePathList;
    handleSelectGitBranchCompareTarget: (targetBranch: string) => Promise<void>;
    handleRecoverRuntime: () => Promise<void>;
  };
