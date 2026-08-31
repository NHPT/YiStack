import type {
  AdminLLMProviderId,
  AdminLLMProvidersResponse,
  AdminProject,
  AuditLog,
  CapabilityProviderPreflightItem,
  CapabilityProviderPreflightItemList,
  CapabilityProviderPreflightResponse,
} from '@/lib/admin/api';
import {
  ADMIN_AUDIT_ACTION_QUERY_PARAM,
  ADMIN_AUDIT_TARGET_TYPE_QUERY_PARAM,
  deriveAdminAuditDiagnosticsSummary,
  type AdminAuditDiagnosticsSummaryModel,
} from './admin-audit-diagnostics-model';
import {
  CAPABILITY_PREFLIGHT_REASON_CODE_QUERY_PARAM,
  CAPABILITY_PREFLIGHT_SEVERITY_QUERY_PARAM,
  deriveCapabilityPreflightPrioritySummary,
  sortCapabilityPreflightItems,
} from './admin-capability-preflight-model';
import {
  ADMIN_PROVIDER_HEALTH_SEVERITY_QUERY_PARAM,
  deriveAdminProviderHealthDiagnosticsSummary,
  type AdminProviderHealthDiagnosticsSummary,
} from './admin-provider-health-diagnostics-model';
import {
  ADMIN_RUNTIME_HEALTH_PROJECT_QUERY_PARAM,
  ADMIN_RUNTIME_HEALTH_SEVERITY_QUERY_PARAM,
  ADMIN_RUNTIME_HEALTH_STATUS_QUERY_PARAM,
  deriveAdminRuntimeHealthDiagnosticsSummary,
  type AdminRuntimeHealthDiagnosticsSummary,
} from './admin-runtime-health-diagnostics-model';

export type AdminDashboardHealthTone = 'success' | 'warning' | 'critical' | 'neutral';
export type AdminDashboardHealthFocusSectionId = 'priority' | 'runtime' | 'config' | 'audit';
export type AdminDashboardDiagnosticsAnchorId = 'admin-dashboard-diagnostics-priority' | 'admin-dashboard-diagnostics-runtime' | 'admin-dashboard-diagnostics-config' | 'admin-dashboard-diagnostics-audit';
export type AdminDashboardDiagnosticsHashHref = '#admin-dashboard-diagnostics-priority' | '#admin-dashboard-diagnostics-runtime' | '#admin-dashboard-diagnostics-config' | '#admin-dashboard-diagnostics-audit';
export type AdminDashboardDiagnosticsHref = AdminDashboardDiagnosticsHashHref | `?${string}${AdminDashboardDiagnosticsHashHref}`;
export type AdminDashboardDiagnosticsQueryParams = {
  [paramName: string]: string | undefined;
};
export type AdminDashboardHealthRunbookItemId = 'provider-blockers' | 'preflight-critical' | 'runtime-blockers' | 'provider-drift' | 'runtime-followup' | 'preflight-warning' | 'audit-context';
export type AdminDashboardHealthPriorityIssueId = `provider-${string}` | `runtime-${string}` | `preflight-${string}` | 'audit-latest-action';

export type AdminDashboardHealthFocusSection = {
  id: AdminDashboardHealthFocusSectionId;
  signalCount: number;
  tone: AdminDashboardHealthTone;
};

export type AdminDashboardHealthRunbookItem = {
  id: AdminDashboardHealthRunbookItemId;
  sectionId: AdminDashboardHealthFocusSectionId;
  tone: AdminDashboardHealthTone;
  title: string;
  description: string;
  signalCount: number;
  href: AdminDashboardDiagnosticsHref;
};

export type AdminDashboardHealthPriorityIssue = {
  id: AdminDashboardHealthPriorityIssueId;
  sectionId: AdminDashboardHealthFocusSectionId;
  tone: AdminDashboardHealthTone;
  title: string;
  description: string;
  evidence: string;
  href: AdminDashboardDiagnosticsHref;
};

export type AdminDashboardHealthSummary = {
  tone: AdminDashboardHealthTone;
  blockerCount: number;
  warningCount: number;
  pendingCount: number;
  auditSignalCount: number;
  primaryMessage: string;
  nextAction: string;
  focusSections: AdminDashboardHealthFocusSection[];
  runbookItems: AdminDashboardHealthRunbookItem[];
  priorityIssues: AdminDashboardHealthPriorityIssue[];
};

