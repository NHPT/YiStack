import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

// GET /api/admin/users
export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: '/api/admin/users',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin users list', error),
  });
}
