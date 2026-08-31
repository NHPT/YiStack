import type { ProjectRuntimeStatus } from '@/lib/api';
import type { AdminProject } from '@/lib/admin/api';
import {
  deriveRuntimeHealthDiagnosticsSummary,
  type RuntimeHealthSeverity,
} from '@/lib/workspace/runtime-health-diagnostics';
import {
  clearRuntimeHealthSearchParams,
  RUNTIME_HEALTH_PROJECT_QUERY_PARAM,
  updateRuntimeHealthProjectSearch,
  updateRuntimeHealthSearchParam,
} from '@/lib/workspace/runtime-health-query';

export type AdminRuntimeHealthSeverityFilter = RuntimeHealthSeverity | 'all';
export type AdminRuntimeHealthStatusFilter = string | 'all';
export type AdminRuntimeHealthProjectFilter = string | 'all';

export const ADMIN_RUNTIME_HEALTH_SEVERITY_QUERY_PARAM = 'runtime_severity';
export const ADMIN_RUNTIME_HEALTH_STATUS_QUERY_PARAM = 'runtime_status';
export const ADMIN_RUNTIME_HEALTH_PROJECT_QUERY_PARAM = RUNTIME_HEALTH_PROJECT_QUERY_PARAM;

export type AdminRuntimeHealthProjectSummary = {
  projectId: string;
  name: string;
  appType: string;
  severity: RuntimeHealthSeverity;
  statusLabel: string;
  containerLabel: string;
  phaseLabel: string;
  message: string;
  nextAction: string;
  persistenceLabel: string;
  updatedAtLabel: string;
  isBlocking: boolean;
  hasRuntimeStatus: boolean;
};

export type AdminRuntimeHealthFilterState = {
  severityFilter: AdminRuntimeHealthSeverityFilter;
  statusFilter: AdminRuntimeHealthStatusFilter;
  projectFilter?: AdminRuntimeHealthProjectFilter;
};

export type AdminRuntimeHealthActiveFilterLabel = string;
export type AdminRuntimeHealthActiveFilterLabelList = AdminRuntimeHealthActiveFilterLabel[];

export type AdminRuntimeHealthActiveFilterSummary = {
  activeFilterCount: number;
  matchedProjectCount: number;
  totalProjectCount: number;
  activeLabels: AdminRuntimeHealthActiveFilterLabelList;
};

export type AdminRuntimeHealthDiagnosticsSummary = {
  totalProjectCount: number;
  observedRuntimeCount: number;
  readyCount: number;
  runningCount: number;
  blockedCount: number;
  idleCount: number;
  unknownCount: number;
  projects: AdminRuntimeHealthProjectSummary[];
  priorityProjects: AdminRuntimeHealthProjectSummary[];
  focusedProject: AdminRuntimeHealthProjectSummary | null;
  healthyMessage: string;
};

const ADMIN_RUNTIME_HEALTH_SEVERITY_FILTERS: AdminRuntimeHealthSeverityFilter[] = [
  'all',
  'ready',
  'running',
  'blocked',
  'idle',
  'unknown',
];

const severityPriority: Record<RuntimeHealthSeverity, number> = {
  blocked: 0,
  running: 1,
  unknown: 2,
  idle: 3,
  ready: 4,
};

function readString(value?: string): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getAdminRuntimeHealthAppTypeLabel(value?: string): string {
  const normalizedValue = readString(value);
  const hasNormalizedValue = normalizedValue.length > 0;
  return hasNormalizedValue === true ? normalizedValue : 'unknown';
}

function toRuntimeStatus(project: AdminProject): ProjectRuntimeStatus | null {
  const runtimeStatus = project.runtime_status;
  const hasRuntimeStatus = runtimeStatus !== undefined && runtimeStatus !== null;
  if (hasRuntimeStatus === false) {
    return null;
  }
  return runtimeStatus;
}

function toAdminRuntimeHealthProjectSummary(project: AdminProject): AdminRuntimeHealthProjectSummary {
  const runtimeStatus = toRuntimeStatus(project);
  const hasRuntimeStatus = runtimeStatus !== null;
  const summary = deriveRuntimeHealthDiagnosticsSummary(runtimeStatus);
  return {
    projectId: readString(project.project_id) || readString(project.id) || 'unknown-project',
    name: readString(project.name) || readString(project.project_id) || '未命名项目',
    appType: getAdminRuntimeHealthAppTypeLabel(project.app_type),
    severity: summary.severity,
    statusLabel: summary.statusLabel,
    containerLabel: summary.containerLabel,
    phaseLabel: summary.phaseLabel,
    message: summary.message,
    nextAction: summary.nextAction,
    persistenceLabel: summary.persistenceLabel,
    updatedAtLabel: summary.updatedAtLabel,
    isBlocking: summary.isBlocking,
    hasRuntimeStatus,
  };
}

