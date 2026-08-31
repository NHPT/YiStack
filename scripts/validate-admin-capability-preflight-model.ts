import { strict as assert } from 'node:assert';
import fs from 'node:fs';

import {
  clearCapabilityPreflightFilterSearch,
  deriveCapabilityPreflightActiveFilterSummary,
  deriveCapabilityPreflightConfigKeySummary,
  deriveCapabilityPreflightFocusedConfigKeySummary,
  deriveCapabilityPreflightFocusedReasonCodeSummary,
  deriveCapabilityPreflightPrioritySummary,
  deriveCapabilityPreflightProviderSummary,
  deriveCapabilityPreflightReasonCodeSummary,
  deriveCapabilityPreflightSnapshotFreshness,
  filterCapabilityPreflightItems,
  normalizeCapabilityPreflightConfigKeyFilter,
  normalizeCapabilityPreflightReasonCodeFilter,
  normalizeCapabilityPreflightSeverityFilter,
  normalizeCapabilityPreflightStatusFilter,
  sortCapabilityPreflightItems,
  updateCapabilityPreflightConfigKeySearch,
  updateCapabilityPreflightReasonCodeSearch,
  updateCapabilityPreflightSeveritySearch,
  updateCapabilityPreflightStatusSearch,
} from '../src/app/admin/admin-capability-preflight-model';
import type {
  CapabilityProviderPreflightItem,
  CapabilityProviderPreflightSeverity,
  CapabilityProviderPreflightStatus,
} from '../src/lib/admin/api';

