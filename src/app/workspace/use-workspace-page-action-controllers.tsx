'use client';

import { useEffect, useRef } from 'react';

import { useWorkspacePageAiActions } from './use-workspace-page-ai-actions';
import type { WorkspacePageAiRuntimeResources } from './use-workspace-page-ai-actions';
import { useWorkspacePageProjectActions } from './use-workspace-page-project-actions';
import type {
  WorkspacePageProjectActionsRuntimeResources,
  WorkspacePageProjectActionsShellState,
} from './use-workspace-page-project-actions';
import type {
  WorkspaceFlowStateContract,
  WorkspaceRuntimeRecoveryMessagesAction,
} from './workspace-flow-state-contract';
import type { WorkspacePageActionControllersContract } from './workspace-page-action-controllers-contract';
import type { WorkspacePageLocalStateContract } from './workspace-page-local-state-contract';
import { getWorkspacePlanAutoConfirmRemainingSeconds } from './workspace-plan-flow-state';
import type { WorkspacePlanGenerationProjectIdSet } from './workspace-plan-generation-types';
import type { PersistGenerationState, WorkspaceChatMessage, WorkspaceProjectInfo } from './workspace-types';
import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceRuntimeRecoveryStatus,
} from '@/lib/workspace/engineering-state';
import type { Plan } from '@/lib/api';
import type { GitBranchCompare } from '@/lib/types';
import { formatWorkspaceRuntimeResourceFailure } from '@/lib/workspace/workspace-runtime-resource-errors';

type LocalState = WorkspacePageLocalStateContract;
type FlowState = WorkspaceFlowStateContract;

export type WorkspacePageActionControllersShellState = WorkspacePageProjectActionsShellState;

export type WorkspacePageActionControllersRuntimeResources =
  WorkspacePageProjectActionsRuntimeResources
  & WorkspacePageAiRuntimeResources
  & {
    refreshProjectBranchCompareTarget: (
      projectId: string,
      targetBranch: string,
    ) => Promise<GitBranchCompare | null>;
  };

type UseWorkspacePageActionControllersOptions = {
  localState: LocalState;
  flowState: FlowState;
  shellState: WorkspacePageActionControllersShellState;
  runtimeResources: WorkspacePageActionControllersRuntimeResources;
  persistGenerationState: PersistGenerationState;
  requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
  plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
};

type WorkspacePageActionControllerFailureMessageList = string[];
type WorkspacePageActionControllerMessageList = WorkspaceChatMessage[];

function getWorkspacePageActionControllerMessageIndex(
  messages: WorkspaceChatMessage[],
  messageId: string,
): number {
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const isTargetMessage = message.id === messageId;
    if (isTargetMessage === true) {
      return index;
    }
  }

  return -1;
}

function materializeWorkspacePageActionControllerUpsertedMessages(
  messages: WorkspaceChatMessage[],
  nextMessage: WorkspaceChatMessage,
): WorkspacePageActionControllerMessageList {
  const nextMessages: WorkspacePageActionControllerMessageList = [];
  const existingIndex = getWorkspacePageActionControllerMessageIndex(messages, nextMessage.id);

  for (let index = 0; index < messages.length; index += 1) {
    const shouldSkipExistingMessage = index === existingIndex;
    if (shouldSkipExistingMessage === true) {
      continue;
    }

    nextMessages.push(messages[index]);
  }

  nextMessages.push(nextMessage);
  return nextMessages;
}

function shouldUseWorkspacePageActionControllerMobileIdeView(isMobile: boolean): boolean {
  const shouldUseMobileIdeView = isMobile === true;
  return shouldUseMobileIdeView === true;
}

function hasWorkspacePageActionControllerTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getWorkspacePageActionControllerFallbackMessage(
  value: string | null | undefined,
  fallback: string,
): string {
  const hasValue = hasWorkspacePageActionControllerTextValue(value);
  if (hasValue === true) {
    return value;
  }

  return fallback;
}

function getWorkspacePageActionControllerPersistedProject(
  projectInfo: WorkspaceProjectInfo | null,
): WorkspaceProjectInfo | null {
  if (projectInfo === null) {
    return null;
  }

  const isPersistedProject = projectInfo.isPersisted === true;
  if (isPersistedProject === false) {
    return null;
  }

  const hasProjectId = hasWorkspacePageActionControllerTextValue(projectInfo.projectId);
  if (hasProjectId === false) {
    return null;
  }

  return projectInfo;
}

