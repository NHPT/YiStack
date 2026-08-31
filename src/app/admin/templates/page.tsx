'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminAuthApi,
  adminConfigApi,
  type AdminPermissionCode,
  type AdminProfileCache,
  type AdminTemplateConfigKey,
  type SystemConfig,
} from '@/lib/admin/api';
import { formatAdminOperationFailure } from '@/lib/admin/admin-operation-errors';
import { Textarea } from '@/components/ui/textarea';
import {
  AdminTemplatePageSnapshotStrip,
  AdminTemplateSaveConfirmationSnapshotStrip,
  buildAdminTemplatePageSnapshot,
  buildAdminTemplateSaveConfirmationSnapshot,
} from './admin-template-page-snapshot';
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
  AdminTemplateProfileCategory,
  AdminTemplateProfileDescription,
  AdminTemplateProfileTitle,
} from '../../workspace/workspace-types';

type AdminTemplateProfile = {
  key: AdminTemplateConfigKey;
  title: AdminTemplateProfileTitle;
  category: AdminTemplateProfileCategory;
  description: AdminTemplateProfileDescription;
};

const templateProfiles: AdminTemplateProfile[] = [
  {
    key: 'template.project_docs.agents_md',
    title: 'AGENTS.md 项目规则模板',
    category: 'ProjectDocs',
    description: '项目生成后写入的 AI 协作规则模板；留空使用内置模板。',
  },
  {
    key: 'template.project_docs.requirements_md',
    title: 'REQUIREMENTS.md 需求模板',
    category: 'ProjectDocs',
    description: '项目级需求文档模板；留空使用内置模板。',
  },
  {
    key: 'template.project_docs.design_md',
    title: 'DESIGN.md 设计模板',
    category: 'ProjectDocs',
    description: '项目级设计文档模板；留空使用内置模板。',
  },
  {
    key: 'template.project_docs.runbook_md',
    title: 'RUNBOOK.md 运维模板',
    category: 'ProjectDocs',
    description: '项目级运行手册模板；留空使用内置模板。',
  },
  {
    key: 'template.project_scaffolds.default.readme_md',
    title: '默认脚手架 README.md',
    category: 'DefaultScaffold',
    description: '默认项目 README 脚手架模板；留空使用内置模板。',
  },
  {
    key: 'template.project_scaffolds.node_nextjs.gitignore',
    title: 'Node Next.js .gitignore',
    category: 'NodeNextJS',
    description: 'Node Next.js 脚手架 .gitignore 模板；留空使用内置模板。',
  },
  {
    key: 'template.project_scaffolds.node_nextjs.package_json',
    title: 'Node Next.js package.json',
    category: 'NodeNextJS',
    description: 'Node Next.js 脚手架 package.json 模板；留空使用内置模板。',
  },
  {
    key: 'template.project_scaffolds.node_nextjs.src.app.layout_tsx',
    title: 'Node Next.js app/layout.tsx',
    category: 'NodeNextJS',
    description: 'Node Next.js 脚手架 layout 模板；留空使用内置模板。',
  },
  {
    key: 'template.project_scaffolds.node_nextjs.src.app.page_tsx',
    title: 'Node Next.js app/page.tsx',
    category: 'NodeNextJS',
    description: 'Node Next.js 脚手架首页模板；留空使用内置模板。',
  },
  {
    key: 'template.project_scaffolds.node_nextjs.tsconfig_json',
    title: 'Node Next.js tsconfig.json',
    category: 'NodeNextJS',
    description: 'Node Next.js 脚手架 TypeScript 配置模板；留空使用内置模板。',
  },
  {
    key: 'template.project_scaffolds.python_fastapi.dockerfile',
    title: 'Python FastAPI Dockerfile',
    category: 'PythonFastAPI',
    description: 'Python FastAPI 脚手架 Dockerfile 模板；留空使用内置模板。',
  },
  {
    key: 'template.project_scaffolds.python_fastapi.main_py',
    title: 'Python FastAPI main.py',
    category: 'PythonFastAPI',
    description: 'Python FastAPI 脚手架入口模板；留空使用内置模板。',
  },
  {
    key: 'template.project_scaffolds.python_fastapi.requirements_txt',
    title: 'Python FastAPI requirements.txt',
    category: 'PythonFastAPI',
    description: 'Python FastAPI 脚手架依赖模板；留空使用内置模板。',
  },
  {
    key: 'template.project_scaffolds.go_gin.dockerfile',
    title: 'Go Gin Dockerfile',
    category: 'GoGin',
    description: 'Go Gin 脚手架 Dockerfile 模板；留空使用内置模板。',
  },
  {
    key: 'template.project_scaffolds.go_gin.go_mod',
    title: 'Go Gin go.mod',
    category: 'GoGin',
    description: 'Go Gin 脚手架 go.mod 模板；留空使用内置模板。',
  },
  {
    key: 'template.project_scaffolds.go_gin.main_go',
    title: 'Go Gin main.go',
    category: 'GoGin',
    description: 'Go Gin 脚手架入口模板；留空使用内置模板。',
  },
];

