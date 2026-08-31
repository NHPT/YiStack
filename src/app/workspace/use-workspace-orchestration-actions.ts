import { useWorkspaceOrchestrationImplementationActions } from './use-workspace-orchestration-implementation-actions';
import { useWorkspaceOrchestrationPlanningActions } from './use-workspace-orchestration-planning-actions';
import { useWorkspaceOrchestrationSharedActions } from './use-workspace-orchestration-shared-actions';
import {
  buildImplementationActionOptions,
  buildPlanningActionOptions,
  buildSharedActionOptions,
} from './workspace-orchestration-action-option-builders';
import type { WorkspaceOrchestrationActionsContract } from './workspace-orchestration-actions-contract';
import type { UseWorkspaceOrchestrationOptions } from './workspace-orchestration-hook-types';

export function useWorkspaceOrchestrationActions(
  options: UseWorkspaceOrchestrationOptions,
): WorkspaceOrchestrationActionsContract {
  const sharedActions = useWorkspaceOrchestrationSharedActions(
    buildSharedActionOptions(options),
  );

  const implementationActions = useWorkspaceOrchestrationImplementationActions(
    buildImplementationActionOptions(options, sharedActions),
  );

  const planningActions = useWorkspaceOrchestrationPlanningActions(
    buildPlanningActionOptions(options, sharedActions),
  );

  return {
    ...implementationActions,
    ...planningActions,
  };
}
