import type { Plan } from '@/lib/api';

import type { WorkspaceChatMessage } from './workspace-types';

export type ApplyWorkspaceState = (
  nextMessages: WorkspaceChatMessage[],
  options?: {
    availablePlans?: Plan[];
    recommendedPlanId?: string | null;
    selectedPlanId?: string | null;
    planCountdown?: number;
    planAutoConfirmDeadlineAt?: string | null;
    planSelectionReady?: boolean;
  }
) => void;

export type WorkspaceMessagePatch =
  | Partial<WorkspaceChatMessage>
  | ((message: WorkspaceChatMessage) => Partial<WorkspaceChatMessage> | null | undefined);

export type MutableRefLike<T> = { current: T };
