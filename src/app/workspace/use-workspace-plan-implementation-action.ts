import { useCallback } from 'react';

import type { Plan } from '@/lib/api';
import type { WorkspaceEngineeringStateSnapshot } from '@/lib/workspace/engineering-state';
import { formatPlanImplementationLaunchFailure } from '@/lib/workspace/plan-implementation-errors';
import { getWorkspaceWorkflowStageDefaultModeOrFallback } from '@/lib/workspace/workflow-contract';

import {
  executePlanImplementation,
  prepareImplementationLaunch,
} from './workspace-plan-implementation';
import type { ChoosePlanOptions } from './workspace-orchestration-flow-types';
import { buildImplementationPrompt as buildImplementationPromptText } from './workspace-orchestration-support';
import type {
  PlanImplementationActionOptions,
  WorkspacePlanImplementationActionContract,
} from './workspace-orchestration-implementation-action-types';
import type {
  GuidanceAction,
  WorkspaceChatMessage,
  WorkspaceGenerationMode,
  WorkspaceProjectInfo,
} from './workspace-types';

const WORKSPACE_PLAN_IMPLEMENTATION_RETRY_STAGE = 'plan-approved';

function getPlanImplementationRetryMode(): WorkspaceGenerationMode {
  const defaultMode = getWorkspaceWorkflowStageDefaultModeOrFallback(
    WORKSPACE_PLAN_IMPLEMENTATION_RETRY_STAGE,
    'implement',
  );
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

function hasPlanImplementationProjectIdValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getPlanImplementationProject(projectInfo: WorkspaceProjectInfo | null): WorkspaceProjectInfo | null {
  if (projectInfo === null) {
    return null;
  }

  const hasProjectId = hasPlanImplementationProjectIdValue(projectInfo.projectId);
  if (hasProjectId === true) {
    return projectInfo;
  }

  return null;
}

function hasPlanImplementationSelectedPlan(selectedPlanId: string | null | undefined): selectedPlanId is string {
  return hasPlanImplementationProjectIdValue(selectedPlanId);
}

function isPlanImplementationInProgress(implementingPlan: boolean): boolean {
  return implementingPlan === true;
}

function shouldBlockPlanImplementationSelectedPlan({
  hasSelectedPlan,
  selectedPlanId,
  planId,
}: {
  hasSelectedPlan: boolean;
  selectedPlanId: string | null;
  planId: string;
}): boolean {
  if (hasSelectedPlan === false) {
    return false;
  }

  return selectedPlanId !== planId;
}

function getPlanImplementationAvailablePlans({
  availablePlans,
  plan,
}: {
  availablePlans: Plan[];
  plan: Plan;
}): Plan[] {
  const hasAvailablePlans = availablePlans.length > 0;
  if (hasAvailablePlans === true) {
    return availablePlans;
  }

  return [plan];
}

function buildPlanImplementationFailureState(
  plan: Plan,
  reasonMessage: string,
  retryPrompt: string,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'plan-approved',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '已批准方案',
      current_task: `按已批准计划「${plan.name}」进入实现失败`,
      completed_tasks: [`方案已确认：${plan.name}`],
      blockers: [reasonMessage],
      next_action: '修复项目保存、运行时准备或实现入口失败原因后，重新应用该方案或重新生成方案。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: true,
      pause_reason: 'plan_implementation_launch_failed',
      approval_boundary: 'plan_selection',
      approved_plan_id: plan.id,
      approved_plan_name: plan.name,
      current_task: `方案「${plan.name}」进入实现失败`,
      next_action: '修复失败原因后重新应用方案',
    },
    recovery: {
      blocked: true,
      reason_code: 'plan_implementation_launch_failed',
      reason_message: reasonMessage,
      resume_stage: 'plan-approved',
      resume_mode: 'implement',
      can_retry: true,
      retry_label: '重新应用该方案',
      retry_prompt: retryPrompt,
    },
  };
}

function shouldClearPlanImplementationSelection(message: WorkspaceChatMessage, planId: string): boolean {
  const isPlanOptionsMessage = message.kind === 'plan-options';
  if (isPlanOptionsMessage === false) {
    return false;
  }

  return message.selectedPlanId === planId;
}

function clearPlanImplementationSelection(messages: WorkspaceChatMessage[], planId: string): WorkspaceChatMessage[] {
  const clearedMessages: WorkspaceChatMessage[] = [];
  for (const message of messages) {
    const shouldClearSelection = shouldClearPlanImplementationSelection(message, planId);
    if (shouldClearSelection === true) {
      clearedMessages.push({
        ...message,
        selectedPlanId: undefined,
        autoSelected: false,
      });
      continue;
    }

    clearedMessages.push(message);
  }

  return clearedMessages;
}

