import type { WorkspaceProjectBootstrapMessageRestoreStatus } from './workspace-types';

export type WorkspaceProjectBootstrapContract = {
  isRestoringWorkspace: boolean;
  messageRestoreStatus: WorkspaceProjectBootstrapMessageRestoreStatus;
};
