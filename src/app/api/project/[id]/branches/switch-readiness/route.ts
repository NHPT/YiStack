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
  const { search } = new URL(request.url);
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: `/api/project/${id}/branches/switch-readiness${search}`,
    errorBody: (error) => buildBackendProxyErrorBody('project branch switch readiness', error),
  });
}