export function normalizeAdminRuntimeHealthSeverityFilter(value?: string | null): AdminRuntimeHealthSeverityFilter {
  const normalizedValue = value?.trim() as AdminRuntimeHealthSeverityFilter | undefined;
  const hasNormalizedValue = normalizedValue !== undefined && normalizedValue.length > 0;
  const isKnownFilter = hasNormalizedValue === true && ADMIN_RUNTIME_HEALTH_SEVERITY_FILTERS.includes(normalizedValue);
  if (isKnownFilter === false) {
    return 'all';
  }
  return normalizedValue;
}

export function normalizeAdminRuntimeHealthStatusFilter(value?: string | null): AdminRuntimeHealthStatusFilter {
  const normalizedValue = value?.trim().toLowerCase();
  const hasNormalizedValue = normalizedValue !== undefined && normalizedValue.length > 0;
  if (hasNormalizedValue === false || normalizedValue === 'all') {
    return 'all';
  }
  return normalizedValue;
}

export function normalizeAdminRuntimeHealthProjectFilter(value?: string | null): AdminRuntimeHealthProjectFilter {
  const normalizedValue = value?.trim();
  const hasNormalizedValue = normalizedValue !== undefined && normalizedValue.length > 0;
  if (hasNormalizedValue === false || normalizedValue === 'all') {
    return 'all';
  }
  return normalizedValue;
}

export function updateAdminRuntimeHealthSeveritySearch(
  search: string,
  severityFilter: AdminRuntimeHealthSeverityFilter,
): string {
  return updateRuntimeHealthSearchParam(search, ADMIN_RUNTIME_HEALTH_SEVERITY_QUERY_PARAM, severityFilter);
}

export function updateAdminRuntimeHealthStatusSearch(
  search: string,
  statusFilter: AdminRuntimeHealthStatusFilter,
): string {
  return updateRuntimeHealthSearchParam(search, ADMIN_RUNTIME_HEALTH_STATUS_QUERY_PARAM, statusFilter);
}

export function updateAdminRuntimeHealthProjectSearch(
  search: string,
  projectFilter: AdminRuntimeHealthProjectFilter,
): string {
  return updateRuntimeHealthProjectSearch(search, projectFilter);
}

export function clearAdminRuntimeHealthFilterSearch(search: string): string {
  return clearRuntimeHealthSearchParams(search, [
    ADMIN_RUNTIME_HEALTH_SEVERITY_QUERY_PARAM,
    ADMIN_RUNTIME_HEALTH_STATUS_QUERY_PARAM,
    ADMIN_RUNTIME_HEALTH_PROJECT_QUERY_PARAM,
  ]);
}

function compareRuntimeProjectSummary(
  left: AdminRuntimeHealthProjectSummary,
  right: AdminRuntimeHealthProjectSummary,
) {
  const severityDiff = severityPriority[left.severity] - severityPriority[right.severity];
  if (severityDiff !== 0) {
    return severityDiff;
  }
  return left.name.localeCompare(right.name, 'zh-CN');
}

function deriveAdminRuntimeHealthProjectSummaries(
  projects: AdminProject[],
): AdminRuntimeHealthProjectSummary[] {
  const projectSummaries: AdminRuntimeHealthProjectSummary[] = [];

  for (const project of projects) {
    projectSummaries.push(toAdminRuntimeHealthProjectSummary(project));
  }

  return projectSummaries.sort(compareRuntimeProjectSummary);
}

export function filterAdminRuntimeHealthProjects(
  projects: AdminRuntimeHealthProjectSummary[],
  severityFilter: AdminRuntimeHealthSeverityFilter,
  statusFilter: AdminRuntimeHealthStatusFilter,
): AdminRuntimeHealthProjectSummary[] {
  const filteredProjects: AdminRuntimeHealthProjectSummary[] = [];

  for (const project of projects) {
    const shouldIncludeProject = shouldIncludeAdminRuntimeHealthProject(project, severityFilter, statusFilter);
    if (shouldIncludeProject === true) {
      filteredProjects.push(project);
    }
  }

  return filteredProjects;
}

function shouldIncludeAdminRuntimeHealthProject(
  project: AdminRuntimeHealthProjectSummary,
  severityFilter: AdminRuntimeHealthSeverityFilter,
  statusFilter: AdminRuntimeHealthStatusFilter,
): boolean {
  const severityMatched = severityFilter === 'all' || project.severity === severityFilter;
  const statusMatched = statusFilter === 'all' || project.statusLabel.toLowerCase() === statusFilter;
  return severityMatched === true && statusMatched === true;
}

function countAdminRuntimeHealthProjectsBySeverity(
  projectSummaries: AdminRuntimeHealthProjectSummary[],
  severity: RuntimeHealthSeverity,
): number {
  let count = 0;

  for (const project of projectSummaries) {
    const isMatchedSeverity = project.severity === severity;
    if (isMatchedSeverity === true) {
      count += 1;
    }
  }

  return count;
}

function countObservedAdminRuntimeHealthProjects(
  projectSummaries: AdminRuntimeHealthProjectSummary[],
): number {
  let count = 0;

  for (const project of projectSummaries) {
    if (project.hasRuntimeStatus === true) {
      count += 1;
    }
  }

  return count;
}

