'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  adminLLMApi,
  type AdminLLMProviderId,
  type AdminLLMProviderType,
  type AdminLLMProviderConnectionTestResponse,
  type LLMProvider,
  type LLMProviderCreate,
  type LLMProviderModelDiscoveryResult,
} from '@/lib/admin/api';
import { formatAdminOperationFailure } from '@/lib/admin/admin-operation-errors';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  AdminLLMProviderDeleteConfirmationSnapshotStrip,
  AdminLLMProviderRuntimeMutationConfirmationSnapshotStrip,
  AdminLLMProviderSaveConfirmationSnapshotStrip,
  AdminLLMProvidersPageSnapshotStrip,
  buildAdminLLMProviderDeleteConfirmationSnapshot,
  buildAdminLLMProviderRuntimeMutationConfirmationSnapshot,
  buildAdminLLMProviderSaveConfirmationSnapshot,
  buildAdminLLMProvidersPageSnapshot,
  type AdminLLMProviderRuntimeMutationKind,
} from './admin-llm-providers-page-snapshot';

type PendingAdminLLMProviderRuntimeMutation = {
  kind: AdminLLMProviderRuntimeMutationKind;
  provider: LLMProvider;
};

type AdminLLMProviderRuntimeSummary = {
  totalCount: number;
  enabledCount: number;
  loadedCount: number;
  activeProviderName: string;
  driftCount: number;
};

type AdminLLMProviderConnectionTestView = {
  providerId: AdminLLMProviderId;
  providerName: string;
  model: string;
  hasApiKey: boolean;
  message: string;
  recovery: string;
  status: AdminLLMProviderConnectionTestResponse['status'];
  latencyMs: number;
  testedAt: string;
};

type AdminLLMProviderForm = LLMProviderCreate & {
  models_text: string;
};

function getAdminLLMProviderDisplayLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = value !== undefined && value !== null && value.length > 0;
  return hasValue === true ? value : fallback;
}

function getAdminLLMProviderModelsText(provider: LLMProvider): string {
  const models = provider.models;
  if (Array.isArray(models) === false || models.length === 0) {
    return getAdminLLMProviderDisplayLabel(provider.model, '');
  }
  const values: string[] = [];
  for (const model of models) {
    if (model.model_id.length > 0) {
      values.push(model.model_id);
    }
  }
  return values.join('\n');
}

function materializeAdminLLMProviderModelPayload(modelsText: string): NonNullable<LLMProviderCreate['models']> {
  const rawLines = modelsText.split(/\r?\n/);
  const models: NonNullable<LLMProviderCreate['models']> = [];
  const seen = new Set<string>();
  for (const rawLine of rawLines) {
    const modelId = rawLine.trim();
    if (modelId.length === 0 || seen.has(modelId)) {
      continue;
    }
    seen.add(modelId);
    models.push({
      model_id: modelId,
      display_name: modelId,
      enabled: true,
      is_default: models.length === 0,
      capability_tags: 'chat,reasoning,coding',
      default_for: 'chat,foundation,plan,implement,repair',
      sort_order: models.length + 1,
    });
  }
  return models;
}

function getAdminLLMProviderDefaultModelFromText(modelsText: string, fallback: string): string {
  const models = materializeAdminLLMProviderModelPayload(modelsText);
  if (models.length > 0) {
    return models[0].model_id;
  }
  return fallback;
}

function getAdminLLMProviderDefaultModel(provider: LLMProvider): string {
  const models = provider.models;
  if (Array.isArray(models) === true) {
    for (const model of models) {
      if (model.is_default === true && model.model_id.length > 0) {
        return model.model_id;
      }
    }
    for (const model of models) {
      if (model.model_id.length > 0) {
        return model.model_id;
      }
    }
  }
  return provider.model;
}

function getAdminLLMDiscoveredModelsText(models: LLMProvider['models']): string {
  if (Array.isArray(models) === false) {
    return '';
  }
  const modelIds: string[] = [];
  for (const model of models) {
    if (model.model_id.length > 0) {
      modelIds.push(model.model_id);
    }
  }
  return modelIds.join('\n');
}

function materializeAdminLLMProviderListAfterModelDiscovery(
  providers: readonly LLMProvider[],
  discoveryResult: LLMProviderModelDiscoveryResult,
  defaultModel: string,
): LLMProvider[] {
  const nextProviders: LLMProvider[] = [];
  for (const provider of providers) {
    if (provider.id !== discoveryResult.provider_id) {
      nextProviders.push(provider);
      continue;
    }
    nextProviders.push({
      ...provider,
      model: defaultModel,
      models: discoveryResult.models,
    });
  }
  return nextProviders;
}

function materializeAdminLLMEditingProviderAfterModelDiscovery(
  provider: LLMProvider | null,
  discoveryResult: LLMProviderModelDiscoveryResult,
  defaultModel: string,
): LLMProvider | null {
  if (provider === null || provider.id !== discoveryResult.provider_id) {
    return provider;
  }
  return {
    ...provider,
    model: defaultModel,
    models: discoveryResult.models,
  };
}

function getAdminLLMProviderCount(providers: readonly unknown[] | undefined): number {
  const hasProviders = Array.isArray(providers) === true;
  return hasProviders === true ? providers.length : 0;
}

