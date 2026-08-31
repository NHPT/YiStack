import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

// GET /api/admin/auth/profile
export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: '/api/admin/auth/profile',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin auth profile', error),
  });
}
