import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { Plan } from '@/lib/api';
import { resolveVisualContextForPlans } from '@/lib/visual-context';
import { toWorkspaceVisualAttachmentInputs } from './workspace-visual-attachments';
import { buildInitialChatAttachmentSnapshot, buildRejectedChatAttachmentSnapshot } from './workspace-chat-composer-snapshot';
import {
  hasCompletedWorkspaceFoundation,
  resolveLatestWorkspaceBootstrapState,
  type WorkspaceBootstrapState,
} from '@/lib/workspace/engineering-state';
import { formatCapabilityAuditLocalError } from '@/lib/workspace/capability-audit-local-errors';
import {
  updateCapabilityAuditProfileSearch,
  updateCapabilityAuditReasonSearch,
  updateCapabilityAuditStatusSearch,
} from '@/lib/workspace/capability-audit-diagnostics';

import {
  getWorkspaceRecommendedPlan,
  resolvePendingPlanIntent,
  resolveReferencedPlan,
} from './workspace-plan-message-helpers';
import type {
  ChoosePlanOptions,
  UpdatePlanFlowState,
} from './workspace-orchestration-flow-types';
import type { GenerateOptions } from './workspace-orchestration-hook-types';
import type { WorkspaceAttachment } from './workspace-page-local-state-contract';
import type { WorkspacePageUiModel } from './workspace-page-ui-contract';
import type { PlanRequestOptions } from './workspace-plan-generation';
import type {
  WorkspaceFoundationDecisionConfirmation,
  WorkspacePromptActionsContract,
} from './workspace-prompt-actions-contract';
import type {
  ChatAttachmentSnapshot,
  ChatMode,
  GuidanceAction,
  WorkspaceEditorNavigationTarget,
  WorkspaceGenerationMode,
  WorkspaceChatMessage,
  WorkspaceProjectInfo,
} from './workspace-types';

export type FoundationActionStage = 'bootstrap' | 'bootstrap_review' | 'bootstrap_confirmed';

export type FoundationAction = {
  stage: FoundationActionStage;
  label: string;
  prompt: string;
  statusLabel: string;
};

export type FoundationDecisionBucket = 'must_decide_now' | 'reserve_extension_now' | 'defer_with_record';

function getFoundationBlockedStatusLabel(status: string | undefined): string {
  const isBlockedStatus = status === 'blocked';
  if (isBlockedStatus === true) {
    return '已阻断';
  }
  return '待确认';
}

function resolveFoundationAction(messages: WorkspaceChatMessage[]): FoundationAction {
  const foundationState = resolveLatestWorkspaceBootstrapState(messages);
  const foundationStatus = getWorkspaceFoundationStatus(foundationState);

  switch (foundationStatus) {
    case 'collecting_decisions':
      return {
        stage: 'bootstrap_review' as const,
        label: '检查基础设定',
        prompt: '请进入 Project Foundation review，检查 must_decide_now 决策、阻断项和下一步确认动作。',
        statusLabel: '决策收集中',
      };
    case 'awaiting_confirmation':
    case 'blocked':
      return {
        stage: 'bootstrap_confirmed' as const,
        label: '确认基础设定',
        prompt: '请将当前 Project Foundation 视为已确认，输出最终确认结果，并准备进入下一阶段。',
        statusLabel: getFoundationBlockedStatusLabel(foundationStatus),
      };
    case 'completed':
      return {
        stage: 'bootstrap_confirmed' as const,
        label: '重跑基础设定',
        prompt: '请重新确认当前 Project Foundation 结果，并输出最新的阶段结论与后续动作。',
        statusLabel: '已完成',
      };
    default:
      return {
        stage: 'bootstrap_confirmed' as const,
        label: '自动准备基础设定',
        prompt: '请自动完成 Project Foundation：基于当前项目需求选择默认可执行决策，记录 must_decide_now / reserve_extension_now / defer_with_record 结论，并直接确认进入 Plan 阶段；只有存在无法自动判断的高风险冲突时才阻断并列出需要用户确认的事项。',
        statusLabel: '未开始',
      };
  }
}

export type FoundationDecisionDraft = {
  id: string;
  title: string;
  bucket: FoundationDecisionBucket;
  selectedOption: string;
  notes?: string;
};