function resolveAdminLLMProviderId(provider: LLMProvider | null): AdminLLMProviderId | null {
  const hasProvider = provider !== null;
  return hasProvider === true ? provider.id : null;
}

function resolvePendingAdminLLMProviderRuntimeMutationAction(
  pendingRuntimeMutation: PendingAdminLLMProviderRuntimeMutation | null,
): AdminLLMProviderRuntimeMutationKind | null {
  const hasPendingRuntimeMutation = pendingRuntimeMutation !== null;
  return hasPendingRuntimeMutation === true ? pendingRuntimeMutation.kind : null;
}

function resolvePendingAdminLLMProviderRuntimeMutationProvider(
  pendingRuntimeMutation: PendingAdminLLMProviderRuntimeMutation | null,
): LLMProvider | null {
  const hasPendingRuntimeMutation = pendingRuntimeMutation !== null;
  return hasPendingRuntimeMutation === true ? pendingRuntimeMutation.provider : null;
}

function getAdminLLMProviderApiKeyPlaceholder(editingProvider: LLMProvider | null): string {
  const isKeepingExistingApiKey = editingProvider !== null && editingProvider.has_api_key === true;
  return isKeepingExistingApiKey === true ? '留空则保持原 API Key 不变' : 'sk-xxxxx';
}

function getAdminLLMOptionalProviderDisplayName(provider: LLMProvider | undefined): string {
  const hasProvider = provider !== undefined;
  return hasProvider === true ? getAdminLLMProviderDisplayLabel(provider.display_name, '') : '';
}

function getAdminLLMOptionalProviderName(provider: LLMProvider | undefined): string {
  const hasProvider = provider !== undefined;
  return hasProvider === true ? getAdminLLMProviderDisplayLabel(provider.name, '') : '';
}

function getAdminLLMProviderReloadMessageClassName(reloadMessage: string): string {
  const hasReloadMessage = reloadMessage.length > 0;
  const isReloadFailure = hasReloadMessage === true && reloadMessage.includes('失败') === true;
  return hasReloadMessage === true && isReloadFailure === false
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-gray-500 dark:text-gray-400';
}

function getAdminLLMProviderReloadActionLabel(reloading: boolean): string {
  return reloading === true ? '重载中...' : '立即重载运行时';
}

function getAdminLLMProviderDriftCountClassName(driftCount: number): string {
  const hasRuntimeDrift = driftCount > 0;
  return hasRuntimeDrift === true
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';
}

function getAdminLLMProviderConnectionTestStatusClassName(status: AdminLLMProviderConnectionTestView['status']): string {
  if (status === 'ready') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300';
  }
  if (status === 'blocked') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300';
}

function getAdminLLMProviderConnectionTestApiKeyLabel(hasApiKey: boolean): string {
  return hasApiKey === true ? 'yes' : 'no';
}

function getAdminLLMProviderConnectionTestActionLabel(isTesting: boolean): string {
  return isTesting === true ? '预检中...' : '连接预检';
}

function shouldRenderAdminLLMProvidersPageError(error: string): boolean {
  const hasError = error.length > 0;
  return hasError === true;
}

function shouldRenderAdminLLMProvidersEmptyState(providers: readonly LLMProvider[]): boolean {
  const providerCount = getAdminLLMProviderCount(providers);
  const hasProviders = Array.isArray(providers) === true && providerCount > 0;
  return hasProviders === false;
}

function shouldRenderAdminLLMProviderDefaultBadge(provider: LLMProvider): boolean {
  return provider.is_default === true;
}

function shouldRenderAdminLLMProviderRuntimeDriftNotice(provider: LLMProvider): boolean {
  const isProviderEnabled = provider.enabled === true;
  const isRuntimeLoaded = provider.runtime_loaded === true;
  return isProviderEnabled === true && isRuntimeLoaded === false;
}

function shouldRenderAdminLLMProviderSetDefaultAction(provider: LLMProvider): boolean {
  const isDefaultProvider = provider.is_default === true;
  const isProviderEnabled = provider.enabled === true;
  return isDefaultProvider === false && isProviderEnabled === true;
}

function shouldRenderAdminLLMProviderForm(showForm: boolean): boolean {
  return showForm === true;
}

function getAdminLLMProviderCardClassName(provider: LLMProvider): string {
  const isProviderEnabled = provider.enabled === true;
  return isProviderEnabled === true
    ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60';
}

function getAdminLLMProviderEnabledBadgeClassName(provider: LLMProvider): string {
  const isProviderEnabled = provider.enabled === true;
  return isProviderEnabled === true
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
}

function getAdminLLMProviderEnabledLabel(provider: LLMProvider): string {
  const isProviderEnabled = provider.enabled === true;
  return isProviderEnabled === true ? '启用' : '禁用';
}

function getAdminLLMProviderTypeLabel(provider: LLMProvider): string {
  const isCloudProvider = provider.type === 'cloud';
  return isCloudProvider === true ? '云端' : '本地';
}

function getAdminLLMProviderApiKeyStatusLabel(provider: LLMProvider): string {
  const hasApiKey = provider.has_api_key === true;
  return hasApiKey === true ? '已配置' : '未设置';
}

function getAdminLLMProviderRuntimeLoadedBadgeClassName(provider: LLMProvider): string {
  const isRuntimeLoaded = provider.runtime_loaded === true;
  return isRuntimeLoaded === true
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
}

