import { useCallback, useReducer } from 'react';
import type { SetStateAction } from 'react';

import type {
  WorkspaceMessageDispatchAction,
  WorkspaceMessageDispatchContract,
} from './workspace-message-dispatch-contract';
import type { WorkspaceChatMessage } from './workspace-types';
import {
  initialWorkspaceMessageState,
  reduceWorkspaceMessageState,
  selectWorkspaceCurrentEngineeringState,
  selectWorkspaceCurrentGateResult,
  selectWorkspaceWorkflowSnapshot,
  type WorkspaceMessageMutationSource,
} from './workspace-message-state';

export function useWorkspaceMessageDispatch(): WorkspaceMessageDispatchContract {
  const [messageState, dispatchMessages] = useReducer(reduceWorkspaceMessageState, initialWorkspaceMessageState);
  const messages = messageState.messages;
  const workflowSnapshot = selectWorkspaceWorkflowSnapshot(messageState);

  const applyWorkspaceMessages = useCallback((
    source: WorkspaceMessageMutationSource,
    value: SetStateAction<WorkspaceChatMessage[]>,
  ) => {
    dispatchMessages({ type: 'apply_messages', source, value });
  }, []);

  const setMessages = useCallback<WorkspaceMessageDispatchAction>((value) => {
    applyWorkspaceMessages('external_set_messages', value);
  }, [applyWorkspaceMessages]);

  return {
    messages,
    workflowSnapshot,
    initialWorkflowSnapshot: initialWorkspaceMessageState.workflowSnapshot,
    applyWorkspaceMessages,
    setMessages,
    currentEngineeringState: selectWorkspaceCurrentEngineeringState(messageState),
    currentGateResult: selectWorkspaceCurrentGateResult(messageState),
  };
}
