import { strict as assert } from 'node:assert';
import fs from 'node:fs';

import type { AdminProject } from '../src/lib/admin/api';
import {
  clearAdminRuntimeHealthFilterSearch,
  ADMIN_RUNTIME_HEALTH_PROJECT_QUERY_PARAM,
  deriveAdminRuntimeHealthActiveFilterSummary,
  deriveAdminRuntimeHealthDiagnosticsSummary,
  normalizeAdminRuntimeHealthProjectFilter,
  normalizeAdminRuntimeHealthSeverityFilter,
  normalizeAdminRuntimeHealthStatusFilter,
  updateAdminRuntimeHealthProjectSearch,
  updateAdminRuntimeHealthSeveritySearch,
  updateAdminRuntimeHealthStatusSearch,
} from '../src/app/admin/admin-runtime-health-diagnostics-model';
import {
  RUNTIME_HEALTH_PROJECT_QUERY_PARAM,
  updateRuntimeHealthProjectSearch,
} from '../src/lib/workspace/runtime-health-query';

const adminRuntimeHealthModel = fs.readFileSync('src/app/admin/admin-runtime-health-diagnostics-model.ts', 'utf8');
const sharedRuntimeHealthDiagnostics = fs.readFileSync('src/lib/workspace/runtime-health-diagnostics.ts', 'utf8');
const adminRuntimeHealthCard = fs.readFileSync('src/app/admin/admin-runtime-health-diagnostics-card.tsx', 'utf8');
const adminDiagnosticLinkCopyHook = fs.readFileSync('src/app/admin/use-admin-diagnostic-link-copy.ts', 'utf8');
const adminApiClient = fs.readFileSync('src/lib/admin/api.ts', 'utf8');
const adminPage = fs.readFileSync('src/app/admin/page.tsx', 'utf8');
assert.match(
  adminRuntimeHealthModel,
  /from '@\/lib\/workspace\/runtime-health-diagnostics'/,
  'admin runtime health diagnostics should reuse the shared workspace runtime health diagnostics model',
);
assert.match(
  adminRuntimeHealthModel,
  /export type AdminRuntimeHealthActiveFilterLabel = string;[\s\S]*export type AdminRuntimeHealthActiveFilterLabelList = AdminRuntimeHealthActiveFilterLabel\[\];[\s\S]*activeLabels: AdminRuntimeHealthActiveFilterLabelList;[\s\S]*const activeLabels: AdminRuntimeHealthActiveFilterLabelList = \[\];[\s\S]*const hasSeverityFilter = filters\.severityFilter !== 'all';[\s\S]*const hasStatusFilter = filters\.statusFilter !== 'all';[\s\S]*const hasProjectFilter = filters\.projectFilter !== undefined && filters\.projectFilter !== 'all';[\s\S]*if \(hasSeverityFilter === true\)[\s\S]*activeLabels\.push\(`\$\{ADMIN_RUNTIME_HEALTH_SEVERITY_QUERY_PARAM\}=\$\{filters\.severityFilter\}`\);[\s\S]*if \(hasStatusFilter === true\)[\s\S]*activeLabels\.push\(`\$\{ADMIN_RUNTIME_HEALTH_STATUS_QUERY_PARAM\}=\$\{filters\.statusFilter\}`\);[\s\S]*if \(hasProjectFilter === true\)[\s\S]*activeLabels\.push\(`\$\{ADMIN_RUNTIME_HEALTH_PROJECT_QUERY_PARAM\}=\$\{filters\.projectFilter\}`\);/,
  'admin runtime health diagnostics should name active filter label contracts and derive URL labels through explicit active filter facts',
);
assert.doesNotMatch(
  adminRuntimeHealthModel,
  /activeLabels: string\[\];|const activeLabels: string\[\]|const activeLabels: AdminRuntimeHealthActiveFilterLabelList = \[[\s\S]*\]\.filter\(Boolean\)/,
  'admin runtime health diagnostics should not keep active filter labels as an anonymous string array contract or filter(Boolean) list',
);
assert.match(
  adminRuntimeHealthModel,
  /const runtimeStatus = project\.runtime_status;[\s\S]*const hasRuntimeStatus = runtimeStatus !== undefined && runtimeStatus !== null;[\s\S]*if \(hasRuntimeStatus === false\)[\s\S]*return runtimeStatus;[\s\S]*function toAdminRuntimeHealthProjectSummary\(project: AdminProject\): AdminRuntimeHealthProjectSummary[\s\S]*const hasRuntimeStatus = runtimeStatus !== null;[\s\S]*hasRuntimeStatus,[\s\S]*const hasNormalizedValue = normalizedValue !== undefined && normalizedValue\.length > 0;[\s\S]*const isKnownFilter = hasNormalizedValue === true && ADMIN_RUNTIME_HEALTH_SEVERITY_FILTERS\.includes\(normalizedValue\);[\s\S]*if \(isKnownFilter === false\)[\s\S]*for \(const project of projects\)[\s\S]*projectSummaries\.push\(toAdminRuntimeHealthProjectSummary\(project\)\);[\s\S]*function shouldIncludeAdminRuntimeHealthProject\([\s\S]*return severityMatched === true && statusMatched === true;[\s\S]*function countAdminRuntimeHealthProjectsBySeverity\([\s\S]*for \(const project of projectSummaries\)[\s\S]*const isMatchedSeverity = project\.severity === severity;[\s\S]*function countObservedAdminRuntimeHealthProjects\([\s\S]*project\.hasRuntimeStatus === true[\s\S]*function shouldIncludeAdminRuntimeHealthPriorityProject\(project: AdminRuntimeHealthProjectSummary\): boolean[\s\S]*project\.isBlocking === true[\s\S]*function listAdminRuntimeHealthPriorityProjects\([\s\S]*for \(const project of projectSummaries\)[\s\S]*priorityProjects\.length >= 5[\s\S]*function resolveAdminRuntimeHealthFocusedProject\([\s\S]*const hasProjectFilter = projectFilter !== undefined && projectFilter !== 'all';[\s\S]*for \(const project of projectSummaries\)[\s\S]*const isMatchedProject = project\.projectId === projectFilter;/,
  'admin runtime health diagnostics should derive runtime status presence, active filters, priority rows and focused drilldown through explicit facts',
);
assert.match(
  adminRuntimeHealthModel,
  /function getAdminRuntimeHealthAppTypeLabel\(value\?: string\): string[\s\S]*const normalizedValue = readString\(value\);[\s\S]*const hasNormalizedValue = normalizedValue\.length > 0;[\s\S]*return hasNormalizedValue === true \? normalizedValue : 'unknown';[\s\S]*appType: getAdminRuntimeHealthAppTypeLabel\(project\.app_type\),/,
  'admin runtime health diagnostics should derive project app type display labels through explicit display facts',
);
assert.doesNotMatch(
  adminRuntimeHealthModel,
  /Boolean\(runtimeStatus\)|!project\.runtime_status|!normalizedValue|\.filter\(Boolean\)|projects\.map\(|projects\.filter\(|projectSummaries\.filter\(|allProjectSummaries\.filter\(|allProjectSummaries\.find\(|filter\(\(project\) => project\.hasRuntimeStatus\)|filter\(\(project\) => project\.isBlocking \|\||const focusedProject = filters\.projectFilter && filters\.projectFilter !== 'all'|readString\(project\.app_type\) \|\| 'unknown'/,
  'admin runtime health diagnostics should not regress runtime status, URL filters, counts, priority rows or drilldown gates to Boolean coercion, filter(Boolean), inline array pipelines, truthy predicates or implicit conjunctions',
);
assert.match(
  sharedRuntimeHealthDiagnostics,
  /export function deriveRuntimeHealthDiagnosticsSummary/,
  'shared workspace runtime health diagnostics should own runtime status summary derivation',
);
assert.match(
  adminRuntimeHealthCard,
  /function getAdminRuntimeHealthActiveFilterLabelSuffix\(summary: AdminRuntimeHealthActiveFilterSummary\): string \{[\s\S]*const hasActiveLabels = summary\.activeLabels\.length > 0;[\s\S]*return hasActiveLabels === true \? ` \/ \$\{summary\.activeLabels\.join\(' \/ '\)\}` : '';[\s\S]*const activeFilterLabelSuffix = getAdminRuntimeHealthActiveFilterLabelSuffix\(activeFilterSummary\);[\s\S]*\{activeFilterLabelSuffix\}/,
  'admin runtime health card should render active URL filter labels through a named suffix fact',
);
assert.match(
  adminRuntimeHealthCard,
  /function getAdminRuntimeHealthRunningBadgeTone\(summary: AdminRuntimeHealthDiagnosticsSummary\): AdminDiagnosticTone \{[\s\S]*const hasRunningProjects = summary\.runningCount > 0;[\s\S]*if \(hasRunningProjects === true\)[\s\S]*return 'warning';[\s\S]*return 'neutral';[\s\S]*function getAdminRuntimeHealthBlockedBadgeTone\(summary: AdminRuntimeHealthDiagnosticsSummary\): AdminDiagnosticTone \{[\s\S]*const hasBlockedProjects = summary\.blockedCount > 0;[\s\S]*if \(hasBlockedProjects === true\)[\s\S]*return 'critical';[\s\S]*return 'neutral';[\s\S]*function getAdminRuntimeHealthEmptyMessage\(summary: AdminRuntimeHealthDiagnosticsSummary, copy: AdminCopy\): string \| undefined \{[\s\S]*const hasProjects = summary\.totalProjectCount > 0;[\s\S]*if \(hasProjects === true\)[\s\S]*return undefined;[\s\S]*return copy\.runtimeHealthEmpty;[\s\S]*function getAdminRuntimeHealthHealthyMessage\(summary: AdminRuntimeHealthDiagnosticsSummary\): string \| undefined \{[\s\S]*const hasHealthyMessage = summary\.healthyMessage\.length > 0;[\s\S]*if \(hasHealthyMessage === false\)[\s\S]*return undefined;[\s\S]*return summary\.healthyMessage;[\s\S]*function getAdminRuntimeHealthFilterOptionLabel\(option: string, copy: AdminCopy\): string \{[\s\S]*const isAllOption = option === 'all';[\s\S]*if \(isAllOption === true\)[\s\S]*return copy\.runtimeHealthAll;[\s\S]*return option;[\s\S]*function getAdminRuntimeHealthDiagnosticLinkCopyActionLabel\(isCopied: boolean, copy: AdminCopy\): string \{[\s\S]*if \(isCopied === true\)[\s\S]*return copy\.runtimeHealthDiagnosticLinkCopied;[\s\S]*return copy\.runtimeHealthCopyDiagnosticLink;[\s\S]*const runningBadgeTone = getAdminRuntimeHealthRunningBadgeTone\(summary\);[\s\S]*const blockedBadgeTone = getAdminRuntimeHealthBlockedBadgeTone\(summary\);[\s\S]*const emptyMessage = getAdminRuntimeHealthEmptyMessage\(summary, copy\);[\s\S]*const healthyMessage = getAdminRuntimeHealthHealthyMessage\(summary\);[\s\S]*const diagnosticLinkCopyActionLabel = getAdminRuntimeHealthDiagnosticLinkCopyActionLabel\(diagnosticLinkCopied, copy\);[\s\S]*tone: runningBadgeTone[\s\S]*tone: blockedBadgeTone[\s\S]*emptyMessage=\{emptyMessage\}[\s\S]*healthyMessage=\{healthyMessage\}[\s\S]*\{diagnosticLinkCopyActionLabel\}/,
  'admin runtime health card should derive badge tones, messages, filter option labels and copy action labels through named display facts',
);
assert.match(
  adminRuntimeHealthCard,
  /import type \{ ReactNode \} from 'react';[\s\S]*type AdminRuntimeHealthProjectSummary,[\s\S]*function materializeAdminRuntimeHealthFilterOptionNodes\([\s\S]*options: readonly string\[\],[\s\S]*copy: AdminCopy,[\s\S]*\): ReactNode\[\] \{[\s\S]*const nodes: ReactNode\[\] = \[\];[\s\S]*for \(const option of options\)[\s\S]*nodes\.push\([\s\S]*getAdminRuntimeHealthFilterOptionLabel\(option, copy\)[\s\S]*function materializeAdminRuntimeHealthProjectDrilldownOptionNodes\([\s\S]*projects: readonly AdminRuntimeHealthProjectSummary\[\],[\s\S]*\): ReactNode\[\] \{[\s\S]*for \(const project of projects\)[\s\S]*project\.projectId[\s\S]*project\.persistenceLabel[\s\S]*function materializeAdminRuntimeHealthPriorityProjectNodes\([\s\S]*projects: readonly AdminRuntimeHealthProjectSummary\[\],[\s\S]*copy: AdminCopy,[\s\S]*onOpenProjectDrilldown: \(projectFilter: AdminRuntimeHealthProjectFilter\) => void,[\s\S]*\): ReactNode\[\] \{[\s\S]*for \(const project of projects\)[\s\S]*onOpenProjectDrilldown\(project\.projectId\)[\s\S]*materializeAdminRuntimeHealthFilterOptionNodes\(runtimeSeverityOptions, copy\)[\s\S]*materializeAdminRuntimeHealthFilterOptionNodes\(runtimeStatusOptions, copy\)[\s\S]*materializeAdminRuntimeHealthProjectDrilldownOptionNodes\(unfilteredSummary\.projects\)[\s\S]*materializeAdminRuntimeHealthPriorityProjectNodes\(summary\.priorityProjects, copy, updateProjectFilter\)/,
  'admin runtime health card should materialize filter options, drilldown options and priority project nodes through named for-of node materializers',
);
assert.match(
  adminRuntimeHealthCard,
  /type AdminRuntimeHealthActiveFilterSummary,[\s\S]*type AdminRuntimeHealthDiagnosticsSummary,[\s\S]*function shouldRenderAdminRuntimeHealthFilteredEmpty\([\s\S]*summary: AdminRuntimeHealthDiagnosticsSummary,[\s\S]*activeFilterSummary: AdminRuntimeHealthActiveFilterSummary,[\s\S]*const hasMatchedProjects = summary\.projects\.length > 0;[\s\S]*const hasActiveFilters = activeFilterSummary\.activeFilterCount > 0;[\s\S]*return hasMatchedProjects === false && hasActiveFilters === true;[\s\S]*function shouldRenderAdminRuntimeHealthPriorityProjects\(summary: AdminRuntimeHealthDiagnosticsSummary\): boolean \{[\s\S]*const priorityProjectCount = summary\.priorityProjects\.length;[\s\S]*return priorityProjectCount > 0;[\s\S]*function shouldRenderAdminRuntimeHealthDiagnosticsContent\(summary: AdminRuntimeHealthDiagnosticsSummary\): boolean \{[\s\S]*const totalProjectCount = summary\.totalProjectCount;[\s\S]*return totalProjectCount > 0;[\s\S]*function shouldRenderAdminRuntimeHealthFocusedProject\(summary: AdminRuntimeHealthDiagnosticsSummary\): boolean \{[\s\S]*const hasFocusedProject = summary\.focusedProject !== null;[\s\S]*return hasFocusedProject === true;[\s\S]*function shouldRenderAdminRuntimeHealthProjectDrilldownMissing\([\s\S]*summary: AdminRuntimeHealthDiagnosticsSummary,[\s\S]*projectFilter: AdminRuntimeHealthProjectFilter,[\s\S]*const hasFocusedProject = summary\.focusedProject !== null;[\s\S]*const hasProjectFilter = projectFilter !== 'all';[\s\S]*return hasFocusedProject === false && hasProjectFilter === true;[\s\S]*const shouldRenderFilteredEmpty = shouldRenderAdminRuntimeHealthFilteredEmpty\(summary, activeFilterSummary\);[\s\S]*const activeFilterLabelSuffix = getAdminRuntimeHealthActiveFilterLabelSuffix\(activeFilterSummary\);[\s\S]*const shouldRenderPriorityProjects = shouldRenderAdminRuntimeHealthPriorityProjects\(summary\);[\s\S]*const shouldRenderDiagnosticsContent = shouldRenderAdminRuntimeHealthDiagnosticsContent\(summary\);[\s\S]*const shouldRenderFocusedProject = shouldRenderAdminRuntimeHealthFocusedProject\(summary\);[\s\S]*const shouldRenderProjectDrilldownMissing = shouldRenderAdminRuntimeHealthProjectDrilldownMissing\(summary, projectFilter\);[\s\S]*\{shouldRenderDiagnosticsContent === true && \([\s\S]*\{shouldRenderFocusedProject === true && summary\.focusedProject !== null && \([\s\S]*\{shouldRenderProjectDrilldownMissing === true && \([\s\S]*\{shouldRenderPriorityProjects === true && \([\s\S]*\{shouldRenderFilteredEmpty === true && \(/,
  'admin runtime health card should render diagnostics content, drilldown, filtered-empty state, active label suffix and priority projects through named explicit facts',
);
assert.doesNotMatch(
  adminRuntimeHealthCard,
  /summary\.projects\.length === 0 && activeFilterSummary\.activeFilterCount > 0 \?|activeFilterSummary\.activeLabels\.length > 0 \?|summary\.priorityProjects\.length > 0 \?|summary\.totalProjectCount > 0 \?|summary\.focusedProject \?|projectFilter !== 'all' \?|summary\.runningCount > 0 \? 'warning' : 'neutral'|summary\.blockedCount > 0 \? 'critical' : 'neutral'|summary\.totalProjectCount === 0 \? copy\.runtimeHealthEmpty : undefined|summary\.healthyMessage \|\| undefined|option === 'all' \? copy\.runtimeHealthAll : option|diagnosticLinkCopied \? copy\.runtimeHealthDiagnosticLinkCopied : copy\.runtimeHealthCopyDiagnosticLink|shouldRenderPriorityProjects === true \? \(|runtime(?:Severity|Status)Options\.map\(|unfilteredSummary\.projects\.map\(|summary\.priorityProjects\.map\(/,
  'admin runtime health card should not regress diagnostics content, drilldown, filtered-empty rendering, active label suffix, badge tones, messages, action labels or node materializers to inline ternary gates or JSX array maps',
);
assert.match(
  adminPage,
  /AdminRuntimeHealthDiagnosticsCard/,
  'admin page should keep Admin Runtime Health diagnostics card mounted',
);
assert.match(
  adminDiagnosticLinkCopyHook,
  /!navigator\.clipboard[\s\S]*formatAdminDiagnosticMissingClipboardError\(\)[\s\S]*复制诊断链接失败：\$\{reason\}[\s\S]*当前诊断链接没有写入系统剪贴板/,
  'admin diagnostic link copy hook should surface missing clipboard support through the shared clipboard formatter',
);
assert.match(
  adminDiagnosticLinkCopyHook,
  /catch \(error\)[\s\S]*formatAdminDiagnosticLocalError\(error, '浏览器拒绝了剪贴板访问', 'clipboard'\)[\s\S]*复制诊断链接失败：\$\{reason\}[\s\S]*当前诊断链接没有写入系统剪贴板[\s\S]*手动复制地址栏链接/,
  'admin diagnostic link copy hook should surface clipboard write failures through the shared clipboard formatter with manual-copy guidance',
);
assert.match(
  adminRuntimeHealthCard,
  /import \{ useAdminDiagnosticLinkCopy \} from '\.\/use-admin-diagnostic-link-copy';[\s\S]*const \{ diagnosticLinkCopied, diagnosticLinkCopyError, copyCurrentDiagnosticLink \} = useAdminDiagnosticLinkCopy\(\);/,
  'admin runtime health diagnostics should use the shared diagnostic link copy hook',
);
assert.match(
  adminRuntimeHealthCard,
  /function shouldRenderAdminRuntimeHealthDiagnosticLinkCopyError\(error: string \| null\): boolean \{[\s\S]*const hasError = error !== null && error\.length > 0;[\s\S]*return hasError === true;[\s\S]*function shouldRenderAdminRuntimeHealthDiagnosticUrlSyncError\(error: string \| null\): boolean \{[\s\S]*const hasError = error !== null && error\.length > 0;[\s\S]*return hasError === true;[\s\S]*const shouldRenderDiagnosticLinkCopyError = shouldRenderAdminRuntimeHealthDiagnosticLinkCopyError\(diagnosticLinkCopyError\);[\s\S]*const shouldRenderDiagnosticUrlSyncError = shouldRenderAdminRuntimeHealthDiagnosticUrlSyncError\(diagnosticUrlSyncError\);[\s\S]*\{shouldRenderDiagnosticLinkCopyError === true && \([\s\S]*\{diagnosticLinkCopyError\}[\s\S]*\{shouldRenderDiagnosticUrlSyncError === true && \([\s\S]*\{diagnosticUrlSyncError\}/,
  'admin runtime health diagnostics should render user-visible diagnostic link copy and URL sync failures through named explicit gates',
);
assert.doesNotMatch(
  adminRuntimeHealthCard,
  /diagnosticLinkCopyError \?|diagnosticUrlSyncError \?/,
  'admin runtime health diagnostics should not regress diagnostic copy or URL sync errors to inline nullable ternaries',
);

function createProject(overrides: Partial<AdminProject> = {}): AdminProject {
  return {
    id: overrides.id ?? overrides.project_id ?? 'project-id',
    project_id: overrides.project_id ?? 'project-id',
    user_id: overrides.user_id ?? 'user-id',
    name: overrides.name ?? 'Project',
    app_type: overrides.app_type ?? 'web',
    container_status: overrides.container_status ?? 'running',
    runtime_status: overrides.runtime_status,
    created_at: overrides.created_at,
    updated_at: overrides.updated_at,
  };
}

const emptySummary = deriveAdminRuntimeHealthDiagnosticsSummary([]);
assert.equal(emptySummary.totalProjectCount, 0);
assert.equal(emptySummary.observedRuntimeCount, 0);
assert.equal(emptySummary.priorityProjects.length, 0);
assert.equal(emptySummary.healthyMessage, '');

const healthySummary = deriveAdminRuntimeHealthDiagnosticsSummary([
  createProject({
    project_id: 'ready-project',
    name: 'Ready Project',
    runtime_status: {
      projectId: 'ready-project',
      status: 'ready',
      containerStatus: 'running',
      phase: 'ready',
      message: 'runtime ready',
      updatedAt: '2026-07-14T10:00:00Z',
    },
  }),
]);
assert.equal(healthySummary.totalProjectCount, 1);
assert.equal(healthySummary.observedRuntimeCount, 1);
assert.equal(healthySummary.readyCount, 1);
assert.equal(healthySummary.blockedCount, 0);
assert.equal(healthySummary.priorityProjects.length, 0);
assert.equal(healthySummary.healthyMessage, '当前没有阻断、准备中或未知 runtime 项目。');

const mixedProjects = [
  createProject({
    project_id: 'ready-project',
    name: 'Ready Project',
    runtime_status: {
      status: 'ready',
      containerStatus: 'running',
      phase: 'ready',
      message: 'ready',
    },
  }),
  createProject({
    project_id: 'blocked-project',
    name: 'Blocked Project',
    runtime_status: {
      status: 'failed',
      containerStatus: 'exited',
      phase: 'installing',
      error: 'missing dependency',
    },
  }),
  createProject({
    project_id: 'running-project',
    name: 'Running Project',
    runtime_status: {
      status: 'preparing',
      containerStatus: 'running',
      phase: 'installing',
      message: 'installing dependencies',
    },
  }),
  createProject({
    project_id: 'missing-snapshot',
    name: 'Missing Snapshot',
    container_status: 'running',
  }),
  createProject({
    project_id: 'persistence-failed-project',
    name: 'Persistence Failed Project',
    runtime_status: {
      status: 'ready',
      containerStatus: 'running',
      phase: 'ready',
      message: 'runtime ready',
      persistenceStatus: 'failed',
      persistenceError: 'path escapes project root',
    },
  }),
];

const mixedSummary = deriveAdminRuntimeHealthDiagnosticsSummary(mixedProjects);

assert.equal(mixedSummary.totalProjectCount, 5);
assert.equal(mixedSummary.observedRuntimeCount, 4);
assert.equal(mixedSummary.readyCount, 1);
assert.equal(mixedSummary.blockedCount, 2);
assert.equal(mixedSummary.runningCount, 1);
assert.equal(mixedSummary.unknownCount, 1);
assert.equal(mixedSummary.priorityProjects.length, 4);
assert.equal(mixedSummary.priorityProjects[0].projectId, 'blocked-project');
assert.equal(mixedSummary.priorityProjects[0].isBlocking, true);
assert.equal(mixedSummary.priorityProjects[1].projectId, 'persistence-failed-project');
assert.equal(mixedSummary.priorityProjects[1].persistenceLabel, 'failed');
assert.match(
  mixedSummary.priorityProjects[1].message,
  /运行时状态持久化失败：path escapes project root/,
  'admin runtime health should surface persistence failures from shared runtime summary',
);
assert.equal(mixedSummary.priorityProjects[2].projectId, 'running-project');
assert.equal(mixedSummary.priorityProjects[3].projectId, 'missing-snapshot');
assert.equal(mixedSummary.healthyMessage, '');

const fallbackSummary = deriveAdminRuntimeHealthDiagnosticsSummary([
  createProject({
    id: 'fallback-id',
    project_id: '',
    name: '',
    app_type: '',
  }),
]);
assert.equal(fallbackSummary.projects[0].projectId, 'fallback-id');
assert.equal(fallbackSummary.projects[0].name, '未命名项目');
assert.equal(fallbackSummary.projects[0].appType, 'unknown');

assert.equal(normalizeAdminRuntimeHealthSeverityFilter('blocked'), 'blocked');
assert.equal(normalizeAdminRuntimeHealthSeverityFilter(' invalid '), 'all');
assert.equal(normalizeAdminRuntimeHealthStatusFilter(' PREPARING '), 'preparing');
assert.equal(normalizeAdminRuntimeHealthStatusFilter('all'), 'all');
assert.equal(normalizeAdminRuntimeHealthProjectFilter(' running-project '), 'running-project');
assert.equal(normalizeAdminRuntimeHealthProjectFilter('all'), 'all');

assert.equal(updateAdminRuntimeHealthSeveritySearch('?foo=bar', 'blocked'), '?foo=bar&runtime_severity=blocked');
assert.equal(updateAdminRuntimeHealthSeveritySearch('?foo=bar&runtime_severity=blocked', 'all'), '?foo=bar');
assert.equal(updateAdminRuntimeHealthStatusSearch('?foo=bar', 'failed'), '?foo=bar&runtime_status=failed');
assert.equal(updateAdminRuntimeHealthStatusSearch('?foo=bar&runtime_status=failed', 'all'), '?foo=bar');
assert.equal(ADMIN_RUNTIME_HEALTH_PROJECT_QUERY_PARAM, RUNTIME_HEALTH_PROJECT_QUERY_PARAM);
assert.equal(updateAdminRuntimeHealthProjectSearch('?foo=bar', 'running-project'), '?foo=bar&runtime_project=running-project');
assert.equal(updateAdminRuntimeHealthProjectSearch('?foo=bar', 'running-project'), updateRuntimeHealthProjectSearch('?foo=bar', 'running-project'));
assert.equal(updateAdminRuntimeHealthProjectSearch('?foo=bar&runtime_project=running-project', 'all'), '?foo=bar');
assert.equal(
  clearAdminRuntimeHealthFilterSearch('?foo=bar&runtime_severity=blocked&runtime_status=failed&runtime_project=running-project'),
  '?foo=bar',
);

const blockedOnlySummary = deriveAdminRuntimeHealthDiagnosticsSummary(mixedProjects, {
  severityFilter: 'blocked',
  statusFilter: 'all',
});
assert.equal(blockedOnlySummary.projects.length, 2);
assert.equal(blockedOnlySummary.projects[0].projectId, 'blocked-project');
assert.equal(blockedOnlySummary.projects[1].projectId, 'persistence-failed-project');

const preparingOnlySummary = deriveAdminRuntimeHealthDiagnosticsSummary(mixedProjects, {
  severityFilter: 'all',
  statusFilter: 'preparing',
});
assert.equal(preparingOnlySummary.projects.length, 1);
assert.equal(preparingOnlySummary.projects[0].projectId, 'running-project');

const unmatchedSummary = deriveAdminRuntimeHealthDiagnosticsSummary(mixedProjects, {
  severityFilter: 'ready',
  statusFilter: 'failed',
});
assert.equal(unmatchedSummary.projects.length, 0);
assert.equal(unmatchedSummary.healthyMessage, '');

const focusedSummary = deriveAdminRuntimeHealthDiagnosticsSummary(mixedProjects, {
  severityFilter: 'all',
  statusFilter: 'all',
  projectFilter: 'running-project',
});
assert.equal(focusedSummary.focusedProject?.projectId, 'running-project');
assert.equal(focusedSummary.focusedProject?.severity, 'running');
assert.equal(focusedSummary.projects.length, 5);

const missingFocusedSummary = deriveAdminRuntimeHealthDiagnosticsSummary(mixedProjects, {
  severityFilter: 'all',
  statusFilter: 'all',
  projectFilter: 'missing-project-id',
});
assert.equal(missingFocusedSummary.focusedProject, null);

const activeFilterSummary = deriveAdminRuntimeHealthActiveFilterSummary(
  mixedSummary.projects,
  blockedOnlySummary.projects,
  {
    severityFilter: 'blocked',
    statusFilter: 'all',
    projectFilter: 'all',
  },
);
assert.equal(activeFilterSummary.activeFilterCount, 1);
assert.equal(activeFilterSummary.matchedProjectCount, 2);
assert.equal(activeFilterSummary.totalProjectCount, 5);
assert.deepEqual(activeFilterSummary.activeLabels, ['runtime_severity=blocked']);

const drilldownFilterSummary = deriveAdminRuntimeHealthActiveFilterSummary(
  mixedSummary.projects,
  focusedSummary.projects,
  {
    severityFilter: 'all',
    statusFilter: 'all',
    projectFilter: 'running-project',
  },
);
assert.equal(drilldownFilterSummary.activeFilterCount, 1);
assert.equal(drilldownFilterSummary.matchedProjectCount, 5);
assert.equal(drilldownFilterSummary.totalProjectCount, 5);
assert.deepEqual(drilldownFilterSummary.activeLabels, ['runtime_project=running-project']);

const combinedFilterSummary = deriveAdminRuntimeHealthActiveFilterSummary(
  mixedSummary.projects,
  blockedOnlySummary.projects,
  {
    severityFilter: 'blocked',
    statusFilter: 'failed',
    projectFilter: 'blocked-project',
  },
);
assert.equal(combinedFilterSummary.activeFilterCount, 3);
assert.deepEqual(combinedFilterSummary.activeLabels, [
  'runtime_severity=blocked',
  'runtime_status=failed',
  'runtime_project=blocked-project',
]);

assert.match(
  adminRuntimeHealthModel,
  /persistenceLabel: string;[\s\S]*persistenceLabel: summary\.persistenceLabel/,
  'admin runtime health project summaries should carry runtime persistence labels',
);
assert.match(
  adminApiClient,
  /ProjectContainerStatusPersistenceStatus[\s\S]*ProjectRuntimeContainerStatus[\s\S]*ProjectRuntimeError[\s\S]*ProjectRuntimeLifecycleStatus[\s\S]*ProjectRuntimeMessage[\s\S]*ProjectRuntimePhase[\s\S]*ProjectRuntimeSpecHash[\s\S]*ProjectRuntimeStatusPersistenceStatus[\s\S]*export interface AdminProjectRuntimeStatus \{[\s\S]*status: ProjectRuntimeLifecycleStatus;[\s\S]*containerStatus\?: ProjectRuntimeContainerStatus;[\s\S]*phase\?: ProjectRuntimePhase;[\s\S]*message\?: ProjectRuntimeMessage;[\s\S]*error\?: ProjectRuntimeError;[\s\S]*specHash\?: ProjectRuntimeSpecHash;[\s\S]*containerStatusPersistence\?: ProjectContainerStatusPersistenceStatus;[\s\S]*persistenceStatus\?: ProjectRuntimeStatusPersistenceStatus;[\s\S]*persistenceError\?: string;[\s\S]*export interface AdminProject \{[\s\S]*container_status\?: ProjectRuntimeContainerStatus;[\s\S]*runtime_status\?: AdminProjectRuntimeStatus;/,
  'admin API runtime status type should consume shared runtime lifecycle, project container status projection, dynamic runtime snapshot field, container persistence and runtime persistence contracts',
);
assert.doesNotMatch(
  adminApiClient,
  /export interface AdminProjectRuntimeStatus \{[\s\S]*containerStatus\?: string;[\s\S]*phase\?: string;[\s\S]*message\?: string;[\s\S]*error\?: string;[\s\S]*specHash\?: string;|export interface AdminProject \{[\s\S]*container_status\?: string;|containerStatusPersistence\?: 'updated' \| 'failed';|persistenceStatus\?: 'persisted' \| 'failed';/,
  'admin API runtime status type should not regress project container status projections or dynamic runtime snapshot fields to raw strings, or persistence status fields to inline unions',
);
assert.match(
  adminRuntimeHealthCard,
  /persistence=\{project\.persistenceLabel\}[\s\S]*persistence=\{summary\.focusedProject\.persistenceLabel\}/,
  'admin runtime health card should render runtime persistence labels in list and focused drilldown',
);

console.log('[YES] Admin runtime health diagnostics model validation passed.');
