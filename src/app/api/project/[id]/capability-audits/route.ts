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
  const search = request.nextUrl.search || '';
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: `/api/project/${id}/capability-audits${search}`,
    responseMode: 'text-or-json',
    errorStatus: 503,
    errorBody: (error) => {
      const body = buildBackendProxyErrorBody('project capability audits', error);
      return {
        ...body,
        success: false,
        error: 'Capability audit service unavailable',
      };
    },
  });
}