type AdminDashboardHealthSummaryInput = {
  providerSnapshot: AdminLLMProvidersResponse | null;
  runtimeProjects: AdminProject[];
  providerPreflight: CapabilityProviderPreflightResponse | null;
  auditLogs: AuditLog[];
};

const EMPTY_ADMIN_DASHBOARD_PREFLIGHT_ITEMS: CapabilityProviderPreflightItemList = [];

function getAdminDashboardHealthSummaryPreflightItems(
  providerPreflight: CapabilityProviderPreflightResponse | null,
): CapabilityProviderPreflightItemList {
  const hasProviderPreflight = providerPreflight !== null;
  if (hasProviderPreflight === false) {
    return EMPTY_ADMIN_DASHBOARD_PREFLIGHT_ITEMS;
  }

  const hasPreflightItems = Array.isArray(providerPreflight.items) === true;
  return hasPreflightItems === true ? providerPreflight.items : EMPTY_ADMIN_DASHBOARD_PREFLIGHT_ITEMS;
}

function getAdminDashboardHealthSummaryPreflightItemCount(items: CapabilityProviderPreflightItemList): number {
  const hasItems = Array.isArray(items) === true;
  return hasItems === true ? items.length : 0;
}

function getAdminDashboardHealthProviderFocusTone(
  providerHealth: AdminProviderHealthDiagnosticsSummary,
): AdminDashboardHealthTone {
  const hasBlockedProviders = providerHealth.blockedCount > 0;
  if (hasBlockedProviders === true) {
    return 'critical';
  }
  return 'warning';
}

function getAdminDashboardHealthRuntimeFocusTone(
  runtimeHealth: AdminRuntimeHealthDiagnosticsSummary,
): AdminDashboardHealthTone {
  const hasBlockedProjects = runtimeHealth.blockedCount > 0;
  if (hasBlockedProjects === true) {
    return 'critical';
  }
  return 'warning';
}

function getAdminDashboardHealthConfigFocusTone(
  criticalCount: number,
): AdminDashboardHealthTone {
  const hasCriticalItems = criticalCount > 0;
  if (hasCriticalItems === true) {
    return 'critical';
  }
  return 'warning';
}

function toFocusSection(
  id: AdminDashboardHealthFocusSectionId,
  signalCount: number,
  tone: AdminDashboardHealthTone,
): AdminDashboardHealthFocusSection | null {
  if (signalCount <= 0) {
    return null;
  }
  return {
    id,
    signalCount,
    tone,
  };
}

function buildFocusSections({
  providerSignals,
  runtimeSignals,
  configSignals,
  auditSignals,
  providerTone,
  runtimeTone,
  configTone,
}: {
  providerSignals: number;
  runtimeSignals: number;
  configSignals: number;
  auditSignals: number;
  providerTone: AdminDashboardHealthTone;
  runtimeTone: AdminDashboardHealthTone;
  configTone: AdminDashboardHealthTone;
}): AdminDashboardHealthFocusSection[] {
  const focusSections: AdminDashboardHealthFocusSection[] = [];
  const candidateSections: Array<AdminDashboardHealthFocusSection | null> = [
    toFocusSection('priority', providerSignals, providerTone),
    toFocusSection('runtime', runtimeSignals, runtimeTone),
    toFocusSection('config', configSignals, configTone),
    toFocusSection('audit', auditSignals, 'neutral'),
  ];

  for (const section of candidateSections) {
    const hasSection = section !== null;
    if (hasSection === true) {
      focusSections.push(section);
    }
  }

  return focusSections;
}

function toRunbookItem(
  item: AdminDashboardHealthRunbookItem,
): AdminDashboardHealthRunbookItem | null {
  if (item.signalCount <= 0) {
    return null;
  }
  return item;
}

function getAdminDashboardRuntimeFollowupSeverityFilter(runtimePreparingCount: number): string {
  const hasPreparingRuntime = runtimePreparingCount > 0;
  if (hasPreparingRuntime === true) {
    return 'running';
  }
  return 'unknown';
}

