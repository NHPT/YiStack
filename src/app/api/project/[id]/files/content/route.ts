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
  const path = request.nextUrl.searchParams.get('path') || '';
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: `/api/project/${id}/files/content?path=${encodeURIComponent(path)}`,
    errorBody: (error) => buildBackendProxyErrorBody('project file content read', error),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'PUT',
    backendPath: `/api/project/${id}/files/content`,
    bodyMode: 'json',
    errorBody: (error) => buildBackendProxyErrorBody('project file content write', error),
  });
}
