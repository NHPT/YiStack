import { formatUserVisibleApiError } from '@/lib/api-error-display';

export function formatWorkspaceModelListLoadFailure(error: unknown) {
  return formatUserVisibleApiError(error, '请稍后重试');
}