function getAdminDashboardRuntimeFollowupStatusFilter(runtimePreparingCount: number): string {
  const hasPreparingRuntime = runtimePreparingCount > 0;
  if (hasPreparingRuntime === true) {
    return 'preparing';
  }
  return 'unknown';
}

function getAdminDashboardAuditRunbookActionQueryValue(auditLatestAction: string | null | undefined): string | undefined {
  const hasAuditLatestAction = auditLatestAction !== null && auditLatestAction !== undefined && auditLatestAction.length > 0;
  if (hasAuditLatestAction === true) {
    return auditLatestAction;
  }
  return undefined;
}

export function getAdminDashboardDiagnosticsAnchorId(
  sectionId: AdminDashboardHealthFocusSectionId,
): AdminDashboardDiagnosticsAnchorId {
  switch (sectionId) {
    case 'priority':
      return 'admin-dashboard-diagnostics-priority';
    case 'runtime':
      return 'admin-dashboard-diagnostics-runtime';
    case 'config':
      return 'admin-dashboard-diagnostics-config';
    case 'audit':
      return 'admin-dashboard-diagnostics-audit';
  }
}

export function getAdminDashboardDiagnosticsHashHref(
  sectionId: AdminDashboardHealthFocusSectionId,
): AdminDashboardDiagnosticsHashHref {
  switch (sectionId) {
    case 'priority':
      return '#admin-dashboard-diagnostics-priority';
    case 'runtime':
      return '#admin-dashboard-diagnostics-runtime';
    case 'config':
      return '#admin-dashboard-diagnostics-config';
    case 'audit':
      return '#admin-dashboard-diagnostics-audit';
  }
}

function buildDashboardDiagnosticsHref(
  sectionId: AdminDashboardHealthFocusSectionId,
  params: AdminDashboardDiagnosticsQueryParams,
): AdminDashboardDiagnosticsHref {
  const searchParams = new URLSearchParams();
  for (const key in params) {
    const hasParam = Object.prototype.hasOwnProperty.call(params, key);
    if (hasParam === true) {
      const value = params[key];
      if (value !== undefined) {
        const normalizedValue = value.trim();
        if (normalizedValue !== '') {
          searchParams.set(key, normalizedValue);
        }
      }
    }
  }

  const search = searchParams.toString();
  const hash = getAdminDashboardDiagnosticsHashHref(sectionId);
  return search ? `?${search}${hash}` as AdminDashboardDiagnosticsHref : hash;
}

function addAdminDashboardHealthRunbookItem(
  items: AdminDashboardHealthRunbookItem[],
  item: AdminDashboardHealthRunbookItem,
): void {
  const runbookItem = toRunbookItem(item);
  const hasRunbookItem = runbookItem !== null;
  if (hasRunbookItem === true) {
    items.push(runbookItem);
  }
}

