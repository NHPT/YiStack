import type {
  PlanSelectionSnapshot,
  PlanSelectionSnapshotSource,
  PlanSelectionSnapshotStatus,
  PlanThoughtProcessSnapshot,
  PlanThoughtProcessSnapshotSource,
  PlanThoughtProcessSnapshotStatus,
} from './workspace-types';

type PlanSelectionSnapshotOptions = {
  timestamp: string | Date;
  planSuperseded?: boolean;
  planCount: number;
  isStreamComplete: boolean;
  isSelectable: boolean;
  selectedPlanId: string | null;
  isBusy: boolean;
  recommendedPlanId: string | null;
};

type PlanThoughtProcessSnapshotOptions = {
  contentLength: number;
  streaming: boolean;
  open: boolean;
  source: PlanThoughtProcessSnapshotSource;
};

function createPlanSelectionSnapshot({
  status,
  source,
  planCount,
  recommendedPlanId,
  selectedPlanId,
  canSelect,
  message,
  recovery,
  updatedAt,
}: {
  status: PlanSelectionSnapshotStatus;
  source: PlanSelectionSnapshotSource;
  planCount: number;
  recommendedPlanId: string | null;
  selectedPlanId: string | null;
  canSelect: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
}): PlanSelectionSnapshot {
  return {
    status,
    source,
    planCount,
    recommendedPlanId,
    selectedPlanId,
    canSelect,
    message,
    recovery,
    updatedAt,
  };
}

function isPlanSelectionSnapshotSuperseded(planSuperseded: boolean | undefined): boolean {
  return planSuperseded === true;
}

function hasPlanSelectionSnapshotSelectedPlanId(selectedPlanId: string | null): selectedPlanId is string {
  return selectedPlanId !== null;
}

function isPlanSelectionSnapshotStreamComplete(isStreamComplete: boolean): boolean {
  return isStreamComplete === true;
}

function isPlanSelectionSnapshotBusy(isBusy: boolean): boolean {
  return isBusy === true;
}

function isPlanThoughtProcessSnapshotStreaming(streaming: boolean): boolean {
  return streaming === true;
}

function isPlanThoughtProcessSnapshotOpen(open: boolean): boolean {
  return open === true;
}

function isPlanThoughtProcessSnapshotUserToggle(source: PlanThoughtProcessSnapshotSource): boolean {
  return source === 'user_toggle';
}

