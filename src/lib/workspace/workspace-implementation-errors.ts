import { formatUserVisibleApiError } from '@/lib/api-error-display';

export function formatImplementationGenerationFailure(error: unknown) {
  return formatUserVisibleApiError(error, '请重试');
}
