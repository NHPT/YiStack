import { formatUserVisibleApiError } from '@/lib/api-error-display';

export function formatWorkspaceMermaidRenderError(error: unknown) {
  const details = error instanceof Error ? error.message : '流程图渲染失败';
  return formatUserVisibleApiError({
    message: details,
    source: 'mermaid_render',
    details,
  }, '流程图渲染失败');
}
