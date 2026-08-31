'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  adminAuthApi,
  adminConfigApi,
  type AdminPermissionCode,
  type AdminProfileCache,
  type AdminSystemConfigKey,
  type SystemConfig,
} from '@/lib/admin/api';
import { formatAdminOperationFailure } from '@/lib/admin/admin-operation-errors';
import { Textarea } from '@/components/ui/textarea';
import {
  AdminConfigPageSnapshotStrip,
  AdminConfigSaveConfirmationSnapshotStrip,
  buildAdminConfigPageSnapshot,
  buildAdminConfigSaveConfirmationSnapshot,
} from './admin-config-page-snapshot';
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

type AdminConfigGroup = {
  title: string;
  description: string;
  items: SystemConfig[];
};

function isLongTextConfig(config: SystemConfig): boolean {
  const isPromptConfig = config.key.startsWith('prompt.');
  const isLongValue = config.value.length > 160;
  return isPromptConfig === true || isLongValue === true;
}

function getConfigValuePreviewLabel(value: string) {
  const hasValue = value.length > 0;
  return hasValue === true ? value : '（空）';
}

function shouldRenderConfigValueType(config: SystemConfig): boolean {
  const valueType = config.value_type;
  const hasValueType = valueType !== undefined && valueType.length > 0;
  return hasValueType === true;
}

function shouldRenderConfigPublicFlag(config: SystemConfig): boolean {
  return config.is_public === true;
}

function shouldRenderConfigDescription(config: SystemConfig): boolean {
  const hasDescription = config.description.length > 0;
  return hasDescription === true;
}

function shouldRenderAdminConfigEmptyState(configs: SystemConfig[]): boolean {
  const configCount = configs.length;
  return configCount === 0;
}

function shouldRenderAdminConfigEditingState(
  editingKey: AdminSystemConfigKey | null,
  config: SystemConfig,
): boolean {
  return editingKey === config.key;
}

function shouldRenderAdminConfigReadonlyState(
  editingKey: AdminSystemConfigKey | null,
  config: SystemConfig,
): boolean {
  const shouldRenderEditingState = shouldRenderAdminConfigEditingState(editingKey, config);
  return shouldRenderEditingState === false;
}

function shouldRenderAdminConfigLongTextEditor(config: SystemConfig): boolean {
  const isLongText = isLongTextConfig(config);
  return isLongText === true;
}

function shouldRenderAdminConfigSingleLineEditor(config: SystemConfig): boolean {
  const isLongText = isLongTextConfig(config);
  return isLongText === false;
}

function shouldRenderAdminConfigEditAction(
  editingKey: AdminSystemConfigKey | null,
  config: SystemConfig,
  canEdit: boolean,
): boolean {
  const shouldRenderReadonlyState = shouldRenderAdminConfigReadonlyState(editingKey, config);
  return shouldRenderReadonlyState === true && canEdit === true;
}

function isAdminConfigContainerConfig(config: SystemConfig): boolean {
  return config.key.startsWith('container.');
}

function canEditAdminConfig(config: SystemConfig, canEditAll: boolean, canEditContainer: boolean): boolean {
  const isContainerConfig = isAdminConfigContainerConfig(config);
  if (isContainerConfig === true) {
    return canEditContainer;
  }

  return canEditAll;
}

function getAdminConfigGroups(configs: SystemConfig[]): AdminConfigGroup[] {
  const container: SystemConfig[] = [];
  const general: SystemConfig[] = [];

  for (const config of configs) {
    const isContainerConfig = isAdminConfigContainerConfig(config);
    if (isContainerConfig === true) {
      container.push(config);
      continue;
    }
    general.push(config);
  }

  const groups: AdminConfigGroup[] = [];
  const hasContainerConfigs = container.length > 0;
  if (hasContainerConfigs === true) {
    groups.push({
      title: '容器配置',
      description: '项目运行时、宿主机目录、端口与镜像配置',
      items: container,
    });
  }
  const hasGeneralConfigs = general.length > 0;
  if (hasGeneralConfigs === true) {
    groups.push({
      title: '其他系统配置',
      description: '功能开关、提示词与全局系统参数',
      items: general,
    });
  }

  return groups;
}

