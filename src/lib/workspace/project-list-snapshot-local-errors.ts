import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type ProjectListSnapshotPersistenceSource = 'local_storage';
export type ProjectListSnapshotPersistenceDetails = string;

export type ProjectListSnapshotPersistenceFailure = {
  ok: false;
  error: unknown;
  source: ProjectListSnapshotPersistenceSource;
  details: ProjectListSnapshotPersistenceDetails;
};

export function getProjectListSnapshotPersistenceDetails(
  error: unknown,
  fallback: ProjectListSnapshotPersistenceDetails,
): ProjectListSnapshotPersistenceDetails {
  return error instanceof Error ? error.message : fallback;
}

export function buildProjectListSnapshotPersistenceFailure(
  error: unknown,
  fallback: ProjectListSnapshotPersistenceDetails = '浏览器拒绝写入本地项目快照',
): ProjectListSnapshotPersistenceFailure {
  return {
    ok: false,
    error,
    source: 'local_storage',
    details: getProjectListSnapshotPersistenceDetails(error, fallback),
  };
}

export function buildProjectListSnapshotPersistenceFailureFromDetails(
  details: ProjectListSnapshotPersistenceDetails,
): ProjectListSnapshotPersistenceFailure {
  return {
    ok: false,
    error: details,
    source: 'local_storage',
    details,
  };
}

export function formatProjectListSnapshotPersistenceFailure(
  failure: ProjectListSnapshotPersistenceFailure,
  fallback: ProjectListSnapshotPersistenceDetails = '浏览器拒绝写入本地项目快照',
) {
  return formatUserVisibleApiError({
    message: failure.details,
    source: failure.source,
    details: failure.details,
  }, fallback);
}
