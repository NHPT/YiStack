'use client';

import type { AdminPermissionId, AdminPermissionIdList, AdminRoleDeletingId, AdminRoleEditingId } from '../../workspace/workspace-types';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminPermissionsApi,
  adminRolesApi,
  type AdminPermission,
  type AdminRole,
  type AdminRoleMutableStatus,
} from '@/lib/admin/api';
import { formatAdminOperationFailure } from '@/lib/admin/admin-operation-errors';
import {
  AdminRoleDeleteConfirmationSnapshotStrip,
  AdminRoleSaveConfirmationSnapshotStrip,
  AdminRolesPageSnapshotStrip,
  buildAdminRoleDeleteConfirmationSnapshot,
  buildAdminRoleSaveConfirmationSnapshot,
  buildAdminRolesPageSnapshot,
} from './admin-roles-page-snapshot';
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

type RoleFormState = {
  name: string;
  display_name: string;
  description: string;
  status: AdminRoleMutableStatus;
  permission_ids: AdminPermissionIdList;
};

type DeletingRoleState = {
  id: AdminRoleDeletingId;
  name: string;
  displayName: string;
  selectedPermissionCount: number;
  isSystemRole: boolean;
};

const emptyForm: RoleFormState = {
  name: '',
  display_name: '',
  description: '',
  status: 'active',
  permission_ids: [],
};

function toEditableAdminRoleStatus(value: string): AdminRoleMutableStatus {
  const hasDisabledStatus = value === 'disabled';
  return hasDisabledStatus === true ? 'disabled' : 'active';
}

function getAdminRoleUnknownStatusValue(role: AdminRole): string | null {
  const hasRawStatus = role.raw_status.length > 0;
  if (hasRawStatus === true) {
    return role.raw_status;
  }
  const hasStatus = role.status.length > 0;
  return hasStatus === true ? role.status : null;
}

function getAdminRoleUnknownStatusLabel(role: AdminRole): string {
  const statusValue = getAdminRoleUnknownStatusValue(role);
  const hasStatusValue = statusValue !== null;
  return hasStatusValue === true ? `未知：${statusValue}` : '未知：unknown';
}

function getAdminRoleStatusLabel(role: AdminRole): string {
  const hasUnknownStatus = role.status === 'unknown';
  return hasUnknownStatus === true ? getAdminRoleUnknownStatusLabel(role) : role.status;
}

function getAdminRolePermissionCodeFirstSegment(code: string): string | undefined {
  const segments = code.split('.');

  for (const segment of segments) {
    return segment;
  }

  return undefined;
}

function getAdminRolePermissionGroupPrefix(permission: AdminPermission): string {
  const prefix = getAdminRolePermissionCodeFirstSegment(permission.code);
  const hasPrefix = prefix !== undefined && prefix.length > 0;
  return hasPrefix === true ? prefix : 'other';
}

function getAdminRolePermissionGroupList(groups: Map<string, AdminPermission[]>, prefix: string): AdminPermission[] {
  const permissions = groups.get(prefix);
  const hasPermissions = permissions !== undefined;
  return hasPermissions === true ? permissions : [];
}

function getAdminRolePermissions(role: AdminRole): AdminPermission[] {
  const permissions = role.permissions;
  const hasPermissions = Array.isArray(permissions) === true;
  return hasPermissions === true ? permissions : [];
}

function getAdminRolePermissionIds(role: AdminRole): AdminPermissionIdList {
  const permissions = getAdminRolePermissions(role);
  const permissionIds: AdminPermissionIdList = [];

  for (const permission of permissions) {
    permissionIds.push(permission.id);
  }

  return permissionIds;
}

function getAdminRolePermissionCount(role: AdminRole): number {
  const permissions = getAdminRolePermissions(role);
  return permissions.length;
}

function getAdminRoleDescription(role: AdminRole): string {
  const description = role.description;
  const hasDescription = description !== undefined;
  return hasDescription === true ? description : '';
}

