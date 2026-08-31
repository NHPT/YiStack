import type { Plan } from '@/lib/api';

import type {
  ChoosePlanOptions,
  GenerateOptions,
  PlanRequestOptions,
} from './workspace-orchestration-hook-types';
import type { WorkspaceProjectInfo } from './workspace-types';

export type WorkspacePlanImplementationActionContract = (
  plan: Plan,
  options?: ChoosePlanOptions,
) => Promise<void>;

export type WorkspaceImplementationGenerationActionContract = (
  prompt: string,
  targetProject?: WorkspaceProjectInfo,
  options?: GenerateOptions,
) => Promise<void>;

export type WorkspaceOrchestrationActionsContract = {
  choosePlanAndImplement: WorkspacePlanImplementationActionContract;
  handleLLMGenerate: WorkspaceImplementationGenerationActionContract;
  buildPlanDiscussionPrompt: (question: string) => string;
  requestPlansForProject: (options?: PlanRequestOptions) => Promise<void>;
};
