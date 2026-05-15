import { NextRequest, NextResponse } from 'next/server';

const protectedRoutes = ['/dashboard', '/social', '/fitness', '/food-log', '/food-journal', '/recipes', '/calendar', '/ai-trainer', '/messages', '/notifications', '/profile', '/settings', '/membership', '/admin'];
const authRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  const isProtected = protectedRoutes.some(r => pathname.startsWith(r));
  const isAuth = authRoutes.some(r => pathname.startsWith(r));

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
  if (isAuth && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public).*)'],
};
