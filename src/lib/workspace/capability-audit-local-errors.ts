import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type CapabilityAuditLocalErrorSource = 'browser_history' | 'clipboard';
export type CapabilityAuditLocalErrorDetails = string;

const capabilityAuditMissingClipboardMessage: CapabilityAuditLocalErrorDetails = '浏览器当前不支持剪贴板访问';
const capabilityAuditMissingClipboardDetails: CapabilityAuditLocalErrorDetails = 'navigator.clipboard is unavailable';

export function formatCapabilityAuditLocalError(
  error: unknown,
  fallback: CapabilityAuditLocalErrorDetails,
  source: CapabilityAuditLocalErrorSource,
) {
  const details = error instanceof Error ? error.message : fallback;
  return formatUserVisibleApiError({
    message: details,
    source,
    details,
  }, fallback);
}

export function formatCapabilityAuditMissingClipboardError() {
  return formatUserVisibleApiError({
    message: capabilityAuditMissingClipboardMessage,
    source: 'clipboard' satisfies CapabilityAuditLocalErrorSource,
    details: capabilityAuditMissingClipboardDetails,
  }, capabilityAuditMissingClipboardMessage);
}
