import type {
  AdminPromptPageSnapshot,
  AdminPromptPageSnapshotSource,
  AdminPromptPageSnapshotStatus,
  AdminPromptProfileTitle,
  AdminPromptProfilePhase,
  AdminPromptSaveConfirmationSnapshot,
  AdminPromptSaveConfirmationRiskLevel,
  AdminPromptSaveConfirmationSnapshotSource,
  AdminPromptSaveConfirmationSnapshotStatus,
} from '../../workspace/workspace-types';
import type { AdminPromptConfigKey } from '@/lib/admin/api';

type AdminPromptSaveProfileSnapshotInput = {
  title: AdminPromptProfileTitle;
  phase: AdminPromptProfilePhase;
} | null;

function getAdminPromptSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = value !== null && value !== undefined && value.length > 0;

  return hasValue === true ? value : fallback;
}

function getAdminPromptSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function buildAdminPromptPageSnapshot({
  loading,
  saving,
  error,
  promptCount,
  knownPromptCount,
  editablePromptCount,
  editingKey,
  editValue,
  totalPromptChars,
  canEdit,
}: {
  loading: boolean;
  saving: boolean;
  error: string;
  promptCount: number;
  knownPromptCount: number;
  editablePromptCount: number;
  editingKey: AdminPromptConfigKey | null;
  editValue: string;
  totalPromptChars: number;
  canEdit: boolean;
}): AdminPromptPageSnapshot {
  const hasError = error.length > 0;
  const hasEditingKey = editingKey !== null && editingKey.length > 0;
  const canStartEdit = loading === false && saving === false && hasEditingKey === false && editablePromptCount > 0;
  const canSave = hasEditingKey === true && loading === false && saving === false && canEdit === true;
  const canCancel = hasEditingKey === true && saving === false;
  const status: AdminPromptPageSnapshotStatus = loading === true
    ? 'loading'
    : hasError === true && hasEditingKey === true
      ? 'save_failed'
      : hasError === true
        ? 'load_failed'
        : saving === true
          ? 'saving'
          : hasEditingKey === true
            ? 'editing'
            : promptCount === 0
              ? 'empty'
              : 'ready';
  const source: AdminPromptPageSnapshotSource = status === 'saving' || status === 'save_failed'
    ? 'prompt_config_save'
    : status === 'editing'
      ? 'prompt_config_edit'
      : canEdit === false && status === 'ready'
        ? 'prompt_config_permission'
        : 'prompt_config_list';

  return {
    status,
    source,
    promptCount,
    knownPromptCount,
    editablePromptCount,
    editingKey,
    editValueLength: editValue.length,
    totalPromptChars,
    isLoading: loading,
    isSaving: saving,
    hasError,
    canEdit,
    canStartEdit,
    canSave,
    canCancel,
    message: status === 'loading'
      ? 'Admin Prompt 正在加载 Prompt 配置。'
      : status === 'load_failed'
        ? 'Admin Prompt 配置加载失败。'
        : status === 'save_failed'
          ? 'Admin Prompt 保存失败，当前编辑值尚未确认写入后端。'
          : status === 'saving'
            ? 'Admin Prompt 正在保存当前 Prompt。'
            : status === 'editing'
              ? 'Admin Prompt 正在编辑专项 Prompt。'
              : status === 'empty'
                ? 'Admin Prompt 当前没有可管理的 Prompt 配置。'
                : 'Admin Prompt 已就绪。',
    recovery: status === 'loading'
      ? '等待配置列表请求返回。'
      : status === 'load_failed'
        ? '稍后刷新 Prompt 管理页或检查 Admin Config API。'
        : status === 'save_failed'
          ? '检查 Prompt 内容后重试保存；保存前不会影响运行期 Prompt。'
          : status === 'saving'
            ? '等待保存完成，避免重复提交。'
            : status === 'editing'
              ? '确认 Prompt 语义、输出格式和真源约束后保存，或取消回到只读状态。'
              : status === 'empty'
                ? '确认当前环境是否已执行 Prompt seed migration。'
                : canEdit
                  ? '可编辑方案、探讨和实现 Prompt；运行期会自动追加项目真源上下文。'
                  : '当前管理员仅可查看 Prompt 配置。',
    updatedAt: 'derived',
  };
}

