import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

/**
 * GET /api/llm/config - 代理获取当前 LLM 配置
 */
export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: '/api/llm/config',
    includeJsonContentType: true,
    errorBody: (error) => buildBackendProxyErrorBody('llm config read', error),
  });
}
