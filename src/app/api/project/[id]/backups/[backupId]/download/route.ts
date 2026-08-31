import { NextRequest } from 'next/server';

import {
  buildBackendProxyErrorBody,
  proxyBackendBinaryRequest,
} from '@/app/api/_utils/backend-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; backupId: string }> }
) {
  const { id, backupId } = await params;
  return proxyBackendBinaryRequest(request, {
    method: 'GET',
    backendPath: `/api/project/${id}/backups/${backupId}/download`,
    errorBody: (error) => buildBackendProxyErrorBody('project backup download', error),
  });
}
