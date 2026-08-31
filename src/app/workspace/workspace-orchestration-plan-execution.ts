import {
  appendPlanGenerationFailureMessage,
  beginPlanGenerationRequest,
  clearActivePlanRequest,
  executePlanGenerationRequest,
  preparePlanGenerationRequest,
  resetRequestedPlanTracking,
} from './workspace-plan-generation';
import { chatApi } from '@/lib/api';
import { hasCompletedWorkspaceFoundation } from '@/lib/workspace/engineering-state';
import { runSSEEventStream } from './workspace-orchestration-shared';
import type { PreparedPlanGenerationRequest } from './workspace-plan-generation-types';
import type {
  RunWorkspacePlanGenerationOptions,
  WorkspacePlanGenerationAutoPlanTriggeredRef,
  WorkspacePlanGenerationMessagesAction,
  WorkspacePlanGenerationRequestedPlansRef,
  WorkspacePlanGenerationRequestedProjects,
} from './workspace-orchestration-execution-types';
import type { WorkspaceChatMessage, WorkspaceProjectInfo } from './workspace-types';

const autoFoundationBeforePlanMessagePrefix = 'auto-foundation-before-plan-';

type WorkspacePlanGenerationFailureResult = {
  aborted: boolean;
};

type WorkspaceAutoFoundationBeforePlanResult = {
  completed: boolean;
};

function hasWorkspacePlanExecutionTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function hasWorkspacePlanExecutionProjectContext(projectInfo: WorkspaceProjectInfo): boolean {
  const hasDescription = hasWorkspacePlanExecutionTextValue(projectInfo.description);
  if (hasDescription === false) {
    return false;
  }

  const hasProjectId = hasWorkspacePlanExecutionTextValue(projectInfo.projectId);
  return hasProjectId === true;
}

function hasWorkspacePlanExecutionCompletedFoundation(messages: WorkspaceChatMessage[]): boolean {
  const hasCompletedFoundation = hasCompletedWorkspaceFoundation(messages);
  return hasCompletedFoundation === true;
}

function shouldSkipWorkspacePlanExecutionRequest({
  request,
  plannedProjectIdsRef,
  plannedProjectIdsAcrossMounts,
}: {
  request: PreparedPlanGenerationRequest;
  plannedProjectIdsRef: RunWorkspacePlanGenerationOptions['plannedProjectIdsRef'];
  plannedProjectIdsAcrossMounts: RunWorkspacePlanGenerationOptions['plannedProjectIdsAcrossMounts'];
}): boolean {
  const isReplan = request.isReplan === true;
  const isRetry = request.isRetry === true;
  const hasPlannedProjectInRef = plannedProjectIdsRef.current.has(request.projectId);
  if (hasPlannedProjectInRef === true) {
    return shouldSkipWorkspacePlanExecutionPreviouslyPlannedRequest({
      isReplan,
      isRetry,
    });
  }

  const hasPlannedProjectAcrossMounts = plannedProjectIdsAcrossMounts.has(request.projectId);
  if (hasPlannedProjectAcrossMounts === false) {
    return false;
  }

  return shouldSkipWorkspacePlanExecutionPreviouslyPlannedRequest({
    isReplan,
    isRetry,
  });
}

function shouldSkipWorkspacePlanExecutionPreviouslyPlannedRequest({
  isReplan,
  isRetry,
}: {
  isReplan: boolean;
  isRetry: boolean;
}): boolean {
  if (isReplan === true) {
    return false;
  }

  return isRetry === false;
}

function shouldResetWorkspacePlanExecutionRequestTracking(request: PreparedPlanGenerationRequest): boolean {
  const isReplan = request.isReplan === true;
  if (isReplan === true) {
    return true;
  }

  const isRetry = request.isRetry === true;
  return isRetry === true;
}

function shouldSupersedeWorkspacePlanExecutionMessages(request: PreparedPlanGenerationRequest): boolean {
  const shouldSupersede = request.isReplan === true;
  return shouldSupersede === true;
}

function hasWorkspacePlanGenerationFailureAborted(result: WorkspacePlanGenerationFailureResult): boolean {
  const hasAborted = result.aborted === true;
  return hasAborted === true;
}