function buildRunbookItems({
  providerBlockedCount,
  providerWarningCount,
  providerDriftCount,
  runtimeBlockedCount,
  runtimePreparingCount,
  runtimeUnknownCount,
  configCriticalCount,
  configWarningCount,
  auditSignalCount,
  auditLatestAction,
}: {
  providerBlockedCount: number;
  providerWarningCount: number;
  providerDriftCount: number;
  runtimeBlockedCount: number;
  runtimePreparingCount: number;
  runtimeUnknownCount: number;
  configCriticalCount: number;
  configWarningCount: number;
  auditSignalCount: number;
  auditLatestAction?: string | null;
}): AdminDashboardHealthRunbookItem[] {
  const runbookItems: AdminDashboardHealthRunbookItem[] = [];

  addAdminDashboardHealthRunbookItem(
    runbookItems,
    {
      id: 'provider-blockers',
      sectionId: 'priority',
      tone: 'critical',
      title: '先处理 Provider 阻断项',
      description: '检查缺失配置、默认 Provider 与当前运行态，确认是否存在会直接阻断能力调用的 Provider。',
      signalCount: providerBlockedCount,
      href: buildDashboardDiagnosticsHref('priority', {
        [ADMIN_PROVIDER_HEALTH_SEVERITY_QUERY_PARAM]: 'blocked',
      }),
    },
  );
  addAdminDashboardHealthRunbookItem(
    runbookItems,
    {
      id: 'preflight-critical',
      sectionId: 'config',
      tone: 'critical',
      title: '再处理 Preflight critical',
      description: '核对启动前置条件、配置键和 reason_code，优先解决会导致能力不可用的配置问题。',
      signalCount: configCriticalCount,
      href: buildDashboardDiagnosticsHref('config', {
        [CAPABILITY_PREFLIGHT_SEVERITY_QUERY_PARAM]: 'critical',
      }),
    },
  );
  addAdminDashboardHealthRunbookItem(
    runbookItems,
    {
      id: 'runtime-blockers',
      sectionId: 'runtime',
      tone: 'critical',
      title: '确认 Runtime 阻断项目',
      description: '查看 failed/stopped runtime 项目的 phase、message 和 next_action，先恢复影响预览或执行链路的项目。',
      signalCount: runtimeBlockedCount,
      href: buildDashboardDiagnosticsHref('runtime', {
        [ADMIN_RUNTIME_HEALTH_SEVERITY_QUERY_PARAM]: 'blocked',
        [ADMIN_RUNTIME_HEALTH_STATUS_QUERY_PARAM]: 'failed',
      }),
    },
  );
  addAdminDashboardHealthRunbookItem(
    runbookItems,
    {
      id: 'provider-drift',
      sectionId: 'priority',
      tone: 'warning',
      title: '排查 Provider 运行态漂移',
      description: '对比 enabled、runtime_loaded、runtime_active 与默认 Provider，处理已启用但未加载或默认不一致的漂移。',
      signalCount: providerWarningCount + providerDriftCount,
      href: buildDashboardDiagnosticsHref('priority', {
        [ADMIN_PROVIDER_HEALTH_SEVERITY_QUERY_PARAM]: 'warning',
      }),
    },
  );
  addAdminDashboardHealthRunbookItem(
    runbookItems,
    {
      id: 'runtime-followup',
      sectionId: 'runtime',
      tone: 'warning',
      title: '跟进 Runtime 准备中或未知状态',
      description: '确认 preparing/unknown 项目是否只是启动中，必要时结合项目级 drilldown 追踪 runtime 快照。',
      signalCount: runtimePreparingCount + runtimeUnknownCount,
      href: buildDashboardDiagnosticsHref('runtime', {
        [ADMIN_RUNTIME_HEALTH_SEVERITY_QUERY_PARAM]: getAdminDashboardRuntimeFollowupSeverityFilter(runtimePreparingCount),
        [ADMIN_RUNTIME_HEALTH_STATUS_QUERY_PARAM]: getAdminDashboardRuntimeFollowupStatusFilter(runtimePreparingCount),
      }),
    },
  );
  addAdminDashboardHealthRunbookItem(
    runbookItems,
    {
      id: 'preflight-warning',
      sectionId: 'config',
      tone: 'warning',
      title: '收敛 Preflight warning',
      description: '处理不会立即阻断但可能引发降级的配置 warning，补齐 provider、config key 与 reason_code 的定位线索。',
      signalCount: configWarningCount,
      href: buildDashboardDiagnosticsHref('config', {
        [CAPABILITY_PREFLIGHT_SEVERITY_QUERY_PARAM]: 'warning',
      }),
    },
  );
  addAdminDashboardHealthRunbookItem(
    runbookItems,
    {
      id: 'audit-context',
      sectionId: 'audit',
      tone: 'neutral',
      title: '最后查看审计上下文',
      description: '结合最近 action/target 分布确认是否有管理操作引发当前运行态或配置态变化。',
      signalCount: auditSignalCount,
      href: buildDashboardDiagnosticsHref('audit', {
        [ADMIN_AUDIT_ACTION_QUERY_PARAM]: getAdminDashboardAuditRunbookActionQueryValue(auditLatestAction),
      }),
    },
  );

  return runbookItems;
}

function getAdminDashboardPreflightIssueProviderLabel(item: CapabilityProviderPreflightItem): string {
  const hasProvider = item.provider.length > 0;
  if (hasProvider === true) {
    return item.provider;
  }
  return 'unknown provider';
}

