import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: `/api/project/${id}/runtime-status`,
    responseMode: 'text-or-json',
    errorStatus: 503,
    errorBody: (error) => {
      const body = buildBackendProxyErrorBody('project runtime status', error);
      return {
        ...body,
        success: false,
        error: 'Runtime status service unavailable',
      };
    },
  });
}
