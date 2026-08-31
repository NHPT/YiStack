import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  ChangeEvent,
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
} from 'react';
import { Eye, FolderOpen, GitBranch, Terminal } from 'lucide-react';

import { llmApi, type LLMProvider } from '@/lib/api';
import type { FileNode } from '@/lib/types';
import { formatWorkspaceModelListLoadFailure } from '@/lib/workspace/workspace-model-list-errors';
import { formatWorkspaceClipboardError } from '@/lib/workspace/workspace-clipboard-local-errors';

import { appTypeNeedsRuntime } from './workspace-page-helpers';
import {
  buildEmptyChatModelRegistrySnapshot,
  buildLoadedChatModelRegistrySnapshot,
  buildLoadingChatModelRegistrySnapshot,
  buildLoadFailedChatModelRegistrySnapshot,
  buildPickerEmptyChatAttachmentSnapshot,
  buildRemovedChatAttachmentSnapshot,
  buildSelectedChatAttachmentSnapshot,
} from './workspace-chat-composer-snapshot';
import type {
  ChatAttachmentSnapshot,
  EditorBufferStatus,
  IDETab,
  PreviewUrlStatus,
  ChatModelRegistrySnapshot,
  WorkspaceBrowserDevice,
  WorkspaceChatMessage,
  WorkspaceContextMenu,
  WorkspaceOpenFilePathList,
  ExplorerSnapshotStatus,
} from './workspace-types';
import type {
  WorkspacePageUiContract,
  WorkspacePageUiModel,
  WorkspacePageUiPreviewDeviceStyleMap,
  WorkspacePageUiTab,
} from './workspace-page-ui-contract';

type AvailableModel = WorkspacePageUiModel;

type AttachedFile = {
  name: string;
  size: number;
};

const workspaceSelectedModelStorageKey = 'yistack_workspace_selected_model';

type WorkspacePageUiAttachedFileList = AttachedFile[];
type WorkspacePageUiModelList = AvailableModel[];

function hasWorkspacePageUiSearchQuery(query: string): boolean {
  const hasQuery = query.length > 0;
  return hasQuery === true;
}

function hasWorkspacePageUiFileNodeChildren(children: FileNode[] | undefined): children is FileNode[] {
  if (children === undefined) {
    return false;
  }

  const hasChildren = children.length > 0;
  return hasChildren === true;
}

function hasWorkspacePageUiTextarea(textarea: HTMLTextAreaElement | null): textarea is HTMLTextAreaElement {
  return textarea !== null;
}

function getWorkspacePageUiProviderList(
  providers: LLMProvider[] | null | undefined,
): LLMProvider[] {
  if (providers === null || providers === undefined) {
    return [];
  }

  return providers;
}

function getWorkspacePageUiDefaultModelName(defaultName: string | null | undefined): string | null {
  if (defaultName === null || defaultName === undefined) {
    return null;
  }

  const hasDefaultName = defaultName.length > 0;
  if (hasDefaultName === true) {
    return defaultName;
  }

  return null;
}

function hasWorkspacePageUiDefaultModelName(defaultName: string | null): defaultName is string {
  return defaultName !== null;
}

function readWorkspacePageUiStoredSelectedModel(): string {
  try {
    return window.sessionStorage.getItem(workspaceSelectedModelStorageKey) || '';
  } catch {
    return '';
  }
}

function writeWorkspacePageUiStoredSelectedModel(modelId: string): void {
  try {
    const normalizedModelId = modelId.trim();
    if (normalizedModelId.length === 0) {
      window.sessionStorage.removeItem(workspaceSelectedModelStorageKey);
      return;
    }
    window.sessionStorage.setItem(workspaceSelectedModelStorageKey, normalizedModelId);
  } catch {
    // Model preference persistence is best-effort; the in-memory selection remains authoritative.
  }
}

function hasWorkspacePageUiModelId(models: WorkspacePageUiModelList, modelId: string): boolean {
  for (const model of models) {
    if (model.id === modelId) {
      return true;
    }
  }
  return false;
}

function getWorkspacePageUiSelectedModelSnapshotValue(selectedModel: string): string {
  const hasSelectedModel = selectedModel.length > 0;
  if (hasSelectedModel === true) {
    return selectedModel;
  }

  return 'default';
}

