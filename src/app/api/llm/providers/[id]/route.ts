import { NextRequest, NextResponse } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

/**
 * GET /api/llm/providers/[id] - 代理获取单个 LLM 提供商
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: `/api/llm/providers/${id}`,
    includeJsonContentType: true,
    errorBody: (error) => buildBackendProxyErrorBody('llm provider detail', error),
  });
}

/**
 * PUT /api/llm/providers/[id] - 普通接口不提供管理操作。
 * 管理后台请使用 /api/admin/llm/providers/[id]。
 */
export async function PUT() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

/**
 * DELETE /api/llm/providers/[id] - 普通接口不提供管理操作。
 * 管理后台请使用 /api/admin/llm/providers/[id]。
 */
export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}
