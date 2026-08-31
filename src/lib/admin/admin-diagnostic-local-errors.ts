import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type AdminDiagnosticLocalErrorSource = 'browser_history' | 'clipboard';
export type AdminDiagnosticLocalErrorDetails = string;

const adminDiagnosticMissingClipboardMessage: AdminDiagnosticLocalErrorDetails = '浏览器当前不支持剪贴板访问';
const adminDiagnosticMissingClipboardDetails: AdminDiagnosticLocalErrorDetails = 'navigator.clipboard is unavailable';

export function formatAdminDiagnosticLocalError(
  error: unknown,
  fallback: AdminDiagnosticLocalErrorDetails,
  source: AdminDiagnosticLocalErrorSource,
) {
  const details = error instanceof Error ? error.message : fallback;
  return formatUserVisibleApiError({
    message: details,
    source,
    details,
  }, fallback);
}

export function formatAdminDiagnosticMissingClipboardError() {
  return formatUserVisibleApiError({
    message: adminDiagnosticMissingClipboardMessage,
    source: 'clipboard' satisfies AdminDiagnosticLocalErrorSource,
    details: adminDiagnosticMissingClipboardDetails,
  }, adminDiagnosticMissingClipboardMessage);
}
