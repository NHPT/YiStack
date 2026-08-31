import type {
  CapabilityAuditProfileFilter,
  CapabilityAuditReasonFilter,
  CapabilityAuditStatusFilter,
} from '@/lib/workspace/capability-audit-diagnostics';
import {
  CAPABILITY_AUDIT_PROFILE_QUERY_PARAM,
  CAPABILITY_AUDIT_REASON_QUERY_PARAM,
  CAPABILITY_AUDIT_STATUS_QUERY_PARAM,
  normalizeCapabilityAuditProfileFilter,
  normalizeCapabilityAuditReasonFilter,
  normalizeCapabilityAuditStatusFilter,
} from '@/lib/workspace/capability-audit-diagnostics';
import {
  deriveRuntimeHealthDiagnosticContext,
  RUNTIME_HEALTH_PROJECT_QUERY_PARAM,
  RUNTIME_HEALTH_REASON_QUERY_PARAM,
  type RuntimeHealthDiagnosticContext,
} from '@/lib/workspace/runtime-health-diagnostics';

import type {
  DebugPanelContextSnapshot,
  DebugPanelContextSnapshotSource,
  DebugPanelContextSnapshotStatus,
  DebugPanelContextUrlParamList,
} from './workspace-types';

function hasDebugPanelContextTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function hasDebugPanelRuntimeContext(
  runtimeContext: RuntimeHealthDiagnosticContext | null,
): runtimeContext is RuntimeHealthDiagnosticContext {
  return runtimeContext !== null;
}

function getDebugPanelRuntimeParams(
  runtimeContext: RuntimeHealthDiagnosticContext | null,
): DebugPanelContextUrlParamList {
  if (hasDebugPanelRuntimeContext(runtimeContext) === false) {
    return [];
  }

  return [
    `${RUNTIME_HEALTH_PROJECT_QUERY_PARAM}=${runtimeContext.projectId}`,
    `${RUNTIME_HEALTH_REASON_QUERY_PARAM}=${runtimeContext.reasonCode}`,
  ];
}

function addDebugPanelCapabilityParam({
  urlParams,
  hasParam,
  key,
  value,
}: {
  urlParams: DebugPanelContextUrlParamList;
  hasParam: boolean;
  key: string;
  value: string;
}): void {
  if (hasParam === true) {
    urlParams.push(`${key}=${value}`);
  }
}

function materializeDebugPanelCapabilityParams({
  capabilityStatus,
  capabilityProfile,
  capabilityReason,
}: {
  capabilityStatus: CapabilityAuditStatusFilter;
  capabilityProfile: CapabilityAuditProfileFilter;
  capabilityReason: CapabilityAuditReasonFilter;
}): DebugPanelContextUrlParamList {
  const urlParams: DebugPanelContextUrlParamList = [];
  const hasCapabilityStatus = capabilityStatus !== 'all';
  const hasCapabilityProfile = capabilityProfile !== 'all';
  const hasCapabilityReason = capabilityReason !== 'all';

  addDebugPanelCapabilityParam({
    urlParams,
    hasParam: hasCapabilityStatus,
    key: CAPABILITY_AUDIT_STATUS_QUERY_PARAM,
    value: capabilityStatus,
  });
  addDebugPanelCapabilityParam({
    urlParams,
    hasParam: hasCapabilityProfile,
    key: CAPABILITY_AUDIT_PROFILE_QUERY_PARAM,
    value: capabilityProfile,
  });
  addDebugPanelCapabilityParam({
    urlParams,
    hasParam: hasCapabilityReason,
    key: CAPABILITY_AUDIT_REASON_QUERY_PARAM,
    value: capabilityReason,
  });

  return urlParams;
}

export function buildDebugPanelContextSnapshot(
  projectId: string | null,
  search: string,
  updatedAt: string,
): DebugPanelContextSnapshot {
  const hasProjectId = hasDebugPanelContextTextValue(projectId);

  if (hasProjectId === false) {
    const status: DebugPanelContextSnapshotStatus = 'idle_without_project';
    const source: DebugPanelContextSnapshotSource = 'project_binding';

    return {
      status,
      source,
      message: 'Debug 面板尚未绑定项目。',
      recovery: '进入已绑定的 Workspace 项目后，Debug 面板会展示项目级诊断上下文。',
      urlParams: [],
      updatedAt,
    };
  }

  const params = new URLSearchParams(search);
  const runtimeContext = deriveRuntimeHealthDiagnosticContext(search);
  const capabilityStatus = normalizeCapabilityAuditStatusFilter(params.get(CAPABILITY_AUDIT_STATUS_QUERY_PARAM));
  const capabilityProfile = normalizeCapabilityAuditProfileFilter(params.get(CAPABILITY_AUDIT_PROFILE_QUERY_PARAM));
  const capabilityReason = normalizeCapabilityAuditReasonFilter(params.get(CAPABILITY_AUDIT_REASON_QUERY_PARAM));
  const capabilityParams = materializeDebugPanelCapabilityParams({
    capabilityStatus,
    capabilityProfile,
    capabilityReason,
  });
  const hasRuntimeContext = hasDebugPanelRuntimeContext(runtimeContext);
  const runtimeParams = getDebugPanelRuntimeParams(runtimeContext);

  if (hasRuntimeContext === true && capabilityParams.length > 0) {
    const status: DebugPanelContextSnapshotStatus = 'combined_drilldown';
    const source: DebugPanelContextSnapshotSource = 'runtime_and_capability';

    return {
      status,
      source,
      message: `Debug 面板当前同时携带 runtime 来源上下文和 Capability Audit 筛选：${[...runtimeContext.activeLabels, ...capabilityParams].join(' / ')}。`,
      recovery: '若定位结果不符合预期，可在 Capability Audit 面板中清除筛选并重新从 Runtime Health 或聊天恢复入口进入。',
      urlParams: [...runtimeParams, ...capabilityParams],
      updatedAt,
    };
  }

  if (hasRuntimeContext === true) {
    const status: DebugPanelContextSnapshotStatus = 'runtime_drilldown';
    const source: DebugPanelContextSnapshotSource = 'runtime_health';

    return {
      status,
      source,
      message: `Debug 面板当前来自 Runtime Health 诊断入口：${runtimeContext.activeLabels.join(' / ')}。`,
      recovery: '该上下文只解释跳转来源，不改变 Capability Audit 查询条件；需要筛选阻断记录时可选择 blocked/profile/reason。',
      urlParams: runtimeParams,
      updatedAt,
    };
  }

  if (capabilityParams.length > 0) {
    const status: DebugPanelContextSnapshotStatus = 'capability_filter_drilldown';
    const source: DebugPanelContextSnapshotSource = 'capability_audit';

    return {
      status,
      source,
      message: `Debug 面板当前携带 Capability Audit URL 筛选：${capabilityParams.join(' / ')}。`,
      recovery: '筛选会作用于已加载审计快照；若地址栏不是预期状态，请使用面板内清除筛选或重新打开诊断链接。',
      urlParams: capabilityParams,
      updatedAt,
    };
  }

  const status: DebugPanelContextSnapshotStatus = 'manual_debug';
  const source: DebugPanelContextSnapshotSource = 'debug_tab';

  return {
    status,
    source,
    message: 'Debug 面板当前为手动打开，没有 runtime 或 capability 定位参数。',
    recovery: '可从 Preview Runtime Health 或聊天恢复入口进入 Debug，以携带更具体的诊断定位上下文。',
    urlParams: [],
    updatedAt,
  };
}
