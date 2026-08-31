import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: '/api/project/list',
    includeJsonContentType: true,
    errorBody: (error) => buildBackendProxyErrorBody('project list', error),
  });
}
