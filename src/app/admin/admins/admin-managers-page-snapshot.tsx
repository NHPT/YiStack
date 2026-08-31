import type {
  AdminManagerDeleteConfirmationRiskLevel,
  AdminManagerDeleteConfirmationSnapshot,
  AdminManagerDeleteConfirmationSnapshotSource,
  AdminManagerDeleteConfirmationSnapshotStatus,
  AdminManagerDeleteSnapshotSystemRole,
  AdminManagerDeletingId,
  AdminManagerEditableSnapshotStatus,
  AdminManagerEditableSnapshotSystemRole,
  AdminManagerSaveConfirmationRiskLevel,
  AdminManagerSaveConfirmationSnapshot,
  AdminManagerSaveConfirmationSnapshotSource,
  AdminManagerSaveConfirmationSnapshotStatus,
  AdminManagersPageSnapshot,
  AdminManagersPageSnapshotSource,
  AdminManagersPageSnapshotStatus,
  AdminManagerId,
  AdminRoleIdList,
  AdminUnknownRawValueList,
} from '../../workspace/workspace-types';
import type { AdminManagerMutableStatus, AdminManagerMutableSystemRole } from '@/lib/admin/api';

type AdminManagersEditingSnapshotInput = {
  id: AdminManagerId;
  role: AdminManagerMutableSystemRole;
  status: AdminManagerMutableStatus;
  role_ids: AdminRoleIdList;
} | null;

type AdminManagersDeletingSnapshotInput = {
  id: AdminManagerDeletingId;
  email: string;
  role: AdminManagerDeleteSnapshotSystemRole;
  selectedRoleCount: number;
} | null;

function getAdminManagersSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = value !== null && value !== undefined && value.length > 0;

  return hasValue === true ? value : fallback;
}

function getAdminManagersUnknownValueListLabel(values: AdminUnknownRawValueList, fallback: string): string {
  const joinedValue = values.join(' / ');

  return getAdminManagersSnapshotLabel(joinedValue, fallback);
}

function getAdminManagersEditingAdminId(editing: AdminManagersEditingSnapshotInput): AdminManagerId | null {
  const hasEditing = editing !== null;

  return hasEditing === true ? editing.id : null;
}

function getAdminManagersDeletingAdminId(
  pendingDelete: AdminManagersDeletingSnapshotInput,
): AdminManagerDeletingId | null {
  const hasPendingDelete = pendingDelete !== null;

  return hasPendingDelete === true ? pendingDelete.id : null;
}

function getAdminManagersEditingSelectedRoleCount(editing: AdminManagersEditingSnapshotInput): number {
  const hasEditing = editing !== null;

  return hasEditing === true ? editing.role_ids.length : 0;
}

function getAdminManagersDeletingSelectedRoleCount(pendingDelete: AdminManagersDeletingSnapshotInput): number {
  const hasPendingDelete = pendingDelete !== null;

  return hasPendingDelete === true ? pendingDelete.selectedRoleCount : 0;
}

function getAdminManagersEditingSystemRole(
  editing: AdminManagersEditingSnapshotInput,
): AdminManagerEditableSnapshotSystemRole {
  const hasEditing = editing !== null;

  return hasEditing === true ? editing.role : 'none';
}

function getAdminManagersEditingStatus(editing: AdminManagersEditingSnapshotInput): AdminManagerEditableSnapshotStatus {
  const hasEditing = editing !== null;

  return hasEditing === true ? editing.status : 'none';
}

function getAdminManagersDeletingEmail(pendingDelete: AdminManagersDeletingSnapshotInput): string {
  const hasPendingDelete = pendingDelete !== null;

  return hasPendingDelete === true ? pendingDelete.email : '';
}

function getAdminManagersDeletingSystemRole(
  pendingDelete: AdminManagersDeletingSnapshotInput,
): AdminManagerDeleteSnapshotSystemRole {
  const hasPendingDelete = pendingDelete !== null;

  return hasPendingDelete === true ? pendingDelete.role : 'none';
}

function getAdminManagersSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function buildAdminManagersPageSnapshot({
  loading,
  saving,
  deleting,
  error,
  adminCount,
  roleCount,
  activeAdminCount,
  disabledAdminCount,
  superAdminCount,
  unknownStatusCount,
  unknownSystemRoleCount,
  unknownStatusValues,
  unknownSystemRoleValues,
  editing,
  pendingDelete,
}: {
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  error: string;
  adminCount: number;
  roleCount: number;
  activeAdminCount: number;
  disabledAdminCount: number;
  superAdminCount: number;
  unknownStatusCount: number;
  unknownSystemRoleCount: number;
  unknownStatusValues: AdminUnknownRawValueList;
  unknownSystemRoleValues: AdminUnknownRawValueList;
  editing: AdminManagersEditingSnapshotInput;
  pendingDelete: AdminManagersDeletingSnapshotInput;
}): AdminManagersPageSnapshot {
  const hasError = error.length > 0;
  const hasEditingAdmin = editing !== null;
  const hasPendingDelete = pendingDelete !== null;
  const canStartEdit = loading === false && saving === false && deleting === false && hasEditingAdmin === false && hasPendingDelete === false && adminCount > 0;
  const canSave = hasEditingAdmin === true && loading === false && saving === false && deleting === false;
  const canCancel = hasEditingAdmin === true && saving === false && deleting === false;
  const canDelete = loading === false && saving === false && deleting === false && hasEditingAdmin === false && hasPendingDelete === false && adminCount > 0;
  const unknownStatusValueLabel = getAdminManagersUnknownValueListLabel(unknownStatusValues, 'unknown');
  const unknownSystemRoleValueLabel = getAdminManagersUnknownValueListLabel(unknownSystemRoleValues, 'unknown');
  const status: AdminManagersPageSnapshotStatus = loading === true
    ? 'loading'
    : hasError === true && hasPendingDelete === true
      ? 'delete_failed'
      : hasError === true && hasEditingAdmin === true
        ? 'save_failed'
        : hasError === true
          ? 'load_failed'
          : deleting === true
            ? 'deleting'
            : saving === true
              ? 'saving'
              : hasPendingDelete === true
                ? 'delete_confirming'
                : hasEditingAdmin === true
                  ? 'editing'
                  : adminCount === 0
                    ? 'empty'
                    : 'ready';
  const source: AdminManagersPageSnapshotSource = status === 'loading' || status === 'load_failed' || status === 'empty' || status === 'ready'
    ? 'admin_list'
    : status === 'deleting' || status === 'delete_confirming' || status === 'delete_failed'
      ? 'admin_delete'
    : status === 'saving' || status === 'save_failed'
      ? 'admin_save'
      : unknownStatusCount > 0 || roleCount > 0
        ? 'admin_edit'
        : 'role_list';

  return {
    status,
    source,
    adminCount,
    roleCount,
    activeAdminCount,
    disabledAdminCount,
    superAdminCount,
    unknownStatusCount,
    unknownSystemRoleCount,
    unknownStatusValues,
    unknownSystemRoleValues,
    editingAdminId: getAdminManagersEditingAdminId(editing),
    deletingAdminId: getAdminManagersDeletingAdminId(pendingDelete),
    selectedRoleCount: getAdminManagersEditingSelectedRoleCount(editing),
    selectedSystemRole: getAdminManagersEditingSystemRole(editing),
    selectedStatus: getAdminManagersEditingStatus(editing),
    isLoading: loading,
    isSaving: saving,
    isDeleting: deleting,
    hasError,
    canStartEdit,
    canSave,
    canCancel,
    canDelete,
    message: status === 'loading'
      ? 'Admin Managers 正在加载管理员和角色列表。'
      : status === 'load_failed'
        ? 'Admin Managers 管理员或角色列表加载失败。'
        : status === 'delete_failed'
          ? 'Admin Managers 删除失败，当前管理员删除尚未确认写入后端。'
        : status === 'deleting'
          ? 'Admin Managers 正在删除管理员账号。'
        : status === 'delete_confirming'
          ? 'Admin Managers 正在等待管理员删除确认。'
        : status === 'save_failed'
          ? 'Admin Managers 保存失败，当前管理员角色绑定尚未确认写入后端。'
          : status === 'saving'
            ? 'Admin Managers 正在保存管理员角色绑定。'
            : status === 'editing'
              ? 'Admin Managers 正在编辑管理员系统角色和自定义角色。'
            : status === 'empty'
              ? 'Admin Managers 当前没有管理员可展示。'
              : unknownStatusCount > 0
                ? 'Admin Managers 已加载，但存在非 active/disabled 的管理员状态。'
                : unknownSystemRoleCount > 0
                  ? 'Admin Managers 已加载，但存在非 admin/super_admin 的系统角色。'
                  : 'Admin Managers 已就绪。',
    recovery: status === 'loading'
      ? '等待管理员和角色请求返回。'
      : status === 'load_failed'
        ? '稍后刷新管理员页或检查 Admin API 可用性。'
        : status === 'delete_failed'
          ? '检查目标管理员与当前登录账号边界后重试，或取消返回列表。'
        : status === 'deleting'
          ? '等待删除请求完成，避免重复提交。'
        : status === 'delete_confirming'
          ? '确认后会调用既有 DELETE API 删除管理员账号，并刷新管理员列表。'
        : status === 'save_failed'
          ? '检查系统角色、状态和自定义角色勾选后重试保存。'
          : status === 'saving'
            ? '等待保存请求完成，避免重复提交。'
            : status === 'editing'
              ? '确认系统角色、状态和自定义角色后保存，或取消返回列表。'
              : status === 'empty'
                ? '确认是否已有管理员账号或后端初始化状态。'
                : unknownStatusCount > 0
                  ? `核对后端管理员状态枚举，避免把未知状态误判为启用或禁用。未知状态：${unknownStatusValueLabel}。`
                  : unknownSystemRoleCount > 0
                    ? `核对后端管理员系统角色枚举，避免把未知角色误判为 admin 或 super_admin。未知角色：${unknownSystemRoleValueLabel}。`
                    : '可以编辑管理员系统角色和自定义角色绑定。',
    updatedAt: 'derived',
  };
}

