import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function POST(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'POST',
    backendPath: '/api/admin/llm/providers/test',
    bodyMode: 'json',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin llm provider connection test', error),
  });
}
