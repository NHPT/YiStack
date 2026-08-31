import type { Plan } from '@/lib/api';

import type { WorkspaceChatMessage } from './workspace-types';

export type PlanConfirmationSource = 'manual' | 'confirmed' | 'timeout';

export type ChoosePlanOptions = {
  autoSelected?: boolean;
  baseMessages?: WorkspaceChatMessage[];
  confirmationSource?: PlanConfirmationSource;
};

export type PlanFlowState = {
  availablePlans: Plan[];
  recommendedPlanId: string | null;
  selectedPlanId: string | null;
  planCountdown: number;
  planAutoConfirmDeadlineAt: string | null;
  planSelectionReady: boolean;
};

export type PlanFlowStatePatch = {
  availablePlans?: Plan[];
  recommendedPlanId?: string | null;
  selectedPlanId?: string | null;
  planCountdown?: number;
  planAutoConfirmDeadlineAt?: string | null;
  planSelectionReady?: boolean;
};

export type UpdatePlanFlowState = (
  patch: PlanFlowStatePatch | ((current: PlanFlowState) => PlanFlowStatePatch | null | undefined)
) => void;
