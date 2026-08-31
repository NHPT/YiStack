import { formatUserVisibleApiError } from '@/lib/api-error-display';

export function formatPlanGenerationFailure(error: unknown) {
  return formatUserVisibleApiError(error, '请重试');
}