function hasActiveAutoFoundationBeforePlanMessage(messages: WorkspaceChatMessage[]): boolean {
  for (const message of messages) {
    const hasMessagePrefix = message.id.startsWith(autoFoundationBeforePlanMessagePrefix);
    if (hasMessagePrefix === false) {
      continue;
    }
    const isStreaming = message.streaming === true;
    if (isStreaming === true) {
      return true;
    }
  }

  return false;
}

function getAutoFoundationBeforePlanErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    const hasMessage = message.length > 0;
    if (hasMessage === true) {
      return message;
    }
  }

  return '自动准备项目基础设定请求失败';
}

function materializeAutoFoundationBeforePlanMessage(
  messages: WorkspaceChatMessage[],
  messageId: string,
  patch: Partial<WorkspaceChatMessage>,
): WorkspaceChatMessage[] {
  const nextMessages: WorkspaceChatMessage[] = [];
  for (const message of messages) {
    if (message.id !== messageId) {
      nextMessages.push(message);
      continue;
    }
    nextMessages.push({
      ...message,
      ...patch,
    });
  }

  return nextMessages;
}

function buildAutoFoundationRetrySuggestedAction() {
  return {
    label: '重试自动准备项目基础设定',
    kind: 'retry_plan_generation' as const,
  };
}

