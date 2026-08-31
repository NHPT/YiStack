import type { WorkspacePageControllersContract } from './workspace-page-controllers-contract';
import type { WorkspacePageLocalStateContract } from './workspace-page-local-state-contract';
import type { WorkspaceShellStateContract } from './workspace-shell-state-contract';
import type { WorkspaceProjectBootstrapMessageRestoreStatus } from './workspace-types';

export type WorkspacePageCompositionContract =
  WorkspacePageLocalStateContract
  & WorkspaceShellStateContract
  & WorkspacePageControllersContract
  & {
    isRestoringWorkspace: boolean;
    messageRestoreStatus: WorkspaceProjectBootstrapMessageRestoreStatus;
  };