function getAdminPermissionDescriptionLabel(permission: AdminPermission): string {
  const description = permission.description;
  const hasDescription = description !== undefined && description.length > 0;
  return hasDescription === true ? description : permission.name;
}

function getAdminRoleSaveConfirmationRoleLabel(
  form: RoleFormState,
  editingRoleId: AdminRoleEditingId | null,
): string {
  const hasDisplayName = form.display_name.length > 0;
  if (hasDisplayName === true) {
    return form.display_name;
  }

  const hasName = form.name.length > 0;
  if (hasName === true) {
    return form.name;
  }

  const hasEditingRoleId = editingRoleId !== null;
  return hasEditingRoleId === true ? editingRoleId : 'none';
}

function getAdminRoleDeleteConfirmationRoleLabel(pendingDelete: DeletingRoleState): string {
  const hasDisplayName = pendingDelete.displayName.length > 0;
  return hasDisplayName === true ? pendingDelete.displayName : pendingDelete.name;
}

function shouldRenderAdminRoleSystemBadge(role: AdminRole): boolean {
  return role.is_system === true;
}

function shouldRenderAdminRolesEmptyRow(roles: AdminRole[]): boolean {
  const hasRoles = roles.length > 0;
  return hasRoles === false;
}

function getAdminRolePermissionGroups(permissions: AdminPermission[]): Array<[string, AdminPermission[]]> {
  const groups = new Map<string, AdminPermission[]>();

  for (const permission of permissions) {
    const prefix = getAdminRolePermissionGroupPrefix(permission);
    const list = getAdminRolePermissionGroupList(groups, prefix);
    list.push(permission);
    groups.set(prefix, list);
  }

  return Array.from(groups.entries());
}

function resolveAdminRoleById(roles: AdminRole[], roleId: AdminRoleEditingId): AdminRole | null {
  for (const role of roles) {
    const isTargetRole = role.id === roleId;
    if (isTargetRole === true) {
      return role;
    }
  }

  return null;
}

function countAdminRolesBySystemRole(roles: AdminRole[]): number {
  let count = 0;

  for (const role of roles) {
    const isSystemRole = role.is_system === true;
    if (isSystemRole === true) {
      count += 1;
    }
  }

  return count;
}

function countAdminRolesByStatus(roles: AdminRole[], status: AdminRole['status']): number {
  let count = 0;

  for (const role of roles) {
    const hasTargetStatus = role.status === status;
    if (hasTargetStatus === true) {
      count += 1;
    }
  }

  return count;
}

function collectAdminRoleUnknownStatusValues(roles: AdminRole[]): string[] {
  const values = new Set<string>();

  for (const role of roles) {
    const hasUnknownStatus = role.status === 'unknown';
    if (hasUnknownStatus === false) {
      continue;
    }
    const value = getAdminRoleUnknownStatusValue(role);
    const hasValue = value !== null;
    if (hasValue === true) {
      values.add(value);
    }
  }

  return Array.from(values).sort();
}

function getAdminRolePermissionIdsWithoutPermissionId(
  permissionIds: AdminPermissionIdList,
  permissionId: AdminPermissionId,
): AdminPermissionIdList {
  const nextPermissionIds: AdminPermissionIdList = [];

  for (const id of permissionIds) {
    const shouldKeepPermissionId = id !== permissionId;
    if (shouldKeepPermissionId === true) {
      nextPermissionIds.push(id);
    }
  }

  return nextPermissionIds;
}

function materializeAdminRolePermissionInputNodes({
  permissions,
  form,
  onTogglePermission,
}: {
  permissions: AdminPermission[];
  form: RoleFormState;
  onTogglePermission: (permissionId: AdminPermissionId) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const permission of permissions) {
    nodes.push(
      <label key={permission.id} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={form.permission_ids.includes(permission.id)}
          onChange={() => onTogglePermission(permission.id)}
          className="mt-1"
        />
        <span>
          <span className="font-mono">{permission.code}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">{getAdminPermissionDescriptionLabel(permission)}</span>
        </span>
      </label>,
    );
  }

  return nodes;
}

