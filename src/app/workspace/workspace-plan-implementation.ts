import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { projectApi, type Plan } from '@/lib/api';
import { serializePlanTechStack } from '@/lib/tech-stack';
import {
  getWorkspaceWorkflowStageApprovalBoundaryOrFallback,
  getWorkspaceWorkflowStageAutoProgressEnabledOrFallback,
  getWorkspaceWorkflowStageDefaultModeOrFallback,
} from '@/lib/workspace/workflow-contract';

import type { GenerateOptions } from './workspace-implementation-generation';
import { buildImplementationPlanContext } from './workspace-orchestration-support';
import type { ChoosePlanOptions, PlanConfirmationSource } from './workspace-orchestration-flow-types';
import type {
  WorkspaceChatMessage,
  WorkspaceGenerationMode,
  WorkspaceProjectInfo,
} from './workspace-types';
import type { WorkspaceEngineeringStateSnapshot } from '@/lib/workspace/engineering-state';

const WORKSPACE_PLAN_APPROVED_STAGE = 'plan-approved';

function getPlanApprovedGenerationMode(): WorkspaceGenerationMode {
  const defaultMode = getWorkspaceWorkflowStageDefaultModeOrFallback(WORKSPACE_PLAN_APPROVED_STAGE, 'implement');
  if (defaultMode === 'foundation') {
    return defaultMode;
  }

  if (defaultMode === 'discuss') {
    return defaultMode;
  }

  if (defaultMode === 'implement') {
    return defaultMode;
  }

  return 'implement';
}

type PreparedImplementationLaunch = {
  confirmationSource: PlanConfirmationSource;
  updatedPlanMessages: WorkspaceChatMessage[];
};

type SelectedPlanProjectPreparationContext = {
  createPersistedProject: (plan: Plan) => Promise<WorkspaceProjectInfo>;
  persistWorkspaceProject: (project: WorkspaceProjectInfo) => void;
  projectInfo: WorkspaceProjectInfo;
  setProjectInfo: Dispatch<SetStateAction<WorkspaceProjectInfo | null>>;
};

type PlanImplementationRuntimePreparationContext = {
  ensureProjectRuntimeReady: (projectId: string, options?: {
    initialStage?: string;
    waitStage?: string;
  }) => Promise<unknown>;
};

function formatConfirmationSource(source: PlanConfirmationSource) {
  switch (source) {
    case 'timeout':
      return '倒计时结束后自动确认推荐方案';
    case 'confirmed':
      return '用户明确确认推荐方案';
    case 'manual':
    default:
      return '用户手动选择方案';
  }
}

function buildPlanApprovedEngineeringState(
  plan: Plan,
  confirmationSource: PlanConfirmationSource,
): WorkspaceEngineeringStateSnapshot {
  const currentTask = `按已批准计划「${plan.name}」自动推进实现`;
  const nextAction = '进入实现阶段并持续执行，直到遇到门禁、风险点或新的确认边界';
  const approvalSource = formatConfirmationSource(confirmationSource);

  return {
    workflow: {
      stage: WORKSPACE_PLAN_APPROVED_STAGE,
      mode: getWorkspaceWorkflowStageDefaultModeOrFallback(WORKSPACE_PLAN_APPROVED_STAGE, 'implement'),
      status: 'running',
    },
    validation: {
      status: 'not_applicable',
    },
    runtime: {
      status: 'pending',
    },
    phase: {
      current_phase: '已批准方案',
      current_task: currentTask,
      completed_tasks: [`方案已确认：${plan.name}`, `确认来源：${approvalSource}`],
      blockers: [],
      next_action: nextAction,
      status: 'running',
    },
    execution: {
      auto_progress_enabled: getWorkspaceWorkflowStageAutoProgressEnabledOrFallback(
        WORKSPACE_PLAN_APPROVED_STAGE,
        true,
      ),
      awaiting_confirmation: false,
      approval_boundary: getWorkspaceWorkflowStageApprovalBoundaryOrFallback(
        WORKSPACE_PLAN_APPROVED_STAGE,
        'approved_plan',
      ),
      approval_source: approvalSource,
      approval_scope: '仅限当前已批准方案，遇到门禁、运行时异常、高风险变更或新确认边界时暂停',
      approved_plan_id: plan.id,
      approved_plan_name: plan.name,
      current_task: currentTask,
      next_action: nextAction,
    },
  };
}

function hasPlanImplementationExistingProject(projectInfo: WorkspaceProjectInfo): boolean {
  const isPersistedProject = projectInfo.isPersisted === true;
  if (isPersistedProject === true) {
    return true;
  }

  const hasPersistedProjectId = projectInfo.projectId.startsWith('proj_');
  return hasPersistedProjectId === true;
}

async function prepareProjectForSelectedPlan(
  plan: Plan,
  context: SelectedPlanProjectPreparationContext,
) {
  const serializedPlan = JSON.stringify(plan);
  const serializedTechStack = serializePlanTechStack(plan);
  const hasExistingProject = hasPlanImplementationExistingProject(context.projectInfo);

  if (hasExistingProject === false) {
    return context.createPersistedProject(plan);
  }

  await projectApi.update(context.projectInfo.projectId, {
    tech_stack: serializedTechStack,
    plan_id: plan.id,
    plan_data: serializedPlan,
  });

  const targetProject: WorkspaceProjectInfo = {
    ...context.projectInfo,
    techStack: serializedTechStack,
    planId: plan.id,
    planData: serializedPlan,
    initialMessage: `基于 ${plan.name} 方案开始实现`,
    isPersisted: true,
  };
  context.setProjectInfo(targetProject);
  context.persistWorkspaceProject(targetProject);
  return targetProject;
}

