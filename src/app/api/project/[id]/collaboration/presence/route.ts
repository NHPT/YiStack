import { NextRequest } from 'next/server';

import { buildBackendProxyErrorBody, proxyBackendRequest } from '@/app/api/_utils/backend-proxy';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'POST',
    backendPath: `/api/project/${encodeURIComponent(id)}/collaboration/presence`,
    bodyMode: 'json',
    errorBody: (error) => buildBackendProxyErrorBody('project collaboration presence', error),
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'DELETE',
    backendPath: `/api/project/${encodeURIComponent(id)}/collaboration/presence`,
    bodyMode: 'json',
    errorBody: (error) => buildBackendProxyErrorBody('project collaboration leave', error),
  });
}