const preflightCard = fs.readFileSync('src/app/admin/admin-capability-preflight-card.tsx', 'utf8');
const preflightView = fs.readFileSync('src/app/admin/admin-capability-preflight-view.tsx', 'utf8');
const preflightModel = fs.readFileSync('src/app/admin/admin-capability-preflight-model.ts', 'utf8');
const adminDiagnosticLinkCopyHook = fs.readFileSync('src/app/admin/use-admin-diagnostic-link-copy.ts', 'utf8');
assert.match(
  preflightModel,
  /export type CapabilityPreflightActiveFilterModel = \{[\s\S]*kind: CapabilityPreflightActiveFilterKind;[\s\S]*value: string;[\s\S]*\};[\s\S]*export type CapabilityPreflightActiveFilterList = CapabilityPreflightActiveFilterModel\[\];[\s\S]*export type CapabilityPreflightActiveFilterLabel = string;[\s\S]*export type CapabilityPreflightActiveFilterLabelList = CapabilityPreflightActiveFilterLabel\[\];[\s\S]*activeLabels: CapabilityPreflightActiveFilterLabelList;[\s\S]*activeFilters: CapabilityPreflightActiveFilterList;[\s\S]*const activeFilters: CapabilityPreflightActiveFilterList = \[\];[\s\S]*const activeLabels: CapabilityPreflightActiveFilterLabelList = \[\];/,
  'admin capability preflight model should name active filter item/list and label/list contracts and consume them in the derived summary',
);
assert.doesNotMatch(
  preflightModel,
  /CapabilityPreflightActiveFilterSummaryModel\['activeFilters'\]|activeLabels: string\[\];|const activeLabels: string\[\]/,
  'admin capability preflight model should not infer active filter list through summary model indexed access or keep active labels as an anonymous string array contract',
);
assert.match(
  preflightModel,
  /CapabilityProviderPreflightNextAction,[\s\S]*CapabilityProviderPreflightProvider,[\s\S]*CapabilityProviderPreflightReasonCode,[\s\S]*CapabilityProviderPreflightRunnerMode,[\s\S]*export type CapabilityPreflightProviderName = CapabilityProviderPreflightProvider;[\s\S]*export type CapabilityPreflightProviderNameList = CapabilityPreflightProviderName\[\];[\s\S]*export type CapabilityPreflightReasonCode = CapabilityProviderPreflightReasonCode;[\s\S]*export type CapabilityPreflightReasonCodeList = CapabilityPreflightReasonCode\[\];[\s\S]*export type CapabilityPreflightConfigKey = string;[\s\S]*export type CapabilityPreflightConfigKeyList = CapabilityPreflightConfigKey\[\];[\s\S]*export type CapabilityPreflightNextAction = CapabilityProviderPreflightNextAction;[\s\S]*export type CapabilityPreflightNextActionList = CapabilityPreflightNextAction\[\];[\s\S]*export type CapabilityPreflightRunnerMode = CapabilityProviderPreflightRunnerMode;[\s\S]*export type CapabilityPreflightRunnerModeList = CapabilityPreflightRunnerMode\[\];/,
  'admin capability preflight model should name provider, reason code, config key, next action and runner mode dimension list contracts and tie provider/reason/next action/runner mode back to API contracts',
);
assert.match(
  preflightModel,
  /key: CapabilityPreflightConfigKey;[\s\S]*providers: CapabilityPreflightProviderNameList;[\s\S]*reasonCodes: CapabilityPreflightReasonCodeList;[\s\S]*reasonCode: CapabilityPreflightReasonCode;[\s\S]*configKeys: CapabilityPreflightConfigKeyList;[\s\S]*provider: CapabilityPreflightProviderName;[\s\S]*runnerModes: CapabilityPreflightRunnerModeList;[\s\S]*reasonCodes: CapabilityPreflightReasonCodeList;[\s\S]*reasonCode: CapabilityPreflightReasonCode;[\s\S]*const summaryByProvider = new Map<CapabilityPreflightProviderName,[\s\S]*const reasonCode: CapabilityPreflightReasonCode = item\.reason_code\.trim\(\);/,
  'admin capability preflight summary models should consume named dimension contracts for item fields, lists and aggregation keys',
);
assert.match(
  preflightModel,
  /CapabilityProviderPreflightItemList,[\s\S]*sortCapabilityPreflightItems\(items: CapabilityProviderPreflightItemList\): CapabilityProviderPreflightItemList[\s\S]*filterCapabilityPreflightItems\([\s\S]*items: CapabilityProviderPreflightItemList,[\s\S]*\): CapabilityProviderPreflightItemList[\s\S]*deriveCapabilityPreflightActiveFilterSummary\([\s\S]*totalItems: CapabilityProviderPreflightItemList,[\s\S]*matchedItems: CapabilityProviderPreflightItemList,[\s\S]*deriveCapabilityPreflightProviderSummary\([\s\S]*items: CapabilityProviderPreflightItemList,/,
  'admin capability preflight model should consume the named provider preflight item list contract across sort, filter and summary helpers',
);
assert.match(
  preflightModel,
  /CapabilityProviderPreflightMetadata,[\s\S]*getCapabilityPreflightConfigKeys\(metadata\?: CapabilityProviderPreflightMetadata\): CapabilityPreflightConfigKeyList[\s\S]*const rawConfigKeys = metadata\?\.config_keys;[\s\S]*const hasRawConfigKeyList = Array\.isArray\(rawConfigKeys\);[\s\S]*if \(hasRawConfigKeyList === false\)[\s\S]*const normalizedConfigKeys = new Set<CapabilityPreflightConfigKey>\(\);[\s\S]*for \(const item of rawConfigKeys\)[\s\S]*const normalizedConfigKey: CapabilityPreflightConfigKey = String\(item\)\.trim\(\);[\s\S]*const hasNormalizedConfigKey = normalizedConfigKey\.length > 0;[\s\S]*if \(hasNormalizedConfigKey === true\)[\s\S]*normalizedConfigKeys\.add\(normalizedConfigKey\);[\s\S]*return getSortedCapabilityPreflightValues\(normalizedConfigKeys\);/,
  'admin capability preflight config key helper should consume named metadata and config key list contracts through explicit config key presence facts',
);
assert.doesNotMatch(
  preflightModel,
  /export type CapabilityPreflightProviderName = string;|export type CapabilityPreflightReasonCode = string;|export type CapabilityPreflightNextAction = string;|export type CapabilityPreflightRunnerMode = string;|key: string;|reasonCode: string;|provider: string;|const summaryByProvider = new Map<string,|providers: string\[\];|reasonCodes: string\[\];|configKeys: string\[\];|nextActions: string\[\];|runnerModes: string\[\]|getCapabilityPreflightConfigKeys\(metadata\?: Record<string, unknown>\)|getCapabilityPreflightConfigKeys\(metadata\?: Record<string, unknown>\): string\[\]|rawConfigKeys\.map\(\(item\) => String\(item\)\.trim\(\)\)\.filter\(Boolean\)|CapabilityProviderPreflightItem\[\]|CapabilityProviderPreflightItem\['status'\]|CapabilityProviderPreflightItem\['severity'\]/,
  'admin capability preflight summary models, fixtures and config key helper should not keep user-visible dimensions as raw strings, anonymous string arrays, anonymous metadata Records or indexed access contracts',
);
assert.match(
  preflightModel,
  /const hasNormalizedValue = normalizedValue !== undefined && normalizedValue\.length > 0;[\s\S]*const isKnownFilter = hasNormalizedValue === true && CAPABILITY_PREFLIGHT_STATUS_FILTERS\.includes\(normalizedValue\);[\s\S]*if \(isKnownFilter === false\)[\s\S]*const isKnownFilter = hasNormalizedValue === true && CAPABILITY_PREFLIGHT_SEVERITY_FILTERS\.includes\(normalizedValue\);[\s\S]*if \(isKnownFilter === false\)[\s\S]*const isAllFilter = normalizedValue === 'all';[\s\S]*if \(hasNormalizedValue === false \|\| isAllFilter === true\)[\s\S]*const hasStatusFilter = filters\.statusFilter !== 'all';[\s\S]*const hasSeverityFilter = filters\.severityFilter !== 'all';[\s\S]*const hasConfigKeyFilter = filters\.configKeyFilter !== 'all';[\s\S]*const hasReasonCodeFilter = filters\.reasonCodeFilter !== 'all';[\s\S]*if \(hasStatusFilter === true\)[\s\S]*if \(hasSeverityFilter === true\)[\s\S]*if \(hasConfigKeyFilter === true\)[\s\S]*if \(hasReasonCodeFilter === true\)/,
  'admin capability preflight filters should derive normalization and active filter labels through explicit filter facts',
);
assert.match(
  preflightModel,
  /const normalizedGeneratedAt = generatedAt\?\.trim\(\);[\s\S]*const hasNormalizedGeneratedAt = normalizedGeneratedAt !== undefined && normalizedGeneratedAt\.length > 0;[\s\S]*if \(hasNormalizedGeneratedAt === false\)[\s\S]*let summaryItem: CapabilityPreflightConfigKeySummaryItem \| undefined;[\s\S]*for \(const item of summary\.items\)[\s\S]*const isMatched = item\.key === configKeyFilter;[\s\S]*if \(isMatched === true\)[\s\S]*summaryItem = item;[\s\S]*const hasSummaryItem = summaryItem !== undefined;[\s\S]*if \(hasSummaryItem === false \|\| summaryItem === undefined\)[\s\S]*const reasonCode: CapabilityPreflightReasonCode = item\.reason_code\.trim\(\);[\s\S]*const hasReasonCode = reasonCode\.length > 0;[\s\S]*if \(hasReasonCode === false\)[\s\S]*let summaryItem: CapabilityPreflightReasonCodeSummaryItem \| undefined;[\s\S]*for \(const item of summary\.items\)[\s\S]*const isMatched = item\.reasonCode === reasonCodeFilter;[\s\S]*if \(isMatched === true\)[\s\S]*summaryItem = item;[\s\S]*const hasSummaryItem = summaryItem !== undefined;[\s\S]*if \(hasSummaryItem === false \|\| summaryItem === undefined\)/,
  'admin capability preflight model should derive timestamp, focused summary and reason code presence through explicit facts',
);
assert.doesNotMatch(
  preflightModel,
  /if \(!normalizedValue \|\| !CAPABILITY_PREFLIGHT_STATUS_FILTERS\.includes\(normalizedValue\)\)|if \(!normalizedValue \|\| !CAPABILITY_PREFLIGHT_SEVERITY_FILTERS\.includes\(normalizedValue\)\)|if \(!normalizedValue \|\| normalizedValue === 'all'\)|if \(filters\.(statusFilter|severityFilter|configKeyFilter|reasonCodeFilter) !== 'all'\)|if \(!normalizedGeneratedAt\)|if \(!summaryItem\)|if \(!reasonCode\)|rawConfigKeys\s*\.[\s\S]*\.map\(|rawConfigKeys\s*\.[\s\S]*\.filter\(|sortCapabilityPreflightItems\(items\)\.filter\(|sortedItems\.filter\(|sortedProviderItems\[0\]|summaryByProvider\.entries\(\)\][\s\S]*\.map\(|summaryItems\.filter\(|summaryByKey\.entries\(\)\][\s\S]*\.map\(|summary\.items\.find\(|summaryByReasonCode\.entries\(\)\][\s\S]*\.map\(/,
  'admin capability preflight filters and summary helpers should not regress normalization, active filters or presence checks to implicit truthy gates',
);
assert.match(
  preflightModel,
  /function shouldIncludeCapabilityPreflightItem\([\s\S]*const statusMatched = statusFilter === 'all' \|\| item\.status === statusFilter;[\s\S]*const severityMatched = severityFilter === 'all' \|\| item\.severity === severityFilter;[\s\S]*const configKeyMatched = hasCapabilityPreflightConfigKey\(item, configKeyFilter\);[\s\S]*const reasonCodeMatched = reasonCodeFilter === 'all' \|\| item\.reason_code === reasonCodeFilter;[\s\S]*const shouldInclude = statusMatched === true && severityMatched === true && configKeyMatched === true && reasonCodeMatched === true;[\s\S]*for \(const item of sortedItems\)[\s\S]*const shouldInclude = shouldIncludeCapabilityPreflightItem\([\s\S]*if \(shouldInclude === true\)[\s\S]*filteredItems\.push\(item\);/,
  'admin capability preflight model should filter items through a named explicit for-of reader',
);
assert.match(
  preflightModel,
  /function getCapabilityPreflightProviderSummaryCountByStatus\([\s\S]*items: readonly CapabilityPreflightProviderSummaryItem\[\],[\s\S]*status: CapabilityProviderPreflightStatus,[\s\S]*\): number[\s\S]*for \(const item of items\)[\s\S]*const isMatched = item\.status === status;[\s\S]*if \(isMatched === true\)[\s\S]*blockedProviderCount: getCapabilityPreflightProviderSummaryCountByStatus\(summaryItems, 'blocked'\),[\s\S]*readyProviderCount: getCapabilityPreflightProviderSummaryCountByStatus\(summaryItems, 'ready'\),[\s\S]*skippedProviderCount: getCapabilityPreflightProviderSummaryCountByStatus\(summaryItems, 'skipped'\),/,
  'admin capability preflight model should count provider summary statuses through a named explicit reader',
);
assert.match(
  preflightModel,
  /function getCapabilityPreflightFirstProviderItemSeverity\([\s\S]*items: CapabilityProviderPreflightItemList,[\s\S]*\): CapabilityProviderPreflightSeverity \{[\s\S]*for \(const item of items\)[\s\S]*return item\.severity;[\s\S]*return 'info';[\s\S]*highestSeverity: getCapabilityPreflightFirstProviderItemSeverity\(sortedProviderItems\),/,
  'admin capability preflight model should derive provider highest severity through a named first-item severity reader',
);
assert.match(
  preflightCard,
  /deriveCapabilityPreflightActiveFilterSummary/,
  'admin capability preflight card should render the active filter summary',
);
assert.match(
  preflightCard,
  /CapabilityProviderPreflightItemList,[\s\S]*CapabilityProviderPreflightResponse,[\s\S]*const EMPTY_CAPABILITY_PROVIDER_PREFLIGHT_ITEMS: CapabilityProviderPreflightItemList = \[\];[\s\S]*function getAdminCapabilityPreflightCardItems\([\s\S]*providerPreflight: CapabilityProviderPreflightResponse \| null,[\s\S]*\): CapabilityProviderPreflightItemList \{[\s\S]*const hasProviderPreflight = providerPreflight !== null;[\s\S]*if \(hasProviderPreflight === false\)[\s\S]*return EMPTY_CAPABILITY_PROVIDER_PREFLIGHT_ITEMS;[\s\S]*const hasProviderPreflightItems = Array\.isArray\(providerPreflight\.items\) === true;[\s\S]*return hasProviderPreflightItems === true \? providerPreflight\.items : EMPTY_CAPABILITY_PROVIDER_PREFLIGHT_ITEMS;[\s\S]*function getAdminCapabilityPreflightCardItemCount\(items: CapabilityProviderPreflightItemList\): number \{[\s\S]*const hasItemList = Array\.isArray\(items\) === true;[\s\S]*return hasItemList === true \? items\.length : 0;[\s\S]*function hasAdminCapabilityPreflightCardItems\(items: CapabilityProviderPreflightItemList\): boolean \{[\s\S]*const itemCount = getAdminCapabilityPreflightCardItemCount\(items\);[\s\S]*const hasItems = Array\.isArray\(items\) === true && itemCount > 0;[\s\S]*return hasItems === true;[\s\S]*function shouldRenderAdminCapabilityPreflightCardUnavailable\(items: CapabilityProviderPreflightItemList\): boolean \{[\s\S]*const hasItems = hasAdminCapabilityPreflightCardItems\(items\);[\s\S]*return hasItems === false;[\s\S]*function shouldRenderAdminCapabilityPreflightCardContent\(items: CapabilityProviderPreflightItemList\): boolean \{[\s\S]*const hasItems = hasAdminCapabilityPreflightCardItems\(items\);[\s\S]*return hasItems === true;[\s\S]*const providerPreflightItems = useMemo\(\(\) => \{[\s\S]*return getAdminCapabilityPreflightCardItems\(providerPreflight\);[\s\S]*const shouldRenderProviderPreflightUnavailable = shouldRenderAdminCapabilityPreflightCardUnavailable\(providerPreflightItems\);[\s\S]*const shouldRenderProviderPreflightContent = shouldRenderAdminCapabilityPreflightCardContent\(providerPreflightItems\);[\s\S]*shouldRenderProviderPreflightUnavailable === true && \([\s\S]*shouldRenderProviderPreflightContent === true && \(/,
  'admin capability preflight card should resolve provider preflight items, unavailable state and content rendering through named facts',
);
assert.doesNotMatch(
  preflightCard,
  /!providerPreflight|providerPreflight\?\.items \?\? \[\]|providerPreflight\.items\.length === 0|shouldRenderProviderPreflightUnavailable === true \? \(/,
  'admin capability preflight card should not regress provider preflight availability or render consumption to optional items fallback, implicit negation gates or inline ternary consumption',
);
assert.match(
  preflightView,
  /AdminCapabilityPreflightHeader/,
  'admin capability preflight view should expose the startup snapshot header display entry',
);
assert.match(
  preflightView,
  /AdminCapabilityPreflightBoundaryNotice/,
  'admin capability preflight view should expose the read-only boundary display entry',
);
assert.match(
  preflightView,
  /CapabilityProviderPreflightMetadata,[\s\S]*getCapabilityPreflightMetadataEntries\(metadata\?: CapabilityProviderPreflightMetadata\)/,
  'admin capability preflight view metadata formatter should consume the named metadata contract',
);
assert.match(
  preflightView,
  /function getCapabilityPreflightListLabel\(values: readonly string\[\], separator: string\): string[\s\S]*const hasValues = values\.length > 0;[\s\S]*return hasValues === true \? values\.join\(separator\) : '-';[\s\S]*function hasCapabilityPreflightPrimaryItem\([\s\S]*item: CapabilityProviderPreflightItem \| null,[\s\S]*\): item is CapabilityProviderPreflightItem \{[\s\S]*return item !== null;[\s\S]*function shouldRenderCapabilityPreflightPrimaryConfigKeys\(configKeys: readonly string\[\]\): boolean \{[\s\S]*const hasConfigKeys = configKeys\.length > 0;[\s\S]*return hasConfigKeys === true;[\s\S]*function shouldRenderCapabilityPreflightProviderSummaryItems\([\s\S]*summary: CapabilityPreflightProviderSummaryModel,[\s\S]*\): boolean \{[\s\S]*const hasProviders = summary\.providerCount > 0;[\s\S]*return hasProviders === true;[\s\S]*const values: string\[\] = \[\];[\s\S]*for \(const item of value\)[\s\S]*values\.push\(String\(item\)\);[\s\S]*return getCapabilityPreflightListLabel\(values, ', '\);[\s\S]*return value === true \? 'true' : 'false';[\s\S]*const hasObjectValue = value !== undefined && value !== null && typeof value === 'object';[\s\S]*if \(hasObjectValue === true\)/,
  'admin capability preflight view should derive metadata array and object labels through explicit display facts',
);
assert.match(
  preflightView,
  /import type \{ ReactNode \} from 'react';[\s\S]*CapabilityPreflightConfigKeySummaryItem,[\s\S]*CapabilityPreflightProviderSummaryItem,[\s\S]*CapabilityPreflightReasonCodeSummaryItem,[\s\S]*function materializeAdminCapabilityPreflightProviderSummaryItemNodes\([\s\S]*items: readonly CapabilityPreflightProviderSummaryItem\[\],[\s\S]*copy: AdminCopy,[\s\S]*\): ReactNode\[\] \{[\s\S]*const nodes: ReactNode\[\] = \[\];[\s\S]*for \(const item of items\)[\s\S]*function materializeAdminCapabilityPreflightConfigKeySummaryItemNodes\([\s\S]*items: readonly CapabilityPreflightConfigKeySummaryItem\[\],[\s\S]*selectedConfigKey: CapabilityPreflightConfigKeyFilter,[\s\S]*onConfigKeySelect: \(value: CapabilityPreflightConfigKeyFilter\) => void,[\s\S]*\): ReactNode\[\] \{[\s\S]*for \(const item of items\)[\s\S]*function materializeAdminCapabilityPreflightReasonCodeRunbookItemNodes\([\s\S]*items: readonly CapabilityPreflightReasonCodeSummaryItem\[\],[\s\S]*copy: AdminCopy,[\s\S]*selectedReasonCode: CapabilityPreflightReasonCodeFilter,[\s\S]*onReasonCodeSelect: \(value: CapabilityPreflightReasonCodeFilter\) => void,[\s\S]*\): ReactNode\[\] \{[\s\S]*for \(const item of items\)[\s\S]*function materializeAdminCapabilityPreflightMetadataEntryNodes\([\s\S]*metadataEntries: readonly CapabilityPreflightMetadataEntry\[\],[\s\S]*\): ReactNode\[\] \{[\s\S]*for \(const entry of metadataEntries\)[\s\S]*function materializeAdminCapabilityPreflightItemNodes\([\s\S]*copy: AdminCopy,[\s\S]*items: CapabilityProviderPreflightItemList,[\s\S]*\): ReactNode\[\] \{[\s\S]*for \(const item of items\)/,
  'admin capability preflight view should render provider/config/reason/item/metadata nodes through named ReactNode materializers and explicit for-of loops',
);
assert.match(
  preflightView,
  /function shouldRenderCapabilityPreflightPrimaryIssue\([\s\S]*item: CapabilityProviderPreflightItem \| null,[\s\S]*\): item is CapabilityProviderPreflightItem \{[\s\S]*const hasPrimaryItem = hasCapabilityPreflightPrimaryItem\(item\);[\s\S]*return hasPrimaryItem === true;[\s\S]*function shouldRenderCapabilityPreflightPriorityHealthy\(item: CapabilityProviderPreflightItem \| null\): boolean \{[\s\S]*const hasPrimaryItem = hasCapabilityPreflightPrimaryItem\(item\);[\s\S]*return hasPrimaryItem === false;[\s\S]*const primaryItem = summary\.primaryItem;[\s\S]*const shouldRenderPrimaryIssue = shouldRenderCapabilityPreflightPrimaryIssue\(primaryItem\);[\s\S]*const shouldRenderPriorityHealthy = shouldRenderCapabilityPreflightPriorityHealthy\(primaryItem\);[\s\S]*const shouldRenderPrimaryConfigKeys = shouldRenderCapabilityPreflightPrimaryConfigKeys\(primaryConfigKeys\);[\s\S]*\{shouldRenderPrimaryIssue === true && primaryItem !== null && \([\s\S]*\{primaryItem\.provider\} \/ \{primaryItem\.reason_code\}[\s\S]*\{shouldRenderPrimaryConfigKeys === true && \([\s\S]*\{primaryItem\.next_action\}[\s\S]*\{shouldRenderPriorityHealthy === true && \([\s\S]*const shouldRenderProviderSummaryItems = shouldRenderCapabilityPreflightProviderSummaryItems\(summary\);[\s\S]*\{shouldRenderProviderSummaryItems === true && \(/,
  'admin capability preflight view should render priority and provider summaries through named render facts and explicit && consumption',
);
assert.match(
  preflightView,
  /import type \{ AdminDiagnosticTone \} from '\.\/admin-diagnostics-view';[\s\S]*function getCapabilityPreflightPrioritySummaryTone\(summary: CapabilityPreflightPrioritySummaryModel\): AdminDiagnosticTone \{[\s\S]*const hasCriticalItems = summary\.criticalCount > 0;[\s\S]*if \(hasCriticalItems === true\)[\s\S]*return 'critical';[\s\S]*const hasWarningItems = summary\.warningCount > 0;[\s\S]*if \(hasWarningItems === true\)[\s\S]*return 'warning';[\s\S]*return 'success';[\s\S]*function isCapabilityPreflightProviderSummaryHealthy\(summary: CapabilityPreflightProviderSummaryModel\): boolean \{[\s\S]*const hasProviders = summary\.providerCount > 0;[\s\S]*const hasBlockedProviders = summary\.blockedProviderCount > 0;[\s\S]*const hasSkippedProviders = summary\.skippedProviderCount > 0;[\s\S]*return hasProviders === true && hasBlockedProviders === false && hasSkippedProviders === false;[\s\S]*function getCapabilityPreflightProviderSummaryEmptyMessage\([\s\S]*summary: CapabilityPreflightProviderSummaryModel,[\s\S]*copy: AdminCopy,[\s\S]*\): string \| undefined \{[\s\S]*const hasProviders = summary\.providerCount > 0;[\s\S]*if \(hasProviders === true\)[\s\S]*return undefined;[\s\S]*return copy\.capabilityPreflightProviderSummaryEmpty;[\s\S]*function getCapabilityPreflightProviderSummaryHealthyMessage\(isHealthy: boolean, copy: AdminCopy\): string \| undefined \{[\s\S]*if \(isHealthy === false\)[\s\S]*return undefined;[\s\S]*return copy\.capabilityPreflightProviderSummaryHealthy;[\s\S]*const summaryTone = getCapabilityPreflightPrioritySummaryTone\(summary\);[\s\S]*const isHealthy = isCapabilityPreflightProviderSummaryHealthy\(summary\);[\s\S]*const emptyMessage = getCapabilityPreflightProviderSummaryEmptyMessage\(summary, copy\);[\s\S]*const healthyMessage = getCapabilityPreflightProviderSummaryHealthyMessage\(isHealthy, copy\);[\s\S]*emptyMessage=\{emptyMessage\}[\s\S]*healthyMessage=\{healthyMessage\}/,
  'admin capability preflight priority/provider summaries should derive tone and messages through named display facts',
);
assert.match(
  preflightView,
  /function getCapabilityPreflightActiveFilterLabelSuffix\(summary: CapabilityPreflightActiveFilterSummaryModel\): string \{[\s\S]*const hasActiveLabels = summary\.activeLabels\.length > 0;[\s\S]*return hasActiveLabels === true \? ` \/ \$\{summary\.activeLabels\.join\(' \/ '\)\}` : '';[\s\S]*function getCapabilityPreflightDiagnosticLinkCopyActionLabel\(isCopied: boolean, copy: AdminCopy\): string \{[\s\S]*if \(isCopied === true\)[\s\S]*return copy\.capabilityPreflightDiagnosticLinkCopied;[\s\S]*return copy\.capabilityPreflightCopyDiagnosticLink;[\s\S]*function shouldRenderCapabilityPreflightDiagnosticLinkCopyError\(error: string\): boolean \{[\s\S]*const hasError = error\.length > 0;[\s\S]*return hasError === true;[\s\S]*function shouldRenderCapabilityPreflightActiveFilters\(summary: CapabilityPreflightActiveFilterSummaryModel\): boolean \{[\s\S]*const hasActiveFilters = summary\.activeFilterCount > 0;[\s\S]*return hasActiveFilters === true;[\s\S]*function shouldRenderCapabilityPreflightConfigKeyFilter\(value: CapabilityPreflightConfigKeyFilter\): boolean \{[\s\S]*return value !== 'all';[\s\S]*function shouldRenderCapabilityPreflightReasonCodeFilter\(value: CapabilityPreflightReasonCodeFilter\): boolean \{[\s\S]*return value !== 'all';[\s\S]*function hasCapabilityPreflightFocusedConfigKeySummary\([\s\S]*summary: CapabilityPreflightFocusedConfigKeySummaryModel,[\s\S]*\): summary is Exclude<CapabilityPreflightFocusedConfigKeySummaryModel, null> \{[\s\S]*return summary !== null;[\s\S]*function hasCapabilityPreflightFocusedReasonCodeSummary\([\s\S]*summary: CapabilityPreflightFocusedReasonCodeSummaryModel,[\s\S]*\): summary is Exclude<CapabilityPreflightFocusedReasonCodeSummaryModel, null> \{[\s\S]*return summary !== null;[\s\S]*const activeFilterLabelSuffix = getCapabilityPreflightActiveFilterLabelSuffix\(activeFilterSummary\);[\s\S]*const shouldRenderDiagnosticLinkCopyError = shouldRenderCapabilityPreflightDiagnosticLinkCopyError\(diagnosticLinkCopyError\);[\s\S]*const shouldRenderActiveFilters = shouldRenderCapabilityPreflightActiveFilters\(activeFilterSummary\);[\s\S]*const shouldRenderConfigKeyFilter = shouldRenderCapabilityPreflightConfigKeyFilter\(configKeyFilter\);[\s\S]*const shouldRenderReasonCodeFilter = shouldRenderCapabilityPreflightReasonCodeFilter\(reasonCodeFilter\);[\s\S]*const hasFocusedConfigKeySummary = hasCapabilityPreflightFocusedConfigKeySummary\(focusedConfigKeySummary\);[\s\S]*const hasFocusedReasonCodeSummary = hasCapabilityPreflightFocusedReasonCodeSummary\(focusedReasonCodeSummary\);[\s\S]*const diagnosticLinkCopyActionLabel = getCapabilityPreflightDiagnosticLinkCopyActionLabel\(diagnosticLinkCopied, copy\);[\s\S]*\{activeFilterLabelSuffix\}[\s\S]*\{diagnosticLinkCopyActionLabel\}[\s\S]*\{shouldRenderDiagnosticLinkCopyError === true && \([\s\S]*\{shouldRenderActiveFilters === true && \([\s\S]*\{shouldRenderConfigKeyFilter === true && \([\s\S]*\{shouldRenderReasonCodeFilter === true && \([\s\S]*\{hasFocusedConfigKeySummary === true && \([\s\S]*\{hasFocusedReasonCodeSummary === true && \(/,
  'admin capability preflight filters should render active labels, errors, filter chips and focused summaries through named facts and explicit && consumption',
);
assert.match(
  preflightView,
  /type CapabilityPreflightMetadataEntry = \{[\s\S]*key: string;[\s\S]*value: string;[\s\S]*function shouldRenderCapabilityPreflightItemNextAction\(item: CapabilityProviderPreflightItem\): boolean \{[\s\S]*const hasNextAction = item\.next_action !== null && item\.next_action !== undefined && item\.next_action\.length > 0;[\s\S]*return hasNextAction === true;[\s\S]*function shouldRenderCapabilityPreflightItemConfigKeys\(configKeys: readonly string\[\]\): boolean \{[\s\S]*const hasConfigKeys = configKeys\.length > 0;[\s\S]*return hasConfigKeys === true;[\s\S]*function shouldRenderCapabilityPreflightItemMetadataEntries\([\s\S]*metadataEntries: readonly CapabilityPreflightMetadataEntry\[\],[\s\S]*\): boolean \{[\s\S]*const hasMetadataEntries = metadataEntries\.length > 0;[\s\S]*return hasMetadataEntries === true;[\s\S]*function getCapabilityPreflightItemRunnerModeLabel\(item: CapabilityProviderPreflightItem\): string \{[\s\S]*const hasRunnerMode = item\.runner_mode\.length > 0;[\s\S]*return hasRunnerMode === true \? item\.runner_mode : 'none';[\s\S]*function getCapabilityPreflightMetadataEntries\(metadata\?: CapabilityProviderPreflightMetadata\): CapabilityPreflightMetadataEntry\[\][\s\S]*function materializeAdminCapabilityPreflightItemNodes\([\s\S]*const shouldRenderNextAction = shouldRenderCapabilityPreflightItemNextAction\(item\);[\s\S]*const shouldRenderConfigKeys = shouldRenderCapabilityPreflightItemConfigKeys\(configKeys\);[\s\S]*const shouldRenderMetadataEntries = shouldRenderCapabilityPreflightItemMetadataEntries\(metadataEntries\);[\s\S]*const runnerModeLabel = getCapabilityPreflightItemRunnerModeLabel\(item\);[\s\S]*\{runnerModeLabel\}[\s\S]*\{shouldRenderNextAction === true && \([\s\S]*\{shouldRenderConfigKeys === true && \([\s\S]*\{shouldRenderMetadataEntries === true && \(/,
  'admin capability preflight item list should render next action, config keys and metadata entries through named facts and explicit && consumption',
);
assert.match(
  preflightView,
  /function getCapabilityPreflightRunbookSelectionClassName\(isSelected: boolean\): string \{[\s\S]*if \(isSelected === true\)[\s\S]*'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-500\/40 dark:bg-blue-500\/10 dark:text-blue-100';[\s\S]*'border-white\/70 bg-white\/70 hover:border-blue-200 hover:bg-blue-50\/50 dark:border-gray-700 dark:bg-gray-950\/30 dark:hover:border-blue-500\/30 dark:hover:bg-blue-500\/10';[\s\S]*function getCapabilityPreflightConfigKeyToggleTarget\([\s\S]*selectedConfigKey: CapabilityPreflightConfigKeyFilter,[\s\S]*configKey: string,[\s\S]*\): CapabilityPreflightConfigKeyFilter \{[\s\S]*const isSelected = selectedConfigKey === configKey;[\s\S]*return isSelected === true \? 'all' : configKey;[\s\S]*function getCapabilityPreflightReasonCodeToggleTarget\([\s\S]*selectedReasonCode: CapabilityPreflightReasonCodeFilter,[\s\S]*reasonCode: string,[\s\S]*\): CapabilityPreflightReasonCodeFilter \{[\s\S]*const isSelected = selectedReasonCode === reasonCode;[\s\S]*return isSelected === true \? 'all' : reasonCode;[\s\S]*const isSelected = selectedConfigKey === item\.key;[\s\S]*const runbookSelectionClassName = getCapabilityPreflightRunbookSelectionClassName\(isSelected\);[\s\S]*const toggleTarget = getCapabilityPreflightConfigKeyToggleTarget\(selectedConfigKey, item\.key\);[\s\S]*isSelected,[\s\S]*onClick=\{\(\) => onConfigKeySelect\(toggleTarget\)\}[\s\S]*\$\{runbookSelectionClassName\}[\s\S]*const isSelected = selectedReasonCode === item\.reasonCode;[\s\S]*const runbookSelectionClassName = getCapabilityPreflightRunbookSelectionClassName\(isSelected\);[\s\S]*const toggleTarget = getCapabilityPreflightReasonCodeToggleTarget\(selectedReasonCode, item\.reasonCode\);[\s\S]*isSelected,[\s\S]*onClick=\{\(\) => onReasonCodeSelect\(toggleTarget\)\}[\s\S]*\$\{runbookSelectionClassName\}/,
  'admin capability preflight runbook buttons should derive selection class and toggle targets through named facts',
);
assert.match(
  preflightView,
  /function isCapabilityPreflightItemBlocked\(item: CapabilityProviderPreflightItem\): boolean \{[\s\S]*const isBlocked = item\.status === 'blocked';[\s\S]*return isBlocked === true;[\s\S]*function getCapabilityPreflightItemContainerClassName\(isBlocked: boolean\): string \{[\s\S]*if \(isBlocked === true\)[\s\S]*'border-red-100 bg-red-50\/70 dark:border-red-500\/20 dark:bg-red-500\/10';[\s\S]*'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900\/40';[\s\S]*function getCapabilityPreflightItemProviderClassName\(isBlocked: boolean\): string \{[\s\S]*if \(isBlocked === true\)[\s\S]*'text-red-800 dark:text-red-200';[\s\S]*'text-gray-900 dark:text-gray-100';[\s\S]*function getCapabilityPreflightItemStatusClassName\(isBlocked: boolean\): string \{[\s\S]*if \(isBlocked === true\)[\s\S]*'bg-red-100 text-red-700 dark:bg-red-500\/20 dark:text-red-200';[\s\S]*'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200';[\s\S]*function getCapabilityPreflightItemSourceNoteClassName\(isBlocked: boolean\): string \{[\s\S]*if \(isBlocked === true\)[\s\S]*'text-red-700 dark:text-red-200';[\s\S]*'text-gray-600 dark:text-gray-300';[\s\S]*const isBlocked = isCapabilityPreflightItemBlocked\(item\);[\s\S]*const itemContainerClassName = getCapabilityPreflightItemContainerClassName\(isBlocked\);[\s\S]*const itemProviderClassName = getCapabilityPreflightItemProviderClassName\(isBlocked\);[\s\S]*const itemStatusClassName = getCapabilityPreflightItemStatusClassName\(isBlocked\);[\s\S]*const itemSourceNoteClassName = getCapabilityPreflightItemSourceNoteClassName\(isBlocked\);[\s\S]*\$\{itemContainerClassName\}[\s\S]*\$\{itemProviderClassName\}[\s\S]*\$\{itemStatusClassName\}[\s\S]*\$\{itemSourceNoteClassName\}/,
  'admin capability preflight item rows should derive blocked display classes through named facts',
);
assert.match(
  preflightView,
  /function getCapabilityPreflightItemCount\(items: readonly CapabilityProviderPreflightItem\[\]\): number \{[\s\S]*const hasItemList = Array\.isArray\(items\) === true;[\s\S]*return hasItemList === true \? items\.length : 0;[\s\S]*function hasCapabilityPreflightItems\(items: readonly CapabilityProviderPreflightItem\[\]\): boolean \{[\s\S]*const itemCount = getCapabilityPreflightItemCount\(items\);[\s\S]*const hasItems = Array\.isArray\(items\) === true && itemCount > 0;[\s\S]*return hasItems === true;[\s\S]*function shouldRenderCapabilityPreflightFilteredEmpty\(items: readonly CapabilityProviderPreflightItem\[\]\): boolean \{[\s\S]*const hasItems = hasCapabilityPreflightItems\(items\);[\s\S]*return hasItems === false;[\s\S]*const shouldRenderFilteredEmpty = shouldRenderCapabilityPreflightFilteredEmpty\(items\);[\s\S]*if \(shouldRenderFilteredEmpty === true\)/,
  'admin capability preflight item list should derive filtered empty state through named item list facts',
);
assert.match(
  preflightView,
  /function hasCapabilityProviderPreflightResponse\([\s\S]*providerPreflight: CapabilityProviderPreflightResponse \| null,[\s\S]*\): providerPreflight is CapabilityProviderPreflightResponse \{[\s\S]*return providerPreflight !== null;[\s\S]*const hasProviderPreflight = hasCapabilityProviderPreflightResponse\(providerPreflight\);[\s\S]*if \(hasProviderPreflight === false\)[\s\S]*return null;/,
  'admin capability preflight view should derive footer provider preflight presence through an explicit type guard',
);
assert.match(
  preflightView,
  /CapabilityProviderPreflightStatus,[\s\S]*function hasCapabilityPreflightStatusCountValue\(value: number \| undefined\): value is number \{[\s\S]*const hasStatusCount = value !== undefined && Number\.isInteger\(value\) === true && value >= 0;[\s\S]*return hasStatusCount === true;[\s\S]*function getCapabilityPreflightStatusCount\([\s\S]*providerPreflight: CapabilityProviderPreflightResponse \| null,[\s\S]*status: CapabilityProviderPreflightStatus,[\s\S]*\): number \{[\s\S]*const hasProviderPreflight = hasCapabilityProviderPreflightResponse\(providerPreflight\);[\s\S]*if \(hasProviderPreflight === false\)[\s\S]*return 0;[\s\S]*const statusCount = providerPreflight\.status_counts\[status\];[\s\S]*const hasStatusCount = hasCapabilityPreflightStatusCountValue\(statusCount\);[\s\S]*return hasStatusCount === true \? statusCount : 0;[\s\S]*const blockedStatusCount = getCapabilityPreflightStatusCount\(providerPreflight, 'blocked'\);[\s\S]*const readyStatusCount = getCapabilityPreflightStatusCount\(providerPreflight, 'ready'\);[\s\S]*const skippedStatusCount = getCapabilityPreflightStatusCount\(providerPreflight, 'skipped'\);[\s\S]*\{copy\.capabilityPreflightBlocked\}: \{blockedStatusCount\}[\s\S]*\{copy\.capabilityPreflightReady\}: \{readyStatusCount\}[\s\S]*\{copy\.capabilityPreflightSkipped\}: \{skippedStatusCount\}/,
  'admin capability preflight header should render status counts through named status count facts',
);
assert.match(
  preflightView,
  /getCapabilityPreflightListLabel\(item\.runnerModes, ', '\)[\s\S]*getCapabilityPreflightListLabel\(item\.reasonCodes, ', '\)[\s\S]*getCapabilityPreflightListLabel\(item\.configKeys, ', '\)[\s\S]*getCapabilityPreflightListLabel\(item\.nextActions, ' \/ '\)[\s\S]*getCapabilityPreflightListLabel\(item\.providers, ', '\)[\s\S]*getCapabilityPreflightListLabel\(item\.configKeys, ', '\)[\s\S]*getCapabilityPreflightListLabel\(item\.nextActions, ' \/ '\)/,
  'admin capability preflight view should render provider and reason runbook dimension lists through explicit display labels',
);
assert.doesNotMatch(
  preflightView,
  /if \(items\.length === 0\)|providerPreflight\?\.status_counts\.(?:blocked|ready|skipped) \?\? 0|summary\.primaryItem \?|primaryConfigKeys\.length > 0 \?|summary\.providerCount > 0 \?|summary\.items\.map\(|activeFilterSummary\.activeLabels\.length > 0 \?|diagnosticLinkCopyError \?|hasActiveFilters \?|configKeyFilter !== 'all' \?|reasonCodeFilter !== 'all' \?|focusedConfigKeySummary \?|focusedReasonCodeSummary \?|item\.next_action \?|configKeys\.length > 0 \?|metadataEntries\.length > 0 \?|metadataEntries\.map\(|Object\.entries\(metadata \?\? \{\}\)\.map\(|return items\.map\(|item\.runner_mode \|\| 'none'|value\.map\(\(item\) => String\(item\)\)|value\.length > 0 \? value\.map\(\(item\) => String\(item\)\)\.join\(', '\) : '-'|return value \? 'true' : 'false';|value && typeof value === 'object'|item\.(runnerModes|reasonCodes|configKeys|nextActions|providers)\.join\([^)]*\) \|\| '-'|if \(!providerPreflight\)|hasPrimaryItem === true \?|shouldRenderPrimaryConfigKeys === true \?|shouldRenderProviderSummaryItems === true \?|shouldRenderDiagnosticLinkCopyError === true \?|shouldRenderActiveFilters === true \?|shouldRenderConfigKeyFilter === true \?|shouldRenderReasonCodeFilter === true \?|hasFocusedConfigKeySummary === true \?|hasFocusedReasonCodeSummary === true \?|shouldRenderNextAction === true \?|shouldRenderConfigKeys === true \?|shouldRenderMetadataEntries === true \?|onConfigKeySelect\(selectedConfigKey === item\.key \? 'all' : item\.key\)|onReasonCodeSelect\(selectedReasonCode === item\.reasonCode \? 'all' : item\.reasonCode\)|summary\.criticalCount > 0\s*\? 'critical'|summary\.warningCount > 0\s*\? 'warning'|summary\.providerCount === 0 \? copy\.capabilityPreflightProviderSummaryEmpty : undefined|isHealthy \? copy\.capabilityPreflightProviderSummaryHealthy : undefined|diagnosticLinkCopied \? copy\.capabilityPreflightDiagnosticLinkCopied : copy\.capabilityPreflightCopyDiagnosticLink|className=\{`rounded-lg border px-3 py-2 text-left transition \$\{[^}]*selectedConfigKey === item\.key|className=\{`rounded-lg border px-3 py-2 text-left transition \$\{[^}]*selectedReasonCode === item\.reasonCode|className=\{`rounded-xl border px-4 py-3 \$\{[^}]*item\.status === 'blocked'|className=\{`text-sm font-semibold \$\{[^}]*item\.status === 'blocked'|className=\{`rounded-full px-2 py-0\.5 text-xs \$\{[^}]*item\.status === 'blocked'|className=\{`mt-1 text-sm \$\{[^}]*item\.status === 'blocked'/,
  'admin capability preflight view should not regress list display labels, summary tone/message labels, runbook selection classes, item blocked classes or footer presence to inline ternary, truthy object gates, join OR fallback or implicit negation',
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
  preflightCard,
  /import \{ useAdminDiagnosticLinkCopy \} from '\.\/use-admin-diagnostic-link-copy';[\s\S]*diagnosticLinkCopyError: providerPreflightDiagnosticLinkCopyError,[\s\S]*\} = useAdminDiagnosticLinkCopy\(\);[\s\S]*diagnosticLinkCopyError=\{providerPreflightDiagnosticLinkCopyError \|\| diagnosticUrlSyncError\}/,
  'admin capability preflight card should pass shared diagnostic link copy failures into the filters view',
);
assert.match(
  preflightView,
  /diagnosticLinkCopyError: string;[\s\S]*diagnosticLinkCopyError,[\s\S]*const shouldRenderDiagnosticLinkCopyError = shouldRenderCapabilityPreflightDiagnosticLinkCopyError\(diagnosticLinkCopyError\);[\s\S]*shouldRenderDiagnosticLinkCopyError === true && \([\s\S]*<span role="status"[\s\S]*\{diagnosticLinkCopyError\}/,
  'admin capability preflight filters should render user-visible diagnostic link copy failures',
);

function createPreflightItem(
  provider: string,
  status: CapabilityProviderPreflightStatus,
  severity: CapabilityProviderPreflightSeverity,
): CapabilityProviderPreflightItem {
  return {
    provider,
    runner_mode: `${provider}-http`,
    status,
    severity,
    reason_code: `${provider}_${status}`,
    source_note: `${provider} source note`,
    next_action: `${provider} next action`,
    metadata: {
      config_keys: [`CAPABILITY_${provider.toUpperCase()}_RUNNER_MODE`, 'CAPABILITY_SHARED_KEY'],
    },
  };
}

const unsortedItems = [
  createPreflightItem('skill', 'ready', 'info'),
  createPreflightItem('mcp', 'blocked', 'critical'),
  createPreflightItem('alpha', 'skipped', 'warning'),
  createPreflightItem('beta', 'blocked', 'critical'),
];

const sortedItems = sortCapabilityPreflightItems(unsortedItems);
assert.deepEqual(
  sortedItems.map((item) => item.provider),
  ['beta', 'mcp', 'alpha', 'skill'],
  'preflight items should sort by severity rank, then provider name',
);
assert.deepEqual(
  unsortedItems.map((item) => item.provider),
  ['skill', 'mcp', 'alpha', 'beta'],
  'sorting should not mutate the original startup snapshot items',
);

const criticalBlockedItems = filterCapabilityPreflightItems(unsortedItems, 'blocked', 'critical');
assert.deepEqual(
  criticalBlockedItems.map((item) => item.provider),
  ['beta', 'mcp'],
  'combined status/severity filters should return sorted matching items only',
);

const warningItems = filterCapabilityPreflightItems(unsortedItems, 'all', 'warning');
assert.deepEqual(
  warningItems.map((item) => item.provider),
  ['alpha'],
  'severity-only filter should keep warning items',
);

const sharedConfigKeyItems = filterCapabilityPreflightItems(unsortedItems, 'all', 'all', 'CAPABILITY_SHARED_KEY');
assert.deepEqual(
  sharedConfigKeyItems.map((item) => item.provider),
  ['beta', 'mcp', 'alpha', 'skill'],
  'config-key filter should keep sorted items that reference the selected config key',
);

const skillConfigKeyItems = filterCapabilityPreflightItems(unsortedItems, 'ready', 'info', 'CAPABILITY_SKILL_RUNNER_MODE');
assert.deepEqual(
  skillConfigKeyItems.map((item) => item.provider),
  ['skill'],
  'config-key filter should compose with status and severity filters',
);

const missingConfigKeyItems = filterCapabilityPreflightItems(unsortedItems, 'all', 'all', 'CAPABILITY_UNKNOWN_KEY');
assert.deepEqual(
  missingConfigKeyItems,
  [],
  'unknown config-key filter should return no preflight items',
);

const mcpReasonCodeItems = filterCapabilityPreflightItems(unsortedItems, 'all', 'all', 'all', 'mcp_blocked');
assert.deepEqual(
  mcpReasonCodeItems.map((item) => item.provider),
  ['mcp'],
  'reason-code filter should keep sorted items that match the selected reason code',
);

const betaReasonCodeItems = filterCapabilityPreflightItems(unsortedItems, 'blocked', 'critical', 'CAPABILITY_SHARED_KEY', 'beta_blocked');
assert.deepEqual(
  betaReasonCodeItems.map((item) => item.provider),
  ['beta'],
  'reason-code filter should compose with status, severity and config-key filters',
);

assert.deepEqual(
  deriveCapabilityPreflightActiveFilterSummary(unsortedItems, betaReasonCodeItems, {
    statusFilter: 'blocked',
    severityFilter: 'critical',
    configKeyFilter: 'CAPABILITY_SHARED_KEY',
    reasonCodeFilter: 'beta_blocked',
  }),
  {
    activeFilterCount: 4,
    matchedItemCount: 1,
    totalItemCount: 4,
    activeLabels: [
      'status=blocked',
      'severity=critical',
      'config_key=CAPABILITY_SHARED_KEY',
      'reason_code=beta_blocked',
    ],
    activeFilters: [
      { kind: 'statusFilter', value: 'blocked' },
      { kind: 'severityFilter', value: 'critical' },
      { kind: 'configKeyFilter', value: 'CAPABILITY_SHARED_KEY' },
      { kind: 'reasonCodeFilter', value: 'beta_blocked' },
    ],
  },
  'active filter summary should expose active filter count and matched item scope',
);
assert.deepEqual(
  deriveCapabilityPreflightActiveFilterSummary(unsortedItems, unsortedItems, {
    statusFilter: 'all',
    severityFilter: 'all',
    configKeyFilter: 'all',
    reasonCodeFilter: 'all',
  }),
  {
    activeFilterCount: 0,
    matchedItemCount: 4,
    totalItemCount: 4,
    activeLabels: [],
    activeFilters: [],
  },
  'active filter summary should be empty when all filters are cleared',
);

const summary = deriveCapabilityPreflightPrioritySummary(unsortedItems);
assert.equal(summary.criticalCount, 2);
assert.equal(summary.warningCount, 1);
assert.equal(summary.infoCount, 1);
assert.equal(summary.primaryItem?.provider, 'beta', 'primary issue should prefer the first sorted critical item');

const healthySummary = deriveCapabilityPreflightPrioritySummary([
  createPreflightItem('skill', 'ready', 'info'),
  createPreflightItem('mcp', 'ready', 'info'),
]);
assert.equal(healthySummary.primaryItem, null, 'ready-only snapshots should not produce a primary issue');
assert.equal(healthySummary.infoCount, 2);

const providerSummary = deriveCapabilityPreflightProviderSummary([
  createPreflightItem('skill', 'ready', 'info'),
  {
    ...createPreflightItem('mcp', 'blocked', 'warning'),
    runner_mode: 'mcp-http',
    reason_code: 'mcp_endpoint_missing',
    next_action: 'configure mcp endpoint',
    metadata: {
      config_keys: ['CAPABILITY_MCP_RUNNER_ENDPOINT', 'CAPABILITY_SHARED_KEY'],
    },
  },
  {
    ...createPreflightItem('mcp', 'skipped', 'critical'),
    runner_mode: 'mcp-stdio',
    reason_code: 'mcp_stdio_disabled',
    next_action: 'confirm mcp stdio policy',
    metadata: {
      config_keys: ['CAPABILITY_MCP_RUNNER_MODE', 'CAPABILITY_SHARED_KEY', 'CAPABILITY_SHARED_KEY'],
    },
  },
  createPreflightItem('alpha', 'skipped', 'warning'),
]);
assert.deepEqual(
  providerSummary.items.map((item) => item.provider),
  ['mcp', 'alpha', 'skill'],
  'provider summary should sort providers by highest severity, then provider name',
);
assert.equal(providerSummary.providerCount, 3);
assert.equal(providerSummary.blockedProviderCount, 1);
assert.equal(providerSummary.readyProviderCount, 1);
assert.equal(providerSummary.skippedProviderCount, 1);
assert.deepEqual(
  providerSummary.items.find((item) => item.provider === 'mcp'),
  {
    provider: 'mcp',
    itemCount: 2,
    highestSeverity: 'critical',
    status: 'blocked',
    runnerModes: ['mcp-http', 'mcp-stdio'],
    reasonCodes: ['mcp_endpoint_missing', 'mcp_stdio_disabled'],
    configKeys: ['CAPABILITY_MCP_RUNNER_ENDPOINT', 'CAPABILITY_MCP_RUNNER_MODE', 'CAPABILITY_SHARED_KEY'],
    nextActions: ['configure mcp endpoint', 'confirm mcp stdio policy'],
  },
  'provider summary should aggregate runner modes, reason codes, config keys and next actions per provider',
);
assert.deepEqual(
  deriveCapabilityPreflightProviderSummary([
    createPreflightItem('skill', 'ready', 'info'),
    createPreflightItem('mcp', 'ready', 'info'),
  ]),
  {
    items: [
      {
        provider: 'mcp',
        itemCount: 1,
        highestSeverity: 'info',
        status: 'ready',
        runnerModes: ['mcp-http'],
        reasonCodes: ['mcp_ready'],
        configKeys: ['CAPABILITY_MCP_RUNNER_MODE', 'CAPABILITY_SHARED_KEY'],
        nextActions: ['mcp next action'],
      },
      {
        provider: 'skill',
        itemCount: 1,
        highestSeverity: 'info',
        status: 'ready',
        runnerModes: ['skill-http'],
        reasonCodes: ['skill_ready'],
        configKeys: ['CAPABILITY_SHARED_KEY', 'CAPABILITY_SKILL_RUNNER_MODE'],
        nextActions: ['skill next action'],
      },
    ],
    providerCount: 2,
    blockedProviderCount: 0,
    readyProviderCount: 2,
    skippedProviderCount: 0,
  },
  'provider summary should expose a ready-only healthy aggregate',
);

const configKeySummary = deriveCapabilityPreflightConfigKeySummary([
  createPreflightItem('skill', 'blocked', 'critical'),
  {
    ...createPreflightItem('mcp', 'blocked', 'critical'),
    reason_code: 'mcp_endpoint_missing',
    metadata: {
      config_keys: ['CAPABILITY_MCP_RUNNER_ENDPOINT', 'CAPABILITY_SHARED_KEY', 'CAPABILITY_SHARED_KEY'],
    },
  },
  {
    ...createPreflightItem('noop', 'ready', 'info'),
    metadata: {},
  },
]);
assert.deepEqual(
  configKeySummary.items.map((item) => item.key),
  [
    'CAPABILITY_MCP_RUNNER_ENDPOINT',
    'CAPABILITY_SHARED_KEY',
    'CAPABILITY_SKILL_RUNNER_MODE',
  ],
  'config key summary should collect and sort unique config keys',
);
assert.equal(configKeySummary.affectedKeyCount, 3);
assert.deepEqual(
  configKeySummary.items.find((item) => item.key === 'CAPABILITY_SHARED_KEY')?.providers,
  ['mcp', 'skill'],
  'shared config keys should aggregate affected providers',
);
assert.deepEqual(
  configKeySummary.items.find((item) => item.key === 'CAPABILITY_SHARED_KEY')?.reasonCodes,
  ['mcp_endpoint_missing', 'skill_blocked'],
  'shared config keys should aggregate reason codes',
);

const sharedConfigKeyFocusSummary = deriveCapabilityPreflightFocusedConfigKeySummary(
  configKeySummary,
  'CAPABILITY_SHARED_KEY',
  filterCapabilityPreflightItems(unsortedItems, 'all', 'all', 'CAPABILITY_SHARED_KEY'),
);
assert.deepEqual(
  sharedConfigKeyFocusSummary,
  {
    key: 'CAPABILITY_SHARED_KEY',
    providerCount: 2,
    reasonCodeCount: 2,
    matchedItemCount: 4,
    providers: ['mcp', 'skill'],
    reasonCodes: ['mcp_endpoint_missing', 'skill_blocked'],
  },
  'focused config key summary should expose provider, reason and matched item counts',
);
assert.equal(
  deriveCapabilityPreflightFocusedConfigKeySummary(configKeySummary, 'all', unsortedItems),
  null,
  'focused config key summary should be null when no config key is selected',
);
assert.deepEqual(
  deriveCapabilityPreflightFocusedConfigKeySummary(configKeySummary, 'CAPABILITY_UNKNOWN_KEY', []),
  {
    key: 'CAPABILITY_UNKNOWN_KEY',
    providerCount: 0,
    reasonCodeCount: 0,
    matchedItemCount: 0,
    providers: [],
    reasonCodes: [],
  },
  'focused config key summary should handle unknown keys without inventing providers or reasons',
);

const reasonCodeSummary = deriveCapabilityPreflightReasonCodeSummary([
  createPreflightItem('skill', 'blocked', 'critical'),
  {
    ...createPreflightItem('mcp', 'blocked', 'critical'),
    reason_code: 'shared_blocked',
    next_action: 'check shared capability config',
    metadata: {
      config_keys: ['CAPABILITY_MCP_RUNNER_ENDPOINT', 'CAPABILITY_SHARED_KEY', 'CAPABILITY_SHARED_KEY'],
    },
  },
  {
    ...createPreflightItem('alpha', 'blocked', 'critical'),
    reason_code: 'shared_blocked',
    next_action: 'check shared capability config',
    metadata: {
      config_keys: ['CAPABILITY_ALPHA_RUNNER_MODE', 'CAPABILITY_SHARED_KEY'],
    },
  },
]);
assert.deepEqual(
  reasonCodeSummary.items.map((item) => item.reasonCode),
  ['shared_blocked', 'skill_blocked'],
  'reason-code runbook should collect and sort unique reason codes',
);
assert.equal(reasonCodeSummary.affectedReasonCodeCount, 2);
assert.deepEqual(
  reasonCodeSummary.items.find((item) => item.reasonCode === 'shared_blocked')?.providers,
  ['alpha', 'mcp'],
  'reason-code runbook should aggregate affected providers',
);
assert.deepEqual(
  reasonCodeSummary.items.find((item) => item.reasonCode === 'shared_blocked')?.configKeys,
  ['CAPABILITY_ALPHA_RUNNER_MODE', 'CAPABILITY_MCP_RUNNER_ENDPOINT', 'CAPABILITY_SHARED_KEY'],
  'reason-code runbook should aggregate unique config keys to check',
);
assert.deepEqual(
  reasonCodeSummary.items.find((item) => item.reasonCode === 'shared_blocked')?.nextActions,
  ['check shared capability config'],
  'reason-code runbook should deduplicate next actions',
);

const focusedReasonCodeSummary = deriveCapabilityPreflightFocusedReasonCodeSummary(
  reasonCodeSummary,
  'shared_blocked',
  filterCapabilityPreflightItems(unsortedItems, 'all', 'all', 'all', 'mcp_blocked'),
);
assert.deepEqual(
  focusedReasonCodeSummary,
  {
    reasonCode: 'shared_blocked',
    providerCount: 2,
    configKeyCount: 3,
    matchedItemCount: 1,
    providers: ['alpha', 'mcp'],
    configKeys: ['CAPABILITY_ALPHA_RUNNER_MODE', 'CAPABILITY_MCP_RUNNER_ENDPOINT', 'CAPABILITY_SHARED_KEY'],
  },
  'focused reason-code summary should expose provider, config key and matched item counts',
);
assert.equal(
  deriveCapabilityPreflightFocusedReasonCodeSummary(reasonCodeSummary, 'all', unsortedItems),
  null,
  'focused reason-code summary should be null when no reason code is selected',
);
assert.deepEqual(
  deriveCapabilityPreflightFocusedReasonCodeSummary(reasonCodeSummary, 'unknown_reason', []),
  {
    reasonCode: 'unknown_reason',
    providerCount: 0,
    configKeyCount: 0,
    matchedItemCount: 0,
    providers: [],
    configKeys: [],
  },
  'focused reason-code summary should handle unknown reason codes without inventing providers or config keys',
);

assert.equal(
  normalizeCapabilityPreflightConfigKeyFilter(' CAPABILITY_SHARED_KEY '),
  'CAPABILITY_SHARED_KEY',
  'config key query filter should trim shared links before applying them',
);
assert.equal(
  normalizeCapabilityPreflightConfigKeyFilter(''),
  'all',
  'empty config key query filter should reset to all',
);
assert.equal(
  normalizeCapabilityPreflightConfigKeyFilter('all'),
  'all',
  'all config key query filter should reset to all',
);
assert.equal(
  updateCapabilityPreflightConfigKeySearch('?tab=dashboard', 'CAPABILITY_SHARED_KEY'),
  '?tab=dashboard&config_key=CAPABILITY_SHARED_KEY',
  'config key query sync should preserve existing query params',
);
assert.equal(
  updateCapabilityPreflightConfigKeySearch('?tab=dashboard&config_key=OLD_KEY', 'CAPABILITY_SHARED_KEY'),
  '?tab=dashboard&config_key=CAPABILITY_SHARED_KEY',
  'config key query sync should replace existing config_key',
);
assert.equal(
  updateCapabilityPreflightConfigKeySearch('?tab=dashboard&config_key=OLD_KEY', 'all'),
  '?tab=dashboard',
  'config key query sync should remove config_key when filter is cleared',
);
assert.equal(
  normalizeCapabilityPreflightStatusFilter(' blocked '),
  'blocked',
  'status query filter should trim valid values before applying them',
);
assert.equal(
  normalizeCapabilityPreflightStatusFilter('unknown'),
  'all',
  'unknown status query filter should reset to all',
);
assert.equal(
  normalizeCapabilityPreflightSeverityFilter(' critical '),
  'critical',
  'severity query filter should trim valid values before applying them',
);
assert.equal(
  normalizeCapabilityPreflightSeverityFilter('unknown'),
  'all',
  'unknown severity query filter should reset to all',
);
assert.equal(
  updateCapabilityPreflightStatusSearch('?tab=dashboard&severity=warning', 'blocked'),
  '?tab=dashboard&severity=warning&status=blocked',
  'status query sync should preserve existing query params',
);
assert.equal(
  updateCapabilityPreflightStatusSearch('?tab=dashboard&status=ready', 'all'),
  '?tab=dashboard',
  'status query sync should remove status when filter is cleared',
);
assert.equal(
  updateCapabilityPreflightSeveritySearch('?tab=dashboard&status=blocked', 'critical'),
  '?tab=dashboard&status=blocked&severity=critical',
  'severity query sync should preserve existing query params',
);
assert.equal(
  updateCapabilityPreflightSeveritySearch('?tab=dashboard&severity=warning', 'all'),
  '?tab=dashboard',
  'severity query sync should remove severity when filter is cleared',
);
assert.equal(
  normalizeCapabilityPreflightReasonCodeFilter(' mcp_endpoint_missing '),
  'mcp_endpoint_missing',
  'reason code query filter should trim shared links before applying them',
);
assert.equal(
  normalizeCapabilityPreflightReasonCodeFilter(''),
  'all',
  'empty reason code query filter should reset to all',
);
assert.equal(
  updateCapabilityPreflightReasonCodeSearch('?tab=dashboard&config_key=CAPABILITY_SHARED_KEY', 'mcp_endpoint_missing'),
  '?tab=dashboard&config_key=CAPABILITY_SHARED_KEY&reason_code=mcp_endpoint_missing',
  'reason code query sync should preserve existing query params',
);
assert.equal(
  updateCapabilityPreflightReasonCodeSearch('?tab=dashboard&reason_code=OLD_REASON', 'mcp_endpoint_missing'),
  '?tab=dashboard&reason_code=mcp_endpoint_missing',
  'reason code query sync should replace existing reason_code',
);
assert.equal(
  updateCapabilityPreflightReasonCodeSearch('?tab=dashboard&reason_code=OLD_REASON', 'all'),
  '?tab=dashboard',
  'reason code query sync should remove reason_code when filter is cleared',
);
assert.equal(
  clearCapabilityPreflightFilterSearch('?tab=dashboard&status=blocked&severity=critical&config_key=CAPABILITY_SHARED_KEY&reason_code=mcp_endpoint_missing&view=ops'),
  '?tab=dashboard&view=ops',
  'clear filter search should remove all provider preflight filters while preserving unrelated query params',
);

assert.deepEqual(
  deriveCapabilityPreflightSnapshotFreshness(
    '2026-07-14T10:00:00Z',
    new Date('2026-07-14T10:45:00Z'),
  ),
  {
    generatedAtLabel: '2026-07-14T10:00:00Z',
    ageLabel: '45m',
    timestampState: 'available',
  },
  'snapshot freshness should expose generated_at and compact age for valid startup snapshots',
);
assert.deepEqual(
  deriveCapabilityPreflightSnapshotFreshness(
    '2026-07-14T08:00:00Z',
    new Date('2026-07-14T10:45:00Z'),
  ),
  {
    generatedAtLabel: '2026-07-14T08:00:00Z',
    ageLabel: '2h',
    timestampState: 'available',
  },
  'snapshot freshness should compact hour-level ages',
);
assert.deepEqual(
  deriveCapabilityPreflightSnapshotFreshness('', new Date('2026-07-14T10:45:00Z')),
  {
    generatedAtLabel: '-',
    ageLabel: '-',
    timestampState: 'missing',
  },
  'snapshot freshness should handle missing generated_at without inventing a timestamp',
);
assert.deepEqual(
  deriveCapabilityPreflightSnapshotFreshness('not-a-time', new Date('2026-07-14T10:45:00Z')),
  {
    generatedAtLabel: 'not-a-time',
    ageLabel: '-',
    timestampState: 'invalid',
  },
  'snapshot freshness should keep invalid generated_at visible for diagnosis',
);

console.log('[YES] Admin capability preflight model validation passed.');