export type FoundationDecisionDraftList = FoundationDecisionDraft[];

export type FoundationDecisionDraftGroup = {
  title: string;
  bucket: FoundationDecisionBucket;
};

export type FoundationDecisionDraftGroupList = FoundationDecisionDraftGroup[];

function getWorkspaceFoundationStatus(foundationState: WorkspaceBootstrapState | undefined): string | undefined {
  if (foundationState === undefined) {
    return undefined;
  }

  return foundationState.status;
}

function normalizeFoundationDecisionInputValue(value: string | undefined): string {
  const hasValue = value !== undefined;
  if (hasValue === false) {
    return '';
  }
  return value.trim();
}

function getFoundationDecisionDraftTitle(decisionTitle: string, decisionId: string): string {
  const hasDecisionTitle = decisionTitle.length > 0;
  if (hasDecisionTitle === true) {
    return decisionTitle;
  }
  return decisionId;
}

function getFoundationDecisionDraftSelectedOption(selectedOption: string): string {
  const hasSelectedOption = selectedOption.length > 0;
  if (hasSelectedOption === true) {
    return selectedOption;
  }
  return '按工作台当前建议确认';
}

function getFoundationDecisionDraftNotes(notes: string): string | undefined {
  const hasNotes = notes.length > 0;
  if (hasNotes === true) {
    return notes;
  }
  return undefined;
}

function hasFoundationDecisionPromptNotes(notes: string | undefined): notes is string {
  if (notes === undefined) {
    return false;
  }

  const hasNotes = notes.length > 0;
  return hasNotes === true;
}

function normalizeFoundationDecisionDraft(
  decision: WorkspaceFoundationDecisionConfirmation,
): FoundationDecisionDraft | null {
  const decisionId = typeof decision.id === 'string' ? decision.id.trim() : '';
  const hasDecisionId = decisionId.length > 0;
  if (hasDecisionId === false) return null;

  const decisionTitle = normalizeFoundationDecisionInputValue(decision.title);
  const selectedOption = normalizeFoundationDecisionInputValue(decision.selectedOption);
  const notes = normalizeFoundationDecisionInputValue(decision.notes);

  return {
    id: decisionId,
    title: getFoundationDecisionDraftTitle(decisionTitle, decisionId),
    bucket: decisionBucketToDraftBucket(decision.bucket),
    selectedOption: getFoundationDecisionDraftSelectedOption(selectedOption),
    notes: getFoundationDecisionDraftNotes(notes),
  };
}

function shouldRenderFoundationDecisionPromptGroup(items: FoundationDecisionDraftList): boolean {
  const hasItems = items.length > 0;
  return hasItems === true;
}

function getFoundationDecisionPromptGroupItems(
  drafts: FoundationDecisionDraftList,
  bucket: FoundationDecisionBucket,
): FoundationDecisionDraftList {
  const items: FoundationDecisionDraftList = [];
  for (const draft of drafts) {
    const hasTargetBucket = draft.bucket === bucket;
    if (hasTargetBucket === true) {
      items.push(draft);
    }
  }

  return items;
}

function getFoundationDecisionPromptLine(draft: FoundationDecisionDraft): string {
  const notes = draft.notes;
  const hasNotes = hasFoundationDecisionPromptNotes(notes);
  if (hasNotes === true) {
    return `- ${draft.title} (${draft.id}): ${draft.selectedOption}；备注：${notes}`;
  }
  return `- ${draft.title} (${draft.id}): ${draft.selectedOption}`;
}

function buildFoundationDecisionPrompt(drafts: FoundationDecisionDraftList) {
  const sections = [
    '请确认当前项目基础设定决策，并基于以下工作台选择输出最终确认结果，准备进入下一阶段。',
  ];

  const groupedDrafts: FoundationDecisionDraftGroupList = [
    { title: 'Must Decide Now', bucket: 'must_decide_now' },
    { title: 'Reserve Extension Now', bucket: 'reserve_extension_now' },
    { title: 'Defer With Record', bucket: 'defer_with_record' },
  ];

  for (const group of groupedDrafts) {
    const items = getFoundationDecisionPromptGroupItems(drafts, group.bucket);
    const shouldRenderGroup = shouldRenderFoundationDecisionPromptGroup(items);
    if (shouldRenderGroup === false) {
      continue;
    }

    sections.push(`${group.title}:`);
    for (const draft of items) {
      sections.push(getFoundationDecisionPromptLine(draft));
    }
  }

  sections.push('请将 must_decide_now 视为已确认，并给出 Gate 结论与下一步。');
  return sections.join('\n');
}

