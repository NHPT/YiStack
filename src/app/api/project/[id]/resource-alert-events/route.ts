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
  const url = new URL(request.url);
  const query = url.search || '';
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: `/api/project/${id}/resource-alert-events${query}`,
    errorBody: (error) => buildBackendProxyErrorBody('project resource alert events', error),
  });
}
