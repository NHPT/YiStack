import type {
  AdminLLMProviderConfirmationRiskLevel,
  AdminLLMProviderDeleteConfirmationSnapshot,
  AdminLLMProviderDeleteConfirmationSnapshotSource,
  AdminLLMProviderDeleteConfirmationSnapshotStatus,
  AdminLLMProviderFormMode,
  AdminLLMProviderReloadMessageState,
  AdminLLMProviderRuntimeMutationAction,
  AdminLLMProviderRuntimeMutationConfirmationSnapshot,
  AdminLLMProviderRuntimeMutationConfirmationSnapshotSource,
  AdminLLMProviderRuntimeMutationConfirmationSnapshotStatus,
  AdminLLMProviderRuntimeMutationKind as AdminLLMProviderRuntimeMutationKindContract,
  AdminLLMProviderSaveConfirmationSnapshot,
  AdminLLMProviderSaveConfirmationSnapshotSource,
  AdminLLMProviderSaveConfirmationSnapshotStatus,
  AdminLLMProvidersPageSnapshot,
  AdminLLMProvidersPageSnapshotSource,
  AdminLLMProvidersPageSnapshotStatus,
} from '../../workspace/workspace-types';
import type { AdminLLMProviderId, AdminLLMProviderType } from '@/lib/admin/api';
import type { AIModelName, AIModelProviderBaseUrl } from '@/lib/types';

export type AdminLLMProviderRuntimeMutationKind = AdminLLMProviderRuntimeMutationKindContract;

type AdminLLMProviderDeleteSnapshotInput = {
  id: AdminLLMProviderId;
  name: string;
  display_name?: string;
  enabled?: boolean;
  is_default?: boolean;
  runtime_loaded?: boolean;
  runtime_active?: boolean;
};

type AdminLLMProviderFormSnapshotInput = {
  name: string;
  display_name?: string;
  type?: AdminLLMProviderType;
  api_key?: string;
  base_url?: AIModelProviderBaseUrl;
  model?: AIModelName;
  enabled?: boolean;
  is_default?: boolean;
  priority?: number;
};

type AdminLLMResolvedProviderSnapshotInput = {
  hasProvider: boolean;
  providerId: AdminLLMProviderId | null;
  providerName: string | null;
  providerDisplayName: string | null;
  isDefaultProvider: boolean;
  isEnabled: boolean;
  isRuntimeLoaded: boolean;
  isRuntimeActive: boolean;
};

type AdminLLMProviderSaveEditingSnapshotInput = {
  id: AdminLLMProviderId;
  has_api_key?: boolean;
};

type AdminLLMResolvedSaveEditingProviderSnapshotInput = {
  hasEditingProvider: boolean;
  providerId: AdminLLMProviderId | null;
  hasExistingApiKey: boolean;
};

function getAdminLLMProviderSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = value !== null && value !== undefined && value.length > 0;

  return hasValue === true ? value : fallback;
}

function getAdminLLMProviderIdLabel(value: AdminLLMProviderId | null, fallback: string): string {
  if (value === null) {
    return fallback;
  }

  return String(value);
}

function getAdminLLMProviderNullableBooleanLabel(value: boolean | null, fallback: string): string {
  if (value === null) {
    return fallback;
  }

  return value === true ? 'yes' : 'no';
}

function getAdminLLMProviderBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function getAdminLLMProviderFormStringValue(value: string | undefined): string {
  const hasValue = value !== undefined;
  return hasValue === true ? value : '';
}

function getAdminLLMProviderFormType(value: AdminLLMProviderType | undefined): AdminLLMProviderType {
  const hasValue = value !== undefined;
  return hasValue === true ? value : 'cloud';
}

function getAdminLLMProviderFormPriority(value: number | undefined): number {
  const hasValue = value !== undefined && Number.isFinite(value) === true;
  return hasValue === true ? value : 0;
}

function getAdminLLMProviderRuntimeMutationAction(
  action: AdminLLMProviderRuntimeMutationKind | null,
): AdminLLMProviderRuntimeMutationAction {
  const hasAction = action !== null;
  if (hasAction === false) {
    return 'none';
  }

  return action;
}

