import type { WorkflowStepStatus } from '@/components/workspace/chat-message-content';
import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceEngineeringStatus,
} from '@/lib/workspace/engineering-state';

import type {
  ChatMessageRole,
  ChatMessageSnapshot,
  ChatMessageSnapshotSource,
  ChatMessageSnapshotStatus,
  GuidanceAction,
  WorkspaceSuggestedQuestionList,
} from './workspace-types';

type ChatMessageSnapshotStep = {
  status?: WorkflowStepStatus;
};

type ChatMessageSnapshotMessage = {
  role: ChatMessageRole;
  workflowSteps?: ChatMessageSnapshotStep[];
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  streaming?: boolean;
  suggestedQuestions?: WorkspaceSuggestedQuestionList;
  suggestedActions?: GuidanceAction[];
  relatedCommit?: unknown;
};

type ChatMessageSnapshotRecoveryActionSummary = {
  actionCount: number;
};

type ChatMessageSnapshotOptions = {
  message: ChatMessageSnapshotMessage;
  displaySteps: ChatMessageSnapshotStep[];
  hasSummary: boolean;
  hasReasoning: boolean;
  hasStatus: boolean;
  recoveryActionSummary?: ChatMessageSnapshotRecoveryActionSummary;
};

function hasChatMessageSnapshotWorkflowStatus(
  displaySteps: ChatMessageSnapshotStep[],
  status: WorkflowStepStatus,
): boolean {
  for (const step of displaySteps) {
    const stepStatus = step.status;
    const hasTargetStatus = stepStatus === status;
    if (hasTargetStatus === true) {
      return true;
    }
  }

  return false;
}

function getChatMessageSnapshotEngineeringState(
  message: ChatMessageSnapshotMessage,
): WorkspaceEngineeringStateSnapshot | undefined {
  const engineeringState = message.engineeringState;
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState;
}

function hasChatMessageSnapshotEngineeringStatusFailed(
  status: WorkspaceEngineeringStatus | undefined,
): boolean {
  if (status === undefined) {
    return false;
  }

  const hasFailedStatus = status === 'failed';
  return hasFailedStatus === true;
}

function getChatMessageSnapshotEngineeringPhaseStatus(
  engineeringState: WorkspaceEngineeringStateSnapshot,
): WorkspaceEngineeringStatus | undefined {
  const phase = engineeringState.phase;
  if (phase === undefined) {
    return undefined;
  }

  return phase.status;
}

function getChatMessageSnapshotEngineeringWorkflowStatus(
  engineeringState: WorkspaceEngineeringStateSnapshot,
): WorkspaceEngineeringStatus | undefined {
  const workflow = engineeringState.workflow;
  if (workflow === undefined) {
    return undefined;
  }

  return workflow.status;
}

function getChatMessageSnapshotEngineeringValidationStatus(
  engineeringState: WorkspaceEngineeringStateSnapshot,
): WorkspaceEngineeringStatus | undefined {
  const validation = engineeringState.validation;
  if (validation === undefined) {
    return undefined;
  }

  return validation.status;
}

function hasChatMessageSnapshotEngineeringFailed(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): boolean {
  if (engineeringState === undefined) {
    return false;
  }

  const phaseStatus = getChatMessageSnapshotEngineeringPhaseStatus(engineeringState);
  const hasPhaseFailed = hasChatMessageSnapshotEngineeringStatusFailed(phaseStatus);
  if (hasPhaseFailed === true) {
    return true;
  }

  const workflowStatus = getChatMessageSnapshotEngineeringWorkflowStatus(engineeringState);
  const hasWorkflowFailed = hasChatMessageSnapshotEngineeringStatusFailed(workflowStatus);
  if (hasWorkflowFailed === true) {
    return true;
  }

  const validationStatus = getChatMessageSnapshotEngineeringValidationStatus(engineeringState);
  const hasValidationFailed = hasChatMessageSnapshotEngineeringStatusFailed(validationStatus);
  if (hasValidationFailed === true) {
    return true;
  }

  return false;
}

function getChatMessageSnapshotWorkflowStepCount(message: ChatMessageSnapshotMessage): number {
  const workflowSteps = message.workflowSteps;
  if (workflowSteps === undefined) {
    return 0;
  }

  return workflowSteps.length;
}

