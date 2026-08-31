import { formatUserVisibleApiError } from '@/lib/api-error-display';

export function formatPlanImplementationLaunchFailure(error: unknown) {
  return formatUserVisibleApiError(error, '请修复后重试');
}
