import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

// PUT /api/admin/config/[key]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  return proxyBackendRequest(request, {
    method: 'PUT',
    backendPath: `/api/admin/config/${encodeURIComponent(key)}`,
    bodyMode: 'json',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin config update', error),
  });
}
