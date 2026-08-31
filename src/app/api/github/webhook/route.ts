import { NextRequest } from 'next/server';

import { buildBackendProxyErrorBody, proxyBackendRequest } from '@/app/api/_utils/backend-proxy';

export async function POST(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: 'POST', backendPath: '/api/github/webhook', bodyMode: 'text',
    includeJsonContentType: true,
    forwardHeaders: ['X-GitHub-Delivery', 'X-GitHub-Event', 'X-Hub-Signature-256'],
    errorBody: (error) => buildBackendProxyErrorBody('github webhook', error),
  });
}
