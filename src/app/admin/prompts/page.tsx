'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminAuthApi,
  adminConfigApi,
  type AdminPermissionCode,
  type AdminProfileCache,
  type AdminPromptConfigKey,
  type SystemConfig,
} from '@/lib/admin/api';
import { formatAdminOperationFailure } from '@/lib/admin/admin-operation-errors';
import { Textarea } from '@/components/ui/textarea';
import {
  AdminPromptPageSnapshotStrip,
  AdminPromptSaveConfirmationSnapshotStrip,
  buildAdminPromptPageSnapshot,
  buildAdminPromptSaveConfirmationSnapshot,
} from './admin-prompt-page-snapshot';
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
import type {
  AdminPromptProfileDescription,
  AdminPromptProfilePhase,
  AdminPromptProfileTitle,
} from '../../workspace/workspace-types';

type AdminPromptProfile = {
  key: AdminPromptConfigKey;
  title: AdminPromptProfileTitle;
  phase: AdminPromptProfilePhase;
  description: AdminPromptProfileDescription;
};

const promptProfiles: AdminPromptProfile[] = [
  {
    key: 'prompt.project_plans.system',
    title: '方案规划 Prompt',
    phase: 'Plan',
    description: '用于生成候选技术方案；后端会继续追加方案输出协议约束。',
  },
  {
    key: 'prompt.chat.discuss.system',
    title: '探讨模式 Prompt',
    phase: 'Discuss',
    description: '用于工作台探讨模式；后端会继续追加项目事实与 Prompt Context。',
  },
  {
    key: 'prompt.chat.implement.system',
    title: '实现模式 Prompt',
    phase: 'Implement',
    description: '用于实现生成模式；后端会继续追加运行配置与项目稳定上下文。',
  },
];

function isPromptConfig(config: SystemConfig) {
  return config.key.startsWith('prompt.');
}

function promptProfileFor(config: SystemConfig) {
  for (const profile of promptProfiles) {
    const isTargetProfile = profile.key === config.key;
    if (isTargetProfile === true) {
      return profile;
    }
  }

  return undefined;
}

function getPromptProfileIndex(config: SystemConfig): number {
  let index = 0;

  for (const profile of promptProfiles) {
    const isTargetProfile = profile.key === config.key;
    if (isTargetProfile === true) {
      return index;
    }
    index += 1;
  }

  return -1;
}

function listAdminPromptConfigs(configs: SystemConfig[]): SystemConfig[] {
  const promptConfigs: SystemConfig[] = [];

  for (const config of configs) {
    const isPrompt = isPromptConfig(config);
    if (isPrompt === true) {
      promptConfigs.push(config);
    }
  }

  return promptConfigs.sort(sortPromptConfigs);
}

function countKnownAdminPromptConfigs(configs: SystemConfig[]): number {
  let count = 0;

  for (const config of configs) {
    const profileMeta = promptProfileFor(config);
    const hasPromptProfile = profileMeta !== undefined;
    if (hasPromptProfile === true) {
      count += 1;
    }
  }

  return count;
}

function countAdminPromptChars(configs: SystemConfig[]): number {
  let count = 0;

  for (const config of configs) {
    count += config.value.length;
  }

  return count;
}

function countEditableAdminPromptConfigs(configs: SystemConfig[], canEdit: boolean): number {
  if (canEdit === false) {
    return 0;
  }

  return configs.length;
}

