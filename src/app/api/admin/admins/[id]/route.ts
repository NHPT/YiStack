import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'PUT',
    backendPath: `/api/admin/admins/${encodeURIComponent(id)}`,
    bodyMode: 'json',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin admin update', error),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'DELETE',
    backendPath: `/api/admin/admins/${encodeURIComponent(id)}`,
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin admin delete', error),
  });
}
