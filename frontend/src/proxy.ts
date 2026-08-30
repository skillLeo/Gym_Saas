import { NextRequest, NextResponse } from 'next/server';

const protectedRoutes = ['/dashboard', '/social', '/fitness', '/food-log', '/food-journal', '/recipes', '/calendar', '/ai-trainer', '/messages', '/notifications', '/profile', '/settings', '/membership', '/admin'];
const authRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password'];

/**
 * Pages that belong to a member's own body, diet and billing.
 *
 * An administrator has no personal food log, workout history or subscription, so
 * serving these to one is meaningless. Hiding them from the navigation was not
 * enough — typing the address still opened the page.
 */
const memberOnlyRoutes = [
  '/food-journal',
  '/food-log',
  '/fitness',
  '/recipes',
  '/calendar',
  '/membership',
  '/ai-trainer',
];

/**
 * Route protection at the edge.
 *
 * This is a navigation layer, NOT the security boundary. It reads a `user_role`
 * cookie, which the browser owns and can therefore edit. The boundary that
 * actually matters is the API: `admin` middleware returns 403 to members on
 * every /admin route, and `member` middleware returns 403 to admins on every
 * personal-data route. Even with a forged cookie, a member reaching /admin/users
 * gets a page whose every request is refused, and an admin reaching
 * /food-journal gets one that can load nothing.
 *
 * Three layers, deliberately: API middleware (real), this (navigation), and a
 * client-side guard (immediate feedback while the page hydrates).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;
  const role = request.cookies.get('user_role')?.value;

  const isProtected = protectedRoutes.some(r => pathname.startsWith(r));
  const isAuth = authRoutes.some(r => pathname.startsWith(r));

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
  if (isAuth && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // A member who reaches an admin page. `?denied=` lets the destination explain
  // why they were moved rather than bouncing them silently.
  if (token && role === 'member' && pathname.startsWith('/admin')) {
    const url = new URL('/dashboard', request.url);
    url.searchParams.set('denied', 'admin_only');
    return NextResponse.redirect(url);
  }

  // The member dashboard is nutrition rings and a food log. An administrator
  // has neither, so send them to the overview that actually has their data.
  if (token && role === 'admin' && pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // An admin who reaches a member-only page.
  if (token && role === 'admin' && memberOnlyRoutes.some(r => pathname === r || pathname.startsWith(`${r}/`))) {
    const url = new URL('/admin', request.url);
    url.searchParams.set('denied', 'member_only');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public).*)'],
};