function getPreflightIssueTitle(item: CapabilityProviderPreflightItem): string {
  const providerLabel = getAdminDashboardPreflightIssueProviderLabel(item);
  return `${providerLabel} preflight ${item.severity}`;
}

function getAdminDashboardProviderPriorityIssueTone(
  provider: AdminProviderHealthDiagnosticsSummary['priorityProviders'][number],
): AdminDashboardHealthTone {
  const isBlockedProvider = provider.severity === 'blocked';
  if (isBlockedProvider === true) {
    return 'critical';
  }
  return 'warning';
}

function getAdminDashboardRuntimePriorityIssueTone(
  project: AdminRuntimeHealthDiagnosticsSummary['priorityProjects'][number],
): AdminDashboardHealthTone {
  if (project.isBlocking === true) {
    return 'critical';
  }
  return 'warning';
}

function getAdminDashboardPreflightPriorityIssueTone(
  item: CapabilityProviderPreflightItem,
): AdminDashboardHealthTone {
  const isCriticalItem = item.severity === 'critical';
  if (isCriticalItem === true) {
    return 'critical';
  }
  return 'warning';
}

function getAdminDashboardPreflightPriorityIssueDescription(item: CapabilityProviderPreflightItem): string {
  const hasReasonCode = item.reason_code.length > 0;
  if (hasReasonCode === true) {
    return item.reason_code;
  }

  const hasSourceNote = item.source_note.length > 0;
  if (hasSourceNote === true) {
    return item.source_note;
  }

  return 'Preflight 发现需要关注的配置态信号。';
}

function getAdminDashboardPreflightPriorityIssueEvidence(item: CapabilityProviderPreflightItem): string {
  const hasNextAction = item.next_action.length > 0;
  if (hasNextAction === true) {
    return item.next_action;
  }

  const hasSourceNote = item.source_note.length > 0;
  if (hasSourceNote === true) {
    return item.source_note;
  }

  return '查看配置态诊断获取 provider、config key 和 reason_code 详情。';
}

function getAdminDashboardAuditPriorityIssueEvidence(summary: AdminAuditDiagnosticsSummaryModel): string {
  const latestAt = summary.latestAt;
  const hasLatestAt = latestAt !== null && latestAt.length > 0;
  if (hasLatestAt === true) {
    return latestAt;
  }
  return '未知时间';
}

function getAdminDashboardAuditTargetTypeQueryValue(summary: AdminAuditDiagnosticsSummaryModel): string | undefined {
  const latestTargetType = summary.latestTargetType;
  const hasLatestTargetType = latestTargetType !== null && latestTargetType.length > 0;
  if (hasLatestTargetType === true) {
    return latestTargetType;
  }
  return undefined;
}

function shouldBuildAdminDashboardAuditPriorityIssue(summary: AdminAuditDiagnosticsSummaryModel): boolean {
  const hasLatestAction = summary.latestAction !== null && summary.latestAction.length > 0;
  return hasLatestAction === true;
}

function buildProviderPriorityIssueId(providerId: AdminLLMProviderId): AdminDashboardHealthPriorityIssueId {
  return `provider-${String(providerId)}`;
}

function buildRuntimePriorityIssueId(projectId: string): AdminDashboardHealthPriorityIssueId {
  return `runtime-${projectId}`;
}

function buildPreflightPriorityIssueId(item: CapabilityProviderPreflightItem): AdminDashboardHealthPriorityIssueId {
  return `preflight-${item.provider}-${item.reason_code}-${item.severity}`;
}

function addAdminDashboardPriorityIssue(
  issues: AdminDashboardHealthPriorityIssue[],
  issue: AdminDashboardHealthPriorityIssue,
): void {
  const hasIssueCapacity = issues.length < 8;
  if (hasIssueCapacity === true) {
    issues.push(issue);
  }
}

