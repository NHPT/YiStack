import { NextRequest } from 'next/server';

import { buildBackendProxyErrorBody, proxyBackendRequest } from '@/app/api/_utils/backend-proxy';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const query = request.nextUrl.searchParams.toString();
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: `/api/project/${encodeURIComponent(id)}/collaboration/state${query ? `?${query}` : ''}`,
    cache: 'no-store',
    errorBody: (error) => buildBackendProxyErrorBody('project collaboration state', error),
  });
}
