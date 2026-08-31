import type { AdminTemplateConfigKey } from '@/lib/admin/api';
import type {
  AdminTemplatePageSnapshot,
  AdminTemplatePageSnapshotSource,
  AdminTemplatePageSnapshotStatus,
  AdminTemplateProfileCategory,
  AdminTemplateProfileTitle,
  AdminTemplateSaveConfirmationRiskLevel,
  AdminTemplateSaveConfirmationSnapshot,
  AdminTemplateSaveConfirmationSnapshotSource,
  AdminTemplateSaveConfirmationSnapshotStatus,
} from '../../workspace/workspace-types';

type AdminTemplateSaveProfileSnapshotInput = {
  title: AdminTemplateProfileTitle;
  category: AdminTemplateProfileCategory;
} | null;

function getAdminTemplateSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = value !== null && value !== undefined && value.length > 0;

  return hasValue === true ? value : fallback;
}

function getAdminTemplateSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function buildAdminTemplatePageSnapshot({
  loading,
  saving,
  error,
  templateCount,
  knownTemplateCount,
  editableTemplateCount,
  editingKey,
  editValue,
  configuredTemplateCount,
  emptyTemplateCount,
  canEdit,
}: {
  loading: boolean;
  saving: boolean;
  error: string;
  templateCount: number;
  knownTemplateCount: number;
  editableTemplateCount: number;
  editingKey: AdminTemplateConfigKey | null;
  editValue: string;
  configuredTemplateCount: number;
  emptyTemplateCount: number;
  canEdit: boolean;
}): AdminTemplatePageSnapshot {
  const hasError = error.length > 0;
  const hasEditingKey = editingKey !== null && editingKey.length > 0;
  const canStartEdit = loading === false && saving === false && hasEditingKey === false && editableTemplateCount > 0;
  const canSave = hasEditingKey === true && loading === false && saving === false && canEdit === true;
  const canCancel = hasEditingKey === true && saving === false;
  const status: AdminTemplatePageSnapshotStatus = loading === true
    ? 'loading'
    : hasError === true && hasEditingKey === true
      ? 'save_failed'
      : hasError === true
        ? 'load_failed'
        : saving === true
          ? 'saving'
          : hasEditingKey === true
            ? 'editing'
            : templateCount === 0
              ? 'empty'
              : 'ready';
  const source: AdminTemplatePageSnapshotSource = status === 'saving' || status === 'save_failed'
    ? 'template_config_save'
    : status === 'editing'
      ? 'template_config_edit'
      : canEdit === false && status === 'ready'
        ? 'template_config_permission'
        : 'template_config_list';

  return {
    status,
    source,
    templateCount,
    knownTemplateCount,
    editableTemplateCount,
    editingKey,
    editValueLength: editValue.length,
    configuredTemplateCount,
    emptyTemplateCount,
    isLoading: loading,
    isSaving: saving,
    hasError,
    canEdit,
    canStartEdit,
    canSave,
    canCancel,
    message: status === 'loading'
      ? 'Admin Template 正在加载 template.* 配置。'
      : status === 'load_failed'
        ? 'Admin Template 配置加载失败。'
        : status === 'save_failed'
          ? 'Admin Template 保存失败，当前覆盖值尚未确认写入后端。'
          : status === 'saving'
            ? 'Admin Template 正在保存模板覆盖配置。'
            : status === 'editing'
              ? 'Admin Template 正在编辑模板覆盖值。'
              : status === 'empty'
                ? 'Admin Template 当前没有 template.* 配置。'
                : 'Admin Template 已就绪。',
    recovery: status === 'loading'
      ? '等待 Admin Config 列表请求返回。'
      : status === 'load_failed'
        ? '稍后刷新 Template 管理页或检查 Admin Config API。'
        : status === 'save_failed'
          ? '检查模板内容后重试保存；保存前不会影响生成期模板覆盖。'
          : status === 'saving'
            ? '等待保存完成，避免重复提交模板覆盖。'
            : status === 'editing'
              ? '确认模板语法、变量占位和空值回退语义后保存，或取消回到只读状态。'
              : status === 'empty'
                ? '确认当前环境是否已执行 project template config seed migration。'
                : canEdit
                  ? '可编辑 template.* 覆盖；留空会继续使用内置模板。'
                  : '当前管理员仅可查看 template.* 配置。',
    updatedAt: 'derived',
  };
}

