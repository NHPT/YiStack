import type { Dispatch, SetStateAction } from 'react';

import type { Plan } from '@/lib/api';
import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspacePlanSelectionState,
  WorkspacePlanSelectionStatus,
} from '@/lib/workspace/engineering-state';

import type {
  WorkspaceChatMessage,
  WorkspaceEditorSessionSnapshot,
  WorkspacePlanFlowState,
  WorkspaceSessionSnapshot,
} from './workspace-types';
import {
  getWorkspaceWorkflowStageApprovalBoundaryOrFallback,
  getWorkspaceWorkflowStageAutoProgressEnabledOrFallback,
  getWorkspaceWorkflowStageDefaultModeOrFallback,
  type WorkspaceApprovalBoundary,
  type WorkspaceBackendWorkflowStage,
} from '@/lib/workspace/workflow-contract';
import { getWorkspaceRecommendedPlanId } from './workspace-plan-message-helpers';

export type WorkspacePlanFlowStatePatch =
  Partial<WorkspacePlanFlowState>
  | ((current: WorkspacePlanFlowState) => Partial<WorkspacePlanFlowState> | null | undefined);

export type WorkspacePlanFlowStateApplyOptions = {
  availablePlans?: Plan[];
  recommendedPlanId?: string | null;
  selectedPlanId?: string | null;
  planCountdown?: number;
  planAutoConfirmDeadlineAt?: string | null;
  planSelectionReady?: boolean;
};

export type WorkspaceExtractedPlanFlowState = {
  availablePlans: Plan[];
  recommendedPlanId: string | null;
  selectedPlanId: string | null;
  planSelectionReady: boolean;
};

type WorkspacePlanList = Plan[];
type WorkspacePlanMessageEngineeringState = Partial<WorkspaceEngineeringStateSnapshot>;
type WorkspacePlanFlowMessageList = WorkspaceChatMessage[];

export const WORKSPACE_PLAN_AUTO_CONFIRM_SECONDS = 120;
const WORKSPACE_PLAN_SELECTION_STAGE: WorkspaceBackendWorkflowStage = 'plan-selection';
const WORKSPACE_PLAN_APPROVED_STAGE: WorkspaceBackendWorkflowStage = 'plan-approved';

type WorkspacePlanSelectionEngineeringStateMessageMaterializerInput = {
  messages: WorkspaceChatMessage[];
  messageIndex: number;
  state: WorkspacePlanFlowState;
  engineeringState: WorkspaceEngineeringStateSnapshot;
};

export const initialWorkspacePlanFlowState: WorkspacePlanFlowState = {
  availablePlans: [],
  recommendedPlanId: null,
  selectedPlanId: null,
  planCountdown: WORKSPACE_PLAN_AUTO_CONFIRM_SECONDS,
  planAutoConfirmDeadlineAt: null,
  planSelectionReady: false,
};

function getWorkspacePlanNowMs(): number {
  return Date.now();
}

export function getWorkspacePlanAutoConfirmDeadlineFromSeconds(seconds: number): string | null {
  if (seconds <= 0) {
    return null;
  }

  return new Date(getWorkspacePlanNowMs() + seconds * 1000).toISOString();
}

export function getWorkspacePlanAutoConfirmRemainingSeconds(deadlineAt: string | null): number | null {
  if (deadlineAt === null) {
    return null;
  }

  const deadlineMs = Date.parse(deadlineAt);
  if (Number.isFinite(deadlineMs) === false) {
    return null;
  }

  const remainingMs = deadlineMs - getWorkspacePlanNowMs();
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / 1000);
}

export function getWorkspaceSessionKey(projectId: string) {
  return `yistack_workspace_session:${projectId}`;
}

function getWorkspacePlanList(plans: Plan[] | undefined): WorkspacePlanList {
  if (Array.isArray(plans) === false) {
    return [];
  }

  return plans;
}

function hasWorkspacePlanList(plans: WorkspacePlanList): boolean {
  const hasPlans = plans.length > 0;
  return hasPlans === true;
}

function hasWorkspacePlanId(planId: string): boolean {
  const hasPlanId = planId.length > 0;
  return hasPlanId === true;
}

