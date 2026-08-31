import type { ProjectRuntimeStatus } from '@/lib/api';
import {
  CAPABILITY_AUDIT_STATUS_QUERY_PARAM,
  updateCapabilityAuditStatusSearch,
} from '@/lib/workspace/capability-audit-diagnostics';
import {
  RUNTIME_HEALTH_REASON_QUERY_PARAM,
  updateRuntimeHealthProjectSearch,
  updateRuntimeHealthSearchParam,
} from '@/lib/workspace/runtime-health-query';

export {
  clearRuntimeHealthDiagnosticContextSearch,
  deriveRuntimeHealthDiagnosticContext,
  RUNTIME_HEALTH_PROJECT_QUERY_PARAM,
  RUNTIME_HEALTH_REASON_QUERY_PARAM,
  type RuntimeHealthDiagnosticContext,
} from '@/lib/workspace/runtime-health-query';

export type RuntimeHealthSeverity = 'ready' | 'running' | 'blocked' | 'idle' | 'unknown';

export type RuntimeHealthRelatedDiagnosticAction = {
  label: string;
  description: string;
  searchParam: string;
  searchValue: string;
};

export type RuntimeHealthRestartReasonCode =
  | 'stopped'
  | 'failed'
  | 'persistence_failed'
  | 'container_status_persistence_failed'
  | 'unknown';

export type RuntimeHealthRestartAction = {
  label: string;
  description: string;
  reasonCode: RuntimeHealthRestartReasonCode;
};

export type RuntimeHealthDiagnosticsSummary = {
  severity: RuntimeHealthSeverity;
  statusLabel: string;
  containerLabel: string;
  phaseLabel: string;
  previewLabel: string;
  message: string;
  nextAction: string;
  persistenceLabel: string;
  updatedAtLabel: string;
  completedAtLabel: string;
  isPreviewAvailable: boolean;
  isBlocking: boolean;
  relatedCapabilityAuditAction: RuntimeHealthRelatedDiagnosticAction | null;
  restartRuntimeAction: RuntimeHealthRestartAction | null;
};

function readString(value?: string): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getRuntimeHealthLabel(value: string, fallback: string): string {
  const hasValue = value.length > 0;

  return hasValue === true ? value : fallback;
}

function hasRuntimeHealthTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function hasRuntimeHealthProjectId(projectId: string): boolean {
  const hasProjectId = hasRuntimeHealthTextValue(projectId);
  return hasProjectId === true;
}

function hasRuntimeHealthStatus(status: ProjectRuntimeStatus | null | undefined): status is ProjectRuntimeStatus {
  if (status === null) {
    return false;
  }

  return status !== undefined;
}

