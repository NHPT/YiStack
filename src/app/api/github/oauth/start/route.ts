import { NextRequest } from 'next/server';

import { buildBackendProxyErrorBody, proxyBackendRequest } from '@/app/api/_utils/backend-proxy';

export async function POST(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'POST', backendPath: '/api/github/oauth/start', bodyMode: 'json',
    errorBody: (error) => buildBackendProxyErrorBody('github oauth start', error),
  });
}
