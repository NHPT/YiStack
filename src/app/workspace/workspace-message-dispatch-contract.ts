import type {
  Dispatch,
  SetStateAction,
} from 'react';

import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceGateResult,
} from '@/lib/workspace/engineering-state';

import type {
  WorkspaceChatMessage,
  WorkspaceWorkflowSnapshot,
} from './workspace-types';
import type { WorkspaceMessageMutationSource } from './workspace-message-state';

export type WorkspaceMessageDispatchAction = Dispatch<SetStateAction<WorkspaceChatMessage[]>>;

export type WorkspaceMessageDispatchContract = {
  messages: WorkspaceChatMessage[];
  workflowSnapshot: WorkspaceWorkflowSnapshot;
  initialWorkflowSnapshot: WorkspaceWorkflowSnapshot;
  applyWorkspaceMessages: (
    source: WorkspaceMessageMutationSource,
    value: SetStateAction<WorkspaceChatMessage[]>,
  ) => void;
  setMessages: WorkspaceMessageDispatchAction;
  currentEngineeringState: WorkspaceEngineeringStateSnapshot | undefined;
  currentGateResult: WorkspaceGateResult | undefined;
};