function getWorkspacePlanIds(plans: Plan[]): string[] {
  const planIds: string[] = [];
  for (const plan of plans) {
    const planId = plan.id;
    const hasPlanId = hasWorkspacePlanId(planId);
    if (hasPlanId === true) {
      planIds.push(planId);
    }
  }

  return planIds;
}

function getWorkspacePlansById(plans: Plan[]): Map<string, Plan> {
  const plansById = new Map<string, Plan>();
  for (const plan of plans) {
    plansById.set(plan.id, plan);
  }

  return plansById;
}

function getWorkspacePlansFromPlanIds(planIds: string[], plansById: Map<string, Plan>): Plan[] {
  const plans: Plan[] = [];
  for (const planId of planIds) {
    const plan = plansById.get(planId);
    if (plan !== undefined) {
      plans.push(plan);
    }
  }

  return plans;
}

function getLatestWorkspacePlanMessage(
  messages: WorkspaceChatMessage[],
): WorkspaceChatMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const isPlanOptionsMessage = message.kind === 'plan-options';
    const isPlanSuperseded = message.planSuperseded === true;
    const messagePlans = getWorkspacePlanList(message.plans);
    const hasMessagePlans = hasWorkspacePlanList(messagePlans);

    if (
      isPlanOptionsMessage === true
      && isPlanSuperseded === false
      && hasMessagePlans === true
    ) {
      return message;
    }
  }

  return undefined;
}

function getWorkspacePlanMessagePlans(
  message: WorkspaceChatMessage | undefined,
): WorkspacePlanList {
  if (message === undefined) {
    return [];
  }

  return getWorkspacePlanList(message.plans);
}

function getWorkspacePlanMessageRecommendedPlanId(
  message: WorkspaceChatMessage | undefined,
): string | null {
  if (message === undefined) {
    return null;
  }

  if (message.recommendedPlanId === undefined) {
    return null;
  }

  return message.recommendedPlanId;
}

function getWorkspacePlanMessageSelectedPlanId(
  message: WorkspaceChatMessage | undefined,
): string | null {
  if (message === undefined) {
    return null;
  }

  if (message.selectedPlanId === undefined) {
    return null;
  }

  return message.selectedPlanId;
}

function isWorkspacePlanMessageStreamComplete(
  message: WorkspaceChatMessage | undefined,
): boolean {
  if (message === undefined) {
    return false;
  }

  return message.planStreamComplete === true;
}

function getWorkspacePlanSelectionOptionalId(value: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }

  return value;
}

function getWorkspacePlanMessageEngineeringState(
  message: WorkspaceChatMessage,
): WorkspacePlanMessageEngineeringState {
  if (message.engineeringState === undefined) {
    return {};
  }

  return message.engineeringState;
}

function getWorkspacePlanSelectionState(
  message: WorkspaceChatMessage,
): WorkspacePlanSelectionState | undefined {
  const engineeringState = message.engineeringState;
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.plan_selection;
}

function getLatestWorkspacePlanSelectionState(
  messages: WorkspaceChatMessage[],
): WorkspacePlanSelectionState | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const planSelection = getWorkspacePlanSelectionState(message);
    const hasPlanSelection = isWorkspacePlanSelectionState(planSelection);

    if (hasPlanSelection === true) {
      return planSelection;
    }
  }

  return undefined;
}

function getWorkspacePlanSelectionAvailablePlanIds(
  planSelection: WorkspacePlanSelectionState,
): string[] {
  if (Array.isArray(planSelection.available_plan_ids) === false) {
    return [];
  }

  return planSelection.available_plan_ids;
}

function getWorkspacePlanSelectionPlanId(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  return value;
}

function getWorkspacePlanSelectionAvailablePlansPatch(plansFromState: Plan[]): Plan[] | undefined {
  const hasPlansFromState = hasWorkspacePlanList(plansFromState);
  if (hasPlansFromState === false) {
    return undefined;
  }

  return plansFromState;
}

function getWorkspacePlanFlowOptionPlans(
  options: WorkspacePlanFlowStateApplyOptions | undefined,
): Plan[] | undefined {
  if (options === undefined) {
    return undefined;
  }

  return options.availablePlans;
}

