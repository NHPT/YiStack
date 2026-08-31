import type {
  ChatAttachmentSnapshot,
  ChatAttachmentSnapshotSource,
  ChatAttachmentSnapshotStatus,
  ChatInputSnapshot,
  ChatInputSnapshotSource,
  ChatInputSnapshotStatus,
  ChatMode,
  ChatModeSnapshot,
  ChatModeSnapshotSource,
  ChatModeSnapshotStatus,
  ChatModelRegistrySnapshot,
  ChatModelRegistrySnapshotSource,
  ChatModelRegistrySnapshotStatus,
} from './workspace-types';

type ChatInputSnapshotOptions = {
  input: string;
  planSelectionPending: boolean;
  isBusyGenerating: boolean;
  isStopConfirming: boolean;
  isPlanning: boolean;
  isGenerating: boolean;
  selectedModel: string;
  modelCount: number;
  attachmentCount: number;
};

type ChatModeSnapshotOptions = {
  chatMode: ChatMode;
  isOnline: boolean;
  foundationStatusLabel: string;
  isBusyGenerating: boolean;
  isStopConfirming: boolean;
  isPlanning: boolean;
  isGenerating: boolean;
};

type ChatModelRegistrySnapshotOptions = {
  modelCount: number;
  selectedModel: string;
};

type LoadedChatModelRegistrySnapshotOptions = {
  modelCount: number;
  resolvedModel: string;
  defaultModel: string | null;
};

type LoadFailedChatModelRegistrySnapshotOptions = ChatModelRegistrySnapshotOptions & {
  failureMessage: string;
};

type SelectedChatAttachmentSnapshotOptions = {
  selectedCount: number;
  attachmentCount: number;
  totalSize: number;
  lastFileName: string | null;
};

type RemovedChatAttachmentSnapshotOptions = {
  attachmentCount: number;
  totalSize: number;
  removedFileName: string | null;
};

function hasWorkspaceChatComposerSnapshotTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

export function getWorkspaceChatComposerSnapshotSelectedModel(
  selectedModel: string | null | undefined,
  fallbackModel: string,
): string {
  const hasSelectedModel = hasWorkspaceChatComposerSnapshotTextValue(selectedModel);
  if (hasSelectedModel === true) {
    return selectedModel;
  }

  return fallbackModel;
}

export function buildInitialChatModelRegistrySnapshot(): ChatModelRegistrySnapshot {
  const status: ChatModelRegistrySnapshotStatus = 'idle';
  const source: ChatModelRegistrySnapshotSource = 'model_registry';

  return {
    status,
    source,
    modelCount: 0,
    selectedModel: 'default',
    defaultModel: null,
    message: '模型列表尚未开始加载。',
    recovery: '进入 Workspace 后会自动从 LLM Provider 配置加载可用模型。',
    updatedAt: 'pending',
  };
}