function getAdminPromptSnapshotClassName(snapshot: AdminPromptPageSnapshot) {
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

export function AdminPromptPageSnapshotStrip({ snapshot }: { snapshot: AdminPromptPageSnapshot }) {
  const editingKeyLabel = getAdminPromptSnapshotLabel(snapshot.editingKey, 'none');
  const isLoadingLabel = getAdminPromptSnapshotBooleanLabel(snapshot.isLoading);
  const isSavingLabel = getAdminPromptSnapshotBooleanLabel(snapshot.isSaving);
  const hasErrorLabel = getAdminPromptSnapshotBooleanLabel(snapshot.hasError);
  const canEditLabel = getAdminPromptSnapshotBooleanLabel(snapshot.canEdit);
  const canStartEditLabel = getAdminPromptSnapshotBooleanLabel(snapshot.canStartEdit);
  const canSaveLabel = getAdminPromptSnapshotBooleanLabel(snapshot.canSave);
  const canCancelLabel = getAdminPromptSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-prompt-page-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminPromptSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Prompt 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Prompts: {snapshot.promptCount}</span>
        <span>Known: {snapshot.knownPromptCount}</span>
        <span>Editable: {snapshot.editablePromptCount}</span>
        <span>Editing: {editingKeyLabel}</span>
        <span>ValueChars: {snapshot.editValueLength}</span>
        <span>TotalChars: {snapshot.totalPromptChars}</span>
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

export function buildAdminPromptSaveConfirmationSnapshot({
  promptKey,
  profile,
  editValue,
  isOpen,
  saving,
  error,
}: {
  promptKey: AdminPromptConfigKey | null;
  profile: AdminPromptSaveProfileSnapshotInput;
  editValue: string;
  isOpen: boolean;
  saving: boolean;
  error: string;
}): AdminPromptSaveConfirmationSnapshot {
  const hasPrompt = promptKey !== null && promptKey.length > 0;
  const hasError = error.length > 0 && isOpen === true && hasPrompt === true;
  const isKnownPrompt = profile !== null;
  const canConfirm = isOpen === true && hasPrompt === true && saving === false;
  const canCancel = isOpen === true && hasPrompt === true && saving === false;
  const status: AdminPromptSaveConfirmationSnapshotStatus = isOpen === false || hasPrompt === false
    ? 'closed'
    : saving === true
      ? 'confirming'
      : hasError === true
        ? 'save_failed'
        : 'awaiting_confirmation';
  const source: AdminPromptSaveConfirmationSnapshotSource = status === 'closed'
    ? 'dialog_state'
    : isKnownPrompt === true
      ? 'prompt_profile'
      : 'prompt_config_save';
  const riskLevel: AdminPromptSaveConfirmationRiskLevel = hasPrompt === true ? 'high' : 'none';
  const promptTitle = getAdminPromptSnapshotLabel(profile?.title, getAdminPromptSnapshotLabel(promptKey, 'none'));
  const promptPhase: AdminPromptProfilePhase = profile !== null ? profile.phase : 'Custom';

  return {
    status,
    source,
    promptKey,
    promptTitle,
    promptPhase,
    editValueLength: editValue.length,
    isKnownPrompt,
    isSaving: saving,
    hasError,
    canConfirm,
    canCancel,
    riskLevel,
    message: status === 'closed'
      ? 'Admin Prompt 保存确认弹窗未打开。'
      : status === 'confirming'
        ? '正在保存 Prompt 配置，确认与取消入口暂时锁定。'
        : status === 'save_failed'
          ? 'Prompt 配置保存失败，当前编辑值尚未确认写入后端。'
          : isKnownPrompt
            ? '正在确认保存稳定 Prompt profile，后续生成链路会使用新的 Prompt 真源。'
            : '正在确认保存自定义 Prompt 配置，后续生成链路可能受影响。',
    recovery: status === 'closed'
      ? '打开保存确认弹窗后会展示 Prompt key、profile、字符数和风险等级。'
      : status === 'confirming'
        ? '等待保存请求完成，避免重复提交 Prompt 配置。'
        : status === 'save_failed'
          ? '保留当前编辑值，检查 Prompt 内容、Admin Config API 和后端错误后重试，或取消返回只读状态。'
          : isKnownPrompt
            ? '确认 Prompt 仍保留 YES 项目事实、输出协议和运行期上下文的承接语义；保存后可通过生成链路验证。'
            : '确认自定义 Prompt 不破坏生成链路约束后保存。',
    updatedAt: 'derived',
  };
}

function getAdminPromptSaveConfirmationSnapshotClassName(snapshot: AdminPromptSaveConfirmationSnapshot) {
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

export function AdminPromptSaveConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminPromptSaveConfirmationSnapshot;
}) {
  const promptKeyLabel = getAdminPromptSnapshotLabel(snapshot.promptKey, 'none');
  const isKnownPromptLabel = getAdminPromptSnapshotBooleanLabel(snapshot.isKnownPrompt);
  const isSavingLabel = getAdminPromptSnapshotBooleanLabel(snapshot.isSaving);
  const hasErrorLabel = getAdminPromptSnapshotBooleanLabel(snapshot.hasError);
  const canConfirmLabel = getAdminPromptSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getAdminPromptSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-prompt-save-confirmation-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminPromptSaveConfirmationSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Prompt 保存确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Key: {promptKeyLabel}</span>
        <span>Prompt: {snapshot.promptTitle}</span>
        <span>Profile: {snapshot.promptPhase}</span>
        <span>ValueChars: {snapshot.editValueLength}</span>
        <span>Known: {isKnownPromptLabel}</span>
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
