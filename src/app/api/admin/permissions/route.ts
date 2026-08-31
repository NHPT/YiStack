import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: '/api/admin/permissions',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin permissions', error),
  });
}
