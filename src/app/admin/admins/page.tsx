'use client';

import type { AdminManagerDeleteSnapshotSystemRole, AdminRoleId, AdminRoleIdList } from '../../workspace/workspace-types';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  adminManagersApi,
  adminRolesApi,
  type AdminManager,
  type AdminManagerId,
  type AdminManagerMutableStatus,
  type AdminManagerMutableSystemRole,
  type AdminPermissionCodeList,
  type AdminRole,
} from '@/lib/admin/api';
import { formatAdminOperationFailure } from '@/lib/admin/admin-operation-errors';
import {
  AdminManagerDeleteConfirmationSnapshotStrip,
  AdminManagerSaveConfirmationSnapshotStrip,
  AdminManagersPageSnapshotStrip,
  buildAdminManagerDeleteConfirmationSnapshot,
  buildAdminManagerSaveConfirmationSnapshot,
  buildAdminManagersPageSnapshot,
} from './admin-managers-page-snapshot';
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

type EditingAdminState = {
  id: AdminManagerId;
  role: AdminManagerMutableSystemRole;
  status: AdminManagerMutableStatus;
  role_ids: AdminRoleIdList;
};

type DeletingAdminState = {
  id: AdminManagerId;
  email: string;
  role: AdminManagerDeleteSnapshotSystemRole;
  selectedRoleCount: number;
};

function toEditableAdminManagerRole(value: string): AdminManagerMutableSystemRole {
  return value === 'super_admin' ? 'super_admin' : 'admin';
}

function toEditableAdminManagerStatus(value: string): AdminManagerMutableStatus {
  return value === 'disabled' ? 'disabled' : 'active';
}

function getAdminManagerUnknownStatusValue(admin: AdminManager): string | null {
  const hasRawStatus = admin.raw_status.length > 0;
  if (hasRawStatus === true) {
    return admin.raw_status;
  }
  const hasStatus = admin.status.length > 0;
  return hasStatus === true ? admin.status : null;
}

function getAdminManagerUnknownSystemRoleValue(admin: AdminManager): string | null {
  const hasRawRole = admin.raw_role.length > 0;
  if (hasRawRole === true) {
    return admin.raw_role;
  }
  const hasRole = admin.role.length > 0;
  return hasRole === true ? admin.role : null;
}

function getAdminManagerUnknownSystemRoleLabel(admin: AdminManager): string {
  const roleValue = getAdminManagerUnknownSystemRoleValue(admin);
  const hasRoleValue = roleValue !== null;
  return hasRoleValue === true ? `未知：${roleValue}` : '未知：unknown';
}

function getAdminManagerSystemRoleLabel(admin: AdminManager): string {
  const hasUnknownSystemRole = admin.role === 'unknown';
  return hasUnknownSystemRole === true ? getAdminManagerUnknownSystemRoleLabel(admin) : admin.role;
}

function getAdminManagerUsernameLabel(admin: AdminManager): string {
  const usernameValue = admin.username;
  const hasUsernameValue = usernameValue !== undefined;
  if (hasUsernameValue === false) {
    return '-';
  }
  const username = usernameValue.trim();
  const hasUsername = username.length > 0;
  return hasUsername === true ? username : '-';
}

function getAdminManagerAssignedRoles(admin: AdminManager): AdminRole[] {
  const assignedRoles = admin.assigned_roles;
  const hasAssignedRoles = assignedRoles !== undefined;
  return hasAssignedRoles === true ? assignedRoles : [];
}

function getAdminManagerAssignedRoleIds(admin: AdminManager): AdminRoleIdList {
  const roleIds: AdminRoleIdList = [];

  for (const role of getAdminManagerAssignedRoles(admin)) {
    roleIds.push(role.id);
  }

  return roleIds;
}

function getAdminManagerRoleDescriptionLabel(role: AdminRole): string {
  const description = role.description;
  const hasDescription = description !== undefined && description.length > 0;
  return hasDescription === true ? description : '无说明';
}

function getAdminManagerPermissionCodes(admin: AdminManager): AdminPermissionCodeList {
  const permissionCodes = admin.permission_codes;
  const hasPermissionCodes = permissionCodes !== undefined;
  return hasPermissionCodes === true ? permissionCodes : [];
}

function shouldRenderAdminManagersEmptyRow(admins: AdminManager[]): boolean {
  const hasAdmins = admins.length > 0;
  return hasAdmins === false;
}

function countAdminManagersByStatus(admins: AdminManager[], status: AdminManager['status']): number {
  let count = 0;

  for (const admin of admins) {
    const hasTargetStatus = admin.status === status;
    if (hasTargetStatus === true) {
      count += 1;
    }
  }

  return count;
}