function shouldIncludeAdminRuntimeHealthPriorityProject(project: AdminRuntimeHealthProjectSummary): boolean {
  const isBlocking = project.isBlocking === true;
  const isRunning = project.severity === 'running';
  const isUnknown = project.severity === 'unknown';
  return isBlocking === true || isRunning === true || isUnknown === true;
}

function listAdminRuntimeHealthPriorityProjects(
  projectSummaries: AdminRuntimeHealthProjectSummary[],
): AdminRuntimeHealthProjectSummary[] {
  const priorityProjects: AdminRuntimeHealthProjectSummary[] = [];

  for (const project of projectSummaries) {
    const shouldIncludeProject = shouldIncludeAdminRuntimeHealthPriorityProject(project);
    if (shouldIncludeProject === true) {
      priorityProjects.push(project);
    }

    const hasPriorityProjectLimit = priorityProjects.length >= 5;
    if (hasPriorityProjectLimit === true) {
      break;
    }
  }

  return priorityProjects;
}

function resolveAdminRuntimeHealthFocusedProject(
  projectSummaries: AdminRuntimeHealthProjectSummary[],
  projectFilter: AdminRuntimeHealthProjectFilter | undefined,
): AdminRuntimeHealthProjectSummary | null {
  const hasProjectFilter = projectFilter !== undefined && projectFilter !== 'all';
  if (hasProjectFilter === false) {
    return null;
  }

  for (const project of projectSummaries) {
    const isMatchedProject = project.projectId === projectFilter;
    if (isMatchedProject === true) {
      return project;
    }
  }

  return null;
}

export function deriveAdminRuntimeHealthActiveFilterSummary(
  totalProjects: AdminRuntimeHealthProjectSummary[],
  matchedProjects: AdminRuntimeHealthProjectSummary[],
  filters: AdminRuntimeHealthFilterState,
): AdminRuntimeHealthActiveFilterSummary {
  const activeLabels: AdminRuntimeHealthActiveFilterLabelList = [];
  const hasSeverityFilter = filters.severityFilter !== 'all';
  const hasStatusFilter = filters.statusFilter !== 'all';
  const hasProjectFilter = filters.projectFilter !== undefined && filters.projectFilter !== 'all';
  if (hasSeverityFilter === true) {
    activeLabels.push(`${ADMIN_RUNTIME_HEALTH_SEVERITY_QUERY_PARAM}=${filters.severityFilter}`);
  }
  if (hasStatusFilter === true) {
    activeLabels.push(`${ADMIN_RUNTIME_HEALTH_STATUS_QUERY_PARAM}=${filters.statusFilter}`);
  }
  if (hasProjectFilter === true) {
    activeLabels.push(`${ADMIN_RUNTIME_HEALTH_PROJECT_QUERY_PARAM}=${filters.projectFilter}`);
  }

  return {
    activeFilterCount: activeLabels.length,
    matchedProjectCount: matchedProjects.length,
    totalProjectCount: totalProjects.length,
    activeLabels,
  };
}

export function deriveAdminRuntimeHealthDiagnosticsSummary(
  projects: AdminProject[],
  filters: AdminRuntimeHealthFilterState = {
    severityFilter: 'all',
    statusFilter: 'all',
    projectFilter: 'all',
  },
): AdminRuntimeHealthDiagnosticsSummary {
  const allProjectSummaries = deriveAdminRuntimeHealthProjectSummaries(projects);
  const projectSummaries = filterAdminRuntimeHealthProjects(
    allProjectSummaries,
    filters.severityFilter,
    filters.statusFilter,
  );

  const blockedCount = countAdminRuntimeHealthProjectsBySeverity(projectSummaries, 'blocked');
  const runningCount = countAdminRuntimeHealthProjectsBySeverity(projectSummaries, 'running');
  const unknownCount = countAdminRuntimeHealthProjectsBySeverity(projectSummaries, 'unknown');
  const idleCount = countAdminRuntimeHealthProjectsBySeverity(projectSummaries, 'idle');
  const readyCount = countAdminRuntimeHealthProjectsBySeverity(projectSummaries, 'ready');
  const observedRuntimeCount = countObservedAdminRuntimeHealthProjects(allProjectSummaries);
  const priorityProjects = listAdminRuntimeHealthPriorityProjects(projectSummaries);
  const focusedProject = resolveAdminRuntimeHealthFocusedProject(allProjectSummaries, filters.projectFilter);

  return {
    totalProjectCount: allProjectSummaries.length,
    observedRuntimeCount,
    readyCount,
    runningCount,
    blockedCount,
    idleCount,
    unknownCount,
    projects: projectSummaries,
    priorityProjects,
    focusedProject,
    healthyMessage: blockedCount === 0 && runningCount === 0 && unknownCount === 0 && projectSummaries.length > 0
      ? '当前没有阻断、准备中或未知 runtime 项目。'
      : '',
  };
}