function getWorkspacePlanFlowOptionRecommendedPlanId(
  options: WorkspacePlanFlowStateApplyOptions | undefined,
): string | null | undefined {
  if (options === undefined) {
    return undefined;
  }

  return options.recommendedPlanId;
}

function getWorkspacePlanFlowOptionSelectedPlanId(
  options: WorkspacePlanFlowStateApplyOptions | undefined,
): string | null | undefined {
  if (options === undefined) {
    return undefined;
  }

  return options.selectedPlanId;
}

function getWorkspacePlanFlowOptionPlanSelectionReady(
  options: WorkspacePlanFlowStateApplyOptions | undefined,
): boolean | undefined {
  if (options === undefined) {
    return undefined;
  }

  return options.planSelectionReady;
}

function getWorkspacePlanFlowOptionPlanCountdown(
  options: WorkspacePlanFlowStateApplyOptions | undefined,
): number | undefined {
  if (options === undefined) {
    return undefined;
  }

  return options.planCountdown;
}

function getWorkspacePlanFlowOptionAutoConfirmDeadlineAt(
  options: WorkspacePlanFlowStateApplyOptions | undefined,
): string | null | undefined {
  if (options === undefined) {
    return undefined;
  }

  return options.planAutoConfirmDeadlineAt;
}

function getRestoredWorkspaceSnapshotPlans(
  snapshot: WorkspaceSessionSnapshot | null,
): Plan[] {
  if (snapshot === null) {
    return [];
  }

  return getWorkspacePlanList(snapshot.availablePlans);
}

function getRestoredWorkspaceSnapshotSelectedPlanId(
  snapshot: WorkspaceSessionSnapshot | null,
): string | null | undefined {
  if (snapshot === null) {
    return undefined;
  }

  return snapshot.selectedPlanId;
}

function getRestoredWorkspaceSnapshotRecommendedPlanId(
  snapshot: WorkspaceSessionSnapshot | null,
): string | null | undefined {
  if (snapshot === null) {
    return undefined;
  }

  return snapshot.recommendedPlanId;
}

function getRestoredWorkspaceSnapshotPlanSelectionReady(
  snapshot: WorkspaceSessionSnapshot | null,
): boolean | undefined {
  if (snapshot === null) {
    return undefined;
  }

  return snapshot.planSelectionReady;
}

function getRestoredWorkspaceSnapshotPlanCountdown(
  snapshot: WorkspaceSessionSnapshot | null,
): number | undefined {
  if (snapshot === null) {
    return undefined;
  }

  return snapshot.planCountdown;
}

function getRestoredWorkspaceSnapshotAutoConfirmDeadlineAt(
  snapshot: WorkspaceSessionSnapshot | null,
): string | null | undefined {
  if (snapshot === null) {
    return undefined;
  }

  return snapshot.planAutoConfirmDeadlineAt;
}

function getWorkspacePlanSelectionAutoConfirmDeadlineAt(
  planSelection: WorkspacePlanSelectionState,
): string | null | undefined {
  if (planSelection.auto_confirm_deadline_at === undefined) {
    return undefined;
  }

  return planSelection.auto_confirm_deadline_at;
}

function getRestoredWorkspacePersistedPlanId(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  return value;
}

export function extractPlanStateFromMessages(
  nextMessages: WorkspaceChatMessage[],
): WorkspaceExtractedPlanFlowState {
  const latestPlanMessage = getLatestWorkspacePlanMessage(nextMessages);
  const messagePlans = getWorkspacePlanMessagePlans(latestPlanMessage);
  const recommendedPlanId = getWorkspacePlanMessageRecommendedPlanId(latestPlanMessage);
  const effectiveRecommendedPlanId = getWorkspaceRecommendedPlanId(messagePlans, recommendedPlanId);

  return {
    availablePlans: messagePlans,
    recommendedPlanId: effectiveRecommendedPlanId,
    selectedPlanId: getWorkspacePlanMessageSelectedPlanId(latestPlanMessage),
    planSelectionReady: isWorkspacePlanMessageStreamComplete(latestPlanMessage),
  };
}