function buildPriorityIssues({
  providerHealth,
  runtimeHealth,
  preflightItems,
  auditSummary,
}: {
  providerHealth: AdminProviderHealthDiagnosticsSummary;
  runtimeHealth: AdminRuntimeHealthDiagnosticsSummary;
  preflightItems: CapabilityProviderPreflightItemList;
  auditSummary: AdminAuditDiagnosticsSummaryModel;
}): AdminDashboardHealthPriorityIssue[] {
  const priorityIssues: AdminDashboardHealthPriorityIssue[] = [];

  for (const provider of providerHealth.priorityProviders) {
    addAdminDashboardPriorityIssue(priorityIssues, {
      id: buildProviderPriorityIssueId(provider.id),
      sectionId: 'priority' as const,
      tone: getAdminDashboardProviderPriorityIssueTone(provider),
      title: provider.displayName,
      description: provider.message,
      evidence: provider.nextAction,
      href: buildDashboardDiagnosticsHref('priority', {
        [ADMIN_PROVIDER_HEALTH_SEVERITY_QUERY_PARAM]: provider.severity,
      }),
    });
  }

  let preflightIssueCount = 0;
  for (const item of sortCapabilityPreflightItems(preflightItems)) {
    const hasPreflightIssueCapacity = preflightIssueCount < 5;
    const hasPriorityIssueCapacity = priorityIssues.length < 8;
    if (hasPreflightIssueCapacity === false || hasPriorityIssueCapacity === false) {
      break;
    }

    const isCritical = item.severity === 'critical';
    const isWarning = item.severity === 'warning';
    const shouldAddPreflightIssue = isCritical === true || isWarning === true;
    if (shouldAddPreflightIssue === true) {
      preflightIssueCount += 1;
      addAdminDashboardPriorityIssue(priorityIssues, {
      id: buildPreflightPriorityIssueId(item),
      sectionId: 'config' as const,
      tone: getAdminDashboardPreflightPriorityIssueTone(item),
      title: getPreflightIssueTitle(item),
      description: getAdminDashboardPreflightPriorityIssueDescription(item),
      evidence: getAdminDashboardPreflightPriorityIssueEvidence(item),
      href: buildDashboardDiagnosticsHref('config', {
        [CAPABILITY_PREFLIGHT_SEVERITY_QUERY_PARAM]: item.severity,
        [CAPABILITY_PREFLIGHT_REASON_CODE_QUERY_PARAM]: item.reason_code,
      }),
      });
    }
  }

  for (const project of runtimeHealth.priorityProjects) {
    addAdminDashboardPriorityIssue(priorityIssues, {
      id: buildRuntimePriorityIssueId(project.projectId),
      sectionId: 'runtime' as const,
      tone: getAdminDashboardRuntimePriorityIssueTone(project),
      title: project.name,
      description: project.message,
      evidence: `${project.statusLabel} / ${project.phaseLabel} / ${project.updatedAtLabel}`,
      href: buildDashboardDiagnosticsHref('runtime', {
        [ADMIN_RUNTIME_HEALTH_SEVERITY_QUERY_PARAM]: project.severity,
        [ADMIN_RUNTIME_HEALTH_STATUS_QUERY_PARAM]: project.statusLabel,
        [ADMIN_RUNTIME_HEALTH_PROJECT_QUERY_PARAM]: project.projectId,
      }),
    });
  }

  const shouldBuildAuditIssue = shouldBuildAdminDashboardAuditPriorityIssue(auditSummary);
  if (shouldBuildAuditIssue === true && auditSummary.latestAction !== null) {
    addAdminDashboardPriorityIssue(priorityIssues, {
      id: 'audit-latest-action',
      sectionId: 'audit' as const,
      tone: 'neutral' as const,
      title: auditSummary.latestAction,
      description: '最近审计日志可作为配置态或运行态变化的上下文。',
      evidence: getAdminDashboardAuditPriorityIssueEvidence(auditSummary),
      href: buildDashboardDiagnosticsHref('audit', {
        [ADMIN_AUDIT_ACTION_QUERY_PARAM]: auditSummary.latestAction,
        [ADMIN_AUDIT_TARGET_TYPE_QUERY_PARAM]: getAdminDashboardAuditTargetTypeQueryValue(auditSummary),
      }),
    });
  }

  return priorityIssues;
}

