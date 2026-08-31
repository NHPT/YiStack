import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: '/api/admin/roles',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin roles list', error),
  });
}

export async function POST(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'POST',
    backendPath: '/api/admin/roles',
    bodyMode: 'json',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin role create', error),
  });
}
