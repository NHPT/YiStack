import { formatUserVisibleApiError } from '@/lib/api-error-display';

import { buildProjectDetailFileTreeParseError } from './workspace-runtime-resource-errors';

export function formatProjectBootstrapRecoveryFailure(error: unknown, fallback = '请稍后重试') {
  return formatUserVisibleApiError(error, fallback);
}

export function buildProjectBootstrapFileTreeParseError(projectId: string) {
  return buildProjectDetailFileTreeParseError(projectId, 'project_bootstrap');
}

export function formatProjectBootstrapFileTreeParseFailure(error: unknown) {
  return formatUserVisibleApiError(error, '项目详情 file_tree 字段格式无效');
}
