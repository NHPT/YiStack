import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendStreamRequest,
} from '@/app/api/_utils/backend-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return proxyBackendStreamRequest(request, {
    method: 'POST',
    backendPath: '/api/project/plans',
    bodyMode: 'json',
    cache: 'no-store',
    errorBody: (error) => buildBackendProxyErrorBody('project plans stream', error),
  });
}