function resolveAdminPromptConfigByKey(
  configs: SystemConfig[],
  editingKey: AdminPromptConfigKey | null,
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

function resolveAdminPromptProfileForConfig(config: SystemConfig | null): AdminPromptProfile | null {
  if (config === null) {
    return null;
  }

  const profileMeta = promptProfileFor(config);
  const hasPromptProfile = profileMeta !== undefined;
  return hasPromptProfile === true ? profileMeta : null;
}

function getPromptProfileDescriptionLabel(config: SystemConfig, profile: AdminPromptProfile | undefined) {
  if (profile !== undefined) {
    return profile.description;
  }
  if (config.description.length > 0) {
    return config.description;
  }
  return '自定义 Prompt 配置';
}

function getPromptConfigValuePreviewLabel(value: string) {
  const hasValue = value.length > 0;
  return hasValue === true ? value : '（空）';
}

function getAdminPromptConfigValueTypeLabel(valueType: string | undefined): string {
  const hasValueType = valueType !== undefined && valueType.length > 0;
  return hasValueType === true ? valueType : 'missing';
}

function shouldRenderAdminPromptEmptyState(configs: SystemConfig[]): boolean {
  const configCount = configs.length;
  return configCount === 0;
}

function shouldRenderAdminPromptEditingState(
  editingKey: AdminPromptConfigKey | null,
  config: SystemConfig,
): boolean {
  return editingKey === config.key;
}

function shouldRenderAdminPromptReadonlyState(
  editingKey: AdminPromptConfigKey | null,
  config: SystemConfig,
): boolean {
  const shouldRenderEditingState = shouldRenderAdminPromptEditingState(editingKey, config);
  return shouldRenderEditingState === false;
}

function shouldRenderAdminPromptEditAction(
  editingKey: AdminPromptConfigKey | null,
  config: SystemConfig,
  canEdit: boolean,
): boolean {
  const shouldRenderReadonlyState = shouldRenderAdminPromptReadonlyState(editingKey, config);
  return shouldRenderReadonlyState === true && canEdit === true;
}

function getPromptSaveConfirmationDescription(
  editingKey: AdminPromptConfigKey | null,
  editingPromptProfile: AdminPromptProfile | null,
) {
  if (editingKey === null) {
    return '确定要保存当前 Prompt 配置吗？';
  }

  const promptTitle = editingPromptProfile !== null ? editingPromptProfile.title : editingKey;
  return `确定要保存 Prompt“${promptTitle}”吗？`;
}

function getAdminPromptSaveConfirmationActionLabel(saving: boolean): string {
  return saving === true ? '保存中...' : '确认保存';
}

function sortPromptConfigs(a: SystemConfig, b: SystemConfig) {
  const aIndex = getPromptProfileIndex(a);
  const bIndex = getPromptProfileIndex(b);
  if (aIndex !== -1 || bIndex !== -1) {
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  }
  return a.key.localeCompare(b.key);
}

function hasAdminPromptProfile(profile: AdminProfileCache | null): profile is AdminProfileCache {
  return profile !== null;
}

function isAdminPromptSuperAdmin(profile: AdminProfileCache | null): boolean {
  const hasProfile = hasAdminPromptProfile(profile);
  const isSuperAdmin = hasProfile === true && profile.role === 'super_admin';
  return isSuperAdmin === true;
}

function hasAdminPromptPermission(profile: AdminProfileCache | null, permission: AdminPermissionCode): boolean {
  const hasProfile = hasAdminPromptProfile(profile);
  if (hasProfile === false) {
    return false;
  }

  const hasPermissionCodes = Array.isArray(profile.permission_codes) === true;
  const hasPermissionCode = hasPermissionCodes === true && profile.permission_codes.includes(permission) === true;
  return hasPermissionCode === true;
}

function materializeAdminPromptConfigNodes({
  configs,
  editingKey,
  editValue,
  snapshot,
  canEdit,
  onEditValueChange,
  onOpenSaveConfirmation,
  onCancelEdit,
  onStartEdit,
}: {
  configs: SystemConfig[];
  editingKey: AdminPromptConfigKey | null;
  editValue: string;
  snapshot: ReturnType<typeof buildAdminPromptPageSnapshot>;
  canEdit: boolean;
  onEditValueChange: (value: string) => void;
  onOpenSaveConfirmation: () => void;
  onCancelEdit: () => void;
  onStartEdit: (config: SystemConfig) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const config of configs) {
    const profileMeta = promptProfileFor(config);
    const profileTitle = profileMeta !== undefined ? profileMeta.title : config.key;
    const profilePhase = profileMeta !== undefined ? profileMeta.phase : 'Custom';
    const profileDescription = getPromptProfileDescriptionLabel(config, profileMeta);
    const valueTypeLabel = getAdminPromptConfigValueTypeLabel(config.value_type);
    const shouldRenderEditingState = shouldRenderAdminPromptEditingState(editingKey, config);
    const shouldRenderReadonlyState = shouldRenderAdminPromptReadonlyState(editingKey, config);
    const shouldRenderEditAction = shouldRenderAdminPromptEditAction(editingKey, config, canEdit);

    nodes.push(
      <section key={config.key} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {profileTitle}
            </h2>
            <span className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
              {profilePhase}
            </span>
            <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded">
              {valueTypeLabel}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {profileDescription}
          </p>
          <p className="text-xs text-gray-400 mt-1 font-mono">{config.key}</p>
        </div>

        <div className="p-4 space-y-3">
          {shouldRenderEditingState === true && (
            <>
              <Textarea
                value={editValue}
                onChange={(event) => onEditValueChange(event.target.value)}
                rows={14}
                className="text-sm font-mono"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenSaveConfirmation}
                  disabled={snapshot.canSave === false}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                >
                  保存
                </button>
                <button
                  onClick={onCancelEdit}
                  disabled={snapshot.canCancel === false}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-lg"
                >
                  取消
                </button>
              </div>
            </>
          )}
          {shouldRenderReadonlyState === true && (
            <>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {getPromptConfigValuePreviewLabel(config.value)}
              </pre>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                <span>字符数：{config.value.length}</span>
                <span>更新时间：{config.updated_at}</span>
              </div>
              {shouldRenderEditAction === true && (
                <button
                  onClick={() => onStartEdit(config)}
                  disabled={snapshot.canStartEdit === false}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  编辑 Prompt
                </button>
              )}
            </>
          )}
        </div>
      </section>,
    );
  }

  return nodes;
}