function resolveAdminLLMProviderSnapshotInput(
  provider: AdminLLMProviderDeleteSnapshotInput | null,
): AdminLLMResolvedProviderSnapshotInput {
  const hasProvider = provider !== null;
  if (hasProvider === false) {
    return {
      hasProvider,
      providerId: null,
      providerName: null,
      providerDisplayName: null,
      isDefaultProvider: false,
      isEnabled: false,
      isRuntimeLoaded: false,
      isRuntimeActive: false,
    };
  }

  return {
    hasProvider,
    providerId: provider.id,
    providerName: provider.name,
    providerDisplayName: provider.display_name !== undefined ? provider.display_name : null,
    isDefaultProvider: provider.is_default === true,
    isEnabled: provider.enabled === true,
    isRuntimeLoaded: provider.runtime_loaded === true,
    isRuntimeActive: provider.runtime_active === true,
  };
}

function resolveAdminLLMProviderSaveEditingSnapshotInput(
  editingProvider: AdminLLMProviderSaveEditingSnapshotInput | null,
): AdminLLMResolvedSaveEditingProviderSnapshotInput {
  const hasEditingProvider = editingProvider !== null;
  if (hasEditingProvider === false) {
    return {
      hasEditingProvider,
      providerId: null,
      hasExistingApiKey: false,
    };
  }

  return {
    hasEditingProvider,
    providerId: editingProvider.id,
    hasExistingApiKey: editingProvider.has_api_key === true,
  };
}