function formatRuntimeTimestamp(value?: string): string {
  const raw = readString(value);
  const hasRawTimestamp = hasRuntimeHealthTextValue(raw);
  if (hasRawTimestamp === false) {
    return '未知时间';
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildRelatedCapabilityAuditAction(): RuntimeHealthRelatedDiagnosticAction {
  return {
    label: '查看 Capability 审计',
    description: '使用 blocked 筛选最近被阻断的能力执行记录，确认是否与当前运行时阻断相关。',
    searchParam: CAPABILITY_AUDIT_STATUS_QUERY_PARAM,
    searchValue: 'blocked',
  };
}

function buildRestartRuntimeAction(reasonCode: RuntimeHealthRestartReasonCode): RuntimeHealthRestartAction {
  return {
    label: '恢复运行时',
    description: '显式重新启动开发运行时并等待 runtime-status 进入 ready；该动作复用受控 start 容器入口。',
    reasonCode,
  };
}

export function buildRuntimeHealthCapabilityAuditSearch(
  search: string,
  status?: ProjectRuntimeStatus | null,
): string {
  let nextSearch = updateCapabilityAuditStatusSearch(search, 'blocked');
  const projectId = readString(status?.projectId);
  const runtimeStatus = readString(status?.status).toLowerCase();
  const hasProjectId = hasRuntimeHealthProjectId(projectId);

  if (hasProjectId === true) {
    nextSearch = updateRuntimeHealthProjectSearch(nextSearch, projectId);
  }
  if (runtimeStatus === 'failed') {
    nextSearch = updateRuntimeHealthSearchParam(nextSearch, RUNTIME_HEALTH_REASON_QUERY_PARAM, 'runtime_readiness_failed');
  }

  return nextSearch;
}

export function deriveRuntimeHealthDiagnosticsSummary(
  status?: ProjectRuntimeStatus | null,
): RuntimeHealthDiagnosticsSummary {
  const runtimeStatus = readString(status?.status).toLowerCase();
  const containerStatus = readString(status?.containerStatus).toLowerCase();
  const phase = readString(status?.phase);
  const previewUrl = readString(status?.previewUrl);
  const error = readString(status?.error);
  const message = readString(status?.message);
  const containerStatusPersistence = readString(status?.containerStatusPersistence).toLowerCase();
  const containerStatusPersistenceError = readString(status?.containerStatusPersistenceError);
  const persistenceStatus = readString(status?.persistenceStatus).toLowerCase();
  const persistenceError = readString(status?.persistenceError);
  const hasPreviewUrl = previewUrl.length > 0;
  const hasError = error.length > 0;
  const isPreviewAvailable = hasPreviewUrl === true;
  const statusLabel = getRuntimeHealthLabel(runtimeStatus, 'unknown');
  const unknownContainerLabel = getRuntimeHealthLabel(containerStatus, 'unknown');
  const readyContainerLabel = getRuntimeHealthLabel(containerStatus, 'running');
  const preparingContainerLabel = getRuntimeHealthLabel(containerStatus, 'pending');
  const stoppedContainerLabel = getRuntimeHealthLabel(containerStatus, 'stopped');
  const persistenceLabel = getRuntimeHealthLabel(persistenceStatus, 'unknown');
  const previewUnavailableLabel = getRuntimeHealthLabel(previewUrl, '未提供预览地址');
  const previewPendingLabel = getRuntimeHealthLabel(previewUrl, '预览地址待生成');
  const persistenceFailureMessage = getRuntimeHealthLabel(persistenceError, '无法写入 runtime-status 快照');
  const containerStatusPersistenceFailureMessage = getRuntimeHealthLabel(
    containerStatusPersistenceError,
    '无法更新项目 container_status',
  );
  const failedRuntimeMessage = getRuntimeHealthLabel(error, getRuntimeHealthLabel(message, '运行时准备失败。'));
  const failedRuntimeNextAction = getRuntimeHealthLabel(error, getRuntimeHealthLabel(message, '检查运行时日志、容器状态或重新启动开发环境。'));
  const readyRuntimeMessage = getRuntimeHealthLabel(message, '开发运行时已就绪。');
  const preparingRuntimeMessage = getRuntimeHealthLabel(message, '运行时正在准备。');
  const stoppedRuntimeMessage = getRuntimeHealthLabel(message, '开发运行时当前未启动。');
  const unknownRuntimeMessage = getRuntimeHealthLabel(message, getRuntimeHealthLabel(error, '运行时状态未归类。'));
  const unknownRuntimeNextAction = getRuntimeHealthLabel(error, '查看运行时详情或刷新项目状态。');
  const relatedCapabilityAuditAction = hasError === true ? buildRelatedCapabilityAuditAction() : null;
  const hasStatus = hasRuntimeHealthStatus(status);

  if (hasStatus === false) {
    return {
      severity: 'unknown',
      statusLabel: 'unknown',
      containerLabel: 'unknown',
      phaseLabel: '未读取',
      previewLabel: '未提供预览地址',
      message: '尚未读取项目运行时状态。',
      nextAction: '选择项目或等待 Workspace 初始化后读取运行时状态。',
      persistenceLabel: '未读取',
      updatedAtLabel: '未知时间',
      completedAtLabel: '未知时间',
      isPreviewAvailable: false,
      isBlocking: false,
      relatedCapabilityAuditAction: null,
      restartRuntimeAction: null,
    };
  }

  if (persistenceStatus === 'failed') {
    return {
      severity: 'blocked',
      statusLabel,
      containerLabel: unknownContainerLabel,
      phaseLabel: getRuntimeHealthLabel(phase, '状态持久化失败'),
      previewLabel: previewUnavailableLabel,
      message: `运行时状态持久化失败：${persistenceFailureMessage}`,
      nextAction: '当前运行时状态可能无法在刷新或重新进入 Workspace 后恢复；请检查项目目录权限或重新恢复运行时。',
      persistenceLabel: 'failed',
      updatedAtLabel: formatRuntimeTimestamp(status.updatedAt),
      completedAtLabel: formatRuntimeTimestamp(status.completedAt),
      isPreviewAvailable,
      isBlocking: true,
      relatedCapabilityAuditAction: null,
      restartRuntimeAction: buildRestartRuntimeAction('persistence_failed'),
    };
  }

  if (containerStatusPersistence === 'failed') {
    return {
      severity: 'blocked',
      statusLabel,
      containerLabel: unknownContainerLabel,
      phaseLabel: getRuntimeHealthLabel(phase, '容器状态同步失败'),
      previewLabel: previewUnavailableLabel,
      message: `项目容器状态同步失败：${containerStatusPersistenceFailureMessage}`,
      nextAction: '当前容器真实状态与项目列表状态可能不一致；请刷新项目详情或检查数据库状态同步日志。',
      persistenceLabel,
      updatedAtLabel: formatRuntimeTimestamp(status.updatedAt),
      completedAtLabel: formatRuntimeTimestamp(status.completedAt),
      isPreviewAvailable,
      isBlocking: true,
      relatedCapabilityAuditAction: null,
      restartRuntimeAction: buildRestartRuntimeAction('container_status_persistence_failed'),
    };
  }

  if (runtimeStatus === 'failed') {
    return {
      severity: 'blocked',
      statusLabel: runtimeStatus,
      containerLabel: unknownContainerLabel,
      phaseLabel: getRuntimeHealthLabel(phase, '运行时失败'),
      previewLabel: previewUnavailableLabel,
      message: failedRuntimeMessage,
      nextAction: failedRuntimeNextAction,
      persistenceLabel,
      updatedAtLabel: formatRuntimeTimestamp(status.updatedAt),
      completedAtLabel: formatRuntimeTimestamp(status.completedAt),
      isPreviewAvailable,
      isBlocking: true,
      relatedCapabilityAuditAction: buildRelatedCapabilityAuditAction(),
      restartRuntimeAction: buildRestartRuntimeAction('failed'),
    };
  }

  if (runtimeStatus === 'ready') {
    return {
      severity: 'ready',
      statusLabel: runtimeStatus,
      containerLabel: readyContainerLabel,
      phaseLabel: getRuntimeHealthLabel(phase, '运行时已就绪'),
      previewLabel: previewUnavailableLabel,
      message: readyRuntimeMessage,
      nextAction: isPreviewAvailable ? '刷新预览或继续代码生成。' : '等待后端返回 previewUrl 或检查端口映射。',
      persistenceLabel,
      updatedAtLabel: formatRuntimeTimestamp(status.updatedAt),
      completedAtLabel: formatRuntimeTimestamp(status.completedAt),
      isPreviewAvailable,
      isBlocking: false,
      relatedCapabilityAuditAction: null,
      restartRuntimeAction: null,
    };
  }

  if (runtimeStatus === 'starting' || runtimeStatus === 'preparing') {
    return {
      severity: 'running',
      statusLabel: runtimeStatus,
      containerLabel: preparingContainerLabel,
      phaseLabel: getRuntimeHealthLabel(phase, '运行时准备中'),
      previewLabel: previewPendingLabel,
      message: preparingRuntimeMessage,
      nextAction: '等待容器启动、依赖安装或运行时校验完成。',
      persistenceLabel,
      updatedAtLabel: formatRuntimeTimestamp(status.updatedAt),
      completedAtLabel: formatRuntimeTimestamp(status.completedAt),
      isPreviewAvailable,
      isBlocking: false,
      relatedCapabilityAuditAction: null,
      restartRuntimeAction: null,
    };
  }

  if (runtimeStatus === 'stopped') {
    return {
      severity: 'idle',
      statusLabel: runtimeStatus,
      containerLabel: stoppedContainerLabel,
      phaseLabel: getRuntimeHealthLabel(phase, '运行时未启动'),
      previewLabel: previewUnavailableLabel,
      message: stoppedRuntimeMessage,
      nextAction: '需要预览或执行运行时任务时启动开发环境。',
      persistenceLabel,
      updatedAtLabel: formatRuntimeTimestamp(status.updatedAt),
      completedAtLabel: formatRuntimeTimestamp(status.completedAt),
      isPreviewAvailable,
      isBlocking: false,
      relatedCapabilityAuditAction: null,
      restartRuntimeAction: buildRestartRuntimeAction('stopped'),
    };
  }

  return {
    severity: 'unknown',
    statusLabel,
    containerLabel: unknownContainerLabel,
    phaseLabel: getRuntimeHealthLabel(phase, '未知阶段'),
    previewLabel: previewUnavailableLabel,
    message: unknownRuntimeMessage,
    nextAction: unknownRuntimeNextAction,
    persistenceLabel,
    updatedAtLabel: formatRuntimeTimestamp(status.updatedAt),
    completedAtLabel: formatRuntimeTimestamp(status.completedAt),
    isPreviewAvailable,
    isBlocking: hasError,
    relatedCapabilityAuditAction,
    restartRuntimeAction: buildRestartRuntimeAction('unknown'),
  };
}
