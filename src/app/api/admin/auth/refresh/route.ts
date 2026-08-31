import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

// POST /api/admin/auth/refresh
export async function POST(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'POST',
    backendPath: '/api/admin/auth/refresh',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin auth refresh', error),
  });
}
