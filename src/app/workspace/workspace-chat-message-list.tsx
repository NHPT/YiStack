'use client';

import type { ReactNode } from 'react';
import {
  ArrowDown,
  Sparkles,
} from 'lucide-react';

import { ChatMessageContent } from '@/components/workspace/chat-message-content';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import type {
  WorkspaceChatExampleClickAction,
  WorkspaceChatMessagesProps,
} from './workspace-chat-panel-types';
import type { WorkspaceChatMessage, WorkspaceChatMessageKind } from './workspace-types';
import { PlanSelectionMessage } from './workspace-chat-plan-selection';

type WorkspaceChatMessageListExampleList = string[];
type WorkspaceChatMessageListExampleNodeList = ReactNode[];
type WorkspaceChatMessageListMessageNodeList = ReactNode[];
type WorkspaceChatMessageListPlanSelectionAction = WorkspaceChatMessagesProps['onSelectPlan'];
type WorkspaceChatMessageListQuestionAction = WorkspaceChatMessagesProps['onAskQuestion'];
type WorkspaceChatMessageListGuidanceAction = WorkspaceChatMessagesProps['onRunAction'];
type WorkspaceChatMessageListRestoreCommitAction = WorkspaceChatMessagesProps['onRestoreCommit'];
type WorkspaceChatMessageListViewCommitAction = WorkspaceChatMessagesProps['onViewCommit'];
type WorkspaceChatMessageListOpenFileAction = WorkspaceChatMessagesProps['onOpenFile'];

type WorkspaceChatMessageListNodeMaterializerInput = {
  messages: WorkspaceChatMessage[];
  planCountdown: number;
  planSelectionReady: boolean;
  selectedPlanId: string | null;
  isBusyGenerating: boolean;
  messageBubblePaddingClassName: string;
  timestampClassName: string;
  onSelectPlan: WorkspaceChatMessageListPlanSelectionAction;
  onAskQuestion: WorkspaceChatMessageListQuestionAction;
  onRunAction: WorkspaceChatMessageListGuidanceAction;
  onRestoreCommit: WorkspaceChatMessageListRestoreCommitAction;
  onViewCommit: WorkspaceChatMessageListViewCommitAction;
  onOpenFile: WorkspaceChatMessageListOpenFileAction;
};

function hasWorkspaceChatMessageListStreamingKind(
  messages: WorkspaceChatMessage[],
  kind: WorkspaceChatMessageKind,
): boolean {
  for (const message of messages) {
    const hasKind = message.kind === kind;
    if (hasKind === false) {
      continue;
    }

    const isStreaming = message.streaming === true;
    if (isStreaming === true) {
      return true;
    }
  }

  return false;
}

function hasWorkspaceChatMessageListKind(
  messages: WorkspaceChatMessage[],
  kind: WorkspaceChatMessageKind,
): boolean {
  for (const message of messages) {
    const hasKind = message.kind === kind;
    if (hasKind === true) {
      return true;
    }
  }

  return false;
}

function getWorkspaceChatMessageListExamples(compact: boolean): WorkspaceChatMessageListExampleList {
  if (compact === true) {
    return ['做一个 AI Agent 平台', '做一个后台管理系统', '做一个内部工具'];
  }

  return ['做一个 AI Agent 平台，先完成 Foundation', '做一个后台管理系统，先完成前置设计', '做一个内部工具，先梳理关键工程决策'];
}

function getWorkspaceChatMessageListTextValue(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }
  return value.trim();
}

function isWorkspaceChatMessageListAutoFoundationNotice(message: WorkspaceChatMessage): boolean {
  if (message.kind !== 'workflow') {
    return false;
  }

  const content = getWorkspaceChatMessageListTextValue(message.content);
  const statusContent = getWorkspaceChatMessageListTextValue(message.statusContent);
  const combined = `${content}\n${statusContent}`;
  const hasFoundationAutoNotice = combined.includes('项目基础设定') || combined.includes('Project Foundation');
  if (hasFoundationAutoNotice === false) {
    return false;
  }

  const hasActionableFailure = combined.includes('失败') || combined.includes('阻断') || combined.includes('暂停');
  return hasActionableFailure === false;
}

function shouldRenderWorkspaceChatMessageListMessage(message: WorkspaceChatMessage): boolean {
  const isAutoFoundationNotice = isWorkspaceChatMessageListAutoFoundationNotice(message);
  return isAutoFoundationNotice === false;
}

function hasWorkspaceChatMessageListMessages(messages: WorkspaceChatMessage[]): boolean {
  const hasMessages = messages.length > 0;
  return hasMessages === true;
}

