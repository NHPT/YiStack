import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useRef, useState } from 'react';

import type { Plan } from '@/lib/api';

import type { WorkspaceMessageMutationSource } from './workspace-message-state';
import type { WorkspacePlanFlowStateContract } from './workspace-plan-flow-state-contract';
import type {
  WorkspacePlanFlowStateApplyOptions,
  WorkspacePlanFlowStatePatch,
} from './workspace-plan-flow-state';
import type {
  WorkspaceChatMessage,
  WorkspacePlanFlowState,
} from './workspace-types';
import {
  WORKSPACE_PLAN_AUTO_CONFIRM_SECONDS,
  attachPlanSelectionEngineeringState,
  initialWorkspacePlanFlowState,
  resolvePlanFlowState,
  syncPlanFlowState,
} from './workspace-plan-flow-state';

type WorkspaceMessagesApplier = (
  source: WorkspaceMessageMutationSource,
  value: SetStateAction<WorkspaceChatMessage[]>,
) => void;

type WorkspacePlanFlowStatePatchValue = Partial<WorkspacePlanFlowState>;

type UseWorkspacePlanFlowStateOptions = {
  normalizePlanSelectionMessages: (messages: WorkspaceChatMessage[]) => WorkspaceChatMessage[];
  removeLegacyPlaceholderMessages: (messages: WorkspaceChatMessage[]) => WorkspaceChatMessage[];
  applyWorkspaceMessages: WorkspaceMessagesApplier;
};

function hasWorkspacePlanFlowStatePatch(
  nextPatch: WorkspacePlanFlowStatePatchValue | null | undefined,
): nextPatch is WorkspacePlanFlowStatePatchValue {
  if (nextPatch === null) {
    return false;
  }

  return nextPatch !== undefined;
}

export function useWorkspacePlanFlowState({
  normalizePlanSelectionMessages,
  removeLegacyPlaceholderMessages,
  applyWorkspaceMessages,
}: UseWorkspacePlanFlowStateOptions): WorkspacePlanFlowStateContract {
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [recommendedPlanId, setRecommendedPlanId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planCountdown, setPlanCountdown] = useState(WORKSPACE_PLAN_AUTO_CONFIRM_SECONDS);
  const [planAutoConfirmDeadlineAt, setPlanAutoConfirmDeadlineAt] = useState<string | null>(null);
  const [planSelectionReady, setPlanSelectionReady] = useState(false);
  const planFlowStateRef = useRef<WorkspacePlanFlowState>(initialWorkspacePlanFlowState);

  const syncNextPlanFlowState = useCallback((nextPlanState: WorkspacePlanFlowState) => {
    planFlowStateRef.current = nextPlanState;
    syncPlanFlowState(nextPlanState, {
      setAvailablePlans,
      setRecommendedPlanId,
      setSelectedPlanId,
      setPlanSelectionReady,
      setPlanCountdown,
      setPlanAutoConfirmDeadlineAt,
    });
  }, []);

  const applyWorkspaceState = useCallback((
    nextMessages: WorkspaceChatMessage[],
    options?: WorkspacePlanFlowStateApplyOptions,
  ) => {
    const normalizedMessages = normalizePlanSelectionMessages(removeLegacyPlaceholderMessages(nextMessages));
    const nextPlanState = resolvePlanFlowState(planFlowStateRef.current, normalizedMessages, options);
    const messagesWithPlanState = attachPlanSelectionEngineeringState(normalizedMessages, nextPlanState);

    applyWorkspaceMessages('workspace_state_apply', messagesWithPlanState);
    syncNextPlanFlowState(nextPlanState);
  }, [applyWorkspaceMessages, normalizePlanSelectionMessages, removeLegacyPlaceholderMessages, syncNextPlanFlowState]);

  const updatePlanFlowState = useCallback((patch: WorkspacePlanFlowStatePatch) => {
    const currentState = planFlowStateRef.current;
    const nextPatch = typeof patch === 'function' ? patch(currentState) : patch;
    if (hasWorkspacePlanFlowStatePatch(nextPatch) === false) {
      return;
    }

    const nextState: WorkspacePlanFlowState = {
      ...currentState,
      ...nextPatch,
    };
    applyWorkspaceMessages('plan_flow_state', (prev) => attachPlanSelectionEngineeringState(prev, nextState));
    syncNextPlanFlowState(nextState);
  }, [applyWorkspaceMessages, syncNextPlanFlowState]);

  const setSelectedPlanIdState = useCallback<Dispatch<SetStateAction<string | null>>>((value) => {
    updatePlanFlowState((current) => ({
      selectedPlanId: typeof value === 'function' ? value(current.selectedPlanId) : value,
    }));
  }, [updatePlanFlowState]);

  const setPlanCountdownState = useCallback<Dispatch<SetStateAction<number>>>((value) => {
    updatePlanFlowState((current) => ({
      planCountdown: typeof value === 'function' ? value(current.planCountdown) : value,
    }));
  }, [updatePlanFlowState]);

  const setPlanAutoConfirmDeadlineAtState = useCallback<Dispatch<SetStateAction<string | null>>>((value) => {
    updatePlanFlowState((current) => ({
      planAutoConfirmDeadlineAt: typeof value === 'function' ? value(current.planAutoConfirmDeadlineAt) : value,
    }));
  }, [updatePlanFlowState]);

  return {
    availablePlans,
    recommendedPlanId,
    selectedPlanId,
    setSelectedPlanId: setSelectedPlanIdState,
    planCountdown,
    setPlanCountdown: setPlanCountdownState,
    planAutoConfirmDeadlineAt,
    setPlanAutoConfirmDeadlineAt: setPlanAutoConfirmDeadlineAtState,
    planSelectionReady,
    updatePlanFlowState,
    applyWorkspaceState,
  };
}
