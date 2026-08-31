import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATH_PREFIXES = ['/workspace', '/projects'];

function isProtectedPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('yistack_token')?.value;
  if (token) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/auth', request.url);
  loginUrl.searchParams.set('redirect', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/workspace/:path*', '/projects/:path*'],
};