function resolvePlanSelectionStatus(state: WorkspacePlanFlowState): WorkspacePlanSelectionStatus {
  const hasSelectedPlan = state.selectedPlanId !== null;
  const hasAvailablePlans = state.availablePlans.length > 0;
  const hasRecommendedPlan = state.recommendedPlanId !== null;
  const hasReadyAvailablePlans = hasWorkspacePlanSelectionReadyWithAvailablePlans({
    planSelectionReady: state.planSelectionReady,
    hasAvailablePlans,
  });
  const hasPendingPlanPresence = hasWorkspacePlanSelectionPendingPlanPresence({
    hasAvailablePlans,
    hasRecommendedPlan,
  });

  if (hasSelectedPlan === true) return 'passed';
  if (hasReadyAvailablePlans === true) return 'running';
  if (hasPendingPlanPresence === true) return 'pending';
  return 'not_applicable';
}

function isWorkspacePlanSelectionState(
  value: WorkspacePlanSelectionState | undefined,
): value is WorkspacePlanSelectionState {
  return value !== undefined;
}

function hasWorkspacePlanSelectionReadyWithAvailablePlans({
  planSelectionReady,
  hasAvailablePlans,
}: {
  planSelectionReady: boolean;
  hasAvailablePlans: boolean;
}): boolean {
  if (planSelectionReady === false) {
    return false;
  }

  return hasAvailablePlans === true;
}

function hasWorkspacePlanSelectionPendingPlanPresence({
  hasAvailablePlans,
  hasRecommendedPlan,
}: {
  hasAvailablePlans: boolean;
  hasRecommendedPlan: boolean;
}): boolean {
  if (hasAvailablePlans === true) {
    return true;
  }

  return hasRecommendedPlan === true;
}

function shouldAwaitWorkspacePlanSelection({
  planSelectionReady,
  hasAvailablePlans,
  hasSelectedPlan,
}: {
  planSelectionReady: boolean;
  hasAvailablePlans: boolean;
  hasSelectedPlan: boolean;
}): boolean {
  if (planSelectionReady === false) {
    return false;
  }

  if (hasAvailablePlans === false) {
    return false;
  }

  return hasSelectedPlan === false;
}

function getWorkspacePlanSelectionCurrentTask({
  hasSelectedPlan,
  awaitingSelection,
}: {
  hasSelectedPlan: boolean;
  awaitingSelection: boolean;
}): string {
  if (hasSelectedPlan === true) {
    return '已确认实现方案';
  }

  if (awaitingSelection === true) {
    return '等待方案确认';
  }

  return '准备方案选择';
}

function getWorkspacePlanSelectionNextAction({
  hasSelectedPlan,
  awaitingSelection,
}: {
  hasSelectedPlan: boolean;
  awaitingSelection: boolean;
}): string {
  if (hasSelectedPlan === true) {
    return '进入已批准方案的实现流程';
  }

  if (awaitingSelection === true) {
    return '确认推荐方案或继续补充约束';
  }

  return '等待方案生成完成';
}

function getWorkspacePlanSelectionApprovalBoundary({
  awaitingSelection,
  hasSelectedPlan,
}: {
  awaitingSelection: boolean;
  hasSelectedPlan: boolean;
}): WorkspaceApprovalBoundary | undefined {
  const workflowStage = getWorkspacePlanSelectionWorkflowStage({ hasSelectedPlan });

  if (awaitingSelection === true) {
    return getWorkspaceWorkflowStageApprovalBoundaryOrFallback(workflowStage, 'plan_selection');
  }

  if (hasSelectedPlan === true) {
    return getWorkspaceWorkflowStageApprovalBoundaryOrFallback(workflowStage, 'plan_selection');
  }

  return undefined;
}

function getWorkspacePlanSelectionWorkflowStage({
  hasSelectedPlan,
}: {
  hasSelectedPlan: boolean;
}): WorkspaceBackendWorkflowStage {
  if (hasSelectedPlan === true) {
    return WORKSPACE_PLAN_APPROVED_STAGE;
  }

  return WORKSPACE_PLAN_SELECTION_STAGE;
}

function getWorkspacePlanSelectionAutoProgressEnabled({
  workflowStage,
  hasSelectedPlan,
}: {
  workflowStage: WorkspaceBackendWorkflowStage;
  hasSelectedPlan: boolean;
}): boolean {
  return getWorkspaceWorkflowStageAutoProgressEnabledOrFallback(workflowStage, hasSelectedPlan);
}

