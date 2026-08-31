import type { MutableRefObject } from 'react';

import type { Plan } from '@/lib/api';

import type { WorkspaceChatMessage, WorkspaceProjectInfo } from './workspace-types';

export type PlanRequestOptions = {
  force?: boolean;
  retry?: boolean;
  userFeedback?: string;
  baseMessages?: WorkspaceChatMessage[];
};

export type PlanRequestTerminalMessageKind = 'aborted' | 'error';

export type PreparedPlanGenerationRequest = {
  appType: string;
  baseMessages: WorkspaceChatMessage[];
  currentPlansForReplan: Plan[];
  initialStatusMessage: string;
  isReplan: boolean;
  isRetry: boolean;
  persistedProjectId?: string;
  projectId: string;
  selectedModel: string;
  requestDescription: string;
  userFeedback: string;
};

export type PlanGenerationAvailablePlans = Plan[];
export type PlanGenerationMessagesRef = MutableRefObject<WorkspaceChatMessage[]>;
export type WorkspacePlanGenerationProjectId = string;
export type WorkspacePlanGenerationProjectIdSet = Set<WorkspacePlanGenerationProjectId>;
export type WorkspacePlanGenerationProjectIdSetRef = MutableRefObject<WorkspacePlanGenerationProjectIdSet>;

export type PreparePlanGenerationRequestOptions = {
  projectInfo: WorkspaceProjectInfo;
  options: PlanRequestOptions | undefined;
  availablePlans: PlanGenerationAvailablePlans;
  messagesRef: PlanGenerationMessagesRef;
};