function countEditableAdminConfigs(
  configs: SystemConfig[],
  canEditAll: boolean,
  canEditContainer: boolean,
): number {
  let count = 0;

  for (const config of configs) {
    const canEditConfig = canEditAdminConfig(config, canEditAll, canEditContainer);
    if (canEditConfig === true) {
      count += 1;
    }
  }

  return count;
}

function countAdminConfigsByContainerScope(configs: SystemConfig[], containerScope: boolean): number {
  let count = 0;

  for (const config of configs) {
    const isContainerConfig = isAdminConfigContainerConfig(config);
    const isTargetScope = isContainerConfig === containerScope;
    if (isTargetScope === true) {
      count += 1;
    }
  }

  return count;
}

function resolveAdminConfigByKey(
  configs: SystemConfig[],
  editingKey: AdminSystemConfigKey | null,
): SystemConfig | null {
  if (editingKey === null) {
    return null;
  }

  for (const config of configs) {
    const isTargetConfig = config.key === editingKey;
    if (isTargetConfig === true) {
      return config;
    }
  }

  return null;
}

function hasAdminConfigProfile(profile: AdminProfileCache | null): profile is AdminProfileCache {
  return profile !== null;
}

function isAdminConfigSuperAdmin(profile: AdminProfileCache | null): boolean {
  const hasProfile = hasAdminConfigProfile(profile);
  const isSuperAdmin = hasProfile === true && profile.role === 'super_admin';
  return isSuperAdmin === true;
}

function hasAdminConfigPermission(profile: AdminProfileCache | null, permission: AdminPermissionCode): boolean {
  const hasProfile = hasAdminConfigProfile(profile);
  if (hasProfile === false) {
    return false;
  }

  const hasPermissionCodes = Array.isArray(profile.permission_codes) === true;
  const hasPermissionCode = hasPermissionCodes === true && profile.permission_codes.includes(permission) === true;
  return hasPermissionCode === true;
}

function getAdminConfigSaveConfirmationDescription(editingKey: AdminSystemConfigKey | null): string {
  const hasEditingKey = editingKey !== null;
  return hasEditingKey === true
    ? `确定要保存配置“${editingKey}”吗？`
    : '确定要保存当前系统配置吗？';
}

function getAdminConfigSaveConfirmationActionLabel(saving: boolean): string {
  return saving === true ? '保存中...' : '确认保存';
}

