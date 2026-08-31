import type { RefObject } from 'react';

import type {
  WorkspaceChatMessage,
  WorkspaceWorkflowSnapshot,
} from './workspace-types';

export type WorkspaceFlowRefsContract = {
  messagesRef: RefObject<WorkspaceChatMessage[]>;
  workflowSnapshotRef: RefObject<WorkspaceWorkflowSnapshot>;
};