export default function AdminPromptsPage() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingKey, setEditingKey] = useState<AdminPromptConfigKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
  const [saveConfirmationError, setSaveConfirmationError] = useState('');
  const profile = adminAuthApi.getCachedProfile();
  const isSuperAdmin = isAdminPromptSuperAdmin(profile);
  const hasSystemConfigUpdatePermission = hasAdminPromptPermission(profile, 'system.config.update');
  const canEdit = isSuperAdmin === true || hasSystemConfigUpdatePermission === true;

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await adminConfigApi.list();
      setConfigs(listAdminPromptConfigs(list));
    } catch (err: unknown) {
      setError(formatAdminOperationFailure(err, '加载 Prompt 配置失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  const knownPromptCount = useMemo(() => countKnownAdminPromptConfigs(configs), [configs]);
  const totalPromptChars = useMemo(() => countAdminPromptChars(configs), [configs]);
  const editingConfig = useMemo(
    () => resolveAdminPromptConfigByKey(configs, editingKey),
    [configs, editingKey],
  );
  const editingPromptProfile = useMemo(
    () => resolveAdminPromptProfileForConfig(editingConfig),
    [editingConfig],
  );
  const editablePromptCount = countEditableAdminPromptConfigs(configs, canEdit);
  const snapshot = buildAdminPromptPageSnapshot({
    loading,
    saving,
    error,
    promptCount: configs.length,
    knownPromptCount,
    editablePromptCount,
    editingKey,
    editValue,
    totalPromptChars,
    canEdit,
  });
  const saveConfirmationSnapshot = buildAdminPromptSaveConfirmationSnapshot({
    promptKey: editingKey,
    profile: editingPromptProfile,
    editValue,
    isOpen: saveConfirmationOpen,
    saving,
    error: saveConfirmationError,
  });
  const saveConfirmationDescription = getPromptSaveConfirmationDescription(editingKey, editingPromptProfile);
  const saveConfirmationActionLabel = getAdminPromptSaveConfirmationActionLabel(saving);
  const hasPageError = error.length > 0;
  const shouldRenderEmptyState = shouldRenderAdminPromptEmptyState(configs);
  const shouldRenderPromptConfigs = shouldRenderEmptyState === false;

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

  const handleSave = async (key: AdminPromptConfigKey) => {
    setSaving(true);
    setError('');
    setSaveConfirmationError('');
    try {
      await adminConfigApi.update(key, editValue);
      setSaveConfirmationOpen(false);
      setEditingKey(null);
      setEditValue('');
      await loadConfigs();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '保存 Prompt 失败');
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
        <AdminPromptPageSnapshotStrip snapshot={snapshot} />
        <div className="text-gray-500">正在加载 Prompt 配置...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Prompt 管理</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          专项管理方案规划、探讨模式与实现模式 Prompt；运行期仍会注入 YES 项目真源上下文。
        </p>
      </div>
      <AdminPromptPageSnapshotStrip snapshot={snapshot} />

      {hasPageError === true && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {shouldRenderEmptyState === true && (
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
          暂无 Prompt 配置项
        </div>
      )}
      {shouldRenderPromptConfigs === true && (
        <div className="grid gap-4">
          {materializeAdminPromptConfigNodes({
            configs,
            editingKey,
            editValue,
            snapshot,
            canEdit,
            onEditValueChange: setEditValue,
            onOpenSaveConfirmation: openSaveConfirmation,
            onCancelEdit: cancelEdit,
            onStartEdit: startEdit,
          })}
        </div>
      )}
      <AlertDialog
        open={saveConfirmationOpen}
        onOpenChange={(open) => {
          if (open === false && saveConfirmationSnapshot.canCancel === true) {
            setSaveConfirmationOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认保存 Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              {saveConfirmationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AdminPromptSaveConfirmationSnapshotStrip snapshot={saveConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saveConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={saveConfirmationSnapshot.canConfirm === false}
              onClick={(event) => {
                event.preventDefault();
                if (editingKey !== null && saveConfirmationSnapshot.canConfirm === true) {
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