function getWorkspacePageUiProviderDisplayName(provider: LLMProvider): string {
  const hasDisplayName = provider.display_name.length > 0;
  if (hasDisplayName === true) {
    return provider.display_name;
  }

  const hasModelName = provider.model.length > 0;
  if (hasModelName === true) {
    return provider.model;
  }

  return provider.name;
}

function getWorkspacePageUiProviderModelDisplayName(provider: LLMProvider, model: NonNullable<LLMProvider['models']>[number]): string {
  const modelDisplayName = model.display_name.trim();
  const modelName = modelDisplayName.length > 0 ? modelDisplayName : model.model_id;
  const providerName = getWorkspacePageUiProviderDisplayName(provider);
  return `${providerName} / ${modelName}`;
}

function getWorkspacePageUiProviderModelName(model: NonNullable<LLMProvider['models']>[number]): string {
  const modelDisplayName = model.display_name.trim();
  if (modelDisplayName.length > 0) {
    return modelDisplayName;
  }
  return model.model_id;
}

function getWorkspacePageUiProviderModels(provider: LLMProvider): NonNullable<LLMProvider['models']> {
  const models = provider.models;
  if (Array.isArray(models) === false) {
    return [];
  }
  return models;
}

function isWorkspacePageUiDefaultProvider(provider: LLMProvider): boolean {
  return provider.is_default === true;
}

function hasWorkspacePageUiProvider(provider: LLMProvider | undefined): provider is LLMProvider {
  return provider !== undefined;
}

function hasWorkspacePageUiModel(model: AvailableModel | undefined): model is AvailableModel {
  return model !== undefined;
}

function materializeWorkspacePageUiFilteredTree(nodes: FileNode[], query: string): FileNode[] {
  const filteredNodes: FileNode[] = [];
  const normalizedQuery = query.toLowerCase();

  for (const node of nodes) {
    const isMatchingNode = node.name.toLowerCase().includes(normalizedQuery);
    if (isMatchingNode === true) {
      filteredNodes.push(node);
    }

    if (hasWorkspacePageUiFileNodeChildren(node.children) === true) {
      const filteredChildren = filterFileTree(node.children, query);
      const hasFilteredChildren = filteredChildren.length > 0;
      if (hasFilteredChildren === true) {
        filteredNodes.push({ ...node, children: filteredChildren });
      }
    }
  }

  return filteredNodes;
}

function materializeWorkspacePageUiUploadedFiles(uploads: FileList): WorkspacePageUiAttachedFileList {
  const selectedFiles: WorkspacePageUiAttachedFileList = [];

  for (let index = 0; index < uploads.length; index += 1) {
    const file = uploads.item(index);
    if (file === null) {
      continue;
    }

    selectedFiles.push({
      name: file.name,
      size: file.size,
    });
  }

  return selectedFiles;
}

function materializeWorkspacePageUiAttachedFiles(
  currentFiles: WorkspacePageUiAttachedFileList,
  selectedFiles: WorkspacePageUiAttachedFileList,
): WorkspacePageUiAttachedFileList {
  const nextFiles: WorkspacePageUiAttachedFileList = [];

  for (const file of currentFiles) {
    nextFiles.push(file);
  }

  for (const file of selectedFiles) {
    nextFiles.push(file);
  }

  return nextFiles;
}

function getWorkspacePageUiAttachedFileTotalSize(files: WorkspacePageUiAttachedFileList): number {
  let totalSize = 0;

  for (const file of files) {
    totalSize += file.size;
  }

  return totalSize;
}

function getWorkspacePageUiLastAttachedFileName(files: WorkspacePageUiAttachedFileList): string | null {
  for (let index = files.length - 1; index >= 0; index -= 1) {
    const file = files[index];
    if (file !== undefined) {
      return file.name;
    }
  }

  return null;
}

function getWorkspacePageUiAttachedFileAt(
  files: WorkspacePageUiAttachedFileList,
  targetIndex: number,
): AttachedFile | null {
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const isTargetFile = index === targetIndex;
    if (isTargetFile === true && file !== undefined) {
      return file;
    }
  }

  return null;
}