function getWorkspacePlanSelectionTargetMessageIndex(messages: WorkspaceChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const isPlanOptionsMessage = message.kind === 'plan-options';
    if (isPlanOptionsMessage === false) {
      continue;
    }

    const isPlanSuperseded = message.planSuperseded === true;
    if (isPlanSuperseded === false) {
      return index;
    }
  }

  return -1;
}

function canUseWorkspaceMessagePlanSelectionReady({
  hasMessageAvailablePlans,
  hasMessagePlanSelectionReady,
}: {
  hasMessageAvailablePlans: boolean;
  hasMessagePlanSelectionReady: boolean;
}): boolean {
  if (hasMessageAvailablePlans === true) {
    return true;
  }

  return hasMessagePlanSelectionReady === true;
}

function shouldResetWorkspacePlanCountdown({
  nextPlanSelectionReady,
  hasNextAvailablePlans,
  hasNextSelectedPlan,
}: {
  nextPlanSelectionReady: boolean;
  hasNextAvailablePlans: boolean;
  hasNextSelectedPlan: boolean;
}): boolean {
  if (nextPlanSelectionReady === false) {
    return false;
  }

  if (hasNextAvailablePlans === false) {
    return false;
  }

  return hasNextSelectedPlan === false;
}

function shouldRestoreWorkspacePlanCountdown({
  hasRestoredAvailablePlans,
  hasRestoredSelectedPlan,
}: {
  hasRestoredAvailablePlans: boolean;
  hasRestoredSelectedPlan: boolean;
}): boolean {
  if (hasRestoredAvailablePlans === false) {
    return false;
  }

  return hasRestoredSelectedPlan === false;
}

function canUseWorkspacePlanAutoConfirmDeadline({
  planSelectionReady,
  hasAvailablePlans,
  hasSelectedPlan,
}: {
  planSelectionReady: boolean;
  hasAvailablePlans: boolean;
  hasSelectedPlan: boolean;
}): boolean {
  if (planSelectionReady === false) {
    return false;
  }

  if (hasAvailablePlans === false) {
    return false;
  }

  return hasSelectedPlan === false;
}

function materializeWorkspacePlanSelectionEngineeringStateMessages({
  messages,
  messageIndex,
  state,
  engineeringState,
}: WorkspacePlanSelectionEngineeringStateMessageMaterializerInput): WorkspacePlanFlowMessageList {
  const nextMessages: WorkspacePlanFlowMessageList = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (index !== messageIndex) {
      nextMessages.push(message);
      continue;
    }

    nextMessages.push({
      ...message,
      recommendedPlanId: getWorkspacePlanSelectionOptionalId(state.recommendedPlanId),
      selectedPlanId: getWorkspacePlanSelectionOptionalId(state.selectedPlanId),
      planStreamComplete: state.planSelectionReady,
      engineeringState: {
        ...getWorkspacePlanMessageEngineeringState(message),
        ...engineeringState,
      },
    });
  }

  return nextMessages;
}

