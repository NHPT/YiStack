import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type {
  WorkspaceBootstrapState,
  WorkspaceEngineeringStateSnapshot,
  WorkspaceExecutionState,
  WorkspaceRecoveryState,
} from '@/lib/workspace/engineering-state';
import { formatPlanGenerationFailure } from '@/lib/workspace/plan-generation-errors';
import { isWorkspaceBackendWorkflowStage } from '@/lib/workspace/workflow-contract';

import type { GuidanceAction, WorkspaceChatMessage, WorkspaceProjectInfo } from './workspace-types';
import type {
  PlanRequestOptions,
  PlanRequestTerminalMessageKind,
  PlanGenerationAvailablePlans,
  PlanGenerationMessagesRef,
  PreparedPlanGenerationRequest,
  WorkspacePlanGenerationProjectIdSet,
  WorkspacePlanGenerationProjectIdSetRef,
} from './workspace-plan-generation-types';

type PlanGenerationLifecycleMessageList = WorkspaceChatMessage[];

function isPlanGenerationLifecyclePlanRequestTerminalMessage(
  message: WorkspaceChatMessage,
): boolean {
  const isPlanRequestErrorMessage = message.id.startsWith('plan-request-error-');
  if (isPlanRequestErrorMessage === true) {
    return true;
  }

  const isPlanRequestAbortedMessage = message.id.startsWith('plan-request-aborted-');
  return isPlanRequestAbortedMessage === true;
}

function materializePlanRequestTerminalMessages(
  messages: WorkspaceChatMessage[],
  planMessageId: string,
  terminalMessage: WorkspaceChatMessage,
): PlanGenerationLifecycleMessageList {
  const nextMessages: PlanGenerationLifecycleMessageList = [];

  for (const message of messages) {
    const isPlanMessage = message.id === planMessageId;
    if (isPlanMessage === true) {
      continue;
    }

    nextMessages.push(message);
  }

  nextMessages.push(terminalMessage);
  return nextMessages;
}

function materializePlanGenerationLifecycleBaseMessages(
  messages: WorkspaceChatMessage[],
): PlanGenerationLifecycleMessageList {
  const nextMessages: PlanGenerationLifecycleMessageList = [];

  for (const message of messages) {
    const isPlanRequestTerminalMessage = isPlanGenerationLifecyclePlanRequestTerminalMessage(message);
    if (isPlanRequestTerminalMessage === true) {
      continue;
    }

    nextMessages.push(message);
  }

  return nextMessages;
}

function appendPlanRequestTerminalMessage(
  context: {
    planMessageId: string;
    applyPlanGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  },
  payload: {
    kind: PlanRequestTerminalMessageKind;
    message: string;
    suggestedActions?: GuidanceAction[];
    engineeringState?: WorkspaceEngineeringStateSnapshot;
  },
) {
  context.applyPlanGenerationMessages((prev) => {
    const terminalMessage: WorkspaceChatMessage = {
      id: `plan-request-${payload.kind}-${Date.now()}`,
      role: 'assistant',
      content: payload.message,
      timestamp: new Date(),
      suggestedActions: payload.suggestedActions,
      engineeringState: payload.engineeringState,
    };
    return materializePlanRequestTerminalMessages(
      prev,
      context.planMessageId,
      terminalMessage,
    );
  });
}

function buildPlanGenerationFailureEngineeringState(error: unknown): WorkspaceEngineeringStateSnapshot {
  const reason = formatPlanGenerationFailure(error);
  return {
    workflow: {
      stage: 'plan-analysis',
      mode: 'plan',
      status: 'failed',
    },
    plan_selection: {
      status: 'failed',
      ready: false,
    },
    validation: {
      status: 'not_applicable',
      failure_items: [],
    },
    phase: {
      current_phase: '方案分析',
      current_task: '生成技术方案失败',
      completed_tasks: [],
      blockers: [reason],
      next_action: '请稍后重试，或切换可用模型后重新生成技术方案。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      pause_reason: 'plan_generation_failed',
      approval_boundary: 'plan_generation',
      current_task: '生成技术方案失败',
      next_action: '重新生成方案，或在模型配置中切换到可用模型。',
    },
    recovery: {
      blocked: true,
      reason_code: 'plan_generation_failed',
      reason_message: reason,
      resume_stage: 'plan-analysis',
      resume_mode: 'plan',
      can_retry: true,
      retry_label: '重新生成方案',
      retry_prompt: '请重新生成技术方案。',
    },
  };
}

function getPlanGenerationLifecycleTextValue(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return value.trim();
}

function hasPlanGenerationLifecycleTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function hasPlanGenerationLifecycleProjectIdSetRef(
  ref: WorkspacePlanGenerationProjectIdSetRef | undefined,
): ref is WorkspacePlanGenerationProjectIdSetRef {
  const hasRef = ref !== undefined;
  return hasRef === true;
}

function hasPlanGenerationLifecycleProjectIdSet(
  set: WorkspacePlanGenerationProjectIdSet | undefined,
): set is WorkspacePlanGenerationProjectIdSet {
  const hasSet = set !== undefined;
  return hasSet === true;
}

function hasPlanGenerationLifecycleAutoPlanTriggeredRef(
  ref: MutableRefObject<boolean> | undefined,
): ref is MutableRefObject<boolean> {
  const hasRef = ref !== undefined;
  return hasRef === true;
}

function hasPlanGenerationLifecyclePlanningAbortRef(
  ref: MutableRefObject<AbortController | null> | undefined,
): ref is MutableRefObject<AbortController | null> {
  const hasRef = ref !== undefined;
  return hasRef === true;
}

function hasPlanGenerationLifecycleSetIsPlanningAction(
  action: Dispatch<SetStateAction<boolean>> | undefined,
): action is Dispatch<SetStateAction<boolean>> {
  const hasAction = action !== undefined;
  return hasAction === true;
}

function getPlanGenerationLifecycleRecoveryState(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): WorkspaceRecoveryState | undefined {
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.recovery;
}

function getPlanGenerationLifecycleExecutionState(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): WorkspaceExecutionState | undefined {
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.execution;
}

function getPlanGenerationLifecycleBootstrapState(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): WorkspaceBootstrapState | undefined {
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.bootstrap_state;
}

function hasPlanGenerationLifecycleRecoveryRetry(recovery: WorkspaceRecoveryState | undefined): boolean {
  if (recovery === undefined) {
    return false;
  }

  return recovery.can_retry === true;
}

function getPlanGenerationLifecycleRetryPrompt(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getPlanGenerationLifecycleTextValue(recovery.retry_prompt);
}

function getPlanGenerationLifecycleRetryLabel(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getPlanGenerationLifecycleTextValue(recovery.retry_label);
}

function getPlanGenerationLifecycleResumeStage(recovery: WorkspaceRecoveryState | undefined): string | undefined {
  if (recovery === undefined) {
    return undefined;
  }

  return recovery.resume_stage;
}

function getPlanGenerationLifecycleRecoveryReasonMessage(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getPlanGenerationLifecycleTextValue(recovery.reason_message);
}

function getPlanGenerationLifecycleExecutionNextAction(
  execution: WorkspaceExecutionState | undefined,
): string {
  if (execution === undefined) {
    return '';
  }

  return getPlanGenerationLifecycleTextValue(execution.next_action);
}

function getPlanGenerationLifecycleBootstrapNextAction(
  bootstrapState: WorkspaceBootstrapState | undefined,
): string {
  if (bootstrapState === undefined) {
    return '';
  }

  return getPlanGenerationLifecycleTextValue(bootstrapState.next_action);
}

function getPlanGenerationLifecycleUserFeedback(options: PlanRequestOptions | undefined): string {
  if (options === undefined) {
    return '';
  }

  return getPlanGenerationLifecycleTextValue(options.userFeedback);
}

function getPlanFoundationGateEngineeringState(error: unknown): WorkspaceEngineeringStateSnapshot | undefined {
  const hasErrorObject = error !== null && typeof error === 'object';
  if (hasErrorObject === false) {
    return undefined;
  }
  const engineeringState = (error as { engineeringState?: WorkspaceEngineeringStateSnapshot }).engineeringState;
  const hasFoundationGateRecoveryReason = engineeringState?.recovery?.reason_code === 'foundation_gate_blocked';
  const hasFoundationGatePauseReason = engineeringState?.execution?.pause_reason === 'foundation_gate_blocked';
  const hasFoundationGateState = hasFoundationGateRecoveryReason === true || hasFoundationGatePauseReason === true;
  if (hasFoundationGateState === true) {
    return engineeringState;
  }
  return undefined;
}

