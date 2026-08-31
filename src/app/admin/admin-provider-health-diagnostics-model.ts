import type { AdminLLMProviderId, AdminLLMProvidersResponse, LLMProvider } from '@/lib/admin/api';
import type { AIModelName, AIModelProviderBaseUrl } from '@/lib/types';

export type AdminProviderHealthSeverity = 'ready' | 'warning' | 'blocked' | 'idle';
export type AdminProviderHealthSeverityFilter = AdminProviderHealthSeverity | 'all';
export type AdminProviderHealthRuntimeFilter = 'loaded' | 'not_loaded' | 'active' | 'inactive' | 'all';

export const ADMIN_PROVIDER_HEALTH_SEVERITY_QUERY_PARAM = 'provider_health';
export const ADMIN_PROVIDER_HEALTH_RUNTIME_QUERY_PARAM = 'provider_runtime';

export type AdminProviderHealthProviderSummary = {
  id: AdminLLMProviderId;
  name: string;
  displayName: string;
  model: AIModelName;
  baseUrl: AIModelProviderBaseUrl;
  severity: AdminProviderHealthSeverity;
  isEnabled: boolean;
  isDefault: boolean;
  isRuntimeLoaded: boolean;
  isRuntimeActive: boolean;
  hasApiKey: boolean;
  message: string;
  nextAction: string;
};

export type AdminProviderHealthDiagnosticsSummary = {
  totalProviderCount: number;
  enabledProviderCount: number;
  loadedProviderCount: number;
  activeProviderName: string;
  defaultProviderName: string;
  driftCount: number;
  blockedCount: number;
  warningCount: number;
  readyCount: number;
  idleCount: number;
  providerSummaries: AdminProviderHealthProviderSummary[];
  priorityProviders: AdminProviderHealthProviderSummary[];
  healthyMessage: string;
};

export type AdminProviderHealthFilterState = {
  severityFilter: AdminProviderHealthSeverityFilter;
  runtimeFilter: AdminProviderHealthRuntimeFilter;
};

export type AdminProviderHealthActiveFilterLabel = string;
export type AdminProviderHealthActiveFilterLabelList = AdminProviderHealthActiveFilterLabel[];

export type AdminProviderHealthActiveFilterSummary = {
  activeFilterCount: number;
  matchedProviderCount: number;
  totalProviderCount: number;
  activeLabels: AdminProviderHealthActiveFilterLabelList;
};

type AdminProviderHealthProviderSummaryList = AdminProviderHealthProviderSummary[];

const ADMIN_PROVIDER_HEALTH_SEVERITY_FILTERS: AdminProviderHealthSeverityFilter[] = [
  'all',
  'blocked',
  'warning',
  'idle',
  'ready',
];

const ADMIN_PROVIDER_HEALTH_PRIORITY_PROVIDER_LIMIT = 5;

const ADMIN_PROVIDER_HEALTH_RUNTIME_FILTERS: AdminProviderHealthRuntimeFilter[] = [
  'all',
  'loaded',
  'not_loaded',
  'active',
  'inactive',
];

const severityPriority: Record<AdminProviderHealthSeverity, number> = {
  blocked: 0,
  warning: 1,
  idle: 2,
  ready: 3,
};

export function normalizeAdminProviderHealthSeverityFilter(value?: string | null): AdminProviderHealthSeverityFilter {
  const normalizedValue = value?.trim() as AdminProviderHealthSeverityFilter | undefined;
  const hasNormalizedValue = normalizedValue !== undefined && normalizedValue.length > 0;
  const isKnownFilter = hasNormalizedValue === true && ADMIN_PROVIDER_HEALTH_SEVERITY_FILTERS.includes(normalizedValue);
  if (isKnownFilter === false) {
    return 'all';
  }
  return normalizedValue;
}