function getAdminManagersSnapshotClassName(snapshot: AdminManagersPageSnapshot) {
  if (snapshot.status === 'load_failed' || snapshot.status === 'save_failed' || snapshot.status === 'delete_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'loading' || snapshot.status === 'saving' || snapshot.status === 'deleting') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (snapshot.status === 'empty' || snapshot.status === 'editing' || snapshot.status === 'delete_confirming' || snapshot.unknownStatusCount > 0 || snapshot.unknownSystemRoleCount > 0) {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

export function AdminManagersPageSnapshotStrip({ snapshot }: { snapshot: AdminManagersPageSnapshot }) {
  const unknownStatusValuesLabel = getAdminManagersUnknownValueListLabel(snapshot.unknownStatusValues, 'none');
  const unknownSystemRoleValuesLabel = getAdminManagersUnknownValueListLabel(snapshot.unknownSystemRoleValues, 'none');
  const editingAdminIdLabel = getAdminManagersSnapshotLabel(snapshot.editingAdminId, 'none');
  const deletingAdminIdLabel = getAdminManagersSnapshotLabel(snapshot.deletingAdminId, 'none');
  const isLoadingLabel = getAdminManagersSnapshotBooleanLabel(snapshot.isLoading);
  const isSavingLabel = getAdminManagersSnapshotBooleanLabel(snapshot.isSaving);
  const isDeletingLabel = getAdminManagersSnapshotBooleanLabel(snapshot.isDeleting);
  const hasErrorLabel = getAdminManagersSnapshotBooleanLabel(snapshot.hasError);
  const canStartEditLabel = getAdminManagersSnapshotBooleanLabel(snapshot.canStartEdit);
  const canSaveLabel = getAdminManagersSnapshotBooleanLabel(snapshot.canSave);
  const canCancelLabel = getAdminManagersSnapshotBooleanLabel(snapshot.canCancel);
  const canDeleteLabel = getAdminManagersSnapshotBooleanLabel(snapshot.canDelete);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-managers-page-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminManagersSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Managers 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Admins: {snapshot.adminCount}</span>
        <span>Roles: {snapshot.roleCount}</span>
        <span>Active: {snapshot.activeAdminCount}</span>
        <span>Disabled: {snapshot.disabledAdminCount}</span>
        <span>SuperAdmins: {snapshot.superAdminCount}</span>
        <span>UnknownStatus: {snapshot.unknownStatusCount}</span>
        <span>UnknownSystemRoles: {snapshot.unknownSystemRoleCount}</span>
        <span>UnknownStatusValues: {unknownStatusValuesLabel}</span>
        <span>UnknownSystemRoleValues: {unknownSystemRoleValuesLabel}</span>
        <span>Editing: {editingAdminIdLabel}</span>
        <span>DeletingAdmin: {deletingAdminIdLabel}</span>
        <span>SystemRole: {snapshot.selectedSystemRole}</span>
        <span>Status: {snapshot.selectedStatus}</span>
        <span>SelectedRoles: {snapshot.selectedRoleCount}</span>
        <span>Loading: {isLoadingLabel}</span>
        <span>Saving: {isSavingLabel}</span>
        <span>Deleting: {isDeletingLabel}</span>
        <span>Error: {hasErrorLabel}</span>
        <span>StartEdit: {canStartEditLabel}</span>
        <span>Save: {canSaveLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
        <span>Delete: {canDeleteLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function buildAdminManagerDeleteConfirmationSnapshot({
  pendingDelete,
  isOpen,
  deleting,
  error,
}: {
  pendingDelete: AdminManagersDeletingSnapshotInput;
  isOpen: boolean;
  deleting: boolean;
  error: string;
}): AdminManagerDeleteConfirmationSnapshot {
  const hasPendingDelete = pendingDelete !== null;
  const hasError = error.length > 0 && isOpen === true && hasPendingDelete === true;
  const canConfirm = isOpen === true && hasPendingDelete === true && deleting === false && hasError === false;
  const canCancel = isOpen === true && hasPendingDelete === true && deleting === false;
  const status: AdminManagerDeleteConfirmationSnapshotStatus = isOpen === false || hasPendingDelete === false
    ? 'closed'
    : deleting === true
      ? 'confirming'
      : hasError === true
        ? 'delete_failed'
        : 'awaiting_confirmation';
  const source: AdminManagerDeleteConfirmationSnapshotSource = status === 'closed'
    ? 'dialog_state'
    : 'admin_delete';
  const riskLevel: AdminManagerDeleteConfirmationRiskLevel = hasPendingDelete === true
    ? 'high'
    : 'none';

  return {
    status,
    source,
    adminId: getAdminManagersDeletingAdminId(pendingDelete),
    adminEmail: getAdminManagersDeletingEmail(pendingDelete),
    systemRole: getAdminManagersDeletingSystemRole(pendingDelete),
    selectedRoleCount: getAdminManagersDeletingSelectedRoleCount(pendingDelete),
    isDeleting: deleting,
    hasError,
    canConfirm,
    canCancel,
    riskLevel,
    message: status === 'closed'
      ? 'Admin Manager 删除确认未打开。'
      : status === 'confirming'
        ? 'Admin Manager 正在执行删除。'
        : status === 'delete_failed'
          ? 'Admin Manager 删除失败，后端尚未确认本次删除。'
          : 'Admin Manager 删除等待确认。',
    recovery: status === 'closed'
      ? '从管理员列表选择删除后再打开确认。'
      : status === 'confirming'
        ? '等待删除请求完成，避免重复提交。'
        : status === 'delete_failed'
          ? '检查目标管理员是否为当前登录 super_admin 后重试，或取消返回列表。'
          : '确认后会调用既有 DELETE API 删除管理员账号，并刷新管理员列表。',
    updatedAt: 'derived',
  };
}

function getAdminManagerDeleteConfirmationSnapshotClassName(snapshot: AdminManagerDeleteConfirmationSnapshot) {
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

export function AdminManagerDeleteConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminManagerDeleteConfirmationSnapshot;
}) {
  const adminIdLabel = getAdminManagersSnapshotLabel(snapshot.adminId, 'none');
  const adminEmailLabel = getAdminManagersSnapshotLabel(snapshot.adminEmail, 'none');
  const isDeletingLabel = getAdminManagersSnapshotBooleanLabel(snapshot.isDeleting);
  const hasErrorLabel = getAdminManagersSnapshotBooleanLabel(snapshot.hasError);
  const canConfirmLabel = getAdminManagersSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getAdminManagersSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-manager-delete-confirmation-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminManagerDeleteConfirmationSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Manager 删除确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Admin: {adminIdLabel}</span>
        <span>Email: {adminEmailLabel}</span>
        <span>SystemRole: {snapshot.systemRole}</span>
        <span>SelectedRoles: {snapshot.selectedRoleCount}</span>
        <span>Deleting: {isDeletingLabel}</span>
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

export function buildAdminManagerSaveConfirmationSnapshot({
  editing,
  isOpen,
  saving,
  error,
}: {
  editing: AdminManagersEditingSnapshotInput;
  isOpen: boolean;
  saving: boolean;
  error: string;
}): AdminManagerSaveConfirmationSnapshot {
  const hasEditing = editing !== null && editing.id.length > 0;
  const hasError = error.length > 0 && isOpen === true && hasEditing === true;
  const selectedSystemRole = getAdminManagersEditingSystemRole(editing);
  const selectedStatus = getAdminManagersEditingStatus(editing);
  const selectedRoleCount = getAdminManagersEditingSelectedRoleCount(editing);
  const canConfirm = isOpen === true && hasEditing === true && saving === false;
  const canCancel = isOpen === true && hasEditing === true && saving === false;
  const status: AdminManagerSaveConfirmationSnapshotStatus = isOpen === false || hasEditing === false
    ? 'closed'
    : saving === true
      ? 'confirming'
      : hasError === true
        ? 'save_failed'
        : 'awaiting_confirmation';
  const source: AdminManagerSaveConfirmationSnapshotSource = status === 'closed'
    ? 'dialog_state'
    : selectedRoleCount > 0
      ? 'role_binding'
      : 'admin_save';
  const riskLevel: AdminManagerSaveConfirmationRiskLevel = hasEditing === false
    ? 'none'
    : selectedSystemRole === 'super_admin' || selectedStatus === 'disabled'
      ? 'high'
      : 'medium';

  return {
    status,
    source,
    adminId: getAdminManagersEditingAdminId(editing),
    selectedSystemRole,
    selectedStatus,
    selectedRoleCount,
    isSaving: saving,
    hasError,
    canConfirm,
    canCancel,
    riskLevel,
    message: status === 'closed'
      ? 'Admin Manager 保存确认弹窗未打开。'
      : status === 'confirming'
        ? '正在保存管理员角色与状态，确认与取消入口暂时锁定。'
        : status === 'save_failed'
          ? '管理员角色或状态保存失败，后端权限绑定尚未确认更新。'
          : selectedStatus === 'disabled'
            ? '正在确认禁用管理员账号，保存后该管理员将不能继续以 active 状态使用后台能力。'
            : selectedSystemRole === 'super_admin'
              ? '正在确认授予 super_admin 系统角色，保存后该管理员将拥有最高后台权限。'
              : selectedRoleCount > 0
                ? '正在确认保存管理员自定义角色绑定。'
                : '正在确认保存管理员系统角色与状态。',
    recovery: status === 'closed'
      ? '打开保存确认弹窗后会展示系统角色、状态、自定义角色数量和风险等级。'
      : status === 'confirming'
        ? '等待保存请求完成，避免重复提交管理员权限变更。'
        : status === 'save_failed'
          ? '保留当前编辑状态，检查系统角色、状态和角色绑定后重试，或取消返回管理员列表。'
          : selectedStatus === 'disabled'
            ? '确认目标管理员不再需要后台访问；保存后可重新编辑并恢复 active。'
            : selectedSystemRole === 'super_admin'
              ? '确认该管理员应拥有全部后台能力；保存后可通过管理员列表再次降级。'
              : selectedRoleCount > 0
                ? '确认自定义角色权限集合符合最小权限原则，保存后可重新编辑调整。'
                : '确认系统角色与状态无误后保存。',
    updatedAt: 'derived',
  };
}

function getAdminManagerSaveConfirmationSnapshotClassName(snapshot: AdminManagerSaveConfirmationSnapshot) {
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

export function AdminManagerSaveConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminManagerSaveConfirmationSnapshot;
}) {
  const adminIdLabel = getAdminManagersSnapshotLabel(snapshot.adminId, 'none');
  const isSavingLabel = getAdminManagersSnapshotBooleanLabel(snapshot.isSaving);
  const hasErrorLabel = getAdminManagersSnapshotBooleanLabel(snapshot.hasError);
  const canConfirmLabel = getAdminManagersSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getAdminManagersSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-manager-save-confirmation-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminManagerSaveConfirmationSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Manager 保存确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Admin: {adminIdLabel}</span>
        <span>SystemRole: {snapshot.selectedSystemRole}</span>
        <span>Status: {snapshot.selectedStatus}</span>
        <span>SelectedRoles: {snapshot.selectedRoleCount}</span>
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
