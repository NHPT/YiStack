import { strict as assert } from 'node:assert';
import fs from 'node:fs';

import type { AdminLLMProvidersResponse, LLMProvider } from '../src/lib/admin/api';
import {
  clearAdminProviderHealthFilterSearch,
  deriveAdminProviderHealthActiveFilterSummary,
  deriveAdminProviderHealthDiagnosticsSummary,
  normalizeAdminProviderHealthRuntimeFilter,
  normalizeAdminProviderHealthSeverityFilter,
  updateAdminProviderHealthRuntimeSearch,
  updateAdminProviderHealthSeveritySearch,
} from '../src/app/admin/admin-provider-health-diagnostics-model';

const providerHealthCard = fs.readFileSync('src/app/admin/admin-provider-health-diagnostics-card.tsx', 'utf8');
const providerHealthModel = fs.readFileSync('src/app/admin/admin-provider-health-diagnostics-model.ts', 'utf8');
const adminDiagnosticLinkCopyHook = fs.readFileSync('src/app/admin/use-admin-diagnostic-link-copy.ts', 'utf8');
const adminPage = fs.readFileSync('src/app/admin/page.tsx', 'utf8');
assert.match(
  providerHealthModel,
  /export type AdminProviderHealthActiveFilterLabel = string;[\s\S]*export type AdminProviderHealthActiveFilterLabelList = AdminProviderHealthActiveFilterLabel\[\];[\s\S]*activeLabels: AdminProviderHealthActiveFilterLabelList;[\s\S]*const activeLabels: AdminProviderHealthActiveFilterLabelList = \[\];[\s\S]*const hasSeverityFilter = filters\.severityFilter !== 'all';[\s\S]*const hasRuntimeFilter = filters\.runtimeFilter !== 'all';[\s\S]*if \(hasSeverityFilter === true\)[\s\S]*activeLabels\.push\(`\$\{ADMIN_PROVIDER_HEALTH_SEVERITY_QUERY_PARAM\}=\$\{filters\.severityFilter\}`\);[\s\S]*if \(hasRuntimeFilter === true\)[\s\S]*activeLabels\.push\(`\$\{ADMIN_PROVIDER_HEALTH_RUNTIME_QUERY_PARAM\}=\$\{filters\.runtimeFilter\}`\);/,
  'admin provider health diagnostics should name active filter label contracts and derive URL labels through explicit active filter facts',
);
assert.doesNotMatch(
  providerHealthModel,
  /activeLabels: string\[\];|const activeLabels: string\[\]|const activeLabels: AdminProviderHealthActiveFilterLabelList = \[[\s\S]*\]\.filter\(Boolean\)/,
  'admin provider health diagnostics should not keep active filter labels as an anonymous string array contract or filter(Boolean) list',
);
assert.match(
  providerHealthModel,
  /const hasProviderModelList = Array\.isArray\(provider\.models\) === true && provider\.models\.length > 0;[\s\S]*const hasLegacyModel = readString\(provider\.model\)\.length > 0;[\s\S]*const isProviderEnabled = provider\.enabled === true;[\s\S]*const hasProviderRequiredConfig = hasRequiredConfig\(provider\);[\s\S]*const isRuntimeLoaded = provider\.runtime_loaded === true;[\s\S]*const isRuntimeActive = provider\.runtime_active === true;[\s\S]*const hasDefaultRuntimeDrift = provider\.is_default === true && isRuntimeActive === false;[\s\S]*if \(isProviderEnabled === false\)[\s\S]*if \(hasProviderRequiredConfig === false\)[\s\S]*if \(isRuntimeLoaded === false \|\| hasDefaultRuntimeDrift === true\)[\s\S]*isRuntimeLoaded,[\s\S]*isRuntimeActive,[\s\S]*return provider\.isRuntimeLoaded === true;[\s\S]*return provider\.isRuntimeLoaded === false;[\s\S]*return provider\.isRuntimeActive === true;[\s\S]*return provider\.isRuntimeActive === false;[\s\S]*function listAdminProviderHealthProviderSummaries\([\s\S]*for \(const provider of providers\)[\s\S]*providerSummaries\.push\(toProviderSummary\(provider\)\);[\s\S]*function resolveAdminProviderHealthActiveProvider\([\s\S]*for \(const provider of providers\)[\s\S]*provider\.isRuntimeActive === true[\s\S]*function resolveAdminProviderHealthDefaultProvider\([\s\S]*for \(const provider of providers\)[\s\S]*provider\.isDefault === true[\s\S]*function countAdminProviderHealthEnabledProviders\([\s\S]*for \(const provider of providers\)[\s\S]*provider\.isEnabled === true[\s\S]*function countAdminProviderHealthLoadedProviders\([\s\S]*for \(const provider of providers\)[\s\S]*provider\.isRuntimeLoaded === true[\s\S]*function countAdminProviderHealthRuntimeDriftProviders\([\s\S]*hasAdminProviderHealthRuntimeDrift\(provider\) === true[\s\S]*enabledProviderCount: countAdminProviderHealthEnabledProviders\(allProviderSummaries\),[\s\S]*loadedProviderCount: countAdminProviderHealthLoadedProviders\(allProviderSummaries\),/,
  'admin provider health diagnostics should derive provider runtime readiness, filters and counts through explicit runtime facts',
);
assert.match(
  providerHealthModel,
  /function getAdminProviderHealthDisplayLabel\(value\?: string\): string[\s\S]*const normalizedValue = readString\(value\);[\s\S]*const hasNormalizedValue = normalizedValue\.length > 0;[\s\S]*return hasNormalizedValue === true \? normalizedValue : '-';[\s\S]*model: getAdminProviderHealthDisplayLabel\(provider\.model\),[\s\S]*baseUrl: getAdminProviderHealthDisplayLabel\(provider\.base_url\),/,
  'admin provider health diagnostics should derive provider model and base URL display labels through explicit display facts',
);
assert.doesNotMatch(
  providerHealthModel,
  /Boolean\(provider\.runtime_loaded\)|Boolean\(provider\.runtime_active\)|!provider\.enabled|!hasRequiredConfig\(provider\)|!provider\.runtime_loaded|provider\.is_default && !provider\.runtime_active|return !provider\.isRuntime(?:Loaded|Active)|provider\.isEnabled && \(!provider\.isRuntimeLoaded|\(provider\) => provider\.isRuntimeActive\)|\(provider\) => provider\.isDefault\)|\(provider\) => provider\.isEnabled\)|\(provider\) => provider\.isRuntimeLoaded\)|readString\(provider\.(model|base_url)\) \|\| '-'|providers\.(?:map|filter|find|slice)\(|providerSummaries\.(?:map|filter|find|slice)\(|allProviderSummaries\.(?:map|filter|find|slice)\(/,
  'admin provider health diagnostics should not regress runtime readiness to Boolean coercion, implicit negation or bare boolean predicates',
);
assert.match(
  providerHealthCard,
  /function getAdminProviderHealthActiveFilterLabelSuffix\(summary: AdminProviderHealthActiveFilterSummary\): string \{[\s\S]*const hasActiveLabels = summary\.activeLabels\.length > 0;[\s\S]*return hasActiveLabels === true \? ` \/ \$\{summary\.activeLabels\.join\(' \/ '\)\}` : '';[\s\S]*const activeFilterLabelSuffix = getAdminProviderHealthActiveFilterLabelSuffix\(activeFilterSummary\);[\s\S]*\{activeFilterLabelSuffix\}/,
  'admin provider health card should render active URL filter labels through a named suffix fact',
);
assert.match(
  providerHealthCard,
  /type AdminProviderHealthProviderSummary,[\s\S]*function getAdminProviderHealthDriftBadgeTone\(summary: AdminProviderHealthDiagnosticsSummary\): AdminDiagnosticTone \{[\s\S]*const hasDrift = summary\.driftCount > 0;[\s\S]*if \(hasDrift === true\)[\s\S]*return 'warning';[\s\S]*return 'neutral';[\s\S]*function getAdminProviderHealthBlockedBadgeTone\(summary: AdminProviderHealthDiagnosticsSummary\): AdminDiagnosticTone \{[\s\S]*const hasBlockedProviders = summary\.blockedCount > 0;[\s\S]*if \(hasBlockedProviders === true\)[\s\S]*return 'critical';[\s\S]*return 'neutral';[\s\S]*function getAdminProviderHealthEmptyMessage\(summary: AdminProviderHealthDiagnosticsSummary, copy: AdminCopy\): string \| undefined \{[\s\S]*const hasProviders = summary\.totalProviderCount > 0;[\s\S]*if \(hasProviders === true\)[\s\S]*return undefined;[\s\S]*return copy\.providerHealthEmpty;[\s\S]*function getAdminProviderHealthHealthyMessage\(summary: AdminProviderHealthDiagnosticsSummary\): string \| undefined \{[\s\S]*const hasHealthyMessage = summary\.healthyMessage\.length > 0;[\s\S]*if \(hasHealthyMessage === false\)[\s\S]*return undefined;[\s\S]*return summary\.healthyMessage;[\s\S]*function getAdminProviderHealthFilterOptionLabel\(option: string, copy: AdminCopy\): string \{[\s\S]*const isAllOption = option === 'all';[\s\S]*if \(isAllOption === true\)[\s\S]*return copy\.providerHealthAll;[\s\S]*return option;[\s\S]*function getAdminProviderHealthDiagnosticLinkCopyActionLabel\(isCopied: boolean, copy: AdminCopy\): string \{[\s\S]*if \(isCopied === true\)[\s\S]*return copy\.providerHealthDiagnosticLinkCopied;[\s\S]*return copy\.providerHealthCopyDiagnosticLink;[\s\S]*function getAdminProviderHealthPriorityIdentityLabel\([\s\S]*provider: AdminProviderHealthProviderSummary,[\s\S]*copy: AdminCopy,[\s\S]*\): string \{[\s\S]*if \(provider\.isDefault === true\)[\s\S]*return copy\.providerHealthDefaultBadge;[\s\S]*return provider\.name;[\s\S]*function getAdminProviderHealthPriorityRuntimeLabel\([\s\S]*provider: AdminProviderHealthProviderSummary,[\s\S]*copy: AdminCopy,[\s\S]*\): string \{[\s\S]*if \(provider\.isRuntimeLoaded === true\)[\s\S]*return copy\.providerHealthLoaded;[\s\S]*return copy\.providerHealthNotLoaded;[\s\S]*function materializeAdminProviderHealthFilterOptionNodes\([\s\S]*options: readonly string\[\],[\s\S]*copy: AdminCopy,[\s\S]*\): ReactNode\[\] \{[\s\S]*for \(const option of options\)[\s\S]*getAdminProviderHealthFilterOptionLabel\(option, copy\)[\s\S]*function materializeAdminProviderHealthPriorityProviderNodes\([\s\S]*providers: readonly AdminProviderHealthProviderSummary\[\],[\s\S]*copy: AdminCopy,[\s\S]*\): ReactNode\[\] \{[\s\S]*for \(const provider of providers\)[\s\S]*const providerIdentityLabel = getAdminProviderHealthPriorityIdentityLabel\(provider, copy\);[\s\S]*const providerRuntimeLabel = getAdminProviderHealthPriorityRuntimeLabel\(provider, copy\);[\s\S]*const driftBadgeTone = getAdminProviderHealthDriftBadgeTone\(summary\);[\s\S]*const blockedBadgeTone = getAdminProviderHealthBlockedBadgeTone\(summary\);[\s\S]*const emptyMessage = getAdminProviderHealthEmptyMessage\(summary, copy\);[\s\S]*const healthyMessage = getAdminProviderHealthHealthyMessage\(summary\);[\s\S]*const diagnosticLinkCopyActionLabel = getAdminProviderHealthDiagnosticLinkCopyActionLabel\(diagnosticLinkCopied, copy\);[\s\S]*tone: driftBadgeTone[\s\S]*tone: blockedBadgeTone[\s\S]*emptyMessage=\{emptyMessage\}[\s\S]*healthyMessage=\{healthyMessage\}[\s\S]*materializeAdminProviderHealthFilterOptionNodes\(providerHealthSeverityOptions, copy\)[\s\S]*materializeAdminProviderHealthFilterOptionNodes\(providerHealthRuntimeOptions, copy\)[\s\S]*\{diagnosticLinkCopyActionLabel\}[\s\S]*materializeAdminProviderHealthPriorityProviderNodes\(summary\.priorityProviders, copy\)/,
  'admin provider health card should derive badge tones, messages, option labels, copy labels and priority provider labels through named display facts',
);
assert.match(
  providerHealthCard,
  /type AdminProviderHealthActiveFilterSummary,[\s\S]*type AdminProviderHealthDiagnosticsSummary,[\s\S]*function shouldRenderAdminProviderHealthFilteredEmpty\([\s\S]*summary: AdminProviderHealthDiagnosticsSummary,[\s\S]*activeFilterSummary: AdminProviderHealthActiveFilterSummary,[\s\S]*const hasMatchedProviders = summary\.providerSummaries\.length > 0;[\s\S]*const hasActiveFilters = activeFilterSummary\.activeFilterCount > 0;[\s\S]*return hasMatchedProviders === false && hasActiveFilters === true;[\s\S]*function shouldRenderAdminProviderHealthPriorityProviders\(summary: AdminProviderHealthDiagnosticsSummary\): boolean \{[\s\S]*const priorityProviderCount = summary\.priorityProviders\.length;[\s\S]*return priorityProviderCount > 0;[\s\S]*function shouldRenderAdminProviderHealthDiagnosticsContent\(summary: AdminProviderHealthDiagnosticsSummary\): boolean \{[\s\S]*const totalProviderCount = summary\.totalProviderCount;[\s\S]*return totalProviderCount > 0;[\s\S]*const shouldRenderFilteredEmpty = shouldRenderAdminProviderHealthFilteredEmpty\(summary, activeFilterSummary\);[\s\S]*const activeFilterLabelSuffix = getAdminProviderHealthActiveFilterLabelSuffix\(activeFilterSummary\);[\s\S]*const shouldRenderPriorityProviders = shouldRenderAdminProviderHealthPriorityProviders\(summary\);[\s\S]*const shouldRenderDiagnosticsContent = shouldRenderAdminProviderHealthDiagnosticsContent\(summary\);[\s\S]*\{shouldRenderDiagnosticsContent === true && \([\s\S]*\{shouldRenderPriorityProviders === true && \([\s\S]*\{shouldRenderFilteredEmpty === true && \(/,
  'admin provider health card should render diagnostics content, filtered-empty state, active label suffix and priority providers through named explicit facts',
);
assert.doesNotMatch(
  providerHealthCard,
  /summary\.providerSummaries\.length === 0 && activeFilterSummary\.activeFilterCount > 0 \?|activeFilterSummary\.activeLabels\.length > 0 \?|summary\.priorityProviders\.length > 0 \?|summary\.totalProviderCount > 0 \?|summary\.driftCount > 0 \? 'warning' : 'neutral'|summary\.blockedCount > 0 \? 'critical' : 'neutral'|summary\.totalProviderCount === 0 \? copy\.providerHealthEmpty : undefined|summary\.healthyMessage \|\| undefined|option === 'all' \? copy\.providerHealthAll : option|diagnosticLinkCopied \? copy\.providerHealthDiagnosticLinkCopied : copy\.providerHealthCopyDiagnosticLink|provider\.isDefault \? copy\.providerHealthDefaultBadge : provider\.name|provider\.isRuntimeLoaded \? copy\.providerHealthLoaded : copy\.providerHealthNotLoaded|shouldRenderPriorityProviders === true \? \(|providerHealth(?:Severity|Runtime)Options\.map\(|summary\.priorityProviders\.map\(/,
  'admin provider health card should not regress diagnostics content, filtered-empty rendering, active label suffix, badge tones, messages, action labels or priority provider labels to inline ternary gates',
);
assert.match(
  adminPage,
  /AdminProviderHealthDiagnosticsCard/,
  'admin page should keep Admin Provider Health diagnostics card mounted',
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
  providerHealthCard,
  /import \{ useAdminDiagnosticLinkCopy \} from '\.\/use-admin-diagnostic-link-copy';[\s\S]*const \{ diagnosticLinkCopied, diagnosticLinkCopyError, copyCurrentDiagnosticLink \} = useAdminDiagnosticLinkCopy\(\);/,
  'admin provider health diagnostics should use the shared diagnostic link copy hook',
);
assert.match(
  providerHealthCard,
  /function shouldRenderAdminProviderHealthDiagnosticLinkCopyError\(error: string \| null\): boolean \{[\s\S]*const hasError = error !== null && error\.length > 0;[\s\S]*return hasError === true;[\s\S]*function shouldRenderAdminProviderHealthDiagnosticUrlSyncError\(error: string \| null\): boolean \{[\s\S]*const hasError = error !== null && error\.length > 0;[\s\S]*return hasError === true;[\s\S]*const shouldRenderDiagnosticLinkCopyError = shouldRenderAdminProviderHealthDiagnosticLinkCopyError\(diagnosticLinkCopyError\);[\s\S]*const shouldRenderDiagnosticUrlSyncError = shouldRenderAdminProviderHealthDiagnosticUrlSyncError\(diagnosticUrlSyncError\);[\s\S]*\{shouldRenderDiagnosticLinkCopyError === true && \([\s\S]*\{diagnosticLinkCopyError\}[\s\S]*\{shouldRenderDiagnosticUrlSyncError === true && \([\s\S]*\{diagnosticUrlSyncError\}/,
  'admin provider health diagnostics should render user-visible diagnostic link copy and URL sync failures through named explicit gates',
);
assert.doesNotMatch(
  providerHealthCard,
  /diagnosticLinkCopyError \?|diagnosticUrlSyncError \?/,
  'admin provider health diagnostics should not regress diagnostic copy or URL sync errors to inline nullable ternaries',
);

function createProvider(overrides: Partial<LLMProvider> = {}): LLMProvider {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'openai',
    display_name: overrides.display_name ?? 'OpenAI',
    type: overrides.type ?? 'cloud',
    has_api_key: overrides.has_api_key ?? true,
    base_url: overrides.base_url ?? 'https://api.example.com',
    model: overrides.model ?? 'gpt-4',
    enabled: overrides.enabled ?? true,
    is_default: overrides.is_default ?? false,
    priority: overrides.priority ?? 0,
    sort_order: overrides.sort_order ?? 0,
    extra_config: overrides.extra_config ?? '',
    use_count: overrides.use_count ?? 0,
    runtime_loaded: overrides.runtime_loaded ?? true,
    runtime_active: overrides.runtime_active ?? false,
    last_used_at: overrides.last_used_at,
    created_at: overrides.created_at ?? '2026-07-14T10:00:00Z',
    updated_at: overrides.updated_at ?? '2026-07-14T10:00:00Z',
  };
}

function createSnapshot(providers: LLMProvider[], defaultName?: string): AdminLLMProvidersResponse {
  return {
    providers,
    default_name: defaultName,
  };
}

const emptySummary = deriveAdminProviderHealthDiagnosticsSummary(null);
assert.equal(emptySummary.totalProviderCount, 0);
assert.equal(emptySummary.enabledProviderCount, 0);
assert.equal(emptySummary.priorityProviders.length, 0);
assert.equal(emptySummary.healthyMessage, '');

const healthySummary = deriveAdminProviderHealthDiagnosticsSummary(createSnapshot([
  createProvider({
    id: 1,
    name: 'doubao',
    display_name: 'Doubao',
    is_default: true,
    runtime_active: true,
  }),
]));
assert.equal(healthySummary.totalProviderCount, 1);
assert.equal(healthySummary.enabledProviderCount, 1);
assert.equal(healthySummary.loadedProviderCount, 1);
assert.equal(healthySummary.readyCount, 1);
assert.equal(healthySummary.blockedCount, 0);
assert.equal(healthySummary.warningCount, 0);
assert.equal(healthySummary.driftCount, 0);
assert.equal(healthySummary.defaultProviderName, 'Doubao');
assert.equal(healthySummary.activeProviderName, 'Doubao');
assert.equal(healthySummary.healthyMessage, '当前 Provider 配置态与运行态没有明显漂移。');

const mixedSnapshot = createSnapshot([
  createProvider({
    id: 1,
    name: 'ready',
    display_name: 'Ready Provider',
    is_default: false,
    runtime_loaded: true,
  }),
  createProvider({
    id: 2,
    name: 'missing-key',
    display_name: 'Missing Key',
    has_api_key: false,
    runtime_loaded: false,
  }),
  createProvider({
    id: 3,
    name: 'enabled-not-loaded',
    display_name: 'Enabled Not Loaded',
    runtime_loaded: false,
  }),
  createProvider({
    id: 4,
    name: 'default-drift',
    display_name: 'Default Drift',
    is_default: true,
    runtime_loaded: true,
    runtime_active: false,
  }),
  createProvider({
    id: 5,
    name: 'disabled',
    display_name: 'Disabled Provider',
    enabled: false,
    runtime_loaded: false,
  }),
], 'default-drift');

const mixedSummary = deriveAdminProviderHealthDiagnosticsSummary(mixedSnapshot);

assert.equal(mixedSummary.totalProviderCount, 5);
assert.equal(mixedSummary.enabledProviderCount, 4);
assert.equal(mixedSummary.loadedProviderCount, 2);
assert.equal(mixedSummary.readyCount, 1);
assert.equal(mixedSummary.blockedCount, 1);
assert.equal(mixedSummary.warningCount, 2);
assert.equal(mixedSummary.idleCount, 1);
assert.equal(mixedSummary.driftCount, 3);
assert.equal(mixedSummary.priorityProviders.length, 3);
assert.equal(mixedSummary.priorityProviders[0].name, 'missing-key');
assert.equal(mixedSummary.priorityProviders[0].severity, 'blocked');
assert.equal(mixedSummary.priorityProviders[1].name, 'default-drift');
assert.equal(mixedSummary.priorityProviders[1].severity, 'warning');
assert.equal(mixedSummary.priorityProviders[2].name, 'enabled-not-loaded');
assert.equal(mixedSummary.priorityProviders[2].severity, 'warning');
assert.equal(mixedSummary.healthyMessage, '');

const localProviderSummary = deriveAdminProviderHealthDiagnosticsSummary(createSnapshot([
  createProvider({
    id: 6,
    name: 'ollama',
    display_name: 'Ollama',
    type: 'local',
    has_api_key: false,
    runtime_loaded: true,
    runtime_active: true,
    is_default: true,
  }),
]));
assert.equal(localProviderSummary.blockedCount, 0);
assert.equal(localProviderSummary.readyCount, 1);

const fallbackSummary = deriveAdminProviderHealthDiagnosticsSummary(createSnapshot([
  createProvider({
    id: 7,
    name: '',
    display_name: '',
    model: '',
    base_url: '',
    runtime_loaded: false,
  }),
], 'fallback-default'));
assert.equal(fallbackSummary.providerSummaries[0].name, 'provider-7');
assert.equal(fallbackSummary.providerSummaries[0].displayName, 'Provider 7');
assert.equal(fallbackSummary.providerSummaries[0].model, '-');
assert.equal(fallbackSummary.providerSummaries[0].baseUrl, '-');
assert.equal(fallbackSummary.activeProviderName, 'fallback-default');

assert.equal(normalizeAdminProviderHealthSeverityFilter('blocked'), 'blocked');
assert.equal(normalizeAdminProviderHealthSeverityFilter(' invalid '), 'all');
assert.equal(normalizeAdminProviderHealthRuntimeFilter('loaded'), 'loaded');
assert.equal(normalizeAdminProviderHealthRuntimeFilter('invalid'), 'all');

assert.equal(updateAdminProviderHealthSeveritySearch('?foo=bar', 'warning'), '?foo=bar&provider_health=warning');
assert.equal(updateAdminProviderHealthSeveritySearch('?foo=bar&provider_health=warning', 'all'), '?foo=bar');
assert.equal(updateAdminProviderHealthRuntimeSearch('?foo=bar', 'not_loaded'), '?foo=bar&provider_runtime=not_loaded');
assert.equal(updateAdminProviderHealthRuntimeSearch('?foo=bar&provider_runtime=not_loaded', 'all'), '?foo=bar');
assert.equal(
  clearAdminProviderHealthFilterSearch('?foo=bar&provider_health=warning&provider_runtime=not_loaded'),
  '?foo=bar',
);

const warningOnlySummary = deriveAdminProviderHealthDiagnosticsSummary(mixedSnapshot, {
  severityFilter: 'warning',
  runtimeFilter: 'all',
});
assert.equal(warningOnlySummary.providerSummaries.length, 2);
assert.equal(warningOnlySummary.providerSummaries[0].name, 'default-drift');
assert.equal(warningOnlySummary.providerSummaries[1].name, 'enabled-not-loaded');

const notLoadedSummary = deriveAdminProviderHealthDiagnosticsSummary(mixedSnapshot, {
  severityFilter: 'all',
  runtimeFilter: 'not_loaded',
});
assert.equal(notLoadedSummary.providerSummaries.length, 3);
assert.deepEqual(
  notLoadedSummary.providerSummaries.map((provider) => provider.name),
  ['missing-key', 'enabled-not-loaded', 'disabled'],
);

const activeSummary = deriveAdminProviderHealthDiagnosticsSummary(mixedSnapshot, {
  severityFilter: 'all',
  runtimeFilter: 'active',
});
assert.equal(activeSummary.providerSummaries.length, 0);
assert.equal(activeSummary.healthyMessage, '');

const activeFilterSummary = deriveAdminProviderHealthActiveFilterSummary(
  mixedSummary.providerSummaries,
  notLoadedSummary.providerSummaries,
  {
    severityFilter: 'all',
    runtimeFilter: 'not_loaded',
  },
);
assert.equal(activeFilterSummary.activeFilterCount, 1);
assert.equal(activeFilterSummary.matchedProviderCount, 3);
assert.equal(activeFilterSummary.totalProviderCount, 5);
assert.deepEqual(activeFilterSummary.activeLabels, ['provider_runtime=not_loaded']);

const combinedFilterSummary = deriveAdminProviderHealthActiveFilterSummary(
  mixedSummary.providerSummaries,
  warningOnlySummary.providerSummaries,
  {
    severityFilter: 'warning',
    runtimeFilter: 'not_loaded',
  },
);
assert.equal(combinedFilterSummary.activeFilterCount, 2);
assert.deepEqual(combinedFilterSummary.activeLabels, [
  'provider_health=warning',
  'provider_runtime=not_loaded',
]);

console.log('[YES] Admin provider health diagnostics model validation passed.');
