import { formatUserVisibleApiError } from '@/lib/api-error-display';

export function formatStopGenerationSyncFailure(error: unknown) {
  return formatUserVisibleApiError(error, '请稍后重试');
}