function shouldRenderWorkspaceChatMessageListEmptyState(messages: WorkspaceChatMessage[]): boolean {
  const hasMessages = hasWorkspaceChatMessageListMessages(messages);
  return hasMessages === false;
}

function getWorkspaceChatMessageListGenerationStageLabel(generationStage: string): string {
  const hasGenerationStage = generationStage.length > 0;
  if (hasGenerationStage === true) {
    return generationStage;
  }

  return '生成中...';
}

function shouldRenderWorkspaceChatMessageListPlanSelection(message: WorkspaceChatMessage): boolean {
  const isPlanOptionsMessage = message.kind === 'plan-options';
  if (isPlanOptionsMessage === false) {
    return false;
  }

  return message.plans !== undefined;
}

function shouldRenderWorkspaceChatMessageListTimestamp(message: WorkspaceChatMessage): boolean {
  return message.timestamp !== undefined;
}

function getWorkspaceChatMessageListTimestampLabel(message: WorkspaceChatMessage): string {
  return new Date(message.timestamp).toLocaleTimeString();
}

function shouldRenderWorkspaceChatMessageListPlanningPlaceholder({
  isPlanning,
  hasStreamingPlanOptionsMessage,
}: {
  isPlanning: boolean;
  hasStreamingPlanOptionsMessage: boolean;
}): boolean {
  if (isPlanning === false) {
    return false;
  }

  return hasStreamingPlanOptionsMessage === false;
}

function shouldRenderWorkspaceChatMessageListGeneratingPlaceholder({
  isGenerating,
  hasWorkflowMessage,
}: {
  isGenerating: boolean;
  hasWorkflowMessage: boolean;
}): boolean {
  if (isGenerating === false) {
    return false;
  }

  return hasWorkflowMessage === false;
}

function shouldRenderWorkspaceChatMessageListAutoScrollAction(isChatAutoScrollEnabled: boolean): boolean {
  return isChatAutoScrollEnabled === false;
}

function getWorkspaceChatMessageListContainerClassName(compact: boolean): string {
  if (compact === true) {
    return 'space-y-3 p-3';
  }

  return 'relative space-y-4 p-4';
}

function getWorkspaceChatMessageListEmptySparklesClassName(compact: boolean): string {
  if (compact === true) {
    return 'mb-2 h-8 w-8';
  }

  return 'mb-3 h-10 w-10';
}

function getWorkspaceChatMessageListEmptyTitleClassName(compact: boolean): string {
  if (compact === true) {
    return 'mb-1 text-sm';
  }

  return 'mb-2';
}

function getWorkspaceChatMessageListEmptyDescriptionClassName(compact: boolean): string {
  if (compact === true) {
    return 'mb-3 text-xs';
  }

  return 'mb-4 text-sm';
}

function getWorkspaceChatMessageListExampleListClassName(compact: boolean): string {
  if (compact === true) {
    return 'space-y-1.5';
  }

  return 'space-y-2';
}

function getWorkspaceChatMessageListExampleButtonClassName(compact: boolean): string {
  if (compact === true) {
    return 'h-8 text-xs';
  }

  return 'text-sm';
}

function getWorkspaceChatMessageListExampleIconClassName(compact: boolean): string {
  if (compact === true) {
    return 'mr-1.5 h-3 w-3';
  }

  return 'mr-2 h-3 w-3';
}

function materializeWorkspaceChatMessageListExampleNodes({
  examples,
  exampleButtonClassName,
  exampleIconClassName,
  onExampleClick,
}: {
  examples: WorkspaceChatMessageListExampleList;
  exampleButtonClassName: string;
  exampleIconClassName: string;
  onExampleClick: WorkspaceChatExampleClickAction;
}): WorkspaceChatMessageListExampleNodeList {
  const nodes: WorkspaceChatMessageListExampleNodeList = [];

  for (const example of examples) {
    nodes.push(
      <Button
        key={example}
        variant="outline"
        className={cn(
          'w-full justify-start',
          exampleButtonClassName,
        )}
        onClick={() => onExampleClick(example)}
      >
        <Sparkles className={exampleIconClassName} />
        {example}
      </Button>,
    );
  }

  return nodes;
}

function getWorkspaceChatMessageListMessageRowClassName(message: WorkspaceChatMessage): string {
  if (message.role === 'user') {
    return 'justify-end';
  }

  return 'justify-start';
}

function getWorkspaceChatMessageListMessageBubbleToneClassName(message: WorkspaceChatMessage): string {
  if (message.role === 'user') {
    return 'bg-primary text-primary-foreground';
  }

  return 'bg-muted';
}

