'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { MarkdownContent } from '@/components/workspace/chat-message-content';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { buildPlanThoughtProcessSnapshot } from './workspace-chat-plan-snapshot';
import type { PlanThoughtProcessSnapshot, PlanThoughtProcessSnapshotSource } from './workspace-types';

function formatPlanThoughtProcessSnapshotTitle(snapshot: PlanThoughtProcessSnapshot) {
  switch (snapshot.status) {
    case 'empty':
      return '思考过程未附加';
    case 'streaming':
      return '思考过程正在流式更新';
    case 'expanded':
      return '思考过程已展开';
    case 'collapsed':
      return '思考过程已折叠';
    case 'settled':
      return '思考过程已完成';
    default:
      return '思考过程状态待确认';
  }
}

function getPlanThoughtProcessSnapshotClassName(snapshot: PlanThoughtProcessSnapshot) {
  if (snapshot.status === 'streaming') {
    return 'border-primary/20 bg-primary/5 text-primary';
  }
  if (snapshot.status === 'expanded') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (snapshot.status === 'settled') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function getPlanThoughtProcessSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function getPlanThoughtProcessContent(content: string | undefined): string {
  if (content === undefined) {
    return '';
  }

  return content.trim();
}

function hasPlanThoughtProcessContent(content: string): boolean {
  const hasContent = content.length > 0;
  return hasContent === true;
}

function isPlanThoughtProcessStreaming(streaming: boolean | undefined): boolean {
  return streaming === true;
}

function shouldOpenPlanThoughtProcessInitially({
  isStreaming,
  hasThoughtContent,
}: {
  isStreaming: boolean;
  hasThoughtContent: boolean;
}): boolean {
  if (isStreaming === true) {
    return true;
  }

  return hasThoughtContent === true;
}

function getPlanThoughtProcessSnapshotSource(isStreaming: boolean): PlanThoughtProcessSnapshotSource {
  if (isStreaming === true) {
    return 'plan_stream';
  }

  return 'message_restore';
}

function getPlanThoughtProcessTitle(isStreaming: boolean): string {
  if (isStreaming === true) {
    return '思考中';
  }

  return '思考过程';
}

function shouldRenderPlanThoughtProcessStreamingIndicator(isStreaming: boolean): boolean {
  return isStreaming === true;
}

function renderPlanThoughtProcessDisclosureIcon(open: boolean) {
  if (open === true) {
    return <ChevronDown className="h-4 w-4 text-muted-foreground" />;
  }

  return <ChevronRight className="h-4 w-4 text-muted-foreground" />;
}

function shouldRenderPlanThoughtProcessContent(hasThoughtContent: boolean): boolean {
  return hasThoughtContent === true;
}

export function PlanThoughtProcess({
  content,
  streaming,
}: {
  content?: string;
  streaming?: boolean;
}) {
  const thoughtContent = getPlanThoughtProcessContent(content);
  const hasThoughtContent = hasPlanThoughtProcessContent(thoughtContent);
  const isStreaming = isPlanThoughtProcessStreaming(streaming);
  const shouldOpenInitially = shouldOpenPlanThoughtProcessInitially({
    isStreaming,
    hasThoughtContent,
  });
  const [open, setOpen] = useState(shouldOpenInitially);
  const [snapshotSource, setSnapshotSource] = useState<PlanThoughtProcessSnapshotSource>(
    getPlanThoughtProcessSnapshotSource(isStreaming),
  );

  useEffect(() => {
    if (isStreaming === true) {
      setOpen(true);
      setSnapshotSource('plan_stream');
      return;
    }
    setOpen(false);
    setSnapshotSource(getPlanThoughtProcessSnapshotSource(isStreaming));
  }, [isStreaming, thoughtContent]);

  const thoughtProcessSnapshot = buildPlanThoughtProcessSnapshot({
    contentLength: thoughtContent.length,
    streaming: isStreaming,
    open,
    source: snapshotSource,
  });
  const isOpenLabel = getPlanThoughtProcessSnapshotBooleanLabel(thoughtProcessSnapshot.isOpen);
  const planThoughtProcessTitle = getPlanThoughtProcessTitle(isStreaming);
  const shouldRenderStreamingIndicator = shouldRenderPlanThoughtProcessStreamingIndicator(isStreaming);
  const disclosureIcon = renderPlanThoughtProcessDisclosureIcon(open);
  const shouldRenderThoughtContent = shouldRenderPlanThoughtProcessContent(hasThoughtContent);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    setSnapshotSource('user_toggle');
  };

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className="rounded-lg border bg-background/70">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-2">
            {disclosureIcon}
            <span className="text-sm font-medium">{planThoughtProcessTitle}</span>
          </div>
          {shouldRenderStreamingIndicator === true && (
            <span className="inline-flex items-center gap-1 text-xs text-primary">
              <Spinner className="h-3.5 w-3.5" />
              流式更新
            </span>
          )}
        </button>
      </CollapsibleTrigger>
      <div
        role="status"
        aria-live="polite"
        data-testid="workspace-plan-thought-process-snapshot"
        className={cn('border-t px-3 py-2 text-xs', getPlanThoughtProcessSnapshotClassName(thoughtProcessSnapshot))}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">{formatPlanThoughtProcessSnapshotTitle(thoughtProcessSnapshot)}</span>
          <span>Phase: {thoughtProcessSnapshot.status}</span>
          <span>Source: {thoughtProcessSnapshot.source}</span>
          <span>Open: {isOpenLabel}</span>
          <span>Chars: {thoughtProcessSnapshot.contentLength}</span>
        </div>
        <p className="mt-1">{thoughtProcessSnapshot.message}</p>
        <p className="mt-1 opacity-80">恢复建议：{thoughtProcessSnapshot.recovery}</p>
      </div>
      <CollapsibleContent className="border-t">
        <div className="space-y-3 px-3 py-3">
          {shouldRenderThoughtContent === true ? (
            <div className="rounded-lg border bg-background px-3 py-3">
              <MarkdownContent content={thoughtContent} />
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
              当前消息没有附加思考过程内容。
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