function getChatMessageSnapshotSuggestedQuestionCount(message: ChatMessageSnapshotMessage): number {
  const suggestedQuestions = message.suggestedQuestions;
  if (suggestedQuestions === undefined) {
    return 0;
  }

  return suggestedQuestions.length;
}

function getChatMessageSnapshotSuggestedActionCount(message: ChatMessageSnapshotMessage): number {
  const suggestedActions = message.suggestedActions;
  if (suggestedActions === undefined) {
    return 0;
  }

  return suggestedActions.length;
}

function getChatMessageSnapshotRecoveryActionCount(
  recoveryActionSummary: ChatMessageSnapshotRecoveryActionSummary | undefined,
): number {
  if (recoveryActionSummary === undefined) {
    return 0;
  }

  return recoveryActionSummary.actionCount;
}

function getChatMessageSnapshotGuidanceActionCount({
  suggestedActionCount,
  recoveryActionCount,
}: {
  suggestedActionCount: number;
  recoveryActionCount: number;
}): number {
  return suggestedActionCount + recoveryActionCount;
}

function hasChatMessageSnapshotRelatedCommit(message: ChatMessageSnapshotMessage): boolean {
  if (message.relatedCommit === undefined) {
    return false;
  }

  return message.relatedCommit !== null;
}

function hasChatMessageSnapshotGuidance(
  suggestedQuestionCount: number,
  guidanceActionCount: number,
): boolean {
  const hasSuggestedQuestions = suggestedQuestionCount > 0;
  if (hasSuggestedQuestions === true) {
    return true;
  }

  const hasGuidanceActions = guidanceActionCount > 0;
  if (hasGuidanceActions === true) {
    return true;
  }

  return false;
}

function hasChatMessageSnapshotContent(
  hasSummary: boolean,
  hasReasoning: boolean,
  hasStatus: boolean,
): boolean {
  if (hasSummary === true) {
    return true;
  }

  if (hasReasoning === true) {
    return true;
  }

  if (hasStatus === true) {
    return true;
  }

  return false;
}

function getChatMessageSnapshotStatus({
  engineeringFailed,
  workflowFailed,
  workflowRunning,
  isStreaming,
  hasGuidance,
  hasRelatedCommit,
  role,
  hasContent,
}: {
  engineeringFailed: boolean;
  workflowFailed: boolean;
  workflowRunning: boolean;
  isStreaming: boolean;
  hasGuidance: boolean;
  hasRelatedCommit: boolean;
  role: ChatMessageRole;
  hasContent: boolean;
}): ChatMessageSnapshotStatus {
  if (engineeringFailed === true) {
    return 'engineering_failed';
  }

  if (workflowFailed === true) {
    return 'workflow_failed';
  }

  if (workflowRunning === true) {
    return 'workflow_running';
  }

  if (isStreaming === true) {
    return 'assistant_streaming';
  }

  if (hasGuidance === true) {
    return 'guidance_available';
  }

  if (hasRelatedCommit === true) {
    return 'commit_attached';
  }

  if (role === 'user') {
    return 'user_message';
  }

  if (role === 'system') {
    return 'system_message';
  }

  if (hasContent === true) {
    return 'content_only';
  }

  return 'empty_message';
}

function getChatMessageSnapshotSource(status: ChatMessageSnapshotStatus): ChatMessageSnapshotSource {
  if (status === 'engineering_failed') {
    return 'engineering_state';
  }

  if (status === 'workflow_failed') {
    return 'workflow_steps';
  }

  if (status === 'workflow_running') {
    return 'workflow_steps';
  }

  if (status === 'assistant_streaming') {
    return 'streaming';
  }

  if (status === 'guidance_available') {
    return 'guidance';
  }

  if (status === 'commit_attached') {
    return 'commit';
  }

  if (status === 'content_only') {
    return 'content';
  }

  if (status === 'empty_message') {
    return 'content';
  }

  return 'message_role';
}

