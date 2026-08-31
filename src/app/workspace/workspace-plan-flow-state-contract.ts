import type {
  Dispatch,
  SetStateAction,
} from 'react';

import type { Plan } from '@/lib/api';

import type { WorkspaceChatMessage } from './workspace-types';
import type {
  WorkspacePlanFlowStateApplyOptions,
  WorkspacePlanFlowStatePatch,
} from './workspace-plan-flow-state';

export type WorkspacePlanSelectionAction<T> = Dispatch<SetStateAction<T>>;

export type WorkspacePlanFlowStateContract = {
  availablePlans: Plan[];
  recommendedPlanId: string | null;
  selectedPlanId: string | null;
  setSelectedPlanId: WorkspacePlanSelectionAction<string | null>;
  planCountdown: number;
  setPlanCountdown: WorkspacePlanSelectionAction<number>;
  planAutoConfirmDeadlineAt: string | null;
  setPlanAutoConfirmDeadlineAt: WorkspacePlanSelectionAction<string | null>;
  planSelectionReady: boolean;
  updatePlanFlowState: (patch: WorkspacePlanFlowStatePatch) => void;
  applyWorkspaceState: (
    nextMessages: WorkspaceChatMessage[],
    options?: WorkspacePlanFlowStateApplyOptions,
  ) => void;
};
