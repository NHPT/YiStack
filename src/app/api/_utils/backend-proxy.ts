import { NextRequest, NextResponse } from 'next/server';

import { API_CONFIG } from '@/lib/config/api';

type ProxyBodyMode = 'none' | 'json' | 'text';
type ProxyResponseMode = 'json' | 'text-or-json';

export type BackendProxyErrorBody = {
  success: false;
  error: string;
  details: string;
  source: 'next_api_proxy';
  reason_code: 'backend_unreachable' | 'proxy_error';
  recovery: string;
};

export type BackendProxyRequestHeaderMap = {
  [headerName: string]: string;
};

type ProxyErrorBody =
  | BackendProxyErrorBody
  | ((error: unknown) => BackendProxyErrorBody);

type ProxyRequestOptions = {
  method: string;
  backendPath: string;
  bodyMode?: ProxyBodyMode;
  responseMode?: ProxyResponseMode;
  includeJsonContentType?: boolean;
  errorStatus?: number;
  errorBody?: ProxyErrorBody;
  cache?: RequestCache;
  forwardHeaders?: string[];
};

function readProxyErrorReason(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message.trim()
    : 'Unknown proxy error';
}

function isBackendUnreachableError(error: unknown, reason: string) {
  if (reason.toLowerCase() === 'fetch failed') {
    return true;
  }

  const cause = error instanceof Error ? error.cause : undefined;
  if (!(cause instanceof Error)) {
    return false;
  }

  const causeMessage = cause.message.toLowerCase();
  return causeMessage.includes('econnrefused')
    || causeMessage.includes('connection refused')
    || causeMessage.includes('failed to connect');
}

export function buildBackendProxyErrorBody(scope: string, error: unknown): BackendProxyErrorBody {
  const originalReason = readProxyErrorReason(error);
  const backendUnreachable = isBackendUnreachableError(error, originalReason);
  const reason = backendUnreachable
    ? `Backend is unreachable from the Next.js proxy. Verify the Go backend is running and BACKEND_URL points to a reachable /api/health endpoint. Original error: ${originalReason}`
    : originalReason;
  return {
    success: false,
    error: `${scope} proxy failed`,
    details: reason,
    source: 'next_api_proxy',
    reason_code: backendUnreachable ? 'backend_unreachable' : 'proxy_error',
    recovery: backendUnreachable
      ? 'Start or restart the YiStack Go backend, then verify /api/health before retrying this page.'
      : 'Check the Next.js proxy logs and backend response format, then retry the request.',
  };
}

function buildProxyHeaders(
  request: NextRequest,
  includeJsonContentType: boolean,
  forwardHeaders: string[] = [],
): BackendProxyRequestHeaderMap {
  const authHeader = request.headers.get('Authorization');
  const headers: BackendProxyRequestHeaderMap = {};

  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }

  if (authHeader) {
    headers.Authorization = authHeader;
  }

  const lastEventId = request.headers.get('Last-Event-ID');
  if (lastEventId) {
    headers['Last-Event-ID'] = lastEventId;
  }

  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  for (const headerName of forwardHeaders) {
    const value = request.headers.get(headerName);
    if (value) {
      headers[headerName] = value;
    }
  }

  return headers;
}

async function buildProxyBody(request: NextRequest, bodyMode: ProxyBodyMode) {
  if (bodyMode === 'none') {
    return undefined;
  }

  return request.text();
}

async function fetchBackendResponse(
  request: NextRequest,
  options: ProxyRequestOptions,
) {
  const {
    method,
    backendPath,
    bodyMode = 'none',
    includeJsonContentType = bodyMode === 'json',
    cache,
    forwardHeaders,
  } = options;

  return fetch(`${API_CONFIG.BACKEND_URL}${backendPath}`, {
    method,
    headers: buildProxyHeaders(request, includeJsonContentType, forwardHeaders),
    body: await buildProxyBody(request, bodyMode),
    cache,
  });
}

async function buildProxyResponse(response: Response, responseMode: ProxyResponseMode) {
  if (responseMode === 'json') {
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  }

  const rawText = await response.text();
  let data: unknown = {};

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Could not parse backend response as JSON';
    data = response.ok
      ? {
        success: true,
        data: rawText,
        details,
        source: 'backend_text_response',
      }
      : {
        success: false,
        error: rawText || `Request failed: ${response.status}`,
        details,
        source: 'backend_text_response',
      };
  }

  return NextResponse.json(data, { status: response.status });
}

function buildErrorResponse(
  error: unknown,
  errorBody: ProxyErrorBody | undefined,
  errorStatus: number,
) {
  const payload = typeof errorBody === 'function'
    ? errorBody(error)
    : (errorBody ?? buildBackendProxyErrorBody('backend request', error));

  return NextResponse.json(payload, { status: errorStatus });
}

export async function proxyBackendRequest(
  request: NextRequest,
  options: ProxyRequestOptions,
) {
  const {
    responseMode = 'json',
    errorStatus = 500,
    errorBody,
  } = options;

  try {
    const response = await fetchBackendResponse(request, options);
    return buildProxyResponse(response, responseMode);
  } catch (error) {
    return buildErrorResponse(error, errorBody, errorStatus);
  }
}

export async function proxyBackendStreamRequest(
  request: NextRequest,
  options: ProxyRequestOptions,
) {
  const {
    errorStatus = 500,
    errorBody,
  } = options;

  try {
    const response = await fetchBackendResponse(request, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorBody: unknown = {
        success: false,
        error: errorText || 'Backend error',
      };

      try {
        errorBody = errorText ? JSON.parse(errorText) : errorBody;
      } catch {
        // Keep the text fallback for non-JSON stream errors.
      }

      return NextResponse.json(
        errorBody,
        { status: response.status },
      );
    }

    if (!response.body) {
      return NextResponse.json(
        { success: false, error: 'Backend stream unavailable' },
        { status: 502 },
      );
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Generation-Job-ID': response.headers.get('X-Generation-Job-ID') ?? '',
      },
    });
  } catch (error) {
    return buildErrorResponse(error, errorBody, errorStatus);
  }
}

const binaryProxyResponseHeaders = [
  'Content-Type',
  'Content-Length',
  'Content-Disposition',
  'X-YiStack-Project-ID',
  'X-YiStack-Backup-ID',
  'X-YiStack-Backup-Manifest',
  'X-YiStack-Backup-Checksum-SHA256',
  'X-YiStack-Backup-Checksum-Verified',
];

export async function proxyBackendBinaryRequest(
  request: NextRequest,
  options: ProxyRequestOptions,
) {
  const {
    errorStatus = 500,
    errorBody,
  } = options;

  try {
    const response = await fetchBackendResponse(request, options);

    if (!response.ok) {
      const rawText = await response.text();
      let data: unknown = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {
          success: false,
          error: rawText || `Request failed: ${response.status}`,
          source: 'backend_binary_response',
        };
      }
      return NextResponse.json(data, { status: response.status });
    }

    if (!response.body) {
      return NextResponse.json(
        { success: false, error: 'Backend binary stream unavailable' },
        { status: 502 },
      );
    }

    const headers = new Headers();
    for (const headerName of binaryProxyResponseHeaders) {
      const value = response.headers.get(headerName);
      if (value) {
        headers.set(headerName, value);
      }
    }
    headers.set('Cache-Control', 'no-store');

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    return buildErrorResponse(error, errorBody, errorStatus);
  }
}
