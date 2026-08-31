import type { WorkspacePageConversationActionsContract } from './workspace-page-conversation-actions-contract';
import type { WorkspacePlanImplementationActionContract } from './workspace-orchestration-actions-contract';
import type { PlanRequestOptions } from './workspace-orchestration-hook-types';

export type WorkspacePageAiActionsContract =
  WorkspacePageConversationActionsContract
  & {
    choosePlanAndImplement: WorkspacePlanImplementationActionContract;
    requestPlansForProject: (options?: PlanRequestOptions) => Promise<void>;
  };