function isTemplateConfig(config: SystemConfig) {
  return config.key.startsWith('template.');
}

function templateProfileFor(config: SystemConfig) {
  for (const profile of templateProfiles) {
    const isTargetProfile = profile.key === config.key;
    if (isTargetProfile === true) {
      return profile;
    }
  }

  return undefined;
}

function getTemplateProfileIndex(config: SystemConfig): number {
  let index = 0;

  for (const profile of templateProfiles) {
    const isTargetProfile = profile.key === config.key;
    if (isTargetProfile === true) {
      return index;
    }
    index += 1;
  }

  return -1;
}

function listAdminTemplateConfigs(configs: SystemConfig[]): SystemConfig[] {
  const templateConfigs: SystemConfig[] = [];

  for (const config of configs) {
    const isTemplate = isTemplateConfig(config);
    if (isTemplate === true) {
      templateConfigs.push(config);
    }
  }

  return templateConfigs.sort(sortTemplateConfigs);
}

function countKnownAdminTemplateConfigs(configs: SystemConfig[]): number {
  let count = 0;

  for (const config of configs) {
    const profileMeta = templateProfileFor(config);
    const hasTemplateProfile = profileMeta !== undefined;
    if (hasTemplateProfile === true) {
      count += 1;
    }
  }

  return count;
}

function getTemplateProfileDescriptionLabel(config: SystemConfig, profile: AdminTemplateProfile | undefined) {
  if (profile !== undefined) {
    return profile.description;
  }
  if (config.description.length > 0) {
    return config.description;
  }
  return '自定义 Template 配置';
}

function getTemplateConfigValuePreviewLabel(value: string) {
  const hasValue = value.length > 0;
  return hasValue === true ? value : '（空，使用内置模板）';
}

function getAdminTemplateConfigValueTypeLabel(valueType: string | undefined): string {
  const hasValueType = valueType !== undefined && valueType.length > 0;
  return hasValueType === true ? valueType : 'missing';
}

function hasAdminTemplateConfigOverride(config: SystemConfig): boolean {
  const overrideValue = config.value.trim();
  const hasOverride = overrideValue.length > 0;
  return hasOverride === true;
}

function getAdminTemplateOverrideBadgeClassName(hasOverride: boolean): string {
  if (hasOverride === false) {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  }
  return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
}

function getAdminTemplateOverrideBadgeLabel(hasOverride: boolean): string {
  if (hasOverride === false) {
    return '内置回退';
  }
  return '覆盖已配置';
}

function getAdminTemplateConfiguredCount(configs: SystemConfig[]): number {
  let count = 0;

  for (const config of configs) {
    const hasOverride = hasAdminTemplateConfigOverride(config);
    if (hasOverride === true) {
      count += 1;
    }
  }

  return count;
}

function countEditableAdminTemplateConfigs(configs: SystemConfig[], canEdit: boolean): number {
  if (canEdit === false) {
    return 0;
  }

  return configs.length;
}