function getWorkspaceChatMessageListMessageBubblePaddingClassName(compact: boolean): string {
  if (compact === true) {
    return 'p-2.5';
  }

  return 'p-3';
}

function materializeWorkspaceChatMessageAttachmentNodes(message: WorkspaceChatMessage): ReactNode[] {
  const attachments = message.attachments ?? [];
  const nodes: ReactNode[] = [];
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    if (attachment === undefined || typeof attachment.dataUrl !== 'string' || attachment.dataUrl.length === 0) {
      continue;
    }
    nodes.push(
      <figure key={`${attachment.name}-${index}`} className="min-w-0">
        <span
          role="img"
          aria-label={`视觉参考图：${attachment.name}`}
          className="block aspect-[4/3] w-full rounded-md border border-white/20 bg-cover bg-center"
          style={{ backgroundImage: `url(${attachment.dataUrl})` }}
        />
        <figcaption className="mt-1 truncate text-[11px] opacity-75" title={attachment.name}>
          {attachment.name}
        </figcaption>
      </figure>,
    );
  }
  return nodes;
}

function getWorkspaceChatMessageListTimestampClassName(compact: boolean): string {
  if (compact === true) {
    return 'mt-0.5';
  }

  return 'mt-1';
}

function getWorkspaceChatMessageListPlaceholderBubbleClassName(compact: boolean): string {
  if (compact === true) {
    return 'p-2.5';
  }

  return 'p-3';
}

function getWorkspaceChatMessageListAutoScrollContainerClassName(compact: boolean): string {
  if (compact === true) {
    return 'px-3 py-2';
  }

  return 'px-4 py-2';
}

function materializeWorkspaceChatMessageListMessageNodes({
  messages,
  planCountdown,
  planSelectionReady,
  selectedPlanId,
  isBusyGenerating,
  messageBubblePaddingClassName,
  timestampClassName,
  onSelectPlan,
  onAskQuestion,
  onRunAction,
  onRestoreCommit,
  onViewCommit,
  onOpenFile,
}: WorkspaceChatMessageListNodeMaterializerInput): WorkspaceChatMessageListMessageNodeList {
  const nodes: WorkspaceChatMessageListMessageNodeList = [];

  for (const message of messages) {
    const shouldRenderMessage = shouldRenderWorkspaceChatMessageListMessage(message);
    if (shouldRenderMessage === false) {
      continue;
    }

    const attachmentNodes = materializeWorkspaceChatMessageAttachmentNodes(message);
    const hasAttachments = attachmentNodes.length > 0;
    nodes.push(
      <div key={message.id} className={cn('flex', getWorkspaceChatMessageListMessageRowClassName(message))}>
        <div className={cn('max-w-[85%] rounded-lg', getWorkspaceChatMessageListMessageBubbleToneClassName(message), messageBubblePaddingClassName)}>
          {hasAttachments === true && (
            <div
              data-testid="workspace-chat-message-attachments"
              className="mb-3 grid max-w-sm grid-cols-2 gap-2"
            >
              {attachmentNodes}
            </div>
          )}
          {shouldRenderWorkspaceChatMessageListPlanSelection(message) === true ? (
            <PlanSelectionMessage
              message={message}
              planCountdown={planCountdown}
              selectionReady={planSelectionReady}
              selectedPlanId={selectedPlanId}
              isBusy={isBusyGenerating}
              onSelectPlan={onSelectPlan}
              onAskQuestion={onAskQuestion}
              onRunAction={onRunAction}
            />
          ) : (
            <ChatMessageContent
              message={message}
              onAskQuestion={onAskQuestion}
              onRunAction={onRunAction}
              onRestoreCommit={onRestoreCommit}
              onViewCommit={onViewCommit}
              onOpenFile={onOpenFile}
            />
          )}
          {shouldRenderWorkspaceChatMessageListTimestamp(message) === true && (
            <span className={cn('block text-xs opacity-60', timestampClassName)}>
              {getWorkspaceChatMessageListTimestampLabel(message)}
            </span>
          )}
        </div>
      </div>,
    );
  }

  return nodes;
}

