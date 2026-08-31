import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: `/api/admin/admins${search}`,
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin admins list', error),
  });
}