export function buildLoadingChatModelRegistrySnapshot({
  modelCount,
  selectedModel,
}: ChatModelRegistrySnapshotOptions): ChatModelRegistrySnapshot {
  const status: ChatModelRegistrySnapshotStatus = 'loading';
  const source: ChatModelRegistrySnapshotSource = 'llm_provider_api';

  return {
    status,
    source,
    modelCount,
    selectedModel: getWorkspaceChatComposerSnapshotSelectedModel(selectedModel, 'default'),
    defaultModel: null,
    message: '正在从 LLM Provider 配置加载可用模型。',
    recovery: '等待模型列表加载完成；若长时间停留，可刷新 Workspace 或检查管理后台 Provider 配置。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildLoadedChatModelRegistrySnapshot({
  modelCount,
  resolvedModel,
  defaultModel,
}: LoadedChatModelRegistrySnapshotOptions): ChatModelRegistrySnapshot {
  const status: ChatModelRegistrySnapshotStatus = resolvedModel ? 'default_selected' : 'ready';
  const source: ChatModelRegistrySnapshotSource = resolvedModel ? 'default_provider' : 'llm_provider_api';

  return {
    status,
    source,
    modelCount,
    selectedModel: getWorkspaceChatComposerSnapshotSelectedModel(resolvedModel, 'default'),
    defaultModel,
    message: resolvedModel
      ? `模型列表已加载，并选择默认模型 ${resolvedModel}。`
      : `模型列表已加载，共 ${modelCount} 个模型。`,
    recovery: '可以在模型菜单中切换模型，或直接使用当前选择继续发送。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildEmptyChatModelRegistrySnapshot(defaultModel: string | null): ChatModelRegistrySnapshot {
  const status: ChatModelRegistrySnapshotStatus = 'empty';
  const source: ChatModelRegistrySnapshotSource = 'llm_provider_api';

  return {
    status,
    source,
    modelCount: 0,
    selectedModel: 'default',
    defaultModel,
    message: 'LLM Provider 接口返回了空模型列表。',
    recovery: '请到管理后台配置并启用 LLM Provider；若后端有默认兜底，也可以继续尝试发送。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildLoadFailedChatModelRegistrySnapshot({
  modelCount,
  selectedModel,
  failureMessage,
}: LoadFailedChatModelRegistrySnapshotOptions): ChatModelRegistrySnapshot {
  const status: ChatModelRegistrySnapshotStatus = 'load_failed';
  const source: ChatModelRegistrySnapshotSource = 'llm_provider_api';

  return {
    status,
    source,
    modelCount,
    selectedModel: getWorkspaceChatComposerSnapshotSelectedModel(selectedModel, 'default'),
    defaultModel: null,
    message: `模型列表加载失败：${failureMessage}`,
    recovery: '当前模型下拉可能为空或不是最新状态；你可以稍后刷新页面，或检查 LLM Provider 配置后重试。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildInitialChatAttachmentSnapshot(): ChatAttachmentSnapshot {
  const status: ChatAttachmentSnapshotStatus = 'empty';
  const source: ChatAttachmentSnapshotSource = 'attachment_state';

  return {
    status,
    source,
    attachmentCount: 0,
    totalSize: 0,
    lastFileName: null,
    message: '当前没有选择附件。',
    recovery: '点击上传按钮可以为下一条消息附加文件。',
    updatedAt: 'pending',
  };
}

export function buildPickerEmptyChatAttachmentSnapshot(): ChatAttachmentSnapshot {
  const status: ChatAttachmentSnapshotStatus = 'picker_empty';
  const source: ChatAttachmentSnapshotSource = 'file_picker';

  return {
    status,
    source,
    attachmentCount: 0,
    totalSize: 0,
    lastFileName: null,
    message: '文件选择器没有返回任何附件。',
    recovery: '重新点击上传按钮选择文件；如果浏览器阻止文件选择，请检查页面权限。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildSelectedChatAttachmentSnapshot({
  selectedCount,
  attachmentCount,
  totalSize,
  lastFileName,
}: SelectedChatAttachmentSnapshotOptions): ChatAttachmentSnapshot {
  const status: ChatAttachmentSnapshotStatus = 'selected';
  const source: ChatAttachmentSnapshotSource = 'file_picker';

  return {
    status,
    source,
    attachmentCount,
    totalSize,
    lastFileName,
    message: `已选择 ${selectedCount} 个新附件，当前共 ${attachmentCount} 个附件。`,
    recovery: '发送前可以继续添加附件，或点击附件标签上的移除按钮清理不需要的文件。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildRemovedChatAttachmentSnapshot({
  attachmentCount,
  totalSize,
  removedFileName,
}: RemovedChatAttachmentSnapshotOptions): ChatAttachmentSnapshot {
  const status: ChatAttachmentSnapshotStatus = attachmentCount > 0 ? 'removed' : 'empty';
  const source: ChatAttachmentSnapshotSource = 'user_action';

  return {
    status,
    source,
    attachmentCount,
    totalSize,
    lastFileName: removedFileName,
    message: removedFileName
      ? `已移除附件 ${removedFileName}，当前剩余 ${attachmentCount} 个附件。`
      : '附件移除请求没有匹配到有效文件。',
    recovery: attachmentCount > 0
      ? '可以继续发送剩余附件，或继续移除不需要的文件。'
      : '当前没有选择附件；需要时可重新点击上传按钮添加文件。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildChatInputSnapshot({
  input,
  planSelectionPending,
  isBusyGenerating,
  isStopConfirming,
  isPlanning,
  isGenerating,
  selectedModel,
  modelCount,
  attachmentCount,
}: ChatInputSnapshotOptions): ChatInputSnapshot {
  const promptLength = input.trim().length;
  const hasPrompt = promptLength > 0;
  const hasSelectedModel = selectedModel.length > 0;
  const canSendBase = planSelectionPending === false
    && hasPrompt === true
    && isBusyGenerating === false;
  const base = {
    canSend: canSendBase,
    promptLength,
    attachmentCount,
    selectedModel: hasSelectedModel === true ? selectedModel : 'default',
    modelCount,
    updatedAt: 'derived',
  };

  if (isStopConfirming === true) {
    const status: ChatInputSnapshotStatus = 'stop_confirmation';
    const source: ChatInputSnapshotSource = 'stop_control';

    return {
      ...base,
      status,
      source,
      canSend: false,
      message: '当前正在等待再次确认停止生成。',
      recovery: '再次点击“确认停止”会终止当前生成；如果误触，等待确认态自动过期即可继续。',
    };
  }
  if (isGenerating === true) {
    const status: ChatInputSnapshotStatus = 'generating';
    const source: ChatInputSnapshotSource = 'generation_state';

    return {
      ...base,
      status,
      source,
      canSend: false,
      message: 'AI 正在生成实现输出，输入区暂时转为停止控制。',
      recovery: '等待生成完成，或点击停止生成后再继续输入新需求。',
    };
  }
  if (isPlanning === true) {
    const status: ChatInputSnapshotStatus = 'planning';
    const source: ChatInputSnapshotSource = 'generation_state';

    return {
      ...base,
      status,
      source,
      canSend: false,
      message: 'AI 正在生成或更新方案，当前输入暂不发送。',
      recovery: '等待方案生成完成，或根据方案选择入口继续推进。',
    };
  }
  if (planSelectionPending === true) {
    const status: ChatInputSnapshotStatus = 'plan_selection_required';
    const source: ChatInputSnapshotSource = 'plan_selection';

    return {
      ...base,
      status,
      source,
      canSend: false,
      message: '已有候选方案等待选择，直接发送新输入可能打断当前方案决策。',
      recovery: '请先选择一个技术方案，或通过方案消息里的提问入口补充问题。',
    };
  }
  if (hasPrompt === false) {
    const status: ChatInputSnapshotStatus = 'empty_prompt';
    const source: ChatInputSnapshotSource = 'input_buffer';

    return {
      ...base,
      status,
      source,
      canSend: false,
      message: attachmentCount > 0
        ? '已添加附件，但还没有输入文字需求。'
        : '输入区当前没有可发送的文字内容。',
      recovery: '补充需求、修改意见或下一步指令后即可发送。',
    };
  }
  if (modelCount === 0) {
    const status: ChatInputSnapshotStatus = 'model_unconfigured';
    const source: ChatInputSnapshotSource = 'model_registry';

    return {
      ...base,
      status,
      source,
      message: '当前未加载到可选择的 LLM 模型，发送可能依赖后端默认模型或失败。',
      recovery: '可先到管理后台检查模型配置；若后端存在默认模型，也可以继续尝试发送。',
    };
  }
  const status: ChatInputSnapshotStatus = 'ready_to_send';
  const source: ChatInputSnapshotSource = 'input_buffer';

  return {
    ...base,
    status,
    source,
    message: attachmentCount > 0
      ? `输入已就绪，并附带 ${attachmentCount} 个附件。`
      : '输入已就绪，可以发送给 AI。',
    recovery: '点击发送或按快捷键即可进入下一步。',
  };
}

export function buildChatModeSnapshot({
  chatMode,
  isOnline,
  foundationStatusLabel,
  isBusyGenerating,
  isStopConfirming,
  isPlanning,
  isGenerating,
}: ChatModeSnapshotOptions): ChatModeSnapshot {
  const isDiscussMode = chatMode === 'discuss';
  const isImplementMode = chatMode === 'implement';
  const hasOnlineMode = isOnline === true;
  const hasBusyGeneration = isBusyGenerating === true;
  const base = {
    chatMode,
    isOnline,
    foundationStatusLabel,
    isBusy: hasBusyGeneration,
    updatedAt: 'derived',
  };

  if (isStopConfirming === true) {
    const status: ChatModeSnapshotStatus = 'stop_confirmation';
    const source: ChatModeSnapshotSource = 'stop_control';

    return {
      ...base,
      status,
      source,
      message: '当前正在确认是否停止生成，模式与联网开关会保留当前选择。',
      recovery: '确认停止或等待确认态结束后，再继续切换探讨/实现或联网状态。',
    };
  }
  if (isGenerating === true) {
    const status: ChatModeSnapshotStatus = 'generating';
    const source: ChatModeSnapshotSource = 'generation_state';

    return {
      ...base,
      status,
      source,
      message: `当前以${isImplementMode === true ? '实现' : '探讨'}模式生成输出，联网${hasOnlineMode === true ? '已开启' : '未开启'}。`,
      recovery: '等待生成完成，或停止生成后再切换模式与联网状态。',
    };
  }
  if (isPlanning === true) {
    const status: ChatModeSnapshotStatus = 'planning';
    const source: ChatModeSnapshotSource = 'generation_state';

    return {
      ...base,
      status,
      source,
      message: `当前正在方案生成阶段，项目基础设定状态为“${foundationStatusLabel}”。`,
      recovery: '等待方案生成完成后，再根据方案选择继续探讨或进入实现。',
    };
  }
  if (hasOnlineMode === true && isDiscussMode === true) {
    const status: ChatModeSnapshotStatus = 'online_discuss';
    const source: ChatModeSnapshotSource = 'online_toggle';

    return {
      ...base,
      status,
      source,
      message: '当前为探讨模式，并已开启联网辅助。',
      recovery: '可继续提问或关闭联网；进入实现前建议确认需求与方案边界。',
    };
  }
  if (hasOnlineMode === true && isImplementMode === true) {
    const status: ChatModeSnapshotStatus = 'online_implement';
    const source: ChatModeSnapshotSource = 'online_toggle';

    return {
      ...base,
      status,
      source,
      message: '当前为实现模式，并已开启联网辅助。',
      recovery: '发送后会按实现路径推进；如不需要外部信息，可关闭联网后再发送。',
    };
  }
  if (isDiscussMode === true) {
    const status: ChatModeSnapshotStatus = 'discuss_ready';
    const source: ChatModeSnapshotSource = 'mode_toggle';

    return {
      ...base,
      status,
      source,
      message: '当前为探讨模式，适合澄清需求、比较方案或提出问题。',
      recovery: '确认方向后可切换到实现模式，或继续以探讨模式补充约束。',
    };
  }
  const status: ChatModeSnapshotStatus = 'implement_ready';
  const source: ChatModeSnapshotSource = 'mode_toggle';

  return {
    ...base,
    status,
    source,
    message: `当前为实现模式，项目基础设定状态为“${foundationStatusLabel}”。`,
    recovery: '发送后会按实现路径推进；如仍需讨论方案，可先切换到探讨模式。',
  };
}