export function buildPlanSelectionSnapshot({
  timestamp,
  planSuperseded,
  planCount,
  isStreamComplete,
  isSelectable,
  selectedPlanId,
  isBusy,
  recommendedPlanId,
}: PlanSelectionSnapshotOptions): PlanSelectionSnapshot {
  const updatedAt = typeof timestamp === 'string'
    ? timestamp
    : timestamp.toISOString();

  if (planCount === 0) {
    return createPlanSelectionSnapshot({
      status: 'empty_plans',
      source: 'message_restore',
      planCount,
      recommendedPlanId,
      selectedPlanId,
      canSelect: false,
      message: '当前方案消息没有可确认的候选方案。',
      recovery: '请重新生成方案，或补充约束后让系统重新规划。',
      updatedAt,
    });
  }

  if (isPlanSelectionSnapshotSuperseded(planSuperseded) === true) {
    return createPlanSelectionSnapshot({
      status: 'superseded',
      source: 'new_requirement',
      planCount,
      recommendedPlanId,
      selectedPlanId,
      canSelect: false,
      message: '这轮方案已被后续新需求替代，仅保留为历史记录。',
      recovery: '请查看最新一轮方案选择消息，或继续补充约束重新规划。',
      updatedAt,
    });
  }

  if (hasPlanSelectionSnapshotSelectedPlanId(selectedPlanId) === true) {
    return createPlanSelectionSnapshot({
      status: 'selected',
      source: 'user_selection',
      planCount,
      recommendedPlanId,
      selectedPlanId,
      canSelect: false,
      message: '当前方案已确认，系统应继续进入实现准备或实现生成。',
      recovery: '如果实现入口失败，请使用同一消息中的恢复动作重新应用方案或重新生成方案。',
      updatedAt,
    });
  }

  if (isPlanSelectionSnapshotStreamComplete(isStreamComplete) === false) {
    return createPlanSelectionSnapshot({
      status: 'streaming',
      source: 'plan_stream',
      planCount,
      recommendedPlanId,
      selectedPlanId,
      canSelect: false,
      message: '方案流尚未完成，候选方案仍可能继续更新。',
      recovery: '等待方案生成完成后再确认；如果生成失败，请使用方案生成恢复入口重试。',
      updatedAt,
    });
  }

  if (isPlanSelectionSnapshotBusy(isBusy) === true) {
    return createPlanSelectionSnapshot({
      status: 'busy_blocked',
      source: 'generation_state',
      planCount,
      recommendedPlanId,
      selectedPlanId,
      canSelect: false,
      message: '当前仍有规划或生成流程在执行，方案选择暂不可提交。',
      recovery: '等待当前流程结束，或先停止生成后再确认方案。',
      updatedAt,
    });
  }

  return createPlanSelectionSnapshot({
    status: 'waiting_for_selection',
    source: 'plan_stream',
    planCount,
    recommendedPlanId,
    selectedPlanId,
    canSelect: isSelectable,
    message: '方案已生成完成，正在等待你确认要进入实现的方案。',
    recovery: '点击一个候选方案确认，或继续补充约束后重新规划。',
    updatedAt,
  });
}

export function buildPlanThoughtProcessSnapshot({
  contentLength,
  streaming,
  open,
  source,
}: PlanThoughtProcessSnapshotOptions): PlanThoughtProcessSnapshot {
  if (contentLength === 0) {
    const status: PlanThoughtProcessSnapshotStatus = 'empty';
    const snapshotSource: PlanThoughtProcessSnapshotSource = 'message_restore';
    return {
      status,
      source: snapshotSource,
      contentLength,
      isOpen: false,
      message: '当前方案消息没有附加可展示的思考过程。',
      recovery: '如需更多推理依据，可以继续追问方案取舍或要求重新规划。',
      updatedAt: 'derived',
    };
  }

  const isStreaming = isPlanThoughtProcessSnapshotStreaming(streaming);
  if (isStreaming === true) {
    const status: PlanThoughtProcessSnapshotStatus = 'streaming';
    const snapshotSource: PlanThoughtProcessSnapshotSource = 'plan_stream';
    return {
      status,
      source: snapshotSource,
      contentLength,
      isOpen: true,
      message: '思考过程仍在随方案生成流更新。',
      recovery: '等待流式生成完成后再根据最终方案确认或追问。',
      updatedAt: 'derived',
    };
  }

  const isOpen = isPlanThoughtProcessSnapshotOpen(open);
  if (isOpen === true) {
    const status: PlanThoughtProcessSnapshotStatus = 'expanded';
    return {
      status,
      source,
      contentLength,
      isOpen: true,
      message: '思考过程已展开，当前可直接查看模型规划依据。',
      recovery: '核对推理依据后，可折叠该区域继续查看候选方案。',
      updatedAt: 'derived',
    };
  }

  const isUserToggle = isPlanThoughtProcessSnapshotUserToggle(source);
  const status: PlanThoughtProcessSnapshotStatus = isUserToggle === true ? 'collapsed' : 'settled';
  return {
    status,
    source,
    contentLength,
    isOpen: false,
    message: isUserToggle === true
      ? '思考过程已由用户折叠，内容仍保留在当前消息中。'
      : '思考过程已完成并默认折叠，内容仍可展开查看。',
    recovery: '点击“思考过程”可重新展开查看规划依据。',
    updatedAt: 'derived',
  };
}
