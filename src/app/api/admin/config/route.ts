import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

// GET /api/admin/config
export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: '/api/admin/config',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin config list', error),
  });
}
