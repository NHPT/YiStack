import { NextRequest, NextResponse } from 'next/server';

import { API_CONFIG } from '@/lib/config/api';

type GitHubOAuthCallbackPayload = {
  success?: boolean;
  data?: { return_path?: string };
};

function safeReturnPath(value: string | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/projects';
  }
  return value;
}

export async function GET(request: NextRequest) {
  const backendURL = new URL(`${API_CONFIG.BACKEND_URL}/api/github/oauth/callback`);
  backendURL.search = request.nextUrl.search;
  try {
    const response = await fetch(backendURL, { method: 'GET', cache: 'no-store' });
    const payload = await response.json() as GitHubOAuthCallbackPayload;
    const returnPath = safeReturnPath(payload.data?.return_path);
    const redirectURL = new URL(returnPath, request.url);
    redirectURL.searchParams.set('github', response.ok && payload.success === true ? 'connected' : 'failed');
    return NextResponse.redirect(redirectURL);
  } catch {
    const redirectURL = new URL('/projects', request.url);
    redirectURL.searchParams.set('github', 'failed');
    return NextResponse.redirect(redirectURL);
  }
}