export function normalizeAdminProviderHealthRuntimeFilter(value?: string | null): AdminProviderHealthRuntimeFilter {
  const normalizedValue = value?.trim() as AdminProviderHealthRuntimeFilter | undefined;
  const hasNormalizedValue = normalizedValue !== undefined && normalizedValue.length > 0;
  const isKnownFilter = hasNormalizedValue === true && ADMIN_PROVIDER_HEALTH_RUNTIME_FILTERS.includes(normalizedValue);
  if (isKnownFilter === false) {
    return 'all';
  }
  return normalizedValue;
}

export function updateAdminProviderHealthSeveritySearch(
  search: string,
  severityFilter: AdminProviderHealthSeverityFilter,
): string {
  const searchParams = new URLSearchParams(search);
  if (severityFilter === 'all') {
    searchParams.delete(ADMIN_PROVIDER_HEALTH_SEVERITY_QUERY_PARAM);
  } else {
    searchParams.set(ADMIN_PROVIDER_HEALTH_SEVERITY_QUERY_PARAM, severityFilter);
  }

  const nextSearch = searchParams.toString();
  return nextSearch ? `?${nextSearch}` : '';
}

export function updateAdminProviderHealthRuntimeSearch(
  search: string,
  runtimeFilter: AdminProviderHealthRuntimeFilter,
): string {
  const searchParams = new URLSearchParams(search);
  if (runtimeFilter === 'all') {
    searchParams.delete(ADMIN_PROVIDER_HEALTH_RUNTIME_QUERY_PARAM);
  } else {
    searchParams.set(ADMIN_PROVIDER_HEALTH_RUNTIME_QUERY_PARAM, runtimeFilter);
  }

  const nextSearch = searchParams.toString();
  return nextSearch ? `?${nextSearch}` : '';
}

export function clearAdminProviderHealthFilterSearch(search: string): string {
  const searchParams = new URLSearchParams(search);
  searchParams.delete(ADMIN_PROVIDER_HEALTH_SEVERITY_QUERY_PARAM);
  searchParams.delete(ADMIN_PROVIDER_HEALTH_RUNTIME_QUERY_PARAM);

  const nextSearch = searchParams.toString();
  return nextSearch ? `?${nextSearch}` : '';
}

function readString(value?: string): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getAdminProviderHealthDisplayLabel(value?: string): string {
  const normalizedValue = readString(value);
  const hasNormalizedValue = normalizedValue.length > 0;
  return hasNormalizedValue === true ? normalizedValue : '-';
}

function hasRequiredConfig(provider: LLMProvider): boolean {
  const hasProviderModelList = Array.isArray(provider.models) === true && provider.models.length > 0;
  const hasLegacyModel = readString(provider.model).length > 0;
  return readString(provider.base_url).length > 0
    && (hasProviderModelList === true || hasLegacyModel === true)
    && (provider.type === 'local' || provider.has_api_key);
}

function deriveProviderHealthSeverity(provider: LLMProvider): AdminProviderHealthSeverity {
  const isProviderEnabled = provider.enabled === true;
  const hasProviderRequiredConfig = hasRequiredConfig(provider);
  const isRuntimeLoaded = provider.runtime_loaded === true;
  const isRuntimeActive = provider.runtime_active === true;
  const hasDefaultRuntimeDrift = provider.is_default === true && isRuntimeActive === false;

  if (isProviderEnabled === false) {
    return 'idle';
  }
  if (hasProviderRequiredConfig === false) {
    return 'blocked';
  }
  if (isRuntimeLoaded === false || hasDefaultRuntimeDrift === true) {
    return 'warning';
  }
  return 'ready';
}