function getChatMessageSnapshotMessage(status: ChatMessageSnapshotStatus): string {
  if (status === 'engineering_failed') {
    return '该消息携带失败的工程状态，需要优先查看恢复入口。';
  }

  if (status === 'workflow_failed') {
    return '该消息包含失败的 workflow step。';
  }

  if (status === 'workflow_running') {
    return '该消息包含仍在执行的 workflow step。';
  }

  if (status === 'assistant_streaming') {
    return '该 assistant 消息仍在流式生成。';
  }

  if (status === 'guidance_available') {
    return '该消息提供建议问题或可执行恢复动作。';
  }

  if (status === 'commit_attached') {
    return '该消息关联了 Git 版本摘要。';
  }

  if (status === 'empty_message') {
    return '该消息没有可展示的正文、步骤或建议入口。';
  }

  return '该消息以内容展示为主。';
}

function getChatMessageSnapshotRecovery(status: ChatMessageSnapshotStatus): string {
  if (status === 'engineering_failed') {
    return '查看工程状态面板和建议动作，按恢复入口继续。';
  }

  if (status === 'workflow_failed') {
    return '展开 workflow 分组查看失败步骤；必要时使用消息建议动作恢复。';
  }

  if (status === 'workflow_running') {
    return '等待当前流式生成或 workflow step 完成后再继续操作。';
  }

  if (status === 'assistant_streaming') {
    return '等待当前流式生成或 workflow step 完成后再继续操作。';
  }

  if (status === 'guidance_available') {
    return '优先使用 primary/retry 动作；只需追问时再点击建议问题。';
  }

  if (status === 'commit_attached') {
    return '可查看修改记录或回到该版本，操作结果会进入 Git/Workspace 状态链路。';
  }

  if (status === 'empty_message') {
    return '检查消息恢复数据是否缺少 content、workflowSteps 或 engineeringState。';
  }

  return '继续阅读正文；如有子快照，可展开对应区域查看来源和恢复建议。';
}

export function buildChatMessageSnapshot({
  message,
  displaySteps,
  hasSummary,
  hasReasoning,
  hasStatus,
  recoveryActionSummary,
}: ChatMessageSnapshotOptions): ChatMessageSnapshot {
  const workflowFailed = hasChatMessageSnapshotWorkflowStatus(displaySteps, 'failed');
  const workflowRunning = hasChatMessageSnapshotWorkflowStatus(displaySteps, 'running');
  const engineeringState = getChatMessageSnapshotEngineeringState(message);
  const engineeringFailed = hasChatMessageSnapshotEngineeringFailed(engineeringState);
  const suggestedQuestionCount = getChatMessageSnapshotSuggestedQuestionCount(message);
  const suggestedActionCount = getChatMessageSnapshotSuggestedActionCount(message);
  const recoveryActionCount = getChatMessageSnapshotRecoveryActionCount(recoveryActionSummary);
  const guidanceActionCount = getChatMessageSnapshotGuidanceActionCount({
    suggestedActionCount,
    recoveryActionCount,
  });
  const hasGuidance = hasChatMessageSnapshotGuidance(suggestedQuestionCount, guidanceActionCount);
  const hasEngineeringState = engineeringState !== undefined;
  const hasRelatedCommit = hasChatMessageSnapshotRelatedCommit(message);
  const isStreaming = message.streaming === true;
  const hasContent = hasChatMessageSnapshotContent(hasSummary, hasReasoning, hasStatus);
  const role = message.role;
  const status = getChatMessageSnapshotStatus({
    engineeringFailed,
    workflowFailed,
    workflowRunning,
    isStreaming,
    hasGuidance,
    hasRelatedCommit,
    role,
    hasContent,
  });
  const source = getChatMessageSnapshotSource(status);
  const workflowStepCount = getChatMessageSnapshotWorkflowStepCount(message);
  const snapshotMessage = getChatMessageSnapshotMessage(status);
  const recovery = getChatMessageSnapshotRecovery(status);

  return {
    status,
    source,
    role,
    workflowStepCount,
    visibleStepCount: displaySteps.length,
    suggestedQuestionCount,
    guidanceActionCount,
    hasEngineeringState,
    hasSummary,
    hasReasoning,
    hasStatus,
    hasRelatedCommit,
    isStreaming,
    message: snapshotMessage,
    recovery,
    updatedAt: 'derived',
  };
}
