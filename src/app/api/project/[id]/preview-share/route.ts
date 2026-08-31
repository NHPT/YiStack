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
    backendPath: `/api/project/${id}/preview-share`,
    includeJsonContentType: true,
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('project preview share enable', error),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'DELETE',
    backendPath: `/api/project/${id}/preview-share`,
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('project preview share disable', error),
  });
}
