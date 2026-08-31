import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'GET',
    backendPath: '/api/admin/enterprise/audit-export-tasks',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin enterprise audit export task readback', error),
  });
}

export async function POST(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'POST',
    backendPath: '/api/admin/enterprise/audit-export-tasks',
    responseMode: 'text-or-json',
    bodyMode: 'json',
    errorBody: (error) => buildBackendProxyErrorBody('admin enterprise audit export task create', error),
  });
}
