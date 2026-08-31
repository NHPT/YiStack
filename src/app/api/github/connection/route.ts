import { NextRequest } from 'next/server';

import { buildBackendProxyErrorBody, proxyBackendRequest } from '@/app/api/_utils/backend-proxy';

export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'GET', backendPath: '/api/github/connection',
    errorBody: (error) => buildBackendProxyErrorBody('github connection', error),
  });
}

export async function DELETE(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'DELETE', backendPath: '/api/github/connection',
    errorBody: (error) => buildBackendProxyErrorBody('github disconnect', error),
  });
}
