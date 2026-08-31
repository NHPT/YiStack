import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendStreamRequest,
} from '@/app/api/_utils/backend-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/generate - 代理流式代码生成请求到 Go 后端
 * 后端返回 SSE (text/event-stream)，这里直接透传
 */
export async function POST(request: NextRequest) {
  return proxyBackendStreamRequest(request, {
    method: 'POST',
    backendPath: '/api/chat/generate',
    bodyMode: 'json',
    cache: 'no-store',
    errorBody: (error) => buildBackendProxyErrorBody('chat generate stream', error),
  });
}
