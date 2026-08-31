import type {
  AdminUserDeleteConfirmationRiskLevel,
  AdminUserDeleteConfirmationSnapshot,
  AdminUserDeleteConfirmationSnapshotSource,
  AdminUserDeleteConfirmationSnapshotStatus,
  AdminUserDeleteSnapshotStatus,
  AdminUserDeletingId,
  AdminUserEditableSnapshotRole,
  AdminUserEditableSnapshotStatus,
  AdminUserEditingId,
  AdminUserSaveConfirmationRiskLevel,
  AdminUserSaveConfirmationSnapshot,
  AdminUserSaveConfirmationSnapshotSource,
  AdminUserSaveConfirmationSnapshotStatus,
  AdminUsersPageSnapshot,
  AdminUsersPageSnapshotSource,
  AdminUsersPageSnapshotStatus,
  AdminUnknownRawValueList,
} from '../../workspace/workspace-types';
import type { AdminUserId, AdminUserMutableRole, AdminUserMutableStatus, AdminUserRole, AdminUserStatus } from '@/lib/admin/api';

type AdminUsersSnapshotInput = {
  id: AdminUserId;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  username?: string;
  raw_role?: string;
  raw_status?: string;
};

type AdminUsersEditingSnapshotInput = {
  id: AdminUserEditingId;
  email: string;
  role: AdminUserMutableRole;
  status: AdminUserMutableStatus;
} | null;

type AdminUsersDeletingSnapshotInput = {
  id: AdminUserDeletingId;
  email: string;
  status: AdminUserStatus;
} | null;

function collectUniqueValues(values: AdminUnknownRawValueList): AdminUnknownRawValueList {
  const uniqueValues = new Set<string>();

  for (const value of values) {
    const normalizedValue = value.trim();
    const hasValue = normalizedValue.length > 0;
    if (hasValue === true) {
      uniqueValues.add(normalizedValue);
    }
  }

  const sortedValues: AdminUnknownRawValueList = [];
  for (const value of uniqueValues) {
    sortedValues.push(value);
  }

  return sortedValues.sort();
}

function countAdminUsersByStatus(users: readonly AdminUsersSnapshotInput[], status: AdminUserStatus): number {
  let count = 0;

  for (const user of users) {
    const isMatchedStatus = user.status === status;
    if (isMatchedStatus === true) {
      count += 1;
    }
  }

  return count;
}

function countAdminUsersByRole(users: readonly AdminUsersSnapshotInput[], role: AdminUserRole): number {
  let count = 0;

  for (const user of users) {
    const isMatchedRole = user.role === role;
    if (isMatchedRole === true) {
      count += 1;
    }
  }

  return count;
}

function collectAdminUsersUnknownStatusValues(users: readonly AdminUsersSnapshotInput[]): AdminUnknownRawValueList {
  const values: AdminUnknownRawValueList = [];

  for (const user of users) {
    const hasUnknownStatus = user.status === 'unknown';
    if (hasUnknownStatus === true) {
      values.push(user.raw_status ?? user.status);
    }
  }

  return collectUniqueValues(values);
}

function collectAdminUsersUnknownRoleValues(users: readonly AdminUsersSnapshotInput[]): AdminUnknownRawValueList {
  const values: AdminUnknownRawValueList = [];

  for (const user of users) {
    const hasUnknownRole = user.role === 'unknown';
    if (hasUnknownRole === true) {
      values.push(user.raw_role ?? user.role);
    }
  }

  return collectUniqueValues(values);
}

function countNamedAdminUsers(users: readonly AdminUsersSnapshotInput[]): number {
  let count = 0;

  for (const user of users) {
    const username = user.username;
    const hasUsername = username !== undefined && username.trim().length > 0;
    if (hasUsername === true) {
      count += 1;
    }
  }

  return count;
}

function countAdminUsersWithAdminRole(users: readonly AdminUsersSnapshotInput[]): number {
  const adminCount = countAdminUsersByRole(users, 'admin');
  const superAdminCount = countAdminUsersByRole(users, 'super_admin');
  return adminCount + superAdminCount;
}

function getAdminUsersSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = value !== null && value !== undefined && value.length > 0;

  return hasValue === true ? value : fallback;
}

function getAdminUsersUnknownValueListLabel(values: AdminUnknownRawValueList, fallback: string): string {
  const joinedValue = values.join(' / ');

  return getAdminUsersSnapshotLabel(joinedValue, fallback);
}

function getAdminUsersEditingUserId(editing: AdminUsersEditingSnapshotInput): AdminUserEditingId | null {
  const hasEditing = editing !== null;

  return hasEditing === true ? editing.id : null;
}

