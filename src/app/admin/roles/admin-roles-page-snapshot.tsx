import type {
  AdminPermissionIdList,
  AdminRoleDeleteConfirmationRiskLevel,
  AdminRoleDeleteConfirmationSnapshot,
  AdminRoleDeleteConfirmationSnapshotSource,
  AdminRoleDeleteConfirmationSnapshotStatus,
  AdminRoleDeletingId,
  AdminRoleEditingId,
  AdminRoleFormMode,
  AdminRoleEditableSnapshotStatus,
  AdminRoleId,
  AdminRoleSaveConfirmationRiskLevel,
  AdminRoleSaveConfirmationSnapshot,
  AdminRoleSaveConfirmationSnapshotSource,
  AdminRoleSaveConfirmationSnapshotStatus,
  AdminRolesPageSnapshot,
  AdminRolesPageSnapshotSource,
  AdminRolesPageSnapshotStatus,
  AdminUnknownRawValueList,
} from '../../workspace/workspace-types';
import type { AdminRoleMutableStatus } from '@/lib/admin/api';

type AdminRolesFormSnapshotInput = {
  name: string;
  display_name: string;
  description: string;
  status: AdminRoleMutableStatus;
  permission_ids: AdminPermissionIdList;
};

type AdminRolesDeletingSnapshotInput = {
  id: AdminRoleDeletingId;
  name: string;
  displayName: string;
  selectedPermissionCount: number;
  isSystemRole: boolean;
} | null;

function getAdminRolesSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = value !== null && value !== undefined && value.length > 0;

  return hasValue === true ? value : fallback;
}

function getAdminRolesUnknownValueListLabel(values: AdminUnknownRawValueList, fallback: string): string {
  const joinedValue = values.join(' / ');

  return getAdminRolesSnapshotLabel(joinedValue, fallback);
}

function getAdminRolesDeletingRoleId(pendingDelete: AdminRolesDeletingSnapshotInput): AdminRoleDeletingId | null {
  const hasPendingDelete = pendingDelete !== null;

  return hasPendingDelete === true ? pendingDelete.id : null;
}

function getAdminRolesDeletingSelectedPermissionCount(pendingDelete: AdminRolesDeletingSnapshotInput): number {
  const hasPendingDelete = pendingDelete !== null;

  return hasPendingDelete === true ? pendingDelete.selectedPermissionCount : 0;
}

function getAdminRolesDeletingIsSystemRole(pendingDelete: AdminRolesDeletingSnapshotInput): boolean {
  const hasPendingDelete = pendingDelete !== null;

  return hasPendingDelete === true ? pendingDelete.isSystemRole : false;
}

function getAdminRolesFormStatus(form: AdminRolesFormSnapshotInput): AdminRoleEditableSnapshotStatus {
  return form.status;
}

function getAdminRolesSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function buildAdminRolesPageSnapshot({
  loading,
  saving,
  deleting,
  error,
  roleCount,
  permissionCount,
  permissionGroupCount,
  systemRoleCount,
  unknownStatusCount,
  unknownStatusValues,
  editingRoleId,
  pendingDelete,
  form,
}: {
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  error: string;
  roleCount: number;
  permissionCount: number;
  permissionGroupCount: number;
  systemRoleCount: number;
  unknownStatusCount: number;
  unknownStatusValues: AdminUnknownRawValueList;
  editingRoleId: AdminRoleEditingId | null;
  pendingDelete: AdminRolesDeletingSnapshotInput;
  form: AdminRolesFormSnapshotInput;
}): AdminRolesPageSnapshot {
  const hasError = error.length > 0;
  const hasEditingRole = editingRoleId !== null;
  const hasPendingDelete = pendingDelete !== null;
  const formMode: AdminRoleFormMode = editingRoleId === 'new'
    ? 'create'
    : hasEditingRole
      ? 'edit'
      : 'none';
  const nameLength = form.name.trim().length;
  const displayNameLength = form.display_name.trim().length;
  const formComplete = formMode === 'none' || (nameLength > 0 && displayNameLength > 0);
  const canCreate = loading === false && saving === false && deleting === false && formMode === 'none' && hasPendingDelete === false;
  const canSave = formMode !== 'none' && formComplete === true && loading === false && saving === false && deleting === false;
  const canCancel = formMode !== 'none' && saving === false && deleting === false;
  const canDelete = loading === false && saving === false && deleting === false && formMode === 'none' && hasPendingDelete === false && roleCount > 0;
  const unknownStatusValueLabel = getAdminRolesUnknownValueListLabel(unknownStatusValues, 'unknown');
  const status: AdminRolesPageSnapshotStatus = loading === true
    ? 'loading'
    : hasError === true && hasPendingDelete === true
      ? 'delete_failed'
      : hasError === true && formMode !== 'none'
        ? 'save_failed'
        : hasError === true
          ? 'load_failed'
          : deleting === true
            ? 'deleting'
            : saving === true
              ? 'saving'
              : hasPendingDelete === true
                ? 'delete_confirming'
                : formMode !== 'none' && formComplete === false
                  ? 'form_incomplete'
                  : formMode === 'create'
                    ? 'creating'
                    : formMode === 'edit'
                      ? 'editing'
                      : roleCount === 0
                        ? 'empty'
                        : 'ready';
  const source: AdminRolesPageSnapshotSource = status === 'loading' || status === 'load_failed' || status === 'empty' || status === 'ready'
    ? 'role_list'
    : status === 'deleting' || status === 'delete_confirming' || status === 'delete_failed'
      ? 'role_delete'
    : status === 'saving' || status === 'save_failed'
      ? 'role_save'
      : permissionCount > 0
        ? 'role_form'
        : 'permission_list';

  return {
    status,
    source,
    roleCount,
    permissionCount,
    permissionGroupCount,
    systemRoleCount,
    unknownStatusCount,
    unknownStatusValues,
    editingRoleId,
    deletingRoleId: getAdminRolesDeletingRoleId(pendingDelete),
    formMode,
    nameLength,
    displayNameLength,
    descriptionLength: form.description.trim().length,
    selectedPermissionCount: form.permission_ids.length,
    isLoading: loading,
    isSaving: saving,
    isDeleting: deleting,
    hasError,
    canCreate,
    canSave,
    canCancel,
    canDelete,
    message: status === 'loading'
      ? 'Admin Roles 正在加载角色和权限列表。'
      : status === 'load_failed'
        ? 'Admin Roles 角色或权限列表加载失败。'
        : status === 'delete_failed'
          ? 'Admin Roles 删除失败，当前角色删除尚未确认写入后端。'
        : status === 'deleting'
          ? 'Admin Roles 正在删除角色及权限绑定。'
        : status === 'delete_confirming'
          ? 'Admin Roles 正在等待角色删除确认。'
        : status === 'save_failed'
          ? 'Admin Roles 保存失败，当前表单尚未确认写入后端。'
          : status === 'saving'
            ? 'Admin Roles 正在保存当前角色表单。'
            : status === 'form_incomplete'
              ? 'Admin Roles 表单尚未满足保存条件。'
              : status === 'creating'
                ? 'Admin Roles 正在创建新角色。'
                : status === 'editing'
                  ? 'Admin Roles 正在编辑已有角色。'
                  : status === 'empty'
                    ? 'Admin Roles 当前没有角色可展示。'
                    : unknownStatusCount > 0
                      ? 'Admin Roles 已加载，但存在非 active/disabled 的角色状态。'
                      : 'Admin Roles 已就绪。',
    recovery: status === 'loading'
      ? '等待角色和权限请求返回。'
      : status === 'load_failed'
        ? '稍后刷新角色权限页或检查 Admin API 可用性。'
        : status === 'delete_failed'
          ? '检查目标角色是否为系统角色后重试，或取消返回列表。'
        : status === 'deleting'
          ? '等待删除请求完成，避免重复提交。'
        : status === 'delete_confirming'
          ? '确认后会调用既有 DELETE API 删除自定义角色及绑定关系，并刷新角色列表。'
        : status === 'save_failed'
          ? '检查角色标识、显示名称和权限勾选后重试保存。'
          : status === 'saving'
            ? '等待保存请求完成，避免重复提交。'
            : status === 'form_incomplete'
              ? '填写角色标识和显示名称后再保存。'
              : status === 'creating'
                ? '确认角色标识、显示名称、状态和权限点后保存。'
                : status === 'editing'
                  ? '确认显示名称、状态和权限点后保存，或取消返回列表。'
                  : status === 'empty'
                    ? '创建新角色或检查后端角色初始化状态。'
                    : unknownStatusCount > 0
                      ? `核对后端角色状态枚举，避免把未知状态误判为启用或禁用。未知状态：${unknownStatusValueLabel}。`
                      : '可以创建新角色或编辑已有角色权限。',
    updatedAt: 'derived',
  };
}