function getFoundationDecisionDrafts(
  decisions: WorkspaceFoundationDecisionConfirmation[],
): FoundationDecisionDraftList {
  const drafts: FoundationDecisionDraftList = [];
  for (const decision of decisions) {
    const draft = normalizeFoundationDecisionDraft(decision);
    if (draft !== null) {
      drafts.push(draft);
    }
  }

  return drafts;
}

function decisionBucketToDraftBucket(bucket?: string): FoundationDecisionBucket {
  switch (bucket) {
    case 'reserve_extension_now':
      return 'reserve_extension_now';
    case 'defer_with_record':
      return 'defer_with_record';
    default:
      return 'must_decide_now';
  }
}

function normalizeRecoveryMode(mode?: string): WorkspaceGenerationMode {
  switch (mode) {
    case 'foundation':
      return 'foundation';
    case 'discuss':
      return 'discuss';
    case 'implement':
      return 'implement';
    default:
      return 'implement';
  }
}

function getGuidanceActionPrompt(action: GuidanceAction): string {
  return normalizeFoundationDecisionInputValue(action.prompt);
}

function getRecoveryStageLabel(action: GuidanceAction): string {
  const stage = action.conversationStage;
  const hasStage = stage !== undefined;
  if (hasStage === false) {
    return '';
  }
  return stage;
}

function getRecoveryInitialReasoningContent(recoveryStageLabel: string): string {
  const hasRecoveryStageLabel = recoveryStageLabel.length > 0;
  if (hasRecoveryStageLabel === true) {
    return `正在恢复 ${recoveryStageLabel} 阶段...`;
  }
  return '正在恢复 当前 阶段...';
}

function getFoundationStartPrompt(input: string, action: FoundationAction): string {
  const prompt = input.trim();
  const hasPrompt = prompt.length > 0;
  if (hasPrompt === true) {
    return prompt;
  }
  return action.prompt;
}

function shouldUseSendPromptAction(action: GuidanceAction): boolean {
  const isSendPromptAction = action.kind === 'send_prompt';
  const prompt = getGuidanceActionPrompt(action);
  const hasPrompt = prompt.length > 0;
  if (isSendPromptAction === false) {
    return false;
  }

  return hasPrompt === true;
}

function hasWorkspacePromptBusyGeneration({
  isGenerating,
  isPlanning,
}: {
  isGenerating: boolean;
  isPlanning: boolean;
}): boolean {
  if (isGenerating === true) {
    return true;
  }

  return isPlanning === true;
}

function shouldBlockWorkspacePromptSubmit({
  hasContent,
  hasBusyGeneration,
}: {
  hasContent: boolean;
  hasBusyGeneration: boolean;
}): boolean {
  if (hasContent === false) {
    return true;
  }

  return hasBusyGeneration === true;
}

function hasWorkspacePromptProjectPlanId(projectInfo: WorkspaceProjectInfo | null): boolean {
  if (projectInfo === null) {
    return false;
  }

  if (projectInfo.planId === undefined) {
    return false;
  }

  return projectInfo.planId !== null;
}

function hasWorkspacePromptProjectPlanData(projectInfo: WorkspaceProjectInfo | null): boolean {
  if (projectInfo === null) {
    return false;
  }

  if (projectInfo.planData === undefined) {
    return false;
  }

  return projectInfo.planData !== null;
}

function isWorkspacePromptPlanSelectionPending({
  hasAvailablePlans,
  hasSelectedPlan,
}: {
  hasAvailablePlans: boolean;
  hasSelectedPlan: boolean;
}): boolean {
  if (hasAvailablePlans === false) {
    return false;
  }

  return hasSelectedPlan === false;
}