function deriveProviderHealthMessage(provider: LLMProvider, severity: AdminProviderHealthSeverity): string {
  if (severity === 'idle') {
    return 'Provider 已禁用，不参与当前运行态。';
  }
  const hasProviderRequiredConfig = hasRequiredConfig(provider);
  const isRuntimeLoaded = provider.runtime_loaded === true;
  const hasDefaultRuntimeDrift = provider.is_default === true && provider.runtime_active === false;

  if (hasProviderRequiredConfig === false) {
    return 'Provider 配置不完整，无法形成稳定运行态。';
  }
  if (isRuntimeLoaded === false) {
    return 'Provider 已启用但未加载到运行时。';
  }
  if (hasDefaultRuntimeDrift === true) {
    return 'Provider 标记为默认，但当前运行态未使用它。';
  }
  return 'Provider 配置态与运行态一致。';
}

function deriveProviderHealthNextAction(provider: LLMProvider, severity: AdminProviderHealthSeverity): string {
  if (severity === 'idle') {
    return '如需参与运行态，请在 LLM Provider 管理页启用后按既定流程刷新运行态。';
  }
  const hasProviderRequiredConfig = hasRequiredConfig(provider);
  const isRuntimeLoaded = provider.runtime_loaded === true;
  const hasDefaultRuntimeDrift = provider.is_default === true && provider.runtime_active === false;

  if (hasProviderRequiredConfig === false) {
    return '检查 base_url、model 与 API Key 配置；本诊断不读取或展示密钥值。';
  }
  if (isRuntimeLoaded === false) {
    return '确认配置变更后按既定流程刷新 Provider 运行态。';
  }
  if (hasDefaultRuntimeDrift === true) {
    return '确认默认 Provider 与当前运行态是否需要重新同步。';
  }
  return '无需处理。';
}

function toProviderSummary(provider: LLMProvider): AdminProviderHealthProviderSummary {
  const severity = deriveProviderHealthSeverity(provider);
  const isRuntimeLoaded = provider.runtime_loaded === true;
  const isRuntimeActive = provider.runtime_active === true;
  return {
    id: provider.id,
    name: readString(provider.name) || `provider-${provider.id}`,
    displayName: readString(provider.display_name) || readString(provider.name) || `Provider ${provider.id}`,
    model: getAdminProviderHealthDisplayLabel(provider.model),
    baseUrl: getAdminProviderHealthDisplayLabel(provider.base_url),
    severity,
    isEnabled: provider.enabled,
    isDefault: provider.is_default,
    isRuntimeLoaded,
    isRuntimeActive,
    hasApiKey: provider.has_api_key,
    message: deriveProviderHealthMessage(provider, severity),
    nextAction: deriveProviderHealthNextAction(provider, severity),
  };
}

function compareProviderSummary(
  left: AdminProviderHealthProviderSummary,
  right: AdminProviderHealthProviderSummary,
) {
  const severityDiff = severityPriority[left.severity] - severityPriority[right.severity];
  if (severityDiff !== 0) {
    return severityDiff;
  }
  if (left.isDefault !== right.isDefault) {
    return left.isDefault ? -1 : 1;
  }
  return left.displayName.localeCompare(right.displayName, 'zh-CN');
}

function runtimeFilterMatches(
  provider: AdminProviderHealthProviderSummary,
  runtimeFilter: AdminProviderHealthRuntimeFilter,
): boolean {
  if (runtimeFilter === 'all') {
    return true;
  }
  if (runtimeFilter === 'loaded') {
    return provider.isRuntimeLoaded === true;
  }
  if (runtimeFilter === 'not_loaded') {
    return provider.isRuntimeLoaded === false;
  }
  if (runtimeFilter === 'active') {
    return provider.isRuntimeActive === true;
  }
  return provider.isRuntimeActive === false;
}

export function filterAdminProviderHealthSummaries(
  providers: AdminProviderHealthProviderSummaryList,
  severityFilter: AdminProviderHealthSeverityFilter,
  runtimeFilter: AdminProviderHealthRuntimeFilter,
): AdminProviderHealthProviderSummaryList {
  const matchedProviders: AdminProviderHealthProviderSummaryList = [];

  for (const provider of providers) {
    const severityMatched = severityFilter === 'all' || provider.severity === severityFilter;
    const runtimeMatched = runtimeFilterMatches(provider, runtimeFilter);
    const shouldIncludeProvider = severityMatched === true && runtimeMatched === true;
    if (shouldIncludeProvider === true) {
      matchedProviders.push(provider);
    }
  }

  return matchedProviders;
}