function getAdminTemplateSnapshotClassName(snapshot: AdminTemplatePageSnapshot) {
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

export function AdminTemplatePageSnapshotStrip({ snapshot }: { snapshot: AdminTemplatePageSnapshot }) {
  const editingKeyLabel = getAdminTemplateSnapshotLabel(snapshot.editingKey, 'none');
  const isLoadingLabel = getAdminTemplateSnapshotBooleanLabel(snapshot.isLoading);
  const isSavingLabel = getAdminTemplateSnapshotBooleanLabel(snapshot.isSaving);
  const hasErrorLabel = getAdminTemplateSnapshotBooleanLabel(snapshot.hasError);
  const canEditLabel = getAdminTemplateSnapshotBooleanLabel(snapshot.canEdit);
  const canStartEditLabel = getAdminTemplateSnapshotBooleanLabel(snapshot.canStartEdit);
  const canSaveLabel = getAdminTemplateSnapshotBooleanLabel(snapshot.canSave);
  const canCancelLabel = getAdminTemplateSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-template-page-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminTemplateSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Template 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Templates: {snapshot.templateCount}</span>
        <span>Known: {snapshot.knownTemplateCount}</span>
        <span>Editable: {snapshot.editableTemplateCount}</span>
        <span>Editing: {editingKeyLabel}</span>
        <span>ValueChars: {snapshot.editValueLength}</span>
        <span>Configured: {snapshot.configuredTemplateCount}</span>
        <span>Empty: {snapshot.emptyTemplateCount}</span>
        <span>Loading: {isLoadingLabel}</span>
        <span>Saving: {isSavingLabel}</span>
        <span>Error: {hasErrorLabel}</span>
        <span>Edit: {canEditLabel}</span>
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

export function buildAdminTemplateSaveConfirmationSnapshot({
  templateKey,
  profile,
  editValue,
  isOpen,
  saving,
  error,
}: {
  templateKey: AdminTemplateConfigKey | null;
  profile: AdminTemplateSaveProfileSnapshotInput;
  editValue: string;
  isOpen: boolean;
  saving: boolean;
  error: string;
}): AdminTemplateSaveConfirmationSnapshot {
  const hasTemplate = templateKey !== null && templateKey.length > 0;
  const hasError = error.length > 0 && isOpen === true && hasTemplate === true;
  const isKnownTemplate = profile !== null;
  const canConfirm = isOpen === true && hasTemplate === true && saving === false;
  const canCancel = isOpen === true && hasTemplate === true && saving === false;
  const status: AdminTemplateSaveConfirmationSnapshotStatus = isOpen === false || hasTemplate === false
    ? 'closed'
    : saving === true
      ? 'confirming'
      : hasError === true
        ? 'save_failed'
        : 'awaiting_confirmation';
  const source: AdminTemplateSaveConfirmationSnapshotSource = status === 'closed'
    ? 'dialog_state'
    : isKnownTemplate === true
      ? 'template_profile'
      : 'template_config_save';
  const riskLevel: AdminTemplateSaveConfirmationRiskLevel = hasTemplate === true ? 'high' : 'none';
  const isClearingOverride = editValue.length === 0;
  const templateTitle = getAdminTemplateSnapshotLabel(profile?.title, getAdminTemplateSnapshotLabel(templateKey, 'none'));
  const templateCategory: AdminTemplateProfileCategory = profile !== null ? profile.category : 'Custom';

  return {
    status,
    source,
    templateKey,
    templateTitle,
    templateCategory,
    editValueLength: editValue.length,
    isKnownTemplate,
    isClearingOverride,
    isSaving: saving,
    hasError,
    canConfirm,
    canCancel,
    riskLevel,
    message: status === 'closed'
      ? 'Admin Template 保存确认弹窗未打开。'
      : status === 'confirming'
        ? '正在保存 Template 配置，确认与取消入口暂时锁定。'
        : status === 'save_failed'
          ? 'Template 配置保存失败，当前覆盖值尚未确认写入后端。'
          : isClearingOverride
            ? '正在确认清空模板覆盖，生成链路会回退内置模板。'
            : isKnownTemplate
              ? '正在确认保存稳定 Template profile，后续生成链路会优先使用该覆盖。'
              : '正在确认保存自定义 Template 配置，后续模板渲染可能受影响。',
    recovery: status === 'closed'
      ? '打开保存确认弹窗后会展示 Template key、profile、字符数和风险等级。'
      : status === 'confirming'
        ? '等待保存请求完成，避免重复提交模板覆盖。'
        : status === 'save_failed'
          ? '保留当前编辑值，检查模板内容、Admin Config API 和后端错误后重试，或取消返回只读状态。'
          : isClearingOverride
            ? '确认空值回退内置模板是预期行为后保存。'
            : '确认模板变量、输出格式和内置回退语义后保存。',
    updatedAt: 'derived',
  };
}

function getAdminTemplateSaveConfirmationSnapshotClassName(snapshot: AdminTemplateSaveConfirmationSnapshot) {
  if (snapshot.status === 'save_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-300';
}

export function AdminTemplateSaveConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminTemplateSaveConfirmationSnapshot;
}) {
  const templateKeyLabel = getAdminTemplateSnapshotLabel(snapshot.templateKey, 'none');
  const isKnownTemplateLabel = getAdminTemplateSnapshotBooleanLabel(snapshot.isKnownTemplate);
  const isClearingOverrideLabel = getAdminTemplateSnapshotBooleanLabel(snapshot.isClearingOverride);
  const isSavingLabel = getAdminTemplateSnapshotBooleanLabel(snapshot.isSaving);
  const hasErrorLabel = getAdminTemplateSnapshotBooleanLabel(snapshot.hasError);
  const canConfirmLabel = getAdminTemplateSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getAdminTemplateSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-template-save-confirmation-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminTemplateSaveConfirmationSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Template 保存确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Key: {templateKeyLabel}</span>
        <span>Template: {snapshot.templateTitle}</span>
        <span>Category: {snapshot.templateCategory}</span>
        <span>ValueChars: {snapshot.editValueLength}</span>
        <span>Known: {isKnownTemplateLabel}</span>
        <span>Clearing: {isClearingOverrideLabel}</span>
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
