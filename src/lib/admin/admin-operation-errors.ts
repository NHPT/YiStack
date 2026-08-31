import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type AdminOperationErrorDetails = string;

export function formatAdminOperationFailure(
  error: unknown,
  fallback: AdminOperationErrorDetails,
) {
  return formatUserVisibleApiError(error, fallback);
}
