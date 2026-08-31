import { formatUserVisibleApiError } from '@/lib/api-error-display';

export function formatCapabilityAuditLoadFailure(error: unknown) {
  return formatUserVisibleApiError(error, '能力审计加载失败');
}
