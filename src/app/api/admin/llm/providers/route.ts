import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: '/api/admin/llm/providers',
    includeJsonContentType: true,
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin llm providers', error),
  });
}

export async function POST(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'POST',
    backendPath: '/api/admin/llm/providers',
    bodyMode: 'json',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin llm provider create', error),
  });
}