function buildPlanFoundationGateActions(engineeringState?: WorkspaceEngineeringStateSnapshot): GuidanceAction[] {
  const recovery = getPlanGenerationLifecycleRecoveryState(engineeringState);
  const hasRecoveryRetry = hasPlanGenerationLifecycleRecoveryRetry(recovery);
  const retryPrompt = getPlanGenerationLifecycleRetryPrompt(recovery);
  const hasRetryPrompt = hasPlanGenerationLifecycleTextValue(retryPrompt);
  if (hasRecoveryRetry === true && hasRetryPrompt === true) {
    const recoveryStage = getPlanGenerationLifecycleResumeStage(recovery);
    const resumeStage = isWorkspaceBackendWorkflowStage(recoveryStage)
      ? recoveryStage
      : 'bootstrap_review';
    return [
      {
        label: '重试自动准备项目基础设定',
        kind: 'retry_workflow_gate',
        prompt: retryPrompt,
        mode: 'foundation',
        conversationStage: resumeStage,
      },
    ];
  }
  return [
    {
      label: '重试自动准备项目基础设定',
      kind: 'send_prompt',
      prompt: '请自动完成项目基础设定：基于当前需求选择默认可执行决策并继续生成技术方案；只有存在无法自动判断的高风险冲突时才列出需要补充的关键信息。',
      mode: 'foundation',
      conversationStage: 'bootstrap_confirmed',
    },
  ];
}

export function preparePlanGenerationRequest(
  projectInfo: WorkspaceProjectInfo,
  selectedModel: string,
  options: PlanRequestOptions | undefined,
  availablePlans: PlanGenerationAvailablePlans,
  messagesRef: PlanGenerationMessagesRef,
): PreparedPlanGenerationRequest {
  const hasForceReplan = options?.force === true;
  const userFeedback = getPlanGenerationLifecycleUserFeedback(options);
  const hasUserFeedback = hasPlanGenerationLifecycleTextValue(userFeedback);
  const isReplan = hasForceReplan === true && hasUserFeedback === true;
  const isRetry = options?.retry === true;
  const optionBaseMessages = options?.baseMessages;
  const hasOptionBaseMessages = optionBaseMessages !== undefined;
  const baseMessageSource = hasOptionBaseMessages === true ? optionBaseMessages : messagesRef.current;
  const baseMessages = materializePlanGenerationLifecycleBaseMessages(baseMessageSource);

  return {
    appType: projectInfo.appType,
    baseMessages,
    currentPlansForReplan: isReplan ? availablePlans : [],
    initialStatusMessage: isReplan
      ? '正在重新准备方案，并根据你刚补充的要求重新规划技术方案。'
      : '正在准备方案，先分析需求并生成候选技术方案。',
    isReplan,
    isRetry,
    persistedProjectId: projectInfo.isPersisted ? projectInfo.projectId : undefined,
    projectId: projectInfo.projectId,
    selectedModel,
    requestDescription: projectInfo.description,
    userFeedback,
  };
}

export function resetRequestedPlanTracking(
  projectId: string,
  context: {
    requestedPlansRef: WorkspacePlanGenerationProjectIdSetRef;
    requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
    plannedProjectIdsRef?: WorkspacePlanGenerationProjectIdSetRef;
    plannedProjectIdsAcrossMounts?: WorkspacePlanGenerationProjectIdSet;
    autoPlanTriggeredRef?: MutableRefObject<boolean>;
  },
) {
  context.requestedPlansRef.current.delete(projectId);
  context.requestedPlanProjectsAcrossMounts.delete(projectId);
  const plannedProjectIdsRef = context.plannedProjectIdsRef;
  const hasPlannedProjectIdsRef = hasPlanGenerationLifecycleProjectIdSetRef(plannedProjectIdsRef);
  if (hasPlannedProjectIdsRef === true) {
    plannedProjectIdsRef.current.delete(projectId);
  }

  const plannedProjectIdsAcrossMounts = context.plannedProjectIdsAcrossMounts;
  const hasPlannedProjectIdsAcrossMounts = hasPlanGenerationLifecycleProjectIdSet(
    plannedProjectIdsAcrossMounts,
  );
  if (hasPlannedProjectIdsAcrossMounts === true) {
    plannedProjectIdsAcrossMounts.delete(projectId);
  }

  const autoPlanTriggeredRef = context.autoPlanTriggeredRef;
  const hasAutoPlanTriggeredRef = hasPlanGenerationLifecycleAutoPlanTriggeredRef(autoPlanTriggeredRef);
  if (hasAutoPlanTriggeredRef === true) {
    autoPlanTriggeredRef.current = false;
  }
}