function materializeAdminRolePermissionGroupNodes({
  permissionGroups,
  form,
  onTogglePermission,
}: {
  permissionGroups: Array<[string, AdminPermission[]]>;
  form: RoleFormState;
  onTogglePermission: (permissionId: AdminPermissionId) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const [groupName, items] of permissionGroups) {
    nodes.push(
      <div key={groupName} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">{groupName}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {materializeAdminRolePermissionInputNodes({
            permissions: items,
            form,
            onTogglePermission,
          })}
        </div>
      </div>,
    );
  }

  return nodes;
}

function materializeAdminRolePermissionCodeNodes(role: AdminRole): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const permission of getAdminRolePermissions(role)) {
    nodes.push(
      <span key={permission.id} className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
        {permission.code}
      </span>,
    );
  }

  return nodes;
}

function materializeAdminRoleRowNodes({
  roles,
  adminRolesPageSnapshot,
  onStartEdit,
  onDelete,
}: {
  roles: AdminRole[];
  adminRolesPageSnapshot: ReturnType<typeof buildAdminRolesPageSnapshot>;
  onStartEdit: (role: AdminRole) => void;
  onDelete: (role: AdminRole) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const role of roles) {
    nodes.push(
      <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900 dark:text-white">{role.display_name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">{role.name}</div>
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
          {getAdminRoleStatusLabel(role)}
          {shouldRenderAdminRoleSystemBadge(role) === true && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">系统角色</span>}
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
          <div className="flex flex-wrap gap-1">
            {materializeAdminRolePermissionCodeNodes(role)}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onStartEdit(role)}
              disabled={adminRolesPageSnapshot.canCreate === false}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-60"
            >
              编辑
            </button>
            <button
              type="button"
              onClick={() => onDelete(role)}
              disabled={adminRolesPageSnapshot.canDelete === false}
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

function getAdminRoleSaveConfirmationTitle(editingRoleId: AdminRoleEditingId | null): string {
  const isCreatingRole = editingRoleId === 'new';
  return isCreatingRole === true ? '确认创建角色' : '确认保存角色权限';
}

function getAdminRoleSaveConfirmationDescription(
  form: RoleFormState,
  editingRoleId: AdminRoleEditingId | null,
): string {
  const hasEditingRole = editingRoleId !== null;
  return hasEditingRole === true
    ? `确定要保存角色“${getAdminRoleSaveConfirmationRoleLabel(form, editingRoleId)}”的状态和权限绑定吗？`
    : '确定要保存当前角色权限变更吗？';
}

function getAdminRoleDeleteConfirmationDescription(pendingDelete: DeletingRoleState | null): string {
  const hasPendingDelete = pendingDelete !== null;
  return hasPendingDelete === true
    ? `确定要删除角色“${getAdminRoleDeleteConfirmationRoleLabel(pendingDelete)}”吗？该操作会删除角色权限绑定和管理员绑定关系。`
    : '确定要删除当前角色吗？';
}

function getAdminRoleSaveConfirmationActionLabel(saving: boolean): string {
  return saving === true ? '保存中...' : '确认保存';
}

function getAdminRoleDeleteConfirmationActionLabel(deleting: boolean): string {
  return deleting === true ? '删除中...' : '确认删除';
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<AdminRoleEditingId | null>(null);
  const [form, setForm] = useState<RoleFormState>(emptyForm);
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
  const [saveConfirmationError, setSaveConfirmationError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<DeletingRoleState | null>(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deleteConfirmationError, setDeleteConfirmationError] = useState('');
  const hasPageError = error.length > 0;
  const shouldRenderRoleForm = editingRoleId !== null;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rolesData, permissionsData] = await Promise.all([
        adminRolesApi.list(),
        adminPermissionsApi.list(),
      ]);
      setRoles(rolesData);
      setPermissions(permissionsData);
    } catch (err: unknown) {
      setError(formatAdminOperationFailure(err, '加载角色权限失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const permissionGroups = useMemo(() => getAdminRolePermissionGroups(permissions), [permissions]);
  const currentEditingRole = useMemo(() => {
    if (editingRoleId === null || editingRoleId === 'new') {
      return null;
    }
    return resolveAdminRoleById(roles, editingRoleId);
  }, [editingRoleId, roles]);
  const isCurrentEditingSystemRole = currentEditingRole !== null && currentEditingRole.is_system === true;
  const adminRolesPageSnapshot = buildAdminRolesPageSnapshot({
    loading,
    saving,
    deleting,
    error,
    roleCount: roles.length,
    permissionCount: permissions.length,
    permissionGroupCount: permissionGroups.length,
    systemRoleCount: countAdminRolesBySystemRole(roles),
    unknownStatusCount: countAdminRolesByStatus(roles, 'unknown'),
    unknownStatusValues: collectAdminRoleUnknownStatusValues(roles),
    editingRoleId,
    pendingDelete,
    form,
  });
  const adminRoleSaveConfirmationSnapshot = buildAdminRoleSaveConfirmationSnapshot({
    editingRoleId,
    form,
    isOpen: saveConfirmationOpen,
    saving,
    error: saveConfirmationError,
    isSystemRole: isCurrentEditingSystemRole,
  });
  const adminRoleDeleteConfirmationSnapshot = buildAdminRoleDeleteConfirmationSnapshot({
    pendingDelete,
    isOpen: deleteConfirmationOpen,
    deleting,
    error: deleteConfirmationError,
  });
  const shouldRenderEmptyRow = shouldRenderAdminRolesEmptyRow(roles);
  const shouldRenderRoleRows = shouldRenderEmptyRow === false;
  const saveConfirmationTitle = getAdminRoleSaveConfirmationTitle(editingRoleId);
  const saveConfirmationDescription = getAdminRoleSaveConfirmationDescription(form, editingRoleId);
  const deleteConfirmationDescription = getAdminRoleDeleteConfirmationDescription(pendingDelete);
  const saveConfirmationActionLabel = getAdminRoleSaveConfirmationActionLabel(saving);
  const deleteConfirmationActionLabel = getAdminRoleDeleteConfirmationActionLabel(deleting);

  const startCreate = () => {
    setSaveConfirmationOpen(false);
    setSaveConfirmationError('');
    setDeleteConfirmationOpen(false);
    setDeleteConfirmationError('');
    setPendingDelete(null);
    setEditingRoleId('new');
    setForm(emptyForm);
  };

  const startEdit = (role: AdminRole) => {
    setSaveConfirmationOpen(false);
    setSaveConfirmationError('');
    setDeleteConfirmationOpen(false);
    setDeleteConfirmationError('');
    setPendingDelete(null);
    setEditingRoleId(role.id);
    setForm({
      name: role.name,
      display_name: role.display_name,
      description: getAdminRoleDescription(role),
      status: toEditableAdminRoleStatus(role.status),
      permission_ids: getAdminRolePermissionIds(role),
    });
  };

  const cancelEdit = () => {
    setSaveConfirmationOpen(false);
    setSaveConfirmationError('');
    setEditingRoleId(null);
    setForm(emptyForm);
  };

  const openDeleteConfirmation = (role: AdminRole) => {
    setSaveConfirmationOpen(false);
    setSaveConfirmationError('');
    setEditingRoleId(null);
    setForm(emptyForm);
    setDeleteConfirmationError('');
    setPendingDelete({
      id: role.id,
      name: role.name,
      displayName: role.display_name,
      selectedPermissionCount: getAdminRolePermissionCount(role),
      isSystemRole: role.is_system === true,
    });
    setDeleteConfirmationOpen(true);
  };

  const cancelDelete = () => {
    setDeleteConfirmationOpen(false);
    setDeleteConfirmationError('');
    setPendingDelete(null);
  };

  const togglePermission = (permissionId: AdminPermissionId) => {
    setForm((prev) => {
      const hasPermissionId = prev.permission_ids.includes(permissionId);
      const nextPermissionIds = hasPermissionId === true
        ? getAdminRolePermissionIdsWithoutPermissionId(prev.permission_ids, permissionId)
        : [...prev.permission_ids, permissionId];
      return {
        ...prev,
        permission_ids: nextPermissionIds,
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaveConfirmationError('');
    try {
      if (editingRoleId === 'new') {
        await adminRolesApi.create(form);
      } else if (editingRoleId !== null) {
        await adminRolesApi.update(editingRoleId, form);
      }
      setSaveConfirmationOpen(false);
      cancelEdit();
      await loadData();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '保存角色失败');
      setSaveConfirmationError(message);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (pendingDelete === null) return;
    if (pendingDelete.isSystemRole === true) return;
    setDeleting(true);
    setError('');
    setDeleteConfirmationError('');
    try {
      await adminRolesApi.delete(pendingDelete.id);
      setDeleteConfirmationOpen(false);
      setPendingDelete(null);
      await loadData();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '删除角色失败');
      setDeleteConfirmationError(message);
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  const openSaveConfirmation = () => {
    setSaveConfirmationError('');
    setSaveConfirmationOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <AdminRolesPageSnapshotStrip snapshot={adminRolesPageSnapshot} />
        <div className="text-gray-500">正在加载角色权限...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">角色权限</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">超级管理员可创建角色并分配后台权限点</p>
        </div>
        <button
          onClick={startCreate}
          disabled={adminRolesPageSnapshot.canCreate === false}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          新建角色
        </button>
      </div>
      <AdminRolesPageSnapshotStrip snapshot={adminRolesPageSnapshot} />

      {hasPageError === true && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {shouldRenderRoleForm === true && (
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-sm text-gray-600 dark:text-gray-300">角色标识</span>
              <input
                value={form.name}
                disabled={editingRoleId !== 'new'}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-60"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-600 dark:text-gray-300">显示名称</span>
              <input
                value={form.display_name}
                onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="text-sm text-gray-600 dark:text-gray-300">说明</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-sm text-gray-600 dark:text-gray-300">状态</span>
            <select
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: toEditableAdminRoleStatus(e.target.value) }))}
              className="w-full md:w-60 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </label>

          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">权限点</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">容器配置相关权限为 `system.container_config.read/update`。</p>
            </div>
            <div className="space-y-4">
              {materializeAdminRolePermissionGroupNodes({
                permissionGroups,
                form,
                onTogglePermission: togglePermission,
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openSaveConfirmation}
              disabled={adminRolesPageSnapshot.canSave === false}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60"
            >
              保存角色
            </button>
            <button
              onClick={cancelEdit}
              disabled={adminRolesPageSnapshot.canCancel === false}
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
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">角色</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">状态</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">权限</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {shouldRenderEmptyRow === true && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">暂无角色</td>
              </tr>
            )}
            {shouldRenderRoleRows === true && materializeAdminRoleRowNodes({
              roles,
              adminRolesPageSnapshot,
              onStartEdit: startEdit,
              onDelete: openDeleteConfirmation,
            })}
          </tbody>
        </table>
      </div>
      <AlertDialog
        open={saveConfirmationOpen}
        onOpenChange={(open) => {
          if (open === false && adminRoleSaveConfirmationSnapshot.canCancel === true) {
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
          <AdminRoleSaveConfirmationSnapshotStrip snapshot={adminRoleSaveConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={adminRoleSaveConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={adminRoleSaveConfirmationSnapshot.canConfirm === false}
              onClick={(event) => {
                event.preventDefault();
                if (adminRoleSaveConfirmationSnapshot.canConfirm === true) {
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
          if (open === false && adminRoleDeleteConfirmationSnapshot.canCancel === true) {
            cancelDelete();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除角色</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AdminRoleDeleteConfirmationSnapshotStrip snapshot={adminRoleDeleteConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={adminRoleDeleteConfirmationSnapshot.canCancel === false}
              onClick={cancelDelete}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={adminRoleDeleteConfirmationSnapshot.canConfirm === false}
              onClick={(event) => {
                event.preventDefault();
                if (adminRoleDeleteConfirmationSnapshot.canConfirm === true) {
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