export function WorkspaceChatMessages({
  compact,
  messages,
  isPlanning,
  isGenerating,
  generationStage,
  planCountdown,
  planSelectionReady,
  selectedPlanId,
  isBusyGenerating,
  isChatAutoScrollEnabled,
  chatScrollSnapshot,
  containerRef,
  messagesEndRef,
  updateChatAutoScrollState,
  enableAutoScroll,
  onExampleClick,
  onSelectPlan,
  onAskQuestion,
  onRunAction,
  onRestoreCommit,
  onViewCommit,
  onOpenFile,
}: WorkspaceChatMessagesProps) {
  const examples = getWorkspaceChatMessageListExamples(compact);
  const hasStreamingPlanOptionsMessage = hasWorkspaceChatMessageListStreamingKind(messages, 'plan-options');
  const hasStreamingWorkflowMessage = hasWorkspaceChatMessageListStreamingKind(messages, 'workflow');
  const hasWorkflowMessage = hasWorkspaceChatMessageListKind(messages, 'workflow');
  const generationStageLabel = getWorkspaceChatMessageListGenerationStageLabel(generationStage);
  const shouldRenderEmptyState = shouldRenderWorkspaceChatMessageListEmptyState(messages);
  const shouldRenderPlanningPlaceholder = shouldRenderWorkspaceChatMessageListPlanningPlaceholder({
    isPlanning,
    hasStreamingPlanOptionsMessage,
  });
  const shouldRenderGeneratingPlaceholder = shouldRenderWorkspaceChatMessageListGeneratingPlaceholder({
    isGenerating,
    hasWorkflowMessage,
  });
  const shouldRenderAutoScrollAction = shouldRenderWorkspaceChatMessageListAutoScrollAction(isChatAutoScrollEnabled);
  const containerClassName = getWorkspaceChatMessageListContainerClassName(compact);
  const emptySparklesClassName = getWorkspaceChatMessageListEmptySparklesClassName(compact);
  const emptyTitleClassName = getWorkspaceChatMessageListEmptyTitleClassName(compact);
  const emptyDescriptionClassName = getWorkspaceChatMessageListEmptyDescriptionClassName(compact);
  const exampleListClassName = getWorkspaceChatMessageListExampleListClassName(compact);
  const exampleButtonClassName = getWorkspaceChatMessageListExampleButtonClassName(compact);
  const exampleIconClassName = getWorkspaceChatMessageListExampleIconClassName(compact);
  const messageBubblePaddingClassName = getWorkspaceChatMessageListMessageBubblePaddingClassName(compact);
  const timestampClassName = getWorkspaceChatMessageListTimestampClassName(compact);
  const placeholderBubbleClassName = getWorkspaceChatMessageListPlaceholderBubbleClassName(compact);
  const autoScrollContainerClassName = getWorkspaceChatMessageListAutoScrollContainerClassName(compact);

  return (
    <>
      <div
        ref={containerRef}
        onScroll={(event) => updateChatAutoScrollState(event.currentTarget)}
        data-plan-countdown={planCountdown}
        className={cn(
          'flex-1 overflow-y-auto',
          containerClassName,
        )}
      >
        {shouldRenderEmptyState === true && (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <Sparkles className={cn('text-muted-foreground/50', emptySparklesClassName)} />
            <h3 className={cn('font-medium', emptyTitleClassName)}>开始对话</h3>
            <p className={cn('text-muted-foreground', emptyDescriptionClassName)}>描述项目目标，我会先进入 Foundation，再进入方案与实现</p>
            <div className={cn('w-full', exampleListClassName)}>
              {materializeWorkspaceChatMessageListExampleNodes({
                examples,
                exampleButtonClassName,
                exampleIconClassName,
                onExampleClick,
              })}
            </div>
          </div>
        )}

        {materializeWorkspaceChatMessageListMessageNodes({
          messages,
          planCountdown,
          planSelectionReady,
          selectedPlanId,
          isBusyGenerating,
          messageBubblePaddingClassName,
          timestampClassName,
          onSelectPlan,
          onAskQuestion,
          onRunAction,
          onRestoreCommit,
          onViewCommit,
          onOpenFile,
        })}

        {shouldRenderPlanningPlaceholder === true && (
          <div className="flex justify-start">
            <div className={cn('bg-muted rounded-lg max-w-[85%]', placeholderBubbleClassName)}>
              <div className="flex items-center gap-2">
                <Spinner className="w-4 h-4" />
                <span className="text-sm text-muted-foreground">正在准备方案...</span>
              </div>
            </div>
          </div>
        )}

        {shouldRenderGeneratingPlaceholder === true && (
          <div className="flex justify-start">
            <div className={cn('bg-muted rounded-lg max-w-[85%]', placeholderBubbleClassName)}>
              <div className="flex items-center gap-2">
                <Spinner className="w-4 h-4" />
                <span className="text-sm text-muted-foreground">{generationStageLabel}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {shouldRenderAutoScrollAction === true && (
        <div className={cn('border-t', autoScrollContainerClassName)}>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={enableAutoScroll}>
            <ArrowDown className="mr-1 h-4 w-4" />
            回到最新输出
          </Button>
        </div>
      )}
    </>
  );
}
