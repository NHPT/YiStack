'use client';

import type { AdminUserDeletingId, AdminUserEditingId } from '../../workspace/workspace-types';
import type { ReactNode } from 'react';
import { useEffect, useState, useCallback } from 'react';
import {
  adminUsersApi,
  type AdminUser,
  type AdminUserMutableRole,
  type AdminUserMutableStatus,
} from '@/lib/admin/api';
import { formatAdminOperationFailure } from '@/lib/admin/admin-operation-errors';
import {
  AdminUserDeleteConfirmationSnapshotStrip,
  AdminUserSaveConfirmationSnapshotStrip,
  AdminUsersPageSnapshotStrip,
  buildAdminUserDeleteConfirmationSnapshot,
  buildAdminUserSaveConfirmationSnapshot,
  buildAdminUsersPageSnapshot,
} from './admin-users-page-snapshot';
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

type EditingUserState = {
  id: AdminUserEditingId;
  email: string;
  role: AdminUserMutableRole;
  status: AdminUserMutableStatus;
};

type DeletingUserState = {
  id: AdminUserDeletingId;
  email: string;
  status: AdminUser['status'];
};

function toEditableAdminUserRole(value: string): AdminUserMutableRole {
  if (value === 'admin') return 'admin';
  if (value === 'super_admin') return 'super_admin';
  return 'user';
}

function toEditableAdminUserStatus(value: string): AdminUserMutableStatus {
  return value === 'disabled' ? 'disabled' : 'active';
}

function hasAdminUserDeleteAvailable(user: AdminUser): boolean {
  return user.status !== 'deleted';
}

function getAdminUserOptionalLabel(value: string | undefined | null): string {
  const hasValue = value !== undefined && value !== null;
  if (hasValue === false) {
    return '-';
  }
  const normalizedValue = value.trim();
  const hasNormalizedValue = normalizedValue.length > 0;
  return hasNormalizedValue === true ? normalizedValue : '-';
}

function getAdminUserUnknownRoleValue(user: AdminUser): string | null {
  const hasRawRole = user.raw_role.length > 0;
  if (hasRawRole === true) {
    return user.raw_role;
  }
  const hasRole = user.role.length > 0;
  return hasRole === true ? user.role : null;
}

function getAdminUserUnknownRoleLabel(user: AdminUser): string {
  const roleValue = getAdminUserUnknownRoleValue(user);
  const hasRoleValue = roleValue !== null;
  return hasRoleValue === true ? `未知：${roleValue}` : '未知：unknown';
}

function getAdminUserRoleLabel(user: AdminUser): string {
  const hasUnknownRole = user.role === 'unknown';
  return hasUnknownRole === true ? getAdminUserUnknownRoleLabel(user) : user.role;
}

function getAdminUserUnknownStatusValue(user: AdminUser): string | null {
  const hasRawStatus = user.raw_status.length > 0;
  if (hasRawStatus === true) {
    return user.raw_status;
  }
  const hasStatus = user.status.length > 0;
  return hasStatus === true ? user.status : null;
}

function getAdminUserUnknownStatusLabel(user: AdminUser): string {
  const statusValue = getAdminUserUnknownStatusValue(user);
  const hasStatusValue = statusValue !== null;
  return hasStatusValue === true ? `未知：${statusValue}` : '未知：unknown';
}

function getAdminUserStatusBadgeClassName(user: AdminUser): string {
  const hasActiveStatus = user.status === 'active';
  return hasActiveStatus === true
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
}

function getAdminUserStatusLabel(user: AdminUser): string {
  const hasActiveStatus = user.status === 'active';
  if (hasActiveStatus === true) {
    return '启用';
  }
  const hasDisabledStatus = user.status === 'disabled';
  if (hasDisabledStatus === true) {
    return '禁用';
  }
  const hasDeletedStatus = user.status === 'deleted';
  if (hasDeletedStatus === true) {
    return '已删除';
  }
  return getAdminUserUnknownStatusLabel(user);
}

function getAdminUserCreatedAtLabel(createdAt: string | null): string {
  const hasCreatedAt = createdAt !== null && createdAt.length > 0;
  return hasCreatedAt === true ? new Date(createdAt).toLocaleString() : '-';
}

function shouldRenderAdminUsersEmptyRow(users: AdminUser[]): boolean {
  const userCount = users.length;
  return userCount === 0;
}