function buildPlanSelectionEngineeringState(
  state: WorkspacePlanFlowState,
  sourceMessageId?: string,
): WorkspaceEngineeringStateSnapshot {
  const hasSelectedPlan = state.selectedPlanId !== null;
  const hasAvailablePlans = state.availablePlans.length > 0;
  const awaitingSelection = shouldAwaitWorkspacePlanSelection({
    planSelectionReady: state.planSelectionReady,
    hasAvailablePlans,
    hasSelectedPlan,
  });
  const currentTask = getWorkspacePlanSelectionCurrentTask({
    hasSelectedPlan,
    awaitingSelection,
  });
  const nextAction = getWorkspacePlanSelectionNextAction({
    hasSelectedPlan,
    awaitingSelection,
  });
  const approvalBoundary = getWorkspacePlanSelectionApprovalBoundary({
    awaitingSelection,
    hasSelectedPlan,
  });
  const workflowStage = getWorkspacePlanSelectionWorkflowStage({ hasSelectedPlan });
  const workflowMode = getWorkspaceWorkflowStageDefaultModeOrFallback(workflowStage, 'discuss');
  const autoProgressEnabled = getWorkspacePlanSelectionAutoProgressEnabled({
    workflowStage,
    hasSelectedPlan,
  });

  return {
    workflow: {
      stage: workflowStage,
      mode: workflowMode,
      status: resolvePlanSelectionStatus(state),
    },
    validation: {
      status: 'not_applicable',
    },
    plan_selection: {
      status: resolvePlanSelectionStatus(state),
      available_plan_ids: getWorkspacePlanIds(state.availablePlans),
      recommended_plan_id: getWorkspacePlanSelectionOptionalId(state.recommendedPlanId),
      selected_plan_id: getWorkspacePlanSelectionOptionalId(state.selectedPlanId),
      ready: state.planSelectionReady,
      countdown_seconds: state.planCountdown,
      auto_confirm_deadline_at: state.planAutoConfirmDeadlineAt ?? undefined,
      source_message_id: sourceMessageId,
    },
    phase: {
      current_phase: '方案选择',
      current_task: currentTask,
      completed_tasks: hasSelectedPlan === true ? ['方案已确认'] : [],
      blockers: awaitingSelection === true ? ['等待用户确认方案'] : [],
      next_action: nextAction,
      status: resolvePlanSelectionStatus(state),
    },
    execution: {
      auto_progress_enabled: autoProgressEnabled,
      awaiting_confirmation: awaitingSelection,
      pause_reason: awaitingSelection === true ? 'awaiting_plan_confirmation' : undefined,
      approval_boundary: approvalBoundary,
      current_task: currentTask,
      next_action: nextAction,
    },
  };
}

export function attachPlanSelectionEngineeringState(
  messages: WorkspaceChatMessage[],
  state: WorkspacePlanFlowState,
): WorkspaceChatMessage[] {
  const messageIndex = getWorkspacePlanSelectionTargetMessageIndex(messages);
  if (messageIndex < 0) {
    return messages;
  }

  const targetMessage = messages[messageIndex];
  const engineeringState = buildPlanSelectionEngineeringState(state, targetMessage.id);

  return materializeWorkspacePlanSelectionEngineeringStateMessages({
    messages,
    messageIndex,
    state,
    engineeringState,
  });
}

export function extractPlanStateFromEngineeringState(
  nextMessages: WorkspaceChatMessage[],
  availablePlans: Plan[],
): Partial<WorkspacePlanFlowState> {
  const latestPlanSelection = getLatestWorkspacePlanSelectionState(nextMessages);

  if (latestPlanSelection === undefined) {
    return {};
  }

  if (latestPlanSelection.status === 'not_applicable') {
    return {
      availablePlans: [],
      recommendedPlanId: null,
      selectedPlanId: null,
      planSelectionReady: false,
      planCountdown: 0,
      planAutoConfirmDeadlineAt: null,
    };
  }

  const availablePlanIds = getWorkspacePlanSelectionAvailablePlanIds(latestPlanSelection);
  const plansById = getWorkspacePlansById(availablePlans);
  const plansFromState = getWorkspacePlansFromPlanIds(availablePlanIds, plansById);

  return {
    availablePlans: getWorkspacePlanSelectionAvailablePlansPatch(plansFromState),
    recommendedPlanId: getWorkspacePlanSelectionPlanId(latestPlanSelection.recommended_plan_id),
    selectedPlanId: getWorkspacePlanSelectionPlanId(latestPlanSelection.selected_plan_id),
    planSelectionReady: latestPlanSelection.ready,
    planCountdown: latestPlanSelection.countdown_seconds,
    planAutoConfirmDeadlineAt: getWorkspacePlanSelectionAutoConfirmDeadlineAt(latestPlanSelection),
  };
}

