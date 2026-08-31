import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type WorkspaceChatStateSummaryTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type WorkspaceChatStateSummaryToneTarget = 'container' | 'summary';
export type WorkspaceChatStateSummaryTonePriorityMap = {
  [tone in WorkspaceChatStateSummaryTone]: number;
};

export type WorkspaceChatStateSummaryRule = {
  active: boolean;
  tone: WorkspaceChatStateSummaryTone;
  autoOpen?: boolean;
};
type WorkspaceChatStateSummaryFactNodeList = ReactNode[];

const summaryTonePriority: WorkspaceChatStateSummaryTonePriorityMap = {
  neutral: 0,
  success: 1,
  info: 2,
  warning: 3,
  danger: 4,
};

function getWorkspaceChatStateSummaryActiveRules(
  rules: WorkspaceChatStateSummaryRule[],
): WorkspaceChatStateSummaryRule[] {
  const activeRules: WorkspaceChatStateSummaryRule[] = [];
  for (const rule of rules) {
    if (rule.active === true) {
      activeRules.push(rule);
    }
  }

  return activeRules;
}

function getWorkspaceChatStateSummaryTone(
  activeRules: WorkspaceChatStateSummaryRule[],
  fallbackTone: WorkspaceChatStateSummaryTone,
): WorkspaceChatStateSummaryTone {
  let tone = fallbackTone;
  for (const rule of activeRules) {
    const hasHigherPriority = summaryTonePriority[rule.tone] > summaryTonePriority[tone];
    if (hasHigherPriority === true) {
      tone = rule.tone;
    }
  }

  return tone;
}

function shouldOpenWorkspaceChatStateSummary(
  activeRules: WorkspaceChatStateSummaryRule[],
): boolean {
  for (const rule of activeRules) {
    if (rule.autoOpen === true) {
      return true;
    }
  }

  return false;
}

function getWorkspaceChatStateSummaryOpenValue(shouldOpen: boolean): true | undefined {
  if (shouldOpen === true) {
    return true;
  }

  return undefined;
}

function shouldApplyWorkspaceChatStateSummaryContainerTone(
  toneTarget: WorkspaceChatStateSummaryToneTarget,
): boolean {
  return toneTarget === 'container';
}

function shouldApplyWorkspaceChatStateSummarySummaryTone(
  toneTarget: WorkspaceChatStateSummaryToneTarget,
): boolean {
  return toneTarget === 'summary';
}

function materializeWorkspaceChatStateSummaryFactNodes(
  facts: ReactNode[],
): WorkspaceChatStateSummaryFactNodeList {
  const nodes: WorkspaceChatStateSummaryFactNodeList = [];

  for (let index = 0; index < facts.length; index += 1) {
    const fact = facts[index];
    if (fact === undefined) {
      continue;
    }

    nodes.push(
      <span key={index}>{fact}</span>,
    );
  }

  return nodes;
}

export function resolveWorkspaceChatStateSummaryRules(
  rules: WorkspaceChatStateSummaryRule[],
  fallbackTone: WorkspaceChatStateSummaryTone = 'neutral',
) {
  const activeRules = getWorkspaceChatStateSummaryActiveRules(rules);
  const tone = getWorkspaceChatStateSummaryTone(activeRules, fallbackTone);

  return {
    tone,
    shouldOpen: shouldOpenWorkspaceChatStateSummary(activeRules),
  };
}

export function getWorkspaceChatStateSummaryToneClassName(tone: WorkspaceChatStateSummaryTone) {
  switch (tone) {
    case 'danger':
      return 'border-destructive/30 bg-destructive/5 text-destructive';
    case 'warning':
      return 'border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'success':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'info':
      return 'border-primary/20 bg-primary/5 text-primary';
    default:
      return 'border-border bg-background/70 text-foreground';
  }
}

export function WorkspaceChatStateSummaryDisclosure({
  testId,
  title,
  facts,
  description,
  tone,
  shouldOpen,
  toneTarget,
  containerClassName,
  summaryClassName,
  children,
}: {
  testId: string;
  title: string;
  facts: ReactNode[];
  description: string;
  tone: WorkspaceChatStateSummaryTone;
  shouldOpen: boolean;
  toneTarget: WorkspaceChatStateSummaryToneTarget;
  containerClassName?: string;
  summaryClassName?: string;
  children: ReactNode;
}) {
  const toneClassName = getWorkspaceChatStateSummaryToneClassName(tone);
  const detailsOpenValue = getWorkspaceChatStateSummaryOpenValue(shouldOpen);
  const shouldApplyContainerTone = shouldApplyWorkspaceChatStateSummaryContainerTone(toneTarget);
  const shouldApplySummaryTone = shouldApplyWorkspaceChatStateSummarySummaryTone(toneTarget);

  return (
    <details
      open={detailsOpenValue}
      data-testid={testId}
      className={cn(containerClassName, shouldApplyContainerTone === true && toneClassName)}
    >
      <summary
        className={cn(
          'cursor-pointer list-none',
          summaryClassName,
          shouldApplySummaryTone === true && toneClassName,
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">{title}</span>
          {materializeWorkspaceChatStateSummaryFactNodes(facts)}
        </div>
        <p className="mt-1 opacity-80">{description}</p>
      </summary>

      <div className="mt-2 grid gap-2">
        {children}
      </div>
    </details>
  );
}
