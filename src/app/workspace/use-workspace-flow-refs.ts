import { useEffect, useRef } from 'react';

import type { WorkspaceFlowRefsContract } from './workspace-flow-refs-contract';
import type {
  WorkspaceChatMessage,
  WorkspaceWorkflowSnapshot,
} from './workspace-types';

type UseWorkspaceFlowRefsOptions = {
  messages: WorkspaceChatMessage[];
  workflowSnapshot: WorkspaceWorkflowSnapshot;
  initialWorkflowSnapshot: WorkspaceWorkflowSnapshot;
};

export function useWorkspaceFlowRefs({
  messages,
  workflowSnapshot,
  initialWorkflowSnapshot,
}: UseWorkspaceFlowRefsOptions): WorkspaceFlowRefsContract {
  const messagesRef = useRef<WorkspaceChatMessage[]>([]);
  const workflowSnapshotRef = useRef<WorkspaceWorkflowSnapshot>(initialWorkflowSnapshot);

  useEffect(() => {
    messagesRef.current = messages;
    workflowSnapshotRef.current = workflowSnapshot;
  }, [messages, workflowSnapshot]);

  return {
    messagesRef,
    workflowSnapshotRef,
  };
}