function needsWorkspacePromptPlanBeforeImplementation({
  foundationCompleted,
  isPlanSelectionPending,
  hasProjectPlanId,
  hasProjectPlanData,
  hasSelectedPlan,
}: {
  foundationCompleted: boolean;
  isPlanSelectionPending: boolean;
  hasProjectPlanId: boolean;
  hasProjectPlanData: boolean;
  hasSelectedPlan: boolean;
}): boolean {
  if (foundationCompleted === false) {
    return false;
  }

  if (isPlanSelectionPending === true) {
    return false;
  }

  if (hasProjectPlanId === true) {
    return false;
  }

  if (hasProjectPlanData === true) {
    return false;
  }

  return hasSelectedPlan === false;
}

function hasWorkspacePromptReferencedPlanForContext(plan: Plan | null | undefined): plan is Plan {
  if (plan === null) {
    return false;
  }

  return plan !== undefined;
}

function isWorkspacePromptRepairNavigationAction(action: GuidanceAction): boolean {
  if (action.kind === 'open_validation_failure') {
    return true;
  }

  return action.kind === 'open_context_repair';
}

function getWorkspacePromptNavigationTarget(
  action: GuidanceAction,
): WorkspaceEditorNavigationTarget | undefined {
  return action.navigationTarget;
}

function canOpenWorkspacePromptRepairNavigation(action: GuidanceAction): boolean {
  const isRepairNavigationAction = isWorkspacePromptRepairNavigationAction(action);
  if (isRepairNavigationAction === false) {
    return false;
  }

  const navigationTarget = getWorkspacePromptNavigationTarget(action);
  return navigationTarget !== undefined;
}

function isWorkspacePromptRetryGateAction(action: GuidanceAction): boolean {
  if (action.kind === 'retry_context_gate') {
    return true;
  }

  return action.kind === 'retry_workflow_gate';
}

function canRunWorkspacePromptRetryGateAction({
  isRetryGateAction,
  hasActionPrompt,
}: {
  isRetryGateAction: boolean;
  hasActionPrompt: boolean;
}): boolean {
  if (isRetryGateAction === false) {
    return false;
  }

  return hasActionPrompt === true;
}

type UseWorkspacePromptActionsOptions = {
  input: string;
  chatMode: ChatMode;
  isOnline: boolean;
  isGenerating: boolean;
  isPlanning: boolean;
  availablePlans: Plan[];
  recommendedPlanId: string | null;
  selectedPlanId: string | null;
  selectedModel: string;
  availableModels: WorkspacePageUiModel[];
  attachedFiles: WorkspaceAttachment[];
  projectInfo: WorkspaceProjectInfo | null;
  messagesRef: MutableRefObject<WorkspaceChatMessage[]>;
  focusedPlanIdRef: MutableRefObject<string | null>;
  autoPlanTriggeredRef: MutableRefObject<boolean>;
  setInput: Dispatch<SetStateAction<string>>;
  setAttachedFiles: Dispatch<SetStateAction<WorkspaceAttachment[]>>;
  setChatAttachmentSnapshot: Dispatch<SetStateAction<ChatAttachmentSnapshot>>;
  applyPromptInteractionMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  updatePlanFlowState: UpdatePlanFlowState;
  buildPlanDiscussionPrompt: (prompt: string) => string;
  choosePlanAndImplement: (plan: Plan, options?: ChoosePlanOptions) => Promise<void>;
  handleLLMGenerate: (
    prompt: string,
    targetProject?: WorkspaceProjectInfo,
    options?: GenerateOptions,
  ) => Promise<void>;
  requestPlansForProject: (options?: PlanRequestOptions) => Promise<void>;
  onRefreshExplorerPanel: () => void | Promise<void>;
  onOpenExplorerPanel: () => void;
  onOpenGitPanel: () => void;
  onOpenCapabilityAudit: () => void;
  onOpenValidationFailure: (target: WorkspaceEditorNavigationTarget) => void | Promise<void>;
  onOpenFoundationPanel: () => void;
};

