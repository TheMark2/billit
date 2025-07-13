import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { cookies, nextUrl } = request;
  const accessToken = cookies.get('sb-access-token');

  const isAuth = !!accessToken?.value;
  const isDashboard = nextUrl.pathname.startsWith('/dashboard');
  const isAuthPage = nextUrl.pathname === '/login' || nextUrl.pathname === '/register';

  if (!isAuth && isDashboard) {
    const url = nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (isAuth && isAuthPage) {
    const url = nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
}; 