import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: `/api/admin/llm/providers/${id}`,
    includeJsonContentType: true,
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin llm provider detail', error),
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'PUT',
    backendPath: `/api/admin/llm/providers/${id}`,
    bodyMode: 'json',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin llm provider update', error),
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'DELETE',
    backendPath: `/api/admin/llm/providers/${id}`,
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin llm provider delete', error),
  });
}
