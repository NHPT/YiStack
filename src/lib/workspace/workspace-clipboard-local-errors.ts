import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type WorkspaceClipboardLocalErrorDetails = string;

const workspaceMissingClipboardMessage: WorkspaceClipboardLocalErrorDetails = '浏览器当前不支持剪贴板访问';
const workspaceMissingClipboardDetails: WorkspaceClipboardLocalErrorDetails = 'navigator.clipboard is unavailable';

export function formatWorkspaceClipboardError(
  error: unknown,
  fallback: WorkspaceClipboardLocalErrorDetails,
) {
  const details = error instanceof Error ? error.message : fallback;
  return formatUserVisibleApiError({
    message: details,
    source: 'clipboard',
    details,
  }, fallback);
}

export function formatWorkspaceMissingClipboardError() {
  return formatUserVisibleApiError({
    message: workspaceMissingClipboardMessage,
    source: 'clipboard',
    details: workspaceMissingClipboardDetails,
  }, workspaceMissingClipboardMessage);
}
