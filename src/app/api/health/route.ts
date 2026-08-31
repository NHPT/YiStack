import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: '/api/health',
    includeJsonContentType: true,
    errorBody: (error) => buildBackendProxyErrorBody('backend health', error),
  });
}
