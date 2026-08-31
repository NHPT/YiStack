import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function POST(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'POST',
    backendPath: '/api/admin/enterprise/project-access-guard-activation/manual-approval',
    responseMode: 'text-or-json',
    errorBody: (error) => buildBackendProxyErrorBody('admin enterprise project access guard activation manual approval', error),
  });
}
