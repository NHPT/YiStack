import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: '/api/auth/profile',
    includeJsonContentType: true,
    errorBody: (error) => buildBackendProxyErrorBody('auth profile', error),
  });
}

export async function PUT(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'PUT',
    backendPath: '/api/auth/profile',
    bodyMode: 'json',
    errorBody: (error) => buildBackendProxyErrorBody('auth profile update', error),
  });
}