function hasWorkspacePageActionControllerProjectPlan(projectInfo: WorkspaceProjectInfo): boolean {
  const hasPlanId = hasWorkspacePageActionControllerTextValue(projectInfo.planId);
  if (hasPlanId === true) {
    return true;
  }

  const hasPlanData = hasWorkspacePageActionControllerTextValue(projectInfo.planData);
  return hasPlanData === true;
}

function shouldAutoRequestWorkspacePlan({
  projectInfo,
  availablePlanCount,
  isPlanning,
  isGenerating,
  requestedProjectId,
}: {
  projectInfo: WorkspaceProjectInfo | null;
  availablePlanCount: number;
  isPlanning: boolean;
  isGenerating: boolean;
  requestedProjectId: string | null;
}): boolean {
  const persistedProject = getWorkspacePageActionControllerPersistedProject(projectInfo);
  if (persistedProject === null) {
    return false;
  }

  const hasProjectPlan = hasWorkspacePageActionControllerProjectPlan(persistedProject);
  if (hasProjectPlan === true) {
    return false;
  }

  const hasAvailablePlans = availablePlanCount > 0;
  if (hasAvailablePlans === true) {
    return false;
  }

  if (isPlanning === true || isGenerating === true) {
    return false;
  }

  const hasRequestedProject = requestedProjectId === persistedProject.projectId;
  return hasRequestedProject === false;
}

function getWorkspacePageActionControllerRecommendedPlan({
  availablePlans,
  recommendedPlanId,
}: {
  availablePlans: Plan[];
  recommendedPlanId: string | null;
}): Plan | null {
  if (recommendedPlanId === null) {
    return null;
  }

  for (const plan of availablePlans) {
    const isRecommendedPlan = plan.id === recommendedPlanId;
    if (isRecommendedPlan === true) {
      return plan;
    }
  }

  return null;
}

function shouldRunWorkspacePlanAutoConfirmCountdown({
  availablePlanCount,
  selectedPlanId,
  planAutoConfirmDeadlineAt,
  planSelectionReady,
  isPlanning,
  isGenerating,
}: {
  availablePlanCount: number;
  selectedPlanId: string | null;
  planAutoConfirmDeadlineAt: string | null;
  planSelectionReady: boolean;
  isPlanning: boolean;
  isGenerating: boolean;
}): boolean {
  if (planSelectionReady === false) {
    return false;
  }

  const hasAvailablePlans = availablePlanCount > 0;
  if (hasAvailablePlans === false) {
    return false;
  }

  if (selectedPlanId !== null) {
    return false;
  }

  if (isPlanning === true || isGenerating === true) {
    return false;
  }

  const remainingSeconds = getWorkspacePlanAutoConfirmRemainingSeconds(planAutoConfirmDeadlineAt);
  if (remainingSeconds === null) {
    return false;
  }

  return remainingSeconds > 0;
}

function shouldAutoConfirmWorkspaceRecommendedPlan({
  recommendedPlan,
  selectedPlanId,
  planCountdown,
  planAutoConfirmDeadlineAt,
  planSelectionReady,
  isPlanning,
  isGenerating,
  autoConfirmingPlanId,
}: {
  recommendedPlan: Plan | null;
  selectedPlanId: string | null;
  planCountdown: number;
  planAutoConfirmDeadlineAt: string | null;
  planSelectionReady: boolean;
  isPlanning: boolean;
  isGenerating: boolean;
  autoConfirmingPlanId: string | null;
}): boolean {
  if (planSelectionReady === false) {
    return false;
  }

  if (recommendedPlan === null) {
    return false;
  }

  if (selectedPlanId !== null) {
    return false;
  }

  if (isPlanning === true || isGenerating === true) {
    return false;
  }

  const remainingSeconds = getWorkspacePlanAutoConfirmRemainingSeconds(planAutoConfirmDeadlineAt);
  const hasLiveDeadline = remainingSeconds !== null;
  if (hasLiveDeadline === true && remainingSeconds > 0) {
    return false;
  }

  if (hasLiveDeadline === false && planCountdown > 0) {
    return false;
  }

  const isAutoConfirmingPlan = autoConfirmingPlanId === recommendedPlan.id;
  return isAutoConfirmingPlan === false;
}

