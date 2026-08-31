import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type AuthOperationErrorDetails = string;

export function formatAuthOperationFailure(
  error: unknown,
  fallback: AuthOperationErrorDetails,
) {
  return formatUserVisibleApiError(error, fallback);
}
