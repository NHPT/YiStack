import { NextRequest } from 'next/server';

import { proxyPreviewRequest } from './_preview-proxy';

export async function GET(request: NextRequest) {
  return proxyPreviewRequest(request, []);
}

export async function POST(request: NextRequest) {
  return proxyPreviewRequest(request, []);
}

export async function PUT(request: NextRequest) {
  return proxyPreviewRequest(request, []);
}

export async function PATCH(request: NextRequest) {
  return proxyPreviewRequest(request, []);
}

export async function DELETE(request: NextRequest) {
  return proxyPreviewRequest(request, []);
}

export async function OPTIONS(request: NextRequest) {
  return proxyPreviewRequest(request, []);
}