export function resolvePlanFlowState(
  currentState: WorkspacePlanFlowState,
  nextMessages: WorkspaceChatMessage[],
  options?: WorkspacePlanFlowStateApplyOptions,
): WorkspacePlanFlowState {
  const engineeringState = extractPlanStateFromEngineeringState(nextMessages, currentState.availablePlans);
  const messageState = extractPlanStateFromMessages(nextMessages);
  const hasMessageAvailablePlans = hasWorkspacePlanList(messageState.availablePlans);
  const nextAvailablePlans = getWorkspacePlanFlowOptionPlans(options)
    ?? engineeringState.availablePlans
    ?? (hasMessageAvailablePlans === true ? messageState.availablePlans : currentState.availablePlans);
  const nextRecommendedPlanId = getWorkspacePlanFlowOptionRecommendedPlanId(options)
    ?? engineeringState.recommendedPlanId
    ?? messageState.recommendedPlanId
    ?? currentState.recommendedPlanId;
  const nextSelectedPlanId = getWorkspacePlanFlowOptionSelectedPlanId(options)
    ?? engineeringState.selectedPlanId
    ?? messageState.selectedPlanId
    ?? currentState.selectedPlanId;
  const hasMessagePlanSelectionReady = messageState.planSelectionReady === true;
  const canUseMessagePlanSelectionReady = canUseWorkspaceMessagePlanSelectionReady({
    hasMessageAvailablePlans,
    hasMessagePlanSelectionReady,
  });
  const nextPlanSelectionReady = getWorkspacePlanFlowOptionPlanSelectionReady(options)
    ?? engineeringState.planSelectionReady
    ?? (canUseMessagePlanSelectionReady === true
      ? messageState.planSelectionReady
      : currentState.planSelectionReady);
  const hasNextSelectedPlan = nextSelectedPlanId !== null;
  const hasNextAvailablePlans = hasWorkspacePlanList(nextAvailablePlans);
  const shouldResetPlanCountdown = shouldResetWorkspacePlanCountdown({
    nextPlanSelectionReady,
    hasNextAvailablePlans,
    hasNextSelectedPlan,
  });
  const optionPlanCountdown = getWorkspacePlanFlowOptionPlanCountdown(options);
  const optionAutoConfirmDeadlineAt = getWorkspacePlanFlowOptionAutoConfirmDeadlineAt(options);
  const engineeringAutoConfirmDeadlineAt = engineeringState.planAutoConfirmDeadlineAt;
  const currentAutoConfirmDeadlineAt = currentState.planAutoConfirmDeadlineAt;
  const canUseAutoConfirmDeadline = canUseWorkspacePlanAutoConfirmDeadline({
    planSelectionReady: nextPlanSelectionReady,
    hasAvailablePlans: hasNextAvailablePlans,
    hasSelectedPlan: hasNextSelectedPlan,
  });
  const restoredAutoConfirmDeadlineAt = optionAutoConfirmDeadlineAt
    ?? engineeringAutoConfirmDeadlineAt
    ?? currentAutoConfirmDeadlineAt;
  const nextAutoConfirmDeadlineAt = canUseAutoConfirmDeadline === false
    ? null
    : restoredAutoConfirmDeadlineAt
      ?? (shouldResetPlanCountdown === true
        ? getWorkspacePlanAutoConfirmDeadlineFromSeconds(
          optionPlanCountdown ?? WORKSPACE_PLAN_AUTO_CONFIRM_SECONDS,
        )
        : null);
  const remainingCountdown = getWorkspacePlanAutoConfirmRemainingSeconds(nextAutoConfirmDeadlineAt);

  return {
    availablePlans: nextAvailablePlans,
    recommendedPlanId: nextRecommendedPlanId,
    selectedPlanId: nextSelectedPlanId,
    planSelectionReady: nextPlanSelectionReady,
    planCountdown: remainingCountdown
      ?? optionPlanCountdown
      ?? engineeringState.planCountdown
      ?? (shouldResetPlanCountdown === true ? WORKSPACE_PLAN_AUTO_CONFIRM_SECONDS : 0),
    planAutoConfirmDeadlineAt: nextAutoConfirmDeadlineAt,
  };
}

export function syncPlanFlowState(
  nextState: WorkspacePlanFlowState,
  handlers: {
    setAvailablePlans: Dispatch<SetStateAction<Plan[]>>;
    setRecommendedPlanId: Dispatch<SetStateAction<string | null>>;
    setSelectedPlanId: Dispatch<SetStateAction<string | null>>;
    setPlanSelectionReady: Dispatch<SetStateAction<boolean>>;
    setPlanCountdown: Dispatch<SetStateAction<number>>;
    setPlanAutoConfirmDeadlineAt: Dispatch<SetStateAction<string | null>>;
  },
) {
  handlers.setAvailablePlans(nextState.availablePlans);
  handlers.setRecommendedPlanId(nextState.recommendedPlanId);
  handlers.setSelectedPlanId(nextState.selectedPlanId);
  handlers.setPlanSelectionReady(nextState.planSelectionReady);
  handlers.setPlanCountdown(nextState.planCountdown);
  handlers.setPlanAutoConfirmDeadlineAt(nextState.planAutoConfirmDeadlineAt);
}

