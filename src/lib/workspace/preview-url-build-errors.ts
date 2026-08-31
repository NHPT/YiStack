import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type PreviewUrlBuildReasonSource = 'workspace_project' | 'preview_gateway_config';

export type PreviewUrlBuildFailureReason = {
  reasonMessage: string;
  reasonSource: PreviewUrlBuildReasonSource;
  reasonDetails: string;
};

export function formatPreviewUrlBuildFailure(
  result: PreviewUrlBuildFailureReason,
  fallback = 'Preview URL 构建失败',
) {
  return formatUserVisibleApiError({
    message: result.reasonMessage,
    source: result.reasonSource,
    details: result.reasonDetails,
  }, fallback);
}
