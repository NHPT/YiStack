import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'POST',
    backendPath: `/api/project/${id}/runtime-activity`,
    responseMode: 'text-or-json',
    errorStatus: 503,
    errorBody: (error) => {
      const body = buildBackendProxyErrorBody('project runtime activity', error);
      return {
        ...body,
        success: false,
        error: 'Runtime activity service unavailable',
      };
    },
  });
}
