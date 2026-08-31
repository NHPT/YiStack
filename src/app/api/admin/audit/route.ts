import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

// GET /api/admin/audit
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '20';
  const offset = searchParams.get('offset') || '0';

  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: `/api/admin/audit?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin audit list', error),
  });
}
