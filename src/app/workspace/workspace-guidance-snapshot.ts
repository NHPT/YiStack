import type {
  WorkspaceGuidanceSnapshot,
  WorkspaceGuidanceSnapshotSource,
  WorkspaceGuidanceSnapshotStatus,
} from './workspace-types';

type WorkspaceGuidanceSnapshotOptions = {
  questionCount: number;
  actionCount: number;
  primaryActionCount: number;
  retryActionCount: number;
  hasExplicitSuggestedActions: boolean;
  hasRecoveryRetry: boolean;
};

function usesWorkspaceGuidanceRecoveryFallback({
  hasExplicitSuggestedActions,
  actionCount,
  hasRecoveryRetry,
}: {
  hasExplicitSuggestedActions: boolean;
  actionCount: number;
  hasRecoveryRetry: boolean;
}): boolean {
  if (hasExplicitSuggestedActions === true) {
    return false;
  }

  const hasActions = hasWorkspaceGuidanceSnapshotCount(actionCount);
  if (hasActions === false) {
    return false;
  }

  return hasRecoveryRetry === true;
}

function hasWorkspaceGuidanceSnapshotCount(count: number): boolean {
  const hasCount = count > 0;
  return hasCount === true;
}

function hasWorkspaceGuidanceSnapshotEmptyCounts({
  questionCount,
  actionCount,
}: {
  questionCount: number;
  actionCount: number;
}): boolean {
  const hasQuestions = hasWorkspaceGuidanceSnapshotCount(questionCount);
  if (hasQuestions === true) {
    return false;
  }

  const hasActions = hasWorkspaceGuidanceSnapshotCount(actionCount);
  if (hasActions === true) {
    return false;
  }

  return true;
}

function hasWorkspaceGuidanceSnapshotMixedCounts({
  questionCount,
  actionCount,
}: {
  questionCount: number;
  actionCount: number;
}): boolean {
  const hasQuestions = hasWorkspaceGuidanceSnapshotCount(questionCount);
  if (hasQuestions === false) {
    return false;
  }

  const hasActions = hasWorkspaceGuidanceSnapshotCount(actionCount);
  return hasActions === true;
}

export function buildWorkspaceGuidanceSnapshot({
  questionCount,
  actionCount,
  primaryActionCount,
  retryActionCount,
  hasExplicitSuggestedActions,
  hasRecoveryRetry,
}: WorkspaceGuidanceSnapshotOptions): WorkspaceGuidanceSnapshot {
  const hasEmptyCounts = hasWorkspaceGuidanceSnapshotEmptyCounts({
    questionCount,
    actionCount,
  });
  if (hasEmptyCounts === true) {
    const status: WorkspaceGuidanceSnapshotStatus = 'empty';
    const source: WorkspaceGuidanceSnapshotSource = 'suggested_questions';

    return {
      status,
      source,
      questionCount: 0,
      actionCount: 0,
      primaryActionCount: 0,
      retryActionCount: 0,
      message: '当前消息没有可用的建议问题或恢复入口。',
      recovery: '继续输入新的需求，或等待后续 workflow 消息提供恢复动作。',
      updatedAt: 'derived',
    };
  }

  const usesRecoveryFallback = usesWorkspaceGuidanceRecoveryFallback({
    hasExplicitSuggestedActions,
    actionCount,
    hasRecoveryRetry,
  });

  if (usesRecoveryFallback === true) {
    const status: WorkspaceGuidanceSnapshotStatus = 'recovery_fallback';
    const source: WorkspaceGuidanceSnapshotSource = 'engineering_recovery';

    return {
      status,
      source,
      questionCount,
      actionCount,
      primaryActionCount,
      retryActionCount,
      message: '当前恢复入口来自工程状态 recovery fallback。',
      recovery: '点击恢复入口会把 recovery retry prompt 重新送回对应阶段。',
      updatedAt: 'derived',
    };
  }

  const hasMixedCounts = hasWorkspaceGuidanceSnapshotMixedCounts({
    questionCount,
    actionCount,
  });
  if (hasMixedCounts === true) {
    const status: WorkspaceGuidanceSnapshotStatus = 'mixed';
    const source: WorkspaceGuidanceSnapshotSource = 'suggested_actions';

    return {
      status,
      source,
      questionCount,
      actionCount,
      primaryActionCount,
      retryActionCount,
      message: '当前消息同时提供建议问题和可执行动作。',
      recovery: '优先点击可执行恢复入口；需要补充约束时再选择建议问题。',
      updatedAt: 'derived',
    };
  }

  const hasActions = hasWorkspaceGuidanceSnapshotCount(actionCount);
  if (hasActions === true) {
    const status: WorkspaceGuidanceSnapshotStatus = 'actions_available';
    const source: WorkspaceGuidanceSnapshotSource = 'suggested_actions';

    return {
      status,
      source,
      questionCount,
      actionCount,
      primaryActionCount,
      retryActionCount,
      message: '当前消息提供可执行建议动作。',
      recovery: '优先点击 primary 动作定位或恢复；retry 动作用于重新进入对应流程。',
      updatedAt: 'derived',
    };
  }

  const status: WorkspaceGuidanceSnapshotStatus = 'questions_only';
  const source: WorkspaceGuidanceSnapshotSource = 'suggested_questions';

  return {
    status,
    source,
    questionCount,
    actionCount,
    primaryActionCount,
    retryActionCount,
    message: '当前消息仅提供建议追问。',
    recovery: '点击建议问题可把追问写入当前对话，继续收敛方案或恢复上下文。',
    updatedAt: 'derived',
  };
}