function listAdminProviderHealthProviderSummaries(
  providers: readonly LLMProvider[],
): AdminProviderHealthProviderSummaryList {
  const providerSummaries: AdminProviderHealthProviderSummaryList = [];

  for (const provider of providers) {
    providerSummaries.push(toProviderSummary(provider));
  }

  providerSummaries.sort(compareProviderSummary);
  return providerSummaries;
}

function countAdminProviderHealthSummariesBySeverity(
  providers: AdminProviderHealthProviderSummaryList,
  severity: AdminProviderHealthSeverity,
): number {
  let count = 0;

  for (const provider of providers) {
    if (provider.severity === severity) {
      count += 1;
    }
  }

  return count;
}

function resolveAdminProviderHealthActiveProvider(
  providers: AdminProviderHealthProviderSummaryList,
): AdminProviderHealthProviderSummary | undefined {
  for (const provider of providers) {
    if (provider.isRuntimeActive === true) {
      return provider;
    }
  }

  return undefined;
}

function resolveAdminProviderHealthDefaultProvider(
  providers: AdminProviderHealthProviderSummaryList,
): AdminProviderHealthProviderSummary | undefined {
  for (const provider of providers) {
    if (provider.isDefault === true) {
      return provider;
    }
  }

  return undefined;
}

function countAdminProviderHealthEnabledProviders(
  providers: AdminProviderHealthProviderSummaryList,
): number {
  let count = 0;

  for (const provider of providers) {
    if (provider.isEnabled === true) {
      count += 1;
    }
  }

  return count;
}

function countAdminProviderHealthLoadedProviders(
  providers: AdminProviderHealthProviderSummaryList,
): number {
  let count = 0;

  for (const provider of providers) {
    if (provider.isRuntimeLoaded === true) {
      count += 1;
    }
  }

  return count;
}

function hasAdminProviderHealthRuntimeDrift(provider: AdminProviderHealthProviderSummary): boolean {
  if (provider.isEnabled === false) {
    return false;
  }

  const hasRuntimeLoadedDrift = provider.isRuntimeLoaded === false;
  const hasDefaultRuntimeActiveDrift = provider.isDefault === true && provider.isRuntimeActive === false;
  return hasRuntimeLoadedDrift === true || hasDefaultRuntimeActiveDrift === true;
}

function countAdminProviderHealthRuntimeDriftProviders(
  providers: AdminProviderHealthProviderSummaryList,
): number {
  let count = 0;

  for (const provider of providers) {
    if (hasAdminProviderHealthRuntimeDrift(provider) === true) {
      count += 1;
    }
  }

  return count;
}

function listAdminProviderHealthPriorityProviders(
  providers: AdminProviderHealthProviderSummaryList,
): AdminProviderHealthProviderSummaryList {
  const priorityProviders: AdminProviderHealthProviderSummaryList = [];

  for (const provider of providers) {
    const isPriorityProvider = provider.severity === 'blocked' || provider.severity === 'warning';
    if (isPriorityProvider === true) {
      priorityProviders.push(provider);
    }

    const hasReachedLimit = priorityProviders.length >= ADMIN_PROVIDER_HEALTH_PRIORITY_PROVIDER_LIMIT;
    if (hasReachedLimit === true) {
      break;
    }
  }

  return priorityProviders;
}

function getAdminProviderHealthSnapshotProviders(
  snapshot: AdminLLMProvidersResponse | null,
): readonly LLMProvider[] {
  if (snapshot === null) {
    return [];
  }

  return snapshot.providers;
}

function getAdminProviderHealthDefaultProviderName(snapshot: AdminLLMProvidersResponse | null): string {
  if (snapshot === null) {
    return '';
  }

  return readString(snapshot.default_name);
}

