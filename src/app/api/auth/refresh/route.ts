import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function POST(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'POST',
    backendPath: '/api/auth/refresh',
    bodyMode: 'json',
    errorBody: (error) => buildBackendProxyErrorBody('auth refresh', error),
  });
}