export function buildAdminLLMProvidersPageSnapshot({
  loading,
  saving,
  reloading,
  error,
  providerCount,
  enabledCount,
  loadedCount,
  driftCount,
  defaultProviderName,
  activeProviderName,
  showForm,
  editingProviderId,
  deletingProviderId,
  form,
  reloadMessage,
  lastReloadAt,
}: {
  loading: boolean;
  saving: boolean;
  reloading: boolean;
  error: string;
  providerCount: number;
  enabledCount: number;
  loadedCount: number;
  driftCount: number;
  defaultProviderName: string;
  activeProviderName: string;
  showForm: boolean;
  editingProviderId: AdminLLMProviderId | null;
  deletingProviderId: AdminLLMProviderId | null;
  form: AdminLLMProviderFormSnapshotInput;
  reloadMessage: string;
  lastReloadAt: string;
}): AdminLLMProvidersPageSnapshot {
  const hasError = error.length > 0;
  const hasDeletingProvider = deletingProviderId !== null;
  const formMode: AdminLLMProviderFormMode = showForm
    ? editingProviderId === null
      ? 'create'
      : 'edit'
    : 'none';
  const nameLength = form.name.trim().length;
  const displayNameLength = getAdminLLMProviderFormStringValue(form.display_name).trim().length;
  const baseUrlLength = getAdminLLMProviderFormStringValue(form.base_url).trim().length;
  const modelLength = getAdminLLMProviderFormStringValue(form.model).trim().length;
  const formComplete = formMode === 'none' || nameLength > 0;
  const hasReloadMessage = reloadMessage.length > 0;
  const hasLastReloadAt = lastReloadAt.length > 0;
  const defaultProviderNameLabel = getAdminLLMProviderSnapshotLabel(defaultProviderName, 'none');
  const activeProviderNameLabel = getAdminLLMProviderSnapshotLabel(activeProviderName, 'none');
  const reloadMessageState: AdminLLMProviderReloadMessageState = hasReloadMessage === true
    ? reloadMessage.includes('失败') === true
      ? 'failed'
      : 'success'
    : 'none';
  const canCreate = loading === false && saving === false && reloading === false && formMode === 'none' && hasDeletingProvider === false;
  const canReload = loading === false && saving === false && reloading === false;
  const canSave = formMode !== 'none' && formComplete === true && loading === false && saving === false && reloading === false;
  const canCancelForm = formMode !== 'none' && saving === false;
  const canConfirmDelete = hasDeletingProvider === true && saving === false && reloading === false;
  const status: AdminLLMProvidersPageSnapshotStatus = loading === true
    ? 'loading'
    : hasError === true && hasDeletingProvider === true
      ? 'delete_failed'
      : hasError === true && formMode !== 'none'
        ? 'save_failed'
        : hasError === true && reloadMessageState === 'failed'
          ? 'reload_failed'
          : hasError === true
            ? 'load_failed'
            : saving === true
              ? 'saving'
              : reloading === true
                ? 'reloading'
                : hasDeletingProvider === true
                  ? 'delete_confirming'
                  : formMode !== 'none' && formComplete === false
                    ? 'form_incomplete'
                    : formMode === 'create'
                      ? 'creating'
                      : formMode === 'edit'
                        ? 'editing'
                        : providerCount === 0
                          ? 'empty'
                          : driftCount > 0
                            ? 'runtime_drift'
                            : 'ready';
  const source: AdminLLMProvidersPageSnapshotSource = status === 'loading' || status === 'load_failed' || status === 'empty' || status === 'ready'
    ? 'provider_list'
    : status === 'runtime_drift'
      ? 'provider_runtime'
      : status === 'reloading' || status === 'reload_failed'
        ? 'runtime_reload'
        : status === 'delete_confirming' || status === 'delete_failed'
          ? 'provider_delete'
          : 'provider_form';

  return {
    status,
    source,
    providerCount,
    enabledCount,
    loadedCount,
    driftCount,
    defaultProviderName: defaultProviderNameLabel,
    activeProviderName: activeProviderNameLabel,
    formMode,
    editingProviderId,
    deletingProviderId,
    nameLength,
    displayNameLength,
    baseUrlLength,
    modelLength,
    hasApiKeyInput: getAdminLLMProviderFormStringValue(form.api_key).length > 0,
    reloadMessageState,
    hasLastReloadAt,
    isLoading: loading,
    isSaving: saving,
    isReloading: reloading,
    hasError,
    canCreate,
    canReload,
    canSave,
    canCancelForm,
    canConfirmDelete,
    message: status === 'loading'
      ? 'Admin LLM Providers 正在加载提供商列表。'
      : status === 'load_failed'
        ? 'Admin LLM Providers 提供商列表加载失败。'
        : status === 'reload_failed'
          ? 'LLM 运行时 reload 失败，数据库配置与运行态可能不同步。'
          : status === 'save_failed'
            ? 'LLM Provider 保存失败，表单尚未确认写入后端。'
            : status === 'delete_failed'
              ? 'LLM Provider 删除失败，提供商仍可能保留在列表中。'
              : status === 'saving'
                ? '正在保存 LLM Provider，并将在保存后 reload 运行时。'
                : status === 'reloading'
                  ? '正在 reload LLM 运行时配置。'
                  : status === 'delete_confirming'
                    ? '正在确认删除 LLM Provider。'
                    : status === 'form_incomplete'
                      ? 'LLM Provider 表单尚未满足保存条件。'
                      : status === 'creating'
                        ? '正在创建新的 LLM Provider。'
                        : status === 'editing'
                          ? '正在编辑 LLM Provider。'
                          : status === 'empty'
                            ? '当前没有 LLM Provider 配置。'
                            : status === 'runtime_drift'
                              ? '存在已启用但未加载到运行时的 LLM Provider。'
                              : 'Admin LLM Providers 已就绪。',
    recovery: status === 'loading'
      ? '等待提供商列表请求返回。'
      : status === 'load_failed'
        ? '稍后刷新 LLM 提供商页或检查 Admin API 可用性。'
        : status === 'reload_failed'
          ? '检查 provider 配置和后端 reload 日志后重试 reload。'
          : status === 'save_failed'
            ? '检查名称、Base URL、模型和 API Key 后重试保存。'
            : status === 'delete_failed'
              ? '刷新列表确认删除状态，必要时重试删除。'
              : status === 'saving'
                ? '等待保存和 reload 完成，避免重复提交。'
                : status === 'reloading'
                  ? '等待 reload 完成，再判断运行时 active/default provider。'
                  : status === 'delete_confirming'
                    ? '确认风险后删除，或取消返回提供商列表。'
                    : status === 'form_incomplete'
                      ? '填写 provider 名称后再保存。'
                      : status === 'creating'
                        ? '确认 provider 名称、类型、Base URL、模型、API Key 和默认/启用状态后保存。'
                        : status === 'editing'
                          ? '确认配置变更后保存；API Key 留空会保持原值。'
                          : status === 'empty'
                            ? '新增 provider 后 reload 运行时。'
                            : status === 'runtime_drift'
                              ? '执行一次 reload，使启用的 provider 进入运行时。'
                              : '可以继续新增、编辑、切换、设默认或 reload provider。',
    updatedAt: 'derived',
  };
}

