import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

/**
 * GET /api/chat/models - 代理获取可用模型列表
 */
export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: '/api/chat/models',
    includeJsonContentType: true,
    errorBody: (error) => buildBackendProxyErrorBody('chat models', error),
  });
}
