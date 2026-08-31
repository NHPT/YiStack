import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function GET(request: NextRequest) {
  const { search } = new URL(request.url);
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: `/api/admin/projects${search}`,
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin projects', error),
  });
}
