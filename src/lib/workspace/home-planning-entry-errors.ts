import { formatUserVisibleApiError } from '@/lib/api-error-display';

export function formatHomePlanningStartFailure(error: unknown) {
  return formatUserVisibleApiError(error, '未知错误');
}
