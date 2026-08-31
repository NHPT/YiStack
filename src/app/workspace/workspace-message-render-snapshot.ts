import type {
  MermaidMessageRenderSnapshotStatus,
  MessageRenderSnapshot,
  MessageRenderSnapshotSource,
  MessageRenderSnapshotStatus,
} from './workspace-types';

export type CodeBlockCopyStatus = 'idle' | 'copied' | 'failed';

type CodeBlockMessageRenderSnapshotOptions = {
  copyStatus: CodeBlockCopyStatus;
  copyError: string;
  language: string;
  contentLength: number;
};

type MermaidMessageRenderSnapshotOptions = {
  status: MermaidMessageRenderSnapshotStatus;
  contentLength: number;
  error?: string;
};

function hasMessageRenderSnapshotTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function getMessageRenderSnapshotFallbackTextValue(value: string, fallback: string): string {
  const hasValue = hasMessageRenderSnapshotTextValue(value);
  if (hasValue === true) {
    return value;
  }

  return fallback;
}

function getMessageRenderSnapshotOptionalTextValue(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }

  return value;
}

function getMessageRenderSnapshotLanguage(language: string): string {
  return getMessageRenderSnapshotFallbackTextValue(language, 'code');
}

function getCodeBlockCopyErrorMessage(copyError: string): string {
  return getMessageRenderSnapshotFallbackTextValue(copyError, '浏览器拒绝了剪贴板访问');
}

function getMermaidRenderErrorMessage(error: string | undefined): string {
  const errorValue = getMessageRenderSnapshotOptionalTextValue(error);
  return getMessageRenderSnapshotFallbackTextValue(errorValue, '未知渲染错误');
}

export function buildCodeBlockMessageRenderSnapshot({
  copyStatus,
  copyError,
  language,
  contentLength,
}: CodeBlockMessageRenderSnapshotOptions): MessageRenderSnapshot {
  const resolvedLanguage = getMessageRenderSnapshotLanguage(language);

  if (copyStatus === 'failed') {
    const status: MessageRenderSnapshotStatus = 'code_copy_failed';
    const source: MessageRenderSnapshotSource = 'clipboard';
    const copyErrorMessage = getCodeBlockCopyErrorMessage(copyError);

    return {
      status,
      source,
      language: resolvedLanguage,
      contentLength,
      message: `代码块复制失败：${copyErrorMessage}`,
      recovery: '当前内容没有写入系统剪贴板；请手动选中代码复制，或检查浏览器剪贴板权限后重试。',
      updatedAt: 'derived',
    };
  }

  if (copyStatus === 'copied') {
    const status: MessageRenderSnapshotStatus = 'code_copied';
    const source: MessageRenderSnapshotSource = 'clipboard';

    return {
      status,
      source,
      language: resolvedLanguage,
      contentLength,
      message: '代码块内容已写入系统剪贴板。',
      recovery: '可以直接粘贴到目标文件、终端或外部编辑器。',
      updatedAt: 'derived',
    };
  }

  const status: MessageRenderSnapshotStatus = 'code_idle';
  const source: MessageRenderSnapshotSource = 'code_block';

  return {
    status,
    source,
    language: resolvedLanguage,
    contentLength,
    message: '代码块等待复制操作。',
    recovery: '点击复制按钮可写入系统剪贴板；如果浏览器拒绝，会显示结构化失败来源。',
    updatedAt: 'derived',
  };
}

export function buildMermaidMessageRenderSnapshot({
  status,
  contentLength,
  error,
}: MermaidMessageRenderSnapshotOptions): MessageRenderSnapshot {
  if (status === 'mermaid_failed') {
    const source: MessageRenderSnapshotSource = 'mermaid_render';
    const errorMessage = getMermaidRenderErrorMessage(error);

    return {
      status,
      source,
      language: 'mermaid',
      contentLength,
      message: `Mermaid 图表渲染失败：${errorMessage}`,
      recovery: '当前仍展示原始 Mermaid 源码；请修正语法或简化图表后重试。',
      updatedAt: 'derived',
    };
  }

  if (status === 'mermaid_rendering') {
    const source: MessageRenderSnapshotSource = 'mermaid_render';

    return {
      status,
      source,
      language: 'mermaid',
      contentLength,
      message: 'Mermaid 图表正在渲染。',
      recovery: '等待渲染完成；如果长时间没有完成，请检查图表语法或刷新消息。',
      updatedAt: 'derived',
    };
  }

  const source: MessageRenderSnapshotSource = 'mermaid_render';

  return {
    status,
    source,
    language: 'mermaid',
    contentLength,
    message: 'Mermaid 图表已渲染为 SVG 预览。',
    recovery: '如图表展示异常，请检查源码或复制 Mermaid 内容到外部工具排查。',
    updatedAt: 'derived',
  };
}
