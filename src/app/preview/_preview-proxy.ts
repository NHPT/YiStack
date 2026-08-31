import { NextRequest, NextResponse } from 'next/server';

type PreviewPathSegmentList = string[];

const previewGatewayInternalUrl = process.env.PREVIEW_GATEWAY_URL
  || process.env.CONTAINER_PREVIEW_INTERNAL_URL
  || `http://127.0.0.1:${process.env.CONTAINER_PREVIEW_PORT || '3100'}`;

function getPreviewProxyPath(pathSegments: PreviewPathSegmentList): string {
  if (pathSegments.length === 0) {
    return '/';
  }

  const encodedSegments: string[] = [];
  for (const segment of pathSegments) {
    encodedSegments.push(encodeURIComponent(segment));
  }
  return `/${encodedSegments.join('/')}`;
}

function getPreviewProxyPublicShareBasePath(pathSegments: PreviewPathSegmentList): string {
  if (pathSegments.length === 0) {
    return '/preview';
  }

  const shareId = pathSegments[0]?.trim() || '';
  if (/^[A-Za-z0-9_-]{24,96}$/.test(shareId) === false) {
    return '/preview';
  }

  return `/preview/${encodeURIComponent(shareId)}`;
}

function getPreviewProxyTargetUrl(request: NextRequest, pathSegments: PreviewPathSegmentList): string {
  const baseUrl = new URL(previewGatewayInternalUrl);
  const targetUrl = new URL(baseUrl.toString());
  const basePath = baseUrl.pathname.replace(/\/$/, '');
  const previewPath = getPreviewProxyPath(pathSegments);
  targetUrl.pathname = `${basePath}${previewPath}`;
  targetUrl.search = request.nextUrl.search;
  return targetUrl.toString();
}

function getPreviewProxyRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey === 'host'
      || normalizedKey === 'content-length'
      || normalizedKey === 'accept-encoding'
      || normalizedKey === 'connection'
    ) {
      continue;
    }
    headers.set(key, value);
  }
  headers.set('x-forwarded-host', request.headers.get('host') || '');
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
  return headers;
}

async function getPreviewProxyRequestBody(request: NextRequest): Promise<ArrayBuffer | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined;
  }

  return request.arrayBuffer();
}

function getPreviewProxyResponseHeaders(response: Response): Headers {
  const headers = new Headers();
  for (const [key, value] of response.headers.entries()) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey === 'content-length'
      || normalizedKey === 'content-encoding'
      || normalizedKey === 'transfer-encoding'
      || normalizedKey === 'connection'
      || normalizedKey === 'set-cookie'
    ) {
      continue;
    }
    headers.set(key, value);
  }
  const cookieHeaders = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() || [];
  for (const cookieHeader of cookieHeaders) {
    headers.append('set-cookie', cookieHeader);
  }
  headers.set('cache-control', 'no-store');
  return headers;
}

function shouldRewritePreviewProxyHtml(response: Response): boolean {
  const contentType = response.headers.get('content-type') || '';
  return contentType.toLowerCase().includes('text/html');
}

function rewritePreviewProxyHtml(html: string, publicShareBasePath: string): string {
  const normalizedBasePath = publicShareBasePath.replace(/\/$/, '');
  return html
    .replace(/((?:src|href|action)=["'])\/(?!\/|preview(?:\/|\?))/g, `$1${normalizedBasePath}/`)
    .replace(/(url\(["']?)\/(?!\/|preview(?:\/|\?))/g, `$1${normalizedBasePath}/`);
}

async function buildPreviewProxyResponse(
  response: Response,
  publicShareBasePath: string,
): Promise<Response> {
  const headers = getPreviewProxyResponseHeaders(response);
  if (shouldRewritePreviewProxyHtml(response) === true) {
    const html = await response.text();
    return new Response(rewritePreviewProxyHtml(html, publicShareBasePath), {
      status: response.status,
      headers,
    });
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function buildPreviewProxyErrorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'unknown preview proxy error';
  return NextResponse.json({
    success: false,
    error: 'Preview proxy failed',
    details: message,
    source: 'next_preview_proxy',
    recovery: '确认内部 Preview Gateway 已启动，并检查 PREVIEW_GATEWAY_URL 或 CONTAINER_PREVIEW_PORT 配置。',
  }, { status: 502 });
}

export async function proxyPreviewRequest(
  request: NextRequest,
  pathSegments: PreviewPathSegmentList,
): Promise<Response> {
  try {
    const publicShareBasePath = getPreviewProxyPublicShareBasePath(pathSegments);
    const response = await fetch(getPreviewProxyTargetUrl(request, pathSegments), {
      method: request.method,
      headers: getPreviewProxyRequestHeaders(request),
      body: await getPreviewProxyRequestBody(request),
      redirect: 'manual',
      cache: 'no-store',
    });
    return buildPreviewProxyResponse(response, publicShareBasePath);
  } catch (error) {
    return buildPreviewProxyErrorResponse(error);
  }
}
