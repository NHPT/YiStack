import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), '..');

function readProjectFile(relativePath) {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

function fail(message) {
  console.error(`[YES] Admin dashboard diagnostics layout validation failed: ${message}`);
  process.exit(1);
}

function assertIncludes(content, needle, owner) {
  if (!content.includes(needle)) {
    fail(`${owner} is missing ${needle}`);
  }
}

function assertNotIncludes(content, needle, owner) {
  if (content.includes(needle)) {
    fail(`${owner} must not include ${needle}`);
  }
}

const page = readProjectFile('src/app/admin/page.tsx');
const pageSnapshot = readProjectFile('src/app/admin/admin-dashboard-page-snapshot.tsx');
const layout = readProjectFile('src/app/admin/admin-dashboard-diagnostics-layout.tsx');
const layoutSnapshot = readProjectFile('src/app/admin/admin-dashboard-diagnostics-layout-snapshot.tsx');
const healthSummaryModel = readProjectFile('src/app/admin/admin-dashboard-health-summary-model.ts');
const providerHealthModel = readProjectFile('src/app/admin/admin-provider-health-diagnostics-model.ts');
const runtimeHealthModel = readProjectFile('src/app/admin/admin-runtime-health-diagnostics-model.ts');
const preflightModel = readProjectFile('src/app/admin/admin-capability-preflight-model.ts');
const auditModel = readProjectFile('src/app/admin/admin-audit-diagnostics-model.ts');
const i18n = readProjectFile('src/lib/admin/i18n.ts');
const validationLayer = readProjectFile('docs/engineering/VALIDATION_LAYER.md');
const healthSummaryFixture = readProjectFile('scripts/validate-admin-dashboard-health-summary-fixtures.ts');

[
  'buildAdminDashboardPageSnapshot',
  'AdminDashboardPageSnapshotStrip',
  'adminDashboardPageSnapshot',
  'cardCount: cards.length',
  'quickLinkCount: quickLinks.length',
  'healthSummary: dashboardHealthSummary',
  '<AdminDashboardPageSnapshotStrip snapshot={adminDashboardPageSnapshot} />',
  'AdminDashboardDiagnosticsLayout',
  'deriveAdminDashboardHealthSummary',
  'healthSummary={dashboardHealthSummary}',
  'priorityDiagnostics={<AdminProviderHealthDiagnosticsCard',
  'runtimeDiagnostics={<AdminRuntimeHealthDiagnosticsCard',
  'configDiagnostics={<AdminCapabilityPreflightCard',
  'auditDiagnostics={<AdminAuditDiagnosticsCard',
  'function shouldRenderAdminDashboardDiagnosticsLayout(isSuperAdmin: boolean): boolean',
  'function shouldRenderAdminDashboardAuditFallback(isSuperAdmin: boolean): boolean',
  'function getAdminDashboardQuickAccessSectionClassName(isSuperAdmin: boolean): string',
  'const shouldRenderDiagnosticsLayout = shouldRenderAdminDashboardDiagnosticsLayout(isSuperAdmin);',
  'const shouldRenderAuditFallback = shouldRenderAdminDashboardAuditFallback(isSuperAdmin);',
  'const quickAccessSectionClassName = getAdminDashboardQuickAccessSectionClassName(isSuperAdmin);',
  '{shouldRenderDiagnosticsLayout === true && (',
  'className={quickAccessSectionClassName}',
  '{shouldRenderAuditFallback === true && (',
].forEach((needle) => assertIncludes(page, needle, 'src/app/admin/page.tsx'));

[
  '{isSuperAdmin === true ? (',
  '{isSuperAdmin === false ? (',
  "className={isSuperAdmin === true ? 'grid gap-6' : 'grid gap-6 xl:grid-cols-[1.2fr_0.8fr]'}",
].forEach((needle) => assertNotIncludes(page, needle, 'src/app/admin/page.tsx'));

[
  'buildAdminDashboardPageSnapshot',
  'AdminDashboardPageSnapshotStatus',
  'AdminDashboardPageSnapshotSource',
  'status: AdminDashboardPageSnapshotStatus',
  'source: AdminDashboardPageSnapshotSource',
  "'profile_missing'",
  "'loading'",
  "'empty'",
  "'limited_ready'",
  "'diagnostics_partial'",
  "'diagnostics_ready'",
  'data-testid="admin-dashboard-page-snapshot"',
  'Phase: {snapshot.status}',
  'Cards: {snapshot.cardCount}',
  'QuickLinks: {snapshot.quickLinkCount}',
  'function getAdminDashboardPageSnapshotBooleanLabel(value: boolean): string',
  'const hasProviderSnapshotLabel = getAdminDashboardPageSnapshotBooleanLabel(snapshot.hasProviderSnapshot);',
  'const hasProviderPreflightLabel = getAdminDashboardPageSnapshotBooleanLabel(snapshot.hasProviderPreflight);',
  'Provider: {hasProviderSnapshotLabel}',
  'Preflight: {hasProviderPreflightLabel}',
  'Tone: {snapshot.healthTone}',
  'const canOpenDiagnosticsLabel = getAdminDashboardPageSnapshotBooleanLabel(snapshot.canOpenDiagnostics);',
  'Diagnostics: {canOpenDiagnosticsLabel}',
].forEach((needle) => assertIncludes(pageSnapshot, needle, 'src/app/admin/admin-dashboard-page-snapshot.tsx'));

[
  "Provider: {snapshot.hasProviderSnapshot ? 'yes' : 'no'}",
  "Preflight: {snapshot.hasProviderPreflight ? 'yes' : 'no'}",
  "Diagnostics: {snapshot.canOpenDiagnostics ? 'yes' : 'no'}",
  "const hasProviderSnapshotLabel = snapshot.hasProviderSnapshot === true ? 'yes' : 'no';",
  "const hasProviderPreflightLabel = snapshot.hasProviderPreflight === true ? 'yes' : 'no';",
  "const canOpenDiagnosticsLabel = snapshot.canOpenDiagnostics === true ? 'yes' : 'no';",
].forEach((needle) => assertNotIncludes(pageSnapshot, needle, 'src/app/admin/admin-dashboard-page-snapshot.tsx'));

[
  'dashboardDiagnosticsPriority',
  'dashboardDiagnosticsRuntime',
  'dashboardDiagnosticsConfig',
  'dashboardDiagnosticsAudit',
  'dashboardDiagnosticsReadOnly',
  'dashboardHealthSummary',
  'dashboardHealthBlockers',
  'dashboardHealthWarnings',
  'dashboardHealthPending',
  'dashboardHealthAuditSignals',
  'dashboardHealthFocusAreas',
  'dashboardHealthFocusSignalCount',
  'dashboardHealthPriorityIssuesTitle',
  'dashboardHealthPriorityIssuesDescription',
  'dashboardHealthRunbookTitle',
  'dashboardHealthRunbookDescription',
  'AdminDashboardDiagnosticsAnchorId',
  'getAdminDashboardDiagnosticsAnchorId',
  'getAdminDashboardDiagnosticsHashHref',
  'AdminDashboardHealthFocusSection',
  'AdminDashboardHealthPriorityIssue',
  'AdminDashboardHealthRunbookItem',
  'function shouldRenderAdminDashboardHealthFocusSections(healthSummary: AdminDashboardHealthSummary): boolean',
  'function shouldRenderAdminDashboardHealthPriorityIssues(healthSummary: AdminDashboardHealthSummary): boolean',
  'function shouldRenderAdminDashboardHealthRunbookItems(healthSummary: AdminDashboardHealthSummary): boolean',
  'function materializeAdminDashboardHealthFocusSectionNodes(',
  'for (const section of sections)',
  'function materializeAdminDashboardHealthPriorityIssueNodes(',
  'for (const issue of issues)',
  'function materializeAdminDashboardHealthRunbookItemNodes(',
  'for (const item of items)',
  'const shouldRenderHealthFocusSections = shouldRenderAdminDashboardHealthFocusSections(healthSummary);',
  'const shouldRenderHealthPriorityIssues = shouldRenderAdminDashboardHealthPriorityIssues(healthSummary);',
  'const shouldRenderHealthRunbookItems = shouldRenderAdminDashboardHealthRunbookItems(healthSummary);',
  '{shouldRenderHealthFocusSections === true && (',
  '{shouldRenderHealthPriorityIssues === true && (',
  '{shouldRenderHealthRunbookItems === true && (',
  'materializeAdminDashboardHealthFocusSectionNodes(',
  'materializeAdminDashboardHealthPriorityIssueNodes(',
  'materializeAdminDashboardHealthRunbookItemNodes(',
  'id: AdminDashboardDiagnosticsAnchorId',
  'href={getAdminDashboardDiagnosticsHashHref(section.id)}',
  "id={getAdminDashboardDiagnosticsAnchorId('priority')}",
  "id={getAdminDashboardDiagnosticsAnchorId('runtime')}",
  "id={getAdminDashboardDiagnosticsAnchorId('config')}",
  "id={getAdminDashboardDiagnosticsAnchorId('audit')}",
  'href={issue.href}',
  'href={item.href}',
  'AdminDashboardDiagnosticsLayoutSnapshot',
  'snapshot: AdminDashboardDiagnosticsLayoutSnapshot',
].forEach((needle) => assertIncludes(layout, needle, 'admin-dashboard-diagnostics-layout.tsx'));

assertNotIncludes(
  layout,
  'ReturnType<typeof buildAdminDashboardDiagnosticsLayoutSnapshot>',
  'admin-dashboard-diagnostics-layout.tsx',
);
assertNotIncludes(
  layout,
  'id: string;',
  'admin-dashboard-diagnostics-layout.tsx',
);
[
  'healthSummary.focusSections.length > 0 ?',
  'healthSummary.priorityIssues.length > 0 ?',
  'healthSummary.runbookItems.length > 0 ?',
  '{shouldRenderHealthFocusSections === true ? (',
  '{shouldRenderHealthPriorityIssues === true ? (',
  '{shouldRenderHealthRunbookItems === true ? (',
  'healthSummary.focusSections.map',
  'healthSummary.priorityIssues.map',
  'healthSummary.runbookItems.map',
].forEach((needle) => assertNotIncludes(layout, needle, 'admin-dashboard-diagnostics-layout.tsx'));

[
  'AdminDashboardDiagnosticsLayoutSnapshotSource',
  'AdminDashboardDiagnosticsLayoutSnapshotStatus',
  'function countRenderedAdminDashboardDiagnosticsLayoutSections',
  'for (const hasSection of sections)',
  'const renderedSectionCount = countRenderedAdminDashboardDiagnosticsLayoutSections',
  'const status: AdminDashboardDiagnosticsLayoutSnapshotStatus',
  'const source: AdminDashboardDiagnosticsLayoutSnapshotSource',
].forEach((needle) => assertIncludes(layoutSnapshot, needle, 'admin-dashboard-diagnostics-layout-snapshot.tsx'));

assertNotIncludes(
  layoutSnapshot,
  '].filter((hasSection) => hasSection === true).length',
  'admin-dashboard-diagnostics-layout-snapshot.tsx',
);

[
  'dashboardDiagnosticsTitle',
  'dashboardDiagnosticsDescription',
  'dashboardDiagnosticsPriorityDescription',
  'dashboardDiagnosticsRuntimeDescription',
  'dashboardDiagnosticsConfigDescription',
  'dashboardDiagnosticsAuditDescription',
  'dashboardHealthSummary',
  'dashboardHealthBlockers',
  'dashboardHealthWarnings',
  'dashboardHealthPending',
  'dashboardHealthAuditSignals',
  'dashboardHealthFocusAreas',
  'dashboardHealthFocusSignalCount',
  'dashboardHealthPriorityIssuesTitle',
  'dashboardHealthPriorityIssuesDescription',
  'dashboardHealthRunbookTitle',
  'dashboardHealthRunbookDescription',
].forEach((needle) => {
  const count = i18n.split(needle).length - 1;
  if (count < 4) {
    fail(`src/lib/admin/i18n.ts has insufficient ${needle} definitions`);
  }
});

[
  'deriveAdminProviderHealthDiagnosticsSummary',
  'deriveAdminRuntimeHealthDiagnosticsSummary',
  'deriveCapabilityPreflightPrioritySummary',
  'deriveAdminAuditDiagnosticsSummary',
  "tone: 'critical'",
  "tone: 'warning'",
  "tone: 'neutral'",
  "tone: 'success'",
  'AdminDashboardDiagnosticsAnchorId',
  'AdminDashboardDiagnosticsHashHref',
  'AdminDashboardDiagnosticsHref',
  'AdminDashboardDiagnosticsQueryParams',
  'AdminDashboardHealthRunbookItemId',
  'AdminDashboardHealthPriorityIssueId',
  'admin-dashboard-diagnostics-priority',
  'admin-dashboard-diagnostics-runtime',
  'admin-dashboard-diagnostics-config',
  'admin-dashboard-diagnostics-audit',
  'focusSections',
  'buildFocusSections',
  "toFocusSection('priority'",
  "toFocusSection('runtime'",
  "toFocusSection('config'",
  "toFocusSection('audit'",
  'runbookItems',
  'buildRunbookItems',
  "id: 'provider-blockers'",
  "id: 'preflight-critical'",
  "id: 'runtime-blockers'",
  "id: 'provider-drift'",
  "id: 'runtime-followup'",
  "id: 'preflight-warning'",
  "id: 'audit-context'",
  'priorityIssues',
  'buildPriorityIssues',
  'buildProviderPriorityIssueId',
  'buildRuntimePriorityIssueId',
  'buildPreflightPriorityIssueId',
  'priorityProviders',
  'priorityProjects',
  'sortCapabilityPreflightItems',
  'audit-latest-action',
  'for (const section of candidateSections)',
  'for (const key in params)',
  'Object.prototype.hasOwnProperty.call(params, key)',
  'addAdminDashboardHealthRunbookItem',
  'for (const provider of providerHealth.priorityProviders)',
  'for (const item of sortCapabilityPreflightItems(preflightItems))',
  'for (const project of runtimeHealth.priorityProjects)',
  'addAdminDashboardPriorityIssue',
  'preflightIssueCount < 5',
  'priorityIssues.length < 8',
  'ADMIN_AUDIT_ACTION_QUERY_PARAM',
  'ADMIN_AUDIT_TARGET_TYPE_QUERY_PARAM',
  'id: AdminDashboardHealthRunbookItemId',
  'id: AdminDashboardHealthPriorityIssueId',
  'href: AdminDashboardDiagnosticsHref',
  'params: AdminDashboardDiagnosticsQueryParams',
  'getAdminDashboardDiagnosticsAnchorId',
  'getAdminDashboardDiagnosticsHashHref',
  'buildDashboardDiagnosticsHref',
  'getAdminDashboardHealthProviderFocusTone',
  'getAdminDashboardHealthRuntimeFocusTone',
  'getAdminDashboardHealthConfigFocusTone',
  'getAdminDashboardRuntimeFollowupSeverityFilter',
  'getAdminDashboardRuntimeFollowupStatusFilter',
  'getAdminDashboardAuditRunbookActionQueryValue',
  'getAdminDashboardPreflightIssueProviderLabel',
  'getAdminDashboardProviderPriorityIssueTone',
  'getAdminDashboardRuntimePriorityIssueTone',
  'getAdminDashboardPreflightPriorityIssueTone',
  'getAdminDashboardPreflightPriorityIssueDescription',
  'getAdminDashboardPreflightPriorityIssueEvidence',
  'getAdminDashboardAuditPriorityIssueEvidence',
  'getAdminDashboardAuditTargetTypeQueryValue',
  'shouldBuildAdminDashboardAuditPriorityIssue',
  'ADMIN_PROVIDER_HEALTH_SEVERITY_QUERY_PARAM',
  'ADMIN_RUNTIME_HEALTH_PROJECT_QUERY_PARAM',
  'ADMIN_RUNTIME_HEALTH_SEVERITY_QUERY_PARAM',
  'ADMIN_RUNTIME_HEALTH_STATUS_QUERY_PARAM',
  'CAPABILITY_PREFLIGHT_SEVERITY_QUERY_PARAM',
  'CAPABILITY_PREFLIGHT_REASON_CODE_QUERY_PARAM',
  'AdminProviderHealthDiagnosticsSummary',
  'AdminRuntimeHealthDiagnosticsSummary',
  'AdminAuditDiagnosticsSummaryModel',
].forEach((needle) => assertIncludes(healthSummaryModel, needle, 'admin-dashboard-health-summary-model.ts'));

[
  'ReturnType<typeof deriveAdminProviderHealthDiagnosticsSummary>',
  'ReturnType<typeof deriveAdminRuntimeHealthDiagnosticsSummary>',
  'ReturnType<typeof deriveAdminAuditDiagnosticsSummary>',
  'href: string',
  'id: string',
  'params: Record<string, string | undefined>',
  "runtimePreparingCount > 0 ? 'running' : 'unknown'",
  "runtimePreparingCount > 0 ? 'preparing' : 'unknown'",
  "provider.severity === 'blocked' ? 'critical' as const : 'warning' as const",
  "project.isBlocking ? 'critical' as const : 'warning' as const",
  "item.severity === 'critical' ? 'critical' as const : 'warning' as const",
  "auditSummary.latestAction\n    ? [{",
  "auditLatestAction ?? undefined",
  "item.provider || 'unknown provider'",
  "item.reason_code || item.source_note || 'Preflight 发现需要关注的配置态信号。'",
  "item.next_action || item.source_note || '查看配置态诊断获取 provider、config key 和 reason_code 详情。'",
  "auditSummary.latestAt || '未知时间'",
  "auditSummary.latestTargetType ?? undefined",
  "providerHealth.blockedCount > 0 ? 'critical' : 'warning'",
  "runtimeHealth.blockedCount > 0 ? 'critical' : 'warning'",
  "preflightPriority.criticalCount > 0 ? 'critical' : 'warning'",
  'Object.entries(params).forEach',
  '].filter((section): section is AdminDashboardHealthFocusSection => section !== null)',
  '].filter((item): item is AdminDashboardHealthRunbookItem => item !== null)',
  'providerHealth.priorityProviders.map',
  'runtimeHealth.priorityProjects.map',
  '.filter((item) => item.severity ===',
  '.map((item) => ({',
  '].slice(0, 8)',
].forEach((needle) => assertNotIncludes(healthSummaryModel, needle, 'admin-dashboard-health-summary-model.ts'));

[
  'deriveAdminProviderHealthDiagnosticsSummary',
].forEach((needle) => assertIncludes(providerHealthModel + healthSummaryModel, needle, 'admin provider health dashboard source coverage'));

[
  'deriveAdminRuntimeHealthDiagnosticsSummary',
].forEach((needle) => assertIncludes(runtimeHealthModel + healthSummaryModel, needle, 'admin runtime health dashboard source coverage'));

[
  'deriveCapabilityPreflightPrioritySummary',
].forEach((needle) => assertIncludes(preflightModel + healthSummaryModel, needle, 'admin preflight dashboard source coverage'));

[
  'deriveAdminAuditDiagnosticsSummary',
].forEach((needle) => assertIncludes(auditModel + healthSummaryModel, needle, 'admin audit dashboard source coverage'));

[
  'fetch(',
  'adminLLMApi.',
  'runtimeApi.',
  'reload',
  'testConnection',
].forEach((needle) => {
  if (healthSummaryModel.includes(needle)) {
    fail(`admin-dashboard-health-summary-model.ts must stay read-only and pure; found ${needle}`);
  }
});

[
  'Admin Dashboard diagnostics layout',
  'Admin Dashboard health summary',
  '优先处理 / 运行态 / 配置态 / 审计',
  'Provider Health / Runtime Health / Provider Preflight / Audit',
  '健康摘要到诊断分组定位',
  'Runbook',
  '跨分组优先问题',
  'URL filter',
  '样例语义校验',
].forEach((needle) => assertIncludes(validationLayer, needle, 'docs/engineering/VALIDATION_LAYER.md'));

[
  'deriveAdminDashboardHealthSummary',
  'provider_health=blocked#admin-dashboard-diagnostics-priority',
  'runtime_severity=blocked&runtime_status=failed&runtime_project=proj-runtime-1#admin-dashboard-diagnostics-runtime',
  'runtime_severity=running&runtime_status=preparing#admin-dashboard-diagnostics-runtime',
  'severity=critical&reason_code=missing_api_key#admin-dashboard-diagnostics-config',
  'audit_action=llm_provider.update&audit_target_type=llm_provider#admin-dashboard-diagnostics-audit',
  'audit_action=llm_provider.update#admin-dashboard-diagnostics-audit',
  'preflight critical runbook href',
  'runtime blockers runbook href',
].forEach((needle) => assertIncludes(healthSummaryFixture, needle, 'validate-admin-dashboard-health-summary-fixtures.ts'));

execFileSync('pnpm', ['exec', 'tsx', 'scripts/validate-admin-dashboard-health-summary-fixtures.ts'], {
  cwd: ROOT_DIR,
  stdio: 'inherit',
});

console.log('[YES] Admin dashboard diagnostics layout validation passed.');