function countAdminManagersBySystemRole(admins: AdminManager[], role: AdminManager['role']): number {
  let count = 0;

  for (const admin of admins) {
    const hasTargetRole = admin.role === role;
    if (hasTargetRole === true) {
      count += 1;
    }
  }

  return count;
}

function collectAdminManagerUnknownStatusValues(admins: AdminManager[]): string[] {
  const values = new Set<string>();

  for (const admin of admins) {
    const hasUnknownStatus = admin.status === 'unknown';
    if (hasUnknownStatus === false) {
      continue;
    }
    const value = getAdminManagerUnknownStatusValue(admin);
    const hasValue = value !== null;
    if (hasValue === true) {
      values.add(value);
    }
  }

  return Array.from(values).sort();
}

function collectAdminManagerUnknownSystemRoleValues(admins: AdminManager[]): string[] {
  const values = new Set<string>();

  for (const admin of admins) {
    const hasUnknownSystemRole = admin.role === 'unknown';
    if (hasUnknownSystemRole === false) {
      continue;
    }
    const value = getAdminManagerUnknownSystemRoleValue(admin);
    const hasValue = value !== null;
    if (hasValue === true) {
      values.add(value);
    }
  }

  return Array.from(values).sort();
}

function getAdminManagerRoleIdsWithoutRoleId(roleIds: AdminRoleIdList, roleId: AdminRoleId): AdminRoleIdList {
  const nextRoleIds: AdminRoleIdList = [];

  for (const id of roleIds) {
    const shouldKeepRoleId = id !== roleId;
    if (shouldKeepRoleId === true) {
      nextRoleIds.push(id);
    }
  }

  return nextRoleIds;
}

function materializeAdminManagerRoleBindingNodes(
  roles: AdminRole[],
  editing: EditingAdminState | null,
  onToggleRole: (roleId: AdminRoleId) => void,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const hasEditing = editing !== null;
  if (hasEditing === false) {
    return nodes;
  }

  for (const role of roles) {
    nodes.push(
      <label key={role.id} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <input
          type="checkbox"
          checked={editing.role_ids.includes(role.id)}
          onChange={() => onToggleRole(role.id)}
          className="mt-1"
        />
        <span>
          <span className="font-medium">{role.display_name}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">{role.name}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">{getAdminManagerRoleDescriptionLabel(role)}</span>
        </span>
      </label>,
    );
  }

  return nodes;
}

function materializeAdminManagerAssignedRoleNodes(admin: AdminManager): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const role of getAdminManagerAssignedRoles(admin)) {
    nodes.push(
      <span key={role.id} className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
        {role.display_name}
      </span>,
    );
  }

  return nodes;
}

function materializeAdminManagerPermissionCodeNodes(admin: AdminManager): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const code of getAdminManagerPermissionCodes(admin)) {
    nodes.push(
      <span key={code} className="px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
        {code}
      </span>,
    );
  }

  return nodes;
}

