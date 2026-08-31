import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendRequest,
} from '@/app/api/_utils/backend-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackendRequest(request, {
    method: 'POST',
    backendPath: `/api/project/${id}/commits/restore-file`,
    bodyMode: 'text',
    includeJsonContentType: true,
    errorBody: (error) => buildBackendProxyErrorBody('project commit file restore', error),
  });
}