function resolveAdminTemplateConfigByKey(
  configs: SystemConfig[],
  editingKey: AdminTemplateConfigKey | null,
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

function resolveAdminTemplateProfileForConfig(config: SystemConfig | null): AdminTemplateProfile | null {
  if (config === null) {
    return null;
  }

  const profileMeta = templateProfileFor(config);
  const hasTemplateProfile = profileMeta !== undefined;
  return hasTemplateProfile === true ? profileMeta : null;
}

function shouldRenderAdminTemplateEmptyState(configs: SystemConfig[]): boolean {
  const configCount = configs.length;
  return configCount === 0;
}

function shouldRenderAdminTemplateEditingState(
  editingKey: AdminTemplateConfigKey | null,
  config: SystemConfig,
): boolean {
  return editingKey === config.key;
}

function shouldRenderAdminTemplateReadonlyState(
  editingKey: AdminTemplateConfigKey | null,
  config: SystemConfig,
): boolean {
  const shouldRenderEditingState = shouldRenderAdminTemplateEditingState(editingKey, config);
  return shouldRenderEditingState === false;
}

function shouldRenderAdminTemplateEditAction(
  editingKey: AdminTemplateConfigKey | null,
  config: SystemConfig,
  canEdit: boolean,
): boolean {
  const shouldRenderReadonlyState = shouldRenderAdminTemplateReadonlyState(editingKey, config);
  return shouldRenderReadonlyState === true && canEdit === true;
}

function getTemplateSaveConfirmationDescription(
  editingKey: AdminTemplateConfigKey | null,
  editingTemplateProfile: AdminTemplateProfile | null,
) {
  if (editingKey === null) {
    return '确定要保存当前 Template 配置吗？';
  }

  const templateTitle = editingTemplateProfile !== null ? editingTemplateProfile.title : editingKey;
  return `确定要保存 Template“${templateTitle}”吗？`;
}

function getAdminTemplateSaveConfirmationActionLabel(saving: boolean): string {
  return saving === true ? '保存中...' : '确认保存';
}

function sortTemplateConfigs(a: SystemConfig, b: SystemConfig) {
  const aIndex = getTemplateProfileIndex(a);
  const bIndex = getTemplateProfileIndex(b);
  if (aIndex !== -1 || bIndex !== -1) {
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  }
  return a.key.localeCompare(b.key);
}

function formatTemplateCategory(category?: AdminTemplateProfileCategory) {
  if (category === 'ProjectDocs') return 'Project Docs';
  if (category === 'NodeNextJS') return 'Node Next.js';
  if (category === 'PythonFastAPI') return 'Python FastAPI';
  if (category === 'GoGin') return 'Go Gin';
  if (category === 'DefaultScaffold') return 'Default Scaffold';
  return 'Custom';
}

function hasAdminTemplateProfile(profile: AdminProfileCache | null): profile is AdminProfileCache {
  return profile !== null;
}

function isAdminTemplateSuperAdmin(profile: AdminProfileCache | null): boolean {
  const hasProfile = hasAdminTemplateProfile(profile);
  const isSuperAdmin = hasProfile === true && profile.role === 'super_admin';
  return isSuperAdmin === true;
}

function hasAdminTemplatePermission(profile: AdminProfileCache | null, permission: AdminPermissionCode): boolean {
  const hasProfile = hasAdminTemplateProfile(profile);
  if (hasProfile === false) {
    return false;
  }

  const hasPermissionCodes = Array.isArray(profile.permission_codes) === true;
  const hasPermissionCode = hasPermissionCodes === true && profile.permission_codes.includes(permission) === true;
  return hasPermissionCode === true;
}

function materializeAdminTemplateConfigNodes({
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
  editingKey: AdminTemplateConfigKey | null;
  editValue: string;
  snapshot: ReturnType<typeof buildAdminTemplatePageSnapshot>;
  canEdit: boolean;
  onEditValueChange: (value: string) => void;
  onOpenSaveConfirmation: () => void;
  onCancelEdit: () => void;
  onStartEdit: (config: SystemConfig) => void;
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const config of configs) {
    const profileMeta = templateProfileFor(config);
    const profileTitle = profileMeta !== undefined ? profileMeta.title : config.key;
    const profileCategory = profileMeta !== undefined ? profileMeta.category : undefined;
    const category = formatTemplateCategory(profileCategory);
    const profileDescription = getTemplateProfileDescriptionLabel(config, profileMeta);
    const valueTypeLabel = getAdminTemplateConfigValueTypeLabel(config.value_type);
    const hasOverride = hasAdminTemplateConfigOverride(config);
    const overrideBadgeClassName = getAdminTemplateOverrideBadgeClassName(hasOverride);
    const overrideBadgeLabel = getAdminTemplateOverrideBadgeLabel(hasOverride);
    const shouldRenderEditingState = shouldRenderAdminTemplateEditingState(editingKey, config);
    const shouldRenderReadonlyState = shouldRenderAdminTemplateReadonlyState(editingKey, config);
    const shouldRenderEditAction = shouldRenderAdminTemplateEditAction(editingKey, config, canEdit);

    nodes.push(
      <section key={config.key} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {profileTitle}
            </h2>
            <span className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
              {category}
            </span>
            <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded">
              {valueTypeLabel}
            </span>
            <span className={`px-1.5 py-0.5 text-xs rounded ${overrideBadgeClassName}`}>
              {overrideBadgeLabel}
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
              <p className="text-xs text-amber-700 dark:text-amber-300">
                当前字符数：{editValue.length}。保存空值会清空覆盖并回退内置模板。
              </p>
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
                {getTemplateConfigValuePreviewLabel(config.value)}
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
                  编辑 Template
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

export default function AdminTemplatesPage() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingKey, setEditingKey] = useState<AdminTemplateConfigKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
  const [saveConfirmationError, setSaveConfirmationError] = useState('');
  const profile = adminAuthApi.getCachedProfile();
  const isSuperAdmin = isAdminTemplateSuperAdmin(profile);
  const hasSystemConfigUpdatePermission = hasAdminTemplatePermission(profile, 'system.config.update');
  const canEdit = isSuperAdmin === true || hasSystemConfigUpdatePermission === true;

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await adminConfigApi.list();
      setConfigs(listAdminTemplateConfigs(list));
    } catch (err: unknown) {
      setError(formatAdminOperationFailure(err, '加载 Template 配置失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  const knownTemplateCount = useMemo(() => countKnownAdminTemplateConfigs(configs), [configs]);
  const configuredTemplateCount = useMemo(() => getAdminTemplateConfiguredCount(configs), [configs]);
  const emptyTemplateCount = configs.length - configuredTemplateCount;
  const editingConfig = useMemo(
    () => resolveAdminTemplateConfigByKey(configs, editingKey),
    [configs, editingKey],
  );
  const editingTemplateProfile = useMemo(
    () => resolveAdminTemplateProfileForConfig(editingConfig),
    [editingConfig],
  );
  const editableTemplateCount = countEditableAdminTemplateConfigs(configs, canEdit);
  const snapshot = buildAdminTemplatePageSnapshot({
    loading,
    saving,
    error,
    templateCount: configs.length,
    knownTemplateCount,
    editableTemplateCount,
    editingKey,
    editValue,
    configuredTemplateCount,
    emptyTemplateCount,
    canEdit,
  });
  const saveConfirmationSnapshot = buildAdminTemplateSaveConfirmationSnapshot({
    templateKey: editingKey,
    profile: editingTemplateProfile,
    editValue,
    isOpen: saveConfirmationOpen,
    saving,
    error: saveConfirmationError,
  });
  const saveConfirmationDescription = getTemplateSaveConfirmationDescription(editingKey, editingTemplateProfile);
  const saveConfirmationActionLabel = getAdminTemplateSaveConfirmationActionLabel(saving);
  const hasPageError = error.length > 0;
  const shouldRenderEmptyState = shouldRenderAdminTemplateEmptyState(configs);
  const shouldRenderTemplateConfigs = shouldRenderEmptyState === false;

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

  const handleSave = async (key: AdminTemplateConfigKey) => {
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
      const message = formatAdminOperationFailure(err, '保存 Template 配置失败');
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
        <AdminTemplatePageSnapshotStrip snapshot={snapshot} />
        <div className="text-gray-500">正在加载 Template 配置...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Template 管理</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">专项管理 `template.*` 覆盖项；留空时生成链路继续使用内置项目文档和脚手架模板。</p></div>
        <Link href="/admin/project-templates" className="inline-flex h-9 items-center border px-3 text-sm font-medium hover:bg-muted">管理官方项目模板版本</Link>
      </div>
      <AdminTemplatePageSnapshotStrip snapshot={snapshot} />

      {hasPageError === true && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {shouldRenderEmptyState === true && (
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
          暂无 Template 配置项
        </div>
      )}
      {shouldRenderTemplateConfigs === true && (
        <div className="grid gap-4">
          {materializeAdminTemplateConfigNodes({
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
            <AlertDialogTitle>确认保存 Template</AlertDialogTitle>
            <AlertDialogDescription>
              {saveConfirmationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AdminTemplateSaveConfirmationSnapshotStrip snapshot={saveConfirmationSnapshot} />
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
