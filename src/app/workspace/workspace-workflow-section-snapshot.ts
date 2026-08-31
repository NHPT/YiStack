import type { WorkflowStepStatus } from '@/components/workspace/chat-message-content';

import type {
  WorkflowSectionKind,
  WorkflowSectionSnapshot,
  WorkflowSectionSnapshotSource,
  WorkflowSectionSnapshotStatus,
} from './workspace-types';

type WorkflowSectionSnapshotStep = {
  status?: WorkflowStepStatus;
};

type WorkflowSectionSnapshotOptions = {
  kind: WorkflowSectionKind;
  displaySteps: WorkflowSectionSnapshotStep[];
  visibleLineCount: number;
  open: boolean;
  source: WorkflowSectionSnapshotSource;
};

function getWorkflowSectionSnapshotStepStatusCount(
  displaySteps: WorkflowSectionSnapshotStep[],
  status: WorkflowStepStatus,
): number {
  let count = 0;
  for (const step of displaySteps) {
    const stepStatus = step.status;
    const hasTargetStatus = stepStatus === status;
    if (hasTargetStatus === true) {
      count += 1;
    }
  }

  return count;
}

function getWorkflowSectionSnapshotStatus({
  runningCount,
  failedCount,
  visibleLineCount,
  open,
}: {
  runningCount: number;
  failedCount: number;
  visibleLineCount: number;
  open: boolean;
}): WorkflowSectionSnapshotStatus {
  const hasRunningSteps = runningCount > 0;
  if (hasRunningSteps === true) {
    return 'running';
  }

  const hasFailedSteps = failedCount > 0;
  if (hasFailedSteps === true) {
    return 'failed';
  }

  const lacksVisibleLines = visibleLineCount === 0;
  if (lacksVisibleLines === true) {
    return 'empty_lines';
  }

  if (open === true) {
    return 'open';
  }

  return 'collapsed';
}

function getWorkflowSectionSnapshotSource({
  visibleLineCount,
  source,
}: {
  visibleLineCount: number;
  source: WorkflowSectionSnapshotSource;
}): WorkflowSectionSnapshotSource {
  const lacksVisibleLines = visibleLineCount === 0;
  if (lacksVisibleLines === true) {
    return 'display_filter';
  }

  return source;
}

function getWorkflowSectionSnapshotMessage({
  status,
  open,
}: {
  status: WorkflowSectionSnapshotStatus;
  open: boolean;
}): string {
  if (status === 'running') {
    return '该 workflow 分组仍有步骤在执行。';
  }

  if (status === 'failed') {
    return '该 workflow 分组包含失败步骤，需要根据失败项继续恢复。';
  }

  if (status === 'empty_lines') {
    return '该 workflow 分组存在步骤，但当前步骤缺少可展示行。';
  }

  if (open === true) {
    return '该 workflow 分组已展开，正在展示可见步骤。';
  }

  return '该 workflow 分组已折叠，步骤详情仍保留在当前消息中。';
}

function getWorkflowSectionSnapshotRecovery({
  status,
  open,
}: {
  status: WorkflowSectionSnapshotStatus;
  open: boolean;
}): string {
  if (status === 'failed') {
    return '展开该分组查看失败步骤；如有修复入口，请优先使用消息中的建议动作。';
  }

  if (status === 'empty_lines') {
    return '检查 workflow step 的 kind、title、detail 或 meta 是否足够生成可见行。';
  }

  if (open === true) {
    return '确认步骤后可以折叠该分组，或点击可定位文件步骤打开对应文件。';
  }

  return '点击分组标题可重新展开查看步骤详情。';
}

export function buildWorkflowSectionSnapshot({
  kind,
  displaySteps,
  visibleLineCount,
  open,
  source,
}: WorkflowSectionSnapshotOptions): WorkflowSectionSnapshot {
  const runningCount = getWorkflowSectionSnapshotStepStatusCount(displaySteps, 'running');
  const failedCount = getWorkflowSectionSnapshotStepStatusCount(displaySteps, 'failed');
  const status = getWorkflowSectionSnapshotStatus({
    runningCount,
    failedCount,
    visibleLineCount,
    open,
  });
  const snapshotSource = getWorkflowSectionSnapshotSource({
    visibleLineCount,
    source,
  });
  const message = getWorkflowSectionSnapshotMessage({
    status,
    open,
  });
  const recovery = getWorkflowSectionSnapshotRecovery({
    status,
    open,
  });

  return {
    status,
    source: snapshotSource,
    sectionKind: kind,
    stepCount: displaySteps.length,
    runningCount,
    failedCount,
    visibleLineCount,
    isOpen: open,
    message,
    recovery,
    updatedAt: 'derived',
  };
}