async function runAutoFoundationBeforePlan({
  projectId,
  projectInfo,
  applyPlanGenerationMessages,
  autoPlanTriggeredRef,
  requestedPlansRef,
  requestedPlanProjectsAcrossMounts,
  safeParseJSON,
  normalizeWorkflowStep,
  resolveStepEngineeringState,
  applyWorkflowStepToMessage,
  setMessageStreamingState,
}: {
  projectId: string;
  projectInfo: WorkspaceProjectInfo;
  applyPlanGenerationMessages: WorkspacePlanGenerationMessagesAction;
  autoPlanTriggeredRef: WorkspacePlanGenerationAutoPlanTriggeredRef;
  requestedPlansRef: WorkspacePlanGenerationRequestedPlansRef;
  requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationRequestedProjects;
  safeParseJSON: RunWorkspacePlanGenerationOptions['safeParseJSON'];
  normalizeWorkflowStep: RunWorkspacePlanGenerationOptions['normalizeWorkflowStep'];
  resolveStepEngineeringState: RunWorkspacePlanGenerationOptions['resolveStepEngineeringState'];
  applyWorkflowStepToMessage: RunWorkspacePlanGenerationOptions['applyWorkflowStepToMessage'];
  setMessageStreamingState: RunWorkspacePlanGenerationOptions['setMessageStreamingState'];
}): Promise<WorkspaceAutoFoundationBeforePlanResult> {
  requestedPlansRef.current.delete(projectId);
  requestedPlanProjectsAcrossMounts.delete(projectId);
  autoPlanTriggeredRef.current = false;

  const messageId = `${autoFoundationBeforePlanMessagePrefix}${Date.now()}`;
  applyPlanGenerationMessages((prev) => {
    const hasActiveMessage = hasActiveAutoFoundationBeforePlanMessage(prev);
    if (hasActiveMessage === true) {
      return prev;
    }
    return [
      ...prev,
      {
        id: messageId,
        role: 'assistant',
        kind: 'workflow',
        content: '正在自动准备项目基础设定。普通项目会采用默认可执行决策并直接进入方案生成；只有出现无法自动判断的高风险冲突时才需要你补充信息。',
        timestamp: new Date(),
        streaming: true,
        statusContent: '正在自动准备项目基础设定...',
      },
    ];
  });

  let hasTerminalEvent = false;
  let completed = false;

  try {
    const response = await chatApi.generateStream({
      project_id: projectId,
      prompt: '请自动完成 Project Foundation：基于当前项目需求选择默认可执行决策，记录 must_decide_now / reserve_extension_now / defer_with_record 结论，并直接确认进入 Plan 阶段；只有存在无法自动判断的高风险冲突时才阻断并列出需要用户确认的事项。',
      mode: 'foundation',
      conversation_stage: 'bootstrap_confirmed',
      app_type: projectInfo.appType,
      project_name: projectInfo.projectName,
      idempotency_key: messageId,
    });

    await runSSEEventStream({
      response,
      safeParseJSON,
      unreadableMessage: '自动准备项目基础设定响应不可读取',
      unreadableSource: 'auto_foundation_before_plan',
      handlers: {
        step: (data) => {
          const step = normalizeWorkflowStep(data);
          if (step === null) return;
          applyWorkflowStepToMessage(messageId, step);
          const engineeringState = resolveStepEngineeringState(data);
          applyPlanGenerationMessages((prev) => materializeAutoFoundationBeforePlanMessage(
            prev,
            messageId,
            {
              engineeringState,
              statusContent: `${step.title}: ${step.status}`,
            },
          ));
        },
        done: (data) => {
          hasTerminalEvent = true;
          completed = true;
          const engineeringState = resolveStepEngineeringState(data);
          applyPlanGenerationMessages((prev) => materializeAutoFoundationBeforePlanMessage(
            prev,
            messageId,
            {
              streaming: false,
              statusContent: '项目基础设定已自动确认',
              content: '项目基础设定已自动确认，正在进入技术方案生成。',
              engineeringState,
            },
          ));
          setMessageStreamingState(messageId, false);
        },
        error: (data) => {
          hasTerminalEvent = true;
          completed = false;
          const message = typeof data.message === 'string' ? data.message : '自动准备项目基础设定失败';
          applyPlanGenerationMessages((prev) => materializeAutoFoundationBeforePlanMessage(
            prev,
            messageId,
            {
              streaming: false,
              statusContent: '项目基础设定自动处理失败',
              content: `项目基础设定自动处理失败：${message}。请重试自动准备；如果连续失败，请补充需求中的关键约束后再提交。`,
              suggestedActions: [buildAutoFoundationRetrySuggestedAction()],
            },
          ));
          setMessageStreamingState(messageId, false);
        },
      },
    });
  } catch (error) {
    const message = getAutoFoundationBeforePlanErrorMessage(error);
    applyPlanGenerationMessages((prev) => materializeAutoFoundationBeforePlanMessage(
      prev,
      messageId,
      {
        streaming: false,
        statusContent: '项目基础设定自动处理失败',
        content: `项目基础设定自动处理失败：${message}。请重试自动准备；如果连续失败，请补充需求中的关键约束后再提交。`,
        suggestedActions: [buildAutoFoundationRetrySuggestedAction()],
      },
    ));
    setMessageStreamingState(messageId, false);
    return { completed: false };
  }

  if (hasTerminalEvent === false) {
    applyPlanGenerationMessages((prev) => materializeAutoFoundationBeforePlanMessage(
      prev,
      messageId,
      {
        streaming: false,
        statusContent: '项目基础设定自动处理未完成',
        content: '项目基础设定自动处理未返回完成事件。请重试自动准备；如果连续失败，请补充需求中的关键约束后再提交。',
        suggestedActions: [buildAutoFoundationRetrySuggestedAction()],
      },
    ));
    setMessageStreamingState(messageId, false);
    return { completed: false };
  }

  return { completed };
}