export function deriveAdminDashboardHealthSummary({
  providerSnapshot,
  runtimeProjects,
  providerPreflight,
  auditLogs,
}: AdminDashboardHealthSummaryInput): AdminDashboardHealthSummary {
  const providerHealth = deriveAdminProviderHealthDiagnosticsSummary(providerSnapshot);
  const runtimeHealth = deriveAdminRuntimeHealthDiagnosticsSummary(runtimeProjects);
  const preflightItems = getAdminDashboardHealthSummaryPreflightItems(providerPreflight);
  const preflightItemCount = getAdminDashboardHealthSummaryPreflightItemCount(preflightItems);
  const preflightPriority = deriveCapabilityPreflightPrioritySummary(preflightItems);
  const auditSummary = deriveAdminAuditDiagnosticsSummary(auditLogs);

  const blockerCount = providerHealth.blockedCount
    + runtimeHealth.blockedCount
    + preflightPriority.criticalCount;
  const warningCount = providerHealth.warningCount
    + runtimeHealth.runningCount
    + runtimeHealth.unknownCount
    + preflightPriority.warningCount;
  const pendingCount = providerHealth.driftCount
    + runtimeHealth.priorityProjects.length
    + preflightPriority.criticalCount
    + preflightPriority.warningCount;
  const focusSections = buildFocusSections({
    providerSignals: providerHealth.blockedCount + providerHealth.warningCount + providerHealth.driftCount,
    runtimeSignals: runtimeHealth.blockedCount + runtimeHealth.runningCount + runtimeHealth.unknownCount,
    configSignals: preflightPriority.criticalCount + preflightPriority.warningCount,
    auditSignals: auditSummary.totalLogCount,
    providerTone: getAdminDashboardHealthProviderFocusTone(providerHealth),
    runtimeTone: getAdminDashboardHealthRuntimeFocusTone(runtimeHealth),
    configTone: getAdminDashboardHealthConfigFocusTone(preflightPriority.criticalCount),
  });
  const runbookItems = buildRunbookItems({
    providerBlockedCount: providerHealth.blockedCount,
    providerWarningCount: providerHealth.warningCount,
    providerDriftCount: providerHealth.driftCount,
    runtimeBlockedCount: runtimeHealth.blockedCount,
    runtimePreparingCount: runtimeHealth.runningCount,
    runtimeUnknownCount: runtimeHealth.unknownCount,
    configCriticalCount: preflightPriority.criticalCount,
    configWarningCount: preflightPriority.warningCount,
    auditSignalCount: auditSummary.totalLogCount,
    auditLatestAction: auditSummary.latestAction,
  });
  const priorityIssues = buildPriorityIssues({
    providerHealth,
    runtimeHealth,
    preflightItems,
    auditSummary,
  });

  if (blockerCount > 0) {
    return {
      tone: 'critical',
      blockerCount,
      warningCount,
      pendingCount,
      auditSignalCount: auditSummary.totalLogCount,
      primaryMessage: '存在需要优先处理的阻断项。',
      nextAction: '先查看优先处理和配置态诊断，定位 Provider 或 Preflight 阻断来源。',
      focusSections,
      runbookItems,
      priorityIssues,
    };
  }

  if (warningCount > 0 || pendingCount > 0) {
    return {
      tone: 'warning',
      blockerCount,
      warningCount,
      pendingCount,
      auditSignalCount: auditSummary.totalLogCount,
      primaryMessage: '当前没有阻断项，但仍存在告警或待处理线索。',
      nextAction: '优先确认运行态漂移、准备中 runtime 项目和 Preflight warning。',
      focusSections,
      runbookItems,
      priorityIssues,
    };
  }

  if (
    providerHealth.totalProviderCount === 0
    && runtimeHealth.totalProjectCount === 0
    && preflightItemCount === 0
  ) {
    return {
      tone: 'neutral',
      blockerCount,
      warningCount,
      pendingCount,
      auditSignalCount: auditSummary.totalLogCount,
      primaryMessage: '暂无足够诊断快照。',
      nextAction: '等待 Admin Provider、Runtime 和 Preflight 快照加载后再判断总体健康。',
      focusSections,
      runbookItems,
      priorityIssues,
    };
  }

  return {
    tone: 'success',
    blockerCount,
    warningCount,
    pendingCount,
    auditSignalCount: auditSummary.totalLogCount,
    primaryMessage: '当前核心诊断线索未发现阻断或告警。',
    nextAction: '继续通过下方分组诊断关注配置、运行态和审计上下文。',
    focusSections,
    runbookItems,
    priorityIssues,
  };
}