function getAdminLLMProviderRuntimeLoadedLabel(provider: LLMProvider): string {
  const isRuntimeLoaded = provider.runtime_loaded === true;
  return isRuntimeLoaded === true ? '已加载' : '未加载';
}

function getAdminLLMProviderRuntimeActiveBadgeClassName(provider: LLMProvider): string {
  const isRuntimeActive = provider.runtime_active === true;
  return isRuntimeActive === true
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
}

function getAdminLLMProviderRuntimeActiveLabel(provider: LLMProvider): string {
  const isRuntimeActive = provider.runtime_active === true;
  return isRuntimeActive === true ? '当前生效中' : '当前未生效';
}

function getAdminLLMProviderToggleActionClassName(provider: LLMProvider): string {
  const isProviderEnabled = provider.enabled === true;
  return isProviderEnabled === true
    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'
    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400';
}

function getAdminLLMProviderToggleActionLabel(provider: LLMProvider): string {
  const isProviderEnabled = provider.enabled === true;
  return isProviderEnabled === true ? '禁用' : '启用';
}

function getAdminLLMProviderFormSubmitLabel(isEditingProvider: boolean): string {
  return isEditingProvider === true ? '更新' : '创建';
}

function getAdminLLMProviderFormTitle(isEditingProvider: boolean): string {
  return isEditingProvider === true ? '编辑提供商' : '新增提供商';
}

function getAdminLLMProviderSaveConfirmationTitle(isEditingProvider: boolean): string {
  return isEditingProvider === true ? '确认更新 LLM Provider' : '确认创建 LLM Provider';
}

function getAdminLLMProviderSaveActionLabel(saving: boolean): string {
  return saving === true ? '保存中...' : '确认保存';
}

function getAdminLLMRuntimeMutationTitle(pendingRuntimeMutation: PendingAdminLLMProviderRuntimeMutation | null): string {
  const runtimeMutationAction = resolvePendingAdminLLMProviderRuntimeMutationAction(pendingRuntimeMutation);
  const isSetDefaultMutation = runtimeMutationAction === 'set_default';
  return isSetDefaultMutation === true ? '确认设为默认提供商' : '确认切换提供商状态';
}

function getAdminLLMRuntimeMutationActionLabel(
  pendingRuntimeMutation: PendingAdminLLMProviderRuntimeMutation,
): string {
  const isSetDefaultMutation = pendingRuntimeMutation.kind === 'set_default';
  if (isSetDefaultMutation === true) {
    return '设为默认';
  }
  return getAdminLLMProviderToggleActionLabel(pendingRuntimeMutation.provider);
}

function getAdminLLMRuntimeMutationDescription(
  pendingRuntimeMutation: PendingAdminLLMProviderRuntimeMutation | null,
): string {
  const hasPendingRuntimeMutation = pendingRuntimeMutation !== null;
  if (hasPendingRuntimeMutation === false) {
    return '确定要变更这个提供商吗？';
  }

  const mutationActionLabel = getAdminLLMRuntimeMutationActionLabel(pendingRuntimeMutation);
  const providerDisplayName = getAdminLLMProviderDisplayLabel(
    pendingRuntimeMutation.provider.display_name,
    pendingRuntimeMutation.provider.name,
  );
  return `确定要${mutationActionLabel}提供商“${providerDisplayName}”吗？`;
}

function getAdminLLMDeleteConfirmationDescription(deletingProvider: LLMProvider | null): string {
  const hasDeletingProvider = deletingProvider !== null;
  if (hasDeletingProvider === false) {
    return '确定要删除这个提供商吗？';
  }

  const providerDisplayName = getAdminLLMProviderDisplayLabel(deletingProvider.display_name, deletingProvider.name);
  return `确定要删除提供商“${providerDisplayName}”吗？`;
}

function getAdminLLMProviderRuntimeMutationActionLabel(isMutatingProvider: boolean): string {
  return isMutatingProvider === true ? '提交中...' : '确认变更';
}

function getAdminLLMProviderDeleteActionLabel(isDeletingProvider: boolean): string {
  return isDeletingProvider === true ? '删除中...' : '确认删除';
}

function buildAdminLLMProviderRuntimeSummary(
  providers: readonly LLMProvider[],
  defaultProviderName: string,
): AdminLLMProviderRuntimeSummary {
  let enabledCount = 0;
  let loadedCount = 0;
  let driftCount = 0;
  let activeProvider: LLMProvider | undefined;

  for (const provider of providers) {
    const isProviderEnabled = provider.enabled === true;
    if (isProviderEnabled === true) {
      enabledCount += 1;
    }

    const isRuntimeLoaded = provider.runtime_loaded === true;
    if (isRuntimeLoaded === true) {
      loadedCount += 1;
    }

    const hasRuntimeDrift = shouldRenderAdminLLMProviderRuntimeDriftNotice(provider);
    if (hasRuntimeDrift === true) {
      driftCount += 1;
    }

    const shouldSetActiveProvider = activeProvider === undefined && provider.runtime_active === true;
    if (shouldSetActiveProvider === true) {
      activeProvider = provider;
    }
  }

  const activeProviderDisplayName = getAdminLLMOptionalProviderDisplayName(activeProvider);
  const activeProviderName = getAdminLLMOptionalProviderName(activeProvider);
  const fallbackDefaultProviderName = getAdminLLMProviderDisplayLabel(defaultProviderName, '未加载');
  const runtimeActiveProviderName = getAdminLLMProviderDisplayLabel(
    activeProviderDisplayName,
    getAdminLLMProviderDisplayLabel(activeProviderName, fallbackDefaultProviderName),
  );

  return {
    totalCount: getAdminLLMProviderCount(providers),
    enabledCount,
    loadedCount,
    activeProviderName: runtimeActiveProviderName,
    driftCount,
  };
}