function materializeAdminManagerRowNodes({
  admins,
  adminManagersPageSnapshot,
  onStartEdit,
  onDelete,
}: {
  admins: AdminManager[];
  adminManagersPageSnapshot: ReturnType<typeof buildAdminManagersPageSnapshot>;
  onStartEdit: (admin: AdminManager) => void;
  onDelete: (admin: AdminManager) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const admin of admins) {
    const systemRoleLabel = getAdminManagerSystemRoleLabel(admin);
    nodes.push(
      <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900 dark:text-white">{admin.email}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{getAdminManagerUsernameLabel(admin)}</div>
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
          {systemRoleLabel}
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
          <div className="flex flex-wrap gap-1">
            {materializeAdminManagerAssignedRoleNodes(admin)}
          </div>
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
          <div className="flex flex-wrap gap-1">
            {materializeAdminManagerPermissionCodeNodes(admin)}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onStartEdit(admin)}
              disabled={adminManagersPageSnapshot.canStartEdit === false}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              编辑
            </button>
            <button
              type="button"
              onClick={() => onDelete(admin)}
              disabled={adminManagersPageSnapshot.canDelete === false}
              className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 rounded-lg transition-colors disabled:opacity-60"
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

function getAdminManagerSaveConfirmationDescription(editing: EditingAdminState | null): string {
  const hasEditing = editing !== null;
  return hasEditing === true
    ? `确定要保存管理员 ${editing.id} 的系统角色、状态和自定义角色绑定吗？`
    : '确定要保存当前管理员权限变更吗？';
}

function getAdminManagerDeleteConfirmationDescription(pendingDelete: DeletingAdminState | null): string {
  const hasPendingDelete = pendingDelete !== null;
  return hasPendingDelete === true
    ? `确定要删除管理员 ${pendingDelete.email} 吗？该操作会调用后台 DELETE 管理员接口。`
    : '确定要删除当前管理员吗？';
}

function getAdminManagerSaveConfirmationActionLabel(saving: boolean): string {
  return saving === true ? '保存中...' : '确认保存';
}

function getAdminManagerDeleteConfirmationActionLabel(deleting: boolean): string {
  return deleting === true ? '删除中...' : '确认删除';
}

export default function AdminManagersPage() {
  const [admins, setAdmins] = useState<AdminManager[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<EditingAdminState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeletingAdminState | null>(null);
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
  const [saveConfirmationError, setSaveConfirmationError] = useState('');
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deleteConfirmationError, setDeleteConfirmationError] = useState('');
  const hasPageError = error.length > 0;
  const shouldRenderEditForm = editing !== null;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [adminsData, rolesData] = await Promise.all([
        adminManagersApi.list(),
        adminRolesApi.list(),
      ]);
      setAdmins(adminsData.admins);
      setRoles(rolesData);
    } catch (err: unknown) {
      setError(formatAdminOperationFailure(err, '加载管理员失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const adminManagersPageSnapshot = buildAdminManagersPageSnapshot({
    loading,
    saving,
    deleting,
    error,
    adminCount: admins.length,
    roleCount: roles.length,
    activeAdminCount: countAdminManagersByStatus(admins, 'active'),
    disabledAdminCount: countAdminManagersByStatus(admins, 'disabled'),
    superAdminCount: countAdminManagersBySystemRole(admins, 'super_admin'),
    unknownStatusCount: countAdminManagersByStatus(admins, 'unknown'),
    unknownSystemRoleCount: countAdminManagersBySystemRole(admins, 'unknown'),
    unknownStatusValues: collectAdminManagerUnknownStatusValues(admins),
    unknownSystemRoleValues: collectAdminManagerUnknownSystemRoleValues(admins),
    editing,
    pendingDelete,
  });
  const adminManagerSaveConfirmationSnapshot = buildAdminManagerSaveConfirmationSnapshot({
    editing,
    isOpen: saveConfirmationOpen,
    saving,
    error: saveConfirmationError,
  });
  const adminManagerDeleteConfirmationSnapshot = buildAdminManagerDeleteConfirmationSnapshot({
    pendingDelete,
    isOpen: deleteConfirmationOpen,
    deleting,
    error: deleteConfirmationError,
  });
  const shouldRenderEmptyRow = shouldRenderAdminManagersEmptyRow(admins);
  const shouldRenderAdminRows = shouldRenderEmptyRow === false;
  const saveConfirmationDescription = getAdminManagerSaveConfirmationDescription(editing);
  const deleteConfirmationDescription = getAdminManagerDeleteConfirmationDescription(pendingDelete);
  const saveConfirmationActionLabel = getAdminManagerSaveConfirmationActionLabel(saving);
  const deleteConfirmationActionLabel = getAdminManagerDeleteConfirmationActionLabel(deleting);

  const startEdit = (admin: AdminManager) => {
    setSaveConfirmationOpen(false);
    setSaveConfirmationError('');
    setDeleteConfirmationOpen(false);
    setDeleteConfirmationError('');
    setPendingDelete(null);
    setEditing({
      id: admin.id,
      role: toEditableAdminManagerRole(admin.role),
      status: toEditableAdminManagerStatus(admin.status),
      role_ids: getAdminManagerAssignedRoleIds(admin),
    });
  };

  const toggleRole = (roleId: AdminRoleId) => {
    setEditing((prev) => {
      const hasEditing = prev !== null;
      if (hasEditing === false) {
        return prev;
      }
      const hasRoleId = prev.role_ids.includes(roleId);
      const nextRoleIds = hasRoleId === true
        ? getAdminManagerRoleIdsWithoutRoleId(prev.role_ids, roleId)
        : [...prev.role_ids, roleId];
      return {
        ...prev,
        role_ids: nextRoleIds,
      };
    });
  };

  const handleSave = async () => {
    if (editing === null) return;
    setSaving(true);
    setError('');
    setSaveConfirmationError('');
    try {
      await adminManagersApi.update(editing.id, {
        role: editing.role,
        status: editing.status,
        role_ids: editing.role_ids,
      });
      setSaveConfirmationOpen(false);
      setEditing(null);
      await loadData();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '保存管理员失败');
      setSaveConfirmationError(message);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const openSaveConfirmation = () => {
    setSaveConfirmationError('');
    setSaveConfirmationOpen(true);
  };

  const toDeleteSnapshotSystemRole = (role: AdminManager['role']): AdminManagerDeleteSnapshotSystemRole => {
    if (role === 'admin') return 'admin';
    if (role === 'super_admin') return 'super_admin';
    if (role === 'unknown') return 'unknown';
    return 'none';
  };

  const openDeleteConfirmation = (admin: AdminManager) => {
    setSaveConfirmationOpen(false);
    setSaveConfirmationError('');
    setEditing(null);
    setDeleteConfirmationError('');
    setPendingDelete({
      id: admin.id,
      email: admin.email,
      role: toDeleteSnapshotSystemRole(admin.role),
      selectedRoleCount: getAdminManagerAssignedRoles(admin).length,
    });
    setDeleteConfirmationOpen(true);
  };

  const cancelEditing = () => {
    setSaveConfirmationOpen(false);
    setSaveConfirmationError('');
    setEditing(null);
  };

  const cancelDelete = () => {
    setDeleteConfirmationOpen(false);
    setDeleteConfirmationError('');
    setPendingDelete(null);
  };

  const handleDelete = async () => {
    if (pendingDelete === null) return;
    setDeleting(true);
    setError('');
    setDeleteConfirmationError('');
    try {
      await adminManagersApi.delete(pendingDelete.id);
      setDeleteConfirmationOpen(false);
      setPendingDelete(null);
      await loadData();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '删除管理员失败');
      setDeleteConfirmationError(message);
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <AdminManagersPageSnapshotStrip snapshot={adminManagersPageSnapshot} />
        <div className="text-gray-500">正在加载管理员...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">管理员</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">超级管理员可绑定自定义角色，将容器配置权限授予指定管理员。</p>
      </div>
      <AdminManagersPageSnapshotStrip snapshot={adminManagersPageSnapshot} />

      {hasPageError === true && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {shouldRenderEditForm === true && (
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 block">
              <span className="text-sm text-gray-600 dark:text-gray-300">系统角色</span>
              <select
                value={editing.role}
                onChange={(event) => setEditing((prev) => {
                  const hasEditing = prev !== null;
                  if (hasEditing === false) {
                    return prev;
                  }
                  return { ...prev, role: toEditableAdminManagerRole(event.target.value) };
                })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
            </label>
            <label className="space-y-1 block">
              <span className="text-sm text-gray-600 dark:text-gray-300">状态</span>
              <select
                value={editing.status}
                onChange={(event) => setEditing((prev) => {
                  const hasEditing = prev !== null;
                  if (hasEditing === false) {
                    return prev;
                  }
                  return { ...prev, status: toEditableAdminManagerStatus(event.target.value) };
                })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">绑定自定义角色</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {materializeAdminManagerRoleBindingNodes(roles, editing, toggleRole)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openSaveConfirmation}
              disabled={adminManagersPageSnapshot.canSave === false}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60"
            >
              保存管理员
            </button>
            <button
              onClick={cancelEditing}
              disabled={adminManagersPageSnapshot.canCancel === false}
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
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">管理员</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">系统角色</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">自定义角色</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">权限</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {shouldRenderEmptyRow === true && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">暂无管理员</td>
              </tr>
            )}
            {shouldRenderAdminRows === true && materializeAdminManagerRowNodes({
              admins,
              adminManagersPageSnapshot,
              onStartEdit: startEdit,
              onDelete: openDeleteConfirmation,
            })}
          </tbody>
        </table>
      </div>
      <AlertDialog
        open={saveConfirmationOpen}
        onOpenChange={(open) => {
          if (open === false && adminManagerSaveConfirmationSnapshot.canCancel === true) {
            setSaveConfirmationOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认保存管理员权限</AlertDialogTitle>
            <AlertDialogDescription>
              {saveConfirmationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AdminManagerSaveConfirmationSnapshotStrip snapshot={adminManagerSaveConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={adminManagerSaveConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={adminManagerSaveConfirmationSnapshot.canConfirm === false}
              onClick={(event) => {
                event.preventDefault();
                if (adminManagerSaveConfirmationSnapshot.canConfirm === true) {
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
          if (open === false && adminManagerDeleteConfirmationSnapshot.canCancel === true) {
            cancelDelete();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除管理员</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AdminManagerDeleteConfirmationSnapshotStrip snapshot={adminManagerDeleteConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={adminManagerDeleteConfirmationSnapshot.canCancel === false}
              onClick={cancelDelete}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={adminManagerDeleteConfirmationSnapshot.canConfirm === false}
              onClick={(event) => {
                event.preventDefault();
                if (adminManagerDeleteConfirmationSnapshot.canConfirm === true) {
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