function materializeAdminConfigItemNodes({
  configs,
  editingKey,
  editValue,
  adminConfigPageSnapshot,
  canEditAll,
  canEditContainer,
  onEditValueChange,
  onOpenSaveConfirmation,
  onCancelEdit,
  onStartEdit,
}: {
  configs: SystemConfig[];
  editingKey: AdminSystemConfigKey | null;
  editValue: string;
  adminConfigPageSnapshot: ReturnType<typeof buildAdminConfigPageSnapshot>;
  canEditAll: boolean;
  canEditContainer: boolean;
  onEditValueChange: (value: string) => void;
  onOpenSaveConfirmation: () => void;
  onCancelEdit: () => void;
  onStartEdit: (config: SystemConfig) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const config of configs) {
    const shouldRenderEditingState = shouldRenderAdminConfigEditingState(editingKey, config);
    const shouldRenderReadonlyState = shouldRenderAdminConfigReadonlyState(editingKey, config);
    const shouldRenderLongTextEditor = shouldRenderAdminConfigLongTextEditor(config);
    const shouldRenderSingleLineEditor = shouldRenderAdminConfigSingleLineEditor(config);
    const canEditCurrentConfig = canEditAdminConfig(config, canEditAll, canEditContainer);
    const shouldRenderEditAction = shouldRenderAdminConfigEditAction(
      editingKey,
      config,
      canEditCurrentConfig,
    );

    nodes.push(
      <div key={config.key} className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{config.key}</h3>
              {shouldRenderConfigValueType(config) === true && (
                <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded">
                  {config.value_type}
                </span>
              )}
              {shouldRenderConfigPublicFlag(config) === true && (
                <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
                  公开
                </span>
              )}
            </div>
            {shouldRenderConfigDescription(config) === true && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{config.description}</p>
            )}
            {shouldRenderEditingState === true && (
              <div className="mt-2 space-y-2">
                {shouldRenderLongTextEditor === true && (
                  <Textarea
                    value={editValue}
                    onChange={(e) => onEditValueChange(e.target.value)}
                    rows={10}
                    className="text-sm font-mono"
                  />
                )}
                {shouldRenderSingleLineEditor === true && (
                  <input
                    value={editValue}
                    onChange={(e) => onEditValueChange(e.target.value)}
                    className="flex-1 w-full px-3 py-1.5 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={onOpenSaveConfirmation}
                    disabled={adminConfigPageSnapshot.canSave === false}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                  >
                    保存
                  </button>
                  <button
                    onClick={onCancelEdit}
                    disabled={adminConfigPageSnapshot.canCancel === false}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-lg"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
            {shouldRenderReadonlyState === true && (
              <p className="mt-1 text-sm font-mono text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap">
                {getConfigValuePreviewLabel(config.value)}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">更新时间：{config.updated_at}</p>
          </div>
          {shouldRenderEditAction === true && (
            <button
              onClick={() => onStartEdit(config)}
              disabled={adminConfigPageSnapshot.canStartEdit === false}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-lg transition-colors ml-4"
            >
              编辑
            </button>
          )}
        </div>
      </div>,
    );
  }

  return nodes;
}

function materializeAdminConfigGroupNodes({
  groupedConfigs,
  editingKey,
  editValue,
  adminConfigPageSnapshot,
  canEditAll,
  canEditContainer,
  onEditValueChange,
  onOpenSaveConfirmation,
  onCancelEdit,
  onStartEdit,
}: {
  groupedConfigs: AdminConfigGroup[];
  editingKey: AdminSystemConfigKey | null;
  editValue: string;
  adminConfigPageSnapshot: ReturnType<typeof buildAdminConfigPageSnapshot>;
  canEditAll: boolean;
  canEditContainer: boolean;
  onEditValueChange: (value: string) => void;
  onOpenSaveConfirmation: () => void;
  onCancelEdit: () => void;
  onStartEdit: (config: SystemConfig) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const group of groupedConfigs) {
    nodes.push(
      <section key={group.title} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{group.title}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{group.description}</p>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {materializeAdminConfigItemNodes({
            configs: group.items,
            editingKey,
            editValue,
            adminConfigPageSnapshot,
            canEditAll,
            canEditContainer,
            onEditValueChange,
            onOpenSaveConfirmation,
            onCancelEdit,
            onStartEdit,
          })}
        </div>
      </section>,
    );
  }

  return nodes;
}

export default function ConfigPage() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingKey, setEditingKey] = useState<AdminSystemConfigKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
  const [saveConfirmationError, setSaveConfirmationError] = useState('');
  const profile = adminAuthApi.getCachedProfile();
  const isSuperAdmin = isAdminConfigSuperAdmin(profile);
  const hasSystemConfigUpdatePermission = hasAdminConfigPermission(profile, 'system.config.update');
  const hasSystemContainerConfigUpdatePermission = hasAdminConfigPermission(profile, 'system.container_config.update');
  const canEditAll = isSuperAdmin === true || hasSystemConfigUpdatePermission === true;
  const canEditContainer = isSuperAdmin === true
    || canEditAll === true
    || hasSystemContainerConfigUpdatePermission === true;

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminConfigApi.list();
      setConfigs(list);
    } catch (err: unknown) {
      setError(formatAdminOperationFailure(err, '加载配置失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const groupedConfigs = useMemo(() => getAdminConfigGroups(configs), [configs]);
  const editableConfigCount = useMemo(
    () => countEditableAdminConfigs(configs, canEditAll, canEditContainer),
    [canEditAll, canEditContainer, configs],
  );
  const editingConfig = useMemo(
    () => resolveAdminConfigByKey(configs, editingKey),
    [configs, editingKey],
  );
  const adminConfigPageSnapshot = buildAdminConfigPageSnapshot({
    loading,
    saving,
    error,
    configCount: configs.length,
    groupCount: groupedConfigs.length,
    containerConfigCount: countAdminConfigsByContainerScope(configs, true),
    generalConfigCount: countAdminConfigsByContainerScope(configs, false),
    editableConfigCount,
    canEditAll,
    canEditContainer,
    editingKey,
    editValue,
  });
  const adminConfigSaveConfirmationSnapshot = buildAdminConfigSaveConfirmationSnapshot({
    config: editingConfig,
    editValue,
    isOpen: saveConfirmationOpen,
    saving,
    error: saveConfirmationError,
  });
  const saveConfirmationDescription = getAdminConfigSaveConfirmationDescription(editingKey);
  const saveConfirmationActionLabel = getAdminConfigSaveConfirmationActionLabel(saving);
  const hasPageError = error.length > 0;
  const shouldRenderEmptyState = shouldRenderAdminConfigEmptyState(configs);
  const shouldRenderConfigGroups = shouldRenderEmptyState === false;

  const startEdit = (config: SystemConfig) => {
    setSaveConfirmationOpen(false);
    setSaveConfirmationError('');
    setEditingKey(config.key);
    setEditValue(config.value);
  };

  const cancelEdit = () => {
    setSaveConfirmationOpen(false);
    setSaveConfirmationError('');
    setEditingKey(null);
    setEditValue('');
  };

  const handleSave = async (key: AdminSystemConfigKey) => {
    setSaving(true);
    setError('');
    setSaveConfirmationError('');
    try {
      await adminConfigApi.update(key, editValue);
      setSaveConfirmationOpen(false);
      setEditingKey(null);
      await loadConfigs();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '保存失败');
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

  if (loading) {
    return (
      <div className="space-y-4">
        <AdminConfigPageSnapshotStrip snapshot={adminConfigPageSnapshot} />
        <div className="text-gray-500">正在加载配置...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">系统配置</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">管理全局系统配置项</p>
      </div>
      <AdminConfigPageSnapshotStrip snapshot={adminConfigPageSnapshot} />

      {hasPageError === true && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {shouldRenderEmptyState === true && (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            暂无配置项
          </div>
        )}
        {shouldRenderConfigGroups === true && (
          materializeAdminConfigGroupNodes({
            groupedConfigs,
            editingKey,
            editValue,
            adminConfigPageSnapshot,
            canEditAll,
            canEditContainer,
            onEditValueChange: setEditValue,
            onOpenSaveConfirmation: openSaveConfirmation,
            onCancelEdit: cancelEdit,
            onStartEdit: startEdit,
          })
        )}
      </div>
      <AlertDialog
        open={saveConfirmationOpen}
        onOpenChange={(open) => {
          if (open === false && adminConfigSaveConfirmationSnapshot.canCancel === true) {
            setSaveConfirmationOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认保存系统配置</AlertDialogTitle>
            <AlertDialogDescription>
              {saveConfirmationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AdminConfigSaveConfirmationSnapshotStrip snapshot={adminConfigSaveConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={adminConfigSaveConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={adminConfigSaveConfirmationSnapshot.canConfirm === false}
              onClick={(event) => {
                event.preventDefault();
                if (editingKey !== null && adminConfigSaveConfirmationSnapshot.canConfirm === true) {
                  void handleSave(editingKey);
                }
              }}
            >
              {saveConfirmationActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