function getAdminLLMProvidersSnapshotClassName(snapshot: AdminLLMProvidersPageSnapshot) {
  if (snapshot.status === 'load_failed' || snapshot.status === 'reload_failed' || snapshot.status === 'save_failed' || snapshot.status === 'delete_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'loading' || snapshot.status === 'saving' || snapshot.status === 'reloading') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (snapshot.status === 'empty' || snapshot.status === 'runtime_drift' || snapshot.status === 'creating' || snapshot.status === 'editing' || snapshot.status === 'form_incomplete' || snapshot.status === 'delete_confirming') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

export function AdminLLMProvidersPageSnapshotStrip({ snapshot }: { snapshot: AdminLLMProvidersPageSnapshot }) {
  const editingProviderIdLabel = getAdminLLMProviderIdLabel(snapshot.editingProviderId, 'none');
  const deletingProviderIdLabel = getAdminLLMProviderIdLabel(snapshot.deletingProviderId, 'none');
  const hasApiKeyInputLabel = getAdminLLMProviderBooleanLabel(snapshot.hasApiKeyInput);
  const hasLastReloadAtLabel = getAdminLLMProviderBooleanLabel(snapshot.hasLastReloadAt);
  const isLoadingLabel = getAdminLLMProviderBooleanLabel(snapshot.isLoading);
  const isSavingLabel = getAdminLLMProviderBooleanLabel(snapshot.isSaving);
  const isReloadingLabel = getAdminLLMProviderBooleanLabel(snapshot.isReloading);
  const hasErrorLabel = getAdminLLMProviderBooleanLabel(snapshot.hasError);
  const canCreateLabel = getAdminLLMProviderBooleanLabel(snapshot.canCreate);
  const canReloadLabel = getAdminLLMProviderBooleanLabel(snapshot.canReload);
  const canSaveLabel = getAdminLLMProviderBooleanLabel(snapshot.canSave);
  const canCancelFormLabel = getAdminLLMProviderBooleanLabel(snapshot.canCancelForm);
  const canConfirmDeleteLabel = getAdminLLMProviderBooleanLabel(snapshot.canConfirmDelete);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-llm-providers-page-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminLLMProvidersSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin LLM Providers 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Providers: {snapshot.providerCount}</span>
        <span>Enabled: {snapshot.enabledCount}</span>
        <span>Loaded: {snapshot.loadedCount}</span>
        <span>Drift: {snapshot.driftCount}</span>
        <span>Default: {snapshot.defaultProviderName}</span>
        <span>Active: {snapshot.activeProviderName}</span>
        <span>Mode: {snapshot.formMode}</span>
        <span>Editing: {editingProviderIdLabel}</span>
        <span>Deleting: {deletingProviderIdLabel}</span>
        <span>NameChars: {snapshot.nameLength}</span>
        <span>DisplayChars: {snapshot.displayNameLength}</span>
        <span>BaseUrlChars: {snapshot.baseUrlLength}</span>
        <span>ModelChars: {snapshot.modelLength}</span>
        <span>ApiKeyInput: {hasApiKeyInputLabel}</span>
        <span>ReloadMessage: {snapshot.reloadMessageState}</span>
        <span>ReloadAt: {hasLastReloadAtLabel}</span>
        <span>Loading: {isLoadingLabel}</span>
        <span>Saving: {isSavingLabel}</span>
        <span>Reloading: {isReloadingLabel}</span>
        <span>Error: {hasErrorLabel}</span>
        <span>Create: {canCreateLabel}</span>
        <span>Reload: {canReloadLabel}</span>
        <span>Save: {canSaveLabel}</span>
        <span>CancelForm: {canCancelFormLabel}</span>
        <span>ConfirmDelete: {canConfirmDeleteLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function buildAdminLLMProviderSaveConfirmationSnapshot({
  form,
  formMode,
  editingProvider,
  isOpen,
  saving,
  error,
}: {
  form: AdminLLMProviderFormSnapshotInput;
  formMode: AdminLLMProviderFormMode;
  editingProvider: AdminLLMProviderSaveEditingSnapshotInput | null;
  isOpen: boolean;
  saving: boolean;
  error: string;
}): AdminLLMProviderSaveConfirmationSnapshot {
  const resolvedEditingProvider = resolveAdminLLMProviderSaveEditingSnapshotInput(editingProvider);
  const trimmedProviderName = form.name.trim();
  const trimmedProviderDisplayName = getAdminLLMProviderFormStringValue(form.display_name).trim();
  const trimmedBaseUrl = getAdminLLMProviderFormStringValue(form.base_url).trim();
  const trimmedModel = getAdminLLMProviderFormStringValue(form.model).trim();
  const hasForm = formMode !== 'none' && trimmedProviderName.length > 0;
  const hasError = error.length > 0 && isOpen === true && hasForm === true;
  const hasApiKeyInput = getAdminLLMProviderFormStringValue(form.api_key).length > 0;
  const hasExistingApiKey = resolvedEditingProvider.hasExistingApiKey;
  const preservesExistingApiKey = formMode === 'edit' && hasApiKeyInput === false && hasExistingApiKey === true;
  const providerNameLabel = getAdminLLMProviderSnapshotLabel(trimmedProviderName, 'none');
  const providerDisplayNameLabel = getAdminLLMProviderSnapshotLabel(
    trimmedProviderDisplayName,
    providerNameLabel,
  );
  const willEnableProvider = form.enabled === true;
  const willSetDefaultProvider = form.is_default === true;
  const canConfirm = isOpen === true && hasForm === true && saving === false;
  const canCancel = isOpen === true && hasForm === true && saving === false;
  const status: AdminLLMProviderSaveConfirmationSnapshotStatus = isOpen === false || hasForm === false
    ? 'closed'
    : saving === true
      ? 'confirming'
      : hasError === true
        ? 'save_failed'
        : 'awaiting_confirmation';
  const source: AdminLLMProviderSaveConfirmationSnapshotSource = status === 'closed'
    ? 'dialog_state'
    : formMode === 'create'
      ? 'provider_create'
      : willEnableProvider === true || willSetDefaultProvider === true
        ? 'provider_runtime'
        : 'provider_update';
  const riskLevel: AdminLLMProviderConfirmationRiskLevel = hasForm === false
    ? 'none'
    : willSetDefaultProvider === true || (willEnableProvider === true && formMode === 'create')
      ? 'high'
      : willEnableProvider === true || hasApiKeyInput === true
        ? 'medium'
        : 'medium';

  return {
    status,
    source,
    formMode,
    providerId: resolvedEditingProvider.providerId,
    providerName: providerNameLabel,
    providerDisplayName: providerDisplayNameLabel,
    providerType: getAdminLLMProviderFormType(form.type),
    baseUrlLength: trimmedBaseUrl.length,
    modelLength: trimmedModel.length,
    hasApiKeyInput,
    preservesExistingApiKey,
    willEnableProvider,
    willSetDefaultProvider,
    priority: getAdminLLMProviderFormPriority(form.priority),
    isSaving: saving,
    hasError,
    canConfirm,
    canCancel,
    riskLevel,
    message: status === 'closed'
      ? 'Admin LLM Provider 保存确认弹窗未打开。'
      : status === 'confirming'
        ? '正在保存 LLM Provider，并将在保存后 reload 运行时。'
        : status === 'save_failed'
          ? 'LLM Provider 保存失败，表单尚未确认写入后端。'
          : formMode === 'create'
            ? '正在确认创建新的 LLM Provider，可能改变后续生成可用 provider 集合。'
            : '正在确认更新 LLM Provider，保存后会 reload 运行时配置。',
    recovery: status === 'closed'
      ? '打开保存确认弹窗后会展示 provider 名称、类型、模型、API Key 与运行态影响。'
      : status === 'confirming'
        ? '等待保存和 reload 完成，避免重复提交 provider 配置。'
        : status === 'save_failed'
          ? '保留当前表单，检查名称、Base URL、模型、API Key 和 Admin API 错误后重试，或取消返回列表。'
          : willSetDefaultProvider
            ? '确认 provider 配置可用且适合作为默认 provider；保存后检查 default/active provider 与 Provider Health。'
            : willEnableProvider
              ? '确认 provider 可连通；保存后检查 runtime loaded 状态，如仍有 drift 可手动 reload。'
              : preservesExistingApiKey
                ? 'API Key 留空将沿用后端已有密钥；确认其他字段无误后保存。'
                : '确认 provider 字段无误后保存；保存后检查 reload 结果。',
    updatedAt: 'derived',
  };
}

function getAdminLLMProviderSaveConfirmationSnapshotClassName(
  snapshot: AdminLLMProviderSaveConfirmationSnapshot,
) {
  if (snapshot.status === 'save_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (snapshot.status === 'awaiting_confirmation' || snapshot.riskLevel === 'high') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-300';
}

export function AdminLLMProviderSaveConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminLLMProviderSaveConfirmationSnapshot;
}) {
  const providerIdLabel = getAdminLLMProviderIdLabel(snapshot.providerId, 'new');
  const hasApiKeyInputLabel = getAdminLLMProviderBooleanLabel(snapshot.hasApiKeyInput);
  const preservesExistingApiKeyLabel = getAdminLLMProviderBooleanLabel(snapshot.preservesExistingApiKey);
  const willEnableProviderLabel = getAdminLLMProviderBooleanLabel(snapshot.willEnableProvider);
  const willSetDefaultProviderLabel = getAdminLLMProviderBooleanLabel(snapshot.willSetDefaultProvider);
  const isSavingLabel = getAdminLLMProviderBooleanLabel(snapshot.isSaving);
  const hasErrorLabel = getAdminLLMProviderBooleanLabel(snapshot.hasError);
  const canConfirmLabel = getAdminLLMProviderBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getAdminLLMProviderBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-llm-provider-save-confirmation-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminLLMProviderSaveConfirmationSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin LLM Provider 保存确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Mode: {snapshot.formMode}</span>
        <span>Provider: {providerIdLabel}</span>
        <span>Name: {snapshot.providerName}</span>
        <span>Display: {snapshot.providerDisplayName}</span>
        <span>Type: {snapshot.providerType}</span>
        <span>BaseUrlChars: {snapshot.baseUrlLength}</span>
        <span>ModelChars: {snapshot.modelLength}</span>
        <span>ApiKeyInput: {hasApiKeyInputLabel}</span>
        <span>PreserveKey: {preservesExistingApiKeyLabel}</span>
        <span>Enable: {willEnableProviderLabel}</span>
        <span>Default: {willSetDefaultProviderLabel}</span>
        <span>Priority: {snapshot.priority}</span>
        <span>Saving: {isSavingLabel}</span>
        <span>Error: {hasErrorLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function buildAdminLLMProviderRuntimeMutationConfirmationSnapshot({
  action,
  provider,
  isMutating,
  error,
}: {
  action: AdminLLMProviderRuntimeMutationKind | null;
  provider: AdminLLMProviderDeleteSnapshotInput | null;
  isMutating: boolean;
  error: string;
}): AdminLLMProviderRuntimeMutationConfirmationSnapshot {
  const resolvedProvider = resolveAdminLLMProviderSnapshotInput(provider);
  const hasProvider = resolvedProvider.hasProvider;
  const hasAction = action !== null;
  const actionValue = getAdminLLMProviderRuntimeMutationAction(action);
  const hasError = error.length > 0 && hasProvider === true;
  const isDefaultProvider = resolvedProvider.isDefaultProvider;
  const isEnabled = resolvedProvider.isEnabled;
  const isRuntimeLoaded = resolvedProvider.isRuntimeLoaded;
  const isRuntimeActive = resolvedProvider.isRuntimeActive;
  const nextEnabled = action === 'toggle_enabled' && hasProvider === true ? isEnabled === false : null;
  const canConfirm = hasProvider === true && hasAction === true && isMutating === false;
  const canCancel = hasProvider === true && hasAction === true && isMutating === false;
  const status: AdminLLMProviderRuntimeMutationConfirmationSnapshotStatus = hasProvider === false || hasAction === false
    ? 'closed'
    : isMutating === true
      ? 'confirming'
      : hasError === true
        ? 'mutation_failed'
        : 'awaiting_confirmation';
  const source: AdminLLMProviderRuntimeMutationConfirmationSnapshotSource = status === 'closed'
    ? 'dialog_state'
    : action === 'set_default'
      ? 'provider_default'
      : 'provider_runtime';
  const riskLevel: AdminLLMProviderConfirmationRiskLevel = hasProvider === false || hasAction === false
    ? 'none'
    : action === 'set_default' || (action === 'toggle_enabled' && (isDefaultProvider === true || isRuntimeActive === true))
      ? 'high'
      : 'medium';

  return {
    status,
    source,
    action: actionValue,
    providerId: resolvedProvider.providerId,
    providerName: resolvedProvider.providerName,
    providerDisplayName: resolvedProvider.providerDisplayName,
    isDefaultProvider,
    isEnabled,
    nextEnabled,
    isRuntimeLoaded,
    isRuntimeActive,
    isMutating,
    hasError,
    canConfirm,
    canCancel,
    riskLevel,
    message: status === 'closed'
      ? 'Admin LLM Provider 运行态变更确认弹窗未打开。'
      : status === 'confirming'
        ? '正在提交 LLM Provider 运行态变更，确认与取消入口暂时锁定。'
        : status === 'mutation_failed'
          ? 'LLM Provider 运行态变更失败，数据库配置与运行态可能未完成同步。'
          : action === 'set_default'
            ? '正在确认切换默认 LLM Provider，后续生成会优先使用新的默认 provider。'
            : nextEnabled
              ? '正在确认启用 LLM Provider，保存后需要 reload 运行时才能生效。'
              : isDefaultProvider || isRuntimeActive
                ? '正在确认禁用当前默认或运行中 LLM Provider，可能影响后续生成请求。'
                : '正在确认禁用 LLM Provider。',
    recovery: status === 'closed'
      ? '打开启用、禁用或设为默认确认弹窗后会展示运行态影响和恢复建议。'
      : status === 'confirming'
        ? '等待配置写入和 reload 完成，避免重复提交。'
        : status === 'mutation_failed'
          ? '保留当前弹窗，检查 Admin API 或后端 reload 日志后重试，或取消并刷新 provider 列表确认状态。'
          : action === 'set_default'
            ? '确认目标 provider 已启用且配置可用；变更后检查 active/default provider 与 Provider Health。'
            : nextEnabled
              ? '启用后检查运行时 loaded 状态；如仍有 drift，手动执行 reload。'
              : isDefaultProvider === true || isRuntimeActive === true
                ? '禁用前确认已有替代 provider；禁用后检查默认 provider、active provider 和生成能力。'
                : '确认不再需要该 provider 参与运行时后再禁用。',
    updatedAt: 'derived',
  };
}

function getAdminLLMProviderRuntimeMutationConfirmationSnapshotClassName(
  snapshot: AdminLLMProviderRuntimeMutationConfirmationSnapshot,
) {
  if (snapshot.status === 'mutation_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (snapshot.status === 'awaiting_confirmation' || snapshot.riskLevel === 'high') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-300';
}

export function AdminLLMProviderRuntimeMutationConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminLLMProviderRuntimeMutationConfirmationSnapshot;
}) {
  const providerIdLabel = getAdminLLMProviderIdLabel(snapshot.providerId, 'none');
  const providerNameLabel = getAdminLLMProviderSnapshotLabel(snapshot.providerName, 'none');
  const isDefaultProviderLabel = getAdminLLMProviderBooleanLabel(snapshot.isDefaultProvider);
  const isEnabledLabel = getAdminLLMProviderBooleanLabel(snapshot.isEnabled);
  const nextEnabledLabel = getAdminLLMProviderNullableBooleanLabel(snapshot.nextEnabled, 'none');
  const isRuntimeLoadedLabel = getAdminLLMProviderBooleanLabel(snapshot.isRuntimeLoaded);
  const isRuntimeActiveLabel = getAdminLLMProviderBooleanLabel(snapshot.isRuntimeActive);
  const isMutatingLabel = getAdminLLMProviderBooleanLabel(snapshot.isMutating);
  const canConfirmLabel = getAdminLLMProviderBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getAdminLLMProviderBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-llm-provider-runtime-mutation-confirmation-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminLLMProviderRuntimeMutationConfirmationSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin LLM Provider 运行态变更确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Provider: {providerIdLabel}</span>
        <span>Name: {providerNameLabel}</span>
        <span>Default: {isDefaultProviderLabel}</span>
        <span>Enabled: {isEnabledLabel}</span>
        <span>NextEnabled: {nextEnabledLabel}</span>
        <span>Loaded: {isRuntimeLoadedLabel}</span>
        <span>Active: {isRuntimeActiveLabel}</span>
        <span>Mutating: {isMutatingLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function buildAdminLLMProviderDeleteConfirmationSnapshot({
  provider,
  isDeleting,
  error,
}: {
  provider: AdminLLMProviderDeleteSnapshotInput | null;
  isDeleting: boolean;
  error: string;
}): AdminLLMProviderDeleteConfirmationSnapshot {
  const resolvedProvider = resolveAdminLLMProviderSnapshotInput(provider);
  const hasProvider = resolvedProvider.hasProvider;
  const hasError = error.length > 0 && hasProvider === true;
  const isDefaultProvider = resolvedProvider.isDefaultProvider;
  const isEnabled = resolvedProvider.isEnabled;
  const isRuntimeLoaded = resolvedProvider.isRuntimeLoaded;
  const isRuntimeActive = resolvedProvider.isRuntimeActive;
  const canConfirm = hasProvider === true && isDeleting === false;
  const canCancel = hasProvider === true && isDeleting === false;
  const status: AdminLLMProviderDeleteConfirmationSnapshotStatus = hasProvider === false
    ? 'closed'
    : isDeleting === true
      ? 'confirming'
      : hasError === true
        ? 'delete_failed'
        : 'awaiting_confirmation';
  const source: AdminLLMProviderDeleteConfirmationSnapshotSource = status === 'closed'
    ? 'dialog_state'
    : isRuntimeLoaded === true || isRuntimeActive === true
      ? 'provider_runtime'
      : 'provider_delete';
  const riskLevel: AdminLLMProviderConfirmationRiskLevel = hasProvider === false
    ? 'none'
    : isDefaultProvider === true || isRuntimeActive === true
      ? 'high'
      : 'medium';

  return {
    status,
    source,
    providerId: resolvedProvider.providerId,
    providerName: resolvedProvider.providerName,
    providerDisplayName: resolvedProvider.providerDisplayName,
    isDefaultProvider,
    isEnabled,
    isRuntimeLoaded,
    isRuntimeActive,
    isDeleting,
    hasError,
    canConfirm,
    canCancel,
    riskLevel,
    message: status === 'closed'
      ? 'Admin LLM Provider 删除确认弹窗未打开。'
      : status === 'confirming'
        ? '正在删除 LLM Provider，确认与取消入口暂时锁定。'
        : status === 'delete_failed'
          ? 'LLM Provider 删除失败，当前 provider 仍可能保留在数据库和运行态中。'
          : isDefaultProvider === true
            ? '正在确认删除默认 LLM Provider，删除后需要重新确认默认 provider 与运行态 reload。'
            : isRuntimeLoaded === true || isRuntimeActive === true
              ? '正在确认删除已加载到运行态的 LLM Provider，删除后需要 reload 运行时。'
              : '正在确认删除 LLM Provider。',
    recovery: status === 'closed'
      ? '打开删除确认弹窗后会展示 provider 身份、运行态影响和恢复建议。'
      : status === 'confirming'
        ? '等待删除请求和 reload 完成，避免重复提交。'
        : status === 'delete_failed'
          ? '保留当前弹窗，检查 Admin API 或后端 provider 删除错误后重试，或取消并刷新列表确认状态。'
          : isDefaultProvider === true
            ? '删除前确认已有替代默认 provider；删除后检查默认 provider 与运行态 active provider。'
            : isRuntimeLoaded === true || isRuntimeActive === true
              ? '删除后执行 reload 并确认 Provider Health 是否仍有配置态与运行态漂移。'
              : '确认不再需要该 provider 后删除；取消不会修改 provider 配置。',
    updatedAt: 'derived',
  };
}

function getAdminLLMProviderDeleteConfirmationSnapshotClassName(
  snapshot: AdminLLMProviderDeleteConfirmationSnapshot,
) {
  if (snapshot.status === 'delete_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (snapshot.status === 'awaiting_confirmation' || snapshot.riskLevel === 'high') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-300';
}

export function AdminLLMProviderDeleteConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminLLMProviderDeleteConfirmationSnapshot;
}) {
  const providerIdLabel = getAdminLLMProviderIdLabel(snapshot.providerId, 'none');
  const providerNameLabel = getAdminLLMProviderSnapshotLabel(snapshot.providerName, 'none');
  const isDefaultProviderLabel = getAdminLLMProviderBooleanLabel(snapshot.isDefaultProvider);
  const isEnabledLabel = getAdminLLMProviderBooleanLabel(snapshot.isEnabled);
  const isRuntimeLoadedLabel = getAdminLLMProviderBooleanLabel(snapshot.isRuntimeLoaded);
  const isRuntimeActiveLabel = getAdminLLMProviderBooleanLabel(snapshot.isRuntimeActive);
  const isDeletingLabel = getAdminLLMProviderBooleanLabel(snapshot.isDeleting);
  const canConfirmLabel = getAdminLLMProviderBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getAdminLLMProviderBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-llm-provider-delete-confirmation-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminLLMProviderDeleteConfirmationSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin LLM Provider 删除确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Provider: {providerIdLabel}</span>
        <span>Name: {providerNameLabel}</span>
        <span>Default: {isDefaultProviderLabel}</span>
        <span>Enabled: {isEnabledLabel}</span>
        <span>Loaded: {isRuntimeLoadedLabel}</span>
        <span>Active: {isRuntimeActiveLabel}</span>
        <span>Deleting: {isDeletingLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