export function buildWorkspaceSessionSnapshot(
  messages: WorkspaceChatMessage[],
  planState: WorkspacePlanFlowState,
  editorState?: WorkspaceEditorSessionSnapshot,
): WorkspaceSessionSnapshot {
  const snapshot: WorkspaceSessionSnapshot = {
    messages,
    ...planState,
  };

  if (editorState !== undefined) {
    snapshot.editorState = editorState;
  }

  return snapshot;
}

export function getWorkspaceSessionSnapshotEditorState(
  snapshot: WorkspaceSessionSnapshot | null,
): WorkspaceEditorSessionSnapshot | null {
  if (snapshot === null) {
    return null;
  }

  const editorState = snapshot.editorState;
  if (editorState === undefined) {
    return null;
  }

  return editorState;
}

export function resolveRestoredPlanFlowState(
  preferredMessages: WorkspaceChatMessage[],
  snapshot: WorkspaceSessionSnapshot | null,
  persistedPlanId?: string,
): WorkspacePlanFlowState {
  const snapshotAvailablePlans = getRestoredWorkspaceSnapshotPlans(snapshot);
  const engineeringState = extractPlanStateFromEngineeringState(preferredMessages, snapshotAvailablePlans);
  const messagePlanState = extractPlanStateFromMessages(preferredMessages);
  const selectedPlanId = getRestoredWorkspaceSnapshotSelectedPlanId(snapshot)
    ?? engineeringState.selectedPlanId
    ?? messagePlanState.selectedPlanId
    ?? getRestoredWorkspacePersistedPlanId(persistedPlanId);
  const engineeringAvailablePlans = getWorkspacePlanList(engineeringState.availablePlans);
  const hasSnapshotAvailablePlans = hasWorkspacePlanList(snapshotAvailablePlans);
  const hasEngineeringAvailablePlans = hasWorkspacePlanList(engineeringAvailablePlans);
  const availablePlans = hasSnapshotAvailablePlans === true
    ? snapshotAvailablePlans
    : hasEngineeringAvailablePlans === true
      ? engineeringAvailablePlans
      : messagePlanState.availablePlans;
  const recommendedPlanId = getRestoredWorkspaceSnapshotRecommendedPlanId(snapshot)
    ?? engineeringState.recommendedPlanId
    ?? messagePlanState.recommendedPlanId;
  const planSelectionReady = getRestoredWorkspaceSnapshotPlanSelectionReady(snapshot)
    ?? engineeringState.planSelectionReady
    ?? messagePlanState.planSelectionReady;
  const hasRestoredSelectedPlan = selectedPlanId !== null;
  const hasRestoredAvailablePlans = hasWorkspacePlanList(availablePlans);
  const shouldRestorePlanCountdown = shouldRestoreWorkspacePlanCountdown({
    hasRestoredAvailablePlans,
    hasRestoredSelectedPlan,
  });
  const restoredAutoConfirmDeadlineAt = getRestoredWorkspaceSnapshotAutoConfirmDeadlineAt(snapshot)
    ?? engineeringState.planAutoConfirmDeadlineAt
    ?? null;
  const remainingCountdown = getWorkspacePlanAutoConfirmRemainingSeconds(restoredAutoConfirmDeadlineAt);
  const planCountdown = remainingCountdown
    ?? getRestoredWorkspaceSnapshotPlanCountdown(snapshot)
    ?? engineeringState.planCountdown
    ?? (shouldRestorePlanCountdown === true ? WORKSPACE_PLAN_AUTO_CONFIRM_SECONDS : 0);
  const planAutoConfirmDeadlineAt = hasRestoredSelectedPlan === true
    ? null
    : restoredAutoConfirmDeadlineAt;

  return {
    availablePlans,
    recommendedPlanId,
    selectedPlanId,
    planCountdown,
    planAutoConfirmDeadlineAt,
    planSelectionReady,
  };
}
