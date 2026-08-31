import type { SetStateAction } from 'react';

import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceGateResult,
} from '@/lib/workspace/engineering-state';
import { resolveLatestWorkspaceEngineeringState } from '@/lib/workspace/engineering-state';

import type {
  WorkspaceChatMessage,
  WorkspaceWorkflowSnapshot,
} from './workspace-types';

export type WorkspaceMessageMutationSource =
  | 'external_set_messages'
  | 'session_snapshot_read_failure'
  | 'session_snapshot_parse_failure'
  | 'workflow_step'
  | 'message_streaming'
  | 'workspace_state_apply'
  | 'plan_flow_state'
  | 'runtime_recovery'
  | 'project_panel_refresh'
  | 'prompt_interaction'
  | 'runtime_resource'
  | 'project_bootstrap'
  | 'page_effect'
  | 'page_ui'
  | 'ide_interaction'
  | 'resource_file'
  | 'resource_git'
  | 'orchestration_shared'
  | 'generation_state_persistence'
  | 'plan_generation'
  | 'plan_stream_patch'
  | 'plan_implementation'
  | 'implementation_generation'
  | 'implementation_stream_patch'
  | 'session_snapshot_save_failure';

export type WorkspaceMessageState = {
  messages: WorkspaceChatMessage[];
  workflowSnapshot: WorkspaceWorkflowSnapshot;
  lastMutationSource: WorkspaceMessageMutationSource | null;
  mutationVersion: number;
};

export type WorkspaceMessageStateAction = {
  type: 'apply_messages';
  source: WorkspaceMessageMutationSource;
  value: SetStateAction<WorkspaceChatMessage[]>;
};

export const initialWorkspaceMessageState: WorkspaceMessageState = {
  messages: [],
  workflowSnapshot: {},
  lastMutationSource: null,
  mutationVersion: 0,
};

function hasWorkspaceMessageStateGateResult(
  gateResult: WorkspaceGateResult | undefined,
): gateResult is WorkspaceGateResult {
  return gateResult !== undefined;
}

function hasWorkspaceMessageStateMessage(
  message: WorkspaceChatMessage | undefined,
): message is WorkspaceChatMessage {
  return message !== undefined;
}

export function resolveLatestWorkflowSnapshot(messages: WorkspaceChatMessage[]): {
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  gateResult?: WorkspaceGateResult;
} {
  const engineeringState = resolveLatestWorkspaceEngineeringState(messages);
  let gateResult: WorkspaceGateResult | undefined;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const hasMessage = hasWorkspaceMessageStateMessage(message);
    if (hasMessage === false) {
      continue;
    }

    const hasGateResult = hasWorkspaceMessageStateGateResult(gateResult);
    const messageGateResult = message.gateResult;
    const hasMessageGateResult = hasWorkspaceMessageStateGateResult(messageGateResult);
    if (hasGateResult === false && hasMessageGateResult === true) {
      gateResult = messageGateResult;
    }

    const hasResolvedGateResult = hasWorkspaceMessageStateGateResult(gateResult);
    if (hasResolvedGateResult === true) {
      break;
    }
  }

  return {
    engineeringState,
    gateResult,
  };
}

export function reduceWorkspaceMessageState(
  state: WorkspaceMessageState,
  action: WorkspaceMessageStateAction,
): WorkspaceMessageState {
  const nextMessages = typeof action.value === 'function'
    ? action.value(state.messages)
    : action.value;

  return {
    messages: nextMessages,
    workflowSnapshot: resolveLatestWorkflowSnapshot(nextMessages),
    lastMutationSource: action.source,
    mutationVersion: state.mutationVersion + 1,
  };
}

export function selectWorkspaceWorkflowSnapshot(
  state: WorkspaceMessageState,
): WorkspaceWorkflowSnapshot {
  return state.workflowSnapshot;
}

export function selectWorkspaceCurrentEngineeringState(
  state: WorkspaceMessageState,
): WorkspaceEngineeringStateSnapshot | undefined {
  return selectWorkspaceWorkflowSnapshot(state).engineeringState;
}

export function selectWorkspaceCurrentGateResult(
  state: WorkspaceMessageState,
): WorkspaceGateResult | undefined {
  return selectWorkspaceWorkflowSnapshot(state).gateResult;
}