function getAdminUserSaveConfirmationDescription(editing: EditingUserState | null): string {
  const hasEditing = editing !== null;
  return hasEditing === true
    ? `确定要保存用户 ${editing.email} 的角色和状态吗？`
    : '确定要保存当前用户变更吗？';
}

function getAdminUserDeleteConfirmationDescription(pendingDelete: DeletingUserState | null): string {
  const hasPendingDelete = pendingDelete !== null;
  return hasPendingDelete === true
    ? `确定要删除用户 ${pendingDelete.email} 吗？当前实现会将用户状态标记为 deleted。`
    : '确定要删除当前用户吗？';
}

function getAdminUserSaveConfirmationActionLabel(saving: boolean): string {
  return saving === true ? '保存中...' : '确认保存';
}

function getAdminUserDeleteConfirmationActionLabel(deleting: boolean): string {
  return deleting === true ? '删除中...' : '确认删除';
}

function materializeAdminUserRowNodes({
  users,
  snapshot,
  onStartEdit,
  onOpenDeleteConfirmation,
}: {
  users: AdminUser[];
  snapshot: ReturnType<typeof buildAdminUsersPageSnapshot>;
  onStartEdit: (user: AdminUser) => void;
  onOpenDeleteConfirmation: (user: AdminUser) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const user of users) {
    const roleLabel = getAdminUserRoleLabel(user);
    const statusBadgeClassName = getAdminUserStatusBadgeClassName(user);
    const statusLabel = getAdminUserStatusLabel(user);

    nodes.push(
      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
        <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{user.email}</td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{getAdminUserOptionalLabel(user.username)}</td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
          {roleLabel}
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusBadgeClassName}`}>
            {statusLabel}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
          {getAdminUserCreatedAtLabel(user.created_at)}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onStartEdit(user)}
              disabled={snapshot.canStartEdit === false}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-60"
            >
              编辑
            </button>
            <button
              type="button"
              onClick={() => onOpenDeleteConfirmation(user)}
              disabled={snapshot.canDelete === false || hasAdminUserDeleteAvailable(user) === false}
              className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 rounded-lg transition-colors disabled:opacity-60"
            >
              删除
            </button>
          </div>
        </td>
      </tr>,
    );
  }

  return nodes;
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<EditingUserState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeletingUserState | null>(null);
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
  const [saveConfirmationError, setSaveConfirmationError] = useState('');
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deleteConfirmationError, setDeleteConfirmationError] = useState('');
  const hasPageError = error.length > 0;
  const shouldRenderEditForm = editing !== null;
  const shouldRenderEmptyRow = shouldRenderAdminUsersEmptyRow(users);
  const shouldRenderUserRows = shouldRenderEmptyRow === false;
  const saveConfirmationDescription = getAdminUserSaveConfirmationDescription(editing);
  const deleteConfirmationDescription = getAdminUserDeleteConfirmationDescription(pendingDelete);
  const saveConfirmationActionLabel = getAdminUserSaveConfirmationActionLabel(saving);
  const deleteConfirmationActionLabel = getAdminUserDeleteConfirmationActionLabel(deleting);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await adminUsersApi.list();
      setUsers(list);
    } catch (err: unknown) {
      setError(formatAdminOperationFailure(err, '加载用户失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const adminUsersPageSnapshot = buildAdminUsersPageSnapshot({
    loading,
    saving,
    deleting,
    error,
    users,
    editing,
    pendingDelete,
  });
  const adminUserSaveConfirmationSnapshot = buildAdminUserSaveConfirmationSnapshot({
    editing,
    isOpen: saveConfirmationOpen,
    saving,
    error: saveConfirmationError,
  });
  const adminUserDeleteConfirmationSnapshot = buildAdminUserDeleteConfirmationSnapshot({
    pendingDelete,
    isOpen: deleteConfirmationOpen,
    deleting,
    error: deleteConfirmationError,
  });

  const startEdit = (user: AdminUser) => {
    setSaveConfirmationOpen(false);
    setSaveConfirmationError('');
    setDeleteConfirmationOpen(false);
    setDeleteConfirmationError('');
    setPendingDelete(null);
    setEditing({
      id: user.id,
      email: user.email,
      role: toEditableAdminUserRole(user.role),
      status: toEditableAdminUserStatus(user.status),
    });
  };

  const openSaveConfirmation = () => {
    setSaveConfirmationError('');
    setSaveConfirmationOpen(true);
  };

  const openDeleteConfirmation = (user: AdminUser) => {
    if (hasAdminUserDeleteAvailable(user) === false) return;
    setSaveConfirmationOpen(false);
    setSaveConfirmationError('');
    setEditing(null);
    setDeleteConfirmationError('');
    setPendingDelete({
      id: user.id,
      email: user.email,
      status: user.status,
    });
    setDeleteConfirmationOpen(true);
  };

  const cancelEditing = () => {
    setSaveConfirmationOpen(false);
    setSaveConfirmationError('');
    setEditing(null);
  };

  const cancelDeleting = () => {
    setDeleteConfirmationOpen(false);
    setDeleteConfirmationError('');
    setPendingDelete(null);
  };

  const handleSave = async () => {
    if (editing === null) return;
    setSaving(true);
    setError('');
    setSaveConfirmationError('');
    try {
      await adminUsersApi.update(editing.id, {
        role: editing.role,
        status: editing.status,
      });
      setSaveConfirmationOpen(false);
      setEditing(null);
      await loadUsers();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '保存用户失败');
      setSaveConfirmationError(message);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (pendingDelete === null) return;
    setDeleting(true);
    setError('');
    setDeleteConfirmationError('');
    try {
      await adminUsersApi.delete(pendingDelete.id);
      setDeleteConfirmationOpen(false);
      setPendingDelete(null);
      await loadUsers();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '删除用户失败');
      setDeleteConfirmationError(message);
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <AdminUsersPageSnapshotStrip snapshot={adminUsersPageSnapshot} />
        <div className="text-gray-500">正在加载用户...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">用户管理</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">查看和管理用户账号</p>
        </div>
        <button
          type="button"
          onClick={() => void loadUsers()}
          disabled={adminUsersPageSnapshot.canReload === false}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
        >
          刷新用户
        </button>
      </div>
      <AdminUsersPageSnapshotStrip snapshot={adminUsersPageSnapshot} />

      {hasPageError === true && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {shouldRenderEditForm === true && (
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">编辑用户状态和角色</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{editing.email}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 block">
              <span className="text-sm text-gray-600 dark:text-gray-300">角色</span>
              <select
                value={editing.role}
                onChange={(event) => setEditing((prev) => prev === null ? prev : { ...prev, role: toEditableAdminUserRole(event.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
            </label>
            <label className="space-y-1 block">
              <span className="text-sm text-gray-600 dark:text-gray-300">状态</span>
              <select
                value={editing.status}
                onChange={(event) => setEditing((prev) => prev === null ? prev : { ...prev, status: toEditableAdminUserStatus(event.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openSaveConfirmation}
              disabled={adminUsersPageSnapshot.canSave === false}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60"
            >
              保存用户
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={adminUsersPageSnapshot.canCancel === false}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-lg"
            >
              取消
            </button>
          </div>
        </section>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">邮箱</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">名称</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">角色</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">状态</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">创建时间</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {shouldRenderEmptyRow === true && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">暂无用户</td>
              </tr>
            )}
            {shouldRenderUserRows === true && (
              materializeAdminUserRowNodes({
                users,
                snapshot: adminUsersPageSnapshot,
                onStartEdit: startEdit,
                onOpenDeleteConfirmation: openDeleteConfirmation,
              })
            )}
          </tbody>
        </table>
      </div>
      <AlertDialog
        open={saveConfirmationOpen}
        onOpenChange={(open) => {
          if (open === false && adminUserSaveConfirmationSnapshot.canCancel === true) {
            setSaveConfirmationOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认保存用户状态和角色</AlertDialogTitle>
            <AlertDialogDescription>
              {saveConfirmationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AdminUserSaveConfirmationSnapshotStrip snapshot={adminUserSaveConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={adminUserSaveConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={adminUserSaveConfirmationSnapshot.canConfirm === false}
              onClick={(event) => {
                event.preventDefault();
                if (adminUserSaveConfirmationSnapshot.canConfirm === true) {
                  void handleSave();
                }
              }}
            >
              {saveConfirmationActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={deleteConfirmationOpen}
        onOpenChange={(open) => {
          if (open === false && adminUserDeleteConfirmationSnapshot.canCancel === true) {
            cancelDeleting();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除用户</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AdminUserDeleteConfirmationSnapshotStrip snapshot={adminUserDeleteConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={adminUserDeleteConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={adminUserDeleteConfirmationSnapshot.canConfirm === false}
              onClick={(event) => {
                event.preventDefault();
                if (adminUserDeleteConfirmationSnapshot.canConfirm === true) {
                  void handleDelete();
                }
              }}
            >
              {deleteConfirmationActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