function getWorkspacePageActionControllerRecoveryProjectId(
  recoveryProjectId: string | null,
): string | null {
  const hasRecoveryProjectId = hasWorkspacePageActionControllerTextValue(recoveryProjectId);
  if (hasRecoveryProjectId === true) {
    return recoveryProjectId;
  }

  return null;
}

function materializeWorkspacePageActionControllerRejectedResults(
  results: PromiseSettledResult<unknown>[],
): PromiseRejectedResult[] {
  const rejectedResults: PromiseRejectedResult[] = [];

  for (const result of results) {
    const isRejectedResult = result.status === 'rejected';
    if (isRejectedResult === true) {
      rejectedResults.push(result);
    }
  }

  return rejectedResults;
}

function getWorkspacePageActionControllerFailureMessages(
  failures: PromiseRejectedResult[],
): WorkspacePageActionControllerFailureMessageList {
  const failureMessages: WorkspacePageActionControllerFailureMessageList = [];

  for (const failure of failures) {
    const failureMessage = formatWorkspaceRuntimeResourceFailure(failure.reason);
    const hasFailureMessage = hasWorkspacePageActionControllerTextValue(failureMessage);
    if (hasFailureMessage === true) {
      failureMessages.push(failureMessage);
    }
  }

  return failureMessages;
}

function getWorkspacePageActionControllerFailureMessage(
  failures: PromiseRejectedResult[],
  fallback: string,
): string {
  const failureMessages = getWorkspacePageActionControllerFailureMessages(failures);
  const joinedFailureMessage = failureMessages.join('；');
  return getWorkspacePageActionControllerFallbackMessage(joinedFailureMessage, fallback);
}

function getWorkspacePageActionControllerRuntimeFailureMessage(error: unknown): string {
  const failureMessage = formatWorkspaceRuntimeResourceFailure(error);
  return getWorkspacePageActionControllerFallbackMessage(failureMessage, '未知错误');
}

function getWorkspacePageActionControllerReasonMessage(reasonMessage: string | null | undefined): string | null {
  const hasReasonMessage = hasWorkspacePageActionControllerTextValue(reasonMessage);
  if (hasReasonMessage === true) {
    return reasonMessage;
  }

  return null;
}

function buildRuntimeRecoveryState(
  status: WorkspaceRuntimeRecoveryStatus,
  reasonMessage?: string,
): WorkspaceEngineeringStateSnapshot {
  const normalizedReasonMessage = getWorkspacePageActionControllerReasonMessage(reasonMessage);
  const failureReasonMessage = getWorkspacePageActionControllerFallbackMessage(
    normalizedReasonMessage,
    '运行时恢复失败',
  );
  const currentTask = status === 'passed'
    ? 'Workspace Runtime Health 显式恢复完成'
    : status === 'running'
      ? 'Workspace Runtime Health 显式恢复进行中'
      : 'Workspace Runtime Health 显式恢复失败';
  const nextAction = status === 'passed'
    ? '继续使用 Preview、Explorer 与 Git 面板；运行时状态已通过受控 start 容器入口恢复。'
    : status === 'running'
      ? '等待当前恢复链路完成；重复恢复请求已被控制器防重入拦截。'
      : '查看 Runtime Health 的失败原因，修复容器、依赖或后端 API 问题后再次点击恢复运行时。';

  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status,
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: currentTask,
      completed_tasks: status === 'passed'
        ? ['已触发显式运行时恢复', '已等待 runtime-status 进入 ready', '已刷新 Workspace 后端真源']
        : status === 'running'
          ? ['已接收显式运行时恢复请求', '已进入受控 start/wait 链路']
          : ['已触发显式运行时恢复', '恢复链路返回失败'],
      blockers: normalizedReasonMessage !== null ? [normalizedReasonMessage] : [],
      next_action: nextAction,
      status: status,
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: currentTask,
      next_action: nextAction,
    },
    recovery: status === 'running' ? undefined : {
      blocked: status === 'failed',
      reason_code: status === 'passed'
        ? 'runtime_health_recovery_completed'
        : 'runtime_health_recovery_failed',
      reason_message: status === 'passed'
        ? '运行时已通过显式恢复入口重新进入 ready。'
        : `${failureReasonMessage}。`,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: status === 'failed',
      retry_label: status === 'failed' ? '恢复运行时' : undefined,
      retry_prompt: status === 'failed'
        ? '请重新触发 Runtime Health 的恢复运行时动作。'
        : undefined,
    },
  };
}

