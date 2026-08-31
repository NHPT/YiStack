import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'POST',
    backendPath: `/api/admin/llm/providers/${id}/models/discover`,
    includeJsonContentType: true,
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin llm provider model discovery', error),
  });
}
