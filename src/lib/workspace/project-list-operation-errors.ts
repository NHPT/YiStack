import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type ProjectListOperationErrorDetails = string;

export function formatProjectListOperationError(
  error: unknown,
  fallback: ProjectListOperationErrorDetails,
) {
  return formatUserVisibleApiError(error, fallback);
}