export async function runWorkspacePlanGeneration({
  options,
  projectInfo,
  selectedModel,
  availablePlans,
  requestedPlanProjectsAcrossMounts,
  plannedProjectIdsAcrossMounts,
  messagesRef,
  planningAbortRef,
  planningProjectIdRef,
  autoPlanTriggeredRef,
  requestedPlansRef,
  plannedProjectIdsRef,
  applyPlanGenerationMessages,
  setIsPlanning,
  applyWorkspaceState,
  applyWorkflowStepToMessage,
  applyPlanStreamPatchMessages,
  setMessageStreamingState,
  safeParseJSON,
  appendReasoningChunk,
  appendReasoningLine,
  normalizeWorkflowStep,
  getEventMessage,
  getSuggestedQuestionsFromEvent,
  getSuggestedActionsFromEvent,
  enrichPlanMessageGuidance,
  supersedePlanSelectionMessages,
  resolveStepEngineeringState,
}: RunWorkspacePlanGenerationOptions) {
  const hasProjectContext = hasWorkspacePlanExecutionProjectContext(projectInfo);
  if (hasProjectContext === false) return;
  if (planningProjectIdRef.current === projectInfo.projectId) return;
  const hasCompletedFoundation = hasWorkspacePlanExecutionCompletedFoundation(messagesRef.current);
  if (hasCompletedFoundation === false) {
    planningProjectIdRef.current = projectInfo.projectId;
    setIsPlanning(true);
    let autoFoundationResult: WorkspaceAutoFoundationBeforePlanResult;
    try {
      autoFoundationResult = await runAutoFoundationBeforePlan({
        projectId: projectInfo.projectId,
        projectInfo,
        applyPlanGenerationMessages,
        autoPlanTriggeredRef,
        requestedPlansRef,
        requestedPlanProjectsAcrossMounts,
        safeParseJSON,
        normalizeWorkflowStep,
        resolveStepEngineeringState,
        applyWorkflowStepToMessage,
        setMessageStreamingState,
      });
    } finally {
      planningProjectIdRef.current = null;
      setIsPlanning(false);
    }
    if (autoFoundationResult.completed === false) {
      return;
    }
  }

  const request = preparePlanGenerationRequest(projectInfo, selectedModel, options, availablePlans, messagesRef);
  const shouldSkipRequest = shouldSkipWorkspacePlanExecutionRequest({
    request,
    plannedProjectIdsRef,
    plannedProjectIdsAcrossMounts,
  });
  if (shouldSkipRequest === true) {
    return;
  }

  const shouldResetTracking = shouldResetWorkspacePlanExecutionRequestTracking(request);
  if (shouldResetTracking === true) {
    resetRequestedPlanTracking(request.projectId, {
      requestedPlansRef,
      requestedPlanProjectsAcrossMounts,
      plannedProjectIdsRef,
      plannedProjectIdsAcrossMounts,
      autoPlanTriggeredRef,
    });
  }

  const shouldSupersedeMessages = shouldSupersedeWorkspacePlanExecutionMessages(request);
  if (shouldSupersedeMessages === true) {
    const supersededMessages = supersedePlanSelectionMessages(request.baseMessages);
    applyWorkspaceState(supersededMessages, {
      availablePlans: [],
      recommendedPlanId: null,
      selectedPlanId: null,
      planCountdown: 0,
      planAutoConfirmDeadlineAt: null,
      planSelectionReady: false,
    });
  }

  const { abortController, planMessageId } = beginPlanGenerationRequest(request.projectId, {
    planningAbortRef,
    planningProjectIdRef,
    setIsPlanning,
  });

  try {
    await executePlanGenerationRequest(request, {
      abortController,
      planMessageId,
    }, {
      appendReasoningChunk,
      appendReasoningLine,
      applyWorkspaceState,
      applyWorkflowStepToMessage,
      applyPlanStreamPatchMessages,
      autoPlanTriggeredRef,
      enrichPlanMessageGuidance,
      getEventMessage,
      getSuggestedActionsFromEvent,
      getSuggestedQuestionsFromEvent,
      messagesRef,
      normalizeWorkflowStep,
      plannedProjectIdsAcrossMounts,
      plannedProjectIdsRef,
      resolveStepEngineeringState,
      safeParseJSON,
      setMessageStreamingState,
      applyPlanGenerationMessages,
    });
  } catch (error) {
    const result = appendPlanGenerationFailureMessage({
      planMessageId,
      requestedPlanProjectsAcrossMounts,
      requestedPlansRef,
      setMessageStreamingState,
      applyPlanGenerationMessages,
    }, {
      error,
      projectId: request.projectId,
    });
    const hasAborted = hasWorkspacePlanGenerationFailureAborted(result);
    if (hasAborted === true) {
      return;
    }
  } finally {
    clearActivePlanRequest(request.projectId, {
      planningProjectIdRef,
      planningAbortRef,
      setIsPlanning,
    });
  }
}