function materializeWorkspacePageUiRemainingAttachedFiles(
  files: WorkspacePageUiAttachedFileList,
  removedIndex: number,
): WorkspacePageUiAttachedFileList {
  const nextFiles: WorkspacePageUiAttachedFileList = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const shouldRemoveFile = index === removedIndex;
    if (shouldRemoveFile === true || file === undefined) {
      continue;
    }

    nextFiles.push(file);
  }

  return nextFiles;
}

function getWorkspacePageUiAttachmentSnapshotFileName(file: AttachedFile | null): string | null {
  if (file === null) {
    return null;
  }

  return file.name;
}

function materializeWorkspacePageUiModelList(providers: LLMProvider[]): WorkspacePageUiModelList {
  const modelList: WorkspacePageUiModelList = [];

  for (const provider of providers) {
    const providerModels = getWorkspacePageUiProviderModels(provider);
    if (providerModels.length > 0) {
      const providerName = getWorkspacePageUiProviderDisplayName(provider);
      for (const model of providerModels) {
        if (model.enabled === false) {
          continue;
        }
        const modelName = getWorkspacePageUiProviderModelName(model);
        modelList.push({
          id: model.runtime_id,
          name: getWorkspacePageUiProviderModelDisplayName(provider, model),
          providerId: provider.name,
          providerName,
          modelName,
        });
      }
      continue;
    }

    const providerName = getWorkspacePageUiProviderDisplayName(provider);
    modelList.push({
      id: provider.name,
      name: providerName,
      providerId: provider.name,
      providerName,
      modelName: providerName,
    });
  }

  return modelList;
}

function getWorkspacePageUiDefaultProvider(providers: LLMProvider[]): LLMProvider | undefined {
  for (const provider of providers) {
    const isDefaultProvider = isWorkspacePageUiDefaultProvider(provider);
    if (isDefaultProvider === true) {
      return provider;
    }
  }

  return undefined;
}

function getWorkspacePageUiDefaultProviderModelId(provider: LLMProvider): string {
  const providerModels = getWorkspacePageUiProviderModels(provider);
  for (const model of providerModels) {
    if (model.is_default === true && model.enabled !== false) {
      return model.runtime_id;
    }
  }
  for (const model of providerModels) {
    if (model.enabled !== false) {
      return model.runtime_id;
    }
  }
  return provider.name;
}

function getWorkspacePageUiFirstModel(models: WorkspacePageUiModelList): AvailableModel | undefined {
  for (const model of models) {
    return model;
  }

  return undefined;
}

function shouldRenderWorkspacePageUiRuntimeTabs(runtimeEnabled: boolean): boolean {
  const shouldRender = runtimeEnabled === true;
  return shouldRender === true;
}

function isWorkspacePageUiRuntimeTab(activeTab: IDETab): boolean {
  const isPreviewTab = activeTab === 'preview';
  if (isPreviewTab === true) {
    return true;
  }

  const isDebugTab = activeTab === 'debug';
  if (isDebugTab === true) {
    return true;
  }

  const isTerminalTab = activeTab === 'terminal';
  return isTerminalTab === true;
}

function shouldResetWorkspacePageUiRuntimeTab(activeTab: IDETab, runtimeEnabled: boolean): boolean {
  const shouldRenderRuntimeTabs = shouldRenderWorkspacePageUiRuntimeTabs(runtimeEnabled);
  if (shouldRenderRuntimeTabs === true) {
    return false;
  }

  const isRuntimeTab = isWorkspacePageUiRuntimeTab(activeTab);
  return isRuntimeTab === true;
}

function shouldResetWorkspacePageUiInternalFoundationTab(activeTab: IDETab): boolean {
  const isInternalFoundationTab = activeTab === 'foundation';
  return isInternalFoundationTab === true;
}

