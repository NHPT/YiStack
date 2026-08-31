import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type WorkspacePendingNavigationOperation =
  | 'read'
  | 'parse_cleanup'
  | 'clear';
export type WorkspacePendingNavigationLocalSource = 'session_storage';
export type WorkspacePendingNavigationLocalDetails = string;
export type WorkspacePendingNavigationCleanupDetails = WorkspacePendingNavigationLocalDetails;
export type WorkspacePendingNavigationDetailsSegment = string;
export type WorkspacePendingNavigationDetailsSegmentList = WorkspacePendingNavigationDetailsSegment[];

export type WorkspacePendingNavigationLocalFailure<TOperation extends WorkspacePendingNavigationOperation> = {
  ok: false;
  operation: TOperation;
  error: unknown;
  source: WorkspacePendingNavigationLocalSource;
  details: WorkspacePendingNavigationLocalDetails;
  cleanupError?: unknown;
  cleanupDetails?: WorkspacePendingNavigationCleanupDetails;
};

export function getWorkspacePendingNavigationErrorDetails(
  error: unknown,
  fallback: WorkspacePendingNavigationLocalDetails,
): WorkspacePendingNavigationLocalDetails {
  return error instanceof Error ? error.message : fallback;
}

export function buildWorkspacePendingNavigationLocalFailure<
  TOperation extends WorkspacePendingNavigationOperation,
>(
  error: unknown,
  operation: TOperation,
  fallback: WorkspacePendingNavigationLocalDetails,
  cleanup?: {
    error: unknown;
    fallback: WorkspacePendingNavigationCleanupDetails;
  },
): WorkspacePendingNavigationLocalFailure<TOperation> {
  return {
    ok: false,
    operation,
    error,
    source: 'session_storage',
    details: getWorkspacePendingNavigationErrorDetails(error, fallback),
    ...(cleanup
      ? {
        cleanupError: cleanup.error,
        cleanupDetails: getWorkspacePendingNavigationErrorDetails(cleanup.error, cleanup.fallback),
      }
      : {}),
  };
}

function hasWorkspacePendingNavigationDetailsSegment(
  segment: WorkspacePendingNavigationDetailsSegment | undefined,
): segment is WorkspacePendingNavigationDetailsSegment {
  if (segment === undefined) {
    return false;
  }

  const hasSegment = segment.length > 0;
  return hasSegment === true;
}

function getWorkspacePendingNavigationDetailsSegment({
  key,
  value,
}: {
  key: string;
  value: WorkspacePendingNavigationLocalDetails | undefined;
}): WorkspacePendingNavigationDetailsSegment | undefined {
  if (value === undefined) {
    return undefined;
  }

  const hasValue = value.length > 0;
  if (hasValue === false) {
    return undefined;
  }

  return `${key}=${value}`;
}

function formatWorkspacePendingNavigationDetails(
  failure: WorkspacePendingNavigationLocalFailure<WorkspacePendingNavigationOperation>,
) {
  const segments: WorkspacePendingNavigationDetailsSegmentList = [
    `operation=${failure.operation}`,
    `details=${failure.details}`,
  ];
  const cleanupDetailsSegment = getWorkspacePendingNavigationDetailsSegment({
    key: 'cleanup_details',
    value: failure.cleanupDetails,
  });
  const hasCleanupDetailsSegment = hasWorkspacePendingNavigationDetailsSegment(cleanupDetailsSegment);
  if (hasCleanupDetailsSegment === true) {
    segments.push(cleanupDetailsSegment);
  }

  return segments.join('；');
}

export function formatWorkspacePendingNavigationLocalFailure(
  failure: WorkspacePendingNavigationLocalFailure<WorkspacePendingNavigationOperation>,
  fallback: WorkspacePendingNavigationLocalDetails,
) {
  return formatUserVisibleApiError({
    message: failure.details,
    source: failure.source,
    details: formatWorkspacePendingNavigationDetails(failure),
  }, fallback);
}
