import type {
  AdminConfigPageSnapshot,
  AdminConfigPageSnapshotSource,
  AdminConfigPageSnapshotStatus,
  AdminConfigSaveConfirmationSnapshot,
  AdminConfigSaveConfirmationSnapshotSource,
  AdminConfigSaveConfirmationSnapshotStatus,
  AdminConfigSaveConfirmationRiskLevel,
} from '../../workspace/workspace-types';
import type {
  AdminSystemConfigKey,
  AdminSystemConfigPublicFlag,
  AdminSystemConfigValueType,
} from '@/lib/admin/api';

type AdminConfigSaveConfigInput = {
  key: AdminSystemConfigKey;
  value_type?: AdminSystemConfigValueType;
  is_public?: AdminSystemConfigPublicFlag;
} | null;

function getAdminConfigSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = value !== null && value !== undefined && value.length > 0;

  return hasValue === true ? value : fallback;
}

function getAdminConfigSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function getAdminConfigPublicFlagLabel(value: AdminSystemConfigPublicFlag | null): string {
  if (value === null) {
    return 'missing';
  }

  return value === true ? 'yes' : 'no';
}

export function buildAdminConfigPageSnapshot({
  loading,
  saving,
  error,
  configCount,
  groupCount,
  containerConfigCount,
  generalConfigCount,
  editableConfigCount,
  canEditAll,
  canEditContainer,
  editingKey,
  editValue,
}: {
  loading: boolean;
  saving: boolean;
  error: string;
  configCount: number;
  groupCount: number;
  containerConfigCount: number;
  generalConfigCount: number;
  editableConfigCount: number;
  canEditAll: boolean;
  canEditContainer: boolean;
  editingKey: AdminSystemConfigKey | null;
  editValue: string;
}): AdminConfigPageSnapshot {
  const hasError = error.length > 0;
  const hasEditingKey = editingKey !== null && editingKey.length > 0;
  const canStartEdit = loading === false && saving === false && hasEditingKey === false && editableConfigCount > 0;
  const canSave = hasEditingKey === true && loading === false && saving === false;
  const canCancel = hasEditingKey === true && saving === false;
  const status: AdminConfigPageSnapshotStatus = loading === true
    ? 'loading'
    : hasError === true && hasEditingKey === true
      ? 'save_failed'
      : hasError === true
        ? 'load_failed'
        : saving === true
          ? 'saving'
          : hasEditingKey === true
            ? 'editing'
            : configCount === 0
              ? 'empty'
              : 'ready';
  const source: AdminConfigPageSnapshotSource = status === 'loading' || status === 'load_failed' || status === 'empty' || status === 'ready'
    ? 'config_list'
    : status === 'saving' || status === 'save_failed'
      ? 'config_save'
      : editableConfigCount > 0
        ? 'config_edit'
        : 'config_permission';

  return {
    status,
    source,
    configCount,
    groupCount,
    containerConfigCount,
    generalConfigCount,
    editableConfigCount,
    canEditAll,
    canEditContainer,
    editingKey,
    editValueLength: editValue.length,
    isLoading: loading,
    isSaving: saving,
    hasError,
    canStartEdit,
    canSave,
    canCancel,
    message: status === 'loading'
      ? 'Admin Config 正在加载配置列表。'
      : status === 'load_failed'
        ? 'Admin Config 配置列表加载失败。'
        : status === 'save_failed'
          ? 'Admin Config 保存失败，当前编辑值尚未确认写入后端。'
          : status === 'saving'
            ? 'Admin Config 正在保存当前配置。'
            : status === 'editing'
              ? 'Admin Config 正在编辑配置项。'
              : status === 'empty'
                ? 'Admin Config 当前没有配置项可展示。'
                : 'Admin Config 已就绪。',
    recovery: status === 'loading'
      ? '等待配置列表请求返回。'
      : status === 'load_failed'
        ? '稍后刷新配置页或检查 Admin API 可用性。'
        : status === 'save_failed'
          ? '检查配置值后重试保存；必要时刷新页面确认后端配置。'
          : status === 'saving'
            ? '等待保存请求完成，避免重复提交。'
            : status === 'editing'
              ? '确认配置值后保存，或取消返回只读列表。'
              : status === 'empty'
                ? '确认当前环境是否已初始化系统配置。'
                : editableConfigCount > 0
                  ? '可按权限编辑系统配置或容器配置。'
                  : '当前管理员仅可查看配置。',
    updatedAt: 'derived',
  };
}