type UseWorkspacePageUiOptions = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  handleGenerate: () => Promise<void>;
  fileTree: FileNode[];
  explorerSnapshotStatus: ExplorerSnapshotStatus | null;
  searchQuery: string;
  availableModels: AvailableModel[];
  selectedModel: string;
  appType?: string | null;
  activeTab: IDETab;
  browserDevice: WorkspaceBrowserDevice;
  setActiveTab: Dispatch<SetStateAction<IDETab>>;
  applyPageUiMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  setPreviewUrlStatus: Dispatch<SetStateAction<PreviewUrlStatus | null>>;
  setMobilePreviewUrlStatus: Dispatch<SetStateAction<PreviewUrlStatus | null>>;
  setFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setSavedFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setEditorBufferStatuses: Dispatch<SetStateAction<Map<string, EditorBufferStatus>>>;
  setOpenFiles: Dispatch<SetStateAction<WorkspaceOpenFilePathList>>;
  setActiveFile: Dispatch<SetStateAction<string | null>>;
  setPendingCloseFile: Dispatch<SetStateAction<string | null>>;
  setInput: Dispatch<SetStateAction<string>>;
  setChatExpanded: Dispatch<SetStateAction<boolean>>;
  setContextMenu: Dispatch<SetStateAction<WorkspaceContextMenu | null>>;
  attachedFiles: AttachedFile[];
  setAttachedFiles: Dispatch<SetStateAction<AttachedFile[]>>;
  setChatAttachmentSnapshot: Dispatch<SetStateAction<ChatAttachmentSnapshot>>;
  setAvailableModels: Dispatch<SetStateAction<AvailableModel[]>>;
  setSelectedModel: Dispatch<SetStateAction<string>>;
  setChatModelRegistrySnapshot: Dispatch<SetStateAction<ChatModelRegistrySnapshot>>;
};

function filterFileTree(nodes: FileNode[], query: string): FileNode[] {
  if (hasWorkspacePageUiSearchQuery(query) === false) return nodes;
  return materializeWorkspacePageUiFilteredTree(nodes, query);
}