function buildPlanImplementationFailureActions(retryPrompt: string): GuidanceAction[] {
  return [
    {
      label: '重新应用该方案',
      kind: 'retry_workflow_gate',
      prompt: retryPrompt,
      mode: getPlanImplementationRetryMode(),
      conversationStage: WORKSPACE_PLAN_IMPLEMENTATION_RETRY_STAGE,
    },
    {
      label: '重新生成方案',
      kind: 'retry_plan_generation',
    },
  ];
}

export function useWorkspacePlanImplementationAction({
  projectInfo,
  isOnline,
  availablePlans,
  recommendedPlanId,
  selectedPlanId,
  messagesRef,
  implementingPlanRef,
  autoPlanTriggeredRef,
  setProjectInfo,
  applyPlanImplementationMessages,
  applyWorkspaceState,
  ensureProjectRuntimeReady,
  createPersistedProject,
  persistWorkspaceProject,
  handleLLMGenerate,
  updatePlanFlowState,
}: PlanImplementationActionOptions): WorkspacePlanImplementationActionContract {
  const buildImplementationPrompt = useCallback(
    (plan: Plan) => buildImplementationPromptText(plan, projectInfo),
    [projectInfo],
  );

  return useCallback(async (
    plan: Plan,
    options?: ChoosePlanOptions,
  ) => {
    const effectiveProject = getPlanImplementationProject(projectInfo);
    if (effectiveProject === null) return;
    const implementationInProgress = isPlanImplementationInProgress(implementingPlanRef.current);
    if (implementationInProgress === true) return;
    const hasSelectedPlan = hasPlanImplementationSelectedPlan(selectedPlanId);
    const shouldBlockSelectedPlan = shouldBlockPlanImplementationSelectedPlan({
      hasSelectedPlan,
      selectedPlanId,
      planId: plan.id,
    });
    if (shouldBlockSelectedPlan === true) return;
    implementingPlanRef.current = true;
    autoPlanTriggeredRef.current = true;

    const launch = prepareImplementationLaunch(plan, options, messagesRef);

    applyWorkspaceState(launch.updatedPlanMessages, {
      availablePlans: getPlanImplementationAvailablePlans({
        availablePlans,
        plan,
      }),
      recommendedPlanId,
      selectedPlanId: plan.id,
      planCountdown: 0,
      planAutoConfirmDeadlineAt: null,
    });

    try {
      await executePlanImplementation(plan, {
        confirmationSource: launch.confirmationSource,
      }, {
        buildImplementationPrompt,
        createPersistedProject,
        ensureProjectRuntimeReady,
        handleLLMGenerate,
        isOnline,
        persistWorkspaceProject,
        projectInfo: effectiveProject,
        applyPlanImplementationMessages,
        setProjectInfo,
      });
    } catch (error) {
      console.error('应用方案失败:', error);
      const failureMessage = formatPlanImplementationLaunchFailure(error);
      const retryPrompt = buildImplementationPrompt(plan);
      autoPlanTriggeredRef.current = true;
      updatePlanFlowState({
        selectedPlanId: null,
        planCountdown: -1,
        planAutoConfirmDeadlineAt: null,
      });
      applyPlanImplementationMessages((prev) => [
        ...clearPlanImplementationSelection(prev, plan.id),
        {
          id: `plan-error-${Date.now()}`,
          role: 'assistant',
          kind: 'workflow',
          content: `应用方案失败：${failureMessage}。当前方案没有可靠进入实现阶段；请修复项目保存、运行时准备或实现入口问题后重试。`,
          statusContent: '方案确认进入实现失败',
          engineeringState: buildPlanImplementationFailureState(plan, failureMessage, retryPrompt),
          suggestedActions: buildPlanImplementationFailureActions(retryPrompt),
          timestamp: new Date(),
        },
      ]);
    } finally {
      implementingPlanRef.current = false;
    }
  }, [
    applyWorkspaceState,
    autoPlanTriggeredRef,
    availablePlans,
    buildImplementationPrompt,
    createPersistedProject,
    ensureProjectRuntimeReady,
    handleLLMGenerate,
    implementingPlanRef,
    isOnline,
    messagesRef,
    persistWorkspaceProject,
    projectInfo,
    recommendedPlanId,
    selectedPlanId,
    applyPlanImplementationMessages,
    setProjectInfo,
    updatePlanFlowState,
  ]);
}