function getAdminConfigSnapshotClassName(snapshot: AdminConfigPageSnapshot) {
  if (snapshot.status === 'load_failed' || snapshot.status === 'save_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'loading' || snapshot.status === 'saving') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (snapshot.status === 'empty' || snapshot.status === 'editing') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

export function AdminConfigPageSnapshotStrip({ snapshot }: { snapshot: AdminConfigPageSnapshot }) {
  const canEditAllLabel = getAdminConfigSnapshotBooleanLabel(snapshot.canEditAll);
  const canEditContainerLabel = getAdminConfigSnapshotBooleanLabel(snapshot.canEditContainer);
  const editingKeyLabel = getAdminConfigSnapshotLabel(snapshot.editingKey, 'none');
  const isLoadingLabel = getAdminConfigSnapshotBooleanLabel(snapshot.isLoading);
  const isSavingLabel = getAdminConfigSnapshotBooleanLabel(snapshot.isSaving);
  const hasErrorLabel = getAdminConfigSnapshotBooleanLabel(snapshot.hasError);
  const canStartEditLabel = getAdminConfigSnapshotBooleanLabel(snapshot.canStartEdit);
  const canSaveLabel = getAdminConfigSnapshotBooleanLabel(snapshot.canSave);
  const canCancelLabel = getAdminConfigSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-config-page-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminConfigSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Config 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Configs: {snapshot.configCount}</span>
        <span>Groups: {snapshot.groupCount}</span>
        <span>Container: {snapshot.containerConfigCount}</span>
        <span>General: {snapshot.generalConfigCount}</span>
        <span>Editable: {snapshot.editableConfigCount}</span>
        <span>EditAll: {canEditAllLabel}</span>
        <span>EditContainer: {canEditContainerLabel}</span>
        <span>Editing: {editingKeyLabel}</span>
        <span>ValueChars: {snapshot.editValueLength}</span>
        <span>Loading: {isLoadingLabel}</span>
        <span>Saving: {isSavingLabel}</span>
        <span>Error: {hasErrorLabel}</span>
        <span>StartEdit: {canStartEditLabel}</span>
        <span>Save: {canSaveLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function buildAdminConfigSaveConfirmationSnapshot({
  config,
  editValue,
  isOpen,
  saving,
  error,
}: {
  config: AdminConfigSaveConfigInput;
  editValue: string;
  isOpen: boolean;
  saving: boolean;
  error: string;
}): AdminConfigSaveConfirmationSnapshot {
  const configKey = config !== null ? config.key : null;
  const hasConfig = configKey !== null && configKey.length > 0;
  const isContainerConfig = configKey !== null && configKey.startsWith('container.') === true;
  const isPromptConfig = configKey !== null && configKey.startsWith('prompt.') === true;
  const hasError = error.length > 0 && isOpen === true && hasConfig === true;
  const canConfirm = isOpen === true && hasConfig === true && saving === false;
  const canCancel = isOpen === true && hasConfig === true && saving === false;
  const status: AdminConfigSaveConfirmationSnapshotStatus = isOpen === false || hasConfig === false
    ? 'closed'
    : saving === true
      ? 'confirming'
      : hasError === true
        ? 'save_failed'
        : 'awaiting_confirmation';
  const source: AdminConfigSaveConfirmationSnapshotSource = status === 'closed'
    ? 'dialog_state'
    : isContainerConfig === true
      ? 'container_config_save'
      : isPromptConfig === true
        ? 'prompt_config_save'
        : 'config_save';
  const riskLevel: AdminConfigSaveConfirmationRiskLevel = hasConfig === false
    ? 'none'
    : isContainerConfig === true || isPromptConfig === true
      ? 'high'
      : 'medium';

  return {
    status,
    source,
    configKey,
    valueType: config?.value_type ?? null,
    editValueLength: editValue.length,
    isContainerConfig,
    isPromptConfig,
    isPublicConfig: config?.is_public ?? null,
    isSaving: saving,
    hasError,
    canConfirm,
    canCancel,
    riskLevel,
    message: status === 'closed'
      ? 'Admin Config 保存确认弹窗未打开。'
      : status === 'confirming'
        ? '正在保存系统配置，确认与取消入口暂时锁定。'
        : status === 'save_failed'
          ? '系统配置保存失败，当前编辑值尚未确认写入后端。'
          : isContainerConfig
            ? '正在确认保存容器配置，可能影响项目运行时启动和镜像/目录/端口行为。'
            : isPromptConfig
              ? '正在确认保存 Prompt 配置，可能影响后续方案生成或对话生成行为。'
              : '正在确认保存系统配置。',
    recovery: status === 'closed'
      ? '打开保存确认弹窗后会展示配置 key、类型、编辑值长度和风险等级。'
      : status === 'confirming'
        ? '等待保存请求完成，避免重复提交系统配置。'
        : status === 'save_failed'
          ? '保留当前编辑值，检查配置格式和 Admin API 错误后重试，或取消返回只读列表。'
          : isContainerConfig
            ? '确认容器配置值符合运行时契约；保存后必要时重新验证项目 runtime。'
            : isPromptConfig
              ? '确认 Prompt 内容符合 YES 注入事实要求；保存后可通过生成链路验证效果。'
              : '确认配置值无误后保存。',
    updatedAt: 'derived',
  };
}

function getAdminConfigSaveConfirmationSnapshotClassName(snapshot: AdminConfigSaveConfirmationSnapshot) {
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

export function AdminConfigSaveConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminConfigSaveConfirmationSnapshot;
}) {
  const configKeyLabel = getAdminConfigSnapshotLabel(snapshot.configKey, 'none');
  const valueTypeLabel = getAdminConfigSnapshotLabel(snapshot.valueType, 'missing');
  const isContainerConfigLabel = getAdminConfigSnapshotBooleanLabel(snapshot.isContainerConfig);
  const isPromptConfigLabel = getAdminConfigSnapshotBooleanLabel(snapshot.isPromptConfig);
  const isPublicConfigLabel = getAdminConfigPublicFlagLabel(snapshot.isPublicConfig);
  const isSavingLabel = getAdminConfigSnapshotBooleanLabel(snapshot.isSaving);
  const hasErrorLabel = getAdminConfigSnapshotBooleanLabel(snapshot.hasError);
  const canConfirmLabel = getAdminConfigSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getAdminConfigSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-config-save-confirmation-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminConfigSaveConfirmationSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Config 保存确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Key: {configKeyLabel}</span>
        <span>Type: {valueTypeLabel}</span>
        <span>ValueChars: {snapshot.editValueLength}</span>
        <span>Container: {isContainerConfigLabel}</span>
        <span>Prompt: {isPromptConfigLabel}</span>
        <span>Public: {isPublicConfigLabel}</span>
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