function getAdminProviderHealthResolvedProviderName(
  provider: AdminProviderHealthProviderSummary | undefined,
  fallbackName: string,
  emptyFallbackName: string,
): string {
  if (provider !== undefined) {
    return provider.displayName;
  }

  const normalizedFallbackName = readString(fallbackName);
  const hasFallbackName = normalizedFallbackName.length > 0;
  if (hasFallbackName === true) {
    return normalizedFallbackName;
  }

  return emptyFallbackName;
}

export function deriveAdminProviderHealthActiveFilterSummary(
  totalProviders: AdminProviderHealthProviderSummary[],
  matchedProviders: AdminProviderHealthProviderSummary[],
  filters: AdminProviderHealthFilterState,
): AdminProviderHealthActiveFilterSummary {
  const activeLabels: AdminProviderHealthActiveFilterLabelList = [];
  const hasSeverityFilter = filters.severityFilter !== 'all';
  const hasRuntimeFilter = filters.runtimeFilter !== 'all';
  if (hasSeverityFilter === true) {
    activeLabels.push(`${ADMIN_PROVIDER_HEALTH_SEVERITY_QUERY_PARAM}=${filters.severityFilter}`);
  }
  if (hasRuntimeFilter === true) {
    activeLabels.push(`${ADMIN_PROVIDER_HEALTH_RUNTIME_QUERY_PARAM}=${filters.runtimeFilter}`);
  }

  return {
    activeFilterCount: activeLabels.length,
    matchedProviderCount: matchedProviders.length,
    totalProviderCount: totalProviders.length,
    activeLabels,
  };
}

export function deriveAdminProviderHealthDiagnosticsSummary(
  snapshot: AdminLLMProvidersResponse | null,
  filters: AdminProviderHealthFilterState = {
    severityFilter: 'all',
    runtimeFilter: 'all',
  },
): AdminProviderHealthDiagnosticsSummary {
  const providers = getAdminProviderHealthSnapshotProviders(snapshot);
  const allProviderSummaries = listAdminProviderHealthProviderSummaries(providers);
  const providerSummaries = filterAdminProviderHealthSummaries(
    allProviderSummaries,
    filters.severityFilter,
    filters.runtimeFilter,
  );
  const fallbackDefaultProviderName = getAdminProviderHealthDefaultProviderName(snapshot);
  const activeProvider = resolveAdminProviderHealthActiveProvider(allProviderSummaries);
  const defaultProvider = resolveAdminProviderHealthDefaultProvider(allProviderSummaries);
  const blockedCount = countAdminProviderHealthSummariesBySeverity(providerSummaries, 'blocked');
  const warningCount = countAdminProviderHealthSummariesBySeverity(providerSummaries, 'warning');
  const idleCount = countAdminProviderHealthSummariesBySeverity(providerSummaries, 'idle');
  const readyCount = countAdminProviderHealthSummariesBySeverity(providerSummaries, 'ready');

  return {
    totalProviderCount: allProviderSummaries.length,
    enabledProviderCount: countAdminProviderHealthEnabledProviders(allProviderSummaries),
    loadedProviderCount: countAdminProviderHealthLoadedProviders(allProviderSummaries),
    activeProviderName: getAdminProviderHealthResolvedProviderName(activeProvider, fallbackDefaultProviderName, '未加载'),
    defaultProviderName: getAdminProviderHealthResolvedProviderName(defaultProvider, fallbackDefaultProviderName, '未设置'),
    driftCount: countAdminProviderHealthRuntimeDriftProviders(allProviderSummaries),
    blockedCount,
    warningCount,
    readyCount,
    idleCount,
    providerSummaries,
    priorityProviders: listAdminProviderHealthPriorityProviders(providerSummaries),
    healthyMessage: blockedCount === 0 && warningCount === 0 && providerSummaries.length > 0
      ? '当前 Provider 配置态与运行态没有明显漂移。'
      : '',
  };
}
