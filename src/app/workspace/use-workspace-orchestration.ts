import type { UseWorkspaceOrchestrationOptions } from './workspace-orchestration-hook-types';
import type { WorkspaceOrchestrationActionsContract } from './workspace-orchestration-actions-contract';
import { useWorkspaceOrchestrationActions } from './use-workspace-orchestration-actions';

export function useWorkspaceOrchestration({
  ...options
}: UseWorkspaceOrchestrationOptions): WorkspaceOrchestrationActionsContract {
  return useWorkspaceOrchestrationActions(options);
}