export function useWorkspacePromptActions({
  input,
  chatMode,
  isOnline,
  isGenerating,
  isPlanning,
  availablePlans,
  recommendedPlanId,
  selectedPlanId,
  selectedModel,
  availableModels,
  attachedFiles,
  projectInfo,
  messagesRef,
  focusedPlanIdRef,
  autoPlanTriggeredRef,
  setInput,
  setAttachedFiles,
  setChatAttachmentSnapshot,
  applyPromptInteractionMessages,
  updatePlanFlowState,
  buildPlanDiscussionPrompt,
  choosePlanAndImplement,
  handleLLMGenerate,
  requestPlansForProject,
  onRefreshExplorerPanel,
  onOpenExplorerPanel,
  onOpenGitPanel,
  onOpenCapabilityAudit,
  onOpenValidationFailure,
  onOpenFoundationPanel,
}: UseWorkspacePromptActionsOptions): WorkspacePromptActionsContract {
  const [foundationAction, setFoundationAction] = useState<FoundationAction>(() => resolveFoundationAction([]));

  // Keep this as a post-render ref snapshot sync; the state setter below avoids update loops.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const nextAction = resolveFoundationAction(messagesRef.current);
    setFoundationAction((previousAction) => (
      previousAction.stage === nextAction.stage
      && previousAction.label === nextAction.label
      && previousAction.prompt === nextAction.prompt
      && previousAction.statusLabel === nextAction.statusLabel
        ? previousAction
        : nextAction
    ));
  });

  const submitPrompt = useCallback(async (rawPrompt: string) => {
    const visualAttachments = toWorkspaceVisualAttachmentInputs(attachedFiles);
    const hasVisualAttachments = visualAttachments.length > 0;
    const requestVisualAttachments = hasVisualAttachments === true ? visualAttachments : undefined;
    const reusableVisualContext = resolveVisualContextForPlans(
      availablePlans,
      selectedPlanId,
      recommendedPlanId,
    );
    const requestVisualContext = hasVisualAttachments === true ? undefined : reusableVisualContext;
    const prompt = rawPrompt.trim() || visualPromptFallback(attachedFiles);
    const hasContent = prompt.length > 0 || hasVisualAttachments;
    const hasBusyGeneration = hasWorkspacePromptBusyGeneration({
      isGenerating,
      isPlanning,
    });
    const shouldBlockSubmit = shouldBlockWorkspacePromptSubmit({
      hasContent,
      hasBusyGeneration,
    });
    if (shouldBlockSubmit === true) return;
    if (
      hasVisualAttachments === true
      && selectedWorkspaceModelSupportsVision(availableModels, selectedModel) === false
    ) {
      setChatAttachmentSnapshot(buildRejectedChatAttachmentSnapshot({
        attachmentCount: attachedFiles.length,
        totalSize: getWorkspacePromptAttachmentTotalSize(attachedFiles),
        message: '当前模型不支持图片输入。请选择标记为支持视觉的模型后再发送。',
        source: 'user_action',
      }));
      return;
    }

    const latestMessages = messagesRef.current;
    const foundationCompleted = hasCompletedWorkspaceFoundation(latestMessages);
    const needsFoundationFirst = foundationCompleted === false;
    const hasAvailablePlans = availablePlans.length > 0;
    const hasSelectedPlan = selectedPlanId !== null;
    const hasProjectPlanId = hasWorkspacePromptProjectPlanId(projectInfo);
    const hasProjectPlanData = hasWorkspacePromptProjectPlanData(projectInfo);
    const isPlanSelectionPending = isWorkspacePromptPlanSelectionPending({
      hasAvailablePlans,
      hasSelectedPlan,
    });
    const needsPlanBeforeImplementation = needsWorkspacePromptPlanBeforeImplementation({
      foundationCompleted,
      isPlanSelectionPending,
      hasProjectPlanId,
      hasProjectPlanData,
      hasSelectedPlan,
    });
    const userMessage: WorkspaceChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date(),
      attachments: hasVisualAttachments === true
        ? materializeWorkspacePromptMessageAttachments(attachedFiles)
        : undefined,
    };

    setInput('');
    const completeVisualSubmission = (succeeded: boolean) => {
      if (hasVisualAttachments === false || succeeded === false) {
        return;
      }
      setAttachedFiles([]);
      setChatAttachmentSnapshot(buildInitialChatAttachmentSnapshot());
    };

    if (needsFoundationFirst === true) {
      const nextMessages = [...latestMessages, userMessage];

      updatePlanFlowState({
        availablePlans: [],
        recommendedPlanId: null,
        selectedPlanId: null,
        planSelectionReady: false,
        planCountdown: 0,
        planAutoConfirmDeadlineAt: null,
      });
      applyPromptInteractionMessages(nextMessages);

      await requestPlansForProject({
        force: true,
        userFeedback: prompt,
        baseMessages: nextMessages,
        visualAttachments: requestVisualAttachments,
        visualContext: requestVisualContext,
        onTerminal: completeVisualSubmission,
      });
      return;
    }

    if (isPlanSelectionPending === true) {
      const nextMessages = [...latestMessages, userMessage];
      autoPlanTriggeredRef.current = false;
      updatePlanFlowState({
        planCountdown: 0,
        planAutoConfirmDeadlineAt: null,
      });
      applyPromptInteractionMessages(nextMessages);

      if (hasVisualAttachments === true) {
        await requestPlansForProject({
          force: true,
          userFeedback: prompt,
          baseMessages: nextMessages,
          visualAttachments: requestVisualAttachments,
          visualContext: requestVisualContext,
          onTerminal: completeVisualSubmission,
        });
        focusedPlanIdRef.current = null;
        return;
      }

      const referencedPlanForContext = resolveReferencedPlan(prompt, availablePlans);
      const hasReferencedPlanForContext = hasWorkspacePromptReferencedPlanForContext(referencedPlanForContext);
      if (hasReferencedPlanForContext === true) {
        focusedPlanIdRef.current = referencedPlanForContext.id;
      } else if (/(推荐方案|默认方案|按推荐|采用推荐|推荐的|就推荐)/i.test(prompt)) {
        focusedPlanIdRef.current = recommendedPlanId;
      }

      const intentResult = resolvePendingPlanIntent(prompt, availablePlans, recommendedPlanId, focusedPlanIdRef.current);

      if (intentResult.intent === 'confirm') {
        await choosePlanAndImplement(intentResult.plan, {
          baseMessages: nextMessages,
          confirmationSource: 'confirmed',
        });
        return;
      }

      if (intentResult.intent === 'discuss') {
        await handleLLMGenerate(prompt, undefined, {
          mode: 'discuss',
          online: isOnline,
          conversationStage: 'plan-selection',
          planContext: buildPlanDiscussionPrompt(prompt),
          visualContext: requestVisualContext,
        });
        return;
      }

      if (intentResult.intent === 'clarify') {
        applyPromptInteractionMessages((prev) => [
          ...prev,
          {
            id: `plan-clarify-${Date.now()}`,
            role: 'assistant',
            content: intentResult.message,
            timestamp: new Date(),
          },
        ]);
        return;
      }

      await requestPlansForProject({
        force: true,
        userFeedback: prompt,
        baseMessages: nextMessages,
        visualAttachments: requestVisualAttachments,
        visualContext: requestVisualContext,
        onTerminal: completeVisualSubmission,
      });
      focusedPlanIdRef.current = null;
      return;
    }

    if (needsPlanBeforeImplementation === true) {
      const nextMessages = [...latestMessages, userMessage];
      applyPromptInteractionMessages(nextMessages);
      await requestPlansForProject({
        force: true,
        userFeedback: prompt,
        baseMessages: nextMessages,
        visualAttachments: requestVisualAttachments,
        visualContext: requestVisualContext,
        onTerminal: completeVisualSubmission,
      });
      return;
    }

    applyPromptInteractionMessages((prev) => [...prev, userMessage]);
    await handleLLMGenerate(prompt, undefined, {
      mode: chatMode,
      online: isOnline,
      visualAttachments: requestVisualAttachments,
      visualContext: requestVisualContext,
      onTerminal: completeVisualSubmission,
    });
  }, [
    attachedFiles,
    autoPlanTriggeredRef,
    availableModels,
    availablePlans,
    buildPlanDiscussionPrompt,
    chatMode,
    choosePlanAndImplement,
    focusedPlanIdRef,
    handleLLMGenerate,
    isGenerating,
    isOnline,
    isPlanning,
    messagesRef,
    projectInfo,
    recommendedPlanId,
    requestPlansForProject,
    selectedModel,
    selectedPlanId,
    setAttachedFiles,
    setChatAttachmentSnapshot,
    setInput,
    applyPromptInteractionMessages,
    updatePlanFlowState,
  ]);

  const handleGenerate = useCallback(async () => {
    await submitPrompt(input);
  }, [input, submitPrompt]);

  const handleSuggestedQuestion = useCallback(async (question: string) => {
    await submitPrompt(question);
  }, [submitPrompt]);

  const handleSuggestedAction = useCallback(async (action: GuidanceAction) => {
    const canOpenRepairNavigation = canOpenWorkspacePromptRepairNavigation(action);
    if (canOpenRepairNavigation === true) {
      const navigationTarget = getWorkspacePromptNavigationTarget(action);
      if (navigationTarget !== undefined) {
        await onOpenValidationFailure(navigationTarget);
      }
      return;
    }

    if (action.kind === 'open_foundation_panel') {
      await requestPlansForProject({
        retry: true,
        baseMessages: messagesRef.current,
      });
      return;
    }

    if (action.kind === 'refresh_explorer_panel') {
      await onRefreshExplorerPanel();
      return;
    }

    if (action.kind === 'open_explorer_panel') {
      onOpenExplorerPanel();
      return;
    }

    if (action.kind === 'open_git_panel') {
      onOpenGitPanel();
      return;
    }

    if (action.kind === 'open_capability_audit') {
      if (typeof window !== 'undefined') {
        const blockedSearch = updateCapabilityAuditStatusSearch(window.location.search, 'blocked');
        const profileSearch = action.capabilityAuditProfile
          ? updateCapabilityAuditProfileSearch(blockedSearch, action.capabilityAuditProfile)
          : blockedSearch;
        const nextSearch = action.capabilityAuditReasonCode
          ? updateCapabilityAuditReasonSearch(profileSearch, action.capabilityAuditReasonCode)
          : profileSearch;
        const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
        try {
          window.history.replaceState(window.history.state, '', nextUrl);
        } catch (error) {
          const reason = formatCapabilityAuditLocalError(error, '浏览器拒绝更新地址栏', 'browser_history');
          applyPromptInteractionMessages((prev) => [...prev, {
            id: `capability-audit-url-sync-failed-${Date.now()}`,
            role: 'assistant',
            content: `Capability Audit 定位参数写入失败：${reason}。已打开 Debug 面板，但地址栏未写入 blocked/profile/reason 定位参数；Capability Audit 可能仍展示旧筛选或全部记录，请在面板内手动选择 blocked、Profile 或 Reason 筛选继续排查。`,
            timestamp: new Date(),
          }]);
        }
      }
      onOpenCapabilityAudit();
      return;
    }

    if (action.kind === 'confirm_recommended_plan') {
      const recommendedPlan = getWorkspaceRecommendedPlan(availablePlans, recommendedPlanId);
      if (recommendedPlan === undefined) return;
      await choosePlanAndImplement(recommendedPlan, { confirmationSource: 'confirmed' });
      return;
    }

    if (action.kind === 'retry_plan_generation') {
      await requestPlansForProject({
        retry: true,
        baseMessages: messagesRef.current,
      });
      return;
    }

    const isRetryGateAction = isWorkspacePromptRetryGateAction(action);
    const actionPrompt = getGuidanceActionPrompt(action);
    const hasActionPrompt = actionPrompt.length > 0;
    const canRunRetryGateAction = canRunWorkspacePromptRetryGateAction({
      isRetryGateAction,
      hasActionPrompt,
    });
    if (canRunRetryGateAction === true) {
      const hasBusyGeneration = hasWorkspacePromptBusyGeneration({
        isGenerating,
        isPlanning,
      });
      if (hasBusyGeneration === true) return;

      const prompt = actionPrompt;

      applyPromptInteractionMessages((prev) => [...prev, {
        id: `user-gate-retry-${Date.now()}`,
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      }]);

      const recoveryStageLabel = getRecoveryStageLabel(action);

      await handleLLMGenerate(prompt, undefined, {
        mode: normalizeRecoveryMode(action.mode),
        online: isOnline,
        conversationStage: action.conversationStage,
        initialReasoningContent: getRecoveryInitialReasoningContent(recoveryStageLabel),
      });
      return;
    }

    const shouldSendPrompt = shouldUseSendPromptAction(action);
    if (shouldSendPrompt === true) {
      await submitPrompt(getGuidanceActionPrompt(action));
    }
  }, [
    availablePlans,
    choosePlanAndImplement,
    handleLLMGenerate,
    isGenerating,
    isOnline,
    isPlanning,
    messagesRef,
    onOpenCapabilityAudit,
    onOpenExplorerPanel,
    onOpenFoundationPanel,
    onOpenGitPanel,
    onRefreshExplorerPanel,
    onOpenValidationFailure,
    recommendedPlanId,
    requestPlansForProject,
    applyPromptInteractionMessages,
    submitPrompt,
  ]);

  const handleStartFoundation = useCallback(async () => {
    const hasBusyGeneration = hasWorkspacePromptBusyGeneration({
      isGenerating,
      isPlanning,
    });
    if (hasBusyGeneration === true) return;

    const nextAction = resolveFoundationAction(messagesRef.current);
    const prompt = getFoundationStartPrompt(input, nextAction);

    setInput('');
    applyPromptInteractionMessages((prev) => [...prev, {
      id: `user-foundation-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    }]);

    await handleLLMGenerate(prompt, undefined, {
      mode: 'foundation',
      online: isOnline,
      conversationStage: nextAction.stage,
      initialReasoningContent: `正在进入 ${nextAction.label}...`,
    });
  }, [
    handleLLMGenerate,
    input,
    isGenerating,
    isOnline,
    isPlanning,
    messagesRef,
    setInput,
    applyPromptInteractionMessages,
  ]);

  const handleConfirmFoundationDecisions = useCallback(async (
    decisions: WorkspaceFoundationDecisionConfirmation[],
  ) => {
    const hasBusyGeneration = hasWorkspacePromptBusyGeneration({
      isGenerating,
      isPlanning,
    });
    if (hasBusyGeneration === true) return;

    const drafts = getFoundationDecisionDrafts(decisions);
    const hasDrafts = drafts.length > 0;
    if (hasDrafts === false) return;

    const prompt = buildFoundationDecisionPrompt(drafts);

    applyPromptInteractionMessages((prev) => [...prev, {
      id: `user-foundation-confirm-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    }]);

    await handleLLMGenerate(prompt, undefined, {
      mode: 'foundation',
      online: isOnline,
      conversationStage: 'bootstrap_confirmed',
      initialReasoningContent: '正在根据工作台决策确认 Project Foundation...',
    });
  }, [
    handleLLMGenerate,
    isGenerating,
    isOnline,
    isPlanning,
    applyPromptInteractionMessages,
  ]);

  return {
    submitPrompt,
    handleGenerate,
    handleSuggestedQuestion,
    handleSuggestedAction,
    handleStartFoundation,
    handleConfirmFoundationDecisions,
    foundationActionLabel: foundationAction.label,
    foundationStatusLabel: foundationAction.statusLabel,
  };
}

function getWorkspacePromptAttachmentTotalSize(attachments: WorkspaceAttachment[]): number {
  let totalSize = 0;
  for (const attachment of attachments) totalSize += attachment.size;
  return totalSize;
}

function materializeWorkspacePromptMessageAttachments(
  attachments: WorkspaceAttachment[],
): WorkspaceChatMessage['attachments'] {
  const messageAttachments: NonNullable<WorkspaceChatMessage['attachments']> = [];
  for (const attachment of attachments) {
    messageAttachments.push({
      name: attachment.name,
      size: attachment.size,
      type: attachment.type,
      dataUrl: attachment.dataUrl,
    });
  }
  return messageAttachments;
}

function selectedWorkspaceModelSupportsVision(
  models: WorkspacePageUiModel[],
  selectedModel: string,
): boolean {
  for (const model of models) {
    if (model.id === selectedModel) {
      return model.supportsVision === true;
    }
  }
  return false;
}


function visualPromptFallback(attachments: WorkspaceAttachment[]): string {
  if (attachments.length > 0) {
    return '请根据附带的视觉参考继续当前任务。';
  }
  return '';
}
