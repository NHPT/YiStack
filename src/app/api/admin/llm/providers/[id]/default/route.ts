import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'PUT',
    backendPath: `/api/admin/llm/providers/${id}/default`,
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin llm provider set default', error),
  });
}
