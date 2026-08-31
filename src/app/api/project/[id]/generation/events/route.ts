import { NextRequest } from 'next/server';

import { buildBackendProxyErrorBody, proxyBackendStreamRequest } from '@/app/api/_utils/backend-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const query = request.nextUrl.searchParams.toString();
  return proxyBackendStreamRequest(request, {
    method: 'GET',
    backendPath: `/api/project/${id}/generation/events${query ? `?${query}` : ''}`,
    cache: 'no-store',
    errorBody: (error) => buildBackendProxyErrorBody('project generation event replay', error),
  });
}