function getAdminUsersDeletingUserId(pendingDelete: AdminUsersDeletingSnapshotInput): AdminUserDeletingId | null {
  const hasPendingDelete = pendingDelete !== null;

  return hasPendingDelete === true ? pendingDelete.id : null;
}

function getAdminUsersEditingRole(editing: AdminUsersEditingSnapshotInput): AdminUserEditableSnapshotRole {
  const hasEditing = editing !== null;

  return hasEditing === true ? editing.role : 'none';
}

function getAdminUsersEditingStatus(editing: AdminUsersEditingSnapshotInput): AdminUserEditableSnapshotStatus {
  const hasEditing = editing !== null;

  return hasEditing === true ? editing.status : 'none';
}

function getAdminUsersDeletingStatus(pendingDelete: AdminUsersDeletingSnapshotInput): AdminUserDeleteSnapshotStatus {
  const hasPendingDelete = pendingDelete !== null;

  return hasPendingDelete === true ? toAdminUserDeleteSnapshotStatus(pendingDelete.status) : 'none';
}

function getAdminUsersSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function buildAdminUsersPageSnapshot({
  loading,
  saving,
  deleting,
  error,
  users,
  editing,
  pendingDelete,
}: {
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  error: string;
  users: AdminUsersSnapshotInput[];
  editing: AdminUsersEditingSnapshotInput;
  pendingDelete: AdminUsersDeletingSnapshotInput;
}): AdminUsersPageSnapshot {
  const hasError = error.length > 0;
  const hasEditing = editing !== null;
  const hasPendingDelete = pendingDelete !== null;
  const userCount = users.length;
  const activeUserCount = countAdminUsersByStatus(users, 'active');
  const disabledUserCount = countAdminUsersByStatus(users, 'disabled');
  const deletedUserCount = countAdminUsersByStatus(users, 'deleted');
  const unknownStatusCount = countAdminUsersByStatus(users, 'unknown');
  const unknownRoleCount = countAdminUsersByRole(users, 'unknown');
  const unknownStatusValues = collectAdminUsersUnknownStatusValues(users);
  const unknownRoleValues = collectAdminUsersUnknownRoleValues(users);
  const namedUserCount = countNamedAdminUsers(users);
  const adminRoleCount = countAdminUsersWithAdminRole(users);
  const canStartEdit = loading === false && saving === false && deleting === false && hasEditing === false && hasPendingDelete === false && userCount > 0;
  const canSave = hasEditing === true && loading === false && saving === false && deleting === false;
  const canCancel = hasEditing === true && saving === false && deleting === false;
  const canDelete = loading === false && saving === false && deleting === false && hasEditing === false && hasPendingDelete === false && userCount > 0;
  const canReload = loading === false && saving === false && deleting === false;
  const unknownStatusValueLabel = getAdminUsersUnknownValueListLabel(unknownStatusValues, 'unknown');
  const unknownRoleValueLabel = getAdminUsersUnknownValueListLabel(unknownRoleValues, 'unknown');
  const status: AdminUsersPageSnapshotStatus = loading === true
    ? 'loading'
    : hasError === true && hasPendingDelete === true
      ? 'delete_failed'
      : hasError === true && hasEditing === true
        ? 'save_failed'
        : hasError === true
          ? 'load_failed'
          : deleting === true
            ? 'deleting'
            : saving === true
              ? 'saving'
              : hasPendingDelete === true
                ? 'delete_confirming'
                : hasEditing === true
                  ? 'editing'
                  : userCount === 0
                    ? 'empty'
                    : 'ready';
  const source: AdminUsersPageSnapshotSource = status === 'loading' || status === 'load_failed' || status === 'empty'
    ? 'user_list'
    : status === 'deleting' || status === 'delete_confirming' || status === 'delete_failed'
      ? 'user_delete'
    : status === 'saving' || status === 'save_failed'
      ? 'user_save'
    : status === 'editing'
      ? 'user_edit'
    : unknownStatusCount > 0
      ? 'user_status'
      : unknownRoleCount > 0 || adminRoleCount > 0
        ? 'user_role'
        : 'user_list';

  return {
    status,
    source,
    userCount,
    activeUserCount,
    disabledUserCount,
    deletedUserCount,
    unknownStatusCount,
    unknownRoleCount,
    unknownStatusValues,
    unknownRoleValues,
    namedUserCount,
    adminRoleCount,
    editingUserId: getAdminUsersEditingUserId(editing),
    deletingUserId: getAdminUsersDeletingUserId(pendingDelete),
    selectedRole: getAdminUsersEditingRole(editing),
    selectedStatus: getAdminUsersEditingStatus(editing),
    isLoading: loading,
    isSaving: saving,
    isDeleting: deleting,
    hasError,
    canStartEdit,
    canSave,
    canCancel,
    canDelete,
    canReload,
    message: status === 'loading'
      ? 'Admin Users 正在加载用户列表。'
      : status === 'load_failed'
        ? 'Admin Users 用户列表加载失败。'
        : status === 'delete_failed'
          ? 'Admin Users 删除失败，当前用户软删除尚未确认写入后端。'
        : status === 'deleting'
          ? 'Admin Users 正在软删除用户。'
        : status === 'delete_confirming'
          ? 'Admin Users 正在等待用户软删除确认。'
        : status === 'save_failed'
          ? 'Admin Users 保存失败，当前用户状态或角色尚未确认写入后端。'
          : status === 'saving'
            ? 'Admin Users 正在保存用户状态或角色。'
            : status === 'editing'
              ? 'Admin Users 正在编辑用户状态和角色。'
              : status === 'empty'
                ? 'Admin Users 当前没有用户可展示。'
                : unknownStatusCount > 0
                  ? 'Admin Users 已加载，但存在非 active/disabled 的用户状态。'
                  : unknownRoleCount > 0
                    ? 'Admin Users 已加载，但存在非 user/admin/super_admin 的用户角色。'
                    : 'Admin Users 已就绪。',
    recovery: status === 'loading'
      ? '等待用户列表请求返回。'
      : status === 'load_failed'
        ? '稍后刷新用户管理页或检查 Admin API 可用性。'
        : status === 'delete_failed'
          ? '检查目标用户和删除确认边界后重试，或取消返回列表。'
        : status === 'deleting'
          ? '等待软删除请求完成，避免重复提交。'
        : status === 'delete_confirming'
          ? '确认后会调用既有 DELETE API 将用户标记为 deleted，并刷新用户列表。'
        : status === 'save_failed'
          ? '检查用户状态、角色和确认边界后重试保存。'
          : status === 'saving'
            ? '等待保存请求完成，避免重复提交。'
            : status === 'editing'
              ? '确认用户状态和角色后保存，或取消返回列表。'
              : status === 'empty'
                ? '确认是否已有普通用户注册，或检查后端用户初始化状态。'
                : unknownStatusCount > 0
                  ? `核对后端用户状态枚举，避免把未知状态误判为启用或禁用。未知状态：${unknownStatusValueLabel}。`
                  : unknownRoleCount > 0
                    ? `核对后端用户角色枚举，避免把未知角色误判为普通用户或管理员。未知角色：${unknownRoleValueLabel}。`
                    : '可以查看用户账号，或受控编辑用户状态和角色。',
    updatedAt: 'derived',
  };
}

