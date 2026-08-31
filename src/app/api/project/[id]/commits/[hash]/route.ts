import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; hash: string }> }
) {
  const { id, hash } = await params;
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: `/api/project/${id}/commits/${hash}`,
    errorBody: (error) => buildBackendProxyErrorBody('project commit detail', error),
  });
}
