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
    backendPath: `/api/project/${id}`,
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('project detail', error),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'PUT',
    backendPath: `/api/project/${id}`,
    bodyMode: 'json',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('project update', error),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'DELETE',
    backendPath: `/api/project/${id}`,
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('project delete', error),
  });
}