function materializeAdminLLMProviderCardNodes({
  providers,
  testingProviderId,
  connectionTest,
  onOpenRuntimeMutationConfirmation,
  onOpenEdit,
  onOpenDeleteConfirmation,
  onTestConnection,
}: {
  providers: readonly LLMProvider[];
  testingProviderId: AdminLLMProviderId | null;
  connectionTest: AdminLLMProviderConnectionTestView | null;
  onOpenRuntimeMutationConfirmation: (
    kind: AdminLLMProviderRuntimeMutationKind,
    provider: LLMProvider,
  ) => void;
  onOpenEdit: (provider: LLMProvider) => void;
  onOpenDeleteConfirmation: (provider: LLMProvider) => void;
  onTestConnection: (provider: LLMProvider) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const provider of providers) {
    const providerDisplayName = getAdminLLMProviderDisplayLabel(provider.display_name, provider.name);
    const providerModelLabel = getAdminLLMProviderDisplayLabel(provider.model, '（未设置）');
    const providerModelsText = getAdminLLMProviderModelsText(provider);
    const providerModelsLabel = getAdminLLMProviderDisplayLabel(providerModelsText.replace(/\n/g, ' / '), '（未设置）');
    const providerModelCount = materializeAdminLLMProviderModelPayload(providerModelsText).length;
    const providerBaseUrlLabel = getAdminLLMProviderDisplayLabel(provider.base_url, '（未设置）');
    const shouldRenderDefaultBadge = shouldRenderAdminLLMProviderDefaultBadge(provider);
    const shouldRenderRuntimeDriftNotice = shouldRenderAdminLLMProviderRuntimeDriftNotice(provider);
    const shouldRenderSetDefaultAction = shouldRenderAdminLLMProviderSetDefaultAction(provider);
    const providerCardClassName = getAdminLLMProviderCardClassName(provider);
    const providerEnabledBadgeClassName = getAdminLLMProviderEnabledBadgeClassName(provider);
    const providerEnabledLabel = getAdminLLMProviderEnabledLabel(provider);
    const providerTypeLabel = getAdminLLMProviderTypeLabel(provider);
    const providerApiKeyStatusLabel = getAdminLLMProviderApiKeyStatusLabel(provider);
    const providerRuntimeLoadedBadgeClassName = getAdminLLMProviderRuntimeLoadedBadgeClassName(provider);
    const providerRuntimeLoadedLabel = getAdminLLMProviderRuntimeLoadedLabel(provider);
    const providerRuntimeActiveBadgeClassName = getAdminLLMProviderRuntimeActiveBadgeClassName(provider);
    const providerRuntimeActiveLabel = getAdminLLMProviderRuntimeActiveLabel(provider);
    const providerToggleActionClassName = getAdminLLMProviderToggleActionClassName(provider);
    const providerToggleActionLabel = getAdminLLMProviderToggleActionLabel(provider);
    const isTestingProvider = testingProviderId === provider.id;
    const canTestProviderConnection = testingProviderId === null || isTestingProvider === true;
    const connectionTestActionLabel = getAdminLLMProviderConnectionTestActionLabel(isTestingProvider);
    const shouldRenderConnectionTest = connectionTest !== null && connectionTest.providerId === provider.id;
    const connectionTestStatusClassName = shouldRenderConnectionTest === true
      ? getAdminLLMProviderConnectionTestStatusClassName(connectionTest.status)
      : '';
    const connectionTestApiKeyLabel = shouldRenderConnectionTest === true
      ? getAdminLLMProviderConnectionTestApiKeyLabel(connectionTest.hasApiKey)
      : 'no';

    nodes.push(
      <div
        key={provider.id}
        className={`p-4 rounded-lg border transition-colors ${providerCardClassName}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {providerDisplayName}
              </h3>
              {shouldRenderDefaultBadge === true && (
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                  默认
                </span>
              )}
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${providerEnabledBadgeClassName}`}>
                {providerEnabledLabel}
              </span>
              <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full capitalize">
                {providerTypeLabel}
              </span>
            </div>
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
              <p>默认模型：<span className="font-mono text-gray-700 dark:text-gray-300">{providerModelLabel}</span></p>
              <p>模型数量：{providerModelCount}</p>
              <p className="line-clamp-2">模型列表：<span className="font-mono text-gray-700 dark:text-gray-300">{providerModelsLabel}</span></p>
              <p>Base URL：<span className="font-mono text-gray-700 dark:text-gray-300">{providerBaseUrlLabel}</span></p>
              <p>API Key：<span className="font-mono text-gray-700 dark:text-gray-300">
                {providerApiKeyStatusLabel}
              </span></p>
              <p>使用次数：{provider.use_count} 次 | 优先级：{provider.priority}</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${providerRuntimeLoadedBadgeClassName}`}>
                运行时{providerRuntimeLoadedLabel}
              </span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${providerRuntimeActiveBadgeClassName}`}>
                {providerRuntimeActiveLabel}
              </span>
              {shouldRenderRuntimeDriftNotice === true && (
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  数据库已启用，但运行时还未加载，建议执行一次 reload。
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => onOpenRuntimeMutationConfirmation('toggle_enabled', provider)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${providerToggleActionClassName}`}
            >
              {providerToggleActionLabel}
            </button>
            {shouldRenderSetDefaultAction === true && (
              <button
                onClick={() => onOpenRuntimeMutationConfirmation('set_default', provider)}
                className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 rounded-md transition-colors"
              >
                设为默认
              </button>
            )}
            <button
              onClick={() => onOpenEdit(provider)}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-md transition-colors"
            >
              编辑
            </button>
            <button
              type="button"
              data-testid="admin-llm-provider-connection-test"
              disabled={canTestProviderConnection === false}
              onClick={() => onTestConnection(provider)}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-md transition-colors disabled:opacity-60"
            >
              {connectionTestActionLabel}
            </button>
            <button
              onClick={() => onOpenDeleteConfirmation(provider)}
              className="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 rounded-md transition-colors"
            >
              删除
            </button>
          </div>
        </div>
        {shouldRenderConnectionTest === true && (
          <div
            className={`mt-3 rounded-md border px-3 py-2 text-xs ${connectionTestStatusClassName}`}
            data-testid="admin-llm-provider-connection-test-result"
          >
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span className="font-medium">连接预检</span>
              <span>Status: {connectionTest.status}</span>
              <span>Provider: {connectionTest.providerName}</span>
              <span>Model: {connectionTest.model}</span>
              <span>HasApiKey: {connectionTestApiKeyLabel}</span>
              <span>LatencyMs: {connectionTest.latencyMs}</span>
              <span>CheckedAt: {connectionTest.testedAt}</span>
            </div>
            <p className="mt-1">{connectionTest.message}</p>
            <p className="mt-1 opacity-80">恢复建议：{connectionTest.recovery}</p>
            <p className="mt-1 opacity-80">该入口会在配置齐备时发起受控真实模型连接测试；blocked 时不会访问上游，不暴露 API Key。</p>
          </div>
        )}
      </div>,
    );
  }

  return nodes;
}

export default function LLMManagementPage() {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [defaultProviderName, setDefaultProviderName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AdminLLMProviderForm>({
    name: '',
    display_name: '',
    type: 'cloud',
    api_key: '',
    base_url: '',
    model: '',
    models_text: '',
    enabled: false,
    is_default: false,
    priority: 0,
  });
  const [saving, setSaving] = useState(false);
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
  const [saveConfirmationError, setSaveConfirmationError] = useState('');
  const [deletingProvider, setDeletingProvider] = useState<LLMProvider | null>(null);
  const [isDeletingProvider, setIsDeletingProvider] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [pendingRuntimeMutation, setPendingRuntimeMutation] = useState<PendingAdminLLMProviderRuntimeMutation | null>(null);
  const [isMutatingProvider, setIsMutatingProvider] = useState(false);
  const [providerMutationError, setProviderMutationError] = useState('');
  const [reloading, setReloading] = useState(false);
  const [reloadMessage, setReloadMessage] = useState('');
  const [lastReloadAt, setLastReloadAt] = useState('');
  const [testingProviderId, setTestingProviderId] = useState<AdminLLMProviderId | null>(null);
  const [connectionTest, setConnectionTest] = useState<AdminLLMProviderConnectionTestView | null>(null);
  const [discoveringModels, setDiscoveringModels] = useState(false);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminLLMApi.listProviders();
      setProviders(data.providers);
      setDefaultProviderName(getAdminLLMProviderDisplayLabel(data.default_name, ''));
    } catch (err: unknown) {
      setError(formatAdminOperationFailure(err, '加载提供商失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const resetForm = () => {
    setSaveConfirmationOpen(false);
    setSaveConfirmationError('');
    setForm({
      name: '',
      display_name: '',
      type: 'cloud',
      api_key: '',
      base_url: '',
      model: '',
      models_text: '',
      enabled: false,
      is_default: false,
      priority: 0,
    });
    setEditingProvider(null);
    setShowForm(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (provider: LLMProvider) => {
    setSaveConfirmationOpen(false);
    setSaveConfirmationError('');
    setEditingProvider(provider);
    setForm({
      name: provider.name,
      display_name: provider.display_name,
      type: provider.type,
      api_key: '',
      base_url: provider.base_url,
      model: provider.model,
      models_text: getAdminLLMProviderModelsText(provider),
      enabled: provider.enabled,
      is_default: provider.is_default,
      priority: provider.priority,
    });
    setShowForm(true);
  };

  const runtimeSummary = useMemo(() => {
    return buildAdminLLMProviderRuntimeSummary(providers, defaultProviderName);
  }, [defaultProviderName, providers]);
  const adminLLMProvidersPageSnapshot = buildAdminLLMProvidersPageSnapshot({
    loading,
    saving,
    reloading,
    error,
    providerCount: runtimeSummary.totalCount,
    enabledCount: runtimeSummary.enabledCount,
    loadedCount: runtimeSummary.loadedCount,
    driftCount: runtimeSummary.driftCount,
    defaultProviderName,
    activeProviderName: runtimeSummary.activeProviderName,
    showForm,
    editingProviderId: resolveAdminLLMProviderId(editingProvider),
    deletingProviderId: resolveAdminLLMProviderId(deletingProvider),
    form,
    reloadMessage,
    lastReloadAt,
  });
  const adminLLMProviderDeleteConfirmationSnapshot = buildAdminLLMProviderDeleteConfirmationSnapshot({
    provider: deletingProvider,
    isDeleting: isDeletingProvider,
    error: deleteError,
  });
  const adminLLMProviderRuntimeMutationConfirmationSnapshot = buildAdminLLMProviderRuntimeMutationConfirmationSnapshot({
    action: resolvePendingAdminLLMProviderRuntimeMutationAction(pendingRuntimeMutation),
    provider: resolvePendingAdminLLMProviderRuntimeMutationProvider(pendingRuntimeMutation),
    isMutating: isMutatingProvider,
    error: providerMutationError,
  });
  const adminLLMProviderSaveConfirmationSnapshot = buildAdminLLMProviderSaveConfirmationSnapshot({
    form,
    formMode: adminLLMProvidersPageSnapshot.formMode,
    editingProvider,
    isOpen: saveConfirmationOpen,
    saving,
    error: saveConfirmationError,
  });
  const isEditingProvider = editingProvider !== null;
  const shouldRenderPageError = shouldRenderAdminLLMProvidersPageError(error);
  const shouldRenderEmptyProviders = shouldRenderAdminLLMProvidersEmptyState(providers);
  const shouldRenderProviderForm = shouldRenderAdminLLMProviderForm(showForm);
  const defaultProviderNameLabel = getAdminLLMProviderDisplayLabel(defaultProviderName, '未设置');
  const reloadMessageLabel = getAdminLLMProviderDisplayLabel(reloadMessage, '本次会话尚未手动重载');
  const reloadMessageClassName = getAdminLLMProviderReloadMessageClassName(reloadMessage);
  const reloadActionLabel = getAdminLLMProviderReloadActionLabel(reloading);
  const lastReloadAtLabel = getAdminLLMProviderDisplayLabel(lastReloadAt, '暂无');
  const providerFormSubmitLabel = getAdminLLMProviderFormSubmitLabel(isEditingProvider);
  const providerFormTitle = getAdminLLMProviderFormTitle(isEditingProvider);
  const saveConfirmationTitle = getAdminLLMProviderSaveConfirmationTitle(isEditingProvider);
  const hasFormProviderName = form.name.length > 0;
  const formProviderDisplayName = getAdminLLMProviderDisplayLabel(form.display_name, form.name);
  const saveConfirmationDescription = hasFormProviderName === true
    ? `确定要${providerFormSubmitLabel}提供商“${formProviderDisplayName}”吗？`
    : '确定要保存当前 LLM Provider 配置吗？';
  const apiKeyPlaceholder = getAdminLLMProviderApiKeyPlaceholder(editingProvider);
  const runtimeMutationTitle = getAdminLLMRuntimeMutationTitle(pendingRuntimeMutation);
  const runtimeMutationDescription = getAdminLLMRuntimeMutationDescription(pendingRuntimeMutation);
  const deleteConfirmationDescription = getAdminLLMDeleteConfirmationDescription(deletingProvider);
  const driftCountClassName = getAdminLLMProviderDriftCountClassName(runtimeSummary.driftCount);
  const saveActionLabel = getAdminLLMProviderSaveActionLabel(saving);
  const runtimeMutationActionLabel = getAdminLLMProviderRuntimeMutationActionLabel(isMutatingProvider);
  const deleteActionLabel = getAdminLLMProviderDeleteActionLabel(isDeletingProvider);

  const handleReloadProviders = useCallback(async () => {
    setReloading(true);
    setError('');
    try {
      const result = await adminLLMApi.reload();
      const providerCount = getAdminLLMProviderCount(result.providers);
      const fallbackReloadMessage = `重载完成，当前已加载 ${providerCount} 个提供商`;
      setReloadMessage(getAdminLLMProviderDisplayLabel(result.message, fallbackReloadMessage));
      setLastReloadAt(new Date().toLocaleString());
      await loadProviders();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '重载失败');
      setReloadMessage(message);
      setLastReloadAt(new Date().toLocaleString());
      setError(message);
    } finally {
      setReloading(false);
    }
  }, [loadProviders]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaveConfirmationError('');
    try {
      const modelPayload = materializeAdminLLMProviderModelPayload(form.models_text);
      const savePayload: LLMProviderCreate = {
        ...form,
        model: getAdminLLMProviderDefaultModelFromText(form.models_text, ''),
        models: modelPayload,
      };
      delete (savePayload as Partial<AdminLLMProviderForm>).models_text;
      if (editingProvider !== null) {
        await adminLLMApi.updateProvider(editingProvider.id, savePayload);
      } else {
        await adminLLMApi.createProvider(savePayload);
      }
      resetForm();
      await loadProviders();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '保存失败');
      setSaveConfirmationError(message);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscoverModels = async () => {
    if (editingProvider === null) {
      return;
    }
    setDiscoveringModels(true);
    setError('');
    try {
      const result = await adminLLMApi.discoverModels(editingProvider.id);
      const discoveredModels = getAdminLLMDiscoveredModelsText(result.models);
      const discoveredDefaultModel = getAdminLLMProviderDefaultModelFromText(discoveredModels, '');
      setForm({
        ...form,
        model: discoveredDefaultModel,
        models_text: discoveredModels,
      });
      setProviders((previousProviders) => materializeAdminLLMProviderListAfterModelDiscovery(
        previousProviders,
        result,
        discoveredDefaultModel,
      ));
      setEditingProvider((previousProvider) => materializeAdminLLMEditingProviderAfterModelDiscovery(
        previousProvider,
        result,
        discoveredDefaultModel,
      ));
    } catch (err: unknown) {
      setError(formatAdminOperationFailure(err, '自动发现模型失败'));
    } finally {
      setDiscoveringModels(false);
    }
  };

  const openSaveConfirmation = () => {
    setSaveConfirmationError('');
    setSaveConfirmationOpen(true);
  };

  const handleDelete = async (id: AdminLLMProviderId) => {
    setIsDeletingProvider(true);
    setError('');
    setDeleteError('');
    try {
      await adminLLMApi.deleteProvider(id);
      setDeletingProvider(null);
      await loadProviders();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '删除失败');
      setDeleteError(message);
      setError(message);
    } finally {
      setIsDeletingProvider(false);
    }
  };

  const handleToggleEnabled = async (provider: LLMProvider) => {
    setIsMutatingProvider(true);
    setError('');
    setProviderMutationError('');
    try {
      await adminLLMApi.updateProvider(provider.id, { enabled: provider.enabled === false });
      setPendingRuntimeMutation(null);
      await loadProviders();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '切换状态失败');
      setProviderMutationError(message);
      setError(message);
    } finally {
      setIsMutatingProvider(false);
    }
  };

  const handleSetDefault = async (provider: LLMProvider) => {
    setIsMutatingProvider(true);
    setError('');
    setProviderMutationError('');
    try {
      await adminLLMApi.setDefault(provider.id);
      setPendingRuntimeMutation(null);
      await loadProviders();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '设置默认失败');
      setProviderMutationError(message);
      setError(message);
    } finally {
      setIsMutatingProvider(false);
    }
  };

  const openRuntimeMutationConfirmation = (
    kind: AdminLLMProviderRuntimeMutationKind,
    provider: LLMProvider,
  ) => {
    setProviderMutationError('');
    setPendingRuntimeMutation({ kind, provider });
  };

  const openDeleteConfirmation = (provider: LLMProvider) => {
    setDeleteError('');
    setDeletingProvider(provider);
  };

  const handleTestProviderConnection = async (provider: LLMProvider) => {
    setTestingProviderId(provider.id);
    setError('');
    const testModel = getAdminLLMProviderDefaultModel(provider);
    try {
      const result: AdminLLMProviderConnectionTestResponse = await adminLLMApi.testConnection(provider.name, testModel);
      setConnectionTest({
        providerId: provider.id,
        providerName: result.provider,
        model: result.model,
        hasApiKey: result.has_api_key,
        message: result.message,
        recovery: result.recovery,
        status: result.status,
        latencyMs: result.latency_ms,
        testedAt: new Date().toLocaleString(),
      });
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '连接预检失败');
      setConnectionTest({
        providerId: provider.id,
        providerName: provider.name,
        model: testModel,
        hasApiKey: provider.has_api_key,
        message,
        recovery: '检查 Admin API、后端日志和 Provider 配置后重试连接测试。',
        status: 'failed',
        latencyMs: 0,
        testedAt: new Date().toLocaleString(),
      });
      setError(message);
    } finally {
      setTestingProviderId(null);
    }
  };

  const handleConfirmRuntimeMutation = () => {
    if (
      pendingRuntimeMutation === null ||
      adminLLMProviderRuntimeMutationConfirmationSnapshot.canConfirm !== true
    ) {
      return;
    }
    if (pendingRuntimeMutation.kind === 'set_default') {
      void handleSetDefault(pendingRuntimeMutation.provider);
      return;
    }
    void handleToggleEnabled(pendingRuntimeMutation.provider);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <AdminLLMProvidersPageSnapshotStrip snapshot={adminLLMProvidersPageSnapshot} />
        <div className="text-gray-500">正在加载提供商...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">LLM 提供商管理</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            配置用于代码生成和方案分析的 AI 模型提供商
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void handleReloadProviders()}
            disabled={adminLLMProvidersPageSnapshot.canReload === false}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {reloadActionLabel}
          </button>
          <button
            onClick={openCreate}
            disabled={adminLLMProvidersPageSnapshot.canCreate === false}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + 新增提供商
          </button>
        </div>
      </div>
      <AdminLLMProvidersPageSnapshotStrip snapshot={adminLLMProvidersPageSnapshot} />

      {shouldRenderPageError === true && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">数据库配置</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{runtimeSummary.totalCount}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">其中启用 {runtimeSummary.enabledCount} 个</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">运行时已加载</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{runtimeSummary.loadedCount}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">当前默认：{defaultProviderNameLabel}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">当前运行中</p>
          <p className="mt-2 truncate text-lg font-semibold text-gray-900 dark:text-white">{runtimeSummary.activeProviderName}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">运行态 active provider</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">配置漂移</p>
          <p className={`mt-2 text-2xl font-semibold ${driftCountClassName}`}>
            {runtimeSummary.driftCount}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">启用但未加载的提供商数量</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <p className="text-gray-700 dark:text-gray-200">
            最近一次 reload 结果：
            <span className={`ml-2 font-medium ${reloadMessageClassName}`}>
              {reloadMessageLabel}
            </span>
          </p>
          <p className="text-gray-500 dark:text-gray-400">
            更新时间：{lastReloadAtLabel}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {shouldRenderEmptyProviders === true && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            暂未配置任何 LLM 提供商，点击“新增提供商”开始配置。
          </div>
        )}
        {materializeAdminLLMProviderCardNodes({
          providers,
          testingProviderId,
          connectionTest,
          onOpenRuntimeMutationConfirmation: openRuntimeMutationConfirmation,
          onOpenEdit: openEdit,
          onOpenDeleteConfirmation: openDeleteConfirmation,
          onTestConnection: (provider) => {
            void handleTestProviderConnection(provider);
          },
        })}
      </div>

      {shouldRenderProviderForm === true && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {providerFormTitle}
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名称（ID）</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      disabled={isEditingProvider === true}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50"
                      placeholder="deepseek"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">显示名称</label>
                    <input
                      value={form.display_name}
                      onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                      placeholder="DeepSeek"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">类型</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as AdminLLMProviderType })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    >
                      <option value="cloud">云端</option>
                      <option value="local">本地（Ollama）</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">优先级</label>
                    <input
                      type="number"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base URL</label>
                  <input
                    value={form.base_url}
                    onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono dark:bg-gray-700 dark:text-white"
                    placeholder="https://api.deepseek.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                  <input
                    type="password"
                    value={form.api_key}
                    onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono dark:bg-gray-700 dark:text-white"
                    placeholder={apiKeyPlaceholder}
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">模型列表（一行一个）</label>
                    <button
                      type="button"
                      onClick={() => void handleDiscoverModels()}
                      disabled={editingProvider === null || discoveringModels === true}
                      className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                      {discoveringModels === true ? '发现中...' : '自动发现模型'}
                    </button>
                  </div>
                  <textarea
                    value={form.models_text}
                    onChange={(e) => setForm({
                      ...form,
                      models_text: e.target.value,
                      model: getAdminLLMProviderDefaultModelFromText(e.target.value, ''),
                    })}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono dark:bg-gray-700 dark:text-white"
                    placeholder={'gpt-oss:120b\nqwen2.5-coder\nllama3.1'}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Provider 保存连接信息；这里配置该 Provider 下可选模型。第一行作为默认模型，可在 Workspace 下拉中分别选择。
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">启用</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_default}
                      onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">默认提供商</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={resetForm}
                  disabled={adminLLMProvidersPageSnapshot.canCancelForm === false}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={openSaveConfirmation}
                  disabled={adminLLMProvidersPageSnapshot.canSave === false}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {providerFormSubmitLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <AlertDialog
        open={saveConfirmationOpen}
        onOpenChange={(open) => {
          if (open === false && adminLLMProviderSaveConfirmationSnapshot.canCancel === true) {
            setSaveConfirmationOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {saveConfirmationTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {saveConfirmationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AdminLLMProviderSaveConfirmationSnapshotStrip snapshot={adminLLMProviderSaveConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={adminLLMProviderSaveConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={adminLLMProviderSaveConfirmationSnapshot.canConfirm === false}
              onClick={(event) => {
                event.preventDefault();
                if (adminLLMProviderSaveConfirmationSnapshot.canConfirm === true) {
                  void handleSave();
                }
              }}
            >
              {saveActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingRuntimeMutation !== null}
        onOpenChange={(open) => {
          if (open === false && adminLLMProviderRuntimeMutationConfirmationSnapshot.canCancel === true) {
            setPendingRuntimeMutation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {runtimeMutationTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {runtimeMutationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AdminLLMProviderRuntimeMutationConfirmationSnapshotStrip snapshot={adminLLMProviderRuntimeMutationConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={adminLLMProviderRuntimeMutationConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={adminLLMProviderRuntimeMutationConfirmationSnapshot.canConfirm === false}
              onClick={(event) => {
                event.preventDefault();
                if (adminLLMProviderRuntimeMutationConfirmationSnapshot.canConfirm === true) {
                  void handleConfirmRuntimeMutation();
                }
              }}
            >
              {runtimeMutationActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={deletingProvider !== null}
        onOpenChange={(open) => {
          if (open === false && adminLLMProviderDeleteConfirmationSnapshot.canCancel === true) {
            setDeletingProvider(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除提供商</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AdminLLMProviderDeleteConfirmationSnapshotStrip snapshot={adminLLMProviderDeleteConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={adminLLMProviderDeleteConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={adminLLMProviderDeleteConfirmationSnapshot.canConfirm === false}
              onClick={(event) => {
                event.preventDefault();
                if (deletingProvider !== null && adminLLMProviderDeleteConfirmationSnapshot.canConfirm === true) {
                  void handleDelete(deletingProvider.id);
                }
              }}
            >
              {deleteActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
