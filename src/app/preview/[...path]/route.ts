import { NextRequest } from 'next/server';

import { proxyPreviewRequest } from '../_preview-proxy';

type PreviewRouteContext = {
  params: Promise<{ path?: string[] }>;
};

async function getPreviewPathSegments(context: PreviewRouteContext): Promise<string[]> {
  const params = await context.params;
  return params.path || [];
}

export async function GET(request: NextRequest, context: PreviewRouteContext) {
  return proxyPreviewRequest(request, await getPreviewPathSegments(context));
}

export async function POST(request: NextRequest, context: PreviewRouteContext) {
  return proxyPreviewRequest(request, await getPreviewPathSegments(context));
}

export async function PUT(request: NextRequest, context: PreviewRouteContext) {
  return proxyPreviewRequest(request, await getPreviewPathSegments(context));
}

export async function PATCH(request: NextRequest, context: PreviewRouteContext) {
  return proxyPreviewRequest(request, await getPreviewPathSegments(context));
}

export async function DELETE(request: NextRequest, context: PreviewRouteContext) {
  return proxyPreviewRequest(request, await getPreviewPathSegments(context));
}

export async function OPTIONS(request: NextRequest, context: PreviewRouteContext) {
  return proxyPreviewRequest(request, await getPreviewPathSegments(context));
}
