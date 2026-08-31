import type { WorkspaceFlowStateContract } from './workspace-flow-state-contract';
import type { WorkspacePageLocalStateContract } from './workspace-page-local-state-contract';
import type { WorkspaceRuntimeResourcesContract } from './workspace-runtime-resources-contract';
import type { WorkspaceShellStateContract } from './workspace-shell-state-contract';
import type { WorkspaceProjectBootstrapMessageRestoreStatus } from './workspace-types';

export type WorkspacePageFoundationContract = {
  localState: WorkspacePageLocalStateContract;
  flowState: WorkspaceFlowStateContract;
  shellState: WorkspaceShellStateContract;
  runtimeResources: WorkspaceRuntimeResourcesContract;
  isRestoringWorkspace: boolean;
  messageRestoreStatus: WorkspaceProjectBootstrapMessageRestoreStatus;
};
