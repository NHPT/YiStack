import { strict as assert } from 'node:assert';
import fs from 'node:fs';

import {
  clearAdminAuditFilterSearch,
  deriveAdminAuditActiveFilterSummary,
  deriveAdminAuditDiagnosticsSummary,
  filterAdminAuditLogs,
  normalizeAdminAuditFilterValue,
  updateAdminAuditActionSearch,
  updateAdminAuditTargetTypeSearch,
} from '../src/app/admin/admin-audit-diagnostics-model';
import type { AuditLog } from '../src/lib/admin/api';

const auditCard = fs.readFileSync('src/app/admin/admin-audit-diagnostics-card.tsx', 'utf8');
const auditModel = fs.readFileSync('src/app/admin/admin-audit-diagnostics-model.ts', 'utf8');
const adminDiagnosticLinkCopyHook = fs.readFileSync('src/app/admin/use-admin-diagnostic-link-copy.ts', 'utf8');
const adminPage = fs.readFileSync('src/app/admin/page.tsx', 'utf8');
assert.match(
  auditModel,
  /export type AdminAuditActiveFilterLabel = string;[\s\S]*export type AdminAuditActiveFilterLabelList = AdminAuditActiveFilterLabel\[\];[\s\S]*activeLabels: AdminAuditActiveFilterLabelList;[\s\S]*const activeLabels: AdminAuditActiveFilterLabelList = \[\];[\s\S]*const hasActionFilter = filters\.actionFilter !== 'all';[\s\S]*const hasTargetTypeFilter = filters\.targetTypeFilter !== 'all';[\s\S]*if \(hasActionFilter === true\)[\s\S]*activeLabels\.push\(`\$\{ADMIN_AUDIT_ACTION_QUERY_PARAM\}=\$\{filters\.actionFilter\}`\);[\s\S]*if \(hasTargetTypeFilter === true\)[\s\S]*activeLabels\.push\(`\$\{ADMIN_AUDIT_TARGET_TYPE_QUERY_PARAM\}=\$\{filters\.targetTypeFilter\}`\);/,
  'admin audit diagnostics should name active filter label contracts and derive URL labels through explicit active filter facts',
);
assert.doesNotMatch(
  auditModel,
  /activeLabels: string\[\];|const activeLabels: string\[\]|const activeLabels: AdminAuditActiveFilterLabelList = \[[\s\S]*\]\.filter\(Boolean\)/,
  'admin audit diagnostics should not keep active filter labels as an anonymous string array contract or filter(Boolean) list',
);
assert.match(
  auditModel,
  /const normalizedValue = readString\(value\);[\s\S]*const hasNormalizedValue = normalizedValue\.length > 0;[\s\S]*const isAllFilter = normalizedValue === 'all';[\s\S]*return hasNormalizedValue === true && isAllFilter === false \? normalizedValue : 'all';[\s\S]*if \(hasNormalizedValue === false \|\| isAllFilter === true\)[\s\S]*const hasAction = action\.length > 0;[\s\S]*if \(hasAction === true\)[\s\S]*const hasTargetType = targetType\.length > 0;[\s\S]*if \(hasTargetType === true\)/,
  'admin audit diagnostics should derive filter normalization, search params and distribution dimensions through explicit presence facts',
);
assert.doesNotMatch(
  auditModel,
  /return normalizedValue && normalizedValue !== 'all' \? normalizedValue : 'all'|if \(!normalizedValue \|\| normalizedValue === 'all'\)|if \(action\)|if \(targetType\)|\.filter\(Boolean\)/,
  'admin audit diagnostics should not regress filter normalization, search params, active labels or distribution counting to truthy predicates',
);
assert.match(
  auditModel,
  /export type AdminAuditActionName = string;[\s\S]*export type AdminAuditTargetTypeName = string;[\s\S]*export type AdminAuditActionCount = \{[\s\S]*action: AdminAuditActionName;[\s\S]*count: number;[\s\S]*\};[\s\S]*export type AdminAuditActionCountList = AdminAuditActionCount\[\];[\s\S]*export type AdminAuditActionCountMap = Map<AdminAuditActionName, number>;[\s\S]*export type AdminAuditTargetTypeCount = \{[\s\S]*targetType: AdminAuditTargetTypeName;[\s\S]*count: number;[\s\S]*\};[\s\S]*export type AdminAuditTargetTypeCountList = AdminAuditTargetTypeCount\[\];[\s\S]*export type AdminAuditTargetTypeCountMap = Map<AdminAuditTargetTypeName, number>;[\s\S]*topActions: AdminAuditActionCountList;[\s\S]*targetTypes: AdminAuditTargetTypeCountList;[\s\S]*function shouldIncludeAdminAuditLog\(log: AuditLog, filters: AdminAuditFilterState\): boolean[\s\S]*return actionMatched === true && targetTypeMatched === true;[\s\S]*const actionCounts: AdminAuditActionCountMap = new Map<AdminAuditActionName, number>\(\);[\s\S]*const targetTypeCounts: AdminAuditTargetTypeCountMap = new Map<AdminAuditTargetTypeName, number>\(\);[\s\S]*const action: AdminAuditActionName = log\.action\.trim\(\);[\s\S]*const targetType: AdminAuditTargetTypeName = log\.target_type\.trim\(\);[\s\S]*function readAdminAuditActionCountList\([\s\S]*actionCounts: AdminAuditActionCountMap,[\s\S]*\): AdminAuditActionCountList[\s\S]*for \(const \[action, count\] of actionCounts\)[\s\S]*function readAdminAuditTargetTypeCountList\([\s\S]*targetTypeCounts: AdminAuditTargetTypeCountMap,[\s\S]*\): AdminAuditTargetTypeCountList[\s\S]*for \(const \[targetType, count\] of targetTypeCounts\)/,
  'admin audit diagnostics should name action and target type distribution list and map contracts',
);
assert.match(
  auditModel,
  /function getAdminAuditLatestSortedLog\(sortedLogs: AuditLog\[\]\): AuditLog \| undefined \{[\s\S]*for \(const log of sortedLogs\)[\s\S]*return log;[\s\S]*return undefined;[\s\S]*const latestLog = getAdminAuditLatestSortedLog\(sortedLogs\);/,
  'admin audit diagnostics should derive latest sorted log through a named first-log reader',
);
assert.doesNotMatch(
  auditModel,
  /topActions: Array<\{[\s\S]*action: string;[\s\S]*count: number;[\s\S]*\}>;|targetTypes: Array<\{[\s\S]*targetType: string;[\s\S]*count: number;[\s\S]*\}>;|new Map<string, number>\(\);|const action = log\.action\.trim\(\);|const targetType = log\.target_type\.trim\(\);|logs\.filter\(|sortedLogs\[0\]|actionCounts\.entries\(\)\]\.map|targetTypeCounts\.entries\(\)\]\.map/,
  'admin audit diagnostics should not regress action or target type distributions to inline array objects, raw maps, untyped local dimensions or inline array pipelines',
);
assert.match(
  auditCard,
  /deriveAdminAuditActiveFilterSummary/,
  'admin audit diagnostics card should render active filter summary from URL state',
);
assert.match(
  auditCard,
  /import type \{ ReactNode \} from 'react';[\s\S]*type AdminAuditActiveFilterSummary,[\s\S]*type AdminAuditActionCountList,[\s\S]*type AdminAuditDiagnosticsSummaryModel,[\s\S]*type AdminAuditTargetTypeCountList,[\s\S]*function getAdminAuditDiagnosticsCardLabel\(value: string \| null\): string[\s\S]*const hasValue = value !== null && value\.length > 0;[\s\S]*return hasValue === true \? value : '-';[\s\S]*function shouldRenderAdminAuditLatestContext\(summary: AdminAuditDiagnosticsSummaryModel\): boolean[\s\S]*const hasLatestAction = summary\.latestAction !== null && summary\.latestAction\.length > 0;[\s\S]*const hasLatestAt = summary\.latestAt !== null && summary\.latestAt\.length > 0;[\s\S]*return hasLatestAction === true && hasLatestAt === true;[\s\S]*function shouldRenderAdminAuditFilteredEmpty\([\s\S]*filteredLogs: AuditLog\[\],[\s\S]*activeFilterSummary: AdminAuditActiveFilterSummary,[\s\S]*const hasFilteredLogs = filteredLogs\.length > 0;[\s\S]*const hasActiveFilters = activeFilterSummary\.activeFilterCount > 0;[\s\S]*return hasFilteredLogs === false && hasActiveFilters === true;[\s\S]*function getAdminAuditActiveFilterLabelSuffix\(summary: AdminAuditActiveFilterSummary\): string \{[\s\S]*const hasActiveLabels = summary\.activeLabels\.length > 0;[\s\S]*return hasActiveLabels === true \? ` \/ \$\{summary\.activeLabels\.join\(' \/ '\)\}` : '';[\s\S]*function shouldRenderAdminAuditTopActions\(summary: AdminAuditDiagnosticsSummaryModel\): boolean \{[\s\S]*const topActionCount = summary\.topActions\.length;[\s\S]*return topActionCount > 0;[\s\S]*function shouldRenderAdminAuditTargetTypes\(summary: AdminAuditDiagnosticsSummaryModel\): boolean \{[\s\S]*const targetTypeCount = summary\.targetTypes\.length;[\s\S]*return targetTypeCount > 0;[\s\S]*function shouldRenderAdminAuditDiagnosticsContent\(summary: AdminAuditDiagnosticsSummaryModel\): boolean \{[\s\S]*const totalLogCount = summary\.totalLogCount;[\s\S]*return totalLogCount > 0;[\s\S]*function materializeAdminAuditActionOptionNodes\(items: AdminAuditActionCountList\): ReactNode\[\] \{[\s\S]*for \(const item of items\)[\s\S]*function materializeAdminAuditTargetTypeOptionNodes\(items: AdminAuditTargetTypeCountList\): ReactNode\[\] \{[\s\S]*for \(const item of items\)[\s\S]*function getAdminAuditTopActionSummaryLabel\(items: AdminAuditActionCountList\): string \{[\s\S]*for \(const item of items\)[\s\S]*segments\.push\(`\$\{item\.action\} \(\$\{item\.count\}\)`\);[\s\S]*function getAdminAuditTargetTypeSummaryLabel\(items: AdminAuditTargetTypeCountList\): string \{[\s\S]*for \(const item of items\)[\s\S]*segments\.push\(`\$\{item\.targetType\} \(\$\{item\.count\}\)`\);[\s\S]*function materializeAdminAuditDiagnosticLogNodes\(logs: AuditLog\[\]\): ReactNode\[\] \{[\s\S]*for \(const log of logs\)[\s\S]*getAdminAuditDiagnosticsCardLabel\(log\.target_id\)[\s\S]*getAdminAuditDiagnosticsCardLabel\(log\.ip_address\)/,
  'admin audit diagnostics card should derive diagnostics content, latest context, row labels, filtered-empty rendering, active label suffix, distribution sections and nodes through named explicit facts/materializers',
);
assert.match(
  auditCard,
  /AdminDiagnosticSection, type AdminDiagnosticTone[\s\S]*function getAdminAuditActionBadgeTone\(summary: AdminAuditDiagnosticsSummaryModel\): AdminDiagnosticTone \{[\s\S]*const hasActions = summary\.actionCount > 0;[\s\S]*if \(hasActions === true\)[\s\S]*return 'info';[\s\S]*return 'neutral';[\s\S]*function getAdminAuditEmptyMessage\(summary: AdminAuditDiagnosticsSummaryModel, copy: AdminCopy\): string \| undefined \{[\s\S]*const hasLogs = summary\.totalLogCount > 0;[\s\S]*if \(hasLogs === true\)[\s\S]*return undefined;[\s\S]*return copy\.emptyAudit;[\s\S]*function getAdminAuditDiagnosticLinkCopyActionLabel\(isCopied: boolean, copy: AdminCopy\): string \{[\s\S]*if \(isCopied === true\)[\s\S]*return copy\.auditDiagnosticsDiagnosticLinkCopied;[\s\S]*return copy\.auditDiagnosticsCopyDiagnosticLink;[\s\S]*const actionBadgeTone = getAdminAuditActionBadgeTone\(summary\);[\s\S]*const emptyMessage = getAdminAuditEmptyMessage\(unfilteredSummary, copy\);[\s\S]*const diagnosticLinkCopyActionLabel = getAdminAuditDiagnosticLinkCopyActionLabel\(diagnosticLinkCopied, copy\);[\s\S]*tone: actionBadgeTone[\s\S]*emptyMessage=\{emptyMessage\}[\s\S]*\{diagnosticLinkCopyActionLabel\}/,
  'admin audit diagnostics card should derive badge tone, empty message and copy action label through named display facts',
);
assert.match(
  auditCard,
  /const shouldRenderLatestContext = shouldRenderAdminAuditLatestContext\(summary\);[\s\S]*const shouldRenderFilteredEmpty = shouldRenderAdminAuditFilteredEmpty\(filteredLogs, activeFilterSummary\);[\s\S]*const activeFilterLabelSuffix = getAdminAuditActiveFilterLabelSuffix\(activeFilterSummary\);[\s\S]*const shouldRenderTopActions = shouldRenderAdminAuditTopActions\(summary\);[\s\S]*const shouldRenderTargetTypes = shouldRenderAdminAuditTargetTypes\(summary\);[\s\S]*const shouldRenderDiagnosticsContent = shouldRenderAdminAuditDiagnosticsContent\(unfilteredSummary\);[\s\S]*const topActionSummaryLabel = getAdminAuditTopActionSummaryLabel\(summary\.topActions\);[\s\S]*const targetTypeSummaryLabel = getAdminAuditTargetTypeSummaryLabel\(summary\.targetTypes\);[\s\S]*\{shouldRenderDiagnosticsContent === true && \([\s\S]*materializeAdminAuditActionOptionNodes\(unfilteredSummary\.topActions\)[\s\S]*materializeAdminAuditTargetTypeOptionNodes\(unfilteredSummary\.targetTypes\)[\s\S]*\{activeFilterLabelSuffix\}[\s\S]*\{shouldRenderLatestContext === true && \([\s\S]*\{shouldRenderTopActions === true && \([\s\S]*\{topActionSummaryLabel\}[\s\S]*\{shouldRenderTargetTypes === true && \([\s\S]*\{targetTypeSummaryLabel\}[\s\S]*materializeAdminAuditDiagnosticLogNodes\(filteredLogs\)[\s\S]*\{shouldRenderFilteredEmpty === true && \(/,
  'admin audit diagnostics card should consume diagnostics content, latest context, target/ip labels, active label suffix, distribution sections, row nodes and filtered-empty gates through explicit render facts/materializers',
);
assert.doesNotMatch(
  auditCard,
  /summary\.latestAction && summary\.latestAt|log\.target_id \|\| '-'|log\.ip_address \|\| '-'|filteredLogs\.length === 0 && activeFilterSummary\.activeFilterCount > 0 \?|activeFilterSummary\.activeLabels\.length > 0 \?|summary\.(topActions|targetTypes)\.length > 0 \?|unfilteredSummary\.totalLogCount > 0 \?|summary\.actionCount > 0 \? 'info' : 'neutral'|unfilteredSummary\.totalLogCount === 0 \? copy\.emptyAudit : undefined|diagnosticLinkCopied \? copy\.auditDiagnosticsDiagnosticLinkCopied : copy\.auditDiagnosticsCopyDiagnosticLink|shouldRenderTopActions === true \? \(|shouldRenderTargetTypes === true \? \(|unfilteredSummary\.(topActions|targetTypes)\.map\(|summary\.(topActions|targetTypes)\.map\(|filteredLogs\.map\(/,
  'admin audit diagnostics card should not regress diagnostics content, latest context, row labels, active label suffix, display labels, distribution sections, row nodes or filtered-empty rendering to truthy gates, OR fallback, inline ternary gates or JSX array maps',
);
assert.match(
  adminPage,
  /AdminAuditDiagnosticsCard/,
  'admin page should keep Admin Audit diagnostics card mounted',
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
  auditCard,
  /import \{ useAdminDiagnosticLinkCopy \} from '\.\/use-admin-diagnostic-link-copy';[\s\S]*const \{ diagnosticLinkCopied, diagnosticLinkCopyError, copyCurrentDiagnosticLink \} = useAdminDiagnosticLinkCopy\(\);/,
  'admin audit diagnostics should use the shared diagnostic link copy hook',
);
assert.match(
  auditCard,
  /function shouldRenderAdminAuditDiagnosticLinkCopyError\(error: string \| null\): boolean \{[\s\S]*const hasError = error !== null && error\.length > 0;[\s\S]*return hasError === true;[\s\S]*function shouldRenderAdminAuditDiagnosticUrlSyncError\(error: string \| null\): boolean \{[\s\S]*const hasError = error !== null && error\.length > 0;[\s\S]*return hasError === true;[\s\S]*const shouldRenderDiagnosticLinkCopyError = shouldRenderAdminAuditDiagnosticLinkCopyError\(diagnosticLinkCopyError\);[\s\S]*const shouldRenderDiagnosticUrlSyncError = shouldRenderAdminAuditDiagnosticUrlSyncError\(diagnosticUrlSyncError\);[\s\S]*\{shouldRenderDiagnosticLinkCopyError === true && \([\s\S]*\{diagnosticLinkCopyError\}[\s\S]*\{shouldRenderDiagnosticUrlSyncError === true && \([\s\S]*\{diagnosticUrlSyncError\}/,
  'admin audit diagnostics should render user-visible diagnostic link copy and URL sync failures through named explicit gates',
);
assert.doesNotMatch(
  auditCard,
  /diagnosticLinkCopyError \?|diagnosticUrlSyncError \?/,
  'admin audit diagnostics should not regress diagnostic copy or URL sync errors to inline nullable ternaries',
);

function createAuditLog(
  id: number,
  action: string,
  targetType: string,
  createdAt: string,
): AuditLog {
  return {
    id,
    admin_id: `admin-${id}`,
    action,
    target_type: targetType,
    target_id: `target-${id}`,
    detail: `${action} detail`,
    ip_address: '127.0.0.1',
    created_at: createdAt,
  };
}

const logs = [
  createAuditLog(1, 'update_user', 'user', '2026-07-14T10:00:00Z'),
  createAuditLog(2, 'delete_user', 'user', '2026-07-14T11:00:00Z'),
  createAuditLog(3, 'update_user', 'config', '2026-07-14T09:00:00Z'),
  createAuditLog(4, 'reload_provider', 'provider', '2026-07-14T12:00:00Z'),
];

assert.deepEqual(
  deriveAdminAuditDiagnosticsSummary(logs),
  {
    totalLogCount: 4,
    actionCount: 3,
    targetTypeCount: 3,
    latestAction: 'reload_provider',
    latestTargetType: 'provider',
    latestAt: '2026-07-14T12:00:00Z',
    topActions: [
      { action: 'update_user', count: 2 },
      { action: 'delete_user', count: 1 },
      { action: 'reload_provider', count: 1 },
    ],
    targetTypes: [
      { targetType: 'user', count: 2 },
      { targetType: 'config', count: 1 },
      { targetType: 'provider', count: 1 },
    ],
  },
  'admin audit diagnostics should derive counts, latest action and sorted distributions',
);

assert.deepEqual(
  deriveAdminAuditDiagnosticsSummary([]),
  {
    totalLogCount: 0,
    actionCount: 0,
    targetTypeCount: 0,
    latestAction: null,
    latestTargetType: null,
    latestAt: null,
    topActions: [],
    targetTypes: [],
  },
  'admin audit diagnostics should expose a stable empty summary',
);

assert.deepEqual(
  deriveAdminAuditDiagnosticsSummary([
    createAuditLog(5, ' ', 'user', '2026-07-14T10:00:00Z'),
    createAuditLog(6, 'update_user', ' ', '2026-07-14T11:00:00Z'),
  ]),
  {
    totalLogCount: 2,
    actionCount: 1,
    targetTypeCount: 1,
    latestAction: 'update_user',
    latestTargetType: ' ',
    latestAt: '2026-07-14T11:00:00Z',
    topActions: [{ action: 'update_user', count: 1 }],
    targetTypes: [{ targetType: 'user', count: 1 }],
  },
  'admin audit diagnostics should ignore blank action or target labels in distributions',
);

assert.equal(normalizeAdminAuditFilterValue(' reload_provider '), 'reload_provider');
assert.equal(normalizeAdminAuditFilterValue('all'), 'all');
assert.equal(normalizeAdminAuditFilterValue(' '), 'all');
assert.equal(updateAdminAuditActionSearch('?foo=bar', 'reload_provider'), '?foo=bar&audit_action=reload_provider');
assert.equal(updateAdminAuditActionSearch('?foo=bar&audit_action=reload_provider', 'all'), '?foo=bar');
assert.equal(updateAdminAuditTargetTypeSearch('?foo=bar', 'provider'), '?foo=bar&audit_target_type=provider');
assert.equal(updateAdminAuditTargetTypeSearch('?foo=bar&audit_target_type=provider', 'all'), '?foo=bar');
assert.equal(
  clearAdminAuditFilterSearch('?foo=bar&audit_action=reload_provider&audit_target_type=provider'),
  '?foo=bar',
);

const providerAuditLogs = filterAdminAuditLogs(logs, {
  actionFilter: 'reload_provider',
  targetTypeFilter: 'provider',
});
assert.deepEqual(
  providerAuditLogs.map((log) => log.id),
  [4],
  'admin audit filters should compose action and target type on the loaded snapshot',
);

const activeFilterSummary = deriveAdminAuditActiveFilterSummary(logs, providerAuditLogs, {
  actionFilter: 'reload_provider',
  targetTypeFilter: 'provider',
});
assert.deepEqual(
  activeFilterSummary,
  {
    activeFilterCount: 2,
    matchedLogCount: 1,
    totalLogCount: 4,
    activeLabels: ['audit_action=reload_provider', 'audit_target_type=provider'],
  },
  'admin audit active filter summary should expose URL labels and matched counts',
);

const emptyActiveFilterSummary = deriveAdminAuditActiveFilterSummary(logs, logs, {
  actionFilter: 'all',
  targetTypeFilter: 'all',
});
assert.deepEqual(
  emptyActiveFilterSummary,
  {
    activeFilterCount: 0,
    matchedLogCount: 4,
    totalLogCount: 4,
    activeLabels: [],
  },
  'admin audit active filter summary should be empty when filters are cleared',
);

console.log('[YES] Admin audit diagnostics model validation passed.');