export function useWorkspacePageUi({
  textareaRef,
  handleGenerate,
  fileTree,
  explorerSnapshotStatus,
  searchQuery,
  availableModels,
  selectedModel,
  appType,
  activeTab,
  browserDevice,
  setActiveTab,
  applyPageUiMessages,
  setPreviewUrlStatus,
  setMobilePreviewUrlStatus,
  setFiles,
  setSavedFiles,
  setEditorBufferStatuses,
  setOpenFiles,
  setActiveFile,
  setPendingCloseFile,
  setInput,
  setChatExpanded,
  setContextMenu,
  attachedFiles,
  setAttachedFiles,
  setChatAttachmentSnapshot,
  setAvailableModels,
  setSelectedModel,
  setChatModelRegistrySnapshot,
}: UseWorkspacePageUiOptions): WorkspacePageUiContract {
  const modelsLoadedRef = useRef(false);
  const modelsLoadingRef = useRef(false);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (hasWorkspacePageUiTextarea(textarea) === false) return;

    textarea.style.height = 'auto';
    const computed = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 24;
    const minHeight = Math.ceil(lineHeight * 3 + 16);
    const maxHeight = Math.ceil(lineHeight * 8 + 16);
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
    textarea.scrollTop = textarea.scrollHeight;
  }, [textareaRef]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleGenerate();
    }
  }, [handleGenerate]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('复制失败:', error);
      const reason = formatWorkspaceClipboardError(error, '浏览器拒绝了剪贴板访问');
      applyPageUiMessages((prev) => [...prev, {
        id: `clipboard-copy-failed-${Date.now()}`,
        role: 'assistant',
        content: `复制到剪贴板失败：${reason}。当前内容没有写入系统剪贴板；你可以手动选中文本复制，或检查浏览器剪贴板权限后重试。`,
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [applyPageUiMessages]);

  const exportProject = useCallback(() => {
    applyPageUiMessages((prev) => [
      ...prev,
      {
        id: `export-project-notice-${Date.now()}`,
        role: 'assistant',
        content: '项目导出功能即将上线。',
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [applyPageUiMessages]);

  const quoteToChat = useCallback((path: string) => {
    setInput((prev) => `${prev}\n\`\`\`\n// ${path}\n\`\`\`\n`);
    setChatExpanded(true);
    setContextMenu(null);
  }, [setChatExpanded, setContextMenu, setInput]);

  const clearChat = useCallback(() => {
    applyPageUiMessages([]);
    setPreviewUrlStatus(null);
    setMobilePreviewUrlStatus(null);
    setFiles(new Map());
    setSavedFiles(new Map());
    setEditorBufferStatuses(new Map());
    setOpenFiles([]);
    setActiveFile(null);
    setPendingCloseFile(null);
  }, [applyPageUiMessages, setActiveFile, setEditorBufferStatuses, setFiles, setMobilePreviewUrlStatus, setOpenFiles, setPendingCloseFile, setPreviewUrlStatus, setSavedFiles]);

  const handleFileUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const uploads = event.target.files;
    if (!uploads || uploads.length === 0) {
      setChatAttachmentSnapshot(buildPickerEmptyChatAttachmentSnapshot());
      return;
    }

    const selectedFiles = materializeWorkspacePageUiUploadedFiles(uploads);
    const next = materializeWorkspacePageUiAttachedFiles(attachedFiles, selectedFiles);
    const totalSize = getWorkspacePageUiAttachedFileTotalSize(next);
    const lastFileName = getWorkspacePageUiLastAttachedFileName(selectedFiles);
    setAttachedFiles(next);
    setChatAttachmentSnapshot(buildSelectedChatAttachmentSnapshot({
      selectedCount: selectedFiles.length,
      attachmentCount: next.length,
      totalSize,
      lastFileName,
    }));
    event.target.value = '';
  }, [attachedFiles, setAttachedFiles, setChatAttachmentSnapshot]);

  const removeAttachment = useCallback((index: number) => {
    const removed = getWorkspacePageUiAttachedFileAt(attachedFiles, index);
    const next = materializeWorkspacePageUiRemainingAttachedFiles(attachedFiles, index);
    const totalSize = getWorkspacePageUiAttachedFileTotalSize(next);
    setAttachedFiles(next);
    setChatAttachmentSnapshot(buildRemovedChatAttachmentSnapshot({
      attachmentCount: next.length,
      totalSize,
      removedFileName: getWorkspacePageUiAttachmentSnapshotFileName(removed),
    }));
  }, [attachedFiles, setAttachedFiles, setChatAttachmentSnapshot]);

  const filteredTree = useMemo(() => filterFileTree(fileTree, searchQuery), [fileTree, searchQuery]);
  const hasOriginalFileTreeData = fileTree.length > 0;

  const models = useMemo(() => (
    availableModels.length > 0 ? availableModels : []
  ), [availableModels]);

  useEffect(() => {
    const loadModels = async () => {
      if (modelsLoadedRef.current || modelsLoadingRef.current) return;

      modelsLoadingRef.current = true;
      const selectedModelSnapshotValue = getWorkspacePageUiSelectedModelSnapshotValue(selectedModel);
      setChatModelRegistrySnapshot(buildLoadingChatModelRegistrySnapshot({
        modelCount: availableModels.length,
        selectedModel: selectedModelSnapshotValue,
      }));
      try {
        const data = await llmApi.listProviders();
        const providers = getWorkspacePageUiProviderList(data.providers);
        const defaultName = getWorkspacePageUiDefaultModelName(data.default_name);
        if (providers.length > 0) {
          const modelList = materializeWorkspacePageUiModelList(providers);
          setAvailableModels(modelList);

          const storedSelectedModel = readWorkspacePageUiStoredSelectedModel();
          const hasStoredSelectedModel = hasWorkspacePageUiModelId(modelList, storedSelectedModel);
          let resolvedModel = hasStoredSelectedModel === true
            ? storedSelectedModel
            : hasWorkspacePageUiDefaultModelName(defaultName) === true
            ? defaultName
            : '';
          if (hasStoredSelectedModel === true) {
            setSelectedModel(storedSelectedModel);
          } else if (hasWorkspacePageUiDefaultModelName(defaultName) === true) {
            setSelectedModel(defaultName);
          } else {
            const defaultProvider = getWorkspacePageUiDefaultProvider(providers);
            if (hasWorkspacePageUiProvider(defaultProvider) === true) {
              resolvedModel = getWorkspacePageUiDefaultProviderModelId(defaultProvider);
              setSelectedModel(resolvedModel);
            } else {
              const firstModel = getWorkspacePageUiFirstModel(modelList);
              if (hasWorkspacePageUiModel(firstModel) === true) {
                resolvedModel = firstModel.id;
                setSelectedModel(firstModel.id);
              }
            }
          }
          setChatModelRegistrySnapshot(buildLoadedChatModelRegistrySnapshot({
            modelCount: modelList.length,
            resolvedModel,
            defaultModel: defaultName,
          }));
        } else {
          setAvailableModels([]);
          setSelectedModel('');
          setChatModelRegistrySnapshot(buildEmptyChatModelRegistrySnapshot(defaultName));
        }
        modelsLoadedRef.current = true;
      } catch (error) {
        console.error('加载模型列表失败:', error);
        const failureMessage = formatWorkspaceModelListLoadFailure(error);
        setChatModelRegistrySnapshot(buildLoadFailedChatModelRegistrySnapshot({
          modelCount: availableModels.length,
          selectedModel: selectedModelSnapshotValue,
          failureMessage,
        }));
        applyPageUiMessages((prev) => [...prev, {
          id: `model-list-load-failed-${Date.now()}`,
          role: 'assistant',
          content: `模型列表加载失败：${failureMessage}。当前模型下拉可能为空或不是最新状态；你可以稍后刷新页面，或检查 LLM Provider 配置后重试。`,
          timestamp: new Date().toISOString(),
        }]);
      } finally {
        modelsLoadingRef.current = false;
      }
    };

    void loadModels();
  }, [applyPageUiMessages, availableModels.length, selectedModel, setAvailableModels, setChatModelRegistrySnapshot, setSelectedModel]);

  useEffect(() => {
    writeWorkspacePageUiStoredSelectedModel(selectedModel);
  }, [selectedModel]);

  const runtimeEnabled = appTypeNeedsRuntime(appType);

  const tabs = useMemo<WorkspacePageUiTab[]>(() => {
    const shouldRenderRuntimeTabs = shouldRenderWorkspacePageUiRuntimeTabs(runtimeEnabled);
    const pageTabs: WorkspacePageUiTab[] = [
      { id: 'explorer', label: '文件', icon: <FolderOpen className="w-4 h-4" /> },
    ];

    if (shouldRenderRuntimeTabs === true) {
      pageTabs.push({ id: 'preview', label: '预览', icon: <Eye className="w-4 h-4" /> });
    }

    pageTabs.push({ id: 'git', label: 'Git', icon: <GitBranch className="w-4 h-4" /> });

    if (shouldRenderRuntimeTabs === true) {
      pageTabs.push({ id: 'debug', label: '调试', icon: <Terminal className="w-4 h-4" /> });
      pageTabs.push({ id: 'terminal', label: '终端', icon: <Terminal className="w-4 h-4" /> });
    }

    return pageTabs;
  }, [runtimeEnabled]);

  useEffect(() => {
    const shouldResetInternalFoundationTab = shouldResetWorkspacePageUiInternalFoundationTab(activeTab);
    if (shouldResetInternalFoundationTab === true) {
      setActiveTab('explorer');
      return;
    }

    const shouldResetRuntimeTab = shouldResetWorkspacePageUiRuntimeTab(activeTab, runtimeEnabled);
    if (shouldResetRuntimeTab === true) {
      setActiveTab('explorer');
    }
  }, [activeTab, runtimeEnabled, setActiveTab]);

  const previewDeviceStyle = useMemo(() => {
    const deviceSizes: WorkspacePageUiPreviewDeviceStyleMap = {
      desktop: { width: '100%', height: '100%' },
      tablet: { width: '768px', height: '1024px' },
      'tablet-landscape': { width: '1024px', height: '768px' },
      mobile: { width: '375px', height: '667px' },
    };

    return deviceSizes[browserDevice];
  }, [browserDevice]);

  return {
    adjustTextareaHeight,
    handleKeyDown,
    copyToClipboard,
    exportProject,
    quoteToChat,
    clearChat,
    handleFileUpload,
    removeAttachment,
    filteredTree,
    hasOriginalFileTreeData,
    explorerSnapshotStatus,
    models,
    runtimeEnabled,
    tabs,
    previewDeviceStyle,
  };
}