function getAdminRolesSnapshotClassName(snapshot: AdminRolesPageSnapshot) {
  if (snapshot.status === 'load_failed' || snapshot.status === 'save_failed' || snapshot.status === 'delete_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'loading' || snapshot.status === 'saving' || snapshot.status === 'deleting') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (snapshot.status === 'empty' || snapshot.status === 'creating' || snapshot.status === 'editing' || snapshot.status === 'form_incomplete' || snapshot.status === 'delete_confirming' || snapshot.unknownStatusCount > 0) {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

export function AdminRolesPageSnapshotStrip({ snapshot }: { snapshot: AdminRolesPageSnapshot }) {
  const unknownStatusValuesLabel = getAdminRolesUnknownValueListLabel(snapshot.unknownStatusValues, 'none');
  const editingRoleIdLabel = getAdminRolesSnapshotLabel(snapshot.editingRoleId, 'none');
  const deletingRoleIdLabel = getAdminRolesSnapshotLabel(snapshot.deletingRoleId, 'none');
  const isLoadingLabel = getAdminRolesSnapshotBooleanLabel(snapshot.isLoading);
  const isSavingLabel = getAdminRolesSnapshotBooleanLabel(snapshot.isSaving);
  const isDeletingLabel = getAdminRolesSnapshotBooleanLabel(snapshot.isDeleting);
  const hasErrorLabel = getAdminRolesSnapshotBooleanLabel(snapshot.hasError);
  const canCreateLabel = getAdminRolesSnapshotBooleanLabel(snapshot.canCreate);
  const canSaveLabel = getAdminRolesSnapshotBooleanLabel(snapshot.canSave);
  const canCancelLabel = getAdminRolesSnapshotBooleanLabel(snapshot.canCancel);
  const canDeleteLabel = getAdminRolesSnapshotBooleanLabel(snapshot.canDelete);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-roles-page-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminRolesSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Roles 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Roles: {snapshot.roleCount}</span>
        <span>Permissions: {snapshot.permissionCount}</span>
        <span>PermissionGroups: {snapshot.permissionGroupCount}</span>
        <span>SystemRoles: {snapshot.systemRoleCount}</span>
        <span>UnknownStatus: {snapshot.unknownStatusCount}</span>
        <span>UnknownStatusValues: {unknownStatusValuesLabel}</span>
        <span>Editing: {editingRoleIdLabel}</span>
        <span>DeletingRole: {deletingRoleIdLabel}</span>
        <span>Mode: {snapshot.formMode}</span>
        <span>NameChars: {snapshot.nameLength}</span>
        <span>DisplayChars: {snapshot.displayNameLength}</span>
        <span>DescriptionChars: {snapshot.descriptionLength}</span>
        <span>SelectedPermissions: {snapshot.selectedPermissionCount}</span>
        <span>Loading: {isLoadingLabel}</span>
        <span>Saving: {isSavingLabel}</span>
        <span>Deleting: {isDeletingLabel}</span>
        <span>Error: {hasErrorLabel}</span>
        <span>Create: {canCreateLabel}</span>
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

export function buildAdminRoleSaveConfirmationSnapshot({
  editingRoleId,
  form,
  isOpen,
  saving,
  error,
  isSystemRole,
}: {
  editingRoleId: AdminRoleEditingId | null;
  form: AdminRolesFormSnapshotInput;
  isOpen: boolean;
  saving: boolean;
  error: string;
  isSystemRole: boolean;
}): AdminRoleSaveConfirmationSnapshot {
  const formMode: AdminRoleFormMode = editingRoleId === 'new'
    ? 'create'
    : editingRoleId !== null
      ? 'edit'
      : 'none';
  const hasRole = formMode !== 'none';
  const hasError = error.length > 0 && isOpen === true && hasRole === true;
  const trimmedRoleName = form.name.trim();
  const trimmedDisplayName = form.display_name.trim();
  const roleName = getAdminRolesSnapshotLabel(trimmedRoleName, 'none');
  const displayName = getAdminRolesSnapshotLabel(trimmedDisplayName, 'none');
  const selectedPermissionCount = form.permission_ids.length;
  const roleStatus = getAdminRolesFormStatus(form);
  const hasExistingRole = editingRoleId !== null && editingRoleId !== 'new';
  const roleId: AdminRoleId | null = hasExistingRole === true ? editingRoleId : null;
  const canConfirm = isOpen === true && hasRole === true && saving === false;
  const canCancel = isOpen === true && hasRole === true && saving === false;
  const status: AdminRoleSaveConfirmationSnapshotStatus = isOpen === false || hasRole === false
    ? 'closed'
    : saving === true
      ? 'confirming'
      : hasError === true
        ? 'save_failed'
        : 'awaiting_confirmation';
  const source: AdminRoleSaveConfirmationSnapshotSource = status === 'closed'
    ? 'dialog_state'
    : selectedPermissionCount > 0
      ? 'permission_binding'
      : formMode === 'create'
        ? 'role_create'
        : 'role_update';
  const riskLevel: AdminRoleSaveConfirmationRiskLevel = hasRole === false
    ? 'none'
    : isSystemRole === true || selectedPermissionCount > 0
      ? 'high'
      : 'medium';

  return {
    status,
    source,
    formMode,
    roleId,
    roleName,
    displayName,
    roleStatus,
    selectedPermissionCount,
    isSystemRole,
    isSaving: saving,
    hasError,
    canConfirm,
    canCancel,
    riskLevel,
    message: status === 'closed'
      ? 'Admin Role 保存确认弹窗未打开。'
      : status === 'confirming'
        ? '正在保存角色权限，确认与取消入口暂时锁定。'
        : status === 'save_failed'
          ? '角色权限保存失败，当前角色表单尚未确认写入后端。'
          : formMode === 'create'
            ? '正在确认创建新的后台角色及权限集合。'
            : isSystemRole
              ? '正在确认修改系统角色，可能影响后台基础权限模型。'
              : selectedPermissionCount > 0
                ? '正在确认保存角色权限绑定。'
                : '正在确认保存角色基础信息。',
    recovery: status === 'closed'
      ? '打开保存确认弹窗后会展示角色、状态、权限数量和风险等级。'
      : status === 'confirming'
        ? '等待保存请求完成，避免重复提交角色权限变更。'
        : status === 'save_failed'
          ? '保留当前表单，检查角色标识、显示名称、状态和权限勾选后重试，或取消返回角色列表。'
          : formMode === 'create'
            ? '确认角色标识稳定且权限集合符合最小权限原则；保存后可继续编辑调整。'
            : isSystemRole
              ? '确认系统角色变更符合后台权限模型；保存后核对管理员权限继承结果。'
              : selectedPermissionCount > 0
                ? '确认权限点集合符合最小权限原则，保存后可重新编辑调整。'
                : '确认角色基础信息无误后保存。',
    updatedAt: 'derived',
  };
}

export function buildAdminRoleDeleteConfirmationSnapshot({
  pendingDelete,
  isOpen,
  deleting,
  error,
}: {
  pendingDelete: AdminRolesDeletingSnapshotInput;
  isOpen: boolean;
  deleting: boolean;
  error: string;
}): AdminRoleDeleteConfirmationSnapshot {
  const hasPendingDelete = pendingDelete !== null;
  const hasError = error.length > 0 && isOpen === true && hasPendingDelete === true;
  const selectedPermissionCount = getAdminRolesDeletingSelectedPermissionCount(pendingDelete);
  const isSystemRole = getAdminRolesDeletingIsSystemRole(pendingDelete);
  const roleName = getAdminRolesSnapshotLabel(pendingDelete?.name, 'none');
  const displayName = getAdminRolesSnapshotLabel(pendingDelete?.displayName, 'none');
  const status: AdminRoleDeleteConfirmationSnapshotStatus = isOpen === false || hasPendingDelete === false
    ? 'closed'
    : deleting === true
      ? 'confirming'
      : hasError === true
        ? 'delete_failed'
        : 'awaiting_confirmation';
  const source: AdminRoleDeleteConfirmationSnapshotSource = status === 'closed'
    ? 'dialog_state'
    : selectedPermissionCount > 0
      ? 'permission_binding'
      : 'role_delete';
  const riskLevel: AdminRoleDeleteConfirmationRiskLevel = hasPendingDelete === false
    ? 'none'
    : isSystemRole === true
      ? 'blocked'
      : 'high';

  return {
    status,
    source,
    roleId: getAdminRolesDeletingRoleId(pendingDelete),
    roleName,
    displayName,
    selectedPermissionCount,
    isSystemRole,
    isDeleting: deleting,
    hasError,
    canConfirm: status === 'awaiting_confirmation' && isSystemRole === false,
    canCancel: status === 'awaiting_confirmation' || status === 'delete_failed',
    riskLevel,
    message: status === 'closed'
      ? 'Admin Role 删除确认未打开。'
      : status === 'confirming'
        ? 'Admin Role 正在执行删除。'
        : status === 'delete_failed'
          ? 'Admin Role 删除失败，后端尚未确认本次删除。'
          : isSystemRole
            ? '系统角色不能删除，后端会拒绝该操作。'
            : 'Admin Role 删除等待确认。',
    recovery: status === 'closed'
      ? '从角色列表选择删除后再打开确认。'
      : status === 'confirming'
        ? '等待删除请求完成，避免重复提交。'
        : status === 'delete_failed'
          ? '检查目标角色是否为系统角色后重试，或取消返回列表。'
          : isSystemRole
            ? '系统角色只能编辑受控字段，不应提交删除请求。'
            : '确认后会调用既有 DELETE API 删除自定义角色、权限绑定和管理员绑定关系，并刷新角色列表。',
    updatedAt: 'derived',
  };
}

function getAdminRoleDeleteConfirmationSnapshotClassName(snapshot: AdminRoleDeleteConfirmationSnapshot) {
  if (snapshot.status === 'delete_failed' || snapshot.riskLevel === 'blocked') {
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

export function AdminRoleDeleteConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminRoleDeleteConfirmationSnapshot;
}) {
  const roleIdLabel = getAdminRolesSnapshotLabel(snapshot.roleId, 'none');
  const isSystemRoleLabel = getAdminRolesSnapshotBooleanLabel(snapshot.isSystemRole);
  const isDeletingLabel = getAdminRolesSnapshotBooleanLabel(snapshot.isDeleting);
  const hasErrorLabel = getAdminRolesSnapshotBooleanLabel(snapshot.hasError);
  const canConfirmLabel = getAdminRolesSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getAdminRolesSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-role-delete-confirmation-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminRoleDeleteConfirmationSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Role 删除确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Role: {roleIdLabel}</span>
        <span>Name: {snapshot.roleName}</span>
        <span>Display: {snapshot.displayName}</span>
        <span>Permissions: {snapshot.selectedPermissionCount}</span>
        <span>System: {isSystemRoleLabel}</span>
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

function getAdminRoleSaveConfirmationSnapshotClassName(snapshot: AdminRoleSaveConfirmationSnapshot) {
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

export function AdminRoleSaveConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminRoleSaveConfirmationSnapshot;
}) {
  const roleIdLabel = getAdminRolesSnapshotLabel(snapshot.roleId, 'new');
  const isSystemRoleLabel = getAdminRolesSnapshotBooleanLabel(snapshot.isSystemRole);
  const isSavingLabel = getAdminRolesSnapshotBooleanLabel(snapshot.isSaving);
  const hasErrorLabel = getAdminRolesSnapshotBooleanLabel(snapshot.hasError);
  const canConfirmLabel = getAdminRolesSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getAdminRolesSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-role-save-confirmation-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminRoleSaveConfirmationSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Role 保存确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Mode: {snapshot.formMode}</span>
        <span>Role: {roleIdLabel}</span>
        <span>Name: {snapshot.roleName}</span>
        <span>Display: {snapshot.displayName}</span>
        <span>Status: {snapshot.roleStatus}</span>
        <span>Permissions: {snapshot.selectedPermissionCount}</span>
        <span>System: {isSystemRoleLabel}</span>
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