function appendRuntimeRecoveryMessage(
  applyRuntimeRecoveryMessages: WorkspaceRuntimeRecoveryMessagesAction,
  message: WorkspaceChatMessage,
) {
  applyRuntimeRecoveryMessages((prev) => [...prev, message]);
}

export function useWorkspacePageActionControllers({
  localState,
  flowState,
  shellState,
  runtimeResources,
  persistGenerationState,
  requestedPlanProjectsAcrossMounts,
  plannedProjectIdsAcrossMounts,
}: UseWorkspacePageActionControllersOptions): WorkspacePageActionControllersContract {
  const recoveringRuntimeProjectRef = useRef<string | null>(null);
  const autoPlanRequestedProjectRef = useRef<string | null>(null);
  const autoConfirmingPlanRef = useRef<string | null>(null);
  const projectActions = useWorkspacePageProjectActions({
    localState,
    flowState: {
      applyProjectPanelRefreshMessages: flowState.applyProjectPanelRefreshMessages,
      applyIdeInteractionMessages: flowState.applyIdeInteractionMessages,
      applyResourceFileMessages: flowState.applyResourceFileMessages,
      applyResourceGitMessages: flowState.applyResourceGitMessages,
    },
    shellState,
    runtimeResources: {
      fetchProjectDetail: runtimeResources.fetchProjectDetail,
      fetchRuntimeStatusSnapshot: runtimeResources.fetchRuntimeStatusSnapshot,
      refreshProjectFileTree: runtimeResources.refreshProjectFileTree,
      fetchProjectBranches: runtimeResources.fetchProjectBranches,
      fetchProjectRemotes: runtimeResources.fetchProjectRemotes,
      fetchProjectRemoteBranches: runtimeResources.fetchProjectRemoteBranches,
      fetchProjectTags: runtimeResources.fetchProjectTags,
      fetchProjectStashes: runtimeResources.fetchProjectStashes,
      fetchProjectWorktreeStatus: runtimeResources.fetchProjectWorktreeStatus,
      fetchProjectCommits: runtimeResources.fetchProjectCommits,
    },
  });

  const aiActions = useWorkspacePageAiActions({
    localState,
    flowState,
    shellState: {
      setMobileView: shellState.setMobileView,
    },
    runtimeResources,
    persistGenerationState,
    projectActions: {
      reflectFilePathInTree: projectActions.reflectFilePathInTree,
      applyIncrementalWorkflowStep: projectActions.applyIncrementalWorkflowStep,
      openWorkspaceFile: projectActions.openWorkspaceFile,
      openExplorerPanel: projectActions.openExplorerPanel,
      refreshExplorerPanel: projectActions.refreshExplorerPanel,
    },
    requestedPlanProjectsAcrossMounts,
    plannedProjectIdsAcrossMounts,
  });

  useEffect(() => {
    const shouldRequestPlan = shouldAutoRequestWorkspacePlan({
      projectInfo: localState.projectInfo,
      availablePlanCount: flowState.availablePlans.length,
      isPlanning: localState.isPlanning,
      isGenerating: localState.isGenerating,
      requestedProjectId: autoPlanRequestedProjectRef.current,
    });
    if (shouldRequestPlan === false) {
      return;
    }

    const project = getWorkspacePageActionControllerPersistedProject(localState.projectInfo);
    if (project === null) {
      return;
    }
    autoPlanRequestedProjectRef.current = project.projectId;
    void aiActions.requestPlansForProject({
      baseMessages: flowState.messagesRef.current,
    });
  }, [
    aiActions,
    flowState.availablePlans.length,
    flowState.messagesRef,
    localState.isGenerating,
    localState.isPlanning,
    localState.projectInfo,
  ]);

  useEffect(() => {
    const shouldRunCountdown = shouldRunWorkspacePlanAutoConfirmCountdown({
      availablePlanCount: flowState.availablePlans.length,
      selectedPlanId: flowState.selectedPlanId,
      planAutoConfirmDeadlineAt: flowState.planAutoConfirmDeadlineAt,
      planSelectionReady: flowState.planSelectionReady,
      isPlanning: localState.isPlanning,
      isGenerating: localState.isGenerating,
    });
    if (shouldRunCountdown === false) {
      return;
    }

    autoConfirmingPlanRef.current = null;
    const syncRemainingCountdown = () => {
      const remainingSeconds = getWorkspacePlanAutoConfirmRemainingSeconds(flowState.planAutoConfirmDeadlineAt);
      if (remainingSeconds === null) {
        return;
      }

      flowState.setPlanCountdown(remainingSeconds);
    };
    syncRemainingCountdown();
    const timer = window.setInterval(() => {
      const remainingSeconds = getWorkspacePlanAutoConfirmRemainingSeconds(flowState.planAutoConfirmDeadlineAt);
      if (remainingSeconds === null) {
        window.clearInterval(timer);
        return;
      }

      flowState.setPlanCountdown(remainingSeconds);
      if (remainingSeconds <= 0) {
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    flowState.availablePlans.length,
    flowState.planAutoConfirmDeadlineAt,
    flowState.planSelectionReady,
    flowState.selectedPlanId,
    flowState.setPlanCountdown,
    localState.isGenerating,
    localState.isPlanning,
  ]);

  useEffect(() => {
    const recommendedPlan = getWorkspacePageActionControllerRecommendedPlan({
      availablePlans: flowState.availablePlans,
      recommendedPlanId: flowState.recommendedPlanId,
    });
    const shouldConfirmPlan = shouldAutoConfirmWorkspaceRecommendedPlan({
      recommendedPlan,
      selectedPlanId: flowState.selectedPlanId,
      planCountdown: flowState.planCountdown,
      planAutoConfirmDeadlineAt: flowState.planAutoConfirmDeadlineAt,
      planSelectionReady: flowState.planSelectionReady,
      isPlanning: localState.isPlanning,
      isGenerating: localState.isGenerating,
      autoConfirmingPlanId: autoConfirmingPlanRef.current,
    });
    if (shouldConfirmPlan === false) {
      return;
    }

    if (recommendedPlan === null) {
      return;
    }

    autoConfirmingPlanRef.current = recommendedPlan.id;
    void aiActions.choosePlanAndImplement(recommendedPlan, {
      autoSelected: true,
      baseMessages: flowState.messagesRef.current,
      confirmationSource: 'timeout',
    });
  }, [
    aiActions,
    flowState.availablePlans,
    flowState.messagesRef,
    flowState.planAutoConfirmDeadlineAt,
    flowState.planCountdown,
    flowState.planSelectionReady,
    flowState.recommendedPlanId,
    flowState.selectedPlanId,
    localState.isGenerating,
    localState.isPlanning,
  ]);

  const handleSelectGitBranchCompareTarget = async (targetBranch: string) => {
    const persistedProject = getWorkspacePageActionControllerPersistedProject(localState.projectInfo);
    if (persistedProject === null) {
      return;
    }

    const projectId = persistedProject.projectId;
    await runtimeResources.refreshProjectBranchCompareTarget(projectId, targetBranch);
  };

  const handleRecoverRuntime = async () => {
    const persistedProject = getWorkspacePageActionControllerPersistedProject(localState.projectInfo);
    if (persistedProject === null) {
      const failureMessage = '当前项目尚未持久化，无法通过后端 start 容器入口恢复运行时。';
      appendRuntimeRecoveryMessage(flowState.applyRuntimeRecoveryMessages, {
        id: `runtime-recovery-unavailable-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `Runtime Health 恢复暂不可用：${failureMessage}`,
        statusContent: 'Runtime 恢复暂不可用',
        engineeringState: buildRuntimeRecoveryState('failed', failureMessage),
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const projectId = persistedProject.projectId;

    const recoveryProjectId = getWorkspacePageActionControllerRecoveryProjectId(recoveringRuntimeProjectRef.current);
    if (recoveryProjectId !== null) {
      const messageId = `runtime-recovery-in-progress-${recoveryProjectId}`;
      const nextMessage: WorkspaceChatMessage = {
        id: messageId,
        role: 'assistant',
        kind: 'workflow',
        content: 'Runtime Health 恢复已在进行中：控制器已拦截重复恢复请求，避免并发触发多条 start/wait 链路。',
        statusContent: 'Runtime 恢复进行中',
        engineeringState: buildRuntimeRecoveryState('running'),
        timestamp: new Date().toISOString(),
      };
      flowState.applyRuntimeRecoveryMessages((prev) => (
        materializeWorkspacePageActionControllerUpsertedMessages(prev, nextMessage)
      ));
      return;
    }

    recoveringRuntimeProjectRef.current = projectId;
    localState.setActiveTab('preview');
    const shouldUseMobileIdeView = shouldUseWorkspacePageActionControllerMobileIdeView(shellState.isMobile);
    if (shouldUseMobileIdeView === true) {
      shellState.setMobileView('ide');
    }

    try {
      await runtimeResources.ensureProjectRuntimeReady(projectId, {
        initialStage: '正在恢复开发运行时...',
        waitStage: '正在等待运行时就绪...',
      });
      const refreshResults = await Promise.allSettled([
        runtimeResources.fetchProjectDetail(projectId),
        runtimeResources.refreshProjectFileTree(projectId, true, {
          suppressNotice: true,
        }),
        runtimeResources.fetchProjectBranches(projectId, undefined, {
          suppressNotice: true,
        }),
        runtimeResources.fetchProjectRemotes(projectId, {
          suppressNotice: true,
        }),
        runtimeResources.fetchProjectRemoteBranches(projectId, {
          suppressNotice: true,
        }),
        runtimeResources.fetchProjectTags(projectId, {
          suppressNotice: true,
        }),
        runtimeResources.fetchProjectStashes(projectId, {
          suppressNotice: true,
        }),
        runtimeResources.fetchProjectWorktreeStatus(projectId, {
          suppressNotice: true,
        }),
        runtimeResources.fetchProjectCommits(projectId, {
          suppressNotice: true,
        }),
      ]);
      const refreshFailures = materializeWorkspacePageActionControllerRejectedResults(refreshResults);
      if (refreshFailures.length > 0) {
        const failureMessage = getWorkspacePageActionControllerFailureMessage(
          refreshFailures,
          '后置真源刷新失败',
        );
        appendRuntimeRecoveryMessage(flowState.applyRuntimeRecoveryMessages, {
          id: `runtime-recovery-refresh-partial-${Date.now()}`,
          role: 'assistant',
          kind: 'workflow',
          content: `Runtime Health 已恢复运行时，但后置真源刷新存在失败资源：${failureMessage}。Preview 可继续基于 ready runtime 使用，Explorer 或 Git 面板可能仍显示旧快照；请手动刷新对应面板确认最新真源。`,
          statusContent: 'Runtime 已恢复，真源刷新不完整',
          engineeringState: buildRuntimeRecoveryState('failed', `运行时已恢复；后置真源刷新失败：${failureMessage}`),
          timestamp: new Date().toISOString(),
        });
        return;
      }
      appendRuntimeRecoveryMessage(flowState.applyRuntimeRecoveryMessages, {
        id: `runtime-recovery-completed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: 'Runtime Health 已显式恢复：Workspace 复用受控 start 容器入口等待 runtime-status 进入 ready，并已刷新项目详情、Explorer 与 Git 只读真源。',
        statusContent: 'Runtime 已恢复',
        engineeringState: buildRuntimeRecoveryState('passed'),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const failureMessage = getWorkspacePageActionControllerRuntimeFailureMessage(error);
      appendRuntimeRecoveryMessage(flowState.applyRuntimeRecoveryMessages, {
        id: `runtime-recovery-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `Runtime Health 恢复失败：${failureMessage}。恢复动作已停止，未绕过既有 start 容器与 runtime-status readiness 合约。`,
        statusContent: 'Runtime 恢复失败',
        engineeringState: buildRuntimeRecoveryState('failed', failureMessage),
        timestamp: new Date().toISOString(),
      });
    } finally {
      if (recoveringRuntimeProjectRef.current === projectId) {
        recoveringRuntimeProjectRef.current = null;
      }
    }
  };

  return {
    ...projectActions,
    ...aiActions,
    handleSelectGitBranchCompareTarget,
    handleRecoverRuntime,
    pendingCloseFile: localState.pendingCloseFile,
    setPendingCloseFile: localState.setPendingCloseFile,
    gitCommits: localState.gitCommits,
    openFiles: localState.openFiles,
  };
}
