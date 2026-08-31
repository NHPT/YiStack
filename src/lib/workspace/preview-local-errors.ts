import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type PreviewLocalErrorSource = 'preview_iframe' | 'browser_history';
export type PreviewLocalErrorDetails = string;

export function getPreviewLocalErrorDetails(
  error: unknown,
  fallback: PreviewLocalErrorDetails,
): PreviewLocalErrorDetails {
  return error instanceof Error ? error.message : fallback;
}

export function formatPreviewLocalError(
  error: unknown,
  fallback: PreviewLocalErrorDetails,
  source: PreviewLocalErrorSource,
) {
  const details = getPreviewLocalErrorDetails(error, fallback);
  return formatUserVisibleApiError({
    message: details,
    source,
    details,
  }, fallback);
}

export function formatPreviewIframeError(error: unknown, fallback: PreviewLocalErrorDetails) {
  return formatPreviewLocalError(error, fallback, 'preview_iframe');
}
