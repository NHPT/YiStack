import { NextRequest, NextResponse } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

/**
 * GET /api/llm/providers - 代理获取 LLM 提供商列表
 */
export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: '/api/llm/providers',
    includeJsonContentType: true,
    errorBody: (error) => buildBackendProxyErrorBody('llm providers', error),
  });
}

/**
 * POST /api/llm/providers - 普通接口不提供管理操作。
 * 管理后台请使用 /api/admin/llm/providers。
 */
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}