function getAdminUsersSnapshotClassName(snapshot: AdminUsersPageSnapshot) {
  if (snapshot.status === 'load_failed' || snapshot.status === 'save_failed' || snapshot.status === 'delete_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'loading' || snapshot.status === 'saving' || snapshot.status === 'deleting') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (snapshot.status === 'empty' || snapshot.status === 'editing' || snapshot.status === 'delete_confirming' || snapshot.unknownStatusCount > 0 || snapshot.unknownRoleCount > 0) {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-900/20';
}

export function AdminUsersPageSnapshotStrip({ snapshot }: { snapshot: AdminUsersPageSnapshot }) {
  const unknownStatusValuesLabel = getAdminUsersUnknownValueListLabel(snapshot.unknownStatusValues, 'none');
  const unknownRoleValuesLabel = getAdminUsersUnknownValueListLabel(snapshot.unknownRoleValues, 'none');
  const editingUserIdLabel = getAdminUsersSnapshotLabel(snapshot.editingUserId, 'none');
  const deletingUserIdLabel = getAdminUsersSnapshotLabel(snapshot.deletingUserId, 'none');
  const isLoadingLabel = getAdminUsersSnapshotBooleanLabel(snapshot.isLoading);
  const isSavingLabel = getAdminUsersSnapshotBooleanLabel(snapshot.isSaving);
  const isDeletingLabel = getAdminUsersSnapshotBooleanLabel(snapshot.isDeleting);
  const hasErrorLabel = getAdminUsersSnapshotBooleanLabel(snapshot.hasError);
  const canStartEditLabel = getAdminUsersSnapshotBooleanLabel(snapshot.canStartEdit);
  const canSaveLabel = getAdminUsersSnapshotBooleanLabel(snapshot.canSave);
  const canCancelLabel = getAdminUsersSnapshotBooleanLabel(snapshot.canCancel);
  const canDeleteLabel = getAdminUsersSnapshotBooleanLabel(snapshot.canDelete);
  const canReloadLabel = getAdminUsersSnapshotBooleanLabel(snapshot.canReload);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-users-page-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminUsersSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Users 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Users: {snapshot.userCount}</span>
        <span>Active: {snapshot.activeUserCount}</span>
        <span>Disabled: {snapshot.disabledUserCount}</span>
        <span>Deleted: {snapshot.deletedUserCount}</span>
        <span>Unknown: {snapshot.unknownStatusCount}</span>
        <span>UnknownRoles: {snapshot.unknownRoleCount}</span>
        <span>UnknownStatusValues: {unknownStatusValuesLabel}</span>
        <span>UnknownRoleValues: {unknownRoleValuesLabel}</span>
        <span>Named: {snapshot.namedUserCount}</span>
        <span>AdminRoles: {snapshot.adminRoleCount}</span>
        <span>Editing: {editingUserIdLabel}</span>
        <span>DeletingUser: {deletingUserIdLabel}</span>
        <span>Role: {snapshot.selectedRole}</span>
        <span>Status: {snapshot.selectedStatus}</span>
        <span>Loading: {isLoadingLabel}</span>
        <span>Saving: {isSavingLabel}</span>
        <span>Deleting: {isDeletingLabel}</span>
        <span>Error: {hasErrorLabel}</span>
        <span>StartEdit: {canStartEditLabel}</span>
        <span>Save: {canSaveLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
        <span>Delete: {canDeleteLabel}</span>
        <span>Reload: {canReloadLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

function toAdminUserDeleteSnapshotStatus(userStatus?: AdminUserStatus): AdminUserDeleteSnapshotStatus {
  if (userStatus === 'active') return 'active';
  if (userStatus === 'disabled') return 'disabled';
  if (userStatus === 'deleted') return 'deleted';
  if (userStatus === 'unknown') return 'unknown';
  return 'none';
}

export function buildAdminUserSaveConfirmationSnapshot({
  editing,
  isOpen,
  saving,
  error,
}: {
  editing: AdminUsersEditingSnapshotInput;
  isOpen: boolean;
  saving: boolean;
  error: string;
}): AdminUserSaveConfirmationSnapshot {
  const hasEditing = editing !== null && editing.id.length > 0;
  const hasError = error.length > 0 && isOpen === true && hasEditing === true;
  const userRole = getAdminUsersEditingRole(editing);
  const userStatus = getAdminUsersEditingStatus(editing);
  const userEmail = getAdminUsersSnapshotLabel(editing?.email, 'none');
  const canConfirm = isOpen === true && hasEditing === true && saving === false && hasError === false;
  const canCancel = isOpen === true && hasEditing === true && saving === false;
  const status: AdminUserSaveConfirmationSnapshotStatus = isOpen === false || hasEditing === false
    ? 'closed'
    : saving === true
      ? 'confirming'
      : hasError === true
        ? 'save_failed'
        : 'awaiting_confirmation';
  const source: AdminUserSaveConfirmationSnapshotSource = status === 'closed'
    ? 'dialog_state'
    : userRole !== 'none' && userStatus !== 'none'
      ? 'user_save'
      : userRole !== 'none'
        ? 'role_update'
        : 'status_update';
  const riskLevel: AdminUserSaveConfirmationRiskLevel = hasEditing === false
    ? 'none'
    : userRole === 'super_admin' || userStatus === 'disabled'
      ? 'high'
      : 'medium';

  return {
    status,
    source,
    userId: getAdminUsersEditingUserId(editing),
    userEmail,
    userRole,
    userStatus,
    isSaving: saving,
    hasError,
    canConfirm,
    canCancel,
    riskLevel,
    message: status === 'closed'
      ? 'Admin User 保存确认未打开。'
      : status === 'confirming'
        ? 'Admin User 状态和角色正在写入。'
        : status === 'save_failed'
          ? 'Admin User 保存失败，后端尚未确认本次状态或角色变更。'
          : 'Admin User 状态和角色等待确认。',
    recovery: status === 'closed'
      ? '从用户列表选择编辑后再打开保存确认。'
      : status === 'confirming'
        ? '等待保存请求完成，避免重复提交。'
        : status === 'save_failed'
          ? '检查目标用户、角色和状态后重试，或取消返回列表。'
          : '确认该用户的状态和角色变更，保存后会刷新用户列表。',
    updatedAt: 'derived',
  };
}

export function buildAdminUserDeleteConfirmationSnapshot({
  pendingDelete,
  isOpen,
  deleting,
  error,
}: {
  pendingDelete: AdminUsersDeletingSnapshotInput;
  isOpen: boolean;
  deleting: boolean;
  error: string;
}): AdminUserDeleteConfirmationSnapshot {
  const hasPendingDelete = pendingDelete !== null && pendingDelete.id.length > 0;
  const hasError = error.length > 0 && isOpen === true && hasPendingDelete === true;
  const userEmail = getAdminUsersSnapshotLabel(pendingDelete?.email, 'none');
  const canConfirm = isOpen === true && hasPendingDelete === true && deleting === false && hasError === false;
  const canCancel = isOpen === true && hasPendingDelete === true && deleting === false;
  const status: AdminUserDeleteConfirmationSnapshotStatus = isOpen === false || hasPendingDelete === false
    ? 'closed'
    : deleting === true
      ? 'confirming'
      : hasError === true
        ? 'delete_failed'
        : 'awaiting_confirmation';
  const source: AdminUserDeleteConfirmationSnapshotSource = status === 'closed'
    ? 'dialog_state'
    : 'user_delete';
  const riskLevel: AdminUserDeleteConfirmationRiskLevel = hasPendingDelete === true
    ? 'high'
    : 'none';

  return {
    status,
    source,
    userId: getAdminUsersDeletingUserId(pendingDelete),
    userEmail,
    userStatus: getAdminUsersDeletingStatus(pendingDelete),
    isDeleting: deleting,
    hasError,
    canConfirm,
    canCancel,
    riskLevel,
    message: status === 'closed'
      ? 'Admin User 删除确认未打开。'
      : status === 'confirming'
        ? 'Admin User 正在执行软删除。'
        : status === 'delete_failed'
          ? 'Admin User 删除失败，后端尚未确认本次软删除。'
          : 'Admin User 软删除等待确认。',
    recovery: status === 'closed'
      ? '从用户列表选择删除后再打开确认。'
      : status === 'confirming'
        ? '等待删除请求完成，避免重复提交。'
        : status === 'delete_failed'
          ? '检查目标用户后重试，或取消返回列表。'
          : '确认后会调用既有 DELETE API 将用户标记为 deleted，并刷新用户列表。',
    updatedAt: 'derived',
  };
}

function getAdminUserDeleteConfirmationSnapshotClassName(snapshot: AdminUserDeleteConfirmationSnapshot) {
  if (snapshot.status === 'delete_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (snapshot.riskLevel === 'high') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-slate-500/30 bg-slate-50 text-slate-700 dark:bg-slate-900/20 dark:text-slate-300';
}

export function AdminUserDeleteConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminUserDeleteConfirmationSnapshot;
}) {
  const userIdLabel = getAdminUsersSnapshotLabel(snapshot.userId, 'none');
  const userEmailLabel = getAdminUsersSnapshotLabel(snapshot.userEmail, 'none');
  const isDeletingLabel = getAdminUsersSnapshotBooleanLabel(snapshot.isDeleting);
  const hasErrorLabel = getAdminUsersSnapshotBooleanLabel(snapshot.hasError);
  const canConfirmLabel = getAdminUsersSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getAdminUsersSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-user-delete-confirmation-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminUserDeleteConfirmationSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin User 删除确认</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>User: {userIdLabel}</span>
        <span>Email: {userEmailLabel}</span>
        <span>Status: {snapshot.userStatus}</span>
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

function getAdminUserSaveConfirmationSnapshotClassName(snapshot: AdminUserSaveConfirmationSnapshot) {
  if (snapshot.status === 'save_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (snapshot.riskLevel === 'high') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-slate-500/30 bg-slate-50 text-slate-700 dark:bg-slate-900/20 dark:text-slate-300';
}

export function AdminUserSaveConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminUserSaveConfirmationSnapshot;
}) {
  const userIdLabel = getAdminUsersSnapshotLabel(snapshot.userId, 'none');
  const userEmailLabel = getAdminUsersSnapshotLabel(snapshot.userEmail, 'none');
  const isSavingLabel = getAdminUsersSnapshotBooleanLabel(snapshot.isSaving);
  const hasErrorLabel = getAdminUsersSnapshotBooleanLabel(snapshot.hasError);
  const canConfirmLabel = getAdminUsersSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getAdminUsersSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-user-save-confirmation-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminUserSaveConfirmationSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin User 保存确认</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>User: {userIdLabel}</span>
        <span>Email: {userEmailLabel}</span>
        <span>Role: {snapshot.userRole}</span>
        <span>Status: {snapshot.userStatus}</span>
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