function appendImplementationKickoffMessage(
  implementationMessageId: string,
  plan: Plan,
  confirmationSource: PlanConfirmationSource,
  applyPlanImplementationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>,
) {
  applyPlanImplementationMessages((prev) => [...prev, {
    id: implementationMessageId,
    role: 'assistant',
    content: '',
    statusContent: confirmationSource === 'timeout'
      ? `已自动确认推荐方案「${plan.name}」，正在确认开发环境并发起本轮实现。`
      : '已收到你的方案选择，正在确认开发环境并发起本轮实现。',
    kind: 'workflow',
    workflowSteps: [],
    engineeringState: buildPlanApprovedEngineeringState(plan, confirmationSource),
    streaming: true,
    timestamp: new Date(),
  }]);
}

function getPlanImplementationAutoSelected(options: ChoosePlanOptions | undefined): boolean {
  if (options === undefined) {
    return false;
  }

  return options.autoSelected === true;
}

function getPlanImplementationConfirmationSource({
  options,
  autoSelected,
}: {
  options: ChoosePlanOptions | undefined;
  autoSelected: boolean;
}): PlanConfirmationSource {
  if (options !== undefined && options.confirmationSource !== undefined) {
    return options.confirmationSource;
  }

  if (autoSelected === true) {
    return 'timeout';
  }

  return 'manual';
}

function getPlanImplementationBaseMessages({
  options,
  messagesRef,
}: {
  options: ChoosePlanOptions | undefined;
  messagesRef: MutableRefObject<WorkspaceChatMessage[]>;
}): WorkspaceChatMessage[] {
  if (options !== undefined && options.baseMessages !== undefined) {
    return options.baseMessages;
  }

  return messagesRef.current;
}

function updatePlanImplementationMessageSelection({
  message,
  plan,
  autoSelected,
}: {
  message: WorkspaceChatMessage;
  plan: Plan;
  autoSelected: boolean;
}): WorkspaceChatMessage {
  const isPlanOptionsMessage = message.kind === 'plan-options';
  if (isPlanOptionsMessage === false) {
    return message;
  }

  return {
    ...message,
    selectedPlanId: plan.id,
    autoSelected,
  };
}

function getPlanImplementationUpdatedPlanMessages({
  baseMessages,
  plan,
  autoSelected,
}: {
  baseMessages: WorkspaceChatMessage[];
  plan: Plan;
  autoSelected: boolean;
}): WorkspaceChatMessage[] {
  const updatedPlanMessages: WorkspaceChatMessage[] = [];
  for (const message of baseMessages) {
    updatedPlanMessages.push(updatePlanImplementationMessageSelection({
      message,
      plan,
      autoSelected,
    }));
  }

  return updatedPlanMessages;
}

async function prepareRuntimeForImplementation(
  projectId: string,
  context: PlanImplementationRuntimePreparationContext,
) {
  await context.ensureProjectRuntimeReady(projectId, {
    initialStage: '正在启动开发机容器...',
  });
}

export function prepareImplementationLaunch(
  plan: Plan,
  options: ChoosePlanOptions | undefined,
  messagesRef: MutableRefObject<WorkspaceChatMessage[]>,
): PreparedImplementationLaunch {
  const autoSelected = getPlanImplementationAutoSelected(options);
  const confirmationSource = getPlanImplementationConfirmationSource({
    options,
    autoSelected,
  });
  const baseMessages = getPlanImplementationBaseMessages({
    options,
    messagesRef,
  });
  const updatedPlanMessages = getPlanImplementationUpdatedPlanMessages({
    baseMessages,
    plan,
    autoSelected,
  });

  return {
    confirmationSource,
    updatedPlanMessages,
  };
}

export async function executePlanImplementation(
  plan: Plan,
  state: {
    confirmationSource: PlanConfirmationSource;
  },
  context: {
    buildImplementationPrompt: (plan: Plan) => string;
    createPersistedProject: (plan: Plan) => Promise<WorkspaceProjectInfo>;
    ensureProjectRuntimeReady: (projectId: string, options?: {
      initialStage?: string;
      waitStage?: string;
    }) => Promise<unknown>;
    handleLLMGenerate: (
      prompt: string,
      overrideProject?: WorkspaceProjectInfo,
      options?: GenerateOptions,
    ) => Promise<void>;
    isOnline: boolean;
    persistWorkspaceProject: (nextProject: WorkspaceProjectInfo) => void;
    projectInfo: WorkspaceProjectInfo;
    applyPlanImplementationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
    setProjectInfo: Dispatch<SetStateAction<WorkspaceProjectInfo | null>>;
  },
) {
  const targetProject = await prepareProjectForSelectedPlan(plan, {
    createPersistedProject: context.createPersistedProject,
    persistWorkspaceProject: context.persistWorkspaceProject,
    projectInfo: context.projectInfo,
    setProjectInfo: context.setProjectInfo,
  });

  const implementationMessageId = `assistant-${Date.now()}`;
  appendImplementationKickoffMessage(
    implementationMessageId,
    plan,
    state.confirmationSource,
    context.applyPlanImplementationMessages,
  );

  await prepareRuntimeForImplementation(targetProject.projectId, {
    ensureProjectRuntimeReady: context.ensureProjectRuntimeReady,
  });

  await context.handleLLMGenerate(context.buildImplementationPrompt(plan), targetProject, {
    mode: getPlanApprovedGenerationMode(),
    online: context.isOnline,
    conversationStage: WORKSPACE_PLAN_APPROVED_STAGE,
    planContext: buildImplementationPlanContext(plan, targetProject),
    visualContext: plan.visual_context,
    assistantMessageId: implementationMessageId,
  });
}