export function clearActivePlanRequest(
  projectId: string,
  context: {
    planningProjectIdRef: MutableRefObject<string | null>;
    planningAbortRef?: MutableRefObject<AbortController | null>;
    setIsPlanning?: Dispatch<SetStateAction<boolean>>;
  },
) {
  const planningAbortRef = context.planningAbortRef;
  const hasPlanningAbortRef = hasPlanGenerationLifecyclePlanningAbortRef(planningAbortRef);
  if (hasPlanningAbortRef === true) {
    planningAbortRef.current = null;
  }
  if (context.planningProjectIdRef.current === projectId) {
    context.planningProjectIdRef.current = null;
  }
  const setIsPlanning = context.setIsPlanning;
  const hasSetIsPlanningAction = hasPlanGenerationLifecycleSetIsPlanningAction(setIsPlanning);
  if (hasSetIsPlanningAction === true) {
    setIsPlanning(false);
  }
}

export function appendPlanGenerationFailureMessage(
  context: {
    planMessageId: string;
    requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
    requestedPlansRef: WorkspacePlanGenerationProjectIdSetRef;
    setMessageStreamingState: (messageId: string, streaming: boolean) => void;
    applyPlanGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  },
  payload: {
    error: unknown;
    projectId: string;
  },
) {
  resetRequestedPlanTracking(payload.projectId, {
    requestedPlansRef: context.requestedPlansRef,
    requestedPlanProjectsAcrossMounts: context.requestedPlanProjectsAcrossMounts,
  });

  if (payload.error instanceof DOMException && payload.error.name === 'AbortError') {
    context.setMessageStreamingState(context.planMessageId, false);
    appendPlanRequestTerminalMessage({
      planMessageId: context.planMessageId,
      applyPlanGenerationMessages: context.applyPlanGenerationMessages,
    }, {
      kind: 'aborted',
      message: '本次方案生成已停止。你可以继续输入需求后重新开始。',
    });
    return { aborted: true };
  }

  const foundationGateState = getPlanFoundationGateEngineeringState(payload.error);
  const hasFoundationGateState = foundationGateState !== undefined;
  if (hasFoundationGateState === true) {
    const recovery = getPlanGenerationLifecycleRecoveryState(foundationGateState);
    const execution = getPlanGenerationLifecycleExecutionState(foundationGateState);
    const bootstrapState = getPlanGenerationLifecycleBootstrapState(foundationGateState);
    const recoveryReasonMessage = getPlanGenerationLifecycleRecoveryReasonMessage(recovery);
    const hasRecoveryReasonMessage = hasPlanGenerationLifecycleTextValue(recoveryReasonMessage);
    const executionNextAction = getPlanGenerationLifecycleExecutionNextAction(execution);
    const hasExecutionNextAction = hasPlanGenerationLifecycleTextValue(executionNextAction);
    const bootstrapNextAction = getPlanGenerationLifecycleBootstrapNextAction(bootstrapState);
    const hasBootstrapNextAction = hasPlanGenerationLifecycleTextValue(bootstrapNextAction);
    const nextAction = hasRecoveryReasonMessage === true
      ? recoveryReasonMessage
      : hasExecutionNextAction === true
        ? executionNextAction
        : hasBootstrapNextAction === true
          ? bootstrapNextAction
          : '请重试自动准备项目基础设定；如果连续失败，请补充关键业务、鉴权、数据或合规约束后再生成技术方案。';
    appendPlanRequestTerminalMessage({
      planMessageId: context.planMessageId,
      applyPlanGenerationMessages: context.applyPlanGenerationMessages,
    }, {
      kind: 'error',
      message: `项目基础设定尚未完成，已暂停进入方案生成。\n\n${nextAction}`,
      suggestedActions: buildPlanFoundationGateActions(foundationGateState),
    });
    return { aborted: false };
  }

  appendPlanRequestTerminalMessage({
    planMessageId: context.planMessageId,
    applyPlanGenerationMessages: context.applyPlanGenerationMessages,
  }, {
    kind: 'error',
    message: `生成技术方案失败：${formatPlanGenerationFailure(payload.error)}`,
    suggestedActions: [{ label: '重新生成方案', kind: 'retry_plan_generation' }],
    engineeringState: buildPlanGenerationFailureEngineeringState(payload.error),
  });
  return { aborted: false };
}

export function beginPlanGenerationRequest(
  projectId: string,
  context: {
    planningAbortRef: MutableRefObject<AbortController | null>;
    planningProjectIdRef: MutableRefObject<string | null>;
    setIsPlanning: Dispatch<SetStateAction<boolean>>;
  },
) {
  context.planningProjectIdRef.current = projectId;
  context.setIsPlanning(true);

  const abortController = new AbortController();
  context.planningAbortRef.current = abortController;

  return {
    abortController,
    planMessageId: `plans-${Date.now()}`,
  };
}
